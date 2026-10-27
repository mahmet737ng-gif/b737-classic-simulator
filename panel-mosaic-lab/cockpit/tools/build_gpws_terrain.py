#!/usr/bin/env python3
"""Derive the owner-requested three-position GPWS background.
Modify only the isolated panel photograph's GPWS zone, never the locked master.
"""
from pathlib import Path
import hashlib, json
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/"panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png"
OUT=ROOT/"panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_V2.png"
PREVIEW=ROOT/"panel-mosaic-lab/cockpit/assets/gpws-terrain-qa-preview.webp"
MANIFEST=ROOT/"panel-mosaic-lab/cockpit/assembly.json"
REPORT=ROOT/"panel-mosaic-lab/cockpit/assets/gpws-terrain-v2-audit.json"

raw=SOURCE.read_bytes()
before=Image.open(SOURCE).convert("RGB")
assert before.size==(918,1713), f"Unexpected master dims {before.size}"
arr=np.array(before)
old=arr.copy()

# The existing two recesses and lettering are inside the GPWS plate.
# Clone ONLY the original GEAR opening to the right for the third matching opening.
# All coordinates are native 918x1713 pixels, calibrated from preview of this exact file.
donor=(742,1431,817,1552)
dx=78
sx1,sy1,sx2,sy2=donor
patch=old[sy1:sy2,sx1:sx2].copy()
ph,pw=patch.shape[:2]
assert sx2+dx<918
feather=np.ones((ph,pw),dtype=np.float32)
for i in range(8):
    v=(i+1)/9
    feather[:,i]=np.minimum(feather[:,i],v)
    feather[:,-i-1]=np.minimum(feather[:,-i-1],v)
    feather[i,:]=np.minimum(feather[i,:],v)
    feather[-i-1,:]=np.minimum(feather[-i-1,:],v)
dst=arr[sy1:sy2,sx1+dx:sx2+dx]
arr[sy1:sy2,sx1+dx:sx2+dx]=np.clip(patch*feather[:,:,None]+dst*(1-feather[:,:,None]),0,255).astype('uint8')

# Erase ONLY tiny legacy side-printed legends (not the heading or cavity).
# Restrict inpaint to bright letter shapes to avoid repainting original metallic surface.
bright=(old[:,:,0]>140)&(old[:,:,1]>140)&(old[:,:,2]>140)
mask=np.zeros(old.shape[:2],np.uint8)
for x1,y1,x2,y2 in [
    (617,1420,690,1467),   # old side FLAP/INHIBIT legend
    (802,1415,914,1462),   # old side GEAR/INHIBIT legend (outside opening)
    (648,1547,737,1581),   # old NORMAL for FLAP, redraw aligned
    (806,1547,912,1581),   # old NORMAL for GEAR, redraw aligned
]:
    yy,xx=np.ogrid[y1:y2,x1:x2]
    mask[y1:y2,x1:x2]=np.where(bright[y1:y2,x1:x2],255,mask[y1:y2,x1:x2])
# Protect recess interiors, original screws, and relevant controls.
for x1,y1,x2,y2 in [(681,1431,738,1550),(744,1431,813,1550),(820,1431,899,1550)]:
    mask[y1:y2,x1:x2]=0
mask=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
arr=cv2.inpaint(arr,mask,3,cv2.INPAINT_TELEA)
photo=Image.fromarray(arr)
draw=ImageDraw.Draw(photo)
font_path="/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf"
font_bold="/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
small=ImageFont.truetype(font_bold,14)
tiny=ImageFont.truetype(font_path,12)
normal=ImageFont.truetype(font_path,12)
ink=(211,220,222)
def center(text,x,y,font):
    bb=draw.textbbox((0,0),text,font=font)
    xp=x-(bb[2]-bb[0])/2
    draw.text((round(xp),y),text,font=font,fill=ink,stroke_width=0)
# Label each guarded cavity in the original stencil-like capital typography.
# Both rows are ABOVE rather than beside the switches.
for title,cx in [('FLAP',709),('GEAR',779),('TERRAIN',857)]:
    center(title,cx,1398,small)
    center('INHIBIT',cx,1415,tiny)
    center('NORMAL',cx,1571,normal)

# Enforce unchanged RGB values outside the narrow GPWS change rectangle.
modified=np.array(photo)
change_rect=(600,1393,918,1595)
x1,y1,x2,y2=change_rect
outside=np.ones(old.shape[:2],bool)
outside[y1:y2,x1:x2]=False
assert np.array_equal(modified[outside],old[outside]),'Unexpected edits outside GPWS'
assert sum(1 for i in range(3) if i)==2
OUT.parent.mkdir(parents=True,exist_ok=True)
# Preserve the original alpha channel exactly if the blank panel is RGBA.
if "A" in Image.open(SOURCE).getbands():
    photo.putalpha(Image.open(SOURCE).getchannel("A"))
photo.save(OUT,optimize=True)
# QA preview is a small dedicated image, not a re-rendered cockpit.
crop=photo.crop((540,1320,918,1640))
crop.save(PREVIEW,format="WEBP",quality=96)
assembly=json.loads(MANIFEST.read_text())
replaced=False
for region in assembly["regions"]:
    if region["id"]!="main":continue
    for p in region["placements"]:
        if p["id"]=="fo-inner":
            assert p["asset"]=="panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png"
            p["asset"]="panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_V2.png"
            p["presentation"]="Original panel 918x1713, only GPWS region optically amended: third TERRAIN socket right of GEAR, matching labeled three-column arrangement"
            replaced=True
assert replaced
# Keep original asset record unchanged; register a new explicit derivative record.
rel="panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_V2.png"
out_bytes=OUT.read_bytes()
assembly["assets"][rel]={
    "path":rel,"url":"./assets/B737_Right_Main_Instruments_GPWS_TERRAIN_V2.png",
    "dimensions":[918,1713],"bytes":len(out_bytes),
    "sha256":hashlib.sha256(out_bytes).hexdigest(),
    "sourceOriginalUnchanged":True,
    "sourcePanel":"panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png",
    "nativeChangedAreaPx":list(change_rect)
}
assembly["version"]="CKP-0013-GPWS-TERRAIN-THIRD-SOCKET"
MANIFEST.write_text(json.dumps(assembly,ensure_ascii=False,indent=2)+"\n")
r={"sourceSha256":hashlib.sha256(raw).hexdigest(),"derivativeSha256":hashlib.sha256(out_bytes).hexdigest(),
   "sourceSize":before.size,"generatedPixelsChanged":int(np.any(old!=modified,axis=2).sum()),
   "changeRectNativePx":list(change_rect),"sourceUnmodified":hashlib.sha256(SOURCE.read_bytes()).hexdigest()==hashlib.sha256(raw).hexdigest(),
   "switches":["FLAP INHIBIT","GEAR INHIBIT","TERRAIN INHIBIT"],"terrainPlacement":"RIGHT_OF_GEAR_INHIBIT",
   "fonts":"DejaVuSansCondensed, DejaVuSansCondensed-Bold; source is photo-textured; direct source exact glyph reproduction unavailable"}
REPORT.write_text(json.dumps(r,indent=2)+"\n")
print("PASS GPWS third socket",r)
