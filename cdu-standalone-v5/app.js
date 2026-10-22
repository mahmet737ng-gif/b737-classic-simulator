'use strict';
const $=id=>document.getElementById(id);
const map=window.CDU_MAP, pages=window.CDU_PAGES, core=window.CDU_ENGINE;
const state=core.makeState('INDEX');
const byId={};
function position(el,box){const [x1,y1,x2,y2]=box;Object.assign(el.style,{left:x1/1199*100+'%',top:y1/1312*100+'%',width:(x2-x1)/1199*100+'%',height:(y2-y1)/1312*100+'%'});}
function makeControls(){const click=$('clickmap');for(const c of map.controls){let el=document.createElement('button');el.type='button';el.className='hotspot '+c.shape;position(el,c.bbox_px);el.title=c.label+' — '+c.id;el.dataset.short=c.label;el.setAttribute('aria-label',c.label);let handled=false,timer;el.addEventListener('pointerdown',()=>{if(c.id.endsWith('KEY_CLR')){handled=false;timer=setTimeout(()=>{handled=true;core.press(state,pages,c.id,{longPress:true});update()},700)}});el.addEventListener('pointerup',()=>clearTimeout(timer));el.addEventListener('pointerleave',()=>clearTimeout(timer));el.addEventListener('pointercancel',()=>clearTimeout(timer));el.addEventListener('click',()=>{if(!handled){core.press(state,pages,c.id);update()}else handled=false});el.addEventListener('focus',()=>{if($('selected-code'))$('selected-code').textContent=JSON.stringify(c,null,2)});click.appendChild(el);byId[c.id]=el;}
 const outputs=$('annunciators');for(const a of map.outputs){const el=document.createElement('div');el.id=a.id;el.className='annunciator '+a.color+(a.label==='EXEC'?' exec':'');let b=a.sprite_bbox_px;position(el,b);if(a.illuminated_sprite){const pic=document.createElement('img');pic.className='light-glyph';pic.src=a.illuminated_sprite;el.appendChild(pic);}outputs.appendChild(el);byId[a.id]=el;}}
function updateEHSI(){ if(window.EHSI_ENGINE) window.EHSI_ENGINE.renderToDom(state,core,$('ehsi-svg'),document); }
function update(){const lines=core.render(state,pages);const box=$('fmc-lines');box.replaceChildren();for(let i=0;i<lines.length;i++){
  const d=document.createElement('div');
  d.className='fmc-line'+(i===0?' fmc-header':'')+(i===13?' scratch':'');
  d.textContent=lines[i]||' ';
  // Anchors in native 1199×1312 coordinates. Each label uses the physical
  // centre of its own LSK; values belong directly underneath that LSK.
  const screenTop=1312*0.0765, screenHeight=1312*0.375;
  let glyphTop;
  if(i===0){glyphTop=117;}
  else if(i===13){glyphTop=565;}
  else {
    const row=Math.floor((i-1)/2)+1;
    const lsk=map.controls.find(c=>c.id==='CDU_CAPT_LSK_L'+row);
    const cy=(lsk.bbox_px[1]+lsk.bbox_px[3])/2;
    glyphTop=(i%2===1)?cy-13:cy+10;
  }
  d.style.top=((glyphTop-screenTop)/screenHeight*100)+'%';
  d.dataset.displayRow=String(i);
  box.appendChild(d);
}
 box.style.opacity=state.brightness;
 const all=core.lights(state);for(const [l,on] of Object.entries(all)){const el=byId['CDU_CAPT_'+l+'_LIGHT'];if(el)el.classList.toggle('on',on)}
 $('page-now').textContent=state.page;$('scratch-now').textContent=state.message||state.scratch||'—';$('pending-now').textContent=core.pendingCount(state);$('key-now').textContent=state.lastKey;
 const ref=pages[state.page].source_ref;$('current-reference').textContent=`FCOM ${ref.folio_family} (near PDF p. ${ref.pdf_page_near}); field-by-field verification pending`;
 $('current-status').textContent=pages[state.page].source_status;
 updateEHSI();
}
function send(k){core.press(state,pages,k);update()}
function reset(){const fresh=core.makeState('INDEX');Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,fresh);['call-test','fault-test','offset-test'].forEach(k=>$(k).checked=false);$('ehsi-heading').value=0;$('ehsi-course').value=0;$('ehsi-range').value=10;$('ehsi-mode').value='MAP';update()}
function init(){if(!map||!pages||!core)throw Error('CDU data is missing');makeControls();update();$('reset').onclick=reset;$('overlay-toggle').onclick=()=>$('cdu-stage').classList.toggle('debug');$('info-toggle').onclick=()=>$('qa').hidden=!$('qa').hidden;
 for(const [el,k] of [['call-test','call'],['fault-test','fail'],['offset-test','offsetGuidance']])$(el).addEventListener('change',e=>{state[k]=e.target.checked;update()});
 $('test-message').onclick=()=>{state.message='CHECK FMC DATA';update()};
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;let key=null;
 if(e.key==='Backspace')key='KEY_CLR';else if(e.key==='Enter')key='EXEC';else if(e.key===' ')key='KEY_SP';else if(e.key==='.')key='KEY_DOT';else if(e.key==='/')key='KEY_SLASH';else if(e.key==='-')key='KEY_PLUS_MINUS';else if(/^[A-Z0-9]$/i.test(e.key))key='KEY_'+e.key.toUpperCase();if(key){e.preventDefault();send('CDU_CAPT_'+key)}});
 $('page-select').addEventListener('change',e=>{core.choose(state,pages,e.target.value);update()});
 Object.keys(pages).sort().forEach(key=>{const option=document.createElement('option');option.value=key;option.textContent=key;$('page-select').appendChild(option)});
 new MutationObserver(()=>{$('page-select').value=state.page}).observe($('page-now'),{childList:true});$('page-select').value=state.page;
 window.EHSI_ENGINE?.initControls(state,core,document,updateEHSI);
 $('ehsi-heading').addEventListener('input',e=>{state.ehsi.heading=Number(e.target.value)||0;updateEHSI()});
 $('ehsi-course').addEventListener('input',e=>{state.ehsi.course=Number(e.target.value)||0;updateEHSI()});
 $('ehsi-range').addEventListener('change',e=>{state.ehsi.range=Number(e.target.value)||10;updateEHSI()});
 $('ehsi-mode').addEventListener('change',e=>{state.ehsi.mode=e.target.value;updateEHSI()});
}
init();