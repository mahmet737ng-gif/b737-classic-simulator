'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const metrics=require('../cdu-24-column-metrics-v1.js');
const core=require('../../../cdu-standalone-v6/engine/cdu-engine.js');
const fitSource=fs.readFileSync(path.join(__dirname,'../../../panel-mosaic-lab/cockpit/cdu-screen-fit-v6.js'),'utf8');
const fixedStyle=()=>{const values={};return {values,setProperty:(k,v)=>{values[k]=v},removeProperty:k=>{delete values[k]}}};
const node=(text='',classes=[])=>{
 const style=fixedStyle(),set=new Set(classes);
 return {textContent:text,style,classList:{contains:k=>set.has(k)},
 getBoundingClientRect:()=>({width:set.has('full')?550:260,bottom:420}),
 querySelectorAll:()=>[],querySelector:()=>null};
};
function makeLine(classes,left='',right=''){
 const l=node(left,['fmc-left',...(classes.includes('scratch')?['full']:[])]),r=node(right,['fmc-right']);
 const root=node(left+right,classes.split(' '));
 root.querySelectorAll=sel=>sel==='span'?[l,r]:[];
 root.querySelector=sel=>sel.includes('.fmc-left')?l:null;
 root.children=[l,r];
 return root;
}
function fixture(seat='CAPT'){
 const ls=[makeLine('fmc-line fmc-header','ACT RTE','1/2')];
 for(let i=0;i<6;i++){
  ls.push(makeLine('fmc-line fmc-small fmc-pairline','ORIGIN','DEST'));
  ls.push(makeLine('fmc-line fmc-pairline','OIII','OIMM'));
 }
 ls.push(makeLine('fmc-line scratch fmc-pairline','A'.repeat(24)));
 let listener=null;
 const screen={getBoundingClientRect:()=>({bottom:510})};
 const scratch=ls[ls.length-1],small=ls[1];
 const box={
  querySelectorAll:sel=>sel==='.fmc-line'?ls:[],
  querySelector:sel=>sel==='.fmc-line.scratch'?scratch:sel.includes('.fmc-small')?small.children[0]:null,
  style:fixedStyle()
 };
 const ctx={font:'',measureText(text){return {width:(parseFloat(this.font.match(/\d+(?:\.\d+)?(?=px)/)[0])||0)*text.length*.25}}};
 const doc={getElementById:id=>id==='fmc-lines'?box:id==='fmc-screen'?screen:null,
  createElement:()=>({getContext:()=>ctx}),
  documentElement:{dataset:{}},fonts:{ready:new Promise(()=>{}),load:()=>new Promise(()=>{})}};
 const root={location:{search:'?seat='+seat},document:doc,
  getComputedStyle:elem=>({fontFamily:elem===small.children[0]?'BoeingCDUSmall':'BoeingCDULarge',
    top:elem.style.values.top||'450px'}),requestAnimationFrame:cb=>cb(),
  addEventListener(){}};
 class Query{constructor(x){this.value=x}get(k){return k==='seat'?seat:null}}
 vm.runInNewContext(fitSource,{window:root,URLSearchParams:Query,
  MutationObserver:class{constructor(fn){listener=fn}observe(){}}
 },{timeout:2000});
 return {root,ls,doc,ctx,box,listener:()=>listener()};
}
test('24 identical A glyphs fit the usable line, 25 cannot fit',()=>{
 const ctx={font:'',measureText(t){return {width:parseFloat(this.font.match(/\d+(?:\.\d+)?(?=px)/)[0])*.25*t.length}}};
 const result=metrics.calibrate(ctx,550,'BoeingCDULarge');
 assert.equal(result.columns,24);
 assert.equal(result.valid,true);
 assert.ok(result.width24Px<=result.availablePx);
 assert.ok(result.width25Px>result.availablePx);
 assert.equal(metrics.TEST.length,24);
 assert.equal(metrics.TOO_LONG.length,25);
});
test('Actual runtime computes scratchpad size from width, not hardcoded 54 or 92px',()=>{
 const f=fixture();const out=f.root.B737CduScreenFitV6.apply();
 assert.equal(out.ready,true);
 assert.equal(out.columns,24);
 assert.equal(out.large.valid,true);
 assert.ok(out.large.width24Px<=out.large.availablePx);
 assert.ok(out.large.width25Px>out.large.availablePx);
 assert.equal(f.ls[13].style.values['font-size'],out.fontSizePx+'px');
 assert.equal(f.doc.documentElement.dataset.cduScreenFit,'CDU-24COL-0006');
});
test('24-column scratchpad persists after page repaint while labels use Small face',()=>{
 const f=fixture('FO');const api=f.root.B737CduScreenFitV6;
 const first=api.apply();
 f.ls[13].children[0].textContent='A'.repeat(23);
 const next=api.apply();
 assert.equal(next.fontSizePx,first.fontSizePx);
 assert.equal(next.labelPx,first.labelPx);
 assert.equal(next.scratchLength,23);
 assert.ok(next.labelPx>0);
});
test('CDU source engine accepts A exactly 24 times and rejects 25th including +/- overflow',()=>{
 const st=core.makeState('IDENT');
 for(let i=0;i<24;i++)core.press(st,{},'CDU_CAPT_KEY_A');
 assert.equal(st.scratch,'A'.repeat(24));
 core.press(st,{},'CDU_CAPT_KEY_A');
 assert.equal(st.scratch.length,24);
 core.press(st,{},'CDU_CAPT_KEY_PLUS_MINUS');
 assert.equal(st.scratch.length,24);
 core.press(st,{},'CDU_CAPT_KEY_CLR');
 assert.equal(st.scratch.length,23);
 core.press(st,{},'CDU_CAPT_KEY_PLUS_MINUS');
 assert.equal(st.scratch.length,24);
});
