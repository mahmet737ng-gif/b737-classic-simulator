'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=__dirname,read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const js=read('irs-dspl-sel-upper-v1.js');
const css=read('irs-dspl-sel-upper-v1.css');
const outer=read('assets/irs-dspl-sel-outer-v1.svg');
const inner=read('assets/irs-dspl-sel-inner-brt-v1.svg');
const html=read('index.html');
assert(html.includes('irs-dspl-sel-upper-v1.js?v=IRS-UPPER-0001'));
assert(html.includes('irs-dspl-sel-upper-v1.css?v=IRS-UPPER-0001'));
assert.match(js,/const MODES=Object\.freeze\(\['TEST','TK\/GS','PPOS','WIND','HDG\/STS'\]\)/);
assert.match(js,/const DETENTS=Object\.freeze\(\[-79,-46,-10,27,61\]\)/);
assert.match(js,/x:471\.48,y:368\.69,w:1731,h:909/);
assert.match(js,/w:2214,h:1019/);
assert.match(js,/const SIZE=Object\.freeze\(\{width:100,height:100\}\)/);
assert.match(outer,/viewBox="0 0 160 160"/);
assert.match(outer,/Central aperture/);
assert.match(inner,/brightness knob/);
assert.match(css,/irs-upper-mode-tick/);
assert(!css.includes('irs-sys-dspl-mount'),'Upper CSS must not restyle owner-locked lower switch');
assert.match(css,/\.irs-upper-brt\{/);
assert.match(css,/\.irs-photo-key \.irs-cue-lens\[data-lit="true"\]/);
assert(!/B737IRS\.apply|B737ElectricalV7\.apply|engine\/systems/.test(js));
const lowerLock=JSON.parse(read('irs-sys-dspl-owner-lock-v1.json'));
assert.equal(lowerLock.id,'IRS-SYS-DSPL-OWNER-LOCK-0001');
for(const token of lowerLock.indexMounts)assert.equal(html.split(token).length-1,1,'Lower owner-approved mount removed or duplicated');
class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts.detail;}}
const events=[],listeners={};
function element(tag){
 const x={tag,className:'',children:[],dataset:{},events:{},attrs:{},
  style:{setProperty(key,val){this[key]=val;}},append(child){this.children.push(child);},
  setAttribute(k,v){this.attrs[k]=v;},getBoundingClientRect(){return {left:0,top:0,width:100,height:100};},
  setPointerCapture(){},addEventListener(name,fn){this.events[name]=fn;},
  querySelector(q){if(q==='#irsUpperDsplSelMounted')return this.children.find(c=>c.id==='irsUpperDsplSelMounted')||null;
   if(q==='.irs-upper-outer')return this.children.find(c=>c.className==='irs-upper-outer')||null;
   if(q==='.irs-upper-brt')return this.children.find(c=>c.className==='irs-upper-brt')||null;
   return null;}
 };
 return x;
}
const region=element('section');
const doc={readyState:'loading',documentElement:{},addEventListener(n,fn){listeners[n]=fn;},
 getElementById(n){return n==='region-overhead'?region:null;},
 querySelector(){return null;},createElement:element};
const win={dispatchEvent(e){events.push(e);},addEventListener(){}};
vm.runInNewContext(js,{window:win,document:doc,CustomEvent,MutationObserver:class{}},{timeout:2000});
const api=win.B737IRSUpperSelector;
assert(api);
listeners.DOMContentLoaded();
assert.equal(region.children.length,1);
const holder=region.children[0];
assert.equal(holder.id,'irsUpperDsplSelMounted');
assert.equal(holder.dataset.frontendOnly,'true');
assert.equal(holder.children.filter(c=>c.className==='irs-upper-mode-tick').length,5);
assert.equal(holder.children.filter(c=>c.className==='irs-upper-outer').length,1);
assert.equal(holder.children.filter(c=>c.className==='irs-upper-brt').length,1);
const outerButton=holder.querySelector('.irs-upper-outer');
const innerButton=holder.querySelector('.irs-upper-brt');
assert.equal(outerButton.children[0].src,'./assets/irs-dspl-sel-outer-v1.svg');
assert.equal(innerButton.children[0].src,'./assets/irs-dspl-sel-inner-brt-v1.svg');
assert.equal(api.getMode(),'PPOS');
assert.equal(api.getBrightness(),78);
assert(Math.abs(parseFloat(holder.style.left)+50-(3+471.48*2214/1731))<.01);
assert(Math.abs(parseFloat(holder.style.top)+50-(3+368.69*1019/909))<.01);
assert.equal(outerButton.attrs['aria-valuetext'],'PPOS');
function send(button,event,extra={}){
 button.events[event]({currentTarget:button,button:0,pointerType:'mouse',pointerId:12,clientX:50,clientY:50,
 stopPropagation(){},preventDefault(){},...extra});
}
send(outerButton,'click');
assert.equal(api.getMode(),'WIND');
send(outerButton,'click');
assert.equal(api.getMode(),'HDG/STS');
send(outerButton,'wheel',{deltaY:-1});
assert.equal(api.getMode(),'WIND');
send(outerButton,'keydown',{key:'Home'});
assert.equal(api.getMode(),'TEST');
send(outerButton,'keydown',{key:'End'});
assert.equal(api.getMode(),'HDG/STS');
assert.throws(()=>api.setMode('NAV'),/Invalid/);
send(innerButton,'click');
assert.equal(api.getBrightness(),88);
assert.equal(api.getMode(),'HDG/STS','Inner brightness MUST NOT move outer selector');
send(innerButton,'wheel',{deltaY:-1});
assert.equal(api.getBrightness(),93);
send(innerButton,'keydown',{key:'Home'});
assert.equal(api.getBrightness(),0);
send(innerButton,'keydown',{key:'End'});
assert.equal(api.getBrightness(),100);
assert.equal(holder.dataset.brightness,'100');
assert.equal(region.style['--irs-brt-level'],'1');
assert.throws(()=>api.setBrightness(NaN),/Invalid/);
api.setMode('TK/GS');
assert.equal(api.getBrightness(),100,'Outer mode must NOT change BRT setting');
send(outerButton,'pointerdown',{clientX:50,clientY:50});
send(outerButton,'pointermove',{clientX:90,clientY:10});
send(outerButton,'pointerup',{clientX:90,clientY:10});
assert.equal(api.getMode(),'HDG/STS','Outer drag snaps to nearest exact white detent');
send(outerButton,'click');
assert.equal(api.getMode(),'HDG/STS','Click after drag must be suppressed');
api.mount();
assert.equal(region.children.length,1,'No duplicate mount on remount');
assert(events.some(e=>e.type==='b737:irs-upper-visual-change'&&e.detail.frontendOnly));
console.log('PASS IRS upper concentric selector: five modes in correct clockwise order; five ticks; independent BRT; source registration; lower lock preserved.');
