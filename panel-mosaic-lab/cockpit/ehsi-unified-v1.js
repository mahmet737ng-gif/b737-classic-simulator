/* Photo-registered Classic EHSI for the Unified cockpit. Source adapters are read-only. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737UnifiedEHSI=api.mount(root);
})(globalThis,function(){
 'use strict';
 const VERSION='UNIFIED-EHSI-0001';
 const NS='http://www.w3.org/2000/svg';
 // Apertures measured inside the source glass. Children inherit each photo's
 // existing registration, including the FO mode-specific transform and lift.
 const CAPT={parent:'[data-piece="captain"]',box:[312,256,159,198],photo:[726,661.356]};
 const FO={
  EIS:{parent:'[data-piece="fo-outer"]',box:[26,215,153,200],photo:[475,592.164]},
  CONVENTIONAL:{parent:'#fo-owner-panel-v1',box:[452,522,344,370],photo:[1286,1223]}
 };
 const TOPICS=new Set(['electrical.buses','irs.left','irs.right','mcp.state',
  'airdata.adc1','airdata.adc2','navigation.vor1','navigation.vor2','navigation.dme1','navigation.dme2']);
 const SEATS=['CAPT','FO'];
 const number=v=>Number.isFinite(v)?v:null;
 function signal(snapshot,key){
  const s=snapshot?.[key];
  return s?.quality==='VALID'?s.value:null;
 }
 function liveModel(snapshot,state,aspect,acBus){
  const seat=state.seat,isCaptain=seat==='CAPT',n=isCaptain?1:2,d=state.ehsi;
  const bus=signal(snapshot,'electrical.buses')?.bus;
  const powered=(acBus?.powered??bus?.['electronic'+n])===true;
  const irs=signal(snapshot,isCaptain?'irs.left':'irs.right');
  const validIrs=irs?.powered===true&&irs.positionValid===true;
  const heading=validIrs?number(irs.headingDeg):null,track=validIrs?number(irs.trackDeg):null;
  const mcp=signal(snapshot,'mcp.state'),variation=number(irs?.magneticVariationDeg);
  const mcpTrue=value=>mcp?.powered===true&&variation!==null&&Number.isFinite(value)?((value+variation)%360+360)%360:null;
  const vor=signal(snapshot,'navigation.vor'+n),dme=signal(snapshot,'navigation.dme'+n);
  const matchedDme=dme&&(!vor||dme.stationIdent===vor.stationIdent)?number(dme.distanceNm):null;
  const radio=d.mode.includes('VOR_ILS');
  return {mode:d.mode,range:d.range,heading,track,selectedHeading:mcpTrue(mcp?.headingDeg),
   course:radio?mcpTrue(isCaptain?mcp?.courseL:mcp?.courseR):null,
   trueRef:true,trueAirspeed:number(signal(snapshot,'airdata.adc'+n)?.tasKt),
   groundSpeed:validIrs?number(irs.gsKt):null,
   nav:{type:'VOR',valid:radio&&!!vor,source:'VOR '+n,frequency:number(vor?.tunedFrequencyMHz),dme:matchedDme,cdi:null},
   route:{points:[],activeIndex:0,centerIndex:0},
   mapObjects:[],syntheticAirport:false,showSyntheticBearing:false,options:d.options,
   efis:{displayPower:powered,sgValid:powered,headingValid:heading!==null,trackValid:track!==null,
    brightness:d.brightness,wxBrightness:d.wxBrightness,displayAspect:aspect}};
 }
 function mount(win){
  const {document:doc,EFISDisplayLabCore:core,EFISClassicEHSIV2:renderer}=win;
  if(!core||!renderer)return null;
  const state={},instructor={},screens={},painted={};
  for(const seat of SEATS){state[seat]=core.initial();state[seat].seat=seat;instructor[seat]=false;}
  let selected='CAPT',frame=0,expiry=0,controlLoad=null;
  const cockpit=doc.getElementById('unifiedEfisDialog');
  const base=new URL('../../efis-display-lab/',doc.baseURI);
  const controlMount=doc.getElementById('efisCpMount');
  function syncControls(){
   const button=doc.getElementById('unifiedEfisDemo');
   if(button){button.checked=instructor[selected];}
   win.dispatchEvent(new CustomEvent('efislab-state',{detail:state[selected]}));
  }
  function select(seat){
   if(!SEATS.includes(seat))return;
   selected=seat;syncControls();
  }
  function dispatch(event){
   state[selected]=core.apply(state[selected],event);
   syncControls();
   schedule();
   return state[selected];
  }
  // Same controller contract used by the standalone EFIS controls.
  win.B737EFISDisplayLab=Object.freeze({getState:()=>JSON.parse(JSON.stringify(state[selected])),dispatch});
  function css(href){
   const link=doc.createElement('link');
   link.rel='stylesheet';link.href=href;doc.head.append(link);
   return link;
  }
  function script(src){
   return new Promise((resolve,reject)=>{
    const tag=doc.createElement('script');
    tag.src=src;tag.onload=resolve;tag.onerror=()=>{tag.remove();reject(Error('EFIS control assets unavailable'));};
    doc.head.append(tag);
   });
  }
  function showControls(){
   if(!cockpit?.open)cockpit?.showModal();
   if(controlLoad)return;
   controlMount.textContent='Loading EFIS controls…';
   if(!doc.querySelector('link[data-unified-efis-controls]')){
    css(new URL('efis-cp.css?v=UNIFIED-EHSI-0001',base)).dataset.unifiedEfisControls='true';
   }
   controlLoad=(async()=>{
    if(!win.EFIS_TEST_IMAGES)await script(new URL('../cdu-standalone-v6/efis-test/images.js',base));
    controlMount.textContent='';
    await script(new URL('efis-cp.js?v=UNIFIED-EHSI-0001',base));
    syncControls();
   })().catch(()=>{controlLoad=null;controlMount.textContent='Could not load EFIS controls. Reopen to retry.';});
  }
  function slot(seat){
   return seat==='CAPT'?CAPT:FO[doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS'];
  }
  function display(seat,native){
   const placement=slot(seat),parent=native.querySelector(placement.parent);
   if(!parent)return null;
   const existing=screens[seat];
   if(existing?.host.parentNode===parent)return existing;
   existing?.host.remove();
   const host=doc.createElement('div'),svg=doc.createElementNS(NS,'svg');
   const [x,y,w,h]=placement.box,[pw,ph]=placement.photo;
   host.dataset.unifiedEhsiSeat=seat;
   host.className='unified-ehsi-glass';
   Object.assign(host.style,{left:100*x/pw+'%',top:100*y/ph+'%',width:100*w/pw+'%',height:100*h/ph+'%'});
   svg.id='unifiedEhsi'+seat;svg.setAttribute('role','img');
   host.append(svg);parent.append(host);
   delete painted[seat];
   return screens[seat]={host,svg,aspect:w/h};
  }
  function trackExpiry(snapshot){
   if(expiry)win.clearTimeout(expiry);
   expiry=0;
   // Expiry does not emit a network event. Wake only for the next valid
   // external packet deadline, using the network's own registered TTL.
   const catalog=win.B737AvionicsDataNetworkV1?.CATALOG,now=Date.now();
   const deadlines=[...TOPICS]
    .filter(topic=>/^(airdata|navigation)\./.test(topic)&&snapshot?.[topic]?.quality==='VALID')
    .map(topic=>snapshot[topic].receivedAtMs+catalog?.[topic]?.ttl)
    .filter(deadline=>Number.isFinite(deadline));
   if(deadlines.length)expiry=win.setTimeout(schedule,Math.max(1,Math.min(...deadlines)-now+1));
  }
  function refresh(){
   const native=doc.querySelector('#region-main .region-native');
   if(!native)return;
   const snapshot=win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
   trackExpiry(snapshot);
   for(const seat of SEATS){
    const screen=display(seat,native);
    if(!screen)continue;
    const setup=state[seat],preview=instructor[seat];
    const feed=win.B737UnifiedBusConsumerLiveV1?.getBus?.(seat==='CAPT'?'electronic1':'electronic2','115VAC');
    const model=preview?core.ehsiModel(setup):liveModel(snapshot,setup,screen.aspect,feed);
    model.efis.displayAspect=screen.aspect;
    const signature=JSON.stringify(model);
    if(painted[seat]!==signature){
     renderer.render(screen.svg,model);
     painted[seat]=signature;
    }
    screen.host.dataset.input=preview?'INSTRUCTOR':'UNIFIED';
    const adi=native.querySelector('[data-eadi-stage1-seat="'+seat+'"] canvas');
    if(adi&&adi.style.opacity!==String(setup.eadi.brightness))adi.style.opacity=String(setup.eadi.brightness);
   }
  }
  function schedule(){
   if(frame)return;
   frame=win.requestAnimationFrame(()=>{frame=0;refresh();});
  }
  doc.getElementById('unifiedEfisOpen')?.addEventListener('click',showControls);
  doc.getElementById('unifiedEfisClose')?.addEventListener('click',()=>cockpit.close());
  doc.getElementById('unifiedEfisSeat')?.addEventListener('change',e=>select(e.target.value));
  doc.getElementById('unifiedEfisDemo')?.addEventListener('change',e=>{
   instructor[selected]=e.target.checked;schedule();
  });
  for(const event of ['b737:cockpit-mounted','b737:engine-indication-view','b737:bus-consumer-snapshot'])win.addEventListener(event,schedule);
  win.addEventListener('b737:avionics-data',e=>{if(TOPICS.has(e.detail?.topic))schedule();});
  schedule();
  return Object.freeze({version:VERSION,refresh});
 }
 return Object.freeze({VERSION,liveModel,mount});
});
