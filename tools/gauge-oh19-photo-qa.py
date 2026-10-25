#!/usr/bin/env python3
"""Read-only OH19 photo inspection for CAB ALT inner dial.
Emits compressed source crop as a CI log so reviewer can inspect original ticks
without modifying locked PNG artwork."""
import base64, io, json, hashlib
from PIL import Image, ImageDraw
from pathlib import Path
p=Path("panel-mosaic-lab/assets/locked/2026-10-23/OH19-PRESS-DIFF-ALT-HORN-d6719ce57cef.png")
raw=p.read_bytes()
im=Image.open(io.BytesIO(raw)).convert('RGB')
print('OH19_IMAGE_META='+json.dumps(dict(path=str(p),sha256=hashlib.sha256(raw).hexdigest(),size=im.size)))
assert im.size==(1267,1241)
# Native 1:1 content, crop around two concentric scales, not an edited asset.
for key,box in [('GAUGE',(150,10,820,700)),('INNER',(300,170,690,565))]:
    crop=im.crop(box)
    buf=io.BytesIO();crop.save(buf,format='JPEG',quality=88,optimize=True)
    print(f'OH19_IMAGE_B64_{key}='+base64.b64encode(buf.getvalue()).decode('ascii'))

# White tick scan: radial intensity sampled along the CAB ALT inner annulus.
from math import sin,cos,pi
pixel=im.load()
cx,cy=489,365
def ray(a):
    rad=a*pi/180
    hits=[]
    for r in range(112,169):
        x=int(round(cx+r*sin(rad)));y=int(round(cy-r*cos(rad)))
        if 0<=x<im.width and 0<=y<im.height:
            red,green,blue=pixel[x,y]
            gray=(red+green+blue)/3
            # all source ticks are bright ivory, avoid steel frame
            if gray>170 and max(red,green,blue)-min(red,green,blue)<65:
                hits.append(r)
    return hits
step=.25
scores=[]
for i in range(round(360/step)):
    a=i*step
    hits=ray(a)
    middle=[r for r in hits if 127<=r<=148]
    score=len(middle)
    scores.append((a,score,hits))
def group_peaks(values,threshold=5):
    found=[]
    current=[]
    for a,score,hits in values:
        if score>=threshold:
            current.append((a,score,hits))
        elif current:
            found.append(current);current=[]
    if current:found.append(current)
    # 0 and 360 are contiguous; join across boundary.
    if len(found)>1 and found[0][0][0]<=step and found[-1][-1][0]>=360-step*2:
        merged=found[-1]+[(a+360,s,h) for a,s,h in found[0]]
        found=[merged]+found[1:-1]
    candidates=[]
    for g in found:
        if len(g)<2:continue
        total=sum(s for a,s,h in g)
        center=sum(a*s for a,s,h in g)/total
        strongest=max(g,key=lambda v:v[1])
        radii=strongest[2]
        candidates.append(dict(angle=round(center%360,2),score=strongest[1],
            angularWidth=round(len(g)*step,2),rMin=min(radii) if radii else None,
            rMax=max(radii) if radii else None))
    return sorted(candidates,key=lambda c:c["angle"])
cands=group_peaks(scores)
print('OH19_RADIAL_TICKS='+json.dumps(cands,separators=(',',':')))
print('OH19_TICKS_COUNT='+str(len(cands)))
# Native photo with candidate radial hairlines for independent visual QA.
color=im.crop((150,10,820,700))
draw=ImageDraw.Draw(color)
for c in cands:
    a=c['angle']*pi/180
    x0=cx-150+110*sin(a); y0=cy-10-110*cos(a)
    x1=cx-150+166*sin(a); y1=cy-10-166*cos(a)
    draw.line((x0,y0,x1,y1),fill=(255,60,60),width=2)
buf=io.BytesIO()
color.save(buf,format='JPEG',quality=88,optimize=True)
print('OH19_IMAGE_B64_DETECTED='+base64.b64encode(buf.getvalue()).decode('ascii'))

for key,box in [('ZERO_TO_THREE',(445,188,655,370)),
                ('THREE_TO_TEN',(560,240,695,520)),
                ('CABINNER_LEFT',(285,215,480,565))]:
    focus=im.crop(box)
    focus=focus.resize((focus.width*3,focus.height*3),Image.Resampling.NEAREST)
    b=io.BytesIO();focus.save(b,format='JPEG',quality=88,optimize=True)
    print(f'OH19_IMAGE_B64_{key}='+base64.b64encode(b.getvalue()).decode('ascii'))
