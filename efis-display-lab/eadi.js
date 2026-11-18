/* Classic EADI display. Canvas coordinates follow the FSI figure in FCOM 10.30.7. */
(function(root,factory){
 const api=factory(root.EFISLabGlyphs,root.B737ClassicSpeedTapeEngineV1,root.B737ClassicFlapSpeedProfileV1,root.B737UnifiedSpeedTapeV1,root.B737FmaModeEngineV1,root.B737EADIFMAFcomV2,root.B737EfisReferenceGeometry??(typeof require==='function'?require('./reference-geometry.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.EFISDisplayLabEadi=api;
 // Allow Unified to repaint when a deferred source finishes loading; DOM
 // readiness and paint readiness are separate states.
 if(root.document&&root.dispatchEvent&&root.CustomEvent)
  root.dispatchEvent(new root.CustomEvent('b737:efis-lab-eadi-ready'));
})(globalThis,function(glyph,speedEngine,flaps,speedLayer,fmaEngine,fmaLayer,geometry){
'use strict';
const G=geometry.eadi;
const W=640,H=640,[CX,CY]=G.center,SCALE=G.attitude.pitchPerDeg;
const C=glyph?.colors;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const rad=n=>n*Math.PI/180;
const {white:WHITE,green:GREEN,magenta:MAGENTA,amber:AMBER,red:RED}=C||{};
function line(c,x,y,X,Y,color=WHITE,width=2){
 c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function txt(c,value,x,y,size=18,color=WHITE,align='left'){
 if(value!==null&&value!==undefined&&value!=='')glyph.canvas(c,value,x,y,size,color,align,.83);
}
function shape(c,points,{fill=null,stroke=WHITE,width=2}={}){
 c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
 if(fill){c.fillStyle=fill;c.fill();}
 if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function circle(c,x,y,r,stroke=WHITE,fill=null,width=2){
 c.beginPath();c.arc(x,y,r,0,Math.PI*2);
 if(fill){c.fillStyle=fill;c.fill();}
 if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function box(c,value,x,y,size=19){
 const width=String(value).length*size*.62+13;
 c.fillStyle='#000';c.fillRect(x-width/2,y-12,width,24);
 c.strokeStyle=AMBER;c.lineWidth=1.5;c.strokeRect(x-width/2,y-12,width,24);
 txt(c,value,x,y,size,AMBER,'center');
}
function aperture(c){
 const {left,right,top,bottom,shoulder,heel}=G.attitude;
 c.beginPath();c.moveTo(left,shoulder);
 c.bezierCurveTo(211,155,264,top,CX,top);
 c.bezierCurveTo(376,top,427,155,right,shoulder);c.lineTo(right,heel);
 c.bezierCurveTo(428,514,377,bottom,CX,bottom);
 c.bezierCurveTo(263,bottom,212,514,left,heel);
 c.closePath();
}
function attitude(c,e,v){
 const bank=clamp(e.bank,-180,180),pitch=clamp(e.pitch,-90,90)*SCALE;
 c.save();aperture(c);c.clip();
 if(v.raster){c.fillStyle='#123862';c.fillRect(0,0,W,H);}
 c.save();c.translate(CX,CY);c.rotate(-rad(bank));
 if(v.raster){c.fillStyle='#623818';c.fillRect(-1200,pitch,2400,1700);}
 line(c,-1200,pitch,1200,pitch,WHITE,3.2);
 for(let marking=-90;marking<=90;marking+=2.5){
  if(marking===0)continue;
  const a=Math.abs(marking),y=pitch-marking*SCALE,major=a%10===0;
  const t=G.attitudeTicks,width=major?t.major:a%5===0?t.intermediate:t.minor;
  line(c,-width,y,width,y,WHITE,major?2.7:1.9);
  if(major){txt(c,a,-width-8,y,t.labelSize,WHITE,'right');txt(c,a,width+8,y,t.labelSize);}
 }
 if(e.tcas!=='OFF'){
  const boundary=pitch-clamp(e.tcasLimit,-35,35)*SCALE;
  const bottom=e.tcas==='UP'?boundary+53:boundary;
  const top=e.tcas==='UP'?boundary:boundary-53;
  c.save();c.beginPath();c.rect(-123,top,246,bottom-top);c.clip();
  for(let x=-175;x<145;x+=10)line(c,x,top,x+39,bottom,RED,2.1);
  c.restore();
  line(c,-123,boundary,123,boundary,RED,3);
 }
 // Classic FCOM 10.30.12-13: red pitch attitudes to AVOID, no green
 // fly-to director. The cue moves with the pitch card and its bank.
 for(const zone of e.tcasRa?.avoid||[]){
  const boundary=pitch-clamp(zone.pitchDeg,-35,35)*SCALE;
  const sign=zone.side==='BELOW'?1:-1,far=boundary+sign*145;
  line(c,-91,far,-39,boundary,RED,3);
  line(c,-39,boundary,39,boundary,RED,3);
  line(c,39,boundary,91,far,RED,3);
  for(let i=0;i<8;i++){
   const dy=sign*(i*17+9),x=39+52*Math.abs(dy)/145;
   line(c,-x,boundary+dy,-x-8,boundary+dy-sign*8,RED,1.9);
   line(c,x,boundary+dy,x+8,boundary+dy-sign*8,RED,1.9);
  }
 }
 if(e.pli||e.flaps>0){
  const y=pitch-clamp(e.pliAngle,0,30)*SCALE;
  for(const side of [-1,1]){
   line(c,side*65,y,side*104,y,AMBER,2.6);
   for(let n=0;n<5;n++)line(c,side*(65+n*8),y,side*(69+n*8),y-8,AMBER,1.8);
  }
 }
 c.restore();
 for(const side of [-1,1]){
  const points=[[31,-6],[104,-6],[108,-3],[108,6],[37,6],[37,37],[29,37],[29,-2]].map(([x,y])=>[CX+x*side,CY+y]);
  shape(c,points,{fill:'#080a0c',width:2.6});
 }
 circle(c,CX,CY,5.8,WHITE,'#080a0c',2);
 if(v.fd){
  const y=CY-clamp(e.fdPitch-e.pitch,-23,23)*SCALE;
  const x=CX+clamp(e.fdRoll-e.bank,-31,31)*3.8;
  const d=G.director,cue='#ee43e7';
  if(v.fdPitch!==false)line(c,CX-d.halfHorizontal,y,CX+d.halfHorizontal,y,cue,d.stroke);
  if(v.fdRoll!==false)line(c,x,CY-d.halfVertical,x,CY+d.halfVertical,cue,d.stroke);
 }
 c.restore();
 for(const a of [-60,-45,-30,-20,-10,10,20,30,45,60]){
  const t=rad(a),inner=a%30===0?214:216,outer=a%30===0?244:234;
  line(c,CX+Math.sin(t)*inner*.72,CY-Math.cos(t)*inner,
         CX+Math.sin(t)*outer*.72,CY-Math.cos(t)*outer,WHITE,a%30===0?3:2.1);
 }
 const bankMark=G.movingBank,fixed=G.fixedBank;
 shape(c,[[CX-fixed.width/2,fixed.top],[CX+fixed.width/2,fixed.top],[CX,fixed.tip]],{fill:WHITE,stroke:null});
 c.save();c.translate(CX,CY);c.scale(.72,1);c.rotate(-rad(bank));
 const tip=-bankMark.radius;
 shape(c,[[0,tip+4],[-bankMark.width/1.44,tip+bankMark.height],[bankMark.width/1.44,tip+bankMark.height]],{width:2.5});
 c.restore();

}
function fmaInput(state,v){
 const {eadi:e,power:p,seat}=state;
 const cwsPitch=e.afds==='CWS P'||e.afds==='CWS BOTH';
 const cwsRoll=e.afds==='CWS R'||e.afds==='CWS BOTH';
 const cmd=e.afds==='CMD'||cwsPitch||cwsRoll;
 const pitch=e.pitchMode==='LVL CHG'?'MCP SPD':e.pitchMode;
 const selected=(field,value)=>fmaEngine.MODES[field].includes(value)?value:'';
 const armed=(field,value)=>fmaEngine.ARMED[field].includes(value)?value:'';
 const locCaptured=e.locCaptured&&p.loc;
 const gsCaptured=e.gsCaptured&&v.gs&&locCaptured;
 const fmcVerticalValid=e.fmcVerticalValid&&p.nav;
 const pitchReady={ 'G/S':gsCaptured,'VNAV SPD':fmcVerticalValid,'VNAV PTH':fmcVerticalValid,'ALT ACQ':e.altAcquire };
 const pitchActive=pitchReady[pitch]===false?'':selected('pitch',pitch);
 const rollActive=e.rollMode==='VOR/LOC'&&!locCaptured?'':selected('roll',e.rollMode);
 const output={schema:'B737_MCP_AFDS_OUTPUT_V1',power:v.powered&&v.sg,
  controls:{atArm:!!e.at,fd:{left:v.fd,right:v.fd}},
  modes:{thrust:null,vertical:pitchActive||null,lateral:rollActive||null,autopilot:cmd?'CMD_A':null},
  axisControl:{pitch:cwsPitch||!pitchActive?'CWS':'CMD',roll:cwsRoll||!rollActive?'CWS':'CMD'}};
 const director=cmd||e.afds==='FD'&&v.fd;
 const observation={schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat,
  fields:{
   at:{active:selected('at',e.at)},
   pitch:{active:director&&!cwsPitch?pitchActive:'',armed:director?armed('pitch',e.armedPitch):''},
   roll:{active:director&&!cwsRoll?rollActive:'',armed:director?armed('roll',e.armedRoll):''}
  },
  evidence:{locCaptured,navCaptured:locCaptured,gsCaptured,fmcVerticalValid,altAcquire:e.altAcquire===true}};
 return fmaEngine.project(output,seat,observation);
}
function tapeInput(state,v,fma=fmaInput(state,v)){
 const e=state.eadi,engine=speedEngine;
 const ias=clamp(e.ias,0,450),prior=clamp(ias-e.acceleration,0,450),takeoff=e.phase==='TAKEOFF';
 const detent=Number(e.flaps),flapPosition=clamp(e.flaps,0,40);
 const flap=flaps.DETENTS.includes(detent)?flaps.get(detent,{flap30MaximumKt:Number(e.flap30MaximumKt)}):null;
 const gear=e.gearState==='UNKNOWN'?null:e.gearState;
 const source=e.speedSource==='AUTO'?(fma.at.active==='FMC SPD'?'FMC':'MCP'):e.speedSource;
 let s=engine.initialState(state.seat);
 const apply=event=>{s=engine.transition(s,event);};
 if(v.ias){
  for(const [casKt,timeMs] of [[prior,0],[ias,1000]])
   apply({type:'TRAINING_CAS',origin:'TRAINING_SCENARIO',casKt,mach:clamp(e.mach,0,.99),timeMs});
 }
 apply({type:'MCP',powered:true,displayBlank:source==='FMC',selectedCasKt:clamp(e.selectedSpeed,0,450),speedDisplayMode:'IAS'});
 apply({type:'CONFIG',phase:e.phase,flapsPosition:flapPosition,gearState:gear,inFlight:e.radioAlt>0});
 apply({type:'FMC',valid:state.power.nav,grossWeightAvailable:false,commandCasKt:clamp(e.fmcCommandSpeed,0,450),
  v1Kt:takeoff?e.v1:null,vrKt:takeoff?e.vr:null,selectedVrefKt:e.phase==='APPROACH'?e.vref:null});
 apply({type:'COMMAND_AUTHORITY',source});
 apply({type:'FAILURES',speed:!v.ias,selectedSpeed:!state.power.selSpeed,v1:!state.power.v1Data,speedLimit:!state.power.speedLimit,mach:!state.power.machData});
 if(flap)apply({type:'TRAINING_FLAP_PROFILE',source:'INSTRUCTOR_VISUAL_DETENT',detent,maximumKt:flap.maximumKt,bufferKt:flap.bufferKt});
 apply({type:'TRAINING_GEAR_PROFILE',source:'INSTRUCTOR_VISUAL_GEAR',gearState:gear});
 if(e.demoLimits)apply({type:'LIMITS',valid:true,minimumManeuverKt:e.minManeuver,stickShakerKt:e.shaker,
  vmoMmoCasKt:e.vmo,flapPlacardKt:flap?.maximumKt,flapBufferKt:flap?.bufferKt,
  flapRetractionKt:e.retractSpeed,flapsUpManeuverKt:e.flapsUpSpeed});
 return engine.view(s);
}
function speedTape(c,view){
 const {axis,centerY,scaleX,scaleY}=G.tape;
 c.save();
 c.translate(axis-speedLayer.TAPE.axis*scaleX,centerY-speedLayer.TAPE.centerY*scaleY);
 c.scale(scaleX,scaleY);
 speedLayer.draw(c,view,{reference:true,glyph});
 c.restore();
}
const fmaTimers=new WeakMap();
function drawFma(c,seat){
 fmaLayer.renderReference(c,seat,G.fma,glyph);
}
function flightModes(canvas,c,seat,fields){
 const changed=fmaLayer.accept(seat,fields);
 drawFma(c,seat);
 if(!changed||typeof globalThis.setTimeout!=='function')return;
 // The shared renderer owns the 10-second deadline. Standalone EADI supplies
 // only the repaint because it is not registered as a Unified cockpit layer.
 const timer=fmaTimers.get(canvas);
 if(timer!==undefined)globalThis.clearTimeout(timer);
 fmaTimers.set(canvas,globalThis.setTimeout(()=>{
  fmaTimers.delete(canvas);
  if(canvas.dataset.fmaSeat===seat)drawFma(c,seat);
 },10025));
}
function diamond(c,x,y,color=MAGENTA){
 shape(c,[[x-8,y],[x,y-10],[x+8,y],[x,y+10]],{fill:'#060606',stroke:color,width:2.3});
}
function approach(c,e,v){
 if(v.gsScale&&(!e.suppressGsScale)){
  for(const i of [-2,-1,1,2])circle(c,566,CY+i*25,3.8);
  line(c,556,CY,576,CY,WHITE,1.6);
  if(v.gs)diamond(c,566,CY+clamp(e.gsDev,-2.3,2.3)*25);
 }
 if(v.ils){
  const y=535,dot=v.locExpanded?51:31,color=v.locWarning?AMBER:WHITE;
  for(const i of [-2,-1,1,2])circle(c,CX+i*dot,y,3.6,color);
  line(c,CX,y-8,CX,y+8,color,1.8);
  if(v.loc){
   const x=CX+clamp(e.locDev*(v.locExpanded?2:1),-2.25,2.25)*dot;
   diamond(c,x,y);
   if(v.runway){
    const progress=clamp((200-v.radioAlt)/200,0,1),yy=y-45-progress*134;
    const w=18+8*progress;
    shape(c,[[x-w,yy-10],[x+w,yy-10],[x+w-6,yy+10],[x-w+6,yy+10]],{stroke:GREEN,width:2.7});
    line(c,x,yy-7,x,yy+7,GREEN,1.8);
   }
  }else if(v.locFlag)box(c,'LOC',CX,y);
 }
 if(v.dhDigital)txt(c,'DH'+e.dh,G.dh.x,G.dh.y,G.dh.size,'#26ed36');
 else if(v.flags.includes('DH'))box(c,'DH',566,445);
 if(!v.ra){if(v.radioAlt===null)box(c,'RA',552,546);return;}
 const color=v.dhAlert?AMBER:WHITE;
 if(v.dial){
  const x=537,y=503,r=50;
  c.beginPath();c.arc(x,y,r,rad(105),rad(372));c.strokeStyle=color;c.lineWidth=2.1;c.stroke();
  for(let i=0;i<=10;i++){
   const a=rad(115+i*24),p=i%5===0?8:4;
   line(c,x+Math.cos(a)*r,y+Math.sin(a)*r,x+Math.cos(a)*(r-p),y+Math.sin(a)*(r-p),color,1.8);
  }
  if(v.dhPointer){
   const a=rad(115+240*e.dh/1000),col=v.dhAlert?AMBER:MAGENTA;
   line(c,x+Math.cos(a)*(r-13),y+Math.sin(a)*(r-13),x+Math.cos(a)*(r+3),y+Math.sin(a)*(r+3),col,3.3);
  }
  if(v.heightAlert){c.strokeStyle=WHITE;c.lineWidth=1.5;c.strokeRect(508,489,58,26);}
  txt(c,Math.round(v.radioAlt),x,y,27,color,'center');
 }else txt(c,Math.round(v.radioAlt),G.radioAltitude.x,G.radioAltitude.y,G.radioAltitude.size,color);
}
function render(canvas,state,core,live){
 if(!canvas)return;
 const c=canvas.getContext('2d'),e=state.eadi,v=core.evaluate(state);
 if(canvas.width!==W)canvas.width=W;
 if(canvas.height!==H)canvas.height=H;
 canvas.style.opacity=String(e.brightness);
 c.fillStyle='#000';c.fillRect(0,0,W,H);
 canvas.dataset.fmaSeat='';
 canvas.dataset.efisReferenceGeometry='B733-20261116';
 if(!v.powered)return;
 if(!v.sg){txt(c,'SG FAIL',CX,CY+46,30,AMBER,'center');return;}
 const fma=live?null:fmaInput(state,v),speed=live?live.speedView:tapeInput(state,v,fma);
 canvas.dataset.fmaSeat=state.seat;
 // Unified receives authoritative MCP/FCC annunciations from its live
 // FMA owner. Do not overwrite them with the lab demonstration projection.
 if(live)drawFma(c,state.seat);
 else flightModes(canvas,c,state.seat,fma);
 const fields=live?fmaLayer.getState(state.seat).fields:fma;
 const axes=[fields?.afds?.secondary,fields?.afds?.tertiary];
 if(v.attitude)attitude(c,e,{...v,fdPitch:e.fdPitchValid!==false&&!axes.includes('CWS P'),fdRoll:e.fdRollValid!==false&&!axes.includes('CWS R')});else box(c,'ATT',CX,CY);
 if(v.flags.includes('FD'))box(c,'FD',466,104);
 if(speed)speedTape(c,speed);
 approach(c,e,v);
 const mach=live?speed?.actualMach??(v.mach?e.mach:null):v.ias&&v.mach?e.mach:null;
 if(Number.isFinite(mach)&&mach>=.4&&!speed?.flags?.MACH)
  txt(c,mach.toFixed(3).replace(/^0/,''),G.mach.x,G.mach.y,G.mach.size);
 if(v.flags.includes('MACH'))box(c,'MACH',81,539,16);
 if(e.windshear)txt(c,'WINDSHEAR',CX,463,33,RED,'center');
 else if(e.pullup)txt(c,'PULL UP',CX,463,33,RED,'center');
 // Classic FCOM locates TRAFFIC on EHSI; EADI carries the red pitch fence.
 const comparison=live?.comparison??v.comparison;
 for(const [i,flag] of comparison.entries())box(c,flag,CX+(i-(comparison.length-1)/2)*78,566);
 c.strokeStyle='#809189';c.lineWidth=1.5;
 c.strokeRect(CX-47,592,94,18);
 line(c,CX-9,593,CX-9,609,WHITE,1.35);line(c,CX+9,593,CX+9,609,WHITE,1.35);
 circle(c,CX+clamp(e.slip,-10,10)*3.4,601,6,'#758179','#151716',1.7);
 return {fma,speedTape:speed};
}
// Unified adapter: use the same new Classic EADI attitude renderer without
// instructor-only FMA, IAS, ILS, TCAS, or fabricated flight data. The
// established Unified FMA and speed-tape publishers own those live layers.
// Canvas coordinates deliberately remain 900x720 for both crew sockets.
function renderUnifiedAttitude(canvas,input={}){
 if(!canvas)return false;
 const c=canvas.getContext('2d',{alpha:false});
 if(!c)return false;
 const w=canvas.width,h=canvas.height;
 c.save();
 c.setTransform(1,0,0,1,0,0);
 c.fillStyle='#000';c.fillRect(0,0,w,h);
 if(input.powered===false){c.restore();return true;}
 if(input.attitudeValid===false){
  // Fail closed rather than drawing a false level horizon.
  box(c,'ATT',w/2,h*.515,27);
  c.restore();return true;
 }
 const pitch=Number.isFinite(input.pitch)?Math.max(-90,Math.min(90,input.pitch)):0;
 const bank=Number.isFinite(input.bank)?Math.max(-180,Math.min(180,input.bank)):0;
 // Existing owner-approved native glass rectangles are unchanged.
 // New EADI attitude card occupies ~45% glass width / ~70% glass height.
 c.translate(w*.5,h*.515);
 c.scale(w/900*1.35,h/720*1.25);
 c.translate(-CX,-CY);
 attitude(c,{pitch,bank,tcas:'OFF',flaps:0,pli:false,
   fdPitch:Number.isFinite(input.fdPitch)?input.fdPitch:0,
   fdRoll:Number.isFinite(input.fdRoll)?input.fdRoll:0},
   {raster:true,fd:input.fdValid===true});
 c.restore();
 return true;
}
// FULL lab presentation projected from Unified avionics evidence. In contrast
// to the earlier attitude-only bridge, this runs the real EFIS Lab EADI
// renderer (glass, attitude, FMA, tape, flags, ILS / DH) in the cockpit.
// The laboratory's demonstration data is NEVER allowed through unchanged.
function renderUnifiedFull(canvas,input={}){
 if(!canvas)return false;
 const core=globalThis.EFISDisplayLabCore;
 if(!core?.initial||!core?.evaluate)return false;
 const state=core.initial(),e=state.eadi,p=state.power;
 state.seat=input.seat==='FO'?'FO':'CAPT';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const observed=(x,def=null)=>finite(x)?x:def;
 e.pitch=observed(input.pitch,0);e.bank=observed(input.bank,0);
 e.slip=0;e.tcas='OFF';e.pli=false;e.flaps=0;e.demoLimits=false;
 e.tcasRa=input.tcas?.advisory==='RA'?input.tcas.ra:null;
 canvas.dataset.tcasAdvisory=input.tcas?.advisory||'';
 canvas.dataset.tcasRa=e.tcasRa?.id||'';
 e.ias=observed(input.iasKt,0);e.selectedSpeed=observed(input.selectedSpeedKt,0);
 e.mach=observed(input.mach,0);e.machVisible=finite(input.mach);
 e.groundSpeed=observed(input.groundSpeedKt);
 e.brightness=observed(input.brightness,1);
 e.radioAlt=observed(input.radioAltFt,0);e.dh=observed(input.dhFt,-20);
 e.fdPitchValid=finite(input.director?.pitchDeg);e.fdRollValid=finite(input.director?.rollDeg);
 e.fd=input.director?.enabled===true&&(e.fdPitchValid||e.fdRollValid);
 e.fdAuto=false;e.fdPitch=observed(input.director?.pitchDeg,0);e.fdRoll=observed(input.director?.rollDeg,0);
 e.locDev=observed(input.locDeviation,0);e.gsDev=observed(input.gsDeviation,0);
 e.frontCourse=input.frontCourse===true;e.suppressGsScale=input.frontCourse!==true;e.locCaptured=input.director?.locCaptured===true;e.gsCaptured=input.director?.gsCaptured===true;
 e.ilsSelected=false;e.windshear=false;e.pullup=false;
 e.pitchMode='';e.rollMode='';e.at='';e.afds='';e.armedPitch='';e.armedRoll='';
 e.phase='GROUND';e.v1=0;e.vr=0;e.vref=0;e.shaker=0;
 e.minManeuver=0;e.vmo=0;e.acceleration=0;e.speedSource='MCP';
 e.fmcCommandSpeed=0;e.retractSpeed=0;e.flapsUpSpeed=0;
 e.apEngaged=false;e.descent=false;e.dhLatched=input.dhLatched===true;
 p.eadi=input.powered!==false;p.ehsi=false;
 p.sg1=true;p.sg2=true;p.att=input.attitudeValid!==false;
 // A documented simulator attitude level datum is visible until real
 // flight attitude telemetry is connected; it is not an IRS navigation fix.
 p.irsLeft=input.attitudeValid!==false;
 p.irsRight=input.attitudeValid!==false;
 p.adc=finite(input.iasKt);p.machData=finite(input.mach);
 // MCP numeric value is blank in VNAV and may represent Mach rather
  // than CAS; that is not a failed selected-speed source. The real
  // MCP electrical state, not the current numeric window, validates it.
  p.selSpeed=input.selectedSpeedValid===true;
 p.nav=false;p.loc=finite(input.locDeviation);p.gs=finite(input.gsDeviation);
 p.ra=finite(input.radioAltFt);
 p.fd=e.fd;p.dhData=finite(input.dhFt);
 p.v1Data=false;p.speedLimit=false;p.fmcTrack=false;
 state.ehsi.navType=input.ils===true?'ILS':'VOR';
 state.ehsi.track=0;state.ehsi.course=0;
 canvas.dataset.eadiUnifiedFull='true';
 render(canvas,state,core,input);
 canvas.dataset.eadiRenderer='EFIS-LAB-FULL-0005-MCP';
 canvas.dataset.eadiSource=input.source||'UNKNOWN';
 return true;
}
return {render,tapeInput,fmaInput,renderUnifiedAttitude,renderUnifiedFull};
});
