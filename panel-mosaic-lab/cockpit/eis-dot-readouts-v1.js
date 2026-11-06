/* Live EIS numeric presentation. Reads the shared ECU; owns no engine plant. */
(function(){'use strict';
 const font=window.B737EISDotDigitsV1,model=window.B737ISNEngineGaugeModel;
 if(!font||!model)return;
 const ns='http://www.w3.org/2000/svg';
 const specs=Object.freeze(model.eisGauges.filter(g=>['n1','egt','n2','fuelFlow'].includes(g.signal)).map(g=>Object.freeze({
  id:g.id,engine:g.engine,signal:g.signal,cx:g.cx,cy:g.cy,
  decimals:g.signal==='fuelFlow'?2:['n1','n2'].includes(g.signal)?1:0,
  integerDigits:g.signal==='fuelFlow'?1:3,divisor:g.signal==='fuelFlow'?1000:1,
  unit:g.signal==='fuelFlow'?'t/h':g.signal==='egt'?'°C':'%',
  template:g.signal==='fuelFlow'?'0.00':g.signal==='egt'?'999':'100.0',drum:true,scale:1
 })).concat([1,2].map(n=>Object.freeze({id:'oilQuantity_'+n,engine:'engine'+n,signal:'oilQuantity',
  cx:n===1?984:1095,cy:741,decimals:0,integerDigits:3,divisor:1,unit:'%FULL',template:'999',drum:false,scale:.83}))));
 const values=new Map(specs.map(s=>[s.id,{value:['n1','n2'].includes(s.signal)?0:null,source:'INITIAL'}]));
 const mounted=new Map(),ecuOwned=new Set(),backendOwned=new Set(),startFallbacks=new Map();
 let layer=null,conventionalLayer=null,ticket=null,lastFrame=null;
 const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:null;
 const caf=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null;
 function element(parent,tag,attrs={}){const node=document.createElementNS(ns,tag);
  for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));parent.append(node);return node;}
 const glyphId=(ch,variant='EIS')=>(variant==='EIS'?'eis':'conv')+'-dot-glyph-'+(ch==='.'?'decimal':ch==='-'?'dash':ch);
 function conventionalSpecs(){
  const registered=window.B737ConventionalNeedlesV1?.getSpecs?.();if(!registered)return [];
  return specs.map(s=>{
   const point=registered.find(g=>g.engine===s.engine&&g.signal===(s.signal==='oilQuantity'?'oilQty':s.signal));
   if(!point)throw Error('Conventional dial registration missing: '+s.id);
   // The real Classic mechanical-dial numerals sit in the upper-right quadrant,
   // not beneath the shaft. Leave the separate oil-quantity window unchanged.
   const isMechanicalDrum=s.signal!=='oilQuantity';
   return {...s,cx:point.cx+(isMechanicalDrum?21:0),cy:point.cy+(isMechanicalDrum?-43:2),scale:isMechanicalDrum?.8:.78,
    ...(s.signal==='oilQuantity'?{decimals:2,divisor:20,unit:'USgal',template:'0.00',integerDigits:1}:{})};
  });
 }
 function createLayer(piece,layerSpecs,variant){
  const svg=element(piece,'svg',{class:variant==='EIS'?'eis-dot-readouts-v1':'conventional-dot-readouts-v1',
   viewBox:variant==='EIS'?'0 0 1235 1274':'0 0 1463 1075',
   [variant==='EIS'?'data-eis-dot-readouts':'data-conventional-dot-readouts']:font.VERSION,
   'aria-label':variant+' live dot matrix engine numbers'});
  const defs=element(svg,'defs');
  for(const [ch,glyph]of Object.entries(font.glyphs)){
   const g=element(defs,'g',{id:glyphId(ch,variant),fill:font.style.color,
    stroke:font.style.color,'stroke-width':'.25','stroke-opacity':'.36'});
   for(const p of glyph.points)element(g,'circle',{cx:p.x,cy:p.y,r:ch==='.'?.9:font.style.radius/font.style.pitch});
  }
  for(const spec of layerSpecs){
   const group=element(svg,'g',{[variant==='EIS'?'data-eis-readout':'data-conventional-readout']:spec.id,role:'img'});
   const width=font.layout(spec.template).width,lastX=width-14;
   // Conventional drum aperture: show more of the numbers above and below
   // the active right-hand digit, without altering the calibrated EIS window.
   const drumWindow=variant==='CONVENTIONAL'?{x:lastX-5,y:-13,width:23,height:46}:
    {x:lastX-2,y:font.style.windowTop,width:16,height:font.style.windowHeight};
   element(group,'rect',{'data-eis-display-face':'',x:-2,y:font.style.bodyTop,
    width:width+4,height:font.style.bodyHeight,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
   const clipId=variant+'-last-digit-window-'+spec.id,bodyId=variant+'-body-window-'+spec.id;
   const bodyClip=element(defs,'clipPath',{id:bodyId,clipPathUnits:'userSpaceOnUse'});
   element(bodyClip,'rect',{x:-2,y:font.style.bodyTop,width:width+4,height:font.style.bodyHeight});
   if(spec.drum){
    element(group,'rect',{'data-eis-tall-window':'',x:drumWindow.x,y:drumWindow.y,
     width:drumWindow.width,height:drumWindow.height,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
    const clip=element(defs,'clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});
    element(clip,'rect',{x:drumWindow.x,y:drumWindow.y,width:drumWindow.width,height:drumWindow.height});
   }
   // Fixed windows clip independent vertical digit tapes. Glyph nodes are
   // allocated once; one shared RAF moves all active drums without timers.
   const template=font.layout(spec.template),digits=[...spec.template].filter(c=>c!=='.').length;
   let position=digits;
   const slots=template.cells.map((cell,index)=>{
    const tall=spec.drum&&index===template.cells.length-1;
    const clip=element(group,'g',{'data-eis-digit-cell':index,'clip-path':'url(#'+(tall?clipId:bodyId)+')'});
    const fixed=element(clip,'use',{x:cell.x,visibility:'hidden','aria-hidden':'true'});
    const tape=element(clip,'g',{'data-eis-digit-tape':'',visibility:'hidden','aria-hidden':'true'});
    const glyphs=[-2,-1,0,1,2].map(offset=>element(tape,'use',{
     x:cell.x,y:-offset*font.style.drumStride,'data-drum-glyph':offset,
     ...(tall&&Math.abs(offset)===1?{'data-eis-adjacent-digit':offset}:{})}));
    return {clip,fixed,tape,glyphs,x:cell.x,power:cell.character==='.'?null:--position,
     wheel:null,character:' ',base:null,offset:null};
   });
   group.dataset.displayUnit=spec.unit;
   const pitch=font.style.pitch*spec.scale;
   group.setAttribute('transform',`translate(${spec.cx-width*pitch/2} ${spec.cy-10*pitch}) scale(${pitch})`);
   mounted.set(variant+'.'+spec.id,{spec,variant,group,slots,width,text:null,dirty:true});
  }
  return svg;
 }
 function removeLayer(variant,svg){
  if(svg)svg.remove();
  for(const [key,part]of mounted)if(part.variant===variant)mounted.delete(key);
 }
 function mount(){
  const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');if(!piece)return false;
  if(layer?.parentNode!==piece){removeLayer('EIS',layer);layer=createLayer(piece,specs,'EIS');}
  const host=window.B737EngineIndicationModeV1?.wrap?.(),layout=window.B737EngineIndicationModeV1?.layout?.();
  if(host&&layout){
   if(conventionalLayer?.parentNode!==host){
    const registered=conventionalSpecs();
    if(registered.length){removeLayer('CONVENTIONAL',conventionalLayer);conventionalLayer=createLayer(host,registered,'CONVENTIONAL');}
   }
   if(conventionalLayer)Object.assign(conventionalLayer.style,{width:'1463px',height:'1075px',transform:layout.cssMatrix});
  }
  syncTargets();paint();schedule();return true;
 }
 function syncTargets(){if(!mounted.size)return;
  for(const part of mounted.values()){
   const spec=part.spec,reading=values.get(spec.id);
   const text=font.format(reading.value,spec);part.group.dataset.source=reading.source;
   if(part.text===text)continue;
   part.text=text;part.dirty=true;part.group.dataset.value=text;
   part.group.setAttribute('aria-label',spec.engine+' '+spec.signal+' '+text+' '+(part.group.dataset.displayUnit||spec.unit));
   const padded=text.padStart(spec.template.length,' ');
   const numeric=Number.isFinite(Number(text));
   const ticks=numeric?Math.round(Math.abs(Number(text))*10**spec.decimals):0;
   part.slots.forEach((slot,i)=>{
    const character=padded[i]||' ';slot.character=character;
    if(slot.power!==null&&numeric&&(character===' '||/^[0-9]$/.test(character))){
     const column=Math.floor(ticks/10**slot.power);
     if(!slot.wheel)slot.wheel=font.createWheel(column);else slot.wheel.setColumn(column);
     if(!raf)slot.wheel.snap();
     slot.fixed.setAttribute('visibility','hidden');
    }else{
     slot.wheel=null;slot.tape.setAttribute('visibility','hidden');
     slot.fixed.setAttribute('visibility',character===' '?'hidden':'visible');
     if(character!==' ')slot.fixed.setAttribute('href','#'+glyphId(character,part.variant));
    }
   });
  }
 }
 const isMoving=()=>[...mounted.values()].some(p=>p.slots.some(s=>s.wheel?.snapshot().moving));
 function paint(){if(!layer)return;
  for(const part of mounted.values()){
   const moving=part.slots.some(s=>s.wheel?.snapshot().moving);
   if(!part.dirty&&!moving&&part.group.dataset.motion==='REST')continue;
   let direction='REST';
   part.slots.forEach(slot=>{
    if(!slot.wheel)return;
    const state=slot.wheel.snapshot(),base=Math.floor(state.phase),fraction=state.phase-base;
    slot.tape.setAttribute('visibility',slot.character===' '&&!state.moving?'hidden':'visible');
    slot.clip.dataset.drumPhase=state.phase.toFixed(4);
    slot.clip.dataset.drumDirection=state.direction;
    if(state.moving)direction=state.direction;
    if(slot.base!==base){
     slot.base=base;
     slot.glyphs.forEach((node,i)=>node.setAttribute('href','#'+glyphId(String(((base+i-2)%10+10)%10),part.variant)));
    }
    const offset=(fraction*font.style.drumStride).toFixed(4);
    if(slot.offset!==offset){slot.offset=offset;slot.tape.setAttribute('transform','translate(0 '+offset+')');}
   });
   part.group.dataset.motion=direction;part.dirty=false;
  }
 }
 function schedule(){if(raf&&ticket===null&&isMoving())ticket=raf(frame);}
 function frame(now){
  ticket=null;const seconds=lastFrame===null?1/60:Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  for(const part of mounted.values())for(const slot of part.slots)slot.wheel?.step(seconds);
  paint();if(isMoving())schedule();else lastFrame=null;
 }
 function refresh(){mount();syncTargets();paint();schedule();}
 function write(spec,value,source){values.set(spec.id,{value:Number.isFinite(value)?value:null,source});}
 function observeECU(live){
  const paths={n1:'n1Percent',n2:'n2Percent',egt:'egtC',fuelFlow:'fuelFlowKgHr',oilQuantity:'oil.quantityPct'};
  for(const s of specs){
   if(backendOwned.has(s.id))continue;
   const engine=live?.engines?.[s.engine];if(!engine)continue;
   const value=paths[s.signal].split('.').reduce((o,k)=>o?.[k],engine);
   // Some ECU snapshots omit FF; the start observation supplies that channel.
   // An absent property is not an invalid sensor and must not erase it.
   if(value!==undefined){ecuOwned.add(s.id);write(s,value,'UNIFIED_ECU_OBSERVATION');}
   else{
    ecuOwned.delete(s.id);
    if(startFallbacks.has(s.id))write(s,startFallbacks.get(s.id),'ISN_START_SOURCE');
   }
  }
  refresh();
 }
 function observeStart(packet){
  for(const s of specs){
   if(backendOwned.has(s.id))continue;
   const signal=packet?.engines?.[s.engine]?.[s.signal];
   if(signal&&Object.hasOwn(signal,'value')){
    startFallbacks.set(s.id,signal.value);
    // Do not retarget a moving drum to a legacy start estimate immediately
    // before its authoritative ECU value arrives in the same update cycle.
    if(!ecuOwned.has(s.id))write(s,signal.value,'ISN_START_SOURCE');
   }
  }
  refresh();
 }
 window.B737EISDotReadoutsV1=Object.freeze({
  getSpecs:(mode='EIS')=>(mode==='CONVENTIONAL'?conventionalSpecs():specs).map(s=>({...s})),
  getReadings:()=>Object.fromEntries([...values].map(([id,v])=>{
   const spec=specs.find(s=>s.id===id);return [id,{...v,text:font.format(v.value,spec),displayUnit:spec.unit}];
  })),
  getMotion:(mode='EIS')=>Object.fromEntries([...mounted.values()].filter(p=>p.variant===mode).map(p=>[p.spec.id,p.slots.map(s=>s.wheel?.snapshot()||null)])),
  setReading(engine,signal,value,source='EXPLICIT_TRAINER_OR_SOURCE'){
   const spec=specs.find(s=>s.engine===engine&&s.signal===signal);if(!spec)throw Error('Unknown EIS numeric field');
   if(source==='ENGINE_INDICATION_BACKEND_V2')backendOwned.add(spec.id);
   write(spec,value,source);refresh();
  },mount
 });
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:engine-indication-view',mount);
 window.addEventListener('b737:unified-ecu-observation',e=>observeECU(e.detail));
 window.addEventListener('b737:isn-start-indications',e=>observeStart(e.detail));
 mount();
 const live=window.B737ISNCockpitV1?.getECUState?.();if(live)observeECU(live);
})();
