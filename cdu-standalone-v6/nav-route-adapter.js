/* Read-only validated AIRAC reference-route handoff to CDU trainer v6.
 * This file never issues LNAV/VNAV, IRS, or autothrottle instructions.
 * Source data must be fetched from SAME-ORIGIN loopback /api/route only.
 */
(() => {
'use strict';
if (typeof state==='undefined' || typeof core==='undefined' || typeof update==='undefined') return;
const MAX_LEGS=250;
const exactKey='PMDG_WORLD_2610_WITH_PROCEDURES_R1';
function goodRoute(v){
 return v&&v.airac==='2610'&&v.sourceId===exactKey&&v.fmcExecutable===false&&
 Array.isArray(v.legs)&&v.legs.length>0&&v.legs.length<=MAX_LEGS&&
 /^[A-Z0-9]{4}$/.test(v.origin||'')&&/^[A-Z0-9]{4}$/.test(v.destination||'')&&
 v.legs.every(x=>/^[A-Z0-9]{2,8}$/.test(x.to||'')&&Number.isFinite(x.lat)&&Math.abs(x.lat)<=90&&Number.isFinite(x.lon)&&Math.abs(x.lon)<=180&&Number.isFinite(x.distanceNm));
}
function stage(route){
 if(!goodRoute(route))throw new Error('NAVDB source identity or route data invalid');
 if(core.pendingCount(state)||core.hasStagedRoute(state))throw new Error('CDU has uncommitted modifications. EXEC or ERASE them first.');
 if(state.navdbActive)throw new Error('Existing NAVDB route: reset CDU first to avoid silent replacement');
 state.navdbPending=structuredClone(route);
 state.navdbStage='WAIT_ACTIVATE_EXEC';
 state.stagedRoute={ORIGIN:route.origin,DEST:route.destination};
 state.message='';
 core.choose(state,pages,'RTE');
 update();
 return {status:'STAGED_NOT_ACTIVE',count:route.legs.length};
}
function afterKey(key){
 if(!state.navdbPending)return;
 if(key.replace(/^CDU_CAPT_/,'')==='EXEC'&&
   !core.pendingCount(state)&&!core.hasStagedRoute(state)&&
   state.active.ORIGIN===state.navdbPending.origin&&state.active.DEST===state.navdbPending.destination){
  state.navdbActive=structuredClone(state.navdbPending);
  delete state.navdbPending;
  state.navdbStage='COMMITTED_REFERENCE_ONLY';
  const fixes=state.navdbActive.legs.filter(x=>x.to!==state.active.DEST).slice(0,4);
  for(let i=0;i<4;i++)state.active['WPT'+(i+1)]=fixes[i]?.to||'';
 }
}
function line(top,l,r){
 const row=document.createElement('div');row.className='fmc-line fmc-pairline';row.style.top=top+'%';
 const left=document.createElement('span');left.className='fmc-left';left.textContent=l;
 const right=document.createElement('span');right.className='fmc-right';right.textContent=r;
 row.append(left,right);return row;
}
function paint(box){
 if(state.page!=='LEGS' || !(state.navdbActive||state.navdbPending))return;
 const active=state.navdbActive||state.navdbPending,committed=!!state.navdbActive;
 const n=Math.max(1,Math.ceil(active.legs.length/6));
 state.navdbLegPage=Math.max(1,Math.min(n,state.navdbLegPage||1));
 box.replaceChildren();
 box.append(line(3.5,(committed?'ACT ':'MOD ')+'LEGS REF',''+state.navdbLegPage+'/'+n));
 const offset=(state.navdbLegPage-1)*6;
 for(let i=0;i<6;i++){
  const leg=active.legs[offset+i],y=11.2+i*12.8;
  if(!leg)continue;
  box.append(line(y,leg.via==='DCT'?'DIRECT':'VIA '+leg.via, 'TRUE '+(leg.trueInitialTrackDeg??'---')));
  box.append(line(y+5.5,String(leg.to).slice(0,11),String(leg.distanceNm.toFixed(1)+'NM').slice(0,11)));
 }
 box.append(line(92,'REF ONLY','NO LNAV'));
}
function afterPage(key){
 const k=key.replace(/^CDU_CAPT_/,'');
 if(state.page==='LEGS'&&(state.navdbActive||state.navdbPending)&&(k==='NEXT_PAGE'||k==='PREV_PAGE')){
  const n=Math.max(1,Math.ceil((state.navdbActive||state.navdbPending).legs.length/6));
  state.navdbLegPage=Math.max(1,Math.min(n,(state.navdbLegPage||1)+(k==='NEXT_PAGE'?1:-1)));
  if(state.message==='END OF PAGES')state.message='';
 }
}
function snapshot(){return {stage:state.navdbStage||'NONE',pending:state.navdbPending?.legs.length||0,committed:state.navdbActive?.legs.length||0,page:state.page,origin:state.active.ORIGIN,dest:state.active.DEST,guidance:false}}
window.CDU_NAV_API=Object.freeze({stage,afterKey,afterPage,paint,snapshot});
})();