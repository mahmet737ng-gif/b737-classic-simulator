'use strict';
// A presentation mode over the authenticated, running Unified cockpit.
// No duplicated CDU, EHSI, EFIS, FMC, flight or navigation implementations.
const labPath='/panel-mosaic-lab/unified/cdu-lab.html';
const legacy=/^\/cdu-standalone(?:-v[356])?\/(?:index\.html)?$/;
function volatileStorage(isLab){
 let active=isLab;
 try{active=active||parent!==window&&parent.__UnifiedCduLab===true;}catch{}
 if(!active)return;
 window.__UnifiedCduLab=true;
 function make(){
  const items=new Map();
  return new Proxy({get length(){return items.size;},key:i=>[...items.keys()][i]??null,
   getItem:k=>items.has(String(k))?items.get(String(k)):null,
   setItem:(k,v)=>items.set(String(k),String(v)),removeItem:k=>items.delete(String(k)),clear:()=>items.clear()},
   {get:(o,k)=>Reflect.has(o,k)?Reflect.get(o,k):items.get(String(k)),
    set:(o,k,v)=>{items.set(String(k),String(v));return true;},
    deleteProperty:(o,k)=>{items.delete(String(k));return true;}});
 }
 for(const k of ['localStorage','sessionStorage']){
  const store=parent!==window&&parent.__UnifiedCduLab?parent[k]:make();
  Object.defineProperty(window,k,{configurable:true,get:()=>store});
 }
}
function view(){
 const doc=document,root=doc.documentElement;
 root.dataset.cduLab='true';
 function start(){
  const bar=doc.createElement('div');bar.id='unifiedCduLabControls';bar.dataset.cduLabItem='controls';
  const status=doc.createElement('output');status.textContent='Loading current Unified cockpit…';
  const take=doc.createElement('button'),des=doc.createElement('button');
  take.type=des.type='button';take.textContent='START TAKEOFF';des.textContent='START DESCENT';
  take.disabled=des.disabled=true;take.hidden=des.hidden=true;
  const resume=doc.createElement('button');resume.type='button';resume.textContent='START FLIGHT';resume.hidden=true;resume.disabled=true;
  const hud=doc.createElement('section');hud.id='unifiedCduRunHud';hud.hidden=true;hud.setAttribute('aria-label','Live flight telemetry');
  const metrics=doc.createElement('div');metrics.className='lab-run-metrics';
  const fields={};function metric(key,label){const cell=doc.createElement('div'),title=doc.createElement('small'),value=doc.createElement('strong');title.textContent=label;value.textContent='—';cell.append(title,value);metrics.append(cell);fields[key]=value;}
  for(const [key,label] of [['alt','ALT MSL'],['ra','RAD ALT'],['ias','IAS'],['gs','GS'],['vs','V/S'],['time','SIM TIME'],['phase','PHASE']])metric(key,label);
  const fma=doc.createElement('div');fma.className='lab-run-fma';fma.setAttribute('aria-label','Live FMA');
  const fmaFields={};for(const [key,label] of [['at','A/T'],['pitch','PITCH'],['roll','ROLL'],['afds','AFDS']]){
   const cell=doc.createElement('div'),title=doc.createElement('small'),value=doc.createElement('strong'),armed=doc.createElement('span');title.textContent=label;value.textContent='—';cell.append(title,value,armed);fma.append(cell);fmaFields[key]={value,armed};
  }
  hud.append(metrics,fma);
  const runControls=doc.createElement('div');runControls.id='unifiedCduRunControls';runControls.hidden=true;
  const rate=doc.createElement('select');rate.setAttribute('aria-label','Simulation speed');
  for(const n of [1,10,20,60])rate.add(new Option(n+'×',String(n)));rate.value='20';
  const run=doc.createElement('button'),pauseRun=doc.createElement('button'),runState=doc.createElement('span');
  run.type=pauseRun.type='button';run.textContent='RUN';pauseRun.textContent='PAUSE';run.disabled=pauseRun.disabled=true;runState.setAttribute('role','status');
  runControls.append(rate,run,pauseRun,runState);
  const actions=doc.createElement('div');actions.className='lab-run-actions';actions.append(status,take,des,resume,runControls);
  bar.append(hud,actions);doc.body.append(bar);
  function paintRun(api,state,prepared){
   const d=api.getDiagnostics(),clock=api.getLabRunClock?.();
   hud.hidden=false;runControls.hidden=!clock;
   const fmt=(n,unit)=>Number.isFinite(n)?Math.round(n).toLocaleString('en-US')+' '+unit:'—';
   fields.alt.textContent=fmt(state.altitudeFt,'FT');fields.ra.textContent=fmt(state.radioAltitudeFt,'FT');
   fields.ias.textContent=fmt(state.iasKt,'KT');fields.gs.textContent=fmt(state.gsKt,'KT');fields.vs.textContent=fmt(state.vsFpm,'FPM');
   const sec=Math.max(0,Math.floor(state.elapsedSec||0));fields.time.textContent=[Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':');
   fields.phase.textContent=String(state.phase||'—').replaceAll('_',' ');
   const f=window.B737EADIFMAFcomV2?.getState?.(seat||'CAPT')?.fields;
   for(const [k,cell] of Object.entries(fmaFields)){cell.value.textContent=f?String(f[k]?.active||''):'—';cell.armed.textContent=f?String(f[k]?.armed||''):'';}
   const canStart=prepared&&!loadPending&&!!clock&&(state.phase!=='GROUND_READY'||!take.disabled);
   run.disabled=!canStart;pauseRun.disabled=!prepared||loadPending||d.paused;
   run.textContent=d.paused&&clock?.enabled?'RESUME':'RUN';
   runState.textContent=d.paused?'PAUSED':clock?.enabled?'RUNNING '+clock.effective+'× / '+clock.requested+'×':'NORMAL 1×';
   if(clock?.enabled)resume.hidden=true;
  }
  run.onclick=()=>{try{
   const api=get(),state=api?.getState?.();if(!state||run.disabled)throw Error('AIRCRAFT NOT READY');
   api.setLabRunRate(Number(rate.value));
   if(state.phase==='GROUND_READY'){const button=doc.getElementById('flightTakeoff');if(!button||button.disabled)throw Error('TAKEOFF NOT AVAILABLE');api.pause(false);button.click();}
   else if(api.getDiagnostics()?.paused&&!api.togglePause())throw Error('FLIGHT START INHIBITED');
   status.hidden=true;runState.textContent='RUNNING';
  }catch(e){try{get()?.setLabRunRate?.(1);}catch{}failure(e);}};
  pauseRun.onclick=()=>{try{const api=get();if(!api?.getDiagnostics()?.paused)api.togglePause();}catch(e){failure(e);}};
  rate.onchange=()=>{try{const api=get();if(api?.getLabRunClock?.()?.enabled)api.setLabRunRate(Number(rate.value));}catch(e){failure(e);}};
  const setup=doc.createElement('section');setup.id='unifiedCduLabLocation';setup.dataset.cduLabItem='location';setup.hidden=true;setup.dir='ltr';
  const airportPick=doc.createElement('select'),runwayPick=doc.createElement('select'),positionPick=doc.createElement('select'),load=doc.createElement('button');
  function field(title,select){const label=doc.createElement('label'),text=doc.createElement('span');text.textContent=title;label.append(text,select);select.setAttribute('aria-label',title);setup.append(label);}
  field('AIRPORT',airportPick);field('RUNWAY',runwayPick);field('POSITION',positionPick);
  for(const [value,label] of [['READY_FOR_TAKEOFF','ON RUNWAY'],['FINAL_10','10 NM FINAL'],['CRUISE','CRUISE · FL300']])positionPick.add(new Option(label,value));
  load.type='button';load.textContent='LOAD';setup.append(load);doc.body.append(setup);
  let catalogReady=false,loadPending=false,loadingSince=0;
  const catalog=()=>window.B737FlightScenarioCoreV1?.AIRPORTS;
  function fillRunways(preferred){
   const a=catalog()?.[airportPick.value];if(!a)return false;
   runwayPick.replaceChildren();for(const id of Object.keys(a.runways||{}))runwayPick.add(new Option('RWY '+id,id));
   runwayPick.value=Object.hasOwn(a.runways,preferred)?preferred:a.defaultRunway;
   return !!runwayPick.value;
  }
  airportPick.onchange=()=>fillRunways(runwayPick.value);
  function initCatalog(airport,runway){
   const data=catalog();if(!data||!Object.keys(data).length)return false;
   airportPick.replaceChildren();
   for(const a of Object.values(data))airportPick.add(new Option(a.icao+' · '+a.name,a.icao));
   airportPick.value=Object.hasOwn(data,airport)?airport:Object.keys(data)[0];
   catalogReady=fillRunways(runway);return catalogReady;
  }
  function selectionConfig(){
   const airport=airportPick.value,runway=runwayPick.value,kind=positionPick.value,a=catalog()?.[airport];
   if(!a||!Object.hasOwn(a.runways,runway))throw Error('SELECT VALID AIRPORT AND RUNWAY');
   if(kind==='CRUISE')return {airport,runway,preset:'MANUAL',airborne:true,holdStart:true,altitudeFt:30000,headingDeg:a.runways[runway],speedKt:279,vsFpm:0};
   if(!['READY_FOR_TAKEOFF','FINAL_10'].includes(kind))throw Error('SELECT VALID POSITION');
   return {airport,runway,preset:kind,airborne:kind==='FINAL_10',holdStart:true};
  }
  load.onclick=()=>{try{
   const api=get(),config=selectionConfig(),irs=window.B737IRSTrainerUnified;
   if(!api?.loadScenario||!api.prepareScenario||!irs?.setMode)throw Error('UNIFIED OWNERS NOT READY');
   if(config.preset==='MANUAL'&&!window.B737PoweredGeneralPresetsV1?.applyCruise)throw Error('CRUISE OWNER NOT READY');
   if(config.preset==='FINAL_10'&&!window.B737Final10ApproachPresetV1?.apply)throw Error('FINAL 10 OWNER NOT READY');
   api.prepareScenario(config); // validate before changing the current aircraft
   // A deliberate instructor relocation must not reuse IRS coordinates from
   // the previous airport. The existing scenario preset aligns the real IRUs.
   for(const side of ['L','R'])if(irs.getState().units[side].mode!=='OFF')irs.setMode(side,'OFF');
   const state=api.loadScenario(config);
   if(config.preset==='MANUAL')window.B737PoweredGeneralPresetsV1.applyCruise(state);
   loadPending=true;loadingSince=Date.now();load.disabled=true;take.disabled=des.disabled=resume.disabled=true;
   status.hidden=false;status.textContent='Preparing '+config.airport+' RWY '+config.runway+'…';
  }catch(e){loadPending=false;load.disabled=false;failure(e);}};
  resume.onclick=()=>{try{const api=get();if(!api?.getState()?.airborne||loadPending)throw Error('AIRCRAFT NOT READY');api.togglePause();}catch(e){failure(e);}};
  let requested=false,last=[],seat=null;const geometry=new WeakMap();
  const startedAt=Date.now();
  function waiting(message){status.hidden=false;status.textContent=message+(Date.now()-startedAt>45000?' · RELOAD IF NOT READY':'');}
  const get=()=>window.B737UnifiedFlightScenarioV1;
  function failure(error){status.hidden=false;status.textContent=String(error?.message||error);}
  take.onclick=()=>{try{const api=get(),button=doc.getElementById('flightTakeoff');
   if(!api||!button||button.disabled)throw Error('TAKEOFF NOT AVAILABLE');
   api.setLabRunRate?.(1);api.pause(false);button.click();status.hidden=true;
  }catch(e){failure(e);}};
  des.onclick=()=>{try{const api=get();if(api?.getState()?.airborne!==true)throw Error('AIRCRAFT NOT AIRBORNE');
   api.command({type:'VS',value:-1000});api.pause(false);status.hidden=true;
  }catch(e){failure(e);}};
  function clearMarks(){for(const e of doc.querySelectorAll('[data-cdu-lab-branch]'))delete e.dataset.cduLabBranch;
   for(const e of last)delete e.dataset.cduLabItem;}
  function branch(e,name){e.dataset.cduLabItem=name;for(let a=e.parentElement;a;a=a.parentElement)a.dataset.cduLabBranch='true';}
  function tick(){
   try{
    // This route intentionally has no Welcome UI. Start the live scenario
    // through its own public API, not through a hidden Welcome button.
    const api=get(),airport=doc.getElementById('flightAirport')?.value,runway=doc.getElementById('flightRunway')?.value;
    if(!api?.loadScenario||!airport||!runway||!window.B737PoweredGeneralPresetsV1?.apply||!window.B737ISNCockpitV1){
     waiting('Waiting for Unified flight and electrical owners…');return;
    }
    if(!catalogReady&&!initCatalog(airport,runway)){waiting('Waiting for Unified airport catalog…');return;}
    if(!requested&&api.getDiagnostics()?.active!==true){
     requested=true;
     try{api.loadScenario({airport,runway,preset:'READY_FOR_TAKEOFF',airborne:false,holdStart:true});}
     catch(e){requested=false;throw e;}
    }
    if(api.getDiagnostics()?.active!==true){waiting('Waiting for flight scenario…');return;}
    const frames=['CAPT','FO'].map(s=>[s,doc.getElementById('cduFrame'+s)]).filter(x=>x[1]);
    const pair=frames.find(x=>x[1].closest('.cdu-station')?.classList.contains('ready'))||frames.find(x=>x[1].contentDocument?.getElementById('fmc-lines')?.children.length);
    if(!pair){waiting('Waiting for live CDU…');return;}
    const [s,frame]=pair;const cdu=frame.closest('.cdu-station');
    const nd=doc.querySelector('[data-unified-ehsi-seat="'+s+'"]');
    const cp=doc.querySelector('[data-uefis-seat="'+s+'"]');
    if(!cdu||!nd||!cp){waiting('Waiting for '+[!cdu?'CDU':null,!nd?'EHSI':null,!cp?'EFIS CP':null].filter(Boolean).join(' / ')+'…');return;}
    for(const e of [cdu,nd,cp])if(!geometry.has(e)){
     const rect=e.getBoundingClientRect();
     const w=e.offsetWidth||rect.width,h=e.offsetHeight||rect.height;
     if(w>0&&h>0)geometry.set(e,{w,h});
    }
    if(![cdu,nd,cp].every(e=>geometry.has(e))){waiting('Waiting for live panel layout…');return;}
    if(last[0]!==cdu||last[1]!==nd||last[2]!==cp){
     clearMarks();last=[cdu,nd,cp];branch(cdu,'cdu');branch(nd,'nd');branch(cp,'cp');branch(bar,'controls');branch(setup,'location');setup.hidden=false;seat=s;
    }
    const native=geometry.get(cdu),n=geometry.get(nd),c=geometry.get(cp);
    if(!(native.w>0&&native.h>0&&n.w>0&&n.h>0&&c.w>0&&c.h>0))return;
    const gap=10,available=Math.max(250,innerWidth-4*gap),height=Math.max(120,innerHeight-146);
    const ratios=[native.w/native.h,n.w/n.h,c.w/c.h];
    // Relative to the previous equal-height layout: CDU +20%, EHSI unchanged,
    // EFIS CP 50%. Reserve the released width for the CDU; fit as a group on
    // smaller screens and keep all original interactive elements intact.
    const factors=[1.2,1,0.5];
    const sum=ratios.reduce((a,b,i)=>a+b*factors[i],0);
    const oldScale=Math.min(height,available/ratios.reduce((a,b)=>a+b,0));
    const scale=Math.min(oldScale,height/Math.max(...factors),available/sum);
    const heights=factors.map(f=>scale*f);
    const widths=ratios.map((r,i)=>r*heights[i]);
    const setupWidth=Math.max(widths[2],Math.min(200,innerWidth*.28));
    const total=widths[0]+widths[1]+setupWidth+2*gap;
    let x=Math.max(4,(innerWidth-total)/2);
    for(const [i,e] of last.entries()){
     let y=Math.max(6,(innerHeight-132-heights[i])/2),px=x;
     if(i===2){
      setup.style.setProperty('--lab-x',x+'px');setup.style.setProperty('--lab-w',setupWidth+'px');
      const sh=setup.offsetHeight||132;
      const groupHeight=sh+gap+heights[i];
      const top=Math.max(6,(innerHeight-132-groupHeight)/2);
      setup.style.setProperty('--lab-y',top+'px');y=top+sh+gap;px=x+(setupWidth-widths[i])/2;
     }
     e.style.setProperty('--lab-x',px+'px');e.style.setProperty('--lab-y',y+'px');
     e.style.setProperty('--lab-w',widths[i]+'px');e.style.setProperty('--lab-h',heights[i]+'px');
     x+=widths[i]+gap;
    }
    cdu.style.setProperty('--lab-native-w',native.w+'px');cdu.style.setProperty('--lab-native-h',native.h+'px');
    cdu.style.setProperty('--lab-scale',String(widths[0]/native.w));
    root.dataset.cduLabReady='true';root.dataset.cduLabSeat=seat;
    take.hidden=des.hidden=false;
    const state=api.getState(),preset=window.B737PoweredGeneralPresetsV1?.getStatus?.();
    const final=state?.preset==='FINAL_10',finalStatus=final?window.B737Final10ApproachPresetV1?.getStatus?.():null;
    const prepared=final?finalStatus?.complete===true:preset?.coreReady===true;
    if(loadPending&&(prepared||Date.now()-loadingSince>45000))loadPending=false;
    load.disabled=loadPending;
    take.disabled=loadPending||state?.airborne===true||doc.getElementById('flightTakeoff')?.disabled===true||preset?.coreReady!==true;
    des.disabled=loadPending||state?.airborne!==true||!prepared;
    resume.hidden=state?.airborne!==true;resume.disabled=loadPending||!prepared;
    resume.textContent=api.getDiagnostics()?.paused?'START FLIGHT':'PAUSE FLIGHT';
    if(state)paintRun(api,state,prepared);
    const feed=frame.contentDocument?.documentElement?.dataset;
    if(feed?.cduAwaitingPower==='true'||feed?.cduElectricalFeed==='ABSENT'){
     waiting('Waiting for CDU power'+(preset?.missing?.length?' · '+preset.missing.join(' / '):'')+'…');
    }else if(final&&!prepared){waiting('Preparing 10 NM final · '+(finalStatus?.missing||[]).join(' / '));}
    else if(preset?.timedOut&&!preset.coreReady){waiting('Aircraft preparation incomplete · '+(preset.missing||[]).join(' / '));}
    else if(!prepared){waiting('Preparing aircraft · '+(preset?.missing||[]).join(' / '));}
    else status.hidden=true;
   }catch(e){failure(e);}
  }
  setInterval(tick,250);tick();
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
const css=String.raw
`
html[data-cdu-lab]{background:#10171b!important;}
html[data-cdu-lab] body{background:#10171b!important;margin:0!important;}
html[data-cdu-lab]:not([data-cdu-lab-ready]) body :not(#unifiedCduLabControls):not(#unifiedCduLabControls *){visibility:hidden!important;pointer-events:none!important;}
html[data-cdu-lab-ready] body :not([data-cdu-lab-branch]):not([data-cdu-lab-item]):not([data-cdu-lab-item] *){visibility:hidden!important;pointer-events:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-branch]{visibility:visible!important;overflow:visible!important;transform:none!important;contain:none!important;clip-path:none!important;filter:none!important;backdrop-filter:none!important;perspective:none!important;will-change:auto!important;content-visibility:visible!important;background:transparent!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item]:not([data-cdu-lab-item="controls"]){position:fixed!important;left:var(--lab-x)!important;top:var(--lab-y)!important;right:auto!important;bottom:auto!important;z-index:999999!important;visibility:visible!important;pointer-events:auto!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cdu"]{width:var(--lab-native-w)!important;height:var(--lab-native-h)!important;transform:scale(var(--lab-scale))!important;transform-origin:0 0!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="nd"]{width:var(--lab-w)!important;height:var(--lab-h)!important;transform:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cp"]{width:var(--lab-w)!important;height:auto!important;transform:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cp"] .uefis-banner{display:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cdu"] .cdu-seat-label{display:none!important;}
#unifiedCduLabControls{position:fixed!important;left:0!important;right:0!important;bottom:10px!important;z-index:2147483646!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;visibility:visible!important;pointer-events:auto!important;color:#e3eef0!important;font:14px system-ui,sans-serif!important;}
#unifiedCduLabLocation{box-sizing:border-box!important;width:var(--lab-w)!important;padding:8px!important;display:grid!important;gap:5px!important;border:1px solid #53636b;border-radius:6px;background:#1b272e!important;color:#dce8ed!important;font:11px system-ui,sans-serif!important;z-index:1000000!important;}
#unifiedCduLabLocation[hidden]{display:none!important;}
#unifiedCduLabLocation label{display:grid!important;grid-template-columns:61px minmax(0,1fr);gap:4px;align-items:center!important;margin:0!important;color:inherit!important;}
#unifiedCduLabLocation select,#unifiedCduLabLocation button{box-sizing:border-box!important;min-width:0!important;width:100%!important;padding:5px!important;border-radius:3px!important;background:#263740!important;color:#e3eef0!important;border:1px solid #61717a!important;font:11px system-ui,sans-serif!important;}
#unifiedCduLabLocation button{cursor:pointer!important;}
#unifiedCduLabLocation button:disabled{opacity:.45!important;cursor:default!important;}
#unifiedCduLabControls button{padding:10px 16px!important;border-radius:5px!important;background:#23333c!important;border:1px solid #61717a!important;color:#e3eef0!important;cursor:pointer!important;}
#unifiedCduLabControls button:disabled{opacity:.42!important;cursor:default!important;}
#unifiedCduLabControls [hidden]{display:none!important;}

#unifiedCduLabControls{flex-direction:column!important;gap:6px!important;padding:0 10px!important;}
#unifiedCduRunHud{display:flex!important;align-items:stretch!important;gap:8px!important;max-width:100%;background:#141f25;color:#dce8ed;border:1px solid #53636b;border-radius:6px;padding:5px 8px;box-sizing:border-box;font:12px system-ui,sans-serif;}
#unifiedCduRunHud .lab-run-metrics,#unifiedCduRunHud .lab-run-fma{display:flex;align-items:stretch;gap:3px;}
#unifiedCduRunHud .lab-run-metrics>div,#unifiedCduRunHud .lab-run-fma>div{min-width:57px;display:grid;align-content:start;padding:3px 6px;border-right:1px solid #34434c;text-align:center;}
#unifiedCduRunHud small{font-size:10px;letter-spacing:.04em;color:#a6bbc4;}
#unifiedCduRunHud strong{font:600 14px monospace;white-space:nowrap;min-height:17px;}
#unifiedCduRunHud .lab-run-fma{background:#050807;border:1px solid #53636b;border-radius:3px;}
#unifiedCduRunHud .lab-run-fma strong{color:#40e873;min-width:66px;}
#unifiedCduRunHud .lab-run-fma span{color:white;font:11px monospace;min-height:12px;}
#unifiedCduLabControls .lab-run-actions,#unifiedCduRunControls{display:flex!important;gap:6px!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap;}
#unifiedCduRunControls select{background:#263740;color:#e3eef0;border:1px solid #61717a;border-radius:4px;padding:8px;font:13px system-ui;}
#unifiedCduRunControls #unifiedCduRunControls button{white-space:nowrap;}
#unifiedCduRunControls span{font:11px monospace;min-width:95px;color:#b8d5e0;}
#unifiedCduLabControls button{padding:7px 12px!important;font-size:12px!important;}
@media(max-width:850px){#unifiedCduRunHud{flex-wrap:wrap;justify-content:center;}#unifiedCduRunHud .lab-run-metrics{flex-wrap:wrap;justify-content:center;}#unifiedCduRunHud .lab-run-metrics>div,#unifiedCduRunHud .lab-run-fma>div{min-width:38px;padding:2px 3px;}#unifiedCduRunHud strong{font-size:11px;}#unifiedCduRunHud .lab-run-fma strong{min-width:46px;}}

`;
function head(isLab){
 return '<script>('+volatileStorage.toString()+')('+String(isLab)+');</script>'+
  (isLab?'<style>'+css+'</style><script>('+view.toString()+')();</script>':'');
}
function addLink(html){
 return html.replace('<div id="unifiedLabShortcuts" class="unified-lab-shortcuts"></div>',
  '<div id="unifiedLabShortcuts" class="unified-lab-shortcuts"><a href="'+labPath+'" target="_blank" rel="noopener">CDU / EHSI / EFIS CP TEST LAB</a></div>');
}
module.exports={labPath,legacy,head,addLink};
