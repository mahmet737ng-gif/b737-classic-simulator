/* Opt-in public Unified access to owner's localhost NAVDATA; token never stored. */
(function(root){
'use strict';
const BASE='http://127.0.0.1:8767',DOMAIN='mahmet737ng-gif.github.io';
let token='',connected=false;
root.B737NavBridgeV1=Object.freeze({
 isConnected:()=>connected&&!!token,
 async request(path,options){
  if(!connected||!token)throw Error('PRIVATE NAV DATA DISCONNECTED');
  if(typeof path!=='string'||!/^\/api\/stage6\/(navdata|catalog)\?/.test(path)||
    (options?.method&&options.method.toUpperCase()!=='GET'))
   throw Error('READ ONLY LOOKUP REQUIRED');
  return fetch(BASE+path,{method:'GET',mode:'cors',cache:'no-store',
   credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',
   headers:{'X-B737-Nav-Token':token}});
 }
});
const el=x=>document.getElementById(x),frames=()=>[...document.querySelectorAll('iframe.cdu-frame')];
function broadcast(name){for(const frame of frames())try{frame.contentWindow?.[name]?.()}catch(_){}}
function status(message,ok=false){
 const output=el('privateNavStatus');if(output)output.textContent=message;
 const b=el('privateNavConnect'),d=el('privateNavDisconnect');
 if(b)b.disabled=ok;if(d)d.disabled=!ok;
}
function disconnect(){connected=false;token='';broadcast('B737CDUDetachPublicNavDataV1');status('خصوصی: قطع · CDU در حالت عادی');}
async function connect(){
 const input=el('privateNavToken'),submitted=String(input?.value||'').trim();
 if(input)input.value='';
 if(root.location.hostname!==DOMAIN||submitted.length<24||submitted.length>256){
  status('دامنه رسمی یا توکن اتصال معتبر نیست');return;
 }
 el('privateNavConnect').disabled=true;status('در حال بررسی سرویس محلی…');
 try{
  const r=await fetch(BASE+'/api/navdata/status',{
   method:'GET',mode:'cors',cache:'no-store',credentials:'omit',
   referrerPolicy:'no-referrer',redirect:'error',
   headers:{'X-B737-Nav-Token':submitted}});
  if(!r.ok)throw Error('TOKEN_REJECTED');
  const x=await r.json();
  if(x.status!=='CONNECTED_READ_ONLY'||x.airac!=='2610'||
     x.fmc_executable!==false||x.public_source_hosted!==false)
   throw Error('INVALID_LOCAL_BRIDGE');
  token=submitted;connected=true;
  status('متصل · PRIVATE AIRAC 2610 · فقط خواندنی',true);
  broadcast('B737CDUAttachPublicNavDataV1');
 }catch(_){
  disconnect();status('اتصال برقرار نشد: سرویس محلی، توکن یا مجوز مرورگر را بررسی کنید');
 }finally{el('privateNavConnect').disabled=connected;}
}
function init(){
 const sidebar=document.querySelector('section.cdu-tools');
 if(!sidebar||el('privateNavConnect'))return;
 const wrap=document.createElement('section');wrap.className='private-nav-bridge';
 wrap.style.cssText='margin-top:12px;padding:12px;border:1px solid #456070;border-radius:8px;display:grid;gap:8px';
 const title=document.createElement('strong');title.textContent='Private NAV DATA · AIRAC 2610';
 const help=document.createElement('small');help.textContent='دیتابیس خصوصی روی همین کامپیوتر می‌ماند؛ توکن سرویس محلی را وارد کنید.';
 const input=document.createElement('input');input.id='privateNavToken';input.type='password';
 input.autocomplete='off';input.dir='ltr';input.placeholder='One-time connection token';
 input.setAttribute('aria-label','Private NAVDATA token');
 const b=document.createElement('button');b.id='privateNavConnect';b.type='button';b.textContent='Connect Private NAV DATA';
 const d=document.createElement('button');d.id='privateNavDisconnect';d.type='button';d.textContent='Disconnect';d.disabled=true;
 const info=document.createElement('p');info.id='privateNavStatus';info.setAttribute('role','status');
 info.textContent='خصوصی: قطع · اختیاری';info.style.margin='0';
 wrap.append(title,help,input,b,d,info);sidebar.append(wrap);
 b.addEventListener('click',connect);d.addEventListener('click',disconnect);
 for(const frame of frames())frame.addEventListener('load',()=>{
  if(connected)try{frame.contentWindow?.B737CDUAttachPublicNavDataV1?.()}catch(_){}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
