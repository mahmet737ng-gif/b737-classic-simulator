#!/usr/bin/env python3
"""Versioned aviation navigation-data ingest and read-only simulator queries.

OurAirports: globally available non-AIRAC community source.
FAA CIFP: raw 132-char ARINC 424 records are STAGED, NOT decoded/activated.
Not for real-world navigation.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import urllib.request
import zipfile

BASE_URL = 'https://davidmegginson.github.io/ourairports-data/'
FILES = {'airports.csv': 'airports', 'runways.csv': 'runways',
         'navaids.csv': 'navaids', 'airport-frequencies.csv': 'frequencies'}
SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE sources (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, filename TEXT NOT NULL,
  retrieved_utc TEXT NOT NULL, sha256 TEXT NOT NULL, license TEXT NOT NULL,
  cycle TEXT, UNIQUE(name,filename,sha256));
CREATE TABLE airports (
  id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id),
  ident TEXT, icao TEXT, iata TEXT, name TEXT NOT NULL, country TEXT,
  municipality TEXT, lat REAL, lon REAL, elevation_ft REAL, airport_type TEXT,
  CHECK(lat BETWEEN -90 AND 90), CHECK(lon BETWEEN -180 AND 180));
CREATE INDEX airport_icao_idx ON airports(icao);
CREATE INDEX airport_iata_idx ON airports(iata);
CREATE TABLE runways (
  id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id),
  airport_id INTEGER NOT NULL REFERENCES airports(id),
  le_ident TEXT, he_ident TEXT, length_ft REAL, width_ft REAL, surface TEXT,
  le_lat REAL, le_lon REAL, he_lat REAL, he_lon REAL);
CREATE INDEX runway_airport_idx ON runways(airport_id);
CREATE TABLE navaids (
  id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id),
  ident TEXT, name TEXT, type TEXT, frequency_khz REAL, lat REAL, lon REAL,
  elevation_ft REAL, magnetic_variation_deg REAL, associated_airport TEXT,
  CHECK(lat BETWEEN -90 AND 90), CHECK(lon BETWEEN -180 AND 180));
CREATE INDEX navaid_ident_idx ON navaids(ident);
CREATE TABLE frequencies (
  id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id),
  airport_id INTEGER NOT NULL REFERENCES airports(id),
  type TEXT, description TEXT, frequency_mhz REAL);
CREATE INDEX freq_airport_idx ON frequencies(airport_id);
CREATE TABLE faa_raw (
  id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id),
  line_no INTEGER NOT NULL, section TEXT, subsection TEXT, raw_record TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'STAGED_UNVERIFIED',
  CHECK(length(raw_record)=132), UNIQUE(source_id,line_no));
CREATE INDEX faa_section_idx ON faa_raw(section,subsection);
CREATE TABLE rejected (
  id INTEGER PRIMARY KEY, filename TEXT NOT NULL, row_no INTEGER NOT NULL,
  reason TEXT NOT NULL);
CREATE TABLE airac_cycles (
  source TEXT PRIMARY KEY, cycle TEXT, effective TEXT, expires TEXT,
  state TEXT NOT NULL);
CREATE TABLE procedures (
  id INTEGER PRIMARY KEY, airport_icao TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('SID','STAR','APP')),
  ident TEXT NOT NULL, transition_ident TEXT, runway TEXT,
  source_id INTEGER REFERENCES sources(id), cycle TEXT,
  status TEXT NOT NULL DEFAULT 'UNVERIFIED');
CREATE TABLE procedure_legs (
  id INTEGER PRIMARY KEY, procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  seq INTEGER NOT NULL, path_terminator TEXT, fix_ident TEXT,
  altitude_constraint TEXT, speed_constraint TEXT, raw_record_ref INTEGER REFERENCES faa_raw(id),
  UNIQUE(procedure_id,seq));
CREATE TABLE waypoints (
  id INTEGER PRIMARY KEY, ident TEXT NOT NULL, region TEXT,
  lat REAL, lon REAL, source_id INTEGER REFERENCES sources(id),
  cycle TEXT, status TEXT NOT NULL DEFAULT 'UNVERIFIED');
CREATE TABLE airways (
  id INTEGER PRIMARY KEY, ident TEXT NOT NULL, waypoint_id INTEGER REFERENCES waypoints(id),
  seq INTEGER, source_id INTEGER REFERENCES sources(id),
  cycle TEXT, status TEXT NOT NULL DEFAULT 'UNVERIFIED');
'''

def num(value):
    if not value: return None
    try: return float(value)
    except (ValueError, TypeError): return None

def whole(value):
    if not value: return None
    try: return int(value)
    except (ValueError, TypeError): return None

def valid_coord(lat, lon):
    return (lat is not None and lon is not None
            and -90 <= lat <= 90 and -180 <= lon <= 180)

def get_file(path, allow_network):
    if path.is_file(): return
    if not allow_network: raise FileNotFoundError(f'Missing offline input: {path}')
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(BASE_URL+path.name, timeout=120) as response, path.open('wb') as out:
        shutil.copyfileobj(response, out)

def stage_faa(con, faa_path, cycle):
    """Safely stage ARINC raw text; do NOT invent ARINC field decoding."""
    if not cycle or len(cycle)!=6 or not cycle.isdigit():
        raise ValueError('FAA cycle must be YYMMDD (e.g. 261001)')
    if faa_path.suffix.lower()=='.zip':
        with zipfile.ZipFile(faa_path) as archive:
            entries=[n for n in archive.namelist() if Path(n).name.upper().startswith('FAACIFP') and not n.endswith('/')]
            if len(entries)!=1: raise ValueError('FAA ZIP must have exactly one FAACIFP record file')
            info=archive.getinfo(entries[0])
            if info.file_size>250_000_000: raise ValueError('FAA data exceeds safety limit')
            data=archive.read(info)
    else:
        data=faa_path.read_bytes()
    if len(data)>250_000_000: raise ValueError('FAA data exceeds safety limit')
    digest=hashlib.sha256(data).hexdigest()
    source_id=con.execute('INSERT INTO sources(name,filename,retrieved_utc,sha256,license,cycle) VALUES(?,?,?,?,?,?)',
        ('FAA CIFP',faa_path.name,datetime.now(timezone.utc).isoformat(),digest,'FAA public data; check provider terms',cycle)).lastrowid
    count=0; rejected=0
    for line_no, raw in enumerate(data.splitlines(),1):
        record=raw.decode('latin-1')
        if len(record)!=132 or record[0] not in ('S','T'):
            con.execute('INSERT INTO rejected(filename,row_no,reason) VALUES(?,?,?)',('FAA CIFP',line_no,'invalid record width/type'))
            rejected+=1; continue
        # Preserve every record exactly; identifying fields require record-specific ARINC layouts.
        con.execute('INSERT INTO faa_raw(source_id,line_no,section,subsection,raw_record) VALUES(?,?,?,?,?)',
                    (source_id,line_no,None,None,record)); count+=1
    con.execute('INSERT INTO airac_cycles VALUES(?,?,?,?,?)',('FAA CIFP',cycle,None,None,'STAGED_NOT_FMC_READY'))
    return {'staged_faa_records':count, 'rejected_faa_records':rejected}

def build(data_dir, db_path, allow_network=False, faa_path=None, faa_cycle=None):
    data_dir=Path(data_dir); db_path=Path(db_path)
    db_path.parent.mkdir(parents=True,exist_ok=True)
    fd, name=tempfile.mkstemp(prefix='.navdb-',suffix='.sqlite',dir=str(db_path.parent)); os.close(fd)
    tmp=Path(name)
    stats={}; seen=set()
    con=None
    try:
        con=sqlite3.connect(tmp)
        con.executescript(SCHEMA)
        con.execute('BEGIN')
        sid={}
        for filename in FILES:
            path=data_dir/filename
            get_file(path,allow_network)
            sid[filename]=con.execute('INSERT INTO sources(name,filename,retrieved_utc,sha256,license,cycle) VALUES(?,?,?,?,?,?)',
                ('OurAirports',filename,datetime.now(timezone.utc).isoformat(),hashlib.sha256(path.read_bytes()).hexdigest(),'Public Domain',None)).lastrowid
        for filename, table in FILES.items():
            accepted=0; errors=0
            with (data_dir/filename).open(encoding='utf-8-sig',newline='') as fh:
                reader=csv.DictReader(fh)
                for line,row in enumerate(reader,2):
                    try:
                        if table=='airports':
                            lat,lon=num(row.get('latitude_deg')),num(row.get('longitude_deg'))
                            if not valid_coord(lat,lon): raise ValueError('bad airport coordinates')
                            con.execute('INSERT INTO airports VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                                (whole(row['id']),sid[filename],row.get('ident'),row.get('icao_code'),row.get('iata_code'),row['name'],row.get('iso_country'),row.get('municipality'),lat,lon,num(row.get('elevation_ft')),row.get('type')))
                            seen.add(whole(row['id']))
                        elif table=='runways':
                            airport_id=whole(row.get('airport_ref'))
                            if airport_id not in seen: raise ValueError('missing airport reference')
                            con.execute('INSERT INTO runways VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                                (whole(row['id']),sid[filename],airport_id,row.get('le_ident'),row.get('he_ident'),num(row.get('length_ft')),num(row.get('width_ft')),row.get('surface'),num(row.get('le_latitude_deg')),num(row.get('le_longitude_deg')),num(row.get('he_latitude_deg')),num(row.get('he_longitude_deg'))))
                        elif table=='navaids':
                            lat,lon=num(row.get('latitude_deg')),num(row.get('longitude_deg'))
                            if not valid_coord(lat,lon): raise ValueError('bad navaid coordinates')
                            con.execute('INSERT INTO navaids VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                                (whole(row['id']),sid[filename],row.get('ident'),row.get('name'),row.get('type'),num(row.get('frequency_khz')),lat,lon,num(row.get('elevation_ft')),num(row.get('magnetic_variation_deg')),row.get('associated_airport')))
                        else:
                            airport_id=whole(row.get('airport_ref'))
                            if airport_id not in seen: raise ValueError('missing airport reference')
                            con.execute('INSERT INTO frequencies VALUES(?,?,?,?,?,?)',
                                (whole(row['id']),sid[filename],airport_id,row.get('type'),row.get('description'),num(row.get('frequency_mhz'))))
                        accepted+=1
                    except (ValueError,KeyError,sqlite3.IntegrityError) as ex:
                        con.execute('INSERT INTO rejected(filename,row_no,reason) VALUES(?,?,?)',(filename,line,str(ex)[:200]))
                        errors+=1
            stats[table]={'accepted':accepted,'rejected':errors}
        con.execute('INSERT INTO airac_cycles VALUES(?,?,?,?,?)',('OurAirports',None,None,None,'NON_AIRAC_UNVERIFIED'))
        if faa_path:
            stats['faa']=stage_faa(con,Path(faa_path),faa_cycle)
        con.commit()
        bad=con.execute('PRAGMA foreign_key_check').fetchall()
        if bad: raise ValueError(f'Foreign key validation failure: {bad[:5]}')
        if any(v['accepted']==0 for k,v in stats.items() if k!='faa'):
            raise ValueError('Required OurAirports table unexpectedly empty')
        con.close(); con=None
        os.replace(tmp,db_path)
        return stats
    finally:
        if con is not None: con.close()
        if tmp.exists(): tmp.unlink()

def airport(con, ident):
    con.row_factory=sqlite3.Row
    ident=ident.upper().strip()
    row=con.execute('SELECT * FROM airports WHERE icao=? OR iata=? OR ident=? ORDER BY CASE WHEN icao=? THEN 0 ELSE 1 END LIMIT 1',
                    (ident,ident,ident,ident)).fetchone()
    if row is None: return None
    r=dict(row)
    r['runways']=[dict(x) for x in con.execute('SELECT * FROM runways WHERE airport_id=? ORDER BY le_ident',(r['id'],))]
    r['frequencies']=[dict(x) for x in con.execute('SELECT * FROM frequencies WHERE airport_id=?',(r['id'],))]
    r['data_status']='COMMUNITY_UNVERIFIED_NOT_FMC_READY'
    return r

def summary(con):
    counts={table:con.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in
            ('airports','runways','navaids','frequencies','faa_raw','waypoints','airways','procedures','procedure_legs','rejected')}
    return {'counts':counts,'cycles':con.execute('SELECT * FROM airac_cycles').fetchall()}

def cli():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='cmd',required=True)
    b=sub.add_parser('build'); b.add_argument('--data-dir',type=Path,default=Path('data')); b.add_argument('--db',type=Path,default=Path('navdb.sqlite')); b.add_argument('--download',action='store_true'); b.add_argument('--faa-file',type=Path); b.add_argument('--faa-cycle')
    q=sub.add_parser('airport'); q.add_argument('ident'); q.add_argument('--db',type=Path,default=Path('navdb.sqlite'))
    s=sub.add_parser('summary'); s.add_argument('--db',type=Path,default=Path('navdb.sqlite'))
    e=sub.add_parser('export'); e.add_argument('ident',nargs='+'); e.add_argument('--db',type=Path,default=Path('navdb.sqlite')); e.add_argument('--output',type=Path,required=True)
    a=parser.parse_args()
    if a.cmd=='build': result=build(a.data_dir,a.db,a.download,a.faa_file,a.faa_cycle)
    else:
        with sqlite3.connect(a.db) as con:
            if a.cmd=='airport': result=airport(con,a.ident)
            elif a.cmd=='summary': result=summary(con)
            else:
                result={ident:airport(con,ident) for ident in a.ident}
                a.output.parent.mkdir(parents=True,exist_ok=True)
                a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2,default=list),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2,default=list))

if __name__=='__main__': cli()
