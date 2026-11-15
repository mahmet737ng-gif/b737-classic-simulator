/* Unified EADI v2: cockpit mount for the new EFIS Display Lab EADI renderer.
 * Replaces the retired attitude-only painter, retaining the owner-registered
 * Captain and FO glass apertures and existing live FMA / speed-tape contracts.
 * No demo values are read from EFISDisplayLabCore.initial().
 */
(function(root){
 'use strict';
 const VERSION='UNIFIED-EADI-LAB-FULL-0003';
 const WIDTH=900,HEIGHT=720;
 const slots=Object.freeze(['fma','speedTape','mach','localizer','glideslope',
   'radioAltitude','decisionHeight','flightDirector','tcasRA','windshear','comparators']);
 const stations={
  CAPT:{name:'Captain',x:327.20,y:218.20,w:198.00,h:159.30,
   pitch:0,bank:0,powered:true,attitudeValid:true,source:'TRAINING_LEVEL_DATUM'},
  FO:{name:'First Officer',x:1612.75,y:263.40,w:173.44,h:147.14,
   pitch:0,bank:0,powered:true,attitudeValid:true,source:'TRAINING_LEVEL_DATUM'}
 };
 const hooks={CAPT:new Map(),FO:new Map()};
 const screen={CAPT:null,FO:null};
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
 function observed(snapshot,topic){
  const record=snapshot?.[topic];
  return record?.quality==='VALID'?record.value:null;
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
  const snapshot=root.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
  const n=seat==='CAPT'?1:2,adc=observed(snapshot,'airdata.adc'+n);
  const mcp=observed(snapshot,'mcp.state');
  const irs=observed(snapshot,seat==='CAPT'?'irs.left':'irs.right');
  const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  const painted=renderer.renderUnifiedFull(display.canvas,{
   seat,pitch:station.pitch,bank:station.bank,
   powered:station.powered,attitudeValid:station.attitudeValid,
   source:station.source,
   iasKt:numeric(adc?.iasKt)??numeric(adc?.casKt),
   mach:numeric(adc?.mach),
   selectedSpeedKt:mcp?.powered===true?numeric(mcp?.selectedSpeedKt):null,
   groundSpeedKt:irs?.powered===true&&irs?.positionValid===true?
    numeric(irs.gsKt):null,
   radioAltFt:null,dhFt:null,locDeviation:null,gsDeviation:null
  });
  if(painted!==true){
   display.host.dataset.eadiError='NEW_FULL_RENDER_FAILED';return false;
  }
  delete display.host.dataset.eadiError;
  display.host.dataset.eadiPainter='EFIS_LAB_FULL_0003';
  display.host.dataset.eadiPaintCount=String(
   Number(display.host.dataset.eadiPaintCount||0)+1);
  const ctx=display.canvas.getContext('2d');
  const pixel=ctx?.getImageData?.(328,235,1,1)?.data;
  display.host.dataset.eadiSkyPixel=pixel?[pixel[0],pixel[1],pixel[2]].join(','):'UNREADABLE';
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
  setPower,registerLayer,snapshot});
 root.B737UnifiedEADI=api;
 // Compatibility only for existing live FMA / speed-tape extensions.
 // This alias NEVER loads or paints eadi-stage1-unified-v1.js.
 root.B737UnifiedEADIStage1=api;
 root.addEventListener('b737:efis-lab-eadi-ready',()=>{
  // Defer load order must not leave an empty new EADI canvas.
  if(screen.CAPT?.host?.isConnected)paint('CAPT');
  if(screen.FO?.host?.isConnected)paint('FO');
 });
 let refreshScheduled=false;
 function scheduleLive(){
  if(refreshScheduled)return;
  refreshScheduled=true;
  root.requestAnimationFrame(()=>{
   refreshScheduled=false;
   for(const seat of ['CAPT','FO'])if(screen[seat]?.host?.isConnected)paint(seat);
  });
 }
 root.addEventListener('b737:avionics-data',event=>{
  if(/^(airdata\.adc[12]|irs\.(left|right)|mcp\.state)$/.test(event.detail?.topic||''))scheduleLive();
 });
 root.addEventListener('b737:bus-consumer-snapshot',scheduleLive);
 root.addEventListener('b737:cockpit-mounted',mount);
 root.addEventListener('b737:engine-indication-view',mount);
 if(root.document.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})(window);
