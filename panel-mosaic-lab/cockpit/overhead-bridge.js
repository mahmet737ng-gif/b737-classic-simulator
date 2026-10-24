(function(){
 'use strict';
 const send=detail=>{if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',...detail},location.origin);};
 let ready=false,pending=false;
 function visualTest(active){document.documentElement.classList.toggle('cockpit-visual-test',active);let count=0;for(const node of document.querySelectorAll('.mounted-light')){const faces=[...node.querySelectorAll('.light-face')],bright=faces.find(n=>n.dataset.frame==='BRIGHT_BLUE')||faces.find(n=>n.dataset.frame==='ON');for(const img of faces)img.dataset.visualOn=String(active&&img===bright);if(active&&bright){node.dataset.visualFrame=bright.dataset.frame;count++;}else delete node.dataset.visualFrame;}send({kind:'visual-state',active,count});}
 function report(){if(!ready||pending)return;pending=true;requestAnimationFrame(()=>{pending=false;const s=window.B737OverheadLights.getState();send({kind:'state',lights:s.lights,frames:s.frames,context:s.context,lampTest:s.lampTest,power:s.power});});}
 function start(){if(ready||!window.B737OverheadLights||!window.B737RotaryGuards)return;ready=true;send({kind:'ready',version:'LGT-0003',lampDefinitions:window.B737OverheadLights.getRegistry().lights.map(c=>({id:c.id,rule:c.rule,states:c.states||['OFF','ON']})),switches:58,rotaries:20,guards:11});report();}
 const observer=new MutationObserver(()=>{start();if(ready)observer.disconnect();});observer.observe(document.getElementById('atlasAbsolute'),{childList:true,subtree:true});start();
 for(const type of ['b737:switch-change','b737:rotary-change','b737:guarded-change','b737:overhead-light-state'])window.addEventListener(type,report);
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;const d=e.data;if(!ready)return;
  if(d.action==='visual-test'&&typeof d.active==='boolean')visualTest(d.active);
  if(d.action==='lamp-test'&&typeof d.active==='boolean')window.B737OverheadLights.setLampTest(d.active);
  if(d.action==='fault'&&typeof d.id==='string'&&typeof d.active==='boolean'){try{window.B737OverheadLights.setFault(d.id,d.active);}catch{}}
  if(d.action==='reset-scenario')window.B737OverheadLights.reset();
  if(d.action==='reset-controls')document.getElementById('resetToggles').click();
  report();
 });
 document.addEventListener('click',e=>{const node=e.target.closest('[data-light]');if(node)send({kind:'selected-light',id:node.dataset.light});});
 const isControl=e=>e.target.closest('.mounted-toggle,.mounted-rotary,.guard-node,.mounted-light');let drag=null;
 document.addEventListener('pointerdown',e=>{if(e.button!==0||isControl(e))return;drag=e.pointerId;send({kind:'pan-start',screenX:e.screenX,screenY:e.screenY});});
 document.addEventListener('pointermove',e=>{if(drag===e.pointerId)send({kind:'pan-move',screenX:e.screenX,screenY:e.screenY});});
 for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{if(drag!==null)send({kind:'pan-end'});drag=null;});
 document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();send({kind:'zoom',delta:e.deltaY,clientX:e.clientX,clientY:e.clientY});}},{capture:true,passive:false});
 window.addEventListener('blur',()=>{if(ready){window.B737OverheadLights.setLampTest(false);report();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready){window.B737OverheadLights.setLampTest(false);report();}});
})();
