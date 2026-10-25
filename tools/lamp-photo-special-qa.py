#!/usr/bin/env python3
"""Targeted, non-destructive *candidate* measurement for two difficult lamp photographs.

Extract 2D multicolour (RGB) rim gradients on several independent transverse
scanlines. Report confidence and image-based candidate geometry, never silently
change an aviation panel source ROI. Has no authority to mark a borderline case
as pixel certified until its physical glass edges are visually corroborated.
"""
from collections import defaultdict
import base64
import io
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((ROOT/p).read_text(encoding="utf8"))
oh=read("panel-mosaic-lab/interactive-overhead/lights.json")
main=read("panel-mosaic-lab/cockpit/lights.json")
atlas=read("panel-mosaic-lab/all-overhead/atlas-layout.json")
spec=read("panel-mosaic-lab/all-overhead/spec.json")
assembly=read("panel-mosaic-lab/cockpit/assembly.json")
ids={"flight-recorder-off","main-pull-up-captain"}
source_photo={x["id"]:(ROOT/"panel-mosaic-lab/all-overhead"/x["url"]).resolve() for x in spec["images"]}
id_to_source={x["id"]:x["sourceId"] for x in atlas["placements"]}
main_pieces={p["id"]:(ROOT/assembly["assets"][p["asset"]]["path"]).resolve() for r in assembly["regions"] for p in r.get("placements",[])}
lamps=[x for x in oh["lights"]+main["lights"] if x["id"] in ids]
if len(lamps)!=2:raise ValueError("Target lamp sources unavailable")

def measure_side(arr,side,rect):
 x,y,w,h=map(int,rect)
 H,W,_=arr.shape
 is_vertical=side in ("left","right")
 outer=float(x if side=="left" else x+w if side=="right" else y if side=="top" else y+h)
 expected_sign=-1 if side in ("left","top") else 1
 span=9 if min(w,h)<50 else 13
 bands=(.24,.34,.44,.54,.64,.74)
 rows=[]
 for frac in bands:
  if is_vertical:
   sy=round(y+h*frac)
   a=max(0,sy-2);b=min(H,sy+3)
   profile=np.mean(arr[a:b,:,:],axis=0)
  else:
   sx=round(x+w*frac)
   a=max(0,sx-2);b=min(W,sx+3)
   profile=np.mean(arr[:,a:b,:],axis=1)
  mid=int(round(outer));lo=max(5,mid-span);hi=min(len(profile)-6,mid+span)
  if hi<=lo:continue
  candidates=[]
  for k in range(lo,hi+1):
   # RGB scanline difference across 3 native image pixels; brightness
   # keeps dark-glass inner rim distinct from adjacent lens text.
   d=profile[k+2]-profile[k-2]
   signed=float(np.mean(d))*expected_sign
   labdiff=float(np.linalg.norm(d))/1.73205
   if signed>3.0 and labdiff>5.0:
    # Strong contrast plus proximity to expected socket edge.
    candidates.append((k,round(signed,2),round(labdiff,2)))
  if not candidates:continue
  max_strength=max(z[1] for z in candidates)
  eligible=[z for z in candidates if z[1]>=max(4.0,max_strength*.5)]
  best=min(eligible,key=lambda z:(abs(z[0]-outer),-z[1]))
  rows.append(dict(frac=frac,edge=int(best[0]),signedContrast=best[1],rgbContrast=best[2]))
 if len(rows)<4:return dict(side=side,status="WEAK",samples=rows)
 values=np.array([r["edge"] for r in rows],dtype=float)
 med=float(np.median(values))
 spread=float(np.median(np.abs(values-med)))
 strength=float(np.median([z["signedContrast"] for z in rows]))
 # The perspective-rich PULL UP face might naturally vary in edge
 # position with row. Report that spread without forcing rectangularity.
 return dict(side=side,status="MEASURED" if spread<=3.5 and strength>=5 else "AMBIGUOUS",
             medianSourcePx=med,spreadSourcePx=round(spread,2),
             medianSignedContrast=round(strength,2),samples=rows)

def crop_evidence(rgb,rect,result):
 x,y,w,h=map(int,rect)
 pad=max(12,round(max(w,h)*.12))
 left=max(0,x-pad);top=max(0,y-pad)
 right=min(rgb.width,x+w+pad);bottom=min(rgb.height,y+h+pad)
 cut=rgb.crop((left,top,right,bottom))
 ratio=6 if w<50 else 3
 im=cut.resize((cut.width*ratio,cut.height*ratio),Image.Resampling.NEAREST)
 d=ImageDraw.Draw(im)
 box=((x-left)*ratio,(y-top)*ratio,(x+w-left)*ratio,(y+h-top)*ratio)
 d.rectangle(box,outline="#ff4b52",width=3)
 d.line(((x+w/2-left)*ratio-10,(y+h/2-top)*ratio,(x+w/2-left)*ratio+10,(y+h/2-top)*ratio),fill="#52f4c4",width=3)
 d.line(((x+w/2-left)*ratio,(y+h/2-top)*ratio-10,(x+w/2-left)*ratio,(y+h/2-top)*ratio+10),fill="#52f4c4",width=3)
 for side,info in result["sides"].items():
  if "medianSourcePx" not in info:continue
  pos=(info["medianSourcePx"]-(left if side in ("left","right") else top))*ratio
  if side in ("left","right"):d.line((pos,0,pos,im.height),fill="#44c2ff",width=2)
  else:d.line((0,pos,im.width,pos),fill="#44c2ff",width=2)
 return im

reports=[]
for lamp in lamps:
 panel=lamp.get("placementId",lamp.get("pieceId"))
 source=source_photo[id_to_source[panel]] if "placementId" in lamp else main_pieces[panel]
 with Image.open(source) as im:photo=im.convert("RGB")
 rgb=np.asarray(photo,dtype=np.float64)
 rect=lamp["sourceRect"]
 scans={k:measure_side(rgb,k,rect) for k in ("left","right","top","bottom")}
 measurable=all(s["status"]=="MEASURED" for s in scans.values())
 if measurable:
  left,right,top,bottom=(scans[k]["medianSourcePx"] for k in ("left","right","top","bottom"))
  dx=(left+right)/2-(rect[0]+rect[2]/2)
  dy=(top+bottom)/2-(rect[1]+rect[3]/2)
  status="CANDIDATE_FOUR_SIDE_MATCH" if max(abs(dx),abs(dy))<=3 else "REVIEW_MEASURED_OFFSET"
 else:
  dx=dy=None
  status="UNRESOLVED_PHOTO_BOUNDARY"
 result={"id":lamp["id"],"panel":panel,"originalSource":str(source.relative_to(ROOT)),
         "sourceRect":rect,"sides":scans,"centreDeviation":[dx,dy],
         "status":status,"annotationNote":"RED current glass ROI, CYAN four measured rim lines, GREEN original center; no pixels or coordinates changed"}
 review=crop_evidence(photo,rect,result)
 buffer=io.BytesIO();review.save(buffer,format="PNG",optimize=True)
 print("SPECIAL_PHOTO_PREVIEW",lamp["id"],base64.b64encode(buffer.getvalue()).decode("ascii"))
 reports.append(result)
 print("SPECIAL_PHOTO_MEASUREMENT",json.dumps({k:v for k,v in result.items() if k!="sides"},separators=(",",":")))
out=Path("/tmp/b737-special-two-lamps-evidence.json")
out.write_text(json.dumps({"schema":"b737.photographic-special-two.v1","records":reports},indent=2)+"\n",encoding="utf8")
print("SPECIAL_PHOTO_SUMMARY",json.dumps({"count":len(reports),"status":{r["id"]:r["status"] for r in reports}}))
