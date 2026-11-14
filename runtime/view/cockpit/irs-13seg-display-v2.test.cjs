'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const js=read('irs-13seg-display-v2.js'),css=read('irs-13seg-display-v2.css'),index=read('index.html');
assert(index.includes('irs-13seg-display-v2.js?v=IRS-FILAMENT-0002'));
assert(index.includes('irs-13seg-display-v2.css?v=IRS-FILAMENT-0002'));
assert(js.includes('sourceRect:SOURCE'));
assert.match(js,/const LEFT=Object\.freeze\(\[18,76,134,192,250,308\]\)/);
assert.match(js,/RIGHT=Object\.freeze\(\[430,488,546,604,662,720,778\]\)/);
assert.match(js,/const TOP_DOTS=Object\.freeze\(\[179,370,624,801\]\)/);
assert.match(js,/BOTTOM_DOTS=Object\.freeze\(\[334,799\]\)/);
assert(css.includes('.irs-amber-display{display:none!important'),'Old two-row renderer must be hidden');
assert(css.includes('.irs-segment-display .irs-filament[data-on="true"]'));
assert(!/B737ElectricalV7\.apply|B737IRS\.apply|B737FMC\.apply/.test(js));
const evt={},timers=[],emitted=[];
function node(tag){
 return {tag,children:[],attrs:{},dataset:{},style:{setProperty(k,v){this[k]=v;}},handlers:{},
  appendChild(c){this.children.push(c);return c},append(c){this.children.push(c)},
  setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5)]=String(v)},
  getAttribute(k){return this.attrs[k]},addEventListener(k,fn){this.handlers[k]=fn},
  querySelector(){return null}};
}
const region=node('section');region.querySelector=(q)=>q==='#irsSegmentDisplayMounted'?region.children.find(c=>c.id==='irsSegmentDisplayMounted')||null:null;
const document={readyState:'loading',documentElement:{},activeElement:null,
 getElementById(id){return id==='region-overhead'?region:null},
 addEventListener(k,fn){evt['doc:'+k]=fn},createElement:node,createElementNS(ns,tag){assert.equal(ns,'http://www.w3.org/2000/svg');return node(tag)}};
const window={addEventListener(k,fn){evt['win:'+k]=fn},dispatchEvent(e){emitted.push(e)},
 setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){}};
class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts.detail}}
vm.runInNewContext(js,{window,document,CustomEvent,MutationObserver:class{}},{timeout:2000});
const api=window.B737IRSSegmentDisplay;
assert(api);evt['doc:DOMContentLoaded']();
assert.equal(region.children.length,1);
const box=region.children[0];assert.equal(box.id,'irsSegmentDisplayMounted');
assert.equal(box.dataset.frontendOnly,'true');
const svg=box.children[0];assert.equal(svg.attrs.viewBox,'0 0 835 106');
const groups=svg.children.filter(c=>c.tag==='g');
const points=svg.children.filter(c=>c.tag==='circle'&&c.attrs['data-position']);
assert.equal(groups.length,13,'Exactly 13 independent incandescent character cells');
assert.equal(points.length,6,'4 upper points + 2 decimal lamps');
assert.equal(api.getState().characters,13);
assert.equal(api.getState().leftCells,6);
assert.equal(api.getState().rightCells,7);
function activeSegments(i){return groups[i].children.filter(c=>c.attrs['data-on']==='true').map(c=>c.attrs['data-seg'])}
assert(groups.every(g=>g.children.every(p=>p.attrs['data-on']==='false')),'Unpowered readout must be dark');
api.press('2');
assert.equal(api.getState().typed,'2');
assert(groups[0].children.some(p=>p.attrs['data-on']==='true'),'Latitude hemisphere symbol is lit');
assert(activeSegments(5).length>=4,'A right-most numeric must light 7-segment strokes');
assert.equal(points.filter(p=>p.attrs['data-on']==='true').length,2);
api.setBrightness(0);
assert(groups.every(g=>g.children.every(p=>p.attrs['data-on']==='false')),'BRT at zero extinguishes ALL filaments');
api.setBrightness(100);
assert(groups.some(g=>g.children.some(p=>p.attrs['data-on']==='true')));
api.press('ENT');assert.equal(api.getState().lastEntered,'2');
api.press('CLR');assert.equal(api.getState().typed,'');assert.equal(api.getState().lastEntered,'');
api.press('8');api.press('9');
api.hemisphere('S');api.hemisphere('W');
assert.equal(api.getState().latHem,'S');assert.equal(api.getState().lonHem,'W');
api.startTest();assert.equal(api.getState().testActive,true);
assert.equal(groups[0].dataset.char,'N');assert.equal(groups[6].dataset.char,'W');
assert.equal(groups[5].dataset.char,'8');assert.equal(groups[12].dataset.char,'8');
assert(points.every(p=>p.attrs['data-on']==='true'),'Top/decimal lamps light during ALL-segment test');
assert(timers.at(-1).ms===10000);
api.finishTest();assert.equal(api.getState().testActive,false);
evt['win:b737:irs-dspl-sel-change']({detail:{mode:'HDG/STS',brightness:25}});
assert.equal(api.getState().mode,'HDG/STS');assert.equal(api.getState().brightness,25);
evt['win:b737:irs-upper-visual-change']({detail:{mode:'PPOS',brightness:84}});
assert.equal(api.getState().mode,'PPOS');assert.equal(api.getState().brightness,84);
evt['doc:b737:irs-visual-key']({detail:{key:'1'}});
assert.equal(api.getState().typed,'891');
api.mount();assert.equal(region.children.length,1,'Idempotent mount');
const lock=JSON.parse(read('irs-sys-dspl-owner-lock-v1.json'));
for(const token of lock.indexMounts)assert.equal(index.split(token).length-1,1,'Frozen lower SYS DSPL mount must be unchanged');
assert(emitted.some(e=>e.type==='b737:irs-display-segments-change'&&e.detail.frontendOnly===true));
console.log('PASS IRS 13 luminous segments: single row, 6 + 7, 4 upper + 2 decimal lamps, data entry, timed test, BRT 0/100, owner-lock preserved');
