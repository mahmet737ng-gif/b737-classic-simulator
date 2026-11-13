/* BUSLAB-SCHEMATIC-0001 — first interactive MRG-style topology test view.
   Reuses the authoritative isolated Bus Test Lab session and MRG consumer index.
   The SOURCE links are generic training dependencies, not a certified EP-FSI WDM. */
(function(win){
'use strict';
const NS='http://www.w3.org/2000/svg',ID='b737BusSchematicV1';
const coords={
 'external@115VAC':[85,50], 'generator1@115VAC':[485,50],
 'generator2@115VAC':[985,50], 'battery@28VDC':[1370,50],
 'groundService@115VAC':[85,225],
 'main1@115VAC':[325,340], 'generator1@115VAC':[485,50],
 'transfer1@115VAC':[610,340], 'transfer2@115VAC':[875,340],
 'main2@115VAC':[1145,340],
 'hotBattery@28VDC':[1370,225], 'switchedHotBattery@28VDC':[1370,365],
 'groundService@28VAC':[85,380],
 'main1@28VAC':[325,500],
 'electronic1@115VAC':[515,500],
 'transfer1@28VAC':[700,500],
 'transfer2@28VAC':[885,500],
 'electronic2@115VAC':[1070,500],
 'main2@28VAC':[1255,500],
 'dc1@28VDC':[645,662], 'dc2@28VDC':[895,662],
 'electronic1@28VDC':[390,815],
 'electronic2@28VDC':[1135,815],
 'standby@115VAC':[645,935], 'standby@28VDC':[895,935]
};
const labels={
 generator1:'GENERATOR BUS 1',generator2:'GENERATOR BUS 2',main1:'MAIN BUS 1',main2:'MAIN BUS 2',
 transfer1:'TRANSFER BUS 1',transfer2:'TRANSFER BUS 2',external:'EXTERNAL AC BUS',
 groundService:'GROUND SERVICE BUS',battery:'BATTERY BUS',hotBattery:'HOT BATTERY BUS',
 switchedHotBattery:'SWITCHED HOT BAT BUS',dc1:'DC BUS 1',dc2:'DC BUS 2',
 electronic1:'ELECTRONIC BUS 1',electronic2:'ELECTRONIC BUS 2',standby:'STANDBY BUS'
};
const panelName=k=>{
 const [bus,volts]=k.split('@');
 return (bus==='standby'?(volts==='115VAC'?'AC STANDBY BUS':'DC STANDBY BUS'):labels[bus])||k;
};
const elt=(tag,parent,text,cls)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==undefined&&text!==null)e.textContent=text;
 parent?.append(e);return e;
};
const svg=(tag,parent,attrs)=>{
 const e=document.createElementNS(NS,tag);
 for(const [k,v]of Object.entries(attrs||{}))e.setAttribute(k,String(v));
 parent?.append(e);return e;
};
let api=null,selected=null,nodes=new Map(),lines=[],graph,affected,totals,selectedInfo,updating=false;
const POWER=['OFF','DEGRADED','UNKNOWN'];
function position(key){const p=coords[key];if(!p)throw Error('Missing MRG schematic node: '+key);return p;}
function draw(){
 const source=win.B737BusConsumerTestLabV1?.SOURCE;
 if(!source||!api)throw Error('Bus topology session unavailable');
 const keys=api.listBusNames(),parents=Object.keys(source);
 if(keys.length!==24||parents.length!==24||keys.some(k=>!source[k]||!coords[k]))
  throw Error('Schematic bus list must cover all 24 lab power classes');
 const section=elt('section',document.querySelector('.metrics'),null,'bus-schematic-panel');
 section.id=ID;
 // A section cannot live inside the metric grid: move directly after it.
 document.querySelector('.metrics').after(section);
 const head=elt('div',section,null,'schematic-heading');
 const text=elt('div',head);
 elt('h2',text,'ATA 24 · ELECTRICAL BUS SCHEMATIC','schematic-title');
 elt('p',text,'MRG IV.6 · diagrammatic laboratory view · click a bus to interrupt / restore its feed');
 const actions=elt('div',head,null,'schematic-actions');
 const btn=elt('button',actions,'RESTORE ALL','schematic-reset');btn.type='button';
 btn.addEventListener('click',()=>{document.getElementById('allOn')?.click();});
 const body=elt('div',section,null,'schematic-body');
 const scroller=elt('div',body,null,'schematic-scroll');
 graph=svg('svg',scroller,{viewBox:'0 0 1630 1050',role:'img','aria-label':'Interactive 737 Classic electrical bus distribution schematic','preserveAspectRatio':'xMidYMin meet'});
 const defs=svg('defs',graph);
 const arrow=svg('marker',defs,{id:'busSchematicArrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});
 svg('path',arrow,{d:'M 0 0 L 10 5 L 0 10 Z',fill:'#577588'});
 const edgeLayer=svg('g',graph,{'class':'schematic-edges'});
 const nodeLayer=svg('g',graph,{'class':'schematic-nodes'});
 // Draw exact SOURCE links: transfer alternate feeds remain alternatives, not forced single feeders.
 for(const [child,feeds] of Object.entries(source)){
  for(const from of feeds){
   const [sx,sy]=position(from),[dx,dy]=position(child);
   const x1=sx+83,y1=sy+60,x2=dx+83,y2=dy;
   const cy=y1+(y2-y1)*.54;
   const d=Math.abs(x2-x1)<12?('M '+x1+' '+y1+' L '+x2+' '+y2):
    ('M '+x1+' '+y1+' C '+x1+' '+cy+' '+x2+' '+cy+' '+x2+' '+y2);
   const path=svg('path',edgeLayer,{d,'class':'schematic-edge','marker-end':'url(#busSchematicArrow)','data-from':from,'data-to':child});
   lines.push({from,to:child,node:path});
  }
 }
 for(const key of keys){
  const [x,y]=position(key),grp=svg('g',nodeLayer,{transform:'translate('+x+' '+y+')','class':'schematic-node','data-bus-key':key,role:'button',tabindex:0,
   'aria-label':panelName(key)+' '+key.split('@')[1]+' toggle simulated power'});
  svg('rect',grp,{x:0,y:0,width:166,height:60,rx:9});
  const n=svg('text',grp,{x:83,y:21,'text-anchor':'middle','class':'schematic-node-name'});
  n.textContent=panelName(key);
  const voltage=svg('text',grp,{x:83,y:40,'text-anchor':'middle','class':'schematic-node-voltage'});
  voltage.textContent=key.split('@')[1].replace('VAC',' V AC').replace('VDC',' V DC');
  const state=svg('text',grp,{x:83,y:53,'text-anchor':'middle','class':'schematic-node-state'});
  grp.addEventListener('click',()=>clickBus(key));
  grp.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();clickBus(key);}});
  nodes.set(key,{grp,state});
 }
 const side=elt('aside',body,null,'schematic-affected');
 elt('h3',side,'Affected consumers / systems');
 totals=elt('p',side,'','schematic-totals');
 selectedInfo=elt('p',side,'Select a bus to inspect its failure and downstream effects.','schematic-selection');
 affected=elt('div',side,null,'schematic-affected-list');
 elt('p',section,'Training topology only: dual feeders are evaluated by the existing Cascade engine. Red = no supply, blue = powered, amber = affected device channel. This is not an airframe-specific wiring diagram.','schematic-disclaimer');
}
function clickBus(key){
 if(!api||updating)return;
 selected=key;
 // Do not enable an independently isolated downstream bus while its source remains failed.
 const session=api.getSession(),state=session.busStates;
 if(state[key]===false&&!session.disabled.includes(key)){
  selectedInfo.textContent=panelName(key)+' — upstream power is unavailable. Restore its source first.';
  render();return;
 }
 try{api.toggleBus(key);render();}
 catch(e){selectedInfo.textContent=String(e.message||e);}
}
function render(){
 if(!api||!nodes.size)return;
 const session=api.getSession(),power=session.busStates,forced=new Set(session.disabled);
 for(const [k,node]of nodes){
  node.grp.dataset.power=power[k]===true?'ON':'OFF';
  node.grp.dataset.forced=String(forced.has(k));
  node.grp.dataset.selected=String(selected===k);
  node.grp.setAttribute('aria-pressed',String(power[k]===true));
  node.state.textContent=power[k]===true?'● POWERED':forced.has(k)?'● INJECTED OFF':'● CASCADE OFF';
 }
 for(const l of lines)l.node.dataset.selected=String(l.from===selected||l.to===selected);
 const snapshot=api.getSnapshot();
 const allDevices=Object.values(snapshot.devices||{});
 const impacted=allDevices.filter(d=>POWER.includes(d.state));
 const off=impacted.filter(d=>d.state==='OFF').length;
 const limited=impacted.length-off;
 const cascaded=Object.keys(power).filter(k=>power[k]===false&&!forced.has(k)).length;
 totals.textContent=forced.size+' direct OFF · '+cascaded+' downstream OFF · '+off+' devices OFF · '+limited+' degraded/unknown';
 if(selected){
  const state=power[selected]?'POWERED':forced.has(selected)?'DIRECTLY INTERRUPTED':'DOWNSTREAM POWER LOST';
  selectedInfo.textContent=panelName(selected)+' · '+selected.split('@')[1]+' · '+state;
 }else selectedInfo.textContent='All affected devices are listed below; select any bus to highlight its connections.';
 const fragment=document.createDocumentFragment();
 if(!impacted.length)elt('p',fragment,'No consumers have lost power in the current lab scenario.','schematic-empty');
 const grouped=new Map();
 for(const d of impacted){
  if(!grouped.has(d.system))grouped.set(d.system,[]);
  grouped.get(d.system).push(d);
 }
 for(const [system,devices]of [...grouped].sort((a,b)=>a[0].localeCompare(b[0]))){
  const block=elt('section',fragment,null,'schematic-system');
  elt('h4',block,system+'  ('+devices.length+')');
  for(const d of devices){
   const item=elt('div',block,null,'schematic-device');
   item.dataset.power=d.state;
   elt('b',item,d.displayName||d.name);
   elt('span',item,d.state==='OFF'?'NO POWER':d.state);
  }
 }
 affected.replaceChildren(fragment);
}
function ready(){
 if(api)return;
 api=win.B737BusConsumerTestLabUIV1;
 if(!api)return;
 const s=api.getSession();
 // A schematic is intended to show actual dependencies, unlike the default
 // independent lab toggle mode. This changes only the isolated test session.
 if(!s.cascade){document.getElementById('cascadeSwitch').checked=true;api.setCascade(true);}
 draw();render();
}
win.addEventListener('b737:buslab-ui-ready',ready);
win.addEventListener('b737:buslab-updated',render);
if(win.B737BusConsumerTestLabUIV1)ready();
})(window);
