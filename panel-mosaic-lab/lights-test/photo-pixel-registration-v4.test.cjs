'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=__dirname,read=p=>JSON.parse(fs.readFileSync(path.resolve(base,p),'utf8'));
const v4=read('photo-pixel-registration-v4.json'),v3=read('photo-pixel-registration-v3.json');
const adj=read('photo-position-corrections-v2.json');
const oh=read('../interactive-overhead/lights.json'),main=read('../cockpit/lights.json');
const curr=new Map([...oh.lights,...main.lights].map(x=>[x.id,x]));
const old=new Map(v3.records.map(x=>[x.id,x]));
// V4 is an immutable historical snapshot, recorded when the overhead registry
// was LGT-0011. Newer lamp cycles may retain its calibration unchanged.
assert.equal(v4.versions.overhead,'LGT-0011');
const vnum=v=>Number(String(v).replace(/^LGT-/,'')); 
assert.ok(vnum(oh.version)>=vnum(v4.versions.overhead),'Photo snapshot cannot refer to a future registry');
assert.equal(v4.versions.main,main.version);
assert.equal(v4.summary.mounted,142);
assert.equal(v4.summary.verifiedWithinThreePhotoPixels,140);
assert.equal(v4.summary.requiresSpecialInspection,2);
assert.equal(v4.summary.sourcePhotoPositionCorrections,13);
assert.equal(v4.summary.reflowedLensDesigns,21);
assert.equal(v4.summary.reflowedSvgStates,45);
assert.equal(v4.summary.originalLockedPhotoChanges,0);
assert.equal(adj.records.length,1);
let good=0,bad=0,changed=0;
for(const rec of v4.records){
 const lamp=curr.get(rec.id),hist=old.get(rec.id);
 assert.ok(lamp&&hist,rec.id);
 assert.deepEqual(lamp.sourceRect,rec.currentSourceRect,rec.id);
 if(rec.id==='fuel-1-aft'){
  assert.deepEqual(rec.currentSourceRect,adj.records[0].newSourceRect);
  assert.deepEqual(hist.currentSourceRect,adj.records[0].previousSourceRect);
  changed++;
 }else assert.deepEqual(hist.currentSourceRect,rec.currentSourceRect,rec.id+' unmodified source photo rectangle');
 const passed=hist.status==='AUTO_PIXEL_CENTRE_MATCH_3PX'||rec.latestScanline?.status==='SCANLINE_CENTRE_CANDIDATE';
 assert.equal(rec.finalPixelVerdict,passed?'PHOTO_PIXEL_CENTRE_CONFIRMED_3PX':'PHOTO_REVIEW_NEEDS_MANUAL_GEOMETRY',rec.id);
 if(rec.finalPixelVerdict==='PHOTO_PIXEL_CENTRE_CONFIRMED_3PX')good++;else bad++;
}
assert.equal(good,140);assert.equal(bad,2);assert.equal(changed,1);
assert.deepEqual(v4.pending.map(x=>x.id).sort(),['flight-recorder-off','main-pull-up-captain']);
console.log('PASS: 140/142 pixel-confirmed B737 annunciator source registrations; FUEL 1 AFT +4px photo correction; 2 hard photo cases flagged; no locked pixel edits.');
