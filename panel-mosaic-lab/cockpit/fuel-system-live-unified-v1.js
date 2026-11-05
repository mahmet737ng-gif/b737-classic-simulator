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
  text('p','سوخت واقعی مدل ECU / شش پمپ و منیفولد مشترک. برای تست سوخت و خرابی از کنترل‌های مربی استفاده کن؛ سوییچ‌ها روی Overhead باقی می‌مانند.',panel);
  liveRows=text('div',undefined,panel);liveRows.dir='ltr';
  liveRows.style.cssText='font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#0f1b22;color:#d9e5ec;padding:10px;border-radius:6px';
  controls=text('details',undefined,panel);text('summary','Instructor · Load fuel / inject fuel faults',controls);
  const tanks=text('div',undefined,controls);
  for(const id of ['main1','center','main2']){
   const line=text('label',undefined,tanks);line.style.cssText='display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:7px 0';
   text('span',label[id]+' kg',line);
   const inp=text('input',undefined,line);inp.type='number';inp.min='0';inp.max=String(({main1:4555,center:7029,main2:4555})[id]);inp.step='1';inp.dataset.tank=id;inp.style.cssText='width:100px';
   const button=text('button','SET',line);button.type='button';button.onclick=()=>command({type:'SERVICE_TANK',tank:id,quantityKg:Number(inp.value)});
  }
  const tempLine=text('label',undefined,controls);tempLine.style.cssText='display:block;margin:10px 0';
  text('span','Fuel Temperature °C ',tempLine);
  const t=text('input',undefined,tempLine);t.type='number';t.min='-56';t.max='56';t.step='1';t.value='10';t.style.width='70px';
  const b=text('button','SET TEMP',tempLine);b.type='button';b.onclick=()=>command({type:'FUEL_TEMPERATURE',celsius:Number(t.value)});
  const x=text('label',undefined,controls);x.style.cssText='display:block;margin:8px 0';
  const chk=text('input',undefined,x);chk.type='checkbox';
  text('span',' Simulate CROSSFEED VALVE stuck',x);
  chk.onchange=()=>command({type:'CROSSFEED_FAILURE',active:chk.checked});
  const faults=text('div',undefined,controls);
  for(const [id,name] of Object.entries(pumpLabel)){
   const l=text('label',undefined,faults);l.style.cssText='display:inline-flex;gap:5px;align-items:center;margin:5px 9px 5px 0';
   const inp=text('input',undefined,l);inp.type='checkbox';
   text('span',name+' FAIL',l);
   inp.onchange=()=>command({type:'PUMP_FAILURE',id,active:inp.checked});
  }
  status=text('p','Ready · FCOM 12.10 / 12.20 · Training values',panel);status.setAttribute('role','status');
  refresh();return true;
 }
 function refresh(){
  if(!panel||!owner()?.getFuelSystem)return;
  const s=owner().getFuelSystem();if(!s)return;
  const key=JSON.stringify([s.tanksKg,s.pumps,s.valves,s.scavenge,s.caution,s.fuelTemperatureC]);
  if(key===last)return;last=key;
  const q=Object.entries(s.tanksKg).map(([id,kg])=>label[id]+': '+kg.toFixed(1)+' / '+s.capacitiesKg[id]+' kg');
  const ps=Object.entries(s.pumps).map(([id,p])=>pumpLabel[id]+': '+(p.commandedOn?'ON':'OFF')+' · '+(p.operating===null?'POWER ?':p.operating?'PRESSURE OK':'LOW PRESSURE')+(p.autoStopped?' · AUTO STOP':''));
  liveRows.textContent=q.join(' | ')+'\nTOTAL '+s.totalFuelKg.toFixed(1)+' kg · T '+s.fuelTemperatureC+' °C'+
   '\nCROSSFEED selector '+s.valves.crossfeed.command+' / valve '+s.valves.crossfeed.position+' · '+s.valves.crossfeed.lamp+
   '\nSCAVENGE '+(s.scavenge.active?'WINDOW OPEN':'OFF')+' · '+s.scavenge.flowKgHr+' kg/h · '+Math.ceil(s.scavenge.remainingMs/60000)+' min left'+
   '\nFUEL CAUTION '+(s.caution.masterCaution?'ON':'OFF')+'\n'+ps.join(' | ');
 }
 root.addEventListener('b737:electrical-owner-ready',()=>{mount();refresh()});
 root.addEventListener('b737:unified-ecu-observation',()=>{if(mount()&&panel)refresh()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
 root.B737UnifiedFuelSystemATA28=Object.freeze({version:'ATA28-FUEL-LIVE-0001',snapshot:()=>owner()?.getFuelSystem?.()??null,refresh});
})(window);
