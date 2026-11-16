/* Unified CDU data reads use the local bank after installation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.mount(root);
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const CYCLE='UNSPECIFIED_IN_UPLOADED_FILES', KEY='b737.unified.cduCatalog.v1';
 const AUTO_OFF=KEY+'.autoInstallOff';
 const AIRPORTS=['OIII','OIMM','OISS'], KINDS=['SID','STAR','APP'];
 function createCatalog(data){
  if(data?.schema!=='CDU_SG_CATALOG_V1'||data.source_cycle!==CYCLE||
     data.fmc_executable!==false||data.reference_only!==true)throw Error('INVALID NAV DATA');
  for(const icao of AIRPORTS){
   const a=data.airports?.[icao];
   if(a?.airport?.icao!==icao||!Array.isArray(a.airport.runways)||!Array.isArray(a.airport.published_runways)||
      !KINDS.every(k=>Array.isArray(a.catalogs?.[k]?.items)&&Array.isArray(a.procedures?.[k])))
    throw Error('INCOMPLETE NAV DATA');
  }
  function events(part){
   if(!Array.isArray(part.commands)||!Array.isArray(part.refs)||!Number.isInteger(part.source_line))
    throw Error('PROCEDURE SOURCE INCOMPLETE');
   const fixes=part.refs.filter(ref=>ref.kind==='FIX');
   let idx=0;
   return part.commands.map(cmd=>{
    if(cmd.kind==='SPEED')return {kind:'SPEED_TOKEN'};
    if(cmd.kind!=='FIX')return {kind:String(cmd.kind||'UNKNOWN')};
    const ident=String(cmd.value||'').trim().replace(/^OVERFLY\s+/,'');
    const ref=fixes[idx++];
    if(ref?.ident!==ident||ref.source_resolution!=='LOCAL_AIRPORT_FIX'||
       !['ROUTE_POINT','DIRECT_FIX'].includes(ref.role)||!Number.isFinite(ref.lat)||!Number.isFinite(ref.lon))
     return {kind:'UNRESOLVED_FIX',values:{ident}};
    return {kind:'FIX_PASSAGE',values:{ident:ref.ident},reference_status:'LOCAL_FIX_COORDINATE_VERIFIED',
     fix:{ident:ref.ident,lat:ref.lat,lon:ref.lon}};
   });
  }
  function request(path){
   if(typeof path!=='string'||path.length>420||!/^\/api\/cdu\/(airport|catalog|procedure)\?[^#]+$/.test(path))
    throw Error('INVALID NAV DATA QUERY');
   const url=new URL(path,'https://localhost'),get=name=>url.searchParams.get(name);
   const icao=get('icao')||get('airport'),a=AIRPORTS.includes(icao)?data.airports[icao]:null;
   if(!a)throw Error('AIRPORT NOT IN NAV DATA');
   if(url.pathname.endsWith('/airport'))return a.airport;
   const kind=get('kind');
   if(!KINDS.includes(kind))throw Error('INVALID PROCEDURE KIND');
   if(url.pathname.endsWith('/catalog'))return a.catalogs[kind];
   const procedure=a.procedures[kind].find(p=>p.ident===get('ident'));
   if(!procedure||procedure.fmc_executable!==false)throw Error('PROCEDURE NOT IN NAV DATA');
   const runway=get('runway'),transition=get('transition');
   if((procedure.requires_runway_selection&&!runway)||(procedure.requires_transition_selection&&!transition)||
      (runway&&!procedure.runway_options.includes(runway))||
      (transition&&!procedure.transition_options.includes(transition)))throw Error('SELECT PUBLISHED VARIANT');
   const variant=procedure.variants.filter(p=>p.runway===runway);
   const base=variant.length?variant:procedure.variants.filter(p=>!p.runway);
   const trans=transition?procedure.transitions.filter(p=>p.ident===transition):[];
   if(!base.length||(transition&&!trans.length))throw Error('PROCEDURE SOURCE INCOMPLETE');
   const parts=kind==='SID'?[...base,...trans]:[...trans,...base];
   return {airport:icao,kind,ident:procedure.ident,fmc_executable:false,
    requires_runway_selection:procedure.requires_runway_selection,
    requires_transition_selection:procedure.requires_transition_selection,
    runway_options:procedure.runway_options,transition_options:procedure.transition_options,
    segments:parts.map(part=>({events:events(part)}))};
  }
  return Object.freeze({request});
 }
 function mount(root){
  const doc=root.document,$=id=>doc.getElementById(id);
  const frames=()=>[...doc.querySelectorAll('iframe.cdu-frame')];
  let catalog=null,attempt=0;
  const storage={
   read(key){try{return root.localStorage.getItem(key);}catch(_){return null;}},
   save(key,value){try{root.localStorage.setItem(key,value);return true;}catch(_){return false;}},
   remove(key){try{root.localStorage.removeItem(key);}catch(_){}}
  };
  function announce(action){
   for(const f of frames())try{f.contentWindow?.[action]?.()}catch(_){}
  }
  function status(message){
   const label=$('cduSgPrivateStatus');if(label)label.textContent=message;
   const remove=$('cduSgPrivateDisconnect');if(remove)remove.disabled=!catalog;
  }
  root.B737CduSgBridgeV1=Object.freeze({
   isConnected:()=>!!catalog,source:'UNIFIED_LOCAL_NAVDATA',
   async request(path){
    if(!catalog)throw Error('NAV DATA UNAVAILABLE');
    try{const body=catalog.request(path);return {ok:true,json:async()=>body};}
    catch(err){return {ok:false,json:async()=>({error:err.message})};}
   }
  });
  function install(text){
   const next=createCatalog(JSON.parse(text));
   if(catalog){
    root.B737CduSgRouteV1?.setConnected(false);
    announce('B737CDUDetachCduSgV1');
   }
   catalog=next;root.B737CduSgRouteV1?.setConnected(true);
   announce('B737CDUAttachCduSgV1');
  }
  function save(raw){
   install(raw);
   status(storage.save(KEY,raw)?'بانک OIII، OIMM و OISS فعال است.':
    'بانک فعال است. ذخیره برای بازدید بعدی در این مرورگر ممکن نیست.');
  }
  async function seedFromPage(path){
   if(!/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(path||''))return;
   const current=++attempt;
   status('در حال خواندن بانک نصب‌شدهٔ یونیفاید…');
   try{
    const response=await root.fetch(path,{credentials:'same-origin',mode:'same-origin',
     cache:'no-store',redirect:'error',headers:{Accept:'application/json','X-Unified-Navdata':'local-reference'}});
    if(!response.ok)throw Error('NAV DATA UNAVAILABLE');
    const raw=await response.text();
    if(current!==attempt)return;
    if(raw.length>2_900_000)throw Error('INVALID NAV DATA');
    save(raw);
   }catch(_){
    if(current===attempt)status('بانک نصب‌شده در دسترس نیست. فایل CDU_3_AIRPORTS.json را انتخاب کن.');
   }
  }
  function init(){
   const panel=doc.querySelector('section.cdu-tools');
   if(!panel||$('cduSgPrivateStatus'))return;
   const section=doc.createElement('section');section.className='private-nav-bridge';
   const title=doc.createElement('strong');title.textContent='CDU / SG · NAV DATA';
   const file=doc.createElement('input');file.type='file';file.accept='.json,application/json';
   file.id='cduSgPrivateFile';
   file.setAttribute('aria-label','Import CDU_3_AIRPORTS.json');
   const remove=doc.createElement('button');remove.type='button';remove.id='cduSgPrivateDisconnect';
   remove.textContent='حذف بانک محلی';
   const label=doc.createElement('p');label.id='cduSgPrivateStatus';label.setAttribute('role','status');
   section.append(title,file,remove,label);panel.append(section);
   const seed=doc.querySelector('meta[name="unified-navdata-seed"]')?.content;
   if(seed){
    const restore=doc.createElement('button');restore.type='button';
    restore.textContent='بازخوانی بانک نصب‌شده';
    restore.addEventListener('click',()=>{storage.remove(AUTO_OFF);void seedFromPage(seed);});
    section.insertBefore(restore,remove);
   }
   status('فایل CDU_3_AIRPORTS.json را انتخاب کن.');
   file.addEventListener('change',async()=>{
    const selected=file.files?.[0];file.value='';
    if(!selected)return;
    const current=++attempt;
    if(selected.size>2_900_000){status('حجم فایل معتبر نیست.');return;}
    try{
     const raw=await selected.text();
     if(current===attempt)save(raw);
    }catch(err){if(current===attempt)status('ورود بانک ناموفق بود · '+err.message);}
   });
   remove.addEventListener('click',()=>{
    ++attempt;catalog=null;
    storage.remove(KEY);
    if(seed)storage.save(AUTO_OFF,'1');
    root.B737CduSgRouteV1?.setConnected(false);announce('B737CDUDetachCduSgV1');
    status('بانک محلی برداشته شد.');
   });
   const inspector=$('inspectorToggle'),header=inspector?.parentElement;
   if(header&&!$('cduSgQuickOpen')){
    const quick=doc.createElement('button');quick.type='button';quick.id='cduSgQuickOpen';quick.textContent='NAV DATA';
    quick.addEventListener('click',()=>{
     if(!doc.body.classList.contains('side-open'))inspector.click();
     section.scrollIntoView({block:'start'});
    });
    header.insertBefore(quick,inspector);
   }
   root.addEventListener('message',event=>{
    const d=event.data;
    if(catalog&&event.origin===root.location.origin&&d?.type==='b737:unified-cdu'&&d.kind==='ready'&&
       ['CAPT','FO'].includes(d.seat)&&frames().some(frame=>frame.contentWindow===event.source)){
     try{event.source.B737CDUAttachCduSgV1?.()}catch(_){}
    }
   });
   const saved=storage.read(KEY);
   if(saved)try{
    install(saved);
    status('بانک OIII، OIMM و OISS فعال است.');
   }catch(_){storage.remove(KEY);}
   if(!catalog&&seed&&storage.read(AUTO_OFF)!=='1')void seedFromPage(seed);
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
 }
 return Object.freeze({createCatalog,mount});
});
