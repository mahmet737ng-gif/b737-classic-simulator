#!/usr/bin/env python3
"""Read-only native-pixel radial photo scan: OH09, OH20, OH21.
Detect candidate major/minor white radial strokes as angles/inner pixel points.
Do not infer needle physics or automatically certify numerical minor ticks.
"""
import base64, hashlib, io, json, math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
survey=json.loads((ROOT/'engine/instruments/gauge-survey-stage2-3.json').read_text())
table={x['id']:x for x in survey['faces']}
configs=[
 ('oh.fuel.temperature',-136,136,108,148),
 ('oh.cabin.temperature',-146,146,122,181),
 ('oh.duct.pressure_lr',-159,159,126,187),
]
fnt=ImageFont.load_default()
for gid,amin,amax,rmin,rmax in configs:
 f=table[gid];im=Image.open(ROOT/f['source']).convert('RGB')
 assert im.size==(f['imageWidth'],f['imageHeight'])
 assert hashlib.sha256((ROOT/f['source']).read_bytes()).hexdigest()==f['sourceSha256']
 x,y=f['pivot']['x'],f['pivot']['y']
 a=np.asarray(im).astype(np.float32)
 angles=np.arange(amin,amax+.01,.25)
 scores=[]
 samples=[]
 for bearing in angles:
  rr=np.arange(rmin,rmax+1)
  t=math.radians(bearing)
  xs=np.rint(x+rr*np.sin(t)).astype(int)
  ys=np.rint(y-rr*np.cos(t)).astype(int)
  ok=(xs>=0)&(xs<a.shape[1])&(ys>=0)&(ys<a.shape[0])
  rgb=a[ys[ok],xs[ok]]
  lum=rgb@np.asarray([.299,.587,.114],dtype=np.float32)
  contrast=np.max(rgb,axis=1)-np.min(rgb,axis=1)
  good=(lum>172)&(contrast<62)
  rad=rr[ok][good]
  scores.append(int(good.sum()))
  samples.append(rad.tolist())
 scores=np.asarray(scores)
 # Smooth minimally; regular 1-3 degree tick gaps must stay distinct.
 filt=np.convolve(scores,[.2,.6,.2],mode='same')
 chosen=[]
 for i in range(2,len(angles)-2):
  if filt[i]<6.8:continue
  if filt[i]>=filt[i-1] and filt[i]>=filt[i+1]:
   angle=float(angles[i])
   if chosen and angle-chosen[-1]['angleDeg']<2.25:
    if filt[i]>chosen[-1]['score']:chosen[-1]={'angleDeg':angle,'score':float(filt[i]),'sample':samples[i]}
   else:chosen.append({'angleDeg':angle,'score':float(filt[i]),'sample':samples[i]})
 points=[]
 for k,c in enumerate(chosen):
  rr=c['sample'];radius=min(rr) if rr else None
  if radius is None:continue
  angle=c['angleDeg'];t=math.radians(angle)
  points.append({'id':k,'angleDeg':angle,'candidateInnerRadiusPx':radius,
    'innerPoint':{'x':round(x+radius*math.sin(t),2),'y':round(y-radius*math.cos(t),2)},
    'brightnessRunScore':round(c['score'],2),
    'classification':'UNCLASSIFIED_WHITELINE_POSSIBLE_TICK',
    'approved':False})
 # Review sheet retains FULL NATIVE extracted pixel crop, scaled only after detections.
 half=rmax+27;crop=Image.new('RGB',(half*2,half*2),'#34383b')
 sx,sy=max(0,x-half),max(0,y-half)
 rect=(sx,sy,min(im.width,x+half),min(im.height,y+half))
 crop.paste(im.crop(rect),(sx-(x-half),sy-(y-half)))
 display=crop.resize((920,920),Image.Resampling.LANCZOS)
 painter=ImageDraw.Draw(display)
 mid=460;sc=920/(half*2)
 for pt in points:
  t=math.radians(pt['angleDeg']);r=pt['candidateInnerRadiusPx']
  xx=mid+r*math.sin(t)*sc;yy=mid-r*math.cos(t)*sc
  painter.ellipse((xx-3,yy-3,xx+3,yy+3),fill='#fd2c86')
  # Every few dots label angle to avoid obscuring artwork.
  if pt['id']%8==0:painter.text((xx+4,yy+3),str(pt['id']),fill='#ffe84e',font=fnt,stroke_width=1,stroke_fill='#202020')
 painter.ellipse((mid-5,mid-5,mid+5,mid+5),outline='#55ffff',width=2)
 out=io.BytesIO();display.save(out,'JPEG',quality=65,optimize=True)
 print('B737_RADIAL_IMAGE_'+gid.replace('.','_')+'='+base64.b64encode(out.getvalue()).decode('ascii'),flush=True)
 record={'id':gid,'source':f['source'],'sha256':f['sourceSha256'],'sourceSize':[im.width,im.height],
         'pivotCandidate':[x,y],'annulus':[rmin,rmax],'angularIntervalDeg':[amin,amax],
         'angularSampleResolutionDeg':.25,'tickCandidates':points,
         'approved':False,'status':'SOURCE_PHOTO_AUTOMATIC_WHITELINE_CANDIDATES_REQUIRE_MANUAL_NUMBER_MATCHING'}
 print('B737_RADIAL_POINTS_'+gid.replace('.','_')+'='+json.dumps(record,separators=(',',':')),flush=True)
 print('B737_RADIAL_SUMMARY '+gid+' total_whiteline_candidates='+str(len(points)),flush=True)
