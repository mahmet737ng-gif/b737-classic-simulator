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
 // Physical detail is derived from each control's own documented native
 // source-position, plus proportional PHOTO preview limits; not one giant
 // generic rectangle. Source coordinates are never treated as millimetres.
 if(legacy.presentation==='flight-recorder-left-hinge'){
  const w=node.clientWidth,h=node.clientHeight;
  assert(w>5&&h>5,'flight recorder native source window unavailable');
  return {left:0,top:0,w,h,capW:w*.90,capH:h*.80,method:'NATIVE_SOURCE_RECT_RECORDER'};
 }
 if(Array.isArray(legacy.mountingRectSource)){
  const x=Number(node.dataset.mountLeft),y=Number(node.dataset.mountTop),
   w=Number(node.dataset.mountWidth),h=Number(node.dataset.mountHeight);
  assert([x,y,w,h].every(Number.isFinite)&&w>5&&h>5,'OH11 native mounting rectangle unavailable');
  const wide=c.controlId==='standby-power';
  return {left:x,top:y,w,h,capW:w*(wide?.88:.58),capH:h*(wide?.76:.78),
    method:wide?'OWNER_MARKED_WIDE_SWITCH_SLOT':'OWNER_MARKED_GEN_RECESS__NARROW_CAP'};
 }
 const d=Number(node.dataset.scale)*261;
 assert(Number.isFinite(d)&&d>5,'guard center/source scale missing '+c.controlId);
 // Each candidate is constrained to screenshot-based native-source proportions.
 // No unmeasured individual switch can expand to the original 261x359 sprite.
 const factors={
  'flight-control-a':[.60,.90],'flight-control-b':[.60,.90],
  'spoiler-a':[.61,.86],'spoiler-b':[.61,.86],
  'alternate-flaps-master':[.47,1.02],
  'battery-master':[.68,.92],
  'emergency-exit-lights':[.59,.98],
  'passenger-oxygen':[.57,.97]
 };
 const factor=factors[c.controlId]||[.57,.90];
 const capW=d*factor[0],capH=d*factor[1];
 return {left:-capW/2,top:-capH/2,w:capW,h:capH,capW,capH,method:'NATIVE_SOURCE_CENTER__PHOTO_CONSTRAINED_PREVIEW_SIZE'};
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
 const lgW=slot.capW;
 const lgH=slot.capH;
 // Geometry is resolved before touching the legacy artwork; failures
 // preserve the last functional guard rather than partially overwriting it.
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
 const surface=c.material.swatchHex.toLowerCase().startsWith('#a3')||
  c.geometry.contourProfile==='red-tapered-long-cap'?'red':
  horizontal?'horizontal':'black';
 lid.dataset.surface=surface;
 root.dataset.surface=surface;
 const fixed=make('span','g17-native-fixed-hinge');
 // One immutable cover; surface texture never changes across open and closed.
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
 // Align physical knuckles with the actual movable cover edge, not the
 // outer recess border. The knuckles stay fixed while the cover rotates.
 const hinge=c.hingeDirection.toLowerCase();
 const hStyle={};
 if(hinge==='up'||hinge==='down'){
  hStyle.width=(lgW*.60)+'px';hStyle.height=Math.max(3,Math.min(7,lgW*.08))+'px';
  hStyle.left=(left+lgW*.20)+'px';
  hStyle[hinge==='up'?'top':'bottom']=(hinge==='up'?top-3:slot.h-top-lgH-3)+'px';
 }else{
  hStyle.width=Math.max(3,Math.min(7,lgH*.09))+'px';hStyle.height=(lgH*.60)+'px';
  hStyle.top=(top+lgH*.20)+'px';
  hStyle[hinge==='left'?'left':'right']=(hinge==='left'?left-3:slot.w-left-lgW-3)+'px';
 }
 Object.assign(fixed.style,hStyle);
 pivot.append(lid);root.append(well,ring,shaft,grip,pivot,fixed);
 node.classList.add('g17-native-upgraded');
 node.append(root);
 const observer=new MutationObserver(sync);
 observer.observe(node,{attributes:true,attributeFilter:['data-guard','data-value']});
 sync();
 return {id:c.controlId,panel:c.panelId,method:slot.method,hinge:c.hingeDirection,rect:{x:slot.left,y:slot.top,w:slot.w,h:slot.h}};
}
function marker(pending,installed){
 const parent=document.getElementById('toggleInspector');
 if(!parent)return;
 let output=document.getElementById('g17-native-install-status');
 if(!output){output=document.createElement('div');output.id='g17-native-install-status';output.className='g17-native-install-status';parent.prepend(output);}
 output.textContent='گاردهای واقعاً آماده روی Overhead: '+installed+'/۱۲ نقطهٔ موجود؛ پنج مورد نیازمند مختصات معتبر: '+pending.map(p=>p.displayName).join('، ')+'. پیش‌نمایش هر ۱۷ گارد در Unified موجود است.';
}
async function start(){
 try{
  const requests=await Promise.all([BP,OWNER,LEGACY,UPPER].map(u=>fetch(u,{cache:'no-store'})));
  for(const r of requests)if(!r.ok)throw Error('source fetch HTTP '+r.status);
  const [blueprint,owner,legacy,upper]=await Promise.all(requests.map(r=>r.json()));
  const {original,available,pending}=validData(blueprint,owner,legacy,upper);
  // Install individually: a late or missing legacy node must NOT prevent
  // correctly anchored neighbors from receiving their photo-constrained cap.
  const receipt=new Map(),failures=new Map();
  const mount=()=>{
   const nodes=new Map([...document.querySelectorAll('#rotaryGuardLayer .guard-node[data-control]')].map(n=>[n.dataset.control,n]));
   for(const guard of original){
    if(receipt.has(guard.id)||!nodes.has(guard.id))continue;
    try{
     const node=nodes.get(guard.id);
     if(node.classList.contains('g17-native-upgraded'))continue;
     const result=build(node,available.get(guard.id),guard);
     receipt.set(guard.id,result);failures.delete(guard.id);
    }catch(e){failures.set(guard.id,String(e.message));console.error('Guard surface validation',guard.id,e);}
   }
   marker(pending,receipt.size);
   window.B737NativeGuards=Object.freeze({installed:receipt.size,
    pending:pending.map(p=>p.controlId),placements:[...receipt.values()],
    mountingFailures:[...failures.entries()].map(([id,reason])=>({id,reason})),
    ownerHinges:owner.questions.map(x=>({id:x.controlId,hinge:x.selection})),
    version:'NATIVE-G17-PHOTO-V2'});
   if(receipt.size===original.length){
    window.dispatchEvent(new CustomEvent('b737:native-guards-installed',
     {detail:{installed:receipt.size,pending:pending.length}}));
    return true;
   }
   return false;
  };
  if(!mount()){
   const target=document.getElementById('atlasAbsolute');
   if(target){
    const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
    observer.observe(target,{childList:true,subtree:true});
   }
  }
 }catch(error){console.error(error);const el=document.getElementById('toggleInspector');if(el){const note=document.createElement('p');note.textContent='خطای نصب گاردها: '+error.message;note.setAttribute('role','alert');el.append(note);}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
