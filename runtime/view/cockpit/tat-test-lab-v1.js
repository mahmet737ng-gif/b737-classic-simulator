/* TAT-TESTLAB-0001: OH15 photo-backed, independently simulated systems lab.
 * Uses exact owner-locked OH15 background as-is; never edits the atlas,
 * registered switch positions, guarded artwork, or live switch wiring.
 * Triple tap is detected on physical OH15 coordinates in the iframe.
 */
(function(){'use strict';
 const Core=window.B737TATProbeV1,Tat=window.B737TATProbeUnifiedV1;
 if(!Core||!Tat)return;
 const IMAGE=new URL('../assets/locked/2026-10-23/OH15-WINDOW-PITOT-4ecfdc65f71b.png',document.baseURI).href;
 const scenarios=[
  {id:'ground-off',name:'GROUND · A OFF',text:'TEMP PROBE amber on; TAT heater inhibited until TEST is pressed.',ground:true,a:false,press:false,main2:true,dc1:true},
  {id:'ground-on',name:'GROUND · A ON',text:'Ground inhibit bypasses the TEMP PROBE lamp; probe heater remains OFF.',ground:true,a:true,press:false,main2:true,dc1:true},
  {id:'tat-test',name:'TAT TEST · HEALTHY',text:'On ground with A OFF, press/hold TAT TEST: heater current flows and amber goes out.',ground:true,a:false,press:true,main2:true,dc1:true},
  {id:'heater-fail',name:'HEATER FAILURE',text:'TAT TEST is pressed but heater current is absent. TEMP PROBE stays amber.',ground:true,a:false,press:true,main2:true,dc1:true,fault:'HEATER_FAIL'},
  {id:'sensor-fail',name:'CURRENT DETECTOR FAIL',text:'Heater has power; failed current detection leaves TEMP PROBE amber.',ground:true,a:false,press:true,main2:true,dc1:true,fault:'CURRENT_SENSE_FAIL'},
  {id:'cb-pulled',name:'CB OPEN · SCENARIO',text:'Simulated P18-3/C5 open for this scenario only; real cockpit CB unchanged.',ground:true,a:false,press:true,main2:true,dc1:true,virtualCb:true},
  {id:'ac-loss',name:'MAIN BUS 2 LOST',text:'AC heater supply unavailable while DC indicator remains energized; amber stays on during TEST.',ground:true,a:false,press:true,main2:false,dc1:true},
  {id:'dc-loss',name:'DC INDICATION LOST',text:'No indicator electrical power, so the TEMP PROBE light cannot glow.',ground:true,a:false,press:false,main2:true,dc1:false},
  {id:'flight',name:'FLIGHT · A ON',text:'In flight PITOT A ON requests actual TAT probe heat; button ground-test is inoperative.',ground:false,a:true,press:false,main2:true,dc1:true},
  {id:'lamp-stuck',name:'INDICATOR STUCK ON',text:'Indication failure keeps TEMP PROBE amber illuminated despite healthy heater current.',ground:true,a:false,press:true,main2:true,dc1:true,fault:'INDICATOR_STUCK_ON'}
 ];
 const byId=new Map(scenarios.map(x=>[x.id,x]));
 const local={...scenarios[0]};
 let lab=null,frameBound=null,pressPointer=false,upEvents=0,down=null,lastAt=0;
 const $=id=>lab?.querySelector('#'+id);
 function realCB(){return Tat.getCbState?.()||{pulled:false,tripped:false,fault:null};}
 function output(){
  const state=local.fault?Core.injectFault(Core.initialState(),local.fault,true):Core.initialState();
  const cbPulled=realCB().pulled||!!local.virtualCb;
  const b={[Core.CB_ID]:!cbPulled};
  return Core.evaluate(state,{onGround:local.ground,switches:{'pitot-a':local.a?'ON':'OFF'},
   testPressed:local.press,breakers:b,buses:{main2:local.main2,dc1:local.dc1},
   trainingPower:false});
 }
 function draw(){
  if(!lab)return;
  const o=output(),cb=realCB();
  lab.querySelectorAll('[data-tat-scenario]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tatScenario===local.id)));
  $('tatlab-a').dataset.position=local.a?'ON':'OFF';
  $('tatlab-b').dataset.position=local.b?'ON':'OFF';
  $('tatlab-test').dataset.pressed=String(!!local.press);
  $('tatlab-temp').dataset.on=String(o.amberOn);
  $('tatlab-temp').setAttribute('aria-label','TEMP PROBE '+(o.amberOn?'amber illuminated':'extinguished'));
  $('tatlab-led-caption').textContent=o.amberOn?'TEMP PROBE — AMBER':'TEMP PROBE — OFF';
  $('tatlab-scenario-desc').textContent=local.text||'Manual switches / TAT TEST';
  $('tatlab-metrics').textContent='MODE '+(o.onGround?'GROUND':'FLIGHT')+
    ' · MAIN BUS 2 '+(local.main2?'ON':'OFF')+' · DC IND '+(local.dc1?'ON':'OFF')+
    ' · HEATER '+(o.heaterPower?'ENERGIZED':'OFF')+' · TEST '+(o.testPressed?'PRESSED':'RELEASED');
  $('tatlab-status').textContent=o.status;
  $('tatlab-cb-value').textContent=cb.pulled?'PULLED / OPEN':'PUSHED / CLOSED';
  $('tatlab-cb-value').dataset.pulled=String(cb.pulled);
  $('tatlab-cb-toggle').textContent=cb.pulled?'PUSH REAL CB':'PULL REAL CB';
  $('tatlab-cb-toggle').disabled=!!(cb.pulled&&(cb.tripped||cb.fault));
  $('tatlab-cb-note').textContent=local.virtualCb?'This scenario also simulates an open C5, without changing the real CB.':cb.pulled?'REAL C5 PULLED — Live Unified heater is also blocked.':'REAL C5 PUSHED — Live Unified can heat normally if power exists.';
  $('tatlab-manual-test').setAttribute('aria-pressed',String(!!local.press));
 }
 function setScenario(id){
  const v=byId.get(id);if(!v)return false;
  Object.assign(local,{...v,b:false,virtualCb:!!v.virtualCb,fault:v.fault||null});
  draw();return true;
 }
 function manual(){
  local.id='manual';local.text='Manual OH15 photo controls; failure/bus mode retained until selecting a preset.';
  draw();
 }
 function make(){
  lab=document.createElement('dialog');
  lab.id='tatProbeTestLabDialog';lab.className='tatlab-dialog';lab.dir='ltr';
  lab.setAttribute('aria-label','TAT Probe Heat Test Lab with original OH15 panel');
  const opts=scenarios.map(s=>'<button type="button" data-tat-scenario="'+s.id+'" aria-pressed="false">'+s.name+'</button>').join('');
  lab.innerHTML=
   '<header class="tatlab-header"><div><strong>TAT PROBE HEAT · TEST LAB</strong><small>737 Classic · FCOM 3.10.4 · original OH15 panel</small></div><button id="tatlab-close" type="button" aria-label="Close TAT lab">×</button></header>'+
   '<div class="tatlab-main"><div class="tatlab-stage"><div class="tatlab-photo">'+
    '<img src="'+IMAGE+'" alt="Original B737 Classic OH15 window and pitot static heat panel" width="1280" height="1229" draggable="false">'+
    '<button type="button" id="tatlab-a" class="tatlab-toggle" aria-label="PITOT STATIC HEAT A, change ON/OFF" data-position="OFF" style="left:41.2%;top:59.70%"><span></span></button>'+
    '<button type="button" id="tatlab-b" class="tatlab-toggle" aria-label="PITOT STATIC HEAT B, change ON/OFF" data-position="OFF" style="left:58.70%;top:59.70%"><span></span></button>'+
    '<button type="button" id="tatlab-test" aria-label="Press and hold TAT TEST" data-pressed="false" style="left:49.84%;top:83.56%"></button>'+
    '<div class="tatlab-amber" id="tatlab-temp" data-on="false" role="img" aria-label="TEMP PROBE" style="left:10.78%;top:79.58%;width:19.92%;height:6.75%"><span>TEMP PROBE</span></div>'+
   '</div><p id="tatlab-led-caption" class="tatlab-lamp-label">TEMP PROBE — OFF</p>'+
   '<p class="tatlab-help">Toggle A/B on the original panel. Press and hold the round TAT TEST button to check the circuit. This is a separate training scene, not a replacement for live aircraft controls.</p></div>'+
   '<aside class="tatlab-side"><h3>TRAINING SCENARIOS</h3><div class="tatlab-scenarios">'+opts+'</div>'+
    '<p id="tatlab-scenario-desc" class="tatlab-scenario-text"></p>'+
    '<div class="tatlab-metrics" id="tatlab-metrics"></div><p class="tatlab-system-status" id="tatlab-status"></p>'+
    '<button type="button" id="tatlab-manual-test" class="tatlab-manual">Hold TAT TEST · ON/OFF</button>'+
    '<section class="tatlab-cb"><h3>REAL CIRCUIT BREAKER · P18-3 / C5</h3>'+
     '<p><strong id="tatlab-cb-value"></strong> · TEMP PROBE 5A</p><p id="tatlab-cb-note"></p>'+
     '<div class="tatlab-cb-actions"><button type="button" id="tatlab-cb-toggle"></button><button type="button" id="tatlab-cb-view">FIND IN CB PANEL</button></div>'+
    '</section><button type="button" id="tatlab-reset">RESET TRAINING SCENARIOS</button>'+
   '</aside></div>';
  document.body.append(lab);
  $('tatlab-close').addEventListener('click',()=>lab.close());
  lab.addEventListener('click',e=>{if(e.target===lab)lab.close();});
  lab.querySelectorAll('[data-tat-scenario]').forEach(btn=>btn.addEventListener('click',()=>setScenario(btn.dataset.tatScenario)));
  $('tatlab-a').addEventListener('click',()=>{local.a=!local.a;manual();});
  $('tatlab-b').addEventListener('click',()=>{local.b=!local.b;manual();});
  const test=$('tatlab-test');
  test.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pressPointer=true;local.press=true;manual();try{test.setPointerCapture(e.pointerId);}catch{}});
  const release=()=>{if(!pressPointer)return;pressPointer=false;local.press=false;manual();};
  for(const evt of ['pointerup','pointercancel','lostpointercapture','blur'])test.addEventListener(evt,release);
  test.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat){local.press=true;manual();}}});
  test.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();local.press=false;manual();}});
  $('tatlab-manual-test').addEventListener('click',()=>{local.press=!local.press;manual();});
  $('tatlab-cb-toggle').addEventListener('click',()=>{
   const cb=realCB(),result=Tat.setCbPulled?.(!cb.pulled);
   if(!result?.ok){$('tatlab-status').textContent='CB command rejected: '+(result?.reason||'UNAVAILABLE');return;}
   draw();
  });
  $('tatlab-cb-view').addEventListener('click',()=>{
   lab.close();document.getElementById('cbPanelOpen')?.click();
   const frame=document.getElementById('cbPanelFrame');
   const locate=()=>{try{const api=frame?.contentWindow?.B737_CB_MRG_VIEWER;
     if(api){api.focusByKey(Core.CB_ID);return true;}}catch{}return false;};
   if(!locate())frame?.addEventListener('load',()=>{setTimeout(locate,220);},{once:true});
  });
  $('tatlab-reset').addEventListener('click',()=>setScenario('ground-off'));
  draw();
 }
 function open(){if(!lab)make();setScenario('ground-off');if(!lab.open)lab.showModal();}
 // Captured *pointer* releases work even where the atlas intentionally
 // suppresses click/dblclick to prevent selecting/moving source artwork.
 // A valid three-tap gesture needs three distinct, short, one-finger taps
 // strictly inside the rendered OH15 bounding box (including switch overlays).
 function attachFrame(){
  const frame=document.getElementById('overheadFrame');
  let doc;try{doc=frame?.contentDocument;}catch{return;}
  if(!doc||frameBound===doc)return;
  frameBound=doc;upEvents=0;down=null;let touchIds=new Set();
  const within=e=>{
   const tile=doc.querySelector('#atlasAbsolute .atlas-piece[data-key="OH15"]');
   if(!tile)return false;
   const r=tile.getBoundingClientRect();
   return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  };
  doc.addEventListener('pointerdown',e=>{
   if(e.pointerType==='touch')touchIds.add(e.pointerId);
   if(touchIds.size>1){down=null;upEvents=0;return;}
   if(e.pointerType==='mouse'&&e.button!==0)return;
   down=within(e)?{id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()}:null;
  },true);
  doc.addEventListener('pointerup',e=>{
   if(e.pointerType==='touch')touchIds.delete(e.pointerId);
   if(!down||down.id!==e.pointerId){down=null;return;}
   const dt=performance.now()-down.time;
   const still=Math.hypot(e.clientX-down.x,e.clientY-down.y)<12;
   const valid=still&&dt<400&&within(e)&&touchIds.size===0;
   down=null;
   if(!valid){upEvents=0;return;}
   const now=performance.now();
   upEvents=(now-lastAt<620)?upEvents+1:1;lastAt=now;
   if(upEvents===3){upEvents=0;open();}
  },true);
  doc.addEventListener('pointercancel',e=>{if(down?.id===e.pointerId)down=null;touchIds.delete(e.pointerId);},true);
 }
 function boot(){
  make();attachFrame();
  document.getElementById('overheadFrame')?.addEventListener('load',attachFrame);
  window.addEventListener('storage',e=>{if(e.key==='b737classic.cb.v1'&&lab?.open)draw();});
  setInterval(()=>{attachFrame();if(lab?.open)draw();},300);
 }
 window.B737TATTestLabV1=Object.freeze({open,setScenario,output,realCB,refresh:draw,asset:IMAGE});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
