#!/usr/bin/env python3
"""Read-only candidate detection and contact sheets for 34 unresolved pivots.
No alteration to the immutable source artwork, overlays, or Unified geometry.
Not a calibration approval: circle candidates may be screws, rims or text.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
survey=json.loads((ROOT/'engine/instruments/gauge-survey-stage2-3.json').read_text())
PANEL_NAMES=['CAPTAIN','ENGINE','FO-INNER','FO-OUTER','THROTTLE','RADIO']
faces=survey['faces']
images={}
for panel in PANEL_NAMES:
    f=next(f for f in faces if f['panel']==panel)
    p=ROOT/f['source']
    with Image.open(p) as im:
        rgb=im.convert('RGB').copy()
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    if digest!=f['sourceSha256']:
        raise RuntimeError(f'Immutable source hash changed: {panel}')
    if rgb.size!=(f['imageWidth'],f['imageHeight']):
        raise RuntimeError(f'Unexpected native dimensions: {panel}')
    images[panel]=(rgb,f['source'],digest)

font=ImageFont.load_default()
allResults={}
for panel,(img,path,digest) in images.items():
    W,H=img.size
    scale=min(1,1530/max(W,H))
    tw,th=round(W*scale),round(H*scale)
    thumb=img.resize((tw,th),Image.Resampling.LANCZOS)
    gray=cv2.cvtColor(np.asarray(thumb),cv2.COLOR_RGB2GRAY)
    eq=cv2.createCLAHE(clipLimit=1.8,tileGridSize=(8,8)).apply(gray)
    blurred=cv2.medianBlur(eq,5)
    minRadius=max(16,round(min(tw,th)*.023))
    maxRadius=round(min(tw,th)*.22)
    circles=cv2.HoughCircles(
        blurred,cv2.HOUGH_GRADIENT,dp=1.25,minDist=max(38,minRadius*1.5),
        param1=125,param2=95,minRadius=minRadius,maxRadius=maxRadius)
    detections=[]
    if circles is not None:
        for x,y,r in np.round(circles[0]).astype(int):
            detections.append({'x':round(x/scale,1),'y':round(y/scale,1),
                               'radius':round(r/scale,1)})
    # High-confidence, large rings only; suppress duplicates and clutter.
    candidates=sorted(detections,key=lambda c:-c['radius'])
    detections=[]
    for c in candidates:
        if c['radius']<max(45,85/scale): continue
        if all(((c['x']-d['x'])**2+(c['y']-d['y'])**2)**.5>min(c['radius'],d['radius'])*.85 for d in detections):
            detections.append(c)
        if len(detections)>=38:break
    detections.sort(key=lambda c:(c['y'],c['x']))
    # Native coordinate grid, not a fictitious calibration angle or digit.
    sheet=Image.new('RGB',(max(tw+120,500),th+90),'#e7ecf2')
    sheet.paste(thumb,(70,48))
    painter=ImageDraw.Draw(sheet)
    painter.text((10,8),f'{panel} | NATIVE {W}x{H} | CIRCLE CANDIDATES {len(detections)}',fill='#101820',font=font)
    painter.text((10,24),'Numbers on grid use UNRESIZED source-image pixels.',fill='#172333',font=font)
    for nx in range(0,W+1,200):
        px=70+round(nx*scale)
        painter.line([(px,48),(px,48+th)],fill='#ffae00',width=1)
        painter.text((px+2,36),str(nx),fill='#ad3000',font=font)
    for ny in range(0,H+1,200):
        py=48+round(ny*scale)
        painter.line([(70,py),(70+tw,py)],fill='#ffae00',width=1)
        painter.text((4,py),str(ny),fill='#ad3000',font=font)
    for i,c in enumerate(detections):
        x,y,r=c['x']*scale+70,c['y']*scale+48,c['radius']*scale
        painter.ellipse((x-r,y-r,x+r,y+r),outline='#00dfc2',width=1)
        painter.ellipse((x-3,y-3,x+3,y+3),outline='#fa2a73',width=2)
        painter.text((x+4,y+3),str(i),fill='#ff376f',stroke_width=1,stroke_fill='#ffffff',font=font)
    # Previously registered centers shown in magenta + face suffix
    mounted=[f for f in faces if f['panel']==panel and isinstance(f['pivot'],dict)]
    for f in mounted:
        x=70+f['pivot']['x']*scale
        y=48+f['pivot']['y']*scale
        painter.line((x-8,y,x+8,y),fill='#eb00e8',width=2)
        painter.line((x,y-8,x,y+8),fill='#eb00e8',width=2)
    allResults[panel]={'source':path,'sha256':digest,'width':W,'height':H,
                      'candidateCenters':detections,
                      'originalRegisteredCenters':[{'id':f['id'],'x':f['pivot']['x'],'y':f['pivot']['y']} for f in mounted],
                      'review':'CIRCLE_CANDIDATES_NOT_APPROVED'}
    # Data as a single log record, useful when GitHub content bridge blocks raw PNG.
    data=io.BytesIO()
    sheet.save(data,format='JPEG',quality=66,optimize=True)
    print(f'B737_PANEL_PHOTO_{panel.replace("-","_")}='+base64.b64encode(data.getvalue()).decode('ascii'),flush=True)
    print('B737_PANEL_CIRCLES_'+panel.replace('-','_')+'='+json.dumps(allResults[panel],separators=(',',':')),flush=True)
print('B737_PANEL_QA_READ_ONLY_SCAN_COMPLETE '+json.dumps({k:len(v['candidateCenters']) for k,v in allResults.items()}),flush=True)
