(function(win){
'use strict';
const model=win.B737UnifiedFireLampModel;
if(!model)throw Error('FIRELAMP model missing');
const unit=win.B737FireProtection?.createEngine?.({batteryBus:false,hotBatteryBus:false,acTransfer1:false,onGround:true})||null;
const faceNodes=new Map();
let lastRegistration=null;
const overrides={};
let lastPanel='',clockAt=0,clockTimer=0;
const pressed=new Set(),pointerLamps=new Map();
function releaseLamp(id){
 if(pressed.delete(id))draw();
}
function releasePointer(e){
 const id=pointerLamps.get(e.pointerId);if(!id)return;
 pointerLamps.delete(e.pointerId);
 if(![...pointerLamps.values()].includes(id))releaseLamp(id);
}
function releaseAll(){
 pointerLamps.clear();if(pressed.size){pressed.clear();draw();}
}
function bindPushTest(node,id){
 node.setAttribute('role','button');node.tabIndex=0;
 node.setAttribute('aria-label',id+' — hold to test');
 node.addEventListener('pointerdown',e=>{
  e.stopPropagation();if(e.pointerType==='mouse'&&e.button!==0)return;
  pointerLamps.set(e.pointerId,id);pressed.add(id);draw();
 });
 node.addEventListener('click',e=>e.stopPropagation());
 node.addEventListener('keydown',e=>{
  if((e.key===' '||e.key==='Enter')&&!e.repeat){
   e.preventDefault();e.stopPropagation();pressed.add(id);draw();
  }
 });
 node.addEventListener('keyup',e=>{
  if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();releaseLamp(id);}
 });
 node.addEventListener('blur',()=>releaseLamp(id));
}
let external=null, visualTest=false, attached=false, lastSystemLamps='',lampTestPower=false;
const ids=new Set(model.SLOTS.map(s=>s.id));
function systemIndications(computed=unit?.evaluate()?.indications||{}){
 const out={};
 for(const s of model.SLOTS)out[s.id]=Boolean(
  Object.prototype.hasOwnProperty.call(overrides,s.id)?overrides[s.id]:
  external&&Object.prototype.hasOwnProperty.call(external,s.id)?external[s.id]:
  computed[s.id]
 );
 return out;
}
function visualIndications(live=systemIndications()){
 const out={...live};
 for(const [id,lit] of Object.entries(unit?.evaluate()?.testLamps||{}))if(lit)out[id]=true;
 if(visualTest)for(const k of Object.keys(out))out[k]=true;
 if(lampTestPower)for(const id of pressed)out[id]=true;
 return out;
}
function draw(){
 const state=unit?.getState(),derived=unit?.evaluate();
 const live=systemIndications(derived?.indications),vals=visualIndications(live);
 for(const [id,node] of faceNodes){
  node.dataset.illuminated=String(vals[id]);
  node.dataset.pushTest=String(pressed.has(id));
 }
 const caution=derived?.indications.OVHT_DET,signature=JSON.stringify([live,caution]);
 if(signature!==lastSystemLamps){
  lastSystemLamps=signature;
  win.dispatchEvent(new CustomEvent('b737:unified-fire-indicators-state',{detail:{indications:{...live,OVHT_DET:caution},source:'FIRELAMP-0007_SYSTEM'}}));
 }
 if(state){
  const key=JSON.stringify([state.handles,state.selectors,state.test,state.extTest,state.power,state.bottles,
   derived.indications,derived.outputs,visualTest]);
  if(lastPanel!==key){
   lastPanel=key;
   win.dispatchEvent(new CustomEvent('b737:ata26-panel-state',{detail:{state,derived,visualTest}}));
   win.dispatchEvent(new CustomEvent('b737:fire-warning-state',{detail:{active:derived.indications.MASTER_FIRE_WARN,source:'ATA26'}}));
  }
 }
 return vals;
}
function attach(){
 if(attached)return true;
 const host=win.document.querySelector('#region-pedestal .texture-piece[data-piece="fire-protection"]');
 if(!host)return false;
 const base=host.querySelector(':scope > img');
 if(!base||!(base.dataset.perfSource||base.getAttribute('src')||'').includes('fire-v6/FIRE_PANEL_BARE.webp')){
  win.console.warn('FIRELAMP: fire plate asset not recognized; mounting skipped without changing other panels');
  return false;
 }
 const layer=win.document.createElement('div');
 layer.className='fire-lamps-mounted';
 layer.dataset.coordinateBase='2172x724';
 // The full-size host has the exact plate aspect ratio. Percent positioning
 // stays aligned at every zoom and when the real controls are moved to the lab.
 const hostW=parseFloat(host.style.width)||host.clientWidth;
 const hostH=parseFloat(host.style.height)||host.clientHeight;
 layer.setAttribute('aria-label','Fire protection indicator lamps');
 for(const slot of model.SLOTS){
  const node=win.document.createElement('span');node.className='fire-lamp';
  node.dataset.fireLamp=slot.id;node.dataset.kind=slot.type;
  const p=model.percent(slot);
  for(const [key,value]of Object.entries(p))node.style[key]=value;
  node.dataset.color=slot.color;
  node.dataset.version=model.version;
  for(const line of slot.lines){
   const label=win.document.createElement('span');label.textContent=line;node.append(label);
  }
  bindPushTest(node,slot.id);layer.append(node);faceNodes.set(slot.id,node);
 }
 host.append(layer);attached=true;
  win.document.addEventListener('pointerup',releasePointer,true);
  win.document.addEventListener('pointercancel',releasePointer,true);
  win.addEventListener('blur',releaseAll);
  win.document.addEventListener('visibilitychange',()=>{if(win.document.hidden)releaseAll();});
 lastRegistration={hostWidth:hostW,hostHeight:hostH,imageWidth:hostW,imageHeight:hostH,offsetX:0,offsetY:0};draw();
 win.dispatchEvent(new win.CustomEvent('b737:unified-fire-lamps-mounted',{detail:{count:model.SLOTS.length,base:model.BASE,source:model.source}}));
 return true;
}
function patch(values){
 if(!values||typeof values!=='object')throw TypeError('Indicator status object required');
 for(const [id,value] of Object.entries(values)){
  if(!ids.has(id))throw RangeError('Unknown fire indicator '+id);
  if(typeof value!=='boolean')throw TypeError('Fire indicator must be boolean '+id);
 }
 Object.assign(overrides,values);return draw();
}
function clearOverrides(){for(const key of Object.keys(overrides))delete overrides[key];return draw();}
// Run the clock only during a held discharge or a pressure indication delay.
function advanceClock(){
 if(!clockAt)return;
 const now=performance.now(),dt=Math.max(0,(now-clockAt)/1000);clockAt=now;
 if(dt)unit.dispatch({type:'TICK',seconds:Math.min(30,dt)});
}
function armClock(){
 clearTimeout(clockTimer);
 const s=unit.getState();
 const running=Object.values(s.pending).some(n=>n!==null)||Object.values(s.handles).some(h=>h.pulled&&h.angle);
 if(!running){clockAt=0;return;}
 if(!clockAt)clockAt=performance.now();
 clockTimer=setTimeout(()=>{advanceClock();draw();armClock();},100);
}
function dispatch(cmd){
 if(!unit)throw Error('Fire protection behavior core not loaded');
 advanceClock();const x=unit.dispatch(cmd);
 if(['SELECT_LOOP','PULL','ROTATE','OVERRIDE','BELL_CUTOUT','TEST','EXT_TEST'].includes(cmd.type)){
  win.dispatchEvent(new CustomEvent('b737:crew-fire-panel-command',{detail:cmd}));
 }
 if(cmd.type==='RESET')syncPower(true);
 draw();armClock();
 if(!['TEST','EXT_TEST','TICK','OVERRIDE','BELL_CUTOUT'].includes(cmd.type))
  win.dispatchEvent(new CustomEvent('b737:ata26-input-change'));
 return x;
}
function syncPower(force=false){
 if(!unit)return;
 const network=win.B737UnifiedElectricalLive?.snapshot?.(),nodes=network?.nodes;
 const failed=win.B737UnifiedBusFailureInjectionV1?.live;
 const feed=(id,bus,volts)=>nodes?.[id]?.powered===true&&!failed?.isUnavailable(bus,volts);
 // The local lamp push energizes the test filaments through the master dim/test
 // system (LAN 26-20, figures 29/30). Its supply is independent of squib continuity.
 const cb=win.B737UnifiedCB;
 const testSupply=[['BATTERY_BUS','battery','lights.masterDimBattery'],['DC_1','dc1','lights.masterDimDC1'],
  ['DC_2','dc2','lights.masterDimDC2']].some(([id,bus,circuit])=>feed(id,bus,'28VDC')&&cb?.available(circuit)!==false);
 const testPowerChanged=lampTestPower!==testSupply;lampTestPower=testSupply;
 const flight=win.B737UnifiedFlightScenarioV1;
 const onGround=flight?.getDiagnostics?.()?.active===true?flight.getState()?.airborne!==true:network?.controls?.onGround!==false;
 const power={batteryBus:feed('BATTERY_BUS','battery','28VDC'),hotBatteryBus:feed('HOT_BATTERY_BUS','hotBattery','28VDC'),
  acTransfer1:feed('TRANSFER_1','transfer1','115VAC'),onGround};
 const prior=unit.getState().power;
 if(force||testPowerChanged||Object.keys(power).some(k=>prior[k]!==power[k])){
  advanceClock();unit.dispatch({type:'SYNC_POWER',power});draw();armClock();
 }
}
for(const name of ['b737:electrical-distribution-changed','b737:electrical-owner-ready','b737:bus-failure-injection-changed','b737:flight-scenario-stopped'])
 win.addEventListener(name,()=>syncPower());
let lastAirborne=null;
win.addEventListener('b737:flight-scenario-state',e=>{
 const flag=e.detail?.airborne;if(typeof flag==='boolean'&&flag!==lastAirborne){lastAirborne=flag;syncPower();}
});
queueMicrotask(syncPower);
win.addEventListener('b737:cockpit-mounted',attach);
win.document.addEventListener('DOMContentLoaded',attach,{once:true});
win.addEventListener('load',attach,{once:true});
win.addEventListener('b737:visual-test',e=>{visualTest=Boolean(e.detail?.active);draw();});
win.addEventListener('b737:cb-state-change',()=>syncPower(true));
win.addEventListener('b737:fire-protection-state',e=>{if(e.detail?.indications&&typeof e.detail.indications==='object'){external={...e.detail.indications};draw();}});
if(win.document.readyState==='complete')attach();
win.B737UnifiedFireLights=Object.freeze({
 mount:attach,
 setIndicators:patch,
 clearOverrides,
 visualTest(active){visualTest=Boolean(active);return draw();},
 dispatch,indications:()=>Object.freeze({...visualIndications()}),
 systemIndications:()=>Object.freeze({...systemIndications()}),
 getState:()=>unit?.getState()||null,evaluate:()=>unit?.evaluate()||null,
 positions:()=>model.SLOTS.map(s=>({id:s.id,center:[s.cx,s.cy],frameBounds:model.region(s),glassBounds:model.faceRegion(s),legendPercent:model.legendPercent(s)})),
 version:()=>model.version,
 registration:()=>lastRegistration?Object.freeze({...lastRegistration}):null
});
})(window);
