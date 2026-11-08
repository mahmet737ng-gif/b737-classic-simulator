'use strict';
/* Four-way visual transform regression:
 * CAPT/FO × EIS/CONVENTIONAL must each render an ADI picture that is exactly
 * 85% of its prior dimensions, about the unchanged zero-pitch horizon.
 * CRT bezel dimensions, frozen EIS mounts and future canvas drawing hooks
 * must NOT inherit the content-only scale.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'eadi-stage1-unified-v1.js'),'utf8');
const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'eis-main-final-layout-v1.json'),'utf8'));
assert.match(src,/const ADI_CONTENT_SCALE=0\.85;/);
assert.match(src,/c\.clearRect\(0,0,WIDTH,HEIGHT\);c\.fillStyle='#000000';c\.fillRect\(0,0,WIDTH,HEIGHT\);/,
 'ADI surrounding canvas must be pure black, matching FMA');
assert.ok(!src.includes("background:'#080b12'"),
 'No graphite CRT host background permitted');

assert.match(src,/c\.translate\(452,393\);\s*c\.scale\(ADI_CONTENT_SCALE,ADI_CONTENT_SCALE\);\s*c\.translate\(-452,-393\);/);
const handlers=new Map();
const crt={
 x:1631.430793157076,y:234.26283048211508,
 w:194.76671850699844,h:158.0715396578538
};
function makeContext(){
 const state={ops:[]};
 const ctx=new Proxy(state,{get(t,k){
  if(k==='ops')return t.ops;
  if(k==='createLinearGradient')return()=>({addColorStop(){}});
  if(k==='scale'||k==='translate')return(...args)=>t.ops.push([k,...args]);
  if(Object.hasOwn(t,k))return t[k];
  return()=>{};
 }});
 return ctx;
}
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.isConnected=true;
  if(tag==='canvas')this.context=makeContext();}
 appendChild(n){this.children.push(n);n.parentElement=this;n.isConnected=true;return n;}
 querySelector(selector){
  if(selector==='canvas')return this.children.find(n=>n.tag==='canvas')||null;
  const seat=selector.match(/\[data-eadi-stage1-seat="(CAPT|FO)"\]/)?.[1];
  if(seat)return this.children.find(n=>n.dataset.eadiStage1Seat===seat)||null;
  return null;
 }
 setAttribute(){}
 getContext(){return this.context;}
}
const native=new Element('div');
const doc={
 readyState:'complete',documentElement:{dataset:{engineIndication:'EIS'}},
 createElement:tag=>new Element(tag),
 querySelector:q=>q==='#region-main .region-native'?native:null,
 addEventListener:()=>{}
};
const win={
 document:doc,
 B737ConventionalEadiSocketV1:{VERSION:'CONV-FO-EADI-SOCKET-0001',
  nativeRect:crt,cornerRadius:'10% / 11%'},
 addEventListener(name,fn){handlers.set(name,fn);}
};
vm.runInNewContext(src,{window:win,document:doc,console},{filename:'eadi-stage1-unified-v1.js'});
const api=win.B737UnifiedEADIStage1;
assert.equal(api.adiContentScale,.85);
let paintCount=0;
function check(mode){
 paintCount++;
 doc.documentElement.dataset.engineIndication=mode;
 handlers.get('b737:engine-indication-view')();
 const snap=api.snapshot();
 assert.equal(snap.mode,mode);
 assert.equal(snap.adiContentScale,.85);
 for(const seat of ['CAPT','FO']){
  const host=native.querySelector('[data-eadi-stage1-seat="'+seat+'"]');
  assert.ok(host,mode+' '+seat+' host mounted');
  assert.equal(host.dataset.eadiMode,mode);
  assert.equal(host.style.background,'#000000',mode+' '+seat+' CRT surround must be black');
  const ops=host.querySelector('canvas').context.ops;
  const shrinks=ops.filter(x=>x[0]==='scale'&&x[1]===.85&&x[2]===.85);
  assert.equal(shrinks.length,paintCount,
   mode+' '+seat+' ADI should shrink once per paint');
  const s=shrinks.at(-1),i=ops.lastIndexOf(s);
  assert.deepEqual(ops[i-1],['translate',452,393]);
  assert.deepEqual(ops[i+1],['translate',-452,-393]);
  const expected=seat==='FO'&&mode==='CONVENTIONAL'
   ?crt:frozen.eadi.stations[seat];
  for(const key of ['x','y','w','h']){
   const cssKey={x:'left',y:'top',w:'width',h:'height'}[key];
   assert.equal(parseFloat(host.style[cssKey]),expected[key],
    mode+' '+seat+' EADI glass '+key+' MUST NOT resize');
  }
 }
}
check('EIS');
check('CONVENTIONAL');
check('EIS');
assert.equal(api.snapshot().stations.CAPT.x,frozen.eadi.stations.CAPT.x);
assert.equal(api.snapshot().stations.FO.y,frozen.eadi.stations.FO.y);
console.log('PASS: ADI artwork ×0.85 in Captain/FO for EIS/Conventional; center and EIS glass geometry unchanged.');
