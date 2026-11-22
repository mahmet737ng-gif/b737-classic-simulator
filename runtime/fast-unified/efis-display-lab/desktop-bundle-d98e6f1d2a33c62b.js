(async()=>{
;
/* ../../efis-display-lab/reference-geometry.js?v=EFIS-REF-0008 */
try{
/* Geometry rectified to active glass, from the supplied B733 images (2026-11-16).
 * EADI uses 640×640 logical units; EHSI uses 512×512. The socket controls
 * the final physical aspect. Never use the source photo as a texture. */
(function(root){
 const eadi=Object.freeze({
  center:[320,332],
  attitude:{left:171,right:469,top:112,bottom:552,shoulder:221,heel:445,pitchPerDeg:9.65},
  attitudeTicks:{major:54,intermediate:33,minor:17,labelSize:25},
  fixedBank:{x:320,top:86,tip:110,width:22},
  movingBank:{radius:218,width:23,height:22},
  director:{halfHorizontal:81,halfVertical:104,stroke:4.4},
  tape:{axis:140,centerY:332,scaleX:.60,scaleY:.875},
  fma:{centers:[135,269,402,516],dividers:[203,337,470],dividerTop:44,dividerBottom:82,
   primaryY:56,cwsY:131,cwsWidth:93,cwsHeight:34},
  dh:{x:463,y:485,size:35},radioAltitude:{x:463,y:525,size:42},
  mach:{x:97,y:579,size:39}
 });
 const ehsi=Object.freeze({
  expanded:{roseCenter:[256,418],radius:333,radiusX:372,degrees:70},
  centerMap:{roseCenter:[256,302],radius:150,radiusX:178,degrees:360},
  full:{roseCenter:[256,280],radius:115,radiusX:134,degrees:360},
  header:{left:76,right:437,top:52,second:76,heading:59,radioFullHeading:120},
  wind:{expanded:[70,440],center:[69,441],full:[75,439]},
  labels:{waypoint:20,detail:18,expanded:23,center:20,full:23},
  palette:{white:'#e3e9e6',green:'#26ed36',magenta:'#e649e7',cyan:'#63dff5'}
 });
 const api=Object.freeze({eadi,ehsi});root.B737EfisReferenceGeometry=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../efis-display-lab/glyphs.js?v=EHSI-0008 */
try{
/* Authored stroke glyphs. Coordinates describe display units, independent of platform fonts. */
(function(root){
 const shapes = {
  A:'0,7 0,2 2,0 4,2 4,7|0,4 4,4',B:'0,7 0,0 3,0 4,1 4,2.5 3,3.5 0,3.5|3,3.5 4,4.5 4,6 3,7 0,7',
  C:'4,1 3,0 1,0 0,1 0,6 1,7 3,7 4,6',D:'0,7 0,0 2.5,0 4,1.5 4,5.5 2.5,7 0,7',
  E:'4,0 0,0 0,7 4,7|0,3.5 3,3.5',F:'4,0 0,0 0,7|0,3.5 3,3.5',G:'4,1 3,0 1,0 0,1 0,6 1,7 4,7 4,4 2.5,4',
  H:'0,0 0,7|4,0 4,7|0,3.5 4,3.5',I:'0,0 4,0|2,0 2,7|0,7 4,7',J:'4,0 4,6 3,7 1,7 0,6 0,5',
  K:'0,0 0,7|4,0 0,4 4,7',L:'0,0 0,7 4,7',M:'0,7 0,0 2,3.3 4,0 4,7',N:'0,7 0,0 4,7 4,0',
  O:'1,0 3,0 4,1 4,6 3,7 1,7 0,6 0,1 1,0',P:'0,7 0,0 3,0 4,1 4,3 3,4 0,4',
  Q:'1,0 3,0 4,1 4,6 3,7 1,7 0,6 0,1 1,0|2,4.5 4.4,7.5',
  R:'0,7 0,0 3,0 4,1 4,3 3,4 0,4|2,4 4,7',S:'4,1 3,0 1,0 0,1 0,2.5 1,3.5 3,3.5 4,4.5 4,6 3,7 1,7 0,6',
  T:'0,0 4,0|2,0 2,7',U:'0,0 0,6 1,7 3,7 4,6 4,0',V:'0,0 0,1 2,7 4,1 4,0',
  W:'0,0 0,7 2,4 4,7 4,0',X:'0,0 4,7|4,0 0,7',Y:'0,0 2,3.5 4,0|2,3.5 2,7',Z:'0,0 4,0 0,7 4,7',
  0:'1,0 3,0 4,1 4,6 3,7 1,7 0,6 0,1 1,0',1:'1,1 2.5,0 2.5,7|1,7 4,7',
  2:'0,1 1,0 3,0 4,1 4,2.5 0,6 0,7 4,7',3:'0,0 3,0 4,1 4,2.5 3,3.5 1.5,3.5|3,3.5 4,4.5 4,6 3,7 0,7',
  4:'3,7 3,0 0,5 4,5',5:'4,0 0,0 0,3 3,3 4,4 4,6 3,7 1,7 0,6',
  6:'3.5,0 1,0 0,1.5 0,6 1,7 3,7 4,6 4,4.5 3,3.5 0,3.5',7:'0,0 4,0 1,7',
  8:'1,0 3,0 4,1 4,2.5 3,3.5 1,3.5 0,2.5 0,1 1,0|1,3.5 0,4.5 0,6 1,7 3,7 4,6 4,4.5 3,3.5',
  9:'4,3.5 1,3.5 0,2.5 0,1 1,0 3,0 4,1 4,5.5 3,7 1,7',
  '.':'1.8,7 2.1,7', '/':'0,7 4,0', '+':'0,3.5 4,3.5|2,1.5 2,5.5', '-':'0,3.5 4,3.5',
  '°':'1,0 2.5,0 2.5,1.6 1,1.6 1,0', ':':'2,2 2.2,2|2,5.5 2.2,5.5',
  '(':'3,0 1,2 1,5 3,7',')':'1,0 3,2 3,5 1,7','?':'0,1 1,0 3,0 4,1 4,2 2,4 2,5|2,7 2.2,7'
 };
 const strokes=Object.fromEntries(Object.entries(shapes).map(([char,s])=>[char,s.split('|').map(line=>line.split(' ').map(point=>point.split(',').map(Number)))]));
 function visit(value,x,y,size,align,draw,aspect=1){
  const letters=String(value).toUpperCase(), scale=size/10, step=6.1*scale*aspect;
  if(align==='middle'||align==='center') x-=(letters.length*step-2.1*scale*aspect)/2;
  if(align==='end'||align==='right') x-=letters.length*step-2.1*scale*aspect;
  y-=3.5*scale;
  for(const char of letters){
   for(const points of strokes[char]||(char===' '?[]:strokes['?'])){
    draw(points.map(([px,py])=>[x+px*scale*aspect,y+py*scale]));
   }
   x+=step;
  }
 }
 function svg(value,x,y,size,align,aspect){
  let d='';
  visit(value,x,y,size,align,points=>{d+='M'+points.map(([px,py])=>px.toFixed(2)+','+py.toFixed(2)).join('L');},aspect);
  return d;
 }
 function canvas(c,value,x,y,size,color,align,aspect){
  c.beginPath();visit(value,x,y,size,align,points=>points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py)),aspect);
  c.strokeStyle=color;c.lineWidth=Math.max(1,size/11);c.lineJoin='round';c.lineCap='round';c.stroke();
 }
 const colors=Object.freeze({white:'#f0f4ec',green:'#62ee79',magenta:'#ed68df',cyan:'#6adcf4',amber:'#ffca43',red:'#ff504f',black:'#000'});
 const api={svg,canvas,colors};if(typeof module==='object'&&module.exports)module.exports=api;
 root.EFISLabGlyphs=api;
})(globalThis);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../efis-display-lab/eadi.js?v=TCAS-MOTION-0002-RA-20-10-1-0001 */
try{
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
// Display quantization only. Keep the continuous radio-height signal for
// DH/minimums, audio trigger crossings and simulated FCC flight controls.
// >=1000 ft: 20-ft; 100..999 ft: 10-ft; below 100 ft: 1-ft.
function radioAltitudeDisplayFt(raFt){
 if(typeof raFt!=='number'||!Number.isFinite(raFt))return null;
 const ft=Math.max(0,raFt);
 const step=ft>=1000?20:ft>=100?10:1;
 return Math.round(ft/step)*step;
}
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
  // In the TCAS Lab show only the red V fence. Preserve the original
  // Unified rendering by keeping the hatch variant as the default.
  if(!e.tcasFenceSimple){
   for(let i=0;i<8;i++){
    const dy=sign*(i*17+9),x=39+52*Math.abs(dy)/145;
    line(c,-x,boundary+dy,-x-8,boundary+dy-sign*8,RED,1.9);
    line(c,x,boundary+dy,x+8,boundary+dy-sign*8,RED,1.9);
   }
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
function drawFma(c,seat,fontScale=1){
 fmaLayer.renderReference(c,seat,G.fma,glyph,Date.now(),fontScale);
}
function flightModes(canvas,c,seat,fields,fontScale=1){
 const changed=fmaLayer.accept(seat,fields);
 drawFma(c,seat,fontScale);
 if(!changed||typeof globalThis.setTimeout!=='function')return;
 // The shared renderer owns the 10-second deadline. Standalone EADI supplies
 // only the repaint because it is not registered as a Unified cockpit layer.
 const timer=fmaTimers.get(canvas);
 if(timer!==undefined)globalThis.clearTimeout(timer);
 fmaTimers.set(canvas,globalThis.setTimeout(()=>{
  fmaTimers.delete(canvas);
  if(canvas.dataset.fmaSeat===seat)drawFma(c,seat,fontScale);
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
 const displayedRa=radioAltitudeDisplayFt(v.radioAlt);
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
  txt(c,displayedRa,x,y,27,color,'center');
 }else txt(c,displayedRa,G.radioAltitude.x,G.radioAltitude.y,G.radioAltitude.size,color);
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
 const fmaFontScale=clamp(e.fmaFontScale??1,.8,1);
 canvas.dataset.fmaSeat=state.seat;
 // Unified receives authoritative MCP/FCC annunciations from its live
 // FMA owner. Do not overwrite them with the lab demonstration projection.
 if(live)drawFma(c,state.seat);
 else flightModes(canvas,c,state.seat,fma,fmaFontScale);
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
 canvas.dataset.radioAltitudeDisplayFt=finite(input.radioAltFt)?String(radioAltitudeDisplayFt(input.radioAltFt)):'INVALID';
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
return {render,tapeInput,fmaInput,renderUnifiedAttitude,renderUnifiedFull,radioAltitudeDisplayFt};
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../efis-display-lab/core.js?v=UNIFIED-EHSI-0001 */
try{
/* EFIS DISPLAY LAB 0001 — training only, event-driven, no flight use.
 * Source register: B737CL FCOM Vol.2 10.30.6-14; 10.31.2-...; 10.40.9-11.
 * Data tagged SIM is not a live aircraft signal. Visual acceptance is pending.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.EFISDisplayLabCore=api;})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const VERSION='EFIS-DISPLAY-LAB-0004';
const MODES=['FULL_VOR_ILS','EXP_VOR_ILS','FULL_NAV','EXP_NAV','MAP','CTR_MAP','PLAN'];
const RANGES=[10,20,40,80,160,320];
const FCOM='https://boredaviator.com/wp-content/uploads/2025/03/B737-300-FCOM-.pdf';
const items=[
 ['eadi','fma','FMA — 4 mode zones','10.30.6 / Ch.4','RULE_ONLY',[0,0,100,14],'Unified FMA engine with instructor MCP/FCC scenarios'],
 ['eadi','bank','Bank scale / moving pointer','10.30.6','RULE_ONLY',[25,15,53,16],'0/10/20/30/45/60 degree markings'],
 ['eadi','attitude','Pitch ladder / horizon / black L aircraft','10.30.6–7','VISUAL_PENDING',[25,22,53,62],'Classic 10-degree numerals; pixel registration pending'],
 ['eadi','slip','Slip/skid indicator','10.30.8','VISUAL_PENDING',[36,85,29,5],'Injected simulated slip'],
 ['eadi','speed','IAS tape / speed bug / Mach','10.30.7, 10.30.10–12','RULE_ONLY',[2,26,24,55],'Actual MCP/ADC/stall margins not yet bridged'],
 ['eadi','grounds','Groundspeed indication','10.30.7','RULE_ONLY',[3,88,25,7],'FMC/IRS input currently simulated'],
 ['eadi','fd','Flight director command bars','10.30.7 / Ch.4','RULE_ONLY',[26,36,50,42],'Shown only on valid selected FD command'],
 ['eadi','gs','Glideslope deviation','10.30.7','RULE_ONLY',[83,28,16,47],'Invalid signal/backcourse blanks pointer'],
 ['eadi','loc','Localizer deviation','10.30.8','RULE_ONLY',[34,88,40,10],'Invalid LOC blanks pointer'],
 ['eadi','dh','Decision height / RA color','10.30.9–10; 10.40.4–5','RULE_ONLY',[76,77,23,19],'RA warning, reset, and DH+75 restoration'],
 ['eadi','runway','Rising runway','10.30.10; 10.40.4','VISUAL_PENDING',[40,66,25,21],'Appears with valid LOC and RA below 2500 ft; rises below 200 ft'],
 ['eadi','pli','Pitch limit indicator','10.30.7','VISUAL_PENDING',[35,19,30,15],'Lack of stall computer input: illustrative only'],
 ['eadi','tcas','TCAS RA pitch limits','10.30.9','VISUAL_PENDING',[25,22,53,62],'Red avoid region; precise extent pending source verification'],
 ['eadi','alerts','Windshear / PULL UP','10.30.10, 10.30.14','RULE_ONLY',[29,54,43,23],'Alert message injection only'],
 ['eadi','flags','Failure flags / comparator','10.30.13–14','RULE_ONLY',[16,11,73,78],'Source transfer and injected opposite-side comparison'],
 ['ehsi','mode','7 selector modes / orientation','10.40.9–11','RULE_ONLY',[2,0,96,15],'Availability varies by airplane equipment'],
 ['ehsi','rose','Rose / arc / cardinal references','10.31.2–6','VISUAL_PENDING',[5,14,90,76],'Heading-up vs track-up vs true-north'],
 ['ehsi','heading','Heading bug / track indicator','10.31.2–5','RULE_ONLY',[26,6,48,24],'Independent HDG/TRK inputs'],
 ['ehsi','route','Active route / waypoint symbols','10.31.2–5','VISUAL_PENDING',[14,22,72,64],'SYNTHETIC geometry; not FMC route'],
 ['ehsi','course','VOR/ILS CDI / source','10.40.11; 10.31.x','RULE_ONLY',[19,25,63,64],'Navigation validity and course source checks'],
 ['ehsi','dme','VOR DME / active fix information','10.40.10–11','RULE_ONLY',[1,80,98,19],'Injected data, independent VOR/ILS/FMC sources'],
 ['ehsi','opts','WPT / ARPT / NAVAID selections','10.30.3–4','RULE_ONLY',[3,20,94,71],'WPT non-route database points only at <=40 NM'],
 ['ehsi','wxr','WXR / TERR selector exclusion','10.30.4; 10.40.11','RULE_ONLY',[5,63,88,28],'Mode, remote selection, validity and synthetic test packets'],
 ['ehsi','tfc','TCAS traffic overlay','10.30.4; 10.31.x','VISUAL_PENDING',[65,11,30,27],'Injected RA, TA, proximate and other traffic'],
 ['ehsi','fail','Power / SG / IRS / NAV flags','10.30.13–14; 10.40','RULE_ONLY',[10,34,80,39],'Fail-safe simplified; CB source mapping pending']
].map(([display,id,name,folio,status,box,note])=>({display,id,name,folio,status,box,note}));
function clamp(v,min,max){const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;}
function norm(v){return ((Number(v)||0)%360+360)%360;}
function initial(){
 return {seat:'CAPT',power:{eadi:true,ehsi:true,sg1:true,sg2:true,source:'NORMAL',att:true,heading:true,track:true,adc:true,nav:true,loc:true,gs:true,ra:true,fd:true,dhData:true,selSpeed:true,v1Data:true,speedLimit:true,machData:true,irsLeft:true,irsRight:true,irsSource:'NORMAL',eadiThermal:'NORMAL',ehsiThermal:'NORMAL',fmcTrack:true,remoteWxr:false,wxrHealthy:true,terrainHealthy:true,mapRange:true,wxrRange:true,terrainRange:true},
 eadi:{brightness:1,pitch:0,bank:0,slip:0,ias:220,selectedSpeed:230,mach:.55,groundSpeed:310,radioAlt:800,dh:200,descent:true,fd:true,fdPitch:4,fdRoll:0,locDev:.3,gsDev:-.3,frontCourse:true,tcas:'OFF',windshear:false,pullup:false,pli:false,at:'FMC SPD',pitchMode:'VNAV PTH',rollMode:'LNAV',afds:'CMD',machVisible:true,dhReset:false,heightReset:false,dhLatched:false,otherPitch:0,otherBank:0,fdAuto:false,locCaptured:false,gsCaptured:false,fmcVerticalValid:true,altAcquire:false,apEngaged:false,locExcessive:false,tcasLimit:6,phase:'CRUISE',flaps:0,armedPitch:'',armedRoll:'',acceleration:0,pliAngle:17,v1:121,vr:125,vref:136,demoLimits:false,minManeuver:135,shaker:120,vmo:340,gearState:'UP',flap30MaximumKt:180,speedSource:'AUTO',fmcCommandSpeed:230,retractSpeed:155,flapsUpSpeed:205},
 ehsi:{mode:'MAP',range:40,heading:240,track:245,selectedHeading:252,course:233,options:{wpt:true,arpt:false,navAid:false,vorAdf:false,rteData:false,tfc:false,wxr:false,terr:false},showSyntheticRoute:true,brightness:1,wxBrightness:1,navType:'VOR',vorFreq:116.8,ilsFreq:110.1,autoTune:false,dme:13.5,fmcCourse:238,xtk:.7,vorDev:2.5,toFrom:'FROM',vnav:0,vnavActive:false,planStep:1,wxrReturns:false,terrainReturns:false,tcMode:'TA_RA',traffic:false,trueAirspeed:230,windDirection:127,windSpeed:20,trueRef:false,altitude:8500,selectedAltitude:10000,verticalSpeed:1400,altitudeArc:false,tcFailSuppressed:false,nav1Bearing:72,nav2Bearing:212,nav1Valid:false,nav2Valid:false},
 audit:Object.fromEntries(items.map(x=>[x.display+'.'+x.id,'PENDING']))};
}
function activeSg(s){const which=s.power.source==='SG1'?'sg1':s.power.source==='SG2'?'sg2':s.seat==='FO'?'sg2':'sg1';return !!s.power[which];}
function seatSource(s){
 const sg=s.power.source==='NORMAL'?(s.seat==='FO'?'SG2':'SG1'):s.power.source;
 const irs=s.power.irsSource==='NORMAL'?(sg==='SG1'?'LEFT':'RIGHT'):s.power.irsSource;
 return {sg,irs,irsValid:irs==='LEFT'?s.power.irsLeft:s.power.irsRight};
}
function compare(s){
 const {power:p,eadi:e}=s;
 if(p.irsSource!=='NORMAL')return [];
 if(p.source!=='NORMAL'||!p.irsLeft||!p.irsRight||!p.att)return ['COMP'];
 return [Math.abs(e.pitch-e.otherPitch)>3?'PITCH':null,Math.abs(e.bank-e.otherBank)>3?'ROLL':null].filter(Boolean);
}
function evaluate(s){
 const e=s.eadi,p=s.power,source=seatSource(s),sg=activeSg(s),ra=p.ra?e.radioAlt:null;
 const powered=p.eadi&&p.eadiThermal!=='BLANK';
 const valid=powered&&sg,attitude=valid&&p.att&&source.irsValid;
 const ils=s.ehsi.navType==='ILS',loc=valid&&ils&&p.loc;
 const front=e.frontCourse&&Math.abs(((s.ehsi.track-s.ehsi.course+540)%360)-180)<=90;
 const raDigital=valid&&ra!==null&&ra<2500, dial=raDigital&&ra<1000;
 const dhArmed=p.dhData&&e.dh>=0&&!e.dhReset;
 const dhAlert=raDigital&&dhArmed&&ra>0&&(e.dhLatched||(e.descent&&ra<=e.dh));
 return {powered,raster:p.eadiThermal==='NORMAL',sg,source,attitude,ias:valid&&p.adc,
  fd:attitude&&p.fd&&(e.fd||e.fdAuto),ils,loc,locFlag:valid&&ils&&!p.loc,
  locExpanded:loc&&e.locCaptured&&Math.abs(e.locDev)>.5,
  locWarning:loc&&e.apEngaged&&e.locExcessive,
  gs:valid&&ils&&p.gs&&front,gsScale:valid&&ils,ra:raDigital,radioAlt:ra,dial,dhAlert,
  dhPointer:dial&&p.dhData&&e.dh>=0,dhDigital:valid&&ra!==null&&ra>=1000&&p.dhData&&e.dh>=0,
  heightAlert:dial&&ra>=500&&e.descent&&!e.heightReset,
  runway:loc&&raDigital,mach:valid&&p.adc&&p.machData&&e.machVisible,comparison:valid?compare(s):[],
  flags:[!attitude?'ATT':null,!p.adc?'SPD':null,!p.fd&&(e.fd||e.fdAuto)?'FD':null,
   valid&&ils&&!p.loc?'LOC':null,!p.ra?'RA':null,!p.dhData?'DH':null,
   !p.selSpeed?'SEL SPD':null,!p.v1Data?'V1 INOP':null,!p.speedLimit?'SPD LIM':null,!p.machData?'MACH':null].filter(Boolean)};
}
function ehsiModel(s){
 const e=s.ehsi,p=s.power,source=seatSource(s),sg=activeSg(s);
 const mode=MODES.includes(e.mode)?e.mode:'MAP',range=RANGES.includes(Number(e.range))?Number(e.range):40;
 const opts={...e.options,demoRoute:!!e.showSyntheticRoute};
 const fmcOk=!!p.nav&&p.mapRange;
 const pts=e.showSyntheticRoute&&fmcOk?[
  {name:'SADAF',x:-2.4,y:-6.6,altitude:'6500',eta:'1333Z'},
  {name:'KAVIR',x:-14.7,y:.85,altitude:'9000',eta:'1335Z'},
  {name:'NEMAT',x:-27.1,y:6.1,altitude:'12000',eta:'1338Z'},
  {name:'DARYA',x:-35,y:-5.3,altitude:'',eta:'1342Z'}]:[];
 const weatherMode=['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(mode);
 const wxrSelected=weatherMode&&opts.wxr&&p.remoteWxr;
 const terrainSelected=weatherMode&&opts.terr;
 const disagreements=[];
 if(!p.mapRange&&p.nav&&['MAP','CTR_MAP','PLAN','EXP_NAV'].includes(mode))disagreements.push('MAP');
 if(!p.wxrRange&&wxrSelected&&p.wxrHealthy)disagreements.push('WXR');
 if(!p.terrainRange&&terrainSelected&&p.terrainHealthy)disagreements.push('TERR');
 return {mode,range,heading:norm(e.heading),track:norm(e.track),selectedHeading:norm(e.selectedHeading),
  course:norm(mode.includes('VOR_ILS')?e.course:e.fmcCourse),trueRef:e.trueRef,
  trueAirspeed:e.trueAirspeed,windDirection:e.windDirection,windSpeed:e.windSpeed,groundSpeed:s.eadi.groundSpeed,bank:s.eadi.bank,
  altitudeArc:e.altitudeArc?{current:e.altitude,target:e.selectedAltitude,verticalSpeed:e.verticalSpeed}:null,
  nav:{valid:mode.includes('VOR_ILS')?(e.navType==='ILS'?!!p.loc:!!p.nav):fmcOk,
   type:e.navType,source:e.navType+(s.seat==='FO'?' 2':' 1'),dme:e.dme,
   frequency:e.autoTune?null:e.navType==='ILS'?e.ilsFreq:e.vorFreq,
   cdi:mode.includes('VOR_ILS')?(e.navType==='ILS'?s.eadi.locDev:e.vorDev/5):e.xtk/2,
   gsDev:s.eadi.gsDev,gsValid:e.navType==='ILS'&&p.gs&&e.frontCourse&&Math.abs(((e.track-e.course+540)%360)-180)<=90,
   toFrom:e.toFrom,vnavActive:e.vnavActive,vnav:e.vnav},
  bearings:[{channel:1,angle:e.nav1Bearing,valid:e.nav1Valid},{channel:2,angle:e.nav2Bearing,valid:e.nav2Valid}]
   .filter(candidate=>candidate.valid),
  route:{source:'SYNTHETIC',activeIndex:1,centerIndex:e.planStep,points:pts},
  options:opts,weather:{selected:wxrSelected,healthy:p.wxrHealthy,
   visible:wxrSelected&&p.wxrHealthy&&p.wxrRange&&e.wxrReturns&&p.ehsiThermal==='NORMAL',
   displayCooling:wxrSelected&&p.ehsiThermal==='RASTER_OFF',
   terrain:terrainSelected&&p.terrainHealthy&&p.terrainRange&&e.terrainReturns&&p.ehsiThermal==='NORMAL',
   terrainFailure:terrainSelected&&!p.terrainHealthy,disagreement:disagreements.join('/')},
  traffic:{mode:e.tcMode,failSuppressed:e.tcFailSuppressed,targets:e.traffic?[
   {kind:s.eadi.tcas==='OFF'?'TA':'RA',bearing:258,distance:5.3,relativeAltitude:300,verticalRate:-600},
   {kind:'TA',bearing:227,distance:9,relativeAltitude:-1200,verticalRate:650},
   {kind:'PROX',bearing:250,distance:3.5,relativeAltitude:-500,verticalRate:0},
   {kind:'OTHER',bearing:211,distance:15,relativeAltitude:null,verticalRate:0}]:[]},
  efis:{headingValid:!!p.heading&&source.irsValid,trackValid:!!p.track&&(p.fmcTrack||source.irsValid),
   trackSource:p.fmcTrack?'FMC':source.irsValid?'IRS '+source.irs:null,
   sgValid:!!sg,displayPower:p.ehsi&&p.ehsiThermal!=='BLANK',wxBrightness:clamp(e.wxBrightness,0,1),brightness:clamp(e.brightness,0,1)}};
}
function orientation(mode){return mode==='PLAN'?'TRUE_NORTH':mode.includes('VOR_ILS')?'HEADING_UP':'TRACK_UP';}
function apply(s,patch){const x=structuredCopy(s);if(patch.type==='reset')return initial();
 if(patch.type==='scenario'){
  if(patch.name==='normal')return initial();
  const fresh=initial(),e=fresh.eadi,p=fresh.power,h=fresh.ehsi;
  if(patch.name==='approach'){Object.assign(e,{radioAlt:120,ias:143,locDev:.2,gsDev:-.4,locCaptured:true,gsCaptured:true,gearState:'DOWN',phase:'APPROACH',flaps:30,demoLimits:true,rollMode:'VOR/LOC',pitchMode:'G/S'});Object.assign(h,{mode:'FULL_VOR_ILS',navType:'ILS',course:240});}
  if(patch.name==='takeoff'){Object.assign(e,{radioAlt:0,ias:119,selectedSpeed:150,fdPitch:12,phase:'TAKEOFF',flaps:5,demoLimits:true,minManeuver:109,shaker:101,at:'N1',pitchMode:'TO/GA',rollMode:'',afds:'FD',acceleration:1.8});}
  if(patch.name==='cruise'){Object.assign(e,{radioAlt:4500,mach:.75,ias:280,pitch:2});h.range=160;}
  if(patch.name==='tcas'){e.tcas='UP';e.radioAlt=350;h.traffic=true;h.options.tfc=true;h.range=20;}
  if(patch.name==='weather'){h.options.wxr=true;p.remoteWxr=true;h.wxrReturns=true;}
  if(patch.name==='terrain'){h.options.terr=true;h.terrainReturns=true;}
  if(patch.name==='failure'){p.sg1=false;}
  if(patch.name==='dark'){p.eadi=false;p.ehsi=false;}
  if(['ref-cmd','ref-cws-r','ref-cws-p','ref-312'].includes(patch.name)){
   const high=patch.name==='ref-312';
   Object.assign(e,{pitch:high?0:12,fdPitch:high?0:12,fdRoll:0,otherPitch:high?0:12,
    ias:high?312:201.5,selectedSpeed:high?340:201.5,mach:high?.675:.36,
    groundSpeed:high?398:336,radioAlt:patch.name==='ref-cmd'?2200:2900,at:high?'MCP SPD':'N1',pitchMode:high?'V/S':'MCP SPD',
    rollMode:'HDG SEL',afds:patch.name==='ref-cws-r'?'CWS R':patch.name==='ref-cws-p'?'CWS P':'CMD',
    speedSource:'MCP',demoLimits:true,minManeuver:high?180:190,shaker:high?150:158,
    vmo:high?340:400,flapsUpSpeed:210,acceleration:high?1.4:0});
   Object.assign(h,{heading:81,track:81,selectedHeading:81,windDirection:215,windSpeed:32,
    trueAirspeed:374,mode:'CTR_MAP',range:20,nav1Valid:true,nav2Valid:true,nav1Bearing:103,nav2Bearing:265});
   h.options.vorAdf=true;h.options.tfc=true;h.options.rteData=true;
  }
  if(patch.name==='navfail'){p.nav=false;p.heading=false;p.track=false;}
  return fresh;
 } else if(patch.type==='seat'){
  if(!['CAPT','FO'].includes(patch.value))throw Error('BAD_SEAT');
  x.seat=patch.value;
 } else if(patch.type==='dhReset'){
  x.eadi.dhReset=true;x.eadi.dhLatched=false;x.eadi.heightReset=true;
 }
 else if(patch.type==='set'){
  const path=patch.path.split('.');if(path.length!==2||!Object.hasOwn(x,path[0])||!Object.hasOwn(x[path[0]],path[1]))throw Error('BAD_PATH '+patch.path);
  x[path[0]][path[1]]=patch.value;
  if(patch.path==='eadi.dh')x.eadi.dh=clamp(patch.value,-20,999);
  if(['eadi.brightness','ehsi.brightness','ehsi.wxBrightness'].includes(patch.path))x[path[0]][path[1]]=clamp(patch.value,0,1);
  if(patch.path==='eadi.mach')x.eadi.machVisible=Number(patch.value)>=.40?true:Number(patch.value)<.38?false:s.eadi.machVisible;
  const e=x.eadi;
  if(patch.path==='ehsi.tcMode')x.ehsi.tcFailSuppressed=false;
  if(patch.path==='eadi.radioAlt'){
   if(e.radioAlt>=1000)e.heightReset=false;
   if(e.radioAlt>=e.dh+75){e.dhReset=false;e.dhLatched=false;}
   if(e.radioAlt<=0){e.dhLatched=false;e.dhReset=true;}
   if(e.radioAlt>0&&e.radioAlt<=e.dh&&e.dh>=0&&e.descent&&!e.dhReset&&x.power.ra)e.dhLatched=true;
  }
  if(patch.path==='eadi.dh'){e.dhReset=false;e.dhLatched=false;}
  if(patch.path==='power.eadi'&&patch.value&&!s.power.eadi){e.dh=200;e.dhReset=false;e.dhLatched=false;e.heightReset=false;}

 }else if(patch.type==='option'){
  if(!Object.hasOwn(x.ehsi.options,patch.name))throw Error('BAD_OPTION');
  x.ehsi.options[patch.name]=!!patch.value;
  if(patch.name==='tfc'&&x.ehsi.tcMode==='FAIL')x.ehsi.tcFailSuppressed=!x.ehsi.tcFailSuppressed;
  if(patch.name==='wxr'&&patch.value)x.ehsi.options.terr=false;
  if(patch.name==='terr'&&patch.value)x.ehsi.options.wxr=false;
 }else if(patch.type==='audit'){
  const k=patch.key;if(!Object.hasOwn(x.audit,k))throw Error('BAD_AUDIT');x.audit[k]=patch.status;
 }else throw Error('BAD_EVENT');
 return x;
}
function structuredCopy(o){return JSON.parse(JSON.stringify(o));}
function selfTest(){
 const checks=[];const assert=(id,v)=>checks.push({id,pass:!!v});
 let s=initial();assert('Mach initially visible',evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.mach',value:.37});assert('Mach below .38 disappears',!evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.mach',value:.39});assert('Mach hysteresis retains blank',!evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.mach',value:.40});assert('Mach at .40 reappears',evaluate(s).mach);
 s=apply(s,{type:'set',path:'eadi.radioAlt',value:100});assert('RA below DH is amber',evaluate(s).dhAlert);
 s=apply(s,{type:'dhReset'});assert('DH reset clears amber',!evaluate(s).dhAlert);
 s=apply(s,{type:'set',path:'eadi.radioAlt',value:300});assert('DH reset rearmed above DH+75',!s.eadi.dhReset);
 s=apply(s,{type:'set',path:'power.fd',value:false});assert('FD failure blanks bars',!evaluate(s).fd);
 const approach=apply(initial(),{type:'scenario',name:'approach'});
 const set=(state,path,value)=>apply(state,{type:'set',path,value});
 assert('Back course inhibits GS',evaluate(approach).gs&&!evaluate(set(approach,'eadi.frontCourse',false)).gs);
 assert('RA at 2500 blanks',!evaluate(set(approach,'eadi.radioAlt',2500)).ra);
 assert('Positive DH reads above 1000',evaluate(set(approach,'eadi.radioAlt',1250)).dhDigital);
 assert('RA below 1000 adds dial',evaluate(set(approach,'eadi.radioAlt',999)).dial);
 assert('RA at 1000 uses digital DH',!evaluate(set(approach,'eadi.radioAlt',1000)).dial);
 assert('Height alert at 700, ends below 500',evaluate(set(approach,'eadi.radioAlt',700)).heightAlert&&!evaluate(set(approach,'eadi.radioAlt',499)).heightAlert);
 assert('Runway already visible above 200',evaluate(set(approach,'eadi.radioAlt',1000)).runway);
 assert('Untuned EADI blanks ILS',!evaluate(initial()).loc);
 assert('TCAS scenario generates injected traffic',ehsiModel(apply(initial(),{type:'scenario',name:'tcas'})).traffic.targets.length===4);
 assert('Attitude difference exactly 3° accepted',compare(set(initial(),'eadi.otherPitch',3)).length===0);
 assert('Attitude difference above 3° flags PITCH',compare(set(initial(),'eadi.otherPitch',3.1)).includes('PITCH'));
 assert('Common SG flags comparator',compare(set(initial(),'power.source','SG2')).includes('COMP'));
 assert('IRS transfer inhibits disagreement',compare(set(set(initial(),'eadi.otherPitch',4),'power.irsSource','LEFT')).length===0);
 let restore=set(set(initial(),'eadi.dh',180),'power.eadi',false);
 restore=set(restore,'power.eadi',true);
 assert('EADI power restoration resets DH to 200',restore.eadi.dh===200);
 assert('EADI first thermal stage retains vector attitude',evaluate(set(initial(),'power.eadiThermal','RASTER_OFF')).attitude&&!evaluate(set(initial(),'power.eadiThermal','RASTER_OFF')).raster);
 assert('EADI second thermal stage blanks display',!evaluate(set(initial(),'power.eadiThermal','BLANK')).powered);
 assert('DH data failure blanks selection and alert',!evaluate(set(approach,'power.dhData',false)).dhAlert&&!evaluate(set(approach,'power.dhData',false)).dhPointer);
 assert('Mach failure does not blank CAS',!evaluate(set(initial(),'power.machData',false)).mach&&evaluate(set(initial(),'power.machData',false)).ias);
 assert('FMC track falls back to the selected IRS',ehsiModel(set(set(initial(),'power.fmcTrack',false),'power.irsSource','RIGHT')).efis.trackSource==='IRS RIGHT');
 s=apply(s,{type:'set',path:'power.sg1',value:false});assert('CAPT SG1 failure blanks',!evaluate(s).sg);
 s=apply(s,{type:'set',path:'power.source',value:'SG2'});assert('Transfer to SG2 available',evaluate(s).sg);
 s=apply(s,{type:'set',path:'power.eadi',value:false});assert('Power EADI fail dark',!evaluate(s).powered);
 const h=ehsiModel(initial());assert('MAP track-up',orientation(h.mode)==='TRACK_UP');
 assert('VOR heading-up',orientation('FULL_VOR_ILS')==='HEADING_UP');
 assert('PLAN north-up',orientation('PLAN')==='TRUE_NORTH');
 assert('WPT range <=40',!!h.options.wpt&&h.range<=40);
 s=apply(initial(),{type:'option',name:'wxr',value:true});s=apply(s,{type:'option',name:'terr',value:true});assert('TERR and WXR mutually exclusive',!s.ehsi.options.wxr&&s.ehsi.options.terr);
 return {pass:checks.every(x=>x.pass),checks};
}
return {VERSION,MODES,RANGES,FCOM,items,initial,clamp,norm,activeSg,seatSource,compare,evaluate,ehsiModel,orientation,apply,selfTest};
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../efis-display-lab/ehsi-v2.js?v=TCAS-MOTION-0002 */
try{
/* Classic EHSI render pipeline, grounded in Sepehran FCOM 10.31–10.32 and 10.40. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./glyphs.js'):root.EFISLabGlyphs,
  typeof module==='object'&&module.exports?require('./reference-geometry.js').ehsi:root.B737EfisReferenceGeometry.ehsi);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.EFISClassicEHSIV2=api;
})(globalThis,function(glyph,G){
'use strict';
const VERSION='EHSI-CLASSIC-REBUILD-0011-FCOM-1031-FULL-NAV';
const COLORS=glyph.colors;
const W=512,H=512,NS='http://www.w3.org/2000/svg';
// Active EHSI aperture in the two 1920 x 1080 owner-supplied reference frames.
const FRAME=Object.freeze({left:390,top:64,width:900,height:837});
const px=n=>n*W/FRAME.width,py=n=>n*H/FRAME.height;
const PHOTO_COLORS=Object.freeze({...COLORS,...G.palette});
const DISPLAY_ASPECT=350/411;
const MAP_ID_SIZE=G.labels.waypoint,MAP_DETAIL_SIZE=G.labels.detail;
const EXPANDED=Object.freeze({...G.expanded,route:true,aircraft:G.expanded.roseCenter,calibrated:true});
const FULL=Object.freeze({...G.full,route:false,aircraft:G.full.roseCenter,full:true});
const PLAN={...EXPANDED,aircraft:null,rose:false,planCompass:true};
const LAYOUT=Object.freeze({
 MAP:EXPANDED,
 CTR_MAP:{...G.centerMap,route:true,aircraft:G.centerMap.roseCenter,calibrated:true},
 EXP_NAV:{...EXPANDED,route:false},
 FULL_NAV:FULL,
 EXP_VOR_ILS:{...EXPANDED,route:false},
 FULL_VOR_ILS:FULL,
 PLAN
});
// Opt-in TCAS trainer geometry, leaving validated Unified/EFIS Lab unchanged.
function layoutFor(m){
 const base=LAYOUT[m.mode];
 if(!m.trainingRoseLarge)return base;
 if(m.mode==='CTR_MAP')return {...base,roseCenter:[256,290],aircraft:[256,290],radius:189,radiusX:211};
 if(m.mode==='EXP_NAV')return {...base,route:true};
 if(m.mode==='FULL_NAV')return {...base,roseCenter:[256,288],aircraft:[256,288],
  radius:183,radiusX:199,route:m.routeOnFull===true,calibrated:true};
 return base;
}
const MODES=Object.freeze(Object.keys(LAYOUT));
const REFERENCE=Object.freeze({
 MAP:'10.31.2–3',CTR_MAP:'10.31.4–5',EXP_NAV:'10.31.6–7',FULL_NAV:'10.31.8–9',
 EXP_VOR_ILS:'10.31.10–11 / 10.31.14–15',FULL_VOR_ILS:'10.31.12–13 / 10.31.16–17',PLAN:'10.31.18–19'
});
const norm=n=>((Number(n)||0)%360+360)%360;
const rel=n=>norm(Number(n)+180)-180;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const direction=n=>String(norm(Math.round(n))).padStart(3,'0');
const rad=n=>n*Math.PI/180;
const polar=(cx,cy,a,r)=>[cx+Math.sin(rad(a))*r,cy-Math.cos(rad(a))*r];
function rosePoint(l,angle,fraction=1){
 const [cx,cy]=l.roseCenter;
 return [cx+Math.sin(rad(angle))*(l.radiusX??l.radius)*fraction,cy-Math.cos(rad(angle))*l.radius*fraction];
}
function roseTangent(l,angle){
 return Math.atan2(l.radius*Math.sin(rad(angle)),(l.radiusX??l.radius)*Math.cos(rad(angle)))*180/Math.PI;
}

function model(input={}){
 const {nav={},options={},route={},efis={},weather={},traffic={}}=input;
 const mode=MODES.includes(input.mode)?input.mode:'MAP',radio=mode.includes('VOR_ILS');
 return {...input,mode,range:input.range||40,nav,options,
  route:{points:[],activeIndex:0,centerIndex:0,...route},efis,weather,traffic,
  radio,modeName:radio?mode.replace('VOR_ILS',nav.type==='ILS'?'ILS':'VOR'):mode,
  reference:radio?norm(input.heading):norm(input.track)};
}
function computeDisplay(input){
 const m=model(input),l=layoutFor(m),plan=m.mode==='PLAN';
 const headingValid=m.efis.headingValid!==false,trackValid=m.efis.trackValid!==false;
 const compassValid=m.radio?headingValid:trackValid;
 const trafficMode=['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(m.mode)||
  (m.mode==='FULL_NAV'&&m.routeOnFull===true);
 return {version:VERSION,mode:m.mode,presentation:m.modeName,supported:MODES.includes(input.mode),
  orientation:plan?'TRUE_NORTH':m.radio?'HEADING_UP':'TRACK_UP',
  compassHeadingReference:m.radio?'HEADING':'TRACK',has70DegreeArc:l.degrees===70,
  hasFullCompass:l.degrees===360,northUp:plan,layout:l,
  powered:m.efis.displayPower!==false,sgValid:m.efis.sgValid!==false,
  orientationValid:plan||compassValid,compassValid,headingValid,trackValid,
  trackSource:m.efis.trackSource,navValid:!!m.nav.valid,
  routeValid:l.route&&!!m.nav.valid&&(plan||compassValid)&&m.route.points.length>0,
  wptDatabaseEligible:l.route&&!!m.options.wpt&&m.range<=40,
  headingBugLineVisible:!plan&&compassValid,
  wxrVisible:!!m.weather.visible&&compassValid,terrainVisible:!!m.weather.terrain&&compassValid,
  trafficOverlay:trafficMode&&compassValid&&!!m.options.tfc&&['TA_RA','TA_ONLY','TEST'].includes(m.traffic.mode),
  range:m.range,source:'Sepehran FCOM '+REFERENCE[m.mode],approval:'VISUAL_REFERENCE_PIXEL_QA_PENDING'};
}
function make(parent,tag,attrs={},value){
 const e=parent.ownerDocument.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)e.setAttribute(k,String(v));
 if(value!==undefined)e.textContent=String(value);
 parent.appendChild(e);return e;
}
const layer=(parent,id,attrs={})=>make(parent,'g',{'data-segment':id,...attrs});
const line=(p,x1,y1,x2,y2,color=COLORS.white,w=1.7,attrs={})=>make(p,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':w,...attrs});
const circle=(p,cx,cy,r,color=COLORS.white,fill='none')=>make(p,'circle',{cx,cy,r,stroke:color,'stroke-width':1.65,fill});
const polygon=(p,pts,color=COLORS.white,fill='none',w=1.8)=>make(p,'polygon',{points:pts.map(q=>q.join(',')).join(' '),fill,stroke:color,'stroke-width':w,'stroke-linejoin':'round'});
function stroke(p,points,color=COLORS.white,w=1.65,attrs={}){
 return make(p,'polyline',{points:points.map(q=>q.map(k=>k.toFixed(2)).join(',')).join(' '),stroke:color,'stroke-width':w,fill:'none','stroke-linejoin':'round',...attrs});
}
function text(p,value,x,y,size=17,color=COLORS.white,align='start'){
 if(value===null||value===undefined||value==='')return;
 const g=make(p,'g',{'data-text':String(value),'aria-label':String(value),'font-size':size,'data-x':x,'data-y':y});
 make(g,'title',{},value);
 return make(g,'path',{d:glyph.svg(value,x,y,size,align,.84),fill:'none',stroke:color,'stroke-width':Math.max(.8,size/12.5),'stroke-linecap':'round','stroke-linejoin':'round'});
}
function flag(p,value,x,y){
 const width=value.length*11+12;
 make(p,'rect',{x:x-width/2,y:y-12,width,height:24,fill:COLORS.black,stroke:COLORS.amber,'stroke-width':1.3});
 text(p,value,x,y,17,COLORS.amber,'middle');
}
const photoText=(p,value,x,y,size,color=PHOTO_COLORS.white,align='start')=>text(p,value,x,y,size,color,align);
const numberText=(n,digits=0)=>Number.isFinite(n)?n.toFixed(digits):'---';
function header(svg,m,status){
 const l=layoutFor(m),h=G.header;
 const active=m.nav.valid?m.route.points[m.route.activeIndex]:null;
 const distance=active?Math.hypot(active.x,active.y):null;
 const fmcDistance=Number.isFinite(m.nav.activeDistanceNm)?m.nav.activeDistanceNm:distance;
 const left=m.radio?'DME'+numberText(m.nav.valid?m.nav.dme:null,1):
  numberText(fmcDistance,1)+' NM';
 const g=layer(svg,'header');
 photoText(g,left,h.left+70,h.top,23,PHOTO_COLORS.white,'end');
 if(!m.radio){
  const eta=m.nav.activeEta??active?.eta??'----Z';
  photoText(g,String(eta),h.right,h.top,23,PHOTO_COLORS.white,'end');
  if(m.mode==='FULL_NAV'){
   const name=m.nav.activeWaypoint??active?.name;
   if(name&&m.nav.valid)photoText(g,String(name),h.left,h.top+27,22,PHOTO_COLORS.magenta);
  }
  // Instructor FMC route may supply dynamic time-to-go; unchanged if absent.
  if(m.nav.timeToGo)photoText(g,'TTG '+String(m.nav.timeToGo),76,485,18,PHOTO_COLORS.white);
 }
 if(m.mode==='PLAN')return;
 // FULL NAV 10.31.8 has waypoint name/distance and ETA, not TAS/GS
 // (the latter belong to other instrument presentations).
 if(m.mode!=='FULL_NAV'){
  photoText(g,'TAS'+numberText(m.trueAirspeed),h.left,h.second,22);
  photoText(g,'GS'+numberText(m.groundSpeed),h.right,h.second,22,PHOTO_COLORS.white,'end');
 }
 const key=m.radio?'HDG':'TRK',y=l.full?h.radioFullHeading:h.heading;
 if(!status.compassValid){flag(g,key,256,y);return;}
 const index=layer(g,'track-readout');
 stroke(index,[[225,y-17],[225,y+14],[241,y+14],[256,y+26],[271,y+14],[287,y+14],[287,y-17]],PHOTO_COLORS.white,1.75);
 photoText(index,key,219,y+2,23,PHOTO_COLORS.green,'end');
 photoText(index,direction(m.reference),256,y,27,PHOTO_COLORS.white,'middle');
 photoText(index,m.trueRef?'TRU':'M',294,y+2,23,PHOTO_COLORS.green);
 const end=l.roseCenter[1]-l.radius;
 const spine=l.route?l.roseCenter[1]-4:end-6;
 if(spine>y+26)line(index,256,y+26,256,spine,PHOTO_COLORS.white,1.5);
}
function mapRange(svg,m,l){
 const g=layer(svg,'range-scale'),[cx,cy]=l.roseCenter;
 const centered=m.mode==='CTR_MAP';
 if(!centered){
  for(const fraction of [.25,.5,.75]){
   const edge=Math.asin(Math.min(1,198/(l.radiusX*fraction)))*180/Math.PI;
   stroke(g,Array.from({length:61},(_,i)=>rosePoint(l,edge*(i/30-1),fraction)),PHOTO_COLORS.white,1.65);
  }
 }
 const half=rosePoint(l,0,.5)[1];
 photoText(g,String(m.range/2),cx-6,half-(centered?0:13),23,PHOTO_COLORS.white,'end');
 if(centered){
  line(g,cx-8,half,cx+6,half,PHOTO_COLORS.white,1.6);
  const bottom=rosePoint(l,180,.5)[1];
  line(g,cx-8,bottom,cx+6,bottom,PHOTO_COLORS.white,1.6);
  line(g,cx,bottom,cx,cy+l.radius-4,PHOTO_COLORS.white,1.6);
  photoText(g,String(m.range/2),cx-9,bottom,23,PHOTO_COLORS.white,'end');
 }
}
function mapMarker(p,l,angle,id,fraction=1){
 const [x,y]=rosePoint(l,angle,fraction);
 return layer(p,id,{transform:'translate('+x+' '+y+') rotate('+roseTangent(l,angle)+')'});
}
function selectedHeadingPresentation(m,l){
 // The expanded compass displays only 70° at a time, but the selected MCP
 // heading is a circular 000...359° command. Never gate the radial magenta
 // heading vector on whether its triangle currently fits on that 70° arc.
 // See owner FSX reference: an off-scale selected heading retains its dashed
 // direction cue inside the glass while the off-arc triangle is withheld.
 const delta=Number.isFinite(m.selectedHeading)?rel(m.selectedHeading-m.reference):null;
 const onArc=delta!==null&&Math.abs(delta)<=l.degrees/2;
 return {delta,onArc,offScale:delta!==null&&!onArc,
  // FCOM 10.32.2: dashed magenta selected-heading reference line in
  // every mode except PLAN, including the 360-degree FULL NAV rose.
  vectorVisible:delta!==null&&!l.planCompass,
  vectorLength:onArc ? 0.92 : 1.25};
}
function compass(svg,m,l){
 const g=layer(svg,l.planCompass?'plan-compass':'compass-rose');
 const half=l.degrees/2,centered=m.mode==='CTR_MAP',full=l.degrees===360,ref=l.planCompass?0:m.reference;
 if(!full)stroke(g,Array.from({length:l.degrees+1},(_,i)=>rosePoint(l,i-half)),PHOTO_COLORS.white,1.9);
 for(let bearing=0;bearing<360;bearing+=centered?10:5){
  const angle=rel(bearing-ref);
  if(Math.abs(angle)>half)continue;
  const numbered=bearing%30===0,major=bearing%10===0;
  const length=centered?.054:full?(major?.15:.09):(major?.058:.027);
  if(!centered||!numbered)line(g,...rosePoint(l,angle),...rosePoint(l,angle,1-length),PHOTO_COLORS.white,1.65);
  if(!numbered)continue;
  const [x,y]=rosePoint(l,angle,centered?1.008:full?.73:.855);
  const label=make(g,'g',{transform:'rotate('+roseTangent(l,angle)+' '+x+' '+y+')'});
  photoText(label,String(bearing/10),x,y,full?(centered?G.labels.center:G.labels.full):G.labels.expanded,PHOTO_COLORS.white,'middle');
 }
 // 10.32.23: MAP range arcs are always present; expanded NAV/VOR-ILS
 // range arcs require WXR or TFC selected on the EFIS control panel.
 if((l.route&&!l.planCompass)||
  (['EXP_NAV','EXP_VOR_ILS'].includes(m.mode)&&(m.options.wxr||m.options.tfc)))mapRange(g,m,l);
 const otherAngle=rel((m.radio?m.track:m.heading)-ref);
 const known=m.radio?m.efis.trackValid!==false:m.efis.headingValid!==false;
 if(!l.planCompass&&known&&Math.abs(otherAngle)<=half){
  const mark=mapMarker(g,l,otherAngle,'heading-pointer',1.035);
  polygon(mark,[[0,-6],[4,0],[0,6],[-4,0]],PHOTO_COLORS.white,'none',1.7);
 }
 const heading=selectedHeadingPresentation(m,l);
 if(heading.onArc&&!l.planCompass){
  const bug=mapMarker(g,l,heading.delta,'heading-bug');
  const size=full?8:7;
  polygon(bug,[[0,-2],[-size,12],[size,12]],PHOTO_COLORS.magenta,'none',1.9);
 }

 // Off-scale: ONLY the dashed heading vector remains. Neither a
 // magenta edge triangle nor an arrow is drawn until the selected MCP
 // heading re-enters the visible compass arc.
 if(heading.vectorVisible){
  // Clip the vector to the calibrated EHSI glass, NOT to the ±35° compass
  // arc. A selected heading at 100/180/260 degrees off the bow still gives
  // an angular directional cue (even after crossing 359° -> 000°).
  const vector=layer(g,'selected-heading-vector',{
   'clip-path':'url(#'+(svg.id||'ehsi')+'-plot)'});
  line(vector,...rosePoint(l,heading.delta,heading.vectorLength),
   ...rosePoint(l,heading.delta,.08),PHOTO_COLORS.magenta,1.5,
   {'stroke-dasharray':'8 18','data-segment':'heading-bug-vector',
    'data-heading-offscale':String(heading.offScale),
    'data-relative-heading':heading.delta});
 }
}
function navPointers(svg,m,l){
 if(m.mode==='PLAN'||m.options.vorAdf!==true)return;
 const g=layer(svg,'nav-bearing-pointers'),limit=l.degrees/2;
 for(const entry of m.bearings||[]){
  if(!Number.isFinite(entry.angle)||![1,2].includes(entry.channel))continue;
  const angle=rel(entry.angle-m.reference);
  if(Math.abs(angle)<=limit){
   const h=mapMarker(g,l,angle,'nav'+entry.channel+'-head',1.035);
   if(entry.channel===1)stroke(h,[[-5,2],[0,-5],[5,2],[0,-5],[0,26]],PHOTO_COLORS.green,1.9);
   else polygon(h,[[0,-6],[-5,1],[-5,24],[5,24],[5,1]],PHOTO_COLORS.green,'none',1.8);
  }
  const tailAngle=rel(angle+180);
  if(Math.abs(tailAngle)>limit)continue;
  const t=mapMarker(g,l,tailAngle,'nav'+entry.channel+'-tail',1.02);
  const base=entry.channel===1?[[-9,-10],[-3,-10],[-3,-3],[3,-3],[3,-10],[9,-10],[9,-4],[4,2],[4,23],[0,27],[-4,23],[-4,2],[-9,-4]]:
   [[-9,-10],[0,-5],[9,-10],[9,-2],[4,4],[4,23],[0,27],[-4,23],[-4,4],[-9,-2]];
  polygon(t,base,PHOTO_COLORS.green,'none',1.85);
 }
}
function waypointBearingPointer(svg,m,l){
 // 10.31.9 item 11 / 10.32.6: magenta pointer only for an active,
 // validated FMC waypoint. This is separate from green ADF heads/tails.
 if(!['FULL_NAV','EXP_NAV'].includes(m.mode)||m.nav.valid!==true||
  !Number.isFinite(m.waypointBearing))return;
 const angle=rel(m.waypointBearing-m.reference);
 if(Math.abs(angle)>l.degrees/2)return;
 const g=layer(svg,'active-waypoint-bearing');
 const h=mapMarker(g,l,angle,'waypoint-bearing-pointer',.93);
 polygon(h,[[0,-12],[-6,2],[0,-1],[6,2]],PHOTO_COLORS.magenta,'none',1.9);
}
function aircraft(svg,l,full){
 if(!l.aircraft)return;
 const [cx,cy]=l.aircraft,g=layer(svg,'aircraft');
 if(l.calibrated){
  polygon(g,[[cx,cy],[cx-13,cy+33],[cx+13,cy+33]],PHOTO_COLORS.white,'none',1.7);
 }else if(full){
  line(g,cx,cy-24,cx,cy+26,COLORS.white,2.5);
  line(g,cx-23,cy+3,cx+23,cy+3,COLORS.white,2.5);
  line(g,cx-10,cy+19,cx+10,cy+19,COLORS.white,2.1);
 }else polygon(g,[[cx,cy-22],[cx-12,cy+12],[cx+12,cy+12]],COLORS.white,COLORS.black,2.1);
}
function projection(m,l,plan=false){
 const [cx,cy]=plan?[252,294]:l.roseCenter;
 const scale=l.radius/m.range,scaleX=(l.radiusX??l.radius)/m.range;
 const anchor=plan?m.route.points[clamp(m.route.centerIndex,0,m.route.points.length-1)]:null;
 return (east,north)=>{
  const a=rad(plan?0:m.geoTrack??m.reference);
  const e=east-(anchor?.x??0),n=north-(anchor?.y??0);
  return [cx+scaleX*(e*Math.cos(a)-n*Math.sin(a)),cy-scale*(n*Math.cos(a)+e*Math.sin(a))];
 };
}
const symbolVisible=([x,y],l)=>l.calibrated?x>=0&&x<=W&&y>=49&&y<=H:x>=25&&x<=482&&y>=89&&y<=462;
function mapWaypoint(g,x,y,pt,color,showData,shape){
 if(shape==='airport')make(g,'ellipse',{cx:x,cy:y,rx:px(22),ry:py(16),fill:'none',stroke:color,'stroke-width':1.9});
 else if(shape==='nav'){
  const mark=layer(g,'map-navaid');
  const vertices=[[-18,0],[-12,-11],[12,-11],[18,0],[11,14],[-11,14]];
  const place=points=>points.map(([dx,dy])=>[x+px(dx),y+py(dy)]);
  polygon(mark,place(vertices),color,'none',1.75);
  for(const spoke of [[[-12,-11],[-27,-17],[-37,-5],[-18,0]],[[12,-11],[27,-17],[37,-5],[18,0]],[[-11,14],[-11,27],[11,27],[11,14]]])
   stroke(mark,place(spoke),color,1.75);
 }else if(pt.symbol==='CONSTRAINT')circle(g,x,y,5.8,color);
 else polygon(g,Array.from({length:8},(_,i)=>{
  const angle=rad(i*45),radius=i%2?2.2:9.5;
  return [x+Math.sin(angle)*radius,y+Math.cos(angle)*radius];
 }),color,'none',1.55);
 const dx=shape==='nav'?19:shape==='airport'?16:10,labelY=y+3;
 photoText(g,pt.name,x+dx,labelY,MAP_ID_SIZE,color);
 if(showData){
  photoText(g,pt.altitude,x+dx,labelY+14,MAP_DETAIL_SIZE,color);
  photoText(g,pt.eta,x+dx,labelY+28,MAP_DETAIL_SIZE,color);
 }
}
function waypoint(parent,x,y,pt,color,showData,shape='star',calibrated=false){
 const g=layer(parent,'waypoint');
 if(calibrated){mapWaypoint(g,x,y,pt,color,showData,shape);return;}
 if(shape==='star')polygon(g,Array.from({length:8},(_,i)=>polar(x,y,i*45,i%2?2.5:7)),color,COLORS.black);
 else if(shape==='airport')circle(g,x,y,6,color);
 else polygon(g,Array.from({length:6},(_,i)=>polar(x,y,i*60,6)),color);
 text(g,pt.name,x+10,y-7,15,color);
 if(showData){
  text(g,pt.altitude,x+10,y+7,13,color);
  text(g,pt.eta,x+10,y+20,13,color);
 }
}
// Measure a conservative glyph footprint before drawing so that a fix ID
// cannot be partly erased by the circular/sector compass crop. Label positions
// are re-evaluated on every render as the ownship moves and the range changes.
function routeFixLabel(x,y,name,l,occupied=[]){
 const size=MAP_ID_SIZE,width=Math.max(22,String(name).length*size*.75),height=size*.94;
 const cx=l.roseCenter[0],cy=l.roseCenter[1],rx=Math.max(1,(l.radiusX??l.radius)-9),
  ry=Math.max(1,l.radius-9);
 const fitsBox=([left,top,right,bottom])=>{
  if(left<12||right>W-12||top<86||bottom>H-21)return false;
  for(const px of [left,right])for(const py of [top,bottom]){
   const dx=(px-cx)/rx,dy=(py-cy)/ry;
   if(dx*dx+dy*dy>1)return false;
   if(l.degrees<360&&Math.abs(Math.atan2(dx,-dy)*180/Math.PI)>l.degrees/2-2)return false;
  }
  return !occupied.some(([a,b,c,d])=>left<c+7&&right>a-7&&top<d+4&&bottom>b-4);
 };
 const candidates=[
  [x+15,y+4,'start'],[x-15,y+4,'end'],
  [x+15,y-18,'start'],[x-15,y-18,'end'],
  [x+15,y+24,'start'],[x-15,y+24,'end'],
  [x-width/2,y-22,'start'],[x-width/2,y+29,'start'],
  [x-width/2,y-40,'start'],[x-width/2,y+44,'start']
 ];
 for(const [atX,atY,align] of candidates){
  const left=align==='end'?atX-width:atX;
  const box=[left,atY-height,left+width,atY+3];
  if(fitsBox(box))return {x:atX,y:atY,align,box};
 }
 return null; // Never draw a half-visible identifier.
}
function drawRoute(svg,m,l,status,plan){
 const project=projection(m,l,plan),points=m.route.points;
 const rangeClip=m.routeClipToScale&&!plan?'url(#'+(svg.id||'ehsi')+'-route-range)':null;
 const g=layer(svg,plan?'plan-route':'active-route',rangeClip?{'clip-path':rangeClip}:{});

 const brightness=String(clamp(m.efis.wxBrightness??1,0,1));
 g.style.opacity=brightness;
 const colors=l.calibrated?PHOTO_COLORS:COLORS;
 const fits=xy=>{
  if(!symbolVisible(xy,l))return false;
  if(m.routeClipToScale&&!plan){
   const dx=(xy[0]-l.roseCenter[0])/Math.max(1,(l.radiusX??l.radius)-17);
   const dy=(xy[1]-l.roseCenter[1])/Math.max(1,l.radius-17);
   if(dx*dx+dy*dy>1)return false;
   if(l.degrees<360&&Math.abs(Math.atan2(dx,-dy)*180/Math.PI)>l.degrees/2-2)return false;
  }
  return l.calibrated||plan||Math.hypot(xy[0]-l.roseCenter[0],xy[1]-l.roseCenter[1])<l.radius-33;
 };
 if(status.routeValid){
  const positions=points.map(pt=>project(pt.x,pt.y));
  const segments=layer(g,'route-segments');
  positions.slice(1).forEach((to,i)=>{
   const leg=points[i+1].leg||'ACTIVE';
   if(leg==='DISCONTINUITY')return;
   const styles={ACTIVE:[colors.magenta,null],MOD:[colors.white,'6 5'],INACTIVE:[colors.cyan,'12 8'],OFFSET:[colors.magenta,'10 4 2 4']};
   const [color,dash]=styles[leg]||styles.ACTIVE;
   line(segments,...positions[i],...to,color,2.1,{'stroke-dasharray':dash});
  });
  const occupied=[];
  positions.forEach(([x,y],i)=>{
   if(!fits([x,y])||points[i].hidden)return;
   const color=i===m.route.activeIndex?colors.magenta:colors.white;
   if(m.routeClipToScale&&!plan&&l.calibrated){
    // Symbol and label are separate. Use a fully legible, in-scale label
    // placement instead of letting the SVG clip cut half of its letters.
    waypoint(g,x,y,{...points[i],name:''},color,false,'star',true);
    const placement=routeFixLabel(x,y,points[i].name,l,occupied);
    if(placement){
     const label=layer(g,'route-fix-label',{'data-fix':points[i].name,
      'data-label-fitted':'true','data-label-side':placement.align});
     photoText(label,points[i].name,placement.x,placement.y,MAP_ID_SIZE,color,placement.align);
     // FCOM 10.32.17: RTE DATA displays altitude constraints and waypoint ETA
     // on calibrated photo glass too, not only in the uncalibrated lab.
     if(m.options.rteData===true){
      const fields=[points[i].altitude,points[i].eta]
       .filter(value=>value!==null&&value!==undefined&&String(value)!=='').slice(0,2);
      fields.forEach((field,j)=>{
       const y=placement.y+(j+1)*(MAP_DETAIL_SIZE+3);
       const width=String(field).length*MAP_DETAIL_SIZE*.73;
       const left=placement.align==='end'?placement.x-width:placement.x;
       const right=placement.align==='end'?placement.x:placement.x+width;
       const radiusX=Math.max(1,(l.radiusX??l.radius)-9),radiusY=Math.max(1,l.radius-9);
       const inside=[left,right].every(x=>{
        const dx=(x-l.roseCenter[0])/radiusX,dy=(y-l.roseCenter[1])/radiusY;
        return x>12&&x<500&&y>86&&y<491&&dx*dx+dy*dy<=1;
       });
       if(inside)photoText(label,String(field),placement.x,y,MAP_DETAIL_SIZE,color,placement.align);
      });
     }
     occupied.push(placement.box);
    }
   }else waypoint(g,x,y,points[i],color,m.options.rteData,'star',l.calibrated);
  });
 }
 if(!m.nav.valid)return;
 const sample=m.mapObjects??[
  {name:'MAHAN',x:-10,y:-12,on:status.wptDatabaseEligible,shape:'star'},
  {name:'LAR',x:-7,y:-5,on:m.options.arpt,shape:'airport'},
  {name:'SYZ',x:-13,y:3,on:m.options.navAid,shape:'nav'},
  {name:'KRN',x:-78,y:-38,on:m.options.navAid,shape:'nav'}
 ];
 const db=layer(svg,'database-options');
 db.style.opacity=brightness;
 for(const pt of sample){
  const xy=project(pt.x,pt.y);
  if(pt.on&&fits(xy)&&!(pt.shape==='star'&&m.range>40))
   waypoint(db,...xy,pt,pt.tuned===true?colors.green:colors.cyan,false,pt.shape,l.calibrated);
 }
 if(status.routeValid&&m.syntheticAirport!==false){
  const xy=project(-33,-8);
  if(fits(xy)){
   const [x,y]=xy,a=layer(g,'route-airport');
   circle(a,x,y,6);
   line(a,x-7,y+8,x+7,y-8,COLORS.white,2.2);
   if(l.calibrated)photoText(a,'SIMX',x+11,y+12,MAP_ID_SIZE);
   else text(a,'SIMX',x+11,y+12,15);
  }
 }
}
function course(svg,m,l){
 const [cx,cy]=l.roseCenter,r=l.radius,full=l.degrees===360;
 const g=layer(svg,'course-deviation');
 if(!Number.isFinite(m.course))return;
 const delta=rel(m.course-m.reference);
 const stretch=l.radiusX?l.radiusX/l.radius:1;
 const rotation='translate('+cx+' '+cy+') scale('+stretch+' 1) rotate('+delta+') scale('+(1/stretch)+' 1) translate('+(-cx)+' '+(-cy)+')';
 const n=make(g,'g',{transform:rotation});
 const tip=cy-r+20,stub=full?52:48;
 if(full){
  polygon(n,[[cx,tip],[cx-4,tip+8],[cx-4,cy-stub],[cx+4,cy-stub],[cx+4,tip+8]],PHOTO_COLORS.white,'none',1.6);
  polygon(n,[[cx-4,cy+stub],[cx+4,cy+stub],[cx+4,cy+r-20],[cx-4,cy+r-20]],PHOTO_COLORS.white,'none',1.6);
 }else{
  polygon(n,[[cx,tip],[cx-8,tip+12],[cx+8,tip+12]],COLORS.white);
  line(n,cx,tip+13,cx,cy-stub,COLORS.magenta,2.2);
 }
 const spacing=full?21:29;
 if(m.nav.valid&&Number.isFinite(m.nav.cdi)){
  for(const i of [-2,-1,1,2])circle(n,cx+i*spacing,cy,3);
  const x=cx+clamp(m.nav.cdi||0,-2.4,2.4)*spacing;
  if(full)polygon(n,[[x-3,cy-stub],[x+3,cy-stub],[x+3,cy+stub],[x-3,cy+stub]],PHOTO_COLORS.magenta,'none',1.8);
  else line(n,x,cy-stub,x,cy+stub,PHOTO_COLORS.magenta,2.2);
  if(m.radio&&m.nav.type==='VOR'&&m.nav.toFrom){
   if(full)polygon(n,[[cx+14,cy-12],[cx+21,cy-2],[cx+7,cy-2]].map(([x1,y])=>[x1,m.nav.toFrom==='TO'?y:2*cy-y]),COLORS.white);
   text(g,m.nav.toFrom,489,448,17,COLORS.white,'end');
  }
 }else flag(g,m.radio?(m.nav.type==='ILS'?'LOC':'VOR'):'XTK',full?344:357,full?256:379);
}
function vertical(svg,m){
 const isIls=m.radio&&m.nav.type==='ILS',vnav=!m.radio&&m.mode!=='PLAN'&&m.nav.valid&&m.nav.vnavActive&&m.nav.descent===true;
 if(!isIls&&!vnav)return;
 const g=layer(svg,isIls?'glideslope':'vnav-path'),x=473,mid=isIls?(m.mode==='FULL_VOR_ILS'?281:364):341;
 for(let i=-2;i<=2;i++)circle(g,x,mid+i*18,2.8);
 if(isIls&&!m.nav.gsValid)return;
 const offset=isIls?m.nav.gsDev:m.nav.vnav/200,y=mid+clamp(offset,-2.4,2.4)*18;
 polygon(g,[[x-7,y],[x,y-8],[x+7,y],[x,y+8]],COLORS.magenta,COLORS.black,2);
 if(vnav&&Math.abs(m.nav.vnav)>400)text(g,Math.abs(m.nav.vnav),489,385,14,COLORS.white,'end');
}
function wind(svg,m){
 if(m.mode==='PLAN'||!Number.isFinite(m.windDirection)||!Number.isFinite(m.windSpeed)||m.windSpeed<=0)return;
 const l=layoutFor(m),g=layer(svg,'wind');
 const [x,y]=l.full?G.wind.full:m.mode==='CTR_MAP'?G.wind.center:G.wind.expanded;
 photoText(g,direction(m.windDirection)+'°/'+Math.round(m.windSpeed),x,y,23);
 if(m.windSpeed<6)return;
 const ax=x+13,ay=y-33;
 const arrow=make(g,'g',{transform:'translate('+ax+' '+ay+') rotate('+rel(m.windDirection+180-m.reference)+')'});
 line(arrow,0,15,0,-15,PHOTO_COLORS.white,1.8);stroke(arrow,[[-5,-8],[0,-15],[5,-8]],PHOTO_COLORS.white,1.8);
}
function footer(svg,m){
 const g=layer(svg,'lower-data');
 wind(g,m);
 if(m.radio){
  const x=layoutFor(m).full?75:57;
  photoText(g,m.nav.source,x,459,22,PHOTO_COLORS.green);
  if(m.nav.frequency!=null)photoText(g,Number(m.nav.frequency).toFixed(2),440,459,23,PHOTO_COLORS.green,'end');
 }else if(m.mode.endsWith('NAV'))photoText(g,'NAV',72,459,21,PHOTO_COLORS.green);
}
function positionDifferenceDisplay(svg,m){
 // FCOM 10.31.9 item 14 / 10.32.22: display only verified FMC-vs-IRS
 // differences beyond an externally supplied limit. Selected IRS first.
 if(!['MAP','CTR_MAP','FULL_NAV','EXP_NAV'].includes(m.mode)||
  !Array.isArray(m.positionDifferences)||!m.positionDifferences.length)return;
 const g=layer(svg,'fmc-irs-position-difference');
 m.positionDifferences.slice(0,2).forEach((entry,i)=>{
  if(!Number.isFinite(entry.distanceNm)||!['L','R'].includes(entry.side))return;
  const y=440+i*24,x=447;
  photoText(g,entry.distanceNm.toFixed(1),x-25,y,18,PHOTO_COLORS.white,'end');
  photoText(g,entry.side,x,y,18,PHOTO_COLORS.white);
  if(Number.isFinite(entry.bearingMagDeg)&&Number.isFinite(m.reference)){
   const a=rel(entry.bearingMagDeg-m.reference);
   const arrow=make(g,'g',{transform:'translate('+(x+13)+' '+(y-7)+') rotate('+a+')'});
   stroke(arrow,[[0,7],[0,-7],[-3,-2],[0,-7],[3,-2]],PHOTO_COLORS.white,1.4);
  }
 });
}
function radar(svg,m,l,status){
 if(!status.wxrVisible&&!status.terrainVisible)return;
 const g=layer(svg,status.wxrVisible?'weather-returns':'terrain-returns',{opacity:m.efis.wxBrightness??1});
 const project=projection(m,l),[x,y]=project(-6,-10);
 const palette=status.wxrVisible?['#167738','#dba628','#b32b26']:['#136e30','#ba9025','#8e2b26'];
 const shape=[[-44,10],[-52,-16],[-27,-40],[0,-32],[28,-43],[47,-19],[38,3],[20,24],[-17,28]];
 palette.forEach((color,i)=>{
  const scale=1-i*.31;
  polygon(g,shape.map(([dx,dy])=>[x+dx*scale,y+dy*scale]),color,color,0);
 });
}
function trend(svg,m,l){
 if(!['MAP','CTR_MAP'].includes(m.mode)||!(m.groundSpeed>0))return;
 const g=layer(svg,'position-trend'),[cx,cy]=l.roseCenter;
 const speed=m.groundSpeed*.514444,omega=9.80665*Math.tan(rad(clamp(m.bank||0,-60,60)))/speed,scale=l.radius/m.range/1852;
 const tMax=m.range===10?30:m.range===20?60:90;
 const position=t=>Math.abs(omega)<.000001?[cx,cy-speed*t*scale]:[cx+speed/omega*(1-Math.cos(omega*t))*scale*((l.radiusX??l.radius)/l.radius),cy-speed/omega*Math.sin(omega*t)*scale];
 for(let base=0;base<tMax;base+=30){
  stroke(g,Array.from({length:7},(_,i)=>position(base+3+i*4)),COLORS.white,1.45);
 }
}
function altitudeArc(svg,m,l){
 const a=m.altitudeArc;
 if(!a||!['MAP','CTR_MAP'].includes(m.mode)||!a.verticalSpeed)return;
 const minutes=(a.target-a.current)/a.verticalSpeed,distance=minutes*m.groundSpeed/60;
 if(!Number.isFinite(distance)||distance<=0||distance>m.range)return;
 const r=l.radius*distance/m.range;
 const half=Math.min(17,52/r*180/Math.PI),g=layer(svg,'altitude-range-arc');
 stroke(g,Array.from({length:25},(_,i)=>rosePoint(l,(i/12-1)*half,distance/m.range)),COLORS.green,2);
}
function traffic(svg,m,l,status){
 const {mode,targets=[]}=m.traffic,g=layer(svg,'traffic-status');
 const enabled=['TA_RA','TA_ONLY','TEST'].includes(mode);
 const visible=enabled?targets.filter(t=>mode!=='TA_ONLY'||t.kind!=='RA'):[];
 const advisories=visible.filter(t=>t.kind==='TA'||t.kind==='RA');
 const alerts=advisories.some(t=>t.kind==='RA')?COLORS.red:COLORS.amber;
 if(advisories.length){make(g,'rect',{x:343,y:196,width:97,height:22,fill:COLORS.black});text(g,'TRAFFIC',437,214,21,alerts,'end');}
 const labels={OFF:'TCAS OFF',FAIL:'TCAS FAIL',TA_ONLY:'TA ONLY',TEST:'TCAS TEST'};
 if(mode==='OFF'&&l.calibrated){
  photoText(g,'TCAS',64,205,22);
  photoText(g,'OFF',64,226,22);
 }else if(labels[mode]&&(mode!=='FAIL'||!m.traffic.failSuppressed)){
  text(g,labels[mode],64,226,18,mode==='FAIL'?COLORS.amber:mode==='TA_ONLY'?COLORS.green:COLORS.white,'start');
 }
 if(!status.trafficOverlay)return;
 photoText(g,'TFC',G.header.left,184+(Number.isFinite(m.trafficLabelOffsetY)?m.trafficLabelOffsetY:0),21,PHOTO_COLORS.green);
 let offscale=null;
 let noBearingRow=0;
 for(const t of visible){
  if(!Number.isFinite(t.bearing)){
   if(t.kind==='RA'||t.kind==='TA'){
    const color=t.kind==='RA'?COLORS.red:COLORS.amber;
    const altitude=Number.isFinite(t.displayAltitude)?String(t.displayAltitude).padStart(3,'0'):Number.isFinite(t.relativeAltitude)?
     (t.relativeAltitude>=0?'+':'-')+String(Math.round(Math.abs(t.relativeAltitude)/100)).padStart(2,'0'):'';
    const y=236+noBearingRow++*21;
    text(g,t.kind+' '+t.distance.toFixed(1)+' '+altitude,437,y,16,color,'end');
    if(Math.abs(t.verticalRate)>=500){
     const s=Math.sign(t.verticalRate);
     line(g,464,y+7*s,464,y-7*s,color);
     stroke(g,[[460,y-3*s],[464,y-7*s],[468,y-3*s]],color);
    }
   }
   continue;
  }
  const delta=rel(t.bearing-m.reference);
  const xy=rosePoint(l,delta,t.distance/m.range);
  if(t.distance>m.range||Math.abs(delta)>l.degrees/2||!symbolVisible(xy,l)){
   if(t.kind==='RA'||(t.kind==='TA'&&offscale!==COLORS.red))offscale=t.kind==='RA'?COLORS.red:COLORS.amber;
   continue;
  }
  const [x,y]=xy,target=layer(g,'traffic-'+t.kind.toLowerCase(),{'data-target-id':t.id||'',
   'data-relative-altitude':t.relativeAltitude??'UNKNOWN','data-bearing':t.bearing,'data-range':t.distance});
  const color=t.kind==='RA'?COLORS.red:t.kind==='TA'?COLORS.amber:COLORS.white;
  if(t.kind==='TA')circle(target,x,y,6,color,color);
  else if(t.kind==='RA')make(target,'rect',{x:x-6,y:y-6,width:12,height:12,fill:color});
  else polygon(target,[[x,y-7],[x+7,y],[x,y+7],[x-7,y]],color,t.kind==='PROX'?color:COLORS.black);
  if(Number.isFinite(t.relativeAltitude)){
   const a=Math.round(Math.abs(t.relativeAltitude)/100),above=t.relativeAltitude>=0;
   text(target,Number.isFinite(t.displayAltitude)?String(t.displayAltitude).padStart(3,'0'):
    (above?'+':'-')+String(a).padStart(2,'0'),x,y+(above?-14:15),16,color,'middle');
  }
  if(Math.abs(t.verticalRate)>=500){
   const s=Math.sign(t.verticalRate),arrow=layer(target,'traffic-trend',{'data-trend':s>0?'UP':'DOWN'});
   line(arrow,x+12,y+7*s,x+12,y-7*s,color);
   stroke(arrow,[[x+8,y-3*s],[x+12,y-7*s],[x+16,y-3*s]],color);
  }
 }
 if(offscale)text(g,'OFFSCALE',437,192,18,offscale,'end');
}
function render(svg,raw){
 if(!svg)return null;
 const m=model(raw),s=computeDisplay(raw),l=layoutFor(m);
 svg.replaceChildren();
 svg.setAttribute('viewBox','0 0 512 512');
 svg.setAttribute('preserveAspectRatio','none');
 svg.setAttribute('data-renderer',VERSION);
 svg.setAttribute('data-mode',m.mode);
 svg.setAttribute('data-presentation',m.modeName);
 svg.setAttribute('data-approved','false');
 svg.setAttribute('aria-label','Classic EHSI '+m.modeName);
 svg.style.opacity=String(m.efis.brightness??1);
 make(svg,'rect',{x:0,y:0,width:W,height:H,fill:COLORS.black});
 if(!s.powered)return s;
 if(!s.sgValid){text(svg,'SG FAIL',256,256,28,COLORS.amber,'middle');return s;}
 const defs=make(svg,'defs'),clipId=(svg.id||'ehsi')+'-plot';
 const clip=make(defs,'clipPath',{id:clipId});
 make(clip,'rect',l.calibrated?{x:0,y:49,width:W,height:H-49,rx:px(25),ry:py(25)}:{x:13,y:73,width:486,height:391});
 // FMC path, fix symbols and labels must not escape the compass scale.
 // Expanded: the 70-degree elliptical sector. Full: the 360-degree ellipse.
 if(m.routeClipToScale&&l.route&&m.mode!=='PLAN'){
  const rc=make(defs,'clipPath',{id:(svg.id||'ehsi')+'-route-range',clipPathUnits:'userSpaceOnUse'});
  if(l.degrees===360){
   make(rc,'ellipse',{cx:l.roseCenter[0],cy:l.roseCenter[1],
    rx:(l.radiusX??l.radius)-3,ry:l.radius-3});
  }else{
   const outline=[[...l.roseCenter]];
   for(let a=-l.degrees/2;a<=l.degrees/2;a+=.5){
    outline.push(rosePoint(l,Math.min(a,l.degrees/2),.991));
   }
   make(rc,'polygon',{points:outline.map(([x,y])=>x.toFixed(2)+','+y.toFixed(2)).join(' ')});
  }
 }
 const plot=layer(svg,'plot',{'clip-path':'url(#'+clipId+')'});
 header(svg,m,s);
 radar(plot,m,l,s);
 if(s.compassValid){
  compass(svg,m,l);
  navPointers(svg,m,l);
  waypointBearingPointer(svg,m,l);
 }
 if(l.route&&s.orientationValid)drawRoute(plot,m,l,s,m.mode==='PLAN');
 if(m.mode==='PLAN'){
  const n=layer(svg,'true-north');
  line(n,472,345,472,305);stroke(n,[[466,313],[472,305],[478,313]]);
  text(n,'N',472,295,17,COLORS.white,'middle');
 }
 if(s.compassValid&&m.mode!=='PLAN'){
  // FCOM 10.31.8 and 10.32.9: an active NAV route does not hide

  // the FMC selected course pointer and the lateral deviation dots.

  if(!l.route||['FULL_NAV','EXP_NAV'].includes(m.mode))course(plot,m,l);
  trend(plot,m,l);
  altitudeArc(plot,m,l);
  aircraft(svg,l,l.degrees===360);
 }
 if(m.efis.verticalFailure&&!m.radio&&m.mode!=='PLAN')flag(svg,'VTK',473,341);
 if(l.route&&!m.nav.valid&&!m.efis.mapFailurePending&&!m.weather.disagreement?.includes('MAP'))flag(svg,'MAP',256,291);
 vertical(svg,m);
 footer(svg,m);
 positionDifferenceDisplay(svg,m);
 traffic(svg,m,l,s);
 const w=layer(svg,'weather-status');
 if(m.weather.selected&&!m.weather.healthy)text(w,'WXR FAIL',495,49,16,COLORS.amber,'end');
 else if(m.weather.displayCooling)text(w,'WXR DSPY',495,49,16,COLORS.amber,'end');
 if(s.wxrVisible)text(w,'WX',495,49,16,COLORS.green,'end');
 if(s.terrainVisible)text(w,'TERR',495,49,16,COLORS.cyan,'end');
 if(m.weather.terrainFailure)text(w,'TERR FAIL',495,49,16,COLORS.amber,'end');
 if(m.weather.disagreement)text(w,m.weather.disagreement+' RANGE DISAGREE',256,386,17,COLORS.amber,'middle');
 return s;
}
function routeProjection(input){
 const m=model({...input,route:{points:[]}});
 // The normal NAV glyph contract remains unchanged; source-only overlays
  // also need accurate projections for centered/expanded NAV rose modes.
  return ['PLAN','MAP','CTR_MAP','EXP_NAV','FULL_NAV'].includes(m.mode)?
   projection(m,layoutFor(m),m.mode==='PLAN'):null;
}
return {VERSION,COLORS,MODES,REFERENCE,LAYOUT,FRAME,DISPLAY_ASPECT,rosePoint,norm,rel,selectedHeadingPresentation,model,computeDisplay,render,routeProjection,routeFixLabel};
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-sg-ehsi-preview-v1.js?v=SG-5-MAP-MODES-20261117-0002 */
try{
/* Non-executable CDU/SG reference geometry for the EHSI MAP and PLAN screens. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737CduSgEHSIPreviewV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',VERSION='CDU-SG-EHSI-ROUTE-TRAJECTORY-0002';
 const Trajectory=(typeof globalThis==='object'?globalThis.B737UnifiedSGProcedureTrajectoryV1:null)||
  (typeof module==='object'&&typeof require==='function'?require('../../engine/fmc/sg-procedure-trajectory-v1.js'):null);
 function collect(s){
  if(!s?.connected||s.sourceOnly!==true||s.fmcExecutable!==false)return [];
  return Object.values(s.geometries||{}).flatMap(x=>x?.renderStyle==='DASHED_REFERENCE_CHORDS_ONLY'?
   (x.segments||[]):[]).filter(a=>Array.isArray(a)&&a.length===2);
 }
 function collectFixes(s){
  if(!s?.connected||s.sourceOnly!==true||s.fmcExecutable!==false)return [];
  return Object.values(s.geometries||{}).flatMap(x=>x?.renderStyle==='DASHED_REFERENCE_CHORDS_ONLY'?
   (x.fixes||[]):[]).filter(x=>x&&Number.isFinite(x.lon)&&Number.isFinite(x.lat)&&
     Math.abs(x.lon)<=180&&Math.abs(x.lat)<=90&&typeof x.ident==='string').slice(0,150);
 }
 // Match the calibrated EHSI plot aperture and clip the actual coordinates.
 // This also keeps visibility independent of a document's HTML base URL.
 const PLOT={left:1,right:511,top:49,bottom:511};
 const onPlot=([x,y],pad=0)=>x>=PLOT.left+pad&&x<=PLOT.right-pad&&
  y>=PLOT.top+pad&&y<=PLOT.bottom-pad;
 function clipSegment([[x,y],[endX,endY]]){
  if(![x,y,endX,endY].every(Number.isFinite))return null;
  const dx=endX-x,dy=endY-y;
  let start=0,end=1;
  for(const [direction,distance] of [
   [-dx,x-PLOT.left],[dx,PLOT.right-x],[-dy,y-PLOT.top],[dy,PLOT.bottom-y]
  ]){
   if(direction<0)start=Math.max(start,distance/direction);
   else if(direction>0)end=Math.min(end,distance/direction);
   else if(distance<0)return null;
   if(start>=end)return null;
  }
  return [[x+start*dx,y+start*dy],[x+end*dx,y+end*dy]];
 }
 function draw(svg,source,mode,range,powered,offset,project,anchor,flight=null){
  if(!svg)return 0;
  svg.querySelector('[data-cdu-sg-reference]')?.remove();
  if(!powered||!['PLAN','MAP','CTR_MAP','EXP_NAV','FULL_NAV'].includes(mode)||!Number.isFinite(range)||range<=0||
     typeof offset!=='function'||source?.connected!==true||source?.sourceOnly!==true||
     source?.fmcExecutable!==false)return 0;

  // ACT is the last confirmed, reference-only plan. MOD is a preview overlay:
  // unchanged elements of the confirmed plan remain solid magenta while new
  // or altered geometry is cyan dashed. EXEC promotes MOD to ACT atomically.
  const active=source.active?.geometries||{},pending=source.modified?.geometries||null;
  const changed=pending?Object.fromEntries(Object.entries(pending).filter(([key,value])=>
   JSON.stringify(value)!==JSON.stringify(active[key]))):null;
  const valid=x=>x?.renderStyle==='DASHED_REFERENCE_CHORDS_ONLY';
  const layers=[
   {stage:'ACT',color:'#ff47e1',dash:null,geometries:Object.entries(active)
    .filter(([k,g])=>valid(g)&&!(g.kind==='RUNWAY'&&pending?.[k]&&
      JSON.stringify(g)!==JSON.stringify(pending[k]))).map(([,g])=>g)},
   ...(changed?[{stage:'MOD',color:'#00c8f2',dash:'7 5',
    geometries:Object.values(changed).filter(valid)}]:[])
  ].filter(layer=>layer.geometries.length);
  if(!layers.length)return 0;
  const state=pending?'MOD':'ACT';
  const make=(parent,name,attrs={})=>{
   const el=svg.ownerDocument.createElementNS(NS,name);
   for(const [k,v] of Object.entries(attrs))if(v!==null&&v!==undefined)el.setAttribute(k,String(v));
   parent.appendChild(el);return el;
  };
  const group=make(svg,'g',{'data-cdu-sg-reference':'true','pointer-events':'none',
   'data-route-state':state,'data-source-only':'true','aria-label':'Non-executable CDU route reference'});
  const positioned=Number.isFinite(anchor?.lat)&&Number.isFinite(anchor?.lon);
  if(mode!=='PLAN'&&(!positioned||typeof project!=='function'))return 0;

  // Prefer the selected runway threshold when there is no active PLAN anchor.
  // Never manufacture a leg from a single unsourced airport point.
  const all=layers.flatMap(x=>x.geometries);
  const runway=all.find(x=>x.kind==='RUNWAY'&&x.fixes?.length)?.fixes[0];
  const fix=all.find(x=>x.fixes?.length)?.fixes[0];
  const pair=all.find(x=>x.segments?.length)?.segments[0]?.[0];
  const first=runway||fix||(pair&&{lon:pair[0],lat:pair[1]});
  if(!first)return 0;
  const ref=positioned?anchor:first,scale=178/range;
  const xyFor=(lon,lat)=>{
   const d=offset(ref,{lat,lon});
   return typeof project==='function'?project(d.x,d.y):[252+d.x*scale,294-d.y*scale];
  };
  let count=0;
  for(const layer of layers){
   const plot=make(group,'g',{'data-cdu-sg-plot':'true','data-reference-stage':layer.stage});
   for(const g of layer.geometries){
    if(g.kind==='RUNWAY'){
     const axis=g.segments?.[0],threshold=g.fixes?.[0];
     const shape=make(plot,'g',{'data-cdu-sg-runway':g.ident,'data-airport':g.airport,
      'data-reference-stage':layer.stage,'data-reference-only':'true'});
     if(Array.isArray(axis)&&axis.length===2&&axis.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))){
      const a=xyFor(...axis[0]),b=xyFor(...axis[1]);
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(Number.isFinite(len)&&len>.25){
       const ux=dx/len,uy=dy/len,nx=-uy,ny=ux,half=Math.max(3,Math.min(5,len*.22));
       const edge=(p,k)=>[p[0]+k*nx*half,p[1]+k*ny*half];
       const corners=[edge(a,1),edge(b,1),edge(b,-1),edge(a,-1)];
       make(shape,'path',{d:corners.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')+' Z',
        fill:'none',stroke:'#f4f7fa','stroke-width':2.1,
        'data-cdu-sg-geometry':'RUNWAY','data-runway-outline':'true'});count++;
       const extension=Math.max(45,Math.min(150,1200/range));
       for(const [name,from,to] of [
        ['FINAL',[a[0]-ux*extension,a[1]-uy*extension],a],
        ['UPWIND',b,[b[0]+ux*extension,b[1]+uy*extension]]
       ]){
        const line=clipSegment([from,to]);if(!line)continue;
        make(shape,'path',{d:'M'+line[0].join(' ')+' L'+line[1].join(' '),
         fill:'none',stroke:'#f4f7fa','stroke-width':2,'stroke-dasharray':'10 8',
         'data-runway-extension':name,'data-reference-only':'true'});count++;
       }
      }
     }
     if(Number.isFinite(threshold?.lon)&&Number.isFinite(threshold?.lat)){
      const xy=xyFor(threshold.lon,threshold.lat);
      if(onPlot(xy,7)){
       const [x,y]=xy,right=x>450;
       if(!axis?.length){
        make(shape,'circle',{cx:x,cy:y,r:5,stroke:'#f4f7fa',fill:'none',
         'data-runway-threshold-only':'true'});count++;
       }
       const name=make(shape,'text',{x:x+(right?-12:12),y:y-9,fill:'#f4f7fa',
        'font-size':12,'text-anchor':right?'end':'start','font-family':'monospace'});
       name.textContent=g.airport+' '+g.ident;count++;
      }
     }
     continue;
    }
    // Source-command leg programs take priority over raw fix-to-fix chords.
    const model=g.program?Trajectory?.trajectory?.(g.program,flight):null;
    if(model&&Array.isArray(model.segments)){
     for(const leg of model.segments){
      if(!Array.isArray(leg.points)||leg.points.length<2)continue;
      const paths=[];
      for(let i=1;i<leg.points.length;i++){
       const a=leg.points[i-1],b=leg.points[i];
       if(!Number.isFinite(a?.lon)||!Number.isFinite(a?.lat)||
          !Number.isFinite(b?.lon)||!Number.isFinite(b?.lat))continue;
       const clipped=clipSegment([xyFor(a.lon,a.lat),xyFor(b.lon,b.lat)]);
       if(clipped)paths.push('M'+clipped[0].join(' ')+' L'+clipped[1].join(' '));
      }
      if(!paths.length)continue;
      make(plot,'path',{d:paths.join(' '),fill:'none',stroke:layer.color,
       'stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round',
       'stroke-dasharray':layer.dash,'data-trajectory-leg':leg.type,
       'data-trajectory-profile':model.profile,
       'data-cdu-sg-geometry':'PROCEDURE','data-reference-stage':layer.stage,
       'data-reference-only':'true'});count++;
     }
    }
    if(!g.program)for(const segment of (g.segments||[]).slice(0,300)){
     if(!Array.isArray(segment)||segment.length!==2||!segment.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))continue;
     const xy=clipSegment(segment.map(([lon,lat])=>xyFor(lon,lat)));
     if(!xy)continue;
     make(plot,'path',{d:'M'+xy[0].join(' ')+' L'+xy[1].join(' '),fill:'none',
      stroke:layer.color,'stroke-width':2.1,'stroke-dasharray':layer.dash,
      'data-reference-stage':layer.stage,'data-reference-only':'true',
      'data-cdu-sg-geometry':'PROCEDURE'});
     count++;
    }
    for(const point of (g.fixes||[]).slice(0,150)){
     if(!Number.isFinite(point.lon)||!Number.isFinite(point.lat))continue;
     const xy=xyFor(point.lon,point.lat);
     if(!onPlot(xy,7))continue;
     const [x,y]=xy,right=x>450;
     {
      make(plot,'circle',{cx:x,cy:y,r:3.2,fill:layer.color,'data-sourced-fix':'true'});
      const t=make(plot,'text',{x:x+(right?-6:6),y:y<65?y+15:y-5,fill:layer.color,
       'font-size':12,'text-anchor':right?'end':'start','font-family':'monospace',
       'data-source-ident':'true'});
      t.textContent=point.ident;
     }
     count++;
    }
   }
  }
  return count;
 }

 return Object.freeze({VERSION,collect,collectFixes,draw});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ehsi-radio-overlays-v1.js?v=EHSI-RADIO-OVERLAYS-0001 */
try{
/* Unified EHSI valid-radio overlays. Read-only; no synthetic NAV/ADF signal.
 * Independent valid NAV1/NAV2 + powered MCP CRS1/CRS2 -> two dashed green courses on each EHSI.
 * EFIS VOR/ADF option + valid receiver -> solid green station bearing.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.B737UnifiedEhsiRadioOverlayV1=api;
})(globalThis,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',NM=3440.065;
 const norm=n=>((n%360)+360)%360;
 const valid=rec=>rec?.quality==='VALID'&&rec.value&&typeof rec.value==='object'?rec.value:null;
 const coords=o=>Number.isFinite(o?.lat)&&Math.abs(o.lat)<=90&&
  Number.isFinite(o?.lon)&&Math.abs(o.lon)<=180;
 const station=o=>Number.isFinite(o?.stationLat)&&Number.isFinite(o?.stationLon)?
  {lat:o.stationLat,lon:o.stationLon}:null;
 function positionDelta(from,to){
  const r=Math.PI/180,lat1=from.lat*r,lat2=to.lat*r,dl=norm(to.lon-from.lon+180)*r-180*r;
  const dLat=lat2-lat1;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dl/2)**2;
  const arc=2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
  const bearing=Math.atan2(Math.sin(dl)*Math.cos(lat2),
   Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dl));
  const distance=arc*NM;
  return {x:distance*Math.sin(bearing),y:distance*Math.cos(bearing),distance,bearingTrue:norm(bearing/r)};
 }
 function adfMagnetic(data,src){
  const bearing=data?.bearingDeg;
  if(!Number.isFinite(bearing))return null;
  if(data.bearingReference==='MAGNETIC')return norm(bearing);
  if(data.bearingReference==='TRUE'&&Number.isFinite(src?.magneticVariationDeg))
   return norm(bearing-src.magneticVariationDeg);
  if(data.bearingReference==='RELATIVE'&&Number.isFinite(src?.heading))
   return norm(bearing+src.heading);
  return null;
 }
 function plan({snapshot,src,position,options={},range=40,mode='MAP'}={}){
  const result={courses:[],pointers:[]};
  // The twin green MCP CRS1/CRS2 lines are an owner-requested MAP overlay.
  // FCOM 10.31.8 FULL NAV must display the FMC-selected course instead.
  if(!['MAP','CTR_MAP','EXP_NAV'].includes(mode)||
   !coords(position)||!Number.isFinite(range)||range<=0||!src)return result;
  const decl=src.magneticVariationDeg;
  const mcp=valid(snapshot?.['mcp.state']);
  // Both MCP windows are shared aircraft selections. Display CRS1 and CRS2
  // on BOTH EHSIs, independent of the receiving seat, transfer switch, SG or
  // EFIS VOR/ADF pointer selection. Each radio course uses its OWN NAV channel.
  for(const channel of [1,2]){
   const powered=channel===1?mcp?.powered===true:mcp?.course2Powered===true;
   const selectedCourse=channel===1?mcp?.courseL:mcp?.courseR;
   const vor=valid(snapshot?.['navigation.vor'+channel]);
   const ils=valid(snapshot?.['navigation.ils'+channel]);
   const selected=station(vor)?vor:station(ils)?ils:null;
   if(!powered||!Number.isFinite(selectedCourse)||!Number.isFinite(decl)||!selected)continue;
   const delta=positionDelta(position,station(selected));
   result.courses.push({channel,type:selected===vor?'VOR':'ILS',
    degree:norm(selectedCourse),trueDegree:norm(selectedCourse+decl),
    delta,near:delta.distance<=range*.9});
  }
  if(options.vorAdf!==true)return result;
  for(const channel of [1,2]){
   const vor=valid(snapshot?.['navigation.vor'+channel]);
   if(station(vor)){
    const delta=positionDelta(position,station(vor));
    const radial=Number.isFinite(vor.radialDeg)?norm(vor.radialDeg):
     Number.isFinite(decl)?norm(positionDelta(station(vor),position).bearingTrue-decl):null;
    result.pointers.push({channel,type:'V',delta,degree:radial,label:radial===null?
     'V'+channel:'V'+channel+'-'+String(Math.round(radial)%360).padStart(3,'0')});
   }
   const adf=valid(snapshot?.['navigation.adf'+channel]);
   if(adf){
    const bearing=adfMagnetic(adf,src);
    if(bearing===null)continue;
    const target=station(adf);
    // With a valid ADF bearing but no station coordinates, the line extends
    // to the selected EHSI scale; it is NOT labeled as a located station.
    const delta=target?positionDelta(position,target):{
     x:Math.sin(bearing*Math.PI/180)*range,
     y:Math.cos(bearing*Math.PI/180)*range,distance:range};
    const label='A'+channel+'-'+String(Math.round(bearing)%360).padStart(3,'0');
    result.pointers.push({channel,type:'A',delta,degree:bearing,label,
     stationLocated:!!target});
   }
  }
  // Draw VOR1/VOR2 first, then ADF1/ADF2, irrespective of which
  // receivers happen to be valid. This keeps bearing labels stable.
  result.pointers.sort((a,b)=>(a.type==='V'?0:1)-(b.type==='V'?0:1)||a.channel-b.channel);
  return result;
 }
 function draw(svg,model,src,snapshot,position,renderer){
  if(!svg||!renderer)return null;
  svg.querySelector('[data-radio-nav-overlay]')?.remove();
  const selection=plan({snapshot,src,position,options:model?.options,
   range:model?.range,mode:model?.mode});
  if(!selection.courses.length&&!selection.pointers.length)return selection;
  const projector=renderer.routeProjection?.(model);
  const layout=renderer.LAYOUT?.[model?.mode];
  if(!projector||!layout?.roseCenter)return selection;
  const doc=svg.ownerDocument,make=(parent,tag,props={},value)=>{
   const e=doc.createElementNS(NS,tag);
   for(const [k,v] of Object.entries(props))e.setAttribute(k,String(v));
   if(value!==undefined)e.textContent=String(value);
   parent.append(e);return e;
  };
  const color=renderer.COLORS?.green||'#41f585';
  const clipId=(svg.id||'unified-ehsi')+'-radio-clip';
  const root=make(svg,'g',{'data-radio-nav-overlay':'true','pointer-events':'none'});
  const defs=make(root,'defs'),clip=make(defs,'clipPath',{id:clipId});
  const [cx,cy]=layout.roseCenter;
  make(clip,'ellipse',{cx,cy,rx:(layout.radiusX??layout.radius)-3,ry:layout.radius-3});
  const lines=make(root,'g',{'clip-path':'url(#'+clipId+')'});
  const line=(name,xy1,xy2,dashed=false,extra={})=>make(lines,'line',{
   x1:xy1[0],y1:xy1[1],x2:xy2[0],y2:xy2[1],
   stroke:color,'stroke-width':dashed?1.8:2.25,
   ...(dashed?{'stroke-dasharray':'9 12'}:{}),'data-segment':name,...extra});
  const label=(text,xy,kind)=>make(lines,'text',{x:xy[0]+9,y:xy[1]-8,
   fill:color,'font-size':17,'font-weight':500,
   'font-family':'Lucida Console, monospace','stroke':'#030405',
   'stroke-width':.75,'paint-order':'stroke',
   'data-segment':kind},text);
  const maxNm=Math.max(5,model.range*2.2);
  for(const c of selection.courses){
   const r=c.trueDegree*Math.PI/180;
   const dx=Math.sin(r)*maxNm,dy=Math.cos(r)*maxNm;
   const p1=projector(c.delta.x-dx,c.delta.y-dy),p2=projector(c.delta.x+dx,c.delta.y+dy);
   line('nav-selected-course',p1,p2,true,{'data-channel':c.channel,'data-course':c.degree});
   if(c.near){
    const p=projector(c.delta.x,c.delta.y);
    // Keep the two selected course numbers readable when NAV1 and NAV2
    // happen to be tuned to the same station.
    const xy=[p[0]+(c.channel===1?-20:20),p[1]+(c.channel===1?-9:9)];
    if(xy[0]>28&&xy[0]<466&&xy[1]>86&&xy[1]<455){
     const printed=label(String(Math.round(c.degree)%360).padStart(3,'0'),xy,'nav-course-number');
     printed.setAttribute('data-channel',String(c.channel));
    }
   }
  }
  const own=projector(0,0);
  for(const target of selection.pointers){
   const d=target.delta,point=projector(d.x,d.y);
   line('nav-station-bearing',own,point,false,
    {'data-channel':target.channel,'data-source':target.type,'data-degree':target.degree??''});
   const factor=d.distance>0?Math.min(.82,.78*model.range/d.distance):.5;
   const p=projector(d.x*factor,d.y*factor);
   if(p[0]>26&&p[0]<467&&p[1]>83&&p[1]<460)
    label(target.label,p,'nav-bearing-label');
  }
  return selection;
 }
 return Object.freeze({version:'EHSI-RADIO-OVERLAYS-0003-FULL-NAV-FCOM-GATE',positionDelta,adfMagnetic,plan,draw});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/efis/fcom-10-32-symbol-registry-v1.js?v=FCOM1032-REGISTRY-0001 */
try{
/* FlySepehran 737-300/400/500 FCOM Vol 2, 10.32.1–10.32.39.
 * Extracted from the owner-provided Sep 2021 / May 2022 / Dec 2022 edition.
 * This is a declarative rule inventory, not fabricated aircraft-state data.
 * Test/simulator sources must supply real or explicitly injected evidence.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737FCOM1032SymbolRegistryV1=api;
})(globalThis,function(){
 'use strict';
 const specs=Object.freeze([
 {
  "id": "trackOrientation",
  "page": "10.32.2",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "green",
   "white",
   "green"
  ],
  "placement": "top-heading",
  "condition": "valid-track",
  "remarks": "TRK, current track and magnetic/true reference"
 },
 {
  "id": "headingOrientation",
  "page": "10.32.2",
  "modes": [
   "FULL_VOR_ILS",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green",
   "white",
   "green"
  ],
  "placement": "top-heading",
  "condition": "valid-heading",
  "remarks": "HDG, current heading and reference"
 },
 {
  "id": "selectedHeading",
  "page": "10.32.2",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "compass-rose",
  "condition": "mcp-heading-valid",
  "remarks": "Selected HDG bug and dashed line; no dashed reference line in PLAN"
 },
 {
  "id": "trackLineScale",
  "page": "10.32.3",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-axis",
  "condition": "valid-ground-track",
  "remarks": "Track line and selected-range fractions"
 },
 {
  "id": "driftAnglePointer",
  "page": "10.32.4",
  "modes": [
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "full-rose",
  "condition": "valid-ground-track",
  "remarks": "Ground-track indicator replaces track line"
 },
 {
  "id": "magneticTrueReference",
  "page": "10.32.4",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "green",
   "white",
   "amber"
  ],
  "placement": "top-heading",
  "condition": "valid-reference",
  "remarks": "True north boxed white, M transition highlighted ten seconds"
 },
 {
  "id": "expandedCompass",
  "page": "10.32.4",
  "modes": [
   "MAP",
   "EXP_NAV",
   "EXP_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "display-valid",
  "remarks": "Expanded 70-degree compass"
 },
 {
  "id": "ctrMapCompass",
  "page": "10.32.5",
  "modes": [
   "CTR_MAP"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "display-valid",
  "remarks": "Centered 360-degree compass"
 },
 {
  "id": "fullRose",
  "page": "10.32.5",
  "modes": [
   "FULL_NAV",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "display-valid",
  "remarks": "Full compass rose and 45-degree fixed reference ticks"
 },
 {
  "id": "currentHeadingPointer",
  "page": "10.32.6",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "heading-valid",
  "remarks": "White actual heading pointer"
 },
 {
  "id": "activeWaypointBearingPointer",
  "page": "10.32.6",
  "modes": [
   "EXP_NAV",
   "FULL_NAV"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "compass-rose",
  "condition": "fmc-active-fix-valid",
  "remarks": "Bearing toward active FMC waypoint"
 },
 {
  "id": "windDirectionSpeed",
  "page": "10.32.6",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "wind-block",
  "condition": "wind-valid",
  "remarks": "Display after >6kt; blank under 4kt hysteresis"
 },
 {
  "id": "navDataSource",
  "page": "10.32.7",
  "modes": [
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "lower-nav-data",
  "condition": "nav-source-valid",
  "remarks": "VOR1/2, ILS1/2 or FMC NAV"
 },
 {
  "id": "radioFrequency",
  "page": "10.32.7",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "lower-nav-data",
  "condition": "manual-frequency-valid",
  "remarks": "AUTO text when the receiver is in autotune"
 },
 {
  "id": "dmeDistance",
  "page": "10.32.8",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "top-left",
  "condition": "dme-valid",
  "remarks": "Slant DME to reference station"
 },
 {
  "id": "adfPointerHeadTail",
  "page": "10.32.8",
  "modes": [
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "compass-rose",
  "condition": "adf-valid",
  "remarks": "ADF 1 and 2 head and tail symbol"
 },
 {
  "id": "lateralDeviation",
  "page": "10.32.9",
  "modes": [
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "course-needle",
  "condition": "cdi-valid",
  "remarks": "ILS normal 1°/dot, expanded 0.5°/dot, VOR 5°/dot, FMC NAV 2NM/dot"
 },
 {
  "id": "selectedCourseExpanded",
  "page": "10.32.10",
  "modes": [
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white",
   "magenta"
  ],
  "placement": "course-needle",
  "condition": "selected-course-valid",
  "remarks": "Course pointer white and course line magenta"
 },
 {
  "id": "selectedCourseFull",
  "page": "10.32.10",
  "modes": [
   "FULL_NAV",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "full-rose",
  "condition": "selected-course-valid",
  "remarks": "White course pointer; TO/FROM for VOR"
 },
 {
  "id": "glideslopePointer",
  "page": "10.32.11",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "right-glideslope",
  "condition": "glideslope-valid",
  "remarks": "Pointer and deviation scale"
 },
 {
  "id": "toFrom",
  "page": "10.32.11",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "course-needle",
  "condition": "vor-tofrom-valid",
  "remarks": "VOR TO/FROM indicator"
 },
 {
  "id": "navaidDatabase",
  "page": "10.32.12",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan",
   "green"
  ],
  "placement": "map-position",
  "condition": "navaid-catalog-valid",
  "remarks": "All within 10/20/40; high-altitude only at 80/160/320, tuned VHF green"
 },
 {
  "id": "manualVorCourseReciprocal",
  "page": "10.32.12",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-position",
  "condition": "manually-tuned-vor-valid",
  "remarks": "Selected course and reciprocal printed by tuned VOR"
 },
 {
  "id": "vorStationRadial",
  "page": "10.32.12",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-bearing",
  "condition": "vor-adf-on-and-vor-valid",
  "remarks": "V1 or V2 radial"
 },
 {
  "id": "adfStationBearing",
  "page": "10.32.13",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-bearing",
  "condition": "vor-adf-on-and-adf-valid",
  "remarks": "A1/A2 bearing direction"
 },
 {
  "id": "aircraftExpanded",
  "page": "10.32.14",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "aircraft-anchor",
  "condition": "display-valid",
  "remarks": "Apex of white triangle marks present position"
 },
 {
  "id": "aircraftFull",
  "page": "10.32.14",
  "modes": [
   "FULL_NAV",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "aircraft-center",
  "condition": "display-valid",
  "remarks": "Centered airplane symbol"
 },
 {
  "id": "positionTrend",
  "page": "10.32.15",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "white"
  ],
  "placement": "flight-path",
  "condition": "groundspeed-bank-valid",
  "remarks": "Dashes predict 30/60/90 seconds; 10/20/>20NM limits 1/2/3"
 },
 {
  "id": "activeWaypointIdent",
  "page": "10.32.15",
  "modes": [
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "lower-nav-data",
  "condition": "fmc-active-fix-valid",
  "remarks": "Name of next active FMC fix"
 },
 {
  "id": "activeWaypointDistance",
  "page": "10.32.15",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "top-left",
  "condition": "fmc-active-fix-valid",
  "remarks": "NM to active waypoint"
 },
 {
  "id": "activeWaypointEta",
  "page": "10.32.15",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "top-right",
  "condition": "fmc-eta-valid",
  "remarks": "FMC arrival UTC time"
 },
 {
  "id": "courseChangeAlert",
  "page": "10.32.16",
  "modes": [
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "amber"
  ],
  "placement": "message",
  "condition": "fmc-course-change-within-10s",
  "remarks": "ALERT during ten seconds before waypoint change, clear at turn/sequence"
 },
 {
  "id": "standardWaypoint",
  "page": "10.32.16",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "map-position",
  "condition": "route-waypoint-valid",
  "remarks": "Active magenta, other active-route white"
 },
 {
  "id": "conditionalWaypoint",
  "page": "10.32.16",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "map-position",
  "condition": "conditional-waypoint-valid",
  "remarks": "Parenthesized conditional leg description"
 },
 {
  "id": "offRouteWaypoint",
  "page": "10.32.16",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "map-position",
  "condition": "wpt-on-and-range-le-40",
  "remarks": "Unselected waypoint"
 },
 {
  "id": "activeRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "map-route",
  "condition": "active-route-valid",
  "remarks": "Solid active leg"
 },
 {
  "id": "modifiedRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "map-route",
  "condition": "modified-route-valid",
  "remarks": "Short white dashes"
 },
 {
  "id": "inactiveRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "map-route",
  "condition": "inactive-route-valid",
  "remarks": "Long cyan dashes"
 },
 {
  "id": "offsetRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "map-route",
  "condition": "fmc-offset-route-valid",
  "remarks": "Magenta dot-dash parallel to active route"
 },
 {
  "id": "routeData",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "near-waypoint",
  "condition": "rte-data-on-and-route-valid",
  "remarks": "Altitude constraint and waypoint ETA"
 },
 {
  "id": "holdingPattern",
  "page": "10.32.18",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white",
   "cyan"
  ],
  "placement": "map-route",
  "condition": "fmc-hold-valid",
  "remarks": "Fixed icon above 80NM, scaled when <=80NM and within 3min of fix"
 },
 {
  "id": "procedureTurn",
  "page": "10.32.18",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white",
   "cyan"
  ],
  "placement": "map-route",
  "condition": "fmc-procedure-turn-valid",
  "remarks": "Supported only with procedure-turn data and compatible FMC"
 },
 {
  "id": "altitudeRangeArc",
  "page": "10.32.19",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-distance",
  "condition": "altitude-target-and-vs-valid",
  "remarks": "Prediction of MCP altitude interception"
 },
 {
  "id": "altitudeProfilePoint",
  "page": "10.32.19",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-distance",
  "condition": "fmc-profile-valid",
  "remarks": "T/C T/D S/C E/D, intermediate T/D and DECEL"
 },
 {
  "id": "vnavDeviation",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "right-vertical-track",
  "condition": "vnav-descent-valid",
  "remarks": "±400ft scale; extra numeric outside limits"
 },
 {
  "id": "originDestinationAirport",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "map-position",
  "condition": "fmc-origin-destination-valid",
  "remarks": "Airport/runway at ranges 80/160/320"
 },
 {
  "id": "airportDatabase",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "map-position",
  "condition": "arpt-on-and-airport-valid",
  "remarks": "Other airports; FMC origin/destination always visible"
 },
 {
  "id": "runwayCenterlines",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "map-position",
  "condition": "fmc-runway-valid",
  "remarks": "At 10/20/40 NM; dashed runway centerlines 14.2NM"
 },
 {
  "id": "fixReference",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-position",
  "condition": "cdu-fix-valid",
  "remarks": "Reference fix and optional dashed bearings/distance rings"
 },
 {
  "id": "wxRadarReturns",
  "page": "10.32.21",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green",
   "amber",
   "red",
   "magenta"
  ],
  "placement": "map-overlay",
  "condition": "wxr-valid-and-on",
  "remarks": "Returns green low, amber medium, red intense, turbulence magenta"
 },
 {
  "id": "irsPositionDifference",
  "page": "10.32.22",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "white"
  ],
  "placement": "lower-left",
  "condition": "irs-difference-exceeds-limits",
  "remarks": "L/R NM and arrow to displaced IRS positions"
 },
 {
  "id": "northUpArrow",
  "page": "10.32.22",
  "modes": [
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "true-north",
  "condition": "plan-valid",
  "remarks": "True north pointer"
 },
 {
  "id": "rangeArcs",
  "page": "10.32.23",
  "modes": [
   "MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-range",
  "condition": "map-always-or-wxr-tfc-on",
  "remarks": "Always in MAP; EXP if WXR/TFC selected"
 },
 {
  "id": "terrainDisplay",
  "page": "10.32.24",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green",
   "amber",
   "red",
   "magenta"
  ],
  "placement": "map-overlay",
  "condition": "terrain-data-valid-and-enabled",
  "remarks": "Elevation vs aircraft 2000 / 500ft or 250ft gear-down threshold"
 },
 {
  "id": "terrainMode",
  "page": "10.32.25",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "terrain-status",
  "condition": "terrain-enabled",
  "remarks": "TERR and highest/lowest displayed terrain"
 },
 {
  "id": "terrainTest",
  "page": "10.32.25",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "terrain-status",
  "condition": "terrain-test",
  "remarks": "TERR TEST"
 },
 {
  "id": "terrainAlert",
  "page": "10.32.25",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber",
   "red"
  ],
  "placement": "terrain-warning",
  "condition": "terrain-alert",
  "remarks": "TERRAIN caution amber / warning red"
 },
 {
  "id": "terrainFailure",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-status",
  "condition": "terrain-failed",
  "remarks": "TERR FAIL"
 },
 {
  "id": "terrainPosition",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-status",
  "condition": "terrain-position-uncertain",
  "remarks": "TERR POS"
 },
 {
  "id": "terrainInhibit",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-status",
  "condition": "terrain-inhibited",
  "remarks": "TERR INHIBIT"
 },
 {
  "id": "terrainRangeDisagree",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "terrain-range-mismatch",
  "remarks": "TERR RANGE DISAGREE"
 },
 {
  "id": "mapTerrainRangeDisagree",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "map-terrain-range-mismatch",
  "remarks": "MAP/TERR RANGE DISAGREE"
 },
 {
  "id": "wxrModeAndTilt",
  "page": "10.32.27",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "wxr-status",
  "condition": "wxr-on-and-valid",
  "remarks": "VAR gain, MAP/WX/WX+T/TEST mode, antenna tilt"
 },
 {
  "id": "wxrRangeDisagree",
  "page": "10.32.28",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "wxr-range-mismatch",
  "remarks": "WXR RANGE DISAGREE; suppress on transceiver failure"
 },
 {
  "id": "wxrMapRangeDisagree",
  "page": "10.32.28",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "wxr-map-range-mismatch",
  "remarks": "WXR/MAP RANGE DISAGREE; suppress on either failure"
 },
 {
  "id": "tcasRA",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-ra-valid",
  "remarks": "Filled square, relative altitude"
 },
 {
  "id": "tcasTA",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-ta-valid",
  "remarks": "Filled circle, relative altitude"
 },
 {
  "id": "tcasProx",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-prox-valid",
  "remarks": "White filled diamond"
 },
 {
  "id": "tcasOther",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-other-valid",
  "remarks": "White hollow diamond"
 },
 {
  "id": "tcasClimbDescendArrow",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red",
   "amber",
   "white"
  ],
  "placement": "near-traffic",
  "condition": "traffic-rate-ge-500fpm",
  "remarks": "Arrow only >=500 fpm, upper/lower altitude text relative to target"
 },
 {
  "id": "tcasNoBearing",
  "page": "10.32.30",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red",
   "amber"
  ],
  "placement": "right-traffic-data",
  "condition": "tfc-on-no-bearing-ra-ta",
  "remarks": "RA/TA, range, relative altitude and arrow"
 },
 {
  "id": "tcasTrafficMessage",
  "page": "10.32.30",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "red",
   "amber"
  ],
  "placement": "right-alert",
  "condition": "ra-or-ta-valid",
  "remarks": "TRAFFIC even if TFC not selected"
 },
 {
  "id": "tcasOffscale",
  "page": "10.32.30",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red",
   "amber"
  ],
  "placement": "right-alert",
  "condition": "tfc-on-and-ta-ra-offscale",
  "remarks": "OFFSCALE"
 },
 {
  "id": "tcasTfc",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "left-tcas",
  "condition": "tfc-on",
  "remarks": "TFC selected"
 },
 {
  "id": "tcasTaOnly",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "left-tcas",
  "condition": "tcas-ta-only",
  "remarks": "RA not computed"
 },
 {
  "id": "tcasTest",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "left-tcas",
  "condition": "tcas-test",
  "remarks": "TCAS TEST"
 },
 {
  "id": "tcasOff",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber",
   "white"
  ],
  "placement": "left-tcas",
  "condition": "tcas-off-and-not-failed",
  "remarks": "TCAS OFF; text chart and 10.32.33 vary by presentation"
 },
 {
  "id": "tcasFail",
  "page": "10.32.32",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-tcas",
  "condition": "tcas-failed-not-suppressed",
  "remarks": "TCAS FAIL; TFC may cycle annunciation"
 },
 {
  "id": "headingTrackFlag",
  "page": "10.32.35",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "top-heading",
  "condition": "heading-or-track-failed",
  "remarks": "TRK / HDG flag"
 },
 {
  "id": "vorPointerFlag",
  "page": "10.32.35",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "map-warning",
  "condition": "vor-signal-failed-and-vor-adf-on",
  "remarks": "VOR pointer failure flag"
 },
 {
  "id": "excessData",
  "page": "10.32.35",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-warning",
  "condition": "map-refresh-slow",
  "remarks": "EXCESS DATA map performance alert"
 },
 {
  "id": "wxrFailStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-failed",
  "remarks": "WXR FAIL"
 },
 {
  "id": "wxrWeakStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-calibration-fault",
  "remarks": "WXR WEAK"
 },
 {
  "id": "wxrAttStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-attitude-fault",
  "remarks": "WXR ATT"
 },
 {
  "id": "wxrStabStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-stabilization-off",
  "remarks": "WXR STAB"
 },
 {
  "id": "wxrDspyStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-display-overheat",
  "remarks": "WXR DSPY"
 },
 {
  "id": "xtkFlag",
  "page": "10.32.36",
  "modes": [
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "amber"
  ],
  "placement": "course-deviation",
  "condition": "fmc-xtk-invalid",
  "remarks": "XTK flag"
 },
 {
  "id": "vorLocFlag",
  "page": "10.32.36",
  "modes": [
   "FULL_VOR_ILS",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "course-deviation",
  "condition": "nav-vor-loc-invalid",
  "remarks": "VOR / LOC flag"
 },
 {
  "id": "mapFlag",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "map-center",
  "condition": "fmc-map-invalid",
  "remarks": "MAP flag"
 },
 {
  "id": "vtkFlag",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV"
  ],
  "colors": [
   "amber"
  ],
  "placement": "right-vnav",
  "condition": "fmc-vertical-track-invalid",
  "remarks": "VTK flag"
 },
 {
  "id": "rnpAdvisory",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "center-warning",
  "condition": "fmc-anp-greater-than-rnp",
  "remarks": "UNABLE REQD NAV PERF-RNP"
 },
 {
  "id": "mapRangeDisagree",
  "page": "10.32.39",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "fmc-range-mismatch",
  "remarks": "MAP RANGE DISAGREE; hide FMC data, suppress on MAP failure"
 }
].map(item=>Object.freeze({...item,
  modes:Object.freeze(item.modes),colors:Object.freeze(item.colors)})));
 const byId=Object.freeze(Object.fromEntries(specs.map(item=>[item.id,item])));
 const modes=Object.freeze(['MAP','CTR_MAP','EXP_NAV','FULL_NAV','EXP_VOR_ILS','FULL_VOR_ILS','PLAN']);
 function eligible(id,mode,evidence={}){
  const s=byId[id];
  if(!s)return {eligible:false,reason:'UNKNOWN_SYMBOL'};
  if(!s.modes.includes(mode))return {eligible:false,reason:'INAPPLICABLE_MODE'};
  // Strict default OFF: no RNP alert, radar, terrain, TCAS or signal
  // is asserted just because a mode is selected.
  const sample=evidence[id];
  if(sample?.valid!==true)return {eligible:false,reason:'NO_VALID_EVIDENCE'};
  return {eligible:true,reason:'EVIDENCE_VALID',colors:s.colors,
   placement:s.placement,page:s.page};
 }
 function audit(evidence={},mode='MAP'){
  if(!modes.includes(mode))throw Error('INVALID_EHSI_MODE');
  return specs.map(s=>({...s,...eligible(s.id,mode,evidence)}));
 }
 return Object.freeze({version:'FCOM-10.32-SYMBOL-REGISTRY-0001',
  specs,byId,modes,eligible,audit});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
