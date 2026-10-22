(function(){'use strict';
const C=window.B737TrainerCore,W=window.B737WarningEngine,I=window.B737IntegrationV2;
if(!C||!W||!I)throw Error('Trainer dependencies unavailable');
const s=new I.Session({core:C,WarningEngine:W.WarningEngine});
const el=id=>document.getElementById(id),esc=t=>String(t).replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[k]));
const labels={
 'OH.BATTERY':'BATTERY','OH.BUS_TRANS':'BUS TRANS AUTO','OH.GROUND_AVAILABLE':'GROUND PWR AVAILABLE','OH.GRD_PWR':'GRD PWR CONNECTED',
 'OH.ENGINE_1_RUNNING':'ENGINE 1 RUNNING','OH.ENGINE_2_RUNNING':'ENGINE 2 RUNNING','OH.GEN_1':'GEN 1','OH.GEN_2':'GEN 2',
 'OH.APU_RUNNING':'APU RUNNING','OH.APU_GEN_1':'APU GEN 1','OH.APU_GEN_2':'APU GEN 2',
 'OH.FUEL_MAIN1_FWD':'FUEL 1 FWD','OH.FUEL_MAIN1_AFT':'FUEL 1 AFT','OH.FUEL_MAIN2_FWD':'FUEL 2 FWD','OH.FUEL_MAIN2_AFT':'FUEL 2 AFT',
 'OH.FUEL_CTR_L':'FUEL CTR L','OH.FUEL_CTR_R':'FUEL CTR R','OH.HYD_ELEC_A':'HYD ELEC A','OH.HYD_ELEC_B':'HYD ELEC B',
 'OH.HYD_ENG_A':'HYD ENG A','OH.HYD_ENG_B':'HYD ENG B'};
function action(c){try{const r=s.send(c);draw(r);el('status').textContent=`${s.log.length} training commands · ${r.clockMs} ms simulated`;}catch(err){el('status').textContent=`Rejected: ${err.message}`;}}
function controlValue(id){return I.CONTROLS[id].split('.').reduce((o,k)=>o[k],s.state.controls)}
function draw(r){
 el('controls').innerHTML=Object.keys(I.CONTROLS).map(id=>{const on=controlValue(id);return `<div class="ctrl"><label>${esc(labels[id])}</label><button data-ctrl="${id}" aria-pressed="${on}" class="${on?'selected':'secondary'}">${on?'ON':'OFF'}</button></div>`}).join('');
 el('controls').querySelectorAll('button').forEach(b=>b.onclick=()=>action({type:'SWITCH',id:b.dataset.ctrl,value:!controlValue(b.dataset.ctrl)}));
 el('faults').innerHTML=Object.keys(I.FAULTS).map(id=>{const on=s.state.faults[I.FAULTS[id]];return `<button data-f="${id}" class="${on?'danger':'secondary'}" aria-pressed="${on}">${on?'● ':'○ '}${esc(id.replaceAll('.',' '))}</button>`}).join('');
 el('faults').querySelectorAll('button').forEach(b=>b.onclick=()=>action({type:'FAULT',id:b.dataset.f,active:!s.state.faults[I.FAULTS[b.dataset.f]]}));
 [['bus1','GENERATOR BUS 1',r.electrical.generatorBus[1]],['bus2','GENERATOR BUS 2',r.electrical.generatorBus[2]],
  ['t1','TRANSFER BUS 1',r.electrical.transferBus[1]?'ENERGIZED':null],['t2','TRANSFER BUS 2',r.electrical.transferBus[2]?'ENERGIZED':null]].forEach(([id,label,source])=>{const b=el(id);b.className='bus '+(source?'':'off');b.innerHTML=`<strong>${label}</strong><em>${esc(source||'NOT POWERED')}</em>`;});
 const eq=[...Object.entries(r.fuel).map(([k,v])=>[k,v.operational?'RUN':'STOP',v.lowPressure]),...Object.entries(r.hyd).map(([k,v])=>[k,v.operating?'RUN':'STOP',v.lowPressure])];
 el('equipment').innerHTML=`<div class="report">${eq.map(([id,mode,low])=>`<div class="report-row"><span>${esc(id)}</span><b class="${low?'bad':'good'}">${mode} · ${low?'LOW PRESS':'OK'}</b></div>`).join('')}</div>`;
 const lampData=[['BUS OFF 1',r.electrical.indicators.busOff1],['BUS OFF 2',r.electrical.indicators.busOff2],['TRANS BUS 1',r.electrical.indicators.transferBusOff1],['TRANS BUS 2',r.electrical.indicators.transferBusOff2],['FUEL CAUTION',r.electrical.indicators.masterCautionFuel],['CABIN ALT',r.warning.lamps.cabinAltitude],['FIRE WARN',r.warning.lamps.fireWarn,'fire'],['STICK SHAKER',r.stall.airborneShakerSimulated],['STALL TEST',r.stall.columnsVibrateOnTest]];
 el('lamps').innerHTML=lampData.map(([label,on,kind])=>`<div class="lamp ${on?'lit '+(kind||''):''}">${esc(label)}</div>`).join('');
 el('audio').innerHTML=`<b>Warning-engine audio requests:</b> ${r.warning.active.length?r.warning.active.map(a=>`<span class="bad">${esc(a.id)} (${esc(a.asset||'no asset')})</span>`).join(', '):'None'}<div class="hint">Playback not activated. Existing phrase engine assets remain separate.</div>`;
 el('dcpcs').innerHTML=`<div class="statusline"><b>DCPCS</b><span>${r.dcpcs.autoFail?'AUTO FAIL / ALTN':'AUTO'}</span></div><p>${esc(r.dcpcs.outflowValveCommand)} · N1 ${r.environment.engineN1Pct}% · N2 ${r.environment.engineN2Pct}% · ${r.dcpcs.prepressQualified?'1.5s qualified':'not yet qualified'}</p><div class="hint">DCPCS DC feed is a surrogate; actual channel wiring unverified.</div>`;
 el('stallstatus').innerHTML=`<div class="statusline"><b>Stall computer channels</b><span>${r.stall.testAuthorized?'TEST ENABLED':'TEST INHIBITED'}</span></div><p>${r.stall.columnsVibrateOnTest?'BOTH COLUMNS: TEST VIBRATION':'NO TEST VIBRATION'} · Airborne stall: ${r.stall.airborneShakerSimulated?'INSTRUCTOR SIMULATION':'NO OUTPUT'}</p><div class="hint">Exact AoA threshold is not derived from this database.</div>`;
 const q=r.checklist;
 el('checklist').innerHTML=q.id==='none'?'<p>Choose GEN 1 or GEN 2 BUS OFF to practice the source-linked training flow.</p>':`<b>${esc(q.title)}</b><span class="${q.complete?'good':'bad'}"> · ${q.complete?'BUS RESTORED':'NOT RESTORED'}</span>`+q.steps.map(st=>`<div class="checkstep ${st.done?'done':''}">${st.done?'✓':'○'} ${esc(st.title)}</div>`).join('')+`<p class="hint">Not the complete airline QRH procedure; educational branch/checkpoint preview.</p>`;
 el('events').innerHTML=s.log.slice(-10).reverse().map(x=>`#${x.number} (${x.atMs}ms) ${esc(JSON.stringify(x.action))}`).join('\n');
 for(const [id,key] of [['cabin','cabinAltitudeFt'],['n1','engineN1Pct'],['n2','engineN2Pct']]){if(document.activeElement!==el(id))el(id).value=r.environment[key]}
 el('ground').textContent=r.environment.onGround?'GROUND (switch to AIR)':'AIR (switch to GROUND)';
 el('taxi').textContent='TAXI-IN '+(r.environment.taxiIn?'ON':'OFF');
 el('fire').textContent=r.environment.engine1Fire?'Clear Engine 1 Fire':'Inject Engine 1 Fire';
 el('stall').textContent=r.environment.stallWarning?'Clear instructor Stall':'Instructor Stall Trigger';
 el('stalltest').textContent=r.environment.stallTest1?'Release TEST 1':'TEST 1 (Ground)';
}
function scen(side){action({type:'RESET'});action({type:'SCENARIO',id:'bus'+side});action({type:'FAULT',id:'ELEC.GEN'+side+'_FAILED',active:true})}
el('sc1').onclick=()=>scen(1);el('sc2').onclick=()=>scen(2);el('scNone').onclick=()=>action({type:'SCENARIO',id:'none'});
el('reset').onclick=()=>action({type:'RESET'});
el('tick').onclick=()=>action({type:'ADVANCE',ms:1500});
el('fire').onclick=()=>action({type:'ENV',key:'engine1Fire',value:!s.env.engine1Fire});
el('fireAck').onclick=()=>action({type:'ACK_FIRE'});el('cabinAck').onclick=()=>action({type:'ACK_CABIN'});
el('ground').onclick=()=>action({type:'ENV',key:'onGround',value:!s.env.onGround});
el('taxi').onclick=()=>action({type:'ENV',key:'taxiIn',value:!s.env.taxiIn});
el('stall').onclick=()=>action({type:'ENV',key:'stallWarning',value:!s.env.stallWarning,instructor:true});
el('stalltest').onclick=()=>action({type:'ENV',key:'stallTest1',value:!s.env.stallTest1});
for(const [id,key] of [['cabin','cabinAltitudeFt'],['n1','engineN1Pct'],['n2','engineN2Pct']])el(id).addEventListener('change',()=>action({type:'ENV',key,value:Number(el(id).value)}));
el('export').onclick=()=>{const text=JSON.stringify({state:s.state,environment:s.env,clockMs:s.nowMs,log:s.log,derived:s.lastResult},null,2);const blob=new Blob([text],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='b737-systems-training-v2.json';a.click();URL.revokeObjectURL(url)};
draw(s.render());
})();