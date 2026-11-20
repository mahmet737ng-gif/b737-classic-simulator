(async()=>{
;
/* ./eadi-speed-tape-v1.js?v=EADI-SPEED-TAPE-UNIFIED-0013-3DRUM-DOWN-0002 */
try{
/* B737 Classic EADI speed tape — event-driven read-only integration and paint.
 * FCOM 10.30.13–15, 10.40.6–8; uses independent CAPT ADC1 / FO ADC2.
 * Existing EADI geometry, photo overlay, attitude and FMA stay untouched.
 * No synthetic IAS, V1, VR, VREF, stick-shaker or flap limit is published.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.B737UnifiedSpeedTapeV1=api;api.bind(root);}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const VERSION='EADI-SPEED-TAPE-0012';
 const COLOR=Object.freeze({white:'#f4f4f3',green:'#16bf62',magenta:'#dc36df',
  yellow:'#dfc53c',red:'#d44747',black:'#000000'});
 const WIDTH=900,HEIGHT=720,TAPE={left:57,right:256,top:172,bottom:612,axis:199,centerY:391,pxPerKt:5.2};
 // Reference: contiguous to the RIGHT of the white numeric speed scale.
 const POLE_X=TAPE.axis+2,POLE_WIDTH=12;
 // Reuse the exact placard-block height when anchoring the yellow buffer.
 const PLACARD_BLOCK_SIZE=12,PLACARD_BLOCK_GAP=3;
 const model=()=>typeof globalThis==='object'?globalThis.B737ClassicSpeedTapeEngineV1:null;
 let win=null,ready=false;
 const states={CAPT:null,FO:null},unsubscribers=[],expiry={CAPT:null,FO:null};
 const stamps={CAPT:null,FO:null},fingerprints={CAPT:new Map(),FO:new Map()};
 function validateSeat(seat){if(!['CAPT','FO'].includes(seat))throw Error('INVALID_EADI_SEAT');}
 function getState(seat){validateSeat(seat);return JSON.parse(JSON.stringify(states[seat]));}
 function getView(seat){validateSeat(seat);return model().view(states[seat]);}
 function repaint(seat){
  const eadi=win?.B737UnifiedEADIStage1;
  if(eadi?.requestPaint){eadi.requestPaint();return;}
  const display=eadi?.snapshot?.()?.stations?.[seat];
  if(display)eadi.setAttitude(seat,display.pitch,display.bank);
 }
 function dispatch(seat,event){
  validateSeat(seat);
  if(!states[seat])throw Error('SPEED_TAPE_NOT_BOUND');
  const payload=JSON.stringify(event);
  const last=fingerprints[seat].get(event.type);
  if(last===payload)return getView(seat);
  fingerprints[seat].set(event.type,payload);
  states[seat]=model().transition(states[seat],event);
  repaint(seat);return getView(seat);
 }
 function segment(ctx,x1,y1,x2,y2,color=COLOR.white,width=2){
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
 }
 function text(ctx,value,x,y,color=COLOR.white,size=25,align='right'){
  ctx.fillStyle=color;ctx.font='500 '+size+'px Arial, sans-serif';
  ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);
 }
 function yFor(speed,view){return TAPE.centerY-(speed-view.tapeCenterKt)*TAPE.pxPerKt;}
 function visible(y,padding=0){return y>=TAPE.top+padding&&y<=TAPE.bottom-padding;}
 function stripe(ctx,x,y,w,h){
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.fillStyle=COLOR.black;ctx.fillRect(x,y,w,h);
  for(let i=y-30;i<y+h+30;i+=16){
   segment(ctx,x,i,x+w,i+16,COLOR.red,6);
  }
  ctx.restore();
 }
 // FCOM 10.40.6: the flap/gear placard on the supplied Classic EADI
 // reference is a ladder of discrete RED SQUARE blocks with BLACK gaps.
 // This is deliberately different from the diagonal VMO/MMO barber pole.
 function placardBlocks(ctx,x,y,w,h){
  if(h<=0)return;
  const block=PLACARD_BLOCK_SIZE,gap=PLACARD_BLOCK_GAP;
  ctx.save();
  ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.fillStyle=COLOR.black;ctx.fillRect(x,y,w,h);
  ctx.fillStyle=COLOR.red;
  // Align the last full block to the placard boundary, then repeat upward.
  for(let top=y+h-block;top>y-block;top-=block+gap){
   ctx.fillRect(x,top,w,block);
  }
  ctx.restore();
 }
 function digits(ctx,ias){
  const y=TAPE.centerY,x=91,w=108,h=67;
  ctx.save();ctx.fillStyle='#07090b';ctx.fillRect(x,y-h/2,w,h);
  ctx.strokeStyle='#eef1f4';ctx.lineWidth=2.3;ctx.strokeRect(x,y-h/2,w,h);
  ctx.beginPath();ctx.moveTo(x+w,y-10);ctx.lineTo(x+w+14,y);
  ctx.lineTo(x+w,y+10);ctx.fillStyle='#eef1f4';ctx.fill();
  ctx.fillStyle='#07090b';ctx.beginPath();ctx.moveTo(x+w-3,y-6);ctx.lineTo(x+w+8,y);
  ctx.lineTo(x+w-3,y+6);ctx.fill();
  // Individual scrolling units; never rerender the whole three-digit number
  // as a single flashing value. Fractional CAS governs the roll.
  const floor=Math.floor(ias),fraction=ias-floor;
  ctx.beginPath();ctx.rect(x+75,y-31,31,62);ctx.clip();
  text(ctx,String(floor%10),x+101,y+fraction*38,COLOR.white,37,'right');
  text(ctx,String((floor+1)%10),x+101,y+(fraction-1)*38,COLOR.white,37,'right');
  ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(x+4,y-31,75,62);ctx.clip();
  text(ctx,String(Math.floor(ias/10)).padStart(2,'0'),x+74,y,COLOR.white,37,'right');
  ctx.restore();
 }
 // Magnified 45-kt low speed default: a fixed window, not rolling digits.
 // The window masks the 40-kt numeral when the tape rests at 45.
 function referenceDigits(ctx,view,write){
  const y=TAPE.centerY,x=99,edge=TAPE.axis-19,tip=TAPE.axis,top=y-36,bottom=y+36;
  ctx.save();ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(edge,top);
  ctx.lineTo(edge,y-13);ctx.lineTo(tip,y);ctx.lineTo(edge,y+13);
  ctx.lineTo(edge,bottom);ctx.lineTo(x,bottom);ctx.closePath();
  ctx.fillStyle=COLOR.black;ctx.fill();ctx.strokeStyle=COLOR.white;ctx.lineWidth=2.5;ctx.stroke();
  ctx.beginPath();ctx.rect(x+3,top+2,edge-x-5,bottom-top-4);ctx.clip();
  if(view.lowSpeedDefault)write('45',edge-7,y,COLOR.white,41,'right');
  else{
   const speed=Math.max(0,view.casKt);
   const model=globalThis.B737MechanicalNumberWheelsV1;
   const frames=model?.frames(speed,3)??[100,10,1].map(magnitude=>{
    const x=speed/magnitude,whole=Math.floor(x),digit=whole%10;
    const lower=x-whole,phase=magnitude===1?lower:
     Math.max(0,Math.min(1,(lower-.82)/.18));
    return {digit,previous:(digit+9)%10,next:(digit+1)%10,fraction:phase};
   });
   // Three independent vertical drums. The two most significant digits
   // roll only on carry; ones follow continuous fractional IAS.
   const centers=[edge-53,edge-29,edge-7];
   for(let i=0;i<3;i++){
    const f=frames[i],x=centers[i];
    ctx.save();ctx.beginPath();ctx.rect(x-12,y-31,25,62);ctx.clip();
    // Positive IAS change advances the wheel image DOWN; upcoming digit
    // approaches from ABOVE. Lower numbers return UP on deceleration.
    for(const [j,digit]of [[1,f.previous],[0,f.digit],[-1,f.next]])
     write(String(digit),x+10,y+(j+f.fraction)*34,COLOR.white,37,'right');
    ctx.restore();
   }
  }
  ctx.restore();
 }
 function lowSpeed45(ctx){
  const y=TAPE.centerY,x=91,w=108,h=67;
  ctx.save();
  ctx.fillStyle='#07090b';ctx.fillRect(x,y-h/2,w,h);
  ctx.strokeStyle=COLOR.white;ctx.lineWidth=2.5;
  ctx.strokeRect(x,y-h/2,w,h);
  ctx.beginPath();ctx.moveTo(x+w,y-10);ctx.lineTo(x+w+14,y);
  ctx.lineTo(x+w,y+10);ctx.fillStyle=COLOR.white;ctx.fill();
  ctx.beginPath();ctx.moveTo(x+w-3,y-6);ctx.lineTo(x+w+8,y);
  ctx.lineTo(x+w-3,y+6);ctx.fillStyle='#07090b';ctx.fill();
  text(ctx,'45',x+w-12,y,COLOR.white,43,'right');
  ctx.restore();
 }
 function mark(ctx,label,value,view,color=COLOR.green,write){
  if(!Number.isFinite(value))return;
  const y=yFor(value,view);if(!visible(y,9))return;
  segment(ctx,214,y,228,y,color,3);
  if(write)write(label,234,y,color,23,'left');
  else text(ctx,label,234,y,color,18,'left');
 }
 function band(ctx,endSpeed,view,{x,w,direction,color='yellow',striped=false,placard=false}){
  if(!Number.isFinite(endSpeed))return;
  const endpoint=yFor(endSpeed,view);
  const y1=direction==='LOW'?Math.max(endpoint,TAPE.top):TAPE.top;
  const y2=direction==='LOW'?TAPE.bottom:Math.min(endpoint,TAPE.bottom);
  if(y2<=y1)return;
  if(placard)placardBlocks(ctx,x,y1,w,y2-y1);
  else if(striped)stripe(ctx,x,y1,w,y2-y1);
  else{
   ctx.fillStyle='rgba(218,183,55,.16)';ctx.fillRect(x,y1,w,y2-y1);
   segment(ctx,x,y1,x,y2,COLOR[color]||COLOR.yellow,2);
   segment(ctx,x+w,y1,x+w,y2,COLOR[color]||COLOR.yellow,2);
   if(visible(endpoint))segment(ctx,x,endpoint,x+w,endpoint,COLOR[color]||COLOR.yellow,2);
  }
 }
 // HIGH/flap buffer is an inverted L (┘): its stem TOUCHES the
 // RIGHT EDGE of the LAST red block, beginning at that block's CENTER.
 // The final block ends at maximumKt and is PLACARD_BLOCK_SIZE tall;
 // therefore the exact center is yFor(maximumKt) - blockSize/2.
 // There is ONLY a lower, inward/left-facing tooth: no upper tooth/fill.
 function flapBufferBracket(ctx,buffer,view){
  if(!buffer||!Number.isFinite(buffer.lowerKt)||
     !Number.isFinite(buffer.upperKt)||!Number.isFinite(buffer.bufferKt)||
     buffer.bufferKt<=0||buffer.lowerKt>=buffer.upperKt)return;
  const x=POLE_X+POLE_WIDTH,arm=12,
   upper=yFor(buffer.upperKt,view)-PLACARD_BLOCK_SIZE/2,
   lower=yFor(buffer.lowerKt,view);
  if(upper>TAPE.bottom||lower<TAPE.top)return;
  const yTop=Math.max(TAPE.top,upper),yBottom=Math.min(TAPE.bottom,lower);
  if(yBottom<=yTop)return;
  segment(ctx,x,yTop,x,yBottom,COLOR.yellow,3);
  if(visible(lower))segment(ctx,x-arm,lower,x,lower,COLOR.yellow,3);
 }
 // STALL buffer uses the SAME right-hand anchor and inward LEFT-facing
 // tooth as the flap buffer, except its tooth is at the UPPER boundary.
 // With x=POLE_X+POLE_WIDTH the tooth occupies the speed pole itself,
 // not the area outside the pole. Both speed bounds are verified inputs.
 function stallBufferBracket(ctx,minimumManeuverKt,stickShakerKt,view){
  if(!Number.isFinite(minimumManeuverKt)||
     !Number.isFinite(stickShakerKt)||
     minimumManeuverKt<=stickShakerKt)return;
  const x=POLE_X+POLE_WIDTH,arm=POLE_WIDTH,upper=yFor(minimumManeuverKt,view),
   lower=yFor(stickShakerKt,view);
  if(upper>TAPE.bottom||lower<TAPE.top)return;
  const yTop=Math.max(TAPE.top,upper),yBottom=Math.min(TAPE.bottom,lower);
  if(yBottom<=yTop)return;
  segment(ctx,x,yTop,x,yBottom,COLOR.yellow,3);
  if(visible(upper))segment(ctx,x-arm,upper,x,upper,COLOR.yellow,3);
 }
 function draw(ctx,view,style={}){
  if(!view||view.schema!=='B737_CLASSIC_SPEED_TAPE_VIEW_V1')return;
  const ref=style.reference===true&&!!style.glyph;
  const write=(value,x,y,color=COLOR.white,size=25,align='right')=>{
   if(ref)style.glyph.canvas(ctx,value,x,y,size,color,align,.94);
   else text(ctx,value,x,y,color,size,align);
  };
  ctx.save();
  // Layer uses the reserved speedTape canvas region; FMA and attitude windows
  // have their own independent rendering and fixed center datum.
  ctx.beginPath();ctx.rect(TAPE.left,TAPE.top-2,TAPE.right-TAPE.left,TAPE.bottom-TAPE.top+4);ctx.clip();
  if(view.casKt===null){
   if(view.flags.SPD)write('SPD',TAPE.axis-20,TAPE.centerY,COLOR.yellow,35,'center');
   ctx.restore();return;
  }
  const low=view.range.minKt,high=view.range.maxKt;
  // White scale at 20-kt numeric intervals, fine subdivisions every 10 kt.
  for(let k=40;k<=420;k+=10){
   if(k<low-3||k>high+3)continue;
   const y=yFor(k,view);
   segment(ctx,TAPE.axis-(ref?18:k%20===0?31:17),y,TAPE.axis,y,COLOR.white,ref?3.3:2.6);
   if(k%20===0&&!(view.lowSpeedDefault&&k===40))
     write(k,TAPE.axis-(ref?26:40),y,COLOR.white,ref?40:30,'right');
  }
  segment(ctx,TAPE.axis,TAPE.top,TAPE.axis,TAPE.bottom,'#e5e9e9',2.5);
  if(ref)for(const y of [TAPE.top,TAPE.bottom])segment(ctx,87,y,242,y,COLOR.white,3);
  const m=view.marks;
  // Only source-verified limits are drawn, never fixed performance estimates.
  stallBufferBracket(ctx,m.minimumManeuverKt,m.stickShakerKt,view);
  band(ctx,m.stickShakerKt,view,{x:POLE_X,w:POLE_WIDTH,direction:'LOW',striped:true});
  if(ref&&Number.isFinite(m.stickShakerKt)&&visible(yFor(m.stickShakerKt,view)))
   segment(ctx,POLE_X,yFor(m.stickShakerKt,view),POLE_X+20,yFor(m.stickShakerKt,view),COLOR.red,4);
  const highYellow=m.highSpeedBuffetKt??m.nextFlapPlacardKt;
  band(ctx,highYellow,view,{x:234,w:15,direction:'HIGH'});
  band(ctx,m.maximumOperatingKt,view,{x:POLE_X,w:POLE_WIDTH,direction:'HIGH',
   placard:ref||view.maxLimitReason==='FLAPS'||view.maxLimitReason==='GEAR',
   striped:!ref&&view.maxLimitReason==='VMO_MMO'});
  // Instructor gear/flap states are presentation overlays, not verified
  // aircraft configuration and never control AFDS or the autothrottle.
  // The stricter of overlapping visual gear/flap limits is drawn.
  const trn=m.trainingOperatingLimit;
  if(Number.isFinite(trn?.maximumKt)){
   band(ctx,trn.maximumKt,view,{x:POLE_X,w:POLE_WIDTH,direction:'HIGH',placard:true});
   const caption=trn.reason==='GEAR'?'TRN GEAR '+trn.state:'TRN FL'+trn.detent;
   write(caption,TAPE.left+7,TAPE.top+18,COLOR.yellow,15,'left');
  }
  // Draw on top of red blocks so the attachment at the center of the
  // last block is continuous, with no 8px horizontal air gap.
  flapBufferBracket(ctx,m.flapBuffer,view);
  if(Number.isFinite(m.flapsUpKt)){
   const y=yFor(m.flapsUpKt,view);
   if(visible(y,9)){
    ctx.strokeStyle=COLOR.green;ctx.lineWidth=3;ctx.beginPath();ctx.arc(ref?205:212,y,10,0,Math.PI*2);ctx.stroke();
   }
  }
  mark(ctx,'F',m.retractKt,view,COLOR.green,ref?write:null);
  mark(ctx,'R',m.vrefKt,view,COLOR.green,ref?write:null);
  mark(ctx,'1',m.v1Kt,view,COLOR.green,ref?write:null);
  // VR and VREF both use an R cue, but takeoff VR is not a VREF reference.
  mark(ctx,'R',m.vrKt,view,COLOR.green,ref?write:null);
  if(Number.isFinite(m.v1Kt)&&m.v1Kt>high)
   write('V1 '+Math.round(m.v1Kt),TAPE.axis+51,TAPE.top+20,COLOR.green,21,'right');
  // Trend arrow: the pure engine handles 4-kt/3-kt hysteresis.
  if(view.trend){
   const target=Math.max(TAPE.top,Math.min(TAPE.bottom,yFor(view.trend.predictedKt,view)));
   const tipDirection=target<TAPE.centerY?-1:1;
   const x=ref?189:207;
   segment(ctx,x,TAPE.centerY,x,target,COLOR.green,ref?4:3);
   if(ref){
    ctx.beginPath();ctx.moveTo(x,target);ctx.lineTo(x-10,target-tipDirection*15);
    ctx.lineTo(x+10,target-tipDirection*15);ctx.closePath();ctx.fillStyle=COLOR.green;ctx.fill();
   }else{
    segment(ctx,x,target,x-5,target-tipDirection*9,COLOR.green,2);
    segment(ctx,x,target,x+5,target-tipDirection*9,COLOR.green,2);
   }
  }
  // Only the active source appears: MCP or FMC, never concurrent bugs.
  if(view.command){
   const k=view.command.speedKt;
   if(view.commandedPosition==='ON_TAPE'){
    const y=yFor(k,view);
    if(ref)segment(ctx,199,y,241,y,'#ee43e7',5);
    else{
     segment(ctx,199,y-4,228,y-4,COLOR.magenta,3);
     segment(ctx,199,y+4,228,y+4,COLOR.magenta,3);
    }
   }else{
    write(String(Math.round(k)),TAPE.axis+51,
     view.commandedPosition==='ABOVE'?TAPE.top+13:TAPE.bottom-14,COLOR.magenta,23,'right');
   }
  }
  if(ref&&(view.rollingDigitsVisible||view.lowSpeedDefault))referenceDigits(ctx,view,write);
  else if(view.rollingDigitsVisible)digits(ctx,view.casKt);
   else if(view.lowSpeedDefault)lowSpeed45(ctx);
  // Visible provenance: never masquerade instructor IAS as ADC equipment.
  if(view.provenance==='TRAINING_SCENARIO')
   write('TRN',TAPE.left+7,TAPE.bottom-13,COLOR.yellow,15,'left');
  if(view.flags.SEL_SPD_INOP)write('SEL SPD',TAPE.axis-7,TAPE.top+45,COLOR.yellow,17,'right');
  if(view.flags.V1_INOP)write('V1',TAPE.axis+30,TAPE.top+46,COLOR.yellow,18,'left');
  if(view.flags.SPD_LIM)write('SPD LIM',TAPE.axis+38,TAPE.bottom-22,COLOR.yellow,17,'right');
  ctx.restore();
 }
 function cancelExpiry(seat){if(expiry[seat]!==null&&win?.clearTimeout)win.clearTimeout(expiry[seat]);expiry[seat]=null;}
 function observeAdc(seat,signal){
  validateSeat(seat);
  if(!signal||signal.quality==='UNKNOWN'){
   if(states[seat].adc.quality==='VALID')dispatch(seat,{type:'ADC_TIMEOUT',nowMs:Date.now()});
   return false;
  }
  if(signal.quality==='INVALID'||signal.value?.sensorValid===false){
   cancelExpiry(seat);dispatch(seat,{type:'ADC',valid:false});return true;
  }
  const value=signal.value;
  // Both approved simulator ingress (sensorValid) and explicitly owned
  // ADC topic publishers are valid. A missing sensorValid is not proof of
  // failure, but an explicit false is.
  if(signal.quality!=='VALID'||signal.origin!=='SIMULATOR_TELEMETRY'||
     value?.sensorValid===false||!Number.isFinite(value?.casKt))return false;
  const timeMs=signal.receivedAtMs??Date.now();
  if(stamps[seat]!==null&&timeMs<=stamps[seat])return false;
  stamps[seat]=timeMs;
  try{dispatch(seat,{type:'ADC',valid:true,casKt:value.casKt,timeMs,
   mach:Number.isFinite(value.mach)?value.mach:null,
   pressureAltitudeFt:value.pressureAltitudeFt??null});}
  catch(error){win?.console?.warn?.('EADI rejected ADC sample',error);return false;}
  cancelExpiry(seat);
  // One-shot expiry only; no 50/100-ms polling. If source stops, speed blanks.
  if(win?.setTimeout)expiry[seat]=win.setTimeout(()=>{
   expiry[seat]=null;dispatch(seat,{type:'ADC_TIMEOUT',nowMs:Date.now()});
  },2100);
  return true;
 }
 function syncNetwork(){
  const bus=win?.B737UnifiedAvionicsNetworkV1;
  if(!bus?.getSignal)return false;
  for(const [seat,topic]of [['CAPT','airdata.adc1'],['FO','airdata.adc2']])
   observeAdc(seat,bus.getSignal(topic));
  return true;
 }
 function syncMcp(){
  const o=win?.B737McpAFDSBridgeV1?.getOutput?.();
  if(o?.schema!=='B737_MCP_AFDS_OUTPUT_V1')return false;
  const selected=o.speedDisplayMode==='IAS'&&Number.isFinite(o.values?.speed)?o.values.speed:null;
  // An MCP Mach setting must be converted through genuine ADC performance
  // data before it can be placed on a CAS tape. Never interpret Mach as knots.
  const event={type:'MCP',powered:o.power,displayBlank:o.displayBlank?.speed===true,
   selectedCasKt:selected,speedDisplayMode:o.speedDisplayMode};
  for(const seat of ['CAPT','FO'])dispatch(seat,event);
  return true;
 }
 function observe(seat,event){return dispatch(seat,event);}
 function receiveChannel(event){
  const d=event.detail;
  if(!d||!['CAPT','FO','BOTH'].includes(d.seat)||!d.payload)return;
  const type={'b737:speed-tape-command-source':'COMMAND_AUTHORITY',
   'b737:speed-tape-fmc':'FMC','b737:speed-tape-limits':'LIMITS',
   'b737:speed-tape-configuration':'CONFIG','b737:speed-tape-failures':'FAILURES'}[event.type];
  if(!type)return;
  for(const seat of d.seat==='BOTH'?['CAPT','FO']:[d.seat])
   try{observe(seat,{...d.payload,type});}catch(error){win?.console?.warn?.('Speed Tape rejected unverified input',error);}
 }
 function bind(root){
  if(ready)return true;
  const engine=root.B737ClassicSpeedTapeEngineV1||model(),eadi=root.B737UnifiedEADIStage1;
  if(!engine?.initialState||!eadi?.registerLayer)return false;
  win=root;ready=true;
  for(const seat of ['CAPT','FO']){
   states[seat]=engine.initialState(seat);
   unsubscribers.push(eadi.registerLayer(seat,'speedTape',(ctx)=>draw(ctx,engine.view(states[seat]))));
  }
  // The Chapter 4 FCC report carries the verified *command* limits.
  // Do not confuse minimum AFDS speed with Chapter 10 minimum-maneuver
  // or stick-shaker red/yellow bands. Keep those sources independent.
  root.addEventListener('b737:speed-limit-fcc',e=>{
   const f=e.detail;
   if(f?.schema!=='B737_CH4_FCC_SPEED_LIMIT_SAMPLE_V1'||
     f.confirmed!==true||f.source!=='SIMULATED_FCC')return;
   const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=600;
   const validGearState=['UP','DOWN','EXTENDING','RETRACTING'].includes(f.gearState);
   if(!validGearState&&![true,false].includes(f.gearExtended)||
      !finite(f.flapsPosition)||f.flapsPosition>40)return;
   for(const seat of ['CAPT','FO']){
    try{
     dispatch(seat,{type:'CONFIG',
      ...(validGearState?{gearState:f.gearState}:{gearExtended:f.gearExtended}),
      flapsPosition:f.flapsPosition});
     const previous=states[seat].limits;
     const data={type:'LIMITS',...previous,valid:true};
     const mapping={vmoMmoCasKt:'vmoMmoCasKt',
      gearPlacardKt:'gearPlacardKt',flapPlacardKt:'flapPlacardKt',
      minimumAfdsKt:'minimumSpeedKt'};
     for(const [target,source]of Object.entries(mapping)){
      if(f[source]===null) data[target]=null;
      else if(finite(f[source]))data[target]=f[source];
     }
     dispatch(seat,data);
    }catch(error){win?.console?.warn?.('CH4 speed-limit projection rejected',error);}
   }
  });
  root.addEventListener('b737:mcp-afds-state',syncMcp);
  root.addEventListener('b737:avionics-data',e=>{
   if(['airdata.adc1','airdata.adc2'].includes(e.detail?.topic))syncNetwork();
  });
  for(const kind of ['b737:speed-tape-command-source','b737:speed-tape-fmc','b737:speed-tape-limits',
   'b737:speed-tape-configuration','b737:speed-tape-failures'])
   root.addEventListener(kind,receiveChannel);
  root.addEventListener('b737:cockpit-mounted',()=>{syncMcp();syncNetwork()});
  root.addEventListener('b737:engine-indication-view',()=>{syncMcp();syncNetwork()});
  syncMcp();syncNetwork();
  return true;
 }
 return Object.freeze({VERSION,TAPE,COLOR,draw,bind,observe,getState,getView,
  syncMcp,syncNetwork,observeAdc});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./speed-tape-unified-training-v1.js?v=SPEED-TAPE-TRAINING-0004 */
try{
/* Unified Speed Tape cockpit trainer source — evidence-labelled and non-authoritative.
 * Uses a known simulated IAS only when no ADC device is present; never writes
 * airdata.adc1/adc2 or aircraft control. Real/failed ADC takes precedence.
 * UI stays in Inspector; original EADI glass and owner photos are untouched.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.B737UnifiedSpeedTapeTrainerV1=api;api.bind(root);}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const VERSION='SPEED-TAPE-TRAINING-0004';
 let win=null,ready=false,enabled=true,overrideKt=null;
 let flap30MaximumKt=180,lastVisualFlapDetent=null,lastVisualGearState=null;
 const originalAdcSeen={CAPT:false,FO:false};
 const lastValue={CAPT:null,FO:null},lastTime={CAPT:0,FO:0};
 let panel=null;
 function finite(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=600;}
 function source(seat){
  const signal=win?.B737UnifiedAvionicsNetworkV1?.getSignal?.(
   seat==='CAPT'?'airdata.adc1':'airdata.adc2');
  // A valid, failed or expired real sensor must never be substituted by
  // the trainer. UNKNOWN means no sensor has ever been connected.
  if(signal?.quality&&signal.quality!=='UNKNOWN')
   originalAdcSeen[seat]=true;
  return signal;
 }
 function active(seat){
  if(!enabled||originalAdcSeen[seat])return false;
  const quality=win?.B737UnifiedSpeedTapeV1?.getState?.(seat)?.adc?.quality;
  return quality!=='VALID'&&quality!=='INVALID';
 }
 function getTrainingContext(){
  const s=win?.B737UnifiedAvionicsNetworkV1?.getSignal?.('flightcontext.state');
  return s?.quality==='VALID'&&s.origin==='TRAINING_SCENARIO'?s.value:null;
 }
 function sync(){
  const render=win?.B737UnifiedSpeedTapeV1;
  if(!ready||!render?.observe)return false;
  const ctx=getTrainingContext();
  const speed=overrideKt===null?ctx?.iasKt:overrideKt;
  const alt=ctx?.pressureAltitudeFt;
  for(const seat of ['CAPT','FO']){
   source(seat);
   if(!active(seat)){
    if(!enabled&&render.getState(seat)?.adc?.quality==='TRAINING')
     render.observe(seat,{type:'TRAINING_CLEAR'});
    lastValue[seat]=null;continue;
   }
   if(!finite(speed)){
    if(render.getState(seat)?.adc?.quality==='TRAINING')
     render.observe(seat,{type:'TRAINING_CLEAR'});
    lastValue[seat]=null;continue;
   }
   const safeAlt=typeof alt==='number'&&Number.isFinite(alt)&&alt>=-2000&&alt<=70000?alt:null;
   const fp=JSON.stringify([speed,safeAlt]);
   if(fp===lastValue[seat])continue;
   const timeMs=Math.max(Date.now(),lastTime[seat]+150);
   lastTime[seat]=timeMs;
   render.observe(seat,{type:'TRAINING_CAS',origin:'TRAINING_SCENARIO',
    casKt:speed,pressureAltitudeFt:safeAlt,timeMs});
   lastValue[seat]=fp;
  }
  updatePanel();return true;
 }
 function syncVisualFlap(detent){
  const renderer=win?.B737UnifiedSpeedTapeV1;
  const profile=win?.B737ClassicFlapSpeedProfileV1;
  if(!ready||!renderer?.observe||!profile?.get)return false;
  const d=detent??lastVisualFlapDetent??win?.B737FlapVisualTest?.position;
  if(!profile.DETENTS.includes(Number(d)))return false;
  lastVisualFlapDetent=Number(d);
  const value=profile.get(d,{flap30MaximumKt});
  for(const seat of ['CAPT','FO']){
   renderer.observe(seat,{type:'TRAINING_FLAP_PROFILE',source:'INSTRUCTOR_VISUAL_DETENT',
    detent:value.detent,maximumKt:value.maximumKt,bufferKt:value.bufferKt});
  }
  updatePanel();return true;
 }
 // Gear states are explicit training choices until a verified cockpit gear
 // system is connected. The selected limit is visual-only on both EADIs.
 function syncVisualGear(){
  const renderer=win?.B737UnifiedSpeedTapeV1;
  if(!ready||!renderer?.observe)return false;
  for(const seat of ['CAPT','FO']){
   renderer.observe(seat,{type:'TRAINING_GEAR_PROFILE',
    source:'INSTRUCTOR_VISUAL_GEAR',gearState:lastVisualGearState});
  }
  updatePanel();return true;
 }
 function setGearState(value){
  if(![null,'UNKNOWN','UP','DOWN','EXTENDING','RETRACTING'].includes(value))
   throw Error('INVALID_INSTRUCTOR_GEAR_STATE');
  lastVisualGearState=value==='UNKNOWN'?null:value;
  syncVisualGear();updatePanel();
  return lastVisualGearState;
 }
 function setFlap30MaximumKt(value){
  if(![180,185].includes(Number(value)))throw Error('INVALID_FLAP30_VARIANT');
  flap30MaximumKt=Number(value);
  syncVisualFlap();updatePanel();
  return flap30MaximumKt;
 }
 function updatePanel(){
  if(!panel)return;
  const ctx=getTrainingContext(),live=ctx?.iasKt;
  panel.querySelector('[data-speed-status]').textContent=enabled?
   'TRAINING IAS '+(overrideKt===null?(finite(live)?live.toFixed(1)+' kt':'UNAVAILABLE'):
    overrideKt.toFixed(1)+' kt')+' · not an ADC':
   'ADC ONLY · no synthetic speed';
  panel.querySelector('[data-speed-slider]').disabled=!enabled;
  panel.querySelector('[data-speed-auto]').disabled=!enabled;
  panel.querySelector('[data-speed-toggle]').checked=enabled;
  if(overrideKt!==null)panel.querySelector('[data-speed-slider]').value=String(overrideKt);
  else if(finite(live))panel.querySelector('[data-speed-slider]').value=String(live);
  panel.querySelector('[data-speed-reading]').textContent=overrideKt===null?'SIM IAS':overrideKt.toFixed(1)+' kt';
  const flap=panel.querySelector('[data-flap-profile-status]');
  if(flap){
   const detent=lastVisualFlapDetent;
   const value=detent===null?null:
    win?.B737ClassicFlapSpeedProfileV1?.get?.(detent,{flap30MaximumKt});
   flap.textContent=value?.maximumKt!=null?
    'TRN FLAP '+detent+' / MAX '+value.maximumKt+
    ' kt / BUFFER '+(value.bufferKt===null?'UNSPECIFIED':value.bufferKt+' kt'):
    'TRN FLAP LIMIT: '+(detent===0?'UP / NONE':'not connected');
  }
  const gear=panel.querySelector('[data-gear-limit-status]');
  if(gear){
   const l=lastVisualGearState?win?.B737ClassicSpeedTapeEngineV1?.GEAR_SPEED_LIMITS?.[lastVisualGearState]:null;
   gear.textContent=lastVisualGearState===null?'TRN GEAR: UNKNOWN / no cockpit gear sensor connected':
    l?'TRN GEAR '+lastVisualGearState+' / MAX '+l.iasKt+' kt'+
      (l.mach===null?'':' / M'+l.mach.toFixed(2)):
    'TRN GEAR UP / no gear-specific placard';
  }
  const gearSelector=panel.querySelector('[data-gear-training-state]');
  if(gearSelector)gearSelector.value=lastVisualGearState??'UNKNOWN';
  const option=panel.querySelector('[data-flap30-variant]');
  if(option)option.value=String(flap30MaximumKt);
 }
 function setEnabled(value){
  enabled=value===true;
  if(!enabled){
   const render=win?.B737UnifiedSpeedTapeV1;
   if(render)for(const seat of ['CAPT','FO']){
    if(render.getState(seat)?.adc?.quality==='TRAINING')render.observe(seat,{type:'TRAINING_CLEAR'});
    lastValue[seat]=null;
   }
  }
  sync();updatePanel();return enabled;
 }
 function setIAS(value){
  if(value!==null&&!finite(value))throw Error('INVALID_TRAINING_IAS');
  overrideKt=value;
  for(const seat of ['CAPT','FO'])lastValue[seat]=null;
  sync();return overrideKt;
 }
 function mount(){
  if(panel||!win?.document?.createElement)return false;
  const owner=win.document.querySelector('#unifiedControlCenter')||
   win.document.querySelector('#inspector');
  if(!owner)return false;
  panel=win.document.createElement('section');
  panel.className='unified-speed-tape-trainer';
  panel.setAttribute('aria-label','Speed tape instructor training mode');
  panel.style.cssText='border:1px solid #4b6077;border-radius:9px;padding:12px;margin:12px 0;color:inherit';
  panel.innerHTML='<strong>SPEED TAPE · INSTRUCTOR</strong>'+
   '<p style="font-size:12px;line-height:1.5;margin:5px 0" data-speed-status>TRAINING IAS</p>'+
   '<label style="display:flex;gap:8px;font-size:12px"><input type="checkbox" data-speed-toggle checked> Use labelled simulated IAS when ADC is not connected</label>'+
   '<label style="display:block;font-size:12px;margin-top:8px">IAS <output data-speed-reading>SIM IAS</output></label>'+
   '<input type="range" data-speed-slider min="0" max="420" step=".1" value="180" style="width:100%">'+
   '<button type="button" data-speed-auto style="margin:6px">Follow simulator IAS</button>'+
   '<p style="font-size:11px;opacity:.8">TRN on glass = training source. Verified ADC overrides this display. No changes to flight-control or ADC network.</p>'+
   '<p data-flap-profile-status style="font-size:12px;line-height:1.5">TRN FLAP LIMIT: not connected</p>'+
   '<label style="font-size:12px">Flap 30 training max (180 image / 185 list) '+
   '<select data-flap30-variant style="margin:5px;color:inherit;background:#213448">'+
   '<option value="180">180 kt — image</option><option value="185">185 kt — list</option>'+
   '</select></label>'+
   '<p style="font-size:11px;opacity:.8">Visual flap detents display TRN LIMIT only; this does not command the AFDS.</p>'+
   '<p style="font-size:12px;margin-top:12px"><strong>LANDING GEAR SPEED LIMITS · TRAINING</strong></p>'+
   '<label style="font-size:12px">Gear state (manual instructor input)'+
   '<select data-gear-training-state style="margin:5px;color:inherit;background:#213448">'+
   '<option value="UNKNOWN">UNKNOWN / no verified gear signal</option>'+
   '<option value="UP">UP / no gear speed placard</option>'+
   '<option value="EXTENDING">EXTENDING / 270 kt / M0.82</option>'+
   '<option value="DOWN">DOWN / 320 kt / M0.82</option>'+
   '<option value="RETRACTING">RETRACTING / 235 kt</option>'+
   '</select></label>'+
   '<p data-gear-limit-status style="font-size:12px;line-height:1.5">TRN GEAR: UNKNOWN</p>'+
   '<p style="font-size:11px;opacity:.8">Selected gear state draws a TRAINING speed limit on CAPT and FO tape only. It never moves the gear or commands AFDS. When a verified FCC limit controls, that verified limit takes precedence.</p>'+
   '<p><a href="./speed-limit-ch4-lab.html" target="_blank" rel="noopener" style="color:#9ad1ff">FCOM CH4 SPEED LIMITS · TEST LAB</a></p>';
  owner.appendChild(panel);
  panel.querySelector('[data-speed-toggle]').addEventListener('change',e=>setEnabled(e.target.checked));
  panel.querySelector('[data-speed-slider]').addEventListener('input',e=>setIAS(Number(e.target.value)));
  panel.querySelector('[data-speed-auto]').addEventListener('click',()=>setIAS(null));
  panel.querySelector('[data-flap30-variant]').addEventListener('change',
   e=>setFlap30MaximumKt(Number(e.target.value)));
  panel.querySelector('[data-gear-training-state]').addEventListener('change',
   e=>setGearState(e.target.value));
  updatePanel();return true;
 }
 function bind(root){
  if(ready)return true;
  if(!root?.B737UnifiedSpeedTapeV1?.observe)return false;
  win=root;ready=true;
  root.addEventListener('b737:avionics-data',e=>{
   if(['airdata.adc1','airdata.adc2','flightcontext.state'].includes(e.detail?.topic))
    sync();
  });
  // The existing pedestal dispatches CustomEvent on DOCUMENT with
  // bubbles:false. A window listener never receives that event.
  const flapEventTarget=root.document?.addEventListener?root.document:root;
  flapEventTarget.addEventListener('b737:flap-detent-visual-test',event=>{
   if(event.detail?.visualOnly!==true)return;
   syncVisualFlap(event.detail.detent);
  });
  flapEventTarget.addEventListener('b737:flap-ready',event=>{
   syncVisualFlap(event.detail?.position);
  });
  root.addEventListener('b737:cockpit-mounted',()=>{mount();sync();syncVisualFlap();syncVisualGear()});
  if(root.document?.readyState==='loading')
   root.document.addEventListener('DOMContentLoaded',()=>{mount();sync();syncVisualFlap();syncVisualGear()},{once:true});
  else mount();
  sync();syncVisualFlap();syncVisualGear();return true;
 }
 function snapshot(){return {version:VERSION,enabled,overrideKt,
  flap30MaximumKt,lastVisualFlapDetent,lastVisualGearState,
  realAdcSeen:{...originalAdcSeen},sourceLabel:'TRAINING_SCENARIO_NOT_ADC'};}
 return Object.freeze({VERSION,bind,sync,syncVisualFlap,syncVisualGear,setGearState,setFlap30MaximumKt,setEnabled,setIAS,snapshot});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fo-proportional-scale-v1.js?v=FO-PROPORTIONAL-SCALE-0004-CONV-CRT-ISOLATED */
try{
/* FO-PROPORTIONAL-SCALE-0003 — coupled outer F/O photo + EADI horizon registration.
 * Owner-authorized 2026-11-08: scale the complete F/O visual field, including
 * the three named GPWS guards. Preserve their guard artwork, switch mechanics,
 * electrical behavior and frozen source geometry; never edit Owner18 masters.
 *
 * Mode-specific photographic seams:
 * EIS          engine right = FO INNER left = 1222
 * CONVENTIONAL panoramic engine right = FO owner photo left = 1374
 * Different anchors are essential: scaling an owner photograph about 1222
 * creates an otherwise visible black gap at the conventional panel seam.
 *
 * CSS individual transforms preserve original transform:scale(...) !important
 * on the three GPWS guards, physical knobs, and photographed needle rotation.
 * No moving DOM nodes (critical for active EADI and aircraft system bindings).
 * Event-driven; zero timers or subsystem polling.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object')module.exports=api;
 if(root?.document)api.install(root);
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const VERSION='FO-PROPORTIONAL-SCALE-0003';
 const GPWS_IDS=Object.freeze(['gpws-terrain-inhibit','gpws-flap-inhibit','gpws-gear-inhibit']);
 const OWNER_LAMP_IDS=Object.freeze(['main-pull-up-fo','main-below-gs-fo','main-altitude-fo','main-gpws-inop']);
 const PROFILES=Object.freeze({
  EIS:Object.freeze({anchorX:1222,anchorY:127,scale:1.035,rightEdge:2069,mainRightEdge:2100}),
  CONVENTIONAL:Object.freeze({anchorX:1374,anchorY:127,scale:726/695,rightEdge:2069,mainRightEdge:2100})
 });
 const included=new Set(GPWS_IDS),ownerLamps=new Set(OWNER_LAMP_IDS);
 // Measured glass top edges in native MAIN PANEL units: CAPT 218.20,
 // FO 263.40 prior to FO scaling. The aircraft photo + its attached
 // instruments must travel together; moving only the FO canvas is WRONG.
 const EIS_OUTER_LIFT=218.20-(PROFILES.EIS.anchorY+
  (263.40-PROFILES.EIS.anchorY)*PROFILES.EIS.scale);
 function isOuterSurface(node,mode){
  if(mode!=='EIS')return false;
  if(node.matches('.texture-piece[data-piece="fo-outer"],[data-eadi-stage1-seat="FO"].eadi-stage1-host'))return true;
  if(node.matches('.cockpit-light[data-cockpit-light]'))
   return isFoLamp(node)&&/(?:^|\\s)fo-outer(?:\\s|$)/.test(node.title||'');
  // Standalone, direct-mounted controls on the outboard FO photograph.
  // Do not shift GPWS guards or the RMI / gear field in FO INNER.
  const x=parseFloat(node.style.left);
  return node.matches(':not([data-guard-id]):not(.owner18-guard-control)')&&
    Number.isFinite(x)&&x>=1594&&x<2100;
 }
 function mapRect(x,y,w,h,mode='EIS'){
  const p=PROFILES[mode];if(!p)throw Error('Unknown F/O mode');
  return {x:p.anchorX+(x-p.anchorX)*p.scale,
   y:p.anchorY+(y-p.anchorY)*p.scale,w:w*p.scale,h:h*p.scale};
 }
 function delta(x,y,originX=0,originY=0,mode='EIS'){
  const p=PROFILES[mode],factor=p.scale-1;
  return {dx:factor*(x+originX-p.anchorX),
   dy:factor*(y+originY-p.anchorY)};
 }
 function guardId(node){return node?.getAttribute?.('data-guard-id')||'';}
 function isFoLamp(node){
  return node.matches('.cockpit-light[data-cockpit-light]') &&
   /(?:^|\s)fo-(?:inner|outer)(?:\s|$)/.test(node.title||'');
 }
 function classification(node,native,mode){
  if(!node?.matches||!native||!PROFILES[mode])return null;
  if(node.matches('[data-guard-id],.owner18-guard-control')){
   return included.has(guardId(node))?mode:null;
  }
  if(node.matches('.texture-piece')){
   return mode==='EIS'&&node.matches('[data-piece="fo-inner"],[data-piece="fo-outer"]')?mode:null;
  }
  if(node.matches('#fo-owner-panel-v1')){
   return mode==='CONVENTIONAL'?mode:null;
  }
  // Conventional FO EADI is registered to the owner's actual CRT glass in
  // conventional-eadi-socket-v1.js, not the shared panel-wide FO transform.
  // EIS remains byte-for-byte identical in scale, origin and outer lift.
  if(node.matches('[data-eadi-stage1-seat="FO"].eadi-stage1-host'))
   return mode==='EIS'?'EIS':null;
  if(node.matches('.cockpit-light[data-cockpit-light]')){
   if(!isFoLamp(node))return null;
   return mode==='EIS'||ownerLamps.has(node.dataset.cockpitLight)?mode:null;
  }
  // A mounted FO control whose native coordinates belong to the F/O field.
  // Do not claim generic engine-panorama or captain elements by proximity.
  if(node.parentElement!==native||
     node.matches('.cockpit-light-layer,.cdu-station,.main-panel-seam-repair,.conventional-engine-photo-wrap-v1,.region-native,.eadi-stage1-host,.fo-proportional-scale-group')||
     node.querySelector?.('[data-guard-id],.owner18-guard-control')){
   return null;
  }
  const x=parseFloat(node.style.left),y=parseFloat(node.style.top),p=PROFILES[mode];
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=p.anchorX&&
   x<p.mainRightEdge&&y>=p.anchorY&&y<920?mode:null;
 }
 function install(win){
  const doc=win.document,applied=new Map();
  let native=null,observer=null,bootstrapObserver=null,pending=false,activeMode='EIS';
  function stopBoot(){if(bootstrapObserver){bootstrapObserver.disconnect();bootstrapObserver=null;}}
  function measuredOrigin(node,style){
   const parts=(style.transformOrigin||'').split(/\s+/);
   return [parseFloat(parts[0])||0,parseFloat(parts[1])||0];
  }
  function scaleNode(node,mode){
   const style=win.getComputedStyle(node);
   const x=parseFloat(style.left),y=parseFloat(style.top);
   if(!Number.isFinite(x)||!Number.isFinite(y))return false;
   const [ox,oy]=measuredOrigin(node,style);
   const d=delta(x,y,ox,oy,mode);
   // A single additional vertical offset applies to the entire FO OUTER
   // photograph and every independently mounted item on that photograph.
   // The inner FO/ENGINE join stays registered at its locked native seam.
   if(isOuterSurface(node,mode))d.dy+=EIS_OUTER_LIFT;
   const tr=d.dx.toFixed(5)+'px '+d.dy.toFixed(5)+'px';
   const sc=String(PROFILES[mode].scale);
   let before=applied.get(node);
   if(!before){before={translate:node.style.translate,scale:node.style.scale};applied.set(node,before);}
   if(node.style.translate!==tr)node.style.translate=tr;
   if(node.style.scale!==sc)node.style.scale=sc;
   node.dataset.foScaleVersion=VERSION;
   return true;
  }
  function restore(node){
   const original=applied.get(node);
   if(!original)return;
   node.style.translate=original.translate;
   node.style.scale=original.scale;
   if(node.dataset.foScaleVersion===VERSION)delete node.dataset.foScaleVersion;
   applied.delete(node);
  }
  function mount(){
   const target=doc.querySelector('#region-main .region-native');
   if(!target)return false;
   if(target!==native){
    observer?.disconnect();native=target;
    observer=new win.MutationObserver(queue);
    observer.observe(native,{childList:true,subtree:true});
    stopBoot();
   }
   const mode=doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
   activeMode=mode;
   const selected=new Map();
   // Keep the parent of each real instrument unchanged (EADI canvas state).
   for(const node of native.children){
    const id=classification(node,native,mode);
    if(id)selected.set(node,id);
   }
   const lampLayer=native.querySelector('.cockpit-light-layer');
   if(lampLayer){
    for(const node of lampLayer.querySelectorAll('.cockpit-light[data-cockpit-light]')){
     const id=classification(node,native,mode);
     if(id)selected.set(node,id);
    }
   }
   for(const node of applied.keys())if(!selected.has(node)||!node.isConnected)restore(node);
   for(const [node,id]of selected)scaleNode(node,id);
   doc.documentElement.dataset.foScaleVersion=VERSION;
   return selected.size>0;
  }
  function queue(){
   if(pending)return;
   pending=true;
   win.requestAnimationFrame(()=>{pending=false;mount();});
  }
  const stage=doc.getElementById('scene')||doc.body;
  if(!doc.querySelector('#region-main .region-native')){
   bootstrapObserver=new win.MutationObserver(queue);
   bootstrapObserver.observe(stage,{childList:true,subtree:true});
  }
  for(const event of ['b737:cockpit-mounted','b737:engine-indication-view',
   'b737:aircraft-profile-change'])win.addEventListener(event,queue);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',queue,{once:true});
  queue();
  win.B737FoProportionalScaleV1=Object.freeze({
   version:VERSION,profiles:PROFILES,guards:GPWS_IDS,outerLift:EIS_OUTER_LIFT,
   inspect:()=>({version:VERSION,mode:activeMode,profile:PROFILES[activeMode],
    scaled:[...applied.keys()].filter(n=>n.isConnected).map(n=>({
     id:n.id||n.dataset.guardId||n.dataset.cockpitLight||n.dataset.piece||'fo-control',
     translate:n.style.translate,scale:n.style.scale})),
    alignment:{captainEadiTop:218.20,
     foEadiTop:mapRect(1612.75,263.40,0,0,'EIS').y+EIS_OUTER_LIFT,
     foOutboardTop:mapRect(1594,225,0,0,'EIS').y+EIS_OUTER_LIFT},
    seams:{EIS:{engineRight:1222,foLeft:mapRect(1222,127,0,0).x},
     CONVENTIONAL:{engineRight:1374,foLeft:mapRect(1374,127,0,0,'CONVENTIONAL').x}},
    guards:[...native?.querySelectorAll('[data-guard-id]')||[]]
     .filter(n=>included.has(guardId(n)))
     .map(n=>({id:guardId(n),scaled:n.dataset.foScaleVersion===VERSION}))})
  });
 }
 return Object.freeze({VERSION,PROFILES,GPWS_IDS,OWNER_LAMP_IDS,EIS_OUTER_LIFT,
  mapRect,delta,classification,isOuterSurface,install});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/afds-annunciator-v1/afds-test-switch-core.js?v=AFDS-ANN-TEST-0001 */
try{
/* B737 CLASSIC AFDS warning-panel TEST switch — event-driven control core.
 * Hardware/test-only implementation: no inferred FMC/FCC/electrical feed.
 * FCOM visual test: TEST 1 amber all; TEST 2 red A/P & A/T, amber FMC.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.B737AFDSAnnunciatorCoreV1=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const VERSION="AFDS-ANN-TEST-0001";
 const DETENTS=Object.freeze(["TEST_1","NEUTRAL","TEST_2"]);
 const ALLOWED=Object.freeze({AP:["OFF","STEADY_RED","FLASH_RED","STEADY_AMBER","FLASH_AMBER"],
   AT:["OFF","STEADY_RED","FLASH_RED","STEADY_AMBER","FLASH_AMBER"],FMC:["OFF","STEADY_AMBER"]});
 const TEST=Object.freeze({TEST_1:Object.freeze({AP:"STEADY_AMBER",AT:"STEADY_AMBER",FMC:"STEADY_AMBER"}),
   TEST_2:Object.freeze({AP:"STEADY_RED",AT:"STEADY_RED",FMC:"STEADY_AMBER"})});
 const initial=()=>({detent:"NEUTRAL",alerts:{AP:"OFF",AT:"OFF",FMC:"OFF"}});
 function reduce(previous,action){
   const s=previous||initial();
   if(!action||typeof action.type!=="string")return s;
   if(action.type==="PRESS_TEST"){
     if(action.detent!=="TEST_1"&&action.detent!=="TEST_2")return s;
     if(s.detent===action.detent)return s;
     return {...s,detent:action.detent};
   }
   if(action.type==="RELEASE_TEST"||action.type==="CANCEL_TEST"){
     if(s.detent==="NEUTRAL")return s;
     return {...s,detent:"NEUTRAL"};
   }
   if(action.type==="SET_ALERT"){
     const {id,status}=action;
     if(!Object.prototype.hasOwnProperty.call(ALLOWED,id)||!ALLOWED[id].includes(status))return s;
     if(s.alerts[id]===status)return s;
     return {...s,alerts:{...s.alerts,[id]:status}};
   }
   if(action.type==="ACKNOWLEDGE"){
     const id=action.id;
     if(!Object.prototype.hasOwnProperty.call(ALLOWED,id))return s;
     if(s.alerts[id]==="OFF")return s;
     return {...s,alerts:{...s.alerts,[id]:"OFF"}};
   }
   return s;
 }
 function lamps(s){
   if(!s||!DETENTS.includes(s.detent))throw Error("Invalid AFDS test detent");
   return {...(TEST[s.detent]||s.alerts)};
 }
 function status(s){
   return {version:VERSION,detent:s.detent,springReturn:"NEUTRAL",
     lamps:lamps(s),alerts:{...s.alerts},source:"Classic FCOM Chapter 4 AFDS Annunciator P/RST TEST"};
 }
 return Object.freeze({VERSION,DETENTS,ALLOWED,TEST,initial,reduce,lamps,status});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./afds-annunciator-switch-v1.js?v=AFDS-ANN-UNIFIED-0004-NONEIS-FO-REGISTRATION */
try{
/* AFDS-ANN-UNIFIED-0002 — 737 Classic CAPT/FO physical P/RST test.
 * Five-pose Small Silver sprite is explicitly owner-selected here.
 * Photo apertures remain untouched. All coordinates are native MAIN 2100x920.
 * Sign legends alone illuminate. No invented auto-flight warning source.
 */
(function(root){
"use strict";
const Core=root.B737AFDSAnnunciatorCoreV1;
if(!Core)return;
const VERSION="AFDS-ANN-UNIFIED-0004-NONEIS-FO-REGISTRATION";
const SPRITE="../../shared-assets/toggle-switch-small/Small_Silver_5Positions.webp";
// Sprite cells LEFT, CENTER, RIGHT, UP, DOWN (1024 square each).
const POSE=Object.freeze({TEST_1:"75% 0%",NEUTRAL:"25% 0%",TEST_2:"100% 0%"});
const INSTALL=Object.freeze({
  CAPT:Object.freeze({
    source:"captain 3942x3591 source / 1536x1399 photo apertures",
    sourcePiece:"captain",
    lamps:Object.freeze([
      {id:"AP",x:597.0,y:202.2,w:21.4,h:22.3},
      {id:"AT",x:623.5,y:202.2,w:21.4,h:22.3},
      {id:"FMC",x:650.0,y:202.2,w:21.4,h:22.3}
    ]),
    toggle:{cx:683.2,cy:212.9,cell:42,hit:21}
  }),
  FO:Object.freeze({
    source:"owner 1649x928 screenshot 2026-11-15; photo black apertures, native inverse zoom",
    sourcePiece:"fo-inner",
    lamps:Object.freeze([
      {id:"AP",x:1449.1,y:216.9,w:21.8,h:21.1},
      {id:"AT",x:1475.0,y:216.9,w:21.8,h:21.1},
      {id:"FMC",x:1499.9,y:216.9,w:22.1,h:21.1}
    ]),
    toggle:{cx:1532.4,cy:226.5,cell:44,hit:20.8}
  })
});
// Non-EIS uses the independent FO owner panorama, not the EIS FO-inner photo.
 // Screenshot-registered displacement, measured in native MAIN 2100x920 units;
 // CAPT and EIS FO baseline coordinates MUST remain unchanged.
 const FO_NON_EIS_SHIFT=Object.freeze({x:22.0,y:-8.8,
   reference:"owner screenshot 2026-11-16 1920x1080, AFDS lens and TEST fitting",
   status:"SCREENSHOT_REGISTERED_BROWSER_PIXEL_QA_PENDING"});
 function layoutFor(mode){
  if(mode!=="CONVENTIONAL")return INSTALL.FO;
  const dx=FO_NON_EIS_SHIFT.x,dy=FO_NON_EIS_SHIFT.y,base=INSTALL.FO;
  return {source:"FO Non-EIS owner panorama, screenshot-calibrated",
   sourcePiece:"fo-owner",
   lamps:base.lamps.map(l=>({...l,x:l.x+dx,y:l.y+dy})),
   toggle:{...base.toggle,cx:base.toggle.cx+dx,cy:base.toggle.cy+dy}};
 }
 const states={CAPT:Core.initial(),FO:Core.initial()};
const visual=new Map(),toggleHits=new Map(),lamps={CAPT:new Map(),FO:new Map()};
const held={CAPT:null,FO:null};
let mountRoot=null;
function nameFor(id){return id==="AP"?"A/P":id==="AT"?"A/T":"FMC";}
function dispatch(seat){
 root.dispatchEvent(new CustomEvent("b737:afds-annunciator-state",
  {detail:{...Core.status(states[seat]),seat,version:VERSION}}));
}
function paint(seat){
 const output=Core.lamps(states[seat]),v=visual.get(seat);
 if(v){v.dataset.detent=states[seat].detent;
  v.style.backgroundPosition=POSE[states[seat].detent];}
 for(const [id,button]of lamps[seat]){
  const mode=output[id]||"OFF";
  button.dataset.lamp=mode;
  button.setAttribute("aria-label",nameFor(id)+" P/RST "+mode.replaceAll("_"," "));
 }
 dispatch(seat);
}
function transition(seat,action){
 if(!INSTALL[seat])return null;
 const next=Core.reduce(states[seat],action);
 if(next!==states[seat]){states[seat]=next;paint(seat);}
 return Core.status(states[seat]);
}
function release(seat){
 held[seat]=null;
 return transition(seat,{type:"RELEASE_TEST"});
}
function releaseAll(){for(const seat of Object.keys(INSTALL))release(seat);}
function select(seat,detent){
 return transition(seat,detent==="TEST_1"||detent==="TEST_2"
  ?{type:"PRESS_TEST",detent}:{type:"RELEASE_TEST"});
}
function acknowledge(id){
 // Real A/P, A/T, FMC alerts are mirrored to both crew sides.
 for(const seat of Object.keys(INSTALL))transition(seat,{type:"ACKNOWLEDGE",id});
}
function setAlert(id,status){
 for(const seat of Object.keys(INSTALL))transition(seat,{type:"SET_ALERT",id,status});
 return Core.status(states.CAPT);
}
function createToggle(doc,seat,def){
 const {cx,cy,cell,hit}=def.toggle;
 const art=doc.createElement("span");
 art.className="afds-silver-toggle";
 art.dataset.afdsSeat=seat;
 art.dataset.detent="NEUTRAL";
 art.setAttribute("aria-hidden","true");
 art.style.left=(cx-cell/2)+"px";art.style.top=(cy-cell/2)+"px";
 art.style.width=cell+"px";art.style.height=cell+"px";
 art.style.backgroundImage='url("'+SPRITE+'")';
 art.style.backgroundPosition=POSE.NEUTRAL;
 const btn=doc.createElement("button");btn.type="button";
 btn.className="afds-toggle-hit";
 btn.dataset.afdsSeat=seat;
 btn.id="afds"+(seat==="CAPT"?"Capt":"Fo")+"TestLever";
 btn.style.left=(cx-hit/2)+"px";btn.style.top=(cy-hit/2)+"px";
 btn.style.width=hit+"px";btn.style.height=hit+"px";
 btn.setAttribute("aria-label",seat+" AFDS TEST 1 / neutral / TEST 2; spring loaded");
 btn.setAttribute("aria-keyshortcuts","ArrowUp ArrowDown");
 const detentFrom=(e)=>{
  const rect=btn.getBoundingClientRect();
  return e.clientY < rect.top+rect.height/2?"TEST_1":"TEST_2";
 };
 btn.addEventListener("pointerdown",e=>{
  if(e.button!==0||held[seat]!==null)return;
  e.preventDefault();held[seat]={kind:"pointer",id:e.pointerId};
  try{btn.setPointerCapture(e.pointerId);}catch(_){}
  select(seat,detentFrom(e));
 });
 btn.addEventListener("pointermove",e=>{
  if(held[seat]?.kind!=="pointer"||held[seat].id!==e.pointerId)return;
  e.preventDefault();select(seat,detentFrom(e));
 });
 function up(e){
  if(held[seat]?.kind!=="pointer"||held[seat].id!==e.pointerId)return;
  held[seat]=null;select(seat,"NEUTRAL");
  try{if(btn.hasPointerCapture(e.pointerId))btn.releasePointerCapture(e.pointerId);}catch(_){}
 }
 for(const ev of ["pointerup","pointercancel","lostpointercapture"])btn.addEventListener(ev,up);
 btn.addEventListener("keydown",e=>{
  if(e.code!=="ArrowUp"&&e.code!=="ArrowDown")return;
  e.preventDefault();if(e.repeat)return;
  held[seat]={kind:"key",id:e.code};
  select(seat,e.code==="ArrowUp"?"TEST_1":"TEST_2");
 });
 btn.addEventListener("keyup",e=>{
  if(held[seat]?.kind==="key"&&held[seat].id===e.code){
    e.preventDefault();release(seat);
  }
 });
 btn.addEventListener("blur",()=>release(seat));
 btn.addEventListener("click",e=>e.preventDefault());
 visual.set(seat,art);toggleHits.set(seat,btn);
 return [art,btn];
}
function createLamp(doc,seat,rect){
 const btn=doc.createElement("button");btn.type="button";
 btn.className="afds-legend-window";
 btn.dataset.afdsSeat=seat;btn.dataset.afdsLight=rect.id;
 btn.id="afds"+(seat==="CAPT"?"Capt":"Fo")+"Light"+rect.id;
 btn.title=nameFor(rect.id)+" P/RST — acknowledge";
 Object.assign(btn.style,{left:rect.x+"px",top:rect.y+"px",
  width:rect.w+"px",height:rect.h+"px"});
 const upper=doc.createElement("span");upper.className="afds-legend-main";
 upper.textContent=nameFor(rect.id);
 const lower=doc.createElement("span");lower.className="afds-legend-reset";
 lower.textContent="P/RST";
 btn.append(upper,lower);
 btn.addEventListener("click",()=>acknowledge(rect.id));
 lamps[seat].set(rect.id,btn);return btn;
}
function reflowFo(){
 const mode=root.document.documentElement.dataset.engineIndication==="CONVENTIONAL"?"CONVENTIONAL":"EIS";
 const def=layoutFor(mode);
 for(const l of def.lamps){
  const button=lamps.FO.get(l.id);
  if(!button)continue;
  Object.assign(button.style,{left:l.x+"px",top:l.y+"px",width:l.w+"px",height:l.h+"px"});
 }
 const art=visual.get("FO"),hit=toggleHits.get("FO");
 if(art){
  Object.assign(art.style,{left:(def.toggle.cx-def.toggle.cell/2)+"px",
   top:(def.toggle.cy-def.toggle.cell/2)+"px",
   width:def.toggle.cell+"px",height:def.toggle.cell+"px"});
 }
 if(hit){
  Object.assign(hit.style,{left:(def.toggle.cx-def.toggle.hit/2)+"px",
   top:(def.toggle.cy-def.toggle.hit/2)+"px",
   width:def.toggle.hit+"px",height:def.toggle.hit+"px"});
 }
 if(art)art.dataset.afdsFoGeometry=mode==="CONVENTIONAL"?"NON_EIS_FO_OWNER":"EIS_FO_APPROVED";
 return def;
}
function mount(){
 const native=root.document.querySelector("#region-main .region-native");
 if(!native)return false;
 if(mountRoot===native&&visual.get("FO")?.isConnected&&visual.get("CAPT")?.isConnected)return true;
 if(mountRoot!==native){
  mountRoot=native;visual.clear();toggleHits.clear();lamps.CAPT.clear();lamps.FO.clear();
 }
 // Avoid duplicate controls on reentry; preserve previous test state.
 for(const seat of Object.keys(INSTALL)){
  native.querySelectorAll('[data-afds-seat="'+seat+'"].afds-silver-toggle, [data-afds-seat="'+seat+'"].afds-toggle-hit, [data-afds-seat="'+seat+'"].afds-legend-window').forEach(x=>x.remove());
  lamps[seat].clear();
  for(const lamp of INSTALL[seat].lamps)native.append(createLamp(root.document,seat,lamp));
  for(const node of createToggle(root.document,seat,INSTALL[seat]))native.append(node);
  paint(seat);
 }
 reflowFo();
 return true;
}
function start(){
 if(mount())return;
 const stage=root.document.getElementById("scene")||root.document.body;
 if(!stage||!root.MutationObserver)return;
 const observer=new root.MutationObserver(()=>{
  if(mount())observer.disconnect();
 });
 observer.observe(stage,{subtree:true,childList:true});
}
root.B737AFDSAnnunciatorUnifiedV1=Object.freeze({
 VERSION,SPRITE,POSE,INSTALL,FO_NON_EIS_SHIFT,layoutFor,reflowFo,
 state:seat=>Core.status(states[seat||"FO"]),
 getState:seat=>Core.status(states[seat||"FO"]),
 press:(detent,seat="FO")=>select(seat,detent),
 release:(seat="FO")=>release(seat),
 setAlert,acknowledge,mount
});
root.addEventListener("blur",releaseAll);
root.document.addEventListener("visibilitychange",()=>{if(root.document.hidden)releaseAll();});
root.addEventListener("pagehide",releaseAll);
root.addEventListener("b737:cockpit-mounted",mount);
root.addEventListener("b737:engine-indication-view",()=>{
 mount();
 reflowFo();
});
if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
})(window);
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
