(function(){'use strict';
function ready(){
 const open=document.getElementById('busTransferGuardReviewOpen');
 const close=document.getElementById('busTransferGuardReviewClose');
 const dialog=document.getElementById('busTransferGuardReviewDialog');
 if(!open||!close||!dialog)return;
 const frame=dialog.querySelector('iframe');
 function show(){
  if(frame && !frame.src && frame.dataset.src)frame.src=frame.dataset.src;
  if(!dialog.open)dialog.showModal();
 }
 function hide(){if(dialog.open)dialog.close();}
 open.addEventListener('click',show);
 close.addEventListener('click',hide);
 dialog.addEventListener('click',event=>{if(event.target===dialog)hide();});
 // Deep-link to owner-approved preview without modifying scene/overhead.
 if(new URLSearchParams(window.location.search).get('busTransferGuard')==='1')show();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
else ready();
})();
