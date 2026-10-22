'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const m=JSON.parse(fs.readFileSync(path.join(root,'data/cdu-map.json'),'utf8'));
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const script=fs.readFileSync(path.join(root,'app.js'),'utf8');
const src=fs.readFileSync(path.join(root,m.artwork));
assert.equal(crypto.createHash('sha256').update(src).digest('hex'),m.artwork_sha256,'approved image changed');
assert.equal(m.controls.length,70);assert.equal(m.outputs.length,5);
for(const c of m.controls){const [x1,y1,x2,y2]=c.bbox_px;assert(x1>0 && y1>0 && x2<=1199 && y2<=1312 && x1<x2 && y1<y2,'invalid bbox '+c.id);}
for(let i=1;i<=6;i++){
 const l=m.controls.find(c=>c.id==='CDU_CAPT_LSK_L'+i).bbox_px;
 const r=m.controls.find(c=>c.id==='CDU_CAPT_LSK_R'+i).bbox_px;
 assert(l[0]>=149 && l[2]<=208,'left LSK face geometry');
 assert(r[0]>=886 && r[2]<=949,'right LSK face geometry');
 assert(Math.abs((l[1]+l[3])/2-(r[1]+r[3])/2)<1,'LSK not aligned');
}
for(const key of 'EJOTY')assert(m.controls.find(c=>c.id==='CDU_CAPT_KEY_'+key).bbox_px[0]>=813,'right alphabet column needs face calibration');
for(const key of ['SP','DEL','SLASH','CLR'])assert(m.controls.find(c=>c.id==='CDU_CAPT_KEY_'+key).bbox_px[1]>=1143,'bottom key row shifted above face');
for(const a of m.outputs.filter(c=>c.label!=='EXEC'))assert(fs.existsSync(path.join(root,a.illuminated_sprite)),'missing backlight mask '+a.label);
assert(m.outputs.find(c=>c.label==='EXEC').sprite_bbox_px[1]>=705,'EXEC overlay does not cover baked lit slot');
assert(css.includes('opacity:1!important'),'opaque black panel must never dim');
assert(script.includes("$('fmc-lines').style.opacity=sim.brightness"),'brightness must apply only to character overlay');
assert(!script.includes("$('fmc-screen').style.opacity=sim.brightness"),'original text would bleed through');
assert(css.includes('Lucida Console'),'FMC font fallback missing');
assert(script.includes('const mask=document.createElement'), 'source backlit letter masks missing');
console.log('PASS v2: original image SHA; R+L LSK calibration; alpha/edit key centers; full 70 bounds; on-text assets; EXEC source slot coverage; fully opaque page mask; font stack.');