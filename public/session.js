/* Activity heartbeat, same-origin only; never communicates with any other product. */
(function(){
 'use strict';
 async function ping(){
  try{
   const response=await fetch('/api/pulse',{method:'POST',credentials:'same-origin',cache:'no-store'});
   if(response.status===401)location.replace('/login?e=expired');
  }catch(_){}
 }
 // Refresh session as soon as the document becomes interactive. The
 // cockpit can contain hundreds of concurrent static files.
 ping();
 const timer=setInterval(ping,45000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)ping();});
 window.addEventListener('pageshow',event=>{if(event.persisted)ping();});
 window.addEventListener('beforeunload',()=>clearInterval(timer));
})();
