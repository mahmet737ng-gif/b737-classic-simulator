/* Authenticated Railway private, read-only, reference-only three-airport CDU/SG dataset.
 * The licensed/user-uploaded JSON is stored in Railway PostgreSQL, never in GitHub.
 * It is NOT an operational FMC or ARINC navigation database.
 */
'use strict';
const SCHEMA='CDU_SG_CATALOG_V1',CYCLE='UNSPECIFIED_IN_UPLOADED_FILES';
const AIRPORTS=['OIII','OIMM','OISS'],KINDS=['SID','STAR','APP'];
const validIdent=s=>typeof s==='string'&&/^[A-Z0-9._-]{2,16}$/.test(s);
function validate(payload){
 if(!payload||payload.schema!==SCHEMA||payload.source_cycle!==CYCLE||
   payload.reference_only!==true||payload.fmc_executable!==false||
   !payload.airports||typeof payload.airports!=='object')throw Error('INVALID_PRIVATE_NAVDATA_SCHEMA');
 for(const icao of AIRPORTS){
  const node=payload.airports[icao],ap=node?.airport;
  if(ap?.icao!==icao||!Array.isArray(ap.runways)||!Array.isArray(ap.published_runways)||
     !node.catalogs||!node.procedures)throw Error('INVALID_AIRPORT_'+icao);
  if(ap.runways.some(r=>!validIdent(r.runway)||!Number.isFinite(r.threshold_lat)||
       !Number.isFinite(r.threshold_lon)||Math.abs(r.threshold_lat)>90||Math.abs(r.threshold_lon)>180))
   throw Error('INVALID_RUNWAY_'+icao);
  for(const kind of KINDS){
   const c=node.catalogs[kind],ps=node.procedures[kind];
   if(c?.airport!==icao||c?.kind!==kind||c?.cycle!==CYCLE||
      c?.fmc_executable!==false||!Array.isArray(c.items)||!Array.isArray(ps))
     throw Error('INVALID_PROCEDURE_CATALOG');
   if(c.items.length>500||ps.length>500||c.items.some(x=>!validIdent(x.ident)||
       x.fmc_executable!==false||!Array.isArray(x.runways)||!Array.isArray(x.transitions))||
      ps.some(x=>x.airport!==icao||x.kind!==kind||!validIdent(x.ident)||
       x.fmc_executable!==false||!Array.isArray(x.variants)||!Array.isArray(x.transitions)||
       !Array.isArray(x.runway_options)||!Array.isArray(x.transition_options)))
     throw Error('INVALID_PROCEDURE_RECORD');
  }
 }
 return payload;
}
const pick=(u,k)=>String(u.searchParams.get(k)||'').trim().toUpperCase();
const norm=(s)=>typeof s==='string'?s.toUpperCase():'';
function create(pool){
 let cached=null;
 async function initialize(){
  await pool.query('CREATE TABLE IF NOT EXISTS ata24_navdata(ident text PRIMARY KEY,payload jsonb NOT NULL,imported_at timestamptz NOT NULL DEFAULT now())');
 }
 async function importData(payload){
  const valid=validate(payload);
  await pool.query("INSERT INTO ata24_navdata(ident,payload,imported_at) VALUES('CDU_SG_V1',$1::jsonb,now()) ON CONFLICT(ident) DO UPDATE SET payload=excluded.payload,imported_at=now()",[JSON.stringify(valid)]);
  cached=valid;
  return {status:'IMPORTED_REFERENCE_ONLY',airports:AIRPORTS,cycle:CYCLE,
   procedures:AIRPORTS.reduce((n,icao)=>n+KINDS.reduce((m,k)=>m+cached.airports[icao].procedures[k].length,0),0)};
 }
 async function getData(){
  if(cached)return cached;
  const r=await pool.query("SELECT payload FROM ata24_navdata WHERE ident='CDU_SG_V1' LIMIT 1");
  if(!r.rowCount)return null;
  cached=validate(r.rows[0].payload);
  return cached;
 }
 // Transfer only the fields the Unified browser uses to render the reference.
 function localReference(data){
  const segment=p=>({source_line:p.source_line,runway:p.runway,ident:p.ident,
   commands:(p.commands||[]).map(({kind,value})=>({kind,value})),
   refs:(p.refs||[]).map(({kind,ident,role,source_resolution,lat,lon})=>
    ({kind,ident,role,source_resolution,lat,lon}))});
  const airports={};
  for(const icao of AIRPORTS){
   const node=data.airports[icao],{published_runways,runways}=node.airport;
   const catalogs={},procedures={};
   for(const kind of KINDS){
    catalogs[kind]={airport:icao,kind,cycle:CYCLE,fmc_executable:false,
     items:node.catalogs[kind].items.map(({ident,runways,transitions})=>
      ({ident,runways,transitions,fmc_executable:false}))};
    procedures[kind]=node.procedures[kind].map(p=>({airport:icao,kind,ident:p.ident,
     requires_runway_selection:p.requires_runway_selection,
     requires_transition_selection:p.requires_transition_selection,
     runway_options:p.runway_options,transition_options:p.transition_options,
     fmc_executable:false,variants:p.variants.map(segment),transitions:p.transitions.map(segment)}));
   }
   airports[icao]={airport:{icao,published_runways,
    runways:runways.map(({runway,threshold_lat,threshold_lon})=>({runway,threshold_lat,threshold_lon}))},
    catalogs,procedures};
  }
  return {schema:SCHEMA,source_cycle:CYCLE,reference_only:true,fmc_executable:false,airports};
 }
 function referenceSegments(procedure,runway,transition){
  const selected=procedure.variants.filter(v=>!runway||v.runway===runway);
  const features=[];
  for(const variant of selected){
   const refs=(variant.refs||[]).filter(r=>r.role==='ROUTE_POINT'&&
     Number.isFinite(r.lat)&&Number.isFinite(r.lon));
   for(let i=1;i<refs.length;i++){
    const a=refs[i-1],b=refs[i];if(a.ident===b.ident)continue;
    features.push({type:'Feature',geometry:{type:'LineString',
      coordinates:[[a.lon,a.lat],[b.lon,b.lat]]},properties:{
       from:a.ident,to:b.ident,variant_runway:variant.runway||null,
       render_style:'dashed_reference_not_actual_flight_path',fmc_executable:false}});
   }
  }
  return features.slice(0,300);
 }
 function geoProcedure(ap,kind,ident,runway,transition){
  const p=ap.procedures[kind].find(x=>x.ident===ident);
  if(!p)return null;
  if(runway&&!p.runway_options.includes(runway)||
     transition&&!p.transition_options.includes(transition))return null;
  return {type:'FeatureCollection',metadata:{airport:ap.airport.icao,kind,ident,
    airac:CYCLE,fmc_executable:false,selected_runway:runway||null,
    selected_transition:transition||null,geometry_status:'REFERENCE_ONLY'},
   features:referenceSegments(p,runway,transition)};
 }
 function airportGeo(node){
  const ap=node.airport,features=[];
  for(const r of ap.runways)features.push({type:'Feature',geometry:{type:'Point',
   coordinates:[r.threshold_lon,r.threshold_lat]},properties:{
   ident:r.runway,airport:ap.icao,role:'RUNWAY_THRESHOLD'}});
  for(const r of node.local_fixes||[])features.push({type:'Feature',geometry:{type:'Point',
   coordinates:[r.lon,r.lat]},properties:{ident:r.ident,airport:ap.icao,role:'FIX'}});
  return {type:'FeatureCollection',metadata:{airport:ap.icao,fmc_executable:false,
   airac:CYCLE},features};
 }
 async function lookup(url){
  const data=await getData();
  if(!data)return {status:503,body:{status:'NAVDATA_IMPORT_REQUIRED',fmc_executable:false}};
  const pathname=url.pathname;
  if(pathname==='/api/navdata/local-reference')return {status:200,body:localReference(data)};
  if(pathname==='/api/source/status')return {status:200,body:{
   status:'SOURCE_CONNECTED_READ_ONLY',metadata:{schema:'CDU_SG_SOURCE_NAVDB_V1',
     airac:CYCLE,fmc_executable:false},airports:AIRPORTS,fmc_executable:false,
   source:'RAILWAY_AUTHENTICATED_POSTGRES'}};
  const airport=pick(url,pathname==='/api/cdu/airport'?'icao':'airport'),
    kind=pick(url,'kind'),ident=pick(url,'ident'),runway=pick(url,'runway'),
    transition=pick(url,'transition'),node=data.airports[airport];
  if(!node)return {status:404,body:{error:'AIRPORT_NOT_IN_PRIVATE_CATALOG'}};
  if(pathname==='/api/cdu/airport')return {status:200,body:node.airport};
  if(!KINDS.includes(kind))return {status:400,body:{error:'INVALID_PROCEDURE_KIND'}};
  if(pathname==='/api/cdu/catalog')return {status:200,body:node.catalogs[kind]};
  if(!validIdent(ident))return {status:400,body:{error:'INVALID_PROCEDURE_IDENT'}};
  if(pathname==='/api/cdu/procedure'){
   const proc=node.procedures[kind].find(p=>p.ident===ident);
   if(!proc||runway&&!proc.runway_options.includes(runway)||
      transition&&!proc.transition_options.includes(transition))return {status:404,body:{error:'PROCEDURE_NOT_FOUND'}};
   return {status:200,body:{...proc,variants:proc.variants.filter(v=>!runway||v.runway===runway),
     transitions:proc.transitions.filter(t=>!transition||t.ident===transition),
     selected_runway:runway||null,selected_transition:transition||null}};
  }
  if(pathname==='/api/sg/procedure.geojson'){
   const body=geoProcedure(node,kind,ident,runway,transition);
   return body?{status:200,body}:{status:404,body:{error:'PROCEDURE_NOT_FOUND'}};
  }
  return {status:404,body:{error:'NOT_FOUND'}};
 }
 function supports(pathname){
  return ['/api/source/status','/api/cdu/airport','/api/cdu/catalog',
   '/api/cdu/procedure','/api/sg/procedure.geojson'].includes(pathname);
 }
 return {initialize,importData,lookup,supports,getData};
}
module.exports={SCHEMA,CYCLE,AIRPORTS,KINDS,validate,create};
