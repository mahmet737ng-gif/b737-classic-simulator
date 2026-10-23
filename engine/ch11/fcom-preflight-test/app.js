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
 // Source-photo pixel coordinates — explicitly derived from the locked LSK map.
 // LSK centers on the original 1199×1312 artwork: 176, 250, 326, 400, 476, 552.
 const KEY_CENTERS=Array.from({length:6},(_,i)=>{
  const c=map.controls.find(x=>x.id==='CDU_CAPT_LSK_L'+(i+1));
  if(!c)throw Error('LOCKED LSK MAP INCOMPLETE');
  return c.center_px[1];
 });
 const LCD_TOP=1312*0.0745,LCD_HEIGHT=1312*0.375;
 function addRow(left,right,kind,y){
  const row=document.createElement('div');
  row.className='fmc-line '+(kind||'');
  row.style.top=((y-LCD_TOP)/LCD_HEIGHT*100).toFixed(4)+'%';
  for(const [side,value] of [['left',left],['right',right]]){
   if(value===null||value===undefined||String(value)==='')continue;
   const el=document.createElement('span');
   el.className='fmc-cell fmc-'+side;
   el.textContent=String(value);
   row.appendChild(el);
  }
  $('fmc-lines').appendChild(row);
 }
 // No padded spaces: the Boeing screen-font's advance widths are not a
 // substitute for two independently positioned FCOM text columns.
 function fitScreenText(){
  const screen=$('fmc-lines');
  if(!screen||!screen.clientWidth||!screen.clientHeight||!screen.children.length)return;
  const ctx=document.createElement('canvas').getContext('2d');
  const available=screen.clientWidth;
  const lskPitch=(KEY_CENTERS[5]-KEY_CENTERS[0])/5/LCD_HEIGHT*screen.clientHeight;
  let px=Math.min(32,available*0.055,lskPitch*.47);
  for(let n=0;n<12;n++){
   screen.style.fontSize=px.toFixed(3)+'px';
   let fit=1;
   for(const cell of screen.querySelectorAll('.fmc-cell')){
    const cs=getComputedStyle(cell);
    const range=document.createRange();
    range.selectNodeContents(cell);
    if(ctx)ctx.font=cs.font||cs.fontSize+' '+cs.fontFamily;
    const width=Math.max(range.getBoundingClientRect().width,ctx?ctx.measureText(cell.textContent||'').width:0);
    const row=cell.parentElement;
    // FCOM heading uses 70% of LCD, paired data each has 44%.
    const ratio=row.classList.contains('heading')?
      (cell.classList.contains('fmc-left')?.70:.14):
      (row.classList.contains('scratch')?.92:.44);
    const maxWidth=available*ratio*.93;
    if(width>maxWidth)fit=Math.min(fit,maxWidth/width);
    const maxHeight=lskPitch*(row.classList.contains('fmc-small')?.32:.52);
    const h=range.getBoundingClientRect().height;
    if(h>maxHeight)fit=Math.min(fit,maxHeight/h);
   }
   if(fit>=0.992)break;
   px=Math.max(4,px*fit*.99);
  }
 }
 function render(){
  const v=logic.view(s,estimate);const container=$('fmc-lines');container.replaceChildren();
  addRow(v.title,v.count,'heading',119);
  for(let i=0;i<6;i++){
   const r=v.rows[i];
   addRow(r[0],r[2],'fmc-small',KEY_CENTERS[i]-25);
   addRow(r[1],r[3],'',KEY_CENTERS[i]);
  }
  addRow(v.scratch,'','scratch',576);
  fitScreenText();
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
 window.CDU_FCOM_TEST_QA={state:()=>JSON.parse(JSON.stringify(s)),press:key,navigate:p=>{logic.navigate(s,p);render();},fitScreenText};
 if(typeof ResizeObserver==='function'){
  const resize=new ResizeObserver(()=>fitScreenText());
  resize.observe($('cdu'));
 }else window.addEventListener('resize',fitScreenText);
 if(document.fonts?.ready)document.fonts.ready.then(fitScreenText);
 render();
})();