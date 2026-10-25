#!/usr/bin/env python3
"""Enlarged 1:1-source photographic evidence for the remaining non-auto-certified annunciators.
No mutation of original files. Each image is a crop around the real source socket.
"""
import base64,io,json,math
from pathlib import Path
from collections import defaultdict
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
read=lambda x:json.loads((ROOT/x).read_text(encoding="utf8"))
baseline=read("panel-mosaic-lab/lights-test/photo-pixel-registration-2026-10-26.json")
changes=read("panel-mosaic-lab/lights-test/photo-position-corrections-v1.json")
excluded={r["id"] for r in changes["records"]}
remaining={r["id"] for r in baseline["records"] if r["pixelCentreVerdict"]!="PHOTO_PIXEL_CENTRE_VERIFIED_3PX"}-excluded
assert len(remaining)==24,(len(remaining),sorted(remaining))
overhead=read("panel-mosaic-lab/interactive-overhead/lights.json")
main=read("panel-mosaic-lab/cockpit/lights.json")
atlas=read("panel-mosaic-lab/all-overhead/atlas-layout.json")
spec=read("panel-mosaic-lab/all-overhead/spec.json")
assembly=read("panel-mosaic-lab/cockpit/assembly.json")
src={x["id"]:(ROOT/"panel-mosaic-lab/all-overhead"/x["url"]).resolve() for x in spec["images"]}
pl={p["id"]:p["sourceId"] for p in atlas["placements"]}
mp={p["id"]:(ROOT/assembly["assets"][p["asset"]]["path"]).resolve() for r in assembly["regions"] for p in r.get("placements",[])}
groups=defaultdict(list)
for area,reg in [("OVERHEAD",overhead),("MAIN",main)]:
 for l in reg["lights"]:
  if l["id"] in remaining:
   panel=l.get("placementId",l.get("pieceId"))
   groups[panel].append((l,src[pl[panel]] if area=="OVERHEAD" else mp[panel]))
out=Path("/tmp/b737-remaining-24-crops");out.mkdir(parents=True,exist_ok=True)
for panel,entries in sorted(groups.items()):
 cw,ch=560,390;cols=2;rows=math.ceil(len(entries)/cols)
 image=Image.new("RGB",(cw*cols,rows*ch+28),"#161b20")
 draw=ImageDraw.Draw(image)
 draw.text((12,9),f"{panel} | {len(entries)} pixel-resolution pending sockets | RED=sourceRect GREEN=center",fill="#fff")
 for i,(lamp,source) in enumerate(entries):
  with Image.open(source) as p:photo=p.convert("RGB")
  x,y,w,h=lamp["sourceRect"]
  pad_x=max(16,int(w*.25));pad_y=max(16,int(h*.28))
  l,t=max(0,x-pad_x),max(0,y-pad_y)
  r,b=min(photo.width,x+w+pad_x),min(photo.height,y+h+pad_y)
  crop=photo.crop((l,t,r,b))
  scale=min((cw-16)/crop.width,(ch-48)/crop.height)
  new=(round(crop.width*scale),round(crop.height*scale))
  crop=crop.resize(new,Image.Resampling.NEAREST) # no image smoothing (preserve pixel evidence)
  dx=(i%cols)*cw+8;dy=(i//cols)*ch+35
  image.paste(crop,(dx,dy))
  bbox=[dx+(x-l)*scale,dy+(y-t)*scale,dx+(x+w-l)*scale,dy+(y+h-t)*scale]
  draw.rectangle(bbox,outline="#ff3232",width=2)
  mx=(bbox[0]+bbox[2])/2;my=(bbox[1]+bbox[3])/2
  draw.line((mx-9,my,mx+9,my),fill="#1affcf",width=2)
  draw.line((mx,my-9,mx,my+9),fill="#1affcf",width=2)
  draw.text((dx,dy-16),f"{lamp['id']}  ({x},{y},{w},{h})  {scale:.2f}x native pixels",fill="white")
 path=out/(panel.replace("/","_")+".png")
 image.save(path,optimize=True)
 print("VISUAL_REVIEW_BASE64",panel,base64.b64encode(path.read_bytes()).decode("ascii"))
print("VISUAL_REVIEW_SUMMARY",json.dumps({"pending":len(remaining),"panels":len(groups),"ids":sorted(remaining)}))
