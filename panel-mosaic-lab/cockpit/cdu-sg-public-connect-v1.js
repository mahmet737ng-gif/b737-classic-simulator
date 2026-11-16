/* Unified CDU/SG private catalog.
 * GitHub Pages: owner's token-protected localhost 8768 reader.
 * Railway: session-authenticated same-origin PostgreSQL source, with a one-time
 * owner-supplied JSON import. Neither source is committed into public GitHub.
 */
(function(root){
 'use strict';
 const BASE='http://127.0.0.1:8768',DOMAIN='mahmet737ng-gif.github.io';
 const RAILWAY='ata24-review-gateway-production.up.railway.app';
 const RAILWAY_ORIGIN='https://'+RAILWAY;
 const RELAY_PROTOCOL='b737:private-navdata-relay-v1';
 const railway=root.location.hostname===RAILWAY,github=root.location.hostname===DOMAIN;
 const ROUTES=/^\/api\/(?:cdu\/(?:airport|catalog|procedure|lookup)|sg\/(?:procedure|airway|airport)\.geojson)\?/;
 let token='',connected=false,relayWindow=null,relayNonce='',relayReady=false,relaySequence=0,relayHandshake=null;
 const relayInflight=new Map();
 function relayPath(path){
  return typeof path==='string'&&path.length<=440&&
   /^\/api\/(?:source\/status|cdu\/(?:airport|catalog|procedure)|sg\/procedure\.geojson)(?:\?[^#]*)?$/.test(path)&&
   !path.includes('..')&&!/%2f|%5c/i.test(path);
 }
 function clearRelay(){
  relayReady=false;
  if(relayHandshake){clearTimeout(relayHandshake.timer);relayHandshake.reject(Error('RELAY_CLOSED'));relayHandshake=null;}
  for(const [id,item] of relayInflight){clearTimeout(item.timer);item.reject(Error('RELAY_CLOSED'));relayInflight.delete(id);}
  if(relayWindow&&!relayWindow.closed)try{relayWindow.close()}catch(_){}
  relayWindow=null;relayNonce='';
 }
 function handleRelayMessage(event){
  if(event.origin!==RAILWAY_ORIGIN||event.source!==relayWindow||
     event.data?.type!==RELAY_PROTOCOL||event.data.nonce!==relayNonce)return;
  const msg=event.data;
  if(msg.kind==='READY'){
   relayReady=true;
   if(relayHandshake){clearTimeout(relayHandshake.timer);relayHandshake.resolve();relayHandshake=null;}
   return;
  }
  if(msg.kind==='CLOSED'){disconnect();return;}
  if(msg.kind!=='RESULT'||!Number.isSafeInteger(msg.id)||!relayInflight.has(msg.id))return;
  const pending=relayInflight.get(msg.id);relayInflight.delete(msg.id);clearTimeout(pending.timer);
  if(msg.status===401){pending.reject(Error('RAILWAY_SESSION_EXPIRED'));disconnect();return;}
  const status=Number(msg.status)||503;
  pending.resolve({ok:status>=200&&status<300,status,json:async()=>msg.body});
 }
 root.addEventListener('message',handleRelayMessage);
 function openRailwayRelay(){
  if(!github)return Promise.reject(Error('NOT_GITHUB_ORIGIN'));
  clearRelay();
  const bytes=new Uint8Array(16);root.crypto.getRandomValues(bytes);
  relayNonce=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  // Open synchronously from the user click; background popups are blocked.
  relayWindow=root.open(RAILWAY_ORIGIN+'/navdata-relay/start?nonce='+relayNonce,
    'b737NavdataRelay','popup=yes,width=520,height=410,resizable=yes');
  if(!relayWindow)return Promise.reject(Error('ALLOW_POPUP_FOR_RAILWAY'));
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{relayHandshake=null;reject(Error('RAILWAY_LOGIN_REQUIRED'))},20000);
   relayHandshake={resolve,reject,timer};
  });
 }
 function relayRequest(path){
  if(!relayReady||!relayWindow||relayWindow.closed){disconnect();return Promise.reject(Error('RAILWAY_RELAY_CLOSED'));}
  if(!relayPath(path))return Promise.reject(Error('READ_ONLY_PATH_REJECTED'));
  const id=++relaySequence;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{relayInflight.delete(id);reject(Error('RAILWAY_RELAY_TIMEOUT'))},15000);
   relayInflight.set(id,{resolve,reject,timer});
   relayWindow.postMessage({type:RELAY_PROTOCOL,nonce:relayNonce,kind:'GET',id,path},RAILWAY_ORIGIN);
  });
 }
 const $=id=>document.getElementById(id);
 const frames=()=>[...document.querySelectorAll('iframe.cdu-frame')];
 function announce(action){for(const f of frames())try{f.contentWindow?.[action]?.()}catch(_){}}
 function refreshStatus(message){
  const s=$('cduSgPrivateStatus');if(s)s.textContent=message;
  if($('cduSgPrivateConnect'))$('cduSgPrivateConnect').disabled=connected;
  if($('cduSgPrivateDisconnect'))$('cduSgPrivateDisconnect').disabled=!connected;
 }
 function disconnect(){
  token='';connected=false;clearRelay();root.B737CduSgRouteV1?.setConnected(false);
  announce('B737CDUDetachCduSgV1');
  refreshStatus('قطع · منبع CDU/SG غیرفعال است');
 }
 async function status(){
  return railway?fetch('/api/source/status',{method:'GET',credentials:'same-origin',cache:'no-store'}):
   github&&relayReady?relayRequest('/api/source/status'):
   fetch(BASE+'/api/source/status',{method:'GET',cache:'no-store',mode:'cors',
    credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',
    targetAddressSpace:'loopback',headers:{'X-CDU-SG-Token':token}});
 }
 const bridge=Object.freeze({
  isConnected:()=>connected&&(railway||!!token||relayReady),
  source:railway?'UNIFIED_SAME_ORIGIN':github?'UNIFIED_GATEWAY':'CDU_SG_SOURCE_NAVDB_V1',
  async request(path){
   if(!connected||!this.isConnected())throw Error('PRIVATE CDU/SG NAVDB DISCONNECTED');
   if(typeof path!=='string'||path.length>420||!ROUTES.test(path)||
      path.includes('#')||path.includes('..'))throw Error('READ ONLY PATH REJECTED');
   return railway?fetch(path,{method:'GET',cache:'no-store',credentials:'same-origin'}):
    github&&relayReady?relayRequest(path):
    fetch(BASE+path,{method:'GET',cache:'no-store',mode:'cors',credentials:'omit',
     redirect:'error',referrerPolicy:'no-referrer',targetAddressSpace:'loopback',
     headers:{'X-CDU-SG-Token':token}});
  }
 });
 root.B737CduSgBridgeV1=bridge;
 async function connect(){
  if(!railway&&!github){refreshStatus('This source is unavailable on this host');return;}
  if(github){
   // GitHub Pages and Railway do not host separate CDUs. Open the same
   // canonical Unified cockpit behind its authenticated gateway instead of
   // asking the user to approve a second popup/relay session.
   root.location.assign(RAILWAY_ORIGIN+'/panel-mosaic-lab/cockpit/index.html');
   return;
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
    'منبع ناوبری مشترک در دسترس نیست؛ ورود یا نصب بانک را بررسی کن');
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
  const h=document.createElement('strong');h.textContent='CDU / SG · Unified NAVDATA';
  const p=document.createElement('small');p.textContent=railway?
   'CDU و SG از بانک ناوبری مشترک Unified استفاده می‌کنند. اتصال با نشست ورود فعلی انجام می‌شود.':github?
   'برای دسترسی به NAVDATA خصوصی، Unified را از درگاه ورود کنترل‌شده باز کن؛ پنجره یا لاگین دوم CDU لازم نیست.':
   'برای خواندن داده‌های خصوصی، سرویس محلی ناوبری را اجرا کن.';
  const input=document.createElement('input');input.type='password';input.id='cduSgPrivateToken';
  input.autocomplete='off';input.dir='ltr';input.placeholder='Optional local token (port 8768)';
  if(railway)input.hidden=true;
  if(github){input.hidden=true;}
  const connectButton=document.createElement('button');connectButton.type='button';
  connectButton.id='cduSgPrivateConnect';
  connectButton.textContent=railway?'Check Unified NAVDATA':github?'Open Unified Gateway':'Connect Unified NAVDATA';
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
  if((railway||github)&&!$('cduSgQuickOpen')){
   const header=$('inspectorToggle')?.parentElement;
   if(header){
    const quick=document.createElement('button');quick.id='cduSgQuickOpen';
    quick.type='button';quick.textContent='NAV DATA';quick.setAttribute('aria-label','Open CDU NAVDATA import and connection');
    quick.addEventListener('click',()=>{
     if(!document.body.classList.contains('side-open'))$('inspectorToggle')?.click();
     section.scrollIntoView({behavior:'smooth',block:'start'});
    });
    header.insertBefore(quick,$('inspectorToggle'));
   }
  }
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
