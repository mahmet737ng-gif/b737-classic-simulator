/* Read-only Unified ISM bridge for B737 Stage 7 / Stage 8.
 * Listens to the EXISTING ECU observation bus, does not move any pointer.
 * No cockpit artwork, approved sprites or legacy controls changed.
 */
(function(){
 'use strict';
 const contractsUrl=new URL('../../engine/instruments/stage8-signal-contracts-v1.json',document.currentScript.src).href;
 const policyUrl=new URL('../../engine/instruments/cold-dark-indicator-policy-v1.json',document.currentScript.src).href;
 const engine=window.B737InstrumentSignalBridgeV1;
 const coldModel=window.B737Stage7ColdDarkV1;
 let bridge=null,cold=null,ecu=null,observed={},conditions={},signals=null,initial=null;
 let lastError=null;
 const countStatus=()=>{
  if(!bridge)return {status:'loading',reason:lastError};
  return {status:'read_only',systemChannels:signals?.stats?.channels??62,
   qualifiedTraining:signals?.stats?.training??0,
   independentlyObserved:signals?.stats?.observed??0,
   sourceMissing:signals?.stats?.missing??0,
   perGaugePowerFeedsVerified:0,
   liveNeedlesUpdated:0,
   geometryGate:'ALL_UNAPPROVED'};
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
    '0 needles released · unknown instrument-specific wiring':
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
 const refresh=()=>{
  if(!bridge)return;
  try{
   // Existing cockpit ECU emits training simulation data, never a certified sensor.
   signals=bridge.read({ecu,observed,timeMs:ecu?.timeMs??null});
   initial=cold.evaluate({signalSnapshot:signals,conditions});
   lastError=null;
  }catch(err){lastError=err.message;signals=null;initial=null;}
  mount();show();
 };
 const api=Object.freeze({
  getStatus:()=>Object.freeze(countStatus()),
  getSignals:()=>signals,
  getColdDarkState:()=>initial,
  setExplicitContext(value){
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Explicit initial-state context object required');
   conditions={...value};refresh();return initial;
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
 window.addEventListener('b737:cockpit-mounted',mount);
 document.addEventListener('DOMContentLoaded',mount,{once:true});
 (async()=>{
  try{
   if(!engine||!coldModel)throw Error('Missing stage 7/8 adapter scripts');
   const responses=await Promise.all([fetch(contractsUrl,{cache:'no-cache'}),
       fetch(policyUrl,{cache:'no-cache'})]);
   if(responses.some(r=>!r.ok))throw Error('Stage 7/8 contract fetch failed');
   const [contracts,policy]=await Promise.all(responses.map(r=>r.json()));
   bridge=engine.create(contracts);
   cold=coldModel.create({contracts,policy});
   if(!ecu)ecu=window.B737ISNCockpitV1?.getECUState?.()??null;
   refresh();
  }catch(err){lastError=err.message;console.error('Stage 7/8 signal bridge:',err);show();}
 })();
})();
