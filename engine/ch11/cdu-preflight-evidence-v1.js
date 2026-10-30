/* Chapter 11 FMC preflight source projection: IDENT 11.40.8-9,
 * POS INIT 11.40.11-13. Read-only; training-only, not for flight.
 * No invented aircraft model, NAV cycle, program, FMC last position, or clock.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737CDUPreflightEvidenceV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const contract='B737_CDU_PREFLIGHT_EVIDENCE_V1';
 const SOURCE=Object.freeze({
  MODEL:['VERIFIED_AIRCRAFT_PROFILE','FMC_PERFORMANCE_DATABASE'],
  ENG_RATING:['VERIFIED_ENGINE_CONFIG','FMC_PERFORMANCE_DATABASE'],
  NAV_DATA:['VERIFIED_NAV_DATABASE'],
  ACTIVE:['VERIFIED_NAV_DATABASE'],
  INACTIVE:['VERIFIED_NAV_DATABASE'],
  OP_PROGRAM:['VERIFIED_FMC_SOFTWARE'],
  SUPP_DATA:['VERIFIED_SUPPLEMENTAL_DATABASE']
 });
 const texts=Object.freeze({
  MODEL:/^737-(300|400|500)$/,
  ENG_RATING:/^\d{2}(?:\.\d)?K$/,
  NAV_DATA:/^[A-Z0-9._-]{1,24}$/,
  ACTIVE:/^[A-Z0-9/.-]{1,24}$/,
  INACTIVE:/^[A-Z0-9/.-]{1,24}$/,
  OP_PROGRAM:/^[A-Z0-9()./-]{1,24}$/,
  SUPP_DATA:/^[A-Z0-9/.-]{1,24}$/
 });
 const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
 function verifiedText(data,key){
  const x=data?.[key];if(!isObj(x)||x.quality!=='VALID'||!SOURCE[key]?.includes(x.origin))return '';
  const val=String(x.value||'').trim().toUpperCase();
  return texts[key].test(val)?val:'';
 }
 function formatCoord(n,degrees){
  if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>(degrees===2?90:180))return null;
  const h=degrees===2?(n<0?'S':'N'):(n<0?'W':'E');
  const rounded=Math.round(Math.abs(n)*600); // tenths of an arcminute
  const deg=Math.floor(rounded/600),minutes=rounded%600;
  return h+String(deg).padStart(degrees,'0')+'°'+String(Math.floor(minutes/10)).padStart(2,'0')+'.'+minutes%10;
 }
 function lastPosition(data){
  const s=data?.lastFmcPosition;
  if(!isObj(s)||s.quality!=='VALID'||s.origin!=='FMC_COMPUTED'||s.positionValid!==true)return '';
  const lat=formatCoord(s.lat,2),lon=formatCoord(s.lon,3);
  return lat&&lon?lat+' '+lon:'';
 }
 function clock(data){
  const x=data?.clock;
  if(!isObj(x)||x.quality!=='VALID'||!['CAPTAIN_CLOCK','FIRST_OFFICER_CLOCK'].includes(x.origin)||x.valid!==true)return '';
  if(typeof x.isoUtc!=='string'||!/Z$/.test(x.isoUtc))return '';
  const d=new Date(x.isoUtc);if(!Number.isFinite(d.valueOf()))return '';
  const dd=n=>String(n).padStart(2,'0');
  const tenths=Math.floor(d.getUTCSeconds()/6);
  return dd(d.getUTCHours())+dd(d.getUTCMinutes())+'.'+tenths+'Z'+dd(d.getUTCMonth()+1)+'/'+dd(d.getUTCDate());
 }
 function irsHeadingAvailable(data){
  return [data?.irs?.L,data?.irs?.R].some(u=>isObj(u)&&u.mode==='ATT'&&u.powered===true);
 }
 function irsPositionPrompt(data){
  const align=[data?.irs?.L,data?.irs?.R].some(u=>isObj(u)&&u.mode==='ALIGN'&&u.powered===true&&u.positionEntered!==true);
  return align?'□□□□':'';
 }
 function identValue(key,data){return verifiedText(data,key);}
 function posValue(key,data,active={}){
  if(key==='LAST_POS')return lastPosition(data);
  if(key==='GMT_DATE')return clock(data);
  if(key==='IRS_POS')return irsPositionPrompt(data);
  if(key==='IRS_HDG')return irsHeadingAvailable(data)?String(active.IRS_HDG||''):'';
  return String(active[key]||'');
 }
 return Object.freeze({schema:contract,identValue,posValue,lastPosition,clock,irsHeadingAvailable,
  irsPositionPrompt,formatCoord,verifiedText});
});
