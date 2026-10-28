'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('panel-mosaic-lab/cockpit/index.html');
const cdu=read('panel-mosaic-lab/cockpit/cdu-stage.html');
const bridge=read('panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js');
const js=read('panel-mosaic-lab/cockpit/irs-trainer-unified-v1.js');
const browserCore=read('engine/systems/irs-trainer-web-v1.js');
const frozen=JSON.parse(read('panel-mosaic-lab/cockpit/irs-13seg-owner-lock-v1.json'));
for(const tag of frozen.frozenIndexMounts)assert.equal(html.split(tag).length-1,1,'Locked display changed');
for(const file of ['../../engine/systems/irs-trainer-web-v1.js','./irs-trainer-unified-v1.js','./irs-trainer-unified-v1.css'])assert(html.includes(file));
assert(cdu.includes('cdu-bridge.js?v=CDU-U3'));
assert(cdu.includes('cdu-irs-adapter-v1.js?v=IRS-LIVE-0001'));
assert(cdu.indexOf('cdu-irs-adapter-v1.js')>cdu.indexOf('cdu-bridge.js'),'CDU adapter must load AFTER shared-session bridge');
assert(bridge.includes("state.page==='POS_INIT'&&normalized==='LSK_R4'"));
assert(bridge.includes("state.page==='POS_REF'"));
assert(bridge.includes("state.active.IRS_POS=input"));
assert(js.includes("document.addEventListener('b737:irs-visual-key'"));
assert(js.includes('event.stopImmediatePropagation()'),'Old demo keypad handler must not double-apply');
assert(js.includes('rightDcElapsedSec>=300'),'R DC backup cutoff five minutes');
assert(js.includes("u.onDcLamp"),'ON DC physical lamp must read IRS core');
assert(js.includes("u.alignLamp"),'ALIGN physical lamp must read IRS core');
assert(!/\\bwindow\\.B737IRSSegmentDisplay\\.setMode/.test(js),'Do not mutate approved renderer');
vm.runInNewContext(browserCore,{window:{}},{timeout:1500});
const browser={};vm.runInNewContext(browserCore,{window:browser},{timeout:1500});
const core=browser.B737IRSTrainerCoreV1;assert(core);
let x=core.initialState();
for(const side of ['L','R']){x=core.apply(x,{type:'POWER',side,available:true});x=core.apply(x,{type:'SELECT_MODE',side,mode:side==='L'?'NAV':'ALIGN'});}
assert.equal(core.status(x,'L').phase,'SELFTEST');assert.equal(core.status(x,'R').onDcLamp,true);
x=core.tick(x,{dtSec:3,stationary:true});assert.equal(core.status(x,'L').onDcLamp,true);
x=core.tick(x,{dtSec:.5,stationary:true});assert.equal(core.status(x,'L').onDcLamp,false);
assert.equal(core.status(x,'L').alignLamp,true);assert.equal(core.status(x,'L').phase,'ALIGNING');
assert.equal(core.hdgStsCountdown(x,'L').value,7,'Countdown begins after 3.5s ON DC, even if FMC position not yet entered');
x=core.apply(x,{type:'FMC_SET_IRS_POS',position:'N35395 E051254'});
assert.equal(core.status(x,'L').entrySource,'FMC');assert.equal(core.status(x,'R').entrySource,'FMC');
function dom(tag){
 return {tagName:tag.toUpperCase(),children:[],dataset:{},style:{setProperty(k,v){this[k]=v;}},events:{},attrs:{},value:'',textContent:'',
  append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parentNode=this},
  prepend(n){this.children.unshift(n);n.parentNode=this},
  setAttribute(k,v){this.attrs[k]=String(v)},addEventListener(k,fn){this.events[k]=fn},
  querySelector(selector){
    const selectors=[...selector.matchAll(/\[data-([a-z-]+)="([^"]+)"\]/g)];
    const camel=key=>key.replace(/-([a-z])/g,(_,m)=>m.toUpperCase());
    const find=(p)=>{for(const child of p.children){
      if(selectors.length&&selectors.every(m=>child.dataset[camel(m[1])]===m[2]))return child;
      const sub=find(child);if(sub)return sub;
    }return null};
    return find(this);
  }};
}
const overhead=dom('section'),inspector=dom('aside');
overhead.querySelector=function(sel){return null};
const domEvents={};
const doc={readyState:'loading',body:dom('body'),
 getElementById(x){return x==='region-overhead'?overhead:x==='inspector'?inspector:null},
 createElement:dom,addEventListener(k,fn,opts){domEvents[k]=fn}};
const cueChanges=[];
const listeners={};
let interval=null,now=0;
class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts.detail}}
const root={B737IRSTrainerCoreV1:core,
 B737IRSSysDspl:{getSystem:()=> 'L'},
 B737IRSDisplaySelector:{getState:()=>({mode:'PPOS',brightness:82})},
 B737ISDUCues:{setCue(k,v){cueChanges.push([k,v])}},
 B737IRSSegmentDisplay:{getElement:()=>null},
 addEventListener(k,fn){listeners[k]=fn},dispatchEvent(){},setTimeout(fn){return 1},
 setInterval(fn){interval=fn;return 1},console:{error(e){throw Error(e)}}};
vm.runInNewContext(js,{window:root,document:doc,CustomEvent,performance:{now:()=>now}},{timeout:3000});
domEvents.DOMContentLoaded();
const trainer=root.B737IRSTrainerUnified;assert(trainer);
assert(inspector.children.find(n=>n.id==='irsTrainerV1'));
assert(overhead.children.find(n=>n.id==='irsTrainerMSU'));
assert.equal(trainer.getState().units.L.mode,'OFF');
trainer.setMode('L','NAV');trainer.setMode('R','NAV');
assert.equal(trainer.getState().units.L.phase,'SELFTEST');
assert.equal(trainer.getState().units.L.onDcLamp,true);
assert.throws(()=>trainer.setFmcPosition('N95995 E051254'),/degrees or minutes/i);
let fmc=trainer.setFmcPosition('N35395 E051254');assert(fmc.ok);
assert.deepEqual(Array.from(fmc.sides),['L','R']);
assert.equal(trainer.getState().units.R.entrySource,'FMC');
now=1000;interval();now=2000;interval();now=3000;interval();now=4000;interval();now=5000;interval();
assert.equal(trainer.getState().units.L.onDcLamp,false);
assert.equal(trainer.getState().units.L.alignLamp,true);
assert.equal(core.hdgStsCountdown(trainer.getCoreState(),'L').value,7);
trainer.setPowerMode('AIRCRAFT');
assert.equal(trainer.getState().units.L.powered,false,'No live electrical telemetry MUST fail closed');
assert.equal(trainer.getState().units.R.powered,false);
trainer.setPowerMode('BENCH');
trainer.setMode('L','OFF');trainer.setMode('L','NAV');
const keys=['2','3','5','3','9','5','ENT','6','0','5','1','2','5','4','ENT'];
for(const key of keys)trainer.pressISDU(key);
assert.equal(trainer.getState().units.L.entrySource,'ISDU');
assert.equal(trainer.getState().units.R.entrySource,null,'R lost electrical feed: stale FMC initialization must be cleared; L ISDU must not update R');
assert.equal(trainer.getCoreState().units.L.enteredPosition.lat,35+39.5/60);
assert.equal(trainer.getCoreState().units.L.enteredPosition.lon,51+25.4/60);
assert(cueChanges.some(x=>x[0]==='ENT'&&x[1]===true));
assert(cueChanges.some(x=>x[0]==='ENT'&&x[1]===false));
assert.throws(()=>trainer.publishMotion({valid:true,gsKt:150,trueTrackDeg:90}),/timestamp/);
const stamp=Date.now();
trainer.publishMotion({valid:true,gsKt:150,trueTrackDeg:90,trueHeadingDeg:88,altitudeFt:8000,sourceTimestampMs:stamp});
assert.equal(trainer.getState().motionSource,'EXTERNAL_TELEMETRY');
assert.throws(()=>trainer.publishMotion({valid:true,gsKt:150,trueTrackDeg:90,sourceTimestampMs:stamp}),/Out of order/);
// Test the ACTUAL FROZEN Unified bridge (no UI files modified): its AC
// STANDBY / AC TRANSFER 2 / SWITCHED HOT BATTERY selection must keep each
// independent IRS energized only while an acceptable feed remains available.
trainer.stopMotion();
const bus={acStandby:true,transfer2:true,switchedHotBattery:true};
root.B737ISNCockpitV1={getState(){return {state:{electrical:{bus}}};}};
trainer.setPowerMode('AIRCRAFT');
assert.equal(trainer.getState().units.L.powered,true);
assert.equal(trainer.getState().units.R.powered,true);
bus.transfer2=false; // right loses normal AC but has switched-hot DC
now+=2000;interval();
assert.equal(trainer.getState().units.R.powered,true,'R initially backed by DC');
for(let i=1;i<150;i++){now+=2000;interval();}
assert.equal(trainer.getPowerDiagnostics().rightDcElapsedSec,300);
assert.equal(trainer.getState().units.R.phase,'POWER_LOST','R backup expires at five minutes');
assert.equal(trainer.getState().units.L.powered,true,'L independent of R backup');
bus.transfer2=true; // restored AC while the physical R selector remains NAV
now+=2000;interval();
assert.equal(trainer.getState().units.R.phase,'SELFTEST','R must automatically repeat ON DC and alignment');
assert.equal(trainer.getState().units.R.onDcLamp,true);
assert.equal(trainer.getState().units.R.positionValid,false);
assert.equal(trainer.getPowerDiagnostics().rightDcElapsedSec,0);
bus.acStandby=false; // left on switched-hot backup (no five-minute limit)
now+=2000;interval();
assert.equal(trainer.getState().units.L.powered,true);
bus.switchedHotBattery=false; // both left feeds now invalid
now+=2000;interval();
assert.equal(trainer.getState().units.L.phase,'POWER_LOST');
assert.equal(trainer.getState().units.R.powered,true,'R continues on TRANSFER 2');
bus.acStandby=true;
now+=2000;interval();
assert.equal(trainer.getState().units.L.phase,'SELFTEST');
assert.equal(trainer.getState().units.L.onDcLamp,true);
// Missing upstream bus values must never fabricate device power.
bus.acStandby=undefined;bus.switchedHotBattery=true;
now+=2000;interval();
assert.equal(trainer.getState().units.L.powered,false,'Unknown AC + known battery cannot prove selector path');
const lock=JSON.parse(read('panel-mosaic-lab/cockpit/irs-sys-dspl-owner-lock-v1.json'));
for(const tag of lock.indexMounts)assert.equal(html.split(tag).length-1,1);
console.log('PASS Unified IRS end-to-end: OFF=>3.5s ON DC=>ALIGN, exact FMC 4R L/R, selected ISDU keypad latitude+longitude ENT, power fail-closed, source-valid simulator updates and all frozen UI mounts preserved');
