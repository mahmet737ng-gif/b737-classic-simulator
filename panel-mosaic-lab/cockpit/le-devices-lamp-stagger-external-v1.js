/* LE DEVICES lamp stagger – non-invasive visual adapter (2026-10-30).
 * NEVER edits or wraps the owner-locked panel.js API or changes LE physics.
 * Paint changes only, with deterministic offsets from 0 to 78ms.
 * Loaded after the immutable core, in Unified + standalone test lab.
 */
(function(){
'use strict';
const SELECTOR='svg.b737-le-devices__lamps path[data-device][data-level]';
const COLORS=Object.freeze({TRANSIT:'#ffd22a',EXT:'#3ce5aa',FULL_EXT:'#3ce5aa'});
const state=new WeakMap();
function offset(key){let hash=0;for(let i=0;i<key.length;i++)hash=(hash*33+key.charCodeAt(i))>>>0;return (hash%27)*3;}
function relevant(el){return el?.nodeType===1&&el.matches?.(SELECTOR);}
function register(el){
 if(state.has(el))return;
 state.set(el,{desired:el.dataset.lit==='true',visible:el.getAttribute('fill')||'transparent',timer:null,token:0});
}
function reconcile(el){
 if(!relevant(el))return;
 if(!state.has(el)){register(el);return;}
 const s=state.get(el),next=el.dataset.lit==='true';
 if(next!==s.desired){
  s.desired=next;
  if(s.timer!==null)clearTimeout(s.timer);
  s.timer=null;
  if(el.getAttribute('fill')!==s.visible)el.setAttribute('fill',s.visible);
  const color=next?(COLORS[el.dataset.level]||'#3ce5aa'):'transparent';
  const token=++s.token;
  s.timer=setTimeout(()=>{
   if(token!==s.token)return;
   s.timer=null;s.visible=color;
   if(el.isConnected)el.setAttribute('fill',color);
  },offset(el.dataset.device+'|'+el.dataset.level));
 }else if(s.timer!==null){
  // Preserve the visible prior state until its deliberately offset deadline.
  if(el.getAttribute('fill')!==s.visible)el.setAttribute('fill',s.visible);
 }else{
  // Keep the original renderer authoritative for initial paint and brightness.
  s.visible=el.getAttribute('fill')||'transparent';
 }
}
function discover(node){
 if(relevant(node))register(node);
 node?.querySelectorAll?.(SELECTOR).forEach(register);
}
function start(){
 if(!document.documentElement)return;
 discover(document.documentElement);
 const observer=new MutationObserver(records=>{
  const changed=new Set();
  for(const item of records){
   if(item.type==='attributes'){if(relevant(item.target))changed.add(item.target);}
   else if(item.type==='childList'){
    for(const child of item.addedNodes)discover(child);
   }
  }
  changed.forEach(reconcile);
 });
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-lit','fill']});
 window.B737LELampStaggerV1=Object.freeze({version:'LE-STAGGER-EXTERNAL-0001',offset,registered:()=>document.querySelectorAll(SELECTOR).length});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
