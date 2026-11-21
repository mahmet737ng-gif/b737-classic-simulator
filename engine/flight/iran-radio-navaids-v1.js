/* B737 Classic Unified — educational VOR/DME and ILS geometry.
 * Community reference data only. NOT an AIRAC database, approved approach,
 * radio-propagation model, actual station status or flight-navigation source.
 * Runway threshold approximation is explicitly flagged for ILS; DME is
 * slant range to the modeled reference point, NOT a surveyed DME antenna.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737IranRadioNavaidsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const R=Math.PI/180,EARTH_NM=3440.065,FT_PER_NM=6076.11549;
 const rad=n=>n*R,wrap=n=>(n%360+360)%360,delta=(a,b)=>((wrap(a-b)+540)%360)-180;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Existing OurAirports reference positions, published IR ENR references
 // and reference approach/runway locations. Nonoperational trainer data.
 const sites=[
  {ident:'TRN',type:'VOR_DME',freqKhz:115300,lat:35.696999,lon:51.283798,elevationFt:3960,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'IKA',type:'VOR_DME',freqKhz:114300,lat:35.409698,lon:51.178501,elevationFt:3280,source:'OURAIRPORTS_COMMUNITY',note:'SIMULATED_ONLY_STATION_STATUS_UNVERIFIED'},
  {ident:'MSD',type:'VOR_DME',freqKhz:114000,lat:36.231201,lon:59.650600,elevationFt:3251,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'SYZ',type:'VOR_DME',freqKhz:117800,lat:29.540199,lon:52.588799,elevationFt:4920,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'IFN',type:'VORTAC',freqKhz:117100,lat:32.746389,lon:51.824722,elevationFt:5063,source:'PUBLIC_IR_ENR_REFERENCE'},
  {ident:'DHN',type:'VOR_DME',freqKhz:114500,lat:35.254167,lon:52.720278,elevationFt:2756,source:'PUBLIC_IR_ENR_REFERENCE'},
  // ITRN is shown as OIIE RWY 29L in user chart; OIII uses ITHL.
  {ident:'ITRN',type:'ILS_DME',freqKhz:110700,lat:35.4114,lon:51.165798,elevationFt:3305,courseTrueDeg:290,glideDeg:3,runway:'29L',airport:'OIIE',source:'USER_IRAN_CHART_2620',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'IIKA',type:'ILS_DME',freqKhz:110300,lat:35.413101,lon:51.166000,elevationFt:3305,courseTrueDeg:288.88,glideDeg:3,runway:'29R',airport:'OIIE',source:'PUBLIC_OIIE_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  // Mehrabad OIII RWY 29L: ident ITHL, frequency 109.90 MHz; threshold is a TRAINING proxy, not localizer/DME surveyed antenna.
  {ident:'ITHL',type:'ILS_DME',freqKhz:109900,lat:35.682400,lon:51.333599,elevationFt:3797,dmeElevationFt:3804,courseMagDeg:285,courseTrueDeg:289.75,glideDeg:3.3,tchFt:59,locMaxNm:18,gsMaxNm:10,runway:'29L',airport:'OIII',source:'JEPPESEN_OIII_11-1_IRAN2620_CHART',positionQuality:'PROVISIONAL_RWY_THR',dmePositionQuality:'COLOCATED_THRESHOLD_TRAINING_PROXY'},
  {ident:'IMSD',type:'ILS_DME',freqKhz:109900,lat:36.224098,lon:59.657100,elevationFt:3263,courseTrueDeg:313.74,glideDeg:3,runway:'31R',airport:'OIMM',source:'PUBLIC_OIMM_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'ISYZ',type:'ILS_DME',freqKhz:109900,lat:29.5391667,lon:52.5898333,elevationFt:4927,courseTrueDeg:294.4,glideDeg:3,runway:'29L',airport:'OISS',source:'PUBLIC_OISS_APPROACH_REF',positionQuality:'PROVISIONAL_AIRPORT_ARP'}
 ];
 const STATIONS=Object.freeze(sites.map(s=>Object.freeze(s)));
 const ALIASES=Object.freeze({MHD:'MSD'}); // MHD is an IATA airport code, not a separate VOR
 const byIdent=ident=>STATIONS.find(s=>s.ident===(ALIASES[String(ident).toUpperCase()]||String(ident).toUpperCase()))||null;
 function ground(from,to){
  const a=rad(from.lat),b=rad(to.lat),dl=rad(to.lon-from.lon),dp=b-a;
  const h=Math.sin(dp/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  const distanceNm=2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(h)));
  const bearingTrue=wrap(Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl))/R);
  return {distanceNm,bearingTrue};
 }
 function dmeSlantNm(aircraft,station){
  const g=ground(aircraft,station).distanceNm;
  return Math.hypot(g,(Number(aircraft.altitudeFt)-Number(station.dmeElevationFt??station.elevationFt))/FT_PER_NM);
 }
 function validAircraft(a){return a&&Number.isFinite(a.lat)&&Math.abs(a.lat)<=90&&Number.isFinite(a.lon)&&Math.abs(a.lon)<=180&&Number.isFinite(a.altitudeFt);}
 function evaluate(aircraft,station,{variationDeg=null,courseMagDeg=null}={}){
  if(!validAircraft(aircraft)||!station)return null;
  const g=ground(aircraft,station),out={stationIdent:station.ident,stationLat:station.lat,stationLon:station.lon,
   tunedFrequencyMHz:station.freqKhz/1000,distanceNm:dmeSlantNm(aircraft,station),
   bearingDeg:g.bearingTrue,bearingReference:'TRUE',groundDistanceNm:g.distanceNm,
   quality:'TRAINING_GEOMETRY',source:station.source};
  if(station.type!=='ILS_DME'){
   const radialTrue=ground(station,aircraft).bearingTrue;
   const radialMag=Number.isFinite(variationDeg)?wrap(radialTrue-variationDeg):null;
   const toMag=Number.isFinite(variationDeg)?wrap(g.bearingTrue-variationDeg):null;
   const crs=Number.isFinite(courseMagDeg)?wrap(courseMagDeg):null;
   const to=crs!==null&&toMag!==null&&Math.abs(delta(toMag,crs))<=90;
   return {...out,radialMagDeg:radialMag,toFrom:crs===null||toMag===null?null:to?'TO':'FROM',
    deviationDots:crs===null||radialMag===null?null:clamp((to?delta(toMag,crs):delta(radialMag,crs))/2,-2.5,2.5)};
  }
  const fromThreshold=ground(station,aircraft);
  const approachRay=wrap(station.courseTrueDeg+180);
  const offAxis=delta(fromThreshold.bearingTrue,approachRay);
  const front=Math.abs(offAxis)<=35&&g.distanceNm<=(station.locMaxNm??18);
  const loc=front?clamp(offAxis/1.25,-2.5,2.5):null;
  const effectiveNm=Math.max(.03,g.distanceNm);
  const actualGlide=Math.atan2(aircraft.altitudeFt-station.elevationFt-(station.tchFt??50),effectiveNm*FT_PER_NM)/R;
  const gsValid=front&&g.distanceNm<=(station.gsMaxNm??10)&&Math.abs(actualGlide-station.glideDeg)<=5;
  return {...out,frontCourse:front,runway:station.runway,airport:station.airport,
   localizerDots:loc,glideslopeDots:gsValid?clamp((actualGlide-station.glideDeg)/.35,-2.5,2.5):null,
   glidepathAngleDeg:actualGlide,courseTrueDeg:station.courseTrueDeg,courseMagDeg:station.courseMagDeg??null,tchFt:station.tchFt??50,positionQuality:station.positionQuality};
 }
 function match(freqKhz,type,aircraft=null){
  if(!Number.isInteger(freqKhz))return null;
  const options=STATIONS.filter(s=>s.freqKhz===freqKhz&&(type==='ILS'?s.type==='ILS_DME':s.type!=='ILS_DME'));
  if(!options.length)return null;
  if(options.length===1)return options[0];
  if(!validAircraft(aircraft))return null;
  return options.sort((a,b)=>ground(aircraft,a).distanceNm-ground(aircraft,b).distanceNm)[0];
 }
 return Object.freeze({version:'IRAN-RADIONAV-TRAINING-0003',STATIONS,ALIASES,byIdent,ground,dmeSlantNm,evaluate,match,wrap,delta});
});
