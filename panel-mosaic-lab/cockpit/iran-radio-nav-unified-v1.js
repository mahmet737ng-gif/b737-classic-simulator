/* Unified B737 Classic — NAV tuning and actual training trajectory -> avionics bus.
 * Existing EFIS and RDMI instruments own rendering; no display DOM mutations.
 * Training model only; not real ILS radio propagation or AFDS guidance.
 */
(function(root){
 'use strict';
 const GEO=root.B737IranRadioNavaidsV1;
 if(!GEO||!root.document)return;
 const owners={},errors={},seats=['CAPT','FO'];
 let lastReason='NO_VALID_AIRCRAFT_POSITION',lastState={},started=false;
 function connect(){
  const net=root.B737UnifiedAvionicsNetworkV1;
  if(!net?.connectExternal)return false;
  for(const owner of ['VHF_NAV','DME','ILS']){
   if(owners[owner]||errors[owner])continue;
   try{owners[owner]=net.connectExternal(owner);}
   catch(err){errors[owner]=String(err.message||err);}
  }
  return Object.keys(owners).length>0;
 }
 function position(){
  const trainer=root.B737UnifiedFlightScenarioV1;
  const scene=trainer?.getDiagnostics?.()?.active===true?trainer.getState?.():null;
  if(scene&&Number.isFinite(scene.lat)&&Number.isFinite(scene.lon)&&Number.isFinite(scene.altitudeFt))
   return {lat:scene.lat,lon:scene.lon,altitudeFt:scene.altitudeFt,source:'FLIGHT_SCENARIO'};
  const s=root.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
  for(const key of ['irs.left','irs.right']){
   const record=s?.[key],v=record?.quality==='VALID'?record.value:null;
   if(v?.powered!==true||v?.positionValid!==true||!Number.isFinite(v.lat)||!Number.isFinite(v.lon))continue;
   const adc=s?.['airdata.adc'+(key==='irs.left'?1:2)];
   const alt=adc?.quality==='VALID'?adc.value?.pressureAltitudeFt:null;
   if(Number.isFinite(alt))return {lat:v.lat,lon:v.lon,altitudeFt:alt,source:'IRS_ADC'};
  }
  return null;
 }
 function magneticVariation(point){
  const mag=root.B737WMM2025V1?.evaluate?.({lat:point.lat,lon:point.lon,altitudeFt:point.altitudeFt});
  return mag?.valid===true&&Number.isFinite(mag.declinationDeg)?mag.declinationDeg:null;
 }
 function course(channel){
  const snapshot=root.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
  const record=snapshot?.['mcp.state'];
  if(record?.quality!=='VALID')return null;
  const mcp=record.value;
  if(mcp?.powered!==true||(channel===2&&mcp.course2Powered!==true))return null;
  const deg=channel===1?mcp.courseL:mcp.courseR;
  return Number.isFinite(deg)?deg:null;
 }
 function emit(owner,topic,payload,reason){
  const p=owners[owner];if(!p)return;
  try{p.publish(topic,payload,{quality:payload?'VALID':'UNKNOWN',
   origin:'TRAINING_SCENARIO',reason:payload?null:reason||'NO_TUNED_REFERENCE_SIGNAL'});}
  catch(err){errors[owner]=String(err.message||err);}
 }
 function refresh(){
  if(!connect())return false;
  const aircraft=position();
  lastReason=aircraft?'TRAINING_RADIONAV_ACTIVE':'NO_VALID_AIRCRAFT_POSITION';lastState={};
  for(let i=0;i<2;i++){
   const seat=seats[i],ch=i+1,ctl=root.B737UnifiedVHFNavControlsV1?.getState?.(seat);
   const frequencyKhz=ctl?.activeFrequencyKhz;
   const chReason=!aircraft?'POSITION_INVALID':!Number.isInteger(frequencyKhz)?'NAV_NOT_TUNED':null;
   if(chReason){
    emit('VHF_NAV','navigation.vor'+ch,null,chReason);
    emit('DME','navigation.dme'+ch,null,chReason);
    emit('ILS','navigation.ils'+ch,null,chReason);
    lastState[seat]={frequencyKhz:frequencyKhz??null,stationIdent:null,reason:chReason};continue;
   }
   const vor=GEO.match(frequencyKhz,'VOR',aircraft),ils=GEO.match(frequencyKhz,'ILS',aircraft);
   const source=ils||vor;
   const distance=source?GEO.ground(aircraft,source).distanceNm:Infinity;
   const inRange=!!source&&distance<=(ils?18:130);
   const variation=magneticVariation(source||aircraft);
   const calculated=inRange?GEO.evaluate(aircraft,source,{variationDeg:variation,courseMagDeg:course(ch)}):null;
   const ilsValid=!!ils&&calculated?.frontCourse===true;
   const vorValid=!!vor&&!!calculated;
   const vorData=vorValid?{
    stationIdent:vor.ident,stationLat:vor.lat,stationLon:vor.lon,
    tunedFrequencyMHz:vor.freqKhz/1000,bearingDeg:calculated.bearingDeg,
    bearingReference:'TRUE',radialDeg:calculated.radialMagDeg,
    toFrom:calculated.toFrom,deviationDots:calculated.deviationDots,
    trainingOnly:true,source:calculated.source}:null;
   const ilsData=ilsValid?{
    stationIdent:ils.ident,stationLat:ils.lat,stationLon:ils.lon,
    tunedFrequencyMHz:ils.freqKhz/1000,localizerDots:calculated.localizerDots,
    glideslopeDots:calculated.glideslopeDots,frontCourse:true,
    courseTrueDeg:ils.courseTrueDeg,courseMagDeg:ils.courseMagDeg??null,
    glideDeg:ils.glideDeg,tchFt:ils.tchFt??50,runway:ils.runway,
    trainingOnly:true,positionQuality:calculated.positionQuality,
    source:calculated.source}:null;
   const dmeData=(vorValid||ilsValid)?{
    stationIdent:source.ident,stationLat:source.lat,stationLon:source.lon,
    distanceNm:calculated.distanceNm,tunedFrequencyMHz:source.freqKhz/1000,
    trainingOnly:true,slantRange:true,source:calculated.source}:null;
   emit('VHF_NAV','navigation.vor'+ch,vorData,vor?'VOR_OUT_OF_RANGE':'NO_VOR_MATCH');
   emit('DME','navigation.dme'+ch,dmeData,'NO_VALID_DME');
   emit('ILS','navigation.ils'+ch,ilsData,ils?'ILS_NOT_IN_FRONT_COURSE':'NO_ILS_MATCH');
   lastState[seat]={frequencyKhz,stationIdent:vorValid||ilsValid?source.ident:null,
    type:vorValid?'VOR':ilsValid?'ILS':null,distanceNm:dmeData?.distanceNm??null,
    positionSource:aircraft.source,
    reason:vorValid||ilsValid?'TRAINING_GEOMETRY_VALID':'STATION_OUT_OF_RANGE_OR_NO_FRONT_COURSE'};
  }
  return true;
 }
 function schedule(){root.setTimeout?.(refresh,0);}
 for(const event of ['b737:vhf-nav-mode','b737:unified-vhf-frequency',
  'b737:nav-auto-frequency','b737:flight-scenario-state',
  'b737:flight-scenario-stopped','b737:efis-preset-change',
  'b737:irs-trainer-state'])root.addEventListener(event,schedule);
 function start(){if(started)return;started=true;refresh();root.setInterval?.(refresh,1000);}
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 root.B737UnifiedIranRadioNavV1=Object.freeze({version:'IRAN-RADIONAV-UNIFIED-0001',refresh,
  getState:()=>JSON.parse(JSON.stringify({reason:lastReason,channels:lastState,ownerErrors:errors})),
  stationCatalog:GEO.STATIONS});
})(window);
