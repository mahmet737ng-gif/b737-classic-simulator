(function(){
 'use strict';
 const model=window.B737DriveAmpsNeedleModel;
 const ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./drive-amps-needle.svg?v=DAN-0001',document.baseURI).href;
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialAngle]));
 const mounted=new Map(),outputs=new Map(),inputs=new Map();
 let frame=null;
 function element(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 const ampsMeter=id=>Object.prototype.hasOwnProperty.call(model.ampPhotoAngles,id);
 function paint(id){
  const blade=mounted.get(id);if(blade)blade.style.transform=`rotate(${state[id]}deg)`;
  const output=outputs.get(id),input=inputs.get(id);
  const reading=ampsMeter(id)?model.ampsForBearing(id,state[id]):null;
  if(output)output.textContent=ampsMeter(id)?
    (reading===null?'OUT OF PRINTED RANGE':reading.toFixed(1)+' A · '+state[id].toFixed(2)+'°'):
    (state[id]+'° · ANGLE QA ONLY');
  if(input)input.value=String(ampsMeter(id)?(reading===null?'':reading):state[id]);
 }
 function setAngle(id,value){if(!model.needles.some(needle=>needle.id===id))throw Error('Unknown needle '+id);state[id]=model.angle(value);paint(id);return state[id];}
 function setAmps(id,value){
  const amps=Number(value),a=model.bearingForAmps(id,amps);
  if(a===null)throw Error('AC AMPS exceeds printed 0-200A range');
  setAngle(id,a);return amps;
 }
 function getReadings(){return Object.fromEntries(Object.keys(model.ampPhotoAngles).map(id=>[id,model.ampsForBearing(id,state[id])]));}
 function setAngles(values){for(const [id,value]of Object.entries(values||{}))setAngle(id,value);return {...state};}
 function mount(doc,host){
  let complete=true;
  for(const needle of model.needles){
   if(host.querySelector(`[data-drive-amps-needle="${needle.id}"]`))continue;
   const piece=host.querySelector(`.atlas-piece[data-key="${needle.piece}"]`);
   if(!piece){complete=false;continue;}
   const source=model.panels[needle.piece];
   const layer=element(doc,host,'svg',{'data-drive-amps-needle':needle.id,viewBox:`0 0 ${source.width} ${source.height}`,preserveAspectRatio:'none',role:'img','aria-label':needle.label+' pointer'});
   Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1000',pointerEvents:'none',overflow:'hidden'});
   const defs=element(doc,layer,'defs');
   const clip=element(doc,defs,'clipPath',{id:`drive-amps-window-${needle.id}`,clipPathUnits:'userSpaceOnUse'});
   element(doc,clip,'path',{d:model.windowPath(needle)});
   const windowGroup=element(doc,layer,'g',{'clip-path':`url(#drive-amps-window-${needle.id})`});
   const assembly=element(doc,windowGroup,'g',{transform:`translate(${needle.x} ${needle.y}) scale(${needle.tipRadius/220}) translate(-256 -256)`});
   const blade=element(doc,assembly,'g');
   Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
   element(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});
   mounted.set(needle.id,blade);paint(needle.id);
  }
  return complete;
 }
 function bind(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return;
  if(mount(doc,host))return;
  const observer=new MutationObserver(()=>{if(mount(doc,host))observer.disconnect();});observer.observe(host,{childList:true});
 }
 function connect(){
  const next=document.getElementById('overheadFrame');if(!next||next===frame)return;
  frame=next;frame.addEventListener('load',()=>{mounted.clear();bind();});bind();
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedDriveAmpsNeedles';
  const title=document.createElement('h2');title.textContent='GEN DRIVE / A.C. AMPS · 5 Needles';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='A.C. AMPS 1 و 2: مقدار اسلایدر آمپر واقعی روی اسکیل چاپی (0–200 A، هر تقسیم 10 A) است؛ مرکز نیدل از تقاطع ۲۱ خط اسکیل هر گیج محاسبه شده. GEN DRIVE و APU AMPS فقط تست زاویه‌ای هستند؛ محور مکانیکی پنهان هنوز تأیید نشده است.';section.append(note);
  for(const needle of model.needles){
   const calibrated=ampsMeter(needle.id);
   const label=document.createElement('label');label.textContent=needle.label+(calibrated?' · PRINTED SCALE (A)':' · QA ANGLE ONLY (°)');label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');Object.assign(input,{type:'range',min:calibrated?'0':'-90',max:calibrated?'200':'90',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';
   const output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
   input.addEventListener('input',()=>calibrated?setAmps(needle.id,Number(input.value)):setAngle(needle.id,Number(input.value)));
   label.append(input,output);section.append(label);inputs.set(needle.id,input);outputs.set(needle.id,output);paint(needle.id);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به تصویر مرجع';
  reset.addEventListener('click',()=>{for(const needle of model.needles)setAngle(needle.id,needle.initialAngle);});section.append(reset);
  const previous=document.querySelector('#unifiedAcDcMeteringNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);
 }
 window.B737UnifiedDriveAmpsNeedles=Object.freeze({getAngles:()=>({...state}),getReadings,setAngle,setAmps,setAngles});
 window.addEventListener('b737:drive-amps-needle-angles',event=>{try{setAngles(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();
