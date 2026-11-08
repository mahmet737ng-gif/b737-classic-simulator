/* EADI-FMA-FCOM-0002 — source-grounded Classic FMA upper annunciator.
 * Replaces the old 'fma' paint callback without changing EADI glass, its
 * frozen EIS geometry, the ADI 0.85 scale, or existing MCP controls.
 * FCOM D6-27370-300/400/500-SHI 4.10.27 / 4.20.4–4.20.11;
 * Lufthansa LAN ATA22-10/22-12; MRG for AFDS training context.
 * Four zones A/T | PITCH | ROLL | AFDS, THREE white separators only.
 * Green engaged, white armed/ARM, yellow CWS and 1 CH.
 * The FCOM 10-second temporary mode-change border is NOT a permanent cell.
 * All FCC captures require explicit validated simulated flight evidence.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.B737EADIFMAFcomV2=api;api.bind(root);}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const VERSION='EADI-FMA-FCOM-0003-MCP-LIVE';
 const Core=typeof globalThis==='object'?globalThis.B737FmaModeEngineV1:null;
 const FIELDS=Object.freeze(['at','pitch','roll','afds']);
 const SECTION=Object.freeze(['A/T MODE','PITCH MODE','ROLL MODE','AFDS MODE']);
 const LAYOUT=Object.freeze({x:4,y:4,w:892,h:98,segment:223});
 const COLOR=Object.freeze({green:'#21c663',white:'#f2f2f2',yellow:'#e3c23a',black:'#000000'});
 const seats={CAPT:null,FO:null},primed={CAPT:false,FO:false},highlights={CAPT:{},FO:{}},fcc={CAPT:null,FO:null};
 const scheduled={CAPT:null,FO:null};
 let win=null,ready=false,unsubscribe=[];
 let lastMcpPower=null,lastPhysicalSource='NO_HARDWARE_SNAPSHOT',lastTrigger='INIT',lastBridgeRevision=null;
 function model(){return win?.B737FmaModeEngineV1||Core;}
 function validate(seat){if(!['CAPT','FO'].includes(seat))throw Error('FMA seat CAPT or FO required');}
 function getState(seat){validate(seat);return JSON.parse(JSON.stringify({version:VERSION,seat,
  fields:seats[seat]||model()?.blank?.(),fccObserved:!!fcc[seat]}));}
 function repaint(seat){
  const eadi=win?.B737UnifiedEADIStage1;
  const state=eadi?.snapshot?.()?.stations?.[seat];
  if(state)eadi.setAttitude(seat,state.pitch,state.bank);
 }
 function armTimer(seat,now){
  if(scheduled[seat]!==null){
   win?.clearTimeout?.(scheduled[seat]);scheduled[seat]=null;
  }
  if(!win?.setTimeout)return;
  const future=Object.values(highlights[seat]).filter(n=>n>now);
  if(!future.length)return;
  const next=Math.min(...future);
  scheduled[seat]=win.setTimeout(()=>{
   scheduled[seat]=null;
   repaint(seat);
   armTimer(seat,Date.now());
  },Math.max(1,next-now));
 }
 function accept(seat,fields,now=Date.now()){
  validate(seat);
  if(!fields)return false;
  const engine=model();
  if(!engine)throw Error('AFDS FMA model missing');
  const incoming=engine.normalized(fields);
  const firstPaint=!primed[seat];
  const prior=seats[seat]||engine.blank();
  const signature=entry=>JSON.stringify([entry.active,entry.armed,entry.origin]);
  if(FIELDS.every(k=>signature(prior[k])===signature(incoming[k])))return false;
  for(const key of FIELDS){
   if(!firstPaint&&prior[key].active!==incoming[key].active){
    // FCOM 4.10.27: 10s highlight only after an actually changed mode.
    highlights[seat][key]=incoming[key].active&&incoming[key].active!=='ARM'?now+10000:0;
   }
  }
  seats[seat]=incoming;primed[seat]=true;
  repaint(seat);armTimer(seat,now);
  return true;
 }
 // The hardware layer contains the actual A/T ARM and left/right F/D
 // switch positions, while MCP/AFDS owns the simulated powered mode state.
 // FMA must read BOTH; neither a switch click nor the illuminated test button
 // can create unverified autopilot, thrust servo, or electrical power.
 function hardwareReconciled(out){
  if(out?.schema!=='B737_MCP_AFDS_OUTPUT_V1')return out;
  const controls=out.controls||{},fd=controls.fd||{};
  const physical=win?.B737McpHardwareV1?.getState?.();
  if(!physical){lastPhysicalSource='AFDS_OUTPUT_ONLY';return out;}
  const values={AT_ARM:physical.AT_ARM,FD_LEFT:physical.FD_LEFT,FD_RIGHT:physical.FD_RIGHT};
  const valid=(id)=>id==='AT_ARM'?['OFF','ARM'].includes(values[id]):
   ['OFF','ON'].includes(values[id]);
  if(!['AT_ARM','FD_LEFT','FD_RIGHT'].every(valid)){
   lastPhysicalSource='INVALID_HARDWARE_SNAPSHOT';
   return out;
  }
  const physicalAt=values.AT_ARM==='ARM';
  const physicalFd={left:values.FD_LEFT==='ON',right:values.FD_RIGHT==='ON'};
  const changed=physicalAt!==controls.atArm||physicalFd.left!==fd.left||physicalFd.right!==fd.right;
  lastPhysicalSource=changed?'VERIFIED_PHYSICAL_SWITCH_OVERRIDE':'PHYSICAL_AFDS_MATCH';
  const bothOff=!physicalFd.left&&!physicalFd.right;
  // Never mutate the AFDS bridge's published output. All per-event
  // reconciliations are read-only snapshots of its existing mode authority.
  const modes={...out.modes};
  if(bothOff){modes.lateral=null;modes.vertical=null;modes.autopilot=null;}
  // Do not allow stale thrust modes after A/T is physically OFF.
  if(!physicalAt)modes.thrust=null;
  return {...out,
   controls:{...controls,atArm:physicalAt,fd:physicalFd},
   modes};
 }
 function projectMcp(out,trigger='AFDS_OUTPUT'){
  const engine=model();
  if(!engine||out?.schema!=='B737_MCP_AFDS_OUTPUT_V1')return false;
  const matched=hardwareReconciled(out);
  lastMcpPower=matched.power;
  lastTrigger=trigger;
  lastBridgeRevision=matched.electricalRevision??null;
  const now=Date.now();
  let changed=false;
  for(const seat of ['CAPT','FO']){
   try{
    const result=engine.project(matched,seat,fcc[seat]);
    if(result)changed=accept(seat,result,now)||changed;
   }catch(error){
    // Discard stale FCC captures when electrical/mode input conflicts.
    fcc[seat]=null;
    const conservative=engine.fromMcp(matched,seat);
    if(conservative)changed=accept(seat,conservative,now)||changed;
    win?.console?.warn?.('FMA rejected FCC observation',error.message);
   }
  }
  return changed;
 }
 function refreshFromMcp(trigger='MCP_REFRESH'){
  const out=win?.B737McpAFDSBridgeV1?.getOutput?.();
  if(!out)return false;
  return projectMcp(out,trigger);
 }
 function inspectLink(){
  const output=win?.B737McpAFDSBridgeV1?.getOutput?.()||null;
  return Object.freeze({
   version:VERSION,ready,mcpPowered:lastMcpPower,
   mcpPowerEvidence:output?.powerEvidence??null,
   electricalRevision:lastBridgeRevision,
   physical:win?.B737McpHardwareV1?.getState?.()||null,
   physicalSource:lastPhysicalSource,lastTrigger,
   seats:{CAPT:getState('CAPT').fields,FO:getState('FO').fields}
  });
 }
 function observeFcc(evidence){
  if(!evidence||evidence.schema!=='B737_FMA_FCC_OBSERVATION_V1'||
   evidence.confirmed!==true||!['CAPT','FO'].includes(evidence.seat))
   return false;
  const e=win?.B737McpAFDSBridgeV1?.getOutput?.();
  if(!e||e.power!==true)return false;
  try{
   const projected=model().project(e,evidence.seat,evidence);
   if(!projected)return false;
   fcc[evidence.seat]=evidence;accept(evidence.seat,projected);
   return true;
  }catch(error){
   win?.console?.warn?.('Unverified FMA capture ignored',error.message);
   return false;
  }
 }
 function render(ctx,seat,now=Date.now()){
  validate(seat);
  const states=seats[seat]||model()?.blank?.();
  if(!states)return;
  const {x,y,w,h,segment}=LAYOUT;
  ctx.save();
  ctx.fillStyle=COLOR.black;
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=COLOR.white;
  ctx.lineWidth=3;
  // Exactly three continuous WHITE dividers. No permanent box outline.
  for(let i=1;i<4;i++){
   const boundary=x+i*segment;
   ctx.beginPath();ctx.moveTo(boundary,y+1);ctx.lineTo(boundary,y+h-1);ctx.stroke();
  }
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<4;i++){
   const field=FIELDS[i],val=states[field],cx=x+segment*(i+.5);
   if(val?.active){
    const color=model().color(field,val.active);
    ctx.fillStyle=COLOR[color]||COLOR.green;
    ctx.font="700 43px 'Arial Narrow','Liberation Sans Narrow',Arial,sans-serif";
    ctx.fillText(val.active,cx,y+39,segment-13);
    if(highlights[seat][field]>now){
     // Transient rectangle around a CHANGE only, mandated by FCOM;
     // NEVER a border framing any section during normal operation.
     ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1.5;
     ctx.strokeRect(cx-segment/2+8,y+15,segment-16,46);
    }
   }
   if(val?.armed){
    ctx.font="700 22px 'Arial Narrow',Arial,sans-serif";
    ctx.fillStyle=COLOR.white;
    ctx.fillText(val.armed,cx,y+79,segment-15);
   }
  }
  ctx.restore();
 }
 function bind(root){
  if(ready)return true;
  const eadi=root.B737UnifiedEADIStage1;
  const engine=root.B737FmaModeEngineV1;
  if(!eadi?.registerLayer||!engine?.project)return false;
  ready=true;win=root;
  for(const seat of ['CAPT','FO']){
   seats[seat]=engine.blank();
   // The EADI supports one registered fma slot. Replaces its earlier
   // boxed implementation with the FCOM presentation, no second overlay.
   unsubscribe.push(eadi.registerLayer(seat,'fma',(canvas)=>render(canvas,seat)));
  }
  root.addEventListener('b737:mcp-afds-state',event=>projectMcp(event.detail,'AFDS_EVENT'));
  // MCP AFDS bridge handles the hardware/button command before this
  // fallback listener (scripts are loaded in document order). Read its
  // resolved output immediately afterward. No timers or constant polling.
  for(const event of ['b737:mcp-hardware-change','b737:mcp-button-request',
   'b737:mcp-value-change','b737:mcp-bank-limit-preview'])
   root.addEventListener(event,()=>refreshFromMcp(event));
  // The scene can be remounted or changed between EIS/Conventional without
  // any MCP movement. The same source snapshot rehydrates both EADI FMAs.
  for(const event of ['b737:cockpit-mounted','b737:engine-indication-view',
   'b737:electrical-owner-ready','b737:cb-state-change',
   'b737:electrical-distribution-changed','b737:bus-failure-injection-changed'])
   root.addEventListener(event,()=>refreshFromMcp(event));
  root.addEventListener('b737:fma-fcc-observation',event=>observeFcc(event.detail));
  const current=root.B737McpAFDSBridgeV1?.getOutput?.();
  if(current)projectMcp(current,'INITIAL_BRIDGE_SNAPSHOT');
  return true;
 }
 return Object.freeze({VERSION,FIELDS,SECTION,LAYOUT,COLOR,
  accept,projectMcp,refreshFromMcp,hardwareReconciled,inspectLink,observeFcc,render,getState,bind});
});
