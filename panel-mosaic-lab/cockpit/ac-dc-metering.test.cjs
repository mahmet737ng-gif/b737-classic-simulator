'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('./ac-dc-metering-model');
const panel=JSON.parse(fs.readFileSync(path.join(__dirname,'../all-overhead/atlas-layout.json')));
const oh10=panel.placements.find(piece=>piece.id==='OH10');
assert.ok(oh10);
assert.deepEqual(oh10.sourceDimensions,[model.source.width,model.source.height]);
assert.equal(model.meters.length,4);
assert.deepEqual(model.meters.map(m=>m.id),['dcAmps','cps','dcVolts','acVolts']);
assert.deepEqual(model.meters.map(m=>m.initialAngle),[0,-54.21,-45.5,-51.4]);
assert.equal(new Set(model.meters.map(m=>`${m.x}:${m.y}`)).size,4);
for(const meter of model.meters){
 const p=model.placement(oh10,meter);
 assert.ok(p.x>=oh10.x&&p.x<=oh10.x+oh10.w);
 assert.ok(p.y>=oh10.y&&p.y<=oh10.y+oh10.h);
 assert.ok(p.size>90&&p.size<240&&p.sizeX>90&&p.sizeY>90);
}
assert.equal(model.angle(-500),-70);
assert.equal(model.angle(500),70);
assert.throws(()=>model.angle(NaN));
const sprite=fs.readFileSync(path.join(__dirname,'ac-dc-metering-needle.svg'),'utf8');
assert.equal((sprite.match(/<path /g)||[]).length,2,'One isolated white blade plus its highlight');
assert.doesNotMatch(sprite,/<circle|<text|<image/,'The shared needle contains no dial or hub');
const ui=fs.readFileSync(path.join(__dirname,'ac-dc-metering-unified.js'),'utf8');
assert.ok(ui.includes(".atlas-piece[data-key=\"OH10\"]"));
assert.ok(ui.includes("new URL('./ac-dc-metering-needle.svg?v=MET-0001'"));
assert.ok(ui.includes('for(const meter of model.meters)'));
assert.ok(ui.includes('window.B737UnifiedAcDcMetering'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.ok(html.includes('ac-dc-metering-model.js?v=MET-0007-RED-ARC-CLIP'));
assert.ok(html.includes('ac-dc-metering-unified.js?v=MET-0007-RED-ARC-CLIP'));

/* MET-0005 regression: original, shared needle sprite and original OH10 panel ONLY. */
const crypto=require('node:crypto');
const gitBlob=crypto.createHash('sha1').update('blob '+Buffer.byteLength(sprite)+'\0'+sprite).digest('hex');
assert.equal(gitBlob,'3706dc3134d1c7bb989d3de519bf64aa854e705a','the original OH10 needle asset must not change');
assert.equal(model.meters.find(m=>m.id==='cps').tipRadius,148.530,'same sprite at longer photo-derived reach');
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,label+': '+a+' versus '+b);
near(model.angleForIndication('dcAmps',0),0,'0 DC AMPS center-zero');
near(model.angleForIndication('dcAmps',-50),-46.66,'-50 DC AMPS');
near(model.angleForIndication('dcAmps',50),44.26,'+50 DC AMPS');
near(model.angleForIndication('dcVolts',0),-45.5,'zero DC VOLTS');
near(model.angleForIndication('dcVolts',28),18.8254,'28 DC VOLTS interpolated photographic map');
near(model.angleForIndication('cps',400),0,'400 CPS at provisional upper centre');
near(model.angleForIndication('cps',0),-54.21,'power off CPS parks, not 360');
near(model.angleForIndication('acVolts',0),-51.4,'AC 0 V parks at the first printed tick rather than overtravel');
near(model.angleForIndication('acVolts',115),0.0237,'115 V normal AC reference');
near(model.angleForAcVolts(4,{mode:'RESIDUAL'}),-38.2574,'4 V residual uses separate scale');
assert.equal(model.photoScale.cps.readoutApprovedForPreview,false,'CPS provisional scale must remain flagged');
assert.equal(model.photoScale.acVolts.readoutApprovedForPreview,false,'AC scale remains pending visual QA');
assert.throws(()=>model.angleForIndication('cps',NaN));
assert.throws(()=>model.angleForAcVolts(100,{mode:'UNKNOWN'}));
assert.match(ui,/b737:ac-dc-metering-readings/);
assert.match(ui,/setReadings/);
assert.ok(ui.includes("new URL('./ac-dc-metering-needle.svg?v=MET-0001'"));
assert.ok(!ui.includes("createElement('canvas'"));
assert.ok(html.includes('ac-dc-metering-model.js?v=MET-0007-RED-ARC-CLIP'));
assert.ok(html.includes('ac-dc-metering-unified.js?v=MET-0007-RED-ARC-CLIP'));

/* MET-0006 mechanical invariant: the unchanged source-image pointer tip
 * follows the INNER TICK radial track; no animation frame may pass a stop. */
const ids=['dcAmps','cps','dcVolts','acVolts'];
for(const id of ids){
 const m=model.meters.find(x=>x.id===id),bounds=model.bounds(id),r=m.tipRadius;
 assert.ok(r>0&&r<230,id+' tip lies inside source dial');
 near(model.limitAngle(id,bounds.min-999),bounds.min,id+' left stop');
 near(model.limitAngle(id,bounds.max+999),bounds.max,id+' right stop');
 const frames=360;
 for(let i=0;i<=frames;i++){
  const angle=bounds.min+(bounds.max-bounds.min)*i/frames;
  const point=model.tipPoint(id,angle);
  near(Math.hypot(point.x-m.x,point.y-m.y),r,id+' fixed radial tip reach');
  assert.ok(point.angle>=bounds.min-1e-7&&point.angle<=bounds.max+1e-7,id+' bound');
  if(i&&i<frames){
   const next=model.tipPoint(id,angle+(bounds.max-bounds.min)/frames);
   assert.ok(next.x>=point.x-1e-7,'increasing indication must rotate clockwise across top arc');
  }
 }
 for(const [from,to] of [[bounds.min,bounds.max],[bounds.max,bounds.min]]){
  let pos=from,velocity=0,prev=pos,frames=0;
  for(;frames<400;frames++){
   const step=model.advanceNeedle(pos,velocity,to,1/60);
   pos=model.limitAngle(id,step.angle);velocity=step.velocity;
   assert.ok(pos>=bounds.min-1e-9&&pos<=bounds.max+1e-9,id+' during animation');
   assert.ok(Math.abs(velocity)<=model.motion.maxSpeedDegPerSec+1e-9,id+' speed limit');
   assert.ok((to-from)*(pos-prev)>=-1e-9,id+' direction');
   prev=pos;
   if(step.done)break;
  }
  assert.ok(frames<400,id+' settled');
  near(pos,to,id+' exact final stop');
 }
}
assert.equal(model.source.spriteTipRadius,216,'exact existing SVG pointer tip reach, no stretching artefact');
assert.ok(ui.includes('model.advanceNeedle'),'Unified must use bounded angular velocity motion');
assert.ok(ui.includes('model.limitAngle'),'Unified must clamp each animation frame');
assert.ok(ui.includes("transition:'none'"),'prevent CSS transition overriding physical speed limit');
assert.ok(!ui.includes('transition:320ms'),'no fixed-duration unequal-speed sweeps');


/* RED-ARC-0001: photo-fitted needle track, correct inner radius, and curved
 * black/blue foreground occlusion for every frame of every original needle. */
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'../../engine/instruments/oh10-user-arc-fit-v1.json'),'utf8'));
assert.equal(evidence.qa.nativeSourceRegistrationVerified,false,'screenshot fit is NOT native photo certification');
for(const meter of model.meters){
 const arc=evidence.arcMeasurements[meter.id],b=model.bounds(meter.id);
 assert.ok(arc,'missing screenshot measured red arc: '+meter.id);
 const [cx,cy,r]=arc.nativeCircle;
 near(meter.x,cx,meter.id+' screenshot-fitted center X');
 near(meter.y,cy,meter.id+' screenshot-fitted center Y');
 near(meter.tipRadius,r,meter.id+' radius along RED reference arc');
 near(b.min,arc.angleMin,meter.id+' leftmost red reference angle');
 near(b.max,arc.angleMax,meter.id+' rightmost red reference angle');
 assert.equal(model.photoScale[meter.id].readoutApprovedForPreview,false,'screen registration remains provisional');
 assert.ok(model.blackWindowPath(meter.id).startsWith('M 0 0 L 512 0'),'curved blue foreground mask');
 assert.ok(model.blackWindowPath(meter.id).includes('L 504.000 '),'mask uses densely sampled curved edge');
 const p=model.placement(oh10,meter);
 const expectedRatio=(oh10.h/model.source.height)/(oh10.w/model.source.width);
 near(p.sizeY/p.sizeX,expectedRatio,'preserve non-uniform OH10 source stretch');
 for(let n=0;n<=720;n++){
  const a=b.min+(b.max-b.min)*n/720,pt=model.tipPoint(meter.id,a);
  const blueAtTip=model.blueBoundaryAt(meter.id,pt.x);
  assert.ok(pt.y<blueAtTip-20,'needle tip always in black aperture and above blue occlusion: '+meter.id+' @'+a);
  const xp=model.arcPhoto.originX+model.arcPhoto.scaleX*pt.x;
  const yp=model.arcPhoto.originY+model.arcPhoto.scaleY*pt.y;
  assert.ok(Number.isFinite(xp)&&Number.isFinite(yp),'screenshot projection finite');
 }
}
assert.match(ui,/preserveAspectRatio:'none'/,'original non-uniform panel photo must be followed without letterboxing');
assert.match(ui,/model.blackWindowPath\(meter.id\)/,'blue scallop MUST hide pointer body');
assert.doesNotMatch(ui,/svg\(doc,clip,'rect'/,'the former straight clipping line must be removed');

console.log('PASS: one transparent AC/DC metering needle reused on four OH10 gauges with separate pivots/angles.');
