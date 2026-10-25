/* Unified-only 737-400 OH21 air systems adaptation.
 * Does not modify or mount within the immutable all-overhead mosaic.
 * Existing right RECIRC toggle and pack-trip caution logic are reused.
 */
(function(){
 'use strict';
 const m=window.B737Aircon400Oh21Model,host=document.getElementById('atlasAbsolute');
 if(!m||!host)throw Error('737-400 OH21 overlay dependencies unavailable');
 m.validate();
 const PROFILE_KEY='b737classic.aircraft-profile.v1',STORE_KEY='b737classic.aircon400-recirculation.v1';
 const asset=name=>new URL('../cockpit/assets/'+name,document.baseURI).href;
 let family='B737-300-500',plate=null,layer=null,left=null,packNodes=new Map();
 let leftValue='AUTO';
 try{leftValue=m.normalizeSwitch(localStorage.getItem(STORE_KEY));}catch(_){}
 function storedFamily(){
  try{return m.variant(JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.aircraftFamily);}
  catch(_){return 'B737-300-500';}
 }
 function absolutePlacement(el){
  const n=x=>parseFloat(x);
  return {x:n(el.style.left),y:n(el.style.top),w:n(el.style.width),h:n(el.style.height)};
 }
 function fit(node,rect){
  Object.assign(node.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});
 }
 function publishLeft(){
  window.B737OverheadLights?.setAircon400LeftRecirc?.(leftValue);
  window.dispatchEvent(new CustomEvent('b737:aircon400-recirculation-change',{
   detail:{family:'B737-400',side:'L',value:leftValue}
  }));
  if(parent!==window)parent.postMessage({
   type:'b737:cockpit-overhead',kind:'aircon400-recirculation',
   family:'B737-400',side:'L',value:leftValue
  },location.origin);
 }
 function renderLeft(){
  if(!left)return;
  const sprite=left.querySelector('.toggle-sprite');
  const reference=window.B737OverheadToggles?.getRegistry()||{};
  const defs=reference.assets||{},small=reference.visualFamilies?.Small;
  const frame=leftValue==='OFF'?3:4,down=frame===4,definition=defs[down?'vertical-off':'vertical-on'];
  if(sprite&&small){
   // The 737-400 L and R RECIRC FAN use precisely the same fixed-bezel Small atlas.
   sprite.style.backgroundImage='url("'+new URL('../interactive-overhead/'+small.asset,document.baseURI).href+'")';
   sprite.style.backgroundSize='500% 100%';
   sprite.style.backgroundPosition=frame*25+'% 50%';
  }else if(sprite&&definition){
   sprite.style.backgroundImage='url("'+new URL('../interactive-overhead/'+definition.url,document.baseURI).href+'")';
   sprite.style.backgroundSize=down?'100% 100%':'500% 100%';
   sprite.style.backgroundPosition=down?'50% 50%':frame*25+'% 50%';
  }
  left.dataset.state=leftValue;
  left.setAttribute('aria-valuenow',String(leftValue==='OFF'?0:1));
  left.setAttribute('aria-valuetext',leftValue);
  left.setAttribute('aria-label','L RECIRC FAN — '+leftValue);
 }
 function setLeft(value,reason='ui'){
  if(!['OFF','AUTO'].includes(value))return false;
  if(value===leftValue)return true;
  leftValue=value;
  try{localStorage.setItem(STORE_KEY,value);}catch(_){}
  renderLeft();publishLeft();
  return true;
 }
 function addLabels(g){
  for(const item of m.labels){
   const node=document.createElement('span');node.className='aircon400-recirculation-label';
   node.textContent=item.text;node.dataset.airconLabel=item.text;
   const rect=g.rect(item.rect);
   fit(node,rect);
   node.style.fontSize=Math.max(8,Math.round(rect.h*.50))+'px';
   layer.append(node);
  }
 }
 function addLeft(g,right){
  const point=g.point(m.switches[0].sourcePoint);
  // Reuse the approved physical toggle artwork/size, not a new unrelated switch.
  left=right.cloneNode(true);
  left.id='toggle-recirc-fan-l-400';left.dataset.control='recirc-fan-l';
  left.classList.add('aircon400-left-recirculation');left.dataset.visualFamily='Small';
  left.title='L RECIRC FAN — OFF / AUTO';
  Object.assign(left.style,{left:point.x+'px',top:point.y+'px'});
  left.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();});
  left.addEventListener('pointerup',e=>{e.stopPropagation();});
  left.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setLeft(leftValue==='OFF'?'AUTO':'OFF');});
  left.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();setLeft(e.deltaY>0?'AUTO':'OFF');},{passive:false});
  left.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','Home','End',' ','Enter'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(['Home','ArrowUp'].includes(e.key))setLeft('OFF');
   else if(['End','ArrowDown'].includes(e.key))setLeft('AUTO');
   else setLeft(leftValue==='OFF'?'AUTO':'OFF');
  });
  layer.append(left);renderLeft();
 }
 function addPack(g,item){
  const node=document.createElement('span');node.className='aircon400-pack-face';
  node.dataset.airconPack=item.side;node.setAttribute('aria-label',item.side+' PACK caution');
  fit(node,g.rect(item.rect));
  for(const state of ['OFF','ON']){
   const img=document.createElement('img');img.src=asset('737-400-PACK_FITTED_'+state+'.svg');
   img.alt='';img.draggable=false;img.dataset.frame=state;node.append(img);
  }
  layer.append(node);packNodes.set(item.side,{node,item});
 }
 function paint(){
  if(!layer||family!=='B737-400')return;
  const output=window.B737OverheadLights?.getState();
  for(const {node,item} of packNodes.values()){
   const state=output?.frames?.[item.legacyId]==='ON'?'ON':'OFF';
   node.dataset.state=state;
   for(const img of node.querySelectorAll('img'))img.classList.toggle('active',img.dataset.frame===state);
  }
  const togglesHidden=document.getElementById('overheadToggleLayer')?.classList.contains('hidden');
  const lightsHidden=document.getElementById('overheadLightLayer')?.classList.contains('hidden');
  if(left)left.style.visibility=togglesHidden?'hidden':'visible';
  for(const {node} of packNodes.values())node.style.visibility=lightsHidden?'hidden':'visible';
 }
 function mount(){
  const next=host.querySelector('.atlas-piece[data-key="OH21"]');
  const right=document.getElementById('toggle-recirc-fan');
  if(!next||!right||!window.B737OverheadLights||!window.B737OverheadToggles)return false;
  if(layer?.isConnected&&plate===next)return true;
  plate=next;layer?.remove();left=null;packNodes=new Map();
  layer=document.createElement('div');layer.id='aircon400Oh21Overlay';
  layer.className='aircon400-oh21-layer';
  const g=m.geometry(absolutePlacement(plate));
  addLabels(g);addLeft(g,right);for(const p of m.packs)addPack(g,p);
  host.append(layer);
  applyFamily(family);
  return true;
 }
 function applyFamily(value){
  family=m.variant(value);
  if(layer)layer.hidden=family!=='B737-400';
  window.B737OverheadLights?.setAircraftFamily?.(family);
  if(family==='B737-400'){
   window.B737OverheadLights?.setAircon400LeftRecirc?.(leftValue);
   paint();
  }
 }
 function boot(){
  applyFamily(storedFamily());
  if(mount())return;
  const watch=new MutationObserver(()=>{if(mount())watch.disconnect();});
  watch.observe(host,{childList:true,subtree:true});
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;
  if(e.data.action==='aircon-background')applyFamily(e.data.family);
 });
 window.addEventListener('storage',e=>{if(e.key===PROFILE_KEY)applyFamily(storedFamily());});
 window.addEventListener('b737:overhead-light-state',paint);
 window.addEventListener('b737:switch-change',e=>{if(e.detail?.id==='recirc-fan')paint();});
 for(const id of ['toggleVisibility','lightVisibility'])
  document.getElementById(id)?.addEventListener('change',()=>queueMicrotask(paint));
 document.getElementById('resetToggles')?.addEventListener('click',()=>{
  setLeft('AUTO','reset');queueMicrotask(paint);
 });
 window.B737Aircon400Oh21=Object.freeze({
  getState:()=>({family,left:leftValue,right:window.B737OverheadToggles?.getState()?.['recirc-fan']??null,
   lamps:Object.fromEntries([...packNodes].map(([side,{node}])=>[side,node.dataset.state]))}),
  switchFamily:applyFamily,setLeft
 });
 boot();
})();
