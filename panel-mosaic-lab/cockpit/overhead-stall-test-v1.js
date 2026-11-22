/* Physical instructor-accessible AFT overhead STALL WARN TEST 1 and TEST 2.
 * Non-destructive mounts over OH-06 region of existing UPPER source photograph;
 * the underlying frozen image, registration and guard controls are unchanged.
 * Placement is a labelled instructor control until exact source sockets are verified.
 */
(function(root){'use strict';
 if(!root?.document||root.parent===root)return;
 const parent=root.parent,origin=root.location.origin;
 const active={1:false,2:false};
 const send=(ch,pressed)=>{
  if(active[ch]===pressed)return;
  active[ch]=pressed;
  parent.postMessage({type:'b737:cockpit-overhead',kind:'stick-shaker-test',channel:ch,
    pressed,source:'AFT_OH06_STALL_WARN_TEST',trainingRegistration:true},origin);
 };
 function button(ch){
  const btn=root.document.createElement('button');
  btn.id='aftOhStallTest'+ch;
  btn.type='button';
  btn.dataset.control='stall-warning-test-'+ch;
  btn.setAttribute('aria-label','AFT OVERHEAD · STALL WARNING TEST '+ch);
  btn.textContent='STALL TEST '+ch;
  btn.title='Momentary stall warning test '+ch+' — ground/115V AC';
  btn.style.cssText='position:absolute;top:63%;left:'+(ch===1?'82%':'90%')+
   ';width:7%;min-width:0;height:5.8%;min-height:22px;border:3px solid #8e969c;'+
   'border-radius:14px;background:linear-gradient(#404e58,#18242d);color:#f2f6fc;'+
   'font:700 12px Arial,sans-serif;letter-spacing:.4px;cursor:pointer;'+
   'z-index:40;touch-action:none;user-select:none;box-shadow:0 2px 7px #000a';
  let down=false;
  const release=()=>{if(!down)return;down=false;btn.style.background='linear-gradient(#404e58,#18242d)';send(ch,false)};
  btn.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   e.stopPropagation();down=true;btn.style.background='#718c9e';send(ch,true);
   try{btn.setPointerCapture(e.pointerId)}catch(_){}
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(type,e=>{e.stopPropagation();release()});
  btn.addEventListener('click',e=>e.stopPropagation());
  btn.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();down=true;send(ch,true)}});
  btn.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' ')release()});
  btn.addEventListener('blur',release);
  return btn;
 }
 let installed=false,obs=null;
 function mount(){
  if(installed)return true;
  const photo=root.document.querySelector('#atlasAbsolute .atlas-piece[data-key="UPPER"]');
  if(!photo)return false;
  photo.append(button(1),button(2));
  installed=true;
  if(obs){obs.disconnect();obs=null;}
  return true;
 }
 const abort=()=>{send(1,false);send(2,false)};
 root.addEventListener('blur',abort);
 root.addEventListener('pagehide',abort);
 root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)abort()});
 if(!mount()){
  const rootNode=root.document.getElementById('atlasAbsolute')||root.document.body;
  obs=new MutationObserver(()=>mount());
  obs.observe(rootNode,{childList:true,subtree:true});
 }
 root.B737AftOverheadStallTestV1=Object.freeze({getState:()=>({...active}),mount});
})(typeof window==='object'?window:null);
