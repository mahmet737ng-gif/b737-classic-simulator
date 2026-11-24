'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const file=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/intermittent-horn-audio-unified-v1.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
assert.ok(html.includes('intermittent-horn-audio-unified-v1.js?v=HORN-OWNER-0002'),
 'Live Unified must invalidate cached old autoplay runtime');
assert.ok(file.includes("header.unified-minimal-header .header-settings"),
 'Horn test must be in visible header, not hidden workbench toolbar');
const callbacks=new Map(),timers=[],events=[],result={resume:0,decode:0,starts:0,stops:0};
let resolveDecode=null,active=false;
class Node{
 constructor(){this.style={};this.children=[];this.dataset={};this.handlers={};this.textContent='';}
 setAttribute(){}
 addEventListener(name,cb){this.handlers[name]=cb;}
 append(...items){this.children.push(...items);}
}
const header=new Node();
const document={readyState:'complete',
 querySelector(selector){return selector.includes('header.unified-minimal-header')?header:null;},
 getElementById(){return null;},
 createElement(){return new Node();},
 addEventListener(type,cb){callbacks.set(type,cb);}
};
const player={
 state:'suspended',currentTime:10,destination:{},
 decodeAudioData(){result.decode++;return new Promise(resolve=>{resolveDecode=resolve;});},
 resume(){result.resume++;this.state='running';return Promise.resolve();},
 createBufferSource(){return{connect(){},start(){result.starts++;},stop(){result.stops++;},
   disconnect(){},buffer:null,loop:false,loopStart:0,loopEnd:0};},
 createGain(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},
  linearRampToValueAtTime(){}},connect(){},disconnect(){}};},
 close(){return Promise.resolve()}
};
const fakeWindow={document,AudioContext:class{constructor(){return player;}},
 B737OwnerIntermittentHornClipV1:{base64:Buffer.from([0,1,2,3]).toString('base64')},
 B737ISNCockpitV1:{
  getWarningSnapshot:()=>({sensors:{},variant:'737-300',warnings:{
   audio:{active:active?[{id:'intermittentHorn'}]:[],lamps:{cabinAltitude:active}}}}),
  instructor(){}
 },
 addEventListener(type,cb){callbacks.set('win:'+type,cb);},
 dispatchEvent(e){events.push(e.type);},
 console:{error(){}}
};
vm.runInNewContext(file,{window:fakeWindow,Uint8Array,
 atob:str=>Buffer.from(str,'base64').toString('binary'),
 setInterval:()=>{},setTimeout:fn=>{timers.push(fn);return timers.length;},
 clearTimeout:()=>{},queueMicrotask:fn=>fn(),
 CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;} }
});
const api=fakeWindow.B737UnifiedIntermittentHornAudioV1;
assert.ok(api?.enable&&api?.testHorn,'horn runtime should expose test controls');
assert.equal(header.children[0].id,'unifiedHornTestButton');
assert.ok(header.children[0].handlers.click,'test button must be clickable');
(async()=>{
 const pending=api.enable();
 // Critical regression: the resume MUST happen synchronously while the
 // user's click still counts as transient browser activation, BEFORE decode.
 assert.equal(result.resume,1,'must resume before awaiting audio decoding');
 assert.equal(result.decode,1,'one shared decode is in flight');
 assert.equal(resolveDecode instanceof Function,true);
 resolveDecode({duration:.51});
 await pending;
 assert.equal(api.getState().ready,true);
 assert.equal(api.getState().contextState,'running');
 await api.testHorn();assert.equal(api.getState().playing,true);
 assert.equal(result.starts,1);
 timers[timers.length-1]();assert.equal(api.getState().playing,false);
 assert.equal(result.stops,1);
 active=true;api.refresh();assert.equal(api.getState().playing,true,'alert must start after test');
 active=false;api.refresh();assert.equal(api.getState().playing,false,'alert must stop on clear');
 assert.equal(result.starts,2);assert.equal(result.stops,2);
 console.log('PASS: owner horn browser unlock before decode, visible header button, test waveform routing and immediate warning clear');
})().catch(e=>{console.error(e);process.exitCode=1;});
