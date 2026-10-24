(function(){
 'use strict';
 const model=window.B737DuctPressureNeedlesModel,ns='http://www.w3.org/2000/svg';
 const sprites=Object.fromEntries(model.needles.map(needle=>[needle.id,new URL('./'+needle.asset+'?v=CRN-0001',document.baseURI).href]));
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialPsi]));
 const blades=new Map(),inputs=new Map(),outputs=new Map();
 let frame=null;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(id){const blade=blades.get(id);if(blade)blade.style.transform=`rotate(${model.bearing(id,state[id])}deg)`;const input=inputs.get(id),output=outputs.get(id);if(input)input.value=String(state[id]);if(output)output.textContent=`${state[id]} PSI`;}
 function setPsi(id,value){state[id]=model.psi(id,value);paint(id);return state[id];}
 function setValues(values){for(const [id,value]of Object.entries(values||{}))setPsi(id,value);return {...state};}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-duct-pressure-needles]'))return true;
  const layer=svg(doc,host,'svg',{'data-duct-pressure-needles':'OH21',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Left and right duct pressure needles on a common pivot'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1005',pointerEvents:'none',overflow:'hidden'});
  // R is drawn first; L is the upper physical pointer.
  for(const needle of model.needles){
   const assembly=svg(doc,layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${needle.tipRadius/220}) translate(-256 -256)`});
   const blade=svg(doc,assembly,'g',{'data-duct-pressure-blade':needle.id});Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
   svg(doc,blade,'image',{href:sprites[needle.id],x:0,y:0,width:512,height:512});blades.set(needle.id,blade);paint(needle.id);
  }
  return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blades.clear();bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedDuctPressureNeedles';
  const title=document.createElement('h2');title.textContent='DUCT PRESSURE · L / R';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='دو نیدل با محور مشترک؛ R زیر L است. هر دو پیش‌فرض روی صفر هم‌پوشانی دارند. مقادیر فعلاً فقط تست تصویری‌اند.';section.append(note);
  for(const needle of model.needles){
   const label=document.createElement('label');label.textContent=needle.label;label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');Object.assign(input,{type:'range',min:'0',max:'100',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';input.addEventListener('input',()=>setPsi(needle.id,Number(input.value)));
   const output=document.createElement('output');output.style.display='block';output.style.direction='ltr';output.style.textAlign='left';label.append(input,output);section.append(label);inputs.set(needle.id,input);outputs.set(needle.id,output);paint(needle.id);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت هر دو به صفر';reset.addEventListener('click',()=>setValues({L:0,R:0}));section.append(reset);
  const previous=document.querySelector('#unifiedCabinTemperatureNeedle');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);
 }
 window.B737UnifiedDuctPressureNeedles=Object.freeze({getValues:()=>({...state}),setPsi,setValues});
 window.addEventListener('b737:duct-pressure-values',event=>{try{setValues(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();
