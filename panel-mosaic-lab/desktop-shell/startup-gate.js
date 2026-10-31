(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CockpitStartupGate=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function intersects(a,b){return a.width>0&&a.height>0&&a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;}
 function visibleImagesReady(w){
  const d=w.document,viewport=d.getElementById('viewport')?.getBoundingClientRect();
  if(!viewport)return false;
  const images=[...d.querySelectorAll('#region-main .texture-piece > img')].filter(img=>{
   const style=w.getComputedStyle(img);
   return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&intersects(img.parentElement.getBoundingClientRect(),viewport);
  });
  return images.length>0&&images.every(img=>img.complete&&img.naturalWidth>0);
 }
 function inspect(w,profile){
  const result={profile:false,main:false,controls:false,overhead:false,cdu:false,usable:false};
  try{
   const d=w.document,p=w.B737AircraftProfileStore?.get();
   result.profile=!!p&&['aircraftFamily','pressurization','engineInstruments'].every(k=>p[k]===profile[k]);
   result.main=!!d.getElementById('region-main')&&visibleImagesReady(w);
   result.controls=!!w.B737ISNCockpitV1&&!!d.querySelector('[data-mcp-hardware="AT_ARM"]');
   result.overhead=!!d.querySelector('#overheadStatus')?.textContent?.includes('متصل');
   result.cdu=!!d.querySelector('.cdu-station[data-seat="CAPT"].ready')&&!!d.querySelector('.cdu-station[data-seat="FO"].ready');
   result.usable=result.profile&&result.main&&result.controls;
  }catch{}
  return result;
 }
 return {inspect,visibleImagesReady,intersects};
});
