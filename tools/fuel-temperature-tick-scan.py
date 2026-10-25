#!/usr/bin/env python3
"""Scan radial tick strokes on original OH09 Fuel Temperature.
No OCR, no input edits; candidate angles are diagnostic only until reviewed.
Output native pixel angular peaks with brightness/radius evidence.
"""
import math, json
from pathlib import Path
from PIL import Image, ImageFilter

root=Path(__file__).resolve().parents[1]
p=root/'panel-mosaic-lab/assets/locked/2026-10-23/OH09-FUEL-921977b56887.png'
im=Image.open(p).convert("RGB")
cx,cy=506,235
# Source was inspected before specifying the scan annulus.
for rad_lo,rad_hi in [(95,124),(110,136),(122,146),(131,157),(138,162)]:
 counts=[]
 for step in range(-240,241):
  bearing=step*.5
  theta=math.radians(bearing)
  score=0
  for radius in range(rad_lo,rad_hi+1):
   x=round(cx+radius*math.sin(theta))
   y=round(cy-radius*math.cos(theta))
   if x<0 or y<0 or x>=im.width or y>=im.height: continue
   r,g,b=im.getpixel((x,y))
   # White tick marks on dark blue face are reasonably color-neutral and luminous;
   # prioritize strokes, not perimeter rim or dark metal.
   lum=.299*r+.587*g+.114*b
   if lum>175 and max(r,g,b)-min(r,g,b)<55: score+=1
  counts.append((bearing,score))
 candidates=[]
 for i in range(2,len(counts)-2):
  b,val=counts[i]
  if val<4:continue
  local=[counts[i+j][1] for j in range(-2,3)]
  if val>=max(local):
   if candidates and b-candidates[-1][0]<2.5:
    if val>candidates[-1][1]:candidates[-1]=(b,val)
   else:candidates.append((b,val))
 print(f'FUEL_RADIAL_SCAN annulus={rad_lo}..{rad_hi}, peaks={len(candidates)}')
 print('FUEL_TICK_PEAKS='+json.dumps(candidates,separators=(',',':')))
