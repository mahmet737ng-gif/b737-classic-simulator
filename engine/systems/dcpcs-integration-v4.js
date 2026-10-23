/* Isolated DCPCS + warning engine integration. No flight or pressure physics. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737DCPCSIntegrationV4=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 class Session {
  constructor({DCPCS,WarningEngine}={}){if(!DCPCS||!WarningEngine)throw Error('DCPCS and existing WarningEngine required');this.DCPCS=DCPCS;this.WarningEngine=WarningEngine;this.reset();}
  reset(){this.s=this.DCPCS.initial();this.warning=new this.WarningEngine({variant:'737-300'});this.events=[];return this.render();}
  send(a){if(!a||typeof a.type!=='string')throw Error('Invalid action');if(a.type==='RESET')return this.reset();
   if(a.type==='HORN_CUTOUT'){this.warning.cutoutCabin();this.events.push(a);return this.render();}
   this.s=this.DCPCS.apply(this.s,a);this.events.push(JSON.parse(JSON.stringify(a)));return this.render();
  }
  // Software handoff from the existing Stall Warning V3 functional N1/N2 interface.
  // No claim of physical channel, pin assignment or serial format.
  feedStallManagement(stallOutput){
   const source=stallOutput?.stall?.dcpcs || stallOutput?.dcpcs;
   if(!source||!Number.isFinite(source.engineN1Pct)||!Number.isFinite(source.engineN2Pct))throw Error('Source stall management N1/N2 values required');
   this.s=this.DCPCS.apply(this.s,{type:'INPUT',key:'engineN1Pct',value:source.engineN1Pct});
   this.s=this.DCPCS.apply(this.s,{type:'INPUT',key:'engineN2Pct',value:source.engineN2Pct});
   this.events.push({type:'STALL_MANAGEMENT_FUNCTIONAL_BRIDGE',source:'Stall Warning V3 / no pin mapping'});
   return this.render();
  }
  render(){const d=this.DCPCS.derive(this.s),i=this.s.input;
   const w=this.warning.update({onGround:i.onGround,cabinAltitudeFt:i.cabinAltitudeFt,
    gearDownLocked:true,flaps:5,pressureAltitudeFt:i.airplaneAltitudeFt,selectedAltitudeFt:0,
    leadingEdgeTakeoff:true,speedbrakeDown:true,parkingBrakeSet:false,stabilizerTrimTakeoff:true,
    takeoffThrust:false,thrustLever1Angle:45,thrustLever2Angle:45});
   return {schema:'b737-dcpcs-integrated/4',dcpcs:d,inputs:{...i},faults:{...this.s.faults},controls:{selector:this.s.selector,manualCommand:this.s.manualCommand},
    warning:{cabinAltitudeLamp:Boolean(w.lamps.cabinAltitude),activeAudioRequests:w.active.filter(x=>x.id==='intermittentHorn'),events:w.events},
    limitations:['CABIN_PRESSURE_NOT_SYNTHESIZED','NO_EXACT_VALVE_AUTO_MOTION','DCPCS_POWER_INDEPENDENT_INSTRUCTOR_INPUT','HORN_COMPUTED_BY_EXISTING_WARNING_ENGINE']};}
  replay(actions){this.reset();for(const a of actions)this.send(a);return this.render();}
 }
 return Object.freeze({Session});
});