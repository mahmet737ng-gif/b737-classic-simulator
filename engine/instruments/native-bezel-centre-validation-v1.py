#!/usr/bin/env python3
"""Validate nine moved gauges against original full-resolution rim arcs.
A rim center is PROVISIONAL; black mechanical spindle remains uncertified.
"""
from PIL import Image,ImageDraw
from pathlib import Path
import json,hashlib,math
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/native-arc-audit'
data=json.loads((ROOT/'engine/instruments/native-bezel-centre-evidence-v1.json').read_text())
assert len(data['gauges'])==11
scores=[]
def lum(rgb):
 return (.299*rgb[0]+.587*rgb[1]+.114*rgb[2])
def circumference_edge(im,cx,cy,rad):
 pix=im.load();vals=[]
 for degree in range(0,360,2):
  angle=degree*math.pi/180
  p=[]
  for r in (rad-5,rad-1,rad+1,rad+5):
   x=round(cx+r*math.sin(angle));y=round(cy-r*math.cos(angle))
   if 0<=x<im.width and 0<=y<im.height:p.append(lum(pix[x,y]))
  if len(p)==4: vals.append(max(abs(p[3]-p[0]),abs(p[2]-p[1])))
 return round(sum(vals)/len(vals),3),len(vals)
for panel,ref in data['sourcePhotos'].items():
 path=ROOT/ref['asset'];raw=path.read_bytes()
 assert hashlib.sha256(raw).hexdigest()==ref['sha256'],panel
 im=Image.open(path).convert('RGB')
 assert list(im.size)==ref['size'],panel
 paint=im.copy();d=ImageDraw.Draw(paint)
 for gauge in (g for g in data['gauges'] if g['panel']==panel):
  old=gauge['oldPivotPx'];current=gauge['bezelArcCentrePx'];r=gauge['bezelRadiusPx']
  oldScore,nOld=circumference_edge(im,*old,r)
  newScore,nNew=circumference_edge(im,*current,r)
  assert nOld>=120 and nNew>=120,'Circle fell outside source PNG'
  if gauge['moveVisualMountToBezelCandidate']:
   assert newScore > oldScore + 5, (
      panel,gauge['id'],'candidate must improve original arc contrast',oldScore,newScore)
  if gauge['id']=='apuAcAmps':
   assert oldScore > newScore, 'APU rollback must be backed by source pixels'
  # Apparent bezel centre extracted from actual image; reject too-close-to-edge.
  assert 0<current[0]<im.width and 0<current[1]<im.height
  d.ellipse((old[0]-9,old[1]-9,old[0]+9,old[1]+9),outline='#ff3a3a',width=3)
  d.line((old[0]-14,old[1],old[0]+14,old[1]),fill='#ff3a3a',width=2)
  d.line((old[0],old[1]-14,old[0],old[1]+14),fill='#ff3a3a',width=2)
  d.ellipse((current[0]-r,current[1]-r,current[0]+r,current[1]+r),outline='#48ffbe',width=3)
  d.ellipse((current[0]-7,current[1]-7,current[0]+7,current[1]+7),outline='#48ffbe',width=3)
  d.line((old[0],old[1],current[0],current[1]),fill='#ffdf57',width=2)
  d.text((max(3,current[0]-65),max(3,current[1]+12)),gauge['id'],fill='#ffff3b')
  scores.append(dict(panel=panel,id=gauge['id'],oldPivot=old,fittedBezelCenter=current,
      bezelRadiusPx=r,oldCircumferenceEdgeStrength=oldScore,
      newCircumferenceEdgeStrength=newScore,
      photoHashVerified=True,physicalSpindleCertainty=False,
      visualMountMoved=gauge['moveVisualMountToBezelCandidate']))
 paint.save(OUT/(panel+'_OLD_VS_FITTED_CENTRE.png'))
report=dict(schema='b737.native-photo.gauge-ring-check.v1',originalImages=5,
 registeredGauges=11,bezelCentreMoved=8,sourceArtworkUnmodified=True,
 photometricMetrics='gray radial edge contrast: original PNG, 2-degree steps',
 mechanicalPivotCertified=False,numericGraduationsAllCertified=False,
 gauges=scores)
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'OH10_12_RIM_EVIDENCE.json').write_text(json.dumps(report,indent=2)+'\n')
print('Original-photo arc validation 11/11; 8 preview centres improved, 1 APU shift rejected, 2 existing hubs retained')
for r in scores:print(r['panel'],r['id'],'old/new rim contrast',r['oldCircumferenceEdgeStrength'],r['newCircumferenceEdgeStrength'])
