/* B737 Classic CDU per-field prompt policy.
 * 737CL FCOM 11.10.5: boxes = required, dashes = optional.
 * Static page metadata remains source-specific; this module resolves
 * conditional mandatory fields without changing LSK geometry or IRS logic.
 * Training only — not for operational flight.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CDU_PROMPT_POLICY_V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CDU-PROMPT-SEMANTICS-20261031-01';
 const REQUIRED=Object.freeze({
  RTE:['ORIGIN','DEST'],
  POS_INIT:['IRS_POS'],
  PERF_INIT:['CRZ_ALT','RESERVES','CI']
 });
 const LENGTH=Object.freeze({
  ICAO:4,FL:5,ALT:5,CI_CL:3,WEIGHT:5,WEIGHT_CG:8,
  LATLON:11,SPEED:3,TEMP:3,WIND:7,QNH:5,HDG:3,
  WAYPOINT:5,AIRWAY:5,RUNWAY:3,FLIGHT:8,BEARDIST:9,
  IASMACH:6,CONSTRAINT:10,PROCEDURE:7
 });
 const text=v=>String(v??'').trim();
 const get=(reader,field,page)=>typeof reader==='function'?text(reader(field,page)):'';
 function mode(page,cell,reader){
  if(!cell||!cell.field)return 'NONE';
  const field=cell.field;
  if(page==='PERF_INIT'&&(field==='GW_CG'||field==='ZFW')){
   // One of GW or ZFW is needed. Neither is an independently compulsory
   // second entry once the other weight has been supplied.
   return get(reader,'GW_CG',page)||get(reader,'ZFW',page)?'OPTIONAL':'REQUIRED';
  }
  return cell.required===true||(REQUIRED[page]||[]).includes(field)?'REQUIRED':'OPTIONAL';
 }
 function placeholder(page,cell,reader){
  if(!cell?.field)return '';
  const value=get(reader,cell.field,page);
  if(value)return value;
  const n=LENGTH[cell.format]||5;
  const glyph=mode(page,cell,reader)==='REQUIRED'?'□':'-';
  return glyph.repeat(Math.min(n,11));
 }
 function audit(pages,reader){
  const records=[];
  for(const [page,p] of Object.entries(pages||{}))
   for(const pair of p.rows||[])for(const cell of pair||[])
    if(cell?.field)records.push({page,lsk:cell.lsk,field:cell.field,
     mode:mode(page,cell,reader),prompt:placeholder(page,cell,reader)});
  return {version:VERSION,pages:Object.keys(pages||{}).length,
   fields:records.length,required:records.filter(x=>x.mode==='REQUIRED').length,
   optional:records.filter(x=>x.mode==='OPTIONAL').length,records};
 }
 return Object.freeze({VERSION,REQUIRED,LENGTH,mode,placeholder,audit});
});
