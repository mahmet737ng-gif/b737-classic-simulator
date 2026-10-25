#!/usr/bin/env python3
"""Non-destructive image evidence export for B737 gauge scale source survey.
Generates *derived* JPEG previews as base64 UTF-8 text for visual QA.
No original or frozen source artwork is ever written to.
"""
from pathlib import Path
from PIL import Image, ImageOps
import json,io,base64,hashlib
ROOT=Path(__file__).resolve().parents[2]
source=json.loads((ROOT/"engine/instruments/gauge-inventory-v1.json").read_text())
out=ROOT/"engine/instruments/review-previews"
out.mkdir(parents=True,exist_ok=True)
selected=["OH09","OH10","OH11","OH12","OH19-DIFF","OH20","OH21",
          "CAPTAIN","ENGINE","FO-INNER","FO-OUTER","THROTTLE","RADIO"]
report=[]
for key in selected:
    path=ROOT/source["sourcePanels"][key]
    with Image.open(path) as src:
        real_size=src.size
        rgb=ImageOps.exif_transpose(src).convert("RGB")
        rgb.thumbnail((1700,1700),Image.Resampling.LANCZOS)
        b=io.BytesIO()
        rgb.save(b,format="JPEG",quality=88,optimize=True,subsampling=0)
    body=b.getvalue()
    filename=key.lower().replace("-","_")+".b64.txt"
    (out/filename).write_text(base64.b64encode(body).decode("ascii"))
    report.append({
        "panel":key,"source":str(path.relative_to(ROOT)),
        "nativeSize":list(real_size),"previewSize":list(rgb.size),
        "previewFile":"engine/instruments/review-previews/"+filename,
        "originalSha256":hashlib.sha256(path.read_bytes()).hexdigest(),
        "previewSha256":hashlib.sha256(body).hexdigest(),
        "note":"derived preview; must not be used for native pixel measurements"
    })
(out/"manifest.json").write_text(json.dumps(report,indent=2)+"\n")
print("Generated",len(report),"non-destructive panel review previews")
