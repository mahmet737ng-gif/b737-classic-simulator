(function(){
 'use strict';
 const model=window.B737AcDcMeteringModel;
 const ns='http://www.w3.org/2000/svg';
 const imageUrl=new URL('./ac-dc-metering-needle.svg?v=MET-0001',document.baseURI).href;
 const state=Object.fromEntries(model.meters.map(meter=>[meter.id,meter.initialAngle]));
 const mounted=new Map();
 const outputs=new Map();
 const inputs=new Map();
 let frame=null;
 const svg=(doc,parent,tag,attrs={})=>{
  const element=doc.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))element.setAttribute(key,String(value));
  parent.append(element);return element;
 };
 function paint(id){
  const blade=mounted.get(id);
  if(blade)blade.style.transform=`rotate(${state[id]}deg)`;
  const output=outputs.get(id),input=inputs.get(id);
  if(output)output.textContent=`${state[id]}°`;
  if(input)input.value=String(state[id]);
 }
 function setAngle(id,value){
  if(!model.meters.some(meter=>meter.id===id))throw Error('Unknown AC/DC meter '+id);
  state[id]=model.angle(value);paint(id);return state[id];
 }
 function setAngles(values){
  for(const [id,value]of Object.entries(values||{}))setAngle(id,value);
  return {...state};
 }
 function mount(doc,host){
  const piece=host.querySelector('.atlas-piece[data-key="OH10"]');
  if(!piece)return false;
  const box={x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  for(const meter of model.meters){
   if(host.querySelector(`[data-metering-needle="${meter.id}"]`))continue;
   const p=model.placement(box,meter);
   const layer=svg(doc,host,'svg',{'data-metering-needle':meter.id,viewBox:'0 0 512 512',role:'img','aria-label':meter.label+' pointer'});
   Object.assign(layer.style,{position:'absolute',left:`${p.x-p.size/2}px`,top:`${p.y-p.size/2}px`,width:`${p.size}px`,height:`${p.size}px`,zIndex:'1000',pointerEvents:'none',overflow:'visible'});
   const defs=svg(doc,layer,'defs');
   const clip=svg(doc,defs,'clipPath',{id:`metering-window-${meter.id}`,clipPathUnits:'userSpaceOnUse'});
   // The lower grey gauge cover stays in front; only the black upper window shows the blade.
   svg(doc,clip,'rect',{x:0,y:0,width:512,height:237});
   const windowGroup=svg(doc,layer,'g',{'clip-path':`url(#metering-window-${meter.id})`});
   const blade=svg(doc,windowGroup,'g');
   Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
   svg(doc,blade,'image',{href:imageUrl,x:0,y:0,width:512,height:512});
   mounted.set(meter.id,blade);paint(meter.id);
  }
  return true;
 }
 function bindFrame(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  if(mount(doc,host))return;
  const observer=new MutationObserver(()=>{if(mount(doc,host))observer.disconnect();});
  observer.observe(host,{childList:true});
 }
 function connectFrame(){
  const next=document.getElementById('overheadFrame');
  if(!next||next===frame)return;
  frame=next;
  frame.addEventListener('load',()=>{mounted.clear();bindFrame();});
  bindFrame();
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedAcDcMeteringNeedles';
  const title=document.createElement('h2');title.textContent='AC / DC Metering · 4 Needles';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='چهار عقربه از یک فایل مشترک؛ زاویه‌ها صرفاً برای تست تصویری مستقل‌اند.';section.append(note);
  for(const meter of model.meters){
   const label=document.createElement('label');label.textContent=meter.label;label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');Object.assign(input,{type:'range',min:'-70',max:'70',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';
   const output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
   input.addEventListener('input',()=>setAngle(meter.id,Number(input.value)));
   label.append(input,output);section.append(label);inputs.set(meter.id,input);outputs.set(meter.id,output);paint(meter.id);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به تصویر مرجع';
  reset.addEventListener('click',()=>{for(const meter of model.meters)setAngle(meter.id,meter.initialAngle);});section.append(reset);
  const previous=document.querySelector('#unifiedFuelTemperatureNeedle');
  if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);
 }
 window.B737UnifiedAcDcMetering=Object.freeze({getAngles:()=>({...state}),setAngle,setAngles});
 window.addEventListener('b737:ac-dc-metering-angles',event=>{try{setAngles(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connectFrame);
 connectFrame();
 if(document.querySelector('.inspector'))controls();
})();
