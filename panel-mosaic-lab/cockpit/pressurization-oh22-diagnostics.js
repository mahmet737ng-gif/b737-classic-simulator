/* Read-only OH22 audit. Does not actuate switches or alter aircraft state.
 * Verified registry geometry != source-photo alignment. Visual acceptance
 * is always separately required for CPCS and DCPCS.
 */
(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737OH22DiagnosticV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(root){'use strict';
 const VERSION='OH22-DIAG-0001';
 const SEVERITY=['CRITICAL','ERROR','WARNING','INFO'];
 const round=(v,n=2)=>Number.isFinite(v)?Number(v.toFixed(n)):null;
 function analyze(snapshot){
   if(!snapshot||!['CPCS','DCPCS'].includes(snapshot.system))throw Error('Invalid OH22 diagnostic snapshot');
   const issues=[],s=snapshot,system=s.system;
   const add=(severity,code,message,component='OH22',evidence=null)=>issues.push({severity,code,message,component,evidence});
   if(!s.platePresent)add('CRITICAL','PANEL_NOT_MOUNTED','OH22 plate is missing from the current atlas');
   if(!s.layerPresent)add('CRITICAL','OVERLAY_NOT_MOUNTED','Selected OH22 overlay is not mounted');
   if(s.layerSystem&&s.layerSystem!==system)add('CRITICAL','PROFILE_MISMATCH','OH22 overlay belongs to the wrong pressurization variant','CONFIG',{selected:system,overlay:s.layerSystem});
   if(!s.stateAvailable)add('ERROR','NO_ENGINE_STATE','Controller state has not arrived from Unified','STATE');
   if(s.stateAvailable&&!s.engineMatches)add('ERROR','ENGINE_MODE_MISMATCH','Output mode and controller selection disagree','STATE');
   if(s.lampTestActive)add('INFO','LAMP_TEST_ACTIVE','Current illumination is a visual light-test override; do not interpret it as live faults','LAMPS');
   for(const item of s.controls||[]){
     if(!item.present){add('ERROR','CONTROL_MISSING','Declared control has no mounted actuator: '+item.id,item.id);continue;}
     if(!item.enabled)add('ERROR','CONTROL_NOT_INTERACTIVE','Actuator has no interactive pointer target: '+item.id,item.id);
     if(item.centerErrorPx!=null&&item.centerErrorPx>3)add('ERROR','ANCHOR_RUNTIME_DRIFT','Mounted actuator drifted from registered OH22 coordinates: '+item.id,item.id,{pixelDeviation:item.centerErrorPx});
     if(item.outsidePlate)add('ERROR','CONTROL_OUTSIDE_PANEL','Control extends outside OH22 plate: '+item.id,item.id);
     if(item.assetBroken)add('ERROR','ACTUATOR_ASSET_FAILED','Control graphic failed loading: '+item.id,item.id);
     if(item.calibrationProvisional)add('WARNING','UNVERIFIED_SOCKET','Photographic socket center is provisional: '+item.id,item.id);
     if(item.spriteOverscale!=null&&item.spriteOverscale>1.8)add('WARNING','SPRITE_OVERSCALE','Metal toggle sprite extends beyond nominal hotspot; pixel-level socket fitting required: '+item.id,item.id,{spriteScale:item.spriteOverscale});
   }
   for(const id of s.missingControls||[])add('ERROR','CONTROL_REGISTRY_INCOMPLETE','Control is declared in registry but not rendered: '+id,id);
   for(const item of s.displays||[]){
     if(!item.present)add('ERROR','DISPLAY_MISSING','Registered numerical readout is not mounted: '+item.id,item.id);
     else if(item.valueMismatch)add('ERROR','DISPLAY_STATE_MISMATCH','Displayed value disagrees with selected controller snapshot: '+item.id,item.id,{expected:item.expected,actual:item.actual});
     if(item?.overflow)add('ERROR','DIGITS_CLIPPED','Numeric readout overflows its panel window: '+item.id,item.id);
   }
   for(const item of s.lamps||[]){
     if(!item.present){add('ERROR','LAMP_MISSING','Lamp face not mounted: '+item.id,item.id);continue;}
     if(item.error)add('ERROR','LAMP_WRONG_STATE','Lamp DOM does not match expected state: '+item.id,item.id,{expected:item.expected,actual:item.actual});
     if(item.assetBroken)add('ERROR','LAMP_ASSET_FAILED','Lamp image was not loaded: '+item.id,item.id);
     if(item.outsidePlate)add('ERROR','LAMP_OUTSIDE_PANEL','Lamp extends beyond physical OH22 plate: '+item.id,item.id);
     if(item.centerErrorPx!=null&&item.centerErrorPx>3)add('ERROR','LAMP_RUNTIME_DRIFT','Lamp moved from configured reference geometry: '+item.id,item.id);
   }
   for(const item of s.overlapPairs||[]){
     const code=item.hotspot?'HITBOX_COLLISION':'CONTROL_OVERLAP';
     add(item.hotspot?'WARNING':'ERROR',code,'OH22 active regions overlap: '+item.a+' / '+item.b,'GEOMETRY',{fraction:round(item.fraction)});
   }
   if(s.visibleFraction!=null&&s.visibleFraction<0.75)add('INFO','ZOOM_VIEW_CLIPPING','OH22 is partly outside the current viewer. Zoom out or use FIT to inspect every lamp and switch','VIEW',{visibleFraction:round(s.visibleFraction)});
   if(system==='CPCS'){
     if(!s.valveIndicatorPresent)add('WARNING','CPCS_VALVE_INDICATOR_UNMAPPED','CPCS valve-position aperture has no mapped source indication','VALVE');
     if(!s.hornCutoutPresent)add('WARNING','CPCS_HORN_CUTOUT_UNWIRED','ALT HORN CUTOUT on neighbouring OH19 has no interactive click region','HORN');
     if(s.hornCutoutPresent&&s.hornCutoutOutside)add('ERROR','CPCS_HORN_TARGET_OUTSIDE_OH19','Cabin horn button click surface is outside the OH19 photo circle','HORN');
     if(!s.detentHotspotsPresent)add('WARNING','CPCS_DETENT_HIT_TARGETS_MISSING','Direct-click rotary detent legends not available for every label','MODE');
     if(!s.detentCalibrated)add('WARNING','CPCS_DETENT_NOT_PHOTO_VERIFIED','CPCS rotary angle/end-stop geometry is not yet source-photo calibrated','MODE');
   } else if(!s.detentCalibrated)add('WARNING','DCPCS_DETENT_NOT_PHOTO_VERIFIED','DCPCS rotary angle/end-stop geometry is not yet source-photo calibrated','MODE');
   if(s.noPhysics)add('WARNING','PHYSICAL_FEEDBACK_UNAVAILABLE','No cabin pressure feedback has reached the selected controller','ENGINE');
   if(s.unknownBus)add('INFO','POWER_SOURCE_UNVERIFIED','Actual electrical feeder for the selected controller remains unverified','ELECTRICAL');
   const summary=Object.fromEntries(SEVERITY.map(k=>[k,issues.filter(e=>e.severity===k).length]));
   return {schema:'b737-oh22-diagnostic/1',version:VERSION,system,summary,issues,metrics:{
     controlsRegistered:(s.controls||[]).length,lampsRegistered:(s.lamps||[]).length,displaysRegistered:(s.displays||[]).length,
     visibleFraction:s.visibleFraction==null?null:round(s.visibleFraction),pressureFeedback:!s.noPhysics,
     sourceGeometryVerified:false},scope:'BROWSER_LIVE_DOM_AND_CONTROLLER_PROJECTION_ONLY',limitations:[
       'Registration-match checks do not prove alignment with original photograph',
       'No write commands, simulated faults or light-test actions were executed',
       'This is not aircraft certification or a validated hardware wiring audit'
     ]};
 }
 function rect(node){return node&&typeof node.getBoundingClientRect==='function'?node.getBoundingClientRect():null;}
 const area=r=>r?Math.max(0,r.width)*Math.max(0,r.height):0;
 function overlap(a,b){if(!a||!b)return 0;return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
 function centerError(node,xy,plate){
   if(!node||!plate)return null;
   const a=rect(node);if(!a)return null;
   return Math.hypot((a.left+a.width/2)-(plate.left+plate.width*xy[0]),(a.top+a.height/2)-(plate.top+plate.height*xy[1]));
 }
 function browserSnapshot(){
   const model=root?.B737OH22PressureModel,api=root?.B737OH22Pressurization,doc=root?.document;
   if(!doc||!model||!api)throw Error('OH22 browser dependencies missing');
   const system=api.getSystem(),cfg=model.config(system);
   const plate=doc.querySelector('#atlasAbsolute .atlas-piece[data-key="OH22"]'),layer=plate?.querySelector('.oh22-pressure-controls');
   const p=rect(plate),w=root.B737OverheadLights?.getState?.();
   const live=api.getDiagnosticSnapshot?.()||null;
   const engine=live?.output||{},state=live?.state||{},stateAvailable=!!live;
   const expectedMode=system==='CPCS'?state.selectedMode:state.selector;
   const controls=cfg.controls.map(c=>{
     const el=layer?.querySelector('[data-role="actuator"][data-control="'+c.id+'"]'),r=rect(el);
     const img=el?.querySelector('img'),face=el?.querySelector('.oh22-small-silver-face');
     let spriteOverscale=null;
     if(face&&el){
       const fw=parseFloat(root.getComputedStyle(face).width),cw=parseFloat(root.getComputedStyle(el).width);
       if(Number.isFinite(fw)&&Number.isFinite(cw)&&cw>0)spriteOverscale=fw/cw;
     }
     return {id:c.id,present:!!el,enabled:!!el&&root.getComputedStyle(el).pointerEvents!=='none'&&!el.disabled,
       centerErrorPx:centerError(el,c.xy,p),outsidePlate:!!(r&&p&&(r.left<p.left-3||r.right>p.right+3||r.top<p.top-3||r.bottom>p.bottom+3)),
       assetBroken:!!(img&&img.complete&&img.naturalWidth===0),calibrationProvisional:!!c.visualCalibration&&/provisional|screenshot-position-only/i.test(c.visualCalibration),
       spriteOverscale};
   });
   const displays=cfg.displays.map(d=>{
     const el=layer?.querySelector('[data-role="display"][data-display="'+d.id+'"],.oh22-pressure-digits[data-display="'+d.id+'"]');
     const expected=model.readDisplay(system,d,state),actual=el?.textContent?.trim();
     return {id:d.id,present:!!el,valueMismatch:stateAvailable&&!!el&&actual!==String(expected??'—'),expected,actual,
       overflow:!!(el&&el.scrollWidth>el.clientWidth+3)};
   });
   const lampTestActive=doc.documentElement.classList.contains('cockpit-visual-test')||w?.lampTest===true;
   const derived=model.lamps(system,engine);
   const lamps=cfg.lamps.map(l=>{
     const el=layer?.querySelector('[data-role="lamp"][data-lamp="'+l.id+'"]'),r=rect(el);
     const expected=lampTestActive||derived[l.id],actual=el?.dataset.lit==='true';
     const img=el?.querySelector('img');
     return {id:l.id,present:!!el,expected,actual,error:stateAvailable&&!!el&&expected!==actual,
       centerErrorPx:centerError(el,l.xy,p),assetBroken:!!(img&&img.complete&&img.naturalWidth===0),
       outsidePlate:!!(r&&p&&(r.left<p.left-3||r.right>p.right+3||r.top<p.top-3||r.bottom>p.bottom+3))};
   });
   const overlapPairs=[];
   const nodes=[...cfg.controls].map(c=>({id:c.id,kind:c.kind,el:layer?.querySelector('[data-role="actuator"][data-control="'+c.id+'"]')})).filter(x=>x.el);
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
     const a=nodes[i],b=nodes[j],ar=rect(a.el),br=rect(b.el);
     const ratio=overlap(ar,br)/Math.max(1,Math.min(area(ar),area(br)));
     if(ratio>.18)overlapPairs.push({a:a.id,b:b.id,hotspot:a.kind==='momentary'||b.kind==='momentary',fraction:ratio});
   }
   const view=rect(doc.querySelector('#viewport'));
   const visibleFraction=p&&view?overlap(p,view)/Math.max(1,area(p)):null;
   // The physical pushbutton is on the OH19-DIFF tile, NOT OH22.
   const hornPlate=doc.querySelector('#atlasAbsolute .atlas-piece[data-key="OH19-DIFF"]');
   const horn=hornPlate?.querySelector('.oh22-physical-horn-cutout');
   const hornBox=rect(horn),hornRegion=rect(hornPlate);
   const hornOutside=!!(hornBox&&hornRegion&&(hornBox.left<hornRegion.left-3||
     hornBox.right>hornRegion.right+3||hornBox.top<hornRegion.top-3||hornBox.bottom>hornRegion.bottom+3));
   const labelDefs=cfg.detentLabels||{};
   const detentHotspotsPresent=Object.entries(labelDefs).every(([id,positions])=>
     positions.every(d=>(id==='cabin-rate'&&d.value==='INDEX')||
       !!layer?.querySelector('[data-detent-for="'+id+'"][data-detent="'+d.value+'"]')));
   const cap=layer?.querySelector('.oh22-pressure-note');
   return {system,platePresent:!!plate,layerPresent:!!layer,layerSystem:layer?.dataset.system||null,
     stateAvailable,engineMatches:!stateAvailable||engine.selectedMode===expectedMode,controls,lamps,displays,overlapPairs,visibleFraction,
     lampTestActive,valveIndicatorPresent:system==='CPCS'?!!layer?.querySelector('.oh22-pressure-gauge[data-system="CPCS"] .oh22-valve-pointer'):!!layer?.querySelector('.oh22-pressure-gauge'),
     hornCutoutPresent:!!horn,hornCutoutOutside:hornOutside,detentHotspotsPresent,
     detentCalibrated:false,noPhysics:!engine.physical,unknownBus:true,clockMs:state.clockMs??null,outputMode:engine.operatingMode||null,
     layerCaption:cap?.textContent||null};
 }
 function inspect(){const s=browserSnapshot(),report=analyze(s);report.observed={clockMs:s.clockMs,mode:s.outputMode,controllerCaption:s.layerCaption,scanTime:new Date().toISOString()};return report;}
 function setOverlay(enabled){
   const doc=root?.document;
   if(!doc)return;
   doc.documentElement.classList.toggle('oh22-diagnostic-visible',!!enabled);
   let style=doc.getElementById('oh22-diagnostic-overlay-css');
   if(!style){style=doc.createElement('style');style.id='oh22-diagnostic-overlay-css';
     style.textContent='html.oh22-diagnostic-visible .oh22-pressure-controls [data-role="actuator"]{outline:2px solid #30e7e0!important;outline-offset:2px!important}html.oh22-diagnostic-visible .oh22-pressure-controls [data-role="lamp"]{outline:2px solid #f8ca65!important}html.oh22-diagnostic-visible .oh22-pressure-controls .oh22-pressure-digits{outline:1px solid #8ed8ff!important}';
     doc.head.append(style);}
 }
 if(root&&root.addEventListener&&root.document){
   root.addEventListener('message',e=>{
     if(e.origin!==root.location.origin||e.source!==root.parent||e.data?.type!=='b737:cockpit-command')return;
     if(e.data.action==='pressurization-diagnostics-request'){
       try{const report=inspect();if(root.parent!==root)root.parent.postMessage({type:'b737:cockpit-overhead',kind:'pressurization-diagnostics-result',system:report.system,requestId:e.data.requestId,report},e.origin);}
       catch(error){if(root.parent!==root)root.parent.postMessage({type:'b737:cockpit-overhead',kind:'pressurization-diagnostics-error',requestId:e.data.requestId,error:String(error.message)},e.origin);}
     }
     if(e.data.action==='pressurization-diagnostics-overlay')setOverlay(e.data.enabled===true);
   });
 }
 return Object.freeze({VERSION,analyze,browserSnapshot,inspect,setOverlay});
});
