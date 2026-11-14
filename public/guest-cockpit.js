/* Apply the original cockpit's own overhead-focus action, not a cloned viewer. */
(function(){
 'use strict';
 let requested=false;
 function focusOverhead() {
   const hiddenButton=document.getElementById('guestSourceOverheadFocus');
   const region=document.getElementById('region-overhead');
   if(!hiddenButton || !region)return false;
   hiddenButton.click(); // Real original app.js listener -> focus('overhead')
   return true;
 }
 function mountLogout() {
   const header=document.querySelector('header.unified-minimal-header .header-settings');
   if(!header || document.getElementById('guestLogoutForm'))return;
   const form=document.createElement('form');
   form.id='guestLogoutForm';form.action='/api/logout';form.method='post';
   const button=document.createElement('button');
   button.type='submit';button.textContent='SIGN OUT';button.title='Release this guest device slot';
   form.append(button);header.append(form);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountLogout,{once:true});
 else mountLogout();
 window.addEventListener('b737:cockpit-mounted',()=>{
   if(requested)return;
   requested=true;
   // Original mount() dispatches before its initial focus('main'); defer until
   // after that call to avoid racing against the cockpit controller.
   setTimeout(()=>{if(!focusOverhead())requested=false;},0);
 });
 // Same-origin iframe wheel-pan is already implemented by original
 // overhead-bridge.js -> app.js. Do not install duplicate competing handlers.
 // When the user returns from a module, preserve normal cockpit zoom/scroll.
 document.addEventListener('click',event=>{
   const anchor=event.target.closest?.('a[href]');
   if(!anchor)return;
   try {
     const url=new URL(anchor.href,location.href);
     if(url.hostname.endsWith('.github.io') ||
        (url.hostname==='github.com' && url.pathname.includes('b737-classic-simulator'))) {
       event.preventDefault();
     }
   }catch(_){}
 },true);
})();
