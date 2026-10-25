#!/usr/bin/env python3
"""Independent 4-connected black-lens pixel flood-fill on immutable native photos.
Excludes other lenses using the silver bezel as contour; no sourceRect mutations.
"""
import json
from collections import Counter,deque
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text(encoding="utf8"))
overhead=load("panel-mosaic-lab/interactive-overhead/lights.json")
main=load("panel-mosaic-lab/cockpit/lights.json")
spec=load("panel-mosaic-lab/all-overhead/spec.json")
atlas=load("panel-mosaic-lab/all-overhead/atlas-layout.json")
assembly=load("panel-mosaic-lab/cockpit/assembly.json")
sources={x["id"]:(ROOT/"panel-mosaic-lab/all-overhead"/x["url"]).resolve() for x in spec["images"]}
plsrc={p["id"]:p["sourceId"] for p in atlas["placements"]}
mainpieces={p["id"]:(ROOT/assembly["assets"][p["asset"]]["path"]).resolve() for r in assembly["regions"] for p in r.get("placements",[])}
cache={}
results=[]
def fit(im,rect):
 x,y,w,h=map(int,rect)
 # Source crop includes just the physical lamp + enough chrome border to separate adjacent lamps.
 mx=max(10,round(w*.24));my=max(9,round(h*.28))
 lx=max(0,x-mx);rx=min(im.shape[1],x+w+mx)
 ty=max(0,y-my);by=min(im.shape[0],y+h+my)
 window=im[ty:by,lx:rx]
 midx=int(x+w/2-lx);midy=int(y+h/2-ty)
 median=float(np.median(im[y+round(h*.35):y+round(h*.65),x+round(w*.35):x+round(w*.65)]))
 threshold=max(40,min(90,median+30))
 mask=window<threshold
 height,width=mask.shape
 def find_seed():
  if mask[midy,midx]:return midx,midy
  for rad in range(1,11):
   for dy in range(-rad,rad+1):
    for dx in range(-rad,rad+1):
     yy=midy+dy;xx=midx+dx
     if 0<=xx<width and 0<=yy<height and mask[yy,xx]:return xx,yy
  return None
 seed=find_seed()
 if seed is None:return dict(status="NEEDS_MANUAL_REVIEW",reason="NO_DARK_SEED",median=round(median,1))
 q=deque([seed]);seen=np.zeros_like(mask,dtype=bool);seen[seed[1],seed[0]]=True
 minx=maxx=seed[0]; miny=maxy=seed[1];n=0;reached_border=False
 maxpixels=int(1.8*w*h)
 while q:
  cx,cy=q.popleft();n+=1;minx=min(minx,cx);miny=min(miny,cy);maxx=max(maxx,cx);maxy=max(maxy,cy)
  if cx==0 or cy==0 or cx==width-1 or cy==height-1:reached_border=True
  if n>maxpixels:break
  for xx,yy in [(cx-1,cy),(cx+1,cy),(cx,cy-1),(cx,cy+1)]:
   if 0<=xx<width and 0<=yy<height and not seen[yy,xx] and mask[yy,xx]:
    seen[yy,xx]=True;q.append((xx,yy))
 full=(lx+minx,ty+miny,lx+maxx+1,ty+maxy+1)
 fx,fy,X,Y=full
 component_w=X-fx;component_h=Y-fy
 cx=(fx+X)/2;cy=(fy+Y)/2;dx=round(cx-(x+w/2),2);dy=round(cy-(y+h/2),2)
 sensible=.8*w<component_w<1.45*w and .75*h<component_h<1.5*h and .65*w*h<n<1.5*w*h
 confidence=sensible and not reached_border and abs(dx)<=3 and abs(dy)<=3
 status="PHOTO_COMPONENT_CENTRED" if confidence else "NEEDS_MANUAL_REVIEW"
 return dict(status=status,median=round(median,2),threshold=round(threshold,2),
             componentPixels=n,componentRect=full,componentSize=[component_w,component_h],centreDelta=[dx,dy],
             reachedCropBoundary=reached_border,sensible=sensible)
for kind,r in [("OVERHEAD",overhead),("MAIN",main)]:
 for lamp in r["lights"]:
  panel=lamp.get("placementId",lamp.get("pieceId"))
  p=sources[plsrc[panel]] if kind=="OVERHEAD" else mainpieces[panel]
  if p not in cache:
   with Image.open(p) as f:cache[p]=np.asarray(f.convert("L"),dtype=np.uint8)
  result=fit(cache[p],lamp["sourceRect"])
  results.append(dict(id=lamp["id"],scope=kind,panel=panel,sourceRect=lamp["sourceRect"],**result))
status=Counter(r["status"] for r in results)
print("PIXEL_COMPONENT_SUMMARY",json.dumps({"count":len(results),"status":dict(status),"sources":len(cache)}))
for a in results:
 print("PIXEL_COMPONENT_ROW",a["id"],a["panel"],a["status"],"delta",a.get("centreDelta"),"bbox",a.get("componentRect"),"statusFlags",a.get("sensible"),a.get("reachedCropBoundary"))
out=Path("/tmp/b737-lamp-pixel-component-qa.json")
out.write_text(json.dumps(dict(schema="b737.photo-connected-component.v1",summary=dict(status),results=results),indent=2)+"\n")
