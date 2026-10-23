"""Read-only simulator NAVDB proximity queries; non-AIRAC data never FMC-active."""
import math
import sqlite3

EARTH_NM = 3440.065

def distance_nm(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2-p1, math.radians(lon2-lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*EARTH_NM*math.asin(min(1.0, math.sqrt(a)))

def find_navaids(db, ident=None, near=None, radius_nm=100, limit=50):
    if not 1 <= limit <= 500: raise ValueError('limit must be 1..500')
    if not 0 < radius_nm <= 10000: raise ValueError('invalid radius')
    if near is not None and not (-90 <= near[0] <= 90 and -180 <= near[1] <= 180):
        raise ValueError('invalid coordinates')
    if not ident and near is None: raise ValueError('ident or near required')
    with sqlite3.connect(f'file:{db}?mode=ro', uri=True) as con:
        con.row_factory = sqlite3.Row
        if ident:
            rows = con.execute(
                'SELECT n.*, s.name source, s.sha256 source_sha256 FROM navaids n '
                'JOIN sources s ON n.source_id=s.id WHERE UPPER(n.ident)=?',
                (ident.upper(),)).fetchall()
        else:
            lat, lon = near
            span = radius_nm/60
            rows = con.execute(
                'SELECT n.*, s.name source, s.sha256 source_sha256 FROM navaids n '
                'JOIN sources s ON n.source_id=s.id WHERE n.lat BETWEEN ? AND ?',
                (max(-90,lat-span),min(90,lat+span))).fetchall()
        found = []
        for r in rows:
            x = dict(r)
            if near is not None:
                d = distance_nm(near[0],near[1],x['lat'],x['lon'])
                if d > radius_nm: continue
                x['surface_distance_nm'] = round(d,2)
            x['validation_status'] = 'COMMUNITY_UNVERIFIED_NOT_FMC_READY'
            found.append(x)
        if near is not None: found.sort(key=lambda x:x['surface_distance_nm'])
        return found[:limit]

def readiness(db):
    with sqlite3.connect(f'file:{db}?mode=ro', uri=True) as con:
        counts = {t:con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in (
            'airports','runways','navaids','frequencies','waypoints','airways',
            'procedures','procedure_legs','faa_raw','rejected')}
    return {'counts':counts, 'fmc_active':False,
            'status':'NAVDB_SOURCE_LIBRARY_ONLY',
            'reasons':['Iran-only OurAirports data are non-AIRAC',
                       'Iranian SID/STAR/APP and airways still require verified import',
                       'EP-FSI FMC integration requires verification']}
