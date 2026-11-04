/* CONV-CONTROLS-0001 — source-photo registration for fixed Conventional
 * anti-skid guard and AUTO BRAKE selector. No source image or EIS changes.
 * Geometry is in native pixels of p2-conventional-full-owner-20261030.png
 * (1463 x 1075); its affine matrix is owned by EngineIndicationModeV1.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SOURCE_IMAGE='p2-conventional-full-owner-20261030.png';
 const REF=Object.freeze({
  image:[1463,1075],
  antiskid:Object.freeze({center:[1153.5,620],well:[1120,545,68,149],
    description:'Existing two-position guarded ON/OFF switch; no replacement image'}),
  autobrake:Object.freeze({center:[1147.6,844.8],diameter:80,
    description:'Approved rotary-standard-v1.webp, centered on actual source-photo selector hole'})
 });
 const DETENTS=Object.freeze(['RTO','OFF','1','2','3','MAX']);
 const ANGLES=Object.freeze({RTO:-135,OFF:-90,'1':-45,'2':0,'3':45,MAX:90});
 const STORE='b737.conventional.autobrake.selector.v1';
 const RTO_SELF_TEST_MS=3000;
 const cssId='b737-conventional-physical-controls-register-v1';
 function point(layout,xy){
  if(!layout||layout.sourceWidth!==REF.image[0]||layout.sourceHeight!==REF.image[1])
   throw Error('Conventional native source image geometry is not ready');
  const [a,b,c,d,e,f]=layout.matrix;
  return {x:layout.x+a*xy[0]+c*xy[1]+e,y:layout.y+b*xy[0]+d*xy[1]+f};
 }
 function bounding(layout,center,width,height){
  const p=point(layout,center);
  return{x:p.x-width/2,y:p.y-height/2,w:width,h:height,cx:p.x,cy:p.y};
 }
 function install(win){
  const doc=win.document;
  let knob=null,guard=null,style=null,watcher=null,lastSignature='',ready=false;
  let selected='OFF';
  let rtoTimer=null,rtoSelfTestActive=false,rtoGeneration=0;
  const lightSystem=()=>win.B737CockpitLights;
  // The simulator/trainer uses a separate WOW input. Do not infer ground
  // solely from landing gear position or the aircraft's barometric altitude.
  const isOnGround=()=>lightSystem()?.getState?.()?.inputs?.aircraftOnGround===true;
  function writeRtoSelfTest(active){
   const light=lightSystem();
   if(!light?.setInputs)return false;
   if(light.getState()?.inputs?.autobrakeRtoSelfTest!==active)
    light.setInputs({autobrakeRtoSelfTest:active});
   return true;
  }
  function stopRtoSelfTest(){
   ++rtoGeneration;
   if(rtoTimer!==null){win.clearTimeout(rtoTimer);rtoTimer=null;}
   rtoSelfTestActive=false;
   writeRtoSelfTest(false);
  }
  function startRtoSelfTest(){
   stopRtoSelfTest();
   if(!isOnGround())return false;
   rtoSelfTestActive=true;
   writeRtoSelfTest(true);
   const token=rtoGeneration;
   // A separate input means real DISARM faults remain lit after self-test.
   rtoTimer=win.setTimeout(()=>{
    if(token!==rtoGeneration)return;
    rtoTimer=null;rtoSelfTestActive=false;writeRtoSelfTest(false);
   },RTO_SELF_TEST_MS);
   return true;
  }
  try{const v=win.sessionStorage.getItem(STORE);if(DETENTS.includes(v))selected=v;}catch(_){}
  const native=()=>doc.querySelector('#region-main .region-native');
  const mode=()=>doc.documentElement.dataset.engineIndication;
  const layout=()=>win.B737EngineIndicationModeV1?.layout?.();
  const clearPress=()=>knob?.classList.remove('pressed');
  const report=()=>({ready,mode:mode(),detent:selected,angle:ANGLES[selected],
    onGround:isOnGround(),rtoSelfTestActive,rtoSelfTestMs:RTO_SELF_TEST_MS,
    antiskid:guard?{state:guard.dataset.value,cover:guard.dataset.cover,
      left:getComputedStyle(guard).left,top:getComputedStyle(guard).top}:null,
    knob:knob?{center:[parseFloat(knob.style.left),parseFloat(knob.style.top)],
      size:[parseFloat(knob.style.width),parseFloat(knob.style.height)]}:null});
  function render(){
   if(!knob)return;
   knob.dataset.detent=selected;
   knob.title='AUTO BRAKE — '+selected+' · click/scroll/arrow keys to select';
   knob.setAttribute('aria-label','AUTO BRAKE selector — '+selected);
   knob.setAttribute('aria-valuetext',selected);
   knob.setAttribute('aria-valuenow',String(DETENTS.indexOf(selected)));
   knob.querySelector('img').style.transform='rotate('+ANGLES[selected]+'deg)';
  }
  function set(next,origin='api'){
   if(!DETENTS.includes(next))throw Error('Invalid AUTO BRAKE detent '+next);
   const old=selected;selected=next;
   try{win.sessionStorage.setItem(STORE,next);}catch(_){}
   render();
   if(old!==next){
    if(next==='RTO')startRtoSelfTest();
    else if(old==='RTO')stopRtoSelfTest();
    const detail={selector:'AUTOBRAKE',detent:next,previous:old,
     detents:DETENTS.slice(),source:'CONV-CONTROLS-0001',origin,
     visualControl:true};
    win.dispatchEvent(new win.CustomEvent('b737:autobrake-selector-changed',{detail}));
   }
   return selected;
  }
  function step(dir,origin){
   const index=DETENTS.indexOf(selected);
   return set(DETENTS[Math.max(0,Math.min(DETENTS.length-1,index+dir))],origin);
  }
  function createKnob(){
   if(knob)return knob;
   knob=doc.createElement('button');knob.type='button';
   knob.className='b737-conv-autobrake-rotary';
   knob.dataset.control='autobrake-selector';
   knob.dataset.sourcePhoto=SOURCE_IMAGE;
   knob.setAttribute('role','slider');
   knob.setAttribute('aria-valuemin','0');knob.setAttribute('aria-valuemax','5');
   knob.setAttribute('aria-orientation','horizontal');
   knob.tabIndex=0;
   const img=doc.createElement('img');
   img.alt='';img.draggable=false;
   img.src=new URL('../assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.webp',
     doc.currentScript?.src||new URL('conventional-physical-controls-v1.js',doc.baseURI).href).href;
   knob.append(img);
   knob.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();step(e.shiftKey?-1:1,'click');});
   knob.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();step(-1,'right-click');});
   knob.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();if(e.deltaY!==0)step(e.deltaY<0?1:-1,'wheel');},{passive:false});
   knob.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();step(1,'keyboard');}
    if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();step(-1,'keyboard');}
    if(e.key==='Home'){e.preventDefault();set('RTO','keyboard');}
    if(e.key==='End'){e.preventDefault();set('MAX','keyboard');}
   });
   knob.addEventListener('pointerdown',e=>{e.stopPropagation();knob.classList.add('pressed');});
   for(const name of ['pointerup','pointercancel','pointerleave','blur'])knob.addEventListener(name,clearPress);
   render();
   return knob;
  }
  function update(){
   const main=native(),l=layout();
   if(!main||!l)return false;
   guard=main.querySelector('.owner18-guard-control[data-guard-id="antiskid"]');
   if(!guard)return false;
   const gw=guard.offsetWidth||parseFloat(guard.style.width),gh=guard.offsetHeight||parseFloat(guard.style.height);
   if(!(gw>0&&gh>0))return false;
   const physical=bounding(l,REF.antiskid.center,gw,gh);
   const rotary=point(l,REF.autobrake.center);
   const kw=REF.autobrake.diameter*l.matrix[0],kh=REF.autobrake.diameter*l.matrix[3];
   if(!style){style=doc.createElement('style');style.id=cssId;doc.head.append(style);}
   const rule='html[data-engine-indication="CONVENTIONAL"] #region-main .region-native > .owner18-guard-control[data-guard-id="antiskid"]';
   const signature=[physical.x,physical.y,gw,gh].map(n=>n.toFixed(3)).join('|');
   if(signature!==lastSignature){
    style.textContent=rule+'{left:'+physical.x.toFixed(3)+'px!important;top:'+physical.y.toFixed(3)+'px!important;}';
    lastSignature=signature;
   }
   const knobEl=createKnob();
   Object.assign(knobEl.style,{
    left:rotary.x.toFixed(3)+'px',top:rotary.y.toFixed(3)+'px',
    width:kw.toFixed(3)+'px',height:kh.toFixed(3)+'px'
   });
   if(knobEl.parentElement!==main)main.append(knobEl);
   ready=true;
   doc.documentElement.dataset.conventionalControlsReady='true';
   return true;
  }
  // Never watch the entire scene during EIS. GuardOwner18 already mounts
  // asynchronously; only wait for it while Conventional is actually selected.
  function stopWatcher(){
   if(!watcher)return;
   watcher.disconnect();watcher=null;
  }
  function watchIfNeeded(){
   if(watcher||mode()!=='CONVENTIONAL')return;
   const container=doc.getElementById('scene')||doc.body;
   if(!container)return;
   watcher=new win.MutationObserver(()=>{
    if(update()||mode()!=='CONVENTIONAL')stopWatcher();
   });
   watcher.observe(container,{subtree:true,childList:true});
  }
  function queue(){
   win.requestAnimationFrame(()=>{
    if(update())stopWatcher();
    else watchIfNeeded();
   });
  }
  for(const name of ['b737:cockpit-mounted','b737:engine-indication-view','resize'])
   win.addEventListener(name,queue);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)clearPress();});
  win.addEventListener('blur',clearPress);
  // External WOW changes can arrive from the simulator through this existing
  // cockpit sensor event. Abort the test immediately upon becoming airborne.
  win.addEventListener('b737:cockpit-sensors',event=>{
   if(event.detail?.aircraftOnGround===false)stopRtoSelfTest();
  });
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',queue,{once:true});
  else queue();
  win.B737ConventionalPhysicalControlsV1=Object.freeze({
   getState:report,getDetent:()=>selected,setDetent:set,step,update,
   // Instructor/simulator entry point: weight-on-wheels must be explicit.
   setOnGround(value){
    if(typeof value!=='boolean')throw Error('On-ground sensor must be boolean');
    const lamp=lightSystem();
    if(!lamp?.setInputs)throw Error('Cockpit light sensors not ready');
    lamp.setInputs({aircraftOnGround:value});
    if(!value)stopRtoSelfTest();
    return value;
   },
   getGeometry:()=>({antiskid:{...REF.antiskid},autobrake:{...REF.autobrake}}),
   detents:DETENTS.slice(),RTO_SELF_TEST_MS
  });
 }
 return Object.freeze({REF,DETENTS,ANGLES,RTO_SELF_TEST_MS,point,bounding,install});
});
