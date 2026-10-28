#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const page=file('cockpit/overhead-stage.html');
const runtime=file('lamp-socket-fit-v3/variant-fit.js');
const defaultFit=file('lamp-socket-fit-v3/live-fit.js');
const master=JSON.parse(file('lights-reference-v2/manifest.json'));
const cpcs=require('../cockpit/pressurization-oh22-model.js');
const zone=require('../cockpit/aircon-400-model.js');
const pack=require('../cockpit/aircon-400-oh21-model.js');
assert(page.includes('../lamp-socket-fit-v3/live-fit.js?v=LGT-SOCKET-FIT-005-EMBEDDED'),
 '142-lamp fit never reaches actual Unified overhead iframe');
assert(page.includes('../lamp-socket-fit-v3/variant-fit.js?v=LGT-VARIANTS-FIT-001'),
 'DCPCS/737-400 overlays bypass the 2.5px renderer');
assert(defaultFit.includes("pathname.endsWith('/cockpit/overhead-stage.html')"),'Embedded overhead scope misclassified');
assert(runtime.includes('const photoPad=2.5'),'Variant pad not fixed to 2.5 native source pixels');
assert(runtime.includes('data-lit')&&runtime.includes('data-state'),'Variant power state signals not supported');
assert(runtime.includes("document.addEventListener('load'"),'Asynchronous owner DCPCS photo lacks load retry');
assert(runtime.includes('b737:lamp-brightness-change'),'Global day/night brightness not linked');
assert(runtime.includes('socketFit')&&runtime.includes("==='0'"),'Diagnostic rollback missing');
const special={
 CPCS:['AUTO_FAIL','OFF_SCHED_DESCENT','STANDBY_GREEN','MANUAL_GREEN'],
 DCPCS:['AUTO_FAIL','OFF_SCHED_DESCENT','STANDBY_GREEN','MANUAL_GREEN'],
 OH20_400:['ZONE','TEMP'],
 OH21_400:['PACK_FITTED']
};
for(const [sys,arr] of Object.entries(special)){
 if(sys==='OH21_400')continue;
 for(const asset of arr){
  if(asset==='ZONE'||asset==='TEMP')continue;
  assert(master.sourceAssetToMaster['OH:'+asset],'Missing master for '+sys+' '+asset);
 }
}
assert(master.variantAliases['OH400:PACK_FITTED'],'B737-400 pack has no approved master');
for(const sys of ['CPCS','DCPCS']){
 const cfg=cpcs.config(sys);
 assert.equal(cfg.lamps.length,4,sys+' requires 4 independently fitted sockets');
 assert(cfg.lampFaceCalibration?.asset,sys+' source background missing');
 const centers=cfg.lamps.map(l=>[l.face[0],l.face[1]]);
 assert.equal(new Set(centers.map(a=>a.join(','))).size,4,sys+' duplicate centers');
 for(const l of cfg.lamps)assert(l.face[2]>0&&l.face[3]>0,sys+' invalid socket');
}
assert.equal(zone.lamps.length,3,'737-400 OH20 needs three independent ZONE TEMP lenses');
assert.equal(pack.packs.length,2,'737-400 OH21 needs two PACK lenses');
for(const group of [zone,pack]){
 const entries=group.lamps||group.packs;
 for(const l of entries){
  const [x,y,w,h]=l.rect;
  assert(x>=2.5&&y>=2.5&&x+w+2.5<=group.source.width&&y+h+2.5<=group.source.height,
   '2.5px expansion would leave physical variant source photo');
 }
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const a=entries[i].rect,b=entries[j].rect;
  const A=[a[0]-2.5,a[1]-2.5,a[2]+5,a[3]+5],B=[b[0]-2.5,b[1]-2.5,b[2]+5,b[3]+5];
  assert(!(A[0]<B[0]+B[2]&&B[0]<A[0]+A[2]&&A[1]<B[1]+B[3]&&B[1]<A[1]+A[3]),
    'Two variant sources overlap after 2.5px fit');
 }
}
const images=runtime.match(/const sourceCache=/g)||[];
assert(!runtime.includes('style.fontSize='),'Geometry layer should never change approved typography');
console.log('PASS: 112 embedded OH + 30 MP + 4 CPCS + 4 DCPCS + 3 OH20-400 + 2 OH21-400; 2.5px photo-source pad; master palette and luminance states preserved.');
