/* CB lab↔Window Heat training inspector. Uses the live CB kernel and Electrical V7.
 * Changes to CBs are transmitted via the existing b737classic.cb.v1 snapshot,
 * which Unified reads across same-origin tabs. No new CB presentation geometry.
 */
(function(){'use strict';
const Core=window.B737WindowHeatV1,network=window.B737_CB_Electrical?.network,adapter=window.B737_CB_V7_Integration;
if(!Core||!network||!adapter){console.error('Window Heat CB bridge prerequisites missing');return;}
const sec=document.createElement('section');sec.className='cb-electric';sec.id='cb-window-heat-v1';
sec.innerHTML='<h3>WINDOW HEAT · LIVE CB TEST V1</h3><p>Physical grid: P6-11 / P6-12 heater circuits; P18-3 controller circuits. GREEN/OVERHEAT follow live bus, CB, OH15 switch and faults. <b>General training, not aircraft-specific wiring.</b></p><div id="cbwh-status"></div>'+
'<p>Pull a CB in the panel above, then switch to Unified Cockpit to see the exact overhead lamp respond. The breaker position and pull state are shared across tabs.</p>'+
'<div class="cb-btns"><button data-panel="P6-11">P6-11 · GEN 1</button><button data-panel="P6-12">P6-12 · GEN 2</button><button data-panel="P18-3">P18-3 · CONTROL</button><a href="../panel-mosaic-lab/cockpit/" target="_blank" rel="noopener">Open Unified Cockpit</a></div>';
const base=document.querySelector('#cbv-devices')?.closest('section')||document.querySelector('.cb-electric');
base.after(sec);
const els=sec.querySelector('#cbwh-status'),KEY='b737-overhead-toggles-TGL-0001';
let model=Core.initialState(),last=performance.now();
function readSwitches(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return {};}}
function run(){
 const v7=adapter.evaluate()?.electrical?.bus;if(!v7){els.textContent='Electrical V7 awaiting data';return;}
 const cb={};for(const id of Core.ALL_CBS){const state=network.state(id);if(state)cb[id]=!(state.pulled||state.tripped);}
 const now=performance.now(),dt=Math.min(2,Math.max(0,(now-last)/1000));last=now;
 const r=Core.step(model,{buses:v7,breakers:cb,switches:readSwitches()},dt);model=r.state;
 const rows=Object.entries(r.output.channels).map(([id,x])=>'<tr><td>'+id+'</td><td>'+(x.selected?'ON':'OFF')+'</td><td>'+(x.greenOn?'GREEN':'OFF')+'</td><td>'+(x.overheatOn?'OVHT':'OFF')+'</td><td>'+(x.heaterPower?'HEATING':'STOP')+'</td><td>'+x.temperatureC+'°C</td></tr>').join('');
 const aux=Object.entries(r.output.aux).map(([id,x])=>id+' '+(x.heaterPower?'ON':'OFF')).join(' | ');
 els.innerHTML='<table style="width:100%;text-align:left;border-collapse:collapse"><thead><tr><th>CHANNEL</th><th>SW</th><th>ON</th><th>OVHT</th><th>POWER</th><th>°C</th></tr></thead><tbody>'+rows+'</tbody></table><p>'+aux+'</p><p>Matched physical CBs: '+Core.ALL_CBS.filter(k=>network.state(k)).length+' / '+Core.ALL_CBS.length+'</p>';
}
for(const b of sec.querySelectorAll('[data-panel]'))b.onclick=()=>{const select=document.getElementById('panelSelect');if(!select)return;select.value=b.dataset.panel;select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.viewer-shell')?.scrollIntoView({behavior:'smooth',block:'start'});};
network.subscribe(e=>{if(['PULL','PUSH','INJECT_TRIP','CLEAR_FAULT','RESET','RESTORE'].includes(e.type))run();});
window.addEventListener('storage',e=>{if(e.key===KEY)run();});
setInterval(run,500);window.B737WindowHeatCBV1=Object.freeze({output:()=>model,refresh:run});run();
})();
