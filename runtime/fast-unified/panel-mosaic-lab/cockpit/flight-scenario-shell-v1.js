/* Keep FLT PHASE accessible independently of simulator dependency startup. */
(function(win){
 'use strict';
 const doc=win.document,button=doc.getElementById('flightScenarioHeader'),dialog=doc.getElementById('flightScenarioDialog');
 if(!button||!dialog||button.dataset.flightShell==='READY')return;
 button.dataset.flightShell='READY';
 button.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
 doc.getElementById('flightScenarioClose')?.addEventListener('click',()=>dialog.close());
})(window);
