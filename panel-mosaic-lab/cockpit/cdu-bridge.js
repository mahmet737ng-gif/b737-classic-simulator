(function(){
 'use strict';
 const seat=new URLSearchParams(location.search).get('seat');if(!['CAPT','FO'].includes(seat))return;
 document.documentElement.dataset.cduSeat=seat;document.title=(seat==='CAPT'?'Captain':'First Officer')+' CDU — Unified';
 const send=detail=>{if(parent!==window)parent.postMessage({type:'b737:unified-cdu',seat,...detail},location.origin);};
 let pending=false;
 function report(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;send({kind:'state',page:document.getElementById('page-now').textContent,scratch:document.getElementById('scratch-now').textContent,key:document.getElementById('key-now').textContent});});}
 const count=document.querySelectorAll('#clickmap .hotspot').length;
 if(count!==70||!document.getElementById('fmc-lines').children.length){send({kind:'error',message:'CDU source failed to initialize'});return;}
 // The approved v6 app exposes these script bindings; no source engine or artwork edits.
 if(typeof state==='undefined'||typeof update!=='function'||!parent.B737UnifiedFmc){send({kind:'error',message:'Shared FMC unavailable'});return;}
 const originalUpdate=update,originalReset=reset;
 let applying=false,session;
 const write=shared=>{for(const key of parent.B737CduSession.keys){if(Object.hasOwn(shared,key))state[key]=structuredClone(shared[key]);else delete state[key];}};
 update=function(){originalUpdate();if(!applying)session?.publish();report();};
 window.updateStage5View=update;
 session=parent.B737UnifiedFmc.attach(seat,window,{read:()=>state,write,refresh(){applying=true;try{update();}finally{applying=false;}}});
 // A CDU reset clears its screen/input; shared flight data survives it.
 reset=function(){const shared=session.snapshot();applying=true;try{originalReset();write(shared);}finally{applying=false;}update();};
 document.getElementById('reset').onclick=reset;
 send({kind:'ready',controls:count});report();
 const observer=new MutationObserver(report);for(const id of ['page-now','scratch-now','key-now'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:unified-cdu-command'||e.data.seat!==seat)return;if(e.data.action==='reset')reset();if(e.data.action==='reset-fmc'){originalReset();session.publish();}});
 document.addEventListener('pointerdown',e=>{if(e.target.closest('.hotspot'))send({kind:'focus'});});
 document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();send({kind:'zoom',delta:e.deltaY,clientX:e.clientX,clientY:e.clientY});}},{capture:true,passive:false});
})();
