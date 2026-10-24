(function(){
 'use strict';
 const model=window.B737LightAssets;
 const byId=id=>document.getElementById(id);
 const dialog=byId('unifiedLightsDialog');
 const assetRoot='../assets/locked/2026-10-23/LIGHTS/';
 const githubApi='https://api.github.com/repos/mahmet737ng-gif/b737-classic-simulator/contents/panel-mosaic-lab/assets/locked/2026-10-23/LIGHTS';
 const states=new Map(),cards=new Map();
 let lights=[],version='LGT-0006',registered=new Set();

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
  card.image.src=assetRoot+encodeURIComponent(file)+'?v='+encodeURIComponent(version);
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
  const query=byId('unifiedLightSearch').value.trim().toUpperCase().replace(/\s+/g,'_');
  const shown=lights.filter(c=>(c.id+'_'+c.lines.join('_')).toUpperCase().includes(query));
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
 async function sync(){
  const button=byId('unifiedLightSync');button.disabled=true;
  try{
   const response=await fetch('../lights-test/registry.json?ts='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw Error('رجیستری چراغ‌ها در دسترس نیست');
   const reg=await response.json();version=reg.version;registered=new Set(reg.lights.map(c=>c.id));
   lights=model.merge(reg);
   try{const r=await fetch(githubApi,{cache:'no-store'});if(r.ok){const files=await r.json();if(Array.isArray(files))lights=model.merge(reg,files);}}catch{/* The full versioned registry works offline from the GitHub API. */}
   for(const c of lights)if(!c.states.includes(states.get(c.id)))states.set(c.id,'OFF');
   render();
  }catch(error){byId('unifiedLightStats').textContent='خطای همگام‌سازی: '+error.message;}
  finally{button.disabled=false;}
 }
 function all(state){for(const c of lights){const s=state==='OFF'?'OFF':c.states.at(-1);states.set(c.id,s);window.dispatchEvent(new CustomEvent('b737:unified-legend-test',{detail:{asset:c.id,state:s}}));}render();}
 byId('unifiedLightsOpen').onclick=()=>{dialog.showModal();sync();};
 byId('unifiedLightsClose').onclick=()=>dialog.close();
 byId('unifiedLightSearch').oninput=render;
 byId('unifiedLightSync').onclick=sync;
 byId('unifiedLightAllOn').onclick=()=>all('ON');
 byId('unifiedLightAllOff').onclick=()=>all('OFF');
 byId('unifiedLightReset').onclick=()=>{states.clear();window.dispatchEvent(new CustomEvent('b737:unified-legend-clear'));render();};
 window.B737UnifiedLights=Object.freeze({open:()=>byId('unifiedLightsOpen').click(),set,getFrame:id=>states.get(String(id).toUpperCase())||'OFF',registry:()=>JSON.parse(JSON.stringify(lights))});
})();
