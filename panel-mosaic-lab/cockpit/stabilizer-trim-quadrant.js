/* Both manual wheels drive one stabilizer and the two mechanical index shoes. */
(function(win){
'use strict';
const doc=win.document, wheels=[], ticks=[[0,521],[5,563],[10,608],[15,646],[17,663]];
let units=5,layer,held=null;
function indexY(value){
 const end=ticks.findIndex(([n])=>n>=value);if(end<=0)return ticks[0][1];
 const [a,y]=ticks[end-1],[b,z]=ticks[end];return y+(z-y)*(value-a)/(b-a);
}
function paint(){
 for(const {wheel,index,rotor,sign} of wheels){
  rotor.style.transform='rotate('+((units-5)*360*15*sign)+'deg)';
  index.style.top=(indexY(units)/10)+'%';
  wheel.setAttribute('aria-valuenow',String(Math.round(units*100)/100));
  wheel.setAttribute('aria-valuetext',units.toFixed(2)+' units');
 }
}
function set(value,source='MANUAL'){
 if(!Number.isFinite(value)||(held&&source!=='MANUAL'))return false;
 const next=Math.min(17,Math.max(0,value));if(next===units)return true;
 units=next;paint();
 win.dispatchEvent(new CustomEvent('b737:stabilizer-trim-position',{detail:{units,source}}));
 return true;
}
function mount(){
 if(layer)return;
 const plate=doc.querySelector('#region-pedestal [data-piece="throttle-quadrant"]');if(!plate)return;
 layer=doc.createElement('div');layer.className='pedestal-trim-layer';
 for(const [side,sign] of [['CAPT',1],['FO',-1]]){
  const wheel=doc.createElement('div'),rim=doc.createElement('div'),rotor=new Image(),index=new Image();
  wheel.className='pedestal-trim-wheel';wheel.dataset.side=side;wheel.setAttribute('role','slider');wheel.tabIndex=0;
  wheel.setAttribute('aria-label',side+' manual stabilizer trim wheel');wheel.setAttribute('aria-valuemin','0');wheel.setAttribute('aria-valuemax','17');wheel.setAttribute('aria-orientation','vertical');
  rim.className='pedestal-trim-plane';rotor.src='./assets/pedestal-hardware/trim-wheel.webp';rotor.alt='';rotor.draggable=false;
  index.src='./assets/pedestal-hardware/trim-index.webp';index.className='pedestal-trim-index';index.dataset.side=side;index.alt='';index.draggable=false;
  rim.append(rotor);wheel.append(rim);layer.append(wheel,index);wheels.push({wheel,index,rotor,sign});
  wheel.onpointerdown=e=>{
   if(held||e.button!==0)return;e.preventDefault();e.stopPropagation();
   held={wheel,id:e.pointerId,y:e.clientY,units,height:Math.max(1,wheel.getBoundingClientRect().height)};
   wheel.setPointerCapture(e.pointerId);
  };
  wheel.onpointermove=e=>{
   if(held?.wheel!==wheel||held.id!==e.pointerId)return;
   e.preventDefault();e.stopPropagation();
   set(held.units+(e.clientY-held.y)/held.height);
  };
  wheel.onlostpointercapture=wheel.onpointercancel=wheel.onpointerup=e=>{if(held?.id===e.pointerId)held=null;};
  wheel.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();set(units+Math.sign(e.deltaY)*.1);},{passive:false});
  wheel.onkeydown=e=>{
   const delta={ArrowDown:.1,ArrowUp:-.1,PageDown:1,PageUp:-1}[e.key];
   if(delta===undefined)return;e.preventDefault();e.stopPropagation();set(units+delta);
  };
 }
 plate.append(layer);paint();
}
win.addEventListener('blur',()=>{held=null;});
win.addEventListener('b737:stabilizer-trim-drive',e=>{
 if(['MAIN_ELECTRIC','AUTOPILOT'].includes(e.detail?.source))set(e.detail.units,e.detail.source);
});
win.B737StabilizerTrim=Object.freeze({get:()=>units,set});
win.addEventListener('b737:cockpit-mounted',mount);queueMicrotask(mount);
})(window);
