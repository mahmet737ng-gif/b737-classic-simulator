(function(){'use strict';
 // A runnable trainer-control inside the EXISTING unmounted photo-guard review.
 // Absolutely no change to the locked OH12 artwork or measured socket.
 const auto=document.getElementById('busTransferLiveAuto');
 const off=document.getElementById('busTransferLiveOff');
 const status=document.getElementById('busTransferLiveStatus');
 if(!auto||!off||!status)return;
 let connected=false,awaiting=false,value=null,sequence=0;
 const statusText=(s)=>{status.textContent=s;};
 const send=x=>{if(parent===window)return;parent.postMessage(x,location.origin);};
 function show(){
  auto.disabled=off.disabled=!connected||awaiting;
  auto.setAttribute('aria-pressed',String(value==='auto'));
  off.setAttribute('aria-pressed',String(value==='off'));
 }
 function command(next){
  if(!connected||awaiting)return;
  if(!document.querySelector('.station.opened')){
   statusText('اول گارد را باز کن، بعد سوئیچ را تغییر بده.');
   return;
  }
  if(value===next){statusText('این حالت همین حالا فعال است.');return;}
  awaiting=true;sequence++;show();statusText('فرمان به سیستم برق فرستاده شد…');
  send({type:'b737:bus-transfer-preview-command',value:next,guard:'open',sequence});
 }
 // The 3D opened cover can overlap its neighbor's pointer hitbox in Chromium.
 // Accessible controls activate the SAME already-approved cover toggle; no
 // substitute artwork and no bypass of guard logic.
 document.getElementById('busTransferGuardOpen')?.addEventListener('click',()=>{
  const s=document.querySelectorAll('.station')[1];
  if(s&&!s.classList.contains('opened'))s.querySelector('.cover')?.click();
  statusText('گارد باز شد. می‌توانی AUTO یا OFF را انتخاب کنی.');
 });
 document.getElementById('busTransferGuardClose')?.addEventListener('click',()=>{
  document.querySelectorAll('.station.opened .cover').forEach(c=>c.click());
  statusText('گارد بسته شد. تغییر حالت مجاز نیست.');
 });
 auto.addEventListener('click',()=>command('auto'));
 off.addEventListener('click',()=>command('off'));
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  const m=event.data;
  if(m?.type!=='b737:bus-transfer-preview-state')return;
  if(m.sequence!==undefined&&m.sequence!==sequence)return; // stale answer
  if(m.value!=='auto'&&m.value!=='off'){
   awaiting=false;connected=false;show();statusText('پاسخ سیستم برق معتبر نیست.');return;
  }
  connected=true;awaiting=false;value=m.value;show();
  if(m.accepted===false)statusText('فرمان رد شد: '+String(m.reason||'نامشخص').slice(0,130));
  else statusText('وضعیت واقعی برق: '+value.toUpperCase());
 });
 show();
 send({type:'b737:bus-transfer-preview-ready'});
})();