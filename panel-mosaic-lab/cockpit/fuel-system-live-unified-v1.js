/* B737 Classic ATA28: live readout of the ONE Unified/ISN ECU fuel system.
 * Controls are instructor-only ground fuel servicing/failure injection;
 * existing OH09 physical switches remain sole pilot command inputs.
 */
(function(root){'use strict';
 const ID='unifiedFuelSystemLiveATA28';let panel=null,status=null,liveRows=null,controls=null,last='';
 const label={main1:'MAIN 1',center:'CENTER',main2:'MAIN 2'};
 const pumpLabel={'fuel.main1FwdPump':'M1 FWD','fuel.main1AftPump':'M1 AFT',
  'fuel.main2FwdPump':'M2 FWD','fuel.main2AftPump':'M2 AFT',
  'fuel.centerLeftPump':'CTR L','fuel.centerRightPump':'CTR R'};
 const text=(tag,value,parent)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;parent?.append(el);return el;};
 const owner=()=>root.B737ISNCockpitV1;
 function command(args){
  try{const result=owner()?.fuelTrainerAction?.({instructor:true,...args});
   if(!result)throw Error('ECU fuel backend is not connected');
   status.textContent='ATA28 command accepted';refresh();return result;
  }catch(err){status.textContent=err.message||String(err);return null;}
 }
 function mount(){
  if(panel)return true;
  const parent=document.getElementById('isnBridgePanel');
  if(!parent||!owner()?.getFuelSystem)return false;
  panel=text('section',undefined,parent);panel.id=ID;panel.style.cssText='border:1px solid #45606b;border-radius:10px;padding:12px;margin:12px 0;line-height:1.7';
  text('h2','FUEL SYSTEM · ATA 28 · LIVE',panel);
  text('p','ECU fuel model with six pumps and a common manifold. Use FAILURES > FUEL to inject faults; overhead switches remain the pilot commands.',panel);
  liveRows=text('div',undefined,panel);liveRows.dir='ltr';
  liveRows.style.cssText='font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#0f1b22;color:#d9e5ec;padding:10px;border-radius:6px';
  controls=text('details',undefined,panel);text('summary','GROUND FUEL SERVICING · ON GROUND ONLY',controls);
  text('p','Fuel failure injection has moved to FAILURES > FUEL in the cockpit top bar.',controls);
  const tanks=text('div',undefined,controls);
  for(const id of ['main1','center','main2']){
   const line=text('label',undefined,tanks);
   line.style.cssText='display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:7px 0';
   text('span',label[id]+' kg',line);
   const inp=text('input',undefined,line);inp.type='number';inp.min='0';
   inp.max=String(({main1:4555,center:7029,main2:4555})[id]);inp.step='1';
   inp.dataset.tank=id;inp.style.cssText='width:100px';
   const button=text('button','SET QUANTITY',line);button.type='button';
   button.onclick=()=>command({type:'SERVICE_TANK',tank:id,quantityKg:Number(inp.value)});
  }
  status=text('p','Ready · FCOM 12.10 / 12.20 · Training values',panel);status.setAttribute('role','status');
  refresh();return true;
 }
 function refresh(){
  if(!panel||!owner()?.getFuelSystem)return;
  const s=owner().getFuelSystem();if(!s)return;
  const key=JSON.stringify([s.tanksKg,s.pumps,s.valves,s.scavenge,s.caution,s.indications,s.leaks]);
  if(key===last)return;last=key;
  const q=Object.entries(s.tanksKg).map(([id,kg])=>label[id]+': '+kg.toFixed(1)+' / '+s.capacitiesKg[id]+' kg');
  const ps=Object.entries(s.pumps).map(([id,p])=>pumpLabel[id]+': '+(p.commandedOn?'ON':'OFF')+' · '+(p.operating===null?'POWER ?':p.operating?'PRESSURE OK':'LOW PRESSURE')+(p.autoStopped?' · AUTO STOP':''));
  liveRows.textContent=q.join(' | ')+'\nTOTAL '+s.totalFuelKg.toFixed(1)+' kg · T '+s.fuelTemperatureC+' °C'+
   '\nMAIN 2 − MAIN 1 '+s.indications.imbalanceKg.toFixed(1)+' kg'+
   (s.indications.imbalanceLimitExceeded?' · LIMIT EXCEEDED':'')+
   '\nTEMPERATURE '+s.indications.temperature.status+' · MIN '+s.indications.temperature.minimumC+' °C'+
   '\nLEAK LOSS '+Object.entries(s.leaks.lostKg).map(([id,kg])=>label[id]+' '+kg.toFixed(1)+' kg').join(' | ')+
   '\nCROSSFEED selector '+s.valves.crossfeed.command+' / valve '+s.valves.crossfeed.position+' · '+s.valves.crossfeed.lamp+
   '\nSCAVENGE '+(s.scavenge.active?'WINDOW OPEN':'OFF')+' · '+s.scavenge.flowKgHr+' kg/h · '+Math.ceil(s.scavenge.remainingMs/60000)+' min left'+
   '\nFUEL CAUTION '+(s.caution.masterCaution?'ON':'OFF')+'\n'+ps.join(' | ');
 }
 root.addEventListener('b737:electrical-owner-ready',()=>{mount();refresh()});
 // ATA28 instructor telemetry is not an aircraft output. Never serialize
 // the full fuel snapshot at 10 Hz while the instructor drawer is hidden.
 // The ECU fuel plant, physical OH09 switches, cautions and fuel needles
 // still update independently through their existing live paths.
 root.addEventListener('b737:unified-ecu-observation',()=>{
  if(!document.body.classList.contains('side-open'))return;
  const profiler=root.B737InteractionProfilerV1,started=profiler?performance.now():0;
  try{if(mount()&&panel)refresh();}
  finally{if(profiler)profiler.markWork('ECU listener ATA28 instructor',performance.now()-started);}
 });
 document.getElementById('inspectorToggle')?.addEventListener('click',()=>{
  setTimeout(()=>{if(document.body.classList.contains('side-open')){mount();refresh();}},0);
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
 root.B737UnifiedFuelSystemATA28=Object.freeze({version:'ATA28-FUEL-LIVE-0001',snapshot:()=>owner()?.getFuelSystem?.()??null,refresh});
})(window);
