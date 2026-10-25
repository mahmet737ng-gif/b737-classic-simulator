#!/usr/bin/env python3
"""Phase-2 first cohort: true native-ratio B737 annunciator glass, typography not stretched.

Reads approved immutable SVGs, changes ONLY the dark face canvas dimensions,
centres the original vector text without rescaling glyphs, writes derived
unlocked files, and updates existing asset URLs + SHA256 (no new asset IDs).
This script is repeatable; existing generated sources remain untouched.
"""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"panel-mosaic-lab/assets/lights/precision-fit-v1"
SPECS=[
 ("panel-mosaic-lab/interactive-overhead/lights.json",{
  "yaw-damper","probe-capt-ps","probe-l-elev","probe-l-alpha",
  "probe-temp","probe-fo-ps","probe-r-elev","probe-r-alpha"}),
 ("panel-mosaic-lab/cockpit/lights.json",{"main-stab-trim"})
]

def pngless_native_svg(original:str,w:int,h:int)->tuple[str,float]:
    opening=re.match(r'<svg\b[^>]*>',original)
    if not opening:raise ValueError("SVG root not found")
    head=opening.group()
    sw=re.search(r'\bwidth="(\d+(?:\.\d+)?)"',head)
    sh=re.search(r'\bheight="(\d+(?:\.\d+)?)"',head)
    view=re.search(r'\bviewBox="0 0 ([\d.]+) ([\d.]+)"',head)
    if not (sw and sh and view):raise ValueError("Unrecognized intrinsic SVG geometry")
    ow,oh=float(sw.group(1)),float(sh.group(1))
    if abs(ow/oh-float(view.group(1))/float(view.group(2)))>1e-6:
        raise ValueError("Existing SVG has inconsistent dimensions")
    virtualw=oh*w/h
    if virtualw<ow:raise ValueError("Would clip non-uniformly: target ratio narrower than source")
    shift=(virtualw-ow)/2
    replace=head.replace(sw.group(),f'width="{w}"').replace(sh.group(),f'height="{h}"').replace(view.group(),f'viewBox="0 0 {virtualw:.6f} {oh:g}"')
    out=original.replace(head,replace,1)
    # All input source SVGs have one root background rectangle after </defs>.
    background=re.search(r'<rect width="([\d.]+)" height="([\d.]+)" fill="(#[A-Fa-f0-9]+)"\s*/>',out)
    if not background or abs(float(background.group(1))-ow)>1e-6 or abs(float(background.group(2))-oh)>1e-6:
        raise ValueError("Expected bezel-free full background rectangle absent")
    newrect=f'<rect width="{virtualw:.6f}" height="{oh:g}" fill="{background.group(3)}"/>'
    out=out[:background.start()]+newrect+out[background.end():]
    # Text groups (including glow) move together, no glyph stretching or legend changes.
    insert=background.start()+len(newrect)
    out=out[:insert]+f'\n<g transform="translate({shift:.6f} 0)" data-fit="uniform-translation-only">' +out[insert:]
    if "</svg>" not in out:raise ValueError("Unclosed source SVG")
    out=out.replace("</svg>","</g>\n</svg>",1)
    # Strict no-glyph-rescaling guard.
    def rawtexts(s):
        return re.findall(r'<text\b[^>]*>.*?</text>',s,re.S)
    if rawtexts(out)!=rawtexts(original):
        raise ValueError("Original typography changed unexpectedly")
    return out,virtualw

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    report=[]
    for registry_rel,selection in SPECS:
        file=ROOT/registry_rel
        registry=json.loads(file.read_text(encoding="utf8"))
        current={x["id"]:x for x in registry["lights"]}
        if not selection<=current.keys():raise ValueError("Missing lamp IDs "+str(selection-current.keys()))
        singletons={}
        for lamp in registry["lights"]:
            singletons[lamp["asset"]]=singletons.get(lamp["asset"],0)+1
        for lid in sorted(selection):
            lamp=current[lid]
            key=lamp["asset"]
            if singletons[key]!=1:raise ValueError("Shared artwork requires explicit per-instance derivative "+key)
            x,y,w,h=lamp["sourceRect"]
            if not all(isinstance(z,int) for z in [x,y,w,h]):raise ValueError("Nonintegral photo rectangle")
            frames=registry["assets"][key]
            for state in sorted(frames):
                url=frames[state]["url"]
                if "precision-fit-v1/" in url:
                    existing=(file.parent/url).resolve()
                    if not existing.is_file():raise FileNotFoundError(existing)
                    digest=hashlib.sha256(existing.read_bytes()).hexdigest()
                    if frames[state]["sha256"]!=digest:raise ValueError("Generated content tampered "+str(existing))
                    src=ROOT/"panel-mosaic-lab/assets/locked/2026-10-23/LIGHTS/unified-mounted-v1"/f"{key}_{state}.svg"
                    if not src.is_file():raise FileNotFoundError(src)
                    report.append({"lamp":lid,"asset":key,"state":state,"oldSource":str(src.relative_to(ROOT)),
                                   "derived":str(existing.relative_to(ROOT)),"sourceRect":lamp["sourceRect"],
                                   "SVGRoot":[w,h],"viewBox":[round(300*w/h,6),300],
                                   "glyphRescaled":False,"positionChanged":False,"sha256":digest})
                    continue
                src=(file.parent/url).resolve()
                if "assets/locked/2026-10-23/LIGHTS" not in str(src):
                    raise ValueError("Unexpected original location "+str(src))
                original=src.read_text(encoding="utf8")
                if hashlib.sha256(original.encode("utf8")).hexdigest()!=frames[state]["sha256"]:
                    raise ValueError("Untrusted changed original "+str(src))
                fitted,boxwidth=pngless_native_svg(original,w,h)
                dest=DEST/f"{key}_{state}_{w}x{h}.svg"
                if dest.exists() and dest.read_text(encoding="utf8")!=fitted:raise ValueError("Derivative collision "+str(dest))
                dest.write_text(fitted,encoding="utf8")
                digest=hashlib.sha256(fitted.encode("utf8")).hexdigest()
                frames[state]={"url":str(Path("../assets/lights/precision-fit-v1")/dest.name),"sha256":digest}
                report.append({"lamp":lid,"asset":key,"state":state,"oldSource":str(src.relative_to(ROOT)),
                               "derived":str(dest.relative_to(ROOT)),"sourceRect":lamp["sourceRect"],
                               "SVGRoot":[w,h],"viewBox":[round(boxwidth,6),300 if key!="STAB_OUT_OF_TRIM" else 300],
                               "glyphRescaled":False,"positionChanged":False,"sha256":digest})
        if "interactive-overhead" in registry_rel:
            if registry["version"]=="LGT-0007":
                registry["previousVersion"]="LGT-0007"
                registry["version"]="LGT-0008"
            elif registry["version"] not in ("LGT-0008","LGT-0009"):raise ValueError("Unexpected overhead registry version "+registry["version"])
        else:
            if registry["version"]=="LGT-0010":
                registry["previousVersion"]="LGT-0010"
                registry["version"]="LGT-0011"
            elif registry["version"]!="LGT-0011":raise ValueError("Unexpected cockpit registry version "+registry["version"])
        registry["faceFitRevision"]="PH2-FIT-0001"
        file.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    report_path=ROOT/"panel-mosaic-lab/lights-test/precision-faces-v1.json"
    manifest={"schema":"b737.annunciators.non-distorting-faces.v1","date":"2026-10-26",
              "sourceArtImmutable":True,"strategy":"Expand bezel-free SVG face background horizontally; centre original glyph and glow groups without scaling, preserving size, font and colors.",
              "selectedLamps":sum(len(x) for _,x in SPECS),"derivedStates":len(report),
              "visualReleaseState":"UNIFIED_SCREENSHOT_QA_REQUIRED","derivatives":report}
    report_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("PRECISION_FACE_BUILD",json.dumps({"lamps":manifest["selectedLamps"],"states":len(report),
                      "overhead":"LGT-0008","main":"LGT-0011","lockedEdits":0}))
if __name__=="__main__":main()
