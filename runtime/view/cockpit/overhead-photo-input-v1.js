/* PHOTO-INPUT-0001
   Intercept only photo-tile selection in Unified's embedded overhead iframe.
   Do not alter the locked atlas renderer or physical switch event handling.
   Touch scroll and two-finger gestures still reach existing listeners.
*/
(function(){
 'use strict';
 const viewport=document.getElementById('viewport');
 if(!viewport)return;
 const tileSelector='.atlas-piece, .piece, .top-image';
 const controlSelector='button, input, select, textarea, a, label, [contenteditable], [role="slider"], [role="switch"], [role="checkbox"], [role="combobox"], [data-control], .mounted-toggle';
 function plainTile(event){
   const target=event.target;
   if(!(target instanceof Element)||!viewport.contains(target))return null;
   const tile=target.closest(tileSelector);
   if(!tile||!viewport.contains(tile))return null;
   // Physical controls mounted on or inside a photo must keep their own events.
   let node=target;
   while(node&&node!==tile){
     if(node.matches?.(controlSelector))return null;
     node=node.parentElement;
   }
   return tile;
 }
 // The frozen atlas's photo onClick and SVG polygon "pick()" must never fire
 // on this embedded route. These listeners run in capture phase.
 for(const name of ['click','dblclick','auxclick']){
   viewport.addEventListener(name,event=>{
     if(plainTile(event)){
       event.preventDefault();
       event.stopImmediatePropagation();
     }
   },true);
 }
 viewport.addEventListener('contextmenu',event=>{
   if(plainTile(event)){
     event.preventDefault();
     event.stopImmediatePropagation();
   }
 },true);
 viewport.addEventListener('dragstart',event=>{
   if(plainTile(event))event.preventDefault();
 },true);
 viewport.addEventListener('selectstart',event=>{
   if(plainTile(event))event.preventDefault();
 },true);
 // Photo tiles are not keyboard targets in the cockpit. This changes
 // only the runtime elements of THIS embedded copy, not any source atlas file.
 function neutralize(){
   viewport.querySelectorAll(tileSelector).forEach(tile=>{
     if(tile.getAttribute('role')==='button')tile.removeAttribute('role');
     if(tile.hasAttribute('tabindex'))tile.setAttribute('tabindex','-1');
   });
 }
 neutralize();
 const observer=new MutationObserver(neutralize);
 observer.observe(viewport,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
