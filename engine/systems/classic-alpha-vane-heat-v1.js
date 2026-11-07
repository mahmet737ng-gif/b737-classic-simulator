/* B737 Classic ATA30-31 left/right alpha-vane probe heater.
 * Lufthansa LAN ATA30: left and right heater elements are 115VAC from
 * TRANSFER BUS 1 and TRANSFER BUS 2 respectively, via PROBE HEAT A/B.
 * Annunciator electrical power is separately supplied by 28V DC indicator
 * circuits (simulator approximation: DC1 / DC2; actual P6 dim bus not modeled).
 * Main 1/2 AoA consumer rows in MRG are not a second heater element.
 * This is a functional trainer, not a wiring or dispatch authority.
 */
(function(root,factory){'use strict';
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicAlphaVaneHeatV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const CHANNELS=Object.freeze({
  L:Object.freeze({id:'probe-l-alpha',switchId:'pitot-a',heaterBus:'transfer1',
   indicatorBus:'dc1',sensorReferenceBus:'main1',cbId:'probe.alphaL'}),
  R:Object.freeze({id:'probe-r-alpha',switchId:'pitot-b',heaterBus:'transfer2',
   indicatorBus:'dc2',sensorReferenceBus:'main2',cbId:'probe.alphaR'})
 });
 function evaluate({buses={},switches={},cbAvailable=null}={}){
  const indicators={},channels={};
  for(const [side,c]of Object.entries(CHANNELS)){
   const requested=String(switches?.[c.switchId]||'OFF').toUpperCase()==='ON';
   const heaterBusPowered=buses?.[c.heaterBus]===true;
   const heaterCbClosed=typeof cbAvailable==='function'?cbAvailable(c.cbId)!==false:true;
   const heaterPower=requested&&heaterBusPowered&&heaterCbClosed;
   const lampBusPowered=buses?.[c.indicatorBus]===true;
   // Lamp illuminates when the current transformer does not detect heater
   // current, including the switch OFF case. A dead indicator bus leaves
   // the amber face dark even while the physical heater can still work.
   const amberOn=lampBusPowered&&!heaterPower;
   channels[side]=Object.freeze({
    id:c.id,requested,heaterBus:c.heaterBus,heaterBusPowered,
    heaterCbClosed,heaterPower,heaterCurrentDetected:heaterPower,
    indicatorBus:c.indicatorBus,lampBusPowered,amberOn,
    sensorReferenceBus:c.sensorReferenceBus,
    sensorReferenceBusPowered:buses?.[c.sensorReferenceBus]===true,
    switchMechanicalOperable:true,
    failure:!heaterBusPowered?'HEATER_AC_SUPPLY_LOST':
     !heaterCbClosed?'HEATER_CB_OPEN':
     !requested?'PROBE_HEAT_SWITCH_OFF':'NONE'
   });
   indicators[c.id]=amberOn;
  }
  return Object.freeze({
   schema:'B737_CLASSIC_ALPHA_VANE_HEAT_ATA30_V1',
   channels:Object.freeze(channels),lamps:Object.freeze(indicators)
  });
 }
 return Object.freeze({CHANNELS,evaluate});
});
