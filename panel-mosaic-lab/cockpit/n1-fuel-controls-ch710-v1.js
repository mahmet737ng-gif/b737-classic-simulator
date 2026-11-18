/* EIS + Conventional physical N1 manual set, FUEL USED / RESET.
 * FCOM SHI 7.10.3-4, 7.10.6-7, 7.10.14-17. Indicators use the
 * original single ECU ledger, not a second independent fuel accumulator.
 */
(function(win){'use strict';
 const N=win.B737ClassicN1LimitCH710V1,doc=win.document;
 if(!N)return;
 let shell=null,mode='',active=false;
 const knobs={engine1:{pulled:false,setN1:90},engine2:{pulled:false,setN1:90}};
 const by=id=>doc.getElementById(id);
 const engine=()=>win.B737UnifiedEngineIndicationsV2;
 const dispatch=(type,value)=>{try{
  if(!engine()?.command)throw Error('Live engine indications unavailable');
  engine().command({type,...value});status('ENGINE ECU DISPLAY COMMAND ACCEPTED');
  }catch(e){status('ENGINE INDICATION ERROR · '+String(e.message||e),true);}};
 function status(message,error=false){if(by('ch710Status')){by('ch710Status').textContent=message;by('ch710Status').dataset.error=String(error);}}
 function context(id){
  const f=win.B737UnifiedFlightScenarioV1?.getState?.(),e=win.B737ISNCockpitV1?.getPropulsionSnapshot?.()?.engines?.[id];
  const profile=win.B737AircraftProfileStore?.get?.();
  const variant=profile?.aircraftModel==='737-400'?'22K':'20K';
  const k=knobs[id];
  return {engineVariant:variant,pressureAltitudeFt:f?.altitudeFt??0,
   ambientC:Number.isFinite(f?.ambientC)?f.ambientC:15,
   // Known state only; exact anti-ice/bleed loads require live ATA30/36.
   antiIceOn:false,bleedsOn:false,manualPulled:k.pulled,manualN1:k.setN1,
   measuredN1:e?.n1Percent??null,
   fmcReferenceN1:win.B737N1LimitFMCV1?.getState?.()?.engines?.[id]?.targetN1??null};
 }
 function paint(){
  if(!shell?.isConnected)return;
  mode=doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
  shell.dataset.mode=mode;
  for(const [id,k] of Object.entries(knobs)){
   const result=N.limit(context(id)),readout=by('ch710N1'+id),button=by('ch710Pull'+id);
   if(readout)readout.textContent=(result.referenceN1===null?'—':result.referenceN1.toFixed(1))+
     '% '+(result.source==='CREW_SELECTED'?'MAN SET':result.source==='FMC_N1_LIMIT_PAGE'?'FMC':'EST*');
   if(button)button.setAttribute('aria-pressed',String(k.pulled));
   const bug=by('ch710Bug'+id);
   if(bug){
    const spec=win.B737ISNEngineGaugeModel?.eisGauges?.find(g=>g.engine===id&&g.signal==='n1');
    if(spec&&Number.isFinite(result.referenceN1)){
     const deg=win.B737ISNEngineGaugeModel.eisAngle(spec,result.referenceN1)*Math.PI/180;
     const radius=spec.radius+6;
     bug.style.left=((spec.cx+radius*Math.sin(deg))/1235*100)+'%';
     bug.style.top=((spec.cy-radius*Math.cos(deg))/1274*100)+'%';
     bug.style.display=mode==='EIS'?'block':'none';
     bug.title='N1 reference bug · '+result.source+' · '+result.referenceN1.toFixed(1)+'%';
    }else bug.style.display='none';
   }
   win.dispatchEvent(new CustomEvent('b737:n1-reference',{detail:{engine:id,...result}}));
  }
 }
 function knob(id){
  const k=knobs[id],holder=doc.createElement('div');holder.className='ch710-n1-unit';
  holder.innerHTML='<button type="button" class="ch710-knob" aria-label="N1 manual set rotary '+id+'" title="Mouse wheel / arrow keys to set N1"></button>'+
   '<button type="button" class="ch710-pull" id="ch710Pull'+id+'" aria-pressed="false">PULL TO SET N1</button>'+
   '<output class="ch710-n1-read" id="ch710N1'+id+'"></output>';
  const rotor=holder.querySelector('.ch710-knob');
  const update=delta=>{k.setN1=Math.max(0,Math.min(120,Math.round((k.setN1+delta)*10)/10));paint();};
  rotor.addEventListener('wheel',e=>{e.preventDefault();update(e.deltaY<0?.5:-.5);},{passive:false});
  rotor.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();update(e.key==='ArrowUp'?.5:-.5);});
  rotor.addEventListener('click',()=>{k.pulled=true;paint();});
  holder.querySelector('.ch710-pull').addEventListener('click',()=>{k.pulled=!k.pulled;paint();});
  return holder;
 }
 function mount(){
  const piece=doc.querySelector('#region-main .texture-piece[data-piece="engine"]');
  if(!piece)return;
  if(shell?.parentNode!==piece){
   shell?.remove();shell=doc.createElement('section');shell.id='ch710PhysicalControls';
   shell.className='ch710-panel';shell.setAttribute('aria-label','B737 engine N1 and Fuel Used controls');
   for(const id of ['engine1','engine2'])shell.append(knob(id));
   const fuel=doc.createElement('div');fuel.className='ch710-fuel-controls';
   fuel.innerHTML='<button type="button" id="ch710FuelUsed">PUSH FUEL USED</button>'+
    '<button type="button" id="ch710FuelReset">RESET FUEL USED</button>'+
    '<button type="button" id="ch710FuelRate">RATE</button>'+
    '<output id="ch710Status" aria-live="polite">CH7.10 · FUEL FLOW / USED</output>';
   shell.append(fuel);
   for(const id of ['engine1','engine2']){
    const bug=doc.createElement('div');bug.id='ch710Bug'+id;bug.className='ch710-n1-bug';
    bug.setAttribute('aria-label','N1 yellow reference bug '+id);shell.append(bug);
   }
   piece.append(shell);
   by('ch710FuelUsed').addEventListener('click',()=>dispatch('FUEL_MODE',{value:'USED'}));
   by('ch710FuelReset').addEventListener('click',()=>dispatch('RESET_FUEL_USED',{}));
   by('ch710FuelRate').addEventListener('click',()=>dispatch('FUEL_MODE',{value:'RATE'}));
  }
  paint();
 }
 for(const ev of ['b737:cockpit-mounted','b737:engine-indications-live-v2'])win.addEventListener(ev,()=>{
  if(!shell?.isConnected)mount();else paint();
 });
 doc.addEventListener('DOMContentLoaded',mount,{once:true});
 if(doc.readyState!=='loading')mount();
 win.B737N1FuelControlsCH710V1=Object.freeze({mount,paint,
  getState:()=>({mode,knobs:JSON.parse(JSON.stringify(knobs))}),
  setManual:(id,pulled,n1)=>{if(!knobs[id]||typeof pulled!=='boolean'||!Number.isFinite(n1))return false;
   knobs[id]={pulled,setN1:Math.max(0,Math.min(120,n1))};paint();return true;}});
})(window);
