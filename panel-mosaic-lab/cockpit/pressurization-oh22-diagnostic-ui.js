/* Unified-facing, read-only CPCS/DCPCS diagnostic console.
 * Runs inside the existing cockpit, scans the actual OH22 iframe DOM and
 * collects controller state. No instructor faults or switch commands.
 */
(function(){
 'use strict';
 const mount=document.querySelector('.aircraft-profile-summary');
 if(!mount)return;
 const wrap=document.createElement('section');
 wrap.className='oh22-diagnostic-console';
 wrap.id='oh22DiagnosticConsole';
 wrap.setAttribute('aria-label','OH22 pressure panel diagnostic scanner');
 wrap.innerHTML='<h3>OH22 · CPCS / DCPCS Diagnostics</h3>'+
   '<p class="muted">Live scan of selected OH22 layer, controller state, lamp assets, physical clipping, and control overlap. Read-only — no switches are moved.</p>'+
   '<div class="oh22-diag-actions">'+
     '<button id="oh22DiagScan" type="button">Scan current panel</button>'+
     '<button id="oh22DiagOverlay" type="button" aria-pressed="false">Show socket outlines</button>'+
     '<button id="oh22DiagCopy" type="button" disabled>Copy JSON report</button>'+
   '</div><p id="oh22DiagStatus" role="status">Ready for inspection</p>'+
   '<output id="oh22DiagTotals" style="display:block;direction:ltr;text-align:left"></output>'+
   '<div id="oh22DiagResults" class="oh22-diag-results" dir="ltr"></div>'+
   '<small>Alignment against the original photo still requires visual approval; match to registry coordinates is not proof of photo accuracy.</small>';
 const target=document.getElementById('pressurePhysicsDiagnostics');
 if(target)target.before(wrap);else mount.append(wrap);
 const el=id=>wrap.querySelector('#'+id);
 const frame=()=>document.getElementById('overheadFrame');
 const status=el('oh22DiagStatus'),results=el('oh22DiagResults'),totals=el('oh22DiagTotals');
 let last=null,token=0,overlay=false;
 function send(action,more={}){
   const w=frame()?.contentWindow;
   if(!w){status.textContent='Overhead iframe is not ready.';return false;}
   w.postMessage({type:'b737:cockpit-command',action,...more},location.origin);return true;
 }
 function scan(){
   token+=1;status.textContent='Scanning live OH22 (read-only)…';
   if(!send('pressurization-diagnostics-request',{requestId:token})){
     status.textContent='Embedded OH22 is not available.';
   }
 }
 // Report is intentionally bounded to a single in-flight request and the
 // selected installation; stale CPCS results cannot be shown as DCPCS.
 function result(report){
   last=report;el('oh22DiagCopy').disabled=false;
   const s=report.summary;
   totals.textContent=report.system+' | '+s.CRITICAL+' critical · '+s.ERROR+' errors · '+s.WARNING+' warnings · '+s.INFO+' notes';
   results.replaceChildren();
   const append=(message,kind)=>{
     const node=document.createElement('p');node.className='oh22-diag-'+kind.toLowerCase();node.textContent=message;
     results.append(node);
   };
   if(!report.issues.length)append('No runtime issues detected. Photo-level calibration still required.','INFO');
   for(const issue of report.issues)append('['+issue.severity+'] '+issue.code+' — '+issue.message,issue.severity);
   status.textContent='Completed '+new Date(report.observed?.scanTime||Date.now()).toLocaleTimeString()+
     ' · '+report.metrics.controlsRegistered+' controls / '+report.metrics.lampsRegistered+' lamps / '+report.metrics.displaysRegistered+' readouts.';
 }
 window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==frame()?.contentWindow)return;
   const d=e.data;
   if(d?.type!=='b737:cockpit-overhead'||!['pressurization-diagnostics-result','pressurization-diagnostics-error'].includes(d.kind))return;
   if(d.requestId!==token)return;
   const selected=window.B737PressurizationIntegration?.getSelected?.();
   if(d.kind==='pressurization-diagnostics-error'){status.textContent='OH22 scan error: '+d.error;return;}
   if(d.report?.system!==selected){status.textContent='Panel selection changed; rerun scan.';return;}
   result(d.report);
 });
 el('oh22DiagScan').onclick=scan;
 el('oh22DiagOverlay').onclick=()=>{
   overlay=!overlay;
   el('oh22DiagOverlay').setAttribute('aria-pressed',String(overlay));
   el('oh22DiagOverlay').textContent=overlay?'Hide socket outlines':'Show socket outlines';
   send('pressurization-diagnostics-overlay',{enabled:overlay});
 };
 el('oh22DiagCopy').onclick=async()=>{
   if(!last)return;
   const serialized=JSON.stringify(last,null,2);
   try{
     await navigator.clipboard.writeText(serialized);
     status.textContent='OH22 diagnostic JSON copied.';
   }catch(error){
     status.textContent='Clipboard unavailable; select the text shown below to copy.';
     const pre=document.createElement('pre');pre.textContent=serialized;pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';
     results.prepend(pre);
   }
 };
 window.addEventListener('b737:aircraft-profile-change',()=>{
   last=null;el('oh22DiagCopy').disabled=true;
   totals.textContent='';results.replaceChildren();status.textContent='Selected profile changed — scan the new OH22 installation.';
   if(overlay)send('pressurization-diagnostics-overlay',{enabled:true});
 });
 const overhead=frame();
 // A mount-time read-only scan is useful for a screenshot-driven audit.
 // The Scan button remains available after zoom/profile changes.
 if(overhead)overhead.addEventListener('load',()=>window.setTimeout(scan,350));
 window.setTimeout(()=>{if(!last)scan();},1400);
 window.B737UnifiedOH22Diagnostics=Object.freeze({scan,getLatest:()=>last});
})();
