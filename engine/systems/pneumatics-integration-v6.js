/* Pneumatics V6 integration: existing WarningEngine is authoritative for CAB ALT audio.
 * Cabin pressure is intentionally NEVER inferred from pack status.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737PneumaticsIntegrationV6=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
class Session{
 constructor({Pneumatics,WarningEngine}={}){if(!Pneumatics||typeof WarningEngine!=='function')throw Error('Pneumatics and WarningEngine dependencies required');this.Pneumatics=Pneumatics;this.WarningEngine=WarningEngine;this.reset();}
 reset(){this.state=this.Pneumatics.initial();this.warning=new this.WarningEngine({variant:'737-300'});this.log=[];return this.render();}
 send(action){if(action?.type==='HORN_CUTOUT'){this.warning.cutoutCabin();this.log.push({...action});return this.render();}this.state=this.Pneumatics.apply(this.state,action);if(action?.type==='RESET'){this.warning=new this.WarningEngine({variant:'737-300'});this.log=[];}else this.log.push(JSON.parse(JSON.stringify(action)));return this.render();}
 render(){const d=this.Pneumatics.derive(this.state),i=this.state.inputs;
  const w=this.warning.update({onGround:i.onGround,cabinAltitudeFt:i.cabinAltitudeFt,gearDownLocked:true,flaps:5,takeoffThrust:false,leadingEdgeTakeoff:true,speedbrakeDown:true,parkingBrakeSet:false,stabilizerTrimTakeoff:true,thrustLever1Angle:45,thrustLever2Angle:45});
  return {pneumatics:d,inputs:{...i},controls:{...this.state.controls},faults:{...this.state.faults},cabinWarning:{lamp:w.lamps.cabinAltitude,audio:w.active.filter(x=>x.id==='intermittentHorn'),events:w.events},relatedDCPCS:{supply:d.toPressurization,controlState:'SEPARATE_EXISTING_DCPCS_V4',cabinPressureValue:'NO_PHYSICAL_MODEL'},checkpoints:this.checklist(d),limitations:['NO_PRESSURE_DYNAMICS','NO_HARDWARE_BUS_WIRING','QRH_TRAINING_NOT_COMPLETE']};
 }
 checklist(d){return [{id:'identify',label:'Observe BLEED/PACK/DUCT annunciations',observed:Object.values(d.lamps).some(Boolean)},{id:'cause',label:'Inspect fault source and selected bleed/pack modes',observed:true},{id:'reset',label:'After clearing condition, attempt TRIP RESET',observed:!Object.values(this.state.latched).some(Boolean)}];}
 replay(actions){this.reset();for(const action of actions)this.send(action);return this.render();}
}
return Object.freeze({Session});
});