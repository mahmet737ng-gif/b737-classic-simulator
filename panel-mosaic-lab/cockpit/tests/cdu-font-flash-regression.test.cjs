'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cockpit=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(cockpit,n),'utf8');
const script=read('cdu-screen-fit-v6.js');
const css=read('cdu-embed.css');
const sourcePage=read('cdu-stage.html');
const exactMetrics=require('../../../engine/ch11/cdu-24-column-metrics-v1.js');
function props(){
 const entries={};
 return {entries,setProperty(k,v){entries[k]=String(v)},removeProperty(k){delete entries[k]}};
}
function node(classes,text='',width=245,family='BoeingCDULarge'){
 const set=new Set(classes.split(' '));
 return {classList:{contains:k=>set.has(k),add:k=>set.add(k)},textContent:text,
  style:props(),width,family,children:[],
  getBoundingClientRect(){return {width:this.width,bottom:760}},
  querySelectorAll(sel){return sel==='span'?[...this.children]:[]},
  querySelector(sel){const needle=sel.includes('.fmc-right')?'fmc-right':'fmc-left';
   return this.children.find(x=>x.classList.contains(needle))||null}};
}
const pair=(small,id)=>{
 const p=node('fmc-line fmc-pairline'+(small?' fmc-small':''),'',445,
  small?'BoeingCDUSmall':'BoeingCDULarge');
 p.children=[node('fmc-left',small?'ORIGIN':'OIII',210,p.family),
             node('fmc-right',small?'DEST':'OIMM',210,p.family)];
 return p;
};
function rows(){
 const h=node('fmc-line fmc-header'),all=[h];
 h.children=[node('fmc-header-title','RTE'),node('fmc-header-count','1/1')];
 for(let i=0;i<6;i++){all.push(pair(true,i),pair(false,i))}
 const scratch=node('fmc-line scratch fmc-pairline');
 scratch.children=[node('fmc-left full','OIII',470)];
 all.push(scratch);
 return all;
}
function fixture(){
 const screen={getBoundingClientRect:()=>({bottom:1200})};
 const box={lines:rows(),style:props(),dataset:{},
   querySelectorAll(sel){return sel==='.fmc-line'?this.lines:[]},
   querySelector(sel){
    if(sel==='.fmc-line.scratch')return this.lines[this.lines.length-1];
    if(sel==='.fmc-line.fmc-small .fmc-left')return this.lines[1].children[0];
    return null;
   }};
 let checks=0,observer;
 const ctx={font:'',measureText(str){
  const px=parseFloat(/([\d.]+)px/.exec(this.font)?.[1]||0);
  return {width:px*.52*str.length,actualBoundingBoxAscent:px*.69,
   actualBoundingBoxDescent:px*.01};
 }};
 const doc={documentElement:{dataset:{}},fonts:{check:()=>true,ready:new Promise(()=>{})},
  createElement:()=>({getContext:()=>ctx}),
  getElementById(id){return id==='fmc-lines'?box:id==='fmc-screen'?screen:
   id==='page-now'?{textContent:'RTE'}:null}};
 const win={document:doc,location:{search:'?seat=FO'},CDU_PAGES:{RTE:{rows:[]}},
  B737CDU24ColumnMetricsV1:{...exactMetrics,calibrate(...args){
   checks++;return exactMetrics.calibrate(...args);
  }},
  getComputedStyle(el){return {fontFamily:el.family,top:'0px'}},
  requestAnimationFrame(fn){fn()},addEventListener(){}};
 vm.runInNewContext(script,{window:win,URLSearchParams,MutationObserver:class{
  constructor(fn){observer=fn}observe(){} }},{timeout:2000});
 return {win,box,metricsCalls:()=>checks,rerender(){
  box.lines=rows();observer();
 }};
}
test('RTE redraws retain a single native 24-column font profile',()=>{
 const f=fixture(),fit=f.win.B737CduScreenFitV6;
 assert.equal(fit.getState().ready,true);
 assert.equal(f.metricsCalls(),2,'one large and one small measurement');
 const stable={...f.box.style.entries};
 for(let i=0;i<12;i++){
  f.rerender();
  assert.equal(fit.getState().fontSizePx,Number(stable['--cdu-locked-value-size'].replace('px','')));
  assert.equal(f.box.style.entries['--cdu-locked-label-size'],stable['--cdu-locked-label-size']);
  assert.equal(f.box.dataset.cduFontGridLocked,'true');
 }
 assert.equal(f.metricsCalls(),2,'repainting RTE must not recalibrate fonts');
 assert.ok(parseFloat(stable['--cdu-locked-value-size'])>parseFloat(stable['--cdu-locked-label-size']));
});
test('CSS gives new RTE rows the frozen sizes before the next animation frame',()=>{
 assert.match(css,/\.fmc-line\.fmc-pairline:not\(\.fmc-small\):not\(\.scratch\)\s*\{\s*font-size:var\(--cdu-locked-value-size,/);
 assert.match(css,/\.fmc-line\.fmc-pairline\.fmc-small\s*\{\s*font-size:var\(--cdu-locked-label-size,/);
 assert.match(css,/\.fmc-line\.fmc-header\s*\{\s*font-size:var\(--cdu-locked-header-size,/);
 assert.match(css,/\.fmc-line\.scratch\s*\{\s*font-size:var\(--cdu-locked-scratch-size,/);
 assert.match(css,/\.fmc-line span\.cdu-lsk-prompt\s*\{\s*font-size:inherit!important/);
 assert.match(script,/function cachedModel\(/);
 assert.match(script,/function lockFontGrid\(/);
 assert.match(sourcePage,/cdu-embed\.css\?v=CDU-OWNER-PHOTO-20261031-NO-FONT-FLASH/);
 assert.match(sourcePage,/cdu-screen-fit-v6\.js\?v=[^"]*-NO-FONT-FLASH/);
 assert.doesNotMatch(css,/@font-face|\.hotspot|#clickmap|\.bbox_px/);
});
