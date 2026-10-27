'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'irs-isdu-cues-v1.js'),'utf8');
const cockpit=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
assert.match(cockpit,/dispatchEvent\(new CustomEvent\('b737:visual-test'/);
assert.match(src,/addEventListener\('b737:visual-test'/);
const handlers={};
const keys={};
const emitted=[];
function makeEl(){
  return {dataset:{},childNodes:[],setAttribute(){},append(c){this.childNodes.push(c);},querySelector(){return null;}};
}
for(const key of ['ENT','CLR']){
  const cap=makeEl();
  const button=makeEl();
  button.dataset={};
  button.querySelector=(q)=>{
    if(q==='.irs-photo-key-cap')return cap;
    const match=q.match(/data-side="(left|right)"/);
    if(match)return cap.childNodes.find(n=>n.dataset.side===match[1])||null;
    return null;
  };
  keys[key]={button,cap};
}
const doc={
  readyState:'loading', documentElement:{dataset:{lampVisualTest:'false'}},
  addEventListener(type,callback){handlers['document:'+type]=callback;},
  getElementById(){return null;},
  querySelector(q){
    const match=q.match(/data-isdu-key="(ENT|CLR)"/);
    return match?keys[match[1]].button:null;
  },
  createElement:makeEl
};
class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
const win={addEventListener(type,fn){handlers[type]=fn;},dispatchEvent(event){emitted.push(event);},innerWidth:1200};
vm.runInNewContext(src,{window:win,document:doc,CustomEvent,MutationObserver:class{observe(){throw Error('Should already find IRS keypad')}disconnect(){}}},{timeout:2000});
const api=win.B737ISDUCues;
assert(api);
handlers['document:DOMContentLoaded']();
function lamps(){return Object.fromEntries(['ENT','CLR'].map(k=>[k,keys[k].cap.childNodes.map(n=>n.dataset.lit)]));}
function assertLit(expected){assert.deepEqual(lamps(),expected);}
assertLit({ENT:['false','false'],CLR:['false','false']});
// One manual lamp ON is kept ON after global test ends.
api.setCueLamp('ENT','left',true);
assertLit({ENT:['true','false'],CLR:['false','false']});
handlers['b737:visual-test']({detail:{active:true}});
assert.equal(api.getState().globalLampTest,true);
assertLit({ENT:['true','true'],CLR:['true','true']});
assert.deepEqual([...api.getState().ENT],[true,false],'Global test must not overwrite stored manual state');
assert.deepEqual([...api.getState().CLR],[false,false],'Global test must not overwrite CLR manual state');
// Manual switches during global force are preserved for later.
api.setCueLamp('CLR','right',true);
assertLit({ENT:['true','true'],CLR:['true','true']});
handlers['b737:visual-test']({detail:{active:false}});
assertLit({ENT:['true','false'],CLR:['false','true']});
assert.deepEqual([...api.getState().effective.ENT],[true,false]);
assert.deepEqual([...api.getState().effective.CLR],[false,true]);
assert.equal(api.getState().globalLampTest,false);
api.reset();
assertLit({ENT:['false','false'],CLR:['false','false']});
// Late mounting while global test already in progress must also show all lamps lit.
const lateDoc={...doc,documentElement:{dataset:{lampVisualTest:'true'}},addEventListener(type,fn){handlers['late:'+type]=fn;}};
const lateWin={...win,addEventListener(type,fn){handlers['lateWin:'+type]=fn;}};
vm.runInNewContext(src,{window:lateWin,document:lateDoc,CustomEvent,MutationObserver:class{}},{timeout:2000});
handlers['late:DOMContentLoaded']();
assert.equal(lateWin.B737ISDUCues.getState().globalLampTest,true);
assertLit({ENT:['true','true'],CLR:['true','true']});
handlers['lateWin:b737:visual-test']({detail:{active:false}});
assertLit({ENT:['false','false'],CLR:['false','false']});
assert(emitted.some(x=>x.type==='b737:irs-cue-visual-change'&&x.detail.globalLampTest===true));
console.log('PASS: General Unified all-lights test illuminates ENT/CLR four cues, late mounting, independent manual state restoration and no backend.');
