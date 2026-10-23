'use strict';
const $=id=>document.getElementById(id);let selectedPlan=null,composeEnabled=false;
async function req(path,opts){const response=await fetch(path,{cache:'no-store',...opts});const data=await response.json();if(!response.ok)throw Error(data.message||data.error||'Source request failed');return data}
function alertMsg(msg,ok=false){$('message').textContent=msg;$('message').className=ok?'ok':'warning'}
function planSummary(plan){return JSON.stringify({airac:plan.airac,origin:plan.origin,destination:plan.destination,
 sid:plan.selected_departure?.ident||'NONE',star:plan.selected_arrival?.ident||'NONE',approach:plan.selected_approach?.ident||'NONE',
 discontinuities:plan.qa?.discontinuity_count,reference_fixes:plan.qa?.airway_fix_row_count,
 FMC:'NOT_EXECUTABLE',NAV_GUIDANCE:'DISABLED'},null,2)}
async function loadPlan(){try{const id=$('saved').value;const result=await req('/api/stage5/plan?id='+encodeURIComponent(id));
 // Never pass a network response to an iframe without validating in the same-origin frame.
 const f=$('cdu').contentWindow;f.NPE_STAGE5_MODEL.validate(result);
 selectedPlan=result;$('details').textContent=planSummary(result);$('stage').disabled=false;alertMsg('Validated source plan loaded. NOT ACTIVE.',true)}catch(e){selectedPlan=null;$('stage').disabled=true;alertMsg(e.message)}}
async function init(){try{
 const stat=await req('/api/stage5/status');if(stat.marker!=='//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'||stat.fmc_executable!==false)throw Error('Unknown AIRAC or unsafe server');
 composeEnabled=!!stat.compose_enabled;
 $('status').textContent='AIRAC '+stat.airac+' / Local · '+(composeEnabled?'Composition enabled':'Saved drafts only');$('status').className='ok';
 const ps=await req('/api/stage5/plans');$('saved').replaceChildren(...ps.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${p.id} · ${p.origin} → ${p.destination} (${p.discontinuities} DISCO)`;return o}));
 $('compose').disabled=!composeEnabled;$('fetchLists').disabled=!composeEnabled;
 }catch(e){$('status').textContent=e.message;$('status').className='warning';$('compose').disabled=true;$('fetchLists').disabled=true}
}
async function lists(){if(!composeEnabled)return;try{
 for(const [id,airport,kind] of [['sid',$('origin').value,'SID'],['star',$('dest').value,'STAR'],['app',$('dest').value,'APP']]){
  const items=await req('/api/stage5/procedures?airport='+encodeURIComponent(airport.toUpperCase())+'&kind='+kind);
  const list=$(''+id);list.replaceChildren();const none=document.createElement('option');none.value='';none.textContent='None';list.append(none);
  for(const item of items){const option=document.createElement('option');option.value=item.ident;option.textContent=item.ident;option.dataset.runways=JSON.stringify(item.runways);option.dataset.transitions=JSON.stringify(item.transitions);list.append(option)}
 }
 alertMsg('Source procedure catalogues ready. Runway/transition must match source.',true);
 }catch(e){alertMsg(e.message)}}
function selected(id,rwy,trans){const ident=$(id).value;if(!ident)return undefined;const obj={ident};if($(rwy)?.value.trim())obj.runway=$(rwy).value.trim().toUpperCase();if(trans&&$(trans).value.trim())obj.transition=$(trans).value.trim().toUpperCase();return obj}
async function compose(){try{const enroute=JSON.parse($('enroute').value);const data={origin:$('origin').value.toUpperCase().trim(),destination:$('dest').value.toUpperCase().trim(),enroute};
 const d=selected('sid','sidRwy'),s=selected('star','starRwy'),a=selected('app','appRwy','appTrans');
 if(d)data.departure=d;if(s)data.arrival=s;if(a)data.approach=a;
 const plan=await req('/api/stage5/compose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const f=$('cdu').contentWindow;f.NPE_STAGE5_MODEL.validate(plan);
 selectedPlan=plan;$('details').textContent=planSummary(plan);$('stage').disabled=false;alertMsg('Composed and validated as DRAFT. NO active legs.',true);
 }catch(e){alertMsg(e.message)}}
function stage(){try{if(!selectedPlan)throw Error('Load a private plan first');const win=$('cdu').contentWindow;
 if(!win?.CDU_STAGE5_API)throw Error('CDU iframe not loaded yet');
 const status=win.CDU_STAGE5_API.stagePlan(selectedPlan);$('cdu-status').textContent=JSON.stringify(status);alertMsg('MOD staged. Press CDU RTE L5 ACTIVATE and then EXEC. No LNAV will be enabled.',true);
 }catch(e){alertMsg(e.message)}}
$('load').addEventListener('click',loadPlan);$('stage').addEventListener('click',stage);$('compose').addEventListener('click',compose);$('fetchLists').addEventListener('click',lists);
$('cdu').addEventListener('load',()=>{if(selectedPlan)$('stage').disabled=false});init();