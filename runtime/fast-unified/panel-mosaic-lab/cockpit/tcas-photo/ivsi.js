(() => {
 'use strict';
 const {hardware,part,url}=window.B737TcasPhotoHardware;
 const api=window.B737UnifiedTcasV1,registration=window.B737PhotoGaugeRegistrationV1;
 const stations=['captain','firstOfficer'],displays=new Map();
 const preferences={captain:{brightness:1,full:false},firstOfficer:{brightness:1,full:false}};
 const scale=new Image();scale.src=url('scale.webp');
 let state=api.getState(),controls=api.getControls(),pending=false;
 const cyan='#79def2',amber='#ffaf21';
 const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 const ticks=[[0,0],[500,34],[1000,66],[2000,108],[4000,148],[6000,180]];
 function angle(v){
  const speed=clamp(Math.abs(v),0,6000);
  const i=Math.max(1,ticks.findIndex(([n])=>n>=speed));
  const [a,b]=ticks[i-1],[c,d]=ticks[i];
  return Math.PI+(b+(d-b)*(speed-a)/(c-a))*Math.sign(v)*Math.PI/180;
 }
 function arc(g,lo,hi,color){
  if(hi<=lo)return;
  g.beginPath();g.arc(201,203,145,angle(lo),angle(hi));g.strokeStyle=color;g.lineWidth=10;g.stroke();
 }
 function guidance(g,ra){
  if(!ra)return;
  if(ra.id.startsWith('LEVEL_OFF')){
   if(ra.id.endsWith('CLIMB'))arc(g,250,6000,'#ff2529');
   else arc(g,-6000,-250,'#ff2529');
   arc(g,-250,250,'#22eb48');return;
  }
  const lo=ra.min??-6000,hi=ra.max??6000;
  arc(g,-6000,lo,'#ff2529');arc(g,hi,6000,'#ff2529');
  if(ra.preventive)return;
  // Simulator fly-to band uses the same vertical-rate limits as the EADI.
  if(ra.min===null)arc(g,Math.max(lo,hi-500),hi,'#22eb48');
  else if(ra.max===null)arc(g,lo,Math.min(hi,lo+500),'#22eb48');
  else arc(g,lo,hi,'#22eb48');
 }
 function label(g,str,x,y,color=cyan,size=17){
  g.font='bold '+size+'px monospace';g.fillStyle=color;g.fillText(str,x,y);
 }
 function traffic(g,range,heading){
  let noBearing=0;
  for(const t of state.targets||[]){
   const danger=t.kind==='RA'||t.kind==='TA';
   const color=t.kind==='RA'?'#ff302e':t.kind==='TA'?amber:'#fff';
   const n=t.displayAltitude??(Number.isFinite(t.relativeAltitude)?Math.round(t.relativeAltitude/100):null);
   const tag=n===null?'':(t.displayAltitude!=null?'FL':n<0?'−':'+')+String(Math.abs(n)).padStart(t.displayAltitude!=null?3:2,'0');
   const trend=Math.abs(t.verticalRate)>500?(t.verticalRate>0?'↑':'↓'):'';
   if(!Number.isFinite(t.bearing)||!Number.isFinite(heading)){
    if(danger)label(g,t.distance.toFixed(1)+'NM/'+tag+trend,140,277+17*noBearing++,color,14);
    continue;
   }
   if(t.distance>range)continue;
   const rad=(t.bearing-heading)*Math.PI/180,r=130*t.distance/range;
   const x=201+r*Math.sin(rad),y=203-r*Math.cos(rad);
   g.save();g.translate(x,y);g.fillStyle=g.strokeStyle=color;g.lineWidth=2;g.beginPath();
   if(t.kind==='RA')g.rect(-5,-5,10,10);
   else if(t.kind==='TA')g.arc(0,0,6,0,2*Math.PI);
   else {g.moveTo(0,-7);g.lineTo(5,0);g.lineTo(0,7);g.lineTo(-5,0);g.closePath();}
   if(t.kind==='OTHER')g.stroke();else g.fill();
   label(g,tag,-12,t.relativeAltitude<0?21:-10,color,14);label(g,trend,8,5,color,16);g.restore();
  }
 }
 function paint(station,d){
  if(!scale.naturalWidth)return;
  const pref=preferences[station],g=d.g,side=station==='captain'?1:2;
  const adc=window.B737UnifiedAvionicsNetworkV1?.getSnapshot?.()?.['airdata.adc'+side];
  const motion=window.B737UnifiedFlightDisplayMotionV1?.sample?.();
  const own=window.B737UnifiedFlightScenarioV1?.getState?.()||{};
  const valid=adc?.quality==='VALID'&&!controls.failures['adc'+side];
  const vs=adc?.value?.verticalSpeedFpm??motion?.vsFpm??own.vsFpm??0;
  const full=pref.full||!!state.advisory||state.mode==='TEST';
  const show=full&&!['OFF','FAIL'].includes(state.mode);
  g.clearRect(0,0,403,403);g.drawImage(scale,0,0);
  if(show){
   g.fillStyle='#060608';g.fillRect(112,114,180,67);g.fillRect(145,236,107,36);
   label(g,'RNG '+controls.rangeNm,295,44,cyan,15);
   if(controls.filter!=='NORM')label(g,controls.filter,25,39,cyan,14);
   if(state.transponder?.absolute&&Number.isFinite(own.altitudeFt))label(g,'FL'+String(Math.round(own.altitudeFt/100)).padStart(3,'0'),25,55);
   traffic(g,controls.rangeNm,own.trueHeadingDeg);
   label(g,'✈',193,207,'white',18);
  }
  guidance(g,state.ra);
  if(valid){
   g.save();g.translate(201,203);g.rotate(angle(vs)-Math.PI);g.fillStyle=cyan;g.beginPath();
   for(const [i,[x,y]] of [[0,-4],[-99,-4],[-99,-13],[-147,0],[-99,13],[-99,4],[0,4]].entries())i?g.lineTo(x,y):g.moveTo(x,y);
   g.fill();g.restore();
  }else label(g,'VSI',310,375,amber);
  const flags={OFF:['TCAS','STBY'],FAIL:['TCAS'],TEST:['TEST'],TA_ONLY:['TA ONLY']};
  const lines=flags[state.mode]||[];
  lines.forEach((line,i)=>label(g,line,34,361+21*i,['FAIL','TEST'].includes(state.mode)?amber:cyan,21));
  if(state.advisory)label(g,state.advisory,52,327,state.advisory==='RA'?'red':amber);
  d.canvas.style.opacity=String(pref.brightness);d.knob.style.transform='rotate('+((pref.brightness-.1)*255)+'deg)';
 }
 function queue(){
  if(!displays.size||pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;displays.forEach((d,station)=>paint(station,d));});
 }
 function mount(){
  const active=localStorage.getItem('b737.ivsi.equipment')==='traffic';
  for(const station of stations){
   const entry=registration.get(registration.modeOf(document),station,'ivsi');
   const host=document.querySelector(registration.selector(entry)),previous=displays.get(station);
   if(previous&&(!active||previous.host!==host)){previous.node.remove();displays.delete(station);}
   if(!active||!host||displays.has(station))continue;
   const width=entry.radius*596/240,height=width*624/630;
   const node=part(host,'div',entry.x-width*310/630,entry.y-height*315/624,width,height,entry.width,entry.height);
   node.dataset.tcasIvsi=station;Object.assign(node.style,{zIndex:'6',background:'black url("'+url('ivsi.webp')+'") center / 100% 100% no-repeat',pointerEvents:'none'});
   const canvas=part(node,'canvas',109,112,403,403,630,624);canvas.width=canvas.height=403;canvas.style.borderRadius='9%';
   const {control,image}=hardware(node,630,624),pref=preferences[station];
   const knob=image('brightness.png',538,542,50,50),button=image('ta.png',568,175,27,52);
   control('TA SEL · full-time / popup',568,175,54,80,null,()=>{
    pref.full=!pref.full;button.animate([{filter:'brightness(.55)'},{filter:'none'}],120);queue();
   });
   control('IVSI brightness',538,542,59,60,d=>{pref.brightness=clamp(pref.brightness+d*.05,.1,1);queue();});
   displays.set(station,{host,node,canvas,knob,g:canvas.getContext('2d')});
  }
  queue();
 }
 scale.onload=queue;
 window.addEventListener('b737:tcas-state',e=>{state=e.detail;controls=api.getControls();queue();});
 for(const name of ['b737:ivsi-equipment','b737:cockpit-mounted','b737:engine-indication-view','b737:aircraft-profile-change'])
  window.addEventListener(name,()=>requestAnimationFrame(()=>requestAnimationFrame(mount)));
 window.addEventListener('b737:flight-presentation-frame',queue);
 mount();
})();
