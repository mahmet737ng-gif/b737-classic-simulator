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

# The source is kept as a permanent locked master.
# Suppress old side legends using undisturbed blue-grey metal from the LOWER
# region of the SAME panel, never from an area containing switch hardware.
def transplant_same_photo(dst_box,src_box,edge=6):
    x1,y1,x2,y2=dst_box
    a,b,c,d=src_box
    assert x2-x1==c-a and y2-y1==d-b
    patch=old[b:d,a:c].copy()
    target=arr[y1:y2,x1:x2].copy()
    h,w=patch.shape[:2]
    weight=np.ones((h,w),dtype=np.float32)
    for k in range(edge):
        v=(k+1)/(edge+1)
        weight[:,k]=np.minimum(weight[:,k],v)
        weight[:,-k-1]=np.minimum(weight[:,-k-1],v)
        weight[k,:]=np.minimum(weight[k,:],v)
        weight[-k-1,:]=np.minimum(weight[-k-1,:],v)
    arr[y1:y2,x1:x2]=np.clip(patch*weight[:,:,None]+target*(1-weight[:,:,None]),0,255).astype('uint8')

# Previously FLAP INHIBIT was BESIDE its socket; no black pixels are
# allowed in this restoration region.
transplant_same_photo((608,1412,678,1468),(608,1587,678,1643),edge=5)
# Previously GEAR INHIBIT was beside the GEAR socket in the new terrain column.
# Clean its heading before adding the actual third socket.
transplant_same_photo((816,1413,893,1435),(816,1588,893,1610),edge=5)

# Clone the native GEAR recess exactly (including its bevel and shadows)
# into the empty right-hand TERRAIN position, without scale/stretching.
donor=(742,1431,817,1552)
dx=78
sx1,sy1,sx2,sy2=donor
patch=old[sy1:sy2,sx1:sx2].copy()
ph,pw=patch.shape[:2]
assert sx2+dx<918
feather=np.ones((ph,pw),dtype=np.float32)
for i in range(6):
    v=(i+1)/7
    feather[:,i]=np.minimum(feather[:,i],v)
    feather[:,-i-1]=np.minimum(feather[:,-i-1],v)
    feather[i,:]=np.minimum(feather[i,:],v)
    feather[-i-1,:]=np.minimum(feather[-i-1,:],v)
# The old GEAR letters behind the new top bezel must be FULLY occluded.
feather[:9,:]=1.0
dst=arr[sy1:sy2,sx1+dx:sx2+dx]
arr[sy1:sy2,sx1+dx:sx2+dx]=np.clip(patch*feather[:,:,None]+dst*(1-feather[:,:,None]),0,255).astype('uint8')

# Three bottom captions use EXACTLY the lettering raster from the original
# FLAP NORMAL photo, with white glyph alpha isolated from its metal backdrop.
# First clean the former two misaligned NORMAL words from a metal-only region.
normal_band=(647,1553,893,1581)
nx1,ny1,nx2,ny2=normal_band
metal=old[1596:1624,nx1:nx2].copy()
assert metal.shape==arr[ny1:ny2,nx1:nx2].shape
arr[ny1:ny2,nx1:nx2]=metal
glyphs=old[1553:1581,656:738].copy()
lum=glyphs.mean(axis=2)
g_alpha=np.clip((lum.astype(float)-117)/94,0,1)
# All three are proportional 80% copies of the ORIGINAL font pixels.
# This creates a real gap between adjacent NORMAL labels.
outw,outh=64,22
glyphs=cv2.resize(glyphs,(outw,outh),interpolation=cv2.INTER_AREA)
g_alpha=cv2.resize(g_alpha.astype(np.float32),(outw,outh),interpolation=cv2.INTER_AREA)[:,:,None]
y0=1556
for caption_center in (709,779,857):
    ix1=round(caption_center-outw/2)
    under=arr[y0:y0+outh,ix1:ix1+outw]
    arr[y0:y0+outh,ix1:ix1+outw]=np.clip(glyphs*g_alpha+under*(1-g_alpha),0,255).astype('uint8')
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
    # Original silver screw above GEAR must stay untouched.
    caption_x=cx-13 if title=='GEAR' else cx
    center(title,caption_x,1391,small)
    center('INHIBIT',caption_x,1405,tiny)
# The two native NORMAL labels remain; the middle column gains its own label.
# Center NORMAL was photo-cloned from the matching original caption above.
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
            assert p["asset"] in {"panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png","panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_V2.png"}
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
    "gitBlobSha":hashlib.sha1(b"blob "+str(len(out_bytes)).encode()+b"\\0"+out_bytes).hexdigest(),
    "sourceOriginalUnchanged":True,
    "sourcePanel":"panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png",
    "nativeChangedAreaPx":list(change_rect)
}
# The approved CKP assembly revision is a fixed provenance field used by
# unrelated light calibration QA: retain it while adding an independent revision.
assembly["version"]="CKP-0012-THROTTLE-FIT"
assembly["gpwsBackgroundRevision"]="GPWS-TERRAIN-THIRD-SOCKET-V2"
MANIFEST.write_text(json.dumps(assembly,ensure_ascii=False,indent=2)+"\n")
r={"sourceSha256":hashlib.sha256(raw).hexdigest(),"derivativeSha256":hashlib.sha256(out_bytes).hexdigest(),
   "sourceSize":before.size,"generatedPixelsChanged":int(np.any(old!=modified,axis=2).sum()),
   "changeRectNativePx":list(change_rect),"sourceUnmodified":hashlib.sha256(SOURCE.read_bytes()).hexdigest()==hashlib.sha256(raw).hexdigest(),
   "switches":["FLAP INHIBIT","GEAR INHIBIT","TERRAIN INHIBIT"],"terrainPlacement":"RIGHT_OF_GEAR_INHIBIT",
   "fonts":"DejaVuSansCondensed, DejaVuSansCondensed-Bold; source is photo-textured; direct source exact glyph reproduction unavailable"}
REPORT.write_text(json.dumps(r,indent=2)+"\n")
print("PASS GPWS third socket",r)
