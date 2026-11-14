'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const js=read('irs-amber-display-v1.js'),css=read('irs-amber-display-v1.css'),index=read('index.html');
assert(index.includes('irs-amber-display-v1.js?v=IRS-AMBER-0001'));
assert(index.includes('irs-amber-display-v1.css?v=IRS-AMBER-0001'));
assert.match(js,/const REGION=\{x:434,y:238,w:299,h:39\}/);
assert.match(js,/b737:irs-visual-key/);
assert.match(js,/b737:irs-upper-visual-change/);
assert.match(js,/no inertial solution|no inertial backend|No inertial solution/i);
assert.match(css,/irs-amber-display/);
assert.match(css,/rgb\(255 164 39 \/ var\(--irs-amber-power\)\)/);
assert.match(css,/\[data-brightness="0"\]/);
const listeners={},timers=[],winEvents=[];
class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail}}
function dom(tag){
 return {tag,children:[],dataset:{},style:{setProperty(k,v){this[k]=v;}},attrs:{},events:{},textContent:'',
    append(child){this.children.push(child)},setAttribute(key,v){this.attrs[key]=v},
    addEventListener(k,v){this.events[k]=v},querySelectorAll(s){return s==='.irs-amber-line'?this.children.filter(x=>x.className==='irs-amber-line'):[]}};
}
const region={children:[],append(x){this.children.push(x)},querySelector(q){return q==='#irsAmberDisplayMounted'?this.children.find(x=>x.id==='irsAmberDisplayMounted'):null}};
const document={readyState:'loading',documentElement:{},activeElement:null,
 getElementById(id){return id==='region-overhead'?region:null},
 addEventListener(k,v){listeners['document:'+k]=v},createElement:dom};
const window={addEventListener(k,v){listeners['window:'+k]=v},
 setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){},
 B737IRSUpperSelector:{getMode:()=>currentMode,setMode(v){currentMode=v}}};
let currentMode='PPOS';
vm.runInNewContext(js,{window,document,CustomEvent,MutationObserver:class{observe(){throw Error('Mount should find region')}}},{timeout:1000});
const display=window.B737IRSAmberDisplay;
assert(display);
listeners['document:DOMContentLoaded']();
const mounted=region.children[0];assert.equal(mounted.id,'irsAmberDisplayMounted');
assert.equal(mounted.dataset.active,'false');
assert.deepEqual(mounted.children.map(x=>x.textContent),['','']);
display.press('1');display.press('2');display.press('3');
assert.equal(display.getState().digits,'123');
assert.equal(mounted.children[0].textContent.trim(),'123');
assert.equal(mounted.dataset.active,'true');
listeners['window:b737:irs-upper-visual-change']({detail:{type:'brightness',brightness:15,mode:'PPOS'}});
assert.equal(display.getState().brightness,15);
const dim=parseFloat(mounted.style['--irs-amber-power']);
listeners['window:b737:irs-upper-visual-change']({detail:{type:'brightness',brightness:90,mode:'PPOS'}});
assert(parseFloat(mounted.style['--irs-amber-power'])>dim);
display.press('ENT');assert.equal(display.getState().lastEntered,'123');
display.press('CLR');assert.equal(display.getState().lastEntered,'');
listeners['document:b737:irs-visual-key']({detail:{key:'9'}});
assert.equal(display.getState().digits,'9');
display.modeChange('HDG/STS');assert.equal(display.getState().mode,'HDG/STS');
currentMode='TEST';
listeners['window:b737:irs-upper-visual-change']({detail:{type:'mode',mode:'TEST',brightness:100}});
assert.equal(display.getState().testActive,true);
assert.deepEqual(mounted.children.map(x=>x.textContent),['8888888','8888888']);
assert(timers.length===1&&timers[0].ms===10000);
timers[0].fn();
assert.equal(currentMode,'TK/GS');
assert.equal(display.getState().mode,'TK/GS');
assert.equal(display.getState().testActive,false);
display.putHemisphere('N');display.press('4');assert.equal(display.getState().hemisphere,'N');
display.brightnessChange(0);assert.equal(display.getState().brightness,0);
display.mount();assert.equal(region.children.length,1,'No second readout installed');
assert(!/B737ElectricalV7\.apply|B737IRS\.apply/.test(js));
const lock=JSON.parse(read('irs-sys-dspl-owner-lock-v1.json'));
for(const m of lock.indexMounts)assert.equal(index.split(m).length-1,1,'Approved lower selector mount modified');
console.log('PASS: photo-aligned two-line amber ISDU, keypad digit entry, CLR/ENT, exact inner brightness, timed TEST, lower knob lock');
