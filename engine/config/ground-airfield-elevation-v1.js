/* B737 Classic trainer: initial on-ground airport reference. User-supplied
 * scenario elevations in feet; not a replacement for a navigation database.
 * Aircraft GNSS/airport source data may override these presets explicitly. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737GroundAirfieldElevationV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const AIRFIELDS=Object.freeze({
   OIAW:Object.freeze({icao:'OIAW',name:'Ahwaz',elevationFt:66,origin:'USER_SCENARIO_VALUE'}),
   OIII:Object.freeze({icao:'OIII',name:'Mehrabad',elevationFt:3963,origin:'USER_SCENARIO_VALUE'}),
   OIMM:Object.freeze({icao:'OIMM',name:'Mashhad',elevationFt:3260,origin:'USER_SCENARIO_VALUE'})
 });
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function altitude(ft){
   if(!finite(ft)||ft< -2000||ft>14000)throw Error('Ground elevation must be finite feet in [-2000,14000]');
   return ft;
 }
 function resolve(icao,overrideFt){
   const code=typeof icao==='string'?icao.trim().toUpperCase():'';
   if(code&& !/^[A-Z0-9]{4}$/.test(code))throw Error('Airport ICAO must be four alphanumerics');
   if(overrideFt!==undefined&&overrideFt!==null){
     altitude(overrideFt);
     return Object.freeze({icao:code||null,fieldElevationFt:overrideFt,
       source:'EXPLICIT_FIELD_ELEVATION_FT',groundReferenceKnown:true});
   }
   const preset=AIRFIELDS[code];
   if(preset)return Object.freeze({icao:code,fieldElevationFt:preset.elevationFt,
     source:preset.origin,groundReferenceKnown:true});
   return Object.freeze({icao:code||null,fieldElevationFt:null,
     source:'AIRPORT_ELEVATION_NOT_PROVIDED',groundReferenceKnown:false});
 }
 function cabinBaseline(selection,{onGround=true,cabinEqualized=true}={}){
   if(!selection||!selection.groundReferenceKnown||!onGround||!cabinEqualized)
     return Object.freeze({status:'requires_pressure_sensor',cabinAltitudeFt:null,differentialPsid:null});
   return Object.freeze({status:'ground_equalized',
     cabinAltitudeFt:selection.fieldElevationFt,differentialPsid:0,
     cabinRateFtMin:0,unit:'ft',source:selection.source});
 }
 return Object.freeze({AIRFIELDS,resolve,cabinBaseline,altitude});
});
