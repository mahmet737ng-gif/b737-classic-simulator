#!/usr/bin/env python3
"""Stage 11 high-priority original-photo review, read-only.
No automatic shaft or physical major/minor graduation is certified.
Original source images are SHA-256-verified before detection and never modified.
"""
from pathlib import Path
import base64, hashlib, json, math, cv2, numpy as np
ROOT=Path(__file__).resolve().parents[1]
MATRIX=json.loads((ROOT/'engine/instruments/stage11-acceptance-matrix-v1.json').read_text())
SHARDS=[json.loads((ROOT/('engine/instruments/stage34-native/'+name+'-candidates-v1.json')).read_text())
        for name in ('overhead','captain','engine','first-officer','pedestal')]
BYID={f['id']:f for shard in SHARDS for f in shard['faces']}
NATIVE=json.loads((ROOT/'engine/instruments/native-photo-geometric-evidence-v1.json').read_text())
BYNATIVE={f['id']:f for f in NATIVE['faces']}
high=[f for f in MATRIX['faces'] if f['priority']=='high']
assert len(high)==15
outdir=ROOT/'reports/stage11-high-risk-native-review'
outdir.mkdir(parents=True,exist_ok=True)
images={}
def load(face):
    s=BYID[face['id']]['source']
    if s['asset'] not in images:
        path=ROOT/s['asset']
        assert path.is_file(),str(path)
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest==s['sha256'], f"PHOTO HASH MISMATCH: {s['asset']}"
        im=cv2.imread(str(path),cv2.IMREAD_COLOR)
        assert im is not None,f"PHOTO NOT DECODABLE: {path}"
        assert (im.shape[1],im.shape[0])==(s['width'],s['height']),f"PHOTO SIZE MISMATCH: {path}"
        images[s['asset']]=im
    return images[s['asset']]
def hud_candidates(image,pivot,radius):
    # Prospective *hub-looking* circles only. A panel with no needle may
    # still contain screwheads/text rings in this region.
    h,w=image.shape[:2]
    margin=max(28,round(radius*.16))
    x0=max(0,round(pivot[0])-margin);x1=min(w,round(pivot[0])+margin)
    y0=max(0,round(pivot[1])-margin);y1=min(h,round(pivot[1])+margin)
    region=image[y0:y1,x0:x1]
    if min(region.shape[:2])<28:return []
    gray=cv2.cvtColor(region,cv2.COLOR_BGR2GRAY)
    circles=cv2.HoughCircles(cv2.medianBlur(gray,5),cv2.HOUGH_GRADIENT,dp=1.2,
       minDist=10,param1=110,param2=18,minRadius=3,maxRadius=max(7,min(27,round(radius*.09))))
    candidates=[]
    if circles is not None:
        for x,y,r in circles[0]:
            X,Y=float(x+x0),float(y+y0)
            delta=math.hypot(X-pivot[0],Y-pivot[1])
            if delta>=margin*1.05:continue
            candidates.append({'x':round(X,2),'y':round(Y,2),'radiusPx':round(float(r),2),
                'distanceFromHistoricPivotPx':round(delta,2),
                'status':'UNCERTAIN_HUB_LIKE_CIRCLE_CANNOT_CERTIFY_SHAFT'})
    return sorted(candidates,key=lambda x:x['distanceFromHistoricPivotPx'])[:7]
def prepare_crop(face):
    f=BYID[face['id']];image=load(face);linear=f['kind']=='linear'
    if linear:
        win=f['lineTrackCandidate']
        cx=(win['x0']+win['x1'])/2;cy=(win['y0']+win['y1'])/2
        radius=max(135,round(max(win['x1']-win['x0'],win['y1']-win['y0'])*.75))
        old=None;rim=None
    else:
        old=f['pivotInput']
        rim=f['circleRimAlternatives'][0] if f['circleRimAlternatives'] else None
        cx=old['x'];cy=old['y']
        radius=max([s['radiusBandPx'][1] for s in f['scales']]+[40])
        if rim:radius=max(radius,round(rim['radius']))
        radius=round(radius*1.23)
    pixels=cv2.getRectSubPix(image,(radius*2+1,radius*2+1),(float(cx),float(cy)))
    scale=700/pixels.shape[0]
    view=cv2.resize(pixels,(700,700),interpolation=cv2.INTER_AREA if scale<1 else cv2.INTER_CUBIC)
    def point(x,y):return (round((x-cx+radius)*scale),round((y-cy+radius)*scale))
    if linear:
        w=f['lineTrackCandidate']
        cv2.rectangle(view,point(w['x0'],w['y0']),point(w['x1'],w['y1']),(30,210,255),2,cv2.LINE_AA)
        for line in f['linearTickEndpoints']:
            cv2.line(view,point(*line['strokePointA']),point(*line['strokePointB']),(70,240,70),2)
    else:
        # Display prior native lines as small blue/gold overlays.
        strokes=[s for band in f['scales'] for s in band['whiteRadialCandidates']]
        accepted=sorted(strokes,key=lambda x:x['lengthPx'],reverse=True)[:36]
        for t in accepted:
            cv2.line(view,point(*t['innerTip']),point(*t['outerTip']),(215,148,38),1,cv2.LINE_AA)
        cv2.drawMarker(view,point(old['x'],old['y']),(255,30,255),cv2.MARKER_CROSS,20,2,cv2.LINE_AA)
        if rim:
            cv2.drawMarker(view,point(rim['x'],rim['y']),(20,225,20),cv2.MARKER_DIAMOND,21,2,cv2.LINE_AA)
            cv2.line(view,point(old['x'],old['y']),point(rim['x'],rim['y']),(20,250,250),1,cv2.LINE_AA)
        conflict=BYNATIVE[face['id']].get('pivotConflict')
        if conflict:
            p=conflict['overlayPivot']
            cv2.drawMarker(view,point(p['x'],p['y']),(0,180,255),cv2.MARKER_TILTED_CROSS,15,2)
    # Clear native image panel label and evidence meaning.
    panel=np.full((770,700,3),32,dtype=np.uint8)
    panel[69:769,0:700]=view
    def title(s,y,color=(255,255,255)):
        cv2.putText(panel,s,(12,y),cv2.FONT_HERSHEY_SIMPLEX,.47,color,1,cv2.LINE_AA)
    title(face['id']+' / '+face['panel']+' | ORIGINAL PNG VERIFIED',21)
    title('MAGENTA legacy; GREEN circle; BLUE/GOLD segments candidate',42,(130,220,255))
    title('NONE PHOTO-CERTIFIED  |  NO ARTWORK MODIFIED',61,(40,180,255))
    return panel
records=[]
for face in high:
    native=BYID[face['id']]
    source=native['source'];load(face)
    p=native.get('pivotInput')
    rim=native.get('circleRimAlternatives') or []
    if native['kind']=='rotary':
        radius=max(s['radiusBandPx'][1] for s in native['scales'])
        hub=hud_candidates(images[source['asset']],(p['x'],p['y']),radius)
    else:hub=[]
    conflict=BYNATIVE[face['id']].get('pivotConflict')
    delta=math.hypot(p['x']-rim[0]['x'],p['y']-rim[0]['y']) if p and rim else None
    ref=[z for band in native.get('scales',[]) for z in band.get('referenceMatches',[])]
    lines=[z for band in native.get('scales',[]) for z in band.get('whiteRadialCandidates',[])]
    risk=(
        'LINEAR_TICKS_MISSING' if native['kind']=='linear' else
        'CONFLICTING_PRIOR_CENTRES' if conflict else
        'RIM_NOT_SHAFT_CENTER_DISPLACEMENT' if delta is not None and delta>20 else
        'INCOMPLETE_TICKS_AND_SHAFT'
    )
    records.append({'id':face['id'],'priority':'high','source':source,
     'inspectionTier':'NATIVE_IMAGE_VERIFIED_AUTOMATED_EVIDENCE',
     'historicalPivot':p,'historicPivotConflict':conflict,
     'rimCircleCandidate':rim[0] if rim else None,
     'rimVersusHistoricalPx':round(delta,2) if delta is not None else None,
     'localHubLikeCirclesUnverified':hub,
     'unassignedWhiteRadialFragments':len(lines),
     'priorNumericReferenceMarks':len(ref),
     'singleReferenceCandidates':sum(z['status']=='single_angle_candidate_not_approved' for z in ref),
     'ambiguousReferenceCandidates':sum(z['status']=='multiple_runs_ambiguous' for z in ref),
     'unmatchedReferenceMarks':sum(z['status']=='no_white_radial_run' for z in ref),
     'linearCrossTrackSegments':len(native.get('linearTickEndpoints',[])),
     'kind':native['kind'],'reason':risk,
     'repairedPivot':None,'approvedShaftPivot':False,
     'approvedMainMinorTicks':0,
     'needsExactOwnerImageReview':True,
     'neverPromoteRimOrTextCandidate':True})
for index in range(0,15,3):
    image=cv2.hconcat([prepare_crop(face) for face in high[index:index+3]])
    path=outdir/f'priorities_{index//3+1:02d}.jpg'
    assert cv2.imwrite(str(path),image,[cv2.IMWRITE_JPEG_QUALITY,85])
    # Three sheets to inspect directly; complete 5-page bundle uploaded as CI artifact.
    if index in (0,3,6,9,12):
        ok,jpg=cv2.imencode('.jpg',image,[cv2.IMWRITE_JPEG_QUALITY,66]);assert ok
        print('B737_HIGH_RISK_PHOTO_SHEET_'+str(index//3+1)+'='+base64.b64encode(jpg).decode('ascii'),flush=True)
# Explore, but do not auto-approve, candidate dark vertical Stab Trim tracks near old ROI.
trim=next(f for f in high if f['id']=='ped.stab_trim.right')
source_image=load(trim)
original_window=BYID[trim['id']]['lineTrackCandidate']
crop_rect=(max(0,original_window['x0']-170),max(0,original_window['y0']-85),
           min(source_image.shape[1],original_window['x1']+35),
           min(source_image.shape[0],original_window['y1']+45))
rx0,ry0,rx1,ry1=crop_rect
roi=cv2.cvtColor(source_image[ry0:ry1,rx0:rx1],cv2.COLOR_BGR2GRAY)
dark=(roi<70).astype(np.uint8)*255
dark=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_RECT,(5,21)))
dark=cv2.morphologyEx(dark,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(3,80)))
components=cv2.connectedComponentsWithStats(dark,8)[2]
boxes=[]
for xx,yy,ww,hh,area in components[1:]:
    xx,yy,ww,hh,area=map(int,(xx,yy,ww,hh,area))
    if hh<150 or ww<5 or ww>180:continue
    boxes.append({'x0':xx+rx0,'y0':yy+ry0,'x1':xx+ww+rx0,'y1':yy+hh+ry0,
      'areaPx':area,'status':'DARK_REGION_CANDIDATE_NOT_PROVEN_TRIM_SLIDER'})
boxes.sort(key=lambda b:(-(b['y1']-b['y0']),-b['areaPx']))
boxes=boxes[:12]
trimWindowProposal=None
if boxes:
    # Consistent with human visual observation of a dark scale LEFT of old ROI.
    nearer=[box for box in boxes if box['x0'] < original_window['x0'] and
            box['x1'] > original_window['x0']-30]
    if nearer:
        darkSelected=nearer[0]
        trimWindowProposal={'x0':darkSelected['x0'],
          'x1':darkSelected['x1'],'y0':original_window['y0'],
          'y1':original_window['y1'],
          'geometryStatus':'UNVERIFIED_ALTERNATIVE_WINDOW_NEEDS_EXACT_SCALE_TICK_QA'}
        left,top,right,bottom=(trimWindowProposal[k] for k in ('x0','y0','x1','y1'))
        gray=cv2.cvtColor(source_image[top:bottom,left:right],cv2.COLOR_BGR2GRAY)
        edge=cv2.Canny(gray,55,145)
        lines=cv2.HoughLinesP(edge,1,np.pi/360,threshold=10,minLineLength=9,maxLineGap=2)
        yset=set()
        if lines is not None:
            for xx,yy,XX,YY in lines.reshape(-1,4):
                if abs(int(YY)-int(yy))<=3:
                    yset.add(int(round((int(yy)+int(YY))/2)))
        trimWindowProposal['horizontalLineCandidateCount']=len(yset)
        trimWindowProposal['rawHorizontalLineRowsPx']=sorted([int(top+y) for y in yset])[:90]
        trimWindowProposal['oldWindowLineCount']=len(BYID[trim['id']]['linearTickEndpoints'])
print('B737_TRIM_RIGHT_ALTERNATIVE_WINDOW='+json.dumps(trimWindowProposal),flush=True)
print('B737_TRIM_RIGHT_DARK_VERTICAL_CANDIDATES='+json.dumps(boxes),flush=True)
for b in boxes:
    # A wrong box must not be automatically replaced with a dark connected region.
    assert b['x0']>=rx0 and b['x1']<=rx1+1

fo=[f for f in MATRIX['faces'] if f['id'] in ('fo.outer_altimeter','fo.outer_vertical_speed','fo.outer_clock')]
assert len(fo)==3
for face in fo:
    img=load(face)
    src=BYID[face['id']]['source']
    assert src['asset']=='file_000000006c00820ab145b3682f686256.png'
    assert (img.shape[1],img.shape[0])==(1123,1400)
    assert src['sha256']=='b2439666f75ddbcab15835b532d26a7ad2d1ab669be5f48774d656c1b8915a3c'
extra={'sourcePath':src['asset'],'sha256':src['sha256'],'nativeSize':[1123,1400],
 'allThreeSourceLinksVerified':True,
 'faces':[f['id'] for f in fo],
 'approval':'SOURCE_PROVENANCE_RESOLVED_NOT_GEOMETRY_CERTIFIED'}
report={'schema':'b737.high-risk-pivot-and-tick-review.v2','sourceDate':'2026-10-25',
 'counts':{'highRiskFaces':len(records),
   'rotary':sum(r['kind']=='rotary' for r in records),
   'linear':sum(r['kind']=='linear' for r in records),
   'shaVerifiedSourceImages':len(images),
   'legacyPivotConflicts':sum(bool(r['historicPivotConflict']) for r in records),
   'largeRimDelta':sum((r['rimVersusHistoricalPx'] or 0)>20 for r in records),
   'previousNumericReferences':sum(r['priorNumericReferenceMarks'] for r in records),
   'nonsemanticHoughFragments':sum(r['unassignedWhiteRadialFragments'] for r in records),
   'sourceApprovedPivotCount':0,'sourceApprovedMajorMinorTickCount':0,
   'foExternalImageFilesStillMissing':0},
 'restrictions':['Never confuse rim circle with shaft pivot','Line segment can be label/screw/rim, not tick',
   'No value assignment without exact photographed major/minor label','Never rewrite artwork or operational coordinates without reviewer evidence'],
 'foSourceVerification':extra,'trimRightDarkVerticalCandidates':boxes,
 'oldTrimRightWindowQuarantined':original_window,
 'trimRightAlternativeWindowProvisional':trimWindowProposal,'faces':records}
dest=ROOT/'reports/stage11-high-risk-native-evidence-v2.json'
dest.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('B737_HIGH_RISK_COUNTS='+json.dumps(report['counts']),flush=True)
print('B737_FO_REPOSITORY_ROOT_SHA_VERIFIED=3',flush=True)
print('B737_HIGH_RISK_RESULT='+str(dest.relative_to(ROOT)),flush=True)
