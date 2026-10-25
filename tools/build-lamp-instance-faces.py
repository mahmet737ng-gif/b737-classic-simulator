#!/usr/bin/env python3
"""Create per-instance vector lens faces for shared B737 annunciator assets.

The light model and 68 overhead / 23 cockpit legend types stay IDENTICAL.
Do not change frozen images, locked SVGs, panel geometry, or actual lamp rules.
Each source state's glyphs/glow translate uniformly in a naturally proportioned
dark full-face SVG; never stretch letters to make artwork fill a physical socket.
"""
from __future__ import annotations
from pathlib import Path
import hashlib
import json
import re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"panel-mosaic-lab/assets/lights/instance-fit-v1"
OVERHEAD=ROOT/"panel-mosaic-lab/interactive-overhead"
COCKPIT=ROOT/"panel-mosaic-lab/cockpit"

FAMILIES={
 "RAM_DOOR_FULL_OPEN","OVERHEAT","ON_GREEN","LOW_PRESSURE","OFF_LAMP",
 "PACK_TRIP_OFF","BLEED_TRIP_OFF","WING_BODY_OVERHEAT"
}
MAIN_FAMILIES={"PULL_UP_RED"}
def digest(text):return hashlib.sha256(text.encode("utf8")).hexdigest()
def text_nodes(text):return re.findall(r'<text\b[^>]*>.*?</text>',text,re.S)
def fit(svg,w,h):
 headmatch=re.match(r"<svg\b[^>]*>",svg)
 if not headmatch:raise ValueError("SVG root absent")
 head=headmatch.group()
 dm=re.search(r'\bwidth="([\d.]+)"',head)
 hm=re.search(r'\bheight="([\d.]+)"',head)
 vb=re.search(r'\bviewBox="0 0 ([\d.]+) ([\d.]+)"',head)
 if not (dm and hm and vb):raise ValueError("Invalid locked SVG root geometry")
 ow,oh=map(float,(dm.group(1),hm.group(1)))
 if abs(float(vb.group(1))-ow)>1e-6 or abs(float(vb.group(2))-oh)>1e-6:
  raise ValueError("Unexpected nonmatching SVG intrinsic viewbox")
 ratio=w/h
 # Enlarge the DARK face behind the artwork; never squeeze the original letters.
 if ratio>=ow/oh:
  vieww,viewh=oh*ratio,oh
  sx,sy=(vieww-ow)/2,0
 else:
  vieww,viewh=ow,ow/ratio
  sx,sy=0,(viewh-oh)/2
 if vieww<ow-1e-5 or viewh<oh-1e-5:raise ValueError("Accidental source crop")
 newhead=head.replace(dm.group(),f'width="{w}"').replace(hm.group(),f'height="{h}"').replace(vb.group(),f'viewBox="0 0 {vieww:.6f} {viewh:.6f}"')
 x=svg.replace(head,newhead,1)
 bg=re.search(r'<rect width="([\d.]+)" height="([\d.]+)" fill="(#[A-Fa-f0-9]+)"\s*/>',x)
 if not bg or abs(float(bg.group(1))-ow)>1e-4 or abs(float(bg.group(2))-oh)>1e-4:
  raise ValueError("Cannot locate original dark glass rectangle")
 newbg=f'<rect width="{vieww:.6f}" height="{viewh:.6f}" fill="{bg.group(3)}"/>'
 x=x[:bg.start()]+newbg+x[bg.end():]
 i=bg.start()+len(newbg)
 x=x[:i]+f'\n<g transform="translate({sx:.6f} {sy:.6f})" data-fit="per-instance-translation-only">' +x[i:]
 if "</svg>" not in x:raise ValueError("Missing closing SVG")
 x=x.replace("</svg>","</g>\n</svg>",1)
 if text_nodes(x)!=text_nodes(svg):raise ValueError("Text nodes changed")
 if "transform=\"scale(" in x:raise ValueError("Forbidden nonuniform vector transform")
 return x,[round(vieww,6),round(viewh,6)],[round(sx,6),round(sy,6)]

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 total=0
 summaries={}
 for directory,families,typ in ((OVERHEAD,FAMILIES,"overhead"),(COCKPIT,MAIN_FAMILIES,"cockpit")):
  registry=json.loads((directory/"lights.json").read_text(encoding="utf8"))
  instances={}
  audit=[]
  count_per_family={}
  for c in registry["lights"]:
   if c["asset"] not in families:continue
   base=c["asset"]
   count_per_family[base]=count_per_family.get(base,0)+1
   _,_,w,h=c["sourceRect"]
   source_frames=registry["assets"][base]
   frames={}
   for state,detail in sorted(source_frames.items()):
    source=(directory/detail["url"]).resolve()
    if "assets/locked/2026-10-23/LIGHTS/unified-mounted-v1" not in str(source):
     raise ValueError("Unexpected mutable source for "+c["id"])
    original=source.read_text(encoding="utf8")
    if digest(original)!=detail["sha256"]:
     raise ValueError("Original asset hash mismatch: "+str(source))
    derived,view,translate=fit(original,w,h)
    filename=f"{typ.upper()}_{c['id']}_{state}_{w}x{h}.svg"
    dest=OUT/filename
    if dest.exists() and dest.read_text(encoding="utf8")!=derived:
     raise ValueError("Existing derived instance asset changed unexpectedly "+str(dest))
    dest.write_text(derived,encoding="utf8")
    checksum=digest(derived)
    frames[state]={"url":"../assets/lights/instance-fit-v1/"+filename,"sha256":checksum}
    audit.append({"id":c["id"],"originalAsset":base,"state":state,"sourceRect":c["sourceRect"],
                  "source":str(source.relative_to(ROOT)),"derived":str(dest.relative_to(ROOT)),
                  "svgDimensions":[w,h],"viewBox":view,"translation":translate,
                  "sourceTextPreserved":True,"hash":checksum})
   instances[c["id"]]={"asset":base,"sourceRect":c["sourceRect"],"states":frames}
  if typ=="overhead" and len(instances)!=35:raise ValueError("Expected exactly 35 selected overhead instances, got "+str(len(instances)))
  if typ=="cockpit" and len(instances)!=2:raise ValueError("Expected two PULL UP displays")
  path=directory/"instance-faces.json"
  result={"schema":"b737.lamps.instance-face.v1","revision":"PH3-INSTANCE-0001",
          "purpose":"View-only unique lens vector for original mutable photo rectangle; no model changes",
          "apertureShapeAutoFit":True,"originalImageEdits":0,
          "instances":instances}
  path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
  summaries[typ]={"count":len(instances),"states":len(audit),"families":count_per_family}
  total+=len(audit)
  records=(ROOT/f"panel-mosaic-lab/lights-test/instance-faces-{typ}-evidence.json")
  records.write_text(json.dumps({"schema":"b737.lamps.instance-derived-source-fingerprints.v1","records":audit},indent=2)+"\n",encoding="utf8")
 manifest={"schema":"b737.lamps.instance-precision-rollout.v1","date":"2026-10-26",
           "overheadAndMain":summaries,"totalNewStates":total,
           "sourceArtworkModified":False,"displayChangesOnly":True,
           "unifiedScreenshotApproval":"PENDING","specialTwoSourcePositions":"NOT_AUTO_CERTIFIED"}
 path=ROOT/"panel-mosaic-lab/lights-test/instance-faces-rollout.json"
 path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print("INSTANCE_FACES_SUMMARY",json.dumps(manifest,sort_keys=True))
if __name__=="__main__":main()
