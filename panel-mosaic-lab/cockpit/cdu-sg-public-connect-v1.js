/* Unified CDU/SG private catalog.
 * GitHub Pages: owner's token-protected localhost 8768 reader.
 * Railway: session-authenticated same-origin PostgreSQL source, with a one-time
 * owner-supplied JSON import. Neither source is committed into public GitHub.
 */
(function(root){
 'use strict';
 const BASE='http://127.0.0.1:8768',DOMAIN='mahmet737ng-gif.github.io';
 const RAILWAY='ata24-review-gateway-production.up.railway.app';
 const railway=root.location.hostname===RAILWAY,github=root.location.hostname===DOMAIN;
 const ROUTES=/^\/api\/(?:cdu\/(?:airport|catalog|procedure|lookup)|sg\/(?:procedure|airway|airport)\.geojson)\?/;
 let token='',connected=false;
 const $=id=>document.getElementById(id);
 const frames=()=>[...document.querySelectorAll('iframe.cdu-frame')];
 function announce(action){for(const f of frames())try{f.contentWindow?.[action]?.()}catch(_){}}
 function refreshStatus(message){
  const s=$('cduSgPrivateStatus');if(s)s.textContent=message;
  if($('cduSgPrivateConnect'))$('cduSgPrivateConnect').disabled=connected;
  if($('cduSgPrivateDisconnect'))$('cduSgPrivateDisconnect').disabled=!connected;
 }
 function disconnect(){
  token='';connected=false;root.B737CduSgRouteV1?.setConnected(false);
  announce('B737CDUDetachCduSgV1');
  refreshStatus('قطع · منبع CDU/SG غیرفعال است');
 }
 async function status(){
  return railway?fetch('/api/source/status',{method:'GET',credentials:'same-origin',cache:'no-store'}):
   fetch(BASE+'/api/source/status',{method:'GET',cache:'no-store',mode:'cors',
    credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',
    targetAddressSpace:'loopback',headers:{'X-CDU-SG-Token':token}});
 }
 const bridge=Object.freeze({
  isConnected:()=>connected&&(railway||!!token),
  source:railway?'RAILWAY_PRIVATE_POSTGRES':'CDU_SG_SOURCE_NAVDB_V1',
  async request(path){
   if(!connected||!this.isConnected())throw Error('PRIVATE CDU/SG NAVDB DISCONNECTED');
   if(typeof path!=='string'||path.length>420||!ROUTES.test(path)||
      path.includes('#')||path.includes('..'))throw Error('READ ONLY PATH REJECTED');
   return railway?fetch(path,{method:'GET',cache:'no-store',credentials:'same-origin'}):
    fetch(BASE+path,{method:'GET',cache:'no-store',mode:'cors',credentials:'omit',
     redirect:'error',referrerPolicy:'no-referrer',targetAddressSpace:'loopback',
     headers:{'X-CDU-SG-Token':token}});
  }
 });
 root.B737CduSgBridgeV1=bridge;
 async function connect(){
  if(!railway&&!github){refreshStatus('This source is unavailable on this host');return;}
  if(github){
   const field=$('cduSgPrivateToken'),submitted=String(field?.value||'').trim();
   if(field)field.value='';
   if(submitted.length<24||submitted.length>256){
    refreshStatus('توکن اتصال معتبر نیست');return;
   }
   token=submitted;
  }
  const button=$('cduSgPrivateConnect');if(button)button.disabled=true;
  refreshStatus('در حال خواندن منبع ناوبری…');
  try{
   const response=await status();
   if(!response.ok)throw Error(response.status===503?'IMPORT_REQUIRED':'SOURCE_UNAVAILABLE');
   const info=await response.json();
   if(info.status!=='SOURCE_CONNECTED_READ_ONLY'||
      info.metadata?.schema!=='CDU_SG_SOURCE_NAVDB_V1'||
      info.metadata?.airac!=='UNSPECIFIED_IN_UPLOADED_FILES'||
      info.metadata?.fmc_executable!==false||info.fmc_executable!==false||
      !['OIII','OIMM','OISS'].every(x=>info.airports?.includes(x)))
    throw Error('INCOMPATIBLE_PRIVATE_DATASET');
   connected=true;
   root.B737CduSgRouteV1?.setConnected(true);
   refreshStatus('متصل · OIII/OIMM/OISS · منبع مرجع فقط‌خواندنی');
   announce('B737CDUAttachCduSgV1');
  }catch(e){
   disconnect();
   refreshStatus(e.message==='IMPORT_REQUIRED'?
    'بانک نصب نشده؛ فایل CDU_3_AIRPORTS.json را در قسمت زیر وارد کن':
    'اتصال برقرار نشد؛ سرویس و اجازه مرورگر را بررسی کن');
  }finally{if(button)button.disabled=connected;}
 }
 async function importJson(input){
  const file=input.files?.[0];input.value='';
  if(!file)return;
  if(!railway||file.size>2_900_000||file.size<100){
   refreshStatus('اندازه یا نوع فایل معتبر نیست');return;
  }
  refreshStatus('در حال ورود بانک سه فرودگاه به سرور خصوصی Railway…');
  try{
   const text=await file.text(),data=JSON.parse(text);
   if(data.schema!=='CDU_SG_CATALOG_V1'||
      data.source_cycle!=='UNSPECIFIED_IN_UPLOADED_FILES'||
      data.fmc_executable!==false||data.reference_only!==true)
    throw Error('INVALID_NAVDATA_FORMAT');
   const r=await fetch('/api/navdata/import',{method:'POST',credentials:'same-origin',
    cache:'no-store',headers:{'Content-Type':'application/json'},body:text});
   const value=await r.json();
   if(!r.ok||value.status!=='IMPORTED_REFERENCE_ONLY')throw Error(value.error||'IMPORT_FAILED');
   await connect();
  }catch(e){refreshStatus('ورود اطلاعات ناموفق: '+String(e.message||'ERROR').slice(0,90));}
 }
 function init(){
  const panel=document.querySelector('section.cdu-tools');
  if(!panel||$('cduSgPrivateConnect'))return;
  const section=document.createElement('section');section.className='private-nav-bridge';
  section.style.cssText='margin-top:12px;padding:12px;border:1px solid #456070;border-radius:8px;display:grid;gap:8px';
  const h=document.createElement('strong');h.textContent='CDU / SG · '+(railway?'Railway Private NAVDATA':'Private SQLite');
  const p=document.createElement('small');p.textContent=railway?
   'بانک سه فرودگاه پس از یک‌بار ورود در PostgreSQL خصوصی Railway نگهداری می‌شود.':
   'برای خواندن داده‌ها سرویس محلی روی همین کامپیوتر اجرا شود.';
  const input=document.createElement('input');input.type='password';input.id='cduSgPrivateToken';
  input.autocomplete='off';input.dir='ltr';input.placeholder='Token from localhost port 8768';
  if(railway)input.hidden=true;
  const connectButton=document.createElement('button');connectButton.type='button';
  connectButton.id='cduSgPrivateConnect';
  connectButton.textContent=railway?'Connect Railway NAVDATA':'Connect CDU / SG SQLite';
  const dis=document.createElement('button');dis.type='button';dis.id='cduSgPrivateDisconnect';
  dis.textContent='Disconnect';dis.disabled=true;
  const s=document.createElement('p');s.id='cduSgPrivateStatus';s.setAttribute('role','status');
  s.textContent='قطع · اتصال بررسی نشده';s.style.margin='0';
  section.append(h,p,input,connectButton,dis,s);
  if(railway){
   const note=document.createElement('small');
   note.textContent='یک‌بار فایل CDU_3_AIRPORTS.json از بسته NAVDATA را انتخاب کن؛ داده فقط در سرور رمزدار Railway ذخیره می‌شود.';
   const file=document.createElement('input');file.type='file';file.id='cduSgPrivateFile';
   file.accept='.json,application/json';file.setAttribute('aria-label','Import private 3-airport CDU JSON');
   file.addEventListener('change',()=>void importJson(file));
   section.append(note,file);
  }
  panel.append(section);
  connectButton.addEventListener('click',()=>void connect());dis.addEventListener('click',disconnect);
  for(const frame of frames())frame.addEventListener('load',()=>{
   if(connected)try{frame.contentWindow?.B737CDUAttachCduSgV1?.()}catch(_){}
  });
  // CDU iframes are often created long after DOMContentLoaded. The native
  // iframe sends 'ready' after all 70 keys/owner artwork finish mounting.
  root.addEventListener('message',event=>{
   const d=event.data;
   if(!connected||event.origin!==root.location.origin||
      d?.type!=='b737:unified-cdu'||d?.kind!=='ready'||
      !['CAPT','FO'].includes(d.seat)||
      !frames().some(frame=>frame.contentWindow===event.source))return;
   try{event.source.B737CDUAttachCduSgV1?.()}catch(_){}
  });
  if(railway)void connect(); // Existing authenticated Railway sessions reconnect automatically.
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
