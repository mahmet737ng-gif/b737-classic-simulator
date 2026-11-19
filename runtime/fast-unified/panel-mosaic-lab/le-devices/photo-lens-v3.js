/* LE-PHOTOLENS-0004. Owner-directed unlock, real OFF glass covering painted bitmap and smooth lit optics.
 * The original final-locked LED engine, 26 input targets, hardware and state
 * remain unchanged. All new lenses are inset inside photo source apertures.
 */
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg',SEL='svg.b737-le-devices__lamps',PATH='path[data-device][data-level]';
const mounted=new WeakSet();let serial=0;
const svg=(tag,a={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(a))n.setAttribute(k,String(v));return n;};
function insetPolygon(d,gap=4.1){
 const p=[...String(d).matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m=>[+m[1],+m[2]]);
 if(p.length!==4)throw Error('LE lens must have four corners');
 const a=p.reduce((n,q,i)=>n+q[0]*p[(i+1)%4][1]-p[(i+1)%4][0]*q[1],0),sign=Math.sign(a);
 if(!sign)throw Error('LE lens polygon has zero area');
 const lines=p.map((q,i)=>{
  const end=p[(i+1)%4],dx=end[0]-q[0],dy=end[1]-q[1],l=Math.hypot(dx,dy);
  if(l<1)throw Error('LE lens degenerate edge');
  const nx=-sign*dy/l,ny=sign*dx/l;return {nx,ny,c:nx*q[0]+ny*q[1]+gap};
 });
 const inner=lines.map((line,i)=>{
  const prev=lines[(i+3)%4],det=prev.nx*line.ny-line.nx*prev.ny;
  if(Math.abs(det)<1e-7)throw Error('LE lens parallel edges');
  return [(prev.c*line.ny-line.c*prev.ny)/det,(prev.nx*line.c-line.nx*prev.c)/det];
 });
 const b=inner.reduce((n,q,i)=>n+q[0]*inner[(i+1)%4][1]-inner[(i+1)%4][0]*q[1],0);
 if(Math.abs(b)>=Math.abs(a)||Math.abs(b)<100)throw Error('LE lens inset out of aperture');
 return inner.map((q,i)=>(i?'L':'M')+q.map(x=>x.toFixed(2)).join(' ')).join(' ')+' Z';
}
function gradient(defs,id,stops){
 const g=svg('linearGradient',{id,x1:'12%',y1:'0%',x2:'88%',y2:'100%'});
 for(const [offset,color,alpha] of stops)g.append(svg('stop',{offset,'stop-color':color,'stop-opacity':alpha}));
 defs.append(g);
}
function install(source){
 if(!source.parentNode)return;
 if(mounted.has(source)&&source.nextElementSibling?.classList?.contains('b737-le-photolens-v2'))return;
 mounted.delete(source);
 const parts=[...source.querySelectorAll(PATH)];if(parts.length!==26)return;
 const id='leph'+(++serial),lens=svg('svg',{class:'b737-le-photolens-v2',viewBox:'0 0 1984 793',preserveAspectRatio:'none','aria-hidden':'true'});
 const defs=svg('defs');lens.append(defs);
 gradient(defs,id+'a',[['0%','#f0c87c','.98'],['30%','#d9a34f','.95'],['72%','#af7833','.94'],['100%','#73531f','.89']]);
 gradient(defs,id+'g',[['0%','#a6c9ae','.98'],['30%','#79ab87','.96'],['72%','#467e64','.95'],['100%','#285547','.91']]);
 gradient(defs,id+'h',[['0%','#ffffff','.16'],['26%','#fff8d9','.08'],['70%','#c7e0d4','.02'],['100%','#000000','0']]);
 const segments=parts.map((original,i)=>{
  const aperture=original.getAttribute('d'),d=insetPolygon(aperture);
  const g=svg('g',{'data-lens-id':original.dataset.device+'|'+original.dataset.level});
  const amber=original.dataset.level==='TRANSIT';
  // A real opaque, smooth, dark glass lens covers the painted green/amber
  // bitmap underneath even while OFF. Its aperture remains fully inside the
  // owner-approved clickable polygon and does not cover the white legends.
  const dark=svg('path',{d:insetPolygon(aperture,0.65),
    fill:amber?'#30251a':'#20342b','data-optic-layer':'unlit-glass'});
  const face=svg('path',{d,fill:'url(#'+id+(amber?'a':'g')+')','data-optic-layer':'illuminated-glass'});
  const sheen=svg('path',{d,fill:'url(#'+id+'h)','data-optic-layer':'soft-reflection'});
  const delay=((i*11)%26)*4+'ms';
  face.style.transition='opacity 72ms ease-out '+delay;
  sheen.style.transition='opacity 72ms ease-out '+delay;
  face.style.opacity='0';sheen.style.opacity='0';
  g.append(dark,face,sheen);lens.append(g);
  return {original,dark,face,sheen};
 });
 source.insertAdjacentElement('afterend',lens);
 source.parentNode.classList.add('b737-le-photolens-ready-v2');
 const sync=()=>{
  for(const {original,face,sheen} of segments){
   const lit=original.dataset.lit==='true',dim=original.getAttribute('fill-opacity')==='.52';
   face.style.opacity=lit?(dim?'.54':'.98'):'0';
   sheen.style.opacity=lit?(dim?'.15':'.46'):'0';
  }
 };
 const watcher=new MutationObserver(sync);
 watcher.observe(source,{subtree:true,attributes:true,attributeFilter:['data-lit','fill-opacity']});
 mounted.add(source);sync();
}
function refresh(){document.querySelectorAll(SEL).forEach(install);}
function mountAdded(node){
 if(node?.nodeType!==1)return;
 if(node.matches?.(SEL))install(node);
 node.querySelectorAll?.(SEL).forEach(install);
}
function boot(){
 // The Unified atlas has thousands of live mutations. Never rescan the whole
 // document on each one. Only newly inserted LED subtrees need registration.
 refresh();
 const observer=new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)mountAdded(node);
 });
 observer.observe(document.body||document.documentElement,{childList:true,subtree:true});
 window.addEventListener('b737:cockpit-mounted',refresh);
}
window.B737LEPhotoLensV2=Object.freeze({version:'LE-PHOTOLENS-0003',refresh,insetPolygon,
 status:()=>[...document.querySelectorAll('.b737-le-photolens-v2')].map(x=>({mounted:x.isConnected,lenses:x.querySelectorAll('[data-lens-id]').length}))});
window.B737LEPhotoLensV3=window.B737LEPhotoLensV2;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();