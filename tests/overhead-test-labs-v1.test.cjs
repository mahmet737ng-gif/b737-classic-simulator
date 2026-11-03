'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'../panel-mosaic-lab/cockpit');
const gesture=require(path.join(ROOT,'overhead-test-labs-gesture-v1.js'));
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'overhead-test-labs-catalog-v1.json'),'utf8'));
const runtime=fs.readFileSync(path.join(ROOT,'overhead-test-labs-v1.js'),'utf8');
test('Each physical B737 Classic overhead region has a unique independent lab catalog',()=>{
 assert.equal(catalog.schema,'B737_CLASSIC_OVERHEAD_LABS_CATALOG_V1');
 assert.equal(catalog.panels.length,26);
 const seen=new Set();
 for(const p of catalog.panels){
  assert.ok(!seen.has(p.id),p.id+' duplicated');seen.add(p.id);
  assert.ok(p.region.w>0&&p.region.h>0,p.id+' missing atlas extent');
  assert.ok(p.components.length>0,p.id+' missing physical/system catalog');
  const ids=new Set();
  for(const c of p.components){
   assert.ok(c.kind&&c.id&&c.label,p.id+' incomplete item');
   assert.ok(!ids.has(c.id),p.id+' duplicated component');ids.add(c.id);
  }
 }
 for(const key of ['OH01','OH02','OH03','OH04','OH05','OH06','OH15','OH16','OH20','OH21','OH22','OH23','OH24','OH25']){
  assert.ok(seen.has(key),key+' unavailable');
 }
 assert.ok(catalog.panels.some(p=>p.region.provisional),'source upper/bottom geometry is described as provisional');
});
test('Same-spot validator tolerates <=12 px; 3 spatially separated taps never launch',()=>{
 let s=gesture.blank();
 s=gesture.advance(s,{valid:true,region:'OH16',x:100,y:100,at:1000});
 s=gesture.advance(s,{valid:true,region:'OH16',x:106,y:100,at:1200});
 assert.equal(s.fire,false);
 s=gesture.advance(s,{valid:true,region:'OH16',x:110,y:104,at:1400});
 assert.equal(s.fire,true);
 s=gesture.blank();
 for(const [x,t]of [[100,1000],[150,1200],[100,1400]])s=gesture.advance(s,{valid:true,region:'OH16',x,y:100,at:t});
 assert.equal(s.fire,false);
});
test('Any control click, any other panel, timeout or moving press breaks the sequence',()=>{
 let s=gesture.blank();
 s=gesture.advance(s,{valid:true,region:'OH15',x:100,y:100,at:1000});
 s=gesture.advance(s,{valid:true,region:'OH15',x:101,y:100,at:1200});
 s=gesture.advance(s,{valid:false,region:'OH15',x:101,y:100,at:1400});
 assert.equal(s.count,0);
 s=gesture.advance(s,{valid:true,region:'OH15',x:100,y:100,at:1500});
 assert.equal(s.count,1);
 s=gesture.advance(s,{valid:true,region:'OH16',x:100,y:100,at:1600});
 assert.equal(s.count,1);
 s=gesture.advance(s,{valid:true,region:'OH16',x:100,y:100,at:2500});
 assert.equal(s.count,1);
 assert.equal(gesture.shortStationary({id:1,x:100,y:100,at:100,region:'OH15',valid:true},{id:1,x:122,y:100,at:120,region:'OH15',valid:true}),false);
 assert.equal(gesture.shortStationary({id:1,x:100,y:100,at:100,region:'OH15',valid:true},{id:1,x:100,y:100,at:550,region:'OH15',valid:true}),false);
});
test('Clickable native controls and annunciator glass are excluded from the hit area',()=>{
 assert.equal(gesture.isInteractive({closest:selector=>selector.includes('.mounted-toggle')?{}:null}),true);
 assert.equal(gesture.isInteractive({closest:selector=>selector.includes('[data-light]')?{}:null}),true);
 assert.equal(gesture.isInteractive({closest:selector=>selector.includes('.owner18-guard')?{}:null}),true);
 assert.equal(gesture.isInteractive({closest:()=>null}),false);
});
function setupLiveGesture(){
 let now=1000,opened=0,sourceReady=true,isSwitch=false;
 const tile={
  dataset:{key:'OH15'},
  closest(sel){return sel.includes('.atlas-piece')?this:null;},
  getBoundingClientRect(){return {left:100,top:100,right:593,bottom:608,width:493,height:508};}
 };
 const button={
  closest(sel){return sel.includes('button')?this:null;}
 };
 const listeners={},frameListeners={};
 const doc={
  addEventListener(t,cb){listeners[t]=cb;},
  elementFromPoint(){return isSwitch?button:tile;},
  querySelectorAll(sel){return sel.includes('.atlas-piece')?[tile]:[];}
 };
 const frame={contentDocument:doc,getAttribute:()=> './overhead-stage.html',addEventListener(t,cb){frameListeners[t]=cb;}};
 const document={readyState:'complete',baseURI:'https://example.test/panel-mosaic-lab/cockpit/',
  getElementById:id=>id==='overheadFrame'?frame:null};
 const window={B737OverheadLabGestureV1:gesture,B737AntiIceTestLabV2:{open(){opened++;}},
  addEventListener(){},innerHeight:800};
 const script={window,document,fetch:async()=>({ok:true,json:async()=>catalog}),
  setInterval:()=>1,performance:{now:()=>now},console,URL};
 vm.runInNewContext(runtime,script,{filename:'overhead-test-labs-v1.js'});
 const tap=(x=250,y=300,sw=false)=>{
  isSwitch=sw;
  const target=sw?button:tile,base={pointerType:'mouse',pointerId:1,isPrimary:true,button:0,target,clientX:x,clientY:y};
  listeners.pointerdown({...base});now+=40;listeners.pointerup({...base});now+=140;
 };
 return {tap,initialized:async()=>{for(let i=0;i<5;i++)await Promise.resolve();return !!window.B737OverheadTestLabsV1;},
  opens:()=>opened,available:()=>window.B737OverheadTestLabsV1?.panels()};
}
test('Unified integration: three real switch operations NEVER launch OH15 lab',async()=>{
 const f=setupLiveGesture();assert.ok(await f.initialized());
 f.tap(250,300,true);f.tap(250,300,true);f.tap(250,300,true);
 assert.equal(f.opens(),0);
 f.tap(250,300,false);f.tap(250,300,false);f.tap(250,300,false);
 assert.equal(f.opens(),1,'three background taps in same place launch only once');
 f.tap(250,300,false);f.tap(250,300,false);f.tap(250,300,true);f.tap(250,300,false);
 assert.equal(f.opens(),1,'a control click must erase the partial sequence');
});
test('Unified integration: three different blank points do not launch; changing back to same point works',async()=>{
 const f=setupLiveGesture();assert.ok(await f.initialized());
 f.tap(250,300);f.tap(330,300);f.tap(400,300);
 assert.equal(f.opens(),0);
 f.tap(250,300);f.tap(252,301);f.tap(253,302);
 assert.equal(f.opens(),1);
 assert.equal(f.available().length,26);
});
test('The dispatcher and original OH15 lab are loaded without mutating locked photo assets',()=>{
 const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 const anti=fs.readFileSync(path.join(ROOT,'antiice-live-test-lab-v2.js'),'utf8');
 assert.ok(index.includes('overhead-test-labs-gesture-v1.js'));
 assert.ok(index.includes('overhead-test-labs-v1.js'));
 assert.ok(!anti.includes('function boot(){installTripleTap();}'),'old OH15 tile-wide tap binding must remain inactive');
 assert.ok(runtime.includes('G.isInteractive(e.target)'));
 assert.ok(runtime.includes('B737AntiIceTestLabV2.open()'));
});
