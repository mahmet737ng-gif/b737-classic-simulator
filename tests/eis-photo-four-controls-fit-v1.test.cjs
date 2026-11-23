'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const REG=require('../panel-mosaic-lab/cockpit/engine-photo-four-control-registration-v1.js');
const DB=require('../engine/instruments/engine-indication-technical-db-v1.json');
const REAL_PHOTO='panel-mosaic-lab/assets/locked/2026-10-23/B737_Engine_Standby_Instruments_Blank.png';

test('the four hole centers and assets are sourced from byte-verified untouched EIS photo',()=>{
 const original=fs.readFileSync(path.join(ROOT,REAL_PHOTO));
 const hash=crypto.createHash('sha256').update(original).digest('hex');
 assert.equal(hash,REG.source.sha256);
 assert.equal(hash,DB.physicalControlAtlas.sourcePhoto.sha256);
 assert.equal(original.readUInt32BE(16),REG.source.width);
 assert.equal(original.readUInt32BE(20),REG.source.height);
 assert.equal(REG.source.path,REAL_PHOTO);
 assert.equal(Object.keys(REG.controls).length,4);
 for(const [id,ref] of Object.entries(REG.controls)){
  const approved=DB.physicalControlAtlas.controls[id];
  assert.ok(approved,id+' missing from engine technical DB');
  assert.equal(approved.kind,ref.kind);
  assert.deepEqual(approved.sourceCenter,[ref.cx,ref.cy]);
  assert.equal(approved.sourceDiameter,ref.diameter);
  assert.ok(approved.asset.endsWith(ref.asset.replace('./assets/','/assets/')),
   id+' must use the approved existing asset');
  assert.ok(fs.existsSync(path.join(ROOT,approved.asset)),id+' asset missing');
 }
 assert.equal(REG.controls.N1_MANUAL_1.diameter,25,'match black inner hole, not outer marker');
 assert.equal(REG.controls.N1_MANUAL_2.diameter,25);
 assert.equal(REG.controls.FUEL_USED_PUSH.diameter,30);
 assert.equal(REG.controls.RESET_FUEL_USED.diameter,23);
 assert.notEqual(REG.controls.FUEL_USED_PUSH.diameter,
  REG.controls.RESET_FUEL_USED.diameter,'two photographed holes are not equal');
});

test('native photo registration is invariant under zoom/pan/resize and respects 0.5px alignment',()=>{
 for(const scale of [0.25,0.5,1,1.5,3,5,8]){
  const rect={w:461*scale,h:475.5578947368421*scale};
  for(const id of Object.keys(REG.controls)){
   const g=REG.fit(id,rect),def=REG.controls[id];
   assert.equal(g.cx,def.cx*rect.w/1235);
   assert.equal(g.cy,def.cy*rect.h/1274);
   const element={style:{},dataset:{}};
   REG.apply(element,id,rect);
   assert.equal(element.dataset.enginePhotoHole,id);
   assert.equal(parseFloat(element.style.left),g.leftPct);
   assert.equal(parseFloat(element.style.top),g.topPct);
   assert.equal(parseFloat(element.style.width),g.width);
   const fitted=REG.within(g,{left:g.cx-g.width/2,top:g.cy-g.height/2,
    width:g.width,height:g.height});
   assert.equal(fitted.pass,true,id+' at scale '+scale);
   assert.equal(REG.within(g,{left:g.cx-g.width/2+1,top:g.cy-g.height/2,
    width:g.width,height:g.height}).pass,false,'reject off center by 1px');
  }
 }
});

test('cockpit loads both hardware styles and shared photo registration before controllers',()=>{
 const html=file('panel-mosaic-lab/cockpit/index.html');
 for(const name of ['manual-n1-live-v1.css','fuel-used-physical-ch7-v1.css',
  'engine-photo-four-control-registration-v1.js','manual-n1-live-v1.js',
  'fuel-used-physical-ch7-v1.js'])assert.match(html,new RegExp(name.replace(/\./g,'\\.')));
 assert.ok(html.indexOf('engine-photo-four-control-registration-v1.js')<
  html.indexOf('manual-n1-live-v1.js'));
 assert.ok(html.indexOf('engine-photo-four-control-registration-v1.js')<
  html.indexOf('fuel-used-physical-ch7-v1.js'));
 const n1css=file('panel-mosaic-lab/cockpit/manual-n1-live-v1.css');
 const fuelcss=file('panel-mosaic-lab/cockpit/fuel-used-physical-ch7-v1.css');
 assert.match(n1css,/min-width:0!important/);
 assert.match(n1css,/manual-n1-knob-label/);
 assert.match(fuelcss,/recessed-pushbutton-v2\.svg/);
 assert.match(fuelcss,/translate\(-50%,-50%\)/);
 assert.match(fuelcss,/min-width:0!important/);
});

test('existing four UI owner elements mount exactly once, stay interactive and EIS aligned',()=>{
 const handlers={};
 const nodes=[];
 const mk=(tag)=>{
  const n={tag,style:{},dataset:{},children:[],listeners:{},parentNode:null,
   setAttribute(k,v){this[k]=v},
   appendChild(child){child.parentNode=this;this.children.push(child);return child},
   addEventListener(ev,fn){(this.listeners[ev]??=[]).push(fn)},
   trigger(type,e={}){for(const fn of this.listeners[type]||[])
    fn({preventDefault(){},stopPropagation(){},button:0,...e})},
   setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:10,height:10}}
  };
  nodes.push(n);return n;
 };
 const native=mk('region-native');
 const piece=mk('texture-piece');
 Object.assign(piece.style,{left:'761px',top:'127px',width:'461px',height:'475.5578947368421px'});
 native.querySelector=sel=>sel.includes('data-piece="engine"')?piece:null;
 const document={readyState:'complete',documentElement:{dataset:{engineIndication:'EIS'}},
  querySelector:sel=>sel.includes('#region-main .region-native')?native:null,
  createElement:mk,getElementById:id=>nodes.find(n=>n.id===id)||null,
  addEventListener(){}};
 const commands=[];
 const window={document,console,
  B737EnginePhotoControlRegistrationV1:REG,
  B737EngineIndicationModeV1:{layout:()=>({x:761,y:127,w:461,h:475.5578947368421})},
  B737UnifiedEngineIndicationsV2:{
   command:cmd=>{commands.push(cmd);return {ok:true}},
   getState:()=>({snapshot:{fuelUsedKg:{engine1:120,engine2:140}}})
  },
  addEventListener:(ev,fn)=>{(handlers[ev]??=[]).push(fn)}};
 vm.runInNewContext(file('panel-mosaic-lab/cockpit/manual-n1-live-v1.js'),
  {window,document,console},{timeout:2000});
 vm.runInNewContext(file('panel-mosaic-lab/cockpit/fuel-used-physical-ch7-v1.js'),
  {window,document,console},{timeout:2000});
 assert.equal(window.B737ManualN1LiveV1.getState().mode,'EIS');
 assert.equal(window.B737FuelUsedPhysicalCh7V1.getStatus().mode,'EIS');
 const controls={
  N1_MANUAL_1:nodes.find(n=>n.dataset.enginePhotoHole==='N1_MANUAL_1'),
  N1_MANUAL_2:nodes.find(n=>n.dataset.enginePhotoHole==='N1_MANUAL_2'),
  FUEL_USED_PUSH:nodes.find(n=>n.id==='fuelUsedEisShow'),
  RESET_FUEL_USED:nodes.find(n=>n.id==='fuelUsedEisReset')
 };
 assert.equal(new Set(Object.values(controls)).size,4,'must use four separate hardware owners');
 for(const [id,node] of Object.entries(controls)){
  assert.ok(node,'missing '+id);
  const geo=REG.fit(id,{w:461,h:475.5578947368421});
  assert.equal(parseFloat(node.style.width),geo.width);
  assert.equal(parseFloat(node.style.height),geo.height);
  assert.equal(parseFloat(node.style.left),geo.leftPct);
  assert.equal(parseFloat(node.style.top),geo.topPct);
 }
 for(const id of ['FUEL_USED_PUSH','RESET_FUEL_USED'])
  assert.match(controls[id].style.backgroundImage,/recessed-pushbutton-v2\.svg/);
 controls.FUEL_USED_PUSH.trigger('click');
 assert.equal(commands.at(-1).type,'FUEL_MODE');
 assert.equal(commands.at(-1).value,'USED');
 controls.RESET_FUEL_USED.trigger('click');
 assert.equal(commands.at(-1).type,'RESET_FUEL_USED');
 controls.N1_MANUAL_1.trigger('click');
 assert.equal(window.B737ManualN1LiveV1.getState()[1].pulled,true);
 assert.equal(window.B737ManualN1LiveV1.getState()[2].pulled,false);
 controls.N1_MANUAL_2.trigger('wheel',{deltaY:-30});
 assert.equal(window.B737ManualN1LiveV1.getState()[2].pulled,true);
 const n=nodes.length;
 window.B737ManualN1LiveV1.refresh();
 window.B737FuelUsedPhysicalCh7V1.mount();
 assert.equal(nodes.length,n,'no duplicated button nodes or listeners on remount');
 assert.equal(window.B737FuelUsedPhysicalCh7V1.getStatus().mounts,2);
});
