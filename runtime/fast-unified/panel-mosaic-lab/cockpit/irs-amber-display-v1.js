/* IRS ISDU DISPLAY · FCOM 11.10.15–17 inspired front-end lab.
 * Physical source in OH01-06, immutable background, two amber LCD rows.
 * No inertial solution, GPS, altitude or simulator flight data is invented.
 * Numeric input is explicitly a local KEYPAD DEMO, never aircraft PPOS.
 */
(function(root){
 'use strict';
 const REGION={x:434,y:238,w:299,h:39};
 const ATLAS={ox:3,oy:3,w:2214,h:1019,sw:1731,sh:909};
 const PX={left:ATLAS.ox+REGION.x*ATLAS.w/ATLAS.sw,top:ATLAS.oy+REGION.y*ATLAS.h/ATLAS.sh,
   width:REGION.w*ATLAS.w/ATLAS.sw,height:REGION.h*ATLAS.h/ATLAS.sh};
 const MODES=['TEST','TK/GS','PPOS','WIND','HDG/STS'];
 const MASK={'PPOS':['------.-','-------.-'],'TK/GS':['---.-','---.-'],'WIND':['---.-','---.-'],'HDG/STS':['---.-','----'],'TEST':['8888888','8888888']};
 let el=null,mode='PPOS',brightness=78,active=false,digits='',lastEntered='',testActive=false,testTimer=null,hemisphere='';
 function state(){return {mode,brightness,active,digits,lastEntered,hemisphere,testActive,frontendOnly:true};}
 function lines(){
   if(!active)return ['',''];
   if(testActive||mode==='TEST')return MASK.TEST;
   if(digits){const str=(hemisphere||'')+digits.slice(-7);return [str.padEnd(6,' '),lastEntered||''];}
   return MASK[mode]||MASK.PPOS;
 }
 function draw(){
   if(!el)return;
   el.dataset.active=String(active);
   el.dataset.mode=mode;
   el.dataset.demo='true';
   const l=lines();
   const rows=el.querySelectorAll('.irs-amber-line');
   if(rows.length>=2){rows[0].textContent=l[0];rows[1].textContent=l[1];}
   const photometric=Math.pow(Math.max(0,brightness)/100,1.35);
   el.style.setProperty('--irs-amber-power',String(photometric));
   el.dataset.brightness=String(brightness);
   el.title='IRS DEMO DISPLAY · '+mode+' · BRT '+brightness+'% · no live aircraft data';
   el.setAttribute('aria-label','IRS demonstration data display: '+l.join(' / ').trim());
 }
 function wake(){active=true;draw();}
 function modeChange(next){
   if(!MODES.includes(next))return;
   mode=next;
   if(!digits)lastEntered='';
   draw();
 }
 function brightnessChange(n){
   if(!Number.isFinite(n))return;
   brightness=Math.min(100,Math.max(0,Math.round(n)));
   draw();
 }
 function clearTimer(){
   if(testTimer!==null){root.clearTimeout?.(testTimer);testTimer=null;}
 }
 function performTest(){
   clearTimer();testActive=true;wake();
   // FCOM TEST is a momentary self-test during alignment (10 s). This
   // visual-only demonstration displays all-segment 8s without running actual BITE.
   testTimer=root.setTimeout?.(()=>{
     testTimer=null;testActive=false;
     if(root.B737IRSUpperSelector?.getMode?.()==='TEST')root.B737IRSUpperSelector.setMode('TK/GS','demo-test-return');
     mode= root.B737IRSUpperSelector?.getMode?.() || 'TK/GS';
     draw();
   },10000)??null;
 }
 function press(key){
   if(!/^(?:[0-9]|ENT|CLR)$/.test(String(key)))return state();
   active=true;
   // Each dual-letter numeric button works as a number; the orientation
   // prefix is selectable by secondary keyboard input N/S/E/W (see keydown).
   if(key==='CLR'){
     digits='';hemisphere='';lastEntered='';
   }else if(key==='ENT'){
     if(digits){lastEntered=(hemisphere||'')+digits;digits='';hemisphere='';}
   }else{
     digits=(digits+String(key)).slice(-9);
   }
   draw();
   return state();
 }
 function putHemisphere(value){
   if(!['N','S','E','W'].includes(value))return;
   hemisphere=value;wake();
 }
 function mount(){
   const region=document.getElementById('region-overhead');
   if(!region)return null;
   const existing=region.querySelector('#irsAmberDisplayMounted');
   if(existing){el=existing;draw();return el;}
   el=document.createElement('div');
   el.id='irsAmberDisplayMounted';el.className='irs-amber-display';
   el.dataset.version='IRS-AMBER-ISDU-0001';
   el.dataset.frontendOnly='true';
   Object.assign(el.style,Object.fromEntries(Object.entries(PX).map(([k,v])=>[k,v+'px'])));
   el.setAttribute('role','group');
   el.setAttribute('aria-live','polite');
   for(const ix of [0,1]){
     const row=document.createElement('div');row.className='irs-amber-line';row.dataset.row=String(ix);
     el.append(row);
   }
   // Explicit demo activation: click window for all-segment check, or use keypad.
   el.addEventListener('click',()=>performTest());
   region.append(el);
   draw();return el;
 }
 function boot(){
   if(!mount()){
     const ob=new MutationObserver(()=>{if(mount())ob.disconnect();});
     ob.observe(document.documentElement,{childList:true,subtree:true});
   }
   document.addEventListener('b737:irs-visual-key',e=>{if(e.detail?.key)press(e.detail.key);});
   root.addEventListener('b737:irs-upper-visual-change',e=>{
     if(e.detail?.mode)modeChange(e.detail.mode);
     if(typeof e.detail?.brightness==='number')brightnessChange(e.detail.brightness);
     if(e.detail?.type==='mode'&&e.detail?.mode==='TEST')performTest();
   });
   document.addEventListener('keydown',e=>{
     // Keyboard hemispheres are lab-only, never intercepted while typing in forms.
     if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
     if(e.altKey&&['N','S','E','W'].includes(e.key.toUpperCase()))putHemisphere(e.key.toUpperCase());
   });
   root.addEventListener('b737:cockpit-mounted',mount);
 }
 root.B737IRSAmberDisplay=Object.freeze({mount,press,putHemisphere,performTest,modeChange,brightnessChange,
    getState:state,getElement:()=>el,geometry:Object.freeze(PX)});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
