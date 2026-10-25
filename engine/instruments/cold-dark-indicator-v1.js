/* Cold & dark analogue instrument initial-condition resolver.
   Numeric physical states are separate from unverified pointer angles.
   Never write unknown sensor values as zero and never assume every dial
   starts at a twelve-o'clock marking. */
(function(root,factory){
 'use strict';
 const registry=(typeof module==='object'&&module.exports)?
   require('./cold-dark-indicator-policy-v1.json'):
   root?.B737ColdDarkIndicatorPolicyV1;
 const api=factory(registry);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ColdDarkIndicatorV1=api;
})(typeof globalThis==='object'?globalThis:this,function(registry){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const safe=(name,val,unit,source)=>Object.freeze({id:name,status:'physical_value_known',value:val,unit,source,calibrationApproved:false});
 const need=(name,why,unit)=>Object.freeze({id:name,status:'requires_system_state',value:null,unit,reason:why,calibrationApproved:false});
 const status=(name,state,reason,unit)=>Object.freeze({id:name,status:state,value:null,unit,reason,calibrationApproved:false});
 function context(profile={}){
   // Cold/dark conditions do not implicitly dictate outside temperature,
   // charge states, cabin altitude, surface positions or oxygen quantity.
   const defaults={enginesStopped:true,apuStopped:true,aircraftStationary:true,
     cabinEqualized:true,cabinPressureStable:true,bleedSourcesOff:true,
     airAndDuctPressureDissipated:false,allBusesDeenergized:true,
     engineOilPressureDissipated:true,hydraulicPressureDissipated:false,
     csdTemperatureEqualized:false,engineCooled:false,apuCooled:false,
     fieldElevationFt:null,indicatedAltitudeFt:null,ambientTemperatureC:null,
     fuelTemperatureC:null,cabinTemperatureC:null,oxygenPressurePsi:null,
     ductPressurePsi:null,flapPosition:null,engineOilTemperatureC:null,
     fuelFlowKgH:null,hydBrakePressurePsi:null,stabilizerTrim:null,
     rudderTrim:null,engineN1:null,engineN2:null,cabinAltitudeFt:null,
     fuelQuantities:null,clockTime:null,indicatedSpeedKts:null,
     selectedBus:null,selectorDriveOilMode:null};
   return Object.freeze({...defaults,...profile});
 }
 function resolve(id,c={}) {
   if(!registry?.entries||!Object.prototype.hasOwnProperty.call(registry.entries,id))
     throw Error('Unknown cold-dark gauge ID '+id);
   const p=registry.entries[id],v=context(c),kind=p.kind;
   const physical=(num,key,unit)=>finite(num)?safe(id,num,unit,key):need(id,'Missing '+key,unit);
   switch(kind){
    case 'electrically_unpowered':
      if(v.allBusesDeenergized)
        return status(id,'unpowered_mechanical_rest_unverified',
          'No measured per-gauge electrical meter zero-stop. Do not invent bearing.',p.unit);
      return need(id,'Read the selected powered bus and meter selector state',p.unit);
    case 'selector_dual_temperature':
      if(!['rise','inlet'].includes(v.selectorDriveOilMode))
        return status(id,'selector_unknown','RISE vs IN not selected; same physical tick has different values','°C');
      if(v.selectorDriveOilMode==='rise'&&v.enginesStopped&&v.csdTemperatureEqualized)
        return safe(id,0,'°C','CSD inlet/outlet thermal equilibrium');
      return physical(v.selectorDriveOilMode==='rise'?v.csdRiseC:v.csdInletC,
        'CSD '+v.selectorDriveOilMode+' sensor','°C');
    case 'dual_readings':{
      const press=v.cabinEqualized?safe('press',0,'psi','equalized ambient and cabin'):
        physical(v.cabinDiffPressurePsi,'cabinDiffPressurePsi','psi');
      const alt=finite(v.cabinAltitudeFt)?safe('cabAlt',v.cabinAltitudeFt,'ft','cabin sensor'):
        v.cabinEqualized&&finite(v.fieldElevationFt)?
        safe('cabAlt',v.fieldElevationFt,'ft','cabin equalized, field elevation assumed on QNH'):
        need('cabAlt','Cabin altitude depends on outside static pressure, not zero','ft');
      return Object.freeze({id,status:'dual_independent_values',needles:Object.freeze({press, cabAlt}),
        calibrationApproved:false});
    }
    case 'zero_on_stable_cabin':
      return v.cabinPressureStable?safe(id,0,'ft/min','stable cabin pressure'):
        physical(v.cabinRateFpm,'cabinRateFpm','ft/min');
    case 'zero_if_pneumatics_isolated':
      if(v.bleedSourcesOff&&v.airAndDuctPressureDissipated)
        return safe(id,0,'psi','pneumatic manifold depressurized');
      return physical(v.ductPressurePsi,'ductPressurePsi','psi');
    case 'ambient_sensor':
      return physical(id==='oh.fuel.temperature'?v.fuelTemperatureC:v.cabinTemperatureC,
        id==='oh.fuel.temperature'?'fuelTemperatureC':'cabinTemperatureC','°C');
    case 'thermal_or_power_dependent':
      return v.apuCooled&&finite(v.ambientTemperatureC)?
        safe(id,v.ambientTemperatureC,'°C','APU thermally cooled to ambient'):
        physical(v.apuEgtC,'apuEgtC','°C');
    case 'mechanical_low_stop':
      if(!v.aircraftStationary&&!finite(v.indicatedSpeedKts))
        return need(id,'Current IAS signal required','kt');
      return Object.freeze({id,status:'low_stop_if_offscale',
        physicalValue:finite(v.indicatedSpeedKts)?v.indicatedSpeedKts:0,unit:'kt',
        currentVisualMinKt:60,actualZeroMarkVerified:false,
        reason:'Photographed dial starts at 60 kt; a stationary aircraft is below the lowest tick',
        calibrationApproved:false});
    case 'zero_on_stable_static_pressure':
      return v.aircraftStationary?safe(id,0,'ft/min','stable static pressure'):
        physical(v.verticalSpeedFpm,'verticalSpeedFpm','ft/min');
    case 'static_pressure_altitude':
      if(finite(v.indicatedAltitudeFt))return safe(id,v.indicatedAltitudeFt,'ft','actual altimeter indication');
      return finite(v.fieldElevationFt)&&v.baroSettingMatchesQnh?
        safe(id,v.fieldElevationFt,'ft','field elevation at correctly set QNH'):
        need(id,'Static pressure and barometric setting required; not always 0 ft','ft');
    case 'rotor_zero':
      return v.enginesStopped?safe(id,0,'%', 'engine rotor stopped'):
        physical(id.includes('.n1.')?v.engineN1:v.engineN2,id.includes('.n1.')?'engineN1':'engineN2','%');
    case 'fuel_flow_zero':
      return v.enginesStopped?safe(id,0,'flow','engines stopped and fuel cutoff'):
        physical(v.fuelFlowKgH,'fuel flow sensor','flow');
    case 'oil_pressure_zero':
      return v.enginesStopped&&v.engineOilPressureDissipated?safe(id,0,'psi','oil pressure dissipated'):
        physical(v.oilPressurePsi,'oilPressurePsi','psi');
    case 'vibration_zero':
      return v.enginesStopped?safe(id,0,p.unit,'no rotating engine components'):
        physical(v.engineVibration,'engineVibration',p.unit);
    case 'engine_oil_thermal':
      return physical(v.engineOilTemperatureC,'engineOilTemperatureC','°C');
    case 'engine_thermal':
      return v.engineCooled&&finite(v.ambientTemperatureC)?
        safe(id,v.ambientTemperatureC,'°C','engine cooled to ambient'):
        physical(v.engineEgtC,'engineEgtC','°C');
    case 'fuel_quantity_retained':{
      const key=id.split('.').at(-1),quantity=v.fuelQuantities?.[key];
      return physical(quantity,'fuel quantity in tank '+key,p.unit);
    }
    case 'accumulator_retained':
      return physical(v.hydBrakePressurePsi,'hydBrakePressurePsi','psi');
    case 'hydraulics_condition':
      return v.hydraulicPressureDissipated?safe(id,0,'psi','hydraulic systems fully depressurized'):
        physical(v.hydPressurePsi,'hydPressurePsi','psi');
    case 'mechanical_last_position':{
      const value=id==='fo.flap_position'?v.flapPosition:
        id.startsWith('ped.stab_trim.')?v.stabilizerTrim:v.rudderTrim;
      return physical(value,'retained mechanical surface position',p.unit);
    }
    case 'bottle_pressure_retained':
      return physical(v.oxygenPressurePsi,'physical oxygen bottle PSI','psi');
    case 'clock_retained':
      return status(id,'clock_or_last_position','Clock may remain running on an independent supply; never force hands to 00:00',p.unit);
    case 'nav_power_dependent':
      return status(id,'nav_invalid_or_held','Without receiver power, bearing needles are not zero; retain/unavailable based on equipment',p.unit);
    case 'identity_unresolved':
    case 'indicator_identity_unknown':
      return status(id,'identity_unresolved',p.details,p.unit);
    default:return status(id,'system_state_required',p.details,p.unit);
   }
 }
 function snapshot(c){return Object.freeze(Object.fromEntries(Object.keys(registry.entries).map(id=>[id,resolve(id,c)])));}
 return Object.freeze({context,resolve,snapshot,registry});
});