/* Private CDU/SG SQLite catalogue: FCOM-compatible six-row page + source-only selection.
 * No AIRAC 2610 assumption; no ARINC leg synthesis or FMC EXEC activation.
 */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory;
 if(!root||!root.parent||root.parent===root)return;
 let adapter=null;
 root.B737CDUAttachCduSgV1=function(){
  try{
   if(root.location.origin!==root.parent.location.origin)return false;
   const bridge=root.parent.B737CduSgBridgeV1,route=root.parent.B737CduSgRouteV1;
   if(!bridge?.isConnected?.()||!route||typeof state==='undefined'||typeof core==='undefined')return false;
   if(adapter)return true;
   adapter=factory(state,core,root.CDU_PAGES,bridge,route,()=>root.updateStage5View?.());
   root.CDU_SG_API=adapter;
   adapter.attach();root.updateStage5View?.();return true;
  }catch(_){return false;}
 };
 root.B737CDUDetachCduSgV1=function(){
  if(!adapter)return false;
  adapter.detach();adapter=null;delete root.CDU_SG_API;
  root.updateStage5View?.();return true;
 };
})(typeof window==='undefined'?null:window,function(state,core,pages,bridge,shared,refresh){
 'use strict';
 let serial=0,unsubscribe=null,attached=false;
 const CYCLE='UNSPECIFIED_IN_UPLOADED_FILES';
 const allowedAirport=s=>typeof s==='string'&&/^[A-Z0-9]{4}$/.test(s);
 const encoded=s=>encodeURIComponent(s);
 const update=()=>refresh?.();
 function issue(message){state.message=String(message||'NAV DATA ERROR').slice(0,24);update();}
 async function request(path){
  const r=await bridge.request(path),body=await r.json();
  if(!r.ok)throw Error(body.error||'PRIVATE SOURCE UNAVAILABLE');return body;
 }
 function sourceSelected(kind,airport){
  return shared.snapshot().selections[kind+'@'+airport]||null;
 }
 function indexKey(k){
  const slots={LSK_L1:['ORIGIN','DEP'],LSK_R1:['ORIGIN','ARR'],
   LSK_R2:['DEST','ARR'],LSK_L6:['OTHER','DEP'],LSK_R6:['OTHER','ARR']};
  if(!slots[k])return false;
  const [source,mode]=slots[k],airport=String(source==='OTHER'?state.scratch:
   core.readValue(state,source,'RTE')||'').trim().toUpperCase();
  if(!allowedAirport(airport)){issue('ENTER VALID AIRPORT');return true;}
  // Preserve the shared RTE's actual origin/destination. OTHER remains read-only.
  const from=String(core.readValue(state,'ORIGIN','RTE')||'').toUpperCase();
  const to=String(core.readValue(state,'DEST','RTE')||'').toUpperCase();
  shared.setContext({origin:from,destination:to});
  const page=mode==='DEP'?'DEPARTURES':'ARRIVALS',referenceOnly=source==='OTHER';
  if(referenceOnly)state.scratch='';
  const view={owner:'CDU_SG_SOURCE',mode:'LOADING',airport,departure:mode==='DEP',
   source,referenceOnly,page:1,left:[],right:[],candidate:null,
   options:[],runway:null,transition:null};
  ++serial;const ticket=serial;
  delete state.stage6View;
  state.cduSgView=view;
  state.depArrSelection={airport,mode,source,referenceOnly};
  core.choose(state,pages,page);update();
  void (async()=>{
   try{
    const kinds=view.departure?['SID']:['STAR','APP'];
    const [catalogs,airportRecord]=await Promise.all([
     Promise.all(kinds.map(kind=>request('/api/cdu/catalog?airport='+encoded(airport)+'&kind='+kind))),
     request('/api/cdu/airport?icao='+encoded(airport))
    ]);
    if(ticket!==serial||state.cduSgView!==view||state.page!==page)return;
    if(airportRecord?.icao!==airport||!Array.isArray(airportRecord.runways)||
       !Array.isArray(airportRecord.published_runways)||
       catalogs.some((c,i)=>c.airport!==airport||c.kind!==kinds[i]||
        c.cycle!==CYCLE||c.fmc_executable!==false||!Array.isArray(c.items)||
        c.items.some(item=>!item||typeof item.ident!=='string'||
         !Array.isArray(item.runways)||!Array.isArray(item.transitions)||item.fmc_executable!==false)))
     throw Error('NAV SOURCE MISMATCH');
    view.airportRecord=airportRecord;
    view.left=catalogs[0].items.map(item=>({kind:kinds[0],ident:item.ident,item}));
    view.right=(view.departure?[]:catalogs[1].items.map(item=>({kind:'APP',ident:item.ident,item})))
     .concat(airportRecord.published_runways.map(runway=>({kind:'RUNWAY',ident:runway})));
    view.mode='CATALOG';view.page=1;update();
   }catch(err){if(ticket===serial&&state.cduSgView===view){view.mode='ERROR';view.error=err.message;issue('NAV SOURCE UNAVAILABLE');}}
  })();
  return true;
 }
 function count(v){return Math.max(1,Math.ceil(Math.max(
  v.mode==='CATALOG'?v.left.length:v.mode==='RUNWAY'||v.mode==='TRANSITION'?v.options.length:0,
  v.mode==='CATALOG'?v.right.length:0)/5))}
 function catalogView(){
  const v=state.cduSgView;
  if(!v||!['DEPARTURES','ARRIVALS'].includes(state.page))return null;
  const blank=()=>({labelL:'',labelR:'',valueL:'',valueR:''});
  const rows=Array.from({length:6},blank),start=(v.page-1)*5;
  if(v.mode==='LOADING'||v.mode==='ERROR'||v.mode==='VERIFYING'){
   rows[0]={labelL:v.departure?'SIDS':'STARS',labelR:v.departure?'RUNWAYS':'APPROACHES',valueL:'',valueR:''};
   rows[2]={...blank(),labelL:'NAV DATA',valueL:v.mode==='LOADING'?'LOADING':
    v.mode==='VERIFYING'?'VERIFYING':'UNAVAILABLE'};
  }else if(v.mode==='RUNWAY'||v.mode==='TRANSITION'){
   for(let i=0;i<5;i++){
    const entry=v.options[start+i];
    rows[i]={...blank(),labelL:i===0?(v.mode==='RUNWAY'?'RUNWAY':'TRANS'):'',
     valueL:entry||''};
   }
  }else{
   for(let i=0;i<5;i++){
    const l=v.left[start+i],r=v.right[start+i],previous=v.right[start+i-1];
    rows[i]={
     labelL:i===0?(v.departure?'SIDS':'STARS'):'',
     valueL:l?(sourceSelected(l.kind,v.airport)?.ident===l.ident?'>':'')+l.ident:'',
     labelR:r?.kind==='RUNWAY'&&(i===0||previous?.kind!=='RUNWAY')?'RUNWAYS':
      i===0?(v.departure?'RUNWAYS':'APPROACHES'):'',
     valueR:r?(shared.snapshot().runways[v.airport]===r.ident?'>':'')+r.ident:''
    };
   }
  }
  rows[5]={...blank(),valueL:'<INDEX',valueR:'RTE>'};
  return {title:v.airport+' '+state.page,number:v.page,count:count(v),rows};
 }
 function fromCatalogKey(k){
  const v=state.cduSgView;
  if(!v||!['DEPARTURES','ARRIVALS'].includes(state.page))return false;
  if(k==='LSK_L6'){++serial;delete state.cduSgView;core.choose(state,pages,'DEP_ARR');update();return true;}
  if(k==='LSK_R6'){++serial;delete state.cduSgView;core.choose(state,pages,'RTE');update();return true;}
  if(k==='PREV_PAGE'||k==='NEXT_PAGE'){
   const pagesCount=count(v);v.page=(v.page-1+(k==='NEXT_PAGE'?1:-1)+pagesCount)%pagesCount+1;
   update();return true;
  }
  const m=/^LSK_([LR])([1-5])$/.exec(k);if(!m)return false;
  const row=(v.page-1)*5+Number(m[2])-1;
  if(v.mode==='LOADING'||v.mode==='ERROR'||v.mode==='VERIFYING'){issue('NAV SOURCE UNAVAILABLE');return true;}
  if(v.mode==='CATALOG'){
   const entry=(m[1]==='L'?v.left:v.right)[row];
   if(!entry){issue('KEY INACTIVE');return true;}
   if(v.referenceOnly){issue('NOT ON ROUTE');return true;}
   if(entry.kind==='RUNWAY'){
    try{shared.chooseRunway({airport:v.airport,runway:entry.ident,airportRecord:v.airportRecord});
     state.message='RWY REF ONLY';update();}catch(e){issue(e.message);}
    return true;
   }
   v.candidate=entry;v.runway=null;v.transition=null;
   v.runways=entry.item.runways;v.transitions=entry.item.transitions;
   if(v.runways.length){v.mode='RUNWAY';v.options=v.runways;v.page=1;update();}
   else if(v.transitions.length){v.mode='TRANSITION';v.options=v.transitions;v.page=1;update();}
   else void confirm(v);
   return true;
  }
  if(m[1]!=='L'){issue('KEY INACTIVE');return true;}
  const value=v.options[row];if(!value){issue('KEY INACTIVE');return true;}
  if(v.referenceOnly){issue('NOT ON ROUTE');return true;}
  if(v.mode==='RUNWAY'){
   v.runway=value;
   if(v.transitions.length){v.mode='TRANSITION';v.options=v.transitions;v.page=1;update();}
   else void confirm(v);
  }else if(v.mode==='TRANSITION'){v.transition=value;void confirm(v);}
  return true;
 }
 async function confirm(v){
  const entry=v.candidate;if(!entry)return;
  const ticket=++serial;
  v.mode='VERIFYING';v.page=1;update();
  const query='airport='+encoded(v.airport)+'&kind='+encoded(entry.kind)+'&ident='+encoded(entry.ident)+
   (v.runway?'&runway='+encoded(v.runway):'')+(v.transition?'&transition='+encoded(v.transition):'');
  try{
   const procedure=await request('/api/cdu/procedure?'+query);
   // The converter belongs to Unified, not a Railway or standalone CDU service.
   // If the verified source already carries local fixes, SG needs no extra
   // geometry endpoint. Otherwise preserve the existing read-only fallback.
   const converter=typeof window!=='undefined'?
    window.parent?.B737UnifiedSGSourceGeometryV1:null;
   let geometry=null;
   if(converter?.hasSource?.(procedure)){
    const candidate=converter.compile(procedure,{airport:v.airport,kind:entry.kind,
     ident:entry.ident,runway:v.runway,transition:v.transition});
    if(candidate.features.some(f=>f.geometry?.type==='LineString'))geometry=candidate;
   }
   if(!geometry)geometry=await request('/api/sg/procedure.geojson?'+query);
   if(ticket!==serial||state.cduSgView!==v)return;
   shared.select({airport:v.airport,kind:entry.kind,ident:entry.ident,
    runway:v.runway,transition:v.transition,procedure,geometry});
   v.mode='CATALOG';v.page=1;v.candidate=null;
   state.message=entry.kind+' REF ONLY';update();
  }catch(err){
   if(ticket===serial&&state.cduSgView===v){
    v.mode='CATALOG';v.page=1;issue(err.message);
   }
  }
 }
 function beforeKey(code){
  if(!attached||!bridge.isConnected())return false;
  const k=String(code).replace(/^CDU_CAPT_/,'');
  if(state.page==='DEP_ARR')return indexKey(k);
  return fromCatalogKey(k);
 }
 function attach(){
  if(attached)return;attached=true;
  // The CDU may already be sitting on an offline DEP/ARR child page when the
  // Railway import finishes. Return to INDEX so a fresh LSK opens the source.
  if(['DEPARTURES','ARRIVALS'].includes(state.page)&&!state.cduSgView)
   core.choose(state,pages,'DEP_ARR');
  unsubscribe=shared.subscribe(()=>{if(attached&&['DEPARTURES','ARRIVALS'].includes(state.page))update();});
 }
 function detach(){
  ++serial;attached=false;unsubscribe?.();unsubscribe=null;
  if(state.cduSgView){delete state.cduSgView;if(['DEPARTURES','ARRIVALS'].includes(state.page))
   core.choose(state,pages,'DEP_ARR');}
 }
 return Object.freeze({attach,detach,beforeKey,chapter11CatalogView:catalogView});
});
