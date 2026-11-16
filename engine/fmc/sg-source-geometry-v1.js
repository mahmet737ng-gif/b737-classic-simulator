/* Unified FMC -> SG reference geometry. Pure read-only translator:
 * NAVDATA source tokens + verified fix coordinates -> point/segment graphics.
 * No turn, vector, hold, path-terminator or AFDS command is inferred.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedSGSourceGeometryV1=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const VERSION='UNIFIED-SG-SOURCE-GEOMETRY-0001';
 const CYCLE='UNSPECIFIED_IN_UPLOADED_FILES';
 const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&
   Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 const validFix=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&
   validPoint([p.lon,p.lat]);
 const ident=s=>typeof s==='string'&&/^[A-Z0-9._-]{2,24}$/.test(s);
 const radians=x=>x*Math.PI/180;
 function nm(a,b){
  const x=radians(b[1]-a[1]),y=radians(b[0]-a[0]);
  const h=Math.sin(x/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(y/2)**2;
  return 3440.065*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
 }
 function hasSource(source){return Array.isArray(source?.segments)&&source.segments.some(s=>
  Array.isArray(s?.events)||Array.isArray(s?.ast));}
 function compile(source,{airport,kind,ident:procedureIdent,runway=null,transition=null}={}){
  if(!source||!hasSource(source)||source.fmc_executable===true||
     source.airport&&source.airport!==airport||source.kind&&source.kind!==kind||
     source.ident&&source.ident!==procedureIdent||
     !/^[A-Z0-9]{4}$/.test(airport||'')||!['SID','STAR','APP'].includes(kind)||
     !ident(procedureIdent))throw Error('SG_SOURCE_UNVERIFIED');
  const features=[],warnings=[],seenMarkers=new Set();
  function point(f,sequence){
   if(!validFix(f)||!ident(f.ident))return null;
   const p=[f.lon,f.lat],key=f.ident+'@'+p.join(',');
   if(!seenMarkers.has(key)){
    seenMarkers.add(key);
    features.push({type:'Feature',geometry:{type:'Point',coordinates:p},
     properties:{ident:f.ident,sequence,render_style:'reference_fix_only',fmc_executable:false}});
   }
   return p;
  }
  for(const [groupIndex,group] of source.segments.entries()){
   let previous=null,previousFix='';
   const tokens=group?.events||group?.ast||[];
   if(!Array.isArray(tokens))throw Error('SG_TOKEN_ARRAY_INVALID');
   for(const [eventIndex,node] of tokens.entries()){
    const type=node?.kind,values=node?.values||{};
    if(type==='SPEED_TOKEN')continue;
    if(type!=='FIX_PASSAGE'){
     previous=null;previousFix='';
     if(type!=='RUNWAY_REFERENCE')warnings.push({group:groupIndex,event:eventIndex,kind:String(type||'UNKNOWN')});
     continue;
    }
    const name=node.fix?.ident||values.ident;
    // Only a verified source-local fix may determine a coordinate.
    const record=node.fix&&node.reference_status==='LOCAL_FIX_COORDINATE_VERIFIED'?node.fix:null;
    const current=record?point({ident:name,lat:record.lat,lon:record.lon},[groupIndex,eventIndex]):null;
    if(!current){
     previous=null;previousFix='';
     warnings.push({group:groupIndex,event:eventIndex,kind:'FIX_COORDINATE_UNVERIFIED',ident:String(name||'')});
     continue;
    }
    if(previous){
     const distance=nm(previous,current);
     if(distance>.005&&distance<=200){
      features.push({type:'Feature',geometry:{type:'LineString',coordinates:[previous,current]},
       properties:{from:previousFix,to:name,reference_distance_nm:Math.round(distance*1000)/1000,
        render_style:'dashed_reference_not_actual_flight_path',fmc_executable:false}});
     }else warnings.push({group:groupIndex,event:eventIndex,kind:'CHORD_DISTANCE_REVIEW_REQUIRED'});
    }
    previous=current;previousFix=name;
   }
  }
  if(features.length>800)throw Error('SG_SOURCE_TOO_LARGE');
  return {type:'FeatureCollection',metadata:{airport,kind,ident:procedureIdent,
    airac:CYCLE,source_cycle:source.airac||null,selected_runway:runway,
    selected_transition:transition,fmc_executable:false,source_only:true,
    warnings,version:VERSION},features};
 }
 return Object.freeze({VERSION,CYCLE,hasSource,compile});
});
