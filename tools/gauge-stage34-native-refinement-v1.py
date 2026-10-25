#!/usr/bin/env python3
"""B737 Classic stages 3/4: native-pixel candidate stroke triage and pivot geometry.

Reads frozen PNGs directly with hash+dimension checks. Never rewrites cockpit artwork.
All results remain candidate-only until each tick and shaft is optically certified.
"""
import argparse, hashlib, json, math
from pathlib import Path
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
RADIUS={
 "oh.fuel.temperature":143,
 "oh.elec.dc_amps":143,"oh.elec.cps":143,"oh.elec.dc_volts":143,"oh.elec.ac_volts":143,
 "oh.drive_oil.1":160,"oh.drive_oil.2":160,
 "oh.ac_amps.1":144,"oh.ac_amps.2":144,"oh.ac_amps.apu":144,
 "oh.apu.egt":154,"oh.cabin.rate":165,"oh.cabin.temperature":180,
 "oh.duct.pressure_lr":170,"oh.crew_oxygen.pressure":57,
}
BANDS={"oh.cabin.diff_pressure_altitude":[("cabinAltitude",112,150),("diffPressure",204,280)]}
STEP=0.5
# Physical tick-bearing sectors inferred from native dial artwork.
# Numbers are *screen bearings*, not approved scale numeric mappings.
SECTORS={
 "oh.fuel.temperature":(-140,140),
 "oh.elec.dc_amps":(-87,87),"oh.elec.cps":(-87,87),
 "oh.elec.dc_volts":(-87,87),"oh.elec.ac_volts":(-85,85),
 "oh.drive_oil.1":(-87,87),"oh.drive_oil.2":(-87,87),
 "oh.ac_amps.1":(-87,87),"oh.ac_amps.2":(-87,87),
 "oh.ac_amps.apu":(-87,87),
 "oh.cabin.temperature":(-145,120),
 "oh.duct.pressure_lr":(-163,163)
}
# Smooth EGT/N2 arcs in the supplied blank panel have no numbered tick
# graduations; angular pixel segments there are NOT tick measurements.
CONTINUOUS_ARC_FACES={"eng.egt.1","eng.egt.2","eng.n2.1","eng.n2.2"}

def angle(p,q):
    return (math.degrees(math.atan2(q[0]-p[0],p[1]-q[1]))+360)%360
def circgap(x,y):
    return abs((x-y+180)%360-180)

def median_or(xs,default):
    return float(np.median(xs)) if xs else default

def source_image(face):
    p=ROOT/face["source"]["asset"]
    assert p.is_file(),str(p)
    data=p.read_bytes()
    assert hashlib.sha256(data).hexdigest()==face["source"]["sha256"],str(p)+" source hash changed"
    im=cv2.imread(str(p),cv2.IMREAD_COLOR)
    assert im is not None
    h,w=im.shape[:2]
    assert (w,h)==(face["source"]["width"],face["source"]["height"]),str(p)+" wrong dimensions"
    return im

def mask_white(im):
    rgb=im.astype(np.int16)
    b,g,r=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    bright=(b*0.114+g*0.587+r*0.299)>165
    neutral=(np.maximum.reduce((b,g,r))-np.minimum.reduce((b,g,r)))<75
    return (bright&neutral).astype(np.uint8)

def sample_ray(mask,pivot,lo,hi,bearing):
    radii=np.arange(lo,hi+1,1,dtype=float)
    t=math.radians(bearing)
    xs=np.rint(pivot[0]+radii*np.sin(t)).astype(np.int32)
    ys=np.rint(pivot[1]-radii*np.cos(t)).astype(np.int32)
    ok=(xs>=0)&(xs<mask.shape[1])&(ys>=0)&(ys<mask.shape[0])
    values=np.zeros(len(radii),np.uint8)
    values[ok]=mask[ys[ok],xs[ok]]
    # Runs of white pixels on radial ray; require continuous radial stroke.
    changes=np.diff(np.concatenate(([0],values,[0])).astype(int))
    starts=np.where(changes==1)[0]
    ends=np.where(changes==-1)[0]
    runs=[]
    for start,end in zip(starts,ends):
        n=end-start
        if n<5 or n>max(43,(hi-lo)*.85):continue
        r0=int(lo+start); r1=int(lo+end-1)
        runs.append((r0,r1,int(n)))
    return runs

def radial_candidates(mask,pivot,lo,hi,sector=None):
    candidates=[]
    for i in range(int(360/STEP)):
        a=i*STEP
        signed=((a+180)%360)-180
        if sector and not(sector[0]<=signed<=sector[1]):continue
        segments=sample_ray(mask,pivot,lo,hi,a)
        for r0,r1,length in segments:
            # White point is a candidate only. Digit stems and borders can be radial.
            if length<max(6,int((hi-lo)*.09)):continue
            t=math.radians(a)
            x0=round(pivot[0]+r0*math.sin(t),2)
            y0=round(pivot[1]-r0*math.cos(t),2)
            x1=round(pivot[0]+r1*math.sin(t),2)
            y1=round(pivot[1]-r1*math.cos(t),2)
            candidates.append({"angleDeg":round(a,2),"innerTip":[x0,y0],
                "outerTip":[x1,y1],"innerRadiusPx":r0,"outerRadiusPx":r1,
                "lengthPx":length,"source":"native_white_radial_run","approved":False})
    # A thick bright graduation spans multiple half-degree rays.
    # Cluster near angles and similar radii, using strongest stroke as representative.
    candidates.sort(key=lambda x:(-x["lengthPx"],x["angleDeg"]))
    result=[]
    for c in candidates:
        near=next((q for q in result
                   if circgap(c["angleDeg"],q["angleDeg"])<1.65
                   and abs(c["innerRadiusPx"]-q["innerRadiusPx"])<13),None)
        if near is not None:continue
        result.append(c)
    return sorted(result,key=lambda x:(x["angleDeg"],x["innerRadiusPx"]))

def choose_circle(im,pivot,rough_radius,uncertainty):
    # Circle fit is visual geometry of rim, not automatically a needle pivot.
    radius=max(15,int(rough_radius))
    cx,cy=pivot
    margin=int(radius*1.6+uncertainty+16)
    x0=max(0,int(cx-margin));x1=min(im.shape[1],int(cx+margin))
    y0=max(0,int(cy-margin));y1=min(im.shape[0],int(cy+margin))
    region=cv2.cvtColor(im[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY)
    sm=cv2.GaussianBlur(region,(7,7),1.5)
    fit=cv2.HoughCircles(sm,cv2.HOUGH_GRADIENT,dp=1.2,minDist=max(12,radius*.4),
                         param1=105,param2=32,
                         minRadius=max(12,int(radius*.67)),
                         maxRadius=int(radius*1.36))
    out=[]
    if fit is not None:
        for x,y,r in fit[0]:
            px=x+x0; py=y+y0
            delta=math.hypot(px-cx,py-cy)
            rerr=float(abs(float(r)-radius))
            if delta>max(uncertainty*1.7,20):continue
            out.append({"x":round(float(px),2),"y":round(float(py),2),
                        "radius":round(float(r),2),
                        "centerDeltaPx":round(delta,2),"radiusDeltaPx":round(rerr,2),
                        "grade":"circle_rim_candidate_not_shaft"})
    out.sort(key=lambda v:(v["centerDeltaPx"]/max(1,uncertainty)+v["radiusDeltaPx"]/max(1,radius)))
    return out[:6]

def classify_ticks(strokes,reference,mode,lo,hi):
    length_values=[s["lengthPx"] for s in strokes]
    typical=median_or(length_values,0)
    # Longest white strokes are major-like; assigning their numeric values from
    # length alone would be invalid. Keep only visual length class.
    for s in strokes:
        ratio=s["lengthPx"]/max(1,typical)
        s["lengthClassCandidate"]="long" if ratio>=1.5 else "medium" if ratio>=1.0 else "short"
        s["scaleModeCandidate"]=mode
        s["numericValue"]=None
        s["physicalTickApproved"]=False
    matched=[]
    for x in reference:
        if x["mode"]!=mode:continue
        near=[s for s in strokes if circgap(x["angleDeg"],s["angleDeg"])<=2.5]
        # Mark as unique only if the origin also passes a radial band check.
        near=[s for s in near if lo<=s["innerRadiusPx"]<=hi]
        if len(near)==1:state="single_angle_candidate_not_approved"
        elif len(near)==0:state="no_white_radial_run"
        else:state="multiple_runs_ambiguous"
        matched.append({"printedOrInferredValue":x["value"],
                       "sourceReferenceAngleDeg":x["angleDeg"],
                       "matchedCandidateIds":[strokes.index(s) for s in near[:12]],
                       "status":state,"sourcePhotoApproved":False})
    return matched

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--report",default="reports/stage34-native-pixel-v1.json")
    args=ap.parse_args()
    base=json.loads((ROOT/"engine/instruments/native-photo-geometric-evidence-v1.json").read_text())
    original=json.loads((ROOT/"engine/instruments/needle-zero-reference-stage1-v1.json").read_text())
    track=json.loads((ROOT/"engine/instruments/native-pivot-track-batch1-v1.json").read_text())
    ref={f["id"]:f for f in original["faces"]}
    rough={f["id"]:f for f in track["circularFaces"]}
    linear={f["id"]:f for f in track["linearFaces"]}
    all_records=[];counts={"faces":0,"rotaryFaces":0,"linearFaces":0,"scaleBands":0,
        "candidateWhiteStrokes":0,"candidateMajorLike":0,"candidateShortLike":0,
        "angleReferences":0,"oneNeighbor":0,"multipleNeighbors":0,"noNeighbor":0,
        "circleRimCandidates":0,"approvedNeedlePivots":0,"certifiedTickScales":0}
    for f in base["faces"]:
        orig=ref[f["id"]]; image=source_image(f)
        record={"id":f["id"],"panel":orig["panel"],"source":f["source"],
                "kind":"linear" if f["id"] in linear else "rotary",
                "approved":False}
        if f["id"] in linear:
            window=linear[f["id"]]["travelWindowCandidate"]
            record.update({"rotationPivot":None,"lineTrackCandidate":window,
                "linearTickEndpoints":[],"reviewState":"linear_travel_tick_mapping_pending"})
            counts["linearFaces"]+=1
        else:
            pivot=f["pivot"]
            assert pivot and "x" in pivot and "y" in pivot
            p=(float(pivot["x"]),float(pivot["y"]))
            oldradius=rough[f["id"]]["roughDialRadiusPx"] if f["id"] in rough else RADIUS.get(f["id"],120)
            uncertainty=pivot.get("uncertaintyPx",25)
            circle=choose_circle(image,p,oldradius,uncertainty)
            radiusB=(rough[f["id"]]["roughDialRadiusPx"] if f["id"] in rough else RADIUS.get(f["id"],120))
            if f["id"] in BANDS:bands=BANDS[f["id"]]
            else:bands=[("primary",max(10,round(radiusB*.67)),round(radiusB*1.07))]
            white=mask_white(image)
            scales=[]
            refs=[dict(mode=s["mode"],value=x["value"],angleDeg=x["angleDeg"])
                  for s in orig["scales"] for x in s["referenceCandidates"]]
            for mode,lo,hi in bands:
                candidates=radial_candidates(white,p,lo,hi,SECTORS.get(f["id"]))
                matched=classify_ticks(candidates,refs,mode,lo,hi)
                counts["scaleBands"]+=1;counts["candidateWhiteStrokes"]+=len(candidates)
                counts["candidateMajorLike"]+=sum(x["lengthClassCandidate"]=="long" for x in candidates)
                counts["candidateShortLike"]+=sum(x["lengthClassCandidate"]=="short" for x in candidates)
                counts["angleReferences"]+=len(matched)
                counts["oneNeighbor"]+=sum(x["status"].startswith("single") for x in matched)
                counts["multipleNeighbors"]+=sum(x["status"].startswith("multiple") for x in matched)
                counts["noNeighbor"]+=sum(x["status"].startswith("no_") for x in matched)
                scales.append({"mode":mode,"radiusBandPx":[lo,hi],
                    "whiteRadialCandidates":candidates,
                    "majorMinorClassification":"length_only_angular_pixel_candidate",
                    "bearingSectorCandidate":SECTORS.get(f["id"]),
                    "hasPrintedDiscreteTickScale":f["id"] not in CONTINUOUS_ARC_FACES,
                    "referenceMatches":matched,
                    "allPhysicalGraduationsCertified":False})
            counts["circleRimCandidates"]+=len(circle)
            record.update({"pivotInput":pivot,"pivotSource":f.get("pivotBasis"),
                "pivotDisagreement":f.get("pivotConflict"),
                "circleRimAlternatives":circle,"pivotSelectedForLiveMotion":None,
                "scales":scales,"reviewState":"pixel_candidates_need_manual_image_qa"})
            counts["rotaryFaces"]+=1
        all_records.append(record);counts["faces"]+=1
        print("B737_STAGE34_JSON_FACE="+json.dumps(record,ensure_ascii=False,separators=(",",":")),flush=True)
        compact={"id":record["id"],"type":record["kind"],
                 "lineCandidates":sum(len(s["whiteRadialCandidates"]) for s in record.get("scales",[])),
                 "rimMatches":len(record.get("circleRimAlternatives",[])),
                 "bands":len(record.get("scales",[]))}
        print("B737_STAGE34_FACE="+json.dumps(compact,separators=(",",":")),flush=True)
    assert counts["faces"]==54 and counts["rotaryFaces"]==49 and counts["linearFaces"]==5,counts
    output={"schema":"b737.native-pixel-stage3-stage4.v1","effectivity":"B737-33V EP-FSI",
      "status":"VISUAL_PIXEL_CANDIDATES_NOT_CERTIFIED",
      "method":"Source SHA-256 verified; neutral-bright radial-run segmentation plus Hough rim proposals",
      "warning":"Detection near scale rings does not prove physical graduation; labels, rims, and markings are false-positive candidates.",
      "rules":["Never infer numeric tick from candidate stroke length alone",
               "No pivot replacement without source-photo signoff",
               "No live gauge calibration until every required tick and mechanism is validated",
               "Keep two concentric OH19 scales separate",
               "Handle five position strips as linear, never rotating"],
      "counts":counts,"faces":all_records}
    dest=ROOT/args.report;dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n")
    print("B737_STAGE34_COUNTS="+json.dumps(counts,separators=(",",":")),flush=True)
    print("B737_STAGE34_RESULT="+str(dest.relative_to(ROOT)),flush=True)
if __name__=="__main__":main()
