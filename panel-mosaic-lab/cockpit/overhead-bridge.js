(function(){
 'use strict';
 const send=detail=>{if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',...detail},location.origin);};
 let ready=false,pending=false,projection=null;
 function applyProjection(){
  if(!ready||!projection||document.documentElement.classList.contains('cockpit-visual-test'))return;
  const base=window.B737OverheadLights.getState();
  if(base.lampTest)return;
  for(const node of document.querySelectorAll('.mounted-light')){
   if(!Object.prototype.hasOwnProperty.call(projection,node.dataset.light))continue;
   const v=projection[node.dataset.light];node.dataset.isnProjection=v===null?'UNKNOWN':v?'ON':'OFF';
   const frame=base.power===false?'OFF':v===null?(base.frames[node.dataset.light]||'OFF'):v?'ON':'OFF';
   for(const face of node.querySelectorAll('.light-face'))face.classList.toggle('active',face.dataset.frame===frame);
   node.dataset.frame=frame;node.dataset.state=frame;
   node.setAttribute('aria-label',node.dataset.light+(v===null?' — ISN UNKNOWN; legacy preview '+frame:' — ISN '+frame));
   node.title=node.dataset.light+(v===null?' · ISN UNKNOWN (legacy trainer image)':' · ISN '+frame);
  }
 }
 function visualTest(active){document.documentElement.classList.toggle('cockpit-visual-test',active);let count=0;for(const node of document.querySelectorAll('.mounted-light')){const faces=[...node.querySelectorAll('.light-face')],bright=faces.find(n=>n.dataset.frame==='BRIGHT_BLUE')||faces.find(n=>n.dataset.frame==='ON');for(const img of faces)img.dataset.visualOn=String(active&&img===bright);if(active&&bright){node.dataset.visualFrame=bright.dataset.frame;count++;}else delete node.dataset.visualFrame;}if(!active)applyProjection();send({kind:'visual-state',active,count});}
 function report(){if(!ready||pending)return;pending=true;requestAnimationFrame(()=>{pending=false;const s=window.B737OverheadLights.getState();send({kind:'state',lights:s.lights,frames:s.frames,context:s.context,lampTest:s.lampTest,power:s.power});send({kind:'controls-state',toggles:window.B737OverheadToggles.getState(),...window.B737RotaryGuards.getState(),context:s.context});applyProjection();});}
 function start(){if(ready||!window.B737OverheadLights||!window.B737RotaryGuards||!window.B737OverheadToggles)return;ready=true;send({kind:'ready',version:'LGT-0003',lampDefinitions:window.B737OverheadLights.getRegistry().lights.map(c=>({id:c.id,rule:c.rule,states:c.states||['OFF','ON']})),switches:58,rotaries:20,guards:11});report();}
 const observer=new MutationObserver(()=>{start();if(ready)observer.disconnect();});observer.observe(document.getElementById('atlasAbsolute'),{childList:true,subtree:true});start();
 for(const type of ['b737:switch-change','b737:rotary-change','b737:guarded-change'])window.addEventListener(type,e=>{send({kind:'control-event',event:{...e.detail,kind:type==='b737:switch-change'?'toggle':type==='b737:rotary-change'?'rotary':'guarded'}});report();});
 window.addEventListener('b737:overhead-light-state',()=>{applyProjection();report();});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;const d=e.data;if(!ready)return;
  if(d.action==='visual-test'&&typeof d.active==='boolean')visualTest(d.active);
  if(d.action==='lamp-test'&&typeof d.active==='boolean')window.B737OverheadLights.setLampTest(d.active);
  if(d.action==='fault'&&typeof d.id==='string'&&typeof d.active==='boolean'){try{window.B737OverheadLights.setFault(d.id,d.active);}catch{}}
  if(d.action==='reset-scenario')window.B737OverheadLights.reset();
  if(d.action==='reset-controls')document.getElementById('resetToggles').click();
  if(d.action==='isn-projection'&&d.lamps&&typeof d.lamps==='object'){
   const ids=new Set(window.B737OverheadLights.getRegistry().lights.map(light=>light.id));
   projection={};for(const [id,v]of Object.entries(d.lamps))if(ids.has(id)&&(v===null||typeof v==='boolean'))projection[id]=v;
   applyProjection();
  }
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
