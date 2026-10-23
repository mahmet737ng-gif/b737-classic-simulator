/* AIRAC 2610 Stage6: source-backed native CDU LSK DEP/ARR selector.
 * Additive overlay; no control hotspot, image or EFIS panel edits.
 * The EXEC action commits only an INACTIVE REFERENCE PLAN.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory;
 // Public GitHub Pages runs the STANDALONE B737 CDU. The Stage6 private-source
 // adapter must only attach in a trusted local development host where the
 // private Stage4/5 NAVDB service can exist. Never intercept native DEP/ARR
 // in the public cockpit or demand that a saved Stage5 plan be executed.
 const privateHost=!!root&&/^(127\.0\.0\.1|localhost|\[::1\])$/.test(root.location?.hostname||'');
 if(privateHost&&root.NPE_STAGE5_MODEL&&typeof state!=='undefined'&&typeof core!=='undefined')
  root.CDU_STAGE6_API=factory(root.NPE_STAGE5_MODEL,state,core,root.CDU_PAGES,
    (url,options)=>fetch(url,{cache:'no-store',credentials:'same-origin',...options}),()=>root.updateStage5View?.());
})(typeof window==='undefined'?null:window,function(model,state,core,pages,fetcher,refresh){
'use strict';
const TYPES=['SID','STAR','APP'];
let serial=0;
const copy=x=>JSON.parse(JSON.stringify(x));
const summaryPlan=()=>state.stage6PendingPlan||state.stage5Committed||null;
const prior=()=>state.stage5Committed||null;
const updates=()=>refresh?.();
const validAirport=s=>typeof s==='string'&&/^[A-Z]{4}$/.test(s);
function error(s){state.message=String(s).replace(/^NAVDB:\s*/,'').slice(0,24);updates();}
function setBasePlanId(id){
 if(!Number.isInteger(id)||id<=0)throw Error('Saved Stage4 private ID required');
 state.stage6BasePlanId=id;state.stage6Selections={};delete state.stage6PendingPlan;
 return {status:'PRIVATE_SOURCE_SELECTION_READY',id};
}
function guardedPlan(){
 const plan=prior();if(!plan)throw Error('EXECUTE Stage5 saved route first');
 model.validate(plan);
 if(!Number.isInteger(state.stage6BasePlanId))throw Error('Load a SAVED Stage4 plan in lab');
 if(state.active?.ORIGIN!==plan.origin||state.active?.DEST!==plan.destination)
  throw Error('Current CDU route differs from source plan');
 if(state.stage5Pending||state.navdbActive||state.navdbPending||core.hasStagedRoute(state)||core.pendingCount(state))
  throw Error('Resolve other CDU MOD entries first');
 return plan;
}
async function json(url,options){
 const resp=await fetcher(url,options);const body=await resp.json();
 if(!resp.ok)throw Error(body.message||body.error||'Private NAVDB source unavailable');
 return body;
}
function openMenu(){state.stage6View={mode:'MENU',page:1};core.choose(state,pages,'DEP_ARR');updates()}
function selected(kind){return state.stage6Selections?.[kind]===null?null:state.stage6Selections?.[kind]||
 prior()?.[({SID:'selected_departure',STAR:'selected_arrival',APP:'selected_approach'})[kind]]||null}
async function openCatalog(kind){
 try{
  const p=guardedPlan();if(!TYPES.includes(kind))throw Error('Invalid kind');
  const airport=kind==='SID'?p.origin:p.destination;
  const ticket=++serial;
  state.stage6View={mode:'LOADING',kind,airport,page:1,items:[]};
  core.choose(state,pages,kind==='SID'?'DEPARTURES':'ARRIVALS');updates();
  const result=await json('/api/stage6/catalog?airport='+encodeURIComponent(airport)+'&kind='+kind);
  if(serial!==ticket)return;
  if(result.airac!=='2610'||result.airport!==airport||result.kind!==kind||result.fmc_executable!==false||!Array.isArray(result.items))throw Error('Invalid AIRAC catalogue');
  for(const entry of result.items){if(!/^[A-Z0-9._-]{2,12}$/.test(entry.ident)||!Array.isArray(entry.runways)||!Array.isArray(entry.transitions)||entry.status!=='SOURCE_ONLY_NOT_FMC_EXECUTABLE')throw Error('Invalid source item');}
  state.stage6View={mode:'CATALOG',kind,airport,page:1,items:result.items};updates();
 }catch(e){state.stage6View={mode:'ERROR',kind,items:[],error:e.message,page:1};error(e.message)}
}
function makeChoice(item){
 const screen=state.stage6View;
 if(!screen||!screen.kind)throw Error('No selected procedure kind');
 if(!screen.items?.some(x=>x.ident===item.ident))throw Error('Source item not in catalogue');
 screen.selected={ident:item.ident};screen.runways=item.runways;screen.transitions=item.transitions;
 if(item.runways.length){screen.mode='RUNWAY';screen.page=1;updates();return;}
 if(item.transitions.length){screen.mode='TRANSITION';screen.page=1;updates();return;}
 void finishSelection();
}
function pickVariant(value){
 const f=state.stage6View;
 if(f.mode==='RUNWAY'){
  if(!f.runways.includes(value))throw Error('Runway not published');
  f.selected.runway=value;
  if(f.transitions.length){f.mode='TRANSITION';f.page=1;updates();return;}
 }else if(f.mode==='TRANSITION'){
  if(!f.transitions.includes(value))throw Error('Transition not published');
  f.selected.transition=value;
 }else throw Error('No runway/transition list');
 void finishSelection();
}
async function finishSelection(clear=false){
 const f=state.stage6View;
 try{
  guardedPlan();const kind=f.kind;
  const requested=clear?null:copy(f.selected);
  const selections={...(state.stage6Selections||{}),[kind]:requested};
  f.mode='COMPOSING';updates();
  const output=await json('/api/stage6/compose',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({plan_id:state.stage6BasePlanId,selections})});
  const valid=model.validate(output);
  if(valid.origin!==state.active.ORIGIN||valid.destination!==state.active.DEST||valid.executable!==false)throw Error('Source route drift');
  state.stage6Selections=selections;state.stage6PendingPlan=copy(output);state.stage6AwaitingExec=false;state.stage6Page=1;
  core.choose(state,pages,'DEP_ARR');state.stage6View={mode:'MENU',page:1};state.message='';updates();
 }catch(e){f.mode='ERROR';f.error=e.message;error(e.message)}
}
function handlesStage6Key(k){
 if(state.page==='RTE'&&k==='LSK_L5'&&state.stage6PendingPlan){
  try{guardedPlan();state.stage6AwaitingExec=true;core.choose(state,pages,'ACTIVATE');state.message='';}
  catch(e){error(e.message)}
  return true;
 }
 if(state.page==='ACTIVATE'&&state.stage6PendingPlan&&k==='LSK_L5'){
  delete state.stage6PendingPlan;state.stage6AwaitingExec=false;state.stage6Selections={};core.choose(state,pages,'RTE');state.message='';return true;
 }
 if(k==='EXEC'&&state.stage6PendingPlan){
  if(!state.stage6AwaitingExec){error('NAVDB ACTIVATE FIRST');return true;}
  try{guardedPlan();model.validate(state.stage6PendingPlan);
   state.stage5Committed=copy(state.stage6PendingPlan);
   delete state.stage6PendingPlan;state.stage6AwaitingExec=false;state.stage6Page=1;
   state.stage5Page=1;state.message='';core.choose(state,pages,'RTE');updates();
  }catch(e){error(e.message)}
  return true;
 }
 if(state.page==='DEP_ARR'&&['LSK_L1','LSK_R1','LSK_R2'].includes(k)){
  // A standalone CDU must not require a Stage 5 plan or private local API.
  // Only hijack the approved CDU controls when the optional private-source
  // laboratory has explicitly loaded and committed a matching saved plan.
  const base=prior();
  if(!base||!Number.isInteger(state.stage6BasePlanId)||
     state.stage6BasePlanId<=0||
     state.active?.ORIGIN!==base.origin||state.active?.DEST!==base.destination)
    return false; // Let native CDU DEP/ARR navigation handle these LSKs.
  void openCatalog(({LSK_L1:'SID',LSK_R1:'STAR',LSK_R2:'APP'})[k]);return true;
 }
 const f=state.stage6View;
 if(!f||!['DEPARTURES','ARRIVALS'].includes(state.page))return false;
 if(k==='LSK_L6'){++serial;openMenu();return true}
 if(k==='NEXT_PAGE'||k==='PREV_PAGE'){
  const source=f.mode==='CATALOG'?f.items:f.mode==='RUNWAY'?f.runways:f.mode==='TRANSITION'?f.transitions:[];
  const total=Math.max(1,Math.ceil(source.length/5));f.page=Math.max(1,Math.min(total,(f.page||1)+(k==='NEXT_PAGE'?1:-1)));updates();return true;
 }
 if(k==='LSK_R5'&&f.mode==='CATALOG'){void finishSelection(true);return true}
 const m=/^LSK_L([1-5])$/.exec(k);
 if(m&&['CATALOG','RUNWAY','TRANSITION'].includes(f.mode)){
  const i=((f.page||1)-1)*5+Number(m[1])-1;
  try{
   if(f.mode==='CATALOG'){if(f.items[i])makeChoice(f.items[i]);}
   else {const list=f.mode==='RUNWAY'?f.runways:f.transitions;if(list[i])pickVariant(list[i]);}
  }catch(e){error(e.message)}
  return true;
 }
 return true; // Never fall through to unrelated CDU keys in a source selector.
}
function beforeKey(code){return handlesStage6Key(code.replace(/^CDU_CAPT_/,''))}
function afterKey(){/* No automatic activation or page transitions. */}
function pair(box,y,left,right){
 const row=document.createElement('div');row.className='fmc-line fmc-pairline';row.style.top=y+'%';
 const l=document.createElement('span');l.className='fmc-left';l.textContent=String(left||'').slice(0,14);
 const r=document.createElement('span');r.className='fmc-right';r.textContent=String(right||'').slice(0,14);
 row.append(l,r);box.appendChild(row);
}
function paint(box){
 const page=state.page,f=state.stage6View||{};
 const plan=summaryPlan();
 if(page==='DEP_ARR'&&prior()){
  box.replaceChildren();pair(box,3,'ACT DEP/ARR REF','AIRAC 2610');
  [['SID',13,'LSK L1'],['STAR',37,'LSK R1'],['APP',61,'LSK R2']].forEach(([kind,y,key])=>{
   const s=selected(kind);pair(box,y,kind+' '+(s?.ident||'NONE'),key);
   pair(box,y+7,'RWY '+(s?.runway||s?.selected_runway||'---'), 'TRANS '+(s?.transition||s?.selected_transition||'---'));
  });
  pair(box,89,state.stage6PendingPlan?'MOD SOURCE READY':'SOURCE ONLY','NO LNAV');return;
 }
 if(['DEPARTURES','ARRIVALS'].includes(page)&&f.mode){
  box.replaceChildren();const list=f.mode==='CATALOG'?f.items:f.mode==='RUNWAY'?f.runways:f.mode==='TRANSITION'?f.transitions:[];
  const total=Math.max(1,Math.ceil(list.length/5)),n=Math.min(total,Math.max(1,f.page||1));
  pair(box,3,f.kind+' '+f.mode,n+'/'+total);
  if(f.mode==='ERROR'||f.mode==='LOADING'||f.mode==='COMPOSING'){pair(box,24,(f.error||f.mode), 'SOURCE ONLY')}
  else for(let i=0;i<5;i++){
   const entry=list[(n-1)*5+i];if(entry===undefined)continue;
   const label=typeof entry==='string'?entry:entry.ident;
   pair(box,13+i*14.5,'<'+label,typeof entry==='string'?'SELECT':('RWY '+entry.runways.length));
  }
  pair(box,91,'<RETURN L6',f.mode==='CATALOG'?'NONE R5':'NO AUTO LEGS');return;
 }
 if(!state.stage6PendingPlan||!['RTE','LEGS','ACTIVATE'].includes(page))return;
 model.validate(plan);box.replaceChildren();
 if(page==='LEGS'){
  const lines=model.rows(plan,'LEGS'),total=Math.max(1,Math.ceil(lines.length/5));
  state.stage6Page=Math.min(total,Math.max(1,state.stage6Page||1));
  pair(box,3,'MOD LEGS REF',state.stage6Page+'/'+total);
  lines.slice((state.stage6Page-1)*5,state.stage6Page*5).forEach((x,i)=>{
   pair(box,12+i*15,x.type==='DISCONTINUITY'?'--- DISCO ---':x.ident,(x.via||'').slice(0,12));
   pair(box,18+i*15,x.distance==null?'REF ONLY':x.distance.toFixed(1)+' NM',x.type==='DISCONTINUITY'?'NO JOIN':'TRUE ONLY');
  });return;
 }
 pair(box,3,page==='ACTIVATE'?'MOD RTE READY':'MOD RTE REF','AIRAC 2610');
 const dep=plan.selected_departure,arr=plan.selected_arrival,app=plan.selected_approach;
 pair(box,19,'SID '+(dep?.ident||'NONE'),'RWY '+(dep?.selected_runway||'---'));
 pair(box,32,'STAR '+(arr?.ident||'NONE'),'RWY '+(arr?.selected_runway||'---'));
 pair(box,45,'APP '+(app?.ident||'NONE'),'RWY '+(app?.selected_runway||'---'));
 pair(box,61,'DISCO '+plan.qa.discontinuity_count,'SOURCE ONLY');
 pair(box,84,page==='ACTIVATE'?'EXEC TO COMMIT':'<ACTIVATE L5','NO LNAV');
}
function afterPage(k){
 const key=k.replace(/^CDU_CAPT_/,'');if(state.page!=='LEGS'||!state.stage6PendingPlan)return;
 if(key!=='NEXT_PAGE'&&key!=='PREV_PAGE')return;
 const total=Math.max(1,Math.ceil(model.rows(state.stage6PendingPlan,'LEGS').length/5));
 state.stage6Page=Math.min(total,Math.max(1,(state.stage6Page||1)+(key==='NEXT_PAGE'?1:-1)));
}
function snapshot(){return {mode:state.stage6AwaitingExec?'WAIT_EXEC':state.stage6PendingPlan?'MOD_REFERENCE_ONLY':'SOURCE_ONLY',
 ready:!!state.stage6BasePlanId,discontinuities:summaryPlan()?.qa?.discontinuity_count||0,activeGuidance:false};}
return Object.freeze({setBasePlanId,beforeKey,afterKey,afterPage,paint,openCatalog,snapshot});
});