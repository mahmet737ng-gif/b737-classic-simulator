/* B737 Classic MCP magnetic selected heading -> EHSI reference.
 * A True-referenced compass must not draw a MAG heading directly. During an
 * instructor training scenario, use bounded nearby-airport WMM2020 2026
 * approximate declination, not a fabricated zero variation.
 *
 * Sources: AirportGuide WMM2020 model (Nov 2026):
 * OIII 5.0 E, OIMM 4.7 E, OISS 3.4 E.
 * This is a REGIONAL SIMULATION ESTIMATE, NOT AIP or certified WMM service.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737SelectedHeadingReferenceV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='SELECTED_HEADING_REFERENCE_0001';
 const AIRPORTS=Object.freeze([
  {icao:'OIII',lat:35.689175,lon:51.314392,variationE:5.0},
  {icao:'OIMM',lat:36.234821,lon:59.642949,variationE:4.7},
  {icao:'OISS',lat:29.539200,lon:52.589802,variationE:3.4}
 ]);
 const LIMIT_NM=90;
 const rad=x=>x*Math.PI/180;
 const norm=x=>((x%360)+360)%360;
 const number=x=>typeof x==='number'&&Number.isFinite(x);
 function distanceNm(lat,lon,p){
  const a=rad(lat),b=rad(p.lat),dl=rad(lon-p.lon),da=b-a;
  const h=Math.sin(da/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  return 3440.065*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
 }
 function nearest(lat,lon){
  if(!number(lat)||!number(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
  const candidates=AIRPORTS.map(x=>({...x,distanceNm:distanceNm(lat,lon,x)}))
   .sort((a,b)=>a.distanceNm-b.distanceNm);
  return candidates[0].distanceNm<=LIMIT_NM?candidates[0]:null;
 }
 function resolve({selectedMagDeg,displayTrueRef,observedVariationDeg=null,
   benchZeroVariation=false,trainerOnly=false,positionValid=false,lat=null,lon=null}={}){
  if(!number(selectedMagDeg)||selectedMagDeg<0||selectedMagDeg>360)
   return {selectedDisplayDeg:null,referenceSource:'MCP_SELECTED_HEADING_UNAVAILABLE',estimated:false};
  if(number(observedVariationDeg)&&Math.abs(observedVariationDeg)<=180){
   return {selectedDisplayDeg:norm(selectedMagDeg),referenceSource:'OBSERVED_MAGNETIC_VARIATION',
    declinationDeg:observedVariationDeg,estimated:false};
  }
  if(benchZeroVariation===true&&!displayTrueRef)
   return {selectedDisplayDeg:norm(selectedMagDeg),referenceSource:'TRAINING_ZERO_VARIATION',
    declinationDeg:0,estimated:true};
  // The rest of the EHSI is TRUE-referenced. Converting the MCP MAG command
  // requires a nonzero explicit estimate. Never silently equate MAG to TRUE.
  if(displayTrueRef===true&&trainerOnly===true&&positionValid===true){
   const site=nearest(lat,lon);
   if(site)return {selectedDisplayDeg:norm(selectedMagDeg+site.variationE),
    referenceSource:'TRAINING_WMM2020_ESTIMATE_'+site.icao,
    declinationDeg:site.variationE,site:site.icao,distanceNm:site.distanceNm,
    estimated:true};
  }
  return {selectedDisplayDeg:null,referenceSource:'MAG_TO_TRUE_REFERENCE_UNAVAILABLE',estimated:false};
 }
 return Object.freeze({VERSION,AIRPORTS,LIMIT_NM,nearest,resolve});
});
