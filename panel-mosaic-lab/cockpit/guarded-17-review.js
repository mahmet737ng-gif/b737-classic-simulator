(function(){
'use strict';
const ROOT='../../';
const BLUEPRINT=ROOT+'unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json';
const OWNER=ROOT+'engine/maps/guarded-switch-owner-hinge-quiz-v1.json';
const HINGES=new Set(['Up','Down','Left','Right']);
const loaded=[];
let catalog=null;
const $=id=>document.getElementById(id);
function element(tag,cls,text){
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(text!==undefined)e.textContent=text;
 return e;
}
function invariant(cond,details){if(!cond)throw new Error('Guarded-17 source validation: '+details);}
function numericTuple(g){return [g.previewWidth,g.previewHeight,g.previewThickness,g.previewCornerRadius];}
function validatedData(blueprint,owner){
 invariant(blueprint&&Array.isArray(blueprint.controls)&&blueprint.controls.length===17,'expected 17 blueprint records');
 invariant(owner&&owner.summary&&owner.summary.ownerConfirmed===17&&owner.summary.unanswered===0,'all owner answers required');
 invariant(owner.questions.length===17,'17 owner hinge responses required');
 const ids=new Set(),hinges=new Map(owner.questions.map(q=>[q.controlId,q.selection]));
 invariant(hinges.size===17,'unique owner answers required');
 for(const c of blueprint.controls){
  invariant(!ids.has(c.controlId),'duplicate control '+c.controlId);
  ids.add(c.controlId);
  invariant(HINGES.has(c.hingeDirection)&&hinges.get(c.controlId)===c.hingeDirection,'owner hinge mismatch '+c.controlId);
  invariant(c.geometry&&numericTuple(c.geometry).every(n=>Number.isFinite(n)&&n>0),'invalid cover dimensions '+c.controlId);
  invariant(c.geometry.approvedDimensionsMm===null,'real dimensions unverified '+c.controlId);
  invariant(c.material&&/^#[\da-fA-F]{6}$/.test(c.material.swatchHex),'cover paint missing '+c.controlId);
  invariant(c.switchAppearance&&Array.isArray(c.switchAppearance.detentLabels)&&c.switchAppearance.detentLabels.length>=2,'underlying switch missing '+c.controlId);
  invariant(c.identityContract&&c.identityContract.meshRefSameOpenClosed===true&&c.identityContract.materialRefSameOpenClosed===true&&c.identityContract.scaleSameOpenClosed===true,'pose identity '+c.controlId);
 }
 const bus=blueprint.controls.find(c=>c.controlId==='bus-transfer');
 const oxygen=blueprint.controls.find(c=>c.controlId==='passenger-oxygen');
 invariant(bus&&oxygen&&bus.geometry.previewWidth===oxygen.geometry.previewHeight&&bus.geometry.previewHeight===oxygen.geometry.previewWidth&&bus.hingeDirection==='Left','BUS TRANSFER is horizontal PASS OXYGEN rotated 90');
 invariant(bus.material.swatchHex===oxygen.material.swatchHex,'BUS TRANSFER base paint mismatch');
 const triplet=['gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit'].map(id=>blueprint.controls.find(c=>c.controlId===id));
 invariant(triplet.every(Boolean),'missing GPWS separate covers');
 const physical=c=>JSON.stringify([...numericTuple(c.geometry),c.geometry.contourProfile,c.material.swatchHex,c.material.metallic,c.material.roughness]);
 invariant(new Set(triplet.map(physical)).size===1,'GPWS triple covers must share shape/size/material');
 invariant(triplet.every(c=>c.hingeDirection==='Up'),'GPWS hinge mismatch');
 invariant(blueprint.controls.find(c=>c.controlId==='antiskid').material.swatchHex==='#202125','ANTISKID must remain black');
 return blueprint;
}
const profiles={
 'black-shouldered-cap':'polygon(4% 0,96% 0,100% 10%,100% 90%,96% 100%,4% 100%,0 90%,0 10%)',
 'red-tapered-long-cap':'polygon(0 0,100% 0,96% 100%,4% 100%)',
 'black-vertical-oxygen':'polygon(2% 0,98% 0,100% 100%,0 100%)',
 'black-horizontal-oxygen-rotated-90':'polygon(0 2%,100% 0,100% 100%,0 98%)',
 'black-antiskid-inset':'polygon(3% 0,97% 0,100% 100%,0 100%)',
 'black-vertical-exit':'polygon(2% 0,98% 0,100% 100%,0 100%)',
 'gpws-three-identical':'polygon(3% 0,97% 0,100% 10%,100% 90%,97% 100%,3% 100%,0 90%,0 10%)'
};
function scaleCover(g){
 const k=Math.min(146/g.previewWidth,118/g.previewHeight);
 return [Math.max(10,Math.round(g.previewWidth*k)),Math.max(10,Math.round(g.previewHeight*k))];
}
function makePose(c,opened,label){
 const outer=element('section','pose');
 const tag=element('span','pose-label',label);
 const field=element('div','panel-field');
 const g=c.geometry,mat=c.material;
 const [w,h]=scaleCover(g);
 const mountW=w+23,mountH=h+20;
 const mount=element('div','mount-root hinge-'+c.hingeDirection.toLowerCase());
 const rad=Math.min(12,Math.max(3,Math.round(g.previewCornerRadius*(w/g.previewWidth))));
 for(const [name,value] of Object.entries({
  '--mount-w':mountW+'px','--mount-h':mountH+'px','--mount-radius':(rad+4)+'px',
  '--lid-w':w+'px','--lid-h':h+'px','--lid-radius':rad+'px',
  '--cover-x':(mountW-w)/2+'px','--cover-y':(mountH-h)/2+'px','--cover-base':mat.swatchHex,
  '--grip-color':c.switchAppearance.gripHex
 }))mount.style.setProperty(name,value);
 mount.append(element('div','mount-well'));
 for(const pos of ['a','b','c','d'])mount.append(element('span','mount-screw '+pos));
 const switchAssembly=element('div','switch-assembly');
 if(c.switchAppearance.momentary)switchAssembly.classList.add('plunger');
 if(['wide-micro-toggle','slim-three-position'].includes(c.switchAppearance.family))switchAssembly.classList.add('flat');
 if(['gpws-mini-identical','mini-silver-test'].includes(c.switchAppearance.family))switchAssembly.classList.add('mini');
 switchAssembly.append(element('span','switch-ring'));
 const axis=element('div','switch-axis');
 axis.append(element('span','switch-shaft'),element('span','switch-grip'));
 switchAssembly.append(axis);
 mount.append(switchAssembly);
 const cover=element('button','guard-cover'+(opened?' open':''));
 cover.type='button';
 cover.setAttribute('aria-label',c.displayName+' '+(opened?'CLOSE':'OPEN'));
 cover.setAttribute('aria-expanded',String(opened));
 if(c.controlId==='antiskid')cover.classList.add('reflective');
 if(profiles[g.contourProfile])cover.style.clipPath=profiles[g.contourProfile];
 mount.append(cover,element('div','hinge-barrel'));
 const status=element('span','pose-state',opened?'OPEN · SWITCH REVEALED':'CLOSED · SWITCH GUARDED');
 field.append(mount);
 outer.append(tag,field,status);
 function setOpen(value){
  cover.classList.toggle('open',value);
  cover.setAttribute('aria-expanded',String(value));
  cover.setAttribute('aria-label',c.displayName+' '+(value?'CLOSE':'OPEN'));
  status.textContent=value?'OPEN · SWITCH REVEALED':'CLOSED · SWITCH GUARDED';
 }
 cover.addEventListener('click',()=>{setOpen(!cover.classList.contains('open'));outer.dispatchEvent(new CustomEvent('guard-pose-change',{bubbles:true}));});
 return {node:outer,cover,axis,setOpen,isOpen:()=>cover.classList.contains('open')};
}
function makeCard(c,i){
 const card=element('article','card');
 card.dataset.controlId=c.controlId;
 card.dataset.panel=c.panelId;
 const head=element('div','card-head');
 head.append(element('span','card-ref',c.panelId),element('h2','card-name',String(i+1).padStart(2,'0')+' · '+c.displayName));
 const meta=element('div','card-meta');
 meta.append(element('span','',c.physicalFamily),element('span','',c.hingeDirection+' HINGE · '+c.geometry.contourProfile));
 const poses=element('div','poses');
 const closed=makePose(c,false,'CLOSED'),opened=makePose(c,true,'OPEN');
 poses.append(closed.node,opened.node);
 const controls=element('div','controls');
 const switchSpec=c.switchAppearance,labels=switchSpec.detentLabels;
 const buttons=[],all=[closed,opened];
 const status=element('span','model-note','Switch state: '+switchSpec.initialState);
 let initialIndex=Math.max(0,labels.indexOf(switchSpec.initialState));
 let chosen=initialIndex,resetTimer=null;
 function setDetent(index){
  chosen=index;
  const value=labels.length===3?(index-1)*switchSpec.detentTiltDegrees:
   switchSpec.momentary?(index===0?0:switchSpec.detentTiltDegrees):
   index===0?-switchSpec.detentTiltDegrees:switchSpec.detentTiltDegrees;
  for(const pose of all)pose.axis.style.setProperty('--detent-angle',value+'deg');
  status.textContent='Switch state: '+labels[index]+(switchSpec.momentary?' · momentary':'');
  buttons.forEach((button,j)=>button.setAttribute('aria-pressed',String(j===index)));
 }
 function refreshButtons(){const open=all.some(x=>x.isOpen());buttons.forEach(b=>b.disabled=!open);}
 for(let j=0;j<labels.length;j++){
  const button=element('button','detent-button',labels[j]);
  button.type='button';
  button.addEventListener('click',()=>{
   if(!all.some(x=>x.isOpen()))return;
   if(resetTimer){clearTimeout(resetTimer);resetTimer=null;}
   setDetent(j);
   if(switchSpec.momentary&&j!==0)resetTimer=setTimeout(()=>{setDetent(0);resetTimer=null;},380);
  });
  buttons.push(button);controls.append(button);
 }
 controls.append(status);
 card.append(head,meta,poses,controls);
 const note=element('div','model-note model-warning',c.sourceMount&&c.sourceMount.sourceRectNativePx?
  'محفظهٔ مرجع: تقریبی؛ ابعاد واقعیِ قطعه تأیید نشده است.':'محل نصب/ابعاد واقعی هنوز کالیبره نشده است.');
 card.append(note);
 card.addEventListener('guard-pose-change',refreshButtons);
 setDetent(initialIndex);refreshButtons();
 function reset(){
  if(resetTimer){clearTimeout(resetTimer);resetTimer=null;}
  closed.setOpen(false);opened.setOpen(true);setDetent(initialIndex);refreshButtons();
 }
 return {card,closed,opened,reset,control:c};
}
function applyFilter(){
 const query=$('switchSearch').value.trim().toLocaleLowerCase();
 const selected=$('systemFilter').value;
 let showing=0;
 for(const entry of loaded){
  const c=entry.control;
  const matchesPanel=selected==='all'||selected===c.panelId;
  const haystack=[c.controlId,c.displayName,c.panelId,c.physicalFamily,c.hingeDirection,...c.switchAppearance.detentLabels].join(' ').toLocaleLowerCase();
  const visible=matchesPanel&&haystack.includes(query);
  entry.card.hidden=!visible;
  if(visible)showing++;
 }
 $('visibleCount').textContent=showing+' / 17 · گاردد سوئیچ موجود در Unified';
}
async function init(){
 try{
  const responses=await Promise.all([fetch(BLUEPRINT,{cache:'no-store'}),fetch(OWNER,{cache:'no-store'})]);
  for(const r of responses)if(!r.ok)throw new Error('Failed to fetch source: HTTP '+r.status);
  const parts=await Promise.all(responses.map(r=>r.json()));
  catalog=validatedData(parts[0],parts[1]);
  const panels=[...new Set(catalog.controls.map(c=>c.panelId))];
  for(const value of panels){const option=element('option','',value);option.value=value;$('systemFilter').append(option);}
  for(const [i,c] of catalog.controls.entries()){const view=makeCard(c,i);loaded.push(view);$('cards').append(view.card);}
  $('validation').textContent='۱۷ پاسخ لولا ✓ · فرم ثابت ✓ · BUS TRANSFER افقی ✓ · GPWS سه‌تایی ✓';
  applyFilter();
 }catch(e){
  $('visibleCount').textContent='خطا در بارگذاری رجیستری ۱۷ سوئیچ';
  $('validation').textContent=String(e.message);
  console.error('Guarded-17 review:',e);
 }
}
$('systemFilter').addEventListener('change',applyFilter);
$('switchSearch').addEventListener('input',applyFilter);
$('allClosed').addEventListener('click',()=>{for(const e of loaded){e.closed.setOpen(false);e.opened.setOpen(false);e.card.dispatchEvent(new CustomEvent('guard-pose-change'));}});
$('allOpened').addEventListener('click',()=>{for(const e of loaded){e.closed.setOpen(true);e.opened.setOpen(true);e.card.dispatchEvent(new CustomEvent('guard-pose-change'));}});
$('restoreStates').addEventListener('click',()=>{for(const e of loaded)e.reset();});
init();
})();
