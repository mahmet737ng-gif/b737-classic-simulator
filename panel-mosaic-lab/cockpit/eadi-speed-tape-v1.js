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
 const VERSION='EADI-SPEED-TAPE-0001';
 const COLOR=Object.freeze({white:'#f4f4f3',green:'#16bf62',magenta:'#dc36df',
  yellow:'#dfc53c',red:'#d44747',black:'#000000'});
 const WIDTH=900,HEIGHT=720,TAPE={left:57,right:256,top:172,bottom:612,axis:199,centerY:391,pxPerKt:5.2};
 const model=()=>typeof globalThis==='object'?globalThis.B737ClassicSpeedTapeEngineV1:null;
 let win=null,ready=false;
 const states={CAPT:null,FO:null},unsubscribers=[],expiry={CAPT:null,FO:null};
 const stamps={CAPT:null,FO:null},fingerprints={CAPT:new Map(),FO:new Map()};
 function validateSeat(seat){if(!['CAPT','FO'].includes(seat))throw Error('INVALID_EADI_SEAT');}
 function getState(seat){validateSeat(seat);return JSON.parse(JSON.stringify(states[seat]));}
 function getView(seat){validateSeat(seat);return model().view(states[seat]);}
 function repaint(seat){
  const eadi=win?.B737UnifiedEADIStage1;
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
 function mark(ctx,label,value,view,color=COLOR.green){
  if(!Number.isFinite(value))return;
  const y=yFor(value,view);if(!visible(y,9))return;
  segment(ctx,214,y,228,y,color,3);
  text(ctx,label,234,y,color,18,'left');
 }
 function band(ctx,endSpeed,view,{x,w,direction,color='yellow',striped=false}){
  if(!Number.isFinite(endSpeed))return;
  const endpoint=yFor(endSpeed,view);
  const y1=direction==='LOW'?Math.max(endpoint,TAPE.top):TAPE.top;
  const y2=direction==='LOW'?TAPE.bottom:Math.min(endpoint,TAPE.bottom);
  if(y2<=y1)return;
  if(striped)stripe(ctx,x,y1,w,y2-y1);
  else{
   ctx.fillStyle='rgba(218,183,55,.16)';ctx.fillRect(x,y1,w,y2-y1);
   segment(ctx,x,y1,x,y2,COLOR[color]||COLOR.yellow,2);
   segment(ctx,x+w,y1,x+w,y2,COLOR[color]||COLOR.yellow,2);
   if(visible(endpoint))segment(ctx,x,endpoint,x+w,endpoint,COLOR[color]||COLOR.yellow,2);
  }
 }
 function draw(ctx,view){
  if(!view||view.schema!=='B737_CLASSIC_SPEED_TAPE_VIEW_V1')return;
  ctx.save();
  // Layer uses the reserved speedTape canvas region; FMA and attitude windows
  // have their own independent rendering and fixed center datum.
  ctx.beginPath();ctx.rect(TAPE.left,TAPE.top,TAPE.right-TAPE.left,TAPE.bottom-TAPE.top);ctx.clip();
  if(view.casKt===null){
   if(view.flags.SPD)text(ctx,'SPD',TAPE.axis-20,TAPE.centerY,COLOR.yellow,35,'center');
   ctx.restore();return;
  }
  const low=view.range.minKt,high=view.range.maxKt;
  // White scale at 20-kt numeric intervals, fine subdivisions every 10 kt.
  for(let k=40;k<=420;k+=10){
   if(k<low-3||k>high+3)continue;
   const y=yFor(k,view);
   segment(ctx,k%20===0?TAPE.axis-31:TAPE.axis-17,y,TAPE.axis,y,COLOR.white,2.6);
   if(k%20===0)text(ctx,k,TAPE.axis-40,y,COLOR.white,30,'right');
  }
  segment(ctx,TAPE.axis,TAPE.top,TAPE.axis,TAPE.bottom,'#e5e9e9',2.5);
  const m=view.marks;
  // Only source-verified limits are drawn, never fixed performance estimates.
  band(ctx,m.minimumManeuverKt,view,{x:234,w:15,direction:'LOW'});
  band(ctx,m.stickShakerKt,view,{x:249,w:10,direction:'LOW',striped:true});
  band(ctx,m.maximumOperatingKt,view,{x:249,w:10,direction:'HIGH',striped:true});
  const highYellow=m.highSpeedBuffetKt??m.nextFlapPlacardKt;
  band(ctx,highYellow,view,{x:234,w:15,direction:'HIGH'});
  if(Number.isFinite(m.flapsUpKt)){
   const y=yFor(m.flapsUpKt,view);
   if(visible(y,9)){
    ctx.strokeStyle=COLOR.green;ctx.lineWidth=3;ctx.beginPath();ctx.arc(212,y,10,0,Math.PI*2);ctx.stroke();
   }
  }
  mark(ctx,'F',m.retractKt,view);
  mark(ctx,'R',m.vrefKt,view);
  mark(ctx,'1',m.v1Kt,view);
  // VR and VREF both use an R cue, but takeoff VR is not a VREF reference.
  mark(ctx,'R',m.vrKt,view);
  if(Number.isFinite(m.v1Kt)&&m.v1Kt>high)
   text(ctx,'V1 '+Math.round(m.v1Kt),TAPE.axis+51,TAPE.top+20,COLOR.green,21,'right');
  // Trend arrow: the pure engine handles 4-kt/3-kt hysteresis.
  if(view.trend){
   const target=Math.max(TAPE.top,Math.min(TAPE.bottom,yFor(view.trend.predictedKt,view)));
   const tipDirection=target<TAPE.centerY?-1:1;
   segment(ctx,207,TAPE.centerY,207,target,COLOR.green,3);
   segment(ctx,207,target,202,target-tipDirection*9,COLOR.green,2);
   segment(ctx,207,target,212,target-tipDirection*9,COLOR.green,2);
  }
  // Only the active source appears: MCP or FMC, never concurrent bugs.
  if(view.command){
   const k=view.command.speedKt;
   if(view.commandedPosition==='ON_TAPE'){
    const y=yFor(k,view);
    segment(ctx,199,y-4,228,y-4,COLOR.magenta,3);
    segment(ctx,199,y+4,228,y+4,COLOR.magenta,3);
   }else{
    text(ctx,String(Math.round(k)),TAPE.axis+51,
     view.commandedPosition==='ABOVE'?TAPE.top+13:TAPE.bottom-14,COLOR.magenta,23,'right');
   }
  }
  if(view.rollingDigitsVisible)digits(ctx,view.casKt);
  else text(ctx,'45',TAPE.axis-46,TAPE.centerY,COLOR.white,30,'right');
  if(view.flags.SEL_SPD_INOP)text(ctx,'SEL SPD',TAPE.axis-7,TAPE.top+45,COLOR.yellow,17,'right');
  if(view.flags.V1_INOP)text(ctx,'V1',TAPE.axis+30,TAPE.top+46,COLOR.yellow,18,'left');
  if(view.flags.SPD_LIM)text(ctx,'SPD LIM',TAPE.axis+38,TAPE.bottom-22,COLOR.yellow,17,'right');
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
  if(signal.quality!=='VALID'||value?.sensorValid!==true||
     !Number.isFinite(value.casKt))return false;
  const timeMs=signal.receivedAtMs??Date.now();
  if(stamps[seat]!==null&&timeMs<=stamps[seat])return false;
  stamps[seat]=timeMs;
  try{dispatch(seat,{type:'ADC',valid:true,casKt:value.casKt,timeMs,
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
  const type={'b737:speed-tape-fmc':'FMC','b737:speed-tape-limits':'LIMITS',
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
  root.addEventListener('b737:mcp-afds-state',syncMcp);
  root.addEventListener('b737:avionics-data',e=>{
   if(['airdata.adc1','airdata.adc2'].includes(e.detail?.topic))syncNetwork();
  });
  for(const kind of ['b737:speed-tape-fmc','b737:speed-tape-limits',
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