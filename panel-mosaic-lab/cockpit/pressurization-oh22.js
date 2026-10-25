/* The live OH22 assembly. No synthetic pressure/valve physics.
 * All controls dispatch to the selected, source-linked CPCS/DCPCS engine.
 * The only visual source switch is OH22; other Overhead systems remain mounted.
 */
(function(){
 'use strict';
 const root=document,model=window.B737OH22PressureModel,atlas=root.getElementById('atlasAbsolute');
 if(!model||!atlas)throw Error('OH22 model / atlas unavailable');
 model.validate();
 const PROFILE_KEY='b737classic.aircraft-profile.v1';
 const knobAsset=new URL('../assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.webp',document.baseURI).href;
 const toggleAsset=new URL('../assets/locked/2026-10-23/Switches/Toggle/b737-toggle-center.webp',document.baseURI).href;
 const lampBase=new URL('../assets/locked/2026-10-23/LIGHTS/unified-mounted-v1/',document.baseURI).href;
 const approvedLamps=Object.freeze({'auto-fail':'AUTO_FAIL','off-sched':'OFF_SCHED_DESCENT','standby':'STANDBY_GREEN','manual':'MANUAL_GREEN'});

 let system='DCPCS',layer=null,plate=null,received=null,fallback=null,controls=new Map(),lamps=new Map(),digits=new Map(),caption=null,gauge=null;
 let activeSpring=null,holdTimer=null,observer=null;
 function notify(kind,additional={}){if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',kind,system,...additional},location.origin);}
 function savedSystem(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.pressurization==='CPCS'?'CPCS':'DCPCS';}catch(_){return 'DCPCS';}}
 function mount(){
   const target=atlas.querySelector('.atlas-piece[data-key="OH22"]');
   if(!target)return false;
   if(target===plate&&layer?.isConnected)return true;
   plate=target;
   window.document.documentElement.classList.add('oh22-pressure-config-active');
   build();
   return true;
 }
 function pos(node,xy){node.style.left=(xy[0]*100)+'%';node.style.top=(xy[1]*100)+'%';}
 function createActuator(c){
   const el=root.createElement('button');el.type='button';el.dataset.role='actuator';el.dataset.control=c.id;
   el.title=c.label+(c.kind==='altitude'?' — left click increase, shift/right click decrease':' — click to next detent');
   el.setAttribute('aria-label',el.title);el.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown');
   pos(el,c.xy);
   const hotspot=c.appearance==='hotspot';
   // Size is installation-specific and based on the real source aperture.
   // A common tiny width made the CPCS/DCPCS mechanisms float in their bezels.
   const size=hotspot?11:model.config(system).controlFit[c.id]*100;
   el.dataset.fitSystem=system;
   el.style.width=size+'%';
   if(hotspot){el.style.height=(size*.34)+'%';}
   else{el.style.height='auto';el.style.aspectRatio='1 / 1';}
   if(hotspot)el.classList.add('oh22-pressure-hotspot');
   const value=root.createElement('span');value.className='oh22-control-value';value.dataset.value='';
   if(!hotspot){
     const img=root.createElement('img');img.src=c.kind==='spring'?toggleAsset:knobAsset;img.alt='';img.draggable=false;
     el.append(img);
   }
   el.append(value);
   const go=(input)=>dispatch(c,input);
   const values=c.states||[];
   function step(dir){
     if(c.kind==='altitude'){const before=Number(model.readControl(system,c,received?.state));go(Math.max(c.min,Math.min(c.max,(Number.isFinite(before)?before:0)+c.step*dir)));return;}
     if(c.kind==='selector'){const before=model.readControl(system,c,received?.state),index=Math.max(0,values.indexOf(before)),next=Math.max(0,Math.min(values.length-1,index+dir));go(values[next]);return;}
     if(c.kind==='momentary')go('CHECK');
   }
   if(c.kind==='spring'){
     el.classList.add('oh22-pressure-actuator-spring');
     el.addEventListener('pointerdown',e=>{
       if(e.button!==0)return;
       e.preventDefault();e.stopPropagation();
       const b=el.getBoundingClientRect(),direction=e.clientX<b.left+b.width/2?'CLOSE':'OPEN';
       activeSpring=el;go(direction);
       try{el.setPointerCapture(e.pointerId)}catch(_){}
       if(holdTimer!==null)clearInterval(holdTimer);
       holdTimer=setInterval(()=>sendCommand({type:'ADVANCE',ms:250}),250);
     });
     const release=()=>{
       if(activeSpring!==el)return;
       activeSpring=null;
       if(holdTimer!==null){clearInterval(holdTimer);holdTimer=null;}
       go('NEUTRAL');
     };
     for(const evt of ['pointerup','pointercancel','lostpointercapture','blur'])el.addEventListener(evt,release);
     window.addEventListener('blur',release);
     el.addEventListener('click',e=>{e.stopPropagation();});
   }else{
     el.addEventListener('click',e=>{e.stopPropagation();step(e.shiftKey?-1:1)});
     el.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();step(-1)});
     el.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();step(e.deltaY>0?1:-1)},{passive:false});
     el.addEventListener('keydown',e=>{if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();e.stopPropagation();step(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)}});
   }
   el.addEventListener('pointerdown',e=>e.stopPropagation());
   return el;
 }
 function createLamp(l){
   const el=root.createElement('span');el.dataset.role='lamp';el.dataset.lamp=l.id;
   el.title=l.label+' · '+system+' logic';
   // Each photograph has its own physical lamp apertures.  Use measured
   // center AND independent width/height, never a common arbitrary lamp size.
   const [x,y,w,h]=model.lampFace(system,l.id);
   pos(el,[x,y]);
   el.style.width=(w*100)+'%';el.style.height=(h*100)+'%';
   // Scale the inner lamp FACE only. The photographed frame never moves.
   // Measured boxes keep their centers; neighbouring faces cannot overlap.
   const fit=model.config(system).lampFit;
   el.style.scale=fit.x+' '+fit.y;
   el.dataset.faceSystem=system;
   el.classList.add(l.id==='auto-fail'||l.id==='off-sched'?'amber':'green');
   if(approvedLamps[l.id]){
     el.dataset.asset=approvedLamps[l.id];
     const approved=root.createElement('img');
     approved.alt=l.label;
     approved.draggable=false;
     Object.assign(approved.style,{display:'block',width:'100%',height:'100%',maxWidth:'none',maxHeight:'none',objectFit:'fill',pointerEvents:'none'});
     approved.src=lampBase+approvedLamps[l.id]+'_OFF.svg';
     el.replaceChildren(approved);
   } else if(l.id==='altn') {
     // Owner's DCPCS label is "ALTN", not the separately archived
     // "ALTEN" spare lamp. Draw the exact legend without duplicating bezel.
     el.textContent='ALTN';
     el.classList.add('oh22-altn-face');
   } else {
     el.textContent=l.label;
   }
   return el;
 }
 function build(){
   if(layer)layer.remove();
   if(holdTimer!==null){clearInterval(holdTimer);holdTimer=null;activeSpring=null;}
   controls.clear();lamps.clear();digits.clear();
   layer=root.createElement('div');layer.className='oh22-pressure-controls';layer.dataset.system=system;
   const cfg=model.config(system);
   for(const lamp of cfg.lamps){const node=createLamp(lamp);layer.append(node);lamps.set(lamp.id,node);}
   for(const display of cfg.displays){
     const node=root.createElement('output');node.className='oh22-pressure-digits';node.dataset.display=display.id;pos(node,display.xy);
     if(display.width)node.style.width=display.width*100+'%';
     if(display.height)node.style.height=display.height*100+'%';
     layer.append(node);digits.set(display.id,node);
   }
   for(const control of cfg.controls){const node=createActuator(control);layer.append(node);controls.set(control.id,node);}
   if(system==='DCPCS'){
     gauge=root.createElement('output');gauge.className='oh22-pressure-gauge';gauge.dataset.known='false';gauge.textContent='—';gauge.title='Actual outflow valve position is not calculated';
     layer.append(gauge);
   }else gauge=null;
   caption=root.createElement('output');caption.className='oh22-pressure-note';caption.textContent=system+' · waiting for selected engine';layer.append(caption);
   plate.append(layer);
   received=null;
   requestState();
 }
 function dispatch(c,value){
   try{const payload=model.command(system,c.id,value,received?.state);sendCommand(payload);}
   catch(error){caption.textContent=error.message;console.warn('OH22 control rejected',error);}
 }
 function sendCommand(command){
   if(parent===window){localCommand(command);return;}
   notify('pressurization-command',{command});
 }
 function requestState(){if(parent===window){localState();return;}notify('pressurization-need-state');}
 function localState(){
   const engine=window[model.config(system).engine];if(!engine)return;
   if(!fallback||fallback.system!==system)fallback={system,engine,state:engine.initial()};
   accept({type:'b737:cockpit-command',action:'pressurization-state',system,output:engine.derive(fallback.state),state:fallback.state});
 }
 function localCommand(command){
   if(!fallback||fallback.system!==system)localState();
   if(!fallback)return;
   try{fallback.state=fallback.engine.apply(fallback.state,command);localState()}catch(error){caption.textContent=error.message;}
 }
 function accept(message){
   if(message.system!==system||!message.output||!message.state)return;
   received={state:message.state,output:message.output};
   paint();
 }
 function paint(){
   if(!received)return;
   const {state,output}=received,cfg=model.config(system);
   const values=model.lamps(system,output);
   // The parent "test all lights" switch and the native overhead lamp-test
   // must override BOTH CPCS and DCPCS annunciators without mutating either
   // engine's real fault/logic state.
   const lampTest=document.documentElement.classList.contains('cockpit-visual-test')||
     window.B737OverheadLights?.getState?.()?.lampTest===true;
   for(const l of cfg.lamps){const n=lamps.get(l.id);if(!n)continue;const lit=lampTest||values[l.id];n.classList.toggle('on',lit);n.dataset.lit=String(lit);n.setAttribute('aria-label',l.label+' '+(lit?'ON':'OFF'));if(n.dataset.asset){const img=n.querySelector('img'),next=lampBase+n.dataset.asset+'_'+(lit?'ON':'OFF')+'.svg';if(img&&img.src!==next)img.src=next;}}
   for(const c of cfg.controls){
     const n=controls.get(c.id);if(!n)continue;
     const value=model.readControl(system,c,state),label=n.querySelector('.oh22-control-value');
     if(c.kind==='momentary'){label.textContent='CHECK';continue;}
     label.textContent=value==null?'—':String(value);
     n.setAttribute('aria-valuetext',String(value));
     let angle=0;
     if(c.kind==='altitude')angle=-155+310*(Number(value)-c.min)/(c.max-c.min);
     else if(c.kind==='selector')angle=(system==='DCPCS'&&c.id==='press-mode'?-45:-65)+(system==='DCPCS'&&c.id==='press-mode'?90:130)*(c.states.indexOf(value)/Math.max(1,c.states.length-1));
     else if(c.kind==='spring')angle=value==='CLOSE'?-24:value==='OPEN'?24:0;
     const img=n.querySelector('img');if(img)img.style.transform='rotate('+angle+'deg)';
   }
   for(const d of cfg.displays){
     const el=digits.get(d.id);
     if(el){const v=model.readDisplay(system,d,state);el.textContent=v===null?'—':String(v);}
   }
   if(gauge){
     const manual=output.operatingMode==='MAN';
     const modelFraction=output.physical?.valveOpenFraction;
     const physicalKnown=typeof modelFraction==='number'&&Number.isFinite(modelFraction);
     gauge.dataset.known=String(physicalKnown||manual);
     gauge.textContent=physicalKnown?Math.round(modelFraction*100)+'%':manual?Math.round(output.manualValveFraction*100)+'%':'';
     gauge.title=physicalKnown?'Training plant estimated outflow opening; not aircraft-measured':
       manual?'Illustrative MAN motor stroke only':'Actual valve position unknown without a pressure plant';
   }
   caption.textContent=system+'  ·  '+(output.operatingMode||'UNKNOWN')+'  ·  '+(output.outflowCommand||output.outflow?.command||'NOT CALCULATED');
   layer.dataset.mode=output.operatingMode||'UNKNOWN';
   layer.dataset.lampTest=String(lampTest);
 }
 function setSystem(next){
   if(next!=='CPCS'&&next!=='DCPCS')return;
   if(system===next&&layer?.isConnected){requestState();return;}
   system=next;
   if(mount())build();
 }
 window.addEventListener('b737:pressure-configuration',event=>setSystem(event.detail?.system));
 // Visual test is sourced from the cockpit toolbar; the native lamp test is
 // sourced from the same overhead lamp controller as all other annunciators.
 window.addEventListener('b737:pressure-light-test',()=>paint());
 window.addEventListener('b737:overhead-light-state',()=>paint());
 window.addEventListener('storage',event=>{if(event.key===PROFILE_KEY)setSystem(savedSystem());});
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='b737:cockpit-command')return;
   if(event.data.action==='pressurization-state')accept(event.data);
   if(event.data.action==='pressurization-background')setSystem(event.data.system);
 });
 const mo=new MutationObserver(()=>{if(mount()){mo.disconnect();window.document.documentElement.classList.add('oh22-pressure-config-active');}});
 mo.observe(atlas,{childList:true,subtree:true});
 system=savedSystem();mount();
 window.B737OH22Pressurization=Object.freeze({getSystem:()=>system,requestState,setSystem});
})();
