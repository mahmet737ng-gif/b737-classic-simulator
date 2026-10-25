#!/usr/bin/env python3
"""Read-only native-image radial graduation candidate survey for B737 gauges.

This generates evidence, NOT certified scale mappings. Never writes source assets.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[1]

def bearing(dx,dy):
    return (math.degrees(math.atan2(dx,-dy))+360)%360

def extract_lines(gray,cx,cy,rmax):
    # Candidate radial tick segments: close to the dial centre, but not through it.
    blur=cv2.GaussianBlur(gray,(3,3),0)
    edges=cv2.Canny(blur,65,155)
    min_length=max(7,int(rmax*.055))
    lines=cv2.HoughLinesP(edges,1,np.pi/720,threshold=12,
                          minLineLength=min_length,maxLineGap=3)
    if lines is None:return []
    raw=[]
    for x1,y1,x2,y2 in np.asarray(lines).reshape((-1,4)):
        d1=math.hypot(x1-cx,y1-cy);d2=math.hypot(x2-cx,y2-cy)
        if min(d1,d2)<rmax*.25 or max(d1,d2)>rmax*1.18:continue
        length=math.hypot(x2-x1,y2-y1)
        if length<min_length:continue
        # Tick stroke must point approximately along a radius.
        midx=(x1+x2)/2-cx;midy=(y1+y2)/2-cy
        cross=abs((x2-x1)*midy-(y2-y1)*midx)
        if cross/(max(1,length*math.hypot(midx,midy)))>.28:continue
        ang=bearing(midx,midy)
        inner=(x1,y1) if d1<d2 else (x2,y2)
        outer=(x2,y2) if d1<d2 else (x1,y1)
        raw.append(dict(angleDeg=round(ang,2),innerPoint=list(map(int,inner)),
                        outerPoint=list(map(int,outer)),innerRadiusPx=round(min(d1,d2),1),
                        outerRadiusPx=round(max(d1,d2),1),lengthPx=round(length,1)))
    # Merge near-duplicate Hough candidates within same annulus, retain longest.
    raw.sort(key=lambda x:-x["lengthPx"])
    selected=[]
    for item in raw:
        if any(min(abs(item["angleDeg"]-v["angleDeg"]),360-abs(item["angleDeg"]-v["angleDeg"]))<1.25
               and abs(item["innerRadiusPx"]-v["innerRadiusPx"])<14 for v in selected):continue
        selected.append(item)
    return sorted(selected,key=lambda x:x["angleDeg"])

def detect_circle_centres(gray):
    h,w=gray.shape
    scaled=cv2.resize(gray,None,fx=min(1,1600/max(h,w)),fy=min(1,1600/max(h,w)),interpolation=cv2.INTER_AREA)
    factor=w/scaled.shape[1]
    min_r=max(25,int(min(scaled.shape)*.025))
    max_r=max(min_r+15,int(min(scaled.shape)*.19))
    c=cv2.HoughCircles(cv2.GaussianBlur(scaled,(9,9),1.8),cv2.HOUGH_GRADIENT,
                       dp=1.3,minDist=min_r*1.6,param1=110,param2=35,
                       minRadius=min_r,maxRadius=max_r)
    if c is None:return []
    circles=[dict(x=round(float(x*factor),1),y=round(float(y*factor),1),
                  radiusPx=round(float(r*factor),1),state="unassigned_circle_candidate")
             for x,y,r in c[0]]
    return sorted(circles,key=lambda z:(z["y"],z["x"]))[:150]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",default="reports/gauge-native-scan-v2.json")
    ap.add_argument("--max-lines",type=int,default=180)
    args=ap.parse_args()
    registry=json.loads((ROOT/"engine/instruments/needle-zero-reference-stage1-v1.json").read_text())
    by_source={}
    for f in registry["faces"]:by_source.setdefault(f["source"]["asset"],[]).append(f)
    result={"schema":"b737.gauge-native-scan.v2","status":"AUTOMATIC_CANDIDATES_NOT_APPROVED",
            "angleConvention":"clockwise from 12 oclock (0..360)",
            "faces":[],"unassignedCirclesBySource":[],"problems":[]}
    for src,faces in sorted(by_source.items()):
        path=ROOT/src
        if not path.exists():
            result["problems"].append({"source":src,"reason":"file_missing"})
            continue
        raw=path.read_bytes()
        digest=hashlib.sha256(raw).hexdigest()
        img=cv2.imread(str(path),cv2.IMREAD_GRAYSCALE)
        if img is None:result["problems"].append({"source":src,"reason":"decode_failed"});continue
        height,width=img.shape
        assert all(f["source"]["sha256"]==digest for f in faces),src+" SHA256 changed"
        assert all(f["source"]["width"]==width and f["source"]["height"]==height for f in faces),src+" dimensions changed"
        unknown=[f for f in faces if f["pivot"] is None]
        if unknown:
            result["unassignedCirclesBySource"].append({
                "source":src,"faceIdsNeedingCentre":[f["id"] for f in unknown],
                "candidates":detect_circle_centres(img)})
        for f in faces:
            centre=f["pivot"]
            if centre is None:
                result["faces"].append({"id":f["id"],"source":src,"pivot":None,
                    "status":"PIVOT_UNKNOWN_NOT_AUTO_ASSIGNED","radialLines":[]})
                continue
            cx,cy=centre["x"],centre["y"]
            rmax=min(width*.24,height*.27, max(55, min(width,height)*.22))
            region=cv2.getRectSubPix(img,(int(rmax*2+1),int(rmax*2+1)),(float(cx),float(cy)))
            local=extract_lines(region,rmax,rmax,rmax)
            # Convert crop coordinates to the original immutable source pixel space.
            dx=cx-rmax;dy=cy-rmax
            for line in local:
                for key in ("innerPoint","outerPoint"):
                    line[key]=[round(line[key][0]+dx,2),round(line[key][1]+dy,2)]
            result["faces"].append({"id":f["id"],"source":src,
                "pivot":centre,"pivotConflict":f.get("pivotConflict"),
                "status":"RADIAL_STROKE_CANDIDATES_ONLY","radialLines":local[:args.max_lines],
                "lineCountRawAfterDedup":len(local)})
    result["counts"]={
        "facesExpected":len(registry["faces"]),
        "facesProcessed":len(result["faces"]),
        "facesWithStrokeCandidates":sum(bool(f["radialLines"]) for f in result["faces"]),
        "candidateStrokes":sum(len(f["radialLines"]) for f in result["faces"]),
        "unknownPivotFaces":sum(f["pivot"] is None for f in result["faces"]),
        "unassignedCentreCandidates":sum(len(x["candidates"]) for x in result["unassignedCirclesBySource"]),
        "certifiedFaces":0}
    out=ROOT/args.output;out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print("NATIVE_GAUGE_SCAN_COUNTS="+json.dumps(result["counts"]))
    print("NATIVE_GAUGE_SCAN_OUTPUT="+str(out.relative_to(ROOT)))
    if result["problems"]:print("NATIVE_GAUGE_SCAN_PROBLEMS="+json.dumps(result["problems"]))
    assert len(result["faces"])==54
if __name__=="__main__":main()
