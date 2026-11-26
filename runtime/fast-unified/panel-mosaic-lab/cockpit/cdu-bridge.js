(function(){
 'use strict';
 const seat=new URLSearchParams(location.search).get('seat');if(!['CAPT','FO'].includes(seat))return;
 document.documentElement.dataset.cduSeat=seat;document.title=(seat==='CAPT'?'Captain':'First Officer')+' CDU — Unified';
 const sendToParent=detail=>{if(parent!==window)parent.postMessage({type:'b737:unified-cdu',seat,...detail},location.origin);};
 let pending=false;
 function report(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sendToParent({kind:'state',page:document.getElementById('page-now').textContent,scratch:document.getElementById('scratch-now').textContent,key:document.getElementById('key-now').textContent});});}
 const count=document.querySelectorAll('#clickmap .hotspot').length;
 if(count!==70||!document.getElementById('fmc-lines').children.length){sendToParent({kind:'error',message:'CDU source failed to initialize'});return;}
 // The approved v6 app exposes these script bindings; no source engine or artwork edits.
 if(typeof state==='undefined'||typeof update!=='function'||!parent.B737UnifiedFmc){sendToParent({kind:'error',message:'Shared FMC unavailable'});return;}
 const originalUpdate=update,originalReset=reset;
 const keys=new Set(map.controls.map(control=>control.id));
 const originalKey=send;
 send=function(id){
  originalKey(id);
  if(keys.has(id))sendToParent({kind:'crew-key',key:id});
 };
 window.B737CrewCduV1=Object.freeze({press(id){
  if(!keys.has(id))return false;
  if(!window.B737CDUIRSAdapterV1?.handleKey?.(id))originalKey(id);
  return true;
 }});
 let applying=false,session;
 const write=shared=>{const old=state.lastHoldExit?.revision;for(const key of parent.B737CduSession.keys){if(Object.hasOwn(shared,key))state[key]=structuredClone(shared[key]);else delete state[key];}if(state.page==='HOLD'&&state.lastHoldExit&&old!==state.lastHoldExit.revision){core.choose(state,pages,'LEGS');state.subpage=1;}};
 update=function(){originalUpdate();if(!applying)session?.publish();report();};
 window.updateStage5View=update;
 session=parent.B737UnifiedFmc.attach(seat,window,{read:()=>state,write,refresh(){applying=true;try{update();}finally{applying=false;}}});
 // A CDU reset clears its screen/input; shared flight data survives it.
 reset=function(){const shared=session.snapshot();applying=true;try{originalReset();write(shared);}finally{applying=false;}update();};
 document.getElementById('reset').onclick=reset;
 sendToParent({kind:'ready',controls:count});report();
 const observer=new MutationObserver(report);for(const id of ['page-now','scratch-now','key-now'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:unified-cdu-command'||e.data.seat!==seat)return;if(e.data.action==='reset')reset();if(e.data.action==='reset-fmc'){originalReset();session.publish();}});
 document.addEventListener('pointerdown',e=>{if(e.target.closest('.hotspot'))sendToParent({kind:'focus'});});
 document.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();sendToParent({kind:'zoom',delta:e.deltaY,clientX:e.clientX,clientY:e.clientY,inputAt:performance.timeOrigin+e.timeStamp});return;}
  if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(!Number.isFinite(e.deltaX)||!Number.isFinite(e.deltaY))return;
  e.preventDefault();e.stopImmediatePropagation();
  sendToParent({kind:'wheel-pan',deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,shiftKey:e.shiftKey});
 },{capture:true,passive:false});
})();
