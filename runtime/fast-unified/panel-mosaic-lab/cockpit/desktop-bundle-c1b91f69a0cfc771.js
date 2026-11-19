(async()=>{
;
/* ./flap-needles-model.js?v=FLP-0001 */
try{
(function(root,factory){
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737FlapNeedlesModel=model;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Angle offsets from UP, measured clockwise against the approved blank gauge.
 // These are visual needle-stop calibrations, not a flap asymmetry alarm threshold.
 const stops=Object.freeze([
  {value:0,angle:0},{value:1,angle:38},{value:2,angle:78},
  {value:5,angle:116},{value:10,angle:148},{value:15,angle:180},
  {value:25,angle:218},{value:30,angle:244},{value:40,angle:270}
 ].map(p=>Object.freeze(p)));
 function validate(value){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>40)throw Error('Flap position must be a finite number from 0 to 40');
  return value;
 }
 function angle(value){
  validate(value);
  for(let i=1;i<stops.length;i++)if(value<=stops[i].value){
   const a=stops[i-1],b=stops[i],t=(value-a.value)/(b.value-a.value);
   return a.angle+(b.angle-a.angle)*t;
  }
  return stops[stops.length-1].angle;
 }
 function make(){
  let left=0,right=0,mode='common';
  return Object.freeze({
   read:()=>Object.freeze({left,right,mode,leftAngle:angle(left),rightAngle:angle(right),rightOccluded:angle(left)===angle(right)}),
   setCommon(value){left=right=validate(value);mode='common';return this.read();},
   setIndependent(values){if(!values||typeof values!=='object')throw Error('Both flap positions required');
    const l=validate(values.left),r=validate(values.right);
    left=l;right=r;mode='independent';return this.read();}
  });
 }
 return Object.freeze({stops,angle,validate,make});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flap-needles.js?v=FLP-0001 */
try{
(function(){
 'use strict';
 const model=window.B737FlapNeedlesModel;
 const engine=model.make();
 const ns='http://www.w3.org/2000/svg';
 const source={pieceId:'fo-inner',width:918,height:1713,centerX:95,centerY:291,overlaySize:145};
 let mounted=false,svg,groups={},status,leftInput,rightInput;
 function element(parent,tag,attrs={}){
  const node=document.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);return node;
 }
 function makePointer(label){
  // Paint order is part of the physical model: R must be added before L.
  const group=element(svg,'g',{class:'flap-pointer','data-side':label});
  element(group,'path',{class:'needle-body',d:'M 58 250 Q 91 243 122 234 L 247 232 L 247 268 L 122 266 Q 91 257 58 250 Z'});
  element(group,'path',{class:'needle-glint',d:'M 61 249 L 124 238 L 230 238 L 230 244 L 123 244 Z'});
  const text=element(group,'text',{class:'needle-letter',x:166,y:251});text.textContent=label;
  groups[label]=group;
 }
 function paint(){
  if(!mounted)return;
  const s=engine.read();
  groups.R.style.transform=`rotate(${s.rightAngle}deg)`;
  groups.L.style.transform=`rotate(${s.leftAngle}deg)`;
  if(status)status.textContent=`L ${s.left}° / R ${s.right}° · ${s.rightOccluded?'R OCCLUDED':'R VISIBLE'} · ${s.mode.toUpperCase()}`;
  if(leftInput)leftInput.value=String(s.left);
  if(rightInput)rightInput.value=String(s.right);
  svg.dataset.rOccluded=String(s.rightOccluded);
 }
 function common(v){const state=engine.setCommon(v);paint();return state;}
 function independent(p){const state=engine.setIndependent(p);paint();return state;}
 function controls(){
  const section=document.createElement('section');section.className='flap-needle-tools';section.id='unifiedFlapNeedles';
  section.innerHTML='<h2>Flap Indicator · L / R</h2><p class="muted">R is always underneath L; when both indications match, R is hidden.</p><label>LEFT (L)<select id="flapLeftTest"></select></label><label>RIGHT (R)<select id="flapRightTest"></select></label><output class="flap-status" id="flapNeedleStatus"></output><button type="button" id="flapFollowCommon">Return to Common Flap Signal</button><small>Independent needle deflection is a visual test only. FLAP SPLIT detection and warnings require documented thresholds.</small>';
  const before=document.querySelector('.cdu-tools')||document.querySelector('.overhead-tools');before.before(section);
  leftInput=section.querySelector('#flapLeftTest');rightInput=section.querySelector('#flapRightTest');status=section.querySelector('#flapNeedleStatus');
  for(const sel of [leftInput,rightInput])for(const stop of model.stops){const o=document.createElement('option');o.value=String(stop.value);o.textContent=stop.value===0?'UP':String(stop.value);sel.append(o);}
  const set=()=>independent({left:Number(leftInput.value),right:Number(rightInput.value)});
  leftInput.addEventListener('change',set);rightInput.addEventListener('change',set);
  section.querySelector('#flapFollowCommon').addEventListener('click',()=>common(window.B737CockpitLights?.getState()?.inputs?.trailingFlaps??0));
 }
 async function mount(){
  if(mounted)return;
  const assembly=await fetch('./assembly.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Flap gauge assembly unavailable');return r.json();});
  const main=assembly.regions.find(r=>r.id==='main'),piece=main?.placements.find(p=>p.id===source.pieceId);
  if(!piece||!main)throw Error('Flap gauge source piece missing');
  const native=document.querySelector('#region-main .region-native');if(!native)return;
  const factor=piece.w/assembly.assets[piece.asset].dimensions[0];
  const x=piece.x+source.centerX*factor,y=piece.y+source.centerY*factor;
  const size=source.overlaySize*factor;
  svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 500 500');svg.setAttribute('aria-label','Flap position needles: R behind L');svg.classList.add('flap-needle-overlay');
  Object.assign(svg.style,{left:(x-size/2)+'px',top:(y-size/2)+'px',width:size+'px',height:size+'px'});
  makePointer('R');makePointer('L');element(svg,'circle',{class:'needle-hub',cx:250,cy:250,r:60});native.append(svg);
  controls();mounted=true;paint();
 }
 // The model always keeps separate R/L values, even when the normal input drives both equally.
 window.B737FlapNeedles=Object.freeze({getState:()=>engine.read(),setPositions:independent,setCommon:common});
 window.addEventListener('b737:cockpit-mounted',()=>mount().catch(console.error),{once:true});
 window.addEventListener('b737:trailing-flaps',e=>{if(engine.read().mode==='common'&&Number.isFinite(e.detail?.position))common(e.detail.position);});
 window.addEventListener('b737:flap-positions',e=>{try{independent(e.detail);}catch(error){console.error('Invalid L/R flap sensor input',error);}});
 if(document.querySelector('#region-main .region-native'))mount().catch(console.error);
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fuel-temperature-needle-model.js?v=FTN-0002-SOURCEQA */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737FuelTemperatureNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Source: OH09-FUEL-921977b56887.png. Never resample or edit that locked image.
 const source=Object.freeze({piece:'OH09',width:1012,height:1555,pivotX:506,pivotY:235,tipRadius:136,hubRadius:25});
 // Nine printed numeric ticks registered against original OH09 source pixels
 // (native image 1012 x 1555). The source-image radial
 // luminance survey `tools/fuel-temperature-tick-scan.py` detects long
 // tick candidates and finds NONLINEAR angular spacing. Interim visual
 // calibration: all 81 integer values use per-segment interpolation.
 // Full inner-tick endpoint/source approval remains pending.
 const ticks=Object.freeze([
  [-40,-92],[-30,-69],[-20,-47.5],[-10,-24.5],
  [0,0.5],[10,24],[20,47],[30,69],[40,91]
 ].map(([celsius,bearing])=>Object.freeze({celsius,bearing,evidence:'native_raster_brightness_peak_candidate'})));
 const spec=Object.freeze({min:-40,max:40,defaultCelsius:10,
  minAngle:ticks[0].bearing,maxAngle:ticks.at(-1).bearing,
  referenceAngle:29,durationMs:320,
  printedMajorTickCount:ticks.length,nativeMajorTicksProvisional:true});
 const clamp=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))throw Error('Fuel temperature must be finite');
  return Math.max(spec.min,Math.min(spec.max,n));
 };
 function angle(value){
  const n=clamp(value);
  for(let i=1;i<ticks.length;i++)if(n<=ticks[i].celsius){
   const a=ticks[i-1],b=ticks[i],u=(n-a.celsius)/(b.celsius-a.celsius);
   return a.bearing+u*(b.bearing-a.bearing);
  }
  return ticks.at(-1).bearing;
 }
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH09 placement');
  const size=512*(source.tipRadius/(256-62))*(piece.w/source.width);
  return {x:piece.x+source.pivotX*piece.w/source.width,
   y:piece.y+source.pivotY*piece.h/source.height,size,
   hubMaskRadius:source.hubRadius*(piece.w/source.width)*(512/size)};
 }
 return Object.freeze({source,spec,ticks,clamp,angle,rotationDelta:value=>angle(value)-spec.referenceAngle,placement});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fuel-temperature-unified.js?v=FTN-0002-SOURCEQA */
try{
(function(){
 'use strict';
 const model=window.B737FuelTemperatureNeedleModel;
 const ns='http://www.w3.org/2000/svg';
 let frame=null;
 let temperature=model.spec.defaultCelsius,needle=null,output=null,input=null;
 const asset=new URL('./fuel-temperature-needle.svg?v=FTN-0001',document.baseURI).href;
 const svg=(doc,parent,tag,attrs={})=>{
  const el=doc.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));
  parent.append(el);return el;
 };
 function render(){
  if(needle)needle.style.transform=`rotate(${model.rotationDelta(temperature)}deg)`;
  if(input)input.value=String(temperature);
  if(output)output.textContent=`${temperature.toFixed(0)} °C`;
 }
 function setTemperature(value){temperature=model.clamp(value);render();return temperature;}
 function mount(doc,host){
  if(host.querySelector('[data-fuel-temperature-needle]'))return;
  const piece=host.querySelector('.atlas-piece[data-key="OH09"]');
  if(!piece)return;
  const p=model.placement({x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)});
  const layer=svg(doc,host,'svg',{'data-fuel-temperature-needle':'FTN-0001',viewBox:'0 0 512 512',role:'img','aria-label':'Fuel temperature pointer, independent vector overlay'});
  Object.assign(layer.style,{position:'absolute',left:`${p.x-p.size/2}px`,top:`${p.y-p.size/2}px`,width:`${p.size}px`,height:`${p.size}px`,zIndex:'1000',overflow:'visible',pointerEvents:'none',transformOrigin:'50% 50%',transition:`transform ${model.spec.durationMs}ms ease-out`});
  const defs=svg(doc,layer,'defs');
  const mask=svg(doc,defs,'mask',{id:'fuel-temperature-pivot-clearance',maskUnits:'userSpaceOnUse',x:0,y:0,width:512,height:512});
  svg(doc,mask,'rect',{x:0,y:0,width:512,height:512,fill:'#fff'});
  // The pivot disk is part of the untouched photo; the needle passes behind it.
  svg(doc,mask,'circle',{cx:256,cy:256,r:p.hubMaskRadius,fill:'#000'});
  svg(doc,layer,'image',{href:asset,width:512,height:512,x:0,y:0,mask:'url(#fuel-temperature-pivot-clearance)'});
  needle=layer;render();
 }
 function bindFrame(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  if(host.querySelector('.atlas-piece[data-key="OH09"]')){mount(doc,host);return;}
  const observer=new MutationObserver(()=>{
   if(host.querySelector('.atlas-piece[data-key="OH09"]')){observer.disconnect();mount(doc,host);}
  });
  observer.observe(host,{childList:true});
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedFuelTemperatureNeedle';
  section.innerHTML='<h2>Fuel Temperature · Needle</h2><p class="muted">White needle on OH09; original panel photo unchanged.</p><label for="fuelTemperatureNeedleInput">Fuel temperature (°C)</label><input type="range" id="fuelTemperatureNeedleInput" min="-40" max="40" step="1" value="10" style="width:100%;accent-color:#d5eaf4"><output id="fuelTemperatureNeedleOutput" dir="ltr" style="display:block;text-align:left">10 °C</output><button type="button" id="fuelTemperatureNeedleReset">Default · 10°C</button>';
  const after=document.querySelector('#unifiedFlapNeedles'),before=document.querySelector('.overhead-tools');
  if(after)after.after(section);else before.before(section);
  input=section.querySelector('input');output=section.querySelector('output');
  input.addEventListener('input',()=>setTemperature(Number(input.value)));
  section.querySelector('button').addEventListener('click',()=>setTemperature(model.spec.defaultCelsius));
  render();
 }
 window.B737UnifiedFuelTemperature=Object.freeze({getTemperature:()=>temperature,setTemperature});
 window.addEventListener('b737:fuel-temperature',event=>{
  const value=event.detail?.celsius;
  if(value!==undefined)try{setTemperature(value);}catch(error){console.error(error);}
 });
 function connectFrame(){
  const next=document.getElementById('overheadFrame');
  if(!next||next===frame)return;
  frame=next;
  frame.addEventListener('load',()=>{needle=null;bindFrame();});
  bindFrame();
 }
 window.addEventListener('b737:cockpit-mounted',connectFrame);
 connectFrame();
 if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
