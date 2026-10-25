#!/usr/bin/env python3
"""Read immutable source images and emit JPEG crops for human pixel QA.
Never modifies an original source or any frozen mosaic geometry."""
import base64, io, json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[1]
doc=json.loads((root/'engine/instruments/gauge-survey-stage2-3.json').read_text(encoding='utf-8'))
faces=[f for f in doc['faces'] if isinstance(f.get('pivot'),dict)]
# The later installed oxygen gauge also needs its true underlying locked source.
faces.append({'id':'oh.crew_oxygen.pressure','panel':'UPPER',
 'source':'panel-mosaic-lab/assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png',
 'pivot':{'x':1078,'y':636},'imageWidth':1731,'imageHeight':909})
faces.sort(key=lambda g:(g['panel'],g['id']))
print(f'GAUGE_QA_SOURCE_PIVOTS={len(faces)}',flush=True)
font=ImageFont.load_default()
for start in range(0,len(faces),4):
 subset=faces[start:start+4]
 sheet=Image.new('RGB',(908,944),'#e7e7e7')
 draw=ImageDraw.Draw(sheet)
 for i,f in enumerate(subset):
  path=root/f['source']
  if not path.exists():raise SystemExit(f'Missing locked image: {path}')
  with Image.open(path) as im:
   src=im.convert('RGB')
  px,py=f['pivot']['x'],f['pivot']['y']
  if src.size!=(f['imageWidth'],f['imageHeight']):
   raise SystemExit(f'Native dimensions mismatch: {f["id"]}, actual {src.size}')
  # Copy only into an ephemeral diagnostic JPEG, NOT the locked source.
  radius=240 if f['panel']=='OH19-DIFF' else 208
  rect=(px-radius,py-radius,px+radius,py+radius)
  crop=Image.new('RGB',(2*radius,2*radius),'#252d33')
  x0=max(0,rect[0]);y0=max(0,rect[1]);x1=min(src.width,rect[2]);y1=min(src.height,rect[3])
  crop.paste(src.crop((x0,y0,x1,y1)),(x0-rect[0],y0-rect[1]))
  crop=crop.resize((436,436),Image.Resampling.LANCZOS)
  # Crosshair is diagnostic only; a tiny ring keeps the actual pivot visible.
  cx=cy=218
  cd=ImageDraw.Draw(crop)
  cd.ellipse((cx-5,cy-5,cx+5,cy+5),outline='#ff43ac',width=2)
  cd.line((cx-12,cy,cx-7,cy),fill='#ff43ac',width=1)
  cd.line((cx+7,cy,cx+12,cy),fill='#ff43ac',width=1)
  tileX=14+(i%2)*452; tileY=12+(i//2)*468
  sheet.paste(crop,(tileX,tileY+22))
  draw.text((tileX,tileY),f'{f["id"]} | {f["panel"]} | pivot({px},{py})',fill='#121212',font=font)
  print(f'GAUGE_QA_CROP_INDEX {start+i}: {f["id"]} {f["panel"]} {src.width}x{src.height} pivot({px},{py})',flush=True)
 out=io.BytesIO()
 sheet.save(out,'JPEG',quality=62,optimize=True,subsampling=2)
 data=base64.b64encode(out.getvalue()).decode('ascii')
 print(f'B737_QA_SHEET_{start//4}={data}',flush=True)
print('GAUGE_QA_RESULT=SOURCE_IMAGES_READ_ONLY_COMPLETE',flush=True)
