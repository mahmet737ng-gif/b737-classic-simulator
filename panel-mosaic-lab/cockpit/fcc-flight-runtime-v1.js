/* Live scenario FCC coupler, EADI F/D source, and FCOM §4.20 A/P protections.
 * Reads only already-modeled flight/airdata and existing MCP AFDS owners.
 * Never asserts LOC, G/S, LNAV, or VNAV capture without signal evidence.
 */
(function(win){
 'use strict';
 const Guidance=win.B737FccFlightGuidanceV1,Protection=win.B737FcomCh4APProtectionV1;
 if(!Guidance||!Protection){win.console.error('FCC/AFDS guidance dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 const VERSION='B737_UNIFIED_FCC_FLIGHT_RUNTIME_0001';
 let fcc=Guidance.createState(),protect=Protection.initial(),last=null;
 let owner=null,sourceError=null,lastAp=null,lastProtectionMs=0;
 const faults={hydA:false,hydB:false,irsL:false,irsR:false,criticalSensor:false,radioAlt:false};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const isActive=()=>win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true;
 const mcp=()=>win.B737McpAFDSBridgeV1?.getOutput?.()||null;
 const flight=()=>isActive()?win.B737UnifiedFlightScenarioV1?.getState?.():null;
 function navInput(){
  // Not enough evidence that a position/symbol is an active valid FMC leg:
  // do not steer LNAV/VNAV merely because a route was typed into the CDU.
  return {fmcTrackValid:false,fmcVerticalValid:false,courseTrackValid:false};
 }
 function guidance(frame,output){
  if(!frame||!output)return null;
  const res=Guidance.evaluate(fcc,output,frame,navInput());
  fcc=res.state;last=res;
  return res;
 }
 function directorPublisher(){
  if(owner||sourceError)return owner;
  try{owner=win.B737UnifiedAvionicsNetworkV1?.connectExternal?.('FCC')||null;}
  catch(e){sourceError=String(e?.message||e);win.console.warn('FCC publisher',e);}
  return owner;
 }
 function paintDirector(frame){
  const out=mcp(),view=guidance(frame,out),p=directorPublisher();
  if(!view||!p)return;
  for(const [n,side] of [[1,'captain'],[2,'firstOfficer']]){
   const enabled=view.fd[side]===true;
   const value={enabled,
    pitchDeg:enabled?view.pitchCommandDeg:null,
    rollDeg:enabled?view.rollCommandDeg:null,
    locCaptured:out?.nav?.loc===true,gsCaptured:out?.nav?.gs===true,
    source:'SIMULATED_FCC_FCOM_CH4_TRAINING',seat:side==='captain'?'CAPT':'FO'};
   try{p.publish('afds.director'+n,value,{quality:'VALID',origin:'TRAINING_SCENARIO'});}
   catch(e){sourceError=String(e?.message||e);}
  }
  const label=by('flightFccStatus');if(label)label.textContent=
   out?.modes?.autopilot+' · '+view.status+
   (view.reasons.length?' · '+view.reasons.join('; '):'')+
   ' · FD CAPT '+(view.fd.captain?'SHOW':'HIDDEN')+
   ' · FD FO '+(view.fd.firstOfficer?'SHOW':'HIDDEN');
 }
 function releaseDirector(){
  if(owner)for(const topic of ['afds.director1','afds.director2'])
   try{owner.publish(topic,{enabled:false,source:'SCENARIO_STOPPED'},
     {quality:'UNKNOWN',origin:'TRAINING_SCENARIO',reason:'SCENARIO_STOPPED'});}catch(_){}
 }
 function follow(frame){
  const out=mcp(),res=guidance(frame,out);
  if(!res)return {actions:[],status:'NO_FCC'};
  return {actions:res.actions,altAcquireConfirmed:res.altAcquireConfirmed,
   altitudeHoldConfirmed:res.altitudeHoldConfirmed,status:res.status,
   reasons:res.reasons,fd:res.fd};
 }
 function disconnect(reason,source='SIMULATED_FCC'){
  const current=mcp();
  if(!/^(CMD|CWS)_[AB]$/.test(current?.modes?.autopilot||''))return false;
  const result=win.B737McpAFDSBridgeV1?.disconnectConfirmed?.({
   reason,source,confirmed:true});
  if(result?.lastAutopilotDisengagement?.reason===reason){
   lastAp={reason,source,timeMs:Date.now()};
   win.dispatchEvent(new CustomEvent('b737:autopilot-disengaged',{
    detail:{schema:'B737_AP_DISENGAGEMENT_V1',...lastAp}}));
   const label=by('flightFccDisconnect');if(label)label.textContent=reason;
   return true;
  }
  return false;
 }
 function protectFlight(frame){
  const now=Date.now();if(now-lastProtectionMs<200)return;
  lastProtectionMs=now;
  const a=mcp();if(!/^(CMD|CWS)_[AB]$/.test(a?.modes?.autopilot||''))return;
  const hyd=win.B737ISNCockpitV1?.getPropulsionSnapshot?.();
  // System-specific hydraulic failure is provided only by source-observed
  // hydraulic data. A simulated <500 PSI threshold is not an AFM trip value.
  const hydraulicSignal=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('hydraulics.state');
  const measured=hydraulicSignal?.quality==='VALID'?hydraulicSignal.value:null;
  const systemA=measured?.systemA?.pressurePsi;
  const systemB=measured?.systemB?.pressurePsi;
  const hydVerified=Number.isFinite(systemA)&&Number.isFinite(systemB);
  const raSignal=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('airdata.radioAltitude1');
  const obs={radioAltitudeFt:frame?.radioAltitudeFt??null,
   hydraulicAAvailable:faults.hydA?false:hydVerified?systemA>=500:null,
   hydraulicBAvailable:faults.hydB?false:hydVerified?systemB>=500:null,
   hydraulicsVerified:faults.hydA||faults.hydB||hydVerified,
   leftIrsFault:faults.irsL,rightIrsFault:faults.irsR,
   irsVerified:faults.irsL||faults.irsR,
   criticalSensorFailureVerified:faults.criticalSensor,
   criticalSensorFailed:faults.criticalSensor,
   raFailureVerified:faults.radioAlt||
    raSignal?.quality==='INVALID'&&raSignal.reason==='RADIO_ALTIMETER_FAILED',
   radioAltimeterInoperative:faults.radioAlt||
    raSignal?.quality==='INVALID'&&raSignal.reason==='RADIO_ALTIMETER_FAILED'};
  const v=Protection.evaluate(protect,a,obs,now);protect=v.state;
  if(v.disengage)disconnect(v.reason);
 }
 function confirmedHardware(reason,extra={}){
  const frame=flight(),output=mcp();
  if(!output)return false;
  const input={...extra,radioAltitudeFt:frame?.radioAltitudeFt??null,
    hardware:{source:'COCKPIT_HARDWARE',reason,confirmed:true}};
  const result=Protection.evaluate(protect,output,input,Date.now());
  protect=result.state;
  return result.disengage&&disconnect(result.reason,'COCKPIT_HARDWARE');
 }
 function mount(){
  const dlg=by('flightScenarioDialog');
  if(!dlg||by('flightFccPanel'))return;
  const panel=doc.createElement('section');panel.id='flightFccPanel';
  panel.innerHTML=`
   <div class="flight-heading">FCC / AFDS · FCOM CHAPTER 4</div>
   <p class="flight-sub" id="flightFccStatus">FCC source awaiting MCP and scenario.</p>
   <p class="flight-sub">FD bars require the pilot's F/D switch ON, a valid pitch command and a valid roll command. CWS axis guidance retracts. CMD drives the aircraft; F/D-only modes draw guidance without moving it. No route/LOC/GS capture is inferred.</p>
   <div class="flight-actions">
    <button type="button" id="flightFccYokeDisconnect">YOKE A/P DISCONNECT</button>
    <button type="button" id="flightFccTrimDisconnect">CONTROL WHEEL TRIM</button>
    <button type="button" id="flightFccTogaDisconnect">TO/GA TEST (RA &lt; 2000)</button>
   </div>
   <details><summary>AP protection failures · instructor tests</summary>
    <label><input type="checkbox" data-fcc-fault="hydA"> HYDRAULIC SYS A PRESSURE LOST</label>
    <label><input type="checkbox" data-fcc-fault="hydB"> HYDRAULIC SYS B PRESSURE LOST</label>
    <label><input type="checkbox" data-fcc-fault="irsL"> LEFT IRS FAULT</label>
    <label><input type="checkbox" data-fcc-fault="irsR"> RIGHT IRS FAULT</label>
    <label><input type="checkbox" data-fcc-fault="criticalSensor"> CRITICAL FCC SENSOR FAILURE</label>
    <label><input type="checkbox" data-fcc-fault="radioAlt"> RADIO ALTIMETER FAILED (2 s after LOC+GS capture)</label>
   </details>
   <p class="flight-sub" role="status" id="flightFccDisconnect">A/P disengagement: no event</p>
  `;
  const anchor=by('flightGaugeBridgePanel')||by('flightAtPanel')||by('flightTelemetry');
  if(anchor)anchor.after(panel);else dlg.append(panel);
  by('flightFccYokeDisconnect').addEventListener('click',()=>confirmedHardware('CONTROL_WHEEL_AP_DISCONNECT'));
  by('flightFccTrimDisconnect').addEventListener('click',()=>confirmedHardware('CONTROL_WHEEL_TRIM'));
  by('flightFccTogaDisconnect').addEventListener('click',()=>confirmedHardware('TOGA_BELOW_2000_RA'));
  for(const input of panel.querySelectorAll('[data-fcc-fault]'))
   input.addEventListener('change',()=>{faults[input.dataset.fccFault]=input.checked;
    protectFlight(flight());});
 }
 win.addEventListener('b737:flight-scenario-state',e=>{
  const frame=e.detail;
  if(frame?.schema!=='B737_FLIGHT_SCENARIO_STATE_V1'||!isActive())return;
  paintDirector(frame);protectFlight(frame);
 });
 win.addEventListener('b737:mcp-afds-state',()=>{
  const frame=flight();if(frame)paintDirector(frame);
 });
 win.addEventListener('b737:flight-scenario-stopped',()=>{
  releaseDirector();fcc=Guidance.createState();protect=Protection.initial();last=null;
 });
 win.addEventListener('b737:afds-hardware-disconnect',e=>{
  if(e.detail?.source==='MCP_HARDWARE'&&e.detail?.reason==='AP_DISENGAGE_BAR_DOWN')
   confirmedHardware('AP_DISENGAGE_BAR_DOWN');
 });
 win.addEventListener('b737:pilot-ap-disconnect',e=>{
  if(e.detail?.confirmed===true&&e.detail?.source==='COCKPIT_HARDWARE')
   confirmedHardware('CONTROL_WHEEL_AP_DISCONNECT');
 });
 win.addEventListener('b737:pilot-trim-command',e=>{
  if(e.detail?.confirmed===true&&e.detail?.source==='COCKPIT_HARDWARE')
   confirmedHardware('CONTROL_WHEEL_TRIM');
 });
 win.addEventListener('b737:stab-trim-autopilot-cutout',e=>{
  if(e.detail?.confirmed===true&&e.detail?.position==='CUTOUT')
   confirmedHardware('STAB_TRIM_AUTOPILOT_CUTOUT');
 });
 win.addEventListener('b737:toga-pressed',e=>{
  if(e.detail?.confirmed===true&&e.detail?.source==='COCKPIT_HARDWARE')
   confirmedHardware('TOGA_BELOW_2000_RA',{touchdown:e.detail?.touchdown===true});
 });
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.addEventListener('b737:cockpit-mounted',mount);
 win.B737UnifiedFccFlightV1=Object.freeze({
  VERSION,follow,getState:()=>({fcc:clone(fcc),protection:clone(protect),last:clone(last),
   lastDisengagement:lastAp?{...lastAp}:null,sourceError,faults:{...faults}}),
  disconnectConfirmed:confirmedHardware,protectionSample:sample=>{
   const result=Protection.evaluate(protect,mcp(),sample,Date.now());
   protect=result.state;
   return result.disengage?disconnect(result.reason):false;
  }});
})(window);
