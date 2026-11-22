'use strict';
/* Focused Unified regression: cockpit RMI, instant FINAL_10 flaps,
 * authoritative ELEC annunciators, and the two live header buttons.
 * Existing source photos, Owner18 guards and LE device mechanics are untouched.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('RMI accepts valid tuned VOR bearings in magnetic degrees, without inventing missing station data',()=>{
 const src=read('panel-mosaic-lab/cockpit/instrument-lab/unified.js');
 const m=src.match(/const magneticBearing=signal=>\{([\s\S]*?)\n        \};\n        const bearing=n=>/);
 assert.ok(m,'RMI source conversion must exist');
 assert.match(src,/const bearing=n=>magneticBearing\(valid\('navigation\.vor'\+n\)\)/);
 const magneticBearing=new Function('nav','hdg','return signal=>{'+m[1]+'};')(
   {magneticVariationDeg:5},290);
 assert.equal(magneticBearing({bearingDeg:295,bearingReference:'TRUE'}),290);
 assert.equal(magneticBearing({bearingDeg:355,bearingReference:'MAGNETIC'}),355);
 assert.equal(magneticBearing({bearingDeg:90,bearingReference:'RELATIVE'}),20);
 assert.equal(magneticBearing(null),null);
 assert.equal(magneticBearing({bearingDeg:210,bearingReference:'UNKNOWN'}),null);
});

test('FINAL_10 reads actual TE owner without modifying the locked LE bridge',()=>{
 const src=read('panel-mosaic-lab/cockpit/final10-approach-preset-v1.js');
 const m=src.match(/function readFlapOwner\(\)\{([\s\S]*?)\n \}\n function applyMcp/);
 assert.ok(m,'read-only owner check must exist');
 const state={lever:30,leStage:'FULL',center:{extended:true},mismatch:[],revision:48};
 const actuator={actual:30,command:30,moving:false};
 const trainer={flapActuator:()=>actuator,snapshot:()=>state};
 const docs={getElementById:()=>({contentWindow:{B737LEDevicesTrainer:trainer}})};
 const readFlapOwner=new Function('docs','return function readFlapOwner(){'+m[1]+'};')(docs);
 const ready=readFlapOwner();
 assert.equal(ready.lever,30);
 assert.equal(ready.actualTe,30);
 assert.equal(ready.projection.leStage,'FULL');
 assert.equal(ready.projection.teMoving,false);
 assert.match(src,/ownerReady=physical/);
 assert.match(src,/owner\?\.projection\?\.center\?\.extended===true/);
 assert.match(src,/getLiveFlapOwnerState:readFlapOwner/);
 actuator.actual=NaN;
 assert.equal(readFlapOwner(),null,'invalid actuator data is rejected');
 actuator.actual=0;state.lever=40;
 assert.equal(readFlapOwner().actualTe,0,'lever never fabricates actual TE angle');
 const locked=read('panel-mosaic-lab/cockpit/le-devices-live-link-v1.js');
 assert.ok(!locked.includes('const final10Ready='),'locked LE owner link stays unchanged');
});

test('Six-Pack removes an obsolete OH BUS OFF only when V7 proves the lamp off',()=>{
 const mapper=require('../panel-mosaic-lab/cockpit/sixpack-live-integration-v1.js');
 const listeners={};const writes=[];const frame={};
 const state={faults:{},source:{1:'GEN1',2:'GEN2'},config:{}};
 let lamp=true;
 const win={location:{origin:'https://unified.test'},
  document:{readyState:'loading',getElementById:id=>id==='overheadFrame'?{contentWindow:frame}:null,addEventListener(){}},
  addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn);},
  dispatchEvent:e=>{for(const fn of listeners[e.type]||[])fn(e);},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},
  B737SixPack:{setLiveConditions:r=>writes.push(r)},
  B737ISNCockpitV1:{getElectricalState:()=>state,getState:()=>({state:{electrical:{lamps:{busOff1:true}}}})},
  B737ElectricalV7:{evaluate:()=>({lamps:{busOff1:lamp}})},
  B737UnifiedElectricalLive:{snapshot:()=>({state})}
 };
 mapper.install(win);
 const oh={type:'b737:cockpit-overhead',kind:'state',power:true,
   lampTest:false,frames:{busOff1:'ON'}};
 for(const fn of listeners.message||[])fn({origin:win.location.origin,source:frame,data:oh});
 assert.ok(writes.at(-1)['CAPT.ELEC'].includes('OH:busOff1'));
 lamp=false;
 for(const fn of listeners['b737:electrical-v7-state']||[])fn({detail:{state}});
 assert.deepEqual(writes.at(-1)['CAPT.ELEC'],[]);
 lamp=true;
 for(const fn of listeners['b737:electrical-v7-state']||[])fn({detail:{state}});
 assert.ok(writes.at(-1)['CAPT.ELEC'].includes('OH:busOff1'),
  'a genuine electrical failure must still illuminate ELEC');
});

test('FAILURES and CB PANEL are not hidden by first paint or workspace',()=>{
 const html=read('panel-mosaic-lab/cockpit/index.html');
 const workspace=read('panel-mosaic-lab/cockpit/unified-workspace-v1.js');
 const header=html.match(/<header class="unified-minimal-header">([\s\S]*?)<\/header>/)?.[1];
 assert.ok(header);
 for(const id of ['cbPanelOpen','failuresHeaderOpen']){
  const tag=header.match(new RegExp('<button[^>]+id="'+id+'"[^>]*>'))?.[0];
  assert.ok(tag,id+' must exist');
  assert.ok(!/display\s*:\s*none/i.test(tag),id+' cannot be inline hidden');
  assert.ok(!new RegExp('>\\s*#'+id+'[,]?', 'i').test(
    html.split('<style id="unified-header-first-paint-v2">')[1]?.split('</style>')[0]||''),
    id+' must not be suppressed before first paint');
  const legacy=workspace.match(/const legacy=new Set\(([^;]+)\);/)?.[1]||'';
  assert.ok(!legacy.includes("'"+id+"'"),id+' must not be force-hidden by Workspace');
 }
 assert.match(html,/cb-panel-entry-v1\.js/);
 assert.match(html,/failures-header-v1\.js/);
});
