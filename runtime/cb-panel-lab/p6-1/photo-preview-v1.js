/* P6-1-PHOTO-0001 — first isolated photo-real CB panel review.
   Only original user photo is drawn: no invented hole, screw, bezel, or text.
   CB targets are calibrated ORIGINAL inner black centers, not uniform grid cells.
   This staging view deliberately does NOT mutate the Unified cockpit or CB engine.
*/
(function(){
'use strict';
const data=window.B737CB_P61_PHOTO_V1;
if(!data||data.cb.length!==41)throw Error('P6-1 original calibrated photo data missing');
const canvas=document.getElementById('panelCanvas'),ctx=canvas.getContext('2d',{alpha:false}),viewport=document.getElementById('viewport'),scene=document.getElementById('photoScene'),status=document.getElementById('status');
const crop=data.crop,W=crop.w,H=crop.h,cb=data.cb.map(b=>({...b,pulled:false}));
canvas.width=W;canvas.height=H;scene.style.width=W+'px';scene.style.height=H+'px';
const image=new Image();image.decoding='async';
let loaded=false,scale=1,tx=0,ty=0,pointers=new Map(),start=null,gesture=null,didMove=false;
const clamp=(a,min,max)=>Math.max(min,Math.min(max,a));
function render(){
 if(!loaded)return;
 ctx.clearRect(0,0,W,H);
 ctx.drawImage(image,crop.x,crop.y,W,H,0,0,W,H);
 for(const b of cb){
  if(!b.pulled)continue;
  const x=b.x-crop.x,y=b.y-crop.y,r=b.r;
  // Preserve the original grey hexagon and original stencils.
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#07090d';ctx.fillRect(x-r-2,y-r-2,r*2+4,r*2+4);
  ctx.drawImage(image,b.x-r,b.y-r,r*2,r*2,x-r-0.45,y-r-3,r*2+0.9,r*2+0.9);
  ctx.restore();
  ctx.save();ctx.beginPath();ctx.arc(x,y,r+.5,0,Math.PI*2);
  ctx.lineWidth=1.7;ctx.strokeStyle='#b35056';ctx.stroke();ctx.restore();
 }
}
function show(){scene.style.transform='translate3d('+tx.toFixed(2)+'px,'+ty.toFixed(2)+'px,0) scale('+scale.toFixed(6)+')';}
function bound(){
 const w=W*scale,h=H*scale,vw=viewport.clientWidth,vh=viewport.clientHeight;
 if(w<=vw){tx=(vw-w)/2;}else{tx=clamp(tx,vw-w,0);}
 if(h<=vh){ty=(vh-h)/2;}else{ty=clamp(ty,vh-h,0);}
}
function fit(){
 scale=clamp(Math.min(viewport.clientWidth/W,viewport.clientHeight/H)*.97,.14,1);
 tx=(viewport.clientWidth-W*scale)/2;ty=(viewport.clientHeight-H*scale)/2;show();
}
function zoomAt(next,x,y){
 const w=(x-tx)/scale,h=(y-ty)/scale;
 scale=clamp(next,.12,4);
 tx=x-w*scale;ty=y-h*scale;bound();show();
}
function coords(e){const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function hit(e){
 const q=coords(e),x=(q.x-tx)/scale+crop.x,y=(q.y-ty)/scale+crop.y;
 let winner=null,d=Infinity;
 for(const b of cb){
  const z=Math.hypot(b.x-x,b.y-y);
  if(z<b.r*.96&&z<d){winner=b;d=z;}
 }
 return winner;
}
function pointerArray(){return [...pointers.values()]}
function startPinch(){
 const p=pointerArray();if(p.length<2)return;
 const mx=(p[0].x+p[1].x)/2,my=(p[0].y+p[1].y)/2;
 const dist=Math.max(2,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y));
 gesture={distance:dist,scale,wx:(mx-tx)/scale,wy:(my-ty)/scale};start=null;
}
viewport.addEventListener('pointerdown',e=>{
 if(!loaded||(e.pointerType==='mouse'&&e.button!==0))return;
 const q=coords(e);
 pointers.set(e.pointerId,{x:q.x,y:q.y,startX:q.x,startY:q.y,moved:false});
 viewport.setPointerCapture(e.pointerId);
 if(pointers.size===2){startPinch();didMove=true}
 else if(pointers.size===1){start={x:q.x,y:q.y,tx,ty,target:hit(e)};didMove=false;}
 e.preventDefault();
});
viewport.addEventListener('pointermove',e=>{
 const p=pointers.get(e.pointerId);if(!p)return;const q=coords(e);
 p.x=q.x;p.y=q.y;
 if(Math.hypot(q.x-p.startX,q.y-p.startY)>5)p.moved=true;
 if(pointers.size>=2){
  if(!gesture)startPinch();
  if(gesture){
   const a=pointerArray(),midX=(a[0].x+a[1].x)/2,midY=(a[0].y+a[1].y)/2;
   const d=Math.max(2,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y));
   scale=clamp(gesture.scale*d/gesture.distance,.12,4);
   tx=midX-gesture.wx*scale;ty=midY-gesture.wy*scale;bound();show();
  }
 }else if(start){
  const dx=q.x-start.x,dy=q.y-start.y;
  if(Math.hypot(dx,dy)>5){didMove=true;viewport.classList.add('dragging')}
  tx=start.tx+dx;ty=start.ty+dy;bound();show();
 }
 e.preventDefault();
});
function end(e){
 const p=pointers.get(e.pointerId);if(!p)return;
 const wasMulti=!!gesture||pointers.size>1;
 pointers.delete(e.pointerId);gesture=null;
 if(!pointers.size){
  viewport.classList.remove('dragging');
  if(!wasMulti&&!p.moved&&!didMove&&start?.target){
   start.target.pulled=!start.target.pulled;
   render();
   status.textContent='P6-1 / '+start.target.id+' — '+(start.target.pulled?'PULLED':'PUSHED')+' · photo-registered inner circle';
  }
  start=null;
 }else{start=null;didMove=true;}
 e.preventDefault();
}
viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;start=null;viewport.classList.remove('dragging')});
viewport.addEventListener('wheel',e=>{e.preventDefault();const p=coords(e);zoomAt(scale*Math.exp(-e.deltaY*.0012),p.x,p.y)},{passive:false});
for(const type of ['contextmenu','dragstart','selectstart','dblclick'])viewport.addEventListener(type,e=>e.preventDefault(),{passive:false});
document.getElementById('fit').onclick=fit;
document.getElementById('reset').onclick=()=>{for(const b of cb)b.pulled=false;render();status.textContent='P6-1 · All 41 mapped CBs PUSHED (visual preview only)';};
window.addEventListener('resize',fit);
image.onload=()=>{loaded=true;fit();render();status.textContent='P6-1 · original reference loaded · 41 photographed CB centers';};
image.onerror=()=>{status.textContent='خطا در بارگذاری تصویر مرجع P6-1';};
image.src=data.sourceImage.dataUrl;
})();
