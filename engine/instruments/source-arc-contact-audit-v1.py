#!/usr/bin/env python3
"""Original-image gauge-centre audit. Produces evidence, not dial certification.
This does NOT derive numeric tick assignments by interpolating unknown marks.
All source art and approved pointer SVGs are read-only.
"""
import hashlib,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'panel-mosaic-lab/assets/locked/2026-10-23'
OUT=ROOT/'artifacts/native-arc-audit'
PANELS={
 'OH10':('OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png',(1095,1436)),
 'OH11':('OH11-STANDBY-8b7d36ff3182.png',(1203,1308)),
 'OH12':('OH12-BUS-TRANS-09319c17e7d0.png',(1024,1536)),
 'OH20':('OH20-AIR-CONDITIONING-0734da6a7726.png',(1254,1254)),
 'OH21':('OH21-BLEED-AIR-cc78219607a3.png',(1122,1402)),
 'OH20-400':('Boeing-Style Environmental Control Panel.png',(1122,1402)),
}
GAUGES=[
 ('OH10','dcAmps',310,168,85,216, 'ANGLE_ONLY_NOT_AMPS'),
 ('OH10','cps',715,190,85,216,'ANGLE_ONLY_NOT_CPS'),
 ('OH10','dcVolts',332,600,85,216,'ANGLE_ONLY_NOT_VOLTS'),
 ('OH10','acVolts',715,620,85,216,'ANGLE_ONLY_NOT_VOLTS'),
 ('OH11','driveOil1',266,1021,98,220,'ANGLE_ONLY_NOT_CELSIUS'),
 ('OH11','driveOil2',781,1021,98,220,'ANGLE_ONLY_NOT_CELSIUS'),
 ('OH12','acAmps1',210,265,102,220,'ANGLE_ONLY_NOT_AMPS'),
 ('OH12','acAmps2',705,265,102,220,'ANGLE_ONLY_NOT_AMPS'),
 ('OH12','apuAcAmps',724,1334,124,220,'ANGLE_ONLY_NOT_AMPS'),
 ('OH20','cabinTemp',618,681,158,220,'CANDIDATE_SIX_MAJOR_NUMBERS'),
 ('OH21','ductPressure',544,439,148,220,'APPROX_LINEAR_PSI_0_TO_100'),
 ('OH20-400','cabinTemp400',284,268,158,220,'ALTERNATE_400_PHOTO_SEPARATE_SCALE_PENDING'),
]
OUT.mkdir(parents=True,exist_ok=True)
registered=[]
for panel,(file,dims) in PANELS.items():
 raw=(ART/file).read_bytes()
 im=Image.open(ART/file)
 assert im.size==dims,(panel,im.size,dims)
 rgb=im.convert('RGB')
 d=ImageDraw.Draw(rgb)
 for p,name,x,y,tip,ref,status in [g for g in GAUGES if g[0]==panel]:
  # The red X is the MODEL-DECLARED pivot; not independently measured.
  d.ellipse((x-8,y-8,x+8,y+8),outline=(255,20,40),width=3)
  d.line((x-17,y,x+17,y),fill=(255,20,40),width=2)
  d.line((x,y-17,x,y+17),fill=(255,20,40),width=2)
  for r,col in [(tip,(245,80,30)),(tip*1.15,(38,224,218))]:
   d.ellipse((x-r,y-r,x+r,y+r),outline=col,width=2)
  d.text((min(x+12,im.width-210),min(y+10,im.height-30)),name,fill=(255,242,50))
  # Save original pixel crop, NEVER just the annotated composite.
  bounds=(max(0,x-245),max(0,y-245),min(im.width,x+245),min(im.height,y+245))
  im.crop(bounds).save(OUT/(panel+'_'+name+'_RAW.png'))
  # raw native image info for subsequent photo measurements
  registered.append(dict(panel=panel,name=name,source=file,sourceSHA256=hashlib.sha256(raw).hexdigest(),
                         sourceSize=list(dims),declaredPivotPx=[x,y],pivotCertified=False,
                         candidateTipRadiusPx=tip,
                         tipActualSvgNeedsIndependentAudit=True,
                         inspectorControl=status,
                         originalImageProcessed=True))
 rgb.save(OUT/(panel+'_DECLARED_CENTRES.png'))
report=dict(schema='b737.native-source-arc-pivots.review1',date='2026-10-26',
            method='Native photo visual crosshair and circular nominal tip reach',
            registeredGaugeCount=len(registered),originalPhotoCount=len(PANELS),
            allCentresCertified=False,allMinorTickValuesCertified=False,
            sourceArtChanged=False,gauges=registered)
(OUT/'PIVOT_EVIDENCE.json').write_text(json.dumps(report,indent=2)+'\n')
print('Original photos',len(PANELS),'declared gauge pivot centres',len(registered))
print('NO CENTRE / NUMERIC TICK APPROVAL IS IMPLIED')
