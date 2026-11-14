/* LGT-GLOBAL-002: Reusable annunciator faces. Preserve source sockets and electrical state. */
(function(win){
 'use strict';
 const locationOfScript=document.currentScript.src;
 const rootURL=new URL('./',locationOfScript);
 const valid=mode=>mode==='DIM'||mode==='BRIGHT';
 let mode='BRIGHT', registry=null, loadError='';
 const masters=new Map();
 const requested=new URLSearchParams(location.search).get('lampBrightness');
 if(valid(requested))mode=requested;
 const ready=fetch(new URL('manifest.json',rootURL),{cache:'no-store'}).then(response=>{
   if(!response.ok)throw Error('Lamp manifest HTTP '+response.status);
   return response.json();
 }).then(data=>{
   if(data.schema!=='b737.classic.annunciator.global-dimmer.v2'||data.masters.length!==87)
     throw Error('Unexpected lamp manifest');
   if(Object.keys(data.sourceAssetToMaster||{}).length!==91)
     throw Error('Incomplete original lamp-family mapping');
   for(const m of data.masters){
     if(masters.has(m.id)||!m.assets.OFF||!m.assets.DIM||!m.assets.BRIGHT)
       throw Error('Duplicate/incomplete lamp family '+m.id);
     masters.set(m.id,m);
   }
   for(const key of Object.values(data.sourceAssetToMaster))
     if(!masters.has(key))throw Error('Missing lamp master '+key);
   registry=data;
   win.dispatchEvent(new CustomEvent('b737:lamp-library-ready',{detail:{count:masters.size,mode}}));
   return true;
 }).catch(error=>{loadError=String(error.message||error);console.error('LGT-GLOBAL-002:',loadError);return false;});
 function resolve(panel,asset,signalState){
   if(!registry||!['OH','MP','OH400'].includes(panel))return null;
   const id=registry.sourceAssetToMaster[panel+':'+asset]||registry.variantAliases?.[panel+':'+asset];
   const master=masters.get(id);
   const frame=signalState==='FLASH'?'ON':signalState;
   const selected=registry.mapping?.[frame]?.[mode];
   const localPath=master?.assets?.[selected];
   return localPath?new URL(localPath,rootURL).href:null;
 }
 function emit(){win.dispatchEvent(new CustomEvent('b737:lamp-brightness-change',{detail:{mode}}));}
 function setMode(next){
   if(!valid(next))throw Error('Lamp mode must be DIM or BRIGHT');
   if(next===mode)return mode;
   mode=next;emit();
   // Propagate brightness only, not cockpit switch positions or aircraft systems.
   for(const frame of document.querySelectorAll('iframe')){
     try{frame.contentWindow?.postMessage({type:'b737:lamp-brightness',mode},location.origin);}catch{}
   }
   return mode;
 }
 win.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.data?.type!=='b737:lamp-brightness'||!valid(event.data.mode))return;
   if(event.data.mode!==mode){mode=event.data.mode;emit();}
 });
 win.B737LampAppearance=Object.freeze({
   ready,resolve,setMode,getMode:()=>mode,
   status:()=>({mode,ready:!!registry,masters:masters.size,error:loadError})
 });
})(window);
