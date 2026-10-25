'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const V=require('../panel-mosaic-lab/cockpit/aircon-400-oh21-model');
const P=require('../engine/systems/pneumatics-v6');
assert.equal(V.validate(),true);
assert.deepEqual(V.switches.map(c=>c.label),['L RECIRC FAN','R RECIRC FAN']);
assert.deepEqual(V.packs.map(c=>c.label),['PACK','PACK']);
assert.deepEqual(V.packs.map(c=>c.legacyId),['pack-trip-l','pack-trip-r']);
assert.equal(V.switches[1].id,'recirc-fan','reuse the existing right physical socket');
const g=V.geometry({x:1724,y:1751,w:493,h:701});
const left=g.point(V.switches[0].sourcePoint),right=g.point(V.switches[1].sourcePoint);
assert.ok(left.x<right.x&&Math.abs(left.y-right.y)<.01,'dual toggles share a row');
for(const lamp of V.packs){
 const box=g.rect(lamp.rect);
 assert.ok(box.x>=1724&&box.y>=1751&&box.x+box.w<=2217&&box.y+box.h<=2452);
}
const set=(s,key,value)=>P.apply(s,{type:'CONTROL',key,value});
const fault=(s,id)=>P.apply(s,{type:'FAULT',id,active:true,instructor:true});
let s=P.initial();
assert.equal(P.derive(s).recircInstallation,'B737-300-500');
assert.equal(P.derive(set(s,'recirc','OFF')).recircFanRunning,false,'legacy 300/500 fan remains unchanged');
s=set(s,'aircraftFamily','B737-400');
assert.equal(P.derive(s).recircFans.L.running,true);
assert.equal(P.derive(s).recircFans.R.running,true);
s=set(s,'recircL','OFF');
assert.equal(P.derive(s).recircFans.L.running,false);
assert.equal(P.derive(s).recircFans.R.running,true,'R independent of left OFF');
s=set(s,'recircR','OFF');
assert.equal(P.derive(s).recircFans.R.running,false);
assert.equal(P.derive(s).recircFanRunning,false);
s=set(s,'recircL','AUTO');
assert.equal(P.derive(s).recircFans.L.running,true,'L independent of right OFF');
assert.equal(P.derive(s).recircFans.R.running,false);
assert.equal(P.derive(fault(s,'recircFanLFailed')).recircFans.R.running,false);
s=set(s,'recircR','AUTO');
assert.equal(P.derive(fault(s,'recircFanLFailed')).recircFans.R.running,true,'L fault does not stop R');
assert.equal(P.derive(fault(s,'recircFanRFailed')).recircFans.L.running,true,'R fault does not stop L');
assert.equal(P.derive(set(s,'aircraftFamily','B737-300-500')).recircFanRunning,true,'family swap restores single-fan rules');
assert.equal(P.derive(P.apply(P.initial(),{type:'SENSOR',key:'packLOverheat',value:true})).lamps.packTripL,true,'same trip source as legacy caution, distinct 400 face');
const base=path.join(__dirname,'../panel-mosaic-lab/cockpit');
for(const mode of ['ON','OFF']){
 const face=fs.readFileSync(path.join(base,'assets/737-400-PACK_'+mode+'.svg'),'utf8');
 assert.match(face,/>PACK</);
 assert.doesNotMatch(face,/TRIP OFF/);
}
const stage=fs.readFileSync(path.join(base,'overhead-stage.html'),'utf8');
for(const name of ['aircon-400-oh21-model.js','aircon-400-oh21-overlay.js','aircon-400-oh21-overlay.css'])
 assert.ok(stage.includes(name),'Unified loads '+name);
const overlay=fs.readFileSync(path.join(base,'aircon-400-oh21-overlay.js'),'utf8');
assert.ok(overlay.includes("toggle-recirc-fan-l-400"));
assert.ok(overlay.includes("setAircon400LeftRecirc"));
const lights=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/interactive-overhead/lights-model.js'),'utf8');
assert.ok(lights.includes('recircL:recirc400Left'));
assert.ok(lights.includes("recircR:control('recirc-fan')"));
const frozen=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/all-overhead/final-lock.json'),'utf8');
assert.ok(frozen.length>100,'frozen mosaic guard remains present');
console.log('PASS: 737-400 dual RECIRC and PACK lens variant, 300/500 regression guards');
