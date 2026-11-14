/* Activity heartbeat, same-origin only; never communicates with any other product. */
(function(){
 'use strict';
 async function ping(){
  try{
   const response=await fetch('/api/pulse',{method:'POST',credentials:'same-origin',cache:'no-store'});
   if(response.status===401)location.replace('/login');
  }catch(_){}
 }
 const timer=setInterval(ping,45000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)ping();});
 window.addEventListener('beforeunload',()=>clearInterval(timer));
})();
