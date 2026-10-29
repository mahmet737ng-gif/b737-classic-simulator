/* PHOTO-INPUT-0001 — browser gesture defaults only.
   This module never suppresses pointerdown/up/move or click on actual controls.
   It only prevents text/photo selection, dragging and browser long-press menus
   within the cockpit viewport, leaving zoom, pan and simulated switches intact.
*/
(function(){
 'use strict';
 const viewport=document.getElementById('viewport');
 if(!viewport)return;
 const editingSelector='input,textarea,select,[contenteditable="true"]';
 function editable(event){
   return event.target instanceof Element&&!!event.target.closest(editingSelector);
 }
 for(const type of ['contextmenu','selectstart','dragstart']){
   viewport.addEventListener(type,event=>{
     if(!editable(event))event.preventDefault();
   },{capture:true,passive:false});
 }
})();
