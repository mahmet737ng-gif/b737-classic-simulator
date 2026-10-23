(function(){'use strict';
const Stall=window.B737StallWarningV3, {StallSession}=window.B737StallIntegrationV3;
const s=new StallSession({Stall,Session:window.B737IntegrationV2.Session,core:window.B737TrainerCore,WarningEngine:window.B737WarningEngine.WarningEngine});
const e=id=>document.getElementById(id);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const status=v=>v===null?'UNKNOWN':v?'ACTIVE':'INACTIVE';
function send(c){try{e('error').textContent='';s.send(c);draw();}catch(err){e('error').textContent=err.message;}}
function renderBlock(id,title,on,desc,failed){const x=e(id);x.className='block'+(on?' active':'')+(failed?' failed':'');x.innerHTML=`<strong>${esc(title)}</strong>${esc(desc)}`;}
function draw(){const o=s.output,st=o.stall,env=s.input;
 for(let k=1;k<=2;k++){const ch=st.channel[k];renderBlock('c'+k,'STALL WARNING COMPUTER '+k,ch.shakerMotorCommand,`FAULT ${ch.failed?'ON':'OFF'} · TEST ${ch.testAttempted?'PRESSED':'RELEASED'} · ${status(ch.flightDemand)}`,ch.failed)}
 renderBlock('captMotor','CAPTAIN MOTOR',st.physical.captainShakerMotor,status(st.physical.captainShakerMotor),false);
 renderBlock('foMotor','FIRST OFFICER MOTOR',st.physical.firstOfficerShakerMotor,status(st.physical.firstOfficerShakerMotor),false);
 e('columns').className='hero'+(st.physical.bothColumnsVibrate?' active':'');e('columns').textContent=st.physical.bothColumnsVibrate?'BOTH CONTROL COLUMNS VIBRATE':'CONTROL COLUMNS QUIET';
 e('audio').textContent='Existing Warning Engine — airborne shaker audio request: '+(o.systems.warning.active.some(x=>x.id==='shaker')?'ACTIVE':'OFF')+' (no audio file playback in this lab)';
 e('efis').textContent='EFIS: Pitch limit symbol '+status(st.efis.pitchLimitSymbolVisible)+'; angle/speed values NOT COMPUTED; flaps-up speed eligibility '+status(st.efis.flapsUpManeuverSpeedEligible);
 e('gpws').textContent='GPWS/Windshear: Functional signal link exists; exact output computation UNAVAILABLE';
 e('dcpcs').textContent='DCPCS functional interface: engine N1 '+st.dcpcs.engineN1Pct+'% / N2 '+st.dcpcs.engineN2Pct+'%. Physical channel/pin UNKNOWN.';
 e('qa').innerHTML=st.qa.map(x=>`<li>${esc(x.replaceAll('_',' '))}</li>`).join('');
 e('events').innerHTML=(s.log.length?s.log.slice(-12).reverse().map((a,i)=>`<div>${esc(JSON.stringify(a))}</div>`).join(''):'No commands yet.');
 for(const id of Stall.FAULTS){const button=e('f_'+id);if(button){const active=s.state.faults[id];button.className=active?'active':'';button.textContent=(active?'● ':'○ ')+id;button.setAttribute('aria-pressed',String(active));}}
 e('ground').value=env.onGround?'ground':'air';e('ac').value=env.ac115Available?'yes':'no';e('flaps').value=String(env.flaps);
 e('weight').value=env.fmcGrossWeightAvailable===null?'unknown':String(env.fmcGrossWeightAvailable);
 for(let i=1;i<=2;i++){e('d'+i).value=s.state.instructorDemand[i]===null?'unknown':String(s.state.instructorDemand[i]);}
 e('n1').value=String(env.engineN1Pct);e('n2').value=String(env.engineN2Pct);
}
const input=(id,key,map)=>e(id).addEventListener('change',ev=>send({type:'INPUT',key,value:map(ev.target.value)}));
input('ground','onGround',v=>v==='ground');input('ac','ac115Available',v=>v==='yes');input('flaps','flaps',Number);
input('weight','fmcGrossWeightAvailable',v=>v==='unknown'?null:v==='true');input('n1','engineN1Pct',Number);input('n2','engineN2Pct',Number);
for(let ch=1;ch<=2;ch++){
 e('d'+ch).addEventListener('change',ev=>send({type:'INSTRUCTOR_DEMAND',channel:ch,active:ev.target.value==='unknown'?null:ev.target.value==='true',instructor:true}));
 const btn=e('test'+ch);let held=false;
 const release=()=>{if(!held)return;held=false;btn.classList.remove('pressed');send({type:'TEST',channel:ch,pressed:false});};
 btn.addEventListener('pointerdown',ev=>{if(held)return;held=true;btn.classList.add('pressed');try{btn.setPointerCapture(ev.pointerId)}catch{}send({type:'TEST',channel:ch,pressed:true});});
 btn.addEventListener('pointerup',release);btn.addEventListener('pointercancel',release);btn.addEventListener('lostpointercapture',release);
 btn.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&!ev.repeat&&!held){ev.preventDefault();held=true;btn.classList.add('pressed');send({type:'TEST',channel:ch,pressed:true});}});
 btn.addEventListener('keyup',release);btn.addEventListener('blur',release);
}
e('faults').innerHTML=Stall.FAULTS.map(id=>`<button type="button" id="f_${id}" data-id="${id}" aria-pressed="false"></button>`).join('');
for(const id of Stall.FAULTS)e('f_'+id).addEventListener('click',()=>send({type:'FAULT',id,active:!s.state.faults[id],instructor:true}));
e('reset').addEventListener('click',()=>send({type:'RESET'}));draw();
})();