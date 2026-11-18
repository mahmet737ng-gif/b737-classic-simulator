(function(win){'use strict';
 const C=win.B737ClassicTcasV2,Core=win.EFISDisplayLabCore,Cruise=win.B737TcasCruiseScenarioV1,
  by=id=>document.getElementById(id);
 let settings=C.controls(),own={airborne:true,altitudeFt:27000,radioAltitudeFt:24000,
  tasKt:440,gsKt:448,iasKt:293,mach:.73,pitchDeg:2,vsFpm:0,
  trueHeadingDeg:0,trueTrackDeg:0,elapsedSec:0},initialAltitudeFt=27000,
 encounter=null,out=null,running=false,last=null,targetPitch=2,autopilotEngaged=true,tfcVisible=true;
 const scenario=by('scenario');for(const [id,s] of Object.entries(C.SCENARIOS)){const o=new Option(s.label,id);scenario.add(o);}scenario.value='SAME_LEVEL';
 for(const id of Object.keys(settings.failures)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.failure=id;label.append(input,document.createTextNode(id));by('failures').append(label);input.addEventListener('change',()=>{settings.failures[id]=input.checked;refresh();});}
 function feeds(){return {xpdr1:by('bus1').checked,xpdr2:by('bus2').checked&&by('atc2cb').checked,computer:!settings.failures.computer,aligned:!settings.failures.irs,adc1:true,adc2:true,radioAlt:true,irs:true};}
 function load(){running=false;last=null;by('play').textContent='RUN';autopilotEngaged=true;
  own.elapsedSec=0;own.altitudeFt=Number(by('altitude').value);own.radioAltitudeFt=Number(by('radioHeight').value);own.iasKt=Number(by('speed').value);
  // 293 KIAS / Mach .73 cruise demonstration, with TAS distinct from CAS.
  // These are trainer estimates, not an ADC atmosphere calculation.
  own.tasKt=own.iasKt*(440/293);own.gsKt=own.tasKt+8;
  own.mach=Math.min(.98,Math.max(0,own.iasKt/293*.73));
  own.pitchDeg=Number(by('pitch').value);targetPitch=own.pitchDeg;own.vsFpm=Number(by('vs').value);
  initialAltitudeFt=own.altitudeFt;
  own.trueTrackDeg=own.trueHeadingDeg=Cruise.route({elapsedSec:0,groundSpeedKt:own.gsKt}).own.headingDeg;
  const options={};
  if(by('converging').checked){options.converging=true;options.lateralSide=by('intruderSide').value;}
  if(by('relative').value.trim())options.relativeAltitudeFt=Number(by('relative').value);
  if(by('intruderVS').value.trim())options.verticalRateFpm=Number(by('intruderVS').value);
  encounter=C.create(scenario.value,own,options);refresh();}
 function refresh(){if(!encounter)return;encounter=C.step(encounter,own,0,settings,feeds());out=encounter.output;paint();}
 function step(dt){
  const change=Math.max(-3*dt,Math.min(3*dt,targetPitch-own.pitchDeg));own.pitchDeg+=change;
  own.vsFpm=Math.sin((own.pitchDeg-2)*Math.PI/180)*own.tasKt*6076.11549/60;
  own.altitudeFt+=own.vsFpm*dt/60;own.radioAltitudeFt+=own.vsFpm*dt/60;own.elapsedSec+=dt;
  // LNAV-like simulation follows each route leg and turns to the next fix.
  own.trueTrackDeg=own.trueHeadingDeg=Cruise.route({elapsedSec:own.elapsedSec,groundSpeedKt:own.gsKt}).own.headingDeg;
  encounter=C.step(encounter,own,dt,settings,feeds());out=encounter.output;paint();
 }
 function syncTfc(){
  const button=by('tfc');
  button.textContent=tfcVisible?'TFC ON':'TFC OFF';
  button.className=tfcVisible?'tfc-on':'tfc-off';
  button.setAttribute?.('aria-pressed',String(tfcVisible));
 }
 function paint(){
  const state=Core.initial();
  state.eadi.pitch=own.pitchDeg;state.eadi.bank=0;
  // The two attitude inputs agree: do not generate an artificial PITCH compare flag.
  state.eadi.otherPitch=own.pitchDeg;state.eadi.otherBank=0;
  state.eadi.ias=own.iasKt;state.eadi.mach=own.mach;state.eadi.machVisible=true;
  state.eadi.groundSpeed=own.gsKt;state.eadi.radioAlt=own.radioAltitudeFt;
  state.eadi.dh=-20; // Instructor cruise: no DH setting, not a failed DH sensor.
  state.eadi.fmaFontScale=.88; // TCAS Lab only; Unified FMA lettering is unchanged.
  state.eadi.selectedSpeed=own.iasKt;state.eadi.fmcCommandSpeed=own.iasKt;
  state.eadi.tcasRa=out.ra;
  // Cruise FMC guidance is unchanged by a TCAS response: the crew
  // disengages CMD and flies the RA with the flight director available.
  state.eadi.at='FMC SPD';state.eadi.pitchMode='VNAV PTH';state.eadi.rollMode='LNAV';
  state.eadi.afds=autopilotEngaged?'CMD':'FD';state.eadi.apEngaged=autopilotEngaged;
  state.eadi.fd=true;state.eadi.fdAuto=false;state.eadi.fdPitch=targetPitch;state.eadi.fdRoll=0;
  state.eadi.fmcVerticalValid=true;state.eadi.phase='CRUISE';
  win.EFISDisplayLabEadi.render(by('eadi'),state,Core);
  const cruise=Cruise.route({elapsedSec:own.elapsedSec,groundSpeedKt:own.gsKt});
  const ambient=Cruise.ambient({elapsedSec:own.elapsedSec,ownAltitudeFt:own.altitudeFt,
   initialAltitudeFt,ownGroundSpeedKt:own.gsKt});
  // Ambient contacts are visual-only; TCAS guidance comes exclusively from C.step.
  const traffic={...out,targets:[...out.targets,...ambient]};
  win.EFISClassicEHSIV2.render(by('ehsi'),{mode:by('displayMode').value,range:Number(by('range').value),
   heading:own.trueHeadingDeg,track:own.trueTrackDeg,geoTrack:own.trueTrackDeg,selectedHeading:own.trueTrackDeg,
   trueRef:false,nav:cruise.nav,route:cruise.route,options:{tfc:tfcVisible},traffic,
   trueAirspeed:own.tasKt,groundSpeed:own.gsKt,syntheticAirport:false,
   trafficLabelOffsetY:12,
   efis:{displayPower:true,sgValid:true,headingValid:!settings.failures.irs,trackValid:!settings.failures.irs},weather:{}});
  by('status').textContent=[out.mode,out.stage,out.callout,...out.inhibits].filter(Boolean).join(' · ');
  const t=out.transponder;by('xpdr').textContent='ATC '+t.selectedUnit+' · '+t.displayedCode+' · MODE S '+(t.modeS?'ON':'OFF')+' · ALT '+(t.altitudeReporting?'REPORTING':'OFF / INVALID')+' · '+(t.atcFailLight?'ATC FAIL / TEST':'NORMAL')+(t.ident?' · IDENT':'');
  by('ownState').textContent='SIM UTC '+cruise.utc+' · NEXT '+cruise.next+
   ' · DIST '+cruise.distanceNm.toFixed(1)+' NM · TTG '+cruise.timeToGo+
   ' · ETA '+cruise.eta+' · GS '+Math.round(own.gsKt)+' KT · TAS '+Math.round(own.tasKt)+
   ' KT · IAS '+Math.round(own.iasKt)+' KT · M '+own.mach.toFixed(2)+
   ' · ALT '+Math.round(own.altitudeFt)+' FT · VS '+Math.round(own.vsFpm)+' FPM';
  const tbody=by('trafficRows');tbody.replaceChildren();for(const t of traffic.targets){const tr=document.createElement('tr');
   const clock=Number.isFinite(t.bearing)?((Math.round(((t.bearing-own.trueHeadingDeg+360)%360)/30)%12)||12):'—';
   for(const value of [t.id,t.kind,clock,t.distance.toFixed(2),t.relativeAltitude===null?'UNKNOWN':Math.round(t.relativeAltitude),t.verticalRate??'—',t.verticalRelation??'—',Number.isFinite(t.tcpaSec)?t.tcpaSec.toFixed(1):'—']){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}tbody.append(tr);}
 }
 function guard(fn){return ()=>{try{fn();}catch(e){by('status').textContent=e.message;}};}
 by('start').onclick=guard(load);by('play').onclick=()=>{running=!running;last=null;by('play').textContent=running?'PAUSE':'RUN';};by('step').onclick=guard(()=>step(1));
 by('respond').onclick=guard(()=>{
  if(!out?.ra)return;
  // EADI annunciator changes immediately, not only at the next RUN frame.
  autopilotEngaged=false;
  const zones=out.ra.avoid;
  targetPitch=zones.length===2?(zones[0].pitchDeg+zones[1].pitchDeg)/2:
   (zones[0]?.pitchDeg??2)+(zones[0]?.side==='BELOW'?.3:-.3);
  by('pitch').value=targetPitch.toFixed(1);
  paint();
 });
 for(const [id,key] of [['mode','mode'],['unit','unit'],['altSource','altSource'],['code','code'],['filter','filter']])by(id).onchange=guard(()=>{settings[key]=['unit','altSource'].includes(key)?Number(by(id).value):by(id).value;refresh();});
 by('pitch').onchange=()=>{targetPitch=Number(by('pitch').value);};
 by('vs').onchange=()=>{targetPitch=2+Math.asin(Math.max(-.7,Math.min(.7,Number(by('vs').value)/(own.tasKt*6076.11549/60))))*180/Math.PI;by('pitch').value=targetPitch.toFixed(1);};
 by('priority').onchange=()=>{settings.priorityWarning=by('priority').checked;refresh();};
 for(const id of ['displayMode','range','bus1','bus2','atc2cb'])by(id).onchange=refresh;
 by('tfc').onclick=()=>{tfcVisible=!tfcVisible;syncTfc();paint();};
 by('ident').onclick=()=>{settings.identUntil=own.elapsedSec+1;refresh();};by('absolute').onclick=()=>{settings.absoluteUntil=own.elapsedSec+15;refresh();};
 function tick(now){if(running&&last!==null){const dt=Math.min(.2,(now-last)/1000)*Number(by('rate').value);try{step(dt);}catch(e){running=false;by('status').textContent=e.message;}}last=now;requestAnimationFrame(tick);}
 syncTfc();load();requestAnimationFrame(tick);
})(window);
