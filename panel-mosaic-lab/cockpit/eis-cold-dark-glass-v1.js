/* EIS-COLD-DARK-0001. Non-destructive optical blackout for the embedded
 * EIS instrument glass only. The approved source bitmap and all needles,
 * instrument coordinates, engine state, and guarded switches remain intact.
 * Hot Battery and ground-service power alone cannot keep EIS glass illuminated.
 */
(function(){
'use strict';
const ID='eisColdDarkGlassV1',ns='http://www.w3.org/2000/svg';
const feeds=['generator1','generator2','transfer1','transfer2','dc1','dc2','acStandby','battery','switchedHotBattery','dcStandby'];
let piece=null,layer=null,last=null;
function paint(){
 const bus=window.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
 if(!bus||!feeds.every(id=>Object.hasOwn(bus,id)))return;
 const absent=feeds.every(id=>bus[id]===false);
 if(absent!==last){last=absent;if(layer)layer.dataset.unpowered=String(absent);}
}
function mount(){
 if(layer&&layer.isConnected)return true;
 piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');
 const specs=window.B737ISNEngineGaugeModel?.eisGauges;
 if(!piece||!Array.isArray(specs)||specs.length!==16)return false;
 layer=document.createElementNS(ns,'svg');
 layer.id=ID;layer.classList.add('eis-cold-dark-glass-v1');
 layer.setAttribute('viewBox','0 0 1235 1274');
 layer.setAttribute('preserveAspectRatio','none');
 layer.setAttribute('aria-hidden','true');
 layer.dataset.unpowered='false';
 const defs=document.createElementNS(ns,'defs');
 const gradient=document.createElementNS(ns,'radialGradient');
 gradient.setAttribute('id','eisColdDarkLensGradientV1');
 for(const [offset,color] of [['0%','#0a1011'],['84%','#070c0e'],['100%','#12181b']]){
  const stop=document.createElementNS(ns,'stop');
  stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);
  gradient.appendChild(stop);
 }
 defs.appendChild(gradient);layer.appendChild(defs);
 for(const spec of specs){
  const circle=document.createElementNS(ns,'circle');
  circle.setAttribute('cx',spec.cx);
  circle.setAttribute('cy',spec.cy);
  circle.setAttribute('r',spec.radius+9);
  circle.setAttribute('fill','url(#eisColdDarkLensGradientV1)');
  circle.setAttribute('stroke','#182125');
  circle.setAttribute('stroke-width','1');
  layer.appendChild(circle);
 }
 piece.appendChild(layer);
 paint();
 return true;
}
function sync(){mount();paint();}
window.addEventListener('b737:cockpit-mounted',sync);
for(const event of ['b737:electrical-network','b737:electrical-v7-state',
 'b737:unified-ecu-observation','b737:electrical-owner-ready'])
 window.addEventListener(event,sync);
document.addEventListener('DOMContentLoaded',sync,{once:true});
if(document.readyState!=='loading')sync();
window.B737EISColdDarkGlassV1=Object.freeze({
 refresh:sync,snapshot:()=>({mounted:!!layer?.isConnected,unpowered:last,faces:layer?.querySelectorAll('circle').length||0})
});
})();
