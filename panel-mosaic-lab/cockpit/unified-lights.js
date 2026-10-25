(function(){
 'use strict';
 const model=window.B737LightAssets;
 const byId=id=>document.getElementById(id);
 const dialog=byId('unifiedLightsDialog');
 const assetRoot='../assets/locked/2026-10-23/LIGHTS/';
 const states=new Map(),cards=new Map();
 let lights=[],version='LGT-0020',registered=new Set(),loadPromise=null,loaded=false,loadError='';
 const queryKey=value=>String(value).toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');

 function update(c){
  const card=cards.get(c.id);if(!card)return;
  const state=states.get(c.id)||'OFF',file=c.assets[state];
  if(!file){card.health.textContent='MISSING '+state;card.health.classList.add('bad');return;}
  card.image.onload=()=>{
   const w=card.image.naturalWidth,h=card.image.naturalHeight;
   const matches=!registered.has(c.id)||(w===c.face.width&&h===c.face.height);
   card.health.textContent=matches?state+' · '+w+'×'+h:'SIZE MISMATCH · '+w+'×'+h;
   card.health.classList.toggle('bad',!matches);
  };
  card.image.onerror=()=>{card.health.textContent='MISSING '+file;card.health.classList.add('bad');};
  card.image.src=assetRoot+file.split('/').map(encodeURIComponent).join('/')+'?v='+encodeURIComponent(version);
  card.image.alt=c.lines.join(' ')+' '+state;
  card.stage.setAttribute('aria-label',c.id+' · '+state+' · کلیک برای حالت بعدی');
  for(const button of card.buttons)button.setAttribute('aria-pressed',String(button.dataset.state===state));
 }
 function set(id,value,notify=true){
  const c=lights.find(c=>c.id===String(id).toUpperCase());if(!c)return false;
  const state=model.normalize(c,value);if(!state)return false;
  states.set(c.id,state);update(c);
  if(notify)window.dispatchEvent(new CustomEvent('b737:unified-legend-test',{detail:{asset:c.id,state}}));
  return true;
 }
 function render(){
  const grid=byId('unifiedLightGrid');grid.replaceChildren();cards.clear();
  const query=queryKey(byId('unifiedLightSearch').value);
  const shown=lights.filter(c=>queryKey(c.id+' '+c.lines.join(' ')).includes(query));
  for(const c of shown){
   const card=document.createElement('article');card.className='unified-light-card';card.dataset.light=c.id;
   const heading=document.createElement('h3');heading.textContent=c.lines.join(' / ');
   const id=document.createElement('div');id.className='unified-light-id';id.textContent=c.id;
   const stage=document.createElement('div');stage.className='unified-light-stage';stage.role='button';stage.tabIndex=0;
   const img=document.createElement('img');img.draggable=false;img.loading='lazy';stage.append(img);
   const buttons=document.createElement('div');buttons.className='unified-light-buttons';const bs=[];
   for(const state of c.states){const button=document.createElement('button');button.type='button';button.dataset.state=state;button.textContent=state;button.onclick=()=>set(c.id,state);buttons.append(button);bs.push(button);}
   const advance=()=>set(c.id,c.states[(c.states.indexOf(states.get(c.id)||'OFF')+1)%c.states.length]);
   stage.onclick=advance;stage.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();advance();}};
   const health=document.createElement('div');health.className='unified-light-health';health.setAttribute('role','status');
   card.append(heading,id,stage,buttons,health);grid.append(card);
   cards.set(c.id,{image:img,buttons:bs,stage,health});if(!states.has(c.id))states.set(c.id,'OFF');update(c);
  }
  byId('unifiedLightStats').textContent=lights.length+' نوع چراغ · '+lights.filter(c=>c.states.includes('DIM_BLUE')).length+' نوع آبی سه‌حالته · '+shown.length+' نمایش داده‌شده · '+version;
 }
 // The single canonical gallery registry is also Unified's library. Do not duplicate
 // 193 SVG files or make a blocking GitHub API call on startup.
 function announceReady(){
  const count=lights.length;
  const open=byId('unifiedLightsOpen');
  open.textContent='تست چراغ‌ها ('+count+')';
  open.setAttribute('aria-label','کتابخانهٔ یونیفاید · '+count+' نوع چراغ');
  window.dispatchEvent(new CustomEvent('b737:unified-light-library-ready',{
   detail:{version,count,states:lights.reduce((n,c)=>n+c.states.length,0)}
  }));
 }
 function validateRegistry(reg){
  if(!reg||!Array.isArray(reg.lights)||!reg.lights.length)throw Error('رجیستری فاقد چراغ است');
  const ids=new Set();
  for(const c of reg.lights){
   if(ids.has(c.id))throw Error('شناسهٔ تکراری: '+c.id);
   ids.add(c.id);
   if(!c.assets?.OFF||!c.states?.includes('OFF')||!c.states.some(s=>s!=='OFF'))throw Error('حالت ناقص: '+c.id);
   if(!c.face||c.face.width<=0||c.face.height<=0)throw Error('ابعاد نامعتبر: '+c.id);
   for(const state of c.states){
    const path=c.assets[state];
    if(typeof path!=='string'||!/^[-a-zA-Z0-9_./]+\\.svg$/.test(path)||path.includes('..')||path.startsWith('/'))throw Error('مسیر SVG نامعتبر: '+c.id+' '+state);
   }
  }
 }
 async function sync({renderNow=true,force=true}={}){
  if(loadPromise){
   await loadPromise;
   if(renderNow&&loaded)render();
   return;
  }
  if(loaded&&!force){if(renderNow)render();return;}
  const button=byId('unifiedLightSync');button.disabled=true;
  loadPromise=(async()=>{
   try{
    const response=await fetch('../lights-test/registry.json?ts='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('رجیستری چراغ‌ها در دسترس نیست');
    const reg=await response.json();
    validateRegistry(reg);
    version=reg.version;registered=new Set(reg.lights.map(c=>c.id));
    lights=model.merge(reg);
    for(const c of lights)if(!c.states.includes(states.get(c.id)))states.set(c.id,'OFF');
    loaded=true;loadError='';announceReady();
   }catch(error){
    loadError=error.message;
    if(!loaded)byId('unifiedLightsOpen').textContent='چراغ‌ها · خطای اتصال';
    byId('unifiedLightStats').textContent='خطای همگام‌سازی: '+loadError;
   }finally{button.disabled=false;}
  })();
  try{await loadPromise;}finally{loadPromise=null;}
  if(renderNow&&loaded)render();
 }
 function all(state){for(const c of lights){const s=state==='OFF'?'OFF':c.states.at(-1);states.set(c.id,s);window.dispatchEvent(new CustomEvent('b737:unified-legend-test',{detail:{asset:c.id,state:s}}));}render();}
 byId('unifiedLightsOpen').onclick=()=>{dialog.showModal();if(loaded)render();sync({renderNow:true,force:true});};
 byId('unifiedLightsClose').onclick=()=>dialog.close();
 byId('unifiedLightSearch').oninput=render;
 byId('unifiedLightSync').onclick=sync;
 byId('unifiedLightAllOn').onclick=()=>all('ON');
 byId('unifiedLightAllOff').onclick=()=>all('OFF');
 byId('unifiedLightReset').onclick=()=>{states.clear();window.dispatchEvent(new CustomEvent('b737:unified-legend-clear'));render();};
 // Uniform resolver for future panel mounts. No location or aircraft logic is inferred.
 const find=id=>lights.find(c=>c.id===String(id).toUpperCase())||null;
 const resolve=(id,state='OFF')=>{
  const c=find(id);if(!c)return null;
  const frame=model.normalize(c,state);if(!frame)return null;
  return {id:c.id,state:frame,url:new URL(assetRoot+c.assets[frame],location.href).href,
   face:{...c.face},scope:c.scope||'ASSET_TEST_ONLY',
   mountedCockpitInstances:[...(c.mountedCockpitInstances||[])]};
 };
 window.B737UnifiedLights=Object.freeze({
  open:()=>byId('unifiedLightsOpen').click(),
  set,
  getFrame:id=>states.get(String(id).toUpperCase())||'OFF',
  registry:()=>JSON.parse(JSON.stringify(lights)),
  resolve,
  whenReady:()=>loadPromise||Promise.resolve(),
  status:()=>({ready:loaded,version,count:lights.length,error:loadError})
 });
 // Preload metadata only: images stay lazy until the user opens the test library.
 sync({renderNow:false,force:false});
})();
