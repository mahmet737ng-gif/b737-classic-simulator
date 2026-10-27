#!/usr/bin/env python3
"""B737 Classic GPWS v3: TERRAIN left of FLAP, typography matched with intact source photo.

Take original native 918x1713 panel; leave every pixel outside the GPWS rectangle
unchanged, including screws, INOP, SYS TEST and the rest of the cockpit.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2, hashlib, json

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/"panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png"
OUT=ROOT/"panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_LEFT_V3.png"
PREVIEW=ROOT/"panel-mosaic-lab/cockpit/assets/gpws-terrain-left-v3-preview.webp"
REPORT=ROOT/"panel-mosaic-lab/cockpit/assets/gpws-terrain-left-v3-audit.json"
MANIFEST=ROOT/"panel-mosaic-lab/cockpit/assembly.json"
sourcebytes=SOURCE.read_bytes()
base=Image.open(SOURCE)
old=np.array(base.convert("RGB"))
assert old.shape[:2]==(1713,918),"Source master photo dimensions drifted"
arr=old.copy()

# Reuse the source's existing GEAR well geometry WITHOUT resizing or redrawing.
# The original FLAP and GEAR wells remain pixel-for-pixel unchanged.
donor=(742,1431,817,1552)
dx=-140
x1,y1,x2,y2=donor
assert x1+dx==602 and x2+dx==677
patch=old[y1:y2,x1:x2].copy()
dst=arr[y1:y2,x1+dx:x2+dx].copy()
h,w=patch.shape[:2]
alpha=np.ones((h,w),dtype=np.float32)
for k in range(4):
    t=(k+1)/5
    alpha[:,k]=np.minimum(alpha[:,k],t)
    alpha[:,-1-k]=np.minimum(alpha[:,-1-k],t)
    alpha[k,:]=np.minimum(alpha[k,:],t)
    alpha[-1-k,:]=np.minimum(alpha[-1-k,:],t)
# Occlude former side lettering at the new third-well top, even at feather edges.
alpha[:8,:]=1.0
arr[y1:y2,x1+dx:x2+dx]=np.clip(patch*alpha[:,:,None]+dst*(1-alpha[:,:,None]),0,255).astype(np.uint8)

# The old FLAP INHIBIT SIDE label was in the area of the third well.
# Only the few exposed letters immediately above that well are removed;
# never inpaint the nearby real metallic screw or adjacent original wells.
roi=(608,1413,676,1431)
rx1,ry1,rx2,ry2=roi
pixels=old[ry1:ry2,rx1:rx2]
bright=np.all(pixels>156,axis=2).astype(np.uint8)*255
bright=cv2.dilate(bright,np.ones((3,3),dtype=np.uint8))
mask=np.zeros(old.shape[:2],dtype=np.uint8)
mask[ry1:ry2,rx1:rx2]=bright
if int(mask.sum())>0:
    arr=cv2.inpaint(arr,mask,2,cv2.INPAINT_TELEA)

# Clone clean metallic texture from an unobstructed part of the SAME photo
# and smoothly merge at the edges. Avoid inpainting only white pixels: it left
# dark ghosts and stray letters in the earlier review.
def clean_photo_region(destination,source,feather=9):
    dx1,dy1,dx2,dy2=destination
    sx1,sy1,sx2,sy2=source
    h,w=dy2-dy1,dx2-dx1
    assert (h,w)==(sy2-sy1,sx2-sx1)
    patch=old[sy1:sy2,sx1:sx2].astype(np.float32)
    target=arr[dy1:dy2,dx1:dx2].astype(np.float32)
    # Match local illumination using color along a border without typography.
    correct=np.median(target[:3,:,:].reshape(-1,3)-patch[:3,:,:].reshape(-1,3),axis=0)
    patch=np.clip(patch+correct.reshape(1,1,3),0,255)
    yy,xx=np.ogrid[:h,:w]
    distance=np.minimum.reduce(np.broadcast_arrays(xx,yy,w-1-xx,h-1-yy)).astype(np.float32)
    alpha=np.clip((distance+0.5)/float(feather),0,1)[:,:,None]
    arr[dy1:dy2,dx1:dx2]=np.clip(patch*alpha+target*(1-alpha),0,255).astype(np.uint8)

# Original GEAR / INHIBIT was placed to the RIGHT of the existing GEAR well.
# Remove BOTH old side legends, retaining adjacent true metal screw heads.
clean_photo_region((816,1425,889,1480),(690,1597,763,1652),feather=8)

# The old side-printed NORMAL must not remain as a ghost fourth legend.
# Clean a larger strip with soft edges, then reuse the photographic NORMAL
# lettering on exactly the three requested new coordinates.
y0=1556
label_strip=(590,1543,900,1594)
nx1,ny1,nx2,ny2=label_strip
# Do not copy the far-right panel border back into the body: its source
# contains deep black rivet shadows. Borrow clean interior panel paint instead.
clean_photo_region((590,1543,814,1594),(590,1600,814,1651),feather=9)
clean_photo_region((809,1543,900,1594),(690,1600,781,1651),feather=9)
glyphs=old[1553:1581,656:738].copy()
lum=glyphs.mean(axis=2)
a=np.clip((lum.astype(float)-117)/94,0,1)
outw,outh=64,22
glyphs=cv2.resize(glyphs,(outw,outh),interpolation=cv2.INTER_AREA)
a=cv2.resize(a.astype(np.float32),(outw,outh),interpolation=cv2.INTER_AREA)[:,:,None]
for cx in (638,709,779):
    lx=int(round(cx-outw/2))
    below=arr[y0:y0+outh,lx:lx+outw]
    arr[y0:y0+outh,lx:lx+outw]=np.clip(glyphs*a+below*(1-a),0,255).astype(np.uint8)

photo=Image.fromarray(arr)
draw=ImageDraw.Draw(photo)
# The rest of the panel uses condensed, slightly slanted light gray capitals.
name_font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf",14)
sub_font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Oblique.ttf",10)
ink=(221,228,230)
captions=[("TERRAIN",638),("FLAP",709),("GEAR",779)]
bounds=[]
for label,cx in captions:
    col=[]
    for text,y,font in ((label,1380,name_font),("INHIBIT",1392,sub_font)):
        bb=draw.textbbox((0,0),text,font=font)
        width=bb[2]-bb[0]; height=bb[3]-bb[1]
        left=round(cx-width/2); right=left+width
        top=y+bb[1]; bottom=y+bb[3]
        assert 600<=left<right<=817 and 1381<=top<bottom<=1404,(text,left,top,right,bottom)
        draw.text((left,y),text,font=font,fill=ink)
        col.append([left,top,right,bottom])
    bounds.append(col)
for a,b in zip(bounds,bounds[1:]):
    for row in range(2):assert a[row][2]+5<b[row][0],"captions collide"

# If requested fonts or clone affect even a single pixel outside the region,
# block the build. Original photo and all mounted hardware are preserved.
rect=(590,1378,909,1595)
modified=np.array(photo)
x1,y1,x2,y2=rect
outside=np.ones(old.shape[:2],dtype=bool);outside[y1:y2,x1:x2]=False
assert np.array_equal(modified[outside],old[outside]),"Unexpected modified pixel outside permitted GPWS zone"
OUT.parent.mkdir(parents=True,exist_ok=True)
if "A" in base.getbands():
    photo.putalpha(base.getchannel("A"))
photo.save(OUT,optimize=True)
photo.crop((530,1320,918,1640)).save(PREVIEW,"WEBP",quality=98)
assembled=json.loads(MANIFEST.read_text())
item=next(p for area in assembled["regions"] if area["id"]=="main" for p in area["placements"] if p["id"]=="fo-inner")
allowed={
 "panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png",
 "panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_V2.png",
 "panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_LEFT_V3.png"
}
assert item["asset"] in allowed
key="panel-mosaic-lab/cockpit/assets/B737_Right_Main_Instruments_GPWS_TERRAIN_LEFT_V3.png"
item["asset"]=key
item["presentation"]="Native locked F/O panel derivative: GPWS order TERRAIN / FLAP / GEAR, source-matched inset wells, centrally aligned two-line stencil captions; all other source photo pixels retained"
out=OUT.read_bytes()
assembled["assets"][key]={
  "path":key,"url":"./assets/B737_Right_Main_Instruments_GPWS_TERRAIN_LEFT_V3.png",
  "dimensions":[918,1713],"bytes":len(out),
  "sha256":hashlib.sha256(out).hexdigest(),
  "gitBlobSha":hashlib.sha1(b"blob "+str(len(out)).encode()+b"\0"+out).hexdigest(),
  "sourceOriginalUnchanged":True,
  "sourcePanel":"panel-mosaic-lab/assets/locked/2026-10-23/B737_Right_Main_Instruments_Blank.png",
  "nativeChangedAreaPx":list(rect)
}
# Stable interface version retained for independent cockpit light and panel QA.
assembled["version"]="CKP-0012-THROTTLE-FIT"
assembled["gpwsBackgroundRevision"]="GPWS-TERRAIN-LEFT-OF-FLAP-V3"
MANIFEST.write_text(json.dumps(assembled,ensure_ascii=False,indent=2)+"\n")
report={
 "sourceSha256":hashlib.sha256(sourcebytes).hexdigest(),
 "sourceUnmodified":SOURCE.read_bytes()==sourcebytes,
 "derivativeSha256":hashlib.sha256(out).hexdigest(),
 "gitBlobSha":assembled["assets"][key]["gitBlobSha"],
 "orderLeftToRight":["TERRAIN INHIBIT","FLAP INHIBIT","GEAR INHIBIT"],
 "centersNativePx":[638,709,779],
 "normalLegendCentersNativePx":[638,709,779],
 "captionBoundsNativePx":bounds,
 "nativeAllowedChangeRectPx":list(rect),
 "pixelsDifferent":int(np.any(modified!=old,axis=2).sum()),
 "unrelatedSourcePixelsIdentical":True,
 "pixelExactTypography":False,
 "font":"DejaVu Sans Condensed Bold Oblique name 14px / Oblique secondary 10px, with original photo NORMAL letter glyphs"
}
REPORT.write_text(json.dumps(report,indent=2)+"\n")
print("PASS TERRAIN LEFT / FLAP CENTER / GEAR RIGHT",report)
