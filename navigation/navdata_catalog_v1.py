#!/usr/bin/env python3
"""Private AIRAC 2610 Stage-1 lookup facade for B737 Classic CDU development.

Uses the verified source SQLite indexes directly; it does not copy licensed
NAVDATA into the repo, generate flight legs or activate an FMC database.
For simulator/trainer reference only; never use for navigation.
"""
import argparse
import json
from pathlib import Path
import re
import sqlite3

CYCLE = '2610'
MARKER = '//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
INDEXES = {
    'airports': 'idx_airports_icao',
    'runways': 'idx_rwy_icao',
    'navaids': 'idx_navaids_ident',
    'waypoints': 'idx_waypoints_ident',
    'airways': 'idx_airways_ident_seq',
    'procedures': 'navdb_procedure_ident_idx',
}

class CatalogError(ValueError):
    pass


def _ident(value, pattern=r'[A-Z0-9]{1,12}'):
    if not isinstance(value, str):
        raise CatalogError('IDENT_REQUIRED')
    value = value.upper().strip()
    if not re.fullmatch(pattern, value, re.ASCII):
        raise CatalogError('INVALID_IDENT')
    return value


def _limit(value):
    if type(value) is not int or value < 1 or value > 100:
        raise CatalogError('LIMIT_OUT_OF_RANGE_1_TO_100')
    return value


class NavCatalog:
    """Read-only catalog; uses existing btree indexes in private DB."""
    def __init__(self, path):
        self.path = Path(path).expanduser().resolve(strict=True)
        self.db = sqlite3.connect(self.path.as_uri() + '?mode=ro', uri=True)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA query_only=ON')
        try:
            self._verify()
        except Exception:
            self.close()
            raise

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def close(self):
        self.db.close()

    def _verify(self):
        batches = self.db.execute(
            'SELECT airac_cycle,marker,status FROM navdata_import_batches'
        ).fetchall()
        runs = self.db.execute(
            'SELECT source_marker,status FROM npe_decoder_runs'
        ).fetchall()
        if (len(batches) != 1 or len(runs) != 1 or
            tuple(batches[0]) != (CYCLE, MARKER, 'IMPORTED_RAW_FMC_BLOCKED') or
            tuple(runs[0]) != (MARKER, 'SOURCE_AST_NON_EXECUTABLE')):
            raise CatalogError('AIRAC_SOURCE_PROVENANCE_MISMATCH')
        if self.db.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0] != 0:
            raise CatalogError('UNEXPECTED_EXECUTABLE_PROCEDURE_LEGS')
        existing = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        )}
        missing = set(INDEXES.values()) - existing
        if missing:
            raise CatalogError('NAVDATA_SOURCE_INDEX_MISSING:' + ','.join(sorted(missing)))

    def _query(self, sql, params, limit=50):
        limit = _limit(limit)
        rows = [dict(x) for x in self.db.execute(sql + ' LIMIT ?', (*params, limit + 1))]
        more = len(rows) > limit
        return {'rows': rows[:limit], 'has_more': more,
                'matches_in_page': min(len(rows), limit),
                'fmc_executable': False, 'source_cycle': CYCLE}

    def airport(self, icao):
        icao = _ident(icao, r'[A-Z]{4}')
        return self._query('SELECT id,icao,lat,lon,source_file,source_line '
                           'FROM airports WHERE icao=? ORDER BY id', (icao,))

    def runways(self, icao, limit=50):
        icao = _ident(icao, r'[A-Z]{4}')
        return self._query('SELECT id,airport_icao,runway_ident,length_ft,'
                           'magnetic_bearing,lat,lon,ils_frequency_mhz,'
                           'localizer_course,elevation_ft,source_file,source_line '
                           'FROM runways WHERE airport_icao=? ORDER BY runway_ident,id',
                           (icao,), limit)

    def fix(self, ident, kind='waypoints', limit=50):
        ident = _ident(ident)
        if kind not in ('waypoints', 'navaids'):
            raise CatalogError('INVALID_FIX_KIND')
        columns = ('id,ident,display_name,lat,lon,source_file,source_line'
                   if kind == 'waypoints' else
                   'id,ident,name,type,frequency,frequency_unit,lat,lon,source_file,source_line')
        # kind and columns are hardcoded allowlisted SQL fragments, never user SQL.
        result = self._query(f'SELECT {columns} FROM {kind} WHERE ident=? ORDER BY id',
                             (ident,), limit)
        result['resolution'] = ('MULTIPLE_SOURCE_CANDIDATES_SELECT_EXACT_ID'
                                if result['has_more'] or len(result['rows']) > 1
                                else 'ONE_MATCH' if result['rows'] else 'NOT_FOUND')
        return result

    def airway(self, ident, limit=100):
        ident = _ident(ident)
        return self._query('SELECT id,ident,seq,fix_ident,lat,lon,source_file,source_line '
                           'FROM airways WHERE ident=? ORDER BY seq,id', (ident,), limit)

    def procedures(self, icao, kind, limit=100):
        icao = _ident(icao, r'[A-Z]{4}')
        if kind not in ('SID', 'STAR', 'APP'):
            raise CatalogError('INVALID_PROCEDURE_KIND')
        return self._query('SELECT p.id,p.airport_icao,p.kind,p.ident,p.status,'
                           'd.parse_status,d.fmc_status,d.runway_reference_json,'
                           'd.transition_labels_json FROM procedures p '
                           'JOIN npe_decoded_procedures d ON d.procedure_id=p.id '
                           'WHERE p.airport_icao=? AND p.kind=? '
                           'ORDER BY p.ident,p.id', (icao, kind), limit)

    def summary(self):
        counts = {table: self.db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                  for table in (*INDEXES, 'procedure_legs')}
        return {'source_cycle': CYCLE, 'provenance': 'VERIFIED_STAGE1_SOURCE',
                'sqlite_indexes': INDEXES, 'records': counts,
                'fmc_executable': False, 'procedure_leg_encoding_validated': False,
                'license': 'PRIVATE_LOCAL_ONLY_NO_REDISTRIBUTION'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, help='PRIVATE AIRAC 2610 Stage1 SQLite')
    cmd = parser.add_subparsers(dest='cmd', required=True)
    cmd.add_parser('summary')
    ap = cmd.add_parser('airport'); ap.add_argument('icao')
    rw = cmd.add_parser('runways'); rw.add_argument('icao')
    fix = cmd.add_parser('fix'); fix.add_argument('ident'); fix.add_argument('--kind', choices=('waypoints','navaids'),default='waypoints')
    airway = cmd.add_parser('airway'); airway.add_argument('ident')
    pr = cmd.add_parser('procedures'); pr.add_argument('icao'); pr.add_argument('kind', choices=('SID','STAR','APP'))
    args = parser.parse_args()
    with NavCatalog(args.db) as nav:
        if args.cmd == 'summary': result = nav.summary()
        elif args.cmd == 'airport': result = nav.airport(args.icao)
        elif args.cmd == 'runways': result = nav.runways(args.icao)
        elif args.cmd == 'fix': result = nav.fix(args.ident, args.kind)
        elif args.cmd == 'airway': result = nav.airway(args.ident)
        else: result = nav.procedures(args.icao, args.kind)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
