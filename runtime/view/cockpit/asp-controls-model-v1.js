/* Owner-specified ASP selection latches and 270-degree receiver travel. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737ASPControlsModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MIC=Object.freeze(['VHF-1','VHF-2','VHF-3','HF-1','SERV INT','FLT INT','PA']);
 const LOWER=Object.freeze(['NAV-1','NAV-2','ADF-1','ADF-2','MKR','SPKR']);
 const sockets=Object.freeze([
  ...MIC.map((channel,i)=>Object.freeze({kind:'mic',channel,x:115+150*i,y:166,w:100,h:104})),
  ...MIC.map((channel,i)=>Object.freeze({kind:'volume',channel,x:115+150*i,y:348,w:96,h:96})),
  ...LOWER.map((channel,i)=>Object.freeze({kind:'volume',channel,x:180+155*i,y:571,w:96,h:96}))
 ]);
 const clamp=n=>Math.max(0,Math.min(100,Number.isFinite(n)?n:0));
 function create(){
  const state=new Map();
  function get(seat,kind,channel){
   if(!['CAPT','FO','OBS'].includes(seat)||!sockets.some(s=>s.kind===kind&&s.channel===channel))throw Error('Unknown ASP control');
   const key=[seat,kind,channel].join(':');
   if(!state.has(key))state.set(key,{selected:false,volume:0});
   return state.get(key);
  }
  function snapshot(seat,kind,channel){const s=get(seat,kind,channel);return Object.freeze({...s,angle:45+s.volume*2.7});}
  return Object.freeze({
   snapshot,
   toggle(seat,kind,channel){const s=get(seat,kind,channel);s.selected=!s.selected;return snapshot(seat,kind,channel);},
   setVolume(seat,channel,value){get(seat,'volume',channel).volume=clamp(value);return snapshot(seat,'volume',channel);}
  });
 }
 // Short signed angular delta avoids jumps at the bottom dead sector.
 const angularDelta=(from,to)=>((to-from+540)%360)-180;
 return Object.freeze({version:'ASP-CONTROLS-0001',viewBox:Object.freeze([1122,888]),sockets,create,angularDelta});
});
