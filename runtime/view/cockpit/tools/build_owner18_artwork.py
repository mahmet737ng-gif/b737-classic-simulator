#!/usr/bin/env python3
"""Create transparent, identically registered owner18 sprite derivatives from eight locked PNGs.
No recoloring, redrawing or resampling. Only remove the exterior black background,
if the original happens to contain an opaque one, and trim ONE shared border.
"""
from pathlib import Path
from PIL import Image
import numpy as np,cv2,hashlib,json
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/"panel-mosaic-lab/assets/locked/2026-10-23/Switches/guard"
OUT=SOURCE/"runtime";OUT.mkdir(parents=True,exist_ok=True)
NAMES=[f"{c}_Guarded_{s}.png" for c in ("Black","Red") for s in ("CLOSED","Open_UP","Open_CENTER","Open_DOWN")]
items={};union=None
for name in NAMES:
    path=SOURCE/name
    raw=path.read_bytes()
    im=Image.open(path).convert("RGBA")
    arr=np.array(im)
    if not np.any(arr[:,:,3]<220):
        # Remove only pitch-black connected OUTSIDE pixels, preserving the
        # interior black guard, scratches, hinges, and silver lever geometry.
        dark=np.max(arr[:,:,:3],axis=2)<=26
        n,labels,stats,_=cv2.connectedComponentsWithStats(dark.astype("uint8"),8)
        border=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
        exterior=np.isin(labels,border)&dark
        if not np.any(exterior):
            raise RuntimeError(f"{name}: opaque image has no removable exterior; refuses to publish a black square")
        arr[exterior,3]=0
    ys,xs=np.where(arr[:,:,3]>12)
    if not len(xs):raise RuntimeError(f"No nontransparent pixels in {name}")
    bbox=[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1]
    union=bbox if union is None else [min(union[0],bbox[0]),min(union[1],bbox[1]),max(union[2],bbox[2]),max(union[3],bbox[3])]
    items[name]={"pixels":arr,"sourceSize":[im.width,im.height],"sourceSha256":hashlib.sha256(raw).hexdigest(),
                 "artworkBBoxNative":bbox,"transparentFraction":round(float(np.mean(arr[:,:,3]<12)),5)}
sizes={tuple(x["sourceSize"]) for x in items.values()}
if len(sizes)!=1:raise RuntimeError("Eight approved images do not share a pixel grid: "+str(sizes))
assert union and union[2]>union[0] and union[3]>union[1]
for name,x in items.items():
    crop=x.pop("pixels")[union[1]:union[3],union[0]:union[2]]
    dest=OUT/name
    Image.fromarray(crop,"RGBA").save(dest,optimize=True)
    x["spriteSha256"]=hashlib.sha256(dest.read_bytes()).hexdigest()
    x["runtimeSize"]=[crop.shape[1],crop.shape[0]]
    x["runtimeTransparentFraction"]=round(float(np.mean(crop[:,:,3]<12)),5)
    if x["runtimeTransparentFraction"]==0:
        raise RuntimeError(f"{name}: PNG sprite was not made transparent")
manifest={"version":"OWNER18-ARTWORK-20261027","sourcesUnchanged":True,"commonCropNative":union,
"outputSize":[union[2]-union[0],union[3]-union[1]],"assets":items,"count":len(items),
"alphaOnlyBackgroundRemoval":True,"sourceGeometryUnaltered":True}
(OUT/"artwork-audit.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("PASS 8 photo assets cropped at a common unchanged origin:",union,manifest["outputSize"])
for name,x in items.items():
    print(name,x["runtimeSize"],"transparent",x["runtimeTransparentFraction"],"original",x["artworkBBoxNative"])
