/* PARK-BRAKE-001 — Boeing 737 Classic parking brake visual owner.
   Native Throttle Quadrant source image: 800px wide.
   Slot (green user mark): (127,925); lamp (red user mark): (207,892).
   Coordinates are in the original photo, NEVER viewport screen pixels.
   This isolated presenter is not an aircraft hydraulic brake simulator. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedParkingBrakeV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(win){
 'use strict';
 const VERSION='PARK-BRAKE-001-SLOT-127-925-LAMP-207-892';
 const SLOT=Object.freeze({x:127,y:925}),LAMP=Object.freeze({x:207,y:892});
 const ASSET='./assets/parking-brake-off-front-v1.svg';
 let engaged=false,holder=null,lever=null,lamp=null;
 const listeners=new Set();
 function geometry(piece={}){
  const scale=(Number(piece.w)||606)/(Number(piece.sourceWidth)||800);
  const x=Number(piece.x)||0,y=Number(piece.y)||0;
  const slot={x:x+SLOT.x*scale,y:y+SLOT.y*scale};
  const light={x:x+LAMP.x*scale,y:y+LAMP.y*scale};
  const width=160*scale,height=width*189/140;
  // The hinge tip center in the cut-out orthographic asset is at (41,185).
  return {slot,light,width,height,hinge:{x:slot.x,y:slot.y},
   left:slot.x-width*41/140,top:slot.y-height*185/189,
   lampDiameter:36*scale,raise:14*scale,scale};
 }
 function snapshot(){return Object.freeze({version:VERSION,engaged,position:engaged?'ON':'OFF'});}
 function render(){
  if(!holder)return;
  holder.dataset.parkingBrake=engaged?'ON':'OFF';
  if(lever){
   lever.style.transform='translateY('+(engaged?-geometryForHolder().raise:0)+'px)';
   lever.setAttribute('aria-pressed',String(engaged));
   lever.setAttribute('aria-label','Parking brake '+(engaged?'ON. Press to release':'OFF. Pull to engage'));
   lever.title=engaged?'Parking Brake ON — pull to release':'Parking Brake OFF — pull to engage';
  }
  if(lamp){
   lamp.dataset.parkingBrakeLight=engaged?'ON':'OFF';
   lamp.setAttribute('aria-label','Parking brake red lamp '+(engaged?'illuminated':'off'));
  }
 }
 let currentGeometry=null;
 function geometryForHolder(){return currentGeometry||geometry({x:272,y:0,w:606,sourceWidth:800});}
 function setEngaged(on,source='USER'){
  if(typeof on!=='boolean')throw new TypeError('Parking brake requires a boolean');
  if(engaged===on)return snapshot();
  engaged=on;render();
  const state=snapshot();
  for(const fn of listeners){try{fn(state);}catch(_e){}}
  if(win?.dispatchEvent&&typeof win.CustomEvent==='function'){
   win.dispatchEvent(new win.CustomEvent('b737:parking-brake-state',{
    detail:{...state,source}}));
  }
  return state;
 }
 function mount(){
  const doc=win?.document;
  if(!doc||holder?.isConnected)return !!holder?.isConnected;
  const photo=doc.querySelector('#region-pedestal .region-native .texture-piece[data-piece="throttle-quadrant"]');
  const native=photo?.parentElement;
  if(!photo||!native)return false;
  const q=geometry({x:photo.offsetLeft,y:photo.offsetTop,
   w:photo.offsetWidth||606,sourceWidth:800});
  currentGeometry=q;
  holder=doc.createElement('div');
  holder.id='b737ParkingBrakeOwner';
  holder.dataset.parkingBrake='OFF';
  holder.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:40;';
  lamp=doc.createElement('span');
  lamp.id='b737ParkingBrakeRedLamp';
  lamp.setAttribute('role','img');
  const d=q.lampDiameter;
  Object.assign(lamp.style,{position:'absolute',left:(q.light.x-d/2)+'px',
   top:(q.light.y-d/2)+'px',width:d+'px',height:d+'px',borderRadius:'50%',
   background:'radial-gradient(circle at 34% 27%,#241b1c,#08090a 62%,#020202)',
   boxShadow:'inset 0 1px 3px #111,0 0 0 1px #2d3339',
   pointerEvents:'none',zIndex:'3'});
  lever=doc.createElement('button');
  lever.id='b737ParkingBrakeOffLever';
  lever.type='button';
  lever.setAttribute('aria-pressed','false');
  Object.assign(lever.style,{position:'absolute',left:q.left+'px',top:q.top+'px',
   width:q.width+'px',height:q.height+'px',padding:'0',margin:'0',border:'0',
   borderRadius:'0',background:'transparent',boxShadow:'none',overflow:'visible',
   lineHeight:'0',cursor:'pointer',pointerEvents:'auto',touchAction:'manipulation',
   zIndex:'5',transformOrigin:'29.3% 98%',transition:'transform 180ms ease-out'});
  const asset=doc.createElement('img');
  asset.src=ASSET;asset.alt='';asset.draggable=false;
  Object.assign(asset.style,{width:'100%',height:'100%',display:'block',
   objectFit:'contain',pointerEvents:'none',userSelect:'none'});
  lever.append(asset);
  lever.addEventListener('click',()=>setEngaged(!engaged,'COCKPIT_LEVER'));
  holder.append(lamp,lever);
  native.append(holder);
  // Red lens illuminates only in Parking Brake ON; unaffected by zoom.
  const style=doc.createElement('style');
  style.id='b737ParkingBrakeLampStyle';
  style.textContent=`
   #b737ParkingBrakeOwner[data-parking-brake="ON"] #b737ParkingBrakeRedLamp{
     background:radial-gradient(circle at 35% 24%,#ffb0a3 0%,#ff302d 24%,#ae090d 62%,#410005 91%) !important;
     box-shadow:inset 0 2px 3px #ffcdcb80,0 0 9px 2px #ff1c1c99,0 0 0 1px #8d2323 !important;
   }
   #b737ParkingBrakeOffLever:hover,#b737ParkingBrakeOffLever:focus-visible{
     outline:1px dashed #d4e9ef;outline-offset:0;
   }`;
  if(!doc.getElementById('b737ParkingBrakeLampStyle'))doc.head.append(style);
  render();
  return true;
 }
 function subscribe(fn){if(typeof fn!=='function')throw new TypeError('SUBSCRIBER');listeners.add(fn);return()=>listeners.delete(fn);}
 const api=Object.freeze({VERSION,SLOT,LAMP,geometry,getState:snapshot,setEngaged,
  toggle:()=>setEngaged(!engaged),mount,subscribe,getGeometry:()=>currentGeometry});
 if(win?.document){
  const ready=()=>{
   if(mount())return;
   const obs=new MutationObserver(()=>{if(mount())obs.disconnect();});
   obs.observe(win.document.documentElement,{childList:true,subtree:true});
   win.addEventListener('pagehide',()=>obs.disconnect(),{once:true});
  };
  if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  win.addEventListener('b737:aircraft-general-state',event=>{
   const state=String(event?.detail?.state||event?.detail?.preset||'').toUpperCase().replace(/\s+/g,'_');
   if(state==='COLD_DARK'||state==='READY_FOR_START')setEngaged(true,'AIRCRAFT_GENERAL_STATE');
   else if(state==='READY_FOR_TAKEOFF')setEngaged(false,'AIRCRAFT_GENERAL_STATE');
  });
 }
 return api;
});