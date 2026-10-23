(function(){'use strict';const P=window.B737PneumaticsV6,W=window.B737WarningEngine?.WarningEngine,I=window.B737PneumaticsIntegrationV6;if(!P||!W||!I)throw Error('System assets missing');const session=new I.Session({Pneumatics:P,WarningEngine:W}),el=id=>document.getElementById(id);
const names={engineBleed1:'ENG 1 BLEED',engineBleed2:'ENG 2 BLEED',apuBleed:'APU BLEED',isolation:'ISOLATION VALVE',packL:'L PACK',packR:'R PACK',recirc:'RECIRC FAN',temperatureL:'CONT CABIN TEMP',temperatureR:'PASS CABIN TEMP'};
const sensors=['engine1Running','engine2Running','apuRunning','onGround','flapsUp','bleedValveControlPower','isolationAcPower','recircAcPower','externalAirAvailable','bleed1Overlimit','bleed2Overlimit','packLOverheat','packROverheat','ductLOverheat','ductROverheat','wingBodyLLeakDetected','wingBodyRLeakDetected','wingBodyTestHeld','cabinAltitudeFt','ductLeftPsi','ductRightPsi'];
const esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function send(a){try{session.send(a);render()}catch(e){el('horn').textContent='REJECTED: '+e.message;}}
function build(){el('controls').innerHTML=Object.entries(P.CONTROL_TYPES).map(([key,opts])=>`<div class="control"><label for="c_${key}">${names[key]}</label><select id="c_${key}" data-control="${key}">${opts.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div>`).join('');
 el('controls').querySelectorAll('select').forEach(x=>x.addEventListener('change',()=>send({type:'CONTROL',key:x.dataset.control,value:x.value})));
 el('inputs').innerHTML=sensors.map(key=>`<label class="field"><span>${esc(key)}</span>${P.INPUT_TYPES[key]==='boolean'?`<button type="button" data-input="${key}"></button>`:`<input type="number" step="any" data-input="${key}"/>`}</label>`).join('');
 el('inputs').querySelectorAll('button').forEach(x=>x.addEventListener('click',()=>send({type:'SENSOR',key:x.dataset.input,value:!session.state.inputs[x.dataset.input]})));
 el('inputs').querySelectorAll('input').forEach(x=>x.addEventListener('change',()=>send({type:'SENSOR',key:x.dataset.input,value:x.value===''&&P.INPUT_TYPES[x.dataset.input]==='numberOrNull'?null:Number(x.value)})));
 el('faults').innerHTML=P.FAULTS.map(id=>`<button data-fault="${id}">${id}</button>`).join('');el('faults').querySelectorAll('button').forEach(x=>x.addEventListener('click',()=>send({type:'FAULT',id:x.dataset.fault,active:!session.state.faults[x.dataset.fault],instructor:true})));
 el('tripReset').addEventListener('click',()=>send({type:'TRIP_RESET'}));el('hornCutout').addEventListener('click',()=>send({type:'HORN_CUTOUT'}));el('reset').addEventListener('click',()=>send({type:'RESET'}));
}
function stat(id,title,value){const e=el(id);e.className='node '+(value===true?'on':value===false?'warn':'');e.innerHTML=`<strong>${title}</strong><p>${value===true?'AVAILABLE':value===false?'OFF/NO SUPPLY':'UNKNOWN'}</p>`;}
function render(){const o=session.render(),d=o.pneumatics,s=session.state;
 el('controls').querySelectorAll('select').forEach(x=>x.value=s.controls[x.dataset.control]);
 el('inputs').querySelectorAll('button').forEach(x=>{const b=s.inputs[x.dataset.input];x.textContent=b?'ON':'OFF';x.className=b?'active':'neutral'});
 el('inputs').querySelectorAll('input').forEach(x=>{if(document.activeElement!==x)x.value=s.inputs[x.dataset.input]??'';});
 el('faults').querySelectorAll('button').forEach(x=>{const b=s.faults[x.dataset.fault];x.className=b?'fault-on':'neutral';x.setAttribute('aria-pressed',b);});
 stat('eng1','ENGINE 1 BLEED',d.bleed.engine1ValveOpen);stat('apu','APU BLEED',d.bleed.apuBleedValveOpen);stat('eng2','ENGINE 2 BLEED',d.bleed.engine2ValveOpen);stat('iso','ISOLATION OPEN',d.bleed.isolationOpen);stat('pL','LEFT PACK',d.pack.L.operational);stat('pR','RIGHT PACK',d.pack.R.operational);
 el('ductInfo').textContent=`LEFT DUCT: ${String(d.duct.L.anySupply)} | RIGHT DUCT: ${String(d.duct.R.anySupply)}\nL/R Pack Flow: ${d.pack.L.flow} / ${d.pack.R.flow}\nRECIRC FAN: ${d.recircFanRunning?'RUNNING':'OFF'}\nDUCT PSI: ${d.gauges.L??'UNKNOWN'} / ${d.gauges.R??'UNKNOWN'} (manual sensor only)\nPressurization supply: ${String(d.toPressurization.packConditionedAirAvailable)} · cabin physics: NOT MODELED`;
 const labs={dualBleed:'DUAL BLEED',bleedTrip1:'BLEED TRIP OFF 1',bleedTrip2:'BLEED TRIP OFF 2',packTripL:'PACK TRIP OFF L',packTripR:'PACK TRIP OFF R',ductOverheatL:'DUCT OVERHEAT L',ductOverheatR:'DUCT OVERHEAT R',wingBodyOverheatL:'WING-BODY L',wingBodyOverheatR:'WING-BODY R'};
 el('lamps').innerHTML=Object.entries(labs).map(([k,label])=>`<div class="lamp ${d.lamps[k]?'lit':''}">${label}</div>`).join('');
 el('horn').textContent=`CABIN ALT WARNING: ${o.cabinWarning.lamp?'LAMP ON':'OFF'} · HORN: ${o.cabinWarning.audio.length?'ACTIVE':'SILENT'} (altitude is an instructor input)`;
 el('checklist').innerHTML=o.checkpoints.map(k=>`<div class="check"><span>${esc(k.label)}</span><b>${k.observed?'✓':'○'}</b></div>`).join('');
 el('events').innerHTML=s.events.slice(-14).reverse().map(a=>`<div>#${a.seq} ${esc(JSON.stringify(a.command))}</div>`).join('')||'No actions';
}
build();render();
})();