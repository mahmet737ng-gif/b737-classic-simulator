/* Explicit starter/panel load PROFILE, not installed-aircraft WDM currents.
 * Live hardware positions and supply paths decide which profile loads draw.
 * AC fuel/hydraulic pumps are intentionally not invented as battery loads.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737BatteryPanelLoadsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 function project(state,e,{litLamps=0,brightness=50,apuPhase='OFF',irsModes={L:'OFF',R:'OFF'}}={}){
  if(state?.schema!=='b737-electrical/7'||e?.revision!==state.rev)throw Error('Matching electrical owner required');
  if(!Number.isInteger(litLamps)||litLamps<0||litLamps>500||!Number.isFinite(brightness)||brightness<0||brightness>100)throw Error('Invalid live panel load input');
  const loads=[],c=state.config,b=e.bus;
  function add(id,bus,amps,active){
   const powered=b[bus]===true;
   const fromBattery=bus==='hotBattery'||bus==='switchedHotBattery'||
    bus==='battery'&&(c.standbySelector==='BAT'||!e.feed.tr.TR3)||
    bus==='dcStandby'&&e.feed.standbyFeed!=='TRANSFER1_DC1';
   loads.push({id,bus,amps:active&&powered?amps:0,fromBattery:Boolean(fromBattery),
    active:Boolean(active&&powered),quality:'LIVE_SWITCH_WITH_TRAINING_CURRENT'});
  }
  add('HOT_BUS_KEEP_ALIVE','hotBattery',0.05,true);
  add('SWITCHED_CONTROL_RELAYS','switchedHotBattery',1.2,true);
  add('DC_PANEL_ELECTRONICS','battery',3,true);
  add('INSTRUMENT_BACKLIGHT','battery',4*brightness/100,true);
  add('ILLUMINATED_PANEL_LAMPS','battery',litLamps*0.06,true);
  add('APU_INLET_DOOR_MOTOR','hotBattery',2,apuPhase==='INLET_DOOR');
  add('APU_STARTER','hotBattery',250,apuPhase==='STARTING');
  for(const side of ['L','R']){
   if(!['OFF','ALIGN','NAV','ATT'].includes(irsModes[side]))throw Error('Invalid IRS load selector');
   // Right backup cutoff is a separate IRS engine responsibility; these are
   // panel-training current estimates, never a CB installation assertion.
   add('IRS_'+side+'_DC_CONTROL','switchedHotBattery',3.5,irsModes[side]!=='OFF');
  }
  add('DC_STANDBY_EQUIPMENT','dcStandby',8,true);
  const inverterOn=b.acStandby===true&&e.feed.standbyFeed!=='TRANSFER1_DC1';
  const inverterWatts=inverterOn?160:0;
  return {loadAmps:loads.filter(x=>x.fromBattery).reduce((sum,x)=>sum+x.amps,0),inverterWatts,
   chargerAvailable:b.groundService===true||b.main2===true,
   forcedFailed:state.faults.BATTERY_DEPLETED,loads,
   panelPower:b.battery===true||b.dc1===true||b.dc2===true||b.dcStandby===true,
   quality:'TRAINING_CURRENTS_AND_FEED_GROUPS_NOT_EP_FSI_LOAD_SCHEDULE'};
 }
 return Object.freeze({project});
});
