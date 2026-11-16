/* Unified A/T SPEED -> shared ISN-18 ENG 1+2 -> flight speed feedback v1.
 * The MCP mode core is authoritative. Never energize a stopped engine or
 * manufacture indications. Instructor RUNNING preset requires explicit click.
 */
(function(win){
 'use strict';
 const Servo=win.B737AutothrottleSpeedServoV1,VERSION='UNIFIED_AT_ENGINE_BRIDGE_0001';
 if(!Servo){win.console?.error('A/T servo dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 let state=Servo.initial(),last=0,lastUi=0,manualOverride=false,errors=[],lastCommands={};
 const clone=x=>JSON.parse(JSON.stringify(x));
 function activeMode(m){
  return m?.power===true&&m.controls?.atArm===true&&m.modes?.thrust==='SPEED';
 }
 function getSources(){
  const mcp=win.B737McpAFDSBridgeV1?.getOutput?.()||null;
  const scenario=win.B737UnifiedFlightScenarioV1;
  const status=scenario?.getDiagnostics?.();
  const flight=status?.active===true?scenario.getState?.():null;
  const owner=win.B737ISNCockpitV1;
  const chain=owner?.getStartState?.(),ecu=owner?.getECUState?.();
  const engines={};
  for(const n of [1,2]){
   const id='engine'+n;
   engines[id]={running:chain?.phase?.[id]==='RUNNING',
    n1Percent:ecu?.engines?.[id]?.n1Percent??null,
    throttle:chain?.runningEnvelope?.throttle?.[id]??null};
  }
  // When the Scenario Lab is not running, accept only a VALID ADC source.
  // The external producer remains responsible for moving IAS in that case.
  const adc=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('airdata.adc1');
  const ias=Number.isFinite(flight?.iasKt)?flight.iasKt:
   adc?.quality==='VALID'?(adc.value?.iasKt??adc.value?.casKt):null;
  return {mcp,flight:{iasKt:ias,vsFpm:flight?.vsFpm??0},
   engines,scenarioActive:status?.active===true,paused:status?.paused===true,
   ecu,owner};
 }
 function notify(){
  win.dispatchEvent(new CustomEvent('b737:autothrottle-speed-state',{detail:clone(state)}));
 }
 function tick(){
  const now=performance.now();
  const dt=last?Math.min(.5,Math.max(0,(now-last)/1000)):.2;
  last=now;
  const src=getSources();
  if(!activeMode(src.mcp)){manualOverride=false;lastCommands={};}
  try{
   state=Servo.step(state,{dtSec:dt,mcp:src.mcp,flight:src.flight,
    engines:src.engines,paused:src.paused,inhibited:manualOverride});
   if(state.active){
    if(typeof src.owner?.autoThrottleCommand!=='function'){
     state={...state,active:false,reason:'ISN18_THROTTLE_INTERFACE_MISSING',commands:[]};
    }else for(const command of state.commands){
     if(Math.abs(command.throttle-(lastCommands[command.engine]??-1))<.008)continue;
     const result=src.owner.autoThrottleCommand({
      engine:command.engine,value:command.throttle,controller:Servo.VERSION});
     if(result?.accepted!==true){
      state={...state,active:false,reason:result?.reason||'ENGINE_THROTTLE_REJECTED',commands:[]};
      break;
     }
     lastCommands[command.engine]=command.throttle;
     const number=command.engine==='engine1'?1:2;
     // This is a photo sprite only. The real ECU has already accepted the
     // continuous throttle; visually it is quantized to five photo stages.
     doc.dispatchEvent(new CustomEvent('b737:throttle-state',{detail:{
      engine:number,percent:command.throttle*100,source:'A/T SPEED',visualOnly:true}}));
    }
   }
  }catch(error){
   const message=String(error?.message||error);
   if(errors.at(-1)!==message){errors.push(message);if(errors.length>12)errors.shift();}
   state={...state,active:false,reason:'A/T_COMMAND_ERROR: '+message,commands:[]};
  }
  if(now-lastUi>350){paint(src);lastUi=now;}
  notify();
 }
 function modeLabel(src){
  if(!src?.mcp)return 'MCP OFF / NO DATA';
  if(state.reason==='NO_RUNNING_ENGINES')return 'NO RUNNING ENGINES — A/T INHIBITED';
  if(state.reason==='MANUAL_OVERRIDE')return 'MANUAL OVERRIDE — DESELECT & RESELECT SPEED';
  if(state.reason==='AT_SPEED_ACTIVE')return 'A/T SPEED ACTIVE';
  if(state.reason==='AT_SPEED_SINGLE_ENGINE_TRAINING')return 'A/T SPEED / SINGLE ENGINE DEGRADED';
  return state.reason.replaceAll('_',' ');
 }
 function paint(src){
  const label=by('flightAtStatus');
  if(!label)return;
  label.textContent=modeLabel(src);
  label.dataset.active=state.active?'true':'false';
  const n=v=>Number.isFinite(v)?v.toFixed(1):'—';
  const data={
   Target:Number.isFinite(state.targetKt)?Math.round(state.targetKt)+' kt':'—',
   IAS:n(src.flight.iasKt)+' kt',
   Delta:Number.isFinite(state.errorKt)?(state.errorKt>=0?'+':'')+n(state.errorKt)+' kt':'—',
   CmdN1:n(state.demandN1)+'%',
   N1A:n(src.engines.engine1.n1Percent)+'%',
   N1B:n(src.engines.engine2.n1Percent)+'%',
   THRA:src.engines.engine1.running?n(src.engines.engine1.throttle*100)+'%':'ENG OFF',
   THRB:src.engines.engine2.running?n(src.engines.engine2.throttle*100)+'%':'ENG OFF'
  };
  for(const [k,value] of Object.entries(data)){
   const p=by('flightAt'+k);
   if(p)p.textContent=value;
  }
  const preset=by('flightAtInstructorRun');
  if(preset)preset.disabled=!src.owner?.engineTrainerAction||
   src.engines.engine1.running&&src.engines.engine2.running;
 }
 function renderPanel(){
  const d=by('flightScenarioDialog');
  if(!d||by('flightAtPanel'))return;
  const section=doc.createElement('section');
  section.id='flightAtPanel';section.className='flight-at-panel';
  section.innerHTML=`
    <div class="flight-heading">A/T COMPUTER · ENGINE THRUST SERVO</div>
    <p class="flight-at-mode" id="flightAtStatus" role="status">MCP / ECU NOT READY</p>
    <div class="flight-telemetry">
     <div><span>MCP SPEED TARGET</span><strong id="flightAtTarget">—</strong></div>
     <div><span>MEASURED IAS</span><strong id="flightAtIAS">—</strong></div>
     <div><span>SPEED ERROR</span><strong id="flightAtDelta">—</strong></div>
     <div><span>DEMANDED N1*</span><strong id="flightAtCmdN1">—</strong></div>
     <div><span>ENGINE 1 N1</span><strong id="flightAtN1A">—</strong></div>
     <div><span>ENGINE 2 N1</span><strong id="flightAtN1B">—</strong></div>
     <div><span>THROTTLE 1</span><strong id="flightAtTHRA">—</strong></div>
     <div><span>THROTTLE 2</span><strong id="flightAtTHRB">—</strong></div>
    </div>
    <div class="flight-actions">
      <button type="button" id="flightAtInstructorRun">SET BOTH ENGINES RUNNING · INSTRUCTOR</button>
    </div>
    <p class="flight-sub">Requires running engines, MCP electrical power, A/T ARM and active SPEED mode. Moving the MCP speed selector alone does not engage A/T. Both actual engine spools and IAS respond with lag. *N1 demand and acceleration are training-only approximations, not AFM performance.</p>
  `;
  (by('flightTelemetry')||d).after(section);
  by('flightAtInstructorRun').addEventListener('click',()=>{
   const owner=win.B737ISNCockpitV1;
   if(!owner?.engineTrainerAction)return;
   const results=[];
   for(const engine of ['engine1','engine2']){
    try{
     if(owner.getStartState()?.phase?.[engine]==='RUNNING'){results.push(engine+' already running');continue;}
     const result=owner.engineTrainerAction({type:'PRESET_RUNNING',engine,instructor:true});
     results.push(engine+(result?.accepted?' RUNNING':' REJECTED'));
    }catch(error){results.push(engine+' ERROR: '+String(error.message||error));}
   }
   const note=by('flightAtStatus');
   if(note)note.textContent=results.join(' · ');
  });
 }
 function manualIntervention(event){
  const d=event?.detail;
  if(![1,2].includes(d?.engine)&&!['engine1','engine2'].includes(d?.engine))return;
  if(!Number.isFinite(d.percent)&&!Number.isFinite(d.throttle))return;
  if(activeMode(win.B737McpAFDSBridgeV1?.getOutput?.()))manualOverride=true;
 }
 doc.addEventListener('b737:throttle-position',manualIntervention);
 win.addEventListener('b737:manual-engine-throttle',manualIntervention);
 const publicApi=Object.freeze({
  getState:()=>clone(state),getDiagnostics:()=>({version:VERSION,manualOverride,errors:[...errors]}),
  tickForTest:tick,resetManualOverride:()=>{manualOverride=false;},
  version:VERSION
 });
 win.B737UnifiedAutothrottleV1=publicApi;
 function boot(){
  renderPanel();
  win.setInterval(tick,200);
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);
