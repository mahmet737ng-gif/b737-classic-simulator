#!/usr/bin/env python3
"""Last two annunciator socket rim audit on ORIGINAL colour pixels.

This tool is intentionally conservative: require four independently observed
physical rim edges. A missing edge cannot be 'inferred' from the intended
rectangle size, and a successful lens reflow is NOT a pixel-position certificate.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text(encoding="utf8"))
oh=load("panel-mosaic-lab/interactive-overhead/lights.json")
main=load("panel-mosaic-lab/cockpit/lights.json")
atlas=load("panel-mosaic-lab/all-overhead/atlas-layout.json")
spec=load("panel-mosaic-lab/all-overhead/spec.json")
assembly=load("panel-mosaic-lab/cockpit/assembly.json")
sources={s["id"]:(ROOT/"panel-mosaic-lab/all-overhead"/s["url"]).resolve() for s in spec["images"]}
placements={s["id"]:s["sourceId"] for s in atlas["placements"]}
pieces={p["id"]:(ROOT/assembly["assets"][p["asset"]]["path"]).resolve() for region in assembly["regions"] for p in region.get("placements",[])}
byid={x["id"]:x for x in oh["lights"]+main["lights"]}
TARGETS=["flight-recorder-off","main-pull-up-captain"]
records=[]
for id in TARGETS:
 c=byid[id]
 photo=sources[placements[c["placementId"]]] if "placementId" in c else pieces[c["pieceId"]]
 with Image.open(photo) as file:
  im=np.asarray(file.convert("RGB"),dtype=np.float32)
 x,y,w,h=map(int,c["sourceRect"])
 gray=np.dot(im,[.2126,.7152,.0722])
 # Draw no conclusions from physical rim pixels outside the source photograph
 if x<14 or y<14 or x+w+14>=im.shape[1] or y+h+14>=im.shape[0]:raise ValueError("Photo ROI outside original image")
 crop_rows=im[y+round(h*.3):y+round(h*.7),:,:]
 crop_cols=im[:,x+round(w*.3):x+round(w*.7),:]
 # Mean and median statistics for all three colour channels, independently.
 vert=np.median(crop_rows,axis=0)
 horiz=np.median(crop_cols,axis=1)
 sides={}
 for side,profile,target,sign,span in [
  ("left",vert,x,-1,max(7,int(w*.19))),
  ("right",vert,x+w,1,max(7,int(w*.19))),
  ("top",horiz,y,-1,max(7,int(h*.19))),
  ("bottom",horiz,y+h,1,max(7,int(h*.19)))
 ]:
  candidates=[]
  # Signed contrast expected from metal bezel to dark lens (or reverse).
  for p in range(max(4,target-span),min(len(profile)-5,target+span)+1):
   outer=np.median(profile[p-4:p-1],axis=0)
   inner=np.median(profile[p+1:p+4],axis=0)
   difference=(inner-outer)*sign
   lum=float(np.dot(difference,[.2126,.7152,.0722]))
   chroma=float(np.linalg.norm(difference)/np.sqrt(3))
   if lum<4.25 or chroma<5.25:continue
   # A nearby strong edge is safer than distant decorative metal edges.
   candidates.append(dict(position=p,delta=p-target,lum=round(lum,2),colorGradient=round(chroma,2)))
  if not candidates:
   sides[side]={"status":"NO_SAFELY_ISOLATED_RIM","position":None,"candidateCount":0}
   continue
  dominant=max(r["colorGradient"] for r in candidates)
  viable=[r for r in candidates if r["colorGradient"]>=max(5.25,dominant*.36)]
  best=min(viable,key=lambda r:(abs(r["delta"]),-r["colorGradient"]))
  sides[side]={**best,"status":"MEASURED_RIM","candidateCount":len(viable)}
 xs=[sides[k].get("position") for k in ("left","right")]
 ys=[sides[k].get("position") for k in ("top","bottom")]
 if None in xs or None in ys:
  status="PHOTO_COLOUR_RIM_REVIEW";center=None
 else:
  dx=(xs[0]+xs[1])/2-(x+w/2)
  dy=(ys[0]+ys[1])/2-(y+h/2)
  center=[round(dx,2),round(dy,2)]
  shape_good=abs((xs[1]-xs[0])-w)<=max(8,.12*w) and abs((ys[1]-ys[0])-h)<=max(6,.16*h)
  near=abs(dx)<=3 and abs(dy)<=3
  status="COLOUR_FOUR_SIDE_CENTRE_CANDIDATE" if shape_good and near else "PHOTO_COLOUR_RIM_REVIEW"
 record={"id":id,"panel":c.get("placementId",c.get("pieceId")),"sourcePhoto":str(photo.relative_to(ROOT)),
         "sourceRect":c["sourceRect"],"fourIndependentEdges":all(x["status"]=="MEASURED_RIM" for x in sides.values()),
         "centreDeviationNativePixels":center,"status":status,"edgeEvidence":sides}
 records.append(record)
 print("SPECIAL_PHOTO_ROW",json.dumps(record,separators=(",",":")))
out={"schema":"b737.lamps.two-special-photo-colour-rim.v1","total":len(records),
     "method":"Three-channel photo rim signed-gradients with independent four-edge requirement.",
     "photosChanged":0,"positionsChanged":0,
     "note":"Candidate requires separate second-method agreement before any final geometric sign-off.","records":records}
Path("/tmp/b737-lamp-special-two-colour-pixels.json").write_text(json.dumps(out,indent=2)+"\n")
print("SPECIAL_PHOTO_SUMMARY",json.dumps({"total":len(records),"candidates":sum(x["status"]=="COLOUR_FOUR_SIDE_CENTRE_CANDIDATE" for x in records)}))
