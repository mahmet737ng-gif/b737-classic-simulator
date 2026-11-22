/* B737 Classic Unified — FCOM/MRG instructor failure effects V2.
 * Training only; source: FCOM 2.10.11-13 / 7.20.7 / 10.20.8 /
 * 11.32.5-7 / 13.20.2-6, MRG IV.2 / IV.7 / IV.11 / IV.13.
 * Pure effects evaluated against cockpit-owned signals, not a second simulator.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='FCOM-MRG-FAILURE-EFFECTS-20261122-V2';
 const MAP=Object.freeze({
 'irs.left':'navigation.irs.left','irs.right':'navigation.irs.right','irs.both':'navigation.irs.both',
 'fmc.left':'navigation.fmc.left','fmc.right':'navigation.fmc.right','fmc.both':'navigation.fmc.both',
 'hyd.a.loss':'hydraulic.a.total','hyd.b.loss':'hydraulic.b.total',
 'hyd.standbyPump':'hydraulic.standby.pump','hyd.ptu':'hydraulic.ptu','hyd.lgtu':'hydraulic.lgtu'
 });
 const IDS=new Set([...Object.values(MAP),'air.autoFail','air.cargoDoor',
 'engine.1.startValveOpen','engine.2.startValveOpen','electrical.buses.both',
 ...['cpt','fo'].flatMap(seat=>['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi'].map(unit=>'instrument.'+seat+'.'+unit))]);
 const normalize=id=>MAP[id]||(/^(cpt|fo)\.(eadi|ehsi|asi|altimeter|vsi|rdmi|ivsi)$/.test(id)?'instrument.'+id:id);
 const failed=(faults,id)=>faults.has(id);
 const pressure=alt=>14.696*Math.pow(Math.max(.00001,1-0.00000687535*Math.max(-1000,Math.min(60000,alt))),5.2559);
 function evaluate(faults,live={},elapsed=0,started={}){
  faults=new Set([...faults].map(normalize));
  const f=id=>failed(faults,id),aircraft=live.flight||{},n1=live.engine1||{},n2=live.engine2||{};
  const irs={left:!f('navigation.irs.left')&&!f('navigation.irs.both'),
   right:!f('navigation.irs.right')&&!f('navigation.irs.both')};
  const fmc={left:!f('navigation.fmc.left')&&!f('navigation.fmc.both'),
   right:!f('navigation.fmc.right')&&!f('navigation.fmc.both')};
  const side=live.fmcSourceSelector||'NORMAL';
  const sources={cpt:side==='BOTH ON R'?'right':'left',fo:side==='BOTH ON L'?'left':'right'};
  const displays={};for(const seat of ['cpt','fo']){
   displays[seat]={};for(const unit of ['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi']){
    const unitWorks=!f('instrument.'+seat+'.'+unit);
    const inertial=irs[(live.irsSource?.[seat]|| (seat==='cpt'?'left':'right'))];
    const usesIRS=['eadi','ehsi','rdmi'].includes(unit)||(['vsi','ivsi'].includes(unit)&&live.ivsSource!=='ADC');
    displays[seat][unit]={powered:unitWorks,valid:unitWorks&&(!usesIRS||inertial),
     flags:!unitWorks?'DISPLAY FAIL':usesIRS&&!inertial?'IRS INVALID':null,
     rawVhfNavAvailable:unitWorks&&unit==='ehsi'};
   }
  }
  const vtk={cpt:!fmc[sources.cpt],fo:!fmc[sources.fo]};
  const mapFailure={};for(const seat of ['cpt','fo']){
   const which=sources[seat],possible=['navigation.fmc.both','navigation.fmc.'+which].filter(f);
   mapFailure[seat]=vtk[seat]&&possible.some(id=>elapsed-(started[id]??elapsed)>=25);
  }
  const afdsChannel=live.afdsChannel==='B'?'B':'A';
  const fmcForAP=afdsChannel==='A'?fmc[sources.cpt]:fmc[sources.fo];
  const ac=live.ac||{},busBoth=f('electrical.buses.both')||!!live.bothBusInjected;
  const buses={ac1:!busBoth&&ac.bus1!==false,ac2:!busBoth&&ac.bus2!==false,
   engineGen1Producing:n1.running!==false&&(n1.n2??70)>=55,
   engineGen2Producing:n2.running!==false&&(n2.n2??70)>=55,
   genOffBus1:busBoth,genOffBus2:busBoth,
   batteryBus:ac.battery!==false};
  const hyd=live.hyd||{},a=!f('hydraulic.a.total')&&hyd.aPsi!==0,
   b=!f('hydraulic.b.total')&&hyd.bPsi!==0;
  const flaps=Number(aircraft.flapDeg||0),airborne=aircraft.airborne!==false;
  const standbyRequested=!!hyd.stbySelected||!!hyd.altFlapsArm||
   (flaps>0&&(airborne||(aircraft.wheelSpeedKts||0)>60)&&(!a||!b)&&hyd.flightControlOn!==false)||
   !!hyd.forceFight;
  const standby=standbyRequested&&!f('hydraulic.standby.pump')&&buses.ac2;
  const ptu=airborne&&a&&(n2.n2??70)<56&&flaps>0&&flaps<15&&
   !f('hydraulic.ptu')&&hyd.bFluidAvailable!==false;
  const lgtu=airborne&&(n1.n2??70)<56&&b&&hyd.gearLever==='UP'&&
   hyd.mainGearUpLocked===false&&!f('hydraulic.lgtu');
  const users={autopilotA:a,autopilotB:b,groundSpoilers:a,
   brakesNormal:b,brakesAlternate:a,autobrake:b,
   normalGear:a,retractGear:a||lgtu,normalNosewheelSteering:a,
   trailingFlapsNormal:b,leadingEdgeNormal:b||ptu,autoslat:b||ptu,
   yawDamper:b,rudder:a||b||standby,
   thrustReverser1:a||standby,thrustReverser2:b||standby};
  const start={};
  for(const [num,e] of [['1',n1],['2',n2]]){
   const stuck=f('engine.'+num+'.startValveOpen'),cutout=(e.n2??70)>=46;
   const valveOpen=stuck||(!cutout&&e.startSwitch==='GRD');
   start[num]={starterCutout:cutout,startSwitch:cutout?'OFF':(e.startSwitch||'OFF'),
    valveOpen,startValveOpenLight:valveOpen&&buses.batteryBus,stuck};
  }
  const press=live.pressure||{},dcpcs=live.panelType==='DCPCS';
  const autoFail=f('air.autoFail')||!!press.autoFail;
  const cab=Number.isFinite(press.cabinAltitudeFt)?press.cabinAltitudeFt:5500;
  const alt=Number.isFinite(aircraft.altitudeFt)?aircraft.altitudeFt:31000;
  const pOut={autoFail,mode:autoFail?(dcpcs?'ALTN':'STBY'):(press.mode||'AUTO'),
   autoFailLight:autoFail,standbyLight:autoFail&&!dcpcs,altnLight:autoFail&&dcpcs,
   cabinAltitudeFt:cab,cabinRateFpm:press.cabinRateFpm||0,
   differentialPsi:Math.max(0,pressure(cab)-pressure(alt)),
   cabinAltitudeWarning:cab>=10000,physicalLeak:f('air.cargoDoor'),
   manualControlEffective:!press.manualActuatorFailed&&!press.outflowValveStuck&&
    !press.uncontrolledLeak};
  return Object.freeze({version:VERSION,navigation:{irs,fmc,displays,vtk,mapFailure,
   fmcAlert:!fmc.left||!fmc.right,cduPowered:true,
   cduMessage:!fmc.left&&!fmc.right?'FMC FAIL':!fmc.left||!fmc.right?'SINGLE FMC OPERATION':null,
   lnavAvailable:fmcForAP,vnavAvailable:fmcForAP},
   flightInstruments:displays,afds:{channel:afdsChannel,
    autopilotAAvailable:a&&irs.left,autopilotBAvailable:b&&irs.right,
    lnavAvailable:fmcForAP,vnavAvailable:fmcForAP},
   electrical:buses,hydraulics:{aAvailable:a,bAvailable:b,standbyActive:standby,
    standbyRequested,ptuActive:ptu,lgtuActive:lgtu,users,
    cautions:{systemA:!a,systemB:!b,stbyRudderOn:standby}},
   engineStart:start,pressurization:pOut,warnings:{fmcAlert:!fmc.left||!fmc.right,
    startValve1:start['1'].startValveOpenLight,startValve2:start['2'].startValveOpenLight,
    cabinAltitude:cab>=10000,hydraulic:!a||!b}});
 }
 function createController(){
  let faults=new Set(),elapsed=0,started={},current=null;
  const subscribers=new Map();
  function publish(live={}){
   current=evaluate(faults,live,elapsed,started);
   for(const [name,fn] of subscribers)try{fn(current[name]||current);}catch(e){/* keep other channels running */}
   return current;
  }
  function replace(ids){
   const next=new Set();for(const id of ids){const key=normalize(id);if(!IDS.has(key))throw Error('Unknown failure '+id);next.add(key);if(!faults.has(key))started[key]=elapsed;}
   faults=next;return publish();
  }
  function tick(delta,live={}){if(!Number.isFinite(delta)||delta<0||delta>10)throw Error('Invalid delta');elapsed+=delta;return publish(live);}
  function registerConsumer(name,fn){if(typeof fn!=='function')throw TypeError('function required');
   subscribers.set(name,fn);return ()=>subscribers.delete(name);}
  return Object.freeze({replace,tick,publish,registerConsumer,getEffects:()=>current||publish(),
   getFaults:()=>[...faults],getDiagnostics:()=>({version:VERSION,elapsed,faults:[...faults],
    consumers:[...subscribers.keys()],nativeReady:subscribers.size>0})});
 }
 function install(win){
  if(win.B737UnifiedFcomFailureEngineV2)return win.B737UnifiedFcomFailureEngineV2;
  const controller=createController();
  function sample(){
   const s=win.B737UnifiedFlightScenarioV1?.getState?.()||{};
   const pressure=win.B737UnifiedInstructorNonNormalV1?.pressureState?.()||{};
   const power=win.B737UnifiedBusFailureInjectionV1?.live?.get?.();
   return {flight:s,pressure,ac:{battery:true},
    bothBusInjected:!!power?.active&&['transfer1@115VAC','transfer2@115VAC'].every(k=>power.offBusKeys.includes(k)),
    engine1:{n2:win.B737ISNCockpitV1?.getState?.()?.state?.engines?.[0]?.n2??70},
    engine2:{n2:win.B737ISNCockpitV1?.getState?.()?.state?.engines?.[1]?.n2??70}};
  }
  function push(kind){
   const output=controller.publish(sample());
   win.dispatchEvent(new CustomEvent('b737:unified-fcom-failure-effects-v2',{
    detail:{kind,output,diagnostics:controller.getDiagnostics(),source:'FCOM_MRG_INSTRUCTOR'}}));
  }
  win.addEventListener('b737:advanced-failures-changed',e=>{
   try{controller.replace(e.detail?.failures||[]);push('FAILURES');}
   catch(error){win.console?.error('Instructor failure rule',error);}
  });
  win.addEventListener('b737:instructor-scenario-loaded',()=>push('SCENARIO'));
  const api=Object.freeze({...controller,version:VERSION,
   tickLive:dt=>{const effects=controller.tick(dt,sample());push('TICK');return effects;},
   sampleLive:sample,refresh:()=>push('MANUAL_REFRESH')});
  win.B737UnifiedFcomFailureEngineV2=api;
  if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',()=>{
   try{controller.replace(win.B737UnifiedAdvancedInstructorV1?.getFailures?.()||[]);push('HYDRATE');}catch(e){win.console?.warn(e);}
  },{once:true});
  else {try{controller.replace(win.B737UnifiedAdvancedInstructorV1?.getFailures?.()||[]);push('HYDRATE');}catch(e){}}
  return api;
 }
 return Object.freeze({VERSION,IDS,normalize,evaluate,createController,install});
});
