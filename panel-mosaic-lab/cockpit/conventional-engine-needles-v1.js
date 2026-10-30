/* CONV NEEDLES V1 — photo-derived ivory pointer mounted independently on
 * all sixteen conventional dial centers. Original EIS, protected cockpit
 * artwork, switches and instrument backend are never modified.
 */
(function(){
'use strict';
const svgNs='http://www.w3.org/2000/svg';
const getMount=()=>window.B737EngineIndicationModeV1?.wrap();
const getLayout=()=>window.B737EngineIndicationModeV1?.layout();
const PHOTO=new URL('./assets/conventional-needle-photo-v1.svg?v=CONV-NEEDLE-0001',document.baseURI).href;
const ROWS=Object.freeze([
 Object.freeze({key:'n1',label:'N1',y:309,min:0,max:120,primary:true,scale:1}),
 Object.freeze({key:'egt',label:'EGT',y:579,min:0,max:1000,primary:true,scale:1}),
 Object.freeze({key:'n2',label:'N2',y:849,min:0,max:120,primary:true,scale:1}),
 Object.freeze({key:'fuelFlow',label:'Fuel Flow',y:1112,min:0,max:12000,primary:true,scale:.9}),
 Object.freeze({key:'oilPressure',label:'Oil Pressure',y:309,min:0,max:100,primary:false,scale:.84}),
 Object.freeze({key:'oilTemp',label:'Oil Temperature',y:579,min:-50,max:200,primary:false,scale:.84}),
 Object.freeze({key:'oilQty',label:'Oil Quantity',y:849,min:0,max:4,primary:false,scale:.76}),
 Object.freeze({key:'vib',label:'Vibration',y:1112,min:0,max:5,primary:false,scale:.76})
]);
// Physical shaft centers measured in the final owner's 1182 x 1330 PNG.
const CENTERS=Object.freeze({
 n1:[[427,427],[600,427]], egt:[[427,596],[600,596]],
 n2:[[425,747],[600,747]], fuelFlow:[[426,910],[600,910]],
 oilPressure:[[805,431],[973,431]], oilTemp:[[805,591],[973,591]],
 oilQty:[[803,748],[970,748]], vib:[[803,909],[970,909]]
});
const SPECS=Object.freeze(ROWS.flatMap(row=>[1,2].map(engine=>Object.freeze({
 id:row.key+'_'+engine,signal:row.key,engine:'engine'+engine,
 cx:CENTERS[row.key][engine-1][0],cy:CENTERS[row.key][engine-1][1],
 min:row.min,max:row.max,primary:row.primary,scale:row.scale*.51
}))));
let layer=null;
const values=new Map();
const rotors=new Map();
for(const spec of SPECS)values.set(spec.id,Object.freeze({value:0,source:'UNSOURCED_PARKED'}));
function node(parent,tag,attrs){
 const el=document.createElementNS(svgNs,tag);
 for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,String(v));
 parent.appendChild(el);
 return el;
}
function angle(spec,value){
 const fraction=Math.max(0,Math.min(1,(value-spec.min)/(spec.max-spec.min)));
 // 0 is on the right/top edge, then goes around the lower arc towards 12.
 // The panel source uses polar degrees; image pointer points vertically up.
 const polar=(spec.primary?-49:-25)+(spec.primary?306:290)*fraction;
 return polar+90;
}
function paint(spec){
 const rotor=rotors.get(spec.id);
 if(!rotor)return;
 const reading=values.get(spec.id);
 rotor.setAttribute('transform','translate('+spec.cx+' '+spec.cy+') rotate('+angle(spec,reading.value).toFixed(3)+') scale('+spec.scale+')');
 rotor.parentNode.dataset.source=reading.source;
 rotor.parentNode.dataset.value=String(reading.value);
}
function mount(){
 const host=getMount(),layout=getLayout();
 if(!host||!layout)return false;
 if(layer?.parentNode===host){layer.style.transform=layout.cssMatrix;return true;}
 if(layer && layer.parentNode!==host){layer.remove();rotors.clear();}
 layer=node(host,'svg',{class:'conventional-engine-needle-layer-v1',
    'data-conventional-needles':'CONV-NEEDLE-FIT-0003',viewBox:'0 0 1463 1075',preserveAspectRatio:'none',
    'aria-label':'Sixteen independent conventional engine instrument needles',
    'aria-hidden':'true',focusable:'false'});
 layer.style.width='1463px';layer.style.height='1075px';
 layer.style.transform=layout.cssMatrix; // Identical photo+pointer transform: no needle drift.
 const defs=node(layer,'defs');
 for(const spec of SPECS){
  const clipId='conv-needle-clip-'+spec.id.replace(/[^a-z0-9-]/g,'-');
  const clip=node(defs,'clipPath',{id:clipId});
  node(clip,'circle',{cx:spec.cx,cy:spec.cy,r:65});
  const group=node(layer,'g',{'data-conventional-needle':spec.id,'clip-path':'url(#'+clipId+')'});
  const pivot=node(group,'g',{'data-needle-pivot':spec.id});
  node(pivot,'image',{href:PHOTO,x:-40,y:-140,width:80,height:160,'preserveAspectRatio':'xMidYMid meet',
   'data-needle-photo':'transparent-photo-master'});
  rotors.set(spec.id,pivot);
  paint(spec);
 }
 return true;
}
function update(engine,signal,reading,source){
 if(!['engine1','engine2'].includes(engine))throw Error('Unknown engine: '+engine);
 const spec=SPECS.find(p=>p.engine===engine&&p.signal===signal);
 if(!spec)throw Error('Unknown conventional instrument '+signal);
 if(typeof reading!=='number'||!Number.isFinite(reading))throw Error('Non-finite instrument reading');
 const bounded=Math.max(spec.min,Math.min(spec.max,reading));
 values.set(spec.id,Object.freeze({value:bounded,source:source||'EXPLICIT'}));
 paint(spec);
 return bounded;
}
function fromIsn(indications){
 for(const engine of ['engine1','engine2']){
  const e=indications?.engines?.[engine];
  if(!e)continue;
  for(const signal of ['n2','egt']){
   const value=e[signal]?.value;
   if(typeof value==='number'&&Number.isFinite(value))
    update(engine,signal,value,'ISN_START_SOURCE');
  }
 }
}
window.addEventListener('b737:cockpit-mounted',mount);
window.addEventListener('DOMContentLoaded',mount,{once:true});
window.addEventListener('b737:engine-indication-view',mount);
window.addEventListener('b737:isn-start-indications',event=>{fromIsn(event.detail);mount();});
window.B737ConventionalNeedlesV1=Object.freeze({
 getSpecs:()=>SPECS.map(spec=>({...spec})),
 getReadings:()=>Object.fromEntries([...values.entries()].map(([id,v])=>[id,{...v}])),
 setReading:(engine,signal,value)=>update(engine,signal,value,'EXPLICIT_TRAINER_OR_SOURCE'),
 resetParked:()=>{for(const spec of SPECS){values.set(spec.id,Object.freeze({value:0,source:'UNSOURCED_PARKED'}));paint(spec);}},
 mount
});
mount();
})();