(function(){
 'use strict';
 const model=window.B737ApuEgtNeedleModel;
 const ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./apu-egt-needle.svg?v=EGT-0002',document.baseURI).href;
 let currentAngle=model.needle.initialAngle,blade=null,frame=null,input=null,output=null;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(blade)blade.style.transform=`rotate(${currentAngle}deg)`;if(input)input.value=String(currentAngle);if(output)output.textContent=`${currentAngle}°`;}
 function setAngle(value){currentAngle=model.angle(value);paint();return currentAngle;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector('.atlas-piece[data-key="OH12"]');if(!piece)return false;
  if(host.querySelector('[data-apu-egt-needle]'))return true;
  const layer=svg(doc,host,'svg',{'data-apu-egt-needle':'apuEgt',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'APU EGT pointer'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1001',pointerEvents:'none',overflow:'hidden'});
  const assembly=svg(doc,layer,'g',{transform:`translate(${model.needle.x} ${model.needle.y}) scale(${model.needle.tipRadius/220}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g');Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
  svg(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blade=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedApuEgtNeedle';
  const title=document.createElement('h2');title.textContent='APU EGT · 1 Needle';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='عقربهٔ مستقل مطابق گیج سمت چپ APU؛ زاویه فعلاً صرفاً برای تست تصویری است.';section.append(note);
  const label=document.createElement('label');label.textContent=model.needle.label;label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'-145',max:'145',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
  input.addEventListener('input',()=>setAngle(Number(input.value)));label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به تصویر مرجع';reset.addEventListener('click',()=>setAngle(model.needle.initialAngle));section.append(reset);
  const previous=document.querySelector('#unifiedDriveAmpsNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedApuEgtNeedle=Object.freeze({getAngle:()=>currentAngle,setAngle});
 window.addEventListener('b737:apu-egt-needle-angle',event=>{try{setAngle(event.detail?.angle);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();
