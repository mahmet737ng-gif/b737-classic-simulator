/* Live TAT probe trainer in Unified. Additive only; OH15 graphics and the
 * momentary TAT button are owned by the locked overhead assembly.
 * P18-3 C5 is shared with CB Panel Lab through its persisted snapshot.
 */
(function(){'use strict';
 const Core=window.B737TATProbeV1,CbLink=window.B737TatCbLinkV1;
 if(!Core){console.error('TAT core unavailable');return;}
 const CB_KEY='b737classic.cb.v1',FAULT_KEY='b737.tat-probe.faults.v1',TRAIN_KEY='b737.tat-probe.training-power.v1';
 // The cockpit boots cold and dark. As with Window Heat, TAT training supply
 // defaults ON for standalone classroom switch checks; OFF restores actual
 // Main Bus 2 heater / DC1 annunciator gating with no invented aircraft feed.
 let state=Core.initialState(),pressed=false,trainingPower=true,output=null,child=null,ui=null;
 try{trainingPower=localStorage.getItem(TRAIN_KEY)!=='0';}catch{}
 try{
  const f=JSON.parse(localStorage.getItem(FAULT_KEY)||'{}');
  for(const id of Core.FAULTS)if(typeof f[id]==='boolean')state=Core.injectFault(state,id,f[id]);
 }catch{}
 const frame=()=>document.getElementById('overheadFrame');
 function readLive(){
  try{
   const p=window.B737ISNCockpitV1,st=p?.getStartState?.(),e=st?.electrical;
   const bus=e&&typeof e==='object'&&Object.prototype.hasOwnProperty.call(e,'main2')?e:p?.getState?.()?.state?.electrical?.bus||null;
   const envelope=st?.runningEnvelope;
   const ground=typeof envelope?.onGround==='boolean'?envelope.onGround:
    p?.getState?.()?.state?.context?.onGround;
   return {buses:bus,onGround:typeof ground==='boolean'?ground:null};
  }catch{return {buses:null,onGround:null};}
 }
 function switches(){
  try{return frame()?.contentWindow?.B737OverheadToggles?.getState?.()||{};}
  catch{return {};}
 }
 function breakers(){
  const out={};
  try{const snapshot=JSON.parse(localStorage.getItem(CB_KEY)||'{}');
   for(const cb of snapshot.breakers||[])if(cb.pulled||cb.tripped)out[cb.id]=false;
  }catch{}
  return out;
 }
 function cbStatus(){
  try{
   const snapshot=JSON.parse(localStorage.getItem(CB_KEY)||'null');
   if(CbLink)return CbLink.read(snapshot);
   const rec=snapshot?.breakers?.find(x=>x.id===Core.CB_ID);
   return {key:Core.CB_ID,pulled:!!(rec?.pulled||rec?.tripped),tripped:!!rec?.tripped,fault:rec?.fault||null};
  }catch{return {key:Core.CB_ID,pulled:false,tripped:false,fault:null};}
 }
 function setCbPulled(pulled){
  if(typeof pulled!=='boolean'||!CbLink)return {ok:false,reason:'CB_LINK_UNAVAILABLE'};
  // If the real CB Panel Lab is open, use its own kernel: it enforces
  // fault and pull rules and persists the same shared state.
  try{
   const front=document.getElementById('cbPanelFrame')?.contentWindow?.B737_CB_LAB;
   if(front&&typeof front.setPulled==='function'){
    const ok=front.setPulled(Core.CB_ID,pulled);
    if(ok){evaluate();return {ok:true,state:cbStatus(),source:'CB_PANEL_LAB'};}
    return {ok:false,reason:'CB_KERNEL_REJECTED',state:cbStatus()};
   }
  }catch{}
  try{
   const raw=localStorage.getItem(CB_KEY);
   const existing=raw?JSON.parse(raw):null;
   const variant=JSON.parse(localStorage.getItem('b737classic.aircraft-profile.v1')||'{}').pressurization;
   const result=CbLink.setPulled(existing,pulled,variant);
   if(!result.ok)return result;
   localStorage.setItem(CB_KEY,JSON.stringify(result.snapshot));
   evaluate();return {ok:true,state:cbStatus(),source:'SHARED_CB_SNAPSHOT'};
  }catch{return {ok:false,reason:'CB_STORAGE_ERROR'};}
 }
 function project(o){
  const f=frame();if(!f)return;
  let doc;try{doc=f.contentDocument;}catch{return;}
  if(!doc?.documentElement||doc.documentElement.classList.contains('cockpit-visual-test')||
   f.contentWindow?.B737OverheadLights?.getState?.()?.lampTest)return;
  try{f.contentWindow?.postMessage({type:'b737:cockpit-command',
    action:'tat-probe-projection',lamps:{'probe-temp':o.amberOn}},location.origin);}catch{}
  const el=doc.querySelector('.mounted-light[data-light="probe-temp"]');
  if(!el)return;
  const face=o.amberOn?'ON':'OFF';
  for(const img of el.querySelectorAll('.light-face'))img.classList.toggle('active',img.dataset.frame===face);
  el.dataset.frame=face;el.dataset.state=face;
  el.dataset.tatProbeEngine='v1';
  el.setAttribute('aria-label','TEMP PROBE — '+face+' (TAT probe heat)');
 }
 function show(o){
  if(!ui)return;
  const status=ui.querySelector('#tat-status');
  if(status)status.textContent=o.status;
  for(const [id,value] of Object.entries({
   'tat-ground':o.onGround===null?'UNKNOWN':o.onGround?'GROUND':'AIR',
   'tat-switch':o.pitotAOn?'PITOT A ON':'PITOT A OFF',
   'tat-button':o.testPressed?'PRESSED':'RELEASED',
   'tat-bus':o.liveMain2===null?'UNKNOWN':o.liveMain2?'ON':'OFF',
   'tat-cb':o.cbClosed?'IN':'OUT',
   'tat-heat':o.heaterPower?'HEATING':'OFF',
   'tat-indicator-feed':o.lampPower?'POWERED':'UNPOWERED',
   'tat-ground-inhibit':o.groundIndicationBypass?'ACTIVE':'INACTIVE',
   'tat-lamp':o.amberOn?'AMBER ON':'OFF'
  })){
   const node=ui.querySelector('#'+id);if(node)node.textContent=value;
  }
 }
 function evaluate(){
  const live=readLive();
  output=Core.evaluate(state,{...live,switches:switches(),breakers:breakers(),
    testPressed:pressed,trainingPower});
  project(output);show(output);
  return output;
 }
 function fault(id,active){
  state=Core.injectFault(state,id,active);
  try{localStorage.setItem(FAULT_KEY,JSON.stringify(state.faults));}catch{}
  evaluate();
 }
 function setTrainingPower(active){
  if(typeof active!=='boolean')throw Error('TAT training power expects boolean');
  trainingPower=active;
  try{localStorage.setItem(TRAIN_KEY,active?'1':'0');}catch{}
  const input=ui?.querySelector('#tat-training-power');if(input)input.checked=active;
  evaluate();
 }
 function onMessage(e){
  if(e.origin!==location.origin||e.source!==frame()?.contentWindow||
      e.data?.type!=='b737:cockpit-overhead'||
      e.data?.kind!=='recessed-button'||e.data?.id!=='pitot-static-tat-test')return;
  pressed=e.data.pressed===true;evaluate();
 }
 function attachFrame(){
  let w;try{w=frame()?.contentWindow;}catch{}
  if(w&&w!==child){
   child=w;pressed=false;
   w.addEventListener('b737:switch-change',e=>{
    if(e.detail?.id==='pitot-a')evaluate();
   });
   w.addEventListener('b737:overhead-light-state',()=>{
    if(output)project(output);
   });
  }
 }
 function mountLab(){
  const lab=document.getElementById('windowHeatTestLabDialog');
  if(!lab||lab.querySelector('#tat-probe-system-v1'))return;
  ui=document.createElement('section');ui.id='tat-probe-system-v1';ui.dir='ltr';
  ui.style.cssText='padding:12px;margin:16px 0 2px;border:1px solid #5d7887;border-radius:9px;color:inherit;font:12px/1.5 sans-serif';
  ui.innerHTML='<h3 style="margin:0 0 8px">TAT PROBE HEAT · FCOM 3.10.4 / MRG</h3>'+
   '<p style="margin:0 0 9px">GROUND: with PITOT A OFF, TEMP PROBE is amber. Hold TAT TEST to energize the heater and extinguish amber (if healthy); release returns amber. With PITOT A ON, the TAT heater remains inhibited on ground BUT TEMP PROBE is dark. TAT TEST overrides ground inhibit to check real current. No timer.</p>'+
   '<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="tat-training-power"> TAT TRAINING SUPPLY · isolated MAIN BUS 2 + indicator DC (demo only, default ON)</label>'+
   '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">'+
    '<div>Ground: <strong id="tat-ground">—</strong></div><div>Switch: <strong id="tat-switch">—</strong></div><div>TAT TEST: <strong id="tat-button">—</strong></div>'+
    '<div>Actual MAIN2: <strong id="tat-bus">—</strong></div><div>CB P18-3 C5: <strong id="tat-cb">—</strong></div><div>Heater: <strong id="tat-heat">—</strong></div>'+
    '<div>TEMP PROBE: <strong id="tat-lamp">—</strong></div><div>Indicator DC: <strong id="tat-indicator-feed">—</strong></div>'+
    '<div>Ground inhibit: <strong id="tat-ground-inhibit">—</strong></div></div>'+
   '<p id="tat-status" role="status" style="font-weight:700;margin:10px 0">Connecting…</p>'+
   '<div style="display:flex;gap:7px;flex-wrap:wrap"><select id="tat-fault" aria-label="TAT trainer failure">'+
    '<option value="HEATER_FAIL">Heater fail</option><option value="CURRENT_SENSE_FAIL">Current detector fail</option>'+
    '<option value="INDICATOR_STUCK_ON">TEMP PROBE lamp stuck ON</option><option value="INDICATOR_STUCK_OFF">TEMP PROBE lamp stuck OFF</option></select>'+
    '<button id="tat-inject" type="button">Inject</button><button id="tat-clear" type="button">Clear</button>'+
    '<button id="tat-reset" type="button">Reset TAT faults</button></div>'+
   '<p style="margin:9px 0 0;font-size:11px">CB: <a href="../../cb-panel-lab/" target="_blank" rel="noopener">P18-3 / C5 TEMP PROBE</a>. Pull/push from CB Panel Lab and return to Unified.</p>';
  lab.append(ui);
  const power=ui.querySelector('#tat-training-power');
  power.checked=trainingPower;
  power.onchange=()=>setTrainingPower(!!power.checked);
  ui.querySelector('#tat-inject').onclick=()=>fault(ui.querySelector('#tat-fault').value,true);
  ui.querySelector('#tat-clear').onclick=()=>fault(ui.querySelector('#tat-fault').value,false);
  ui.querySelector('#tat-reset').onclick=()=>{state=Core.initialState();try{localStorage.setItem(FAULT_KEY,'{}');}catch{}evaluate();};
 }
 function boot(){
  mountLab();attachFrame();evaluate();
  window.addEventListener('message',onMessage);
  window.addEventListener('storage',e=>{
   if(e.key===CB_KEY)evaluate();
   if(e.key===FAULT_KEY){try{
    const values=JSON.parse(e.newValue||'{}');
    for(const id of Core.FAULTS)state=Core.injectFault(state,id,!!values[id]);
   }catch{}evaluate();}
   if(e.key===TRAIN_KEY){trainingPower=e.newValue==='1';const box=ui?.querySelector('#tat-training-power');if(box)box.checked=trainingPower;evaluate();}
  });
  frame()?.addEventListener('load',()=>{pressed=false;attachFrame();evaluate();});
  setInterval(()=>{attachFrame();evaluate();},250);
 }
 window.B737TATProbeUnifiedV1=Object.freeze({
  getOutput:()=>output,getState:()=>state,injectFault:fault,setTrainingPower,
  getCbState:cbStatus,setCbPulled,
  evaluate,cbId:Core.CB_ID,reset:()=>{state=Core.initialState();pressed=false;try{localStorage.setItem(FAULT_KEY,'{}');}catch{}evaluate();}
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
