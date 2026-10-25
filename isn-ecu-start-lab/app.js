(function(){'use strict';
const $=id=>document.getElementById(id), html=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const deps={Electrical:window.B737ElectricalV7,Loads:window.B737ElectricalLoadsV8,
 TrainerCore:window.B737TrainerCore,WarningEngine:window.B737WarningEngine?.WarningEngine,
 Pneumatics:window.B737PneumaticsV6,Pack:window.B737ISNElectricalPackV1,
 EngineAPU:window.B737ISNEngineAPUV1,Start:window.B737ISNStartSequenceV1,
 Chain:window.B737ISNAPUStartChainV1,ThrustPlanner:window.B737ISNThrustPerformanceV1,
 FuelRuntime:window.B737ISN0912RuntimeV1};
let sim=null,runner=null;
function pauseLive(){if(runner!==null){clearInterval(runner);runner=null;}}
function startLive(){
 if(runner!==null)return;
 // Engine/APU START commands progress automatically; manual PAUSE is optional.
 runner=setInterval(()=>{
  try{sim.advance(100);render();}
  catch(err){pauseLive();$('errors').textContent=err.message;render();}
 },100);
 render();
}
function create(){pauseLive();sim=new window.B737ISN1318ECUTestbenchV1.Testbench(deps);$('n1result').textContent='No thrust schedule applied';render();}
function metrics(e){return [['N1',e.n1Percent,'%'],['N2',e.n2Percent,'%'],['EGT',e.egtC,'°C'],['FUEL FLOW',e.fuelFlowKgHr,'kg/h'],['OIL PRESS',e.oil.pressurePsi,'PSI'],['HYD PRESS',e.hydraulic?.engineDrivenPressurePsi??null,'PSI'],['OIL TEMP',e.oil.temperatureC,'°C'],['OIL QTY',e.oil.quantityPct,'%']].map(([name,value,unit])=>`<div class="metric"><span>${name}</span><b>${value==null?'—':html(Number(value).toFixed(1))} <small>${unit}</small></b></div>`).join('');}
function engineCard(e,num){
 return `<section><h2>ENGINE ${num}</h2><div class="metrics">${metrics(e)}</div>
 <p>START VALVE <strong>${e.startValveOpen===null?'UNKNOWN':e.startValveOpen?'OPEN':'CLOSED'}</strong> · FUEL LEVER <strong>${html(e.fuelLever)}</strong> · PHASE <strong>${html(e.phase)}</strong></p>
 <p>FUEL SUPPLY <strong class="${e.fuelSupplyReady===true?'ok':'amber'}">${e.fuelSupplyReady===true?(e.fuelSupplyReason==='OWN_MAIN_ENGINE_DRIVEN_SUCTION'?'SUCTION FEED — OWN MAIN TANK':'AVAILABLE'):html(e.fuelSupplyReason||'UNAVAILABLE')}</strong></p>
 <p>IGN L ${e.ignition?.eligible?.left===true?'POWERED':e.ignition?.eligible?.left===null?'UNKNOWN':'OFF'} · IGN R ${e.ignition?.eligible?.right===true?'POWERED':e.ignition?.eligible?.right===null?'UNKNOWN':'OFF'}</p>
 <p>START DUCT ${e.starterDuctPsiTraining} PSI (TRAINING INPUT) · NOMINAL 25% N2 ${((e.startTimingTraining?.motoringMs??28000)/1000).toFixed(1)}s · POST-IDLE ${((e.startTimingTraining?.lightoffMs??37000)/1000).toFixed(1)}s</p>
 <p><span class="lamp ${e.oil.lowPressureLamp?'on':'off'}">LOW OIL PRESSURE ${e.oil.lowPressureLamp?'ON':'OFF'}</span>
 <span class="lamp ${e.oil.filterBypassLamp?'on':'off'}">OIL FILTER BYPASS ${e.oil.filterBypassLamp?'ON':'OFF'}</span></p></section>`;
}
function render(){if(!sim)return;const s=sim.get();$('clock').textContent=`${(s.timeMs/1000).toFixed(1)} s`;
 $('apu').textContent=`BATTERY ${s.electrical.battery?'ON':'OFF'} · APU ${s.apu.rpmPct}% RPM · EGT ${s.apu.egtC}°C · GEN ${s.apu.generator?.voltageV??0} V / ${s.apu.generator?.frequencyHz??0} Hz · APU LOAD ${s.apu.load?.actualLoadKva??0} kVA · POWER ${s.apu.load?.powerDemandPercent??0}% · FUEL ${s.apu.fuelFlowEstimatedKgHr??0} kg/h · BLEED ${s.apu.bleedValveOpen?'OPEN':'CLOSED'} · BUS 1 ${s.electrical.selectedSources[1]||'OFF'}`;
 $('engines').innerHTML=engineCard(s.engines.engine1,1)+engineCard(s.engines.engine2,2);
 $('ignitionStatus').textContent=`STANDBY POWER ${s.electrical.standbySelector} · STANDBY AC ${s.electrical.standbyAcPowered===true?'AVAILABLE':s.electrical.standbyAcPowered===false?'OFF':'UNKNOWN'} · RIGHT IGNITION: AC STANDBY (BAT via inverter)`;
 $('ductInfo').textContent=`ENG1 ${s.engines.engine1.starterDuctPsiTraining} PSI · ENG2 ${s.engines.engine2.starterDuctPsiTraining} PSI (simulated); 35 PSI -> nominal 65s cycle`;
 $('alertSummary').textContent=s.alerts.length?s.alerts.map(a=>a.id).join(' | '):'No active advisories';
 $('fuelStatus').textContent=`MAIN1 ${s.fuel.tanksKg.main1.toFixed(1)} kg · CENTER ${s.fuel.tanksKg.center.toFixed(1)} kg · MAIN2 ${s.fuel.tanksKg.main2.toFixed(1)} kg · CROSSFEED ${s.fuel.crossfeed}`;
 $('log').textContent=s.trace.slice(-40).map(x=>`${(x.tMs/1000).toFixed(2).padStart(7)}s ${x.type} ${JSON.stringify(x)}`).join('\n');
 document.querySelector('[data-act="play"]').textContent=runner?'❚❚ PAUSE':'▶ RUN LIVE';
 document.querySelector('[data-act="ground"]').textContent=s.aircraft.onGround?'GROUND → FLIGHT':'FLIGHT → GROUND';
 const pumps=sim.start?.core?.pack?.get()?.pumps??{};
 const activeMainPumps=['fuel.main1FwdPump','fuel.main1AftPump','fuel.main2FwdPump','fuel.main2AftPump'].filter(id=>pumps[id]?.switchOn===true).length;
 document.querySelector('[data-act="fuel"]').textContent=`FUEL PUMP SWITCHES ${activeMainPumps}/4 ON`;
}
function action(type){if(type==='reset'){create();return;}if(!sim)throw Error('Simulator not initialized');
 const status=sim.get();switch(type){
 case 'battery':sim.battery(true);break;
 case 'apuStart':sim.startAPU();if(['INLET_DOOR','STARTING'].includes(sim.get().apu.phase))startLive();break;
 case 'apuGen':sim.selectGenerator('APU',1);break;
 case 'apuGen2':sim.selectGenerator('APU',2);break;
 case 'loadAvionics':sim.setElectricalConsumer('AVIONICS',!status.electrical.apuConsumerSwitches.AVIONICS);break;
 case 'loadLights':sim.setElectricalConsumer('CABIN_LIGHTS',!status.electrical.apuConsumerSwitches.CABIN_LIGHTS);break;
 case 'loadGalley':sim.setElectricalConsumer('GALLEY',!status.electrical.apuConsumerSwitches.GALLEY);break;
 case 'loadFans':sim.setElectricalConsumer('AIR_CONDITIONING_FANS',!status.electrical.apuConsumerSwitches.AIR_CONDITIONING_FANS);break;
 case 'ignL':sim.setIgnitionSelector('IGN_L');break;
 case 'ignBoth':sim.setIgnitionSelector('BOTH');break;
 case 'ignR':sim.setIgnitionSelector('IGN_R');break;
 case 'standbyBAT':sim.setStandbyPower('BAT');break;
 case 'standbyAUTO':sim.setStandbyPower('AUTO');break;
 case 'standbyOFF':sim.setStandbyPower('OFF');break;
 case 'apuBleed':sim.apuBleed(true);break;
 case 'fuel':sim.prepareFuel();break;
 case 'apuStop':sim.chain.event({id:'apu-start',kind:'toggle',next:'OFF'});break;
 case 'start1':sim.engineStart('engine1');if(sim.get().engines.engine1.phase==='MOTORING')startLive();else throw Error(sim.chain.get().lastError||'ENGINE START NOT ACCEPTED');break;
 case 'idle1':{const r=sim.fuelLever('engine1','IDLE');if(!r.accepted)throw Error(r.reason);break;}
 case 'off1':sim.shutdown('engine1');break;
 case 'start2':sim.engineStart('engine2');if(sim.get().engines.engine2.phase==='MOTORING')startLive();else throw Error(sim.chain.get().lastError||'ENGINE START NOT ACCEPTED');break;
 case 'idle2':{const r=sim.fuelLever('engine2','IDLE');if(!r.accepted)throw Error(r.reason);break;}
 case 'off2':sim.shutdown('engine2');break;
 case 'play':if(runner!==null)pauseLive();else startLive();break;
 case 'step':sim.advance(500);break;
 case 'step5':sim.advance(5000);break;
 case 'ground':sim.setOnGround(!status.aircraft.onGround);break;
 case 'bleedFault':sim.setAPUFault('bleedFailure',!status.apu.faults.bleedFailure);break;
 case 'genFault':sim.setAPUFault('generatorFailure',!status.apu.faults.generatorFailure);break;
 case 'oilPump1':sim.setOilFault('engine1','pumpFailure',!sim.oil.engine1.faults.pumpFailure);break;
 case 'oilFilter1':sim.setOilFault('engine1','filterRestriction',!sim.oil.engine1.faults.filterRestriction);break;
 case 'oilLeak1':sim.setOilFault('engine1','oilLeak',!sim.oil.engine1.faults.oilLeak);break;
 case 'hot1':sim.setStartFault('engine1','egtHigh',true);break;
 case 'crossfeed':sim.core.fuel.setCrossfeed(status.fuel.crossfeed==='OPEN'?'CLOSED':'OPEN');break;
 case 'fuelLoss1':sim.core.setFireSwitch('engine1',true);break;
 case 'flightInputs':{
   sim.setFlightInputs({iasKt:Number($('ias').value),
    pressureAltitudeFt:Number($('alt').value),oatC:Number($('oat').value)});
   $('n1result').textContent='FLIGHT CONDITIONS UPDATED · IAS '+sim.get().aircraft.iasKt+
    ' kt · ALT '+sim.get().aircraft.pressureAltitudeFt+' ft · each engine fuel flow responds to throttle, altitude and IAS';
   break;
  }
  case 'n1plan':{
  const ias=Number($('ias').value),alt=Number($('alt').value),oat=Number($('oat').value);
  sim.setFlightInputs({iasKt:ias,pressureAltitudeFt:alt,oatC:oat});
  const r=sim.planThrust('engine1',{mode:$('mode').value});
  $('n1result').textContent=`${r.plan.mode.active}: N1 LIMIT ${r.plan.mode.limitN1Percent.toFixed(1)}% · N1 REQUIRED ${r.plan.performance.requiredN1NowPercent.toFixed(1)}% · COMMANDED ${r.plan.performance.selectedN1CommandPercent.toFixed(1)}%`;
  break;
 }
 default:throw Error('Unknown action '+type);
 }render();}
document.addEventListener('click',e=>{const button=e.target.closest('[data-act]');if(!button)return;
 $('errors').textContent='';try{action(button.dataset.act);}catch(err){$('errors').textContent=err.message;render();}});
for(const id of ['throttle1','throttle2'])$(id).addEventListener('input',e=>{try{sim.setThrottle('engine'+id.at(-1),Number(e.target.value)/100);$('errors').textContent='';}catch(err){$('errors').textContent=err.message;}render();});
 for(const id of ['duct1','duct2'])$(id).addEventListener('change',e=>{
  try{sim.setStartDuctPressure('engine'+id.at(-1),Number(e.target.value));$('errors').textContent='';}
  catch(err){$('errors').textContent=err.message;}
  render();
 });
try{create();}catch(err){$('errors').textContent='Missing engine library: '+err.message;console.error(err);}
})();