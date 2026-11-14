/* Only a viewport transform. Original cockpit Overhead DOM and state remain in iframe. */
(function(){
'use strict';
const naturalWidth=2220,naturalHeight=3312,minimum=.115,maximum=1.65;
const box=document.getElementById('guestOverheadScroll');
const canvas=document.getElementById('guestOverheadCanvas');
const iframe=document.getElementById('overheadFrame');
const readout=document.getElementById('guestZoomReadout');
if(!box||!canvas||!iframe)return;
let scale=1,automatic=true;
const clamp=v=>Math.min(maximum,Math.max(minimum,v));
function apply(value,reset=true){
 scale=clamp(value);
 iframe.style.transform='scale('+scale+')';
 canvas.style.width=Math.ceil(naturalWidth*scale)+'px';
 canvas.style.height=Math.ceil(naturalHeight*scale)+'px';
 readout.textContent=Math.round(scale*100)+'%';
 if(reset)box.scrollTo({left:0,top:0,behavior:'instant'});
}
function fit(){
 if(!box.clientWidth||!box.clientHeight)return;
 automatic=true;
 apply(Math.min((box.clientWidth-26)/naturalWidth,(box.clientHeight-20)/naturalHeight),true);
}
function zoom(factor){
 const old=scale,anchorX=box.scrollLeft+box.clientWidth/2,anchorY=box.scrollTop+box.clientHeight/2;
 automatic=false;
 apply(scale*factor,false);
 const ratio=scale/old;
 box.scrollTo({left:Math.max(0,anchorX*ratio-box.clientWidth/2),top:Math.max(0,anchorY*ratio-box.clientHeight/2),behavior:'instant'});
}
document.getElementById('guestZoomFit').addEventListener('click',fit);
document.getElementById('guestZoomIn').addEventListener('click',()=>zoom(1.25));
document.getElementById('guestZoomOut').addEventListener('click',()=>zoom(.8));
box.addEventListener('wheel',event=>{
 if(!event.ctrlKey&&!event.metaKey)return;
 event.preventDefault();zoom(event.deltaY<0?1.12:1/1.12);
},{passive:false});
window.addEventListener('resize',()=>{if(automatic)fit();});
if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(automatic)fit();}).observe(box);
requestAnimationFrame(fit);
iframe.addEventListener('load',()=>{if(automatic)fit();});
window.B737GuestOverheadViewport=Object.freeze({fit,zoom,getScale:()=>scale});
})();
