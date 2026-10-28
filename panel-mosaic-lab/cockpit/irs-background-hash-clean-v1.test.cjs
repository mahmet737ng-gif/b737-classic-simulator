'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const d=__dirname;
const code=fs.readFileSync(path.join(d,'irs-background-hash-clean-v1.js'),'utf8');
const html=fs.readFileSync(path.join(d,'index.html'),'utf8');
const locked=JSON.parse(fs.readFileSync(path.join(d,'irs-panel-registration-v1.json'),'utf8'));
const masks=[
 {x:452,y:337,w:13,h:16},{x:486,y:339,w:13,h:16},
 {x:492,y:360,w:21,h:13},{x:520,y:360,w:19,h:13}
];
test('approved original owner source is unchanged and only derived in memory',()=>{
 const data=fs.readFileSync(path.join(d,'assets',locked.asset));
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),locked.sha256);
 assert.deepEqual([data.readUInt32BE(16),data.readUInt32BE(20)],[1097,1434]);
 assert(code.includes('ctx.getImageData')&&code.includes('ctx.putImageData'));
 assert(code.includes('canvas')&&!code.includes('document.getElementById("irsSysDsplMounted")'));
 assert(code.includes("img.irs-registered-panel-body")&&code.includes('body.src=newURL'));
 assert(!/\.irs-msu-mini|\.irs-photo-key|irsSysDsplMounted|guard-owner18/.test(code));
});
test('renders four local repairs but leaves every external source pixel unchanged',()=>{
 const w=1097,h=1434;
 const base=new Uint8ClampedArray(w*h*4);
 const px=(x,y)=>(y*w+x)*4;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=px(x,y);base[i]=73+(y%7);base[i+1]=101+(y%9);base[i+2]=120+(x%5);base[i+3]=255;
 }
 for(const r of masks)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
  const i=px(x,y);base[i]=base[i+1]=base[i+2]=247;
 }
 const before=new Uint8ClampedArray(base);
 let output=null,updates=0;
 const body={complete:true,naturalWidth:w,naturalHeight:h,dataset:{},src:'./assets/irs-bare-panel-owner-v1.png',addEventListener(){}};
 const ctx={
  drawImage(){},
  getImageData(){return {data:base,width:w,height:h};},
  putImageData(data){output=data.data;updates++;}
 };
 const document={readyState:'complete',documentElement:{},querySelector:s=>s==='#irsBarePanelRegistered img.irs-registered-panel-body'?body:null,
  createElement:tag=>{
   assert.equal(tag,'canvas');
   return {width:0,height:0,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,TEST'};
  },addEventListener(){}};
 const listeners={};
 const window={addEventListener:(k,f)=>listeners[k]=f,console:{warn(){}}};
 vm.runInNewContext(code,{document,window,MutationObserver:class{observe(){throw Error('No observer needed')}}});
 const api=window.B737IRSBackgroundHashClean;
 assert.equal(api.status().installed,true);
 assert.equal(api.status().patched,4);assert.equal(body.dataset.irsLegacyHashesClean,'true');
 assert.equal(updates,1);
 for(const roi of masks){
  const x=roi.x+Math.floor(roi.w/2),y=roi.y+Math.floor(roi.h/2),i=px(x,y);
  assert(output[i]<150&&output[i+1]<160&&output[i+2]<180,'Legacy white dash not erased: '+roi.x);
 }
 for(const [x,y] of [[0,0],[1096,1433],[390,310],[470,370],[530,320],[500,410],[471,700]]){
  const i=px(x,y);
  assert.deepEqual([...output.slice(i,i+4)],[...before.slice(i,i+4)],'Outside masked ROI changed');
 }
 assert.equal(api.apply(),true);
 assert.equal(updates,1,'No repeated inpainting after repaint');
});
test('real Unified includes the cleanup after the panel registration without touching five generated ticks',()=>{
 const first=html.indexOf('irs-panel-registration-v1.js?v='),clean=html.indexOf('irs-background-hash-clean-v1.js?v=');
 assert(first>=0&&clean>first);
 assert(html.includes('irs-rotary-detent-indices-v1.js?v=IRS-INDEX-0001'));
 const photo=fs.readFileSync(path.join(d,'irs-rotary-detent-indices-v1.js'),'utf8');
 assert(photo.includes("setupUpper()")&&photo.includes("setupMsu()"));
 assert(photo.includes("tickFace('upper',angles)")&&photo.includes("tickFace('msu',MSU_ANGLES)"));
});
