/* Independent photographic grips, fixed shafts and projected metal arms.
 * Travel is continuous; ONLY endpoint commands go to the existing ECU owner. */
(function(){
 'use strict';
 const model=window.B737EngineStartLeverModel,ns='http://www.w3.org/2000/svg';
 const positions={engine1:'CUTOFF',engine2:'CUTOFF'},controls=new Map();
 const master=new URL('./assets/engine-start-grips-front-v2.png?v=START-LEVER-0004',document.baseURI).href;
 let art=null;
 const raf=window.requestAnimationFrame?.bind(window),caf=window.cancelAnimationFrame?.bind(window);
 function svg(parent,tag,attrs){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));parent.append(n);return n;}
 function stop(entry){if(entry.ticket!=null)caf?.(entry.ticket);entry.ticket=null;}
 function paint(entry,fraction){
  const g=model.geometry(entry.device,fraction);entry.travel=g.travel;
  const p=model.placementAt(entry.piece,entry.device,g.travel);
  Object.assign(entry.button.style,{left:p.left+'px',top:p.top+'px',width:p.width+'px',height:p.height+'px'});
  const {pivotX:px,pivotY:py,jointX:jx,jointY:jy}=g,w=3.4;
  entry.arm.setAttribute('d',`M ${px-w} ${py} L ${px+w} ${py} L ${jx+w} ${jy} Q ${jx} ${jy+4} ${jx-w} ${jy} Z`);
  entry.edge.setAttribute('d',`M ${px-w+1} ${py+4} L ${jx-w+1} ${jy-1}`);
  entry.joint.setAttribute('cx',jx);entry.joint.setAttribute('cy',jy);
  entry.cap.setAttribute('x',g.x-model.HANDLE.w/2);entry.cap.setAttribute('y',g.y-model.HANDLE.h/2);
  entry.button.dataset.travel=g.travel.toFixed(4);
  entry.button.dataset.position=positions[entry.device];
  entry.button.setAttribute('aria-valuenow',String(Math.round(g.travel*100)));
  entry.button.setAttribute('aria-valuetext',(model.detentAt(g.travel)||'IN TRANSIT')+' · '+Math.round(g.travel*100)+'%');
  entry.button.title='ENGINE '+model.SLOTS[entry.device].label+' START LEVER · '+(model.detentAt(g.travel)||'IN TRANSIT');
 }
 function settle(entry,target){
  stop(entry);const start=entry.travel;
  if(!raf||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||Math.abs(start-target)<.0001){paint(entry,target);return;}
  let began=null;
  function frame(now){if(began===null)began=now;const t=Math.min(1,(now-began)/180),ease=1-(1-t)**3;
   paint(entry,start+(target-start)*ease);entry.ticket=t<1?raf(frame):null;
  }
  entry.ticket=raf(frame);
 }
 function position(device,next){
  if(!model.SLOTS[device]||!['CUTOFF','IDLE'].includes(next))throw Error('Unknown physical start lever state');
  const changed=positions[device]!==next;positions[device]=next;
  const entry=controls.get(device);if(!entry)return;
  entry.button.dataset.position=next;
  // A 10 Hz ECU observation must not pull a hand-driven lever out of the hand.
  if(!entry.drag&&!entry.keyboard&&changed)settle(entry,model.travel(next));
 }
 function request(device,next=positions[device]==='CUTOFF'?'IDLE':'CUTOFF'){
  if(!model.SLOTS[device]||!['CUTOFF','IDLE'].includes(next))throw Error('Unknown physical start lever state');
  const entry=controls.get(device);if(entry)entry.button.dataset.pending='true';
  // The shared ISN ECU alone accepts/rejects the fuel/ignition detent.
  window.dispatchEvent(new CustomEvent('b737:engine-start-lever-command',{detail:{device,position:next,source:'PEDESTAL_PHYSICAL'}}));
  if(entry){delete entry.button.dataset.pending;if(!entry.drag&&!entry.keyboard)settle(entry,model.travel(positions[device]));}
 }
 function endpoint(entry){const next=model.detentAt(entry.travel);
  if(next&&next!==positions[entry.device]&&entry.lastRequested!==next){entry.lastRequested=next;request(entry.device,next);}
  if(!next)entry.lastRequested=null;
 }
 function finish(entry,event,cancelled){
  const drag=entry.drag;if(!drag||drag.id!==event.pointerId)return;
  event.stopPropagation();entry.suppressClick=drag.moved;
  entry.drag=null;delete entry.button.dataset.dragging;
  if(entry.button.hasPointerCapture?.(drag.id))entry.button.releasePointerCapture(drag.id);
  if(drag.moved||cancelled)settle(entry,model.travel(positions[entry.device]));
 }
 function bind(entry){const b=entry.button;
  b.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType!=='touch')return;e.stopPropagation();stop(entry);
   entry.keyboard=false;entry.suppressClick=false;entry.lastRequested=null;
   const scale=b.getBoundingClientRect().width/model.HANDLE.w;
   entry.drag={id:e.pointerId,y:e.clientY,start:entry.travel,span:(model.DETENTS.CUTOFF-model.DETENTS.IDLE)*scale,moved:false};
   b.dataset.dragging='true';b.setPointerCapture(e.pointerId);
  });
  b.addEventListener('pointermove',e=>{
   const d=entry.drag;if(!d||d.id!==e.pointerId)return;e.stopPropagation();
   if(!d.moved&&Math.abs(e.clientY-d.y)<3)return;d.moved=true;e.preventDefault();
   paint(entry,model.dragTravel(d.start,d.y,e.clientY,d.span));endpoint(entry);
  });
  b.addEventListener('pointerup',e=>finish(entry,e,false));
  b.addEventListener('pointercancel',e=>finish(entry,e,true));
  b.addEventListener('lostpointercapture',e=>finish(entry,e,true));
  b.addEventListener('click',e=>{e.stopPropagation();if(entry.suppressClick){entry.suppressClick=false;return;}entry.keyboard=false;request(entry.device);});
  b.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Escape','Enter',' '].includes(e.key))return;
   e.preventDefault();e.stopPropagation();stop(entry);entry.lastRequested=null;
   if(e.key==='Escape'){entry.keyboard=false;settle(entry,model.travel(positions[entry.device]));return;}
   if(['Home','End','Enter',' '].includes(e.key)){entry.keyboard=false;request(entry.device,e.key==='Home'?'CUTOFF':e.key==='End'?'IDLE':undefined);return;}
   entry.keyboard=true;paint(entry,entry.travel+(['ArrowUp','ArrowRight'].includes(e.key)?.05:-.05));endpoint(entry);
  });
  b.addEventListener('blur',()=>{if(entry.keyboard){entry.keyboard=false;settle(entry,model.travel(positions[entry.device]));}});
 }
 function mount(){
  const native=document.querySelector('#region-pedestal .region-native'),texture=native?.querySelector('[data-piece="throttle-quadrant"]');
  if(!texture||!native)return;
  const piece={x:texture.offsetLeft,y:texture.offsetTop,w:texture.offsetWidth,h:texture.offsetHeight};
  if(art){for(const entry of controls.values()){entry.piece=piece;paint(entry,entry.travel);}return;}
  model.placement(piece,'engine1','CUTOFF');
  art=svg(native,'svg',{class:'engine-start-lever-art',viewBox:'0 0 '+model.SOURCE.window.w+' '+model.SOURCE.window.h,
   'data-start-lever-art':'START-LEVER-0004','aria-hidden':'true'});
  Object.assign(art.style,{left:piece.x+'px',top:piece.y+'px',width:piece.w+'px',height:piece.h+'px'});
  const defs=svg(art,'defs'),metal=svg(defs,'linearGradient',{id:'start-lever-arm-metal',x1:'0%',y1:'0%',x2:'100%',y2:'0%'});
  for(const [offset,color]of [['0%','#454b4d'],['12%','#e1e2dc'],['35%','#939a9a'],['70%','#aeb4b2'],['92%','#e8e9e1'],['100%','#5c6261']])svg(metal,'stop',{offset,'stop-color':color});
  for(const device of ['engine1','engine2']){
   const g=model.geometry(device,0),group=svg(art,'g',{'data-start-lever-assembly':device});
   const arm=svg(group,'path',{fill:'url(#start-lever-arm-metal)',stroke:'#484f4f','stroke-width':'.7'});
   const edge=svg(group,'path',{fill:'none',stroke:'#e4e6de','stroke-width':'.55',opacity:'.7'});
   const joint=svg(group,'circle',{r:4,fill:'url(#start-lever-arm-metal)',stroke:'#555b5a','stroke-width':'.6'});
   const cap=svg(group,'svg',{width:model.HANDLE.w,height:model.HANDLE.h,
    viewBox:device==='engine1'?'0 0 1086 724':'1086 0 1086 724',overflow:'hidden'});
   svg(cap,'image',{href:master,width:2172,height:724});
   const button=document.createElement('button');button.type='button';button.className='engine-start-lever';
   button.dataset.device=device;button.setAttribute('role','slider');button.setAttribute('aria-orientation','vertical');
   button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','100');
   button.setAttribute('aria-label','ENGINE '+model.SLOTS[device].label+' START LEVER');
   const entry={device,button,piece,arm,edge,joint,cap,travel:model.travel(positions[device]),drag:null,ticket:null,keyboard:false,lastRequested:null};
   controls.set(device,entry);native.append(button);bind(entry);paint(entry,entry.travel);
  }
 }
 window.addEventListener('b737:engine-start-lever-state',e=>{const feedback=e.detail?.levers;if(!feedback)return;
  for(const device of ['engine1','engine2'])if(['CUTOFF','IDLE'].includes(feedback[device]))position(device,feedback[device]);
 });
 window.addEventListener('b737:cockpit-mounted',mount);
 window.B737EngineStartLevers=Object.freeze({getPosition:device=>positions[device],getTravel:device=>controls.get(device)?.travel??model.travel(positions[device]),request,
  positions:Object.freeze(['CUTOFF','IDLE'])});
})();
