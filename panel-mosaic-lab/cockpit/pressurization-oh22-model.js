/* B737 Classic OH22 pressurization configurations, independent from the artwork.
 * Coordinates are normalized OH22 panel anchors calibrated against the owner's
 * 2026-10-25 Unified screenshot with the owner's approved DCPCS artwork
 * displayed edge-to-edge ('fill'). They are NOT shared with CPCS, whose
 * calibration remains independent. Layout is visual test fit pending owner QA;
 * no pixel coordinates of CPCS are inherited by DCPCS.
 * Physical pressure/servo motion is not invented here: commands go to the
 * independent source-linked engine implementations.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737OH22PressureModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const owner='panel-mosaic-lab/assets/locked/2026-10-23/DCPCS_Background_Owner.png';
 const layouts=Object.freeze({
   DCPCS:Object.freeze({
     engine:'B737DCPCSV4',backgroundAsset:owner,
     modes:['AUTO','ALTN','MAN'],artworkFit:'fill',calibrationAsset:owner,modePosition:[.72,.678],
     // Individual socket-relative VISUAL sizing; no pressure-system logic changes.
     controlFit:Object.freeze({'flight-alt':.157,'landing-alt':.157,'press-mode':.156,'manual-valve':.122}),
     lampFit:Object.freeze({x:1.09,y:1.13}),
     controls:[
       {id:'flight-alt',kind:'altitude',label:'FLT ALT',xy:[.325,.372],unit:'ft',key:'flightAltitudeFt',step:500,min:-1000,max:37000},
       {id:'landing-alt',kind:'altitude',label:'LAND ALT',xy:[.325,.676],unit:'ft',key:'landingAltitudeFt',step:50,min:-1000,max:14000},
       {id:'press-mode',kind:'selector',label:'MODE',xy:[.72,.678],states:['AUTO','ALTN','MAN']},
       {id:'manual-valve',kind:'spring',label:'MANUAL VALVE',xy:[.72,.453],states:['CLOSE','NEUTRAL','OPEN']}
     ],
     displays:[{id:'flight-display',xy:[.32,.207],field:'flightAltitudeFt'},{id:'landing-display',xy:[.32,.498],field:'landingAltitudeFt'}],
     // Inner rectangles of the four DCPCS lamp apertures, measured against
     // the owner's approved DCPCS photograph in its physical OH22 placement.
     // [centerX,centerY,width,height] normalized to this installation ONLY.
     // Each face is fitted within the underlying metal bezel; never redraw it.
     lampFaceCalibration:{asset:owner,version:'DCPCS-OH22-FACES-2'},
     lamps:[
       {id:'auto-fail',xy:[.219,.043],face:[.219,.043,.157,.050],output:'autoFail',label:'AUTO FAIL'},
       {id:'off-sched',xy:[.405,.043],face:[.405,.043,.157,.050],output:'offSchedDescent',label:'OFF SCHED DESCENT'},
       {id:'altn',xy:[.596,.043],face:[.596,.043,.157,.050],output:'altn',label:'ALTN'},
       {id:'manual',xy:[.782,.043],face:[.782,.043,.153,.050],output:'manual',label:'MANUAL'}
     ]
   }),
   CPCS:Object.freeze({
     engine:'B737CPCSV5',backgroundAsset:null,
     modes:['AUTO','STBY','MAN_AC','MAN_DC'],modePosition:[.805,.735],
     controlFit:Object.freeze({'flight-alt':.162,'landing-alt':.162,'standby-alt':.150,'cabin-rate':.154,'press-mode':.160,'manual-valve':.125}),
     lampFit:Object.freeze({x:1.075,y:1.13}),
     controls:[
       {id:'flight-alt',kind:'altitude',label:'FLT ALT',xy:[.288,.429],key:'flightAltitudeFt',unit:'ft',step:500,min:-1000,max:37000},
       {id:'landing-alt',kind:'altitude',label:'LAND ALT',xy:[.286,.729],key:'landingAltitudeFt',unit:'ft',step:50,min:-1000,max:14000},
       {id:'standby-alt',kind:'altitude',label:'STBY CABIN ALT',xy:[.584,.598],key:'standbyCabinAltitudeFt',unit:'ft',step:50,min:-1000,max:14000},
       {id:'cabin-rate',kind:'selector',label:'CABIN RATE',xy:[.553,.270],states:['DECR','INDEX','INCR']},
       {id:'press-mode',kind:'selector',label:'MODE',xy:[.805,.735],states:['AUTO','STBY','MAN_AC','MAN_DC']},
       {id:'manual-valve',kind:'spring',label:'MANUAL VALVE',xy:[.813,.475],states:['CLOSE','NEUTRAL','OPEN']},
       {id:'auto-check',kind:'momentary',label:'AUTO CHECK',xy:[.74,.805],appearance:'hotspot'}
     ],
     displays:[
       {id:'flight-display',xy:[.246,.259],field:'flightAltitudeFt',stateRoot:'settings',width:.272,height:.072},
       {id:'landing-display',xy:[.246,.573],field:'landingAltitudeFt',stateRoot:'settings',width:.272,height:.072},
       {id:'standby-display',xy:[.57,.425],field:'standbyCabinAltitudeFt',stateRoot:'settings',width:.215,height:.067}
     ],
     // Physical CPCS image has a DIFFERENT row spacing and aperture sizes.
     // Its source stays independent of DCPCS, including future image swaps.
     lampFaceCalibration:{asset:'OH22-CABIN-PRESSURIZATION-d1c6c39b6b33.png',version:'CPCS-OH22-FACES-2'},
     lamps:[
       {id:'auto-fail',xy:[.233,.056],face:[.233,.056,.159,.057],output:'autoFail',label:'AUTO FAIL'},
       {id:'off-sched',xy:[.412,.056],face:[.412,.056,.160,.057],output:'offSchedDescent',label:'OFF SCHED DESCENT'},
       {id:'standby',xy:[.590,.056],face:[.590,.056,.158,.057],output:'standby',label:'STANDBY'},
       {id:'manual',xy:[.766,.056],face:[.766,.056,.157,.057],output:'manual',label:'MANUAL'}
     ]
   })
 });
 const modes=Object.freeze(['CPCS','DCPCS']);
 function config(system){if(!modes.includes(system))throw Error('Unsupported pressure installation '+system);return layouts[system];}
 function validPoint(p){return Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=1);}
 function validFace(face){return Array.isArray(face)&&face.length===4&&face.every(v=>Number.isFinite(v)&&v>0&&v<1)&&face[0]-face[2]/2>=0&&face[0]+face[2]/2<=1&&face[1]-face[3]/2>=0&&face[1]+face[3]/2<=1;}
 function lampFace(system,id){const lamp=config(system).lamps.find(x=>x.id===id);if(!lamp||!validFace(lamp.face))throw Error('Missing measured lamp aperture '+system+' '+id);return lamp.face.slice();}
 function validate(){for(const system of modes){const c=config(system),ids=new Set();
     if(!c.lampFit||c.lampFit.x<=1||c.lampFit.y<=1)throw Error('Missing '+system+' lamp-fit');
     for(const control of c.controls)if(control.appearance!=='hotspot'&&!(c.controlFit[control.id]>.07&&c.controlFit[control.id]<.19))throw Error('Missing '+system+' actuator fit '+control.id);
     for(const part of [...c.controls,...c.lamps,...c.displays]){if(!validPoint(part.xy)||ids.has(part.id))throw Error('Invalid '+system+' OH22 '+part.id);ids.add(part.id);}
     if(!c.controls.some(c=>c.id==='press-mode')||!c.controls.some(c=>c.id==='manual-valve'))throw Error('Missing '+system+' controls');
     if(!c.lampFaceCalibration?.asset||c.lamps.length!==4)throw Error('Missing unique '+system+' lamp calibration');
     for(const lamp of c.lamps){if(!validFace(lamp.face)||Math.abs(lamp.face[0]-lamp.xy[0])>.000001||Math.abs(lamp.face[1]-lamp.xy[1])>.000001)throw Error('Invalid '+system+' lamp aperture '+lamp.id);}
   }return true;}
 function command(system,controlId,value,state){const c=config(system).controls.find(x=>x.id===controlId);if(!c)throw Error('Unknown '+system+' control '+controlId);
   if(c.kind==='altitude'){if(!Number.isFinite(value)||value<c.min||value>c.max||(system==='DCPCS'&&value%c.step!==0))throw Error('Out of range '+controlId);return system==='DCPCS'?{type:'INPUT',key:c.key,value}:{type:'ALTITUDE',key:c.key,value};}
   if(c.kind==='selector'){if(!c.states.includes(value))throw Error('Bad detent '+controlId);if(controlId==='press-mode')return {type:'MODE',value};if(controlId==='cabin-rate'&&system==='CPCS')return {type:'CABIN_RATE',value};if(controlId==='flight-ground'&&system==='CPCS')return {type:'FLIGHT_GROUND',value};}
   if(c.kind==='spring'){if(!c.states.includes(value))throw Error('Bad spring '+controlId);return system==='DCPCS'?{type:'MANUAL_SWITCH',value}:{type:'VALVE_SWITCH',value};}
   if(c.kind==='momentary'&&system==='CPCS'&&value==='CHECK')return {type:'AUTO_CHECK',pressed:true};
   throw Error('Unsupported action '+controlId);
 }
 function readDisplay(system,d,state){const record=d.stateRoot==='settings'?state?.settings:state?.input;return record?.[d.field]??null;}
 function readControl(system,c,state){if(system==='DCPCS'){const s=state||{};if(c.kind==='altitude')return s.input?.[c.key]??0;if(c.id==='press-mode')return s.selector||'AUTO';if(c.id==='manual-valve')return s.manualCommand||'NEUTRAL';}
 else {const s=state||{};if(c.kind==='altitude')return s.settings?.[c.key]??0;if(c.id==='press-mode')return s.selectedMode||'AUTO';if(c.id==='cabin-rate')return s.cabinRate||'INDEX';if(c.id==='flight-ground')return s.flightGround||'GRD';if(c.id==='manual-valve')return s.valveSwitch||'NEUTRAL';}
 return null;
 }
 function lamps(system,derived){const values=derived?.lamps||{};return Object.fromEntries(config(system).lamps.map(c=>[c.id,values[c.output]===true]));}
 return Object.freeze({layouts,modes,config,validate,lampFace,command,readControl,readDisplay,lamps});
});
