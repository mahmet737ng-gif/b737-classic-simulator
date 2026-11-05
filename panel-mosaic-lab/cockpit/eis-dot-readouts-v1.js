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
 const mounted=new Map();let layer=null,ticket=null,lastFrame=null;
 const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:null;
 const caf=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null;
 function element(parent,tag,attrs={}){const node=document.createElementNS(ns,tag);
  for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));parent.append(node);return node;}
 const glyphId=ch=>'eis-dot-glyph-'+(ch==='.'?'decimal':ch==='-'?'dash':ch);
 function mount(){
  const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');if(!piece)return false;
  if(layer?.parentNode===piece)return true;
  if(ticket!==null&&caf)caf(ticket);ticket=null;lastFrame=null;
  if(layer)layer.remove();mounted.clear();
  layer=element(piece,'svg',{class:'eis-dot-readouts-v1',viewBox:'0 0 1235 1274',
   'data-eis-dot-readouts':font.VERSION,'aria-label':'EIS live dot matrix engine numbers'});
  const defs=element(layer,'defs');
  for(const [ch,glyph]of Object.entries(font.glyphs)){
   const g=element(defs,'g',{id:glyphId(ch),fill:font.style.color,
    stroke:font.style.color,'stroke-width':'.25','stroke-opacity':'.36'});
   for(const p of glyph.points)element(g,'circle',{cx:p.x,cy:p.y,r:ch==='.'?.9:font.style.radius/font.style.pitch});
  }
  for(const spec of specs){
   const group=element(layer,'g',{'data-eis-readout':spec.id,role:'img'});
   const width=font.layout(spec.template).width,lastX=width-14;
   element(group,'rect',{'data-eis-display-face':'',x:-2,y:font.style.bodyTop,
    width:width+4,height:font.style.bodyHeight,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
   const clipId='eis-last-digit-window-'+spec.id,bodyId='eis-body-window-'+spec.id;
   const bodyClip=element(defs,'clipPath',{id:bodyId,clipPathUnits:'userSpaceOnUse'});
   element(bodyClip,'rect',{x:-2,y:font.style.bodyTop,width:width+4,height:font.style.bodyHeight});
   if(spec.drum){
    element(group,'rect',{'data-eis-tall-window':'',x:lastX-2,y:font.style.windowTop,
     width:16,height:font.style.windowHeight,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
    const clip=element(defs,'clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});
    element(clip,'rect',{x:lastX-2,y:font.style.windowTop,width:16,height:font.style.windowHeight});
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
     x:cell.x,y:offset*font.style.drumStride,'data-drum-glyph':offset,
     ...(tall&&Math.abs(offset)===1?{'data-eis-adjacent-digit':offset}:{})}));
    return {clip,fixed,tape,glyphs,x:cell.x,power:cell.character==='.'?null:--position,
     wheel:null,character:' ',base:null,offset:null};
   });
   group.dataset.displayUnit=spec.unit;
   const pitch=font.style.pitch*spec.scale;
   group.setAttribute('transform',`translate(${spec.cx-width*pitch/2} ${spec.cy-10*pitch}) scale(${pitch})`);
   mounted.set(spec.id,{group,slots,width,text:null,dirty:true});
  }
  syncTargets();paint();schedule();return true;
 }
 function syncTargets(){if(!layer)return;
  for(const spec of specs){
   const part=mounted.get(spec.id),reading=values.get(spec.id);
   const text=font.format(reading.value,spec);part.group.dataset.source=reading.source;
   if(part.text===text)continue;
   part.text=text;part.dirty=true;part.group.dataset.value=text;
   part.group.setAttribute('aria-label',spec.engine+' '+spec.signal+' '+text+' '+spec.unit);
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
     if(character!==' ')slot.fixed.setAttribute('href','#'+glyphId(character));
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
     slot.glyphs.forEach((node,i)=>node.setAttribute('href','#'+glyphId(String(((base+i-2)%10+10)%10))));
    }
    const offset=(-fraction*font.style.drumStride).toFixed(4);
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
   const engine=live?.engines?.[s.engine];if(!engine)continue;
   const value=paths[s.signal].split('.').reduce((o,k)=>o?.[k],engine);
   // Some ECU snapshots omit FF; the start observation supplies that channel.
   // An absent property is not an invalid sensor and must not erase it.
   if(value!==undefined)write(s,value,'UNIFIED_ECU_OBSERVATION');
  }
  refresh();
 }
 function observeStart(packet){
  for(const s of specs){
   const signal=packet?.engines?.[s.engine]?.[s.signal];
   if(signal&&Object.hasOwn(signal,'value'))write(s,signal.value,'ISN_START_SOURCE');
  }
  refresh();
 }
 window.B737EISDotReadoutsV1=Object.freeze({
  getSpecs:()=>specs.map(s=>({...s})),
  getReadings:()=>Object.fromEntries([...values].map(([id,v])=>{
   const spec=specs.find(s=>s.id===id);return [id,{...v,text:font.format(v.value,spec),displayUnit:spec.unit}];
  })),
  getMotion:()=>Object.fromEntries([...mounted].map(([id,p])=>[id,p.slots.map(s=>s.wheel?.snapshot()||null)])),
  setReading(engine,signal,value){
   const spec=specs.find(s=>s.engine===engine&&s.signal===signal);if(!spec)throw Error('Unknown EIS numeric field');
   write(spec,value,'EXPLICIT_TRAINER_OR_SOURCE');refresh();
  },mount
 });
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:unified-ecu-observation',e=>observeECU(e.detail));
 window.addEventListener('b737:isn-start-indications',e=>observeStart(e.detail));
 mount();
 const live=window.B737ISNCockpitV1?.getECUState?.();if(live)observeECU(live);
})();
