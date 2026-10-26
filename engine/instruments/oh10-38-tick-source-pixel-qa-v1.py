#!/usr/bin/env python3
"""Original OH10 source-native photo: independently detect 38 graded lines.
Geometry derived from radial printed ticks, NOT cosmetic metal bezel.
No source file is modified, or hidden mechanical spindle released.
"""
import cv2, numpy as np, json, hashlib, math
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
ledger=json.loads((ROOT/'engine/instruments/oh10-source-radial-graduations-v1.json').read_text())
original=ROOT/ledger['originalPhoto']
assert hashlib.sha256(original.read_bytes()).hexdigest()==ledger['originalSHA']
im=Image.open(original).convert('RGB')
assert list(im.size)==ledger['imageNativeSize']
out=ROOT/'artifacts/native-arc-audit/oh10-graded-ticks'
out.mkdir(parents=True,exist_ok=True)
reports=[]
for g in ledger['gauges']:
 crop=g['sourceCrop'];xy=(crop['x'],crop['y'])
 photo=np.array(im.crop((xy[0],xy[1],xy[0]+crop['w'],xy[1]+crop['h'])))
 gray=cv2.cvtColor(photo,cv2.COLOR_RGB2GRAY)
 mask=(gray>168).astype(np.uint8)*255
 lo,hi={'dcAmps':(60,180),'dcVolts':(150,265),'acVolts':(125,248)}[g['id']]
 mask[:lo]=0;mask[hi:]=0
 n,labels,stats,centroids=cv2.connectedComponentsWithStats(mask,8)
 points=[];axes=[];selected=set()
 for mark in g['sourceMarks']:
  expected=np.array(mark['nativeCentroidPx'])-np.array(xy)
  d=np.linalg.norm(centroids-expected,axis=1)
  d[0]=float('inf')
  idx=int(np.argmin(d))
  assert d[idx]<2.2,(g['id'],mark['value'],'stroke not found',d[idx])
  assert idx not in selected,(g['id'],mark['value'],'duplicate')
  selected.add(idx)
  y,x=np.where(labels==idx)
  pts=np.stack([x,y],axis=1).astype(float)
  mean=pts.mean(axis=0);direction=np.linalg.svd(pts-mean,full_matrices=False)[2][0]
  normal=np.array([-direction[1],direction[0]])
  axes.append((normal,mean))
  points.append((mark,pts,mean))
 A=np.stack([a for a,b in axes]);b=np.array([float(a@pt) for a,pt in axes])
 centerLocal=np.linalg.lstsq(A,b,rcond=None)[0]
 center=centerLocal+np.array(xy)
 rms=float(np.sqrt(np.mean((A@centerLocal-b)**2)))
 dif=float(np.linalg.norm(center-g['radialIntersectionCenterPx']))
 assert dif<2.5 and rms<6.0,(g['id'],'pivot line regression',center.tolist(),dif,rms)
 paint=im.copy();p=ImageDraw.Draw(paint)
 cx,cy=center
 p.ellipse((cx-8,cy-8,cx+8,cy+8),outline='#25fff0',width=3)
 tip=g['sourceOriginalPaintedTipPx']
 p.ellipse((cx-tip,cy-tip,cx+tip,cy+tip),outline='#ffa53b',width=2)
 gaps=[];maxangle=0
 for mark,pts,mean in points:
  nativePts=pts+np.array(xy);mid=mean+np.array(xy)
  rmin=float(np.min(np.linalg.norm(nativePts-center,axis=1)))
  gap=rmin-tip*(216+.6)/216 if g['id'] in ('dcAmps','dcVolts','acVolts') else rmin-tip
  assert gap>1.4,(g['id'],mark['value'],'pointer tip intersects real printed line',gap)
  assert abs(rmin-mark['nativeInnerRadiusPx'])<2,(g['id'],mark['value'],'radial length drift')
  angle=float(np.degrees(np.arctan2(mid[0]-cx,cy-mid[1])))
  delta=abs(angle-mark['angleDeg'])
  assert delta<1.0,(g['id'],mark['value'],'angle discrepancy',delta)
  maxangle=max(maxangle,delta)
  gaps.append(gap)
  v=math.radians(mark['angleDeg']);tipPt=(cx+tip*math.sin(v),cy-tip*math.cos(v))
  p.line(((cx,cy),tipPt),fill='#06b6fa',width=1)
  p.ellipse((mid[0]-2,mid[1]-2,mid[0]+2,mid[1]+2),fill='#2fffa1')
  p.text((mid[0]+3,mid[1]+3),str(mark['value']),fill='#ffe85c')
 paint.save(out/(g['id']+'_PHOTO_SCALE_ANNOTATED.png'))
 reports.append(dict(gauge=g['id'],strokesFromOriginal=len(selected),
    fittedTrueRadialAxisCenterPx=[round(float(cx),3),round(float(cy),3)],
    radialAxisRmsErrorPx=round(rms,3),centerDiffToRegisteredPx=round(dif,3),
    maximumScaleAngleErrorDeg=round(maxangle,3),
    minimumTipStrokeClearancePx=round(min(gaps),3),
    physicalHiddenShaftCertified=False,calibratedManualReading=g['manualPreviewAvailable']))
 print('OH10 original photo',g['id'],len(selected),'strokes','pivot',center,
  'axis RMS',round(rms,3),'needle/tick clearance',round(min(gaps),3))
assert sum(x['strokesFromOriginal'] for x in reports)==38
(out/'OH10_ORIGINAL_38_TICKS_REPORT.json').write_text(json.dumps({
'schema':ledger['schema'],'SHA256':ledger['originalSHA'],
'fullPhotoTickIdentificationPassed':True,'hiddenShaftAuthorized':False,
'results':reports},indent=2)+'\n')
