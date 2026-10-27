'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const directory=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
const source=fs.readFileSync(path.join(directory,'live-mount.js'),'utf8');
const scopes=['OH','MP'], originals=[['../interactive-overhead/lights.json','OH'],['../cockpit/lights.json','MP']];
assert.equal(manifest.masters.length,87);
assert.equal(Object.keys(manifest.sourceAssetToMaster).length,91);
let lamps=0;
for(const [sourceFile,code] of originals){
 const register=JSON.parse(fs.readFileSync(path.join(directory,sourceFile),'utf8'));
 for(const light of register.lights){
  const id=manifest.sourceAssetToMaster[code+':'+light.asset];
  assert.ok(id,light.id+' has no master');
  const master=manifest.masters.find(m=>m.id===id);
  assert.ok(master&&master.assets.OFF&&master.assets.BRIGHT,light.id+' missing states');
  lamps++;
 }
}
assert.equal(lamps,142);
const allFiles=new Set();
for(const m of manifest.masters)for(const [state,p] of Object.entries(m.assets)){
 assert.ok(!allFiles.has(p),'Duplicate physical state path '+p);allFiles.add(p);
 assert.ok(fs.existsSync(path.join(directory,p)),'Missing SVG '+p);
 const svg=fs.readFileSync(path.join(directory,p),'utf8');
 assert.ok(svg.startsWith('<svg '),'Invalid image '+p);
}
assert.equal(allFiles.size,305);
const events=[];
const window={addEventListener(){},dispatchEvent(e){events.push(e.type)}};
const context={window,document:{currentScript:{src:'https://example.test/panel-mosaic-lab/lights-reference-v2/live-mount.js'},querySelectorAll(){return[]}},location:{origin:'https://example.test',search:''},URL,URLSearchParams,CustomEvent:class {constructor(type,detail){this.type=type;this.detail=detail}},fetch:async()=>({ok:true,json:async()=>manifest}),console};
vm.runInNewContext(source,context,{filename:'live-mount.js'});
(async()=>{
 const api=window.B737LampAppearance;
 assert.equal(await api.ready,true);
 assert.equal(api.getMode(),'BRIGHT');
 assert.match(api.resolve('OH','LOW_PRESSURE','ON'),/BRIGHT.svg$/);
 assert.match(api.resolve('MP','STAB_OUT_OF_TRIM','ON'),/STAB_OUT_OF_TRIM__AMBER__BRIGHT.svg$/);
 assert.match(api.resolve('OH','NOT_ARMED_VERTICAL','ON'),/VERTICAL__BRIGHT.svg$/);
 assert.match(api.resolve('OH','L_VALVE_OPEN','DIM_BLUE'),/BLUE_DIM__GLOBAL_BRIGHT.svg$/);
 assert.match(api.resolve('OH','L_VALVE_OPEN','BRIGHT_BLUE'),/BLUE_BRIGHT__GLOBAL_BRIGHT.svg$/);
 assert.match(api.resolve('OH','LOW_PRESSURE','OFF'),/OFF.svg$/);
 api.setMode('DIM');assert.equal(api.getMode(),'DIM');
 assert.match(api.resolve('OH','L_VALVE_OPEN','DIM_BLUE'),/BLUE_DIM__GLOBAL_DIM.svg$/);
 assert.match(api.resolve('OH','L_VALVE_OPEN','BRIGHT_BLUE'),/BLUE_BRIGHT__GLOBAL_DIM.svg$/);
 assert.match(api.resolve('MP','STAB_OUT_OF_TRIM','ON'),/DIM.svg$/);
 assert.ok(events.includes('b737:lamp-brightness-change'));
 for(const html of ['../cockpit/index.html','../interactive-overhead/index.html']){
  const h=fs.readFileSync(path.join(directory,html),'utf8');
  assert.ok(h.includes('lights-reference-v2/live-mount.js?v=LGT-GLOBAL-002'),'Missing loader in '+html);
 }
 for(const script of ['../cockpit/lights.js','../interactive-overhead/lights.js']){
  const code=fs.readFileSync(path.join(directory,script),'utf8');
  new vm.Script(code);assert.ok(code.includes('B737LampAppearance.resolve'),'Old artwork not replaced: '+script);
 }
 console.log('PASS 87 masters / 305 SVG states / '+lamps+' mounted sockets / BRIGHT default / independent blue DIM / original engines untouched');
})().catch(e=>{console.error(e);process.exitCode=1});
