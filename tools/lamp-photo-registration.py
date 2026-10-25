#!/usr/bin/env python3
"""Generate photograph-based pixel QA crops from the ORIGINAL immutable sources.
No original images, lamp sourceRect entries, or approved overlays are modified.
"""
import argparse
import base64
import io
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--emit-preview", action="store_true", help="Emit contact-sheet JPEG as log base64")
    ap.add_argument("--only", default="", help="Optional exact panel / piece ID")
    ap.add_argument("--out", default="/tmp/b737-lamp-photo-qa")
    args = ap.parse_args()

    try:
        from PIL import Image, ImageDraw, ImageFont, ImageStat
    except ImportError as exc:
        raise SystemExit("Pillow is required; pip install pillow") from exc

    overhead = load("panel-mosaic-lab/interactive-overhead/lights.json")["lights"]
    cockpit = load("panel-mosaic-lab/cockpit/lights.json")["lights"]
    spec = load("panel-mosaic-lab/all-overhead/spec.json")
    assembly = load("panel-mosaic-lab/cockpit/assembly.json")
    audit = load("panel-mosaic-lab/lights-test/phase1-geometry-audit.json")

    images_by_id = {item["id"]: (ROOT / "panel-mosaic-lab/all-overhead" / item["url"]).resolve()
                    for item in spec["images"]}
    placement_to_source = {p["id"]: p["sourceId"]
                           for p in load("panel-mosaic-lab/all-overhead/atlas-layout.json")["placements"]}
    main_by_id = {p["id"]: ROOT / assembly["assets"][p["asset"]]["path"]
                  for r in assembly["regions"] for p in r.get("placements", [])}
    grouped = defaultdict(list)
    for item in overhead:
        grouped[item["placementId"]].append(("OVERHEAD", item))
    for item in cockpit:
        grouped[item["pieceId"]].append(("MAIN", item))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    sheets = []
    observations = []
    def face_source(k, scope):
        if scope == "OVERHEAD":
            return images_by_id[placement_to_source[k]]
        return main_by_id[k]

    for key in sorted(grouped):
        if args.only and args.only != key:
            continue
        entries = grouped[key]
        src = face_source(key, entries[0][0])
        if not src.is_file():
            raise FileNotFoundError(f"{key}: missing original source {src}")
        with Image.open(src) as im:
            photo = im.convert("RGB")
        ncols = 3
        cw, ch = 390, 270
        nrows = math.ceil(len(entries) / ncols)
        sheet = Image.new("RGB", (ncols * cw, nrows * ch + 48), "#20242b")
        draw = ImageDraw.Draw(sheet)
        draw.text((12, 11), f"{key} | {len(entries)} native-photo crops | source={src.name} | {photo.width}x{photo.height}",
                  fill="#fefefe")
        for index, (scope, lamp) in enumerate(entries):
            x, y, w, h = lamp["sourceRect"]
            x, y, w, h = map(float, (x,y,w,h))
            # Real source-image coordinates; no atlas or screen-space transforms.
            assert x >= 0 and y >= 0 and x + w <= photo.width and y + h <= photo.height, (key,lamp["id"],(x,y,w,h),photo.size)
            pad_x = max(28, w*.75)
            pad_y = max(30, h*1.1)
            ax, ay = max(0,int(x-pad_x)), max(0,int(y-pad_y))
            bx, by = min(photo.width,math.ceil(x+w+pad_x)), min(photo.height,math.ceil(y+h+pad_y))
            crop = photo.crop((ax,ay,bx,by))
            avail_w,avail_h = cw-14,ch-40
            mult=min(avail_w/crop.width, avail_h/crop.height)
            crop=crop.resize((round(crop.width*mult),round(crop.height*mult)),Image.Resampling.LANCZOS)
            cx=(index % ncols)*cw+7
            cy=(index // ncols)*ch+48
            sheet.paste(crop,(cx,cy+17))
            sx,sy = crop.width/(bx-ax),crop.height/(by-ay)
            rx0=cx+(x-ax)*sx
            ry0=cy+17+(y-ay)*sy
            rx1=cx+(x+w-ax)*sx
            ry1=cy+17+(y+h-ay)*sy
            draw.rectangle([rx0,ry0,rx1,ry1],outline="#ff5656",width=2)
            midx=(rx0+rx1)/2
            midy=(ry0+ry1)/2
            draw.line((midx-7,midy,midx+7,midy),fill="#53f8c9",width=2)
            draw.line((midx,midy-7,midx,midy+7),fill="#53f8c9",width=2)
            draw.text((cx,cy),f"{index+1:02d}  {lamp['id']}  [{int(x)},{int(y)},{int(w)},{int(h)}]",
                      fill="white")
            # Contrast of photo around the *existing* ROI. Diagnostic, not physical socket detection.
            central=photo.crop((math.floor(x+w*.2),math.floor(y+h*.2), math.ceil(x+w*.8), math.ceil(y+h*.8)))
            score=ImageStat.Stat(central.convert("L"))
            observations.append(dict(id=lamp["id"],panel=key,scope=scope,sourceRect=lamp["sourceRect"],
                                     cropSourcePath=str(src.relative_to(ROOT)),
                                     roiMiddleMean=round(score.mean[0],2),
                                     roiMiddleStddev=round(score.stddev[0],2),
                                     pixelReview="NOT_YET_VISUALLY_CERTIFIED"))
        final=out/(key.replace("/","_")+"_lenses.jpg")
        sheet.save(final,quality=70,optimize=True,subsampling=1)
        sheets.append(dict(panel=key,filename=final.name,instances=len(entries),source=str(src.relative_to(ROOT))))
        print("PHOTO_SHEET",key,len(entries),final.name)
        if args.emit_preview:
            encoded=base64.b64encode(final.read_bytes()).decode("ascii")
            print("PHOTO_JPEG_BASE64",key,encoded,flush=True)

    result=dict(schema="b737.pixel-photo-qa.evidence.v1",total=len(observations),groups=sheets,observations=observations,
                note="Preview rectangles/centers are rendered on native original photographs; contrast numbers do NOT prove correct physical socket registration. Human inspection must still classify each item.")
    (out/"photo-qa-evidence.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("PHOTO_QA_SUMMARY",json.dumps(dict(total=len(observations),groups=len(sheets),allImagesLoaded=True)))

if __name__ == "__main__":
    main()
