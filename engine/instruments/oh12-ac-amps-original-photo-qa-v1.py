#!/usr/bin/env python3
"""Strict OH12 photo-pixel audit: 42 source-native graduation lines.
Recomputes PCA intersections independently from the stored registry.
All image assets immutable. A hidden spindle cannot be certified from a rim.
"""
import cv2, numpy as np, json, hashlib, math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]
LEDGER=json.loads((ROOT/'engine/instruments/oh12-ac-amps-photo-graduations-v1.json').read_text())
PHOTO=ROOT/LEDGER['photo']
assert hashlib.sha256(PHOTO.read_bytes()).hexdigest()==LEDGER['sha256']
im=Image.open(PHOTO).convert('RGB')
assert list(im.size)==LEDGER['imageSizePx']
out=ROOT/'artifacts/native-arc-audit/oh12-ac-amps'
out.mkdir(parents=True,exist_ok=True)
reports=[]
for gauge in LEDGER['gauge']:
 c=gauge['crop'];crop=np.array(im.crop((c['x'],c['y'],c['x']+c['width'],c['y']+c['height'])))
 gray=cv2.cvtColor(crop,cv2.COLOR_RGB2GRAY)
 mask=(gray>163).astype(np.uint8)*255
 mask[:95]=0;mask[205:]=0
 n,labels,stats,centers=cv2.connectedComponentsWithStats(mask,8)
 lines=[];marks=[];chosen=set()
 for row in gauge['strokes']:
  estimated=np.array(row['sourceCentroidPx'])-np.array([c['x'],c['y']])
  distances=np.linalg.norm(centers-estimated,axis=1)
  distances[0]=float('inf')
  idx=int(np.argmin(distances))
  assert distances[idx]<2.1,(gauge['id'],row['valueA'],'component not independently rediscovered',float(distances[idx]))
  assert idx not in chosen,(gauge['id'],row['valueA'],'duplicate component')
  chosen.add(idx)
  ys,xs=np.where(labels==idx)
  pixels=np.stack((xs,ys),axis=1).astype(float)
  mean=pixels.mean(axis=0);basis=np.linalg.svd(pixels-mean,full_matrices=False)[2][0]
  normal=np.array([-basis[1],basis[0]])
  lines.append((normal,mean))
  marks.append((row,pixels,mean))
 A=np.stack([normal for normal,_ in lines])
 b=np.array([float(normal @ point) for normal,point in lines])
 center=np.linalg.lstsq(A,b,rcond=None)[0]+np.array([c['x'],c['y']])
 residual=np.abs(A @ (center-np.array([c['x'],c['y']]))-b)
 rms=float(np.sqrt(np.mean(residual**2)))
 claimed=np.array(gauge['radialLineIntersectionPivotPx'])
 deviation=float(np.linalg.norm(center-claimed))
 assert rms<3.5 and deviation<2,(gauge['id'],'wrong center',rms,deviation,center.tolist())
 painted=im.copy();pen=ImageDraw.Draw(painted)
 px,py=map(float,center)
 pen.ellipse((px-9,py-9,px+9,py+9),outline=(15,230,210),width=3)
 pen.ellipse((px-126,py-126,px+126,py+126),outline=(255,180,10),width=2)
 maxBearingError=0;minClearance=999
 for (row,pixels,mean) in marks:
  mn=mean+np.array([c['x'],c['y']])
  ang=math.degrees(math.atan2(mn[0]-px,py-mn[1]))
  error=abs(ang-row['angleDeg'])
  maxBearingError=max(error,maxBearingError)
  assert error<.9,(gauge['id'],row['valueA'],'wrong angle',error)
  absPixels=pixels+np.array([c['x'],c['y']])
  dist=np.hypot(absPixels[:,0]-px,absPixels[:,1]-py)
  rmin=float(dist.min())
  assert abs(rmin-row['innerStrokeRadiusPx'])<2.0,(gauge['id'],row['valueA'],'tip radius mismatch')
  paintedTipRadius=125*(220+1.4/2)/220
  clearance=rmin-paintedTipRadius
  minClearance=min(minClearance,clearance)
  assert clearance>1.5,(gauge['id'],row['valueA'],'needle crosses printed line')
  bearing=math.radians(row['angleDeg'])
  end=(px+125*math.sin(bearing),py-125*math.cos(bearing))
  pen.line(((px,py),end),fill=(27,186,240),width=1)
  pen.ellipse((mn[0]-3,mn[1]-3,mn[0]+3,mn[1]+3),fill=(50,255,112))
  pen.text((mn[0]+4,mn[1]+4),str(row['valueA']),fill=(255,245,0))
 assert len(chosen)==21
 output=out/(gauge['id']+'_RADIAL_TICKS.png')
 painted.save(output)
 reports.append({'id':gauge['id'],'physicalSource':LEDGER['photo'],
   'realNativeTickComponents':21,'confirmedPrintedMajorValues':[0,50,100,150,200],
   'graduationStepA':10,'centerByTrueStrokeLinesPx':[round(px,3),round(py,3)],
   'pivotRecalculationResidualPx':round(rms,3),
   'differenceFromRegistryPx':round(deviation,3),
   'maxRegisteredTickAngularDifferenceDeg':round(maxBearingError,3),
   'minimumNeedleTipToPrintClearancePx':round(minClearance,3),
   'imageOriginalUnmodified':True,
   'actualHiddenShaftCertified':False})
 print('OH12 source photo',gauge['id'],'21 of 21 ticks','pivot',center,'RMS',round(rms,3),
  'min needle tip clearance',round(minClearance,3))
assert len(reports)==2
(out/'OH12_TWO_GAUGE_CALIBRATION_QA.json').write_text(json.dumps({'schema':LEDGER['schema'],
 'sourceImageSHA256':LEDGER['sha256'],'allPhotoTickMatchesPassed':True,
 'fullSourceTickValuesRegistered':True,
 'actualPhysicalSpindleStillHidden':True,'results':reports},indent=2)+'\n')
