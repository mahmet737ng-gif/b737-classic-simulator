(function(win){'use strict';
 const C=win.B737ClassicTcasV2,Core=win.EFISDisplayLabCore,by=id=>document.getElementById(id);
 let settings=C.controls(),own={airborne:true,altitudeFt:10000,radioAltitudeFt:6000,tasKt:220,gsKt:220,iasKt:220,pitchDeg:2,vsFpm:0,trueHeadingDeg:0,trueTrackDeg:0,elapsedSec:0},
 encounter=null,out=null,running=false,last=null,targetPitch=2;
 const scenario=by('scenario');for(const [id,s] of Object.entries(C.SCENARIOS)){const o=new Option(s.label,id);scenario.add(o);}scenario.value='SAME_LEVEL';
 for(const id of Object.keys(settings.failures)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.failure=id;label.append(input,document.createTextNode(id));by('failures').append(label);input.addEventListener('change',()=>{settings.failures[id]=input.checked;refresh();});}
 function feeds(){return {xpdr1:by('bus1').checked,xpdr2:by('bus2').checked&&by('atc2cb').checked,computer:!settings.failures.computer,aligned:!settings.failures.irs,adc1:true,adc2:true,radioAlt:true,irs:true};}
 function load(){own.elapsedSec=0;own.altitudeFt=Number(by('altitude').value);own.radioAltitudeFt=Number(by('radioHeight').value);own.tasKt=own.gsKt=own.iasKt=Number(by('speed').value);own.pitchDeg=Number(by('pitch').value);targetPitch=own.pitchDeg;own.vsFpm=Number(by('vs').value);
  const options={};if(by('relative').value.trim())options.relativeAltitudeFt=Number(by('relative').value);if(by('intruderVS').value.trim())options.verticalRateFpm=Number(by('intruderVS').value);
  encounter=C.create(scenario.value,own,options);refresh();}
 function refresh(){if(!encounter)return;encounter=C.step(encounter,own,0,settings,feeds());out=encounter.output;paint();}
 function step(dt){
  const change=Math.max(-3*dt,Math.min(3*dt,targetPitch-own.pitchDeg));own.pitchDeg+=change;
  own.vsFpm=Math.sin((own.pitchDeg-2)*Math.PI/180)*own.tasKt*6076.11549/60;
  own.altitudeFt+=own.vsFpm*dt/60;own.radioAltitudeFt+=own.vsFpm*dt/60;own.elapsedSec+=dt;
  encounter=C.step(encounter,own,dt,settings,feeds());out=encounter.output;paint();
 }
 function paint(){
  const state=Core.initial();state.eadi.pitch=own.pitchDeg;state.eadi.bank=0;state.eadi.ias=own.iasKt;state.eadi.radioAlt=own.radioAltitudeFt;
  state.eadi.tcasRa=out.ra;state.eadi.fd=false;state.eadi.fdAuto=false;state.eadi.at='';state.eadi.afds='';state.eadi.pitchMode='';state.eadi.rollMode='';
  win.EFISDisplayLabEadi.render(by('eadi'),state,Core);
  win.EFISClassicEHSIV2.render(by('ehsi'),{mode:by('displayMode').value,range:Number(by('range').value),heading:0,track:0,selectedHeading:0,
   trueRef:false,nav:{valid:true},route:{points:[]},options:{tfc:by('tfc').checked},traffic:out,
   efis:{displayPower:true,sgValid:true,headingValid:!settings.failures.irs,trackValid:!settings.failures.irs},weather:{}});
  by('status').textContent=[out.mode,out.stage,out.callout,...out.inhibits].filter(Boolean).join(' · ');
  const t=out.transponder;by('xpdr').textContent='ATC '+t.selectedUnit+' · '+t.displayedCode+' · MODE S '+(t.modeS?'ON':'OFF')+' · ALT '+(t.altitudeReporting?'REPORTING':'OFF / INVALID')+' · '+(t.atcFailLight?'ATC FAIL / TEST':'NORMAL')+(t.ident?' · IDENT':'');
  by('ownState').textContent='TIME '+own.elapsedSec.toFixed(1)+' S · ALT '+Math.round(own.altitudeFt)+' FT · VS '+Math.round(own.vsFpm)+' FPM · PITCH '+own.pitchDeg.toFixed(1)+'°';
  const tbody=by('trafficRows');tbody.replaceChildren();for(const t of out.targets){const tr=document.createElement('tr');
   const clock=Number.isFinite(t.bearing)?((Math.round(((t.bearing-own.trueHeadingDeg+360)%360)/30)%12)||12):'—';
   for(const value of [t.id,t.kind,clock,t.distance.toFixed(2),t.relativeAltitude===null?'UNKNOWN':Math.round(t.relativeAltitude),t.verticalRate??'—',t.verticalRelation??'—',Number.isFinite(t.tcpaSec)?t.tcpaSec.toFixed(1):'—']){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}tbody.append(tr);}
 }
 function guard(fn){return ()=>{try{fn();}catch(e){by('status').textContent=e.message;}};}
 by('start').onclick=guard(load);by('play').onclick=()=>{running=!running;last=null;by('play').textContent=running?'PAUSE':'RUN';};by('step').onclick=guard(()=>step(1));
 by('respond').onclick=()=>{if(!out?.ra)return;const zones=out.ra.avoid;
  targetPitch=zones.length===2?(zones[0].pitchDeg+zones[1].pitchDeg)/2:(zones[0]?.pitchDeg??2)+(zones[0]?.side==='BELOW'?.3:-.3);by('pitch').value=targetPitch.toFixed(1);};
 for(const [id,key] of [['mode','mode'],['unit','unit'],['altSource','altSource'],['code','code'],['filter','filter']])by(id).onchange=guard(()=>{settings[key]=['unit','altSource'].includes(key)?Number(by(id).value):by(id).value;refresh();});
 by('pitch').onchange=()=>{targetPitch=Number(by('pitch').value);};
 by('vs').onchange=()=>{targetPitch=2+Math.asin(Math.max(-.7,Math.min(.7,Number(by('vs').value)/(own.tasKt*6076.11549/60))))*180/Math.PI;by('pitch').value=targetPitch.toFixed(1);};
 by('priority').onchange=()=>{settings.priorityWarning=by('priority').checked;refresh();};
 for(const id of ['displayMode','range','tfc','bus1','bus2','atc2cb'])by(id).onchange=refresh;
 by('ident').onclick=()=>{settings.identUntil=own.elapsedSec+1;refresh();};by('absolute').onclick=()=>{settings.absoluteUntil=own.elapsedSec+15;refresh();};
 function tick(now){if(running&&last!==null){const dt=Math.min(.2,(now-last)/1000)*Number(by('rate').value);try{step(dt);}catch(e){running=false;by('status').textContent=e.message;}}last=now;requestAnimationFrame(tick);}
 load();requestAnimationFrame(tick);
})(window);
