"""Coordinate transforms, explicit curve branches and alignment nomograms.

No label inference or implicit intersection selection. Geometry is independent
of aircraft, engine, chart units and photograph orientation.
"""
import math
from ..technical_reader_v1.numeric import ReaderError, finite, interpolate


def _solve(a,b):
    a=[list(map(float,row))+[float(v)] for row,v in zip(a,b)]
    n=len(b)
    for col in range(n):
        pivot=max(range(col,n),key=lambda r:abs(a[r][col]))
        if abs(a[pivot][col])<1e-11:raise ReaderError('DEGENERATE_CALIBRATION')
        a[col],a[pivot]=a[pivot],a[col]
        q=a[col][col];a[col]=[x/q for x in a[col]]
        for r in range(n):
            if r!=col:
                q=a[r][col];a[r]=[v-q*w for v,w in zip(a[r],a[col])]
    return [row[-1] for row in a]


def _scale(x,scale):
    x=finite(x)
    if scale=='linear':return x
    if scale=='log10' and x>0:return math.log10(x)
    raise ReaderError('INVALID_AXIS_SCALE_OR_VALUE')


def _unscale(x,scale):return 10**x if scale=='log10' else x


class CartesianCalibration:
    """3-point affine or 4-point projective calibration using data-space anchors.

    Anchors are {pixel:[px,py], value:[x,y]}. Log transforms are applied in
    chart space. Full projective calibration rectifies photographed charts.
    """
    def __init__(self,anchors,x_scale='linear',y_scale='linear'):
        if len(anchors) not in (3,4):raise ReaderError('NEED_THREE_OR_FOUR_ANCHORS')
        self.x_scale,self.y_scale=x_scale,y_scale
        mat=[];rhs=[]
        for anchor in anchors:
            px,py=map(finite,anchor['pixel']);x,y=anchor['value']
            x,y=_scale(x,x_scale),_scale(y,y_scale)
            if len(anchors)==3:
                mat.extend([[px,py,1,0,0,0],[0,0,0,px,py,1]])
            else:
                mat.extend([[px,py,1,0,0,0,-x*px,-x*py],[0,0,0,px,py,1,-y*px,-y*py]])
            rhs.extend([x,y])
        self.coefficients=_solve(mat,rhs)
    def to_value(self,pixel):
        px,py=map(finite,pixel);c=self.coefficients
        d=1 if len(c)==6 else c[6]*px+c[7]*py+1
        if abs(d)<1e-10:raise ReaderError('CALIBRATION_HORIZON')
        return [_unscale((c[0]*px+c[1]*py+c[2])/d,self.x_scale),_unscale((c[3]*px+c[4]*py+c[5])/d,self.y_scale)]


class PolarCalibration:
    """Explicit center, radial tick calibration and angular zero/direction."""
    def __init__(self,center,radial_anchors,angle_zero_deg=0,clockwise=False,radial_scale='linear'):
        self.center=list(map(finite,center));self.ticks=radial_anchors
        self.zero=finite(angle_zero_deg);self.direction=-1 if clockwise else 1
        self.scale=radial_scale
        # Validate independently of the queried radius.
        if len(radial_anchors)<2:raise ReaderError('NEED_RADIAL_TICKS')
        for p in radial_anchors:_scale(p[1],radial_scale)
        if any(b[0]<=a[0] for a,b in zip(radial_anchors,radial_anchors[1:])):raise ReaderError('RADIAL_TICKS_ORDER')
    def to_value(self,pixel):
        dx=finite(pixel[0])-self.center[0];dy=self.center[1]-finite(pixel[1])
        radius=math.hypot(dx,dy)
        v,_=interpolate([p[0] for p in self.ticks],[_scale(p[1],self.scale) for p in self.ticks],radius)
        angle=(self.direction*(math.degrees(math.atan2(dy,dx))-self.zero))%360
        return [angle,_unscale(v,self.scale)]


def split_trace(points,tolerance=1e-10):
    """Split at x reversals and vertical segments; retain original turn points.

    Output retains vertical branches separately. No flattening of loops or
    joining through gaps. Each disconnected input trace must be passed alone.
    """
    if len(points)<2:raise ReaderError('NEED_TWO_POINTS')
    points=[[finite(x),finite(y)] for x,y in points]
    branches=[];current=[points[0]];direction=0
    for p in points[1:]:
        delta=p[0]-current[-1][0];d=0 if abs(delta)<=tolerance else (1 if delta>0 else -1)
        if d==0:
            if len(current)>1:branches.append({'points':current,'vertical':False})
            branches.append({'points':[current[-1],p],'vertical':True});current=[p];direction=0
        elif direction and direction!=d:
            branches.append({'points':current,'vertical':False});current=[current[-1],p];direction=d
        else:current.append(p);direction=d
    if len(current)>1:branches.append({'points':current,'vertical':False})
    for i,b in enumerate(branches):b['id']=f'branch-{i+1}'
    return branches


def read_trace(branches,x,branch_id=None):
    """Read y at x only if the requested branch yields exactly one answer."""
    x=finite(x);hits=[]
    if branch_id is not None and not any(b['id']==branch_id for b in branches):raise ReaderError('UNKNOWN_BRANCH')
    for b in branches:
        if branch_id is not None and b['id']!=branch_id:continue
        for a,z in zip(b['points'],b['points'][1:]):
            if abs(z[0]-a[0])<1e-12:
                if abs(x-a[0])<1e-10:raise ReaderError('VERTICAL_BRANCH_NOT_A_FUNCTION')
                continue
            if min(a[0],z[0])-1e-10<=x<=max(a[0],z[0])+1e-10:
                y=a[1]+(z[1]-a[1])*(x-a[0])/(z[0]-a[0])
                if not any(abs(y-h['value'])<1e-9 for h in hits):hits.append({'value':y,'branch_id':b['id'],'endpoints':[a,z]})
    if not hits:raise ReaderError('OUT_OF_DOMAIN_OR_GAP')
    if len(hits)>1:raise ReaderError('AMBIGUOUS_BRANCH: choose an explicit branch')
    return hits[0]


def _axis_point(axis,value):
    ticks=axis['ticks'];vs=[t['value'] for t in ticks]
    if vs[0]>vs[-1]:ticks=ticks[::-1];vs=vs[::-1]
    _,detail=interpolate(vs,list(range(len(vs))),value,scale=axis.get('scale','linear'))
    return [sum(ticks[i]['pixel'][j]*w for i,w in zip(detail['indices'],detail['weights'])) for j in (0,1)]


def alignment_nomogram(input_axes,output_axis,inputs):
    """Two input scales and one output scale; straightedge alignment rule.

    Axes can be piecewise polylines with nonuniform/log ticks. Other nomogram
    constructions require an explicit multi-step plan rather than this rule.
    """
    if len(input_axes)!=2 or len(inputs)!=2:raise ReaderError('TWO_INPUT_SCALES_REQUIRED')
    a,b=[_axis_point(axis,v) for axis,v in zip(input_axes,inputs)]
    vx,vy=b[0]-a[0],b[1]-a[1]
    if math.hypot(vx,vy)<1e-10:raise ReaderError('COINCIDENT_INPUT_POINTS')
    hits=[];ticks=output_axis['ticks']
    for t0,t1 in zip(ticks,ticks[1:]):
        c,d=t0['pixel'],t1['pixel'];wx,wy=d[0]-c[0],d[1]-c[1]
        det=vx*wy-vy*wx
        if abs(det)<1e-10:continue
        # c + u*w = a + t*v; the straightedge is a line, not a finite segment.
        u=((a[0]-c[0])*vy-(a[1]-c[1])*vx)/(wx*vy-wy*vx)
        if -1e-9<=u<=1+1e-9:
            lo=_scale(t0['value'],output_axis.get('scale','linear'));hi=_scale(t1['value'],output_axis.get('scale','linear'))
            value=_unscale(lo+u*(hi-lo),output_axis.get('scale','linear'))
            if not any(abs(value-h['value'])<1e-9 for h in hits):hits.append({'value':value,'pixel':[c[0]+u*wx,c[1]+u*wy],'fraction':u})
    if len(hits)!=1:raise ReaderError('AMBIGUOUS_OR_MISSING_NOMOGRAM_INTERSECTION')
    return {**hits[0],'input_pixels':[a,b],'method':'alignment_nomogram'}


def envelope_contains(rings,point):
    """Point in outer polygon with optional holes; outer boundary is included.

    Polygon coordinates must already be calibrated into the declared units.
    Graph truncation is a domain limit, never an extrapolated boundary.
    """
    px,py=map(finite,point)
    def inside(ring):
        if len(ring)<3:raise ReaderError('POLYGON_NEEDS_THREE_POINTS')
        hit=False
        for a,b in zip(ring,ring[1:]+ring[:1]):
            ax,ay=map(finite,a);bx,by=map(finite,b)
            area=(px-ax)*(by-ay)-(py-ay)*(bx-ax)
            if abs(area)<=1e-9*max(1,abs(bx-ax),abs(by-ay)) and min(ax,bx)-1e-9<=px<=max(ax,bx)+1e-9 and min(ay,by)-1e-9<=py<=max(ay,by)+1e-9:return True,True
            if (ay>py)!=(by>py) and px<(bx-ax)*(py-ay)/(by-ay)+ax:hit=not hit
        return hit,False
    if not rings:raise ReaderError('OUTER_POLYGON_REQUIRED')
    allowed,boundary=inside(rings[0])
    if allowed:
        for hole in rings[1:]:
            h,hb=inside(hole)
            if h or hb:allowed=False;boundary=hb;break
    return {'value':1.0 if allowed else 0.0,'inside':allowed,'boundary':boundary,'point':[px,py],'method':'polygon_envelope'}
