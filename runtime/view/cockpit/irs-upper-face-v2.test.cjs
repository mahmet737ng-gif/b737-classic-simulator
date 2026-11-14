'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const read=x=>fs.readFileSync(path.join(__dirname,x),'utf8');
const base=__dirname;
const html=read('index.html'),js=read('irs-upper-face-v2.js'),css=read('irs-upper-face-v2.css');
const svg=read('assets/irs-upper-mode-labels-v2.svg');
const upperCss=read('irs-dspl-sel-upper-v1.css');
const photoNames=['irs-upper-old-text-clean-v2.avif','irs-upper-outer-photo-v2.avif','irs-upper-inner-photo-v2.avif'];
for(const file of photoNames){
 const abs=path.join(base,'assets',file);
 const data=fs.readFileSync(abs);
 assert(data.length>1500,'Photographic asset is not fully present: '+file);
 assert.equal(data.toString('ascii',4,12),'ftypavif','Bad AVIF photo header: '+file);
 const probe=cp.spawnSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',abs],{encoding:'utf8'});
 if(!probe.error){
   assert.equal(probe.status,0,'Invalid / undecodable AVIF '+file+' '+probe.stderr);
   const meta=JSON.parse(probe.stdout);
   assert(meta.streams.some(s=>s.width>0&&s.height>0),'Invalid AVIF dimensions '+file);
 }
}
assert(html.includes('irs-upper-face-v2.js?v=IRS-UPPER-PHOTO-0002'));
assert(html.includes('irs-upper-face-v2.css?v=IRS-AMBER-0001'));
assert.match(js,/const ROI=Object\.freeze\(\{x:396,y:310,width:168,height:70\}\)/);
assert.match(js,/w:2214,h:1019,sourceW:1731,sourceH:909/);
assert.match(js,/irs-upper-old-text-clean-v2\.avif/);
assert.match(js,/irs-upper-mode-labels-v2\.svg/);
assert.match(css,/z-index:127/);
assert.match(upperCss,/z-index:128/);
assert.match(css,/pointer-events:none/);
assert(!js.includes('irsSysDsplMounted'),'Frozen LOWER selector must not be touched');
assert(!/b737:irs-sys-dspl|setSystem/.test(js));
for(const label of ['TEST','TK/GS','PPOS','WIND','HDG/STS']){
 assert(svg.includes('>'+label+'</text>'),'Missing one of five owner specified mode labels: '+label);
}
assert.match(svg,/viewBox="396 310 168 70"/);
assert(!svg.includes('>DSPL SEL</text>'),'Frozen original printed heading must remain');
const lock=JSON.parse(read('irs-sys-dspl-owner-lock-v1.json'));
for(const mount of lock.indexMounts)assert.equal(html.split(mount).length-1,1);
const listeners={};
const region={
  children:[],
  querySelector(selector){return this.children.find(x=>selector==='#irsUpperFaceV2'&&x.id==='irsUpperFaceV2')||null;},
  append(x){this.children.push(x);}
};
const doc={
 readyState:'loading',documentElement:{},getElementById(id){return id==='region-overhead'?region:null;},
 addEventListener(name,fn){listeners[name]=fn;},
 createElement(tag){return {tag,style:{},children:[],dataset:{},append(child){this.children.push(child);},setAttribute(){}};}
};
const win={addEventListener(){}};
vm.runInNewContext(js,{window:win,document:doc,MutationObserver:class{}},{timeout:1000});
listeners.DOMContentLoaded();
assert.equal(region.children.length,1);
const layer=region.children[0];
assert.equal(layer.id,'irsUpperFaceV2');
assert.equal(layer.children.length,2);
assert.equal(layer.children[0].src,'./assets/irs-upper-old-text-clean-v2.avif');
assert.equal(layer.children[1].src,'./assets/irs-upper-mode-labels-v2.svg');
const left=3+396*2214/1731,top=3+310*1019/909;
assert(Math.abs(parseFloat(layer.style.left)-left)<.02);
assert(Math.abs(parseFloat(layer.style.top)-top)<.02);
win.B737IRSUpperFace.install();
assert.equal(region.children.length,1);
const original=fs.readFileSync(path.join(base,'../assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png'));
assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'9d8ac0ac86bdb92c040e9bdd97811ca381535d949bff94aa5b1a01e5de8e23df');
console.log('PASS IRS UPPER PHOTO V2: photographic double knob, five clean labels, frozen lower and heading, all source geometry.');
