/* Unified avionics evidence bridge for existing two-CDU trainer.
 * Data flows CDU -> FMC reference -> IRS validity -> MCP/AFDS evidence.
 * No A/T motor control, flight guidance, CB-to-bus fabrication or artwork edits.
 */
(function(){
 'use strict';
 const model=window.B737FmcSystemsV1;
 if(!model)throw Error('B737FmcSystemsV1 failed to load');
 let network=model.createState(),lastRouteSig='',lastMcpEvidence='INITIAL',lastPower='UNKNOWN';
 const seatState=new Map();const now=()=>performance.now();
 const emit=()=>{
  const out={revision:network.revision,power:network.power,
   route:network.route,irs:network.irs,guidance:network.guidance,
   recovery:network.recovery,breakerCandidates:model.BREAKERS};
  window.dispatchEvent(new CustomEvent('b737:fmc-systems-state',{detail:out}));
  let el=document.getElementById('fmcNetworkStatus');
  if(!el){
   const panel=document.querySelector('.cdu-tools');
   if(panel){el=document.createElement('p');el.id='fmcNetworkStatus';el.setAttribute('role','status');el.style.fontSize='12px';panel.append(el);}
  }
  if(el){
   const ready=model.mcpEvidence(network);
   el.textContent='FMC/CDU · electrical feeder: '+(lastPower==='ABSENT'?'GLOBAL POWER LOST':'UNVERIFIED')+
    ' · IRS: '+(network.irs.leftValid===true?'L VALID':'L UNKNOWN')+'/'+(network.irs.rightValid===true?'R VALID':'R UNKNOWN')+
    ' · LNAV/VNAV evidence: '+(ready===true?'VERIFIED':ready===false?'NOT READY':'UNVERIFIED')+
    ' · CB: PHOTO INDEX ONLY';
  }
 };
 const transition=event=>{network=model.apply(network,event);emit();return network};
 function transmitToMCP(){
  const evidence=model.mcpEvidence(network);
  if(evidence===lastMcpEvidence)return;
  lastMcpEvidence=evidence;
  window.B737McpAFDSBridgeV1?.setEvidence?.('fmcRouteReady',evidence);
 }
 function updateIRS(){
  const units=window.B737IRSTrainerUnified?.getState?.()?.units;
  if(!units)return;
  const left=units.L?.positionValid===true?true:units.L?.positionValid===false?false:null;
  const right=units.R?.positionValid===true?true:units.R?.positionValid===false?false:null;
  if(left!==network.irs.leftValid||right!==network.irs.rightValid){
   transition({type:'IRS',leftValid:left,rightValid:right});transmitToMCP();
  }
 }
 function receive(e){
  if(e.origin!==location.origin||e.data?.type!=='b737:fmc-cdu-snapshot')return;
  const d=e.data,frame=document.getElementById('cduFrame'+d.seat);
  if(!['CAPT','FO'].includes(d.seat)||!frame||e.source!==frame.contentWindow)return;
  seatState.set(d.seat,d);
  const a=d.active||{},origin=String(a.ORIGIN||''),dest=String(a.DEST||'');
  const activated=/^[A-Z]{4}$/.test(origin)&&/^[A-Z]{4}$/.test(dest)&&origin!==dest&&!d.routeTransactionPending;
  const next={origin,dest,active:activated,legsVerified:false,discontinuitiesUnknown:true};
  const signature=JSON.stringify(next);
  if(signature!==lastRouteSig){
   lastRouteSig=signature;transition({type:'ROUTE',route:next});transmitToMCP();
  }
  updateIRS();
 }
 function refreshGlobalElectrical(){
  const snap=window.B737ISNCockpitV1?.getState?.()?.state?.electrical;
  if(snap?.schema!=='B737_ELECTRICAL_V7_RESULT')return;
  const evaluated=model.globalPower(snap);
  if(evaluated===lastPower)return;
  lastPower=evaluated;
  // Global loss is proven only when every bus in Electrical V7 is false.
  // Restoring upstream power does NOT certify individual equipment feeds.
  for(const unit of model.UNIT_IDS){
   const target=evaluated==='ABSENT'?'ABSENT':'UNKNOWN';
   if(network.power[unit].feed!==target)
    transition({type:'FEED',unit,evidence:target,nowMs:now(),
     provenance:target==='ABSENT'?'ALL_POWER_BUSES_PROVEN_ABSENT':'DIRECT_VERIFIED_EQUIPMENT_FEED'});
  }
  transmitToMCP();
 }
 function setVerifiedFeed(unit,evidence){
  if(!model.UNIT_IDS.includes(unit)||!['PRESENT','ABSENT','UNKNOWN'].includes(evidence))throw Error('DIRECT_FEED_EVIDENCE_INVALID');
  transition({type:'FEED',unit,evidence,nowMs:now(),provenance:'DIRECT_VERIFIED_EQUIPMENT_FEED'});
  transmitToMCP();
 }
 window.addEventListener('message',receive);
 window.addEventListener('b737:cockpit-mounted',()=>{emit();refreshGlobalElectrical()});
 window.addEventListener('b737:isn-start-indications',refreshGlobalElectrical);
 window.addEventListener('b737:mcp-afds-state',()=>{}); // output observed; not back-fed as an electrical source
 window.addEventListener('b737:irs-trainer-state',updateIRS);
 document.addEventListener('DOMContentLoaded',()=>{emit();refreshGlobalElectrical();updateIRS()});
 if(document.readyState!=='loading'){emit();refreshGlobalElectrical();updateIRS();}
 window.B737FmcSystemsBridgeV1=Object.freeze({
  getState:()=>JSON.parse(JSON.stringify(network)),
  getCBPhotoCandidates:()=>model.BREAKERS.map(x=>({...x})),
  refresh:()=>{refreshGlobalElectrical();updateIRS();return network},
  setVerifiedFeed,confirmRouteLegs(verified,discontinuitiesUnknown){
   if(typeof verified!=='boolean'||typeof discontinuitiesUnknown!=='boolean')throw Error('ROUTE_LEG_AUDIT_REQUIRED');
   const r={...network.route,legsVerified:verified,discontinuitiesUnknown};
   transition({type:'ROUTE',route:r});transmitToMCP();
  },
  setPhase:phase=>transition({type:'PHASE',phase}),
  setFailure:failed=>transition({type:'FMC_FAILURE',failed:!!failed}),
  acknowledgeRecovery:()=>transition({type:'ACK_RECOVERY'})
 });
})();
