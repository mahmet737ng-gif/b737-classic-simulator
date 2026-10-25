#!/usr/bin/env python3
"""Read-only OH19 photo inspection for CAB ALT inner dial.
Emits compressed source crop as a CI log so reviewer can inspect original ticks
without modifying locked PNG artwork."""
import base64, io, json, hashlib
from PIL import Image, ImageDraw
from pathlib import Path
p=Path("panel-mosaic-lab/assets/locked/2026-10-23/OH19-PRESS-DIFF-ALT-HORN-d6719ce57cef.png")
raw=p.read_bytes()
im=Image.open(io.BytesIO(raw)).convert('RGB')
print('OH19_IMAGE_META='+json.dumps(dict(path=str(p),sha256=hashlib.sha256(raw).hexdigest(),size=im.size)))
assert im.size==(1267,1241)
# Native 1:1 content, crop around two concentric scales, not an edited asset.
for key,box in [('GAUGE',(150,10,820,700)),('INNER',(300,170,690,565))]:
    crop=im.crop(box)
    buf=io.BytesIO();crop.save(buf,format='JPEG',quality=88,optimize=True)
    print(f'OH19_IMAGE_B64_{key}='+base64.b64encode(buf.getvalue()).decode('ascii'))
