/* Railway guest: preserve the full native Unified cockpit and its default focus. */
(function(){
 'use strict';
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
