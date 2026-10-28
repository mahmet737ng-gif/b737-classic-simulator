/* IRS PROCEDURE TRAINER Unified V1: additive integration.
 * Zero edits to immutable OH mosaic, 18 guards, approved ISDU segments,
 * approved SYS DSPL switch and FCOM keypad artwork.
 * Isolated L/R IRS core is source-of-truth; live motion MUST be explicitly
 * published with quality. Bench controls are visibly marked TRAINING.
 */
(function(root){
'use strict';
const Core=root.B737IRSTrainerCoreV1;
if(!Core){root.console?.error('IRS core missing');return;}
const MODES=['OFF','ALIGN','NAV','ATT'],SIDES=['L','R'];
const atlas=x=>3+x*2214/1731,alto=y=>3+y*1019/909;
let state=Core.initialState(),source='BENCH',simulatedMotion=null,selected='L',keys={lat:'',lon:'',stage:'LAT',enteredLat:false,heading:''};
let lastT=0,clock=null,frameSeq=0,notified='',lastLiveTimestamp=0,lastError='',lastCDUSource='';
let panel=null,widget=null,rightDcElapsedSec=0;
const get=(side)=>Core.status(state,side),current=()=>get(selected);
const cleanErr=e=>(e?.message||String(e)).slice(0,130);
const show=(message)=>{lastError=message||'';renderPanel();};
function electrical(){
 const e=root.B737ISNCockpitV1?.getState?.()?.electrical||
   root.B737ISNCockpitV1?.getECUState?.()?.electrical;
 const b=e?.bus;
 if(!b)return {L:null,R:null,known:false,reason:'NO_LIVE_ELECTRICAL_BUS'};
 const truth=x=>x===true?true:x===false?false:null;
 const dc=truth(b.switchedHotBattery);
 const l=truth(b.acStandby),r=truth(b.transfer2);
 return {L:l===true||l===false&&dc===true?true:l===false&&dc===false?false:null,
         R:r===true||r===false&&dc===true?true:r===false&&dc===false?false:null,
         acRight:r,dcBackup:dc,known:true,reason:'B737_ELECTRICAL_V7'};
}
function powered(side){
 if(source==='BENCH')return true;
 const live=electrical();
 if(side==='R'&&live.acRight===false&&live.dcBackup===true&&rightDcElapsedSec>=300)return false;
 return live[side]===true;
}
function syncPower(){
 for(const side of SIDES){
  const value=powered(side);
  // Unknown live source must never preserve stale BENCH power.
  if(state.units[side].powered!==value)state=Core.apply(state,{type:'POWER',side,available:value});
 }
}
function mode(side,value){
 if(!SIDES.includes(side)||!MODES.includes(value))throw RangeError('IRS mode side or position');
 syncPower();
 if(powered(side)!==true&&value!=='OFF')throw Error('IRS '+side+' NO VALID POWER');
 state=Core.apply(state,{type:'SELECT_MODE',side,mode:value});
 update();return get(side);
}
function fmcPosition(value,originPosition){
 const parsed=Core.parseFmcPosition(value);
 syncPower();
 const eligible=SIDES.filter(x=>state.units[x].powered&&['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN'].includes(state.units[x].phase));
 if(!eligible.length)throw Error('NO IRS ALIGNING — SELECT NAV OR ALIGN');
 state=Core.apply(state,{type:'FMC_SET_IRS_POS',position:positionFormat(parsed),sides:eligible,originPosition});
 lastCDUSource='FMC POS INIT LSK 4R';
 update();return {ok:true,position:parsed,sides:eligible};
}
function positionFormat(p){
 function fmt(v,deg){const sig=v<0?(deg===2?'S':'W'):(deg===2?'N':'E');
  const whole=Math.floor(Math.abs(v)),minutes=Math.round((Math.abs(v)-whole)*600)/10;
  const minutesCapped=minutes>=60?0:minutes;
  const adjust=minutes>=60?1:0;
  return sig+String(whole+adjust).padStart(deg,'0')+
    String(Math.floor(minutesCapped)).padStart(2,'0')+String(Math.round((minutesCapped%1)*10));
 }
 return fmt(p.lat,2)+' '+fmt(p.lon,3);
}
function parseParts(a,b){return Core.parseFmcPosition(a+' '+b);}
function errorCue(){
 root.B737ISDUCues?.setCue('CLR',true);
 root.B737ISDUCues?.setCue('ENT',false);
}
function isduPress(key){
 syncPower();
 if(!current().powered){show('IRS '+selected+' NO POWER');errorCue();return;}
 if(!['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','ATT'].includes(current().phase)){
  show('SELECT IRS '+selected+' ALIGN / NAV BEFORE ENTRY');errorCue();return;
 }
 if(key==='CLR'){
  keys.lat='';keys.lon='';keys.heading='';keys.stage='LAT';keys.enteredLat=false;
  root.B737ISDUCues?.setCue('ENT',false);root.B737ISDUCues?.setCue('CLR',false);show('');update();return;
 }
 if(key==='ENT'){
  try{
   if(keys.stage==='LAT'){
    if(!/^[NS]\d{5}$/.test(keys.lat))throw Error('LATITUDE REQUIRES N/S + 5 DIGITS');
    Core.parseCoordinate(keys.lat,'lat');
    state=Core.apply(state,{type:'ISDU_LAT_ENT',side:selected,value:keys.lat});
    keys.stage='LON';keys.enteredLat=true;keys.lon='';
    show('LAT ACCEPTED — ENTER E/W + LONGITUDE');
   }else{
    if(!/^[EW]\d{6}$/.test(keys.lon))throw Error('LONGITUDE REQUIRES E/W + 6 DIGITS');
    state=Core.apply(state,{type:'ISDU_LON_ENT',side:selected,value:keys.lon});
    const result=get(selected);
    show('IRS '+selected+' POSITION ACCEPTED · '+result.entrySource);
    keys={lat:'',lon:'',stage:'LAT',enteredLat:false,heading:''};
   }
   root.B737ISDUCues?.setCue('ENT',false);root.B737ISDUCues?.setCue('CLR',false);
  }catch(e){show(cleanErr(e));errorCue();}
  update();return;
 }
 if(!/^[0-9]$/.test(key))return;
 if(keys.stage==='LAT'){
  if(!keys.lat){
   if(key==='2')keys.lat='N';
   else if(key==='8')keys.lat='S';
   else {show('START WITH N/2 OR S/8');errorCue();return;}
   root.B737ISDUCues?.setCue('ENT',true);
  }else if(keys.lat.length<6)keys.lat+=key;
  else {show('LATITUDE FIELD FULL');errorCue();return;}
 }else{
  if(!keys.lon){
   if(key==='4')keys.lon='W';
   else if(key==='6')keys.lon='E';
   else{show('START WITH W/4 OR E/6');errorCue();return;}
   root.B737ISDUCues?.setCue('ENT',true);
  }else if(keys.lon.length<7)keys.lon+=key;
  else {show('LONGITUDE FIELD FULL');errorCue();return;}
 }
 root.B737ISDUCues?.setCue('CLR',false);
 update();
}
function validMotion(frame){
 const n=['gsKt','trueTrackDeg'];
 if(!frame||frame.valid!==true||!n.every(k=>Number.isFinite(frame[k]))||
    frame.gsKt<0||frame.gsKt>750||!Number.isFinite(frame.sourceTimestampMs))throw Error('VALID GS/TRK and monotonic timestamp required');
 if(frame.sourceTimestampMs<=lastLiveTimestamp)throw Error('Out of order simulator motion');
 lastLiveTimestamp=frame.sourceTimestampMs;
 simulatedMotion=Object.freeze({...frame,source:'EXTERNAL_TELEMETRY'});
 update();return true;
}
function motionFrame(){
 if(!simulatedMotion)return null;
 if(simulatedMotion.source==='EXTERNAL_TELEMETRY'&&Date.now()-simulatedMotion.sourceTimestampMs>3000)return null;
 return simulatedMotion;
}
function tick(seconds){
 if(source==='AIRCRAFT'){
  const feed=electrical();
  if(feed.acRight===false&&feed.dcBackup===true)rightDcElapsedSec+=seconds;
  else rightDcElapsedSec=0;
 }
 syncPower();
 const m=motionFrame();
 const stop=m?m.gsKt<1:true;
 // If no valid movement data, an explicitly configured BENCH ground run
 // remains parked for alignment but does NOT advance NAV position.
 const input={dtSec:seconds,stationary:stop,valid:!!m,gsKt:m?.gsKt,trueTrackDeg:m?.trueTrackDeg,
   trueHeadingDeg:m?.trueHeadingDeg,altitudeFt:m?.altitudeFt,
   windFromDeg:m?.windFromDeg,windKt:m?.windKt};
 state=Core.tick(state,input);
}
function update(){
 renderPanel();paintDisplay();
 root.dispatchEvent(new CustomEvent('b737:irs-trainer-state',{detail:snapshot()}));
}
function snapshot(){
 return {schema:'b737.irs-unified-v1',units:{L:get('L'),R:get('R')},comparison:Core.comparison(state),
   selected,source,enterStage:keys.stage,typedLat:keys.lat,typedLon:keys.lon,
   lastError,lastCDUSource,motionSource:motionFrame()?.source||'NO_VALID_MOTION',trainerOnly:true};
}
function displayValue(){
 const upper=root.B737IRSDisplaySelector?.getState?.()||
              {mode:root.B737IRSUpperSelector?.getMode?.()||'PPOS',brightness:80};
 const mode=upper.mode||'PPOS',sys=root.B737IRSSysDspl?.getSystem?.()||selected;
 if(sys!==selected){selected=sys;keys={lat:'',lon:'',stage:'LAT',enteredLat:false,heading:''};}
 const u=get(selected);
 const brightness=Math.max(0,Math.min(100,upper.brightness??80));
 let chars=' '.repeat(13),top=[],bottom=[];
 if(!u.powered||brightness===0)return {chars,top,bottom,brightness};
 if(keys.lat||keys.lon){
  const a=keys.lat?keys.lat.padEnd(6,' '):' '.repeat(6);
  const b=keys.lon?keys.lon.padEnd(7,' '):' '.repeat(7);
  return {chars:a+b,top:[],bottom:[5,12],brightness};
 }
 if(mode==='TEST')return {chars:'N88888W888888',top:[0,1,2,3],bottom:[5,12],brightness};
 if(mode==='PPOS'&&u.positionValid){
  chars=positionFormat(u.position).replace(/\s/g,'');
  bottom=[5,12];
 }else if(mode==='TK/GS'&&u.positionValid&&Number.isFinite(u.trueTrackDeg)&&Number.isFinite(u.gsKt)){
  chars=String(Math.round(u.trueTrackDeg*10)).padStart(6,' ')+String(Math.round(u.gsKt*10)).padStart(7,' ');
  bottom=[5,12];
 }else if(mode==='WIND'&&u.positionValid&&Number.isFinite(u.windFromDeg)&&Number.isFinite(u.windKt)){
  chars=String(Math.round(u.windFromDeg*10)).padStart(6,' ')+String(Math.round(u.windKt*10)).padStart(7,' ');
  bottom=[5,12];
 }else if(mode==='HDG/STS'){
  const count=Core.hdgStsCountdown(state,selected);
  const heading=Number.isFinite(u.trueHeadingDeg)?String(Math.round(u.trueHeadingDeg*10)).padStart(6,' '):' '.repeat(6);
  chars=heading+(count.visible?String(count.value).padStart(7,' '):' '.repeat(7));
  if(Number.isFinite(u.trueHeadingDeg))bottom=[5];
 }
 return {chars:chars.padEnd(13,' ').slice(0,13),top,bottom,brightness};
}
const patterns={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abfgcd',
 '-':'g',' ':'',N:'efbcnl',S:'afgcd',E:'afged',W:'w1w2w3w4',H:'fegbc'};
function paintDisplay(){
 const display=root.B737IRSSegmentDisplay?.getElement?.();
 if(!display)return;
 const show=displayValue(),cells=[...display.querySelectorAll('.irs-segment-cell')];
 if(cells.length!==13)return;
 display.style.setProperty('--irs-filament-light',String(show.brightness/100));
 display.dataset.brightness=String(show.brightness);
 display.dataset.active='true';
 for(let i=0;i<13;i++){
  const ch=show.chars[i]||' ',wanted=new Set((patterns[ch]||'').match(/w[1-4]|nl|ns|nr|[a-g]/g)||[]);
  cells[i].dataset.char=ch;
  cells[i].querySelectorAll('[data-seg]').forEach(path=>{
    path.setAttribute('data-on',String(show.brightness>0&&wanted.has(path.dataset.seg)));
  });
 }
 display.querySelectorAll('.irs-fraction-dot').forEach(node=>{
  const slot=String(node.dataset.position||'');
  const pos=slot.startsWith('top')?show.top:show.bottom;
  const ix=Number(slot.split('-')[1]);
  const index=slot.startsWith('top')?ix:ix===0?5:12;
  node.setAttribute('data-on',String(show.brightness>0&&pos.includes(index)));
 });
 display.setAttribute('aria-label','IRS '+selected+' '+(root.B737IRSDisplaySelector?.getState?.().mode||'PPOS')+' '+show.chars+' TRAINER');
}
function createLamp(parent,label){
 const l=document.createElement('span');l.className='irs-lab-lamp';l.dataset.name=label;
 l.textContent=label;parent.append(l);return l;
}
function renderPanel(){
 if(!panel)return;
 for(const side of SIDES){
  const unit=get(side);
  for(const m of MODES){
   const b=panel.querySelector('[data-msu-side="'+side+'"][data-msu-mode="'+m+'"]');
   if(b)b.setAttribute('aria-pressed',String(unit.mode===m));
  }
  for(const id of ['ON DC','ALIGN','FAULT','DC FAIL']){
   const l=panel.querySelector('[data-irs-side="'+side+'"][data-irs-lamp="'+id+'"]');
   if(l)l.dataset.lit=String(id==='ON DC'?unit.onDcLamp:id==='ALIGN'?unit.alignLamp:id==='FAULT'?unit.faultLamp:unit.phase==='POWER_LOST');
  }
  const p=panel.querySelector('[data-irs-readout="'+side+'"]');
  if(p)p.textContent=[unit.mode,unit.phase,unit.positionValid?'NAV VALID':'NAV INVALID',
   unit.alignSecondsRemaining!==null?'T−'+Math.ceil(unit.alignSecondsRemaining)+'s':''].filter(Boolean).join(' · ');
 }
 const explain=panel.querySelector('[data-irs-report]');
 if(explain){
  const delta=Core.comparison(state).separationNm;
  explain.textContent='SYS '+selected+' · '+(source==='BENCH'?'TRAINING POWER':'AIRCRAFT BUS')+
    ' · '+(delta===null?'Δ L/R N/A':'Δ L/R '+delta.toFixed(3)+' NM')+
    ' · '+(motionFrame()?'GS/TRK '+motionFrame().gsKt+' / '+motionFrame().trueTrackDeg:'NO VALID MOTION')+
    (lastError?' · '+lastError:'');
 }
 if(widget)for(const id of SIDES){
  const u=get(id);
  widget.querySelector('[data-msu-mini="'+id+'"]').dataset.phase=u.phase;
  widget.querySelector('[data-msu-mini="'+id+'"]').dataset.mode=u.mode;
  widget.querySelector('[data-msu-mini="'+id+'"]').title='IRS '+id+': '+u.mode+' '+u.phase;
  for(const [name,lit] of [['ALIGN',u.alignLamp],['ON DC',u.onDcLamp],['FAULT',u.faultLamp],['DC FAIL',u.phase==='POWER_LOST']]){
   const lamp=widget.querySelector('[data-irs-physical="'+id+'-'+name+'"]');
   if(lamp)lamp.dataset.lit=String(lit);
  }
 }
}
function mountMsu(){
 const region=document.getElementById('region-overhead');
 if(!region||region.querySelector('#irsTrainerMSU'))return;
 const box=document.createElement('div');box.id='irsTrainerMSU';box.className='irs-msu-trainer-overlay';
 for(const [side,x] of [['L',493],['R',673]]){
  const b=document.createElement('button');
  b.type='button';b.className='irs-msu-mini';b.dataset.msuMini=side;
  const size=69;b.style.left=(atlas(x)-size/2)+'px';b.style.top=(alto(668)-size/2)+'px';
  b.style.width=size+'px';b.style.height=size+'px';b.title='IRS '+side+' mode selector';
  b.setAttribute('aria-label','IRS '+side+' selector: click to advance OFF ALIGN NAV ATT; wheel or arrows to select');
  b.addEventListener('click',e=>{e.stopPropagation();const ix=MODES.indexOf(state.units[side].mode);try{mode(side,MODES[(ix+1)%4])}catch(err){show(cleanErr(err));}});
  b.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();const ix=MODES.indexOf(state.units[side].mode);try{mode(side,MODES[Math.max(0,Math.min(3,ix+(e.deltaY>0?1:-1)))])}catch(err){show(cleanErr(err));}},{passive:false});
  b.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const ix=MODES.indexOf(state.units[side].mode);mode(side,MODES[Math.max(0,Math.min(3,ix+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)))]);});
  box.append(b);
 }
 // Approved photo black wells are kept; add only illuminated lettering
 // at source-measured lamp centers, never modify original mosaic textures.
 for(const side of SIDES){
  const xs=side==='L'?[458,533]:[635,708];
  for(const [name,column,row] of [['ALIGN',0,0],['ON DC',1,0],['FAULT',0,1],['DC FAIL',1,1]]){
   const lamp=document.createElement('span');lamp.className='irs-msu-phys-lamp';
   lamp.dataset.irsPhysical=side+'-'+name;lamp.dataset.lit='false';
   lamp.textContent=name;lamp.setAttribute('aria-hidden','true');
   Object.assign(lamp.style,{left:(atlas(xs[column])-39)+'px',
      top:(alto(row===0?551:590)-17)+'px',width:'78px',height:'34px'});
   box.append(lamp);
  }
 }
 region.append(box);widget=box;
}
function buildPanel(){
 if(panel)return panel;
 panel=document.createElement('section');panel.id='irsTrainerV1';panel.className='irs-trainer-bench';panel.setAttribute('aria-label','IRS L/R PROCEDURE TRAINER');
 const h=document.createElement('h2');h.textContent='IRS L/R · PROCEDURE TRAINER';panel.append(h);
 const p=document.createElement('p');p.textContent='BENCH POWER = instructor simulation. Controls below drive the real trainer engine, not a mock navigation readout.';panel.append(p);
 const select=document.createElement('select');
 select.setAttribute('aria-label','IRS power source');select.innerHTML='<option value="BENCH">TRAINING POWER (manual demo)</option><option value="AIRCRAFT">AIRCRAFT ELECTRICAL BUSES</option>';
 select.addEventListener('change',()=>{source=select.value;syncPower();update();});panel.append(select);
 for(const side of SIDES){
  const h=document.createElement('h3');h.textContent='IRS '+side;panel.append(h);
  const row=document.createElement('div');row.className='irs-msu-mode-row';
  for(const modeName of MODES){
   const b=document.createElement('button');b.type='button';b.textContent=modeName;b.dataset.msuSide=side;b.dataset.msuMode=modeName;
   b.addEventListener('click',()=>{try{mode(side,modeName);show('')}catch(err){show(cleanErr(err))}});row.append(b);
  }
  panel.append(row);
  const lamps=document.createElement('div');lamps.className='irs-msu-lamps';
  for(const name of ['ALIGN','ON DC','FAULT','DC FAIL']){
   const lamp=createLamp(lamps,name);lamp.dataset.irsSide=side;lamp.dataset.irsLamp=name;
  }panel.append(lamps);
  const o=document.createElement('output');o.dataset.irsReadout=side;panel.append(o);
 }
 const help=document.createElement('p');help.textContent='ISDU: SYS DSPL L/R → PPOS → N/2 or S/8 + 5 digits + ENT → E/6 or W/4 + 6 digits + ENT. CDU: POS INIT, type NDDMMm EDDDMMm, press 4R.';panel.append(help);
 const m=document.createElement('div');m.className='irs-motion-controls';
 for(const [id,label,value] of [['gs','GS KT','180'],['trk','TRUE TRK','090'],['hdg','TRUE HDG','088'],['alt','ALT FT','8000']]){
  const outer=document.createElement('label');outer.textContent=label;
  const field=document.createElement('input');field.type='number';field.dataset.irsInput=id;field.value=value;outer.append(field);m.append(outer);
 }
 const setMotion=document.createElement('button');setMotion.textContent='START TRAINING MOTION';setMotion.type='button';setMotion.addEventListener('click',()=>{
  const v=key=>Number(panel.querySelector('[data-irs-input="'+key+'"]').value);
  simulatedMotion={valid:true,source:'BENCH_SIM',gsKt:v('gs'),trueTrackDeg:v('trk'),trueHeadingDeg:v('hdg'),altitudeFt:v('alt')};
  update();
 });m.append(setMotion);
 const stopMotion=document.createElement('button');stopMotion.type='button';stopMotion.textContent='STOP MOTION';stopMotion.addEventListener('click',()=>{simulatedMotion=null;update();});m.append(stopMotion);
 panel.append(m);
 const status=document.createElement('output');status.dataset.irsReport='';panel.append(status);
 const inspector=document.getElementById('inspector');
 if(inspector)inspector.prepend(panel);
 else document.body.append(panel);
 return panel;
}
function boot(){
 buildPanel();mountMsu();
 document.addEventListener('b737:irs-visual-key',event=>{
  // Take ownership of the physical keypad's already-approved DOM event before
  // the old visual-only demonstration listener receives the same event.
  if(!event.detail?.key)return;
  event.stopImmediatePropagation();
  isduPress(event.detail.key);
 },true);
 root.addEventListener('b737:irs-sys-dspl-visual-change',e=>{
   selected=e.detail?.system||'L';keys={lat:'',lon:'',stage:'LAT',enteredLat:false,heading:''};update();
 });
 for(const n of ['b737:irs-dspl-sel-change','b737:irs-upper-visual-change'])root.addEventListener(n,()=>root.setTimeout(paintDisplay,0));
 root.addEventListener('b737:cockpit-mounted',()=>{mountMsu();update();});
 // Explicit same-page simulator telemetry contract. External bridges must
 // validate source identity and provide GS/TRK and timestamp per frame.
 root.addEventListener('b737:simulator-telemetry',e=>{
  try{validMotion(e.detail)}catch(err){show('TELEMETRY REJECTED: '+cleanErr(err));}
 });
 syncPower();
 const step=()=>{
  const now=performance.now();
  const dt=lastT?Math.min(2,Math.max(0,(now-lastT)/1000)):0;
  lastT=now;
  if(dt>0.05){tick(dt);update();}
 };
 clock=root.setInterval(step,250);
 update();
}
root.B737IRSTrainerUnified=Object.freeze({
  setMode:mode,setFmcPosition:fmcPosition,pressISDU:isduPress,getState:snapshot,
  publishMotion:validMotion,setPowerMode(x){if(!['BENCH','AIRCRAFT'].includes(x))throw RangeError('Power mode');source=x;syncPower();update();},
  setBenchMotion(frame){simulatedMotion={...frame,valid:true,source:'BENCH_SIM'};update();},
  stopMotion(){simulatedMotion=null;update();},
  getPowerDiagnostics:()=>({source,electrical:electrical(),rightDcElapsedSec}),
  getCoreState:()=>JSON.parse(JSON.stringify(state)),paintDisplay
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
