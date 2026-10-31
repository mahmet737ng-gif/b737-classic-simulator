/* B737 Classic CDU: derived, non-licensed AIRAC 2611 regional intake metadata.
 * Original user-provided 2621.zip was checked offline and remains private.
 * This is NOT a database, FMC installation, ACTIVE bank, or flyable route.
 * Only factual cycle/date/count metadata is exposed, never source records.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Airac2611MiddleEastPreviewV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='AIRAC2611-ME-SOURCE-PREVIEW-0001';
 const intake=Object.freeze({
  cycle:'2611',revision:1,scope:'IRAN_IRAQ_MIDDLE_EAST',
  validFrom:'2026-10-29',lastValid:'2026-11-25',expiresFrom:'2026-11-26',
  regionalProcedureFileCount:256,regionalAirportCoordinateCount:407,
  sourceCycleConflictInRegion:0,excludedOutOfRegionLegacyCycleFiles:6,
  perFileAiracMarkers:'ABSENT',sourceProvenance:'ARCHIVE_LEVEL_NAVDATA_2611',
  sourceOnly:true,fmcInstalled:false,fmcActive:false,fmcExecutable:false
 });
 const stamp=ymd=>{
  if(typeof ymd!=='string'||!/^\d{4}-\d\d-\d\d$/.test(ymd))throw Error('INVALID_AIRAC_DATE');
  const month=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const i=Number(ymd.slice(5,7));
  if(i<1||i>12||!Number.isFinite(Date.parse(ymd+'T00:00:00Z')))throw Error('INVALID_AIRAC_DATE');
  return ymd.slice(8,10)+month[i-1]+ymd.slice(0,4);
 };
 function identPreviewRow(row){
  if(!Number.isInteger(row)||row<1||row>6)throw Error('INVALID_IDENT_ROW');
  if(row===2)return {labelL:'NAV SOURCE',valueL:'2611 ME REF',labelR:'VALID FROM',valueR:stamp(intake.validFrom)};
  if(row===3)return {labelL:'LAST VALID',valueL:stamp(intake.lastValid),labelR:'EXPIRES',valueR:stamp(intake.expiresFrom)};
  return null;
 }
 return Object.freeze({VERSION,intake,stamp,identPreviewRow});
});
