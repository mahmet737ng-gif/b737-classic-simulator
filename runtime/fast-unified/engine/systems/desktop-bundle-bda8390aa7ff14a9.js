(async()=>{
;
/* ../../engine/systems/electrical-v7.js?v=7&amp;cb=CB-UNIFIED-0001 */
try{
/* Source-located B737 Classic Electrical power trainer V7.
 * References: Private Technical Database FCOM chapter 6 folios 6.10.6–9,
 * 6.20.1–4,6.20.8–12. Not a certified load schedule or aircraft wiring map.
 * Avoid conflating source-described bus connectivity with device-specific feeds.
 */
(function(root,factory){'use strict';const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737ElectricalV7=a;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const REF=Object.freeze({ac:'FCOM 6.20.1-4 (private DB 1150-1153)',dc:'FCOM 6.20.8-10 (private DB 1157-1159)',standby:'FCOM 6.10.7 / 6.20.11-12 (private DB 1146,1160-1161)',lamps:'FCOM 6.10.8-9 (private DB 1147-1148)',ground:'FCOM 6.20.2 (private DB 1151)'});
 const FAULTS=Object.freeze(['GEN1_FAILED','GEN2_FAILED','APU_FAILED','TR1_FAILED','TR2_FAILED','TR3_FAILED','BATTERY_DEPLETED','STATIC_INVERTER_FAILED','TRANSFER1_RELAY_FAILED','TRANSFER2_RELAY_FAILED']);
 const CONTROL_KEYS=Object.freeze({onGround:'boolean',batterySwitch:'boolean',busTransferAuto:'boolean',groundPowerAttached:'boolean',groundPowerQualityGood:'boolean',groundServiceSelected:'boolean',apuRunning:'boolean',engine1Running:'boolean',engine2Running:'boolean',glideslopeCaptured:'boolean',standbySelector:['AUTO','OFF','BAT']});
 const cpy=s=>JSON.parse(JSON.stringify(s));const trit=b=>b===null?null:Boolean(b);
 function initialState({coldDark=false}={}){
  // The original fully-powered baseline is retained for legacy isolated
  // training benches. Integrated ECU sessions explicitly request coldDark;
  // physical engine observations then own every source-running transition.
  if(typeof coldDark!=='boolean')throw Error('Invalid electrical startup preset');
  return {schema:'b737-electrical/7',rev:0,config:{
   onGround:true,batterySwitch:!coldDark,busTransferAuto:true,
   groundPowerAttached:false,groundPowerQualityGood:true,groundServiceSelected:false,
   apuRunning:false,engine1Running:!coldDark,engine2Running:!coldDark,
   glideslopeCaptured:false,standbySelector:'AUTO'
  },source:coldDark?{1:null,2:null}:{1:'GEN1',2:'GEN2'},
   faults:Object.fromEntries(FAULTS.map(k=>[k,false])),events:[]};
 }
 function apply(s,cmd){if(!s||s.schema!=='b737-electrical/7')throw Error('Invalid Electrical V7 state');if(!cmd||typeof cmd.type!=='string')throw Error('Command required');if(cmd.type==='RESET')return initialState();const n=cpy(s),k=cmd.key,v=cmd.value;
   if(cmd.type==='CONTROL'){if(!Object.hasOwn(CONTROL_KEYS,k))throw Error('Unknown electrical control');const type=CONTROL_KEYS[k];if((type==='boolean'&&typeof v!=='boolean')||(Array.isArray(type)&&!type.includes(v)))throw Error('Invalid electrical control value');n.config[k]=v;
     // FCOM Classic 6.20.2: external contactors drop on BAT OFF,
     // disconnected GPU cable, bad-quality supply or loss of ground status.
     // Restoring any of these conditions must NOT auto-select EXT; a new
     // momentary GRD PWR ON command is needed.
     if((k==='batterySwitch'&&!v)||(k==='groundPowerAttached'&&!v)||
        (k==='groundPowerQualityGood'&&!v)||(k==='onGround'&&!v)){
      for(const side of [1,2])if(n.source[side]==='EXT')n.source[side]=null;
      if(['groundPowerAttached','groundPowerQualityGood','onGround'].includes(k)&&!v)n.config.groundServiceSelected=false;
     }}
   else if(cmd.type==='SELECT_SOURCE'){
     if(!['GEN1','GEN2','APU','EXT','OFF'].includes(cmd.source))throw Error('Unknown source');
     if(![1,2].includes(cmd.side))throw Error('Invalid source side');
     if((cmd.source==='GEN1'&&cmd.side!==1)||(cmd.source==='GEN2'&&cmd.side!==2))throw Error('Generator-side mismatch');
     const cfg=n.config;
     if(cmd.source==='EXT'){
       if(!cfg.onGround||!cfg.batterySwitch||!cfg.groundPowerAttached||!cfg.groundPowerQualityGood)throw Error('External AC connection conditions not met');
       n.source[1]='EXT';n.source[2]='EXT';n.config.groundServiceSelected=false;
     }else if(cmd.source==='APU'){
       if(!cfg.apuRunning||n.faults.APU_FAILED)throw Error('APU source not ready');
       if(!cfg.onGround){const other=cmd.side===1?2:1;if(n.source[other]==='APU')n.source[other]=null;}// Flight: one bus only; selection priority is a trainer policy.
       n.source[cmd.side]='APU';
     }else if(cmd.source==='GEN1'||cmd.source==='GEN2'){
       const num=cmd.source==='GEN1'?1:2;
       if(!cfg['engine'+num+'Running']||n.faults['GEN'+num+'_FAILED'])throw Error('Engine generator not ready');
       n.source[cmd.side]=cmd.source;
     }else n.source[cmd.side]=null;
   }else if(cmd.type==='FAULT'){
     if(!FAULTS.includes(cmd.id)||typeof cmd.active!=='boolean'||cmd.instructor!==true)throw Error('Instructor-only listed fault required');n.faults[cmd.id]=cmd.active;
   }else throw Error('Unknown electrical command');
   n.rev++;n.events.push({rev:n.rev,cmd:cpy(cmd)});if(n.events.length>250)n.events.shift();return n;
 }
 function evaluate(s,{groundAutoPolicy='UNKNOWN'}={}){
  if(!s||s.schema!=='b737-electrical/7')throw Error('Invalid Electrical V7 state');
  if(!['UNKNOWN','INHIBIT_6_20_11','TRANSFER_6_10_7'].includes(groundAutoPolicy))throw Error('Invalid source-conflict policy');
  const c=s.config,f=s.faults;
  const cb=(name,value)=>globalThis.B737UnifiedCB?.gate('electrical.'+name,value)??value;
  const apuOnSystemBus=Object.values(s.source).includes('APU');
  // MRG Classic IV.6 printed p.148: BAT OFF on GND with APU GEN on SYS BUS requests APU auto shutdown.
  // Model AC output loss here; actual APU engine-plant shutdown is a separate integration contract.
  const apuShutdownDemand=Boolean(c.onGround&&!c.batterySwitch&&c.apuRunning&&apuOnSystemBus);
  const ready={GEN1:cb('gen1Control',c.engine1Running&&!f.GEN1_FAILED),GEN2:cb('gen2Control',c.engine2Running&&!f.GEN2_FAILED),APU:cb('apuGenControl',c.apuRunning&&!f.APU_FAILED&&!apuShutdownDemand),EXT:cb('externalPowerControl',c.onGround&&c.batterySwitch&&c.groundPowerAttached&&c.groundPowerQualityGood)};
  const powered={};for(const side of [1,2]){const source=s.source[side];powered[side]=source&&ready[source]?source:null;}
  // No AC paralleling; each generator bus has at most one source.
  const gen={1:powered[1]!==null,2:powered[2]!==null};
  const transfer={};const transferSource={};
  for(const side of [1,2]){
    const other=side===1?2:1;const relayFault=f['TRANSFER'+side+'_RELAY_FAILED']||cb('transfer'+side+'Control',true)===false;
    const feed=gen[side]?side:(c.busTransferAuto&&gen[other]&&!relayFault?other:null);
    transfer[side]=feed!==null;transferSource[side]=feed===null?null:'GENERATOR_BUS_'+feed;
  }
  const main={1:gen[1],2:gen[2]};
  const tr={TR1:cb('tr1',transfer[1]&&!f.TR1_FAILED),TR2:cb('tr2',transfer[2]&&!f.TR2_FAILED),TR3:cb('tr3',main[2]&&!f.TR3_FAILED)};
  const tie=!c.glideslopeCaptured&&c.busTransferAuto;
  const dc1=cb('dc1',tie?(tr.TR1||tr.TR2):tr.TR1);
  const dc2=cb('dc2',tie?(tr.TR1||tr.TR2):tr.TR2);
  const batteryAvailable=!f.BATTERY_DEPLETED&&(!s.battery||
   s.battery.chargeAh>0&&s.battery.available!==false);
  const serviceBus=Boolean((c.onGround&&c.groundServiceSelected&&c.groundPowerAttached&&c.groundPowerQualityGood)||gen[1]);
  // FCOM Classic 6.20.9 / ATA24: the charger is fed by GND SERVICE,
  // with the MAIN 2 alternate path. A depleted battery must NOT remove
  // the hot battery bus while the charger remains AC-powered.
  const chargerSource=cb('charger',serviceBus)?'GROUND_SERVICE':cb('alternateCharger',main[2])?'MAIN_2':null;
  const chargerAvailable=chargerSource!==null;
  const hotBattery=batteryAvailable||chargerAvailable;
  const hotBatterySource=chargerAvailable?'CHARGER':batteryAvailable?'BATTERY':null;
  const switchedHotBattery=hotBattery&&c.batterySwitch;
  // Battery Bus relay is controlled by the BAT switch. With BAT OFF the
  // bus is dead even if TR3 runs; standby BAT overrides this relay.
  const forcedStandbyBattery=c.standbySelector==='BAT';
  const batteryBus=cb('batteryBus',forcedStandbyBattery?hotBattery:
   c.batterySwitch&&(tr.TR3||hotBattery));
  // TR3 is a described backup source; exact automatic backfeed routing is not validated here.
  const dcTr3BackupUnknown=tr.TR3&&!(tr.TR1||tr.TR2);
  let acStandby=false,dcStandby=false,standbyFeed='OFF';
  const inverterAvailable=cb('inverterControl',true)&&cb('inverterPower',hotBattery&&batteryBus&&!f.STATIC_INVERTER_FAILED);
  if(c.standbySelector==='BAT'){
    // BAT manually forces the hot-battery-bus path, regardless of BAT switch
    // or normal AC. The inverter still needs a healthy source of DC power.
    acStandby=inverterAvailable;dcStandby=batteryBus;standbyFeed='BATTERY_SELECTOR';
  }else if(c.standbySelector==='AUTO'){
    if(transfer[1]&&dc1){
      // Normal supply operates independently of BAT switch position.
      acStandby=true;dcStandby=true;standbyFeed='TRANSFER1_DC1';
    }else if(c.onGround){
      // Classic (NOT NG): no automatic standby transfer on ground.
      acStandby=false;dcStandby=false;standbyFeed='GROUND_NO_AUTO_TRANSFER';
    }else{
      acStandby=c.batterySwitch&&inverterAvailable;
      dcStandby=c.batterySwitch&&batteryBus;
      standbyFeed='BATTERY_AUTO_AIR';
    }
  }
  // Essential output status preserves UNKNOWN rather than falsely resolving undocumented routes.
  const bus={generator1:gen[1],generator2:gen[2],transfer1:transfer[1],transfer2:transfer[2],main1:main[1],main2:main[2],dc1:dcTr3BackupUnknown?null:dc1,dc2:dcTr3BackupUnknown?null:dc2,battery:batteryBus,hotBattery,switchedHotBattery,acStandby:trit(acStandby),dcStandby:trit(dcStandby),groundService:serviceBus};
  const lamps={busOff1:!gen[1],busOff2:!gen[2],transferBusOff1:!transfer[1],transferBusOff2:!transfer[2],genOffBus1:c.engine1Running===true&&powered[1]!=='GEN1',genOffBus2:c.engine2Running===true&&powered[2]!=='GEN2',groundPowerAvailable:c.groundPowerAttached&&c.groundPowerQualityGood,standbyPowerOff:acStandby===null?null:!acStandby};
  const distinctSources=new Set(Object.values(powered).filter(Boolean));
  const galleyShed=c.onGround?false:distinctSources.size===1;
  const qa=[];
  if(apuShutdownDemand)qa.push({id:'CLASSIC_MRG_P148_APU_GROUND_BATTERY_OFF',detail:'APU generator SYS BUS deenergized; APU engine auto-shutdown request must be applied to upstream plant',level:'SOURCE_MATCH_PLANT_INTEGRATION_PENDING'});
  if(dcTr3BackupUnknown)qa.push({id:'TR3_BACKUP_ROUTE',detail:'TR3 supply to DC 1/2 needs installation wiring QA',level:'UNKNOWN'});
  if(!c.onGround&&s.source[1]==='APU'&&s.source[2]==='APU')qa.push({id:'APU_FLIGHT_DUAL_FEED',detail:'APU dual flight buses not supported; reconnect by selection',level:'INVALID'});
  return {schema:'B737_ELECTRICAL_V7_RESULT',revision:s.rev,source:{...powered},bus,
   feed:{transferSource,tie,tr,standbyFeed,chargerSource,batteryAvailable,hotBatterySource},
   lamps,galleyShed,apuAutomaticShutdownRequested:apuShutdownDemand,qa,trace:{...REF},
   accuracy:{equipmentBusMap:'NOT_VERIFIED_FOR_EP_FSI',standbyGroundAuto:'CLASSIC_GROUND_NO_TRANSFER',
    tr3AutomaticFeed:'INCOMPLETE',model:'EDUCATIONAL_DISCRETE_ONLY'}};
 }
 function execute(commands){let s=initialState();for(const c of commands)s=apply(s,c);return evaluate(s);}
 return Object.freeze({REF,FAULTS,CONTROL_KEYS,initialState,apply,evaluate,execute});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/pneumatics-v6.js?v=AIRCON-FCOM-0001&amp;cb=CB-UNIFIED-0001 */
try{
/* B737 Classic pneumatic/air conditioning discrete trainer V6.
 * Sources: private Technical Database FCOM pages 982-984 (2.10.1-3), 988-989
 * (2.10.7-8), 1000-1001 (2.20.1-2), 1004 (2.20.5),
 * 1006-1007 (2.30.1-2), 1010 (2.30.5).
 * No pressure, temperature, valve travel or actual bus wiring physics.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737PneumaticsV6=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SIDES=['L','R'];
const FAULTS=Object.freeze(['engineBleed1ValveFailed','engineBleed2ValveFailed','apuBleedValveFailed','isolationJammedOpen','isolationJammedClosed','packLValveFailed','packRValveFailed','recircFanFailed','recircFanLFailed','recircFanRFailed']);
const CONTROL_TYPES=Object.freeze({engineBleed1:['ON','OFF'],engineBleed2:['ON','OFF'],apuBleed:['ON','OFF'],isolation:['CLOSE','AUTO','OPEN'],packL:['OFF','AUTO','HIGH'],packR:['OFF','AUTO','HIGH'],recirc:['OFF','AUTO'],recircL:['OFF','AUTO'],recircR:['OFF','AUTO'],aircraftFamily:['B737-300-500','B737-400'],temperatureL:['AUTO','MANUAL'],temperatureR:['AUTO','MANUAL']});
const INPUT_TYPES=Object.freeze({engine1FireHandle:'boolean',engine2FireHandle:'boolean',apuFireHandle:'boolean',engine1Running:'boolean',engine2Running:'boolean',apuRunning:'boolean',onGround:'boolean',flapsUp:'boolean',bleedValveControlPower:'boolean',isolationAcPower:'boolean',recircAcPower:'boolean',ductGaugeAcPower:'boolean',externalAirAvailable:'boolean',bleed1Overlimit:'boolean',bleed2Overlimit:'boolean',packLOverheat:'boolean',packROverheat:'boolean',ductLOverheat:'boolean',ductROverheat:'boolean',wingBodyLLeakDetected:'boolean',wingBodyRLeakDetected:'boolean',wingBodyTestHeld:'boolean',wingBodyLDetectorFailed:'boolean',wingBodyRDetectorFailed:'boolean',zoneContOverheat:'boolean',zoneFwdOverheat:'boolean',zoneAftOverheat:'boolean',packLPrimaryControlFailed:'boolean',packLStandbyControlFailed:'boolean',packRPrimaryControlFailed:'boolean',packRStandbyControlFailed:'boolean',contPrimaryTempControlFailed:'boolean',contStandbyTempControlFailed:'boolean',fwdTempControlFailed:'boolean',aftTempControlFailed:'boolean',cabinAltitudeFt:'number',ductLeftPsi:'numberOrNull',ductRightPsi:'numberOrNull'});
const SOURCES=Object.freeze({bleed:'FCOM 2.20.1-2; indexed pages 1000-1001',panel:'FCOM 2.10.2-3; indexed pages 983-984',packs:'FCOM 2.10.7-8,2.30.1-2; indexed pages 988-989,1006-1007',cooling:'FCOM 2.30.5; indexed page 1010',wingBody:'FCOM 2.20.5; indexed page 1004',cabinHorn:'FCOM 15.20 via existing WarningEngine'});
const copy=v=>JSON.parse(JSON.stringify(v));
function initial(){return {schema:'b737-pneumatics/6',seq:0,controls:{engineBleed1:'ON',engineBleed2:'ON',apuBleed:'OFF',isolation:'AUTO',packL:'AUTO',packR:'AUTO',recirc:'AUTO',recircL:'AUTO',recircR:'AUTO',aircraftFamily:'B737-300-500',temperatureL:'AUTO',temperatureR:'AUTO'},inputs:{engine1FireHandle:false,engine2FireHandle:false,apuFireHandle:false,engine1Running:true,engine2Running:true,apuRunning:false,onGround:true,flapsUp:false,bleedValveControlPower:true,isolationAcPower:true,recircAcPower:true,ductGaugeAcPower:true,externalAirAvailable:false,bleed1Overlimit:false,bleed2Overlimit:false,packLOverheat:false,packROverheat:false,ductLOverheat:false,ductROverheat:false,wingBodyLLeakDetected:false,wingBodyRLeakDetected:false,wingBodyTestHeld:false,wingBodyLDetectorFailed:false,wingBodyRDetectorFailed:false,zoneContOverheat:false,zoneFwdOverheat:false,zoneAftOverheat:false,packLPrimaryControlFailed:false,packLStandbyControlFailed:false,packRPrimaryControlFailed:false,packRStandbyControlFailed:false,contPrimaryTempControlFailed:false,contStandbyTempControlFailed:false,fwdTempControlFailed:false,aftTempControlFailed:false,cabinAltitudeFt:0,ductLeftPsi:null,ductRightPsi:null},faults:Object.fromEntries(FAULTS.map(f=>[f,false])),latched:{bleed1:false,bleed2:false,packL:false,packR:false,ductL:false,ductR:false,zoneCont:false,zoneFwd:false,zoneAft:false},events:[]};}
function ensure(s){if(!s||s.schema!=='b737-pneumatics/6'||!s.controls||!s.inputs||!s.latched)throw Error('Invalid pneumatic state');}
function validateInput(k,v){if(!Object.prototype.hasOwnProperty.call(INPUT_TYPES,k))throw Error('Unknown sensor '+k);const type=INPUT_TYPES[k];if(type==='boolean'&&typeof v!=='boolean')throw Error('Expected Boolean');if(type==='number'&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('Expected finite number');if(type==='numberOrNull'&&v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('Expected nonnegative pressure or null');}
function syncTrips(n){const i=n.inputs;for(const [target,trigger] of [['bleed1','bleed1Overlimit'],['bleed2','bleed2Overlimit'],['packL','packLOverheat'],['packR','packROverheat'],['ductL','ductLOverheat'],['ductR','ductROverheat'],['zoneCont','zoneContOverheat'],['zoneFwd','zoneFwdOverheat'],['zoneAft','zoneAftOverheat']])if(i[trigger])n.latched[target]=true;}
function apply(s,command){ensure(s);if(!command||typeof command.type!=='string')throw Error('Invalid pneumatic command');if(command.type==='RESET')return initial();const n=copy(s),c=n.controls,i=n.inputs;
 switch(command.type){
 case 'CONTROL':if(!Object.prototype.hasOwnProperty.call(CONTROL_TYPES,command.key)||!CONTROL_TYPES[command.key].includes(command.value))throw Error('Invalid switch/detent');c[command.key]=command.value;break;
 case 'SENSOR':validateInput(command.key,command.value);i[command.key]=command.value;break;
 case 'FAULT':if(!FAULTS.includes(command.id)||typeof command.active!=='boolean'||command.instructor!==true)throw Error('Instructor-only fault command');n.faults[command.id]=command.active;break;
 case 'TRIP_RESET':{
   // FCOM: reset only if the initiating condition has been corrected.
   const map={bleed1:'bleed1Overlimit',bleed2:'bleed2Overlimit',packL:'packLOverheat',packR:'packROverheat',ductL:'ductLOverheat',ductR:'ductROverheat',zoneCont:'zoneContOverheat',zoneFwd:'zoneFwdOverheat',zoneAft:'zoneAftOverheat'};
   for(const [lamp,sensor] of Object.entries(map))if(!i[sensor])n.latched[lamp]=false;
   break;}
 default:throw Error('Unknown pneumatic action');
 }
 syncTrips(n);n.seq++;n.events.push({seq:n.seq,command:copy(command)});if(n.events.length>500)n.events.shift();return n;
}
function derive(s){ensure(s);const c=s.controls,i=s.inputs,f=s.faults,t=s.latched;
 const cb=(name,value=true)=>globalThis.B737UnifiedCB?.gate('air.'+name,value)??value;
 // Valve availability is an explicit instructor signal. Missing physical bus wiring is NOT inferred.
 const e1=!i.engine1FireHandle&&cb('bleedLeftControl')&&c.engineBleed1==='ON'&&i.engine1Running&&i.bleedValveControlPower&&!t.bleed1&&!f.engineBleed1ValveFailed;
 const e2=!i.engine2FireHandle&&cb('bleedRightControl')&&c.engineBleed2==='ON'&&i.engine2Running&&i.bleedValveControlPower&&!t.bleed2&&!f.engineBleed2ValveFailed;
 const apu=!i.apuFireHandle&&c.apuBleed==='ON'&&i.apuRunning&&i.bleedValveControlPower&&!f.apuBleedValveFailed;
 const bothBleedsSelected=c.engineBleed1==='ON'&&c.engineBleed2==='ON';
 const bothPacksSelected=c.packL!=='OFF'&&c.packR!=='OFF';
 let isolation=cb('bleedIsolationControl',i.isolationAcPower)?(c.isolation==='OPEN'||(c.isolation==='AUTO'&&!(bothBleedsSelected&&bothPacksSelected))):null;
 if(f.isolationJammedOpen)isolation=true;else if(f.isolationJammedClosed)isolation=false;
 // LAN B737 Classic ATA36-10 pp.24,26,28: the APU feeds the LEFT
 // manifold (its junction is left of isolation); the ground-cart connector
 // is in the RIGHT pack bay. Preserve the approved isolation actuator logic.
 function supply(side){
  const local=side==='L'?(e1||apu):(e2||i.externalAirAvailable);
  const opposite=side==='L'?(e2||i.externalAirAvailable):(e1||apu);
  if(local)return true;
  if(isolation===true)return opposite;
  if(isolation===null&&opposite)return null;
  return false;
 }
 const duct={L:{engineSource:e1,anySupply:supply('L')},R:{engineSource:e2,anySupply:supply('R')}};
 const pack={};for(const side of SIDES){const key='pack'+side,mode=c[key],overheat=t[key],available=duct[side].anySupply;const extra400Trip=c.aircraftFamily==='B737-400'&&i[key+'PrimaryControlFailed']&&i[key+'StandbyControlFailed'];const valid=cb(key)&&mode!=='OFF'&&!overheat&&!extra400Trip&&!f[key+'ValveFailed'];const operational=valid?(available===true?true:available===null?null:false):false;pack[side]={selectedMode:mode,operational,tripOff:overheat||extra400Trip,ductOverheat:t['duct'+side],mixValveCommand:overheat||t['duct'+side]||mode==='OFF'?'FULL_COLD':'TEMP_SELECTOR',flow:'OFF'};}
 const operatingCount=SIDES.filter(x=>pack[x].operational===true).length;
 const apuOnly=apu&&c.engineBleed1==='OFF'&&c.engineBleed2==='OFF';
 for(const side of SIDES){const p=pack[side];if(p.operational===false){p.flow='OFF';continue;}if(p.operational===null){p.flow='UNKNOWN_SOURCE_ROUTE';continue;}
  if(c['pack'+side]==='HIGH')p.flow=i.onGround&&apu?'APU_HIGH':'HIGH';
  else if(apuOnly)p.flow='HIGH';
  else if(operatingCount===1&&!i.onGround&&i.flapsUp)p.flow='HIGH';
  else p.flow='NORMAL';
 }
 // Legacy 300/500 single fan remains unchanged. The 400 has two independently
 // selected fans; physical AC availability is an explicit existing input.
 const singleRecircActive=cb('recirc')&&c.recirc==='AUTO'&&i.recircAcPower&&!f.recircFanFailed&&!(operatingCount===2&&(c.packL==='HIGH'||c.packR==='HIGH'));
 const recircFans={
  L:{selectedMode:c.recircL??'AUTO',running:cb('recirc')&&(c.recircL??'AUTO')==='AUTO'&&i.recircAcPower&&!f.recircFanLFailed},
  R:{selectedMode:c.recircR??'AUTO',running:cb('recirc')&&(c.recircR??'AUTO')==='AUTO'&&i.recircAcPower&&!f.recircFanRFailed}
 };
 const recircActive=c.aircraftFamily==='B737-400'?(recircFans.L.running||recircFans.R.running):singleRecircActive;
 const dualBleed=apu&&(c.engineBleed1==='ON'||(c.engineBleed2==='ON'&&isolation===true));
 // FCOM SP.2: Momentary detector test cannot latch unrelated pack or bleed trips.
 const wingBody={L:cb('overheatDetector')&&(i.wingBodyLLeakDetected||(i.wingBodyTestHeld&&!i.wingBodyLDetectorFailed)),
  R:cb('overheatDetector')&&(i.wingBodyRLeakDetected||(i.wingBodyTestHeld&&!i.wingBodyRDetectorFailed))};
 const pack400={};
 for(const side of SIDES){
  const p=i['pack'+side+'PrimaryControlFailed'],s=i['pack'+side+'StandbyControlFailed'];
  pack400[side]={immediate:t['pack'+side]||(p&&s),
   recallOnly:!t['pack'+side]&&(p!==s),valveClosed:t['pack'+side]||(p&&s)};
 }
 const zoneTemp400={
  CONT:{immediate:t.zoneCont||(i.contPrimaryTempControlFailed&&i.contStandbyTempControlFailed),
   recallOnly:!t.zoneCont&&(i.contPrimaryTempControlFailed!==i.contStandbyTempControlFailed),trimValveClosed:t.zoneCont},
  FWD:{immediate:t.zoneFwd,recallOnly:!t.zoneFwd&&i.fwdTempControlFailed,trimValveClosed:t.zoneFwd},
  AFT:{immediate:t.zoneAft,recallOnly:!t.zoneAft&&i.aftTempControlFailed,trimValveClosed:t.zoneAft}
 };
 const gauges={L:cb('ductGauge',i.ductGaugeAcPower)?i.ductLeftPsi:null,R:cb('ductGauge',i.ductGaugeAcPower)?i.ductRightPsi:null,source:'EXPLICIT_SENSOR_ONLY_PRESSURE_NOT_CALCULATED'};
 return {schema:'b737-pneumatics-derived/6',seq:s.seq,pack400,zoneTemp400,bleed:{engine1ValveOpen:e1,engine2ValveOpen:e2,apuBleedValveOpen:apu,externalAirAttached:i.externalAirAvailable,isolationOpen:isolation,dualBleed,wingBody},duct,pack,recircFanRunning:recircActive,recircFans,recircInstallation:c.aircraftFamily,gauges,
 lamps:{dualBleed,bleedTrip1:t.bleed1,bleedTrip2:t.bleed2,packTripL:c.aircraftFamily==='B737-400'?pack400.L.immediate:t.packL,packTripR:c.aircraftFamily==='B737-400'?pack400.R.immediate:t.packR,ductOverheatL:c.aircraftFamily==='B737-400'?false:t.ductL,ductOverheatR:c.aircraftFamily==='B737-400'?false:t.ductR,wingBodyOverheatL:wingBody.L,wingBodyOverheatR:wingBody.R},
 toPressurization:{packConditionedAirAvailable:operatingCount>0?true:pack.L.operational===null||pack.R.operational===null?null:false,cabinPressureCalculated:false,source:'FCOM 2.30.1 functional supply only'},
 statuses:{physicalBleedPressure:'UNKNOWN',actualTemperature:'UNKNOWN',exactAPUAndGroundSourceRouting:'LEFT_APU_RIGHT_GROUND_FUNCTIONAL_LAN_ATA36',powerBusRouting:'NOT_VERIFIED',overlimitSensorThresholds:'NOT_IN_THIS_SOURCE_VIEW',faultFailureResponse:'SYNTHETIC_TRAINER',flightOperations:'NOT_FOR_FLIGHT'},sources:SOURCES};
}
function replay(commands){let s=initial();for(const a of commands)s=apply(s,a);return s;}
return Object.freeze({SIDES,FAULTS,INPUT_TYPES,CONTROL_TYPES,SOURCES,initial,apply,derive,replay});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
