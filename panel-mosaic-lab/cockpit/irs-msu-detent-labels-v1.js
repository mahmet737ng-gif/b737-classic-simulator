/* IRS MSU PRINTED DETENT TAPS V1 — additive interaction only.
 * Uses the approved four photographed rotary index directions, never changes
 * red-zone assets, selector geometry, alignment physics or power rules.
 */
(function(root){
 'use strict';
 const MODES=Object.freeze(['OFF','ALIGN','NAV','ATT']);
 const seats=['L','R'],mounted=new Map();
 function geometry(){
  const g=root.B737IRSRotaryIndices?.angles;
  return g&&g.msu?.length===4?g:null;
 }
 function setMode(side,mode){
  if(!seats.includes(side)||!MODES.includes(mode))throw Error('Bad IRS detent');
  const owner=root.B737IRSTrainerUnified;
  if(!owner?.setMode)throw Error('IRS procedure trainer not ready');
  owner.setMode(side,mode);
  sync();return owner.getState().units[side].mode;
 }
 function sync(){
  const state=root.B737IRSTrainerUnified?.getState?.();
  if(!state)return;
  for(const [side,labels]of mounted){
   const active=state.units?.[side]?.mode;
   for(const [mode,button]of labels){
    const next=String(mode===active);
    if(button.getAttribute('aria-pressed')!==next)button.setAttribute('aria-pressed',next);
   }
  }
 }
 function mount(){
  const owner=root.B737IRSTrainerUnified,g=geometry(),
   panel=root.document.getElementById('irsTrainerMSU');
  if(!owner||!g||!panel)return false;
  for(const side of seats){
   const control=panel.querySelector('[data-msu-mini="'+side+'"]');
   if(!control||!(control.offsetWidth>0))continue;
   let labels=mounted.get(side);
   if(!labels||[...labels.values()].some(button=>!button.isConnected)){
    labels=new Map();mounted.set(side,labels);
   }
   const cx=control.offsetLeft+control.offsetWidth/2;
   const cy=control.offsetTop+control.offsetHeight/2;
   for(let i=0;i<MODES.length;i++){
    const mode=MODES[i],a=(g.msuBase+g.msu[i])*Math.PI/180;
    let button=labels.get(mode);
    if(!button){
     button=root.document.createElement('button');button.type='button';
     button.className='irs-msu-detent-label';button.dataset.irsMsuLabel=mode;
     button.dataset.irsSide=side;
     button.setAttribute('aria-label','IRS '+side+' → '+mode);
     button.title='IRS '+side+' · '+mode+' (tap printed mark)';
     Object.assign(button.style,{position:'absolute',zIndex:'100',padding:'0',margin:'0',
      border:'0',boxShadow:'none',background:'transparent',borderRadius:'6px',
      cursor:'pointer',touchAction:'manipulation',
      transform:'translate(-50%,-50%)'});
     button.addEventListener('pointerdown',e=>e.stopPropagation());
     button.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      try{setMode(side,mode);}catch(error){
       root.console?.warn?.('IRS direct detent unavailable:',error.message);
      }
     });
     panel.append(button);labels.set(mode,button);
    }
    const radius=control.offsetWidth*1.12;
    Object.assign(button.style,{
     left:(cx+Math.cos(a)*radius)+'px',
     top:(cy+Math.sin(a)*radius)+'px',
     width:(control.offsetWidth*.69)+'px',
     height:(control.offsetHeight*.5)+'px'
    });
   }
  }
  sync();return mounted.size===2;
 }
 root.addEventListener('b737:cockpit-mounted',mount);
 root.addEventListener('b737:irs-trainer-state',sync);
 if(root.document.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 root.B737IRSPrintedDetentTaps=Object.freeze({version:'IRS-MSU-DETENT-TAPS-0001',mount,
  setMode,getState:()=>Object.fromEntries(seats.map(side=>[
   side,{mode:root.B737IRSTrainerUnified?.getState?.()?.units?.[side]?.mode,
    taps:mounted.get(side)?.size||0}
  ]))});
})(window);
