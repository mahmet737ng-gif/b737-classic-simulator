#!/usr/bin/env python3
"""Read-only source-image diagnostic contact sheets for 54 gauge faces."""
import base64,hashlib,json,math
from pathlib import Path
import cv2
ROOT=Path(__file__).resolve().parents[1]
document=json.loads((ROOT/"reports/stage34-native-pixel-v1.json").read_text())
out=ROOT/"reports/stage34-review-images";out.mkdir(parents=True,exist_ok=True)
PANEL=480; HEADER=62; NCOLS=3; NROWS=2
imgcache={}
def load(f):
    asset=f["source"]["asset"]
    if asset not in imgcache:
        path=ROOT/asset
        assert hashlib.sha256(path.read_bytes()).hexdigest()==f["source"]["sha256"]
        imgcache[asset]=cv2.imread(str(path),cv2.IMREAD_COLOR)
    return imgcache[asset]
def tile(face):
    full=load(face)
    if face["kind"]=="linear":
        win=face["lineTrackCandidate"]
        xc=(win["x0"]+win["x1"])*.5;yc=(win["y0"]+win["y1"])*.5
        rad=max(150,int(max(win["x1"]-win["x0"],win["y1"]-win["y0"])*.75))
    else:
        p=face["pivotInput"]
        xc=float(p["x"]);yc=float(p["y"])
        rad=max([hi for s in face["scales"] for lo,hi in [s["radiusBandPx"]]]+[60])
        rad=int(rad*1.14)+12
    source=cv2.getRectSubPix(full,(rad*2+1,rad*2+1),(float(xc),float(yc)))
    ratio=PANEL/source.shape[0]
    view=cv2.resize(source,(PANEL,PANEL),interpolation=cv2.INTER_AREA)
    def point(x,y):
        return (round((x-xc+rad)*ratio),round((y-yc+rad)*ratio))
    if face["kind"]=="rotary":
        for s in face["scales"]:
            for stroke in s["whiteRadialCandidates"]:
                cls=stroke["lengthClassCandidate"]
                color=(255,180,30) if cls=="short" else (30,195,255) if cls=="medium" else (35,255,90)
                cv2.line(view,point(*stroke["innerTip"]),point(*stroke["outerTip"]),color,2,cv2.LINE_AA)
            # Magenta: existing numerical reference angle, not necessarily detected.
            for r in s["referenceMatches"]:
                t=math.radians(r["sourceReferenceAngleDeg"])
                lo,hi=s["radiusBandPx"]
                rm=(lo+hi)*.5
                tip=point(xc+rm*math.sin(t),yc-rm*math.cos(t))
                cv2.circle(view,tip,4,(255,45,235),2,cv2.LINE_AA)
        cv2.drawMarker(view,point(xc,yc),(255,25,255),cv2.MARKER_CROSS,19,2)
        if face["circleRimAlternatives"]:
            x=face["circleRimAlternatives"][0]
            cv2.drawMarker(view,point(x["x"],x["y"]),(0,230,0),cv2.MARKER_DIAMOND,14,2)
    else:
        r=face["lineTrackCandidate"]
        cv2.rectangle(view,point(r["x0"],r["y0"]),point(r["x1"],r["y1"]),(0,205,240),3)
    canvas=cv2.copyMakeBorder(view,HEADER,0,0,0,cv2.BORDER_CONSTANT,value=(29,31,33))
    cv2.putText(canvas,face["id"][:42],(9,19),cv2.FONT_HERSHEY_SIMPLEX,.45,(248,248,248),1,cv2.LINE_AA)
    n=sum(len(s["whiteRadialCandidates"]) for s in face.get("scales",[]))
    info=("LINEAR no pivot" if face["kind"]=="linear" else
          f"{n} radial candidates | rim: {len(face['circleRimAlternatives'])} | NO approval")
    cv2.putText(canvas,info,(9,44),cv2.FONT_HERSHEY_SIMPLEX,.39,(160,226,255),1,cv2.LINE_AA)
    return canvas
faces=document["faces"]
for start in range(0,len(faces),6):
    batch=faces[start:start+6]
    sheet=cv2.copyMakeBorder(
        cv2.hconcat([cv2.vconcat([tile(batch[r*3+c]) if r*3+c<len(batch)
                            else 255*__import__('numpy').ones((PANEL+HEADER,PANEL,3),dtype='uint8')
                            for r in range(NROWS)]) for c in range(NCOLS)]),
        0,0,0,0,cv2.BORDER_CONSTANT,value=(0,0,0))
    ix=start//6
    filepath=out/f"sheet_{ix:02d}.jpg"
    assert cv2.imwrite(str(filepath),sheet,[cv2.IMWRITE_JPEG_QUALITY,79])
    # Emit selected previews only; full set stays in the workflow artifact.
    if ix in [0,2,3,5,7]:
        ok,buf=cv2.imencode(".jpg",sheet,[cv2.IMWRITE_JPEG_QUALITY,64]);assert ok
        print(f"B737_STAGE34_SHEET_{ix}="+base64.b64encode(buf).decode('ascii'),flush=True)
print("B737_STAGE34_VISUAL_QA_SHEETS="+str((len(faces)+5)//6),flush=True)
