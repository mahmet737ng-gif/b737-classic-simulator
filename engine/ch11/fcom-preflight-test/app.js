'use strict';
(function(){
 const map=window.CDU_MAP,logic=window.CDU_FCOM_TEST,estimate=window.EPFSI_ESTIMATED_N1_V19;
 const $=id=>document.getElementById(id);
 if(!map||!logic||map.controls?.length!==70||map.outputs?.length!==5||map.artwork_pixels.join('x')!=='1199x1312'){
  $('last-status').textContent='CONTROL MAP OR MODEL INVALID — LAB BLOCKED';return;}
 let s=logic.makeState();const buttons=$('clickmap'),lamps={};
 function position(el,b){const [l,t,r,d]=b;Object.assign(el.style,{left:l/1199*100+'%',top:t/1312*100+'%',width:(r-l)/1199*100+'%',height:(d-t)/1312*100+'%'});}
 function key(id){logic.press(s,id);render();}
 for(const c of map.controls){
  const b=document.createElement('button');b.type='button';b.className='key-hitbox '+c.shape;b.title=c.label+' · '+c.id;b.dataset.label=c.label;
  b.setAttribute('aria-label',c.label);position(b,c.bbox_px);b.addEventListener('click',()=>key(c.id));buttons.appendChild(b);
 }
 for(const c of map.outputs){const lamp=document.createElement('div');lamp.className='lamp';position(lamp,c.sprite_bbox_px);
  if(c.illuminated_sprite){const img=document.createElement('img');img.src='../'+c.illuminated_sprite;img.alt='';lamp.appendChild(img);}
  else if(c.off_state_plate){const img=document.createElement('img');img.src='../'+c.off_state_plate;img.alt='';lamp.appendChild(img);lamp.classList.add('offplate');}
  $('annunciators').appendChild(lamp);lamps[c.label]=lamp;
 }
 function aligned(left,right){let a=String(left??'').slice(0,12),b=String(right??'').slice(0,11);
  return (a.padEnd(24-b.length,' ')+b).slice(0,24);
 }
 function addRow(text,css){const el=document.createElement('div');el.className='fmc-line'+(css?' '+css:'');el.textContent=String(text);$('fmc-lines').appendChild(el);}
 function render(){
  const v=logic.view(s,estimate);const container=$('fmc-lines');container.replaceChildren();
  addRow(aligned(v.title,v.count),'heading');
  for(const r of v.rows){addRow(aligned(r[0],r[2]),'fmc-small');addRow(aligned(r[1],r[3]),'');}
  addRow(v.scratch);
  if(lamps.EXEC)lamps.EXEC.classList.toggle('active',Boolean(v.exec));
  if(lamps.MSG)lamps.MSG.classList.toggle('active',Boolean(s.message)&&s.message!=='ROUTE ACTIVE');
  $('last-status').textContent='PAGE: '+s.page+' | KEY: '+s.lastKey+' | SCRATCH: '+(s.scratch||'—')+' | '+(s.message||'');
  $('state-output').textContent=JSON.stringify({page:s.page,variant:s.variant,limitsVariant:s.toleranceVariant,route:{origin:s.origin,dest:s.dest,active:s.routeActive,pending:s.routePending},performance:s.performance,limits:s.limits,n1SimEst:v.n1,thrust:s.thrust,lnavVnavAfdsEnabled:false},null,2);
  $('variant').value=s.variant;$('tolerance').value=s.toleranceVariant;
 }
 for(const b of document.querySelectorAll('button[data-page]'))b.addEventListener('click',()=>{logic.navigate(s,b.dataset.page);render();});
 $('variant').addEventListener('change',e=>{logic.setVariant(s,e.target.value);logic.navigate(s,'PERF_INIT');render();});
 $('tolerance').addEventListener('change',e=>{logic.setTolerance(s,e.target.value);logic.navigate(s,'PERF_LIMITS');render();});
 $('reset').addEventListener('click',()=>{s=logic.makeState();render();});
 $('debug').addEventListener('click',()=>$('cdu').classList.toggle('debug'));
 document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.altKey||e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
  let k=null;if(e.key==='Backspace')k='KEY_CLR';else if(e.key==='Enter')k='EXEC';else if(e.key===' ')k='KEY_SP';else if(e.key==='.')k='KEY_DOT';else if(e.key==='/')k='KEY_SLASH';else if(e.key==='-')k='KEY_PLUS_MINUS';else if(/^[A-Z0-9]$/i.test(e.key))k='KEY_'+e.key.toUpperCase();
  if(k){e.preventDefault();key('CDU_CAPT_'+k);}
 });
 window.CDU_FCOM_TEST_QA={state:()=>JSON.parse(JSON.stringify(s)),press:key,navigate:p=>{logic.navigate(s,p);render();}};
 render();
})();