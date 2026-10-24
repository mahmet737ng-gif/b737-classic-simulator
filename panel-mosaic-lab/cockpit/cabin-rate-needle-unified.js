(function(){
 'use strict';
 const model=window.B737CabinRateNeedleModel,ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./'+model.needle.asset+'?v=CRN-0001',document.baseURI).href;
 let frame=null,blade=null,input=null,output=null,currentOffset=model.needle.initialOffset;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(blade)blade.style.transform=`rotate(${model.bearing(currentOffset)}deg)`;if(input)input.value=String(currentOffset);if(output)output.textContent=currentOffset===0?'ZERO · 0°':`${currentOffset>0?'+':''}${currentOffset}° from zero`;}
 function setOffset(value){currentOffset=model.offset(value);paint();return currentOffset;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-cabin-rate-needle]'))return true;
  const layer=svg(doc,host,'svg',{'data-cabin-rate-needle':'OH19',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Cabin climb rate needle, zero by default'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1003',pointerEvents:'none',overflow:'hidden'});
  const assembly=svg(doc,layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${model.needle.tipRadius/220}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g',{'data-cabin-rate-blade':''});Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
  svg(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blade=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedCabinRateNeedle';
  const title=document.createElement('h2');title.textContent='Cabin rate · CABIN CLIMB';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='نیدل مستقل گیج پایین؛ پیش‌فرض دقیقاً روی صفر است. حرکت فعلاً فقط برای تست تصویری است.';section.append(note);
  const label=document.createElement('label');label.textContent='Angle offset from ZERO';label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'-145',max:'145',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';input.addEventListener('input',()=>setOffset(Number(input.value)));
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به صفر';reset.addEventListener('click',()=>setOffset(0));section.append(reset);
  const previous=document.querySelector('#unifiedCabinDualNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedCabinRateNeedle=Object.freeze({getOffset:()=>currentOffset,setOffset});
 window.addEventListener('b737:cabin-rate-needle-offset',event=>{try{setOffset(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();
