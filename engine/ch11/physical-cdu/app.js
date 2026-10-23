'use strict';
(()=>{
 const map=window.CDU_MAP, engine=window.CH11_FMC_RUNTIME_V2;
 const $=id=>document.getElementById(id);
 if(!map||!engine){$('status').textContent='Original control map or FCOM engine failed to load';return;}
 if(map.controls.length!==70||map.outputs.length!==5||map.artwork_pixels.join('x')!=='1199x1312'){
  $('status').textContent='SOURCE CONTROL MAP MISMATCH — INTERACTION BLOCKED';return;
 }
 let state=engine.createState(),lastKey='NONE',lastBlock='';
 const [W,H]=map.artwork_pixels;
 const lamps={};const click=$('clickmap');
 function pos(el,box){const [l,t,r,b]=box;Object.assign(el.style,{
   left:l/W*100+'%',top:t/H*100+'%',width:(r-l)/W*100+'%',height:(b-t)/H*100+'%'
 });}
 function dispatch(ev){
  try{const out=engine.dispatch(state,ev);state=out.state;lastBlock=state.last_error||'';}
  catch(err){lastBlock=String(err.message||err);}
  render();
 }
 function page(name){dispatch({type:'PAGE',page:name})}
 function routeLSK(id){
  if(state.page==='INDEX'){if(id==='L2')return page('RTE');if(id==='L1')return page('IDENT');}
  if(state.page==='IDENT'&&id==='R6')return page('POS_INIT');
  if(state.page==='DEP_ARR'){if(id==='L1')return page('DEPARTURES');if(id==='R1')return page('ARRIVALS');}
  if(id==='L6'&&state.page!=='RTE')return page('INDEX');
  if(state.page==='RTE'&&id==='R6')return dispatch({type:'ACTIVATE_ROUTE'});
  if(state.page==='RTE'&&id==='L6')return dispatch({type:'ERASE_MOD'});
  const fields={RTE:{L1:'ORIGIN',R1:'DEST',L3:'RUNWAY',R2:'FLIGHT',L2:'CO_ROUTE'}};
  const field=fields[state.page]?.[id];
  if(!field){lastBlock='LSK ACTION REQUIRES VERIFIED CH11 PAGE LOGIC';render();return;}
  if(state.scratch&&state.scratch!=='DELETE'){
   const value=state.scratch;
   dispatch({type:'STAGE_ROUTE_FIELD',field,value});
   if(!lastBlock){for(let i=0;i<value.length;i++)dispatch({type:'KEY_CLR'});}
  }else{
   const value=engine.presentationValue(state,field);
   if(value){for(const c of value)dispatch({type:'KEY_CHAR',character:c});}
  }
 }
 function onKey(id,longPress=false){
  lastKey=id;lastBlock='';
  const key=id.replace(/^CDU_CAPT_/,'');
  if(key.startsWith('LSK_'))return routeLSK(key.slice(4));
  if(key==='EXEC')return dispatch({type:'EXECUTE'});
  if(key==='INIT_REF'||key==='MENU')return page('INDEX');
  const names=['RTE','DEP_ARR','LEGS','CLB','CRZ','DES','HOLD','PROG','N1_LIMIT','FIX'];
  if(names.includes(key))return page(key);
  if(key==='KEY_DEL')return dispatch({type:'KEY_DEL'});
  if(key==='KEY_CLR')return dispatch({type:'KEY_CLR',long_press:longPress});
  if(key==='KEY_PLUS_MINUS')return dispatch({type:'KEY_SIGN'});
  if(key==='KEY_SP')return dispatch({type:'KEY_CHAR',character:' '});
  if(key==='KEY_DOT')return dispatch({type:'KEY_CHAR',character:'.'});
  if(key==='KEY_SLASH')return dispatch({type:'KEY_CHAR',character:'/'});
  if(/^KEY_[A-Z0-9]$/.test(key))return dispatch({type:'KEY_CHAR',character:key.slice(-1)});
  lastBlock='CONTROL LOGIC NOT YET DOCUMENTED FOR THIS MODE';render();
 }
 for(const c of map.controls){
  const key=document.createElement('button');
  key.type='button';key.className='key-hitbox '+c.shape;key.dataset.label=c.label;
  key.title=c.label+' · '+c.id;key.setAttribute('aria-label',c.label);
  pos(key,c.bbox_px);
  let timer=null,held=false;
  if(c.id.endsWith('KEY_CLR')){
   key.addEventListener('pointerdown',()=>{held=false;timer=setTimeout(()=>{held=true;onKey(c.id,true)},700)});
   for(const ev of ['pointerup','pointerleave','pointercancel'])key.addEventListener(ev,()=>clearTimeout(timer));
  }
  key.addEventListener('click',()=>{if(held){held=false;return;}onKey(c.id)});
  click.append(key);
 }
 for(const c of map.outputs){
  if(c.off_state_plate){
   const layer=document.createElement('div');layer.className='lamp offplate';pos(layer,c.sprite_bbox_px);
   const img=document.createElement('img');img.src='../'+c.off_state_plate;img.alt='';layer.append(img);
   $('annunciators').append(layer);lamps.EXEC_PLATE=layer;
  }else if(c.illuminated_sprite){
   const layer=document.createElement('div');layer.className='lamp';
   pos(layer,c.sprite_bbox_px);const img=document.createElement('img');img.src='../'+c.illuminated_sprite;img.alt='';layer.append(img);
   $('annunciators').append(layer);lamps[c.label]=layer;
  }
 }
 function line(a='',b=''){a=String(a).slice(0,24);b=String(b).slice(0,24);return (a.slice(0,24-b.length).padEnd(24-b.length,' ')+b).slice(0,24)}
 function screenRows(){
  const page=state.page,view=engine.view(state,page),rte=engine.view(state,'RTE');
  const rows=Array(14).fill(' '.repeat(24));const put=(i,a,b)=>{rows[i]=line(a,b)};
  put(0,(page==='RTE'?rte.route_state+' ':'')+page,'1/1');
  if(page==='INDEX'){put(2,'<IDENT','POS INIT>');put(4,'<RTE','PERF INIT>');put(6,'<LEGS','TAKEOFF>');}
  else if(page==='IDENT'){
   // Initial PREFLIGHT display; exact fields pending page-by-page FCOM validation.
   put(1,'MODEL','ENG RATING');
   put(2,'737-300','CFM56-3B-1');
   put(5,'NAV DATA','STATUS');
   put(6,'-------',state.navdb.source_status);
   put(11,'<INDEX','POS INIT>');
  }
  else if(page==='RTE'){
   put(1,'ORIGIN','DEST');put(2,rte.ORIGIN,rte.DEST);
   put(3,'CO ROUTE','FLIGHT');
   put(4,engine.presentationValue(state,'CO_ROUTE')||'----------',engine.presentationValue(state,'FLIGHT')||'---------');
   put(5,'RUNWAY');put(6,rte.RUNWAY);
   put(10,state.route.activation_requested?'MOD READY':'');
   put(11,'<ERASE','ACTIVATE>');
  }else if(page==='DEP_ARR'){
   put(1,'ORIGIN','DEST');put(2,view.ORIGIN,view.DEST);
   put(4,'<DEPARTURES','ARRIVALS>');
   put(11,'<INDEX','RTE>');
  }else if(page==='DEPARTURES'){
   put(1,'AIRPORT');put(2,view.airport);
   put(3,'RUNWAY','SID');put(4,view.runway,'----');
   put(5,'TRANS');put(6,'----');put(11,'<INDEX','RTE>');
  }else if(page==='ARRIVALS'){
   put(1,'AIRPORT');put(2,view.airport);
   put(3,'RUNWAY','STAR/APP');put(4,'----','----');
   put(11,'<INDEX','RTE>');
  }else if(page==='LEGS'){
   put(2,'-- ROUTE INFORMATION --');put(4,'NOT FLYABLE · PRIVATE DB');
   put(6,'ROUTE DISCONTINUITY');
   put(11,'<INDEX','RTE>');
  }else{
   put(2,'CH11 PAGE LOGIC PENDING');put(4,'NO INVENTED FMC DATA');
   put(11,'<INDEX','RTE>');
  }
  put(12,'------------------------');put(13,state.scratch||engine.topMessage(state)?.text||'');
  return rows;
 }
 function render(){
  const display=$('fmc-lines');display.replaceChildren();
  for(const str of screenRows()){const el=document.createElement('div');el.className='fmc-line';el.textContent=str;display.appendChild(el);}
  for(const name of ['CALL','FAIL','MSG','OFST'])lamps[name]?.classList.toggle('active',Boolean(state.lights[name]));
  lamps.EXEC_PLATE?.classList.toggle('active',!state.lights.EXEC);
  $('status').textContent='Physical map: '+map.controls.length+' keys · 5 indicators · FCOM v2 · '+state.page+' · '+lastKey;
  $('last-error').textContent=lastBlock||'TRAINING ONLY · EXEC references do not enable LNAV/VNAV/AFDS';
  $('state-output').textContent=JSON.stringify({page:state.page,route:state.route,lights:state.lights,phase:state.phase,guidance:state.guidance},null,2);
 }
 $('debug').onclick=()=>$('cdu').classList.toggle('debug');
 $('reset').onclick=()=>{state=engine.createState();lastBlock='';lastKey='RESET';render();};
 // Dedicated QA contract, no externally writable avionics data channel.
 window.CH11_PHYSICAL_LAB_QA={getControlCount:()=>map.controls.length,readState:()=>JSON.parse(JSON.stringify(state)),press:onKey};
 render();
})();