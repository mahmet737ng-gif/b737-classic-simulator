/* Classic stabilizer authorities, FCOM 9.20.8–9.20.9, and P8 wheel/indicator projection. */
(function(win){
'use strict';
const ticks=[[0,520],[5,564],[10,607],[15,646],[17,661]];
function limits(source,flaps=0,variant='737-300'){
 if(source==='MAIN_ELECTRIC')return [flaps>0?.25:variant==='737-300'?2.5:2.8,12.5];
 if(source==='AUTOPILOT')return [.25,14];
 return [0,17];
}
function step(current,target,[low,high]){
 // Outside an electric limit, the actuator can only move back toward its range.
 if(target>current)return Math.max(current,Math.min(target,high));
 return Math.min(current,Math.max(target,low));
}
function indexY(value){
 const end=ticks.findIndex(([n])=>n>=value);
 if(end<=0)return ticks[0][1];
 const [a,y]=ticks[end-1],[b,z]=ticks[end];return y+(z-y)*(value-a)/(b-a);
}
if(typeof module==='object'&&module.exports)module.exports={limits,step,indexY};
if(!win?.document)return;

const doc=win.document, wheels=[];
const switches={MAIN_ELECTRIC:'NORMAL',AUTOPILOT:'NORMAL'};
let units=5,layer,held=null,drive=null,flightColumn=0,override=false,report;
let animation=0,paintQueued=false;
const send=(name,detail)=>win.dispatchEvent(new CustomEvent(name,{detail}));
const flapPosition=()=>{
 const reading=win.B737FlapNeedles?.getState?.();
 return reading?Math.max(reading.left,reading.right):0;
};
const variant=()=>win.B737AircraftProfileStore?.get?.()?.aircraftModel??'737-300';
function apEngaged(){return /^(CMD|CWS)_[AB]$/.test(win.B737McpAFDSBridgeV1?.getOutput?.().modes?.autopilot||'');}
function canDrive(source,direction){
 if(held||switches[source]!=='NORMAL'||(!override&&direction*flightColumn<0))return false;
 if(source==='AUTOPILOT'&&!apEngaged())return false;
 // Available aircraft AC/DC power. Airframe-specific motor feed and CB WDM are separate.
 const bus=win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
 return (bus?.transfer1===true||bus?.transfer2===true)&&(bus?.dc1===true||bus?.dc2===true);
}
function paint(){
 paintQueued=false;
 for(const {wheel,index,rim,sign} of wheels){
  const phase=(units-5)*15*sign+(sign>0?.02:.62);
  rim.style.setProperty('--phase',String(phase-Math.floor(phase)));
  index.style.top=(indexY(units)/10)+'%';
  wheel.setAttribute('aria-valuenow',String(Math.round(units*100)/100));
  wheel.setAttribute('aria-valuetext',units.toFixed(2)+' units');
 }
 if(report){
  const flaps=flapPosition(),[low,high]=limits('MAIN_ELECTRIC',flaps,variant());
  report.textContent=`${units.toFixed(2)} UNITS · FLAPS ${flaps.toFixed(1)} · MAIN ELECT ${low}–${high} · A/P 0.25–14`;
 }
}
function set(target,source='MANUAL'){
 if(!Number.isFinite(target)||!['MANUAL','MAIN_ELECTRIC','AUTOPILOT'].includes(source))return false;
 if(source!=='MANUAL'&&!canDrive(source,Math.sign(target-units)))return false;
 const next=step(units,target,limits(source,flapPosition(),variant()));
 if(next===units)return true;
 units=next;
 if(!paintQueued){paintQueued=true;win.requestAnimationFrame(paint);}
 send('b737:stabilizer-trim-position',{units,source});
 return true;
}
function stopDrive(){
 drive=null;
 if(animation){win.cancelAnimationFrame(animation);animation=0;}
}
function beginDrive(source,direction,target=direction>0?17:0){
 if(!canDrive(source,direction))return false;
 stopDrive();
 if(source==='MAIN_ELECTRIC')send('b737:pilot-trim-command',{confirmed:true,source:'COCKPIT_HARDWARE'});
 drive={source,direction,target,last:win.performance.now()};
 function tick(now){
  if(!drive)return;
  const {source,direction,target,last}=drive,dt=Math.min(.1,Math.max(0,(now-last)/1000));
  drive.last=now;
  // LAN 27-40 speed ratios. Absolute rates are simulator calibration.
  const down=flapPosition()>0,rate=source==='MAIN_ELECTRIC'?(down?.45:.15):(down?.15:.075);
  const next=direction>0?Math.min(target,units+rate*dt):Math.max(target,units-rate*dt);
  const before=units;
  if(!set(next,source)||(dt>0&&units===before)||units===target){stopDrive();return;}
  animation=win.requestAnimationFrame(tick);
 }
 animation=win.requestAnimationFrame(tick);
 return true;
}
function mountCutouts(plate){
 for(const [source,x,label] of [['MAIN_ELECTRIC',570,'MAIN ELECT'],['AUTOPILOT',663,'AUTOPILOT']]){
  const el=doc.createElement('button');
  el.type='button';el.className='pedestal-trim-cutout';el.style.left=x/8+'%';
  el.setAttribute('aria-label','Stabilizer trim '+label+' cutout');
  el.setAttribute('aria-pressed','false');
  el.onpointerdown=e=>e.stopPropagation();
  el.onclick=e=>{
   e.stopPropagation();
   const position=switches[source]==='NORMAL'?'CUTOUT':'NORMAL';
   switches[source]=position;el.dataset.position=position;
   el.setAttribute('aria-pressed',String(position==='CUTOUT'));
   if(drive?.source===source)stopDrive();
   if(source==='AUTOPILOT')send('b737:stab-trim-autopilot-cutout',{confirmed:true,position});
  };
  plate.append(el);
 }
}
function mountControls(){
 const parent=doc.getElementById('unifiedControlCenter');if(!parent)return;
 const detail=doc.createElement('details');detail.className='stab-trim-controls';
 const title=doc.createElement('summary');title.textContent='Stabilizer Trim';detail.append(title);
 report=doc.createElement('output');detail.append(report);
 for(const [source,title] of [['MAIN_ELECTRIC','MAIN ELECT'],['AUTOPILOT','A/P TEST']]){
  for(const [direction,label] of [[-1,'NOSE DOWN'],[1,'NOSE UP']]){
   const input=doc.createElement('button');input.type='button';input.textContent=title+' '+label;
   input.onpointerdown=e=>{if(e.button===0){input.setPointerCapture(e.pointerId);beginDrive(source,direction);}};
   input.onpointerup=input.onpointercancel=input.onlostpointercapture=input.onblur=stopDrive;
   input.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)beginDrive(source,direction);}};
   input.onkeyup=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();stopDrive();}};
   detail.append(input);
  }
 }
 parent.append(detail);
}
function mount(){
 if(layer)return;
 const plate=doc.querySelector('#region-pedestal [data-piece="throttle-quadrant"]');if(!plate)return;
 layer=doc.createElement('div');layer.className='pedestal-trim-layer';
 for(const [side,sign] of [['CAPT',1],['FO',-1]]){
  const wheel=doc.createElement('div'),rim=doc.createElement('div'),tread=doc.createElement('img'),index=new Image();
  wheel.className='pedestal-trim-wheel';wheel.dataset.side=side;wheel.setAttribute('role','slider');wheel.tabIndex=0;
  wheel.setAttribute('aria-label',side+' manual stabilizer trim wheel');wheel.setAttribute('aria-valuemin','0');wheel.setAttribute('aria-valuemax','17');wheel.setAttribute('aria-orientation','vertical');
  rim.className='pedestal-trim-plane';tread.src='./assets/pedestal-hardware/trim-wheel.webp?v=2';tread.alt='';tread.draggable=false;
  index.src='./assets/pedestal-hardware/trim-index.webp?v=2';index.className='pedestal-trim-index';index.dataset.side=side;index.alt='';index.draggable=false;
  rim.append(tread);wheel.append(rim);layer.append(wheel,index);wheels.push({wheel,index,rim,sign});
  wheel.onpointerdown=e=>{
   if(held||e.button!==0)return;e.preventDefault();e.stopPropagation();stopDrive();
   held={wheel,id:e.pointerId,y:e.clientY,at:e.timeStamp,height:Math.max(1,wheel.getBoundingClientRect().height)};
   wheel.setPointerCapture(e.pointerId);
  };
  wheel.onpointermove=e=>{
   if(held?.wheel!==wheel||held.id!==e.pointerId)return;
   e.preventDefault();e.stopPropagation();
   const distance=(e.clientY-held.y)/held.height,dt=Math.max(8,e.timeStamp-held.at);
   const gain=1+Math.min(5,Math.abs(distance)*200/dt);
   set(units+distance*gain);
   held.y=e.clientY;held.at=e.timeStamp;
  };
  wheel.onlostpointercapture=wheel.onpointercancel=wheel.onpointerup=e=>{if(held?.id===e.pointerId)held=null;};
  wheel.addEventListener('wheel',e=>{
   e.preventDefault();e.stopPropagation();stopDrive();
   const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?240:1);
   set(units+Math.sign(pixels)*Math.min(1.2,Math.abs(pixels)/145));
  },{passive:false});
  wheel.onkeydown=e=>{
   const delta={ArrowDown:.1,ArrowUp:-.1,PageDown:1,PageUp:-1,Home:-17,End:17}[e.key];
   if(delta===undefined)return;e.preventDefault();e.stopPropagation();stopDrive();set(units+delta);
  };
 }
 mountCutouts(layer);plate.append(layer);mountControls();paint();
}
win.addEventListener('blur',()=>{held=null;stopDrive();});
win.addEventListener('b737:trailing-flaps',()=>{if(report)paint();});
win.addEventListener('b737:stabilizer-trim-drive',e=>{
 const data=e.detail;
 if(!data?.confirmed||!Number.isFinite(data.units)||!['MAIN_ELECTRIC','AUTOPILOT'].includes(data.source))return;
 const target=step(units,data.units,limits(data.source,flapPosition(),variant()));
 if(target!==units)beginDrive(data.source,Math.sign(target-units),target);
});
win.addEventListener('b737:stabilizer-column',e=>{
 if(!e.detail?.confirmed)return;
 flightColumn=Math.sign(e.detail.direction)||0;override=e.detail.override===true;
});
win.B737StabilizerTrim=Object.freeze({get:()=>units,set,
 limits:source=>limits(source,flapPosition(),variant()),getCutouts:()=>({...switches})});
win.addEventListener('b737:cockpit-mounted',mount);queueMicrotask(mount);
})(typeof window==='object'?window:null);
