/* Classic FCOM 10.32.33 / 10.40 / 11.10.11, ATA 34 EFIS training.
 * Seat -> SG (video relay) -> IRS and VHF NAV (independent input relays).
 * Physical display power and dimmers always belong to the receiving seat. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.B737UnifiedEfisSources=api.bind(root);
})(globalThis,function(){
 'use strict';
 const SEATS=['CAPT','FO'];
 const SWITCHES={'efi-transfer':['BOTH ON 1','NORMAL','BOTH ON 2'],
  'irs-transfer':['BOTH ON L','NORMAL','BOTH ON R'],'vhf-nav':['BOTH ON 1','NORMAL','BOTH ON 2']};
 const signal=(snap,key)=>snap?.[key]?.quality==='VALID'?snap[key].value:null;
 const value=v=>Number.isFinite(v)?v:null;
 const norm=v=>((v%360)+360)%360;
 const delta=v=>norm(v+180)-180;
 const irsTopic=n=>n===1?'irs.left':'irs.right';
 function resolve(snapshot,seat,toggles={},feeds={},faults={}){
  const display=seat==='CAPT'?1:2;
  const selected=(key,fallback)=>{
   const i=SWITCHES[key].indexOf(toggles[key]);
   return i===0?1:i===2?2:fallback;
  };
  const sg=selected('efi-transfer',display);
  const irs=selected('irs-transfer',sg),vhf=selected('vhf-nav',sg);
  const iru=signal(snapshot,irsTopic(irs)),peer=signal(snapshot,irsTopic(irs===1?2:1));
  const validAtt=u=>u?.powered===true&&u.attitudeValid===true&&Number.isFinite(u.pitchDeg)&&Number.isFinite(u.rollDeg);
  const attitude=validAtt(iru),peerAttitude=validAtt(peer);
  const nav=iru?.powered===true&&iru.positionValid===true;
  const fmc=signal(snapshot,'fmc.computed');
  const fmcMotion=fmc?.operational===true?fmc.motion:null;
  const heading=iru?.powered===true?value(iru.headingDeg):null;
  const trueTrack=value(fmcMotion?.trueTrackDeg)??(nav?value(iru.trackDeg):null);
  const variation=iru?.powered===true?value(iru.magneticVariationDeg):null;
  const direction=deg=>Number.isFinite(deg)?norm(deg-(variation??0)):null;
  const magCourse=deg=>Number.isFinite(deg)?norm(deg+(variation===null?0:variation)):null;
  const mcp=signal(snapshot,'mcp.state');
  const radioCourse=mcp?.powered===true?value(sg===1?mcp.courseL:mcp.courseR):null;
  const common=selected('efi-transfer',0)!==0||selected('irs-transfer',0)!==0;
  const comparison=common||!attitude||!peerAttitude?['COMP']:
   [Math.abs(iru.pitchDeg-peer.pitchDeg)>3?'PITCH':null,Math.abs(delta(iru.rollDeg-peer.rollDeg))>3?'ROLL':null].filter(Boolean);
  return {display,sg,irs,vhf,sourceSeat:SEATS[sg-1],displayPowered:feeds[display]===true,
   video:feeds[sg]===true&&faults[sg]!==true,
   attitude,pitch:attitude?iru.pitchDeg:null,bank:attitude?iru.rollDeg:null,comparison,
   heading:direction(heading),track:direction(trueTrack),trueTrack,trueRef:variation===null,
   selectedHeading:variation!==null&&mcp?.powered===true?value(mcp.headingDeg):null,
   course:variation!==null?radioCourse:null,
   frontCourse:trueTrack!==null&&variation!==null&&radioCourse!==null?Math.abs(delta(trueTrack-magCourse(radioCourse)))<=90:null,
   trackSource:Number.isFinite(fmcMotion?.trueTrackDeg)?'FMC':trueTrack!==null?'IRS '+(irs===1?'L':'R'):null,
   groundSpeed:value(fmcMotion?.gsKt)??(nav?value(iru.gsKt):null),
   windDirection:direction(value(fmcMotion?.windFromDeg)??(nav?iru.windFromDeg:null)),
   windSpeed:value(fmcMotion?.windKt)??(nav?value(iru.windKt):null),
   fmc,adc:signal(snapshot,'airdata.adc'+sg),
   vor:signal(snapshot,'navigation.vor'+vhf),dme:signal(snapshot,'navigation.dme'+vhf),
   ils:signal(snapshot,'navigation.ils'+vhf),ra:signal(snapshot,'airdata.radioAltitude'+sg),
   director:signal(snapshot,'afds.director'+sg)};
 }
 function offsets(from,to){
  const r=Math.PI/180,a=from.lat*r,b=to.lat*r,dl=delta(to.lon-from.lon)*r;
  const h=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  const distance=6880.13*Math.asin(Math.sqrt(Math.min(1,h)));
  const bearing=Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl));
  return {x:distance*Math.sin(bearing),y:distance*Math.cos(bearing)};
 }
 function route(fmc,mode,step){
  const data=fmc?.operational===true?fmc.route?.displayRoute:null;
  const points=data?.points;
  if(!points?.length)return {points:[],activeIndex:-1,centerIndex:0};
  const centerIndex=Math.min(points.length-1,Math.max(0,step??1));
  const pos=fmc.position;
  const anchor=mode==='PLAN'?points[centerIndex]:pos?.quality==='VALID'?{lat:pos.latitudeDeg,lon:pos.longitudeDeg}:null;
  return {source:data.source,points:anchor?points.map(p=>({...p,...offsets(anchor,p)})):[],activeIndex:-1,centerIndex};
 }
 function bind(win){
  let requested={},applied={},preset='LIVE';
  const faults={1:false,2:false};
  const notify=()=>win.dispatchEvent(new CustomEvent('b737:efis-source-change'));
  function trainingSupply(bus,voltage){
   return preset==='FULL_ALIGN'&&win.B737UnifiedBusFailureInjectionV1?.live?.isUnavailable(bus,voltage)!==true;
  }
  function applySelection(snapshot){
   const supply=win.B737UnifiedBusConsumerLiveV1;
   const bus=signal(snapshot,'electrical.buses')?.bus;
   if((supply?.getBus?.('battery','28VDC')?.powered??bus?.battery)!==true&&!trainingSupply('battery','28VDC'))return;
   const changed=['efi-transfer','irs-transfer'].some(key=>(applied[key]??'NORMAL')!==(requested[key]??'NORMAL'));
   applied={...requested};
   if(changed)win.dispatchEvent(new CustomEvent('b737:efis-transfer-ap-disconnect'));
  }
  function updateToggles(values){
   let changed=false;
   for(const [key,valid] of Object.entries(SWITCHES)){
    const next=values?.[key];
    if(valid.includes(next)&&requested[key]!==next){requested[key]=next;changed=true;}
   }
   if(changed){applySelection(win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.());notify();}
  }
  win.addEventListener('b737:efis-overhead-selectors',event=>updateToggles(event.detail));
  for(const event of ['b737:bus-consumer-snapshot','b737:avionics-data'])win.addEventListener(event,e=>{
   if(event==='b737:avionics-data'&&e.detail?.topic!=='electrical.buses')return;
   applySelection(win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.());
  });
  function project(seat,snapshot=win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.()){
   const bus=signal(snapshot,'electrical.buses')?.bus;
   const supply=win.B737UnifiedBusConsumerLiveV1;
   const powered=(id,voltage)=>preset!=='COLD_DARK'&&
    ((supply?.getBus?.(id,voltage)?.powered??bus?.[id])===true||trainingSupply(id,voltage));
   return resolve(snapshot,seat,applied,{1:powered('electronic1','115VAC'),2:powered('electronic2','115VAC')},faults);
  }
  return Object.freeze({project,route,getPreset:()=>preset,trainingSupply,
   setPreset(value){
    if(!['FULL_ALIGN','COLD_DARK','LIVE'].includes(value))throw Error('Invalid EFIS preset');
    preset=value;
    applySelection(win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.());
    win.dispatchEvent(new CustomEvent('b737:efis-preset-change',{detail:{preset}}));
    notify();
   },
   setSgFailure(n,on){if(![1,2].includes(n))throw Error('Invalid SG');faults[n]=on===true;notify();}
  });
 }
 return Object.freeze({resolve,route,offsets,bind});
});
