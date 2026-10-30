/* Non-invasive live ATA24 load adapter. Existing panel selector/needle geometry
 * stays untouched: only official public setAmps/setSourceMeasurement APIs are used.
 * Unified ECU Electrical V7 is the only power-state owner.
 */
(function(root){
 'use strict';
 const Engine=root.B737ElectricalDemandEstimateV1;
 if(!Engine)return;
 const owner=()=>root.B737ISNCockpitV1;
 let latest=null,signature='',lastMeterSignature='',panel=null,body=null,head=null,summary=null;
 const pretty=n=>Number.isFinite(n)?n.toFixed(1):'—';
 const safe=fn=>{try{return fn();}catch(error){console.warn('ATA24 load meter:',error);return null;}};
 const clone=v=>JSON.parse(JSON.stringify(v));
 function inputs(){
  const cockpit=owner();
  if(!cockpit?.getElectricalState||!cockpit?.getState)return null;
  const frame=document.getElementById('overheadFrame');
  let toggles={};
  try{toggles=frame?.contentWindow?.B737OverheadToggles?.getState?.()||{};}catch{}
  const windowHeat=root.B737WindowHeatUnifiedV1?.getOutput?.()||null;
  return {electrical:cockpit.getState().state.electrical,
   toggles,windowHeat,battery:cockpit.getLiveBattery?.()||root.B737InstalledBattery?.snapshot?.()||null};
 }
 function selectedMeterReadings(result){
  const electrical=root.B737UnifiedElectricalLive?.snapshot?.();
  const selectors=root.B737UnifiedAcDcSelectors;
  if(!electrical||!selectors)return;
  const battery=result.batteryAmps,dc=electrical.meterSources.DC;
  for(const id of ['TR1','TR2','TR3']){
   const powered=electrical.nodes[id].powered;
   const measurement={volts:dc[id].volts,amps:powered===true?result.trAmps[id]:powered===false?0:null};
   selectors.setSourceMeasurement('DC',id,measurement);
  }
  selectors.setSourceMeasurement('DC','BAT',{volts:dc.BAT.volts,amps:battery});
  // All other selector positions remain controlled by the original network.
 }
 function driveAmmeters(result){
  const needles=root.B737UnifiedDriveAmpsNeedles;
  if(!needles)return;
  const source=result.sourceAmps;
  const assigned=result.sourceToBus;
  const gen1=assigned[1]==='GEN1'?source.GEN1:0;
  const gen2=assigned[2]==='GEN2'?source.GEN2:0;
  needles.setAmps('acAmps1',Math.max(0,Math.min(200,gen1)));
  needles.setAmps('acAmps2',Math.max(0,Math.min(200,gen2)));
  // The original APU meter has NO approved numeric photo graduation yet.
  // Drive its existing blade by monotone visual demand only (QA/provisional).
  const apuNeedle=root.B737DriveAmpsNeedleModel?.needles?.find(x=>x.id==='apuAcAmps');
  if(apuNeedle)needles.setAngle('apuAcAmps',apuNeedle.initialAngle+Math.min(200,Math.max(0,source.APU))*0.49);
 }
 function mount(){
  const host=document.getElementById('electricalLivePanel')||document.getElementById('isnBridgePanel');
  if(!host)return;
  if(panel?.isConnected)return;
  panel=document.createElement('details');panel.id='liveLoadLedgerV1';panel.dir='ltr';
  panel.style.cssText='margin:12px 0;padding:9px;border:1px solid #526f7b;border-radius:7px;font:12px/1.45 system-ui;color:#dce8ea';
  const heading=document.createElement('summary');heading.textContent='ATA 24 · مصرف تقریبی زنده هر سیستم / AC & DC LOAD';heading.style.cursor='pointer';
  head=document.createElement('p');head.style.cssText='font:600 13px/1.7 monospace;white-space:normal';panel.append(heading,head);
  summary=document.createElement('p');summary.style.cssText='font-size:11px;color:#edc87b';
  summary.textContent='اعداد آموزشی و تقریبی هستند؛ اتصال فیزیکی هر مصرف‌کننده به باسِ EP-FSI تأیید WDM ندارد. AC آمپر معادل گیج ژنراتور و DC آمپر 28V است. مجموع مستقیم این دو مجاز نیست.';
  panel.append(summary);
  const scroll=document.createElement('div');scroll.style.cssText='overflow:auto;max-height:350px';
  const table=document.createElement('table');table.style.cssText='border-collapse:collapse;width:100%;font:11px monospace';
  const th=document.createElement('thead');const row=document.createElement('tr');
  for(const label of ['SYSTEM','BUS','SOURCE','STATUS','MODEL A']){
   const cell=document.createElement('th');cell.textContent=label;cell.style.cssText='text-align:left;padding:4px;border-bottom:1px solid #536c73';row.append(cell);
  }
  th.append(row);table.append(th);
  body=document.createElement('tbody');table.append(body);scroll.append(table);panel.append(scroll);
  host.append(panel);
 }
 function paint(result){
  mount();if(!panel)return;
  head.textContent='GEN 1 '+pretty(result.sourceAmps.GEN1)+' A  ·  GEN 2 '+pretty(result.sourceAmps.GEN2)+
   ' A  ·  APU '+pretty(result.sourceAmps.APU)+' A  ·  GPU '+pretty(result.sourceAmps.EXT)+
   ' A  |  TR1 '+pretty(result.trAmps.TR1)+' A  TR2 '+pretty(result.trAmps.TR2)+
   ' A  TR3 '+pretty(result.trAmps.TR3)+' A  |  BAT '+(result.batteryAmps===null?'—':(result.batteryAmps>0?'+':'')+pretty(result.batteryAmps))+' A';
  if(!panel.open)return;
  body.replaceChildren();
  for(const item of result.loads){
   const tr=document.createElement('tr');
   const status=item.active?'DRAWING':item.commanded?item.energized===null?'UNKNOWN':'NO POWER':'OFF';
   const values=[item.label,item.bus,item.source||'—',status,item.active?pretty(item.currentA):'0.0'];
   for(const value of values){
    const td=document.createElement('td');td.textContent=value;
    td.style.cssText='border-bottom:1px solid #314853;padding:3px 5px;white-space:nowrap';
    if(value===status)td.style.color=status==='DRAWING'?'#a4dfb4':status==='UNKNOWN'?'#edc87b':'#a2aeb4';
    tr.append(td);
   }
   body.append(tr);
  }
 }
 function tick(force=false){
  const input=safe(inputs);if(!input)return;
  const sig=JSON.stringify([input.electrical.revision,input.electrical.source,input.electrical.bus,
   input.toggles,input.windowHeat?.channels&&Object.fromEntries(Object.entries(input.windowHeat.channels).map(([k,v])=>[k,v.heaterPower])),
   input.battery?.ammeterA,input.battery?.chargerA]);
  if(!force&&sig===signature)return;
  const estimate=safe(()=>Engine.project(input));if(!estimate)return;
  signature=sig;latest=estimate;
  // Live needle outputs are updated independently of source-selector events.
  safe(()=>driveAmmeters(estimate));
  safe(()=>selectedMeterReadings(estimate));
  paint(estimate);
  root.dispatchEvent(new CustomEvent('b737:electrical-demand-estimate',{detail:clone(estimate)}));
 }
 const events=['b737:electrical-network','b737:electrical-owner-ready','b737:unified-ecu-observation',
  'b737:battery-live','b737:ac-dc-selector-change'];
 for(const name of events)root.addEventListener(name,()=>tick(true));
 root.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==document.getElementById('overheadFrame')?.contentWindow)return;
  if(event.data?.type==='b737:cockpit-overhead'&&['controls-state','control-event'].includes(event.data.kind))tick(true);
 });
 const api=Object.freeze({version:Engine.VERSION,snapshot:()=>latest?clone(latest):null,refresh:()=>tick(true)});
 root.B737UnifiedLoadMeterV1=api;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>tick(true),{once:true});else tick(true);
 setInterval(()=>tick(),350);
})(window);
