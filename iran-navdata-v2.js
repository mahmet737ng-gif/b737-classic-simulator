'use strict';
// Private training dataset. Separate from legacy SG reference data.
// Never include licensed records in the public repository.
const SCHEMA='UNIFIED_IRAN_NAVDATA_V2',CYCLE='AIRAC-2611';
const ICAOS=['OIII','OIFM','OIMM','OISS'];
const ident=s=>typeof s==='string'&&/^[A-Z0-9._-]{1,24}$/.test(s);
const coord=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const key=p=>[p.airway,p.sequence,p.ident,p.lat,p.lon].join('|');
const need=(b,msg)=>{if(!b)throw Error(msg);};
function validate(d){
 need(d?.schema===SCHEMA&&d.cycle===CYCLE&&d.training_only===true,'INVALID_SCHEMA');
 const airports=d.procedures?.airports,e=d.enroute;
 need(airports&&Object.keys(airports).length===4&&e?.metadata?.cycle===CYCLE,'INVALID_DATASET');
 for(const icao of ICAOS){
  const a=airports[icao];need(a?.icao===icao&&String(a.version).includes('AIRAC 2611')&&Array.isArray(a.procedures)&&Array.isArray(a.approaches)&&a.runways,'INVALID_AIRPORT_'+icao);
  const rw=Object.keys(a.runways);
  need(rw.length===4&&rw.every(r=>/^\d{2}[LRC]?$/.test(r)&&coord(a.runways[r])&&Number.isFinite(a.runways[r].alt)),'INVALID_RUNWAYS_'+icao);
  need(a.procedures.length>0&&a.procedures.length<=500,'INVALID_PROCEDURE_COUNT');
  for(const p of a.procedures){
   need(['SID','STAR'].includes(p.kind)&&ident(p.name)&&typeof p.runway==='string'&&Array.isArray(p.legs)&&p.legs.length>0&&p.legs.length<=100,'INVALID_PROCEDURE');
   for(const l of p.legs){need(typeof l.Name==='string'&&typeof l.Type==='string'&&Number.isFinite(Number(l.Latitude))&&Number.isFinite(Number(l.Longitude))&&Math.abs(Number(l.Latitude))<=90&&Math.abs(Number(l.Longitude))<=180,'INVALID_LEG');}
  }
 }
 for(const k of ['fixes','navaids','airports','airways','airway_segments','airway_edges'])need(Array.isArray(e[k])&&e[k].length>0&&e[k].length<10000,'INVALID_'+k);
 for(const k of ['fixes','navaids','airways'])need(e[k].every(p=>coord(p)&&ident(p.ident)),'INVALID_POINT_'+k);
 need(e.airports.every(p=>coord(p)&&/^OI[A-Z]{2}$/.test(p.icao)),'INVALID_ENROUTE_AIRPORT');
 const rows=new Set(e.airways.map(key)),seen=new Set();
 for(const s of e.airway_segments){
  need(ident(s.airway)&&Array.isArray(s.points)&&s.points.length>0,'INVALID_SEGMENT');
  for(let i=0;i<s.points.length;i++){const p=s.points[i],k=key(p);need(p.airway===s.airway&&rows.has(k)&&!seen.has(k)&&Number.isInteger(p.sequence)&&(!i||p.sequence===s.points[i-1].sequence+1),'AIRWAY_DISCONTINUITY');seen.add(k);}
 }
 need(rows.size===e.airways.length&&seen.size===rows.size,'AIRWAY_COVERAGE_MISMATCH');
 return d;
}
function expandAirway(d,airway,from,to){
 airway=String(airway).toUpperCase();from=String(from).toUpperCase();to=String(to).toUpperCase();
 if(![airway,from,to].every(ident)||from===to)throw Error('INVALID_AIRWAY_QUERY');
 const matches=[];
 for(const s of d.enroute.airway_segments.filter(s=>s.airway===airway)){
  for(let i=0;i<s.points.length;i++)if(s.points[i].ident===from)
   for(let j=0;j<s.points.length;j++)if(s.points[j].ident===to){
    const p=s.points.slice(Math.min(i,j),Math.max(i,j)+1);matches.push(i>j?p.reverse():p);
   }
 }
 if(matches.length!==1)throw Error(matches.length?'AMBIGUOUS_AIRWAY':'AIRWAY_NOT_CONNECTED');
 return matches[0];
}
function create(pool){
 let cached=null;
 async function initialize(){await pool.query('CREATE TABLE IF NOT EXISTS unified_iran_navdata_v2 (cycle text PRIMARY KEY,payload jsonb NOT NULL,imported_at timestamptz NOT NULL DEFAULT now())');}
 async function importData(data){const d=validate(data);await pool.query('INSERT INTO unified_iran_navdata_v2(cycle,payload) VALUES($1,$2::jsonb) ON CONFLICT(cycle) DO UPDATE SET payload=excluded.payload,imported_at=now()',[CYCLE,JSON.stringify(d)]);cached=d;return summary(d);}
 async function getData(){if(cached)return cached;const r=await pool.query('SELECT payload FROM unified_iran_navdata_v2 WHERE cycle=$1',[CYCLE]);if(!r.rowCount)return null;cached=validate(r.rows[0].payload);return cached;}
 function summary(d){return {schema:SCHEMA,cycle:CYCLE,training_only:true,airports:ICAOS,procedures:ICAOS.reduce((n,a)=>n+d.procedures.airports[a].procedures.length,0),approaches:ICAOS.reduce((n,a)=>n+d.procedures.airports[a].approaches.length,0),fixes:d.enroute.fixes.length,navaids:d.enroute.navaids.length,airway_points:d.enroute.airways.length};}
 const supports=p=>['/api/iran-navdata/status','/api/iran-navdata/airport','/api/iran-navdata/fix','/api/iran-navdata/airway'].includes(p);
 async function lookup(url){
  const d=await getData();if(!d)return {status:503,body:{error:'IMPORT_REQUIRED'}};
  const q=k=>String(url.searchParams.get(k)||'').trim().toUpperCase();
  if(url.pathname.endsWith('/status'))return {status:200,body:summary(d)};
  if(url.pathname.endsWith('/airport')){const a=d.procedures.airports[q('icao')];return ICAOS.includes(q('icao'))&&a?{status:200,body:a}:{status:404,body:{error:'AIRPORT_NOT_FOUND'}};}
  if(url.pathname.endsWith('/fix')){const id=q('ident');if(!ident(id))return {status:400,body:{error:'INVALID_IDENT'}};const f=[...d.enroute.fixes,...d.enroute.navaids].filter(p=>p.ident===id);return {status:f.length?200:404,body:{matches:f}};}
  if(url.pathname.endsWith('/airway')){try{return {status:200,body:{points:expandAirway(d,q('via'),q('from'),q('to')),training_only:true}};}catch(e){return {status:422,body:{error:e.message}};}}
  return {status:404,body:{error:'NOT_FOUND'}};
 }
 return {initialize,importData,getData,lookup,supports};
}
module.exports={SCHEMA,CYCLE,validate,expandAirway,create};
