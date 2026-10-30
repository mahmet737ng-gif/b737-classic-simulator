/* Owner approved 2026-10-30: exact F/O photo + ONLY three GPWS guard registrations.
 * Original Owner18 assets, behavior and immutable baseline stay unchanged.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root.document)api.install(root);})(typeof window==='object'?window:globalThis,function(){
'use strict';
const source=Object.freeze({width:1286,height:1223,sha256:'34aa9374760f8eb331ef359ad9a39b2954fd2398d0dbb8b9283e695a18744163'});
const rect=Object.freeze({x:1374,y:127,w:695,h:695*1223/1286});
const guards=Object.freeze({'gpws-terrain-inhibit':[173,1069,35,66],'gpws-flap-inhibit':[240,1069,35,66],'gpws-gear-inhibit':[306,1069,35,66]});
const pivots={altimeter:[933,405,86],verticalSpeed:[932,605,86],clock:[1142,592,81],rmi1:[330,714,73],rmi2:[330,714,73]};
function placement(box){const s=rect.w/source.width;return {x:rect.x+box[0]*s,y:rect.y+box[1]*s,w:box[2]*s,h:box[3]*s};}
// Owner-requested paint match, 2026-10-30. Only low-saturation blue-gray
// paint pixels are adjusted; black faces, white print and saturated lamps stay intact.
function matchPaint(img,doc){
 if(img.dataset.paintMatched)return;
 const canvas=doc.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 const frame=ctx.getImageData(0,0,canvas.width,canvas.height),a=frame.data;
 const ramp=(v,lo,hi)=>Math.max(0,Math.min(1,(v-lo)/(hi-lo)));
 for(let i=0;i<a.length;i+=4){const r=a[i],g=a[i+1],b=a[i+2],lo=Math.min(r,g,b),hi=Math.max(r,g,b),chroma=hi-lo;
  const w=ramp(lo,45,65)*ramp(245-hi,0,30)*ramp(b-r,0,10)*ramp(b-g,-3,4)*ramp(g-r,-3,4)*(1-ramp(chroma/Math.max(hi,1),.45,.7));
  if(w===0)continue;
  a[i]=Math.min(255,r+44*w);a[i+1]=Math.min(255,g+37*w);a[i+2]=Math.min(255,b+22*w);
 }
 ctx.putImageData(frame,0,0);img.dataset.paintMatched='ENGINE-GRAY-20261030';img.src=canvas.toDataURL('image/png');
}
function install(win){const doc=win.document;let pending=false;
function mount(){const native=doc.querySelector('#region-main .region-native');if(!native)return;
let photo=doc.getElementById('fo-owner-panel-v1');
if(!photo){photo=doc.createElement('div');photo.id='fo-owner-panel-v1';photo.dataset.piece='fo-owner';photo.className='fo-owner-panel';Object.assign(photo.style,{position:'absolute',left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px',zIndex:'20',pointerEvents:'none'});const img=doc.createElement('img');img.src=new URL('./assets/fo-efis-rd-owner-20261030-v1.png',doc.baseURI).href;img.alt='Owner approved F/O EFIS/RD panel';img.draggable=false;Object.assign(img.style,{width:'100%',height:'100%',display:'block'});img.onload=()=>{photo.dataset.loaded='true';matchPaint(img,doc);};img.onerror=()=>photo.dataset.loaded='false';photo.append(img);native.append(photo);}
const outer=native.querySelector('[data-piece="fo-outer"]');if(outer)outer.style.visibility='hidden';
const inner=native.querySelector('[data-piece="fo-inner"]');if(inner)inner.style.clipPath='inset(0 59.1398% 0 0)';
// Move the EXISTING live needle nodes, preserving state and event/API references.
for(const layer of native.querySelectorAll('svg[data-flight-needles]')){if(layer.dataset.flightNeedles==='captain')continue;
for(const blade of layer.querySelectorAll('[data-flight-needle][data-station="firstOfficer"]')){const key=blade.dataset.flightNeedle,p=pivots[key];if(!p)continue;const group=blade.parentElement;const rmi=key.startsWith('rmi');const transform=rmi?`translate(${p[0]} ${p[1]}) scale(${p[2]/215*.835})`:`translate(${p[0]} ${p[1]}) scale(${p[2]/229}) translate(-256 -256)`;group.setAttribute('transform',transform);}
if(layer.parentElement!==photo){for(const cap of layer.querySelectorAll(':scope > circle'))cap.remove();layer.setAttribute('viewBox','0 0 1286 1223');photo.append(layer);}
}
for(const layer of native.querySelectorAll('svg[data-airspeed-pointers="firstOfficer"]')){const p=[310,422],model=win.B737AirspeedPointersModel;
for(const group of layer.children){const blade=group.querySelector('[data-airspeed-blade]');if(!blade)continue;const limit=blade.dataset.airspeedBlade==='vmo-mmo';const def=limit?model.pointers.vmoMmo:model.pointers.airspeed;group.setAttribute('transform',`translate(${p[0]} ${p[1]}) scale(${(limit?95:100)/def.assetTipRadius}) translate(-512 -512)`);}
if(layer.parentElement!==photo){for(const cap of layer.querySelectorAll(':scope > circle'))cap.remove();layer.setAttribute('viewBox','0 0 1286 1223');photo.append(layer);}}
// A bounded stylesheet overrides placement only for the three owner-authorized guards.
let css=doc.getElementById('fo-owner-registration-css');if(!css){css=doc.createElement('style');css.id='fo-owner-registration-css';doc.head.append(css);}
const rules=['#region-main .cockpit-light-layer{z-index:40!important}'];
for(const [id,box]of Object.entries(guards)){const btn=native.querySelector(`[data-guard-id="${id}"]`);if(!btn)continue;const p=placement(box),w=parseFloat(btn.style.width),h=parseFloat(btn.style.height);if(!(w>0&&h>0))continue;rules.push(`#region-main [data-guard-id="${id}"]{left:${p.x}px!important;top:${p.y}px!important;transform:scale(${p.w/w},${p.h/h})!important;transform-origin:0 0!important;z-index:60!important}`);btn.dataset.ownerPhotoRegistration='FO-OWNER-20261030';}
const lamps={'main-pull-up-fo':[376,216,54,24],'main-below-gs-fo':[376,247,54,24],'main-altitude-fo':[821,256,54,22],'main-gpws-inop':[84,1018,59,26]};
for(const[id,box]of Object.entries(lamps)){const p=placement(box);rules.push(`#region-main [data-cockpit-light="${id}"]{left:${p.x}px!important;top:${p.y}px!important;width:${p.w}px!important;height:${p.h}px!important;z-index:45!important}`);}
rules.push('#region-main [data-cockpit-light="main-brake-temp"]{display:none!important}');
const text=rules.join('\n');if(css.textContent!==text)css.textContent=text;
win.B737FoOwnerPanelV1={version:'FO-OWNER-20261030',source,rect,guards,inspect:()=>({loaded:photo.dataset.loaded==='true',guards:Object.keys(guards).map(id=>{const n=native.querySelector(`[data-guard-id="${id}"]`);return{id,mounted:!!n,box:n?.getBoundingClientRect().toJSON()};})})};
}
function queue(){if(pending)return;pending=true;win.requestAnimationFrame(()=>{pending=false;mount();});}
win.addEventListener('b737:cockpit-mounted',queue);win.addEventListener('resize',queue);new win.MutationObserver(queue).observe(doc.getElementById('scene')||doc.body,{childList:true,subtree:true});queue();
}
return {source,rect,guards,placement,install};
});
