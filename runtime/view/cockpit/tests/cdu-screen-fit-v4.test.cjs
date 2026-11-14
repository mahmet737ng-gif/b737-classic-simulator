'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../cdu-screen-fit-v4.js'),'utf8');
function line(kind,first='',second=''){
 const cls=new Set(kind.split(' '));
 const s1=span(first,'fmc-left'),s2=span(second,'fmc-right');
 return {
  classList:{contains:x=>cls.has(x)},style:style(),
  querySelectorAll:selector=>selector==='span'?[s1,s2]:[],
  textContent:[first,second].join(' '),
  getBoundingClientRect:()=>({width:550}),
  spans:[s1,s2]
 };
}
function style(){const data={};return {
  data,setProperty:(k,v)=>{data[k]=v},removeProperty:k=>{delete data[k]}
 };}
function span(value,clazz){
 const s=style();
 return {textContent:value,classList:{contains:k=>k===clazz},
  style:s,getBoundingClientRect:()=>({width:260})};
}
function fixture({standard=true,long=false,scratch=''}={}){
 const lines=[line('fmc-line fmc-header','ACT RTE','1/2')];
 const count=standard?6:3;
 for(let i=0;i<count;i++){
  lines.push(line('fmc-line fmc-small fmc-pairline',i===0?'ORIGIN':'RUNWAY','DEST'));
  lines.push(line('fmc-line fmc-pairline',long&&i===0?'ABCDEFGHIJKLMNOPQRSTUVW':'OIII','OIMM'));
 }
 lines.push(line('fmc-line scratch fmc-pairline',scratch,''));
 let mutation=null;const ctx={font:'',measureText(s){return {width:s.length*parseFloat(this.font.match(/[0-9]+(?=px)/)[0])*.52}}};
 const root={
  location:{search:'?seat=CAPT'},document:{
   getElementById:id=>id==='fmc-lines'?{querySelectorAll:s=>s==='.fmc-line'?lines:[]}:null,
   createElement:()=>({getContext:()=>ctx}),
   documentElement:{dataset:{}},fonts:{ready:new Promise(()=>{})}
  },
  getComputedStyle:elem=>({fontFamily:'BoeingCDULarge'}),
  requestAnimationFrame:fn=>fn()
 };
 vm.runInNewContext(source,{window:root,URLSearchParams,
  MutationObserver:class {constructor(fn){mutation=fn;}observe(){}}
 },{timeout:1000});
 return {root,lines,notify:()=>mutation()};
}
test('Every ordinary CDU row enlarges and repositions dynamically',()=>{
 const f=fixture();
 const s=f.root.B737CduScreenFitV4.apply();
 assert.equal(s.standard,true);
 assert.equal(f.lines[0].style.data['font-size'],'54px');
 assert.equal(f.lines[1].style.data['font-size'],'39px');
 assert.equal(f.lines[2].style.data['font-size'],'54px');
 assert.equal(f.lines[1].style.data.top,'12%');
 assert.equal(f.lines[2].style.data.top,'19%');
 assert.equal(f.lines[12].style.data.top,'89%');
 assert.equal(f.root.document.documentElement.dataset.cduScreenFit,'CDU-SCREEN-FIT-0004');
});
test('Long field content shrinks to available column width without touching other rows',()=>{
 const f=fixture({long:true});
 f.root.B737CduScreenFitV4.apply();
 const long=f.lines[2].spans[0].style.data['font-size'];
 assert.ok(parseFloat(long)<54);
 assert.equal(f.lines[4].style.data['font-size'],'54px');
});
test('Scratchpad with populated last row reduces row6 font to avoid overlap',()=>{
 const f=fixture({scratch:'CHECK FMC DATA'});
 const summary=f.root.B737CduScreenFitV4.apply();
 assert.equal(summary.dense,true);
 assert.equal(f.lines[12].style.data['font-size'],'39px');
 assert.equal(f.lines[11].style.data['font-size'],'29px');
 assert.equal(f.lines[13].style.data['font-size'],'42px');
});
test('Special NAV reference overlays retain authored top positions',()=>{
 const f=fixture({standard:false});
 f.lines[1].style.setProperty('top','13%');
 const result=f.root.B737CduScreenFitV4.apply();
 assert.equal(result.standard,false);
 assert.equal(f.lines[1].style.data.top,'13%');
 assert.equal(f.lines[2].style.data['font-size'],'31px');
});
