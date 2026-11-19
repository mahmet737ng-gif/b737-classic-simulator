(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.EPFSI_SCENARIO_DEFAULTS=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
/* SIMULATOR DEFAULTS (USER DIRECTIVE), NOT CLAIMS ABOUT AIRCRAFT INSTALLED EQUIPMENT.
 * EP-FSI ASN29340 CFM56-3B-1 / 20K. AFM digitized N1 curves are NOT validated.
 * ISA = standard ambient air temperature vs pressure altitude, not fixed 15 C.
 * No Mach/TAT/PMC, aircraft sensor inputs, or N1 numbers are fabricated.
 */
const DEFAULTS=Object.freeze({
 registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000,
 weatherMode:'ISA',engineBleedMode:'ON',antiIceMode:'OFF',
 acPacks:'AUTO',bleedMode:'ON',
 pmcMode:'UNKNOWN'
});
const FEET_PER_M=1/0.3048;
function isaOatC(pressureAltitudeFt){
 if(!Number.isFinite(pressureAltitudeFt))return null;
 // ISA troposphere: 15 C at MSL, -6.5 C / km through 11 km; isothermal above.
 const heightKm=pressureAltitudeFt*0.3048/1000;
 if(heightKm>20||heightKm< -2)return null; // not an authorized atmospheric extrapolation
 return 15-6.5*Math.min(heightKm,11);
}
function normalize(input){
 const c=input||{};
 const hasManual=Number.isFinite(c.oatC);
 const weatherMode=c.weatherMode==null?(hasManual?'CUSTOM':'ISA'):c.weatherMode;
 if(!['ISA','CUSTOM'].includes(weatherMode))throw Error('UNKNOWN_WEATHER_MODE');
 const antiIceMode=c.antiIceMode??c.antiIce??DEFAULTS.antiIceMode;
 const engineBleedMode=c.engineBleedMode??c.engineBleed??DEFAULTS.engineBleedMode;
 const acPacks=c.acPacks??DEFAULTS.acPacks;
 const bleedMode=c.bleedMode??(engineBleedMode==='ON'?'ON':'OFF');
 if(!['OFF','ENGINE','WING','BOTH','COWL_TAI'].includes(antiIceMode))throw Error('INVALID_ANTI_ICE');
 if(!['ON','OFF'].includes(engineBleedMode))throw Error('INVALID_ENGINE_BLEED');
 if(!['AUTO','HIGH','OFF'].includes(acPacks))throw Error('INVALID_A_C_PACKS');
 const pressureAltitudeFt=Number.isFinite(c.pressureAltitudeFt)?c.pressureAltitudeFt:null;
 const oatC=weatherMode==='ISA'?isaOatC(pressureAltitudeFt):(hasManual?c.oatC:null);
 const derivedOat=weatherMode==='ISA'&&Number.isFinite(oatC);
 return Object.freeze({
   ...DEFAULTS,...c,weatherMode,pressureAltitudeFt,oatC,
   temperatureProvenance:derivedOat?'ISA_BY_PRESSURE_ALTITUDE':(hasManual&&weatherMode==='CUSTOM'?'EXPLICIT_OAT_OVERRIDE':'AWAITING_PRESSURE_ALTITUDE_OR_OAT'),
   antiIceMode,antiIce:antiIceMode==='ENGINE'?'COWL_TAI':antiIceMode,
   engineBleedMode,engineBleed:engineBleedMode,
   bleedMode,acPacks,
   // TAT is not equivalent to ambient ISA OAT; require Mach/actual sensor to derive it.
   tatC:Number.isFinite(c.tatC)?c.tatC:null,
   pmcMode:c.pmcMode??DEFAULTS.pmcMode
 });
}
return Object.freeze({DEFAULTS,isaOatC,normalize,FEET_PER_M});
});