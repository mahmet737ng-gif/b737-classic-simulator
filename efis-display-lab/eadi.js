/* Classic EADI display. Canvas coordinates follow the FSI figure in FCOM 10.30.7. */
(function(root,factory){
 const api=factory(root.EFISLabGlyphs,root.B737ClassicSpeedTapeEngineV1,root.B737ClassicFlapSpeedProfileV1,root.B737UnifiedSpeedTapeV1,root.B737FmaModeEngineV1,root.B737EADIFMAFcomV2);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.EFISDisplayLabEadi=api;
})(globalThis,function(glyph,speedEngine,flaps,speedLayer,fmaEngine,fmaLayer){
'use strict';
const W=640,H=640,CX=328,CY=310,SCALE=6;
const C=glyph?.colors;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const rad=n=>n*Math.PI/180;
const {white:WHITE,green:GREEN,magenta:MAGENTA,amber:AMBER,red:RED}=C||{};
function line(c,x,y,X,Y,color=WHITE,width=2){
 c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function txt(c,value,x,y,size=18,color=WHITE,align='left'){
 if(value!==null&&value!==undefined&&value!=='')glyph.canvas(c,value,x,y,size,color,align);
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
 c.beginPath();c.moveTo(177,259);c.bezierCurveTo(177,174,241,119,CX,119);
 c.bezierCurveTo(413,119,478,174,478,259);c.lineTo(478,410);
 c.bezierCurveTo(478,479,409,518,CX,518);c.bezierCurveTo(245,518,177,479,177,410);
 c.closePath();
}
function attitude(c,e,v){
 const bank=clamp(e.bank,-180,180),pitch=clamp(e.pitch,-90,90)*SCALE;
 c.save();aperture(c);c.clip();
 if(v.raster){c.fillStyle='#1766b4';c.fillRect(0,0,W,H);}
 c.save();c.translate(CX,CY);c.rotate(-rad(bank));
 if(v.raster){c.fillStyle='#825122';c.fillRect(-1200,pitch,2400,1700);}
 line(c,-1200,pitch,1200,pitch,WHITE,3.2);
 for(let marking=-90;marking<=90;marking+=2.5){
  if(marking===0)continue;
  const a=Math.abs(marking),y=pitch-marking*SCALE,major=a%10===0;
  const width=major?57:a%5===0?29:13;
  line(c,-width,y,width,y,WHITE,major?2.7:1.9);
  if(major){txt(c,a,-width-8,y,19,WHITE,'right');txt(c,a,width+8,y,19);}
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
 if(e.pli||e.flaps>0){
  const y=pitch-clamp(e.pliAngle,0,30)*SCALE;
  for(const side of [-1,1]){
   line(c,side*65,y,side*104,y,AMBER,2.6);
   for(let n=0;n<5;n++)line(c,side*(65+n*8),y,side*(69+n*8),y-8,AMBER,1.8);
  }
 }
 c.restore();
 if(v.fd){
  const y=CY-clamp(e.fdPitch-e.pitch,-23,23)*SCALE;
  const x=CX+clamp(e.fdRoll-e.bank,-31,31)*3.8;
  line(c,CX-95,y,CX+95,y,MAGENTA,4);
  line(c,x,CY-94,x,CY+94,MAGENTA,4);
 }
 for(const side of [-1,1]){
  const points=[[37,-5],[112,-5],[112,6],[51,6],[51,25],[37,25]].map(([x,y])=>[CX+x*side,CY+y]);
  shape(c,points,{fill:'#030303',width:2.4});
 }
 circle(c,CX,CY,8,WHITE,'#030303',2.2);
 c.restore();
 for(const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){
  const r=192,r2=r+([0,30,60].includes(Math.abs(a))?17:11);
  line(c,CX+Math.sin(rad(a))*r,CY-Math.cos(rad(a))*r,CX+Math.sin(rad(a))*r2,CY-Math.cos(rad(a))*r2,WHITE,2.5);
 }
 c.save();c.translate(CX,CY);c.rotate(-rad(bank));
 shape(c,[[-9,-176],[9,-176],[0,-192]],{fill:WHITE,stroke:null});
 c.restore();
 shape(c,[[CX-9,91],[CX+9,91],[CX,104]],{width:2.1});
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
 const scale=.665;
 c.save();
 c.translate(135-speedLayer.TAPE.axis*scale,CY-speedLayer.TAPE.centerY*scale);
 c.scale(scale,scale);
 speedLayer.draw(c,view);
 c.restore();
}
const fmaTimers=new WeakMap();
function drawFma(c,seat){
 c.save();c.translate(7,13);c.scale(.696,.69);
 fmaLayer.render(c,seat);
 c.restore();
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
 if(v.gsScale){
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
 if(v.dhDigital)txt(c,'DH'+e.dh,568,510,20,GREEN,'right');
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
 }else txt(c,Math.round(v.radioAlt),572,544,23,color,'right');
}
function render(canvas,state,core){
 if(!canvas)return;
 const c=canvas.getContext('2d'),e=state.eadi,v=core.evaluate(state);
 if(canvas.width!==W)canvas.width=W;
 if(canvas.height!==H)canvas.height=H;
 canvas.style.opacity=String(e.brightness);
 c.fillStyle='#000';c.fillRect(0,0,W,H);
 canvas.dataset.fmaSeat='';
 if(!v.powered)return;
 if(!v.sg){txt(c,'SG FAIL',CX,CY+46,30,AMBER,'center');return;}
 const fma=fmaInput(state,v),speed=tapeInput(state,v,fma);
 canvas.dataset.fmaSeat=state.seat;
 flightModes(canvas,c,state.seat,fma);
 if(v.attitude)attitude(c,e,v);else box(c,'ATT',CX,CY);
 if(v.flags.includes('FD'))box(c,'FD',466,104);
 speedTape(c,speed);approach(c,e,v);
 if(v.ias&&v.mach)txt(c,Number(e.mach).toFixed(3).slice(1),104,539,22,WHITE,'right');
 if(v.flags.includes('MACH'))box(c,'MACH',81,539,16);
 const gs=clamp(e.groundSpeed,0,999);
 if(state.power.fmcTrack||v.source.irsValid){
  txt(c,'GS',129,517,14);txt(c,Math.round(gs),129,539,21);
 }
 if(e.windshear)txt(c,'WINDSHEAR',CX,463,33,RED,'center');
 else if(e.pullup)txt(c,'PULL UP',CX,463,33,RED,'center');
 for(const [i,flag] of v.comparison.entries())box(c,flag,CX+(i-(v.comparison.length-1)/2)*78,566);
 c.strokeStyle='#809189';c.lineWidth=1.5;
 c.strokeRect(CX-47,592,94,18);
 line(c,CX-9,593,CX-9,609,WHITE,1.35);line(c,CX+9,593,CX+9,609,WHITE,1.35);
 circle(c,CX+clamp(e.slip,-10,10)*3.4,601,6,'#758179','#151716',1.7);
 return {fma,speedTape:speed};
}
return {render,tapeInput,fmaInput};
});
