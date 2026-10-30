/* RECESS-0003: owner OH10 residual socket center corrected; other installations unchanged. Original panel bitmaps and guards stay immutable. */
(function(root){
 'use strict';
 const source={UPPER:[1731,909],OH10:[1095,1436],OH15:[1280,1229],OH18:[816,1926],OH21:[1122,1402]};
 const nodes=[{"id":"mach-airspeed-1","piece":"UPPER","label":"MACH AIRSPEED WARNING TEST NO 1","cx":1610,"cy":458,"d":40,"quality":"photo"},{"id":"mach-airspeed-2","piece":"UPPER","label":"MACH AIRSPEED WARNING TEST NO 2","cx":1674,"cy":458,"d":40,"quality":"photo"},{"id":"stall-warning-1","piece":"UPPER","label":"STALL WARNING TEST NO 1","cx":1478,"cy":592,"d":42,"quality":"photo"},{"id":"stall-warning-2","piece":"UPPER","label":"STALL WARNING TEST NO 2","cx":1609,"cy":592,"d":42,"quality":"photo"},{"id":"pitot-static-tat-test","piece":"OH15","label":"PITOT STATIC HEAT / TAT TEST","cx":638,"cy":1027,"d":122,"quality":"photo"},{"id":"residual-volts","piece":"OH10","label":"AC DC METERING RESIDUAL VOLTS","cx":917,"cy":1273,"d":112,"quality":"screenshot-aligned","note":"Owner screenshot OH10 bore center: 8 native px left, 45 native px down; bezel and cap unchanged"},{"id":"aircon-ovht-test","piece":"OH21","label":"AIR CONDITIONING OVERHEAT TEST","cx":925,"cy":472,"d":108,"quality":"photo"},{"id":"trip-reset","piece":"OH21","label":"PACK / BLEED TRIP RESET","cx":559,"cy":1051,"d":109,"quality":"photo"},{"id":"attend","piece":"OH18","label":"ATTEND","cx":160,"cy":400,"d":192,"quality":"photo"},{"id":"ground-call","piece":"OH18","label":"GRD CALL","cx":615,"cy":400,"d":192,"quality":"photo"},{"id":"rain-repellent-left","piece":"OH18","label":"RAIN REPELLENT LEFT","cx":236,"cy":1035,"d":176,"quality":"photo"},{"id":"rain-repellent-right","piece":"OH18","label":"RAIN REPELLENT RIGHT","cx":550,"cy":1035,"d":176,"quality":"photo"}];
 const host=root.document.getElementById('atlasAbsolute');
 if(!host)return;
 const mounted=new Map();
 const send=(id,pressed,quality)=>{
  const detail={id,pressed,action:pressed?'PRESS':'RELEASE',momentary:true,quality,source:'recessed-hardware-v2'};
  root.dispatchEvent(new CustomEvent('b737:recessed-button',{detail}));
  if(root.parent!==root)root.parent.postMessage({type:'b737:cockpit-overhead',kind:'recessed-button',...detail},root.location.origin);
 };
 function make(item){
  const ring=root.document.createElement('div');
  ring.className='b737-recess-unit';ring.dataset.recessedId=item.id;ring.dataset.qa=item.quality;
  ring.title=item.label;
  const cap=root.document.createElement('button');
  cap.className='b737-recess-unit__cap';cap.type='button';cap.dataset.pressed='false';
  cap.setAttribute('aria-label',item.label+' recessed momentary button');cap.setAttribute('aria-pressed','false');
  ring.append(cap);
  let pressed=false;
  const set=next=>{next=!!next;if(pressed===next)return;pressed=next;cap.dataset.pressed=String(next);cap.setAttribute('aria-pressed',String(next));send(item.id,next,item.quality);};
  cap.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.stopPropagation();e.preventDefault();try{cap.setPointerCapture(e.pointerId);}catch(_){}set(true);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])cap.addEventListener(name,e=>{e.stopPropagation();set(false);});
  cap.addEventListener('pointerleave',e=>{if(!cap.hasPointerCapture?.(e.pointerId))set(false);});
  cap.addEventListener('blur',()=>set(false));
  cap.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)set(true);}});
  cap.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();set(false);}});
  cap.addEventListener('click',e=>e.stopPropagation());
  return ring;
 }
 function geometry(piece,item){
  const [sw,sh]=source[item.piece],n=x=>Number.parseFloat(x);
  const x=n(piece.style.left),y=n(piece.style.top),w=n(piece.style.width),h=n(piece.style.height);
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return null;
  return {left:x+w*item.cx/sw,top:y+h*item.cy/sh,width:w*item.d/sw};
 }
 function mount(){
  for(const item of nodes){
   const piece=host.querySelector('.atlas-piece[data-key="'+item.piece+'"]');
   if(!piece)continue;
   const g=geometry(piece,item);if(!g)continue;
   let node=mounted.get(item.id);
   if(!node||!node.isConnected){node=make(item);host.append(node);mounted.set(item.id,node);}
   Object.assign(node.style,{left:g.left+'px',top:g.top+'px',width:g.width+'px',height:g.width+'px'});
  }
  // LE TEST remains owned by its existing momentary 26-window logic. Only its visual cap is themed via CSS.
  const le=root.document.querySelector('.b737-le-devices__test');
  if(le)le.dataset.recessedIntegrated='v2';
 }
 let queue=false;const schedule=()=>{if(queue)return;queue=true;root.requestAnimationFrame(()=>{queue=false;mount();});};
 const observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:false});
 root.addEventListener('resize',schedule);
 root.B737RecessedOverheadV2={version:'RECESS-0002',registry:()=>nodes.map(x=>({...x})),mounted:()=>[...mounted.keys()],refresh:mount};
 schedule();
})(window);