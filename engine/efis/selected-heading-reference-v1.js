/* Unified 737 Classic magnetic selected heading reference (WMM2025).
 * MCP heading is MAGNETIC. IRS/FMC true heading is converted by independently
 * sourced declination; never convert the MCP bug to True on an EHSI.
 * NOAA/BGS WMM2025 modeled field is distinct from sensor/ARINC measurements.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737SelectedHeadingReferenceV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='SELECTED_MAGNETIC_HEADING_WMM2025_0002';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const norm=x=>((x%360)+360)%360;
 function resolve({selectedMagDeg=null,observedVariationDeg=null,
  observedSource=null,positionValid=false,lat=null,lon=null,
  altitudeFt=0,date}={}){
  const mcp=finite(selectedMagDeg)&&selectedMagDeg>=0&&selectedMagDeg<=360;
  const measured=finite(observedVariationDeg)&&Math.abs(observedVariationDeg)<=180;
  let variation=measured?observedVariationDeg:null;
  let source=measured?(observedSource||'IRS_SUPPLIED_MAGNETIC_VARIATION'):'MAGNETIC_VARIATION_UNAVAILABLE';
  let modeled=measured&&typeof observedSource==='string'&&
   observedSource.includes('WMM2025'),decimalYear=null;
  if(!measured&&positionValid===true){
   const model=globalThis.B737WMM2025V1?.evaluate?.({lat,lon,altitudeFt,date});
   if(model?.valid===true){
    variation=model.declinationDeg;source=model.source;
    decimalYear=model.decimalYear;modeled=true;
   }else if(model?.reason)source=model.reason;
  }
  return Object.freeze({selectedDisplayDeg:mcp&&finite(variation)?norm(selectedMagDeg):null,
   declinationDeg:variation,referenceSource:source,reference:'MAGNETIC',
   estimated:modeled,decimalYear,selectedHeadingMagneticDeg:mcp?norm(selectedMagDeg):null,
   quality:finite(variation)?modeled?'WMM2025_MODELED':'OBSERVED':'UNAVAILABLE'});
 }
 return Object.freeze({VERSION,resolve});
});
