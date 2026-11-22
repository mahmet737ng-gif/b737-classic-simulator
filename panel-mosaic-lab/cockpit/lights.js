(function(){
 'use strict';
 const byId=id=>document.getElementById(id),model=window.B737CockpitLightsModel,script=document.currentScript.src,url=p=>new URL(p,script).href;
 let registry,instanceFaces,readabilityFaces,typographyFaces,socketCalibration,engine,selected,ui,frame,assembly,ready=false,localVisualTest=false,widgets=new Map();
 const priorGalleryOverrides=new Map();
 const pressed=new Set(),pointerLamps=new Map(),byLightId=new Map(),realFrames=new Map();
 // One photographic housing per Main Panel socket. The underlying locked
 // picture already contains its physical bezel. Reuse ONLY luminous glyphs
 // from the approved master SVG; never paint another complete framed lamp.
 const emissionCache=new Map();
 function emissionOnly(source){
  if(!emissionCache.has(source))emissionCache.set(source,
   fetch(source,{cache:'force-cache'}).then(response=>{
    if(!response.ok)throw Error('Lamp face HTTP '+response.status);
    return response.text();
   }).then(sourceText=>{
    const documentSVG=new DOMParser().parseFromString(sourceText,'image/svg+xml');
    if(documentSVG.querySelector('parsererror'))throw Error('Malformed lamp SVG');
    const svg=documentSVG.documentElement;
    for(const child of [...svg.children]){
     if(child.localName==='defs'||child.localName==='text'||
        (child.localName==='g'&&child.querySelector('text')))continue;
     child.remove();
    }
    if(!svg.querySelector('text'))throw Error('Lamp master has no legend');
    return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
   }));
  return emissionCache.get(source);
 }
 // Momentary per-lamp test affects the face only; no sensor or failure override.
 function paintLamp(c){
  const node=widgets.get(c.id);if(!node)return;
  const state=pressed.has(c.id)?'ON':realFrames.get(c.id)||'OFF';
  node.dataset.frame=state;node.dataset.pushTest=String(pressed.has(c.id));
  node.classList.toggle('flash',state==='FLASH');
  node.setAttribute('aria-label',c.id+' — '+(pressed.has(c.id)?'PUSH TO TEST':state));
  const img=node.querySelector('img');
  const face=state==='OFF'?'OFF':'ON';
  const oldFace=(typographyFaces?.instances?.[c.id]?.states?.[face]||
   readabilityFaces?.instances?.[c.id]?.states?.[face]||
   instanceFaces?.instances?.[c.id]?.states?.[face]||
   registry.assets[c.asset][face]);
  const src=window.B737LampAppearance.resolve('MP',c.asset,state)||
   url(oldFace.url)+'?v='+encodeURIComponent(registry.version);
  // Never allow the legacy complete-lamp SVG to cover the genuine bezel.
  // This is also a transparent fallback if the socket fitter is delayed.
  if(img.dataset.emissionSource!==src){
   img.dataset.emissionSource=src;
   emissionOnly(src).then(face=>{
    if(img.dataset.emissionSource===src)img.src=face;
   }).catch(error=>{
    if(img.dataset.emissionSource===src)node.dataset.missing='true';
    console.error('MP emission-only face:',c.id,error);
   });
  }
 }
 function clearLampPress(id){
  if(!pressed.delete(id))return;
  const c=byLightId.get(id);if(c)paintLamp(c);
 }
 function releasePointer(e){
  const id=pointerLamps.get(e.pointerId);if(!id)return;
  pointerLamps.delete(e.pointerId);
  if(![...pointerLamps.values()].includes(id))clearLampPress(id);
 }
 function clearPresses(){
  pointerLamps.clear();for(const id of [...pressed])clearLampPress(id);
 }
 function bindLampPress(node,c){
  node.addEventListener('pointerdown',e=>{
   e.stopPropagation();if(e.pointerType==='mouse'&&e.button!==0)return;
   pointerLamps.set(e.pointerId,c.id);pressed.add(c.id);paintLamp(c);
  });
  node.addEventListener('keydown',e=>{
   if((e.key===' '||e.key==='Enter')&&!e.repeat){
    e.preventDefault();e.stopPropagation();pressed.add(c.id);paintLamp(c);
   }
  });
  node.addEventListener('keyup',e=>{
   if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();clearLampPress(c.id);}
  });
  node.addEventListener('blur',()=>clearLampPress(c.id));
 }
 const labels={power:'Local Test Power',aircraftAltitude:'Aircraft Altitude · ft',selectedAltitude:'Selected MCP Altitude · ft',trailingFlaps:'TE Flap Position',gsCaptured:'G/S Captured',gearLever:'Landing Gear Command',gearLeft:'Left Gear Sensor',gearRight:'Right Gear Sensor',gearNose:'Nose Gear Sensor',thrustIdle:'At Least One Throttle in IDLE',leadingEdge:'All Leading Edge Device States',autoslatInFlight:'Autoslat Signal in Flight',antiskidOn:'ANTISKID ON Command',antiskidFault:'ANTISKID Failure',autobrakeArmed:'Autobrake Armed',autobrakeDisarmed:'Autobrake Computer Disarm Output',speedBrakeArmedIndication:'Independent SPEED BRAKE ARMED Lamp Input',speedBrakeDoNotArmIndication:'Independent SPEED BRAKE DO NOT ARM Lamp Input',autopilotEngaged:'Autopilot Engaged',stabTrimError:'Autopilot Stabilizer Trim Error',gpwsPullUp:'GPWS Computer PULL UP Output',belowGsDots:'Below G/S Deviation · dots',gsSignalValid:'Valid G/S Signal',gsInhibited:'G/S Push Inhibit Active',radioAltitude:'Radio Altitude · ft',gpwsComputerFailed:'GPWS Computer Failure',gpwsPowerLost:'GPWS Power Loss',gpwsInvalidInput:'GPWS Invalid Input',brakeTempTest:'Direct Brake Temperature Test Signal',atLimitDegradedN1:'Autothrottle Computer N1 Limit Signal'};
 for(const n of [1,2])Object.assign(labels,{['reverser'+n+'Unlocked']:'Reverser '+n+' unlocked sensor',['startValve'+n+'Open']:'Start Valve '+n+' open',['starter'+n+'Air']:'Starter '+n,['oil'+n+'AtRedRadial']:'Engine oil pressure '+n+' at/below red radial',['oilFilter'+n+'Bypass']:'Oil filter '+n+' near bypass'});
 const options={gearLever:['UP','OFF','DN'],gearLeft:['UP','DOWN','TRANSIT','UNSAFE'],gearRight:['UP','DOWN','TRANSIT','UNSAFE'],gearNose:['UP','DOWN','TRANSIT','UNSAFE'],leadingEdge:['RETRACTED','INTERMEDIATE','FULL','TRANSIT','DISAGREE'],trailingFlaps:[0,1,2,5,10,15,25,30,40]};
 function render(){if(!ready)return;engine.setVisualTest(localVisualTest||document.documentElement.dataset.lampVisualTest==='true');const s=engine.evaluate();const actualTe=window.B737Final10ApproachPresetV1?.getLiveFlapOwnerState?.()?.actualTe??
   window.B737LEDevicesUnifiedLink?.getState()?.actualTe;
  window.dispatchEvent(new CustomEvent('b737:trailing-flaps',{detail:{position:Number.isFinite(actualTe)?actualTe:s.inputs.trailingFlaps}}));for(const [id]of widgets){realFrames.set(id,s.frames[id]);paintLamp(byLightId.get(id));}
  byId('cockpitLightStatus').textContent=Object.values(s.frames).filter(x=>x!=='OFF').length+' / '+registry.lights.length+' ON · '+registry.version+(s.visualTest?' · Visual Test Independent of Power':Object.keys(s.overrides).length?' · Direct Test':s.overheadPower===null?' · Awaiting Overhead Power Connection':s.power?'':' · Power OFF');
  byId('cockpitLightPower').checked=s.inputs.power;byId('cockpitLightTest').disabled=false;byId('cockpitLightTest').setAttribute('aria-pressed',String(s.visualTest));byId('cockpitLightTest').textContent=s.visualTest?'End Main Panel Visual Test':'Illuminate '+registry.lights.length+' Main Panel Lamps';
  if(selected){byId('cockpitLightFrame').textContent=s.frames[selected.id];byId('cockpitLightOverride').value=s.overrides[selected.id]||'AUTO';for(const n of ui.querySelectorAll('[data-light-input]')){const v=s.inputs[n.dataset.lightInput];if(n.type==='checkbox')n.checked=v;else n.value=String(v);}}
 }
 function choose(c){selected=c;byId('cockpitLightSelect').value=c.id;const p=c.provenance;byId('cockpitLightSource').textContent=p.physicalPdfPage?'FCOM '+p.printedFolio+' · PDF '+p.physicalPdfPage:'Direct Visual Test · Technical Conditions Unverified';byId('cockpitLightCondition').textContent=p.condition;byId('cockpitLightEffectivity').textContent=c.effectivity||'';const inputs=byId('cockpitLightInputs');inputs.replaceChildren();const s=engine.evaluate().inputs;
  for(const key of c.inputs){const l=document.createElement('label');l.className='light-input';let n;if(options[key]){n=document.createElement('select');for(const v of options[key]){const o=document.createElement('option');o.value=String(v);o.textContent=String(v);n.append(o);}}else{n=document.createElement('input');n.type=typeof s[key]==='boolean'?'checkbox':'number';if(n.type==='number'){n.step=key==='belowGsDots'?'0.1':'1';n.min=key==='aircraftAltitude'||key==='selectedAltitude'?'-2000':'0';n.max=key==='belowGsDots'?'10':'60000';}}
   n.dataset.lightInput=key;n.setAttribute('aria-label',labels[key]||key);const applyInput=()=>{if(n.type==='number'&&(n.value===''||n.validity.badInput))return;try{engine.update({[key]:typeof s[key]==='boolean'?n.checked:typeof s[key]==='number'?Number(n.value):n.value});byId('cockpitLightError').textContent='';}catch(e){byId('cockpitLightError').textContent=e.message;}render();};n.onchange=applyInput;if(n.type==='number')n.oninput=applyInput;l.append(document.createTextNode(labels[key]||key),n);inputs.append(l);
  }render();
 }
 function inspector(){ui=document.createElement('section');ui.className='cockpit-light-tools';ui.id='cockpitLightsInspector';ui.innerHTML='<h2>Main Panel Lamps</h2><p id="cockpitLightStatus" role="status"></p><button id="cockpitLightTest">Main Panel Lamp Test</button><label class="check"><input id="cockpitLightPower" type="checkbox" checked> Local Test Power</label><label>Select Lamp<select id="cockpitLightSelect" dir="ltr"></select></label><output id="cockpitLightFrame" dir="ltr"></output><label>Direct Test Override<select id="cockpitLightOverride"><option value="AUTO">Database / Sensor Condition</option><option value="OFF">OFF for Test</option><option value="ON">ON for Test</option></select></label><details open><summary>Lamp Condition Inputs</summary><div id="cockpitLightInputs"></div></details><p id="cockpitLightError" role="status"></p><small id="cockpitLightSource"></small><p id="cockpitLightCondition" class="light-condition" dir="ltr"></p><small id="cockpitLightEffectivity"></small><button id="cockpitLightReset">Reset Main Panel Test</button><p class="muted">Sensors in this panel are training inputs. A switch command does not confirm an actual valve opening. Complete engine, GPWS and Autobrake behavior belongs to the corresponding subsystem.</p><a href="../lights-test/?v=LGT-0007">Test All Database Lamps</a>';
  const oldGalleryLink=ui.querySelector('a[href^="../lights-test"]'),inPageButton=document.createElement('button');
  inPageButton.type='button';inPageButton.textContent='Test Individual Lamps in Unified';inPageButton.onclick=()=>byId('unifiedLightsOpen').click();oldGalleryLink.replaceWith(inPageButton);
  document.querySelector('.overhead-tools').before(ui);for(const c of registry.lights){const o=document.createElement('option');o.value=o.textContent=c.id;byId('cockpitLightSelect').append(o);}byId('cockpitLightSelect').onchange=e=>choose(registry.lights.find(c=>c.id===e.target.value));byId('cockpitLightOverride').onchange=e=>{engine.setOverride(selected.id,e.target.value);render();};byId('cockpitLightPower').onchange=e=>{engine.update({power:e.target.checked});render();};byId('cockpitLightReset').onclick=()=>{localVisualTest=false;window.dispatchEvent(new CustomEvent('b737:visual-test-request',{detail:{active:false}}));engine.reset();render();};
  byId('cockpitLightTest').onclick=()=>{if(document.documentElement.dataset.lampVisualTest==='true'){localVisualTest=false;window.dispatchEvent(new CustomEvent('b737:visual-test-request',{detail:{active:false}}));}else localVisualTest=!localVisualTest;if(localVisualTest){byId('scene').classList.remove('reference-mode');byId('reference').setAttribute('aria-pressed','false');}render();};
  window.addEventListener('b737:visual-test',()=>{localVisualTest=false;render();});
 }
 function mount(){frame=byId('overheadFrame');model.validate(registry,assembly);engine=model.controller(registry);const pieces=new Map();for(const r of assembly.regions)for(const p of r.placements||[])pieces.set(p.id,{p,r});const layers=new Map();
  for(const c of registry.lights){const {p,r}=pieces.get(c.pieceId),a=assembly.assets[p.asset],scale=p.w/a.dimensions[0],measured=socketCalibration?.sockets?.[c.id];
  if(!measured||measured.pieceId!==c.pieceId)throw Error('Missing Main Panel photo aperture '+c.id);
  const [x,y,w,h]=measured.sourceRect,center=[x+w/2,y+h/2];
  if(Math.abs(center[0]-measured.center[0])>0.01||Math.abs(center[1]-measured.center[1])>0.01)
   throw Error('Misregistered source center '+c.id);
  let layer=layers.get(r.id);if(!layer){layer=document.createElement('div');layer.className='cockpit-light-layer';layer.style.width=r.nativeWidth+'px';layer.style.height=r.nativeHeight+'px';byId('region-'+r.id).querySelector('.region-native').append(layer);layers.set(r.id,layer);}const node=document.createElement('button');node.className='cockpit-light';node.dataset.cockpitLight=c.id;node.dataset.asset=c.asset;node.title=c.id+' · '+c.pieceId+' · measured aperture ['+measured.sourceRect.join(', ')+']';node.dataset.apertureCenter=center.join(',');Object.assign(node.style,{left:p.x+x*scale+'px',top:p.y+y*scale+'px',width:w*scale+'px',height:h*scale+'px'});const img=document.createElement('img');img.alt='';img.draggable=false;img.onerror=()=>{node.dataset.missing='true';byId('cockpitLightError').textContent='Lamp Asset Failed to Load: '+c.asset;};node.append(img);byLightId.set(c.id,c);bindLampPress(node,c);node.onclick=e=>{e.stopPropagation();choose(c);};layer.append(node);widgets.set(c.id,node);}
  document.addEventListener('pointerup',releasePointer,true);
   document.addEventListener('pointercancel',releasePointer,true);
   window.addEventListener('blur',clearPresses);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)clearPresses();});
   inspector();ready=true;choose(registry.lights.find(c=>c.id==='main-gear-nose-green'));render();frame.contentWindow.postMessage({type:'b737:cockpit-command',action:'report'},location.origin);
  window.B737CockpitLights=Object.freeze({getState:()=>engine.evaluate(),getRegistry:()=>JSON.parse(JSON.stringify(registry)),getCalibration:()=>JSON.parse(JSON.stringify(socketCalibration)),setInputs:patch=>{const state=engine.update(patch);render();return state;},reset:()=>{const state=engine.reset();render();return state;}});
   window.dispatchEvent(new CustomEvent('b737:cockpit-lights-ready',{detail:{source:'MAIN_PANEL_LAMPS'}}));
  window.addEventListener('b737:cockpit-sensors',e=>{try{engine.update(e.detail);render();}catch(error){byId('cockpitLightError').textContent=error.message;}});
 }
 window.addEventListener('message',e=>{if(!ready||e.origin!==location.origin||e.source!==frame?.contentWindow||e.data?.type!=='b737:cockpit-overhead'||e.data.kind!=='state'||typeof e.data.power!=='boolean')return;engine.setOverheadPower(e.data.power);render();});
 // Route-local visual previews: never invent locations for new annunciator types.
 window.addEventListener('b737:unified-legend-test',e=>{
  if(!ready)return;
  const asset=e.detail?.asset,state=e.detail?.state;
  if(!asset||!['OFF','ON','DIM_BLUE','BRIGHT_BLUE'].includes(state))return;
  const mounted=registry.lights.filter(c=>c.asset===asset);
  if(!mounted.length)return;
  const current=engine.evaluate().overrides;
  for(const c of mounted){if(!priorGalleryOverrides.has(c.id))priorGalleryOverrides.set(c.id,current[c.id]||'AUTO');engine.setOverride(c.id,state==='OFF'?'OFF':'ON');}
  render();
 });
 window.addEventListener('b737:unified-legend-clear',()=>{
  if(!ready)return;
  for(const [id,previous] of priorGalleryOverrides)engine.setOverride(id,previous);
  priorGalleryOverrides.clear();render();
 });
 async function start(){try{await window.B737LampAppearance.ready;const responses=await Promise.all([fetch(url('lights.json'),{cache:'no-store'}),fetch(url('assembly.json'),{cache:'no-store'}),fetch(url('instance-faces.json'),{cache:'no-store'}),fetch(url('readability-faces.json'),{cache:'no-store'}),fetch(url('typography-faces.json'),{cache:'no-store'}),fetch(url('main-panel-socket-calibration-v1.json'),{cache:'no-store'})]);if(responses.some(r=>!r.ok))throw Error('Cockpit light database unavailable');[registry,assembly,instanceFaces,readabilityFaces,typographyFaces,socketCalibration]=await Promise.all(responses.map(r=>r.json()));
 if(socketCalibration.schema!=='b737.main-panel-socket-calibration.v1'||
    Object.keys(socketCalibration.sockets||{}).length!==registry.lights.length)
  throw Error('Main Panel photo aperture calibration missing');
 for(const item of registry.lights){
  const slot=socketCalibration.sockets[item.id];
  if(!slot||slot.pieceId!==item.pieceId||!Array.isArray(slot.sourceRect)||slot.sourceRect.length!==4)throw Error('Main Panel aperture missing '+item.id);
  const piece=assembly.regions.flatMap(r=>r.placements||[]).find(p=>p.id===item.pieceId);
  const img=assembly.assets[piece?.asset];
  const [x,y,w,h]=slot.sourceRect;
  if(!img||![x,y,w,h].every(Number.isFinite)||w<=0||h<=0||x<0||y<0||x+w>img.dimensions[0]||y+h>img.dimensions[1])
   throw Error('Main Panel aperture outside photo '+item.id);
 }if(instanceFaces.schema!=='b737.lamps.instance-face.v1')throw Error('Invalid per-position main lens mapping');for(const [id,item] of Object.entries(instanceFaces.instances)){const c=registry.lights.find(x=>x.id===id);if(!c||c.asset!==item.asset||JSON.stringify(c.sourceRect)!==JSON.stringify(item.sourceRect)||Object.keys(registry.assets[c.asset]).some(state=>!item.states[state]))throw Error('Main lens position registration mismatch: '+id);}if(readabilityFaces.schema!=='b737.lamps.readability-face-overrides.v1')throw Error('Readability schema missing');for(const [id,item] of Object.entries(readabilityFaces.instances)){const c=registry.lights.find(x=>x.id===id);if(!c||c.asset!==item.asset||JSON.stringify(c.sourceRect)!==JSON.stringify(item.sourceRect))throw Error('Readability mount mismatch: '+id);}if(typographyFaces.schema!=='b737.main-panel.annunciator-type-v1'||typographyFaces.sourceRegistryVersion!==registry.version||Object.keys(typographyFaces.instances).length!==registry.lights.length)throw Error('Main typography coverage/version mismatch');for(const c of registry.lights){const t=typographyFaces.instances[c.id];if(!t||t.asset!==c.asset||JSON.stringify(t.sourceRect)!==JSON.stringify(c.sourceRect)||['OFF','ON'].some(z=>!t.states[z]))throw Error('Main family typography mismatch: '+c.id);}if(byId('region-main'))mount();else window.addEventListener('b737:cockpit-mounted',mount,{once:true});}catch(e){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Main Panel Lamp Connection Error: '+e.message;byId('inspector').prepend(p);console.error(e);}}
 if(new URLSearchParams(location.search).has('debugLights'))document.documentElement.dataset.lightGeometryDebug='true';
 window.addEventListener('b737:lamp-brightness-change',()=>{if(ready)render();});
 start();
})();
