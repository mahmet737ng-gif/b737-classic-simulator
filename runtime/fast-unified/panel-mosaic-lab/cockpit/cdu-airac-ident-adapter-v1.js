/* Aircraft NAV DATA bank -> IDENT (both seats).
 * Calendar metadata NEVER becomes an active FMC database by itself.
 * FCOM 11.40.9 LSK R2/R3 date copy / transfer + verified ground gate.
 */
(function(root){
 'use strict';
 const seat=new URLSearchParams(root.location.search).get('seat');
 const bank=root.B737FMCAiracBanksV1;
 if(!['CAPT','FO'].includes(seat)||!bank||typeof state==='undefined'||
    typeof update!=='function'||typeof send!=='function')return;
 let lastReport='';
 if(!state.fmcNavDataBanks)state.fmcNavDataBanks=bank.initial();
 function status(){
  try{return bank.status(state.fmcNavDataBanks,new Date().toISOString().slice(0,10));}
  catch(err){return {error:String(err?.message||err)};}
 }
 function sync(){
  try{bank.validate(state.fmcNavDataBanks);}catch{state.fmcNavDataBanks=bank.initial();}
  const next=bank.ident(state.fmcNavDataBanks);
  const src=state.preflightEvidence||{};
  state.preflightEvidence={...src,
   NAV_DATA:next.NAV_DATA,ACTIVE:next.ACTIVE,INACTIVE:next.INACTIVE};
  const report=status();
  const key=JSON.stringify(report);
  if(key!==lastReport){
   lastReport=key;
   if(root.parent!==root)root.parent.postMessage({
    type:'b737:unified-cdu',seat,kind:'airac-banks',...report
   },root.location.origin);
  }
 }
 const previous=update;
 update=function(){sync();return previous();};
 root.updateStage5View=update;
 const originalSend=send;
 send=function(key){
  const row=String(key).replace(/^CDU_CAPT_/,'');
  if(state.page==='IDENT'&&(row==='LSK_R2'||row==='LSK_R3')){
   // The owner's reference shows the start/end of a single display range.
   // These read-only lines must not transfer a different, invisible NAV bank.
   if(root.CDU_PAGES?.IDENT?.variant==='OWNER_CLASSIC_IDENT_20261031')
    return originalSend(key);
   const b=state.fmcNavDataBanks;
   const target=row==='LSK_R2'?b.activeCycle:b.inactiveCycle;
   if(!target){state.message='NAV DATA NOT LOADED';update();return;}
   const range=bank.dateRange(target);
   if(row==='LSK_R3'){state.scratch=range;state.message='';update();return;}
   if(!state.scratch){state.scratch=range;state.message='';update();return;}
   const incoming=Object.keys(b.installed).find(c=>bank.dateRange(c)===state.scratch);
   if(!incoming){state.message='INVALID NAV DATA';update();return;}
   try{
    // Read from verified physical ground source, never infer from local date or
    // airport field. UNKNOWN prevents in-flight database changes.
    const onGround=state.fmcOnGroundVerified===true?true:
      state.fmcOnGroundVerified===false?false:undefined;
    const result=bank.switchFmc(state,incoming,{onGround,
      utcDay:new Date().toISOString().slice(0,10)});
    Object.keys(state).forEach(k=>{if(!Object.hasOwn(result.state,k))delete state[k];});
    Object.assign(state,result.state);
    state.message='';
   }catch(err){state.message=String(err.message||err).slice(0,32);}
   update();return;
  }
  return originalSend(key);
 };
 root.B737CDUAiracIdentAdapterV1=Object.freeze({version:bank.VERSION,status,
  getState:()=>JSON.parse(JSON.stringify(state.fmcNavDataBanks))});
 update();
})(window);
