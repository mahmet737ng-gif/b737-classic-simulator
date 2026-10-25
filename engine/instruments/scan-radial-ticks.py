#!/usr/bin/env python3
"""Generate review-only white radial tick candidate positions from locked photos.
Never certify a tick's numeric value or change the source image.
"""
from pathlib import Path
import cv2, math, json, numpy as np
ROOT=Path(__file__).resolve().parents[2]
out=ROOT/'engine/instruments/review-previews'
out.mkdir(parents=True,exist_ok=True)
INV=json.loads((ROOT/'engine/instruments/gauge-inventory-v1.json').read_text())
# Estimated optical centers are SEPARATE from legacy overlay pivots and
# are only used to select candidate radial line pixels.
DIALS=[
 ('oh.elec.dc_amps','OH10',(310,192),(78,175)),
 ('oh.elec.cps','OH10',(780,192),(78,175)),
 ('oh.elec.dc_volts','OH10',(310,613),(78,175)),
 ('oh.elec.ac_volts','OH10',(780,613),(78,175)),
 ('oh.drive_oil.1','OH11',(339,1009),(88,184)),
 ('oh.drive_oil.2','OH11',(858,1009),(88,184)),
 ('oh.ac_amps.1','OH12',(261,252),(80,174)),
 ('oh.ac_amps.2','OH12',(753,252),(80,174)),
 ('oh.ac_amps.apu','OH12',(726,1350),(78,172)),
 ('oh.apu.egt','OH12',(294,1325),(100,183)),
 ('oh.cabin.diff_pressure.outer','OH19-DIFF',(489,365),(214,272)),
 ('oh.cabin.diff_pressure.inner','OH19-DIFF',(489,365),(105,159)),
 ('oh.cabin.rate','OH19-DIFF',(520,950),(114,187)),
 ('oh.cabin.temperature','OH20',(618,681),(122,187)),
 ('oh.duct.pressure_lr','OH21',(544,439),(110,172)),
 ('eng.n1.1','ENGINE',(535,540),(40,87)),
 ('eng.n1.2','ENGINE',(724,540),(40,87)),
 ('eng.egt.1','ENGINE',(535,723),(40,89)),
 ('eng.egt.2','ENGINE',(724,723),(40,89)),
 ('eng.n2.1','ENGINE',(535,900),(40,89)),
 ('eng.n2.2','ENGINE',(724,900),(40,89))
]
loaded={}
results={}
def angular_error(a,b):
    return abs((a-b+90)%180-90)
for name,panel,(cx,cy),(low,high) in DIALS:
    if panel not in loaded:
        source=ROOT/INV['sourcePanels'][panel]
        loaded[panel]=cv2.imread(str(source))
    im=loaded[panel]
    assert im is not None,(panel,'missing')
    H,W=im.shape[:2]
    lum=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
    mask=np.zeros((H,W),dtype=np.uint8)
    radius=high+6
    x0=max(0,cx-radius);x1=min(W,cx+radius)
    y0=max(0,cy-radius);y1=min(H,cy+radius)
    crop=im[y0:y1,x0:x1]
    hsv=cv2.cvtColor(crop,cv2.COLOR_BGR2HSV)
    # White or slightly off-white ticks on black background, not gray plate.
    bright=cv2.inRange(hsv,np.array([0,0,145]),np.array([179,96,255]))
    mask[y0:y1,x0:x1]=bright
    lines=cv2.HoughLinesP(mask,1,np.pi/900,threshold=12,minLineLength=8,maxLineGap=2)
    hits=[]
    for ln in ([] if lines is None else lines[:,0]):
        x1,y1,x2,y2=[int(x) for x in ln]
        mx=(x1+x2)/2;my=(y1+y2)/2
        d=math.hypot(mx-cx,my-cy)
        seg=math.hypot(x2-x1,y2-y1)
        if not (low<=d<=high and 9<=seg<=62):continue
        ray=math.degrees(math.atan2(mx-cx,cy-my))
        line=math.degrees(math.atan2(x2-x1,y1-y2))
        if angular_error(ray,line)>15:continue
        hits.append(dict(x=round(mx,1),y=round(my,1),angle=round(ray,2),
                         radius=round(d,1),length=round(seg,1)))
    hits.sort(key=lambda x:x['angle'])
    groups=[]
    for h in hits:
        if groups and h['angle']-groups[-1][-1]['angle']<2.8:groups[-1].append(h)
        else:groups.append([h])
    ranked=[sorted(group,key=lambda x:x['length'],reverse=True)[0] for group in groups]
    results[name]={'panel':panel,'centerEstimate':[cx,cy],'ring':[low,high],
                   'imageSize':[W,H],'candidates':ranked,'note':'Radial bright-line detections: UNSUPERVISED, includes false positives, no values assigned; not an approved calibration'}
(out/'radial-tick-candidates.json').write_text(json.dumps(results,indent=2)+'\n')
print('Calculated',len(results),'candidate dials',sum(len(x['candidates']) for x in results.values()),'candidate radial marks')
for k in results:print(k, len(results[k]['candidates']))
