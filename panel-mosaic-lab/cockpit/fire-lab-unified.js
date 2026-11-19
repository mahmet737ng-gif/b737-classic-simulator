/* P8 diagnostics dock the real controls and subscribe to the current aircraft. */
(function(win){
'use strict';
const doc=win.document;
const scenarios={
 ENG1_FIRE:['Engine 1 fire','Both selected detector loops sense a fire. The ENG 1 handle unlocks. Pulling it commands engine isolation.',{type:'SET_FIRE',unit:'ENG1',active:true}],
 ENG2_OVHT:['Engine 2 overheat','The temperature detection path reports overheat. ENG 2 OVERHEAT and OVHT/DET illuminate, and the handle unlocks.',{type:'SET_OVERHEAT',unit:'ENG2',active:true}],
 APU_FIRE:['APU compartment fire','The APU fire detector triggers the red handle, the warning system and automatic APU shutdown.',{type:'SET_FIRE',unit:'APU',active:true}],
 WHEEL:['Main wheel well fire','The wheel well detector generates a warning with AC transfer bus 1 available.',{type:'SET_WHEEL_FIRE',active:true}],
 ENG1_LOOP:['Engine 1 loop A open','With NORMAL selected, loop B remains available. Select A and hold the panel test to see the failed path.',{type:'SET_LOOP',unit:'ENG1',loop:'A',healthy:false}],
 APU_DET:['APU detector inoperative','The APU detection loop is unavailable. Check APU DET INOP and both master caution indicators.',{type:'SET_APU_DETECTOR',healthy:false}],
 BOTTLE:['Left bottle squib 1 open','EXT TEST 1 should leave the left green lens dark. Compare it with EXT TEST 2.',{type:'SET_CIRCUIT',bottle:'L',channel:1,healthy:false}]
};
let dialog,plate,anchor,timer,applied;
const fire=()=>win.B737UnifiedFireLights;
const crew=()=>win.B737SixPack;
const by=id=>dialog.querySelector('#'+id);
const degrees=value=>Number.isFinite(value)?value.toFixed(1)+' °C':'—';
const percent=value=>Number.isFinite(value)?value.toFixed(1)+'%':'—';
const valve=value=>value===true?'OPEN':value===false?'CLOSED':'—';
function scenarioField(command,state){
 switch(command.type){
  case 'SET_FIRE': return ['active',command.unit==='APU'?state.apuFire:state.engineFire[command.unit]];
  case 'SET_OVERHEAT': return ['active',state.engineOverheat[command.unit]];
  case 'SET_WHEEL_FIRE': return ['active',state.wheelWellFire];
  case 'SET_LOOP': return ['healthy',state.loops[command.unit][command.loop]];
  case 'SET_APU_DETECTOR': return ['healthy',state.apuDetector];
  case 'SET_CIRCUIT': return ['healthy',state.squibs[command.bottle][command.channel]];
 }
}
function selectScenario(){
 by('p8-lab-reason').textContent=scenarios[by('p8-lab-scenario').value][1];
}
function paint(){
 if(!dialog?.open)return;
 const lamps=crew()?.getEffectiveState?.()||{};
 const reasons=crew()?.getLiveReasons?.()||{};
 for(const node of dialog.querySelectorAll('[data-caution]')){
  const key=node.dataset.caution;
  node.dataset.lit=String(lamps[key]===true);
  node.title=(reasons[key]||[]).join(', ');
 }
 const owner=win.B737ISNCockpitV1;
 const ecu=owner?.getECUState?.(),start=owner?.getStartState?.();
 const firing=fire()?.evaluate(),raw=fire()?.getState();
 if(!ecu||!start||!raw||!firing)return;
 const feeds=ecu.electrical?.selectedSources||{};
 const sourceKey={ENG1:'GEN1',ENG2:'GEN2',APU:'APU'};
 const installed={ENG1:ecu.engines.engine1,ENG2:ecu.engines.engine2,APU:ecu.apu};
 const fireBuses=raw.power;
 by('p8-lab-power').textContent=[
  ['BATTERY BUS',fireBuses.batteryBus],['HOT BATTERY BUS',fireBuses.hotBatteryBus],
  ['AC TRANSFER BUS 1',fireBuses.acTransfer1]].map(([name,on])=>name+' '+(on?'ON':'OFF')).join('  ·  ');
 for(const [id,unit] of Object.entries(installed)){
  const n=id==='ENG1'?1:2;
  const command=firing.outputs[id];
  const generator=Object.entries(feeds).filter(([,name])=>name===sourceKey[id]).map(([side])=>side);
  const generatorStatus=generator.length?'BUS '+generator.join(' / '):
   command.generatorTrip?'TRIPPED':(id==='APU'?unit.generator?.ready:unit.phase==='RUNNING')?'AVAILABLE':'OFF';
  const fuel=command.fuelShutoff||unit.fuelLever==='CUTOFF'||unit.fuelPath?.reason==='APU_NOT_RUNNING'?'CLOSED':
   unit.fuelLever==='IDLE'||unit.phase==='READY'?'OPEN':'—';
  const detectors=id==='APU'?(raw.apuDetector?'SINGLE LOOP':'INOP'):raw.selectors[id]+' · '+['A','B'].map(loop=>loop+' '+(raw.loops[id][loop]?'OK':'FAIL')).join(' / ');
  const values=[unit.phase,percent(unit.n1Percent??unit.rpmPct),percent(unit.n2Percent),degrees(unit.egtC),degrees(unit.oil?.temperatureC),fuel,
   valve(id==='APU'?unit.bleedValveOpen:start.bleed['engine'+n+'ValveOpen']),
   id==='APU'?'—':valve(!command.hydraulicShutoff),generatorStatus,detectors];
  dialog.querySelectorAll('[data-readout="'+id+'"]').forEach((cell,i)=>{cell.textContent=values[i]??'—';});
 }
 by('p8-lab-bottles').textContent=Object.entries(raw.bottles).map(([id,empty])=>id+' '+(empty?'DISCHARGED':raw.pending[id]!==null?'DISCHARGING':raw.pressureLow[id]?'PRESSURE LOW':'READY')).join('  ·  ');
}
function annunciators(){
 const grid=by('p8-lab-cautions');
 const categories={CAPT:['FLT CONT','ELEC','IRS','APU','FUEL','OVHT/DET'],
 FO:['ANTI-ICE','ENG','HYD','OVERHEAD','DOORS','AIR COND']};
 for(const [side,systems] of Object.entries(categories)){
  const cell=doc.createElement('section');cell.className='p8-lab-crew';
  const title=doc.createElement('strong');title.textContent=side==='CAPT'?'CAPTAIN':'FIRST OFFICER';
  cell.append(title);
  const make=(text,callback,test)=>{
   const button=doc.createElement('button');
   button.type='button';button.textContent=text;button.dataset.caution=side+'.'+text;
   if(callback)button.onclick=()=>{callback();paint();};
   if(test)button.className='p8-lab-fire-warn';
   cell.append(button);return button;
  };
  make('MASTER CAUTION',()=>crew()?.acknowledge('P8_LAB'));
  make('FIRE WARN',()=>crew()?.acknowledgeFire('P8_LAB'),true);
  for(const name of systems)make(name,()=>crew()?.recall(side));
  const recall=doc.createElement('button');recall.type='button';recall.textContent='RECALL';
  recall.onpointerdown=e=>{if(e.button===0){recall.setPointerCapture(e.pointerId);crew()?.press(side);paint();}};
  recall.onpointerup=recall.onpointercancel=()=>{crew()?.release(side);paint();};
  recall.onclick=e=>{if(!e.detail){crew()?.recall(side);paint();}};
  cell.append(recall);grid.append(cell);
 }
}
function build(){
 dialog=doc.createElement('dialog');
 dialog.id='unifiedFireLab';dialog.className='p8-lab';dialog.setAttribute('aria-labelledby','p8-lab-title');
 dialog.innerHTML=`<header><h2 id="p8-lab-title">Fire Protection Test Lab</h2><button type="button" id="p8-lab-close">Close</button></header>
 <div id="p8-lab-board"></div>
 <section aria-label="Master caution and fire warning" id="p8-lab-cautions"></section>
 <section class="p8-lab-scenario"><label>Scenario <select id="p8-lab-scenario"></select></label>
 <button type="button" id="p8-lab-apply">Apply Scenario</button><button type="button" id="p8-lab-clear">Clear Scenario</button>
 <p id="p8-lab-reason"></p><output id="p8-lab-result" role="status"></output></section>
 <section aria-label="Aircraft readings"><p id="p8-lab-power"></p><p id="p8-lab-bottles"></p>
 <div class="p8-lab-table"><table><caption>Live equipment state</caption><thead><tr>${['Equipment','Phase','N1 / RPM','N2','EGT','Oil temperature','Fuel shutoff','Bleed valve','Hydraulic shutoff','Generator','Detector'].map(label=>'<th scope="col">'+label+'</th>').join('')}</tr></thead>
 <tbody>${[['ENG1','ENG 1'],['ENG2','ENG 2'],['APU','APU']].map(([id,label])=>'<tr><th scope="row">'+label+'</th>'+('<td data-readout="'+id+'">—</td>').repeat(10)+'</tr>').join('')}</tbody></table></div></section>`;
 doc.body.append(dialog);annunciators();
 for(const [key,[label]] of Object.entries(scenarios))by('p8-lab-scenario').append(new Option(label,key));
 by('p8-lab-close').onclick=()=>dialog.close();
 by('p8-lab-scenario').onchange=selectScenario;selectScenario();
 function clear(){
  if(!applied)return;
  const {command,key,previous}=applied;
  if(scenarioField(command,fire().getState())[1]===command[key])
   fire().dispatch({...command,[key]:previous});
  applied=null;paint();
 }
 by('p8-lab-apply').onclick=()=>{
  clear();const [label,,command]=scenarios[by('p8-lab-scenario').value];
  const [key,previous]=scenarioField(command,fire().getState());
  fire().dispatch(command);applied={command,key,previous};by('p8-lab-result').textContent=label+' active';paint();
 };
 by('p8-lab-clear').onclick=()=>{clear();by('p8-lab-result').textContent='Scenario cleared';};
 dialog.addEventListener('close',()=>{
  clearInterval(timer);plate.classList.remove('p8-lab-docked');anchor.replaceWith(plate);
 });
}
function open(){
 if(dialog?.open||!fire())return false;
 plate=doc.querySelector('#region-pedestal [data-piece="fire-protection"]');if(!plate)return false;
 if(!dialog)build();
 anchor=doc.createComment('P8 cockpit position');plate.before(anchor);
 plate.classList.add('p8-lab-docked');by('p8-lab-board').append(plate);
 dialog.showModal();paint();timer=setInterval(paint,300);
 return true;
}
win.addEventListener('b737:ata26-panel-state',paint);
win.addEventListener('b737:sixpack-system-update',paint);
win.B737UnifiedFireLab=Object.freeze({open});
})(window);
