/* Unified P5-13 native OH10 DC/AC meter-source selectors.
 * Adds HOTSPOTS over original photo rotaries only; no visual knob, gauge,
 * needle, image or red-zone sprite replacement. Owner detents clockwise.
 */
(function(root){
 'use strict';
 const model=root.B737AcDcSelectorModel,meters=root.B737UnifiedAcDcMetering;
 if(!model||!meters)return;
 const controls=model.create(),SOURCE_W=1095,SOURCE_H=1436,uid='ACDC-DETENT-0001';
 let frame=null,watch=null,watched=null;
 const buttons=new Map();
 const descriptions={DC:'DC METER SELECTOR',AC:'AC METER SELECTOR'};
 let panel=null;
 function updateMeters(){
  // No synthetic current/voltage/frequency: actual selected-source sensor
  // samples arrive separately through setSourceMeasurement().
  meters.setReadings(controls.readings(),{acVoltsMode:'NORMAL'});
 }
 function announce(side){
  const s=controls.read(side),button=buttons.get(side);
  if(button){
   button.dataset.position=s.position;button.dataset.index=String(s.index);
   button.setAttribute('aria-valuenow',String(s.index));
   button.setAttribute('aria-valuetext',s.position);
   button.title=descriptions[side]+' · '+s.position+' ('+(s.index+1)+'/7) · wheel / drag / keyboard';
  }
  if(panel){
   const display=panel.querySelector('[data-meter-selector-state="'+side+'"]');
   if(display)display.textContent=s.position+' · '+(s.index+1)+'/7';
  }
 }
 function emit(side){
  updateMeters();announce(side);
  const s=controls.read(side);
  root.dispatchEvent(new CustomEvent('b737:ac-dc-selector-change',{
   detail:{...s,version:uid,readings:controls.readings(),source:'OH10_COCKPIT_ROTARY'}}));
 }
 function select(side,index){const old=controls.read(side).index,result=controls.select(side,index);if(result.index!==old)emit(side);else announce(side);return result;}
 function choose(side,position){return select(side,model.indexOf(side,position));}
 function step(side,delta){return select(side,Math.max(0,Math.min(6,controls.read(side).index+delta)));}
 function setSourceMeasurement(side,position,sample){
  controls.setSourceMeasurement(side,position,sample);
  if(controls.read(side).position===position){updateMeters();announce(side);}
  return controls.snapshot();
 }
 function nearestIndex(element,event){
  const r=element.getBoundingClientRect();
  const dx=event.clientX-(r.left+r.width/2),dy=event.clientY-(r.top+r.height/2);
  if(Math.hypot(dx,dy)<Math.min(r.width,r.height)*.17)return null;
  const degrees=Math.atan2(dx,-dy)*180/Math.PI;
  // No physical wrap. The left and right mechanical end stops are hard.
  return model.fromAngle(element.dataset.side,degrees);
 }
 function wire(button,side){
  let drag=null,suppressClick=false;
  button.addEventListener('pointerdown',event=>{
   if(event.pointerType==='mouse'&&event.button!==0)return;
   event.stopPropagation();
   drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
   button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   event.stopPropagation();
   if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
   drag.moved=true;event.preventDefault();
   const next=nearestIndex(button,event);
   if(next!==null)select(side,next);
  });
  function end(event){
   if(!drag||event.pointerId!==drag.id)return;
   event.stopPropagation();
   suppressClick=drag.moved;drag=null;
   if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
  }
  button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);
  button.addEventListener('click',event=>{
   event.stopPropagation();event.preventDefault();
   if(suppressClick){suppressClick=false;return;}
   const next=nearestIndex(button,event);
   if(next===null)step(side,event.shiftKey?-1:1);
   else select(side,next);
  });
  button.addEventListener('wheel',event=>{
   if(!event.deltaY)return;
   event.preventDefault();event.stopPropagation();
   step(side,event.deltaY>0?1:-1);
  },{passive:false});
  button.addEventListener('keydown',event=>{
   let next=null;
   if(['ArrowRight','ArrowUp'].includes(event.key))next=controls.read(side).index+1;
   else if(['ArrowLeft','ArrowDown'].includes(event.key))next=controls.read(side).index-1;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=6;
   else if(event.key==='Enter'||event.key===' ')next=controls.read(side).index+1;
   if(next===null)return;
   event.preventDefault();event.stopPropagation();select(side,Math.max(0,Math.min(6,next)));
  });
 }
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  const piece=host.querySelector('.atlas-piece[data-key="OH10"]');
  if(!piece)return;
  const pw=parseFloat(piece.style.width),ph=parseFloat(piece.style.height);
  if(!Number.isFinite(pw)||!Number.isFinite(ph))return;
  for(const side of ['DC','AC']){
   const socket=model.sockets[side],name='acdc-selector-'+side.toLowerCase();
   let button=piece.querySelector('[data-acdc-selector="'+side+'"]');
   if(!button){
    button=doc.createElement('button');button.type='button';
    button.className=name;button.dataset.acdcSelector=side;button.dataset.side=side;
    button.setAttribute('role','slider');
    button.setAttribute('aria-label',descriptions[side]);
    button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','6');
    button.setAttribute('data-geometry-status',socket.confidence);
    // Transparent hit-zone over the existing photo knob (not a new knob).
    Object.assign(button.style,{
     position:'absolute',background:'transparent',border:'none',
     padding:'0',margin:'0',boxShadow:'none',outlineOffset:'1px',
     cursor:'pointer',touchAction:'none',zIndex:'1101',
     borderRadius:'50%',webkitTapHighlightColor:'transparent'
    });
    piece.append(button);wire(button,side);
   }
   const px=socket.x*pw/SOURCE_W,py=socket.y*ph/SOURCE_H;
   const sx=socket.r*2*pw/SOURCE_W,sy=socket.r*2*ph/SOURCE_H;
   Object.assign(button.style,{left:(px-sx/2)+'px',top:(py-sy/2)+'px',width:sx+'px',height:sy+'px'});
   buttons.set(side,button);announce(side);
  }
 }
 function bindFrame(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  if(watched!==host){
   if(watch)watch.disconnect();watched=host;
   watch=new MutationObserver(records=>{
    // Only atlas direct child rebuilds should trigger remount.
    if(records.some(item=>item.target===host&&item.type==='childList'))mount();
   });
   watch.observe(host,{childList:true});
  }
  mount();
 }
 function connect(){
  const next=document.getElementById('overheadFrame');if(!next)return;
  if(next!==frame){
   if(watch)watch.disconnect();watch=null;watched=null;buttons.clear();
   frame=next;
   frame.addEventListener('load',()=>{if(watch)watch.disconnect();watch=null;watched=null;buttons.clear();bindFrame();});
  }
  bindFrame();
 }
 function makeInspector(){
  panel=document.getElementById('unifiedAcDcMeteringNeedles');
  if(!panel||panel.querySelector('[data-acdc-selector-inspector]'))return;
  const block=document.createElement('div');block.dataset.acdcSelectorInspector='1';
  const head=document.createElement('h3');head.textContent='Meter Source Selectors · 7 + 7';
  block.append(head);
  for(const side of ['DC','AC']){
   const row=document.createElement('div');
   row.style.cssText='display:flex;align-items:center;gap:6px;margin:6px 0;direction:ltr;flex-wrap:wrap';
   const label=document.createElement('strong');label.textContent=side+':';
   const prev=document.createElement('button');prev.type='button';prev.textContent='◀';
   prev.setAttribute('aria-label',side+' previous detent');prev.onclick=()=>step(side,-1);
   const now=document.createElement('span');now.dataset.meterSelectorState=side;now.style.fontFamily='monospace';
   const next=document.createElement('button');next.type='button';next.textContent='▶';
   next.setAttribute('aria-label',side+' next detent');next.onclick=()=>step(side,1);
   row.append(label,prev,now,next);block.append(row);
  }
  const caution=document.createElement('p');
  caution.style.fontSize='11px';
  caution.textContent='Knob hotspots select instrument sources only. Real electrical measurements must be supplied by the electrical sensor backend; no artificial volts/amps/CPS are fabricated.';
  block.append(caution);panel.append(block);
  for(const side of ['DC','AC'])announce(side);
 }
 const api=Object.freeze({
  version:uid,detents:model.detents,read:side=>controls.read(side),
  snapshot:()=>controls.snapshot(),select,choose,step,setSourceMeasurement,
  getReadings:()=>controls.readings(),mount
 });
 root.B737UnifiedAcDcSelectors=api;
 root.addEventListener('b737:ac-dc-source-measurement',event=>{
  try{const d=event.detail||{};setSourceMeasurement(d.side,d.position,d.measurement);}
  catch(error){console.error('Invalid AC/DC measurement source',error);}
 });
 root.addEventListener('b737:cockpit-mounted',connect);
 connect();makeInspector();updateMeters();
})(window);
