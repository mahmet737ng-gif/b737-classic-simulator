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
