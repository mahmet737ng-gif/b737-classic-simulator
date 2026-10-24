(function(){
 'use strict';
 const seat=new URLSearchParams(location.search).get('seat');if(!['CAPT','FO'].includes(seat))return;
 document.documentElement.dataset.cduSeat=seat;document.title=(seat==='CAPT'?'Captain':'First Officer')+' CDU — Unified';
 const send=detail=>{if(parent!==window)parent.postMessage({type:'b737:unified-cdu',seat,...detail},location.origin);};
 let pending=false;
 function report(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;send({kind:'state',page:document.getElementById('page-now').textContent,scratch:document.getElementById('scratch-now').textContent,key:document.getElementById('key-now').textContent});});}
 const count=document.querySelectorAll('#clickmap .hotspot').length;
 if(count!==70||!document.getElementById('fmc-lines').children.length){send({kind:'error',message:'CDU source failed to initialize'});return;}
 send({kind:'ready',controls:count});report();
 const observer=new MutationObserver(report);for(const id of ['page-now','scratch-now','key-now'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:unified-cdu-command'||e.data.seat!==seat)return;if(e.data.action==='reset')document.getElementById('reset').click();});
 document.addEventListener('pointerdown',e=>{if(e.target.closest('.hotspot'))send({kind:'focus'});});
 document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();send({kind:'zoom',delta:e.deltaY,clientX:e.clientX,clientY:e.clientY});}},{capture:true,passive:false});
})();
