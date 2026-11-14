/* LE-SMOOTHGLASS-0001 — Visual-only smooth annunciator glass for the
 * 26 already-mounted and owner-locked LE DEVICES optical lenses.
 * NO replacement of the actual photo, input paths, timing or sensor model.
 */
(function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const selector='svg.b737-le-photolens-v2';
 const mounted=new WeakSet();
 let serial=0;
 const make=(tag,attrs={})=>{
  const el=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));
  return el;
 };
 const palette={
  amber:[
   ['0%','#fff7d6'],['15%','#ffe5a0'],
   ['34%','#ffcc66'],['65%','#c78027'],
   ['100%','#593a15']
  ],
  green:[
   ['0%','#e5ffe3'],['15%','#b3f5b8'],
   ['34%','#69d78b'],['65%','#218a4d'],
   ['100%','#103c28']
  ]
 };
 function createRadial(defs,id,stops){
  const gradient=make('radialGradient',{id,cx:'50%',cy:'43%',r:'74%',fx:'50%',fy:'38%'});
  stops.forEach(([offset,color])=>gradient.append(make('stop',{offset,'stop-color':color,'stop-opacity':'1'})));
  defs.append(gradient);
 }
 function createSheen(defs,id){
  const gradient=make('linearGradient',{id,x1:'10%',y1:'0%',x2:'86%',y2:'100%'});
  [['0%','#fffdf1','.20'],['22%','#ffffff','.09'],['48%','#ffffff','.015'],['100%','#ffffff','0']].forEach(
   ([offset,color,alpha])=>gradient.append(make('stop',{offset,'stop-color':color,'stop-opacity':alpha}))
  );
  defs.append(gradient);
 }
 function mount(lens){
  if(mounted.has(lens)||!lens.isConnected)return;
  const groups=[...lens.querySelectorAll('g[data-lens-id]')];
  if(groups.length!==26)return;
  const definitions=lens.querySelector('defs');
  if(!definitions)return;
  const prefix='lesmooth'+(++serial)+'-';
  createRadial(definitions,prefix+'a',palette.amber);
  createRadial(definitions,prefix+'g',palette.green);
  createSheen(definitions,prefix+'s');
  for(const group of groups){
   const children=[...group.children].filter(el=>el.localName==='path');
   if(children.length!==2&&children.length!==3)return;
   // V3 owner-authorized optical correction adds a permanent OFF glass path.
   // Keep dark glass untouched; only recolor live face and its reflection.
   const [face,sheen]=children.length===3?children.slice(1):children;
   const amber=group.getAttribute('data-lens-id')?.endsWith('|TRANSIT');
   face.setAttribute('fill','url(#'+prefix+(amber?'a':'g')+')');
   sheen.setAttribute('fill','url(#'+prefix+'s)');
  }
  lens.classList.add('b737-le-smooth-glass-v1');
  lens.setAttribute('data-glass-version','LE-SMOOTHGLASS-0001');
  mounted.add(lens);
 }
 function scan(){document.querySelectorAll(selector).forEach(mount);}
 function mountAdded(node){
  if(node?.nodeType!==1)return;
  if(node.matches?.(selector))mount(node);
  node.querySelectorAll?.(selector).forEach(mount);
 }
 function boot(){
  scan();
  const observer=new MutationObserver(records=>{
   for(const record of records)for(const node of record.addedNodes)mountAdded(node);
  });
  observer.observe(document.body||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('b737:cockpit-mounted',scan);
 }
 window.B737LESmoothGlassV1=Object.freeze({
  version:'LE-SMOOTHGLASS-0001',
  refresh:scan,
  status:()=>[...document.querySelectorAll(selector)].map(lens=>({
   mounted:lens.classList.contains('b737-le-smooth-glass-v1'),
   windows:lens.querySelectorAll('g[data-lens-id]').length
  }))
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
