/* CB-ENTRY-0001. The CB panel is an independent full-screen view.
   No cockpit switch coordinates, protected assets or simulation state are modified. */
(function(){
 'use strict';
 const open=document.getElementById('cbPanelOpen');
 const dialog=document.getElementById('cbPanelDialog');
 const close=document.getElementById('cbPanelClose');
 const frame=document.getElementById('cbPanelFrame');
 if(!open||!dialog||!close||!frame)return;
 function openCB(){
  if(!frame.getAttribute('src'))frame.src=new URL('../../cb-panel-lab/?v=CB-SIXPACK-FUEL-ANTIICE-0002',document.baseURI).href;
  if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
  else if(typeof dialog.showModal!=='function')location.assign(frame.src);
 }
 function closeCB(){if(dialog.open)dialog.close();
  // Reconcile persisted pulls before painting the now-visible cockpit.
  // Also covers browsers which postpone cross-frame message delivery.
  window.B737UnifiedCB?.refresh?.();
 }
 open.addEventListener('click',openCB);
 close.addEventListener('click',closeCB);
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeCB();});
})();
