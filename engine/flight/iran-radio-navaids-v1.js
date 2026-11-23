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
  {"ident":"ISN","type":"DVOR_DME","freqKhz":113200,"lat":32.74697222,"lon":51.82802778,"source":"IRAN_AIP_OIFM_AD2_19","quality":"AIP_PUBLISHED","dmeChannel":"79X","elevationFt":5072,"airport":"OIFM"},
  {"ident":"IFN","type":"TACAN","freqKhz":117100,"lat":32.74638889,"lon":51.82472222,"source":"IRAN_AIP_OIFM_AD2_19","quality":"AIP_PUBLISHED","tacanChannel":"118X","military":true,"airport":"OIFM","note":"TACAN_ONLY_NOT_CIVIL_VOR"},
  {"ident":"IFN","type":"NDB","freqKhz":337,"lat":32.749,"lon":51.88080556,"source":"IRAN_AIP_OIFM_AD2_19","quality":"AIP_PUBLISHED","airport":"OIFM"},
  {"ident":"VR","type":"NDB","freqKhz":373,"lat":35.34266667,"lon":51.63716667,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","airport":"TEHRAN_REGION","note":"AIP_373_KHZ_ICAO_ASIA_PAC_MAY_2026_LISTS_380_KHZ_VERIFY_BEFORE_USE"},
  {"ident":"KAZ","type":"NDB","freqKhz":358,"lat":35.516701,"lon":51.366901,"source":"OURAIRPORTS_COMMUNITY","quality":"COMMUNITY_ONLY_NOT_CURRENT_AIP_CONFIRMED","airport":"TEHRAN_REGION","note":"ICAO_FREQUENCY_LIST_HAS_KZ_AT_358_NOT_KAZ"},
  {"ident":"SAV","type":"NDB_DME","freqKhz":408,"lat":35.01855556,"lon":50.37136111,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","dmeFreqKhz":115200,"dmeChannel":"99X","name":"Saveh"},
  {"ident":"RSR","type":"NDB_DME","freqKhz":332,"lat":36.90347222,"lon":50.68044444,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","dmeFreqKhz":115500,"dmeChannel":"102X","name":"Ramsar"},
  {"ident":"DZF","type":"NDB","freqKhz":293,"lat":32.43802778,"lon":48.37827778,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Dezful"},
  {"ident":"KLH","type":"NDB","freqKhz":325,"lat":37.38808333,"lon":55.45661111,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Kalaleh"},
  {"ident":"JSK","type":"NDB","freqKhz":349,"lat":25.65161111,"lon":57.78347222,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Jask"},
  {"ident":"SRN","type":"NDB_DME","freqKhz":300,"lat":27.41502778,"lon":62.32541667,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Saravan","dmeChannel":"88X"},
  {"ident":"RAF","type":"NDB_DME","freqKhz":260,"lat":30.30275,"lon":56.05563889,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Rafsanjan","dmeChannel":"70X"},
  {"ident":"KHM","type":"NDB_DME","freqKhz":335,"lat":26.76308333,"lon":55.90766667,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Kishm","dmeChannel":"118X"},
  {"ident":"ABM","type":"NDB_DME","freqKhz":285,"lat":25.878,"lon":55.02280556,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Abumusa","dmeChannel":"101X"},
  {"ident":"ESH","type":"NDB","freqKhz":413,"lat":32.567166,"lon":51.69111,"source":"OURAIRPORTS_COMMUNITY","quality":"COMMUNITY_ONLY_NOT_AIP_CONFIRMED","name":"Shahid Vatan Pour","airport":"OIFH"},
  {ident:'DHN',type:'VOR_DME',freqKhz:114500,lat:35.254167,lon:52.720278,elevationFt:2756,source:'PUBLIC_IR_ENR_REFERENCE'},
  // ITRN is shown as OIIE RWY 29L in user chart; OIII uses ITHL.
  {"ident":"IIFN","type":"ILS_DME","freqKhz":109900,"lat":32.75701944,"lon":51.883725,"elevationFt":5043,"courseTrueDeg":257.96,"glideDeg":2.63,"tchFt":55,"runway":"25R","airport":"OIFM","source":"IRAN_AIP_OIFM_AD2_12_AD2_19","positionQuality":"AIP_SURVEYED_RWY_THR","localizerAntenna":{"lat":32.74786111,"lon":51.83302778},"glideAntenna":{"lat":32.75505556,"lon":51.88019444},"glideFreqKhz":333800,"dmeChannel":"36X","dmeLat":32.75508333,"dmeLon":51.88019444,"dmeElevationFt":5041,"locMaxNm":18,"gsMaxNm":10,"note":"CAT_I_25R_ILS_ONLY_NO_PUBLISHED_25L_ILS"},
  {"ident":"AA","type":"NDB","freqKhz":397,"lat":35.6337,"lon":51.4178,"source":"COMMUNITY_NAVAIDS_2026","quality":"NOT_AIP_VERIFIED","name":"Aliabad","airport":"TEHRAN_REGION"},
  {"ident":"RUS","type":"NDB","freqKhz":275,"lat":35.4451,"lon":50.9013,"source":"COMMUNITY_NAVAIDS_2026","quality":"NOT_AIP_VERIFIED","name":"Rudeshur","airport":"TEHRAN_REGION","note":"SEPARATE_FROM_RUS_VOR_DME_116_950"},
  {"ident":"PIM","type":"NDB","freqKhz":306,"lat":35.7618,"lon":50.8494,"source":"COMMUNITY_NAVAIDS_2026","quality":"NOT_AIP_VERIFIED","name":"Payam","airport":"OIIP"},
  {"ident":"SKD","type":"NDB","freqKhz":376,"lat":32.3055,"lon":50.8386,"source":"COMMUNITY_NAVAIDS_2026","quality":"NOT_AIP_VERIFIED","name":"Shahre Kord","airport":"OIFS"},
  {"ident":"HSA","type":"NDB_DME","freqKhz":230,"lat":32.9326,"lon":51.5601,"dmeChannel":"81Y","dmeFreqKhz":113450,"source":"COMMUNITY_NAVAIDS_2026","quality":"NOT_AIP_VERIFIED","name":"Hesa","airport":"OIFE","note":"DME_ANTENNA_ELEVATION_NOT_SURVEYED_NO_NUMERIC_DME"},
  {"ident":"PIM","type":"VOR_DME","freqKhz":117500,"lat":35.762001,"lon":50.851601,"elevationFt":4125,"source":"OURAIRPORTS_COMMUNITY","name":"Payam","airport":"OIIP"},
  {"ident":"SKD","type":"VOR_DME","freqKhz":117300,"lat":32.2798,"lon":50.8549,"elevationFt":6723,"source":"OURAIRPORTS_COMMUNITY","name":"Shahre Kord","airport":"OIFS"},
  {"ident":"RUS","type":"VOR_DME","freqKhz":116950,"lat":35.44547222,"lon":50.90536111,"elevationFt":3661,"source":"IRAN_AIP_ENR41","quality":"AIP_PUBLISHED","name":"Rudeshur","airport":"TEHRAN_REGION","note":"NOT_NDB_RUS_275_KHZ"},
  {ident:'ITRN',type:'ILS_DME',freqKhz:110700,lat:35.4114,lon:51.165798,elevationFt:3305,courseTrueDeg:290,glideDeg:3,runway:'29L',airport:'OIIE',source:'USER_IRAN_CHART_2620',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'IIKA',type:'ILS_DME',freqKhz:110300,lat:35.413101,lon:51.166000,elevationFt:3305,courseTrueDeg:288.88,glideDeg:3,runway:'29R',airport:'OIIE',source:'PUBLIC_OIIE_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  // Mehrabad OIII RWY 29L: ident ITHL, frequency 109.90 MHz; threshold is a TRAINING proxy, not localizer/DME surveyed antenna.
  {ident:'ITHL',type:'ILS_DME',freqKhz:109900,lat:35.682400,lon:51.333599,elevationFt:3797,dmeElevationFt:3804,courseMagDeg:285,courseTrueDeg:289.75,glideDeg:3.3,tchFt:59,locMaxNm:18,gsMaxNm:10,runway:'29L',airport:'OIII',source:'JEPPESEN_OIII_11-1_IRAN2620_CHART',positionQuality:'PROVISIONAL_RWY_THR',dmePositionQuality:'COLOCATED_THRESHOLD_TRAINING_PROXY'},
  {ident:'IMSD',type:'ILS_DME',freqKhz:109900,lat:36.224098,lon:59.657100,elevationFt:3263,courseTrueDeg:313.74,glideDeg:3,runway:'31R',airport:'OIMM',source:'PUBLIC_OIMM_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'ISYZ',type:'ILS_DME',freqKhz:109900,lat:29.5391667,lon:52.5898333,elevationFt:4927,courseTrueDeg:294.4,glideDeg:3,runway:'29L',airport:'OISS',source:'PUBLIC_OISS_APPROACH_REF',positionQuality:'PROVISIONAL_AIRPORT_ARP'}
 ];
 const MORSE=Object.freeze({A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'});
 const morseOf=ident=>String(ident||'').toUpperCase().split('').map(ch=>MORSE[ch]||'').join(' ').trim();
 const STATIONS=Object.freeze(sites.map(s=>Object.freeze({...s,morseCode:morseOf(s.ident)})));
 const ALIASES=Object.freeze({MHD:'MSD',KZ:'KAZ'}); // MHD is an IATA airport code, not a separate VOR
 const byIdent=(ident,type=null)=>STATIONS.find(s=>s.ident===(ALIASES[String(ident).toUpperCase()]||String(ident).toUpperCase())&&(!type||(type==='NDB'?s.type==='NDB'||s.type==='NDB_DME':s.type===type)))||null;
 function ground(from,to){
  const a=rad(from.lat),b=rad(to.lat),dl=rad(to.lon-from.lon),dp=b-a;
  const h=Math.sin(dp/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  const distanceNm=2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(h)));
  const bearingTrue=wrap(Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl))/R);
  return {distanceNm,bearingTrue};
 }
 function dmeSlantNm(aircraft,station){
  if(station.type==='NDB'||(!Number.isFinite(station.dmeElevationFt)&&!Number.isFinite(station.elevationFt)))return null;
  const dme=Number.isFinite(station.dmeLat)&&Number.isFinite(station.dmeLon)?{lat:station.dmeLat,lon:station.dmeLon}:station;
  const g=ground(aircraft,dme).distanceNm;
  return Math.hypot(g,(Number(aircraft.altitudeFt)-Number(station.dmeElevationFt??station.elevationFt))/FT_PER_NM);
 }
 function validAircraft(a){return a&&Number.isFinite(a.lat)&&Math.abs(a.lat)<=90&&Number.isFinite(a.lon)&&Math.abs(a.lon)<=180&&Number.isFinite(a.altitudeFt);}
 function evaluate(aircraft,station,{variationDeg=null,courseMagDeg=null}={}){
  if(!validAircraft(aircraft)||!station)return null;
  const g=ground(aircraft,station),out={stationIdent:station.ident,stationLat:station.lat,stationLon:station.lon,
   tunedFrequencyMHz:station.freqKhz>=100000?station.freqKhz/1000:null,tunedFrequencyKHz:station.freqKhz,distanceNm:dmeSlantNm(aircraft,station),morseCode:station.morseCode,
   bearingDeg:g.bearingTrue,bearingReference:'TRUE',groundDistanceNm:g.distanceNm,
   quality:'TRAINING_GEOMETRY',source:station.source};
  if(station.type==='NDB'||station.type==='NDB_DME')return {...out,radialMagDeg:null,toFrom:null,deviationDots:null,quality:'TRAINING_ADF_BEARING_ONLY_NO_SIGNAL_MODEL'};
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
  // 0.01NM numerical tolerance allows an exact 10NM great-circle final at
  // decimal-degree station coordinates (not an extra reception claim).
  const gsValid=front&&g.distanceNm<=(station.gsMaxNm??10)+.01&&Math.abs(actualGlide-station.glideDeg)<=5;
  return {...out,frontCourse:front,runway:station.runway,airport:station.airport,
   localizerDots:loc,glideslopeDots:gsValid?clamp((actualGlide-station.glideDeg)/.35,-2.5,2.5):null,
   glidepathAngleDeg:actualGlide,courseTrueDeg:station.courseTrueDeg,courseMagDeg:station.courseMagDeg??null,tchFt:station.tchFt??50,positionQuality:station.positionQuality};
 }
 function match(freqKhz,type,aircraft=null){
  if(!Number.isInteger(freqKhz))return null;
  const options=STATIONS.filter(s=>s.freqKhz===freqKhz&&(type==='ILS'?s.type==='ILS_DME':type==='NDB'?(s.type==='NDB'||s.type==='NDB_DME'):type==='TACAN'?s.type==='TACAN':(s.type==='VOR_DME'||s.type==='DVOR_DME'||s.type==='VORTAC')));
  if(!options.length)return null;
  if(options.length===1)return options[0];
  if(!validAircraft(aircraft))return null;
  return options.sort((a,b)=>ground(aircraft,a).distanceNm-ground(aircraft,b).distanceNm)[0];
 }
 return Object.freeze({version:'IRAN-RADIONAV-TRAINING-0004-OIFM-AIP-NDB',STATIONS,ALIASES,morseOf,byIdent,ground,dmeSlantNm,evaluate,match,wrap,delta});
});
