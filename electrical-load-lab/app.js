(()=>{'use strict';
 const E=globalThis.B737ElectricalV7,L=globalThis.B737ElectricalLoadsV8,Stall=globalThis.B737StallWarningV3,I=globalThis.B737ElectricalIntegrationV8;
 if(!E||!L||!Stall||!I)throw Error('Missing system dependency');
 const $=id=>document.getElementById(id);const s=new I.Session({Electrical:E,Loads:L,Stall});
 const status=v=>v===true?'ENERGIZED':v===false?'OFF':'UNKNOWN';
 const clazz=v=>v===true?'state':v===false?'state off':'state unknown';
 const escaped=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function refresh(){const o=s.render(),e=o.electrical,loads=o.loads;
  $('verified').innerHTML=L.VERIFIED.map(x=>{const v=loads.upstream[x.id];return `<div class="feed"><div><strong>${escaped(x.id)}</strong><small>Input: ${escaped(x.upstream)} · FCOM ${escaped(x.folio)} · DB ${x.pdfPage}</small></div><div class="${clazz(v.acBusAvailable)}">${status(v.acBusAvailable)}<small>TR: ${status(v.powerConversionOperating)}</small></div></div>`}).join('');
  $('coverage').textContent=`${loads.coverage.verifiedUpstream} verified upstream feeds · ${loads.coverage.loadsPending} device feeds pending`;const filter=$('filter').value;
  $('equipment').innerHTML=Object.values(loads.loads).filter(x=>filter==='ALL'||x.system===filter).map(x=>`<tr><td>${escaped(x.id)}<small>${escaped(x.limitation)}</small></td><td>${escaped(x.electricClass||'Unknown')}</td><td><span class="state unknown">UNVERIFIED</span></td><td><span class="${clazz(x.powered)}">${status(x.powered)}</span><small>${escaped(x.reason)}</small></td><td>${escaped(x.folio)} / ${x.pdfPage}</td></tr>`).join('');
  const ac=o.handoff.stallGroundTest;const stall=o.stall;
  $('handoff').textContent=`Electrical: ${e.source[1]||'OFF'} / ${e.source[2]||'OFF'}. Stall test AC evidence: ${status(o.trainingInput.stall115vAcEffective)}. ${ac.annotation}. Ground shaker test: ${stall===null?'NOT EVALUATED (POWER UNKNOWN)':stall.physical.groundTestActive?'ACTIVE':'INACTIVE'}. DCPCS controller feed: UNKNOWN. Fuel and hydraulic pump feeds: UNKNOWN.`;
 }
 function send(fn){try{fn();$('error').textContent='';refresh()}catch(err){$('error').textContent=err.message;refresh()}}
 const control=(key,value)=>s.send({type:'ELECTRICAL',action:{type:'CONTROL',key,value}});
 const electr=(id,active)=>s.send({type:'ELECTRICAL',action:{type:'FAULT',id,active,instructor:true}});
 $('s1').onchange=()=>send(()=>s.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:1,source:$('s1').value}}));
 $('s2').onchange=()=>send(()=>s.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:2,source:$('s2').value}}));
 $('standby').onchange=()=>send(()=>control('standbySelector',$('standby').value));
 for(const [id,key] of [['trans','busTransferAuto'],['battery','batterySwitch']])$(id).onchange=()=>send(()=>control(key,$(id).checked));
 $('ground').onchange=()=>send(()=>s.send({type:'SENSOR',key:'onGround',value:$('ground').checked}));
 for(const [id,key] of [['tr1','TR1_FAILED'],['tr2','TR2_FAILED'],['tr3','TR3_FAILED'],['gen1','GEN1_FAILED'],['gen2','GEN2_FAILED'],['depleted','BATTERY_DEPLETED']])$(id).onchange=()=>send(()=>electr(key,$(id).checked));
 $('filter').onchange=refresh;
 $('stallTest').onchange=()=>send(()=>{for(const channel of [1,2])s.send({type:'STALL',action:{type:'TEST',channel,pressed:$('stallTest').value===String(channel)}})});
 $('testPower').onchange=()=>send(()=>s.send({type:'INSTRUCTOR_TEST_POWER',value:$('testPower').value==='UNKNOWN'?null:$('testPower').value==='YES',instructor:true}));
 $('reset').onclick=()=>send(()=>{s.reset();$('s1').value='GEN1';$('s2').value='GEN2';$('standby').value='AUTO';$('filter').value='ALL';$('stallTest').value='OFF';$('testPower').value='UNKNOWN';for(const id of ['trans','battery','ground'])$(id).checked=true;for(const id of ['tr1','tr2','tr3','gen1','gen2','depleted'])$(id).checked=false;});
 refresh();
})();