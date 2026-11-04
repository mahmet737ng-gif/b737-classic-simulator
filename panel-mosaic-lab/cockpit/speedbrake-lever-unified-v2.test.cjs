'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const events=[],states=[];
let lamp=false;
const win={addEventListener:()=>{},B737CockpitLights:{
 getState:()=>({inputs:{speedBrakeArmedIndication:lamp}}),
 setInputs:input=>{lamp=input.speedBrakeArmedIndication;states.push(lamp);}
}};
const doc={readyState:'loading',addEventListener:()=>{},dispatchEvent:e=>events.push(e),querySelector:()=>null};
class CustomEvent{constructor(type,data){this.type=type;this.detail=data.detail;}}
const src=fs.readFileSync(__dirname+'/speedbrake-lever-unified-v1.js','utf8');
vm.runInNewContext(src,{window:win,document:doc,CustomEvent,console});
const api=win.B737SpeedbrakeLever;
assert.deepEqual(JSON.parse(JSON.stringify(api.stops.map(s=>s.key))),['DOWN','ARMED','FLIGHT_DETENT','UP']);
const geom=api.geometry();
assert.equal(geom.sourceX,171,'user-drawn slot centered x=171');
assert.equal(geom.sourceWidth,124,'new HD sprite scaled without stretching');
assert.equal(geom.baseAnchorX,102/120,'metal base pin is the x anchor');
assert.equal(geom.baseAnchorY,181/207,'metal base pin is the y anchor');
assert.equal(api.path().d,'M 171 257 L 171 632','slot has no bend or diagonal');
assert.equal(api.path().guide.length,2,'strictly vertical groove');
assert.equal(api.path().guide[0].x,api.path().guide[1].x);
assert.equal(JSON.stringify(api.stops.map(s=>s.y)),JSON.stringify([262,288,478,619]));
assert.deepEqual(JSON.parse(JSON.stringify(api.hitTargets().map(s=>s.key))),['DOWN','ARMED','FLIGHT_DETENT','UP']);
assert.ok(fs.existsSync(__dirname+'/assets/speedbrake-lever-hires-v2.svg'),'hi-res source must ship with web deployment');
const svg=fs.readFileSync(__dirname+'/assets/speedbrake-lever-hires-v2.svg','utf8');
assert.match(svg,/viewBox="0 0 120 207"/);
assert.match(svg,/width="480" height="828"/);
assert.match(svg,/cx="102" cy="181"/);
const changes=[];
for(const key of ['DOWN','ARMED','FLIGHT_DETENT','UP']){
 assert.equal(api.set(key),api.stops.find(s=>s.key===key).t);
 const ev=events.filter(e=>e.type==='b737:speedbrake-position').at(-1);
 changes.push([ev.detail.detent,ev.detail.armed]);
 assert.equal(ev.detail.armed,key==='ARMED');
 assert.equal(lamp,key==='ARMED');
}
assert.deepEqual(changes,[['DOWN',false],['ARMED',true],['FLIGHT_DETENT',false],['UP',false]]);
assert.equal(api.set(.20),api.stops.find(s=>s.key==='ARMED').t);
assert.equal(api.set(.50),api.stops.find(s=>s.key==='FLIGHT_DETENT').t);
console.log('PASS: straight owner-defined speedbrake slot, base-aligned 4 detents, four direct hit targets, high-resolution SVG and ARMED lamp.');
