/* Unified shared reference route. Not FMC ACTIVE, LNAV, VNAV or AFDS input. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737CduSgRouteV1=api.create();
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const VERSION='CDU-SG-ROUTE-0001',CYCLE='UNSPECIFIED_IN_UPLOADED_FILES';
 const copy=x=>JSON.parse(JSON.stringify(x));
 const isIcao=x=>typeof x==='string'&&/^[A-Z0-9]{4}$/.test(x);
 const isIdent=x=>typeof x==='string'&&/^[A-Z0-9._-]{2,16}$/.test(x);
 const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 function create(){
  let revision=0,connected=false,origin='',destination='';
  const empty=()=>({selections:{},geometries:{},runways:{}}),listeners=new Set();
  let active=empty(),mod=null;
  const working=()=>mod??active;
  const startMod=()=>mod??(mod=copy(active));
  const snapshot=()=>copy({version:VERSION,revision,connected,origin,destination,cycle:CYCLE,
   sourceOnly:true,fmcExecutable:false,active,modified:mod,...working()});
  function execute(){if(!mod)return snapshot();active=mod;mod=null;return publish();}
  function erase(){if(!mod)return snapshot();mod=null;return publish();}
  function publish(){revision++;const v=snapshot();for(const fn of [...listeners])try{fn(v)}catch(_){/* Observer isolation */}return v}
  function clearAll(){active=empty();mod=null;}
  function setConnected(on){if(connected===(on===true))return snapshot();connected=on===true;if(!connected)clearAll();return publish()}
  function setContext({origin:a='',destination:b=''}={}){
   a=String(a||'').toUpperCase().trim();b=String(b||'').toUpperCase().trim();
   if(a===origin&&b===destination)return snapshot();
   origin=a;destination=b;clearAll();return publish();
  }
  function permitted(kind,airport){return kind==='SID'?airport===origin:
   (kind==='STAR'||kind==='APP')&&(airport===origin||airport===destination)}
  function setRunway(bank,airport,role,runway,airportRecord){
   const slot=role+'@'+airport,key='RUNWAY_'+slot;
   bank.runways[slot]=runway;
   if(role==='DEP'||!bank.runways[airport])bank.runways[airport]=runway;
   const rwy=airportRecord?.runways.find(r=>r.runway===runway);
   const point=r=>r&&[r.threshold_lon,r.threshold_lat];
   const threshold=point(rwy);
   if(!validPoint(threshold)){delete bank.geometries[key];return;}
   const match=/^(\d{2})([LCR]?)$/.exec(runway);
   const end=match?String((Number(match[1])+17)%36+1).padStart(2,'0')+
    ({L:'R',R:'L',C:'C','':''})[match[2]]:null;
   const opposite=point(airportRecord.runways.find(r=>r.runway===end));
   bank.geometries[key]={airport,kind:'RUNWAY',ident:runway,
    segments:validPoint(opposite)?[[threshold,opposite]]:[],
    fixes:[{ident:'RW'+runway,lon:threshold[0],lat:threshold[1]}],
    renderStyle:'DASHED_REFERENCE_CHORDS_ONLY'};
  }
  function chooseRunway({airport,runway,airportRecord,role=airport===origin?'DEP':'ARR'}){
   if(!connected)throw Error('NAV SOURCE DISCONNECTED');
   if(!isIcao(airport)||!isIdent(runway)||![origin,destination].includes(airport)||
      airportRecord?.icao!==airport||!Array.isArray(airportRecord.runways)||
      !airportRecord.runways.some(r=>r?.runway===runway))throw Error('RUNWAY NOT VERIFIED');
   if(!['DEP','ARR'].includes(role)||role==='DEP'&&airport!==origin)throw Error('NOT ON ROUTE');
   const slot=role+'@'+airport;
   if(working().runways[slot]===runway)return snapshot();
   const bank=startMod();
   for(const kind of role==='DEP'?['SID']:['STAR','APP']){
    const key=kind+'@'+airport,s=bank.selections[key];
    if(s?.runway&&s.runway!==runway){delete bank.selections[key];delete bank.geometries[key];}
   }
   setRunway(bank,airport,role,runway,airportRecord);return publish();
  }
  function select({airport,kind,ident,runway=null,transition=null,procedure,geometry,airportRecord}){
   if(!connected)throw Error('NAV SOURCE DISCONNECTED');
   if(!isIcao(airport)||!['SID','STAR','APP'].includes(kind)||!isIdent(ident)||!permitted(kind,airport))
    throw Error('NOT ON ROUTE');
   if(procedure?.airport!==airport||procedure?.kind!==kind||procedure?.ident!==ident||
      procedure?.fmc_executable!==false||
      (procedure?.requires_runway_selection===true&&!runway)||
      (procedure?.requires_transition_selection===true&&!transition)||
      !Array.isArray(procedure?.runway_options)||
      !Array.isArray(procedure?.transition_options))throw Error('UNVERIFIED PROCEDURE');
   if(runway&&!procedure.runway_options.includes(runway)||transition&&!procedure.transition_options.includes(transition)||
      procedure.runway_options.length>1&&!runway||procedure.transition_options.length>1&&!transition)
    throw Error('SELECT PUBLISHED VARIANT');
   const meta=geometry?.metadata;
   if(geometry?.type!=='FeatureCollection'||!Array.isArray(geometry.features)||
      meta?.airport!==airport||meta?.kind!==kind||meta?.ident!==ident||
      meta?.airac!==CYCLE||meta?.fmc_executable!==false||
      (meta?.selected_runway||null)!==(runway||null)||
      (meta?.selected_transition||null)!==(transition||null))
    throw Error('SOURCE GEOMETRY MISMATCH');
   const segments=[];
   for(const feature of geometry.features){
    const pts=feature?.geometry?.coordinates;
    if(feature?.geometry?.type!=='LineString'||!Array.isArray(pts)||
       pts.length!==2||!pts.every(validPoint)||feature.properties?.fmc_executable!==false||
       !String(feature.properties?.render_style||'').includes('reference'))continue;
    segments.push(pts.map(p=>[p[0],p[1]]));
    if(segments.length>=300)break;
   }
   // Source coordinate fixes are display symbols, not inferred flyable legs.
   const fixes=[];
   for(const feature of geometry.features){
    if(feature?.geometry?.type!=='Point'||!validPoint(feature.geometry.coordinates)||
       typeof feature.properties?.ident!=='string'||!isIdent(feature.properties.ident)||
       feature.properties?.fmc_executable!==false)continue;
    const [lon,lat]=feature.geometry.coordinates;
    fixes.push({ident:feature.properties.ident,lon,lat});
    if(fixes.length>=150)break;
   }
   const key=kind+'@'+airport;
   if(!segments.length&&!fixes.length)throw Error('NO VERIFIED GEOMETRY');
   const bank=startMod();
   bank.selections[key]={airport,kind,ident,runway,transition,cycle:CYCLE,sourceOnly:true,fmcExecutable:false};
   bank.geometries[key]={airport,kind,ident,segments,fixes,
    warnings:Array.isArray(meta?.warnings)?meta.warnings.slice(0,100):[],
    renderStyle:'DASHED_REFERENCE_CHORDS_ONLY'};
   if(runway){
    const role=kind==='SID'?'DEP':'ARR',slot=role+'@'+airport;
    if(bank.runways[slot]!==runway)setRunway(bank,airport,role,runway,airportRecord);
   }
   return publish();
  }
  function clear(kind,airport){if(!connected)throw Error('NAV SOURCE DISCONNECTED');const key=kind+'@'+airport;
   if(!working().selections[key])return snapshot();const bank=startMod();
   delete bank.selections[key];delete bank.geometries[key];return publish();}
  function subscribe(fn){if(typeof fn!=='function')throw Error('SUBSCRIBER_REQUIRED');
   listeners.add(fn);fn(snapshot());return ()=>listeners.delete(fn)}
  return Object.freeze({snapshot,subscribe,setConnected,setContext,select,chooseRunway,clear,execute,erase});
 }
 return Object.freeze({VERSION,CYCLE,create});
});
