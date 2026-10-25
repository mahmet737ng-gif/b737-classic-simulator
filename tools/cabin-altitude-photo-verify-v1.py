#!/usr/bin/env python3
"""OH19 dial true source-photo + original pointer SVG visual QA.
No immutable artwork is modified. Emits test previews for review."""
import io, os, sys, math, json, base64, hashlib, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import cairosvg
photo_path=Path('panel-mosaic-lab/assets/locked/2026-10-23/OH19-PRESS-DIFF-ALT-HORN-d6719ce57cef.png')
image=Image.open(photo_path).convert('RGB')
assert image.size==(1267,1241)
cal=json.loads(subprocess.check_output(['node','-e',
 "process.stdout.write(JSON.stringify(require('./engine/instruments/cabin-altitude-photo-map-v1.js')))"],text=True))
assert hashlib.sha256(photo_path.read_bytes()).hexdigest()==cal['SOURCE']['sha256']
ticks=cal['ticks']
assert len(ticks)==47
pixels=image.load()
def pixel_photo_score(angle,radius):
    rad=math.radians(angle)
    x=int(round(489+radius*math.sin(rad)))
    y=int(round(365-radius*math.cos(rad)))
    if not(0<=x<image.width and 0<=y<image.height):return -1
    a=pixels[x,y]
    return sum(a)/3 if max(a)-min(a)<70 else 0
# Native tick verification: at least 1 actual light pixel near each registered
# angular center on its WHITE radial graduation, not only synthetic tick formulas.
passes=[];failures=[]
for t in ticks:
    vals=[pixel_photo_score(t['angleDeg']+da,t['innerRadiusPx']+dr)
      for da in (-.8,-.4,0,.4,.8)
      for dr in (3,5,7,9)]
    max_score=max(vals)
    if max_score>=180:passes.append([t['index'],round(max_score,1)])
    else:failures.append([t['index'],round(max_score,1)])
print('CABALT_PIXEL_TICKS_QA='+json.dumps(dict(total=len(ticks),matched=len(passes),
    unmatched=failures,hashValid=True),separators=(',',':')))
if failures:sys.exit('CAB ALT SOURCE PIXELS DO NOT MATCH CALIBRATION TICKS')

def render_sprite(path,radius,angle,stretch=1):
    raw=cairosvg.svg2png(url=str(path.resolve()))
    sprite=Image.open(io.BytesIO(raw)).convert('RGBA')
    # CSS transform: rotate(angle) scaleY(stretch), anchored on SVG pivot.
    if abs(stretch-1)>1e-7:
        sprite=sprite.transform((512,512),Image.Transform.AFFINE,
            (1,0,0,0,1/stretch,256*(1-1/stretch)),
            resample=Image.Resampling.BICUBIC)
    sprite=sprite.rotate(-angle,resample=Image.Resampling.BICUBIC,expand=False)
    size=round(512*radius/220)
    return sprite.resize((size,size),Image.Resampling.LANCZOS)

def interp_angle(value_ft):
    v=value_ft/1000
    if not(0<=v<=50):raise ValueError('Invalid visual range')
    for a,b in zip(ticks,ticks[1:]):
        if v<=b['valueThousandsFt']:
            t=(v-a['valueThousandsFt'])/(b['valueThousandsFt']-a['valueThousandsFt'])
            return a['angleDeg']+t*(b['angleDeg']-a['angleDeg'])
    return ticks[-1]['angleDeg']

for icao,feet in [('OIAW',66),('OIMM',3260),('OIII',3963)]:
    angle=interp_angle(feet)
    frame=image.convert('RGBA')
    # Cabin altitude sprite first (lower layer); differential pressure at
    # outer zero degree on top, matching actual Unified SVG layering.
    tip=(256-39)*(123/220)
    inner=ticks[0]['innerRadiusPx']
    for aa,bb in zip(ticks,ticks[1:]):
        if feet/1000<=bb['valueThousandsFt']:
            frac=(feet/1000-aa['valueThousandsFt'])/(bb['valueThousandsFt']-aa['valueThousandsFt'])
            inner=aa['innerRadiusPx']+frac*(bb['innerRadiusPx']-aa['innerRadiusPx'])
            break
    stretch=inner/tip
    assert .90<stretch<1.10
    for item,radius,degree,vertical in [
        ('cabin-altitude-needle.svg',123,angle,stretch),
        ('cabin-diff-pressure-needle.svg',207,.64,1)]:
        sprite=render_sprite(Path('panel-mosaic-lab/cockpit')/item,radius,degree,vertical)
        w,h=sprite.size
        frame.alpha_composite(sprite,(int(round(489-w/2)),int(round(365-h/2))))
    crop=frame.convert('RGB').crop((150,10,820,700))
    draw=ImageDraw.Draw(crop)
    draw.rectangle((0,644,670,690),fill=(8,17,27))
    draw.text((15,652),f'{icao} | Cabin altitude {feet:,} ft | {angle:.2f} deg clockwise | source-photo PREVIEW',
         fill=(248,252,255))
    buf=io.BytesIO()
    crop.save(buf,format='JPEG',quality=89,optimize=True)
    print('CABALT_PREVIEW_'+icao+'='+base64.b64encode(buf.getvalue()).decode())
    # Formulaic tip reach to nearest white inner radial endpoint in source coords.
    for a,b in zip(ticks,ticks[1:]):
        if feet/1000<=b['valueThousandsFt']:
            t=(feet/1000-a['valueThousandsFt'])/(b['valueThousandsFt']-a['valueThousandsFt'])
            radius=a['innerRadiusPx']+t*(b['innerRadiusPx']-a['innerRadiusPx'])
            break
    tip=(256-39)*(123/220)
    print('CABALT_AIRPORT_FIT='+json.dumps(dict(icao=icao,feet=feet,angleDeg=round(angle,4),
        photoInnerEdgeRadiusPx=round(radius,2),spriteTipRadiusPx=round(tip,2),
        uncorrectedGapPx=round(radius-tip,2),
        perspectiveStretch=round(stretch,4),correctedTipErrorPx=round(radius-tip*stretch,4),
        approved=False),separators=(',',':')))
