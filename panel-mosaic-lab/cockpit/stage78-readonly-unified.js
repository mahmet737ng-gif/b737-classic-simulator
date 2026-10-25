/* Read-only Unified ISM bridge for B737 Stage 7 / Stage 8.
 * Listens to the EXISTING ECU observation bus, does not move any pointer.
 * No cockpit artwork, approved sprites or legacy controls changed.
 */
(function(){
 'use strict';
 const contractsUrl=new URL('../../engine/instruments/stage8-signal-contracts-v1.json',document.currentScript.src).href;
 const policyUrl=new URL('../../engine/instruments/cold-dark-indicator-policy-v1.json',document.currentScript.src).href;
 const pointerUrl=new URL('../../engine/instruments/stage8-pointer-routing-v1.json',document.currentScript.src).href;
 const previewUrl=new URL('../../engine/instruments/stage10-preview-scale-subset-v1.json',document.currentScript.src).href;
 const engine=window.B737InstrumentSignalBridgeV1;
 const coldModel=window.B737Stage7ColdDarkV1;
 const routeModel=window.B737InstrumentPointerRoutingV1;
 const stage5=window.B737Stage5ScaleMappingV1;
 const stage9=window.B737Stage9NeedleDynamicsV1;
 const stage10=window.B737Stage10NeedleWorkbenchV1;
 let bridge=null,cold=null,pointerRouter=null,motionWorkbench=null,ecu=null,observed={},conditions={},selectors={},signals=null,initial=null,pointerSignals=null,motionPreview=null;
 let lastError=null;
 const countStatus=()=>{
  if(!bridge)return {status:'loading',reason:lastError};
  return {status:'read_only',systemChannels:signals?.stats?.channels??62,
   qualifiedTraining:signals?.stats?.training??0,
   independentlyObserved:signals?.stats?.observed??0,
   sourceMissing:signals?.stats?.missing??0,
   perGaugePowerFeedsVerified:0,
   liveNeedlesUpdated:0,
   geometryGate:'ALL_UNAPPROVED',
   motionPrepared:motionWorkbench?.getPreparedModels().count??0,
   motionEvaluated:motionPreview?.counts?.dynamicsEvaluated??0,
   motionOutput:'QA_PREVIEW_ONLY_ALL_LIVE_NEEDLES_BLOCKED'};
 };
 const show=()=>{
  const container=document.querySelector('#stage78ReadOnlyQA');
  if(!container)return;
  const count=countStatus();
  const output=container.querySelector('output');
  if(output)output.textContent=bridge?
   'Stage 7/8 · '+(signals?.stats?.faces??54)+' gauges · '+
    (signals?.stats?.training??0)+' training channels · '+
    (signals?.stats?.missing??0)+' missing · '+
    '0 needles released · '+(motionPreview?.counts?.geometryPreviewCapable??0)+
    ' motion models · Stage 9/10: QA only · no sprite writes':
   'Stage 7/8 unavailable: '+String(lastError??'waiting for contracts');
 };
 const mount=()=>{
  const box=document.querySelector('.inspector');
  if(!box||document.querySelector('#stage78ReadOnlyQA'))return;
  const area=document.createElement('section');
  area.id='stage78ReadOnlyQA';
  const h=document.createElement('h2');h.textContent='ISM · Instrument Signals QA';
  const note=document.createElement('p');note.className='muted';
  note.textContent='Read-only numerical state · original needle artwork unchanged; electrical LRU feeds and photo calibration still require QA.';
  const out=document.createElement('output');out.style.display='block';out.dir='ltr';
  area.append(h,note,out);box.append(area);show();
 };
 const derivedContext=()=>{
  const ground=typeof window.B737GroundAirfieldContext==='function'?
      window.B737GroundAirfieldContext():null;
  const pressure=window.B737PressurizationIntegration;
  let cabinPhysical=null,selected=null;
  try{
   selected=pressure?.getSelected?.()??null;
   const snap=pressure?.read?.(selected);
   if(snap?.physical?.status==='PROVISIONAL_TRAINING_PHYSICS_NOT_AIRCRAFT_VALIDATED')
     cabinPhysical={...snap.physical,source:'PROVISIONAL_IDEAL_GAS_TRAINER'};
  }catch(_){ /* optional physical plant may not be initialized yet */ }
  const motorOff={};
  for(const n of [1,2]){
   const e=ecu?.engines?.['engine'+n];
   motorOff['engine'+n]=e?.phase==='OFF'&&
     e.n1Percent===0&&e.n2Percent===0;
  }
  const noGenerator=ecu?.electrical?.selectedSources&&
    Object.values(ecu.electrical.selectedSources).every(x=>!x||x==='OFF');
  const coldDark=ecu?.electrical?.battery===false&&noGenerator===true&&
    ecu?.apu?.phase==='OFF'&&motorOff.engine1===true&&motorOff.engine2===true;
  return {
   coldDarkConfirmed:coldDark===true,
   engineStopped:motorOff,
   fieldElevationFt:Number.isFinite(ground?.fieldElevationFt)?ground.fieldElevationFt:null,
   cabinEqualized:ground?.cabinEqualized===true&&cabinPhysical!==null&&
     Number.isFinite(cabinPhysical.differentialPsid)&&Math.abs(cabinPhysical.differentialPsid)<.05,
   cabinPressureStable:ground?.cabinPressureStable===true&&cabinPhysical!==null&&
     Number.isFinite(cabinPhysical.cabinRateFtMin)&&Math.abs(cabinPhysical.cabinRateFtMin)<1,
   aircraftStationary:ecu?.aircraft?.onGround===true&&ecu?.aircraft?.iasKt===0,
   pressurizationArchitecture:selected,
   cabinPlant:cabinPhysical
  };
 };
 const refresh=()=>{
  if(!bridge)return;
  try{
   // Existing cockpit ECU emits training simulation data, never a certified sensor.
   const current=derivedContext();
   signals=bridge.read({ecu,cabinPlant:current.cabinPlant,observed,timeMs:ecu?.timeMs??null});
   const {cabinPlant,...derived}=current;
   initial=cold.evaluate({signalSnapshot:signals,conditions:{...derived,...conditions}});
   pointerSignals=pointerRouter.project(signals,{selectors});
   if(motionWorkbench)motionPreview=motionWorkbench.evaluate(pointerSignals,{
    nowMs:typeof performance!=='undefined'&&typeof performance.now==='function'?
       performance.now():ecu?.timeMs??null
   });
   lastError=null;
  }catch(err){lastError=err.message;signals=null;initial=null;}
  mount();show();
 };
 const api=Object.freeze({
  getStatus:()=>Object.freeze(countStatus()),
  getSignals:()=>signals,
  getColdDarkState:()=>initial,
  getPointerSignals:()=>pointerSignals,
  getMotionPreview:()=>motionPreview,
  setExplicitContext(value){
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Explicit initial-state context object required');
   conditions={...value};refresh();return initial;
  },
  setPointerSelectors(value){
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Pointer selector map required');
   selectors={...value};refresh();return pointerSignals;
  },
  setValidatedObservations(value){
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Explicit sensor envelope required');
   observed=value;refresh();return signals;
  }
 });
 window.B737UnifiedInstrumentSignalsV1=api;
 window.addEventListener('b737:unified-ecu-observation',event=>{
  const value=event.detail;
  if(value?.quality!=='TRAINING_SIMULATION_ONLY')return;
  ecu=value;refresh();
 });
 window.addEventListener('b737:cockpit-mounted',()=>{mount();refresh();});
 window.addEventListener('b737:pressurization-state',refresh);
 window.addEventListener('b737:ground-airfield-changed',refresh);
 window.addEventListener('b737:cold-dark-state',refresh);
 document.addEventListener('DOMContentLoaded',mount,{once:true});
 (async()=>{
  try{
   if(!engine||!coldModel||!routeModel||!stage5||!stage9||!stage10)
    throw Error('Missing stage 5/7/8/9/10 read-only engine dependencies');
   const responses=await Promise.all([fetch(contractsUrl,{cache:'no-cache'}),
       fetch(policyUrl,{cache:'no-cache'}),fetch(pointerUrl,{cache:'no-cache'}),
       fetch(previewUrl,{cache:'no-cache'})]);
   if(responses.some(r=>!r.ok))throw Error('Stage 7/8 contract fetch failed');
   const [contracts,policy,routes,scales]=await Promise.all(responses.map(r=>r.json()));
   bridge=engine.create(contracts);
   cold=coldModel.create({contracts,policy});
   pointerRouter=routeModel.create(routes);
   motionWorkbench=stage10.create({routes,scales,scaleEngine:stage5,dynamics:stage9,
    previewPowerPolicy:'training_qa_assume_power'});
   if(!ecu)ecu=window.B737ISNCockpitV1?.getECUState?.()??null;
   refresh();
  }catch(err){lastError=err.message;console.error('Stage 7/8 signal bridge:',err);show();}
 })();
})();
