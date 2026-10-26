/* FIRELAMP-0006 installs 8 rectangular / 3 round independently cropped approved images
 * in the exact letterboxed 2172×724 source-image rectangle; hardware unchanged. Separate from
 * immutable Fire Protection artwork and from the switches/handles.
 */
(function(win){
'use strict';
const model=win.B737UnifiedFireLampModel;
if(!model)throw Error('FIRELAMP model missing');
const unit=win.B737FireProtection?.createEngine?.()||null;
const faceNodes=new Map();
let lastRegistration=null;
const overrides={};
let external=null, visualTest=false, attached=false;
const ids=new Set(model.SLOTS.map(s=>s.id));
function current(){
 const computed=unit?.evaluate()?.indications||{};
 const out={};
 for(const s of model.SLOTS)out[s.id]=visualTest||Boolean(
  Object.prototype.hasOwnProperty.call(overrides,s.id)?overrides[s.id]:
  external&&Object.prototype.hasOwnProperty.call(external,s.id)?external[s.id]:
  computed[s.id]
 );
 return out;
}
function draw(){
 const vals=current();
 for(const s of model.SLOTS){
  const img=faceNodes.get(s.id);
  if(!img)continue;
  const wanted=model.file(s,vals[s.id]);
  if(img.dataset.source!==wanted){
   img.dataset.source=wanted;img.src=wanted;
  }
  img.dataset.illuminated=vals[s.id]?'true':'false';
 }
 return vals;
}
function attach(){
 if(attached)return true;
 const host=win.document.querySelector('#region-pedestal .texture-piece[data-piece="fire-protection"]');
 if(!host)return false;
 const base=host.querySelector(':scope > img');
 if(!base||!(base.dataset.perfSource||base.getAttribute('src')||'').includes('fire-v6/FIRE_PANEL_BARE.webp')){
  win.console.warn('FIRELAMP: fire plate asset not recognized; mounting skipped without changing other panels');
  return false;
 }
 const layer=win.document.createElement('div');
 layer.className='fire-lamps-mounted';
 layer.dataset.coordinateBase='2172x724';
 // The approved base is object-fit: contain. Pixel registration MUST be
 // performed in its fitted image rectangle, not in the whole texture button.
 // Otherwise, a 4:1 host causes a 3:1 image to be centered with side bars.
 const hostW=host.clientWidth,hostH=host.clientHeight;
 const scale=Math.min(hostW/model.BASE.width,hostH/model.BASE.height);
 const imageW=model.BASE.width*scale,imageH=model.BASE.height*scale;
 Object.assign(layer.style,{
   inset:'auto',
   left:((hostW-imageW)/2)+'px',top:((hostH-imageH)/2)+'px',
   width:imageW+'px',height:imageH+'px'
 });
 // The new owner-approved bare panel already has both bottle cutouts horizontal.
 // Do not overlay the obsolete V3 bottle patch.

 layer.setAttribute('aria-hidden','true');
 for(const slot of model.SLOTS){
  const node=win.document.createElement('span');node.className='fire-lamp';
  node.dataset.fireLamp=slot.id;node.dataset.kind=slot.type;
  const p=model.percent(slot);
  for(const [key,value]of Object.entries(p))node.style[key]=value;
  const img=win.document.createElement('img');
  img.alt='';img.decoding='async';img.draggable=false;
  // Full independent PNG/WebP crop including its original finished lamp bezel.
  // Alpha is preserved; no artificial SVG legend, CSS blend, or corner screws.
  Object.assign(img.style,{position:'absolute',left:'0%',top:'0%',width:'100%',height:'100%'});
  node.dataset.geometry=slot.type==='rect'?'approved-cropped-annunciator':'approved-green-lens';
  node.dataset.version=model.version;
  node.append(img);layer.append(node);faceNodes.set(slot.id,img);
 }
 host.append(layer);attached=true;
 lastRegistration={hostWidth:hostW,hostHeight:hostH,imageWidth:imageW,imageHeight:imageH,offsetX:(hostW-imageW)/2,offsetY:(hostH-imageH)/2};draw();
 win.dispatchEvent(new win.CustomEvent('b737:unified-fire-lamps-mounted',{detail:{count:model.SLOTS.length,base:model.BASE,source:model.source}}));
 return true;
}
function patch(values){
 if(!values||typeof values!=='object')throw TypeError('Indicator status object required');
 for(const [id,value] of Object.entries(values)){
  if(!ids.has(id))throw RangeError('Unknown fire indicator '+id);
  if(typeof value!=='boolean')throw TypeError('Fire indicator must be boolean '+id);
 }
 Object.assign(overrides,values);return draw();
}
function clearOverrides(){for(const key of Object.keys(overrides))delete overrides[key];return draw();}
function dispatch(cmd){if(!unit)throw Error('Fire protection behavior core not loaded');const x=unit.dispatch(cmd);draw();return x;}
win.addEventListener('b737:cockpit-mounted',attach);
win.document.addEventListener('DOMContentLoaded',attach,{once:true});
win.addEventListener('load',attach,{once:true});
win.addEventListener('b737:visual-test',e=>{visualTest=Boolean(e.detail?.active);draw();});
win.addEventListener('b737:fire-protection-state',e=>{if(e.detail?.indications&&typeof e.detail.indications==='object'){external={...e.detail.indications};draw();}});
if(win.document.readyState==='complete')attach();
win.B737UnifiedFireLights=Object.freeze({
 mount:attach,
 setIndicators:patch,
 clearOverrides,
 visualTest(active){visualTest=Boolean(active);return draw();},
 dispatch,indications:()=>Object.freeze({...current()}),
 getState:()=>unit?.getState()||null,
 positions:()=>model.SLOTS.map(s=>({id:s.id,center:[s.cx,s.cy],frameBounds:model.region(s),glassBounds:model.faceRegion(s),legendPercent:model.legendPercent(s)})),
 version:()=>model.version,
 registration:()=>lastRegistration?Object.freeze({...lastRegistration}):null
});
})(window);
