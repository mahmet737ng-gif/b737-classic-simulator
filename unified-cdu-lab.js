'use strict';
// A presentation mode over the authenticated, running Unified cockpit.
// No duplicated CDU, EHSI, EFIS, FMC, flight or navigation implementations.
const labPath='/panel-mosaic-lab/unified/cdu-lab.html';
const legacy=/^\/cdu-standalone(?:-v[356])?\/(?:index\.html)?$/;
function volatileStorage(isLab){
 let active=isLab;
 try{active=active||parent!==window&&parent.__UnifiedCduLab===true;}catch{}
 if(!active)return;
 window.__UnifiedCduLab=true;
 function make(){
  const items=new Map();
  return new Proxy({get length(){return items.size;},key:i=>[...items.keys()][i]??null,
   getItem:k=>items.has(String(k))?items.get(String(k)):null,
   setItem:(k,v)=>items.set(String(k),String(v)),removeItem:k=>items.delete(String(k)),clear:()=>items.clear()},
   {get:(o,k)=>Reflect.has(o,k)?Reflect.get(o,k):items.get(String(k)),
    set:(o,k,v)=>{items.set(String(k),String(v));return true;},
    deleteProperty:(o,k)=>{items.delete(String(k));return true;}});
 }
 for(const k of ['localStorage','sessionStorage']){
  const store=parent!==window&&parent.__UnifiedCduLab?parent[k]:make();
  Object.defineProperty(window,k,{configurable:true,get:()=>store});
 }
}
function view(){
 const doc=document,root=doc.documentElement;
 root.dataset.cduLab='true';
 function start(){
  const bar=doc.createElement('div');bar.id='unifiedCduLabControls';bar.dataset.cduLabItem='controls';
  const status=doc.createElement('output');status.textContent='Loading current Unified cockpit…';
  const take=doc.createElement('button'),des=doc.createElement('button');
  take.type=des.type='button';take.textContent='START TAKEOFF';des.textContent='START DESCENT';
  take.disabled=des.disabled=true;take.hidden=des.hidden=true;
  bar.append(status,take,des);doc.body.append(bar);
  let requested=false,last=[],seat=null;const geometry=new WeakMap();
  const get=()=>window.B737UnifiedFlightScenarioV1;
  function failure(error){status.hidden=false;status.textContent=String(error?.message||error);}
  take.onclick=()=>{try{const api=get(),button=doc.getElementById('flightTakeoff');
   if(!api||!button||button.disabled)throw Error('TAKEOFF NOT AVAILABLE');
   api.pause(false);button.click();status.hidden=true;
  }catch(e){failure(e);}};
  des.onclick=()=>{try{const api=get();if(api?.getState()?.airborne!==true)throw Error('AIRCRAFT NOT AIRBORNE');
   api.command({type:'VS',value:-1000});api.pause(false);status.hidden=true;
  }catch(e){failure(e);}};
  function clearMarks(){for(const e of doc.querySelectorAll('[data-cdu-lab-branch]'))delete e.dataset.cduLabBranch;
   for(const e of last)delete e.dataset.cduLabItem;}
  function branch(e,name){e.dataset.cduLabItem=name;for(let a=e.parentElement;a;a=a.parentElement)a.dataset.cduLabBranch='true';}
  function tick(){
   try{
    const start=doc.getElementById('unifiedWelcomeStart'),ags=doc.getElementById('welcomeGroundState');
    if(!requested&&start&&!start.hidden&&!start.disabled&&ags&&!ags.disabled){
     ags.value='READY_FOR_TAKEOFF';ags.dispatchEvent(new Event('change',{bubbles:true}));
     if(!start.disabled){requested=true;start.click();}
    }
    const welcome=doc.getElementById('unifiedWelcome'),error=doc.getElementById('unifiedWelcomeError');
    if(error&&!error.hidden){failure(error.textContent||'Unified startup failed');return;}
    if(!welcome?.hidden||get()?.getDiagnostics()?.active!==true)return;
    const frames=['CAPT','FO'].map(s=>[s,doc.getElementById('cduFrame'+s)]).filter(x=>x[1]);
    const pair=frames.find(x=>x[1].closest('.cdu-station')?.classList.contains('ready'))||frames.find(x=>x[1].contentDocument?.getElementById('fmc-lines')?.children.length);
    if(!pair)return;
    const [s,frame]=pair;const cdu=frame.closest('.cdu-station');
    const nd=doc.querySelector('[data-unified-ehsi-seat="'+s+'"]');
    const cp=doc.querySelector('[data-uefis-seat="'+s+'"]');
    if(!cdu||!nd||!cp)return;
    for(const e of [cdu,nd,cp])if(!geometry.has(e)){
     const rect=e.getBoundingClientRect();
     geometry.set(e,{w:e.offsetWidth||rect.width,h:e.offsetHeight||rect.height});
    }
    if(last[0]!==cdu||last[1]!==nd||last[2]!==cp){
     clearMarks();last=[cdu,nd,cp];branch(cdu,'cdu');branch(nd,'nd');branch(cp,'cp');branch(bar,'controls');seat=s;
    }
    const native=geometry.get(cdu),n=geometry.get(nd),c=geometry.get(cp);
    if(!(native.w>0&&native.h>0&&n.w>0&&n.h>0&&c.w>0&&c.h>0))return;
    const gap=10,available=Math.max(250,innerWidth-4*gap),height=Math.max(120,innerHeight-90);
    const ratios=[native.w/native.h,n.w/n.h,c.w/c.h],sum=ratios.reduce((a,b)=>a+b,0);
    const scale=Math.min(height,available/sum);
    const widths=ratios.map(x=>x*scale),total=widths.reduce((a,b)=>a+b,0)+2*gap;
    let x=(innerWidth-total)/2;const y=Math.max(6,(innerHeight-70-scale)/2);
    for(const [i,e] of last.entries()){
     e.style.setProperty('--lab-x',x+'px');e.style.setProperty('--lab-y',y+'px');
     e.style.setProperty('--lab-w',widths[i]+'px');e.style.setProperty('--lab-h',scale+'px');
     x+=widths[i]+gap;
    }
    cdu.style.setProperty('--lab-native-w',native.w+'px');cdu.style.setProperty('--lab-native-h',native.h+'px');
    cdu.style.setProperty('--lab-scale',String(widths[0]/native.w));
    root.dataset.cduLabReady='true';root.dataset.cduLabSeat=seat;
    take.hidden=des.hidden=false;
    const state=get().getState();take.disabled=state?.airborne===true||doc.getElementById('flightTakeoff')?.disabled===true;
    des.disabled=state?.airborne!==true;
    if(status.textContent==='Loading current Unified cockpit…')status.hidden=true;
   }catch(e){failure(e);}
  }
  setInterval(tick,250);tick();
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
const css=String.raw
`
html[data-cdu-lab]{background:#10171b!important;}
html[data-cdu-lab] body{background:#10171b!important;margin:0!important;}
html[data-cdu-lab]:not([data-cdu-lab-ready]) body > :not(#unifiedCduLabControls){visibility:hidden!important;pointer-events:none!important;}
html[data-cdu-lab-ready] body :not([data-cdu-lab-branch]):not([data-cdu-lab-item]):not([data-cdu-lab-item] *){visibility:hidden!important;pointer-events:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-branch]{visibility:visible!important;overflow:visible!important;transform:none!important;contain:none!important;clip-path:none!important;filter:none!important;backdrop-filter:none!important;perspective:none!important;will-change:auto!important;content-visibility:visible!important;background:transparent!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item]:not([data-cdu-lab-item="controls"]){position:fixed!important;left:var(--lab-x)!important;top:var(--lab-y)!important;right:auto!important;bottom:auto!important;z-index:999999!important;visibility:visible!important;pointer-events:auto!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cdu"]{width:var(--lab-native-w)!important;height:var(--lab-native-h)!important;transform:scale(var(--lab-scale))!important;transform-origin:0 0!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="nd"]{width:var(--lab-w)!important;height:var(--lab-h)!important;transform:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cp"]{width:var(--lab-w)!important;height:auto!important;transform:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cp"] .uefis-banner{display:none!important;}
html[data-cdu-lab-ready] [data-cdu-lab-item="cdu"] .cdu-seat-label{display:none!important;}
#unifiedCduLabControls{position:fixed!important;left:0!important;right:0!important;bottom:10px!important;z-index:2147483646!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;visibility:visible!important;pointer-events:auto!important;color:#e3eef0!important;font:14px system-ui,sans-serif!important;}
#unifiedCduLabControls button{padding:10px 16px!important;border-radius:5px!important;background:#23333c!important;border:1px solid #61717a!important;color:#e3eef0!important;cursor:pointer!important;}
#unifiedCduLabControls button:disabled{opacity:.42!important;cursor:default!important;}
#unifiedCduLabControls [hidden]{display:none!important;}
`;
function head(isLab){
 return '<script>('+volatileStorage.toString()+')('+String(isLab)+');</script>'+
  (isLab?'<style>'+css+'</style><script>('+view.toString()+')();</script>':'');
}
function addLink(html){
 return html.replace('<div id="unifiedLabShortcuts" class="unified-lab-shortcuts"></div>',
  '<div id="unifiedLabShortcuts" class="unified-lab-shortcuts"><a href="'+labPath+'" target="_blank" rel="noopener">CDU / EHSI / EFIS CP TEST LAB</a></div>');
}
module.exports={labPath,legacy,head,addLink};
