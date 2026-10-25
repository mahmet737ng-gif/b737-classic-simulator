#!/usr/bin/env python3
"""Cross-check original PNG Hough candidates against photographic references.

Triage evidence only: do not authorize live needle geometry, modify images or
replace independently validated measurement with noisy automated detection.
"""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))
def circular_error(a,b):
    return abs((a-b+180)%360-180)
def bearing(pivot,xy):
    return math.degrees(math.atan2(xy[0]-pivot["x"],pivot["y"]-xy[1]))
def entry_angle(entry):
    return entry.get("angleDeg",0)

def main():
    raw=load("reports/gauge-native-scan-v2.json")
    catalog=load("engine/instruments/needle-zero-reference-stage1-v1.json")
    photographed=load("engine/instruments/native-radial-ticks-batch1-v1.json")
    cabin=load("engine/instruments/oh19-native-ticks-batch1.json")
    track=load("engine/instruments/native-pivot-track-batch1-v1.json")
    reference={f["id"]:f for f in catalog["faces"]}
    radial={f["id"]:f for f in photographed["faces"]}
    tracked={f["id"]:f for f in track["circularFaces"]}
    circleSource={x["source"]:x["candidates"] for x in raw["unassignedCirclesBySource"]}
    lines={f["id"]:f for f in raw["faces"]}
    assert set(lines)==set(reference) and len(lines)==54,"Incomplete native source scan"
    count={"faces":54,"coarseRotaryPivotCandidates":0,"initialRotaryPivotCandidates":0,
           "linearTracks":0,"rawLineCandidates":0,"photoAngleReferences":0,
           "uniquePhotoHoughCorrelations":0,"multiplePhotoHoughCorrelations":0,
           "unmatchedPhotoAngles":0,"candidateTickCorrelationsFromPriorScan":0,
           "zeroBearingCandidates":0,"fullyApproved":0}
    faces=[]
    for id in reference:
        base=reference[id]
        scan=lines[id]
        piv=scan.get("pivot")
        islinear=scan.get("status")=="LINEAR_TRACK_NOT_ROTARY"
        if islinear:count["linearTracks"]+=1
        elif scan.get("pivotBasis")=="coarse_native_grid_estimate":count["coarseRotaryPivotCandidates"]+=1
        elif piv is not None:count["initialRotaryPivotCandidates"]+=1
        strokes=scan.get("radialLines",[])
        count["rawLineCandidates"]+=len(strokes)
        circles=[]
        if id in tracked:
            rough=tracked[id]; target=rough["pivotCandidate"]; rad=rough["roughDialRadiusPx"]
            for c in circleSource.get(base["source"]["asset"],[]):
                xyerr=math.hypot(target["x"]-c["x"],target["y"]-c["y"])
                radiusErr=abs(c["radiusPx"]-rad)
                tol=max(24,1.5*target["uncertaintyPx"])
                if xyerr<=tol and radiusErr<=max(40,rad*.30):
                    circles.append({"x":c["x"],"y":c["y"],"radiusPx":c["radiusPx"],
                                    "distanceFromGridEstimatePx":round(xyerr,1),
                                    "radiusDifferencePx":round(radiusErr,1),
                                    "candidateOnly":True})
            circles.sort(key=lambda c:(c["distanceFromGridEstimatePx"]/max(1,target["uncertaintyPx"])+c["radiusDifferencePx"]/max(1,rad)))
        anchors=[]
        for sc in base["scales"]:
            for a in sc["referenceCandidates"]:
                anchor={"mode":sc["mode"],"value":a["value"],"source":a["source"],
                        "referenceAngleDeg":a["angleDeg"],"sourcePhotoApproved":False}
                matches=[]
                for k,s in enumerate(strokes):
                    err=circular_error(s["angleDeg"],a["angleDeg"])
                    if err>2.5:continue
                    # Candidate white-line fragment can be text, rim or a tick:
                    # angular proximity alone is not authorization.
                    pt=a.get("point")
                    spatial=None
                    if pt:
                        spatial=round(math.hypot(s["innerPoint"][0]-pt["x"],s["innerPoint"][1]-pt["y"]),1)
                    matches.append({"houghIndex":k,"angularErrorDeg":round(err,2),
                                    "innerTipPx":s["innerPoint"],"outerTipPx":s["outerPoint"],
                                    "lengthPx":s["lengthPx"],"innerRadiusPx":s["innerRadiusPx"],
                                    "distanceToReferencePointPx":spatial})
                matches.sort(key=lambda r:(r["angularErrorDeg"],-(r["lengthPx"])))
                anchor["nearbyHoughLines"]=matches[:5]
                anchor["status"]=("ONE_ANGULAR_NEIGHBOR_NOT_VISUALLY_SIGNED" if len(matches)==1
                    else "MULTIPLE_NEIGHBORS_REVIEW_REQUIRED" if len(matches)>1
                    else "NO_NEARBY_HOUGH_SEGMENT_REFERENCE_PRESERVED")
                count["photoAngleReferences"]+=1
                count["uniquePhotoHoughCorrelations"]+=len(matches)==1
                count["multiplePhotoHoughCorrelations"]+=len(matches)>1
                count["unmatchedPhotoAngles"]+=not matches
                count["zeroBearingCandidates"]+=a["value"]==0
                anchors.append(anchor)
        prior=[]
        if id in radial:
            for x in radial[id]["strokeCandidates"]:
                ang=x["angleDeg"]
                nearest=min((circular_error(ang,s["angleDeg"]) for s in strokes),default=999)
                prior.append({"angleDeg":ang,"innerTipFromPriorPhotoScan":x["innerPoint"],
                              "numericMajorCandidate":x["majorNumber"],
                              "houghAngularMatchWithin2_5deg":nearest<=2.5,
                              "nearestHoughAngularDifferenceDeg":round(nearest,2) if nearest!=999 else None,
                              "sourceApproved":False})
                count["candidateTickCorrelationsFromPriorScan"]+=nearest<=2.5
        if id=="oh.cabin.diff_pressure_altitude":
            for scale in cabin["scales"]:
                for mark in scale["allVisibleTickCandidates"]:
                    near=min((circular_error(mark["angleDeg"],s["angleDeg"]) for s in strokes),default=999)
                    prior.append({"angleDeg":mark["angleDeg"],"innerTipFromPriorPhotoScan":mark["tipCandidate"],
                                  "mode":scale["mode"],"numericMajorCandidate":mark["interpretedValueFt"] if scale["mode"]=="cabinAltitude" else None,
                                  "houghAngularMatchWithin2_5deg":near<=2.5,
                                  "nearestHoughAngularDifferenceDeg":round(near,2) if near!=999 else None,
                                  "sourceApproved":False})
                    count["candidateTickCorrelationsFromPriorScan"]+=near<=2.5
        face={
            "id":id,"source":base["source"],"mechanism":base["mechanism"],
            "pivot":piv,"pivotBasis":scan.get("pivotBasis"),
            "pivotConflict":base.get("pivotConflict"),
            "pivotImageCertification":False,
            "linearTravelWindowCandidate":scan.get("travelWindow"),
            "nearExistingGridCircleCandidates":circles[:8],
            "nearExistingGridCircleCount":len(circles),
            "radialLineCandidateCount":len(strokes),
            "radialLinesNotSemanticallyAssigned":strokes[:100],
            "photoReferenceMatches":anchors,
            "priorRadialScanCandidates":prior,
            "approval":"BLOCKED_REQUIRES_ORIGINAL_PIXEL_VISUAL_CHECK",
        }
        faces.append(face)
        print("B737_TRIAGE_FACE="+json.dumps(face,ensure_ascii=False,separators=(",",":")),flush=True)
    assert count["coarseRotaryPivotCandidates"]==29,count
    assert count["initialRotaryPivotCandidates"]==20,count
    assert count["linearTracks"]==5,count
    assert count["photoAngleReferences"]>=52,count
    assert count["fullyApproved"]==0
    output={"schema":"b737.native-source-tick-candidate-triage.v1",
            "effectivity":"B737-33V EP-FSI","originalSourcesUnchanged":True,
            "scanEvidence":"Gauge native pixel scan v2 GitHub Actions artifact",
            "sources":[
                "engine/instruments/needle-zero-reference-stage1-v1.json",
                "engine/instruments/native-pivot-track-batch1-v1.json",
                "engine/instruments/native-radial-ticks-batch1-v1.json",
                "engine/instruments/oh19-native-ticks-batch1.json",
                "reports/gauge-native-scan-v2.json",
            ],
            "meaning":"Geometric correlations and unresolved candidates, not verified numeric needle calibrations.",
            "counts":count,"faces":faces}
    out=ROOT/"reports/gauge-native-triage-v1.json"
    out.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("B737_TRIAGE_COUNTS="+json.dumps(count,separators=(",",":")),flush=True)
    print("B737_TRIAGE_COMPLETED=54_UNCERTIFIED_FACES_CORRELATED",flush=True)
if __name__=="__main__":main()
