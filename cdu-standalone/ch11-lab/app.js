'use strict';
(()=>{const $=id=>document.getElementById(id),model=window.CH11Engine,source=window.CDU_MAP;
if(!model||!source)throw Error('Source map or engine not available');
let state=model.createState(), debug=false;const lit={};
function action(evt){state=model.dispatch(state,evt);draw()}
function draw(){const view=model.display(state),list=$('fmc-lines');list.textContent='';
 for(const [idx,str] of view.rows.entries()){const el=document.createElement('div');el.className='fmc-line';el.textContent=str;if(idx===0)el.classList.add('ch11-title');list.appendChild(el)}
 list.style.opacity=state.brightness;
 Object.entries(view.annunciators).forEach(([name,on])=>{if(name==='FMC_ALERT')return;let el=lit[name];if(el)el.classList.toggle('on',on)});
 $('status').textContent=`${state.page} ${state.subpage}/${model.PAGES[state.page]?.pages||1}  | FCOM ${view.printedFcomPage}\nSCRATCH ${state.scratch||'—'}\nMSG ${view.scratchpadMessage?.text||'—'}\nPENDING ${Object.keys(state.pending).length} | EXEC ${view.annunciators.EXEC?'ON':'OFF'}\nLAST ${state.events.at(-1)?.key||'—'}`;
}
for(const c of source.controls){const el=document.createElement('button');el.type='button';el.className='hotspot '+c.shape;el.title=c.id;el.setAttribute('aria-label',c.label);
 const [x1,y1,x2,y2]=c.bbox_px;Object.assign(el.style,{left:100*x1/1199+'%',top:100*y1/1312+'%',width:100*(x2-x1)/1199+'%',height:100*(y2-y1)/1312+'%'});
 el.addEventListener('click',()=>action({type:'KEY',key:c.id}));if(c.id.endsWith('KEY_CLR')){let timer,used=false;
 el.addEventListener('pointerdown',()=>{used=false;timer=setTimeout(()=>{used=true;action({type:'CLEAR_LONG'})},760)});el.addEventListener('pointerup',()=>clearTimeout(timer));el.addEventListener('pointercancel',()=>clearTimeout(timer));
 el.addEventListener('click',e=>{if(used)e.stopImmediatePropagation()},true)}$('clickmap').appendChild(el);
}
for(const o of source.outputs){const e=document.createElement('div');e.id=o.id;e.className='annunciator '+o.color+(o.label==='EXEC'?' exec':'');
const b=o.sprite_bbox_px;Object.assign(e.style,{left:100*b[0]/1199+'%',top:100*b[1]/1312+'%',width:100*(b[2]-b[0])/1199+'%',height:100*(b[3]-b[1])/1312+'%'});
 if(o.label!=='EXEC'){const mask=document.createElement('img');mask.className='light-glyph';mask.src='../'+o.illuminated_sprite;mask.alt='';e.appendChild(mask)}
 $('annunciators').appendChild(e);lit[o.label]=e;
}
const events=[['call','SET_CALL','call'],['fail','SELF_TEST_FAIL','fail'],['offset','LNAV_OFFSET_GUIDANCE','lnavOffsetGuidance']];for(const [id,ty,field] of events)$(id).onclick=()=>action({type:ty,value:!state.status[field]});
$('advisory').onclick=()=>action({type:'MESSAGE',severity:'advisory',text:'CHECK FMC DATA'});
$('alert').onclick=()=>action({type:'MESSAGE',severity:'alert',text:'NAV DATA INVALID'});
$('restart').onclick=()=>action({type:'RESET'});
$('overlay-toggle').onclick=()=>{$('cdu-stage').classList.toggle('debug')};
window.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey)return;const v=event.key;let key=null;if(v==='Enter')key='EXEC';else if(v==='Backspace')key='KEY_CLR';else if(v===' ')key='KEY_SP';else if(v==='.')key='KEY_DOT';else if(v==='/')key='KEY_SLASH';else if(/^[A-Za-z0-9]$/.test(v))key='KEY_'+v.toUpperCase();if(key){event.preventDefault();action({type:'KEY',key:'CDU_CAPT_'+key})}});
draw();
})();