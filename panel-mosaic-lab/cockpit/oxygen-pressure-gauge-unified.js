(function(){
 'use strict';
 const model=window.B737OxygenPressureGaugeModel,ns='http://www.w3.org/2000/svg';
 const faceUrl=new URL('./'+model.dial.faceAsset+'?v=OXG-0001',document.baseURI).href;
 const needleUrl=new URL('./'+model.dial.needleAsset+'?v=OXG-0001',document.baseURI).href;
 let frame=null,blade=null,input=null,output=null,currentPsi=model.initialPsi;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(blade)blade.style.transform=`rotate(${model.bearing(currentPsi)}deg)`;if(input)input.value=String(currentPsi);if(output)output.textContent=`${currentPsi} PSI`;}
 function setPressurePsi(value){currentPsi=model.pressurePsi(value);paint();return currentPsi;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-oxygen-pressure-gauge]'))return true;
  const layer=svg(doc,host,'svg',{'data-oxygen-pressure-gauge':'UPPER',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Crew oxygen pressure gauge, 0 to 2000 PSI'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1006',pointerEvents:'none',overflow:'hidden'});
  const size=model.dial.radius*2;
  svg(doc,layer,'image',{href:faceUrl,x:model.dial.cx-model.dial.radius,y:model.dial.cy-model.dial.radius,width:size,height:size});
  const assembly=svg(doc,layer,'g',{transform:`translate(${model.dial.cx} ${model.dial.cy}) scale(${size/512}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g',{'data-oxygen-pressure-blade':''});Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
  svg(doc,blade,'image',{href:needleUrl,x:0,y:0,width:512,height:512});paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blade=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedOxygenPressureGauge';
  const title=document.createElement('h2');title.textContent='CREW OXYGEN · PRESSURE';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='گیج و نیدل مستقل بر اساس عکس مرجع؛ مقدار ۱۲۰۰ PSI فقط پیش‌فرضِ تست تصویری است و هنوز به سیستم اکسیژن متصل نیست.';section.append(note);
  const label=document.createElement('label');label.textContent='Oxygen pressure (PSI)';label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'0',max:'2000',step:'10'});input.style.width='100%';input.style.accentColor='#f4eee2';input.addEventListener('input',()=>setPressurePsi(Number(input.value)));
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به مقدار عکس مرجع';reset.addEventListener('click',()=>setPressurePsi(model.initialPsi));section.append(reset);
  const previous=document.querySelector('#unifiedDuctPressureNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedOxygenPressureGauge=Object.freeze({getPressurePsi:()=>currentPsi,setPressurePsi});
 window.addEventListener('b737:oxygen-pressure-value',event=>{try{setPressurePsi(event.detail?.psi);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();
