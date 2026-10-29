'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'..','panel-mosaic-lab','cockpit');
const js=fs.readFileSync(path.join(base,'conventional-engine-needles-v1.js'),'utf8');
const css=fs.readFileSync(path.join(base,'conventional-engine-needles-v1.css'),'utf8');
const face=fs.readFileSync(path.join(base,'assets','conventional-engine-face-v1.svg'),'utf8');
const needle=fs.readFileSync(path.join(base,'assets','conventional-needle-photo-v1.svg'),'utf8');
const index=fs.readFileSync(path.join(base,'index.html'),'utf8');
const profile=require('../engine/config/aircraft-profile-v1.js');
assert.equal(profile.DEFAULTS.engineInstruments,'EIS');
assert.ok(index.includes('conventional-engine-needles-v1.js'));
assert.ok(index.includes('conventional-engine-needles-v1.css'));
assert.match(css,/data-engine-indication="CONVENTIONAL"/);
assert.match(css,/z-index:43/);
assert.equal((face.match(/data-conventional-red-lamp-socket/g)||[]).length,6);
const encoded=needle.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/)?.[1];
assert.ok(encoded,'Photo-derived pointer must be embedded for offline GitHub Pages use');
assert.equal(Buffer.from(encoded,'base64').subarray(0,4).toString('utf8'),'RIFF');
// Browser-free DOM shim to verify exact sixteen nodes and state updates.
class Elem {
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.parentNode=null;}
 setAttribute(k,v){this.attrs[k]=String(v)}
 append(child){this.children.push(child);child.parentNode=this}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null}
}
const host=new Elem('button');const listeners=new Map();
const doc={
 baseURI:'https://example.test/b737/panel-mosaic-lab/cockpit/',
 createElementNS:(_,tag)=>new Elem(tag),
 querySelector:selector=>selector.includes('data-piece="engine"')?host:null,
 addEventListener:()=>{}
};
const win={addEventListener:(key,fn)=>listeners.set(key,fn)};
vm.runInNewContext(js,{document:doc,window:win,URL,console});
const api=win.B737ConventionalNeedlesV1;
const specs=api.getSpecs();
assert.equal(specs.length,16);
assert.equal(new Set(specs.map(s=>s.id)).size,16);
assert.deepEqual([...new Set(specs.map(s=>s.cx))].sort((a,b)=>a-b),[158,453,793,1080]);
assert.deepEqual([...new Set(specs.map(s=>s.cy))].sort((a,b)=>a-b),[309,579,849,1112]);
assert.equal(host.children.length,1);
const layer=host.children[0],groups=layer.children.filter(c=>c.tag==='g');
assert.equal(groups.length,16);
assert.equal(layer.attrs.viewBox,'0 0 1235 1274');
for(const group of groups){
 const rotor=group.children[0];
 assert.equal(rotor.children[0].tag,'image');
 assert.ok(rotor.children[0].attrs.href.endsWith('conventional-needle-photo-v1.svg?v=CONV-NEEDLE-0001'));
 assert.ok(rotor.attrs.transform.includes('translate('));
}
assert.equal(api.getReadings().n2_1.source,'UNSOURCED_PARKED');
listeners.get('b737:isn-start-indications')({detail:{engines:{
 engine1:{n2:{value:61.5},egt:{value:545}},engine2:{n2:{value:60},egt:{value:530}}
}}});
assert.equal(api.getReadings().n2_1.value,61.5);
assert.equal(api.getReadings().egt_2.value,530);
assert.equal(api.getReadings().n2_1.source,'ISN_START_SOURCE');
assert.equal(api.getReadings().oilPressure_1.source,'UNSOURCED_PARKED');
assert.equal(api.setReading('engine1','oilPressure',145),100);
assert.throws(()=>api.setReading('engine1','n1',NaN),/Non-finite/);
assert.throws(()=>api.setReading('engine3','n2',35),/Unknown engine/);
api.resetParked();
assert.equal(api.getReadings().n2_1.value,0);
assert.equal(api.getReadings().oilPressure_1.value,0);
console.log('PASS: sixteen photo-derived conventional pointers, exact dial centers, EIS isolation, N2/EGT live wiring and explicit parked-state policy.');
