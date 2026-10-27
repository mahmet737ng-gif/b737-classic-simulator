/* LEDEV-0001 — independent 32-window, front-end-only B737 Classic annunciator.
   Additive to UPPER atlas; never mutates locked OH01-06 source or guarded switches. */
(function(){
 'use strict';
 const ns='http://www.w3.org/2000/svg';
 const assetBase=new URL('./',document.currentScript.src);
 const left=['SLAT_1','SLAT_2','SLAT_3','SLAT_4','FLAP_1','FLAP_2'];
 const right=['FLAP_3','FLAP_4','SLAT_5','SLAT_6','SLAT_7','SLAT_8'];
 const levels=['TRANSIT','EXT','FULL_EXT'];
 const colors={TRANSIT:'#ffa600',EXT:'#35ef15',FULL_EXT:'#35ef15'};
 const activeLevels=id=>id.startsWith('FLAP_')?['TRANSIT','FULL_EXT']:levels;
 const hasWindow=(id,level)=>devices.includes(id)&&activeLevels(id).includes(level);
 const lampCount=32;
 const devices=[...left,...right];
 const states=new Map(devices.map(id=>[id,'RETRACTED']));
 const overrides=new Map();
 const instances=new Set();
 let lampTest=false,brightness='BRIGHT';
 const metrics={source:{width:432,height:195},atlas:{x:.0065,y:.063,w:.213,h:.202},lampCount};
 const isValid=(id,state)=>devices.includes(id)&&['RETRACTED',...activeLevels(id)].includes(state);
 function emit(type,detail){window.dispatchEvent(new CustomEvent(type,{detail}));}
 function recolor(){
  for(const instance of instances){
   const test=lampTest;
   for(const [key,el] of instance.lamps){
    const [id,level]=key.split('|'),on=test||(overrides.has(key)?overrides.get(key):states.get(id)===level);
    el.dataset.lit=String(on);
    el.setAttribute('fill',on?colors[level]:(level==='TRANSIT'?'#4b3410':'#1c391f'));
    el.style.opacity=on?(brightness==='BRIGHT'?'1':'.49'):'1';
   }
   instance.button.classList.toggle('pressed',lampTest);
   instance.button.setAttribute('aria-pressed',String(lampTest));
   if(instance.output)instance.output.textContent=lampTest?'TEST · ALL 32 ON':'READY · '+brightness+' · 32 INDEPENDENT WINDOWS';
  }
 }
 function setLampTest(value){const next=!!value;if(lampTest===next)return;lampTest=next;recolor();emit('b737:le-devices-lamp-test',{pressed:next,windows:lampCount,source:'physical-recessed-button'});}
 function setDevice(id,state){
  id=String(id||'').toUpperCase();state=String(state||'').toUpperCase();
  if(!isValid(id,state))return false;
  states.set(id,state);for(const level of activeLevels(id))overrides.delete(id+'|'+level);recolor();emit('b737:le-devices-state',{id,state});return true;
 }
 function setWindow(device,level,lit){
  device=String(device||'').toUpperCase();level=String(level||'').toUpperCase();
  if(!hasWindow(device,level))return false;
  const key=device+'|'+level;if(lit===null)overrides.delete(key);else overrides.set(key,!!lit);
  recolor();emit('b737:le-window-state',{id:'LE_'+device+'_'+level,device,level,lit});return true;
 }
 function setBrightness(value){if(!['BRIGHT','DIM'].includes(value))return false;brightness=value;recolor();return true;}
 function makeSvg(name,attrs){const n=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,String(v));return n;}
 function coords(side,i,row,span=1){
  const x=side==='left'?[47,69,92,115,138,161,184]:[250,273,296,319,342,365,388];
  const x0=x[i]+1.1,x1=x[i+1]-1.1;
  const top=x=>side==='left'?23+(x-47)*.346:70.8-(x-250)*.346;
  const a=top(x0)+row*24+1.2,b=top(x1)+row*24+1.2;
  return 'M'+x0.toFixed(2)+' '+a.toFixed(2)+' L'+x1.toFixed(2)+' '+b.toFixed(2)+' L'+x1.toFixed(2)+' '+(b+22+(span-1)*24).toFixed(2)+' L'+x0.toFixed(2)+' '+(a+22+(span-1)*24).toFixed(2)+' Z';
 }
 function mount(host){
  if(host.dataset.b737LeMounted==='1')return;
  host.dataset.b737LeMounted='1';
  host.classList.add('b737-le-devices');
  host.setAttribute('role','group');
  host.setAttribute('aria-label','LE DEVICES — leading edge flaps and slats indicator');
  host.dir='ltr';
  const art=document.createElement('img');art.className='b737-le-devices__background';art.src=new URL('panel-background.svg',assetBase).href;art.alt='';art.draggable=false;
  const lights=makeSvg('svg',{viewBox:'0 0 432 195',class:'b737-le-devices__lamps','aria-label':'12 leading-edge devices, 32 independent light segments'});
  const lamps=new Map();
  for(const [side,ids] of [['left',left],['right',right]]){
   ids.forEach((id,index)=>activeLevels(id).forEach(level=>{
    const row=levels.indexOf(level),span=(id.startsWith('FLAP_')&&level==='FULL_EXT')?2:1;
    const path=makeSvg('path',{id:'LE_'+id+'_'+level,d:coords(side,index,row,span),stroke:'#f7f8ef','stroke-width':'2.3','stroke-linejoin':'round','vector-effect':'non-scaling-stroke','data-device':id,'data-level':level,'role':'button','tabindex':'0','aria-label':id.replace('_',' ')+' '+level});
    const title=makeSvg('title');title.textContent=id.replace('_',' ')+' — '+level+' (select demo state)';path.append(title);
    const toggle=event=>{event.stopPropagation();const key=id+'|'+level;const lit=overrides.has(key)?overrides.get(key):states.get(id)===level;setWindow(id,level,!lit);};
    path.addEventListener('click',toggle);
    path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(e);}});
    lights.append(path);lamps.set(id+'|'+level,path);
   }));
  }
  const test=document.createElement('button');test.className='b737-le-devices__test';test.type='button';test.setAttribute('aria-label','LE DEVICES TEST momentary recessed pushbutton');test.title='Press and hold to illuminate all 32 windows';
  const cap=document.createElement('img');cap.src=new URL('recessed-test-button.svg',assetBase).href;cap.alt='';cap.draggable=false;test.append(cap);
  test.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.stopPropagation();e.preventDefault();try{test.setPointerCapture(e.pointerId);}catch(_){}setLampTest(true);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])test.addEventListener(name,e=>{e.stopPropagation();setLampTest(false);});
  test.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)setLampTest(true);}});
  test.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setLampTest(false);}});
  test.addEventListener('click',e=>e.stopPropagation());
  const output=host.closest('[data-b737-le-devices]')?.parentElement?.querySelector('[data-le-devices-status]')||null;
  host.append(art,lights,test);instances.add({host,lamps,button:test,output});recolor();
 }
 function mountAtlas(){
  const root=document.getElementById('atlasAbsolute');if(!root)return;
  const frame=root.querySelector('.atlas-piece[data-key="UPPER"]');
  if(!frame||root.querySelector('[data-b737-le-devices-atlas]'))return;
  const px=n=>Number.parseFloat(n)||0;
  const x=px(frame.style.left),y=px(frame.style.top),w=px(frame.style.width),h=px(frame.style.height);
  const host=document.createElement('div');host.dataset.b737LeDevicesAtlas='';
  host.style.position='absolute';host.style.left=(x+metrics.atlas.x*w)+'px';host.style.top=(y+metrics.atlas.y*h)+'px';
  host.style.width=(metrics.atlas.w*w)+'px';host.style.height=(metrics.atlas.h*h)+'px';host.style.zIndex='12';
  root.append(host);mount(host);
 }
 function initialize(){
  document.querySelectorAll('[data-b737-le-devices]').forEach(mount);
  const root=document.getElementById('atlasAbsolute');
  if(root){mountAtlas();const observer=new MutationObserver(()=>{for(const i of [...instances])if(!i.host.isConnected)instances.delete(i);mountAtlas();});observer.observe(root,{childList:true});}
 }
 window.B737LeadingEdgeDevices=Object.freeze({
  devices:Object.freeze([...devices]),levels:Object.freeze([...levels]),hasWindow,
  setDevice,setWindow,setLampTest,setBrightness,
  snapshot:()=>({devices:Object.fromEntries(states),windowOverrides:Object.fromEntries(overrides),lampTest,brightness,windows:lampCount,placement:metrics}),
  reset:()=>{for(const id of devices)states.set(id,'RETRACTED');overrides.clear();setLampTest(false);recolor();}
 });
 window.addEventListener('b737:le-devices-command',e=>{
  const d=e.detail||{};if(d.action==='set-device')setDevice(d.id,d.state);
  if(d.action==='set-window')setWindow(d.id,d.level,d.lit);
  if(d.action==='lamp-test')setLampTest(d.active);
  if(d.action==='brightness')setBrightness(d.value);
 });
 window.addEventListener('blur',()=>setLampTest(false));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)setLampTest(false);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
