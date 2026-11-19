(async()=>{
;
/* ../../fire-protection-lab/thermal-trainer.js?v=P8-THERMAL-0001 */
try{
/* Independent, deterministic P8 equipment and compartment simulation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737FireThermalTrainer=api;
})(globalThis,()=>{
'use strict';
// Bounded instructor training points. The selected Classic detector
// installation and its measured setpoints are not specified by the FCOM.
const thresholds=Object.freeze({overheat:180,fire:260,releaseMargin:10});
const cbNames=Object.freeze({
 'engine1.fireDetector':'P6-2 A24 · Engine 1 Fire Detection',
 'engine2.fireDetector':'P6-2 A22 · Engine 2 Fire Detection',
 'apu.fireDetector':'P6-2 A23 · APU Fire Detection',
 'fire.wheelWellDetector':'P6-2 B24 · Wheel-Well Detection',
 'warning.masterFireControl':'P6-2 B23 · Master Fire',
 'warning.aural':'P6-2 D22 · Aural Warning',
 'fire.extinguisherL':'P6-2 C24 · Left Bottle',
 'fire.extinguisherLAlternate':'P6-2 D24 · Left Bottle Alternate',
 'fire.extinguisherR':'P6-2 C22 · Right Bottle',
 'fire.extinguisherRAlternate':'P6-2 D23 · Right Bottle Alternate',
 'fire.extinguisherAPU':'P6-2 C23 · APU Bottle'
});
const initial={ENG1:{temperature:100,n1:85,n2:94,egt:560,oil:91},ENG2:{temperature:100,n1:85,n2:94,egt:560,oil:91},
 APU:{temperature:90,n1:100,n2:null,egt:410,oil:null}};
const toward=(value,target,rate,time)=>value+Math.sign(target-value)*Math.min(Math.abs(target-value),rate*time);
function level(celsius,prior){
 if(celsius>=thresholds.fire||prior==='FIRE'&&celsius>=thresholds.fire-thresholds.releaseMargin)return 'FIRE';
 if(celsius>=thresholds.overheat||prior!=='NORMAL'&&celsius>=thresholds.overheat-thresholds.releaseMargin)return 'OVHT';
 return 'NORMAL';
}
function create(Fire){
 const opened=new Set();
 const fire=Fire.createEngine(undefined,{available:key=>!opened.has(key)});
 let equipment,clearCaution=false,falseCue=null,falseAcknowledged=false;
 function reset(){
  opened.clear();fire.dispatch({type:'RESET'});clearCaution=false;falseCue=null;falseAcknowledged=false;
  equipment=Object.fromEntries(Object.entries(initial).map(([id,start])=>[id,{...start,target:start.temperature,stage:'NORMAL',stopped:false}]));
 }
 reset();
 function setTemperature(id,celsius){
  if(!Object.hasOwn(equipment,id)||!Number.isFinite(celsius)||celsius<20||celsius>650)return false;
  equipment[id].target=celsius;return true;
 }
 function faultCue(cue){
  if(![null,'HANDLE','OVERHEAT','BELL'].includes(cue))throw RangeError('Unknown warning cue');
  falseCue=cue;falseAcknowledged=false;
 }
 function setBreaker(key,closed){
  if(!Object.hasOwn(cbNames,key))throw RangeError('Unknown breaker');
  if(closed)opened.delete(key);else opened.add(key);
 }
 function evaluate(){
  const d=fire.evaluate();
  if(!falseCue)return d;
  const indications={...d.indications},activeFire={...d.activeFire};
  if(falseCue==='HANDLE')activeFire.ENG1=indications.ENG1_FIRE=fire.getState().power.batteryBus&&!opened.has('engine1.fireDetector');
  if(falseCue==='OVERHEAT'&&fire.getState().power.batteryBus&&!opened.has('engine1.fireDetector')){
   indications.ENG1_OVERHEAT=indications.OVHT_DET=indications.MASTER_CAUTION=true;
  }
  if(falseCue==='BELL'&&fire.getState().power.batteryBus&&!opened.has('warning.aural')&&!falseAcknowledged)indications.FIRE_BELL=true;
  return {...d,indications,activeFire};
 }
 function dispatch(command){
  const result=fire.dispatch(command);
  if(command.type==='BELL_CUTOUT')falseAcknowledged=true;
  return result;
 }
 function tick(seconds){
  const before=fire.getState();
  if(Object.values(before.pending).some(value=>value!==null)||Object.values(before.handles).some(h=>h.pulled&&h.angle))
   dispatch({type:'TICK',seconds});
  const state=fire.getState(),outputs=fire.evaluate().outputs;
  for(const [id,unit] of Object.entries(equipment)){
   const start=initial[id],isolated=outputs[id].fuelShutoff;
   if(isolated)unit.stopped=true;
   if(Object.keys(state.bottles).some(b=>state.bottles[b]&&!before.bottles[b]&&state.dischargedTo[b]===id))unit.target=start.temperature;
   unit.temperature=toward(unit.temperature,unit.target,unit.target>unit.temperature?36:47,seconds);
   const next=level(unit.temperature,unit.stage);
   if(next!==unit.stage){
    unit.stage=next;
    if(id!=='APU')dispatch({type:'SET_OVERHEAT',unit:id,active:next!=='NORMAL'});
    dispatch({type:'SET_FIRE',unit:id,active:next==='FIRE'});
   }
   const heat=Math.max(0,unit.temperature-start.temperature);
   const targetEGT=unit.stopped?Math.min(40+heat*.8,start.egt):start.egt+heat*.92;
   unit.egt=toward(unit.egt,targetEGT,unit.stopped?68:44,seconds);
   unit.n1=toward(unit.n1,unit.stopped?0:start.n1,unit.stopped?13:2,seconds);
   if(unit.n2!==null)unit.n2=toward(unit.n2,unit.stopped?0:start.n2,unit.stopped?11:2,seconds);
   if(unit.oil!==null)unit.oil=toward(unit.oil,unit.stopped?35:start.oil+heat*.08,2,seconds);
  }
  if(!evaluate().indications.MASTER_CAUTION)clearCaution=false;
 }
 function snapshot(){
  const derived=evaluate(),state=fire.getState();
  const indications=derived.indications;
  const cues=[indications.ENG1_FIRE,indications.ENG1_OVERHEAT,indications.FIRE_BELL];
  return {state,derived,equipment:Object.fromEntries(Object.entries(equipment).map(([id,row])=>[id,{...row}])),
   falseCue,cues,masterCaution:indications.MASTER_CAUTION&&!clearCaution};
 }
 return {dispatch,evaluate,getState:fire.getState,reset,tick,setTemperature,faultCue,setBreaker,snapshot,
  acknowledgeCaution:()=>{clearCaution=true;},recall:()=>{clearCaution=false;}};
}
return Object.freeze({thresholds,cbNames,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fire-lab-unified.js?v=P8-TEST-0002 */
try{
/* Local P8 training aircraft. Unified supplies the artwork and controls only. */
(function(win){
'use strict';
const doc=win.document, model=win.B737FireThermalTrainer;
const scenarios={
 ENG1_FIRE:['Engine 1 compartment fire','Local heat rises through OVHT and FIRE. Compare the red handle, amber OVERHEAT lens and bell.',t=>t.setTemperature('ENG1',335)],
 ENG2_OVHT:['Engine 2 compartment overheat','Local heat crosses the OVHT threshold. It stays below the FIRE threshold.',t=>t.setTemperature('ENG2',225)],
 APU_FIRE:['APU compartment fire','At the FIRE threshold, the APU trips and its EGT and RPM decay.',t=>t.setTemperature('APU',328)],
 FALSE_HANDLE:['False fire handle light','A spurious handle light appears with normal compartment temperature and no corroborating OVERHEAT or bell.',t=>t.faultCue('HANDLE')],
 FALSE_OVHT:['False OVERHEAT light','An isolated indication fault illuminates ENG 1 OVERHEAT. The compartment remains normal.',t=>t.faultCue('OVERHEAT')],
 FALSE_BELL:['False fire bell','The aural fault sounds the bell with both engine handle and overheat lenses dark.',t=>t.faultCue('BELL')],
 WHEEL:['Main wheel-well fire','Open AC TRANSFER BUS 1 or the wheel-well breaker to interrupt the detector.',t=>t.dispatch({type:'SET_WHEEL_FIRE',active:true})],
 ENG1_LOOP:['Engine 1 loop A open','Select A and hold OVHT/FIRE to check the failed path. NORMAL can still use loop B.',t=>t.dispatch({type:'SET_LOOP',unit:'ENG1',loop:'A',healthy:false})],
 APU_DET:['APU detector inoperative','Check the APU DET INOP lens, OVHT/DET and both MASTER CAUTION lights.',t=>t.dispatch({type:'SET_APU_DETECTOR',healthy:false})],
 BOTTLE:['Left bottle squib 1 open','Compare all three green lenses in EXT TEST 1 and EXT TEST 2.',t=>t.dispatch({type:'SET_CIRCUIT',bottle:'L',channel:1,healthy:false})]
};
const buses={batteryBus:'BATTERY BUS · 28V DC',hotBatteryBus:'HOT BATTERY BUS · 28V DC',acTransfer1:'AC TRANSFER BUS 1 · 115V AC'};
const equipmentNames={ENG1:'ENG 1',ENG2:'ENG 2',APU:'APU'};
const columns=['Equipment','Phase','N1 / RPM','N2','EGT','Compartment temp','Detector stage','Oil temp','Fuel valve','Bleed valve','Hydraulic shutoff','Generator'];
let dialog,trainer,hardware,timer,recallHeld=false;
const lenses=new Map();
const by=id=>dialog.querySelector('#'+id);
const degrees=v=>Number.isFinite(v)?v.toFixed(1)+' °C':'—';
const percent=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
function paint(){
 if(!dialog?.open)return;
 const {state,derived,equipment,masterCaution}=trainer.snapshot();
 const lamps=derived.indications;
 for(const [id,node] of lenses)node.dataset.illuminated=String(!!(lamps[id]||derived.testLamps[id]));
 hardware.paint(state,derived);
 for(const node of dialog.querySelectorAll('[data-caution]')){
  const code=node.dataset.caution.split('.')[1];
  const lit=code==='MASTER CAUTION'?masterCaution:code==='FIRE WARN'?lamps.MASTER_FIRE_WARN:
   recallHeld||code==='OVHT/DET'&&masterCaution&&lamps.OVHT_DET;
  node.dataset.on=node.dataset.lit=String(lit);
  if(node.tagName==='BUTTON')node.setAttribute('aria-pressed',String(lit));
 }
 for(const input of by('p8-lab-power').querySelectorAll('input'))input.checked=!!state.power[input.value];
 by('p8-lab-bottles').textContent=Object.entries(state.bottles).map(([id,empty])=>id+' '+(empty?'DISCHARGED':state.pending[id]!==null?'DISCHARGING':state.pressureLow[id]?'PRESSURE LOW':'READY')).join('  ·  ');
 for(const [id,unit] of Object.entries(equipment)){
  const command=derived.outputs[id],running=!unit.stopped;
  const values=[running?'RUNNING':unit.n1>0?'SPOOLING DOWN':'STOPPED',percent(unit.n1),percent(unit.n2),degrees(unit.egt),
   degrees(unit.temperature),unit.stage,degrees(unit.oil),running?'OPEN':'CLOSED',running&&!command.bleedShutoff?'OPEN':'CLOSED',
   id==='APU'?'—':command.hydraulicShutoff?'CLOSED':'OPEN',command.generatorTrip?'TRIPPED':!running?'OFF':id==='APU'?'AVAILABLE':'ON BUS'];
  dialog.querySelectorAll('[data-readout="'+id+'"]').forEach((cell,i)=>{cell.textContent=values[i];});
 }
 for(const id of ['ENG1','ENG2']){
  const cues=[lamps[id+'_FIRE'],lamps[id+'_OVERHEAT'],lamps.FIRE_BELL];
  const names=['FIRE HANDLE','OVERHEAT','BELL'];
  by('p8-lab-cues-'+id).textContent=equipmentNames[id]+' · '+cues.map((cue,i)=>names[i]+' '+(cue?'ON':'OFF')).join('  /  ');
 }
}
function mountPanel(original){
 const panel=doc.createElement('div');panel.className='p8-lab-docked';
 const base=new Image();base.src='./assets/fire-v6/FIRE_PANEL_BARE.webp';base.alt=original.getAttribute('aria-label')||'Fire protection panel';panel.append(base);
 const layer=doc.createElement('div');layer.className='fire-lamps-mounted';panel.append(layer);by('p8-lab-board').append(panel);
 const geometry=win.B737UnifiedFireLampModel;
 for(const slot of geometry.SLOTS){
  const node=doc.createElement('span');node.className='fire-lamp';
  node.dataset.fireLamp=slot.id;node.dataset.kind=slot.type;node.dataset.color=slot.color;
  Object.assign(node.style,geometry.percent(slot));
  for(const text of slot.lines){const line=doc.createElement('span');line.textContent=text;node.append(line);}
  layer.append(node);lenses.set(slot.id,node);
 }
 hardware=win.B737FirePanelHardware.create(()=>({
  ...trainer,dispatch(command){const result=trainer.dispatch(command);paint();return result;}
 }));
 hardware.mount(layer);
}
function mountAnnunciators(){
 const grid=by('p8-lab-cautions');
 for(const side of ['CAPT','FO']){
  const cockpit=doc.querySelector('#region-main [data-sixpack-seat="'+side+'"]');
  if(!cockpit)continue;
  const panel=cockpit.cloneNode(true);
  for(const node of panel.querySelectorAll('[data-sixpack]')){
   node.dataset.caution=node.dataset.sixpack;
   delete node.dataset.sixpack;
   const code=node.dataset.caution.split('.')[1];
   if(code==='MASTER CAUTION')node.onclick=()=>{trainer.acknowledgeCaution();paint();};
   if(code==='FIRE WARN')node.onclick=()=>{trainer.dispatch({type:'BELL_CUTOUT'});paint();};
  }
  const rack=panel.querySelector('.b737-sp-rack');
  const press=()=>{recallHeld=true;paint();};
  const release=()=>{recallHeld=false;trainer.recall();paint();};
  rack.onpointerdown=e=>{if(e.button===0){rack.setPointerCapture(e.pointerId);press();}};
  rack.onpointerup=rack.onpointercancel=rack.onlostpointercapture=release;
  rack.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();press();}};
  rack.onkeyup=e=>{if(e.key===' '||e.key==='Enter')release();};
  rack.onblur=()=>{if(recallHeld)release();};
  grid.append(panel);
 }
}
function build(original){
 dialog=doc.createElement('dialog');dialog.id='unifiedFireLab';dialog.className='p8-lab';dialog.setAttribute('aria-labelledby','p8-lab-title');
 dialog.innerHTML=`<header><h2 id="p8-lab-title">Fire Protection Test Lab</h2><button type="button" id="p8-lab-close">Close</button></header>
 <div id="p8-lab-board"></div>
 <section aria-label="Master caution and fire warning" id="p8-lab-cautions"></section>
 <section class="p8-lab-scenario"><label>Scenario <select id="p8-lab-scenario"></select></label>
 <button type="button" id="p8-lab-apply">Apply Scenario</button><button type="button" id="p8-lab-clear">Reset Lab</button>
 <p id="p8-lab-reason"></p><output id="p8-lab-result" role="status"></output></section>
 <form id="p8-lab-temperature"><label>Compartment <select name="unit"><option value="ENG1">ENG 1</option><option value="ENG2">ENG 2</option><option value="APU">APU</option></select></label>
 <label>Target °C <input name="temperature" type="number" min="20" max="650" value="100" required></label>
 <button type="submit">Set Temperature</button>
 <small>Training thresholds · OVHT ${model.thresholds.overheat} °C · FIRE ${model.thresholds.fire} °C</small></form>
 <fieldset id="p8-lab-power"><legend>Lab Power</legend>${Object.entries(buses).map(([id,label])=>'<label><input type="checkbox" value="'+id+'"> '+label+'</label>').join('')}</fieldset>
 <details><summary>Circuit Breakers</summary><fieldset id="p8-lab-breakers" aria-label="Closed circuit breakers">${Object.entries(model.cbNames).map(([id,label])=>'<label><input type="checkbox" value="'+id+'" checked> '+label+'</label>').join('')}</fieldset></details>
 <section aria-label="Aircraft readings">
 <p id="p8-lab-bottles"></p><div id="p8-lab-cues-ENG1"></div><div id="p8-lab-cues-ENG2"></div>
 <div class="p8-lab-table"><table><caption>Independent training equipment</caption><thead><tr>${columns.map(label=>'<th scope="col">'+label+'</th>').join('')}</tr></thead>
 <tbody>${Object.entries(equipmentNames).map(([id,label])=>'<tr><th scope="row">'+label+'</th>'+('<td data-readout="'+id+'">—</td>').repeat(columns.length-1)+'</tr>').join('')}</tbody></table></div></section>`;
 doc.body.append(dialog);mountPanel(original);mountAnnunciators();
 for(const [key,[label]] of Object.entries(scenarios))by('p8-lab-scenario').append(new Option(label,key));
 function showReason(){by('p8-lab-reason').textContent=scenarios[by('p8-lab-scenario').value][1];}
 function reset(){
  trainer.reset();recallHeld=false;
  for(const input of by('p8-lab-breakers').querySelectorAll('input'))input.checked=true;
  hardware.release();paint();
 }
 by('p8-lab-scenario').onchange=showReason;showReason();
 by('p8-lab-apply').onclick=()=>{reset();const [label,,apply]=scenarios[by('p8-lab-scenario').value];apply(trainer);by('p8-lab-result').textContent=label+' active';paint();};
 by('p8-lab-clear').onclick=()=>{reset();by('p8-lab-result').textContent='Lab reset';};
 by('p8-lab-close').onclick=()=>dialog.close();
 by('p8-lab-temperature').onsubmit=e=>{
  e.preventDefault();const {unit,temperature}=e.currentTarget.elements;
  trainer.setTemperature(unit.value,Number(temperature.value));paint();
 };
 by('p8-lab-power').onchange=e=>{trainer.dispatch({type:'SET_POWER',bus:e.target.value,active:e.target.checked});paint();};
 by('p8-lab-breakers').onchange=e=>{trainer.setBreaker(e.target.value,e.target.checked);paint();};
 dialog.addEventListener('pointerdown',hardware.playBell,{passive:true});
 dialog.addEventListener('close',()=>{clearInterval(timer);hardware.release();hardware.stopBell();win.dispatchEvent(new CustomEvent('b737:fire-lab-visibility',{detail:false}));});
}
function open(){
 if(dialog?.open||!model||!win.B737FireProtection)return false;
 const original=doc.querySelector('#region-pedestal [data-piece="fire-protection"]');if(!original)return false;
 if(!dialog){trainer=model.create(win.B737FireProtection);build(original);}
 win.dispatchEvent(new CustomEvent('b737:fire-lab-visibility',{detail:true}));
 dialog.showModal();paint();
 let last=performance.now();
 timer=setInterval(()=>{const now=performance.now();trainer.tick(Math.min(.25,(now-last)/1000));last=now;paint();},100);
 return true;
}
win.B737UnifiedFireLab=Object.freeze({open,snapshot:()=>trainer?.snapshot()});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
