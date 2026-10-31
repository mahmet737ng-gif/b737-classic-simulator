'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const gate=require('../panel-mosaic-lab/desktop-shell/startup-gate.js');
const inside={left:0,top:0,right:100,bottom:100,width:100,height:100};
function fixture({imageReady=true,offscreenBroken=false,ecu=true,secondary=false}={}){
 const profile={aircraftFamily:'B737-300-500',engineInstruments:'EIS',pressurization:'DCPCS'};
 const image={complete:imageReady,naturalWidth:imageReady?100:0,parentElement:{getBoundingClientRect:()=>inside}};
 const outside={complete:false,naturalWidth:0,parentElement:{getBoundingClientRect:()=>({...inside,top:1000,bottom:1100})}};
 const document={getElementById:id=>id==='viewport'?{getBoundingClientRect:()=>inside}:{},
  querySelectorAll:()=>offscreenBroken?[image,outside]:[image],
  querySelector:s=>s.includes('mcp-hardware')?{}:s==='#overheadStatus'?{textContent:secondary?'متصل':''}:secondary?{}:null};
 return {profile,w:{document,B737ISNCockpitV1:ecu?{}:null,B737AircraftProfileStore:{get:()=>profile},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})}};
}
test('usable main controls never wait for offscreen images, old throttle toolbar or secondary CDU',()=>{
 const {w,profile}=fixture({offscreenBroken:true});const status=gate.inspect(w,profile);
 assert.equal(status.usable,true);assert.equal(status.overhead,false);assert.equal(status.cdu,false);
});
test('no splash-only success: a missing visible texture or live engine blocks readiness',()=>{
 for(const input of [{imageReady:false},{ecu:false}]){const {w,profile}=fixture(input);assert.equal(gate.inspect(w,profile).usable,false);}
 const {w,profile}=fixture();assert.equal(gate.inspect(w,{...profile,engineInstruments:'CONVENTIONAL'}).usable,false);
});
