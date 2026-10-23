#!/usr/bin/env python3
"""B737 simulator Stage 3: flight-leg geometry primitives (non-navigational preview).

All bearings must have an explicit frame. Variation must be supplied for MAG.
All airspeed, bank and wind inputs must be explicitly supplied. These are
mathematical laboratory previews, NOT PMDG/FMC path-terminator execution.
Never use for operational navigation.
"""
from __future__ import annotations
from dataclasses import dataclass
import math

EARTH_RADIUS_NM = 3440.065
NM_TO_M = 1852.0
G = 9.80665


def finite(v: float, name: str) -> float:
    if not isinstance(v, (float, int)) or isinstance(v, bool) or not math.isfinite(v):
        raise ValueError(f'{name} must be finite numeric')
    return float(v)


def latitude_longitude(lat: float, lon: float) -> tuple[float, float]:
    lat, lon = finite(lat, 'latitude'), finite(lon, 'longitude')
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError('lat/lon out of range')
    return lat, lon


def bearing(value: float) -> float:
    v = finite(value, 'bearing')
    if not 0 <= v <= 360:
        raise ValueError('bearing must be 0..360')
    return v % 360


def true_bearing(value: float, *, frame: str, variation_east_deg: float | None = None) -> float:
    """Variation positive EAST; true = magnetic + east variation.

    For MAG a caller-provided, validated variation is REQUIRED, not derived
    from the source runway bearing or a default country value.
    """
    v = bearing(value)
    if frame == 'TRUE':
        if variation_east_deg is not None:
            raise ValueError('variation on TRUE bearing is ambiguous')
        return v
    if frame != 'MAG':
        raise ValueError('frame must be TRUE or MAG')
    if variation_east_deg is None:
        raise ValueError('MAG bearing requires explicit verified east variation')
    d = finite(variation_east_deg, 'variation')
    if abs(d) > 45:
        raise ValueError('variation outside approved lab bounds')
    return (v + d) % 360


def norm(v): return math.sqrt(sum(x*x for x in v))
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def unit(a):
    n = norm(a)
    if n < 1e-14: raise ValueError('degenerate vector')
    return tuple(x/n for x in a)


def earth_vector(lat,lon):
    lat,lon=latitude_longitude(lat,lon)
    p,l=math.radians(lat),math.radians(lon)
    return (math.cos(p)*math.cos(l),math.cos(p)*math.sin(l),math.sin(p))


def vector_location(v):
    x,y,z=unit(v)
    lon=(math.degrees(math.atan2(y,x))+180)%360-180
    return (math.degrees(math.atan2(z,math.hypot(x,y))),lon)


def true_direction_vector(lat,lon,true_deg):
    lat,lon=latitude_longitude(lat,lon);angle=math.radians(bearing(true_deg))
    p,l=math.radians(lat),math.radians(lon)
    e=(-math.sin(l),math.cos(l),0.0)
    n=(-math.sin(p)*math.cos(l),-math.sin(p)*math.sin(l),math.cos(p))
    return tuple(n[i]*math.cos(angle)+e[i]*math.sin(angle) for i in range(3))


def destination_nm(lat,lon,bearing_true,distance_nm):
    d=finite(distance_nm,'distance')
    if not 0 <= d <= math.pi*EARTH_RADIUS_NM:
        raise ValueError('distance must be nonnegative and <= half Earth circumference')
    p=earth_vector(lat,lon);t=true_direction_vector(lat,lon,bearing_true)
    delta=d/EARTH_RADIUS_NM
    return vector_location(tuple(math.cos(delta)*p[i]+math.sin(delta)*t[i] for i in range(3)))


def distance_nm(lat1,lon1,lat2,lon2):
    a,b=earth_vector(lat1,lon1),earth_vector(lat2,lon2)
    return EARTH_RADIUS_NM * math.atan2(norm(cross(a,b)), max(-1.0,min(1.0,dot(a,b))))


def initial_course_true(lat1,lon1,lat2,lon2):
    a,b=earth_vector(lat1,lon1),earth_vector(lat2,lon2)
    if norm(cross(a,b)) < 1e-12: raise ValueError('coincident or antipodal points')
    east=true_direction_vector(lat1,lon1,90)
    north=true_direction_vector(lat1,lon1,0)
    t=tuple(b[i]-dot(b,a)*a[i] for i in range(3))
    return math.degrees(math.atan2(dot(t,east),dot(t,north)))%360


def intersect_forward_rays(start_a,course_a_true,start_b,course_b_true, *, max_nm=350.0):
    """Intersection of two directed great-circle rays; no path terminator inference.

    Rejects parallel/coincident circles, ambiguous two-forward candidates,
    and intersection beyond caller's explicit range bound.
    """
    cap=finite(max_nm,'maximum range')
    if not 0 < cap < 0.49*math.pi*EARTH_RADIUS_NM: raise ValueError('invalid intercept range')
    a=earth_vector(*start_a);b=earth_vector(*start_b)
    na=unit(cross(a,true_direction_vector(*start_a,course_a_true)))
    nb=unit(cross(b,true_direction_vector(*start_b,course_b_true)))
    line=cross(na,nb)
    if norm(line)<1e-10: raise ValueError('parallel, coincident or numerically unstable rays')
    candidates=[]
    for p in (unit(line),tuple(-x for x in unit(line))):
        def forward_angle(src,n):
            angle=math.atan2(dot(cross(src,p),n),dot(src,p))
            if angle < -1e-10: angle+=2*math.pi
            return angle
        ar,br=forward_angle(a,na),forward_angle(b,nb)
        if ar>1e-8 and br>1e-8 and ar*EARTH_RADIUS_NM<=cap and br*EARTH_RADIUS_NM<=cap:
            candidates.append((p,ar*EARTH_RADIUS_NM,br*EARTH_RADIUS_NM))
    if len(candidates)!=1:raise ValueError('no unique forward intercept within range')
    point,da,db=candidates[0]
    lat,lon=vector_location(point)
    return {'lat':lat,'lon':lon,'distance_a_nm':da,'distance_b_nm':db,
            'status':'MATHEMATICAL_INTERSECTION_ONLY'}


def ground_vector_from_heading(heading_true, tas_kt, wind_from_true, wind_kt):
    """Ground velocity components (east,north), explicitly heading vs track."""
    v=finite(tas_kt,'TAS'); w=finite(wind_kt,'wind speed')
    if v<=0 or w<0 or w>400: raise ValueError('invalid TAS/wind')
    hdg=math.radians(bearing(heading_true))
    wind_to=math.radians((bearing(wind_from_true)+180)%360)
    east=v*math.sin(hdg)+w*math.sin(wind_to)
    north=v*math.cos(hdg)+w*math.cos(wind_to)
    groundspeed=math.hypot(east,north)
    if groundspeed<=1e-9:raise ValueError('no defined ground track: zero ground velocity')
    return {'ground_track_true_deg':math.degrees(math.atan2(east,north))%360,
            'groundspeed_kt':groundspeed,'east_kt':east,'north_kt':north}


def turn_radius_nm(tas_kt,bank_deg):
    tas,bank=finite(tas_kt,'TAS'),finite(bank_deg,'bank')
    if not 1<=tas<=600 or not 1<=bank<=35:raise ValueError('TAS or bank outside preview envelope')
    ms=tas*NM_TO_M/3600
    return ms*ms/(G*math.tan(math.radians(bank)))/NM_TO_M


def turn_preview(start_lat,start_lon,start_heading_true,turn_deg,turn_dir, *, tas_kt,bank_deg,
                 wind_from_true,wind_kt,steps=36):
    """Constant bank/TAS, piecewise local geodesic integration, synthetic preview.

    Aircraft heading rotates at v/r in still-air turn dynamics; wind affects
    the ground track, NOT the bank/heading angular velocity. Turn starts at a
    known *heading*, not a synthetic fix-to-fix heading inferred from an AST.
    """
    latitude_longitude(start_lat,start_lon);heading=bearing(start_heading_true)
    angle=finite(turn_deg,'turn degrees')
    if not 0<angle<=360 or turn_dir not in ('LEFT','RIGHT'):
        raise ValueError('turn angle must be (0,360], direction LEFT or RIGHT')
    if not isinstance(steps,int) or not 4<=steps<=720:raise ValueError('steps must be 4..720')
    radius=turn_radius_nm(tas_kt,bank_deg)
    delta=math.radians(angle)/steps
    duration_hours=radius*delta*steps/tas_kt
    elapsed=duration_hours*3600
    sign=1 if turn_dir=='RIGHT' else -1
    lat,lon=start_lat,start_lon
    points=[(lat,lon)]
    dt_h=duration_hours/steps
    for k in range(steps):
        mid_heading=(heading+sign*math.degrees(delta)*(k+0.5))%360
        gv=ground_vector_from_heading(mid_heading,tas_kt,wind_from_true,wind_kt)
        lat,lon=destination_nm(lat,lon,gv['ground_track_true_deg'],gv['groundspeed_kt']*dt_h)
        points.append((lat,lon))
    return {'points':points,'end_heading_true_deg':(heading+sign*angle)%360,
            'radius_still_air_nm':radius,'duration_seconds':elapsed,
            'status':'PARAMETRIC_LAB_PREVIEW_NOT_FMC_GUIDANCE'}


def hold_preview(*,fix_lat,fix_lon,inbound_true,turn_dir,leg_nm=None,leg_minutes=None,
                 tas_kt,bank_deg,wind_from_true,wind_kt,steps_per_turn=72):
    """One synthetic established racetrack circuit. Does not choose hold ENTRY.

    Requires one explicit length or time and known TAS, bank, zero wind. Nonzero
    wind is intentionally rejected until a validated wind correction exists.
    """
    latitude_longitude(fix_lat,fix_lon)
    if (leg_nm is None)==(leg_minutes is None):raise ValueError('exactly one hold leg length/time required')
    if wind_kt!=0:raise ValueError('hold wind correction not validated; use explicitly zero wind in lab')
    if leg_minutes is not None:
        minutes=finite(leg_minutes,'minutes')
        if not .1<=minutes<=5:raise ValueError('invalid explicit hold minutes')
        leg_nm=tas_kt*minutes/60
    leg=finite(leg_nm,'leg length')
    if not .05<=leg<=30:raise ValueError('invalid hold leg length')
    inbound=bearing(inbound_true)
    outbound=(inbound+180)%360
    t1=turn_preview(fix_lat,fix_lon,inbound,180,turn_dir,tas_kt=tas_kt,
                   bank_deg=bank_deg,wind_from_true=wind_from_true,wind_kt=0,steps=steps_per_turn)
    p1=t1['points'][-1]
    p2=destination_nm(*p1,outbound,leg)
    t2=turn_preview(*p2,outbound,180,turn_dir,tas_kt=tas_kt,bank_deg=bank_deg,
                    wind_from_true=wind_from_true,wind_kt=0,steps=steps_per_turn)
    p3=t2['points'][-1]
    estimated_end=destination_nm(*p3,inbound,leg)
    d=distance_nm(*estimated_end,fix_lat,fix_lon)
    # On sphere, ideal racetrack is only approximately closed under constant
    # bearing/arc integration; do not force a false joining line if drifted.
    return {'points':t1['points']+[p2]+t2['points'][1:]+[estimated_end],
            'closure_error_nm':d,'turn_radius_nm':t1['radius_still_air_nm'],
            'outbound_length_nm':leg,'status':'SYNTHETIC_ESTABLISHED_HOLD_CIRCUIT_ONLY',
            'limitations':['NO_HOLD_ENTRY','NO_ALTITUDE_TERMINATOR','NO_WIND_CORRECTION',
                           'NO_FMC_LEG_OR_SOURCE_MAGNETIC_REFERENCE_VALIDATION']}