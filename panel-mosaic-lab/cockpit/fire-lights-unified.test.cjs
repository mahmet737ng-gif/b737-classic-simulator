'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=__dirname,root=path.resolve(dir,'../..'), M=require('./fire-lights-model.js');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'fire-protection-lab/reference/unified-fire-approved-v6.json'),'utf8'));
const asm=JSON.parse(fs.readFileSync(path.join(dir,'assembly.json'),'utf8'));
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),js=fs.readFileSync(path.join(dir,'fire-lights-unified.js'),'utf8'),css=fs.readFileSync(path.join(dir,'fire-lights-unified.css'),'utf8');
let checked=0;function ok(value,why){checked++;assert.ok(value,why);}
const b=s=>M.region(s);
ok(M.validate(),'V6 11 lamp coordinate model');
ok(M.version==='FIRELAMP-0006'&&manifest.version===M.version,'Version and manifest match');
ok(M.SLOTS.length===11&&M.SLOTS.filter(x=>x.type==='rect').length===8&&M.SLOTS.filter(x=>x.type==='round').length===3,'Eight rectangle and three separate round lamps');
ok(M.BASE.width===2172&&M.BASE.height===724,'Natural pixel coordinate canvas');
const p=asm.regions.find(r=>r.id==='pedestal').placements.find(r=>r.id==='fire-protection');
ok(p.asset===manifest.panel.path,'Only the approved Fire bare panel referenced in Unified');
ok(p.presentation==='contain'&&p.w===685&&p.h===170.10287081339712,'Original native placement untouched');
ok(asm.assets[p.asset].url==='./assets/fire-v6/FIRE_PANEL_BARE.webp','Approved Fire webp URL is active');
const plate=path.join(root,p.asset);ok(fs.existsSync(plate),'New bare panel file physically present');
function webpFile(file){
 ok(fs.existsSync(file),'Missing image: '+file);
 const h=fs.readFileSync(file).subarray(0,12);
 ok(h.toString('ascii',0,4)==='RIFF'&&h.toString('ascii',8,12)==='WEBP','Malformed WebP file '+file);
}
webpFile(plate);
for(const lamp of M.SLOTS){
 const registered=manifest.indicators.find(s=>s.id===lamp.id),r=b(lamp);
 ok(!!registered,'Approved lamp slot '+lamp.id);
 ok([r.left,r.top,r.width,r.height].every((v,i)=>registered.bounds[i]===v),'Four corners match approved source '+lamp.id);
 ok(r.left>=0&&r.top>=0&&r.left+r.width<=2172&&r.top+r.height<=724,'Inside panel '+lamp.id);
 for(const state of [true,false]){
  const pathname=M.file(lamp,state);
  ok(pathname.endsWith(lamp.id+'_'+(state?'ON':'OFF')+'.webp'),'Individual ON/OFF crop filename '+lamp.id);
  webpFile(path.resolve(dir,pathname));
 }
 if(lamp.type==='round')ok(r.width>=70&&r.height>=70,'Green lens retains approved full-size face');
}
for(let i=0;i<M.SLOTS.length;i++)for(let j=i+1;j<M.SLOTS.length;j++){
 const a=b(M.SLOTS[i]),c=b(M.SLOTS[j]);
 ok(!(a.left<c.left+c.width&&c.left<a.left+a.width&&a.top<c.top+c.height&&c.top<a.top+a.height),'Physical lamp intersection '+M.SLOTS[i].id+' and '+M.SLOTS[j].id);
}
ok(M.map.L_BOTTLE_DISCHARGED.cy===M.map.R_BOTTLE_DISCHARGED.cy,'Horizontal bottle row');
ok(js.includes('fire-v6/FIRE_PANEL_BARE.webp'),'Base asset guard recognizes only approved V6');
ok(!js.includes('bottle-slots-horizontal-patch.svg'),'Old bottle background patch is no longer used');
ok(js.includes("const p=model.percent(slot)"),'Each ON/OFF asset mounted at own geometric coordinates');
ok(js.includes("const wanted=model.file(s,vals[s.id])"),'Independent per-lamp runtime state switching');
ok(css.includes('mix-blend-mode:normal;'),'Original photo-style crop not screen-blended into panel');
ok(!css.includes('mix-blend-mode:screen;'),'Legacy unnatural screen blending disabled');
for(const filename of ['fire-lights-model.js','fire-lights-unified.js','fire-lights-unified.css']){
 ok(html.includes(filename+'?v=FIRELAMP-0006'),'Cache-busted Unified V6 asset '+filename);
}
new vm.Script(js,{filename:'fire-lights-unified.js'});
console.log('PASS FIRELAMP-0006 '+checked+' checks: 1 new photographic bare panel and 22 individual ON/OFF image crops registered, zero intersections, no prior fire bottle patch.');
