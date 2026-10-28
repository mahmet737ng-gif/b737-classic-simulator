/* IRS TRAINER LIVE V1 — additive cockpit/backend bridge.
 * Locked display, lower SYS DSPL, original overhead & Owner18 are NEVER edited.
 * Instructor power and motion are explicitly labeled TEST, not real sensors.
 */
(function(root){
'use strict';
const Core=root.B737IRSTrainerCoreV1;
if(!Core){console.error('IRS trainer core missing');return;}
const SOURCE={sw:1731,sh:909,aw:2214,ah:1019,ox:3,oy:3};
const x=v=>SOURCE.ox+v*SOURCE.aw/SOURCE.sw,y=v=>SOURCE.oy+v*SOURCE.ah/SOURCE.sh;
const MODE=['OFF','ALIGN','NAV','ATT'];
const SEG={
 '0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgecd',
 '7':'abc','8':'abcdefg','9':'abfgcd','-':'g',' ':'',N:'efbcnl',S:'afgcd',
 E:'afged',W:'w1w2w3w4',H:'fegbc'
};
const DOCK=[{id:'L',cx:486,cy:659},{id:'R',cx:664,cy:659}];
const LAMPS=[{id:'L',key:'alignLamp',cx:453,cy:542,label:'ALIGN'},
 {id:'L',key:'onDcLamp',cx:527,cy:542,label:'ON DC'},
 {id:'L',key:'faultLamp',cx:453,cy:584,label:'FAULT'},
 {id:'L',key:'dcFailLamp',cx:527,cy:584,label:'DC FAIL'},
 {id:'R',key:'alignLamp',cx:626,cy:542,label:'ALIGN'},
 {id:'R',key:'onDcLamp',cx:700,cy:542,label:'ON DC'},
 {id:'R',key:'faultLamp',cx:626,cy:584,label:'FAULT'},
 {id:'R',key:'dcFailLamp',cx:700,cy:584,label:'DC FAIL'}];
let state=Core.initialState(),powerMode='INSTRUCTOR',speed=1;
let isdu={phase:'LAT_HEMISPHERE',latHem:'N',lonHem:'E',latDigits:'',lonDigits:'',latValue:null};
let telemetry=null,telemetryReceivedAt=0,manualMotion=false;
let instructorMotion={gsKt:0,trueTrackDeg:0,trueHeadingDeg:0,altitudeFt:0,windKt:0,windFromDeg:0};
let lastTick=performance.now(),lastPaint=0,message='Ready · training only',connected=false;
const controls={};
const sample=side=>Core.status(state,side),selected=()=>root.B737IRSSysDspl?.getSystem?.()||'L';
function shout(text){message=String(text);if(controls.info)controls.info.textContent=message;root.dispatchEvent(new CustomEvent('b737:irs-trainer-state',{detail:snapshot()}));}
function apply(cmd){state=Core.apply(state,cmd);paint();return state;}
function takePosition(position,source='FMC'){
 state=Core.apply(state,{type:'FMC_SET_IRS_POS',position});
 isdu={phase:'LAT_HEMISPHERE',latHem:'N',lonHem:'E',latDigits:'',lonDigits:'',latValue:null};
 shout(source+' IRS POS ACCEPTED');
 paint();
 return comparison();
}
function formatCoord(position){
 if(!position)return null;
 const form=(v,lat)=>{
  let absolute=Math.abs(v),deg=Math.floor(absolute+1e-10),min=Math.round((absolute-deg)*600);
  if(min>=600){deg++;min=0;}
  return (lat?(v<0?'S':'N'):(v<0?'W':'E'))+
   String(deg).padStart(lat?2:3,'0')+String(min).padStart(3,'0');
 };
 return [form(position.lat,true),form(position.lon,false)];
}
function rawDigits(position){const a=formatCoord(position);return a?a.map(v=>v.slice(1)):null;}
function showCharacters(values,dots=false){
 const el=document.getElementById('irsSegmentDisplayMounted');
 if(!el)return;
 const base=root.B737IRSSegmentDisplay;
 if(base?.getState?.().testActive)return;
 const groups=el.querySelectorAll('g.irs-segment-cell');
 if(groups.length!==13)return;
 const chars=Array.from(String(values).padEnd(13,' ').slice(0,13));
 const light=(base?.getState?.().brightness??82)>0;
 groups.forEach((g,i)=>{
  const c=chars[i];g.dataset.char=c;
  const active=new Set((SEG[c]||'').match(/w[1-4]|nl|ns|nr|[a-g]/g)||[]);
  g.querySelectorAll('path[data-seg]').forEach(path=>path.setAttribute('data-on',String(light&&active.has(path.dataset.seg))));
 });
 el.dataset.active='true';
 el.querySelectorAll('circle.irs-fraction-dot').forEach(n=>{
   n.setAttribute('data-on',String(light&&dots&&n.dataset.position?.startsWith('bottom')));
 });
 el.setAttribute('aria-label','IRS '+selected()+' '+(root.B737IRSDisplaySelector?.getState?.()?.mode||'PPOS')+' '+chars.join('').trim());
}
function readout(){
 const mode=root.B737IRSDisplaySelector?.getState?.()?.mode||root.B737IRSUpperSelector?.getMode?.()||'PPOS';
 const side=selected(),unit=state.units[side],s=sample(side);
 const count=Core.hdgStsCountdown(state,side);
 let str='             ',decimal=false;
 if(mode==='PPOS'){
  if(isdu.phase==='LAT_DIGITS'||isdu.phase==='LON_HEMISPHERE'||isdu.phase==='LON_DIGITS'){
   str=(isdu.latHem+isdu.latDigits.padEnd(5,' ')).slice(0,6)+
       ((isdu.phase==='LAT_DIGITS'?' ':isdu.lonHem)+isdu.lonDigits.padEnd(6,' ')).slice(0,7);
   decimal=true;
  }else{
   const pos=s.positionValid?s.position:unit.initialized?unit.enteredPosition:null;
   const fmt=formatCoord(pos);
   if(fmt){str=fmt.join('');decimal=true;}
  }
 }else if(mode==='HDG/STS'){
  const heading=Number.isFinite(s.trueHeadingDeg)?String(Math.round(s.trueHeadingDeg)%360).padStart(3,'0'):'';
  str=heading.padStart(6,' ')+(count.visible?count.text:'').padStart(7,' ');
 }else if(mode==='TK/GS'&&Number.isFinite(s.trueTrackDeg)&&Number.isFinite(s.gsKt)){
  str=String(Math.round(s.trueTrackDeg)%360).padStart(6,' ')+String(Math.round(s.gsKt)).padStart(7,' ');
 }else if(mode==='WIND'&&Number.isFinite(unit.windFromDeg)&&Number.isFinite(unit.windKt)){
  str=String(Math.round(unit.windFromDeg)%360).padStart(6,' ')+String(Math.round(unit.windKt)).padStart(7,' ');
 }
 if(mode!=='TEST')showCharacters(str,decimal);
}
function comparison(){return Core.comparison(state);}
function snapshot(){return {units:{L:sample('L'),R:sample('R')},comparison:comparison().separationNm,selected:selected(),
 powerMode,manualMotion,speed,message,entry:{...isdu},source:'PROCEDURE_QRH_TRAINER',notForNavigation:true};}
function powerAvailability(id){
 if(powerMode==='INSTRUCTOR')return true;
 const b=root.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
 if(!b)return null;
 const ac=id==='L'?b.acStandby:b.transfer2;
 const backup=b.switchedHotBattery;
 if(ac===true||backup===true)return true;
 if(ac===false&&backup===false)return false;
 return null;
}
function ensurePower(){
 for(const id of ['L','R']){
  const value=powerAvailability(id);
  if(value!==null&&state.units[id].powered!==value)apply({type:'POWER',side:id,available:value});
 }
}
function setMode(id,mode){
 if(!MODE.includes(mode)||!['L','R'].includes(id))throw Error('Invalid IRS MSU mode');
 ensurePower();
 state=Core.apply(state,{type:'SELECT_MODE',side:id,mode});
 shout(id+' IRS: '+mode);
 paint();return snapshot();
}
function onKey(k){
 const mode=root.B737IRSDisplaySelector?.getState?.()?.mode||'PPOS';
 if(mode!=='PPOS'){shout('SELECT PPOS TO ENTER IRS POSITION');return;}
 const id=selected();
 if(!state.units[id].powered||!['SELFTEST','ALIGNING','WAIT_POSITION','ALIGN_READY','HIGH_LAT_READY'].includes(state.units[id].phase)){
  shout(id+' IRS IS NOT ALIGNING');return;
 }
 if(k==='CLR'){
  isdu={phase:'LAT_HEMISPHERE',latHem:'N',lonHem:'E',latDigits:'',lonDigits:'',latValue:null};
  shout('ISDU ENTRY CLEARED');paint();return;
 }
 if(k==='ENT'){
  if(isdu.phase==='LAT_DIGITS'&&isdu.latDigits.length===5){
   try{
    const raw=isdu.latHem+isdu.latDigits;
    const n=Core.parseCoordinate(raw,'lat');
    state=Core.apply(state,{type:'ISDU_LAT_ENT',side:id,value:raw});
    isdu.latValue=n;isdu.phase='LON_HEMISPHERE';
    shout(id+' LAT ACCEPTED · ENTER E/W LONGITUDE');
   }catch(e){shout(e.message);}
  }else if(isdu.phase==='LON_DIGITS'&&isdu.lonDigits.length===6){
   try{
    const raw=isdu.lonHem+isdu.lonDigits;
    state=Core.apply(state,{type:'ISDU_LON_ENT',side:id,value:raw});
    isdu={phase:'LAT_HEMISPHERE',latHem:'N',lonHem:'E',latDigits:'',lonDigits:'',latValue:null};
    shout(id+' IRS POSITION ACCEPTED (ISDU)');
   }catch(e){shout(e.message);}
  }else shout('INVALID IRS ENTRY · COMPLETE COORDINATES');
  paint();return;
 }
 if(!/^[0-9]$/.test(k))return;
 if(isdu.phase==='LAT_HEMISPHERE'){
  if(k!=='2'&&k!=='8'){shout('PRESS N/2 OR S/8 FIRST');return;}
  isdu.latHem=k==='2'?'N':'S';isdu.phase='LAT_DIGITS';
 }else if(isdu.phase==='LAT_DIGITS')isdu.latDigits=(isdu.latDigits+k).slice(0,5);
 else if(isdu.phase==='LON_HEMISPHERE'){
  if(k!=='6'&&k!=='4'){shout('PRESS E/6 OR W/4 FIRST');return;}
  isdu.lonHem=k==='6'?'E':'W';isdu.phase='LON_DIGITS';
 }else isdu.lonDigits=(isdu.lonDigits+k).slice(0,6);
 shout(id+' '+isdu.phase+' · '+isdu.latHem+isdu.latDigits+' '+isdu.lonHem+isdu.lonDigits);
 paint();
}
function publishTelemetry(packet,observedAt=performance.now()){
 if(!packet||packet.valid!==true||!Number.isFinite(packet.gsKt)||!Number.isFinite(packet.trueTrackDeg))
  throw new TypeError('Validated GS/TRUE TRACK simulator telemetry required');
 for(const key of ['gsKt','trueTrackDeg','trueHeadingDeg','altitudeFt','windFromDeg','windKt']){
  if(packet[key]!==undefined&&!Number.isFinite(packet[key]))throw new TypeError('Nonfinite motion '+key);
 }
 telemetry={...packet};telemetryReceivedAt=observedAt;return snapshot();
}
function motionFrame(dt){
 if(manualMotion)return {...instructorMotion,dtSec:dt,stationary:instructorMotion.gsKt<0.1,valid:true};
 const fresh=telemetry&&performance.now()-telemetryReceivedAt<=3000;
 if(fresh)return {...telemetry,dtSec:dt,stationary:telemetry.gsKt<0.1,valid:true};
 return {dtSec:dt,stationary:true,valid:false};
}
function clock(){
 const now=performance.now(),realDelta=Math.max(.05,Math.min(1.0,(now-lastTick)/1000));
 lastTick=now;ensurePower();
 let remaining=realDelta*speed;
 while(remaining>0){
  const dt=Math.min(5,remaining);
  state=Core.tick(state,motionFrame(dt));remaining-=dt;
 }
 if(now-lastPaint>=300){paint();lastPaint=now;}
}
function lightValue(id,key){
 const s=sample(id);
 if(key==='dcFailLamp')return !s.powered&&state.units[id].mode!=='OFF';
 return key==='onDcLamp'?s.onDcLamp:key==='alignLamp'?s.alignLamp:s.faultLamp;
}
function addLamp(region,{id,key,cx,cy,label}){
 const b=document.createElement('span');
 b.className='irs-live-msu-lamp';
 b.dataset.side=id;b.dataset.key=key;b.textContent=label;
 Object.assign(b.style,{left:(x(cx)-46)+'px',top:(y(cy)-17)+'px',width:'92px',height:'34px'});
 region.append(b);return b;
}
function addSelector(region,{id,cx,cy}){
 const el=document.createElement('div');el.className='irs-live-msu';el.dataset.side=id;
 Object.assign(el.style,{left:(x(cx)-41)+'px',top:(y(cy)-41)+'px',width:'82px',height:'82px'});
 const b=document.createElement('button');b.className='irs-live-msu-control';b.type='button';
 b.setAttribute('aria-label','IRS '+id+' mode selector');
 const img=document.createElement('img');img.src='./assets/irs-sys-dspl-selector-approved-v1.avif';img.alt='';img.draggable=false;
 b.append(img);el.append(b);region.append(el);
 b.addEventListener('click',event=>{event.stopPropagation();try{const now=state.units[id].mode;setMode(id,MODE[(MODE.indexOf(now)+1)%4]);}catch(e){shout(e.message);}});
 b.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();
  const ix=MODE.indexOf(state.units[id].mode);try{setMode(id,MODE[Math.max(0,Math.min(3,ix+(event.deltaY>0?1:-1)))]);}catch(e){shout(e.message);}}, {passive:false});
 b.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();const ix=MODE.indexOf(state.units[id].mode);
   const k=event.key==='Home'?0:event.key==='End'?3:Math.max(0,Math.min(3,ix+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)));
   try{setMode(id,MODE[k]);}catch(e){shout(e.message);}
 }});
 return el;
}
function mountOnOverhead(){
 const region=document.getElementById('region-overhead');
 if(!region)return;
 if(!region.querySelector('#irsLiveMsuMounted')){
  const wrap=document.createElement('div');wrap.id='irsLiveMsuMounted';
  for(const location of DOCK)addSelector(wrap,location);
  for(const lamp of LAMPS)addLamp(wrap,lamp);
  region.append(wrap);
 }
}
function makePanel(){
 if(document.getElementById('irsTrainerPanel'))return;
 const nav=document.querySelector('header nav');
 if(!nav)return;
 const open=document.createElement('button');open.textContent='IRS TRAINER';open.type='button';
 open.id='irsTrainerOpen';nav.append(open);
 const panel=document.createElement('section');panel.id='irsTrainerPanel';panel.className='irs-trainer-panel';
 panel.setAttribute('aria-label','IRS TRAINER — NOT FOR NAVIGATION');
 panel.innerHTML='<div class="irs-live-head"><strong>IRS L/R · PROCEDURE TRAINER</strong><button id="irsTrainerClose" type="button">×</button></div>'+
 '<p class="irs-live-caution">TRAINING ONLY · NOT FOR NAVIGATION</p>'+
 '<label>POWER <select id="irsTrainerPower"><option value="INSTRUCTOR">INSTRUCTOR TEST POWER</option><option value="ELECTRICAL">ELECTRICAL BUS STATE (source-gated)</option></select></label>'+
 '<label>TIME <select id="irsTrainerSpeed"><option value="1">1× REALTIME</option><option value="10">10× TRAINING</option><option value="60">60× TRAINING</option></select></label>'+
 '<div class="irs-live-modes"></div><p id="irsTrainerStatus" role="status"></p>'+
 '<p class="irs-live-help">ISDU: DSPL SEL PPOS → N/2 یا S/8 → ۵ رقم → ENT → E/6 یا W/4 → ۶ رقم → ENT. FMC: POS INIT → SET IRS POS (4R).</p>'+
 '<label><input id="irsMotionEnable" type="checkbox"> INSTRUCTOR MOTION (not live sim)</label>'+
 '<div class="irs-live-motion"></div>'+
 '<p id="irsTrainerReadout" class="irs-live-readout" dir="ltr"></p>';
 document.body.append(panel);
 controls.panel=panel;controls.info=panel.querySelector('#irsTrainerStatus');
 open.addEventListener('click',()=>{panel.classList.toggle('open');});
 panel.querySelector('#irsTrainerClose').addEventListener('click',()=>panel.classList.remove('open'));
 panel.querySelector('#irsTrainerPower').addEventListener('change',e=>{powerMode=e.target.value;shout('IRS POWER MODE '+powerMode);});
 panel.querySelector('#irsTrainerSpeed').addEventListener('change',e=>{speed=Number(e.target.value);shout('TRAINING SPEED '+speed+'×');});
 for(const id of ['L','R']){
  const box=document.createElement('label');box.textContent='IRS '+id+' MSU ';
  const select=document.createElement('select');select.dataset.side=id;
  for(const m of MODE){const o=document.createElement('option');o.value=o.textContent=m;select.append(o);}
  select.addEventListener('change',e=>{try{setMode(id,e.target.value);}catch(error){shout(error.message);paint();}});
  box.append(select);panel.querySelector('.irs-live-modes').append(box);controls[id]=select;
 }
 panel.querySelector('#irsMotionEnable').addEventListener('change',e=>{manualMotion=e.target.checked;shout(manualMotion?'INSTRUCTOR MOTION ACTIVE':'MOTION SOURCE: LIVE ONLY');});
 for(const [field,title,defaultValue] of [
  ['gsKt','GS kt',0],['trueTrackDeg','TRUE TRK °',0],['trueHeadingDeg','TRUE HDG °',0],['altitudeFt','ALT ft',0],
  ['windFromDeg','WIND FROM °',0],['windKt','WIND kt',0]]){
  const label=document.createElement('label');label.textContent=title+' ';
  const input=document.createElement('input');input.type='number';input.step='any';input.value=defaultValue;
  input.addEventListener('change',()=>{const v=Number(input.value);if(Number.isFinite(v))instructorMotion[field]=v;});
  label.append(input);panel.querySelector('.irs-live-motion').append(label);
 }
}
function paint(){
 mountOnOverhead();
 const wrap=document.getElementById('irsLiveMsuMounted');
 if(wrap){
  wrap.querySelectorAll('.irs-live-msu').forEach(el=>{
   const id=el.dataset.side,m=state.units[id].mode;
   el.dataset.mode=m;el.querySelector('img').style.transform='rotate('+({OFF:-65,ALIGN:-27,NAV:21,ATT:62}[m])+'deg)';
   el.querySelector('button').setAttribute('title','IRS '+id+' '+m+' · click / wheel / arrow keys');
  });
  wrap.querySelectorAll('.irs-live-msu-lamp').forEach(el=>el.dataset.lit=String(lightValue(el.dataset.side,el.dataset.key)));
 }
 if(controls.info)controls.info.textContent=message;
 for(const id of ['L','R'])if(controls[id])controls[id].value=state.units[id].mode;
 if(controls.panel){
  const c=comparison();
  controls.panel.querySelector('#irsTrainerReadout').textContent=['L','R'].map(id=>{
   const s=sample(id),fmt=formatCoord(s.position);
   return id+' '+s.mode+' '+s.phase+' | '+(fmt?fmt.join(' '):'NO VALID POSITION')+
   (s.alignSecondsRemaining!==null?' | '+Core.hdgStsCountdown(state,id).text+' MIN':'');
  }).join('\n')+'\nL/R SEP: '+(c.separationNm===null?'—':c.separationNm.toFixed(3)+' NM')+
  '\nSOURCE: '+(manualMotion?'INSTRUCTOR':telemetry&&performance.now()-telemetryReceivedAt<3000?'LIVE':'MISSING / STALE');
 }
 readout();
}
function notifyCdu(){
 const statePacket={type:'b737:irs-trainer-cdu-state',snapshot:snapshot()};
 for(const id of ['CAPT','FO']){
  const f=document.getElementById('cduFrame'+id);
  f?.contentWindow?.postMessage(statePacket,location.origin);
 }
}
function handleCdu(event){
 const d=event.data;
 if(event.origin!==location.origin||d?.type!=='b737:irs-cdu-position-set')return;
 const seat=['CAPT','FO'].find(id=>document.getElementById('cduFrame'+id)?.contentWindow===event.source);
 if(!seat||seat!==d.seat)return;
 let ok=false,reason='';
 try{takePosition(d.position,'FMC '+seat);ok=true;}
 catch(e){reason=e.message;shout('CDU POSITION REJECTED: '+reason);}
 event.source.postMessage({type:'b737:irs-cdu-position-result',seat,ok,reason,position:d.position},event.origin);
 notifyCdu();
}
function boot(){
 makePanel();mountOnOverhead();ensurePower();
 document.addEventListener('b737:irs-visual-key',event=>{
  if(!event.target?.closest?.('#irsKeypadMounted'))return;
  event.stopImmediatePropagation();onKey(event.detail?.key);
 },true);
 root.addEventListener('b737:irs-sys-dspl-visual-change',()=>{isdu={phase:'LAT_HEMISPHERE',latHem:'N',lonHem:'E',latDigits:'',lonDigits:'',latValue:null};paint();});
 root.addEventListener('b737:irs-dspl-sel-change',paint);
 root.addEventListener('b737:irs-upper-visual-change',paint);
 root.addEventListener('b737:cockpit-mounted',()=>{mountOnOverhead();paint();});
 root.addEventListener('b737:simulator-telemetry',e=>{try{publishTelemetry(e.detail);}catch(err){shout('MOTION REJECTED: '+err.message);}});
 root.addEventListener('message',handleCdu);
 root.setInterval(clock,200);
 root.setInterval(notifyCdu,1000);
 paint();shout('IRS TRAINER READY · POWER: INSTRUCTOR TEST');
}
root.B737IRSLiveV1=Object.freeze({getState:()=>state,snapshot,setMode,apply,takePosition,
 isduKey:onKey,publishTelemetry,getReadout:readout,formatCoord,comparison,paint});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
