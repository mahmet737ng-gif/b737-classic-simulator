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
  if(!frame.getAttribute('src'))frame.src=new URL('../../cb-panel-lab/?v=CB-FOUR-FLASH-0001',document.baseURI).href;
  if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
  else if(typeof dialog.showModal!=='function')location.assign(frame.src);
 }
 function closeCB(){if(dialog.open)dialog.close();}
 open.addEventListener('click',openCB);
 close.addEventListener('click',closeCB);
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeCB();});
})();
