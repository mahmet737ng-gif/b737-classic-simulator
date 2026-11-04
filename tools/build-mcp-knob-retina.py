#!/usr/bin/env python3
"""MCP-retina visual derivatives. Never edits the locked panel or AFDS logic.
Native original source files placed in assets/mcp-switches/originals take priority.
Without those originals, enhancement of the existing 80/48-pixel derivatives
only reduces scaling artifacts; it cannot reconstruct missing photographic detail.
"""
from pathlib import Path
from io import BytesIO
import base64
import json
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parents[1]/"panel-mosaic-lab/cockpit/assets/mcp-switches"
ORIG=ROOT/"originals"
OUT=ROOT/"retina"
OUT.mkdir(parents=True,exist_ok=True)
SOURCES={
 "course-480.webp":("Front-facing course selector knob(1).png",ROOT/"COURSE_PHOTO_80.webp"),
 "ias-480.webp":("Airspeed selector.png",ROOT.parent/"mcp-ias-mach-knob.webp"),
 "heading-480.webp":("Worn silver HDG selector knob.png",ROOT/"HEADING_PHOTO_80.webp"),
 "altitude-480.webp":("Aircraft-Style Fluted Rotary Knob.png",ROOT/"ALTITUDE_PHOTO_80.webp"),
}
REPORT={"schema":"MCP-RETINA-0001","images":{},"lockedPanelUntouched":True}
def save_photo(name,source,original):
    im=Image.open(source).convert("RGBA")
    src_size=list(im.size)
    if original:
        box=im.getchannel("A").getbbox()
        if box: im=im.crop(box)
        # Keep consistent centered photo bounds while respecting natural aspect ratio.
        fitted=im.copy();fitted.thumbnail((456,456),Image.Resampling.LANCZOS)
        canvas=Image.new("RGBA",(480,480),(0,0,0,0))
        canvas.alpha_composite(fitted,((480-fitted.width)//2,(480-fitted.height)//2))
    else:
        # Upscale ONCE in the asset pipeline instead of making Chromium magnify
        # tiny 80px textures at each interactive viewport zoom level.
        canvas=im.resize((480,480),Image.Resampling.LANCZOS)
        rgb=canvas.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.1,percent=95,threshold=3))
        rgb.putalpha(canvas.getchannel("A"))
        canvas=rgb
    dst=OUT/name;canvas.save(dst,format="WEBP",quality=91,method=6)
    REPORT["images"][name]={"source":str(source.relative_to(ROOT.parent.parent.parent.parent)),"sourcePixels":src_size,"original":original,"targetPixels":[480,480]}
for dest,(original_file,fallback) in SOURCES.items():
    original=ORIG/original_file
    use_original=original.is_file()
    source=original if use_original else fallback
    if not source.is_file():raise SystemExit("Missing MCP photo: "+str(source))
    save_photo(dest,source,use_original)

# Bank-limit square ring and nested SEL are separate layers. The existing
# controller and DOM pivots are preserved; split only the original preview atlas.
parts=[ROOT/f"owner13-photo-part{i}.b64" for i in range(4)]
encoded="".join("".join(p.read_text().split()) for p in parts)
atlas=Image.open(BytesIO(base64.b64decode(encoded))).convert("RGBA")
if atlas.size!=(192,192):raise SystemExit("Owner13 atlas size mismatch")
for dest,idx,original_file in [
 ("bank-ring-480.webp",12,"Worn square aircraft selector ring-1.png"),
 ("heading-sel-480.webp",11,"Worn silver SEL rotary knob.png")]:
    src=ORIG/original_file
    if src.is_file():
        save_photo(dest,src,True)
    else:
        r,c=divmod(idx,4)
        cell=atlas.crop((c*48,r*48,c*48+48,r*48+48))
        box=cell.getchannel("A").getbbox()
        if box:cell=cell.crop(box)
        canvas=Image.new("RGBA",(480,480),(0,0,0,0))
        cell.thumbnail((456,456),Image.Resampling.LANCZOS)
        enlarged=cell.resize((456,456),Image.Resampling.LANCZOS)
        canvas.alpha_composite(enlarged,(12,12))
        canvas.save(OUT/dest,"WEBP",quality=92,method=6)
        REPORT["images"][dest]={"source":"owner13 192x192 atlas cell "+str(idx),"sourcePixels":[48,48],"original":False,"targetPixels":[480,480]}
(OUT/"manifest.json").write_text(json.dumps(REPORT,indent=2)+"\n",encoding="utf-8")
print("MCP retina derivation complete:",len(REPORT["images"]),"source originals:",sum(x["original"] for x in REPORT["images"].values()))
