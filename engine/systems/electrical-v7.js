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
 function initialState(){return {schema:'b737-electrical/7',rev:0,config:{onGround:true,batterySwitch:true,busTransferAuto:true,groundPowerAttached:false,groundPowerQualityGood:true,groundServiceSelected:false,apuRunning:false,engine1Running:true,engine2Running:true,glideslopeCaptured:false,standbySelector:'AUTO'},source:{1:'GEN1',2:'GEN2'},faults:Object.fromEntries(FAULTS.map(k=>[k,false])),events:[]};}
 function apply(s,cmd){if(!s||s.schema!=='b737-electrical/7')throw Error('Invalid Electrical V7 state');if(!cmd||typeof cmd.type!=='string')throw Error('Command required');if(cmd.type==='RESET')return initialState();const n=cpy(s),k=cmd.key,v=cmd.value;
   if(cmd.type==='CONTROL'){if(!Object.hasOwn(CONTROL_KEYS,k))throw Error('Unknown electrical control');const type=CONTROL_KEYS[k];if((type==='boolean'&&typeof v!=='boolean')||(Array.isArray(type)&&!type.includes(v)))throw Error('Invalid electrical control value');n.config[k]=v;if(k==='batterySwitch'&&!v){n.source[1]=n.source[1]==='EXT'?null:n.source[1];n.source[2]=n.source[2]==='EXT'?null:n.source[2];}}
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
  const apuOnSystemBus=Object.values(s.source).includes('APU');
  // MRG Classic IV.6 printed p.148: BAT OFF on GND with APU GEN on SYS BUS requests APU auto shutdown.
  // Model AC output loss here; actual APU engine-plant shutdown is a separate integration contract.
  const apuShutdownDemand=Boolean(c.onGround&&!c.batterySwitch&&c.apuRunning&&apuOnSystemBus);
  const ready={GEN1:c.engine1Running&&!f.GEN1_FAILED,GEN2:c.engine2Running&&!f.GEN2_FAILED,APU:c.apuRunning&&!f.APU_FAILED&&!apuShutdownDemand,EXT:c.onGround&&c.batterySwitch&&c.groundPowerAttached&&c.groundPowerQualityGood};
  const powered={};for(const side of [1,2]){const source=s.source[side];powered[side]=source&&ready[source]?source:null;}
  // No AC paralleling; each generator bus has at most one source.
  const gen={1:powered[1]!==null,2:powered[2]!==null};
  const transfer={};const transferSource={};
  for(const side of [1,2]){
    const other=side===1?2:1;const relayFault=f['TRANSFER'+side+'_RELAY_FAILED'];
    const feed=gen[side]?side:(c.busTransferAuto&&gen[other]&&!relayFault?other:null);
    transfer[side]=feed!==null;transferSource[side]=feed===null?null:'GENERATOR_BUS_'+feed;
  }
  const main={1:gen[1],2:gen[2]};
  const tr={TR1:transfer[1]&&!f.TR1_FAILED,TR2:transfer[2]&&!f.TR2_FAILED,TR3:main[2]&&!f.TR3_FAILED};
  const tie=!c.glideslopeCaptured&&c.busTransferAuto;
  const dc1=tie?(tr.TR1||tr.TR2):tr.TR1;
  const dc2=tie?(tr.TR1||tr.TR2):tr.TR2;
  const batteryHealthy=!f.BATTERY_DEPLETED&&(!s.battery||
   s.battery.chargeAh>0&&s.battery.available!==false);
  const hotBattery=batteryHealthy,switchedHotBattery=batteryHealthy&&c.batterySwitch;
  // FCOM 6.10.7: BAT forces the battery bus to the hot battery bus,
  // regardless of BATTERY switch. Do not show a dead intermediate bus
  // while claiming its inverter/standby consumers are powered.
  const batteryBus=c.standbySelector==='BAT'?batteryHealthy:
    tr.TR3||(batteryHealthy&&c.batterySwitch);
  const serviceBus=Boolean((c.onGround&&c.groundServiceSelected&&c.groundPowerAttached&&c.groundPowerQualityGood)||gen[1]);
  // TR3 is a described backup source; exact automatic backfeed routing is not validated here.
  const dcTr3BackupUnknown=tr.TR3&&!(tr.TR1||tr.TR2);
  let acStandby=false,dcStandby=false,standbyFeed='OFF',standbyGap=null;
  const batteryStandby=batteryHealthy&&batteryBus&&!f.STATIC_INVERTER_FAILED;
  if(c.standbySelector==='BAT'){
    // BAT bypasses battery-switch position for the standby battery path.
    acStandby=batteryHealthy&&!f.STATIC_INVERTER_FAILED;dcStandby=batteryHealthy;standbyFeed='BATTERY_SELECTOR';
  }else if(c.standbySelector==='AUTO'){
    if(transfer[1]&&dc1&&c.batterySwitch){acStandby=true;dcStandby=true;standbyFeed='TRANSFER1_DC1';}
    else if(!c.onGround){acStandby=c.batterySwitch&&batteryStandby;dcStandby=c.batterySwitch&&batteryHealthy;standbyFeed='BATTERY_AUTO_AIR';}
    else if(!gen[1]&&!gen[2]){
      standbyGap='FCOM 6.10.7 versus 6.20.11: ground all-AC-loss AUTO contradiction';
      if(groundAutoPolicy==='UNKNOWN'){acStandby=null;dcStandby=null;standbyFeed='UNKNOWN_SOURCE_CONFLICT';}
      else if(groundAutoPolicy==='INHIBIT_6_20_11'){acStandby=false;dcStandby=false;standbyFeed='GROUND_INHIBITED';}
      else {acStandby=c.batterySwitch&&batteryStandby;dcStandby=c.batterySwitch&&batteryHealthy;standbyFeed='GROUND_BATTERY_FCOM_6_10_7';}
    }else {acStandby=null;dcStandby=null;standbyFeed='GROUND_PARTIAL_LOSS_UNVERIFIED';standbyGap='Ground AUTO partial loss not resolved';}
  }
  // Essential output status preserves UNKNOWN rather than falsely resolving undocumented routes.
  const bus={generator1:gen[1],generator2:gen[2],transfer1:transfer[1],transfer2:transfer[2],main1:main[1],main2:main[2],dc1:dcTr3BackupUnknown?null:dc1,dc2:dcTr3BackupUnknown?null:dc2,battery:batteryBus,hotBattery,switchedHotBattery,acStandby:trit(acStandby),dcStandby:trit(dcStandby),groundService:serviceBus};
  const lamps={busOff1:!gen[1],busOff2:!gen[2],transferBusOff1:!transfer[1],transferBusOff2:!transfer[2],genOffBus1:powered[1]!=='GEN1',genOffBus2:powered[2]!=='GEN2',groundPowerAvailable:c.groundPowerAttached&&c.groundPowerQualityGood,standbyPowerOff:acStandby===null?null:!acStandby};
  const distinctSources=new Set(Object.values(powered).filter(Boolean));
  const galleyShed=c.onGround?false:distinctSources.size===1;
  const qa=[];
  if(standbyGap)qa.push({id:'STANDBY_GROUND_AUTO_CONFLICT',detail:standbyGap,level:'SOURCE_CONFLICT'});
  if(apuShutdownDemand)qa.push({id:'CLASSIC_MRG_P148_APU_GROUND_BATTERY_OFF',detail:'APU generator SYS BUS deenergized; APU engine auto-shutdown request must be applied to upstream plant',level:'SOURCE_MATCH_PLANT_INTEGRATION_PENDING'});
  if(dcTr3BackupUnknown)qa.push({id:'TR3_BACKUP_ROUTE',detail:'TR3 supply to DC 1/2 needs installation wiring QA',level:'UNKNOWN'});
  if(!c.onGround&&s.source[1]==='APU'&&s.source[2]==='APU')qa.push({id:'APU_FLIGHT_DUAL_FEED',detail:'APU dual flight buses not supported; reconnect by selection',level:'INVALID'});
  return {schema:'B737_ELECTRICAL_V7_RESULT',revision:s.rev,source:{...powered},bus,feed:{transferSource,tie,tr,standbyFeed},lamps,galleyShed,apuAutomaticShutdownRequested:apuShutdownDemand,qa,trace:{...REF},accuracy:{equipmentBusMap:'NOT_VERIFIED_FOR_EP_FSI',standbyGroundAuto:'CONFLICT_REQUIRES_REVIEW',tr3AutomaticFeed:'INCOMPLETE',model:'EDUCATIONAL_DISCRETE_ONLY'}};
 }
 function execute(commands){let s=initialState();for(const c of commands)s=apply(s,c);return evaluate(s);}
 return Object.freeze({REF,FAULTS,CONTROL_KEYS,initialState,apply,evaluate,execute});
});
