(function(){
 'use strict';
 const model=window.B737CabinTemperatureNeedleModel,ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./'+model.needle.asset+'?v=CRN-0001',document.baseURI).href;
 let frame=null,blade=null,layer=null,assembly=null,input=null,output=null,currentTemperature=model.needle.initialTemperature;
// Owner-uploaded 737-400 source geometry (1122 × 1402); the 300/500 legacy
// OH20 strip remains calibrated to the original 1254 × 1254 artwork.
const aircon400=Object.freeze({width:1122,height:1402,pivotX:284,pivotY:268,tipRadius:158});
function syncFamily(){
  const plate=frame?.contentDocument?.querySelector('.atlas-piece[data-key="OH20"]');
  const strip=plate?.querySelector('.atlas-source-strip');
  if(!plate||!strip||!layer||!assembly)return;
  const fourHundred=window.B737AircraftProfileStore?.get()?.aircraftFamily==='B737-400';
  const source=fourHundred?aircon400:model.source;
  const pivot=fourHundred?{x:aircon400.pivotX,y:aircon400.pivotY}:model.pivot;
  layer.setAttribute('viewBox','0 0 '+source.width+' '+source.height);
  Object.assign(layer.style,fourHundred?{
    left:plate.style.left,top:plate.style.top,width:plate.style.width,height:plate.style.height
  }:{
    left:(parseFloat(plate.style.left)+parseFloat(strip.style.left))+'px',
    top:(parseFloat(plate.style.top)+parseFloat(strip.style.top))+'px',
    width:strip.style.width,height:strip.style.height
  });
  assembly.setAttribute('transform',`translate(${pivot.x} ${pivot.y}) scale(${(fourHundred?aircon400.tipRadius:model.needle.tipRadius)/220}) translate(-256 -256)`);
}
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(blade)blade.style.transform=`rotate(${model.bearing(currentTemperature)}deg)`;if(input)input.value=String(currentTemperature);if(output)output.textContent=`${currentTemperature} °C`;
 }
 function setTemperature(value){currentTemperature=model.temperature(value);paint();return currentTemperature;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-cabin-temperature-needle]'))return true;
  // OH20 artwork starts below an atlas artInset; use the actual image strip bounds.
  const strip=piece.querySelector('.atlas-source-strip');if(!strip)return false;
  layer=svg(doc,host,'svg',{'data-cabin-temperature-needle':'OH20',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Cabin temperature indicator needle'});
  Object.assign(layer.style,{position:'absolute',left:`${parseFloat(piece.style.left)+parseFloat(strip.style.left)}px`,top:`${parseFloat(piece.style.top)+parseFloat(strip.style.top)}px`,width:strip.style.width,height:strip.style.height,zIndex:'1004',pointerEvents:'none',overflow:'hidden'});
  assembly=svg(doc,layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${model.needle.tipRadius/220}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g',{'data-cabin-temperature-blade':''});Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
  svg(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});syncFamily();paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true,subtree:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blade=null;layer=null;assembly=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedCabinTemperatureNeedle';
  const title=document.createElement('h2');title.textContent='Cabin temperature · TEMP';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='همان نیدل Cabin Rate، بدون تغییر شکل؛ روی گیج دمای OH20. مقدار فعلاً برای تست تصویری است.';section.append(note);
  const label=document.createElement('label');label.textContent='Cabin temperature (°C)';label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'0',max:'100',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';input.addEventListener('input',()=>setTemperature(Number(input.value)));
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به ۲۰°C';reset.addEventListener('click',()=>setTemperature(model.needle.initialTemperature));section.append(reset);
  const previous=document.querySelector('#unifiedCabinRateNeedle');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedCabinTemperatureNeedle=Object.freeze({getTemperature:()=>currentTemperature,setTemperature});
 window.addEventListener('b737:cabin-temperature-needle-value',event=>{try{setTemperature(event.detail?.celsius);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);window.addEventListener('b737:aircraft-profile-change',syncFamily);connect();if(document.querySelector('.inspector'))controls();
})();
