/* Stage10 live source reference for approved rectangular EHSI v6.
 * Source-validated scalar telemetry ONLY; no switch changes/AFDS actuation. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CDU_STAGE10_ADVISORY=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const V='STAGE10_LIVE_REFERENCE_NAV_v1';
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 function valid(f){
  return !!f&&f.version===V&&f.mode==='SIM_REFERENCE_TRACK'&&
   f.reference_only===true&&f.fmc_executable===false&&f.session_authority==='SIM_REFERENCE_ONLY'&&
   (f.source==='AIRAC_2610_PRIVATE'||(f.source==='PUBLIC_SYNTHETIC_DEMO'&&f.demo_marker==='FICTIONAL_ROUTE_NO_NAVDATA'))&&
   Array.isArray(f.afds_commands)&&f.afds_commands.length===0&&
   Array.isArray(f.servo_commands)&&f.servo_commands.length===0&&
   Array.isArray(f.lnav_commands)&&f.lnav_commands.length===0&&
   Array.isArray(f.vnav_commands)&&f.vnav_commands.length===0&&
   f.fd?.flight_director_authority===false&&f.fd?.autopilot_engaged===false&&
   f.fd?.mode==='SIM_REF_FD_PREVIEW'&&finite(f.fd?.bank_preview_deg,-20,20)&&
   Number.isInteger(f.telemetry_seq)&&f.telemetry_seq>=1&&
   finite(f.aircraft?.lat,-90,90)&&finite(f.aircraft?.lon,-180,180)&&
   finite(f.aircraft?.heading_true_deg,0,360)&&
   finite(f.aircraft?.pressure_alt_ft,-2000,60000)&&
   finite(f.desired_true_track_deg,0,360)&&
   finite(f.signed_cross_track_nm,-8,8)&&
   finite(f.distance_to_fix_nm,0,300)&&
   /^[A-Z0-9._-]{2,12}$/.test(f.to||'');
 }
 function safe(f){if(!valid(f))return null;
  return Object.freeze({mode:'SIM_REF_LIVE',leg_index:f.leg_index,
   to:f.to,desired_true_track_deg:f.desired_true_track_deg,
   heading_true_deg:f.aircraft.heading_true_deg,
   pressure_alt_ft:f.aircraft.pressure_alt_ft,
   signed_cross_track_nm:f.signed_cross_track_nm,
   distance_to_fix_nm:f.distance_to_fix_nm,
   fd_bank_preview_deg:f.fd.bank_preview_deg,
   telemetry_seq:f.telemetry_seq,public_demo:f.source==='PUBLIC_SYNTHETIC_DEMO',guidance_authority:false});
 }
 function render(st,svg){
  const old=svg?.querySelector?.('[data-stage10-advisory]');old?.remove?.();
  if(!svg||!st?.stage10Advisory||st.ehsi?.mode!=='PLAN')return {displayed:false};
  const x=st.stage10Advisory;const d=svg.ownerDocument||document,ns='http://www.w3.org/2000/svg';
  const g=d.createElementNS(ns,'g');g.setAttribute('data-stage10-advisory','READ_ONLY');svg.appendChild(g);
  function elem(t,at,txt){const e=d.createElementNS(ns,t);Object.entries(at).forEach(([k,v])=>e.setAttribute(k,String(v)));if(txt!==undefined)e.textContent=String(txt);g.appendChild(e);return e;}
  elem('rect',{x:48,y:333,width:344,height:80,rx:5,fill:'#081822',opacity:.97});
  elem('text',{x:220,y:350,'text-anchor':'middle',fill:'#ffcf82','font-size':11},x.public_demo?'PUBLIC DEMO · NO AFDS AUTHORITY':'LIVE SIM REF · NO AFDS AUTHORITY');
  elem('text',{x:220,y:366,'text-anchor':'middle',fill:'#c9f6ff','font-size':11},
       `${x.to}  TRK ${x.desired_true_track_deg.toFixed(1)}  XTK ${x.signed_cross_track_nm.toFixed(2)}NM`);
  elem('text',{x:220,y:382,'text-anchor':'middle',fill:'#c9f6ff','font-size':11},
       `DTG ${x.distance_to_fix_nm.toFixed(1)}NM  FD REF ${x.fd_bank_preview_deg.toFixed(1)}°`);
  elem('text',{x:220,y:399,'text-anchor':'middle',fill:'#ffbd7a','font-size':10},'REFERENCE ONLY / NOT LNAV, VNAV OR AUTOPILOT');
  return {displayed:true,commandOutputs:0,stage10:true};
 }
 function paint(box,st){
  if(!box||st?.page!=='LEGS'||!st.stage10Advisory)return {displayed:false};
  const x=st.stage10Advisory,doc=box.ownerDocument||document;
  function line(y,left,right){
    const row=doc.createElement('div');row.className='fmc-line fmc-pairline';row.style.top=y+'%';
    const l=doc.createElement('span');l.className='fmc-left';l.textContent=left;
    const r=doc.createElement('span');r.className='fmc-right';r.textContent=right;
    row.append(l,r);box.appendChild(row);
  }
  // Two small read-only rows below the sixth LEGS row, above scratchpad.
  line(84.5,(x.public_demo?'DEMO ':'SIM REF ')+x.to,'LEG '+String(x.leg_index));
  line(89,'DTG '+x.distance_to_fix_nm.toFixed(1)+'NM','XTK '+x.signed_cross_track_nm.toFixed(2));
  return {displayed:true,source:'STAGE10_SIM_REF',guidanceAuthority:false};
 }
 return Object.freeze({valid,safe,render,paint});
});
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
 window.addEventListener('message',event=>{
  if(event.origin!==window.location.origin||event.source!==window.parent||
     event.data?.type!=='B737_STAGE10_LIVE_REFERENCE')return;
  const value=window.CDU_STAGE10_ADVISORY?.safe(event.data?.payload);
  if(!value)return;
  if(typeof state!=='undefined')state.stage10Advisory=value;
  window.updateStage5View?.();
 });
 window.addEventListener('message',event=>{
  if(event.origin!==window.location.origin||event.source!==window.parent||
     event.data?.type!=='B737_STAGE10_STOP')return;
  if(typeof state!=='undefined')delete state.stage10Advisory;
  window.updateStage5View?.();
 });
}