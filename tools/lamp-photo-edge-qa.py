#!/usr/bin/env python3
"""Photographic dark-glass edge checks, native SOURCE pixel coordinates.
Read-only: never changes source images or sourceRect data.
Edge detection is a secondary measurement; return REVIEW for ambiguous seams.
"""
import json
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
read=lambda s: json.loads((ROOT/s).read_text(encoding="utf8"))
oh=read("panel-mosaic-lab/interactive-overhead/lights.json")
main=read("panel-mosaic-lab/cockpit/lights.json")
atlas=read("panel-mosaic-lab/all-overhead/atlas-layout.json")
spec=read("panel-mosaic-lab/all-overhead/spec.json")
assembly=read("panel-mosaic-lab/cockpit/assembly.json")
sources={im["id"]:(ROOT/"panel-mosaic-lab/all-overhead"/im["url"]).resolve() for im in spec["images"]}
source_ids={pl["id"]:pl["sourceId"] for pl in atlas["placements"]}
pieces={p["id"]:(ROOT/assembly["assets"][p["asset"]]["path"]).resolve() for r in assembly["regions"] for p in r.get("placements",[])}

def estimate(im, rect):
    x,y,w,h=map(int,rect)
    if x<0 or y<0 or x+w>im.shape[1] or y+h>im.shape[0]:
        raise ValueError(f"sourceRect out of bounds {rect}")
    midx=x+w*.5; midy=y+h*.5
    # Average central 40% of glass, away from screws, reflections and round corners.
    vert=np.mean(im[max(0,round(y+.3*h)):round(y+.7*h),:],axis=0)
    horiz=np.mean(im[:,max(0,round(x+.3*w)):round(x+.7*w)],axis=1)
    def edge(profile,target,span,direction):
        k=max(5,int(round(span*.14)))
        a=max(3,int(round(target-k)));b=min(len(profile)-4,int(round(target+k)))
        if b<=a:return None
        # +/- 2 pixels contrast across the physical glass/rim transition.
        sample=profile[a+2:b+3]-profile[a-2:b-1]
        power=direction*sample
        best=int(np.argmax(power))
        quality=float(power[best])
        coord=a+best
        return {"p":coord,"strength":round(quality,2),"distance":round(coord-target,2)}
    left=edge(vert,x,w,-1)
    right=edge(vert,x+w,w,1)
    top=edge(horiz,y,h,-1)
    bottom=edge(horiz,y+h,h,1)
    if any(e is None for e in [left,right,top,bottom]):
        return {"status":"EDGE_REVIEW","reason":"INSUFFICIENT_SEARCH"}
    centx=(left["p"]+right["p"])*.5; centy=(top["p"]+bottom["p"])*.5
    dx=round(centx-midx,2);dy=round(centy-midy,2)
    strengths=[e["strength"] for e in [left,right,top,bottom]]
    # Confidence only; not a human sign-off.
    robust=min(strengths)>=10
    centre_ok=abs(dx)<=3 and abs(dy)<=3
    # Measured black-glass edges usually lie OUTSIDE the inset display rectangle.
    encloses=left["p"]<=x+2 and right["p"]>=x+w-2 and top["p"]<=y+2 and bottom["p"]>=y+h-2
    status="AUTO_CENTRE_MATCH" if robust and centre_ok and encloses else "EDGE_REVIEW"
    return {"status":status,"centreDeviationSourcePx":[dx,dy],
            "detectedBounds":[left["p"],top["p"],right["p"],bottom["p"]],
            "edgeStrength":strengths,"edgeDistance":[left["distance"],top["distance"],right["distance"],bottom["distance"]],
            "edgeEnclosesSourceRect":encloses}

records=[]
photos={}
for scope,source_reg in (("OVERHEAD",oh),("MAIN",main)):
    for c in source_reg["lights"]:
        panel=c.get("placementId",c.get("pieceId"))
        filename=sources[source_ids[panel]] if scope=="OVERHEAD" else pieces[panel]
        if filename not in photos:
            with Image.open(filename) as pic:
                rgb=np.array(pic.convert("L"),dtype=np.float32)
            photos[filename]=rgb
        result=estimate(photos[filename],c["sourceRect"])
        records.append(dict(id=c["id"],panel=panel,scope=scope,sourceRect=c["sourceRect"],source=str(filename.relative_to(ROOT)),**result))
summary=dict(total=len(records),sourcePhotos=len(photos),statuses=dict(Counter(r["status"] for r in records)),review=[dict(id=r["id"],panel=r["panel"],delta=r.get("centreDeviationSourcePx"),strengths=r.get("edgeStrength")) for r in records if r["status"]!="AUTO_CENTRE_MATCH"])
out=Path("/tmp/b737-lamp-photo-edge-results.json")
out.write_text(json.dumps(dict(schema="b737.pixel-edges.v1",summary=summary,records=records),indent=2)+"\n")
print("EDGE_QA_SUMMARY",json.dumps({k:v for k,v in summary.items() if k!="review"}))
for r in records:
    print("EDGE_ROW",r["id"],r["panel"],r["status"],"delta",r.get("centreDeviationSourcePx"),"strength",r.get("edgeStrength"))
print("EDGE_REVIEW_COUNT",len(summary["review"]))
