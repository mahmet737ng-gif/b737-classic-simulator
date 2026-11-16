/* Unified EADI v2: cockpit mount for the new EFIS Display Lab EADI renderer.
 * Replaces the retired attitude-only painter, retaining the owner-registered
 * Captain and FO glass apertures and existing live FMA / speed-tape contracts.
 * No demo values are read from EFISDisplayLabCore.initial().
 */
(function(root){
 'use strict';
 const VERSION='UNIFIED-EADI-LAB-FULL-0006-MCP-EFIS';
 const WIDTH=900,HEIGHT=720;
 const slots=Object.freeze(['fma','speedTape','mach','localizer','glideslope',
   'radioAltitude','decisionHeight','flightDirector','tcasRA','windshear','comparators']);
 const stations={
  CAPT:{name:'Captain',x:327.20,y:218.20,w:198.00,h:159.30,
   pitch:0,bank:0,powered:null,attitudeValid:false,source:'IRS'},
  FO:{name:'First Officer',x:1612.75,y:263.40,w:173.44,h:147.14,
   pitch:0,bank:0,powered:null,attitudeValid:false,source:'IRS'}
 };
 const hooks={CAPT:new Map(),FO:new Map()};
 const screen={CAPT:null,FO:null};
 const dh={CAPT:{},FO:{}};
 let refreshScheduled=false;
 function mode(){
  return root.document.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
 }
 function normalized(seat){
  const key=String(seat||'').toUpperCase();
  const s=key==='CAPTAIN'?'CAPT':key==='FIRST OFFICER'||key==='FIRSTOFFICER'?'FO':key;
  if(!stations[s])throw Error('Unknown EADI seat');
  return s;
 }
 function position(seat){
  if(seat!=='FO'||mode()!=='CONVENTIONAL')return stations[seat];
  const slot=root.B737ConventionalEadiSocketV1;
  if(!slot?.nativeRect)throw Error('FO Conventional EADI glass registration unavailable');
  return slot.nativeRect;
 }
 function trackDh(seat,cp,ra,powered){
  const s=dh[seat],setting=cp?.dh??-20,count=cp?.dhResetCount??0;
  if(!powered||s.setting!==setting||s.count!==count)s.latched=false;
  else if(ra!==null&&s.previous>setting&&ra<=setting&&ra>0&&setting>=0)s.latched=true;
  s.setting=setting;s.count=count;s.previous=ra;
  return s.latched;
 }
 function paint(seat){
  const station=stations[seat],display=screen[seat];
  const renderer=root.EFISDisplayLabEadi;
  if(!display?.canvas?.isConnected)return false;
  if(typeof renderer?.renderUnifiedFull!=='function'){
   display.host.dataset.eadiError='NEW_FULL_RENDERER_MISSING';
   const ctx=display.canvas.getContext('2d');
   if(ctx){ctx.fillStyle='#000';ctx.fillRect(0,0,display.canvas.width,display.canvas.height);}
   return false;
  }
  const src=root.B737UnifiedEfisSources?.project(seat);
  if(!src)return false;
  const panel=root.B737UnifiedEFISPedestalV1;
  const cp=panel?.getState?.(seat); // DH/dimmer always belong to the receiving pilot
  const powered=root.B737UnifiedEfisSources.getPreset()!=='COLD_DARK'&&(station.powered??(src.displayPowered&&src.video));
  const injected=station.source==='SIMULATOR_INJECTION';
  const numeric=v=>Number.isFinite(v)?v:null;
  const radAlt=numeric(src.ra?.heightFt),front=src.frontCourse;
  const adc=src.adc;
  const smooth=root.B737UnifiedFlightDisplayMotionV1?.sample?.();
  const validSmooth=smooth?.schema==='B737_FLIGHT_SCENARIO_STATE_V1'&&
   root.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true;
  // No bypass of IRS/ADC validity or an explicit pilot-attitude injection.
  const smoothAttitude=validSmooth&&!injected&&src.attitude===true;
  const smoothIas=validSmooth&&(
   numeric(adc?.iasKt)!==null||numeric(adc?.casKt)!==null);
  const originalSpeedView=root.B737UnifiedSpeedTapeV1?.getView?.(src.sourceSeat);
  let speedView=originalSpeedView;
  if(smoothIas&&originalSpeedView?.casKt!=null){
   const speed=smooth.iasKt,center=Math.max(45,Math.min(420,speed)),radius=42;
   const range={minKt:center-radius,maxKt:center+radius};
   speedView={...originalSpeedView,casKt:speed,tapeCenterKt:center,range,
    lowSpeedDefault:speed<=45,
    commandedPosition:originalSpeedView.command?
      originalSpeedView.command.speedKt>range.maxKt?'ABOVE':
      originalSpeedView.command.speedKt<range.minKt?'BELOW':'ON_TAPE':null};
  }
  const painted=renderer.renderUnifiedFull(display.canvas,{
   seat,pitch:smoothAttitude?smooth.pitchDeg:injected?station.pitch:src.pitch,
   bank:smoothAttitude?smooth.bankDeg:injected?station.bank:src.bank,
   powered,attitudeValid:injected?station.attitudeValid:src.attitude,
   source:injected?station.source:'IRS '+(src.irs===1?'L':'R'),
   comparison:src.comparison,brightness:cp?.brightness.adi??1,
    selectedSpeedKt:src.mcp?.selectedSpeedKt??null,
    selectedSpeedValid:src.mcp?.powered===true,
   iasKt:smoothIas?smooth.iasKt:numeric(adc?.iasKt)??numeric(adc?.casKt),
   mach:numeric(adc?.mach),
   speedView,
   groundSpeedKt:src.groundSpeed,radioAltFt:radAlt,dhFt:cp?.dh??null,dhLatched:trackDh(seat,cp,radAlt,powered),
   ils:!!src.ils,frontCourse:front===true,
   locDeviation:front===false&&Number.isFinite(src.ils?.localizerDots)?-src.ils.localizerDots:numeric(src.ils?.localizerDots),
   gsDeviation:numeric(src.ils?.glideslopeDots),
   director:src.director
  });
  display.host.dataset.sg=String(src.sg);
  display.host.dataset.irs=src.irs===1?'L':'R';
   display.host.dataset.controlSeat=seat;
   display.host.dataset.controlDh=cp?.dh==null?'':String(cp.dh);
   display.host.dataset.controlBrightness=cp?.brightness?.adi==null?'':String(cp.brightness.adi);
   // Read-only MCP-to-glass traces. The real speed tape and the FMA engine
   // keep sole authority for speed bug and annunciation drawing.
   display.host.dataset.mcpSelectedSpeed=src.mcp?.selectedSpeedKt==null?'':String(src.mcp.selectedSpeedKt);
   display.host.dataset.mcpSpeedMode=src.mcp?.speedDisplayMode||'OFF';
   display.host.dataset.mcpVertical=src.mcp?.verticalMode||'';
   display.host.dataset.mcpLateral=src.mcp?.lateralMode||'';
   display.host.dataset.mcpSelectedAltitude=src.mcp?.altitudeSelectedFt==null?'':String(src.mcp.altitudeSelectedFt);
   display.host.dataset.mcpSelectedVs=src.mcp?.verticalSpeedSelectedFpm==null?'':String(src.mcp.verticalSpeedSelectedFpm);
  display.host.dataset.eadiPower=String(powered);
  display.host.dataset.eadiAttitude=String(injected?station.attitudeValid:src.attitude);
  if(painted!==true){
   display.host.dataset.eadiError='NEW_FULL_RENDER_FAILED';return false;
  }
  delete display.host.dataset.eadiError;
  display.host.dataset.eadiPainter='EFIS_LAB_FULL_0004';
  display.host.dataset.eadiPaintCount=String(
   Number(display.host.dataset.eadiPaintCount||0)+1);
  // Full lab engine paints its own live FMA and speed-tape presentation.
  // Legacy hook callbacks remain registered for source notifications but
  // MUST NOT draw the retired attitude-only / duplicate FMA or tape layers.
  return true;
 }
 function make(seat,native){
  const s=stations[seat],rect=position(seat),displayMode=mode();
  let host=native.querySelector('[data-eadi-stage1-seat="'+seat+'"]');
  if(host&&host.dataset.eadiVersion!==VERSION){host.remove();host=null;}
  if(!host){
   host=root.document.createElement('div');
   host.className='eadi-stage1-host';
   host.dataset.eadiStage1Seat=seat;
   host.dataset.eadiVersion=VERSION;
   const canvas=root.document.createElement('canvas');
   canvas.width=WIDTH;canvas.height=HEIGHT;
   canvas.className='eadi-stage1-canvas';
   canvas.setAttribute('role','img');
   canvas.setAttribute('aria-label',s.name+' 737 Classic new EADI');
   host.append(canvas);native.append(host);
  }
  const radius=seat==='FO'&&displayMode==='CONVENTIONAL'
   ?root.B737ConventionalEadiSocketV1.cornerRadius:'7% / 8%';
  Object.assign(host.style,{
   position:'absolute',left:rect.x+'px',top:rect.y+'px',
   width:rect.w+'px',height:rect.h+'px',overflow:'hidden',
   borderRadius:radius,background:'#000',pointerEvents:'none',
   userSelect:'none',zIndex:'27'
  });
  host.dataset.eadiMode=displayMode;
  host.dataset.eadiSocket=seat==='FO'&&displayMode==='CONVENTIONAL'
   ?root.B737ConventionalEadiSocketV1.VERSION:'EIS-FINAL';
  const canvas=host.querySelector('canvas');
  Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',pointerEvents:'none'});
  screen[seat]={host,canvas};
  paint(seat);
 }
 function mount(){
  const native=root.document.querySelector('#region-main .region-native');
  if(!native)return false;
  for(const seat of ['CAPT','FO']){
   const current=screen[seat];
   if(!current?.host?.isConnected||current.host.parentElement!==native||
      current.host.dataset.eadiMode!==mode()){
    make(seat,native);
   }else{
    const rect=position(seat);
    // Retain the approved photo registration even after a mode transition.
    Object.assign(current.host.style,{left:rect.x+'px',top:rect.y+'px',
     width:rect.w+'px',height:rect.h+'px'});
    paint(seat);
   }
  }
  return true;
 }
 function setAttitude(seat,pitch,bank){
  const id=normalized(seat),s=stations[id];
  if(!Number.isFinite(pitch)||!Number.isFinite(bank))
   throw TypeError('EADI pitch/bank require numeric degrees');
  s.pitch=Math.max(-90,Math.min(90,Math.round(pitch*10)/10));
  s.bank=((bank%360)+540)%360-180;
  s.attitudeValid=true;s.source='SIMULATOR_INJECTION';
  paint(id);
  return {seat:id,pitch:s.pitch,bank:s.bank};
 }
 function setAttitudeValid(seat,valid){
  const id=normalized(seat);
  stations[id].attitudeValid=valid===true;paint(id);
  return stations[id].attitudeValid;
 }
 function setPower(seat,on){
  const id=normalized(seat);
  stations[id].powered=on===true;paint(id);
  return stations[id].powered;
 }
 function registerLayer(seat,id,draw){
  const key=normalized(seat);
  if(!slots.includes(id)||typeof draw!=='function')
   throw TypeError('Unregistered EADI extension');
  hooks[key].set(id,draw);paint(key);
  return ()=>{hooks[key].delete(id);paint(key);};
 }
 function snapshot(){
  return {version:VERSION,renderer:root.EFISDisplayLabEadi?.renderUnifiedFull?'EFISDisplayLabEadiFull':'MISSING',
   paints:{CAPT:Number(screen.CAPT?.host?.dataset.eadiPaintCount||0),FO:Number(screen.FO?.host?.dataset.eadiPaintCount||0)},
   mode:mode(),mounted:!!screen.CAPT?.host?.isConnected&&!!screen.FO?.host?.isConnected,
   activeGlass:{CAPT:position('CAPT'),FO:position('FO')},
   stations:Object.fromEntries(Object.entries(stations).map(([seat,s])=>
    [seat,{pitch:s.pitch,bank:s.bank,powered:s.powered,
     attitudeValid:s.attitudeValid,source:s.source}])),
   futureSlots:[...slots]};
 }
 const api=Object.freeze({version:VERSION,mount,setAttitude,setAttitudeValid,
  setPower,registerLayer,snapshot,requestPaint:scheduleLive});
 root.B737UnifiedEADI=api;
 // Compatibility only for existing live FMA / speed-tape extensions.
 // This alias NEVER loads or paints eadi-stage1-unified-v1.js.
 root.B737UnifiedEADIStage1=api;
 root.addEventListener('b737:efis-lab-eadi-ready',()=>{
  // Defer load order must not leave an empty new EADI canvas.
  if(screen.CAPT?.host?.isConnected)paint('CAPT');
  if(screen.FO?.host?.isConnected)paint('FO');
 });
 function scheduleLive(){
  if(refreshScheduled)return;
  refreshScheduled=true;
  root.requestAnimationFrame(()=>{
   refreshScheduled=false;
   for(const seat of ['CAPT','FO'])if(screen[seat]?.host?.isConnected)paint(seat);
  });
 }
 root.addEventListener('b737:avionics-data',event=>{
  if(/^(airdata\.(adc|radioAltitude)[12]|navigation\.ils[12]|afds\.director[12]|irs\.(left|right)|mcp\.state|fmc\.computed|electrical\.buses)$/.test(event.detail?.topic||''))scheduleLive();
 });
 for(const event of ['b737:flight-presentation-frame','b737:bus-consumer-snapshot','b737:efis-source-change','b737:unified-efis-control','b737:mcp-afds-state'])root.addEventListener(event,scheduleLive);
 root.addEventListener('b737:cockpit-mounted',mount);
 root.addEventListener('b737:engine-indication-view',mount);
 if(root.document.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})(window);
