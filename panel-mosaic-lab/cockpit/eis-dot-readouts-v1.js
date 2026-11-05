/* Live EIS numeric presentation. Reads the shared ECU; owns no engine plant. */
(function(){'use strict';
 const font=window.B737EISDotDigitsV1,model=window.B737ISNEngineGaugeModel;
 if(!font||!model)return;
 const ns='http://www.w3.org/2000/svg';
 const specs=Object.freeze(model.eisGauges.filter(g=>['n1','egt','n2','fuelFlow'].includes(g.signal)).map(g=>Object.freeze({
  id:g.id,engine:g.engine,signal:g.signal,cx:g.cx,cy:g.cy,
  decimals:['n1','n2'].includes(g.signal)?1:0,integerDigits:g.signal==='fuelFlow'?5:3,scale:1
 })).concat([1,2].map(n=>Object.freeze({id:'oilQuantity_'+n,engine:'engine'+n,signal:'oilQuantity',
  cx:n===1?984:1095,cy:741,decimals:0,integerDigits:3,scale:.83}))));
 const values=new Map(specs.map(s=>[s.id,{value:['n1','n2'].includes(s.signal)?0:null,source:'INITIAL'}]));
 const mounted=new Map();let layer=null;
 function element(parent,tag,attrs={}){const node=document.createElementNS(ns,tag);
  for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));parent.append(node);return node;}
 const glyphId=ch=>'eis-dot-glyph-'+(ch==='.'?'decimal':ch==='-'?'dash':ch);
 function mount(){
  const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');if(!piece)return false;
  if(layer?.parentNode===piece)return true;
  if(layer)layer.remove();mounted.clear();
  layer=element(piece,'svg',{class:'eis-dot-readouts-v1',viewBox:'0 0 1235 1274',
   'data-eis-dot-readouts':font.VERSION,'aria-label':'EIS live dot matrix engine numbers'});
  const defs=element(layer,'defs');
  for(const [ch,glyph]of Object.entries(font.glyphs)){
   const g=element(defs,'g',{id:glyphId(ch),fill:font.style.color});
   for(const p of glyph.points)element(g,'circle',{cx:p.x,cy:p.y,r:font.style.radius/font.style.pitch});
  }
  for(const spec of specs){
   const group=element(layer,'g',{'data-eis-readout':spec.id,role:'img'});
   // All cells are allocated once. Updates change glyph references only.
   const cells=Array.from({length:7},()=>element(group,'use',{visibility:'hidden'}));
   mounted.set(spec.id,{group,cells,text:null});
  }
  paint();return true;
 }
 function paint(){if(!layer)return;
  for(const spec of specs){
   const part=mounted.get(spec.id),reading=values.get(spec.id);
   const text=font.format(reading.value,spec);part.group.dataset.source=reading.source;
   if(part.text===text)continue;
   part.text=text;part.group.dataset.value=text;
   part.group.setAttribute('aria-label',spec.engine+' '+spec.signal+' '+text);
   const shape=font.layout(text),pitch=font.style.pitch*spec.scale;
   part.group.setAttribute('transform',`translate(${spec.cx-shape.width*pitch/2} ${spec.cy-5*pitch}) scale(${pitch})`);
   part.cells.forEach((cell,i)=>{
    const data=shape.cells[i];cell.setAttribute('visibility',data?'visible':'hidden');
    if(data){cell.setAttribute('href','#'+glyphId(data.character));cell.setAttribute('x',data.x);}
   });
  }
 }
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
  mount();paint();
 }
 function observeStart(packet){
  for(const s of specs){
   const signal=packet?.engines?.[s.engine]?.[s.signal];
   if(signal&&Object.hasOwn(signal,'value'))write(s,signal.value,'ISN_START_SOURCE');
  }
  mount();paint();
 }
 window.B737EISDotReadoutsV1=Object.freeze({
  getSpecs:()=>specs.map(s=>({...s})),
  getReadings:()=>Object.fromEntries([...values].map(([id,v])=>[id,{...v,text:font.format(v.value,specs.find(s=>s.id===id))}])),
  setReading(engine,signal,value){
   const spec=specs.find(s=>s.engine===engine&&s.signal===signal);if(!spec)throw Error('Unknown EIS numeric field');
   write(spec,value,'EXPLICIT_TRAINER_OR_SOURCE');mount();paint();
  },mount
 });
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:unified-ecu-observation',e=>observeECU(e.detail));
 window.addEventListener('b737:isn-start-indications',e=>observeStart(e.detail));
 mount();
 const live=window.B737ISNCockpitV1?.getECUState?.();if(live)observeECU(live);
})();
