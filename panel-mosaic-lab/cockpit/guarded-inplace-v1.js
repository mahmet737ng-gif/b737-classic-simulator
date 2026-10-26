(function(){
'use strict';
/*
 * B737 Classic native atlas guarded-switch visual replacement.
 * DO NOT MODIFY frozen images. Use the already mounted rotary-guard nodes and
 * delegate clicks to their original engine: guardAction, closePolicy, interlocks,
 * persistence and electrical integration remain authoritative.
 *
 * OWNER-APPROVED DIRECTION, INVARIANT COVER:
 * The same DOM cover, contour, material color, dimensions and texture in both
 * poses; animation rotates ONLY its fixed hinge pivot. No sprite swapping.
 */
const source=new URL(document.currentScript.src);
const relative=p=>new URL(p,source).href;
const B='../..';
const BP=relative('../../unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json');
const OWNER=relative('../../engine/maps/guarded-switch-owner-hinge-quiz-v1.json');
const LEGACY=relative('../interactive-overhead/rotary-guards.json');
const UPPER=relative('../interactive-overhead/lights-controls.json');
const VALID_HINGES=['Up','Down','Left','Right'];
const shape={
 'black-shouldered-cap':'polygon(4% 0%,96% 0%,100% 9%,100% 91%,96% 100%,4% 100%,0% 91%,0% 9%)',
 'red-tapered-long-cap':'polygon(1% 0%,99% 0%,95% 100%,5% 100%)',
 'black-vertical-oxygen':'polygon(2% 0%,98% 0%,100% 100%,0% 100%)',
 'black-vertical-exit':'polygon(2% 0%,98% 0%,100% 100%,0% 100%)',
 'black-horizontal-oxygen-rotated-90':'polygon(0% 2%,100% 0%,100% 100%,0% 98%)',
 'black-antiskid-inset':'polygon(3% 0%,97% 0%,100% 100%,0% 100%)',
 'gpws-three-identical':'polygon(3% 0%,97% 0%,100% 9%,100% 91%,97% 100%,3% 100%,0% 91%,0% 9%)'
};
const make=(tag,className)=>{const el=document.createElement(tag);el.className=className;return el;};
const assert=(b,m)=>{if(!b)throw new Error('Guard install: '+m);};
function guardedSize(node,c,legacy){
 const g=c.geometry;
 if(legacy.presentation==='flight-recorder-left-hinge'){
  const w=node.clientWidth,h=node.clientHeight;
  assert(w>5&&h>5,'flight recorder original reference socket unavailable');
  return {left:0,top:0,w,h,method:'EXACT_PRIOR_SOURCE_RECT'};
 }
 if(Array.isArray(legacy.mountingRectSource)){
  const x=Number(node.dataset.mountLeft),y=Number(node.dataset.mountTop),
   w=Number(node.dataset.mountWidth),h=Number(node.dataset.mountHeight);
  assert([x,y,w,h].every(Number.isFinite)&&w>5&&h>5,'native OH11 reference socket unavailable');
  return {left:x,top:y,w,h,method:'OWNER_MARKED_SOURCE_RECT_APPROX'};
 }
 // Legacy sourcePoint is documented, unlike the width/height. Keep the
 // pivot centered on that sourcePoint. The perimeter remains UNVERIFIED.
 const [width,height]=[g.previewWidth,g.previewHeight];
 const diam=legacy.bezelSourceDiameter;
 // Previous renderer scales source bezel into the current atlas in one axis.
 const scale=Number(node.dataset.scale);
 assert(Number.isFinite(scale)&&scale>0,'missing native atlas sprite scaling');
 const w=Math.min(diam*scale*.88,Math.max(20,diam*scale*.88));
 const h=w*(height/width);
 return {left:-w/2,top:-h/2,w,h,method:'SOURCE_CENTER_CONFIRMED_DIMENSION_UNVERIFIED'};
}
function validData(blueprint,owner,old,upper){
 assert(blueprint.controls.length===17&&owner.summary.ownerConfirmed===17,'need all 17 owner answers');
 const ownerHinge=new Map(owner.questions.map(q=>[q.controlId,q.selection]));
 assert(ownerHinge.size===17,'duplicate owner hinge');
 const original=[...old.guards,...upper.guards];
 assert(original.length===12,'12 existing Atlas guard anchors expected');
 const available=new Map(blueprint.controls.map(c=>[c.controlId,c]));
 for(const c of original){
  const bp=available.get(c.id);
  assert(bp&&VALID_HINGES.includes(bp.hingeDirection),'unregistered '+c.id);
  assert(bp.hingeDirection===ownerHinge.get(c.id),'owner hinge mismatch '+c.id);
  assert(bp.geometry.approvedDimensionsMm===null,'must not invent measured size for '+c.id);
  assert(bp.identityContract.meshRefSameOpenClosed&&bp.identityContract.materialRefSameOpenClosed&&bp.identityContract.scaleSameOpenClosed,'invariant lost '+c.id);
 }
 const pending=blueprint.controls.filter(c=>!original.some(x=>x.id===c.controlId));
 assert(pending.length===5,'missing-anchor count must be exactly five');
 return {original,available,pending};
}
function build(node,c,legacy){
 const slot=guardedSize(node,c,legacy),coverRatio=c.geometry.previewWidth/c.geometry.previewHeight;
 const horizontal=coverRatio>1.3;
 const lgW=Math.max(16,slot.w*(horizontal?.88:.73));
 const lgH=Math.max(16,slot.h*(horizontal?.82:.84));
 const root=make('div','g17-native-hardware');
 root.dataset.control=c.controlId;root.dataset.hinge=c.hingeDirection.toLowerCase();
 root.dataset.calibration=slot.method;
 root.style.left=slot.left+'px';root.style.top=slot.top+'px';
 root.style.width=slot.w+'px';root.style.height=slot.h+'px';
 root.style.setProperty('--g17-base',c.material.swatchHex);
 root.style.setProperty('--g17-radius',Math.max(2,Math.min(8,c.geometry.previewCornerRadius/c.geometry.previewWidth*lgW))+'px');
 root.style.setProperty('--g17-grip',c.switchAppearance.gripHex);
 const well=make('span','g17-native-well'),ring=make('span','g17-native-ring'),shaft=make('span','g17-native-shaft');
 const grip=make('button','g17-native-grip');grip.type='button';
 grip.setAttribute('aria-label',c.displayName+' · underlying switch');
 const pivot=make('span','g17-native-hinge-pivot');
 const lid=make('button','g17-native-cover');lid.type='button';
 const fixed=make('span','g17-native-fixed-hinge');
 const fracW=lgW/slot.w,fracH=lgH/slot.h;
 const left=(slot.w-lgW)/2,top=(slot.h-lgH)/2;
 Object.assign(pivot.style,{left:left+'px',top:top+'px',width:lgW+'px',height:lgH+'px'});
 lid.style.clipPath=shape[c.geometry.contourProfile]||'none';
 lid.style.borderRadius='var(--g17-radius)';
 lid.setAttribute('aria-label',c.displayName+' guard cover');
 if(c.controlId==='antiskid')lid.classList.add('g17-reflective-black');
 const d=legacy.states.length,idx=Math.max(0,legacy.states.indexOf(legacy.default.value));
 const legacyCover=node.querySelector('.guard-hit.guard-cover, .recorder-hinge-cover');
 const legacyLever=node.querySelector('.guard-hit.guard-lever, .recorder-hinge-lever');
 assert(legacyCover&&legacyLever,'legacy engine controls not mounted for '+c.controlId);
 lid.addEventListener('pointerdown',e=>e.stopPropagation());
 lid.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();legacyCover.click();});
 grip.addEventListener('pointerdown',e=>e.stopPropagation());
 grip.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!grip.disabled)legacyLever.click();});
 const detent=state=>{
  const i=Math.max(0,legacy.states.indexOf(state));
  const ang=d===3?(i-1)*19:i===0?-21:21;
  shaft.style.transform='translate(-50%,-50%) rotate('+ang+'deg)';
  grip.setAttribute('aria-valuenow',String(i));
  grip.setAttribute('aria-valuetext',String(state));
 };
 function sync(){
  const isOpen=node.dataset.guard==='open',val=node.dataset.value||legacy.default.value;
  root.dataset.open=String(isOpen);
  lid.setAttribute('aria-expanded',String(isOpen));
  lid.setAttribute('aria-label',c.displayName+' '+(isOpen?'Close':'Open')+' guard');
  grip.disabled=!isOpen;
  grip.setAttribute('aria-disabled',String(!isOpen));
  detent(val);
 }
 pivot.append(lid);root.append(well,ring,shaft,grip,pivot,fixed);
 node.classList.add('g17-native-upgraded');
 node.append(root);
 const observer=new MutationObserver(sync);
 observer.observe(node,{attributes:true,attributeFilter:['data-guard','data-value']});
 sync();
 return {id:c.controlId,panel:c.panelId,method:slot.method,hinge:c.hingeDirection,rect:{x:slot.left,y:slot.top,w:slot.w,h:slot.h}};
}
function marker(pending){
 const parent=document.getElementById('toggleInspector');
 if(!parent)return;
 let output=document.getElementById('g17-native-install-status');
 if(!output){output=document.createElement('div');output.id='g17-native-install-status';output.className='g17-native-install-status';parent.prepend(output);}
 output.textContent='گاردهای نصب‌شده روی نقاط مستند Overhead: ۱۲/۱۷ · پنج کنترل بدون مختصات معتبر: '+pending.map(p=>p.displayName).join('، ')+'. پیش‌نمایش همه ۱۷ مورد در Unified موجود است.';
}
async function start(){
 try{
  const requests=await Promise.all([BP,OWNER,LEGACY,UPPER].map(u=>fetch(u,{cache:'no-store'})));
  for(const r of requests)if(!r.ok)throw Error('source fetch HTTP '+r.status);
  const [blueprint,owner,legacy,upper]=await Promise.all(requests.map(r=>r.json()));
  const {original,available,pending}=validData(blueprint,owner,legacy,upper);
  let finished=false;
  const mount=()=>{
   if(finished)return;
   const nodes=new Map([...document.querySelectorAll('#rotaryGuardLayer .guard-node[data-control]')].map(n=>[n.dataset.control,n]));
   if(original.some(x=>!nodes.has(x.id)))return;
   const receipt=[];
   for(const guard of original)receipt.push(build(nodes.get(guard.id),available.get(guard.id),guard));
   finished=true;marker(pending);
   window.B737NativeGuards=Object.freeze({installed:receipt.length, pending:pending.map(p=>p.controlId),placements:receipt,
     ownerHinges:owner.questions.map(x=>({id:x.controlId,hinge:x.selection})),version:'NATIVE-G17-0001'});
   window.dispatchEvent(new CustomEvent('b737:native-guards-installed',{detail:{installed:receipt.length,pending:pending.length}}));
  };
  mount();
  if(!finished){
   const observer=new MutationObserver(()=>{mount();if(finished)observer.disconnect();});
   observer.observe(document.getElementById('atlasAbsolute'),{childList:true,subtree:true});
  }
 }catch(error){console.error(error);const el=document.getElementById('toggleInspector');if(el){const note=document.createElement('p');note.textContent='خطای نصب گاردها: '+error.message;note.setAttribute('role','alert');el.append(note);}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
