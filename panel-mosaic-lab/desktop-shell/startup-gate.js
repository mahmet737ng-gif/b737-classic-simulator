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
 function imagesReady(root,selector,minimum=1){
  const images=root?.querySelectorAll(selector);
  return (images?.length||0)>=minimum&&Array.from(images,img=>img.complete&&img.naturalWidth>0).every(Boolean);
 }
 function inspectFull(w,profile,main=inspect(w,profile)){
  const d=w.document;
  const result={electrical:false,overhead:false,cdu:false,pedestal:false,instruments:false,complete:false};
  try{
   result.electrical=w.B737ISNCockpitV1?.startupSynchronized?.()===true;
   const overhead=d.getElementById('overheadFrame')?.contentDocument;
   const releaseArt=w.B737GatewayBoot?.art;
   const needlesRestored=
    (!releaseArt?.oh10||Boolean(overhead?.querySelector('.atlas-piece[data-key="OH10"][data-static-needle-photo="CLEANED"]')))&&
    (!releaseArt?.oh12||Boolean(overhead?.querySelector('.atlas-piece[data-key="OH12"][data-apu-egt-photo="CLEANED"]')));
   result.overhead=main.overhead&&needlesRestored&&imagesReady(overhead,'#atlasAbsolute .atlas-photo')&&
    (profile.pressurization!=='DCPCS'||imagesReady(overhead,'.dcpcs-owner-oh22-background > img'))&&
    (profile.aircraftFamily!=='B737-400'||imagesReady(overhead,'.b737-400-owner-oh20-background > img'))&&
    imagesReady(overhead,'.asp-control-image');
   result.cdu=main.cdu&&(w.B737UnifiedNoCduTest||['CAPT','FO'].every(seat=>
    imagesReady(d.getElementById('cduFrame'+seat)?.contentDocument,'#cdu-stage img.base')));
   result.pedestal=imagesReady(d,'#region-pedestal .texture-piece > img')&&
    w.B737ThrottlePositions?.mounted?.()===true&&
    d.querySelectorAll('#region-pedestal .engine-start-lever').length===2&&
    (!releaseArt?.engine1||d.querySelectorAll('.engine-start-lever-art image[data-boot-ready="true"]').length===2)&&
    imagesReady(d,'#region-pedestal .fire-handle-control > img',3)&&
    imagesReady(d,'.throttle-state-sprite',10)&&imagesReady(d,'.asp-control-image');
   const eadiSeats=['CAPT','FO'];
   result.instruments=eadiSeats.every(seat=>
    Number(d.querySelector('[data-eadi-stage1-seat="'+seat+'"]')?.dataset.eadiPaintCount)>0&&
    !!d.getElementById('unifiedEhsi'+seat))&&
    !!d.querySelector(profile.engineInstruments==='CONVENTIONAL'?
     '.conventional-engine-needle-layer-v1 [data-render-angle]':'[data-isn-engine-gauges] [data-pointer]');
   result.complete=main.usable&&result.electrical&&result.overhead&&result.cdu&&result.pedestal&&result.instruments;
  }catch{}
  return result;
 }
 function inspect(w,profile){
  const result={profile:false,main:false,controls:false,overhead:false,cdu:false,usable:false};
  try{
   const d=w.document,p=w.B737AircraftProfileStore?.get();
   result.profile=!!p&&['aircraftFamily','pressurization','engineInstruments'].every(k=>p[k]===profile[k]);
   result.main=!!d.getElementById('region-main')&&visibleImagesReady(w);
   if(p?.engineInstruments==='CONVENTIONAL'){
    const photos=[d.querySelector('.conventional-engine-panel-v1'),d.querySelector('#fo-owner-panel-v1 > img')];
    result.main=result.main&&d.documentElement.dataset.engineIndication==='CONVENTIONAL'&&photos.every(img=>img&&img.complete&&img.naturalWidth>0);
   }
   result.controls=!!w.B737ISNCockpitV1&&!!d.querySelector('[data-mcp-hardware="AT_ARM"]');
   result.overhead=!!d.querySelector('#overheadStatus')?.textContent?.includes('Connected');
   result.cdu=!!d.querySelector('.cdu-station[data-seat="CAPT"].ready')&&!!d.querySelector('.cdu-station[data-seat="FO"].ready');
   result.usable=result.profile&&result.main&&result.controls;
  }catch{}
  return result;
 }
 return {inspect,inspectFull,visibleImagesReady,intersects};
});
