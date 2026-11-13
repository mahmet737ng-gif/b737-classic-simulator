/* MRG-CL-POWER-PLATE-0001
   Interactive vector redraw of the user-supplied MRG IV.6 p.152 figure.
   Layout, legend, and wire routing are intentionally page-based (616 x 850).
   Bus toggles reuse the existing Bus Test Lab cascade/consumer engine.
   Relay symbols animate from derived lab supply states; selectable power
   sources and actual aircraft contactor positions are NOT invented. */
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg';
const VERSION='MRG-CL-POWER-PLATE-0001';
const $=id=>document.getElementById(id);
let lab=null,figure=null,summary=null,affected=null,selectedInfo=null;
let selected=null,wireNodes=new Map(),busNodes=new Map(),contactNodes=new Map();
const BUS={
 'external@115VAC':{x:79,y:133,w:76,h:20,color:'service',lines:['115V AC','EXTERNAL BUS']},
 'generator1@115VAC':{x:126,y:242,w:192,h:21,color:'generator',lines:['115V AC','GENERATOR BUS 1']},
 'generator2@115VAC':{x:371,y:242,w:179,h:21,color:'generator',lines:['115V AC','GENERATOR BUS 2']},
 'main1@115VAC':{x:149,y:343,w:69,h:21,color:'main',lines:['115V AC','MAIN BUS 1']},
 'main2@115VAC':{x:480,y:343,w:70,h:21,color:'main',lines:['115V AC','MAIN BUS 2']},
 'transfer1@115VAC':{x:224,y:343,w:101,h:21,color:'transfer',lines:['115V AC','TRANSFER BUS 1']},
 'transfer2@115VAC':{x:367,y:343,w:101,h:21,color:'transfer',lines:['115V AC','TRANSFER BUS 2']},
 'groundService@115VAC':{x:79,y:377,w:68,h:21,color:'service',lines:['115V AC','GND SVCE BUS']},
 'main1@28VAC':{x:162,y:377,w:57,h:20,color:'main',lines:['28V AC','MAIN BUS 1']},
 'main2@28VAC':{x:466,y:377,w:54,h:20,color:'main',lines:['28V AC','MAIN BUS 2']},
 'transfer1@28VAC':{x:256,y:377,w:81,h:20,color:'transfer',lines:['28V AC','TRANSFER BUS 1']},
 'transfer2@28VAC':{x:358,y:377,w:76,h:20,color:'transfer',lines:['28V AC','TRANSFER BUS 2']},
 'groundService@28VAC':{x:128,y:410,w:68,h:20,color:'service',lines:['28V AC','GND SVCE BUS']},
 'electronic1@115VAC':{x:258,y:410,w:78,h:20,color:'transfer',lines:['115V AC','ELECTRONIC BUS 1']},
 'electronic2@115VAC':{x:356,y:410,w:79,h:20,color:'transfer',lines:['115V AC','ELECTRONIC BUS 2']},
 'dc1@28VDC':{x:210,y:519,w:62,h:21,color:'dc',lines:['28V DC','BUS 1']},
 'dc2@28VDC':{x:420,y:519,w:64,h:21,color:'dc',lines:['28V DC','BUS 2']},
 'electronic1@28VDC':{x:259,y:554,w:77,h:20,color:'dc',lines:['28V DC','ELECTRONIC BUS 1']},
 'electronic2@28VDC':{x:356,y:554,w:77,h:20,color:'dc',lines:['28V DC','ELECTRONIC BUS 2']},
 'standby@115VAC':{x:135,y:617,w:63,h:22,color:'battery',lines:['115V AC','STANDBY BUS']},
 'standby@28VDC':{x:217,y:617,w:63,h:22,color:'battery',lines:['28V DC','STANDBY BUS']},
 'battery@28VDC':{x:356,y:596,w:78,h:21,color:'battery',lines:['28V DC','BATTERY BUS']},
 'hotBattery@28VDC':{x:355,y:669,w:78,h:21,color:'battery',lines:['28V DC','HOT BATTERY BUS']},
 'switchedHotBattery@28VDC':{x:446,y:732,w:89,h:22,color:'battery',lines:['28V DC','SWITCH HOT BAT BUS']}
};
const CAT=['ENGINE_INDICATION','AVIONICS','FUEL','ELECTRICAL'];
const make=(tag,parent,cls,content)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(content!==undefined)e.textContent=content;
 parent?.append(e);return e;
};
function s(tag,parent,props={},text=null){
 const el=document.createElementNS(NS,tag);
 for(const [key,value]of Object.entries(props))el.setAttribute(key,String(value));
 if(text!==null)el.textContent=text;
 parent?.append(el);return el;
}
function line(parent,x1,y1,x2,y2,props={}){
 return s('path',parent,{d:'M'+x1+' '+y1+' L'+x2+' '+y2,class:'mrg-wire',...props});
}
function wire(parent,d,opts={}){
 const n=s('path',parent,{d,class:'mrg-wire',...opts});
 if(opts['data-bus']){const id=opts['data-bus'];if(!wireNodes.has(id))wireNodes.set(id,[]);wireNodes.get(id).push(n);}
 return n;
}
function dot(parent,x,y,r=1.35){return s('circle',parent,{cx:x,cy:y,r,fill:'#272727'});}
function text(parent,x,y,t,size=8,opts={}){
 return s('text',parent,{x,y,class:'mrg-text',style:'font-size:'+size+'px',...opts},t);
}
function pair(parent,x,y,a,b,size=7.5){
 const t=s('text',parent,{x,y,'text-anchor':'middle',class:'mrg-text',style:'font-size:'+size+'px;font-weight:650'});
 s('tspan',t,{x,dy:0},a);s('tspan',t,{x,dy:size*.99},b);
 return t;
}
function rect(parent,x,y,w,h,cls='mrg-box',attrs={}){
 return s('rect',parent,{x,y,width:w,height:h,rx:1,class:cls,...attrs});
}
function hatch(def){
 const p=s('pattern',def,{id:'mrg-crosshatch',patternUnits:'userSpaceOnUse',width:6,height:6});
 s('path',p,{d:'M0 0 L6 6 M6 0 L0 6',stroke:'#555', 'stroke-width':.45,opacity:.7,fill:'none'});
}
function drawContact(parent,id,x,y,{orientation='vertical',label='',closed=null}={}){
 const g=s('g',parent,{class:'mrg-contact',transform:'translate('+x+' '+y+')','data-contact':id,tabindex:0,role:'img'});
 const mark=orientation==='horizontal'?s('g',g,{transform:'rotate(-90)'}):g;
 s('circle',mark,{cx:0,cy:-9,r:1.65,fill:'#fff',stroke:'#333','stroke-width':.75});
 s('circle',mark,{cx:0,cy:9,r:1.65,fill:'#fff',stroke:'#333','stroke-width':.75});
 s('path',mark,{d:'M0 9 L0 -6',class:'mrg-contact-blade'});
 if(label)text(parent,x+6,y+2,label,7,{'text-anchor':'start'});
 contactNodes.set(id,{g,blade:mark.querySelector('.mrg-contact-blade'),defaultClosed:closed});
 return g;
}
function plain(parent){
 // Paper and page title, scanned schematic format; no rewritten graph layout.
 rect(parent,0,0,616,850,'mrg-paper');
 line(parent,49,50,141,50);
 rect(parent,141,39,334,24,'mrg-header-box');
 rect(parent,144,42,328,18,'mrg-header-inner');
 text(parent,308,55,'ELECTRICAL POWER SCHEMATIC',13,{'text-anchor':'middle',style:'font-size:13px;font-weight:800'});
 line(parent,475,50,488,50);rect(parent,488,43,69,14,'mrg-header-box');
 text(parent,522,53,'CL',10,{'text-anchor':'middle'});
 line(parent,557,50,568,50);
 // Drawing frame and bottom footer.
 line(parent,90,800,545,800,{'stroke-dasharray':'6 4',opacity:.4});
 line(parent,90,799,90,646,{'stroke-dasharray':'6 4',opacity:.5});
 line(parent,545,799,545,447,{'stroke-dasharray':'6 4',opacity:.5});
 line(parent,90,834,545,834);
 text(parent,97,845,'152 - Electrical',9,{style:'font-style:italic;font-size:9px'});
 text(parent,303,845,'IV.6',9,{style:'font-style:italic;font-size:9px','text-anchor':'middle'});
 text(parent,541,845,'www.b737mrg.net',9,{'text-anchor':'end',style:'font-size:9px;font-style:italic'});
}
function linesLayer(parent){
 const g=s('g',parent,{class:'mrg-wiring'});
 // Source leads, upper section including receptacle, APU generator and two engines.
 wire(g,'M116 133 L116 115 L320 115',{'data-bus':'external@115VAC'});
 wire(g,'M350 132 V143 H458 V164',{'data-bus':'external@115VAC'});
 wire(g,'M350 132 V143 H197 V164',{'data-bus':'external@115VAC'});
 wire(g,'M116 153 V297 H120');
 wire(g,'M143 195 V205 H136 V242',{'data-bus':'generator1@115VAC'});
 wire(g,'M151 195 V218 H260 V242',{'data-bus':'generator1@115VAC'});
 wire(g,'M519 195 V210 H519 V242',{'data-bus':'generator2@115VAC'});
 wire(g,'M296 186 V200 H257 V209',{'data-bus':'generator1@115VAC'});
 wire(g,'M319 184 V200 H397 V209',{'data-bus':'generator2@115VAC'});
 wire(g,'M257 222 V242');wire(g,'M397 222 V242');
 // Top APU shared generator bus contactor network.
 wire(g,'M319 184 H319 V200');
 wire(g,'M319 198 H257');wire(g,'M319 198 H397');
 // Generator bus to main, transfer, alternate electronic AC and TR rectifiers.
 wire(g,'M184 263 V343',{'data-bus':'main1@115VAC'});
 wire(g,'M512 263 V343',{'data-bus':'main2@115VAC'});
 wire(g,'M241 263 V288 H274 V343',{'data-bus':'transfer1@115VAC'});
 wire(g,'M419 263 V288 H418 V343',{'data-bus':'transfer2@115VAC'});
 // Crossing bus transfer route, crossing without connection unless marked.
 wire(g,'M271 288 H332 L351 278 L369 288 H420',{'data-bus':'transfer1@115VAC'});
 wire(g,'M419 288 H351 L332 278 H271',{'data-bus':'transfer2@115VAC'});
 // Ground service bus and converter branches
 wire(g,'M116 297 V339 H131 V377',{'data-bus':'groundService@115VAC'});
 wire(g,'M184 364 V377',{'data-bus':'main1@28VAC'});
 wire(g,'M512 364 V377',{'data-bus':'main2@28VAC'});
 wire(g,'M275 364 V377',{'data-bus':'transfer1@28VAC'});
 wire(g,'M416 364 V377',{'data-bus':'transfer2@28VAC'});
 wire(g,'M112 398 V440 H152 V410',{'data-bus':'groundService@28VAC'});
 wire(g,'M283 398 V410',{'data-bus':'electronic1@115VAC'});
 wire(g,'M396 398 V410',{'data-bus':'electronic2@115VAC'});
 // Rectifier 1 / 2 / 3 feeds and cross-tie (MRG IV.6 physical geometry).
 wire(g,'M242 398 V455',{'data-bus':'transfer1@115VAC'});
 wire(g,'M452 398 V455',{'data-bus':'transfer2@115VAC'});
 wire(g,'M526 397 V455',{'data-bus':'main2@115VAC'});
 wire(g,'M242 484 V519',{'data-bus':'dc1@28VDC'});
 wire(g,'M452 484 V519',{'data-bus':'dc2@28VDC'});
 wire(g,'M526 485 V496 H452');
 wire(g,'M242 497 H527',{'data-bus':'dc1@28VDC'});
 wire(g,'M242 540 V560 H259',{'data-bus':'electronic1@28VDC'});
 wire(g,'M452 540 V560 H433',{'data-bus':'electronic2@28VDC'});
 // Main 1 backup for ground service and APU supply.
 wire(g,'M184 364 V403 H141 V410');
 wire(g,'M160 430 V711 H205',{'data-bus':'groundService@28VAC'});
 // AC standby and DC standby electrical power.
 wire(g,'M242 540 H166 V606',{'data-bus':'standby@115VAC'});
 wire(g,'M242 540 H247 V606',{'data-bus':'standby@28VDC'});
 wire(g,'M166 606 V617',{'data-bus':'standby@115VAC'});
 wire(g,'M247 606 V617',{'data-bus':'standby@28VDC'});
 wire(g,'M166 639 V649 H302',{'data-bus':'standby@115VAC'});
 wire(g,'M247 639 V650 H302',{'data-bus':'standby@28VDC'});
 wire(g,'M316 650 V634');wire(g,'M332 649 H355 V606',{'data-bus':'battery@28VDC'});
 // 28V battery, hot battery, and switched hot battery branches.
 wire(g,'M452 540 V568 H395 V596',{'data-bus':'battery@28VDC'});
 wire(g,'M395 616 V669',{'data-bus':'battery@28VDC'});
 wire(g,'M395 690 V732 H450',{'data-bus':'switchedHotBattery@28VDC'});
 wire(g,'M433 606 H526 V480',{'data-bus':'battery@28VDC'});
 wire(g,'M446 606 H526 V497',{'data-bus':'battery@28VDC'});
 wire(g,'M488 753 V740 H433',{'data-bus':'switchedHotBattery@28VDC'});
 // Battery charger circuit, APU starter and charging inputs (lower dashed zone)
 wire(g,'M116 397 V718 H120 V760 H205');
 wire(g,'M242 719 H280 V728 H355',{'data-bus':'hotBattery@28VDC'});
 wire(g,'M174 676 H205 V719');
 wire(g,'M174 699 V760 H205',{'data-bus':'hotBattery@28VDC'});
 wire(g,'M242 731 V740 H314 V771 H350',{'data-bus':'hotBattery@28VDC'});
 wire(g,'M332 650 V689');
 wire(g,'M166 771 H205');wire(g,'M166 771 V799',{'data-bus':'hotBattery@28VDC'});
 wire(g,'M395 754 V770 H409',{'data-bus':'hotBattery@28VDC'});
 // Small connection / terminals; located at actual wire intersections.
 [[116,297],[184,364],[242,497],[452,497],[526,497],[332,650],[395,690],[242,719],[280,728],[395,732],[166,771]].forEach(([x,y])=>dot(g,x,y));
 // Diode and arrow symbols.
 wire(g,'M483 496 L490 492 V500 Z',{'class':'mrg-wire mrg-diode'});line(g,491,490,491,502);
 s('path',g,{d:'M240 455 L232 447 L248 447 Z',class:'mrg-geometry'});
 s('path',g,{d:'M452 455 L444 447 L460 447 Z',class:'mrg-geometry'});
 s('path',g,{d:'M526 455 L518 447 L534 447 Z',class:'mrg-geometry'});
 s('path',g,{d:'M242 518 L235 510 L249 510 Z',class:'mrg-geometry'});
 s('path',g,{d:'M452 518 L445 510 L459 510 Z',class:'mrg-geometry'});
 s('path',g,{d:'M126 377 L119 369 L133 369 Z',class:'mrg-geometry'});
 text(g,445,477,'TR2',7,{'text-anchor':'middle'});
}
function components(parent){
 const c=s('g',parent,{class:'mrg-components'});
 // Rectangular external AC receptacle and source rectangles.
 rect(c,320,105,63,27,'mrg-outline');
 pair(c,351,116,'EXTERNAL AC','RECEPTACLE',8);
 rect(c,114,167,16,33,'mrg-metal');rect(c,130,164,27,31,'mrg-metal');
 rect(c,157,169,16,22,'mrg-metal');
 text(c,143,185,'GEN',8,{'text-anchor':'middle'});text(c,165,184,'1',9,{'text-anchor':'middle'});
 rect(c,288,163,20,20,'mrg-metal');rect(c,308,158,24,26,'mrg-metal');
 text(c,298,176,'APU',8,{'text-anchor':'middle'});text(c,320,173,'GEN',8,{'text-anchor':'middle'});
 rect(c,486,169,21,21,'mrg-metal');rect(c,507,163,24,33,'mrg-metal');
 text(c,495,181,'2',8,{'text-anchor':'middle'});text(c,519,183,'GEN',8,{'text-anchor':'middle'});
 for(let i=0;i<6;i++){line(c,110,168+i*4,116,168+i*4);line(c,532,170+i*4,538,170+i*4);}
 // Third-order current path contactors. Open/closed visual is state-driven.
 drawContact(c,'GB1',136,210,{label:'GB1'});
 drawContact(c,'GEN1_EXTERNAL',197,210);
 drawContact(c,'GEN1_APU',257,210);
 drawContact(c,'GEN2_APU',397,210);
 drawContact(c,'GEN2_EXTERNAL',458,210);
 drawContact(c,'GB2',519,210,{label:'GB2'});
 drawContact(c,'GROUND_SVC',132,302,{label:'GND SVCE'});
 drawContact(c,'R3',274,300,{label:'R3'});
 drawContact(c,'R4',419,300,{label:'R4'});
 text(c,229,309,'BUS XFR',7);
 text(c,439,309,'BUS XFR',7);
 // Actual AC/DC transformer rectifier symbols and inverse label.
 const device=(x,y,label)=>{
  rect(c,x,y,26,28,'mrg-transformer');
  line(c,x+3,y+25,x+22,y+3,{'class':'mrg-transformer-slash'});
  text(c,x+13,y+16,label,8,{'text-anchor':'middle'});
 };
 device(229,457,'TR1');device(439,457,'TR2');device(513,457,'TR3');
 text(c,312,504,'BUS XFR',7,{'text-anchor':'middle'});
 text(c,312,513,'TR3',7,{'text-anchor':'middle'});
 pair(c,312,519,'DISCONNECT','RELAY',7);
 text(c,319,529,'R9',7,{'text-anchor':'middle'});
 drawContact(c,'R9',348,498,{orientation:'horizontal'});
 // Stby relays and diode inputs.
 drawContact(c,'R37_AC',166,599);
 drawContact(c,'R37_DC',247,599);
 text(c,145,593,'STBY',8);text(c,144,600,'PWR',8);
 text(c,225,593,'STBY',8);text(c,225,600,'PWR',8);
 text(c,184,602,'R37',7);text(c,264,602,'R37',7);
 rect(c,302,634,29,30,'mrg-transformer');
 line(c,306,660,328,640,{'class':'mrg-transformer-slash'});
 text(c,316,652,'INV',8,{'text-anchor':'middle'});
 drawContact(c,'R2',442,606,{orientation:'horizontal',label:'R2'});
 drawContact(c,'R1',395,650,{label:'R1'});
 drawContact(c,'R41',437,744,{orientation:'horizontal',label:'R41'});
 text(c,461,597,'BATTERY',8);
 text(c,401,655,'BATTERY',8);
 // Dashed battery APU sub-schematic boundary, AC/DC rectacles and batteries.
 const zone=rect(c,88,646,454,153,'mrg-boundary');
 zone.setAttribute('fill','none');
 rect(c,137,658,39,38,'mrg-hatched');
 pair(c,156,675,'APU','BATTERY',8);
 rect(c,206,708,39,24,'mrg-transformer');
 pair(c,226,719,'BAT','CHARGER',7.5);
 rect(c,136,747,40,24,'mrg-transformer');pair(c,156,758,'APU BAT','CHARGER',7.5);
 rect(c,272,754,65,29,'mrg-outline');
 pair(c,304,767,'EXTERNAL DC','RECEPTACLE',8);
 rect(c,350,753,60,32,'mrg-hatched');
 pair(c,380,769,'24V DC','NiCd BATTERY',7.5);
 text(c,181,663,'AUXILIARY',7);text(c,181,672,'APU BATTERY',7);
 text(c,181,682,'(As installed)',7);
 text(c,327,703,'APU',8);text(c,326,711,'STARTER',8);
 text(c,109,706,'APU BAT',7);text(c,109,713,'CHGR XFR',7);
 text(c,409,731,'BATTERY',7);
 text(c,177,777,'R89',7);text(c,242,771,'BUS XFR',7);
 // Hairline control switch symbols (only actual relay/contact driven nodes animate).
 drawContact(c,'APU_BAT_CHARGER',103,771);
 drawContact(c,'R89',224,768);
}
function addTiles(parent){
 const g=s('g',parent,{class:'mrg-bus-blocks'});
 for(const [key,b]of Object.entries(BUS)){
  const node=s('g',g,{class:'mrg-bus-node','data-key':key,'data-status':'ON',role:'button',tabindex:0,'aria-label':b.lines.join(' ')+' simulated bus power toggle'});
  rect(node,b.x,b.y,b.w,b.h,'mrg-bus-rect mrg-fill-'+b.color);
  const fs=b.w>140?8.6:b.w>95?7.4:b.w>74?7.15:6.7;
  const y=b.y+b.h/2-1;
  pair(node,b.x+b.w/2,y,b.lines[0],b.lines[1],fs);
  s('title',node,{},b.lines.join(' ')+' — tap to toggle isolated training power');
  node.addEventListener('click',()=>toggle(key));
  node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(key);}});
  busNodes.set(key,node);
 }
}
function createScene(){
 const panel=make('section',null,'mrg-plate-section');
 panel.id='mrgElectricalPowerPlateV2';
 const heading=make('div',panel,'mrg-plate-heading');
 const left=make('div',heading);
 make('h2',left,null,'MRG IV.6 · ELECTRICAL POWER SCHEMATIC');
 make('p',left,null,'Vector redraw · source-geometry matched · tap a colored bus to simulate an interruption');
 const acts=make('div',heading,'mrg-plate-actions');
 const restore=make('button',acts,null,'RESTORE ALL');
 restore.addEventListener('click',()=>document.getElementById('allOn')?.click());
 const change=make('button',acts,null,'RESET TEST');
 change.addEventListener('click',()=>document.getElementById('resetLab')?.click());
 const grid=make('div',panel,'mrg-plate-layout');
 const holder=make('div',grid,'mrg-sheet-holder');
 figure=s('svg',holder,{viewBox:'0 0 616 850',xmlns:NS,'aria-label':'Boeing 737 Classic electrical power schematic vector redraw from supplied MRG reference',role:'img',preserveAspectRatio:'xMidYMin meet'});
 const defs=s('defs',figure);
 hatch(defs);
 const paper=s('g',figure,{class:'mrg-art'});
 plain(paper);
 linesLayer(paper);
 components(paper);
 addTiles(paper);
 const aside=make('aside',grid,'mrg-affected');
 make('h3',aside,null,'AFFECTED SYSTEMS / CONSUMERS');
 summary=make('p',aside,'mrg-affected-count');
 selectedInfo=make('p',aside,'mrg-affected-selection');
 affected=make('div',aside,'mrg-affected-scroll');
 const foot=make('p',panel,'mrg-plate-note');
 foot.textContent='Source geometry: supplied MRG IV.6 page 152 (PDF page 161). Animated contact positions show the isolated LAB topology model, not verified EP-FSI physical contactor feedback. Source switching and aircraft-specific WDM remain separate.';
 const metrics=document.querySelector('.metrics');
 if(!metrics)throw Error('Bus Lab metrics host missing');
 metrics.after(panel);
}
function setContact(name,on,note=''){
 const item=contactNodes.get(name);if(!item)return;
 item.g.dataset.closed=on===null?'unverified':String(!!on);
 item.g.setAttribute('aria-label',name+' '+(on===null?'SOURCE SELECTION NOT MODELLED':on?'CONTACT CLOSED':'CONTACT OPEN'));
 let title=item.g.querySelector('title');
 if(!title)title=s('title',item.g);
 title.textContent=name+': '+(on===null?'UNVERIFIED SOURCE SELECTION':on?'CLOSED':'OPEN')+(note?' · '+note:'');
}
function updateContacts(power){
 const p=key=>power[key]===true;
 const one=p('generator1@115VAC'),two=p('generator2@115VAC');
 const x1=p('transfer1@115VAC'),x2=p('transfer2@115VAC');
 setContact('GB1',one);
 setContact('GB2',two);
 // Modelled source selection is not exposed by the generic lab; never fake
 // EXT / APU contactor operation based only on the availability of a bus.
 for(const id of ['GEN1_EXTERNAL','GEN2_EXTERNAL','GEN1_APU','GEN2_APU'])setContact(id,null);
 setContact('GROUND_SVC',p('groundService@115VAC')&&(one||p('external@115VAC')));
 setContact('R3',one&&x1,'GEN BUS 1 / TRANSFER 1 LAB SUPPLY');
 setContact('R4',two&&x2,'GEN BUS 2 / TRANSFER 2 LAB SUPPLY');
 const trBackup=two&&!p('dc1@28VDC')&&!p('dc2@28VDC');
 setContact('R9',trBackup,'TR3 backup is a training approximation');
 setContact('R37_AC',p('standby@115VAC')&&x1);
 setContact('R37_DC',p('standby@28VDC')&&p('dc1@28VDC'));
 setContact('R2',p('battery@28VDC')&&p('main2@115VAC'));
 setContact('R1',p('battery@28VDC')&&p('hotBattery@28VDC'));
 setContact('R41',p('switchedHotBattery@28VDC')&&p('hotBattery@28VDC'));
 setContact('APU_BAT_CHARGER',null);
 setContact('R89',null);
}
function render(){
 if(!lab||!figure)return;
 const session=lab.getSession(),power=session.busStates,cuts=new Set(session.disabled);
 for(const [key,node]of busNodes){
  const status=power[key]===true?'ON':cuts.has(key)?'CUT':'CASCADE';
  node.dataset.status=status;node.dataset.selected=String(key===selected);
  node.setAttribute('aria-pressed',String(power[key]===true));
 }
 for(const [key,paths]of wireNodes){
  for(const el of paths)el.dataset.power=power[key]===true?'ON':'OFF';
 }
 updateContacts(power);
 const snap=lab.getSnapshot();
 const devices=Object.values(snap.devices||{});
 const impacted=devices.filter(d=>['OFF','DEGRADED','UNKNOWN'].includes(d.state));
 const direct=cuts.size,downstream=Object.keys(power).filter(k=>power[k]===false&&!cuts.has(k)).length;
 const off=impacted.filter(d=>d.state==='OFF').length,partial=impacted.length-off;
 summary.textContent=direct+' DIRECT OFF   ·   '+downstream+' CASCADE OFF   ·   '+off+' DEVICES LOST   ·   '+partial+' DEGRADED / UNKNOWN';
 selectedInfo.textContent=selected?
  selected.split('@')[0].toUpperCase()+' · '+selected.split('@')[1]+' · '+(power[selected]===true?'POWERED':cuts.has(selected)?'DIRECT INTERRUPTION':'UPSTREAM SOURCE UNAVAILABLE'):
  'Tap a colored bus in the original-format drawing to inject its failure.';
 const grouped=new Map();
 for(const item of impacted){
  const g=String(item.system||'UNCLASSIFIED');
  if(!grouped.has(g))grouped.set(g,[]);
  grouped.get(g).push(item);
 }
 const fragment=document.createDocumentFragment();
 if(!impacted.length)make('p',fragment,'mrg-none','NO AFFECTED SYSTEMS IN THE CURRENT SCENARIO');
 for(const [group,entries]of [...grouped].sort((a,b)=>a[0].localeCompare(b[0]))){
  const section=make('section',fragment,'mrg-impact-group');
  make('h4',section,null,group+' ('+entries.length+')');
  for(const e of entries){
   const row=make('div',section,'mrg-impact-row');
   row.dataset.state=e.state;
   make('span',row,null,e.displayName||e.name);
   make('b',row,null,e.state);
  }
 }
 affected.replaceChildren(fragment);
}
function toggle(key){
 if(!lab||!busNodes.has(key))return;
 const session=lab.getSession();
 selected=key;
 if(session.cascade&&session.busStates[key]===false&&!session.disabled.includes(key)){
  selectedInfo.textContent='Upstream source is OFF. Restore its source before attempting to energize '+key+'.';
  return;
 }
 try{lab.toggleBus(key);}
 catch(e){selectedInfo.textContent='Lab error: '+(e?.message||e);}
 render();
}
function mount(){
 if(lab||!root.B737BusConsumerTestLabUIV1)return;
 lab=root.B737BusConsumerTestLabUIV1;
 if(!lab.listBusNames||!lab.setCascade||!lab.getSession)return;
 for(const key of lab.listBusNames())if(!BUS[key])throw Error('MRG plate power class not drawn: '+key);
 // Dependency cascades are opt-in in the existing lab, mandatory for this diagram.
 if(!lab.getSession().cascade)lab.setCascade(true);
 createScene();render();
 root.B737MRGElectricalPlateV2=Object.freeze({
  version:VERSION,refresh:render,select:toggle,
  getContacts:()=>Object.fromEntries([...contactNodes].map(([k,v])=>[k,v.g.dataset.closed])),
  getPower:()=>({...lab.getSession().busStates}),
  getGeometry:()=>Object.fromEntries(Object.entries(BUS).map(([k,v])=>[k,{...v}]))
 });
 root.dispatchEvent(new CustomEvent('b737:mrg-electrical-plate-ready',{detail:{version:VERSION,buses:busNodes.size,contacts:contactNodes.size}}));
}
root.addEventListener('b737:buslab-ui-ready',mount);
root.addEventListener('b737:buslab-updated',render);
if(root.B737BusConsumerTestLabUIV1)mount();
})(window);
