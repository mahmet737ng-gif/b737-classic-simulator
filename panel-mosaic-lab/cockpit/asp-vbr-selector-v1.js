/* Additive owner photograph at the fourth lower ASP aperture.
 * CAPT/FO live in Unified; OBS lives in the real overhead iframe.
 * Selection events are separate from the existing MIC/receiver audio engine.
 */
(function(root){
 'use strict';const model=root.B737ASPVBRModel,registrar=root.B737ASPSocketRegistrationV2;
 if(!model||!registrar)return;
 const observerOnly=root.B737ASPOnlyObserver===true,seats=observerOnly?['OBS']:['CAPT','FO'];
 const state=model.create(),mounted=new Map();
 const source=new URL('./assets/asp-vbr-v1/vbr-selector-owner.png',document.currentScript.src).href;
 function show(button){const s=state.read(button.dataset.seat);button.dataset.position=s.position;button.dataset.angle=String(s.angle);
  button.setAttribute('aria-valuenow',String(s.index));button.setAttribute('aria-valuetext',s.position);
  button.setAttribute('aria-label','ASP '+s.seat+' V/B/R selector');
  button.title='V/B/R: '+s.position+' · click / drag / wheel / arrow keys';
  button.querySelector('.asp-vbr-rotor').style.transform='rotate('+s.angle+'deg)';
 }
 function choose(button,index){state.select(button.dataset.seat,index);show(button);
  root.dispatchEvent(new CustomEvent('b737:asp-vbr-select',{detail:state.read(button.dataset.seat)}));
 }
 function place(host,button){
  const face=host.querySelector(':scope > img'),w=face?.offsetWidth||host.clientWidth,h=face?.offsetHeight||host.clientHeight;
  if(!(w>0&&h>0))return;
  const frame=registrar.viewport(w,h,face?.offsetLeft||0,face?.offsetTop||0),p=frame.point(model.socket.x,model.socket.y);
  const size=model.socket.hit*frame.scale,scale=model.socket.baseDiameter*frame.scale/model.image.baseDiameter;
  Object.assign(button.style,{left:p.x+'px',top:p.y+'px',width:size+'px',height:size+'px'});
  Object.assign(button.querySelector('img').style,{width:model.image.width*scale+'px',height:model.image.height*scale+'px',
   left:size/2-model.image.pivotX*scale+'px',top:size/2-model.image.pivotY*scale+'px'});
 }
 function wire(button){
  let drag=null,ignoreClick=0;
  const angle=e=>{const b=button.getBoundingClientRect();return Math.atan2(e.clientX-b.left-b.width/2,-(e.clientY-b.top-b.height/2))*180/Math.PI;};
  button.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.pointerType==='mouse'&&e.button!==0)return;
   drag={id:e.pointerId,x:e.clientX,y:e.clientY,a:angle(e),start:state.read(button.dataset.seat).angle,moved:false};button.setPointerCapture(e.pointerId);
  });
  button.addEventListener('pointermove',e=>{e.stopPropagation();if(!drag||drag.id!==e.pointerId)return;
   if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4)return;drag.moved=true;e.preventDefault();
   const delta=((angle(e)-drag.a+540)%360)-180;choose(button,Math.round((drag.start+delta+45)/45));
  });
  const end=e=>{e.stopPropagation();if(!drag||drag.id!==e.pointerId)return;if(drag.moved)ignoreClick=performance.now()+300;drag=null;if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
  button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);
  for(const type of ['touchstart','touchmove','touchend'])button.addEventListener(type,e=>e.stopPropagation());
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(performance.now()<ignoreClick)return;
   const b=button.getBoundingClientRect(),x=(e.clientX-b.left)/b.width,y=(e.clientY-b.top)/b.height;
   // Left / center / right hit zones agree with the printed V B R labels.
   const index=e.detail===0?(state.read(button.dataset.seat).index+1)%3:x<.4?0:x>.6?2:y<.5?1:(state.read(button.dataset.seat).index+1)%3;
   choose(button,index);
  });
  button.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();if(e.deltaY)choose(button,state.read(button.dataset.seat).index+(e.deltaY>0?1:-1));},{passive:false});
  button.addEventListener('keydown',e=>{const s=state.read(button.dataset.seat);let index;
   if(['ArrowLeft','ArrowDown'].includes(e.key))index=s.index-1;
   else if(['ArrowRight','ArrowUp'].includes(e.key))index=s.index+1;
   else if(e.key==='Home'||e.key.toUpperCase()==='V')index=0;
   else if(e.key==='End'||e.key.toUpperCase()==='R')index=2;
   else if(e.key.toUpperCase()==='B')index=1;
   else if(e.key===' '||e.key==='Enter')index=(s.index+1)%3;
   if(index!==undefined){e.preventDefault();e.stopPropagation();choose(button,index);}
  });
 }
 function mount(){
  for(const seat of seats){
   const host=document.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
   if(!host||host.classList.contains('asp-observer-legacy')||mounted.get(seat)===host)continue;
   const button=document.createElement('button');button.type='button';button.className='asp-vbr-selector';button.dataset.seat=seat;
   button.setAttribute('role','slider');button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','2');
   const rotor=document.createElement('span');rotor.className='asp-vbr-rotor';
   const image=document.createElement('img');image.className='asp-vbr-photo';image.src=source;image.alt='';image.draggable=false;
   rotor.append(image);button.append(rotor);host.append(button);wire(button);place(host,button);show(button);
   mounted.set(seat,host);host.dataset.aspVbrVersion=model.version;
   new ResizeObserver(()=>place(host,button)).observe(host);
  }
 }
 root.B737ASPVBR=Object.freeze({version:model.version,inspect:()=>seats.map(seat=>state.read(seat))});
 root.addEventListener('b737:cockpit-mounted',mount);root.addEventListener('b737:asp-observer-mounted',mount);
 const watch=new MutationObserver(mount);watch.observe(document.documentElement,{childList:true,subtree:true});mount();
})(window);
