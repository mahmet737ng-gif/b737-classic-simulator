#!/usr/bin/env python3
"""Precision annunciator faces batch 2: 12 singleton legends on 2 new lamp registries.
Builds derived bezel-free SVGs only; preserves original glyphs/photos with SHA guard.
Rerunnable; neither unlocked siblings nor existing artwork are rewritten with new styles.
"""
from pathlib import Path
import hashlib, importlib.util, json, re

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"panel-mosaic-lab/assets/lights/precision-fit-v1"
HELPER=ROOT/"tools/build-lamp-precision-faces.py"
spec=importlib.util.spec_from_file_location("lamp_fit_helper",HELPER)
lib=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lib)
cases=[
 ("panel-mosaic-lab/interactive-overhead/lights.json",[
  "probe-fo-static","probe-capt-static","ground-power-available","wing-valve-l",
  "wing-valve-r","apu-overspeed","feel-diff","speed-trim","mach-trim","auto-slat","crossfeed-valve"
 ]),
 ("panel-mosaic-lab/cockpit/lights.json",["main-antiskid"])
]
records=[]
def digest(s):
 return hashlib.sha256(s.encode("utf8")).hexdigest()
def update_registry(path,ids):
 filename=ROOT/path
 reg=json.loads(filename.read_text(encoding="utf8"))
 original_version="LGT-0009" if "interactive-overhead" in path else "LGT-0011"
 new_version="LGT-0010" if "interactive-overhead" in path else "LGT-0012"
 if reg["version"] not in (original_version,new_version):
  raise ValueError("Version collision; do not overwrite concurrent registry: "+reg["version"])
 byid={l["id"]:l for l in reg["lights"]}
 counts={}
 for l in reg["lights"]:counts[l["asset"]]=counts.get(l["asset"],0)+1
 for id in ids:
  l=byid.get(id)
  if l is None:raise ValueError("missing lamp "+id)
  asset=l["asset"]
  if counts[asset]!=1:raise ValueError("artwork is not a singleton "+asset)
  x,y,w,h=l["sourceRect"]
  if not all(isinstance(i,int) for i in (x,y,w,h)):raise ValueError("fractional socket "+id)
  for state,frame in reg["assets"][asset].items():
   src=ROOT/"panel-mosaic-lab/assets/locked/2026-10-23/LIGHTS/unified-mounted-v1"/f"{asset}_{state}.svg"
   if not src.is_file():raise FileNotFoundError(src)
   original=src.read_text(encoding="utf8")
   existing_url=frame["url"]
   if "precision-fit-v1/" in existing_url:
    dest=(filename.parent/existing_url).resolve()
    result=dest.read_text(encoding="utf8")
    if digest(result)!=frame["sha256"]:raise ValueError("existing fitted SVG changed unexpectedly "+id)
   else:
    if (filename.parent/existing_url).resolve()!=src:raise ValueError("unexpected locked source path "+id)
    if digest(original)!=frame["sha256"]:raise ValueError("original locked lamp SVG hash mismatch "+id)
    result,_=lib.pngless_native_svg(original,w,h)
    dest=DEST/f"{asset}_{state}_{w}x{h}.svg"
    if dest.exists() and dest.read_text(encoding="utf8")!=result:raise ValueError("derivative collision "+id)
    DEST.mkdir(parents=True,exist_ok=True)
    dest.write_text(result,encoding="utf8")
   textorig=re.findall(r'<text\b[^>]*>.*?</text>',original,re.S)
   textnew=re.findall(r'<text\b[^>]*>.*?</text>',result,re.S)
   if textorig!=textnew:raise ValueError("native text mutated "+id)
   head=re.match(r'<svg\b[^>]*>',result).group(0)
   if f'width="{w}"' not in head or f'height="{h}"' not in head:raise ValueError("face dimension mismatch "+id)
   sha=digest(result)
   frame.update(url=str(Path("../assets/lights/precision-fit-v1")/dest.name),sha256=sha)
   records.append(dict(lamp=id,asset=asset,state=state,original=str(src.relative_to(ROOT)),
                       derived=str(dest.relative_to(ROOT)),sourceRect=l["sourceRect"],
                       fittedDimensions=[w,h],sha256=sha,originalGlyphsUnscaled=True))
 reg["previousVersion"]=reg["version"] if reg["version"]==original_version else reg.get("previousVersion",original_version)
 reg["version"]=new_version
 reg["faceFitRevision"]="PH2-FIT-0002"
 filename.write_text(json.dumps(reg,ensure_ascii=False,indent=2)+"\n",encoding="utf8")

def main():
 for path,ids in cases:update_registry(path,ids)
 if len(records)!=27 or len({r["lamp"] for r in records})!=12:
  raise ValueError("Incorrect second-batch count "+str(len(records)))
 out=ROOT/"panel-mosaic-lab/lights-test/precision-faces-batch2.json"
 manifest={"schema":"b737.lamps.annunciator-fit.second-batch.v1","date":"2026-10-26",
           "uniqueDesigns":12,"derivativeStates":len(records),"originalSvgChanges":0,"frozenPhotoChanges":0,
           "method":"Expanded dark vector face proportionally to source ROI; translate existing glyph groups, no nonuniform scaling.",
           "browserVisualAcceptance":"PENDING","records":records}
 out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print("BATCH2_FITTED",json.dumps({"designs":12,"states":len(records),"versions":["LGT-0010","LGT-0012"],"lockedPhotoChanges":0}))
if __name__=="__main__":main()
