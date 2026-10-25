#!/usr/bin/env python3
"""Native-source radial distance of first tick stroke, independently per gauge.
Read only. It detects bright segments along each photographic scale bearing.
Outputs candidate inner/outer boundaries; no changes to original image.
"""
import json,math
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
image_files={
 'OH10':'panel-mosaic-lab/assets/locked/2026-10-23/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png',
 'OH11':'panel-mosaic-lab/assets/locked/2026-10-23/OH11-STANDBY-8b7d36ff3182.png',
 'OH12':'panel-mosaic-lab/assets/locked/2026-10-23/OH12-BUS-TRANS-09319c17e7d0.png',
 'OH19':'panel-mosaic-lab/assets/locked/2026-10-23/OH19-PRESS-DIFF-ALT-HORN-d6719ce57cef.png',
 'OH20':'panel-mosaic-lab/assets/locked/2026-10-23/OH20-AIR-CONDITIONING-0734da6a7726.png',
 'OH21':'panel-mosaic-lab/assets/locked/2026-10-23/OH21-BLEED-AIR-cc78219607a3.png',
 'ENGINE':'panel-mosaic-lab/assets/locked/2026-10-23/B737_Engine_Standby_Instruments_Blank.png',
}
profiles=[
 ("dcAmps","OH10",310,168,0,35,140),
 ("cps","OH10",715,190,-54,35,130),
 ("dcVolts","OH10",332,600,-87,40,140),
 ("driveOil1","OH11",266,1021,-46,45,140),
 ("driveOil2","OH11",781,1021,-46,45,140),
 ("acAmps1","OH12",210,265,-45,40,140),
 ("acAmps2","OH12",705,265,-45,40,140),
 ("apuAcAmps","OH12",724,1334,-47,40,140),
 ("cabinRate","OH19",520,950,-90,45,170),
 ("cabinTemp20","OH20",618,681,-90,50,180),
 ("ductPressureZero","OH21",544,439,-150,40,180),
 ("n2_1","ENGINE",535,900,-45,20,100),
 ("n2_2","ENGINE",724,900,-45,20,100),
]
im={k:Image.open(root/v).convert('RGB') for k,v in image_files.items()}
for name,panel,cx,cy,angle,lo,hi in profiles:
 img=im[panel]
 def lum(r,bearing):
  rad=math.radians(bearing)
  x=round(cx+r*math.sin(rad)); y=round(cy-r*math.cos(rad))
  if x<0 or y<0 or x>=img.width or y>=img.height:return 0
  R,G,B=img.getpixel((x,y))
  return .299*R+.587*G+.114*B
 arr=[]
 for radius in range(lo,hi+1):
  l=max(lum(radius,angle+i) for i in [-1,0,1])
  arr.append((radius,round(l)))
 starts=[];active=None
 for radius,l in arr:
  if l>175 and active is None:active=radius
  elif l<=175 and active is not None:
   if radius-active>=3:starts.append((active,radius-1))
   active=None
 if active is not None:starts.append((active,hi))
 print(f'INNER_SOURCE_TICK {name}: bearing={angle}°, candidateBrightRuns={starts}, measuredLuminance={arr[::5]}',flush=True)
