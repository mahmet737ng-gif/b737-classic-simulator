(function(){
 'use strict';
 const model=window.B737FuelTemperatureNeedleModel;
 const ns='http://www.w3.org/2000/svg';
 let frame=null;
 let temperature=model.spec.defaultCelsius,needle=null,output=null,input=null;
 const asset=new URL('./fuel-temperature-needle.svg?v=FTN-0001',document.baseURI).href;
 const svg=(doc,parent,tag,attrs={})=>{
  const el=doc.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));
  parent.append(el);return el;
 };
 function render(){
  if(needle)needle.style.transform=`rotate(${model.rotationDelta(temperature)}deg)`;
  if(input)input.value=String(temperature);
  if(output)output.textContent=`${temperature.toFixed(0)} °C`;
 }
 function setTemperature(value){temperature=model.clamp(value);render();return temperature;}
 function mount(doc,host){
  if(host.querySelector('[data-fuel-temperature-needle]'))return;
  const piece=host.querySelector('.atlas-piece[data-key="OH09"]');
  if(!piece)return;
  const p=model.placement({x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)});
  const layer=svg(doc,host,'svg',{'data-fuel-temperature-needle':'FTN-0001',viewBox:'0 0 512 512',role:'img','aria-label':'Fuel temperature pointer, independent vector overlay'});
  Object.assign(layer.style,{position:'absolute',left:`${p.x-p.size/2}px`,top:`${p.y-p.size/2}px`,width:`${p.size}px`,height:`${p.size}px`,zIndex:'1000',overflow:'visible',pointerEvents:'none',transformOrigin:'50% 50%',transition:`transform ${model.spec.durationMs}ms ease-out`});
  const defs=svg(doc,layer,'defs');
  const mask=svg(doc,defs,'mask',{id:'fuel-temperature-pivot-clearance',maskUnits:'userSpaceOnUse',x:0,y:0,width:512,height:512});
  svg(doc,mask,'rect',{x:0,y:0,width:512,height:512,fill:'#fff'});
  // The pivot disk is part of the untouched photo; the needle passes behind it.
  svg(doc,mask,'circle',{cx:256,cy:256,r:p.hubMaskRadius,fill:'#000'});
  svg(doc,layer,'image',{href:asset,width:512,height:512,x:0,y:0,mask:'url(#fuel-temperature-pivot-clearance)'});
  needle=layer;render();
 }
 function bindFrame(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  if(host.querySelector('.atlas-piece[data-key="OH09"]')){mount(doc,host);return;}
  const observer=new MutationObserver(()=>{
   if(host.querySelector('.atlas-piece[data-key="OH09"]')){observer.disconnect();mount(doc,host);}
  });
  observer.observe(host,{childList:true});
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedFuelTemperatureNeedle';
  section.innerHTML='<h2>Fuel Temperature · Needle</h2><p class="muted">نیدل سفید روی OH09؛ تصویر اصلی پنل بدون تغییر.</p><label for="fuelTemperatureNeedleInput">Fuel temperature (°C)</label><input type="range" id="fuelTemperatureNeedleInput" min="-40" max="40" step="1" value="10" style="width:100%;accent-color:#d5eaf4"><output id="fuelTemperatureNeedleOutput" dir="ltr" style="display:block;text-align:left">10 °C</output><button type="button" id="fuelTemperatureNeedleReset">Default · 10°C</button>';
  const after=document.querySelector('#unifiedFlapNeedles'),before=document.querySelector('.overhead-tools');
  if(after)after.after(section);else before.before(section);
  input=section.querySelector('input');output=section.querySelector('output');
  input.addEventListener('input',()=>setTemperature(Number(input.value)));
  section.querySelector('button').addEventListener('click',()=>setTemperature(model.spec.defaultCelsius));
  render();
 }
 window.B737UnifiedFuelTemperature=Object.freeze({getTemperature:()=>temperature,setTemperature});
 window.addEventListener('b737:fuel-temperature',event=>{
  const value=event.detail?.celsius;
  if(value!==undefined)try{setTemperature(value);}catch(error){console.error(error);}
 });
 function connectFrame(){
  const next=document.getElementById('overheadFrame');
  if(!next||next===frame)return;
  frame=next;
  frame.addEventListener('load',()=>{needle=null;bindFrame();});
  bindFrame();
 }
 window.addEventListener('b737:cockpit-mounted',connectFrame);
 connectFrame();
 if(document.querySelector('.inspector'))controls();
})();
