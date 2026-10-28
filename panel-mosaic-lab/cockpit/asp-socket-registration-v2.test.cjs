'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const reg=require('./asp-socket-registration-v2.js'),model=require('./asp-controls-model-v1.js');
const read=s=>fs.readFileSync(path.join(__dirname,s),'utf8');
test('independently extract all 20 source-photo apertures in CAPT/FO and OBS',()=>{
 for(const file of ['assets/asp-bare-pedestal-v3.svg','assets/asp-bare-aft-overhead-v3.svg']){
  const sockets=reg.extract(read(file)),matched=reg.compareSockets(model.sockets,sockets);
  assert.equal(sockets.length,20);assert.equal(matched.length,20);
  assert.equal(new Set(matched.map(s=>s.kind+':'+s.channel)).size,20);
  assert.equal(sockets.filter(s=>s.kind==='mic').length,7);
  assert.equal(sockets.filter(s=>s.kind==='volume').length,13);
  for(let i=0;i<7;i++)assert.deepEqual({x:matched[i].x,y:matched[i].y,w:matched[i].w,h:matched[i].h},
   {x:115+150*i,y:166,w:100,h:104});
  for(let i=7;i<14;i++)assert.equal(matched[i].x,115+150*(i-7));
  for(let i=14;i<20;i++)assert.equal(matched[i].x,180+155*(i-14));
  for(let i=7;i<20;i++)assert.equal(matched[i].w,90,'Volume socket radius 45 source px');
 }
});
test('source bitmap alpha, rather than 1254x1254 canvas center, determines knob pivot',()=>{
 const w=130,h=120,raw=new Uint8ClampedArray(w*h*4);
 // Deliberately OFF-CENTER subject: rectangle from x10..39 and y15..94
 for(let y=15;y<=94;y++)for(let x=10;x<=39;x++){const i=(y*w+x)*4;raw[i]=225;raw[i+1]=155;raw[i+2]=125;raw[i+3]=255;}
 const m=reg.mask({width:w,height:h,data:raw});
 assert(Math.abs(m.cx-24)<2);assert(Math.abs(m.cy-54)<2);
 assert(Math.abs(m.cx-w/2)>35,'Test subject must NOT be centered on PNG canvas');
 const slot={kind:'mic',channel:'VHF-1',x:115,y:166,w:100,h:104};
 for(const [hostW,hostH] of [[1122,888],[375,297],[480,345],[483,316],[1400,900]]){
  const fit=reg.fit(slot,m,hostW,hostH,'mic');
  const nominalX=slot.x*hostW/1122,nominalY=slot.y*hostH/888;
  const paintedX=nominalX-fit.hitW/2+fit.left+m.cx*fit.scale;
  const paintedY=nominalY-fit.hitH/2+fit.top+m.cy*fit.scale;
  assert(Math.abs(paintedX-nominalX)<1e-9,'Horizontal mismatch at '+hostW+'x'+hostH);
  assert(Math.abs(paintedY-nominalY)<1e-9,'Vertical mismatch at '+hostW+'x'+hostH);
  assert(Math.abs(fit.visibleW/fit.visibleH-m.w/m.h)<1e-10,'Do not distort photography');
 }
});
test('volume knobs remain round for non-uniform aft overhead CSS scaling and pivot stays exact',()=>{
 const dim=90,bytes=new Uint8ClampedArray(dim*dim*4);
 for(let y=0;y<dim;y++)for(let x=0;x<dim;x++){
  if((x-29)**2+(y-43)**2<=24**2){let i=(y*dim+x)*4;bytes[i+3]=255;}
 }
 const m=reg.mask({width:dim,height:dim,data:bytes}),slot={x:180,y:571,w:90,h:90};
 for(const [w,h] of [[400,400],[480,317],[375,297],[1122,888]]){
  const b=reg.fit(slot,m,w,h,'volume');
  assert.equal(b.hitW,b.hitH);
  assert(Math.abs(b.visibleW-b.visibleH)<2,'Round volume case');
  assert(Math.abs(b.left+m.cx*b.scale-b.hitW/2)<1e-8);
  assert(Math.abs(b.top+m.cy*b.scale-b.hitH/2)<1e-8);
 }
});
test('renderer uses off/on independent optical silhouettes; original user sprites remain byte-identical',()=>{
 const script=read('asp-controls-v1.js'),html=read('index.html'),manifest=JSON.parse(read('asp-controls-v1.json'));
 assert(script.includes('getImageData')&&script.includes('registrar.mask')&&script.includes('registrar.fit'));
 assert(script.includes("ASSETS[kind][img.classList.contains('asp-image-on')?1:0]"));
 assert(script.includes('registeredSocket(host,b)'));
 assert(script.includes('calibrateObserverHost(host)'));
 assert(script.includes("host.dataset.seat==='OBS'"));
 assert(script.includes('faceViewport.point(slot.x,slot.y)'),'OBS/CPT/FO must use the painted SVG viewport');
 assert(script.includes('obsLiveMasks.get(name)'),'OBS visible photo center must work even if global fetch fails');
 assert(html.includes('asp-socket-registration-v2.js?v=ASP-CENTER-0002'));
 assert(html.includes('asp-controls-v1.js?v=ASP-OBS-CENTER-0004'));
 assert(read('overhead-stage.html').includes('asp-controls-v1.js?v=ASP-OBS-CENTER-0004'));
 assert(read('overhead-stage.html').includes('asp-observer-overhead-v3.js?v=ASP-OBS-IFRAME-0005-FACE'));
 assert(html.includes('app.js?v=CKP-0014-AIRCON400-ZONE-LEDEV-STAGED-V1-ASP-OBS-CENTER-0005-FACE'));
 const observer=read('asp-observer-overhead-v3.js');
 assert(observer.includes("position:'absolute',inset:'0',left:'0px',top:'0px'"),'OBS panel SVG must start at native photo origin');
 assert(observer.includes('photoOffsetCssPx')&&observer.includes('maxErrorCssPx'),'OBS requires strict 20-socket visual fit audit');
 assert(!script.includes('sourceCtx.drawImage')&&!script.includes('getImageData(0,0,1,1)'));
 const crypto=require('node:crypto');
 for(const [name,m]of Object.entries(manifest.assets)){
  const buf=fs.readFileSync(path.join(__dirname,'assets/asp-controls-v1',name));
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),m.sha256);
 }
});

test('SVG meet aspect ratio registration centers all 60 photo sockets and 9 physical controls with no ad hoc shift',()=>{
 const dims=[[1122,888],[480,345],[483,316],[375,297],[600,360],[379*2214/1731,283*1019/909],[400,400],[900,500]];
 for(const [w,h] of dims){
  const frame=reg.viewport(w,h);
  assert(Math.abs(frame.padX*2+1122*frame.scale-w)<1e-10);
  assert(Math.abs(frame.padY*2+888*frame.scale-h)<1e-10);
  for(const s of model.sockets){const p=frame.point(s.x,s.y);
   assert(Math.abs((p.x-frame.padX)/frame.scale-s.x)<1e-9);
   assert(Math.abs((p.y-frame.padY)/frame.scale-s.y)<1e-9);
  }
  for(const x of [145,410,980]){const p=frame.point(x,747);
   assert(Math.abs(p.x-(frame.padX+x*frame.scale))<1e-10);
   assert(Math.abs(p.y-(frame.padY+747*frame.scale))<1e-10);
  }
 }
 const view=reg.viewport(600,360);
 assert(view.padX>0,'wide physical ASP must have equal horizontal letterboxing');
 assert.notEqual(view.point(115,166).x,115/1122*600,'stretch arithmetic must not be used');
 const a=read('asp-controls-v1.js'),b=read('asp-physical-controls-v1.js');
 assert(a.includes('faceViewport.point(slot.x,slot.y)'));
 assert(b.includes('frame.point(slot.x,slot.y)'));
 assert(a.includes("preserveAspectRatio','xMidYMid meet"));
});
