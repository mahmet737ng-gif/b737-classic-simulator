/* CROSS-COCKPIT-LABS-0001
 * A system may have physical indicators in several cockpit zones.
 * Display original asset crops + real read-only signals within the SAME system lab.
 * No guessed numeric values, no duplicate physical lamps, no source changes.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737CrossCockpitIndicatorsV1=api;
})(typeof window!=='undefined'?window:null,function(win){
 'use strict';
 const STATUS='B737_CROSS_COCKPIT_INDICATORS_V1';
 let catalogPromise=null,host=null,panel=null,seq=0,interval=null,items=[];
 const by=(v,k)=>v&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,k)?v[k]:undefined;
 const exact=(object,path)=>{
  if(!path||!/^[a-zA-Z0-9_.]+$/.test(path))return undefined;
  return path.split('.').reduce((value,key)=>by(value,key),object);
 };
 function readIndicator(def,sources={}){
  if(!def)return {status:'NO_SOURCE',text:'—'};
  if(def.kind==='sixpack'){
   const value=by(sources.sixpack?.getEffectiveState?.(),def.id);
   return typeof value==='boolean'
    ?{status:'LIVE_MAIN_READ_ONLY',text:value?'ILLUMINATED':'OFF',on:value}
    :{status:'UNAVAILABLE',text:'NOT CONNECTED'};
  }
  if(def.kind==='overhead_lamps'){
   const lampState=sources.overhead?.B737OverheadLights?.getState?.();
   if(!lampState?.frames)return {status:'UNAVAILABLE',text:'LAMP SOURCE NOT READY',lamps:[]};
   const lights=def.lamps.map(id=>({id,frame:by(lampState.frames,id)??'UNKNOWN'}));
   return {status:'LIVE_ISOLATED_OVERHEAD',text:lights.filter(x=>x.frame!=='OFF'&&x.frame!=='UNKNOWN').length+
    ' / '+lights.length+' annunciations active',lamps:lights};
  }
  if(def.kind==='gauge'){
   if(def.source?.provider!=='ecu'||!def.source.path)return {status:'NO_VERIFIED_SIGNAL',text:'—'};
   const ecu=sources.ecu?.getECUState?.();
   const val=exact(ecu,def.source.path);
   // Follow the Stage8 contract: a numeric value without declared simulator
   // provenance is NOT a valid instrument observation.
   if(ecu?.quality!=='TRAINING_SIMULATION_ONLY'||typeof val!=='number'||!Number.isFinite(val))
    return {status:'UNAVAILABLE_SOURCE',text:'—'};
   return {status:'TRAINING_SIMULATION_ONLY',text:val.toFixed(0)+' '+(def.source.unit||'')};
  }
  return {status:'NO_SOURCE',text:'—'};
 }
 function obtainSources(){
  let overhead;
  try{overhead=win.document.getElementById('ohLabStage')?.contentWindow||win.document.getElementById('anti-live-stage')?.contentWindow;}catch(_){}
  return {overhead:overhead||null,sixpack:win.B737SixPack,ecu:win.B737ISNCockpitV1};
 }
 function load(){
  if(!catalogPromise)catalogPromise=fetch('./cross-cockpit-indicators-v1.json',{cache:'no-store'}).then(r=>{
   if(!r.ok)throw Error('Cross-cockpit catalog unavailable '+r.status);
   return r.json();
  }).then(d=>{
   if(d?.schema!==STATUS||!d.panels||typeof d.panels!=='object')throw Error('Cross-cockpit catalog rejected');
   return d;
  });
  return catalogPromise;
 }
 function node(tag,cls,text){
  const el=win.document.createElement(tag);
  if(cls)el.className=cls;if(text!==undefined)el.textContent=text;
  return el;
 }
 function photoCrop(def){
  const photo=def.photo,card=node('div','oh-cross-source');
  if(!photo?.url)return card;
  const p=def.geometry?.pivot;
  // An unapproved native-pixel approximate pivot may be used ONLY to select
  // a generous visual crop. It is never a needle rotation center.
  const size=p?200:null;
  const box=size?{
   x:Math.max(0,Math.min(photo.width-size,p.x-size/2)),
   y:Math.max(0,Math.min(photo.height-size,p.y-size/2)),
   w:Math.min(size,photo.width),h:Math.min(size,photo.height)
  }:{x:0,y:0,w:photo.width,h:photo.height};
  const scale=Math.min(1,220/box.w,180/box.h);
  card.style.width=(box.w*scale)+'px';
  card.style.height=(box.h*scale)+'px';
  const pic=node('div','oh-cross-native-photo');
  Object.assign(pic.style,{
   backgroundImage:'url("'+new URL(photo.url,win.document.baseURI).href+'")',
   backgroundRepeat:'no-repeat',backgroundSize:(photo.width*scale)+'px '+(photo.height*scale)+'px',
   backgroundPosition:(-box.x*scale)+'px '+(-box.y*scale)+'px'
  });
  card.append(pic);
  card.title='Original '+def.panel+' source image'+(p?' · approximate crop, pivot not approved':'');
  return card;
 }
 function displayCard(def){
  const card=node('article','oh-cross-card');
  const tag=node('div','oh-cross-tag',def.zone+' · '+def.id);
  const title=node('strong','oh-cross-name',def.label);
  const output=node('output','oh-cross-value','—');
  const status=node('small','oh-cross-quality','WAITING FOR ORIGINAL SIGNAL');
  card.append(tag,title);
  if(def.photo)card.append(photoCrop(def));
  if(def.kind==='overhead_lamps')card.append(node('div','oh-cross-lamps'));
  card.append(output,status);
  const note=def.kind==='gauge'?
   (def.geometry?.verified?'SOURCE PHOTO VERIFIED':'Photo crop approximate · gauge needle geometry NOT yet certified'):
   def.kind==='sixpack'?'Existing live glareshield six-pack indication':
   'Same original overhead annunciations shown within this system lab';
  card.append(node('small','oh-cross-note',note));
  return {def,card,output,status};
 }
 function refresh(){
  if(!panel||!items.length)return;
  const source=obtainSources();
  for(const item of items){
   const result=readIndicator(item.def,source);
   item.output.textContent=result.text;
   item.output.dataset.on=result.on?'true':'false';
   item.status.textContent=result.status.replaceAll('_',' ');
   if(result.lamps){
    const lamps=item.card.querySelector('.oh-cross-lamps');
    if(lamps) {
     lamps.replaceChildren();
     for(const l of result.lamps){
      const name=node('span','oh-cross-lamp',l.id.replaceAll('-',' ').toUpperCase()+' · '+l.frame);
      name.dataset.frame=l.frame;
      lamps.append(name);
     }
    }
   }
  }
 }
 function mount(container){
  if(!container)return false;
  if(host?.parentNode!==container){
   host=node('section','oh-cross-indicators');
   host.setAttribute('aria-label','Same-system cockpit-wide indicators');
   container.append(host);
  }
  return true;
 }
 function hide(){
  seq++;panel=null;items=[];
  if(interval!==null){clearInterval(interval);interval=null;}
  if(host){host.replaceChildren();host.hidden=true;}
 }
 async function show(id,container){
  if(!mount(container))return false;
  const ticket=++seq;
  if(interval!==null){clearInterval(interval);interval=null;}
  host.hidden=false;host.replaceChildren(node('p','oh-cross-note','Locating the original indicators across cockpit zones…'));
  try{
   const data=await load();
   if(ticket!==seq)return false;
   const entry=data.panels[id];
   panel=id;host.replaceChildren();
   if(!entry?.displays?.length){
    host.hidden=true;return true;
   }
   host.append(node('h3','oh-cross-heading','SYSTEM-WIDE INDICATIONS · ALL COCKPIT LOCATIONS'));
   host.append(node('p','oh-cross-note','Original overhead + main + engine instruments are grouped by system, not by panel. Main/engine values are read-only from the installed cockpit; lab injections are isolated until the corresponding ECU fault bridge is validated.'));
   const grid=node('div','oh-cross-grid');
   items=entry.displays.map(displayCard);
   for(const item of items)grid.append(item.card);
   host.append(grid);
   refresh();interval=setInterval(refresh,500);
   return true;
  }catch(err){
   if(ticket!==seq)return false;
   host.replaceChildren(node('p','oh-cross-error','Cross-cockpit indicators unavailable: '+err.message));
   return false;
  }
 }
 return Object.freeze({load,mount,show,hide,readIndicator,exact,refresh,getCurrent:()=>panel});
});
