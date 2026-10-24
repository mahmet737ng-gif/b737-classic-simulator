(function(){
 'use strict';
 const model=window.B737AirspeedPointersModel,ns='http://www.w3.org/2000/svg';
 const assets={airspeed:new URL('./'+model.pointers.airspeed.asset+'?v=ASP-0001',document.baseURI).href,vmoMmo:new URL('./'+model.pointers.vmoMmo.asset+'?v=ASP-0001',document.baseURI).href};
 let airspeed=model.pointers.airspeed.initialKts,vmoMmo=model.pointers.vmoMmo.initialKts,airBlade=null,vmoBlade=null,airInput=null,vmoInput=null,airOutput=null,vmoOutput=null;
 function svg(parent,tag,attrs={}){const el=document.createElementNS(ns,tag);for(const [name,value]of Object.entries(attrs))el.setAttribute(name,String(value));parent.append(el);return el;}
 function paint(){
  if(airBlade)airBlade.style.transform=`rotate(${model.bearing(airspeed)}deg)`;
  if(vmoBlade)vmoBlade.style.transform=`rotate(${model.vmoBearing(vmoMmo)}deg)`;
  if(airInput)airInput.value=String(airspeed);if(vmoInput)vmoInput.value=String(vmoMmo);
  if(airOutput)airOutput.textContent=`${airspeed} KT`;if(vmoOutput)vmoOutput.textContent=`${vmoMmo} KT · visual limit`;
 }
 function setAirspeedKts(value){airspeed=model.speed(value);paint();return airspeed;}
 function setVmoMmoKts(value){vmoMmo=model.speed(value);paint();return vmoMmo;}
 function mount(){
  const piece=document.querySelector('.texture-piece[data-piece="captain"]');if(!piece)return false;
  if(piece.querySelector('[data-airspeed-pointers]'))return true;
  const layer=svg(piece,'svg',{'data-airspeed-pointers':'ASP-0001',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Independent airspeed and VMO MMO pointers'});
  Object.assign(layer.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',overflow:'hidden',zIndex:'2'});
  function pointer(def,src,id){const assembly=svg(layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${def.tipRadius/def.assetTipRadius}) translate(-512 -512)`});const blade=svg(assembly,'g',{'data-airspeed-blade':id});Object.assign(blade.style,{transformOrigin:'512px 512px',transition:'transform 320ms ease-out'});svg(blade,'image',{href:src,x:0,y:0,width:1024,height:1024});return blade;}
  vmoBlade=pointer(model.pointers.vmoMmo,assets.vmoMmo,'vmo-mmo');
  airBlade=pointer(model.pointers.airspeed,assets.airspeed,'airspeed');
  svg(layer,'circle',{cx:model.pivot.x,cy:model.pivot.y,r:26,fill:'#141511',stroke:'#33332e','stroke-width':3});paint();return true;
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedAirspeedPointers';
  const title=document.createElement('h2');title.textContent='AIRSPEED · VMO/MMO';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='دو نیدل مستقل طبق تصویر مرجع. موقعیت‌ها فعلاً برای تست تصویری‌اند؛ حد VMO/MMO هنوز از مدل پرواز دریافت نمی‌شود.';section.append(note);
  for(const item of [{name:'Airspeed (KT)',value:airspeed,set:setAirspeedKts,kind:'air'},{name:'VMO/MMO visual marker (KT)',value:vmoMmo,set:setVmoMmoKts,kind:'vmo'}]){
   const label=document.createElement('label');label.textContent=item.name;label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');Object.assign(input,{type:'range',min:'60',max:'400',step:'1',value:String(item.value)});input.style.width='100%';input.style.accentColor=item.kind==='vmo'?'#c45c56':'#f2efe8';
   const output=document.createElement('output');output.style.display='block';output.style.direction='ltr';output.style.textAlign='left';input.addEventListener('input',()=>item.set(Number(input.value)));label.append(input,output);section.append(label);
   if(item.kind==='air'){airInput=input;airOutput=output;}else{vmoInput=input;vmoOutput=output;}
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به وضعیت عکس مرجع';reset.addEventListener('click',()=>{setAirspeedKts(model.pointers.airspeed.initialKts);setVmoMmoKts(model.pointers.vmoMmo.initialKts);});section.append(reset);
  const previous=document.querySelector('#unifiedOxygenPressureGauge');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedAirspeedPointers=Object.freeze({getValues:()=>({airspeedKts:airspeed,vmoMmoKts:vmoMmo}),setAirspeedKts,setVmoMmoKts});
 window.addEventListener('b737:airspeed-pointers-values',event=>{try{if(event.detail?.airspeedKts!==undefined)setAirspeedKts(event.detail.airspeedKts);if(event.detail?.vmoMmoKts!==undefined)setVmoMmoKts(event.detail.vmoMmoKts);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',mount);mount();if(document.querySelector('.inspector'))controls();
})();
