#!/usr/bin/env python3
"""Move deterministic source alpha-mask measurement out of the renderer startup.
The original registrar is the algorithm owner; artwork is read, never written.
"""
import argparse,hashlib,json,re,subprocess,tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
JS=ROOT/'panel-mosaic-lab/cockpit/asp-controls-v1.js'
PATTERN=r' const SOURCE_MASKS=Object\.freeze\((\{[^\n]+\})\);'
NAMES=['mic-off.png','mic-on.png','volume-glass-off.png','volume-glass-on.png']
node="const fs=require('fs'),r=require(process.argv[1]);const data=fs.readFileSync(process.argv[2]);process.stdout.write(JSON.stringify(r.mask({data,width:Number(process.argv[3]),height:Number(process.argv[4])})))"
result={}
with tempfile.TemporaryDirectory(prefix='asp-source-mask-') as tmp:
 for name in NAMES:
  p=ROOT/'panel-mosaic-lab/cockpit/assets/asp-controls-v1'/name
  image=Image.open(p).convert('RGBA');rgba=Path(tmp)/(name+'.rgba');rgba.write_bytes(image.tobytes())
  mask=json.loads(subprocess.check_output(['node','-e',node,str(ROOT/'panel-mosaic-lab/cockpit/asp-socket-registration-v2.js'),str(rgba),str(image.width),str(image.height)],text=True))
  result[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mask':mask}
source=JS.read_text();found=re.search(PATTERN,source)
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true')
if parser.parse_args().check:
 if not found or json.loads(found.group(1))!=result:raise SystemExit('ASP source-mask metadata mismatch: regenerate with the original registrar')
 print('PASS: four premeasured source masks match original registrar and exact source PNG hashes')
else:
 line=' const SOURCE_MASKS=Object.freeze('+json.dumps(result,separators=(',',':'))+');'
 if found:source=source[:found.start()]+line+source[found.end():]
 else:source=source.replace(' const SOURCE=Object.freeze(',line+'\n const SOURCE=Object.freeze(',1)
 JS.write_text(source)
 print('Generated source-mask metadata without changing any image or socket geometry')
