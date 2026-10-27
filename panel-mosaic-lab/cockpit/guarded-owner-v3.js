(function(){
'use strict';
/* Owner-approved four photographic guards, replacement for the native 13 guard surfaces.
   Do not touch locked atlas artwork, existing rotary/toggle engine, electrical rules or snapshots. */
const scriptURL=new URL(document.currentScript.src);
const url=p=>new URL(p,scriptURL).href;
const paths={
 red:{closed:'./guard-owner-v3/red-closed.webp',open:'./guard-owner-v3/red-open.webp'},
 black:{closed:'./guard-owner-v3/black-closed.webp',open:'./guard-owner-v3/black-open.webp'},
 silver:'../../shared-assets/toggle-switch-small/Small_Silver_5Positions.webp'
};
const resolved={red:{closed:url(paths.red.closed),open:url(paths.red.open)},black:{closed:url(paths.black.closed),open:url(paths.black.open)},silver:url(paths.silver)};
const BP=url('../../unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json');
const OWNER=url('../../engine/maps/guarded-switch-owner-hinge-quiz-v1.json');
const BASE=url('../interactive-overhead/rotary-guards.json');
const UPPER=url('../interactive-overhead/lights-controls.json');
const names=new Map();
const mounted=new Map(),errors=new Map();
function assert(ok,msg){if(!ok)throw Error('GUARD-OWNER-V3: '+msg);}
function element(name,className){const e=document.createElement(name);e.className=className;return e;}
function dimensions(node,c,legacy){
  // Every geometry value is in the already positioned native mosaic coordinate system.
  // A marked recess is preferred to all old generic knob diameters.
  if(legacy.presentation==='flight-recorder-left-hinge'){
    const w=node.clientWidth,h=node.clientHeight;
    assert(w>3&&h>3,'Flight Recorder mounting frame unavailable');
    return {left:0,top:0,w,h,source:'UPPER_RECORDER_SOURCE_RECT'};
  }
  if(legacy.mountingRectSource){
    const x=Number(node.dataset.mountLeft),y=Number(node.dataset.mountTop);
    const w=Number(node.dataset.mountWidth),h=Number(node.dataset.mountHeight);
    assert([x,y,w,h].every(Number.isFinite)&&w>3&&h>3,'source-native recess not projected: '+c.controlId);
    return {left:x,top:y,w,h,source:c.controlId==='bus-transfer'?'OH12_OWNER_SCREENSHOT_ESTIMATE':'OWNER_MARKED_SOURCE_RECT'};
  }
  const d=Number(node.dataset.scale)*261;
  assert(Number.isFinite(d)&&d>4,'native diameter unavailable '+c.controlId);
  const factors={
    'flight-control-a':[.60,.90],'flight-control-b':[.60,.90],
    'spoiler-a':[.61,.86],'spoiler-b':[.61,.86],
    'alternate-flaps-master':[.47,1.02],
    'battery-master':[.68,.92],
    'emergency-exit-lights':[.59,.98],
    'passenger-oxygen':[.57,.97]
  };
  const f=factors[c.controlId]||[.57,.90],w=d*f[0],h=d*f[1];
  return {left:-w/2,top:-h/2,w,h,source:'SOURCE_CENTER_APPROXIMATE_CAP'};
}
function add(node,c,legacy){
  assert(node instanceof HTMLElement,'missing native guard node');
  assert(!node.classList.contains('g17-owner-upgraded'),'already upgraded '+c.controlId);
  const l=dimensions(node,c,legacy);
  const hinge=c.hingeDirection.toLowerCase();
  assert(['up','down','left'].includes(hinge),'invalid owner hinge '+c.controlId);
  const color=legacy.color==='red'||c.material.swatchHex.toLowerCase()==='#a32123'?'red':'black';
  const base=element('div','g17-owner-hardware');
  base.dataset.control=c.controlId;base.dataset.hinge=hinge;base.dataset.color=color;
  base.dataset.source=l.source;
  Object.assign(base.style,{left:l.left+'px',top:l.top+'px',width:l.w+'px',height:l.h+'px'});
  const plane=element('div','g17-owner-plane'); // pivot and orientation are fixed across both image states
  plane.style.width=(hinge==='left'?l.h:l.w)+'px';
  plane.style.height=(hinge==='left'?l.w:l.h)+'px';
  const lid=element('img','g17-owner-image');
  lid.alt='';lid.draggable=false;lid.decoding='async';
  lid.src=resolved[color].closed;plane.append(lid);
  const cover=element('button','g17-owner-cover-hit');cover.type='button';
  cover.setAttribute('aria-label',c.displayName+' guarded cover, toggle open or closed');
  const actuator=element('button','g17-owner-silver-hit');
  actuator.type='button';actuator.setAttribute('aria-label',c.displayName+' Small Silver switch');
  const sprite=element('span','g17-owner-silver-sprite');
  sprite.setAttribute('aria-hidden','true');actuator.append(sprite);
  const originalCover=node.querySelector('.guard-hit.guard-cover, .recorder-hinge-cover');
  const originalSwitch=node.querySelector('.guard-hit.guard-lever, .recorder-hinge-lever');
  assert(originalCover&&originalSwitch,'legacy event delegates not found '+c.controlId);
  assert([2,3].includes(legacy.states.length),'unsupported detent count '+c.controlId);
  cover.addEventListener('pointerdown',e=>e.stopPropagation());
  actuator.addEventListener('pointerdown',e=>e.stopPropagation());
  cover.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();originalCover.click();
    queueMicrotask(sync);
  });
  actuator.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(actuator.disabled)return;
    // Delegate back to certified source engine: retains 2/3 stops, guards, interlocks and persistence.
    originalSwitch.click();queueMicrotask(sync);
  });
  function sync(){
    const open=node.dataset.guard==='open';
    const state=legacy.states.indexOf(node.dataset.value||legacy.default.value);
    const i=state<0?0:state, n=legacy.states.length;
    lid.src=resolved[color][open?'open':'closed'];
    lid.classList.toggle('is-open',open);
    base.dataset.open=String(open);base.dataset.value=legacy.states[i];
    cover.setAttribute('aria-expanded',String(open));
    actuator.disabled=!open;
    actuator.setAttribute('aria-disabled',String(!open));
    actuator.setAttribute('aria-valuemin','0');
    actuator.setAttribute('aria-valuemax',String(n-1));
    actuator.setAttribute('aria-valuenow',String(i));
    actuator.setAttribute('aria-valuetext',legacy.states[i]);
    // Small_Silver_5Positions atlas order LEFT, CENTER, RIGHT, UP, DOWN.
    // Vertical three-stop: UP/CENTER/DOWN, two-stop UP/DOWN.
    // Horizontal three-stop: LEFT/CENTER/RIGHT, two-stop LEFT/RIGHT.
    const idx=legacy.axis==='horizontal'?(n===3?[0,1,2][i]:[0,2][i]):(n===3?[3,1,4][i]:[3,4][i]);
    sprite.style.backgroundPosition=(idx*25)+'% center';
  }
  base.append(plane,cover,actuator);
  node.append(base);node.classList.add('g17-owner-upgraded');
  const observer=new MutationObserver(sync);
  observer.observe(node,{attributes:true,attributeFilter:['data-guard','data-value']});
  sync();
  return {id:c.controlId,panel:legacy.placementId,color,hinge,states:legacy.states.slice(),calibration:l.source};
}
async function init(){
  try{
    const data=await Promise.all([BP,OWNER,BASE,UPPER].map(async p=>{
      const r=await fetch(p,{cache:'no-store'});assert(r.ok,'source fetch '+p+' HTTP '+r.status);return r.json();
    }));
    const [blueprint,owner,main,upper]=data,legacy=[...main.guards,...upper.guards];
    assert(blueprint.controls.length===17&&owner.summary.ownerConfirmed===17,'17 owner-verified hinges required');
    assert(legacy.length===13,'13 native controls expected, found '+legacy.length);
    const blue=new Map(blueprint.controls.map(c=>[c.controlId,c]));
    const hinges=new Map(owner.questions.map(q=>[q.controlId,q.selection]));
    for(const g of legacy){
      assert(blue.has(g.id),'unknown control '+g.id);
      assert(blue.get(g.id).hingeDirection===hinges.get(g.id),'hinge disagrees with owner '+g.id);
      assert([2,3].includes(g.states.length),'2/3 position only '+g.id);
    }
    await Promise.all([resolved.red.closed,resolved.red.open,resolved.black.closed,resolved.black.open,resolved.silver].map(src=>new Promise((resolve,reject)=>{
      const im=new Image();im.onload=()=>resolve();im.onerror=()=>reject(Error('owner master image missing: '+src));im.src=src;
    })));
    const install=()=>{
      for(const g of legacy){
        if(mounted.has(g.id))continue;
        const node=document.querySelector('#rotaryGuardLayer .guard-node[data-control="'+g.id+'"]');
        if(!node)continue;
        try{mounted.set(g.id,add(node,blue.get(g.id),g));errors.delete(g.id)}
        catch(e){errors.set(g.id,e.message);console.error(e)}
      }
      const result={installed:mounted.size,expected:13,remaining:legacy.filter(g=>!mounted.has(g.id)).map(g=>g.id),
        errors:[...errors.entries()],master:'OWNER_FOUR_PHOTOS_2026_10_27',calibration:'PIXEL_REVIEW_STILL_REQUIRED',
        positions:[...mounted.values()]};
      window.B737OwnerGuards=result;
      let status=document.getElementById('g17-owner-status');
      if(!status){const inspector=document.getElementById('toggleInspector');if(inspector){status=element('p','g17-owner-status');status.id='g17-owner-status';inspector.prepend(status)}}
      if(status)status.textContent='Owner photo guards mounted: '+mounted.size+'/13; QA: source-centered approximations need visual sign-off.';
      if(mounted.size===13){window.dispatchEvent(new CustomEvent('b737:owner-guards-installed',{detail:result}));return true}
      return false;
    };
    if(install())return;
    const root=document.getElementById('atlasAbsolute');
    if(root){const mo=new MutationObserver(()=>{if(install())mo.disconnect()});mo.observe(root,{childList:true,subtree:true})}
  }catch(e){console.error('Owner photographic guard install:',e);window.B737OwnerGuards={installed:0,error:String(e)}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
