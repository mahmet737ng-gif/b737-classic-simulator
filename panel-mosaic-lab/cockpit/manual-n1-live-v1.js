/* B737 Classic EIS / Conventional manual N1 controls — FCOM SHI Ch7.10.3-4,
 * 7.10.14-15: pulling knob disables FMC BUG input but DOES NOT alter A/T.
 * Graphical knob is real PNG; N1 calculation is V19 EST only, unless a
 * qualified FMC source explicitly publishes its limit. This file never
 * commands engine thrust, actual N1 or any AFDS mode.
 */
(function(win){'use strict';
 const doc=win.document;
 const EST=win.EPFSI_ESTIMATED_N1_V19;
 const VERSION='MANUAL_N1_RASTER_CH7_10_0001',knobs={1:null,2:null};
 const state={1:{pulled:false,manualPct:90.0,fmcPct:null,fmcSource:null},
              2:{pulled:false,manualPct:90.0,fmcPct:null,fmcSource:null}};
 let mountNode=null,frame=null,status=null,marker=null,mode='EIS',events=0;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const by=id=>doc.getElementById(id);
 const css=(n,props)=>Object.assign(n.style,props);
 const el=(tag,parent,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;parent.appendChild(n);return n;};
 const validProfile=()=>{
  const profile=win.B737AircraftProfileStore?.get?.();
  return profile?.aircraftModel==='737-300'&&profile?.engineVariant==='CFM56-3B3';
 };
 function phase(){
  const toga=win.B737UnifiedTOGACh4V1?.getState?.();
  return toga?.phase==='GA'?'GO_AROUND':toga?.phase==='TO'?'TAKEOFF':'MAX_CONTINUOUS';
 }
 function estimate(){
  if(!EST||!validProfile())return null;
  const f=win.B737UnifiedFlightScenarioV1?.getState?.();
  const oat=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('airdata.oat')?.value;
  return EST.estimate({...EST.AIRFRAME,phase:phase(),
   pressureAltitudeFt:num(f?.altitudeFt)?f.altitudeFt:null,
   oatC:num(oat?.temperatureC)?oat.temperatureC:null,
   weatherMode:'ISA',engineBleedMode:'ON',acPacks:'AUTO',
   antiIceMode:'OFF',thrustLeverPct:100});
 }
 function source(n){const st=state[n],est=estimate();
  const auto=num(st.fmcPct)?st.fmcPct:num(est?.maxN1Pct)?est.maxN1Pct:null;
  const label=st.pulled?'MAN':num(st.fmcPct)?'FMC':'EST';
  return {targetPct:st.pulled?st.manualPct:auto,source:label,
   automaticPct:auto,pulled:st.pulled,atInfluenced:false,
   maxN1Pct:num(est?.maxN1Pct)?est.maxN1Pct:null,estimateNotAfm:true};
 }
 function change(n,value){
  if(!num(value))return;
  state[n].manualPct=Math.round(clamp(value,20,120)*10)/10;
  paint();
 }
 function imageButton(n,parent){
  const button=el('button',parent,'manual-n1-knob');button.type='button';
  button.setAttribute('aria-label','Engine '+n+' N1 pull to set');
  button.title='N1 ENG '+n+' · click PULL/PUSH, scroll or swipe to SET';
  const img=el('img',button,'manual-n1-raster');img.src='./assets/manual-n1-raster-20261119.png';
  img.alt='';img.draggable=false;
  const note=el('span',button,'manual-n1-knob-label');note.textContent='N1 '+n;
  let drag=null;
  button.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   drag={y:e.clientY,pointer:e.pointerId,moved:false};
   button.setPointerCapture?.(e.pointerId);e.stopPropagation();
  });
  button.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.pointer)return;
   const dy=drag.y-e.clientY;if(Math.abs(dy)<5)return;
   drag.moved=true;drag.y=e.clientY;
   if(!state[n].pulled)state[n].pulled=true;
   change(n,state[n].manualPct+dy*.1);
   e.stopPropagation();
  });
  button.addEventListener('pointerup',e=>{
   if(drag?.moved){button.dataset.swipeHandled='true';}
   drag=null;e.stopPropagation();
  });
  button.addEventListener('click',e=>{
   e.stopPropagation();e.preventDefault();
   if(button.dataset.swipeHandled==='true'){button.dataset.swipeHandled='false';return;}
   state[n].pulled=!state[n].pulled;paint();
  });
  button.addEventListener('wheel',e=>{
   e.preventDefault();e.stopPropagation();
   if(!state[n].pulled)state[n].pulled=true;
   change(n,state[n].manualPct+(e.deltaY<0?.2:-.2));
  },{passive:false});
  button.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='Home'){state[n].pulled=false;paint();return;}
   state[n].pulled=true;
   change(n,e.key==='End'?100:state[n].manualPct+(e.key==='ArrowUp'?.1:-.1));
  });
  return button;
 }
 function mount(){
  const native=doc.querySelector('#region-main .region-native');
  const piece=native?.querySelector('.texture-piece[data-piece="engine"]');
  if(!native||!piece)return false;
  if(!frame){
   frame=el('div',native,'manual-n1-overlay');frame.id='manualN1Overlay';
   for(const n of [1,2])knobs[n]=imageButton(n,frame);
   status=el('output',frame,'manual-n1-status');
   status.setAttribute('aria-label','Estimated N1 limits and manual bug state');
   marker={};
   for(const n of [1,2]){
    marker[n]=el('div',frame,'manual-n1-reference-bug');
    marker[n].title='N1 reference bug · yellow, per FCOM Chapter 7.10';
   }
  }
  const view=doc.documentElement.dataset.engineIndication||'EIS';
  const geo=win.B737EngineIndicationModeV1?.layout?.();
  const conventional=view==='CONVENTIONAL'&&geo?.w>0;
  mode=conventional?'CONVENTIONAL':'EIS';
  const rectangle=conventional?geo:{x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),
   w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  if(!Object.values(rectangle).every(num))return false;
  css(frame,{left:rectangle.x+'px',top:rectangle.y+'px',
   width:rectangle.w+'px',height:rectangle.h+'px'});
  // Conventional photo: N1 reference controls are small circular recesses
  // in the N1 dial faces. EIS photo: PULL TO SET knobs sit by the FF/FU row.
  const coords=conventional?[[.318,.404],[.412,.404]]:[[.240,.585],[.764,.585]];
  const dial=conventional?[[.293,.402],[.408,.402]]:[[.426,.425],[.587,.425]];
  const size=conventional?0.038:.038;
  for(const n of [1,2]){
   css(knobs[n],{left:(coords[n-1][0]*100)+'%',top:(coords[n-1][1]*100)+'%',
    width:(size*rectangle.w)+'px',height:(size*rectangle.w)+'px'});
   marker[n].dataset.faceX=dial[n-1][0];marker[n].dataset.faceY=dial[n-1][1];
  }
  paint();
  return true;
 }
 function paint(){
  if(!frame)return;
  for(const n of [1,2]){
   const rec=source(n),button=knobs[n],mark=marker[n];
   button.dataset.pulled=String(rec.pulled);
   button.setAttribute('aria-pressed',String(rec.pulled));
   button.title='ENGINE '+n+' N1 '+rec.source+' '+(num(rec.targetPct)?rec.targetPct.toFixed(1)+'%':'UNAVAILABLE')+
    ' · PULL TO SET does not affect A/T operation';
   const r=num(rec.targetPct)?clamp(rec.targetPct,0,120):null;
   mark.hidden=r===null;
   if(r!==null){
    // Calibrated training scale from existing N1 gauge model; angular
    // placement is a visual approximation pending photo-pixel alignment.
    const deg=45+(r/120)*270;
    const cx=Number(mark.dataset.faceX),cy=Number(mark.dataset.faceY);
    const radius=mode==='CONVENTIONAL'?.038:.060;
    const a=deg*Math.PI/180;
    css(mark,{left:((cx+Math.sin(a)*radius)*100)+'%',
     top:((cy-Math.cos(a)*radius)*100)+'%',transform:'rotate('+deg+'deg)'});
   }
  }
  const a=source(1),b=source(2);
  status.textContent='N1 1 '+a.source+' '+(num(a.targetPct)?a.targetPct.toFixed(1):'---')+
   '% · N1 2 '+b.source+' '+(num(b.targetPct)?b.targetPct.toFixed(1):'---')+
   '% · MAX N1 EST '+(num(a.maxN1Pct)?a.maxN1Pct.toFixed(1):'---')+'%';
  status.title='Estimates are not validated AFM data; manual knob does not change A/T';
  events++;
 }
 function verifiedFmc(e){
  const p=e.detail;
  if(p?.schema!=='B737_FMC_N1_LIMIT_V1'||p.confirmed!==true||
     p.source!=='FMC'||
     ![1,2].includes(p.engine)||!num(p.n1Percent)||p.n1Percent<20||p.n1Percent>120)return;
  state[p.engine].fmcPct=p.n1Percent;
  state[p.engine].fmcSource='FMC';paint();
 }
 win.addEventListener('b737:fmc-n1-limit',verifiedFmc);
 for(const ev of ['b737:cockpit-mounted','b737:engine-indication-view',
   'b737:flight-scenario-state','b737:toga-mode','b737:aircraft-profile-change']){
  win.addEventListener(ev,()=>{if(!frame)mount();else if(ev==='b737:engine-indication-view')mount();else paint();});
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.B737ManualN1LiveV1=Object.freeze({version:VERSION,
  getState:()=>({1:source(1),2:source(2),mode,events}),
  setManual:(engine,percent)=>{if(![1,2].includes(engine)||!num(percent))return false;
   state[engine].pulled=true;change(engine,percent);return true;},
  setAuto:engine=>{if(![1,2].includes(engine))return false;
   state[engine].pulled=false;paint();return true;},
  refresh:()=>mount()});
})(window);
