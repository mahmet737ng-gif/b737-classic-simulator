'use strict';
const q=id=>document.getElementById(id);
const EF=window.EFIS;
const state=EF.initial();
let data;
const controlEls=new Map();
const knobEls=new Map();
function rect(el,b){let [x1,y1,x2,y2]=b; el.style.left=(100*x1/479)+'%';el.style.top=(100*y1/299)+'%';el.style.width=(100*(x2-x1)/479)+'%';el.style.height=(100*(y2-y1)/299)+'%';}
function previewFile(mode){const files={MAP:'ehsi-map.png',CTR_MAP:'ehsi-ctr_map.png',EXP_NAV:'ehsi-exp_nav.png',FULL_NAV:'ehsi-full_nav.png',EXP_VOR_ILS:'ehsi-exp_vor_ils.png',FULL_VOR_ILS:'ehsi-full_vor_ils.png',PLAN:'ehsi-plan.png'};return 'assets/'+files[mode];}
function act(id,step=1){EF.operate(state,id,step);update();}
function build(){
 data=window.EFIS_DATA;
 if(!data||data.controls.length!==14)throw Error('Missing / invalid FCOM geometry');
 const stage=q('stage'),knobLayer=q('knobs'),hitLayer=q('hits');
 const sprites={DH_REF_SELECTOR:'DH_REF_SELECTOR',EADI_BRT:'EADI_BRT',EHSI_MODE:'MODE',EHSI_RANGE:'RANGE_RING',EHSI_BRT_OUTER:'BRIGHT_OUTER',WXR_BRT_INNER:'BRIGHT_INNER'};
 for(const c of data.controls){
  if(sprites[c.id]){
   const knob=data.knob_sprites[sprites[c.id]];
   const img=document.createElement('img');img.src=knob.sprite;img.className='source-knob';img.dataset.control=c.id;rect(img,knob.bbox);
   knobLayer.appendChild(img);knobEls.set(c.id,img);
  }
  const el=document.createElement('button');el.type='button';el.className='control-hit '+c.shape;
  if(c.type==='concentric_rotary_outer'||c.id==='EHSI_RANGE')el.classList.add('ring-zone');
  el.setAttribute('aria-label',c.label);el.setAttribute('title',c.label+' — FCOM '+c.source);el.dataset.id=c.id;rect(el,c.bbox_in_panel_px);
  if(c.id==='TFC'||c.id==='WXR_BRT_INNER')el.classList.add('inner-zone');
  el.onclick=e=>{act(c.id,1)};
  el.addEventListener('contextmenu',e=>{e.preventDefault();if(c.type.includes('rotary')||c.type==='rotary')act(c.id,-1)});
  el.addEventListener('wheel',e=>{if(c.type.includes('rotary')||c.id==='EHSI_MODE'||c.id==='EHSI_RANGE'){e.preventDefault();act(c.id,e.deltaY<0?1:-1)}},{passive:false});
  el.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();act(c.id,1);}else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();act(c.id,-1);}});
  hitLayer.appendChild(el);controlEls.set(c.id,el);
 }
 for(const id of ['VOR_ADF','NAV_AID','ARPT','RTE_DATA','WPT','WXR']){
  const c=data.controls.find(c=>c.id===id);const lit=document.createElement('div');lit.className='selection-light';lit.dataset.light=id;rect(lit,c.bbox_in_panel_px);lit.textContent='ON';q('lights').appendChild(lit);
 }
 const modeSel=q('mode-selector');for(const m of EF.MODE){const opt=document.createElement('option');opt.value=m;opt.textContent=m.replaceAll('_',' ');modeSel.appendChild(opt)}
 const rangeSel=q('range-selector');for(const r of EF.RANGE){const opt=document.createElement('option');opt.value=r;opt.textContent=r+' NM';rangeSel.appendChild(opt)}
 modeSel.onchange=e=>{EF.setMode(state,e.target.value);update()};rangeSel.onchange=e=>{EF.setRange(state,e.target.value);update()};
 q('dh-input').onchange=e=>{try{EF.setDHTestValue(state,e.target.value);update()}catch(err){alert(err.message)}};
 q('show-boxes').onchange=e=>stage.classList.toggle('audit',e.target.checked);
 q('reset').onclick=()=>{Object.assign(state,EF.initial());update()};
 update();
}
function update(){
 q('mode-selector').value=state.mode;q('range-selector').value=String(state.range);
 q('mode-read').textContent=state.mode.replaceAll('_',' ');q('range-read').textContent=state.range+' NM';
 q('dh-read').textContent=String(state.selectedDH);q('dh-input').value=state.selectedDH;
 q('event-read').textContent=state.lastEvent||'Ready — initial illustration from FCOM';
 const c=data.controls.find(c=>c.id===state.selected);q('control-read').textContent=c?`${c.label} · ${c.source} · ${c.type}`:'—';
 const avail=EF.displayAvailability(state);
 const line=[avail.wxr,avail.tfc,avail.navaid,avail.wpt,avail.arpt,avail.rte,avail.vor].filter(x=>!x.endsWith('off')&&!x.endsWith('not selected')).join('\n');
 q('conditions').textContent=line||'No external navigation, radar or TCAS data simulated.';
 for(const c of data.controls){const el=controlEls.get(c.id);if(!el)continue; const on=(c.id==='WXR'&&state.wxr)||(c.id==='TFC'&&state.tfc)||(c.id in state.switches && state.switches[c.id]);el.classList.toggle('chosen',Boolean(on));el.classList.toggle('current',state.selected===c.id)}
 for(const x of q('lights').children){const id=x.dataset.light;x.classList.toggle('visible',id==='WXR'?state.wxr:!!state.switches[id]);}
 const turnValues={DH_REF_SELECTOR:state.dhTurn,EADI_BRT:state.brightnessTurns.EADI_BRT,EHSI_MODE:EF.MODE.indexOf(state.mode),EHSI_RANGE:EF.RANGE.indexOf(state.range),EHSI_BRT_OUTER:state.brightnessTurns.EHSI_BRT_OUTER,WXR_BRT_INNER:state.brightnessTurns.WXR_BRT_INNER};
 // Knob source pixels remain unchanged: exact rotational angles are not specified in the cited FCOM pages.
 for(const [id,img] of knobEls)img.style.transform='none';
 q('dh-overlay').textContent=String(state.selectedDH);
 q('source-preview').src=previewFile(state.mode);
 q('source-heading').textContent=state.mode.replaceAll('_',' ')+' · FCOM Chapter 10 §10.31';
 const refs={MAP:'10.31.2 / PDF 1339',CTR_MAP:'10.31.4 / PDF 1341',EXP_NAV:'10.31.6 / PDF 1343',FULL_NAV:'10.31.8 / PDF 1345',EXP_VOR_ILS:'10.31.10 / PDF 1347 (VOR sample)',FULL_VOR_ILS:'10.31.12 / PDF 1349 (VOR sample)',PLAN:'10.31.18 / PDF 1355'};
 q('sample-reference').textContent=refs[state.mode];
 q('journal').textContent=state.events.slice(0,10).map((e,i)=>`${i+1}. ${e.event}  ·  ${e.source}`).join('\n')||'No interaction yet.';
}
document.addEventListener('DOMContentLoaded',build);