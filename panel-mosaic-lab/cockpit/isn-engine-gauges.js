(function(){
 'use strict';
 const model=window.B737ISNEngineGaugeModel,ns='http://www.w3.org/2000/svg';
 if(!model)return;
 // At initial cold-dark boot the stationary N2 spools read zero.
 // EGT must not be fabricated as zero: hot metal cools toward ambient.
 // A subsequent ISN observation always replaces this fallback.
 const initialColdDark=Object.freeze({engines:{
  engine1:{n2:{value:0},egt:{value:null}},
  engine2:{n2:{value:0},egt:{value:null}}
 }});
 let layer=null,last=initialColdDark;
 const readings=new Map(model.eisGauges.map(spec=>[spec.id,{value:null,source:'PARKED_NO_DATA'}]));
 const parts=new Map();
 const element=(parent,tag,attrs={})=>{const node=document.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);return node;
 };
 function mount(){const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');
  if(!piece)return;
  if(layer?.parentNode===piece)return;
  if(layer)layer.remove();
  parts.clear();
  const svg=element(piece,'svg',{'data-isn-engine-gauges':'EIS-SINGLE-LINE-0001',viewBox:'0 0 1235 1274',
   role:'img','aria-label':'Sixteen EIS peripheral single-line gauge pointers'});
  svg.classList.add('isn-engine-gauges');
  for(const spec of model.eisGauges){
   const group=element(svg,'g',{'data-gauge':spec.id});
   const pointer=element(group,'g',{'data-pointer':'',transform:`translate(${spec.cx} ${spec.cy}) rotate(${spec.start})`});
   element(pointer,'line',{x1:0,x2:0,y1:-(spec.radius+spec.gap),y2:-(spec.radius+spec.gap+spec.length),
    stroke:model.needle.color,'stroke-width':spec.width,'stroke-linecap':model.needle.linecap});
   const value=spec.valueText?element(group,'text',{'data-value':'',x:spec.cx,y:spec.cy+27,'text-anchor':'middle',
    fill:'#f3f3eb','font-size':'20','font-family':'ui-monospace,Consolas,monospace','font-weight':'700'}):null;
   if(value)value.textContent='—';
   parts.set(spec.id,{group,pointer,value});
  }
  layer=svg;paint();
 }
 function paint(){if(!layer)return;
  for(const spec of model.eisGauges){
   const reading=readings.get(spec.id),part=parts.get(spec.id);
   const degrees=model.eisAngle(spec,reading.value)??spec.start;
   part.pointer.setAttribute('transform',`translate(${spec.cx} ${spec.cy}) rotate(${degrees})`);
   part.group.dataset.source=reading.source;
   if(part.value)part.value.textContent=reading.value===null?'—':String(Math.round(reading.value));
  }
 }
 function setReading(engine,signal,value,source='EXPLICIT_TRAINER_OR_SOURCE'){
  const spec=model.eisGauges.find(g=>g.engine===engine&&g.signal===signal);
  if(!spec||!Number.isFinite(value))throw Error('Known EIS gauge and finite value required');
  readings.set(spec.id,{value,source});
 }
 function render(indications){last=indications||last;
  for(const spec of model.eisGauges){const value=last?.engines?.[spec.engine]?.[spec.signal]?.value;
   if(Number.isFinite(value))setReading(spec.engine,spec.signal,value,'ISN_START_SOURCE');
  }
  paint();
 }
 function observeECU(live){
  const paths={n1:'n1Percent',n2:'n2Percent',egt:'egtC',fuelFlow:'fuelFlowKgHr',
   oilPressure:'oil.pressurePsi',oilTemperature:'oil.temperatureC',
   hydPressure:'hydraulic.engineDrivenPressurePsi'};
  for(const spec of model.eisGauges){
   const path=paths[spec.signal];if(!path)continue;
   const value=path.split('.').reduce((obj,key)=>obj?.[key],live?.engines?.[spec.engine]);
   if(Number.isFinite(value))setReading(spec.engine,spec.signal,value,'UNIFIED_ECU_OBSERVATION');
  }
  mount();paint();
 }
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:isn-start-indications',event=>{render(event.detail);mount();});
 window.addEventListener('b737:unified-ecu-observation',event=>observeECU(event.detail));
 window.B737EISNeedlesV1=Object.freeze({
  getSpecs:()=>model.eisGauges.map(spec=>({...spec})),
  getReadings:()=>Object.fromEntries([...readings].map(([id,r])=>[id,{...r}])),
  setReading:(engine,signal,value)=>{setReading(engine,signal,value);paint();},mount
 });
 render(last);
 if(document.querySelector('#region-main'))mount();
})();
