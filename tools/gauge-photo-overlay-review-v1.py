#!/usr/bin/env python3
"""Non-destructive native-pixel Hough vs photographed-scale overlays.

Diagnostic only, never turns candidate strokes into approved needle geometry.
"""
from pathlib import Path
import base64,hashlib,json,math
import cv2
ROOT=Path(__file__).resolve().parents[1]
evidence=json.loads((ROOT/"engine/instruments/native-photo-geometric-evidence-v1.json").read_text(encoding="utf-8"))
byid={f["id"]:f for f in evidence["faces"]}
targets=[
 ("oh.fuel.temperature",200),
 ("oh.elec.dc_amps",205),
 ("oh.elec.cps",210),
 ("oh.drive_oil.1",205),
 ("oh.ac_amps.1",205),
 ("oh.cabin.diff_pressure_altitude",275),
 ("oh.cabin.temperature",218),
 ("oh.duct.pressure_lr",218),
 ("oh.cabin.rate",205),
]
outdir=ROOT/"reports/gauge-photo-overlays-v1"
outdir.mkdir(parents=True,exist_ok=True)
for i,(name,radius) in enumerate(targets):
    face=byid[name]
    origin=ROOT/face["source"]["asset"]
    assert hashlib.sha256(origin.read_bytes()).hexdigest()==face["source"]["sha256"],name
    native=cv2.imread(str(origin),cv2.IMREAD_COLOR)
    assert (native.shape[1],native.shape[0])==(face["source"]["width"],face["source"]["height"])
    pivot=face["pivot"]
    assert pivot
    cx,cy=round(pivot["x"]),round(pivot["y"])
    size=2*radius+1
    crop=cv2.getRectSubPix(native,(size,size),(float(cx),float(cy)))
    p=(radius,radius)
    def translated(pt):
        return round(pt[0]-cx+radius),round(pt[1]-cy+radius)
    # Subtle blue circles = ALL detected segments; can include text/rim artifacts.
    for l in face["radialLinesNotSemanticallyAssigned"]:
        cv2.line(crop,translated(l["innerPoint"]),translated(l["outerPoint"]),(200,160,40),1,cv2.LINE_AA)
    for ref in face["photoReferenceMatches"]:
        lines=ref["nearbyHoughLines"]
        if len(lines)==1:
            color=(70,220,60) # green: angle agreement, not approval
        elif len(lines)>1:
            color=(25,165,240) # amber: ambiguous
        else:
            color=(40,65,240) # red: prior angle unmatched
        for candidate in lines:
            start=translated(candidate["innerTipPx"]);end=translated(candidate["outerTipPx"])
            cv2.line(crop,start,end,color,3,cv2.LINE_AA)
            cv2.circle(crop,start,3,color,-1,cv2.LINE_AA)
        if not lines:
            a=math.radians(ref["referenceAngleDeg"])
            pt=(round(radius+radius*.72*math.sin(a)),round(radius-radius*.72*math.cos(a)))
            cv2.circle(crop,pt,3,color,-1,cv2.LINE_AA)
    cv2.drawMarker(crop,p,(235,30,235),cv2.MARKER_CROSS,16,2)
    resized=cv2.resize(crop,(740,740),interpolation=cv2.INTER_CUBIC)
    header=80
    page=cv2.copyMakeBorder(resized,header,25,10,10,cv2.BORDER_CONSTANT,value=(30,30,30))
    def line(text,y,color=(255,255,255)):
        cv2.putText(page,text,(20,y),cv2.FONT_HERSHEY_SIMPLEX,.52,color,1,cv2.LINE_AA)
    line(name+"  native source "+str(face["source"]["width"])+"x"+str(face["source"]["height"]),26)
    line("blue=all segments  green=1 match amber=ambiguous red=missing",50)
    line("SCALE/NEEDLE CALIBRATION: NOT APPROVED",71,(60,190,255))
    file=outdir/(name.replace(".","_")+".jpg")
    assert cv2.imwrite(str(file),page,[cv2.IMWRITE_JPEG_QUALITY,79])
    ok,encoded=cv2.imencode(".jpg",page,[cv2.IMWRITE_JPEG_QUALITY,73])
    assert ok
    print("B737_OVERLAY_IMAGE_"+str(i)+"_"+name+"="+base64.b64encode(encoded).decode("ascii"),flush=True)
    print("B737_OVERLAY_SUMMARY="+json.dumps({"face":name,"raw":face["radialLineCandidateCount"],
       "photoReferences":len(face["photoReferenceMatches"]),
       "uniques":sum(len(x["nearbyHoughLines"])==1 for x in face["photoReferenceMatches"]),
       "ambiguous":sum(len(x["nearbyHoughLines"])>1 for x in face["photoReferenceMatches"]),
       "unmatched":sum(not x["nearbyHoughLines"] for x in face["photoReferenceMatches"])}),flush=True)
print("B737_OVERLAY_READONLY_QA=9_REFERENCE_IMAGES")
