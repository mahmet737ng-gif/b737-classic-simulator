from PIL import Image
import json,hashlib,math
from pathlib import Path
root=Path(__file__).resolve().parents[2]
ledger=json.loads((root/'engine/instruments/oh19-native-ticks-batch1.json').read_text())
photo=root/ledger['source']['asset']
assert hashlib.sha256(photo.read_bytes()).hexdigest()==ledger['source']['sha256']
img=Image.open(photo).convert('RGB')
assert img.size==(1267,1241)
rings=ledger['scales']
assert [len(x['allVisibleTickCandidates']) for x in rings]==[47,51]
results=[]
for number,threshold in enumerate((155,175,195),1):
 counts=[]
 for scale in rings:
  hits=0
  for tick in scale['allVisibleTickCandidates']:
   angle=math.radians(tick['angleDeg']);p=ledger['commonPivot']
   good=0
   for r in range(tick['innerRadiusPx']-3,tick['innerRadiusPx']+18):
    x=round(p['x']+r*math.sin(angle));y=round(p['y']-r*math.cos(angle))
    if 0<=x<img.width and 0<=y<img.height:
     rgb=img.getpixel((x,y))
     if min(rgb)>=threshold and max(rgb)-min(rgb)<=95:good+=1
   if good>=3:hits+=1
  counts.append(hits)
 assert counts[0]>=25 and counts[1]>=28,(number,counts)
 results.append(dict(round=number,whiteThreshold=threshold,innerWhiteSites=counts[0],
                     outerWhiteSites=counts[1],innerCandidates=47,outerCandidates=51,
                     unresolvedCabAltValues=32,shaftCertified=False,releaseApproved=False))
 print('OH19 photo pass',number,'white sites',counts,'32 labels still unknown')
out=root/'artifacts/oh19-pixel-qa/OH19_THREE_PASS_SOURCE_PIXELS.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(dict(photoSourceSHA=ledger['source']['sha256'],checks=results),indent=2)+'\n')
