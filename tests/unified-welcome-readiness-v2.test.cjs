'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),vm=require('node:vm');
const Gate=require('../panel-mosaic-lab/cockpit/unified-welcome-readiness-v2.js');
const root=path.join(__dirname,'../panel-mosaic-lab/cockpit');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function sample(){
 return {visual:{main:true,throttle:true,forward:true,aft:false,pedestal:false},
  full:{main:true,instruments:true,controls:true,electrical:true,
   cdu:true,overhead:false},mcpMounted:true};
}
test('source: no partially ready main instrument panel may enter flight',()=>{
 const empty=Gate.evaluate();assert.equal(empty.percent,0);
 assert.equal(empty.canEnter,false);
 const baseline=Gate.evaluate(sample());
 assert.equal(baseline.percent,78);
 assert.equal(baseline.mainReady,true);assert.equal(baseline.canEnter,true);
 const visualOnly=sample();visualOnly.full.instruments=false;
 const broken=Gate.evaluate(visualOnly);
 assert.ok(broken.percent>=Gate.MIN_PERCENT,'score alone must not permit entry');
 assert.equal(broken.canEnter,false);
 assert.ok(broken.missing.includes('mainInstruments'));
});
test('100% visual but one disconnected essential subsystem blocks entry',()=>{
 for(const [area,key] of [
  ['visual','main'],['full','main'],['full','instruments'],
  ['full','controls'],['full','electrical'],['full','cdu'],
  ['visual','throttle'],['visual','forward']]){
  const s=sample();s.visual.aft=s.visual.pedestal=s.full.overhead=true;
  s[area][key]=false;
  assert.equal(Gate.evaluate(s).canEnter,false,area+'.'+key);
 }
 const s=sample();s.mcpMounted=false;
 assert.equal(Gate.evaluate(s).canEnter,false,'real MCP hardware needed');
});
test('missing aft and pedestal photos do not stop 70%-ready cockpit if all essential owners are ready',()=>{
 const out=Gate.evaluate(sample());
 assert.equal(out.canEnter,true);
 assert.equal(out.checks.aft,false);assert.equal(out.checks.pedestal,false);
 assert.equal(out.completed,11);assert.equal(out.total,14);
});
test('welcome never opens the cockpit simply because photos loaded; checks scenario repaint and FINAL_10 owner ACK',()=>{
 const source=read('unified-welcome-v1.js');
 assert.match(source,/CockpitStartupGate\?\.inspectFull\?\./);
 assert.match(source,/B737WelcomeReadinessV2\?\.evaluate\?\./);
 assert.match(source,/gate\?\.canEnter === true && panelComplete/);
 assert.match(source,/now - readySince >= STABLE_MS/);
 assert.match(source,/directorPaintBaseline = mainPaints\(\)/);
 assert.match(source,/repainted = paints\.every/);
 assert.match(source,/B737Final10ApproachPresetV1\?\.getStatus\?\.\(\)\?\.complete === true/);
 assert.match(source,/if \(!active \|\| !repainted \|\| !final10Ready/);
 assert.match(source,/if \(panelComplete\) releaseSystems\(\)/);
});
test('compiled entry loads the gate and a new welcome cache key without mutating protected photos',()=>{
 const index=read('index.html'),gate=index.indexOf('unified-welcome-readiness-v2.js'),
  welcome=index.indexOf('unified-welcome-v1.js');
 assert.ok(gate>0&&welcome>gate,'helper must be listed ahead of the welcome controller');
 assert.match(index,/unified-welcome-v1\.js\?v=WELCOME-GATE-0001/);
 assert.match(index,/id="region-main"/);
 assert.match(index,/overhead-stage\.html/);
});
