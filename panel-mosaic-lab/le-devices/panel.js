/* LEDEV-0006 — owner-approved 26-window, front-end-only B737 Classic annunciator.
   Additive to UPPER atlas; never mutates locked OH01-06 source or guarded switches. */
(function(){
 'use strict';
 const ns='http://www.w3.org/2000/svg';
 const assetBase=new URL('./',document.currentScript.src);
 const left=['SLAT_1','SLAT_2','SLAT_3','FLAP_1','FLAP_2'];
 const right=['FLAP_3','FLAP_4','SLAT_4','SLAT_5','SLAT_6'];
 const levels=['TRANSIT','EXT','FULL_EXT'];
 const colors={TRANSIT:'#ffd22a',EXT:'#3ce5aa',FULL_EXT:'#3ce5aa'};
 const activeLevels=id=>id.startsWith('FLAP_')?['TRANSIT','FULL_EXT']:levels;
 const hasWindow=(id,level)=>devices.includes(id)&&activeLevels(id).includes(level);
 const lampCount=26;
 const windowSpecs=[{"device":"SLAT_1","level":"TRANSIT","polygon":[[417.0,106.0],[497.0,134.0],[492.0,219.0],[417.0,190.0]]},{"device":"SLAT_1","level":"EXT","polygon":[[419.0,210.0],[496.0,239.0],[494.0,334.0],[417.0,304.0]]},{"device":"SLAT_1","level":"FULL_EXT","polygon":[[421.0,325.0],[496.0,353.0],[494.0,442.0],[416.0,413.0]]},{"device":"SLAT_2","level":"TRANSIT","polygon":[[514.0,142.0],[607.0,175.0],[604.0,259.0],[513.0,225.0]]},{"device":"SLAT_2","level":"EXT","polygon":[[513.0,247.0],[606.0,278.0],[601.0,372.0],[513.0,339.0]]},{"device":"SLAT_2","level":"FULL_EXT","polygon":[[513.0,361.0],[605.0,393.0],[602.0,480.0],[513.0,447.0]]},{"device":"SLAT_3","level":"TRANSIT","polygon":[[624.0,182.0],[718.0,216.0],[716.0,298.0],[622.0,263.0]]},{"device":"SLAT_3","level":"EXT","polygon":[[625.0,283.0],[718.0,318.0],[718.0,412.0],[621.0,379.0]]},{"device":"SLAT_3","level":"FULL_EXT","polygon":[[621.0,401.0],[718.0,434.0],[715.0,520.0],[621.0,485.0]]},{"device":"FLAP_1","level":"TRANSIT","polygon":[[735.0,224.0],[819.0,254.0],[818.0,331.0],[735.0,303.0]]},{"device":"FLAP_1","level":"FULL_EXT","polygon":[[735.0,325.0],[818.0,353.0],[817.0,553.0],[735.0,525.0]]},{"device":"FLAP_2","level":"TRANSIT","polygon":[[839.0,260.0],[907.0,285.0],[912.0,365.0],[835.0,339.0]]},{"device":"FLAP_2","level":"FULL_EXT","polygon":[[839.0,359.0],[912.0,387.0],[912.0,585.0],[833.0,560.0]]},{"device":"FLAP_3","level":"TRANSIT","polygon":[[1075.0,290.0],[1154.0,262.0],[1154.0,338.0],[1077.0,368.0]]},{"device":"FLAP_3","level":"FULL_EXT","polygon":[[1079.0,385.0],[1154.0,361.0],[1154.0,558.0],[1074.0,585.0]]},{"device":"FLAP_4","level":"TRANSIT","polygon":[[1170.0,254.0],[1253.0,221.0],[1255.0,302.0],[1171.0,331.0]]},{"device":"FLAP_4","level":"FULL_EXT","polygon":[[1170.0,354.0],[1255.0,325.0],[1255.0,522.0],[1175.0,552.0]]},{"device":"SLAT_4","level":"TRANSIT","polygon":[[1272.0,215.0],[1362.0,183.0],[1363.0,263.0],[1272.0,295.0]]},{"device":"SLAT_4","level":"EXT","polygon":[[1275.0,314.0],[1360.0,284.0],[1364.0,378.0],[1272.0,409.0]]},{"device":"SLAT_4","level":"FULL_EXT","polygon":[[1272.0,431.0],[1364.0,400.0],[1365.0,483.0],[1275.0,518.0]]},{"device":"SLAT_5","level":"TRANSIT","polygon":[[1379.0,175.0],[1467.0,140.0],[1469.0,225.0],[1381.0,259.0]]},{"device":"SLAT_5","level":"EXT","polygon":[[1379.0,278.0],[1469.0,248.0],[1469.0,338.0],[1381.0,369.0]]},{"device":"SLAT_5","level":"FULL_EXT","polygon":[[1380.0,392.0],[1469.0,361.0],[1469.0,447.0],[1381.0,477.0]]},{"device":"SLAT_6","level":"TRANSIT","polygon":[[1485.0,134.0],[1564.0,107.0],[1565.0,191.0],[1486.0,218.0]]},{"device":"SLAT_6","level":"EXT","polygon":[[1486.0,240.0],[1565.0,213.0],[1566.0,303.0],[1488.0,333.0]]},{"device":"SLAT_6","level":"FULL_EXT","polygon":[[1486.0,353.0],[1564.0,323.0],[1566.0,413.0],[1486.0,440.0]]}];
 const devices=[...left,...right];
 const states=new Map(devices.map(id=>[id,'RETRACTED']));
 const overrides=new Map();
 const instances=new Set();
 let lampTest=false,globalLampTest=false,brightness='BRIGHT',panelPower=true;
 const metrics={source:{width:1984,height:793},atlas:{x:3/1731,y:540/909,w:383/1731,h:188/909},nativePanelRect:{x:3,y:540,w:383,h:188,sourceWidth:1731,sourceHeight:909},lampCount};
 const isValid=(id,state)=>devices.includes(id)&&['RETRACTED',...activeLevels(id)].includes(state);
 function emit(type,detail){window.dispatchEvent(new CustomEvent(type,{detail}));}
 function recolor(){
  for(const instance of instances){
   const test=globalLampTest||(lampTest&&panelPower===true);
   for(const [key,el] of instance.lamps){
    const [id,level]=key.split('|'),on=globalLampTest||(panelPower===true&&(test||(overrides.has(key)?overrides.get(key):states.get(id)===level)));
    el.dataset.lit=String(on);
    el.setAttribute('fill',on?colors[level]:'transparent');
    el.style.opacity='1';
    el.setAttribute('fill-opacity',on?(brightness==='BRIGHT'?'1':'.52'):'1');
   }
   instance.host.dataset.power=panelPower===null?'UNKNOWN':panelPower?'ON':'OFF';
   instance.button.classList.toggle('pressed',lampTest);
   instance.button.setAttribute('aria-pressed',String(lampTest));
   if(instance.output)instance.output.textContent=test?'TEST · ALL 26 ON':'READY · '+brightness+' · 26 INDEPENDENT WINDOWS';
  }
 }
 function setLampTest(value){const next=!!value;if(lampTest===next)return;lampTest=next;recolor();emit('b737:le-devices-lamp-test',{pressed:next,windows:lampCount,source:'physical-recessed-button'});}
 function setGlobalLampTest(value){globalLampTest=!!value;recolor();}
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
 function coords(id,level){
  const spec=windowSpecs.find(s=>s.device===id&&s.level===level);
  return spec.polygon.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')+' Z';
 }
 function mount(host){
  if(host.dataset.b737LeMounted==='1')return;
  host.dataset.b737LeMounted='1';
  host.classList.add('b737-le-devices');
  host.setAttribute('role','group');
  host.setAttribute('aria-label','LE DEVICES — leading edge flaps and slats indicator');
  host.dir='ltr';
  const art=document.createElement('img');art.className='b737-le-devices__background';art.src=new URL('panel-owner-restored-v6.png?v=LEDEV-0006',assetBase).href;art.alt='';art.draggable=false;
  const lights=makeSvg('svg',{viewBox:'0 0 1984 793',preserveAspectRatio:'none',class:'b737-le-devices__lamps','aria-label':'10 leading-edge devices, 26 independent light segments'});
  const lamps=new Map();
  for(const [side,ids] of [['left',left],['right',right]]){
   ids.forEach((id,index)=>activeLevels(id).forEach(level=>{
    const flapFull=id.startsWith('FLAP_')&&level==='FULL_EXT';
    const row=flapFull?1:levels.indexOf(level),span=flapFull?2:1;
    const path=makeSvg('path',{id:'LE_'+id+'_'+level,d:coords(id,level),stroke:'none','stroke-width':'0','stroke-linejoin':'round','data-device':id,'data-level':level,'role':'button','tabindex':'0','aria-label':id.replace('_',' ')+' '+level});
    const title=makeSvg('title');title.textContent=id.replace('_',' ')+' — '+level+' (select demo state)';path.append(title);
    const toggle=event=>{event.stopPropagation();const key=id+'|'+level;const lit=overrides.has(key)?overrides.get(key):states.get(id)===level;setWindow(id,level,!lit);};
    path.addEventListener('pointerdown',e=>e.stopPropagation());
    path.addEventListener('click',toggle);
    path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(e);}});
    lights.append(path);lamps.set(id+'|'+level,path);
   }));
  }
  const test=document.createElement('button');test.className='b737-le-devices__test';test.type='button';test.setAttribute('aria-label','LE DEVICES TEST momentary recessed pushbutton');test.title='Press and hold to illuminate all 26 windows';
  const cap=document.createElement('img');cap.className='b737-le-devices__test-cap';cap.src=new URL('recessed-test-button.svg?v=LEDEV-0006',assetBase).href;cap.alt='';cap.draggable=false;test.append(cap);
  test.addEventListener('blur',()=>setLampTest(false));
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
  if(!frame||frame.querySelector('[data-b737-le-devices-atlas]'))return;
  const px=n=>Number.parseFloat(n)||0;
  const w=px(frame.style.width),h=px(frame.style.height);
  if(!(w>0&&h>0))return;
  const host=document.createElement('div');host.dataset.b737LeDevicesAtlas='';
  host.style.position='absolute';host.style.left=(metrics.atlas.x*w)+'px';host.style.top=(metrics.atlas.y*h)+'px';
  host.style.width=(metrics.atlas.w*w)+'px';host.style.height=(metrics.atlas.h*h)+'px';host.style.zIndex='65';
  host.dataset.leDevicesMountedAt='OH-01-native-rect-3-540-383-188';
  frame.append(host);mount(host);
 }
 function initialize(){
  document.querySelectorAll('[data-b737-le-devices]').forEach(mount);
  const root=document.getElementById('atlasAbsolute');
  if(root){mountAtlas();const observer=new MutationObserver(()=>{for(const i of [...instances])if(!i.host.isConnected)instances.delete(i);mountAtlas();});observer.observe(root,{childList:true});}
 }
 window.B737LeadingEdgeDevices=Object.freeze({
  devices:Object.freeze([...devices]),levels:Object.freeze([...levels]),hasWindow,
  setDevice,setWindow,setLampTest,setGlobalLampTest,setBrightness,
  setPower:value=>{if(![true,false,null].includes(value))return false;panelPower=value;recolor();return true;},
  snapshot:()=>({devices:Object.fromEntries(states),windowOverrides:Object.fromEntries(overrides),lampTest,globalLampTest,effectiveLampTest:lampTest||globalLampTest,brightness,power:panelPower,windows:lampCount,placement:metrics}),
  reset:()=>{for(const id of devices)states.set(id,'RETRACTED');overrides.clear();setLampTest(false);recolor();}
 });
 window.addEventListener('b737:le-devices-command',e=>{
  const d=e.detail||{};if(d.action==='set-device')setDevice(d.id,d.state);
  if(d.action==='set-window')setWindow(d.id,d.level,d.lit);
  if(d.action==='lamp-test')setLampTest(d.active);
  if(d.action==='brightness')setBrightness(d.value);
 });
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;
  const d=e.data;
  if(['visual-test','lamp-test'].includes(d.action)&&typeof d.active==='boolean')setGlobalLampTest(d.active);
 });
 window.addEventListener('b737:visual-test',e=>{if(typeof e.detail?.active==='boolean')setGlobalLampTest(e.detail.active);});
 window.addEventListener('blur',()=>setLampTest(false));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)setLampTest(false);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
