#!/usr/bin/env python3
"""Third independent pixel audit: detect silver/black glass boundaries by scanline consensus.

Each measurement is on the original photograph. Unlike flood fill, adjacent
dark lenses cannot merge: each side search is constrained near that socket.
Does not change any placement or artwork. Its vote is advisory, never allowed
to substitute a visual geometry check with inadequate contrast.
"""
import json
from pathlib import Path
from collections import Counter
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text(encoding="utf8"))
audit=load("panel-mosaic-lab/lights-test/photo-pixel-registration-v2.json")
oh=load("panel-mosaic-lab/interactive-overhead/lights.json")
main=load("panel-mosaic-lab/cockpit/lights.json")
spec=load("panel-mosaic-lab/all-overhead/spec.json")
atlas=load("panel-mosaic-lab/all-overhead/atlas-layout.json")
assembly=load("panel-mosaic-lab/cockpit/assembly.json")
src={x["id"]:(ROOT/"panel-mosaic-lab/all-overhead"/x["url"]).resolve() for x in spec["images"]}
plates={x["id"]:x["sourceId"] for x in atlas["placements"]}
parts={x["id"]:(ROOT/assembly["assets"][x["asset"]]["path"]).resolve() for r in assembly["regions"] for x in r.get("placements",[])}
current={x["id"]:x for x in oh["lights"]+main["lights"]}
pending=[r for r in audit["records"] if r["status"]!="AUTO_PIXEL_CENTRE_MATCH_3PX"]
cache={}

def scan(im,rect):
 x,y,w,h=map(int,rect)
 H,W=im.shape
 if x<8 or y<8 or x+w+8>=W or y+h+8>=H:return {"status":"REVIEW_SOURCE_BOUNDARY"}
 # Vertical boundaries: view many rows in the core of lens, exclude rounded corners.
 # Median over raster rows rejects scratches, reflections and noisy pixels.
 y0=y+round(.27*h);y1=y+round(.73*h)
 x0=x+round(.27*w);x1=x+round(.73*w)
 def border_energy(profile,mid,polarity,span,side):
  # finite difference of a lightly-smoothed 1D scanline average
  sm=np.convolve(profile,np.ones(5)/5,mode="same")
  grad=sm[3:]-sm[:-3]
  gx=np.arange(len(grad))+1.5
  # Visible glass inner edge normally 0-12 px from registered rectangle; avoid adjoining socket.
  candidates=np.nonzero((gx>=mid-span)&(gx<=mid+span))[0]
  peaks=[]
  for k in candidates:
   val=float(grad[k]*polarity)
   if val>5.5:
    peaks.append([float(gx[k]),round(val,2)])
  if not peaks:return None
  # prioritize strong edge near original boundary, not maximal rim/bezel/adjacent lamp.
  strongest=max(v for _,v in peaks)
  filtered=[p for p in peaks if p[1]>=max(5.5,strongest*.35)]
  nearest=min(filtered,key=lambda p:(abs(p[0]-mid),-p[1]))
  return {"pos":nearest[0],"strength":nearest[1],"count":len(filtered)}
 # average vertical pixel values (glass vs chrome) at central y strip
 vert=np.median(im[y0:y1,:],axis=0)
 horz=np.median(im[:,x0:x1],axis=1)
 spanX=min(16,max(7,round(w*.075)))
 spanY=min(13,max(6,round(h*.12)))
 sides={
  "left":border_energy(vert,x,-1,spanX,"left"),
  "right":border_energy(vert,x+w,1,spanX,"right"),
  "top":border_energy(horz,y,-1,spanY,"top"),
  "bottom":border_energy(horz,y+h,1,spanY,"bottom")
 }
 if any(v is None for v in sides.values()):return {"status":"SCANLINE_REVIEW","sides":sides}
 left,right,top,bottom=(sides[k]["pos"] for k in ("left","right","top","bottom"))
 dx=round((left+right)/2-(x+w/2),2)
 dy=round((top+bottom)/2-(y+h/2),2)
 # Exception: uneven bezel width. Demands symmetric proximity and strong separate edges.
 closeness=abs(dx)<=3 and abs(dy)<=3
 geometry=abs((right-left)-w)<=24 and abs((bottom-top)-h)<=16
 robust=min(v["strength"] for v in sides.values())>=7
 verdict="SCANLINE_CENTRE_CANDIDATE" if closeness and geometry and robust else "SCANLINE_REVIEW"
 return {"status":verdict,"centreDeltaSourcePx":[dx,dy],"sides":sides,"widthDelta":round(right-left-w,1),"heightDelta":round(bottom-top-h,1)}

results=[]
for item in pending:
 l=current[item["id"]]
 p=src[plates[l["placementId"]]] if "placementId" in l else parts[l["pieceId"]]
 if p not in cache:
  with Image.open(p) as f:cache[p]=np.array(f.convert("L"),dtype=np.float64)
 result=scan(cache[p],l["sourceRect"])
 results.append({"id":l["id"],"panel":item["panel"],"sourceRect":l["sourceRect"],"oldRim":item["photoRimDelta"],"oldComponent":item["darkGlassDelta"],**result})
count=Counter(x["status"] for x in results)
print("SCANLINE_SUMMARY",json.dumps({"audited":len(results),"statuses":dict(count),"originalPhotos":len(cache)}))
for v in results:print("SCANLINE_ROW",json.dumps(v,separators=(",",":")))
path=Path("/tmp/b737-22-photo-scanline.json")
path.write_text(json.dumps({"schema":"b737.photo-scanline-qa.v1","summary":dict(count),"records":results},indent=2)+"\n")
