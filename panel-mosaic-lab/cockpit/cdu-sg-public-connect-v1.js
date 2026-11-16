/* Opt-in loopback SQLite CDU/SG source; never stores token or exposes SQLite. */
(function(root){
 'use strict';
 const BASE='http://127.0.0.1:8768',DOMAIN='mahmet737ng-gif.github.io';
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
 const bridge=Object.freeze({
  isConnected:()=>connected&&!!token,
  source:'CDU_SG_SOURCE_NAVDB_V1',
  async request(path){
   if(!connected||!token)throw Error('PRIVATE CDU/SG NAVDB DISCONNECTED');
   if(typeof path!=='string'||path.length>420||!ROUTES.test(path)||
      path.includes('#')||path.includes('..'))throw Error('READ ONLY PATH REJECTED');
   return fetch(BASE+path,{method:'GET',cache:'no-store',mode:'cors',credentials:'omit',
    redirect:'error',referrerPolicy:'no-referrer',targetAddressSpace:'loopback',
    headers:{'X-CDU-SG-Token':token}});
  }
 });
 root.B737CduSgBridgeV1=bridge;
 function disconnect(){
  token='';connected=false;root.B737CduSgRouteV1?.setConnected(false);
  announce('B737CDUDetachCduSgV1');
  refreshStatus('قطع · مرجع SQLite غیرفعال است');
 }
 async function connect(){
  const field=$('cduSgPrivateToken'),submitted=String(field?.value||'').trim();
  if(field)field.value='';
  if(root.location.hostname!==DOMAIN||submitted.length<24||submitted.length>256){
   refreshStatus('دامنه رسمی یا توکن اتصال نامعتبر است');return;
  }
  const button=$('cduSgPrivateConnect');if(button)button.disabled=true;
  refreshStatus('در حال بررسی بانک خصوصی…');
  try{
   const resp=await fetch(BASE+'/api/source/status',{method:'GET',cache:'no-store',mode:'cors',
    credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',targetAddressSpace:'loopback',
    headers:{'X-CDU-SG-Token':submitted}});
   if(!resp.ok)throw Error('SOURCE_UNAVAILABLE');
   const info=await resp.json();
   if(info.status!=='SOURCE_CONNECTED_READ_ONLY'||
      info.metadata?.schema!=='CDU_SG_SOURCE_NAVDB_V1'||
      info.metadata?.airac!=='UNSPECIFIED_IN_UPLOADED_FILES'||
      info.metadata?.fmc_executable!==false||info.fmc_executable!==false||
      !['OIII','OIMM','OISS'].every(x=>info.airports?.includes(x)))
    throw Error('INCOMPATIBLE_PRIVATE_DATASET');
   token=submitted;connected=true;
   root.B737CduSgRouteV1?.setConnected(true);
   // These are reference-only charts, not a certified FMC nav bank.
   refreshStatus('متصل · OIII/OIMM/OISS · AIRAC نامشخص · فقط مرجع');
   announce('B737CDUAttachCduSgV1');
  }catch(err){disconnect();refreshStatus('اتصال ناموفق: سرویس محلی، توکن یا دسترسی مرورگر را بررسی کنید');}
  finally{if(button)button.disabled=connected;}
 }
 function init(){
  const panel=document.querySelector('section.cdu-tools');
  if(!panel||$('cduSgPrivateConnect'))return;
  const section=document.createElement('section');section.className='private-nav-bridge';
  section.style.cssText='margin-top:12px;padding:12px;border:1px solid #456070;border-radius:8px;display:grid;gap:8px';
  const h=document.createElement('strong');h.textContent='CDU / SG · Private SQLite';
  const p=document.createElement('small');
  p.textContent='فقط دادهٔ مرجع OIII / OIMM / OISS؛ فایل و توکن روی این کامپیوتر می‌مانند.';
  const input=document.createElement('input');input.type='password';input.id='cduSgPrivateToken';
  input.autocomplete='off';input.dir='ltr';input.placeholder='Token from local port 8768';
  const connectButton=document.createElement('button');connectButton.type='button';
  connectButton.id='cduSgPrivateConnect';connectButton.textContent='Connect CDU / SG SQLite';
  const dis=document.createElement('button');dis.type='button';dis.id='cduSgPrivateDisconnect';
  dis.textContent='Disconnect';dis.disabled=true;
  const s=document.createElement('p');s.id='cduSgPrivateStatus';s.setAttribute('role','status');
  s.textContent='قطع · بدون منبع خصوصی';s.style.margin='0';
  section.append(h,p,input,connectButton,dis,s);panel.append(section);
  connectButton.addEventListener('click',connect);dis.addEventListener('click',disconnect);
  for(const f of frames())f.addEventListener('load',()=>{if(connected)try{
    f.contentWindow?.B737CDUAttachCduSgV1?.();}catch(_){}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
