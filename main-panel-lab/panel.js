(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
const svg=$('devices'), lampLayer=$('lamps');
const controls=[
{id:'gear',name:'Landing Gear Lever',type:'gear',x:1300,y:352,states:['UP','OFF','DOWN'],initial:'DOWN',detail:'Three-position UP / OFF / DOWN selector. Tap to cycle or drag vertically. Travel animation is visual; gear position and system interlocks are not modeled.'},
{id:'autobrake',name:'Autobrake Selector',type:'rotary',x:1214,y:511,r:25,states:['RTO','OFF','1','2','3','MAX'],initial:'OFF',detail:'RTO / OFF / 1 / 2 / 3 / MAX detents. Position selection and smooth knob rotation only; automatic braking logic is not implemented.'},
{id:'mcp-course-l',name:'Captain Course',type:'rotary',x:746,y:78,r:16,states:['000','090','180','261','270'],initial:'261',detail:'Selected left course, display demonstration.'},
{id:'mcp-ias',name:'MCP IAS / MACH',type:'rotary',x:885,y:92,r:19,states:['180','210','231','250','300','312'],initial:'312',detail:'IAS/MACH rotary selector. Demonstration values, not flight-performance computations.'},
{id:'mcp-heading',name:'MCP Heading',type:'rotary',x:977,y:84,r:19,states:['000','090','134','180','270'],initial:'134',detail:'Heading select demonstration.'},
{id:'mcp-altitude',name:'MCP Altitude',type:'rotary',x:1075,y:86,r:19,states:['00000','05000','10000','20000','31000','35000'],initial:'31000',detail:'Selected altitude demonstration.'},
{id:'mcp-course-r',name:'First Officer Course',type:'rotary',x:1314,y:81,r:16,states:['000','090','180','261','270'],initial:'261',detail:'Selected right course demonstration.'},
{id:'at-arm',name:'Autothrottle Arm',type:'toggle',x:809,y:73,states:['OFF','ARM'],initial:'OFF',detail:'A/T arming switch; no thrust-system coupling.'},
{id:'fd-left',name:'Flight Director Left',type:'toggle',x:778,y:114,states:['OFF','ON'],initial:'OFF',detail:'Flight director left demonstration.'},
{id:'fd-right',name:'Flight Director Right',type:'toggle',x:1284,y:118,states:['OFF','ON'],initial:'OFF',detail:'Flight director right demonstration.'},
{id:'cmd-a',name:'Autopilot CMD A',type:'push',x:1219,y:55,states:['OFF','ON'],initial:'OFF',color:'green',detail:'CMD A button. Displays selected state only, with no AFDS system simulation.'},
{id:'cmd-b',name:'Autopilot CMD B',type:'push',x:1260,y:55,states:['OFF','ON'],initial:'OFF',color:'green',detail:'CMD B button.'},
{id:'lnav',name:'LNAV',type:'push',x:983,y:113,states:['OFF','ON'],initial:'OFF',color:'green',detail:'Lateral navigation mode selected, visual demonstration.'},
{id:'vnav',name:'VNAV',type:'push',x:930,y:50,states:['OFF','ON'],initial:'OFF',color:'green',detail:'Vertical navigation mode selected, visual demonstration.'},
{id:'lvlchg',name:'Level Change',type:'push',x:882,y:114,states:['OFF','ON'],initial:'OFF',color:'green',detail:'Level change mode, visual demonstration.'},
{id:'heading-sel',name:'Heading Select',type:'push',x:981,y:114,states:['OFF','ON'],initial:'OFF',color:'green',detail:'Heading select mode, visual demonstration.'},
{id:'approach',name:'Approach Mode',type:'push',x:1054,y:115,states:['OFF','ON'],initial:'OFF',color:'green',detail:'APP mode selection is not coupled to navigation systems.'},
{id:'alt-hold',name:'Altitude Hold',type:'push',x:1072,y:115,states:['OFF','ON'],initial:'OFF',color:'green',detail:'ALT HOLD mode demonstration.'},
{id:'vs-hold',name:'Vertical Speed Mode',type:'push',x:1110,y:115,states:['OFF','ON'],initial:'OFF',color:'green',detail:'V/S mode demonstration.'},
{id:'ap-disengage',name:'A/P Disengage Bar',type:'toggle',x:1236,y:130,states:['DISENGAGED','ENGAGED'],initial:'DISENGAGED',detail:'Illustrative switch bar position; no actual autopilot release logic.'},
{id:'master-caution-l',name:'Master Caution Left',type:'lamp',x:521,y:69,w:36,h:30,states:['OFF','ON'],initial:'ON',color:'amber',text:'MASTER',detail:'Clickable annunciator lamp-test simulation; does not indicate a real fault.'},
{id:'fire-warn-l',name:'Fire Warning Left',type:'lamp',x:480,y:70,w:35,h:32,states:['OFF','ON'],initial:'ON',color:'red',text:'FIRE',detail:'Manual warning lamp demonstration, not fire detection.'},
{id:'master-caution-r',name:'Master Caution Right',type:'lamp',x:1538,y:71,w:37,h:31,states:['OFF','ON'],initial:'ON',color:'amber',text:'MASTER',detail:'Manual warning lamp demonstration.'},
{id:'fire-warn-r',name:'Fire Warning Right',type:'lamp',x:1581,y:70,w:36,h:31,states:['OFF','ON'],initial:'ON',color:'red',text:'FIRE',detail:'Manual warning lamp demonstration.'},
{id:'light-test',name:'Lights Test / Dimmer',type:'rotary',x:788,y:223,r:18,states:['DIM','BRT','TEST'],initial:'DIM',detail:'Dimming or lamp test selection, visual demonstration.'},
{id:'anti-skid',name:'Anti-skid Selector',type:'toggle',x:1219,y:415,states:['OFF','ON'],initial:'ON',detail:'Anti-skid control demonstration.'},
{id:'antiskid-inop',name:'Antiskid Inoperative Light',type:'lamp',x:1217,y:355,w:36,h:20,states:['OFF','ON'],initial:'OFF',color:'amber',text:'INOP',systemDriven:true,detail:'FCOM 14.10.5: illuminated when the ANTISKID switch is OFF. Fault-detection logic not yet simulated.'},
{id:'autobrake-disarm',name:'Autobrake Disarm Light',type:'lamp',x:1217,y:468,w:36,h:18,states:['OFF','ON'],initial:'OFF',color:'amber',text:'DISARM',systemDriven:true,detail:'FCOM 14.10.5: this modeled portion illuminates when ANTISKID is OFF while autobrake is selected. Other disarm conditions await full system model.'},
{id:'gear-light-nose',name:'Nose Gear Down Light',type:'gearLamp',x:1298,y:218,w:35,h:17,text:'NOSE',color:'green',states:['OFF','ON'],initial:'ON',detail:'Simulated gear down indication derived from the animated handle position.'},
{id:'gear-light-left',name:'Left Gear Down Light',type:'gearLamp',x:1279,y:239,w:32,h:17,text:'LEFT',color:'green',states:['OFF','ON'],initial:'ON',detail:'Simulated left gear down indication.'},
{id:'gear-light-right',name:'Right Gear Down Light',type:'gearLamp',x:1317,y:239,w:32,h:17,text:'RIGHT',color:'green',states:['OFF','ON'],initial:'ON',detail:'Simulated right gear down indication.'},
{id:'gear-transit-nose',name:'Nose Gear Unsafe',type:'gearLamp',x:1298,y:180,w:34,h:16,text:'NOSE',color:'red',states:['OFF','ON'],initial:'OFF',detail:'Gear transit visualization; not a gear unsafe system model.'},
{id:'gear-transit-left',name:'Left Gear Unsafe',type:'gearLamp',x:1278,y:200,w:32,h:16,text:'LEFT',color:'red',states:['OFF','ON'],initial:'OFF',detail:'Gear transit visualization.'},
{id:'gear-transit-right',name:'Right Gear Unsafe',type:'gearLamp',x:1319,y:200,w:32,h:16,text:'RIGHT',color:'red',states:['OFF','ON'],initial:'OFF',detail:'Gear transit visualization.'},
{id:'panel-light-capt',name:'Captain Panel Brightness',type:'rotary',x:315,y:605,r:23,states:['OFF','DIM','MED','BRIGHT'],initial:'DIM',detail:'Panel light brightness knob demonstration.'},
{id:'panel-light-background',name:'Background Brightness',type:'rotary',x:512,y:607,r:22,states:['OFF','DIM','MED','BRIGHT'],initial:'OFF',detail:'Background light brightness knob.'},
{id:'panel-light-afds',name:'AFDS Flood Brightness',type:'rotary',x:626,y:607,r:22,states:['OFF','DIM','MED','BRIGHT'],initial:'OFF',detail:'AFDS flood light brightness knob.'},
{id:'panel-light-fo',name:'FO Panel Brightness',type:'rotary',x:1720,y:604,r:22,states:['OFF','DIM','MED','BRIGHT'],initial:'OFF',detail:'First officer panel brightness.'},
{id:'gpws-test',name:'Ground Proximity Test',type:'push',x:1417,y:628,states:['OFF','TEST'],initial:'OFF',color:'amber',detail:'GPWS test pushbutton visual only; no audio or flight envelope warning system.'},
{id:'gpws-inhibit',name:'GPWS FLAP/GEAR Inhibit',type:'toggle',x:1522,y:644,states:['NORM','INHIBIT'],initial:'NORM',detail:'GPWS inhibit selector, visual only.'},
{id:'brake-pressure',name:'Brake Pressure Gauge',type:'push',x:1387,y:518,states:['NORMAL','TEST'],initial:'NORMAL',detail:'Gauge test placeholder. Hydraulic pressure calculations not implemented.'}
];
const byId=Object.fromEntries(controls.map(c=>[c.id,c]));
const lampIDs=controls.filter(c=>c.type==='lamp').map(c=>c.id);
const gearLampIDs=controls.filter(c=>c.type==='gearLamp').map(c=>c.id);
const STORE='b737_panel_animated_v1';let values={},selected=null,zoom=1,gearPosition='DOWN',moving=false,version=0,log=[];
function h(tag,attrs={},markup=''){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));el.innerHTML=markup;return el}
function rect(x,y,w,t,fill,stroke='#272d34',radius=3){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+t+'" rx="'+radius+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.5"/>'}
function label(x,y,word,color='#fff',size=10){return '<text x="'+x+'" y="'+y+'" font-family="Arial,sans-serif" font-weight="800" font-size="'+size+'" fill="'+color+'" text-anchor="middle" pointer-events="none">'+word+'</text>'}
function ring(r){return '<circle class="target-ring" cx="0" cy="0" r="'+r+'"/>'}
function load(){controls.forEach(c=>values[c.id]=c.initial);try{const saved=JSON.parse(localStorage.getItem(STORE));if(saved&&saved.values){for(const [k,v] of Object.entries(saved.values)){if(byId[k]&&byId[k].states.includes(v))values[k]=v;}if(['UP','DOWN'].includes(saved.gearPosition))gearPosition=saved.gearPosition;}}catch(e){}}
function save(){try{localStorage.setItem(STORE,JSON.stringify({values,gearPosition}))}catch(e){}}
function createControl(c){
 const g=h('g',{class:'device',tabindex:'0',role:'button','aria-label':c.name+' '+values[c.id],'data-id':c.id});c.element=g;
 if(c.type==='rotary'){
  g.setAttribute('transform','translate('+c.x+' '+c.y+')');let r=c.r||20;
  g.innerHTML='<circle cx="0" cy="2" r="'+(r+6)+'" fill="#1b2227" stroke="#a0a3a4" stroke-width="3"/><circle cx="0" cy="0" r="'+(r+2)+'" fill="#60656a" stroke="#313a40" stroke-width="2"/>';
  const rotor=h('g',{class:'rotor'});rotor.innerHTML='<ellipse cy="2" rx="'+(r-2)+'" ry="'+(r-3)+'" fill="#1b2026" opacity=".55"/><ellipse rx="'+(r-4)+'" ry="'+(r-5)+'" fill="url(#knobFront)" stroke="#e3dfd8" stroke-width="1.5"/><rect x="-4" y="'+(-r+6)+'" width="8" height="'+(r*.9)+'" rx="4" fill="#eee8d8" stroke="#777c81"/><path d="M0 '+(-r+4)+' L0 '+(-r+15)+'" stroke="#aa8146" stroke-width="3"/>';
  g.append(rotor);c.rotor=rotor;g.insertAdjacentHTML('beforeend',ring(r+8));
 }else if(c.type==='gear'){
  // Static opaque panel masks the photographed lever so it can move without leaving a second lever behind.
  g.innerHTML='<rect x="1256" y="245" width="91" height="227" rx="5" fill="url(#plate)" stroke="#8c9599" stroke-width="1.5"/><rect x="1279" y="267" width="40" height="180" rx="16" fill="#2e3539" stroke="#aab0ac" stroke-width="3"/><rect x="1284" y="273" width="30" height="168" rx="13" fill="#181c1f" stroke="#70767a"/>'+label(1300,260,'UP','#fff',11)+label(1300,461,'DN','#fff',11)+'<text x="1342" y="373" font-size="11" fill="#f1f2ea" text-anchor="middle" transform="rotate(90 1342 373)" pointer-events="none">LANDING GEAR</text><rect class="target-ring" x="1252" y="245" width="99" height="226" rx="6"/>';
  const lever=h('g',{class:'lever-moving'});lever.innerHTML='<rect x="1291" y="314" width="16" height="81" rx="7" fill="url(#metal)" stroke="#5b6262" stroke-width="1"/><rect x="1276" y="306" width="47" height="45" rx="16" fill="url(#metal)" stroke="#22282b" stroke-width="3"/><rect x="1283" y="310" width="33" height="35" rx="12" fill="url(#leverGrip)" stroke="#625c3d" stroke-width="2"/><path d="M1289 316V340 M1296 316V340 M1303 316V340 M1310 316V340" stroke="#e0cf85" stroke-width="1.4" opacity=".8"/>';
  lever.style.transformOrigin='1300px 352px';g.append(lever);c.lever=lever;g.classList.add('lever-drag');
 }else if(c.type==='toggle'){
  const w=18,ht=37;
  g.setAttribute('transform','translate('+c.x+' '+c.y+')');
  g.innerHTML=rect(-w/2,-ht/2,w,ht,'#262f36','#aab1b4',2)+'<rect x="-4" y="-13" width="8" height="27" rx="2" fill="#191f24"/>';
  const lever=h('g',{class:'toggle-move'});lever.innerHTML='<rect x="-6" y="-12" width="12" height="22" rx="3" fill="url(#metal)" stroke="#2e3336"/><rect x="-7" y="-10" width="14" height="8" rx="3" fill="#e0e0da"/>';
  g.append(lever);c.lever=lever;g.insertAdjacentHTML('beforeend','<rect class="target-ring" x="-16" y="-25" width="32" height="50" rx="4"/>');
 }else if(c.type==='push'){
  g.setAttribute('transform','translate('+c.x+' '+c.y+')');
  g.innerHTML=rect(-18,-12,36,24,'#121b1b','#737a80',3)+'<rect class="button-face" x="-13" y="-8" width="26" height="16" rx="1" fill="#11191b" stroke="#495359"/>'+label(0,3,'●','#64797d',9)+'<rect class="target-ring" x="-21" y="-15" width="42" height="30" rx="5"/>';
 }else if(c.type==='lamp'||c.type==='gearLamp'){
  const x=c.x-(c.w||34)/2,y=c.y-(c.h||20)/2,w=c.w||34,ht=c.h||20;
  g.innerHTML=rect(x-2,y-2,w+4,ht+4,'#191d22','#9b9a91',2)+rect(x,y,w,ht,'#171713','#333331',1)+label(c.x,c.y+3,c.text,'#dfd9b8',c.h>24?8:7)+'<rect class="target-ring" x="'+(x-4)+'" y="'+(y-4)+'" width="'+(w+8)+'" height="'+(ht+8)+'" rx="3"/>';
  c.lamp=g.children[1];
 }
 (c.type==='gearLamp'?lampLayer:svg).append(g);
 g.addEventListener('click',e=>{e.preventDefault();if(g.dataset.dragged==='yes'){delete g.dataset.dragged;return}if(c.type==='gearLamp'||c.systemDriven){select(c.id);return}cycle(c.id,e.shiftKey?-1:1)});
 g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cycle(c.id,e.shiftKey?-1:1)}else if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();cycle(c.id,1)}else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();cycle(c.id,-1)}});
 if(c.type==='rotary'){g.classList.add('rotary-drag');g.addEventListener('wheel',e=>{e.preventDefault();cycle(c.id,e.deltaY<0?-1:1)},{passive:false});attachRotaryDrag(g,c)}
 if(c.type==='gear')attachGearDrag(g);
}
function attachRotaryDrag(g,c){
 let down=null,last=-1;
 g.addEventListener('pointerdown',e=>{if(e.button!==0)return;down={x:e.clientX,y:e.clientY,index:c.states.indexOf(values[c.id])};last=down.index;g.setPointerCapture(e.pointerId)});
 g.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down.x,dy=down.y-e.clientY;const travel=Math.abs(dx)>Math.abs(dy)?dx:dy;if(Math.abs(travel)<13)return;g.dataset.dragged='yes';const idx=Math.max(0,Math.min(c.states.length-1,down.index+Math.trunc(travel/23)));if(last!==idx){last=idx;setValue(c.id,c.states[idx])}});
 g.addEventListener('pointerup',()=>{down=null;if(g.dataset.dragged==='yes')setTimeout(()=>delete g.dataset.dragged,250)});
 g.addEventListener('pointercancel',()=>{down=null;delete g.dataset.dragged});
}
function attachGearDrag(g){let downY=null,downT=0;
 g.addEventListener('pointerdown',e=>{if(e.button!==0)return;downY=e.clientY;downT=performance.now();g.setPointerCapture(e.pointerId)});
 g.addEventListener('pointerup',e=>{if(downY===null)return;const dy=e.clientY-downY;downY=null;if(Math.abs(dy)<12)return;g.dataset.dragged='yes';setTimeout(()=>delete g.dataset.dragged,250);const next=dy>40?'DOWN':dy< -40?'UP':'OFF';setValue('gear',next)});
 g.addEventListener('pointercancel',()=>downY=null);
}
function cycle(id,dir=1){const c=byId[id];if(!c||c.type==='gearLamp'||c.systemDriven)return;const i=c.states.indexOf(values[id]);const next=c.type==='rotary'?Math.max(0,Math.min(c.states.length-1,i+dir)):(i+dir+c.states.length)%c.states.length;setValue(id,c.states[next]);}
function setValue(id,val){const c=byId[id];if(!c||!c.states.includes(val)||c.type==='gearLamp'||c.systemDriven)return;select(id);if(values[id]===val)return;const from=values[id];values[id]=val;log.unshift(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})+'  '+c.name+'  '+from+' → '+val);log=log.slice(0,18);renderHistory();if(id==='gear'){if(val==='UP'||val==='DOWN'){moving=true;gearLampRender();const token=++version;setTimeout(()=>{if(token!==version)return;gearPosition=val;moving=false;gearLampRender();save();},920)}else{version++;moving=false;gearLampRender()}}render();save();}
function select(id){selected=id;const c=byId[id];document.querySelectorAll('.device').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));$('name').textContent=c.name;$('description').textContent=c.detail;$('ref').textContent='MAIN PANEL / '+c.type.toUpperCase()+' / '+id.toUpperCase();$('value').textContent=values[id];const choices=$('choices');choices.replaceChildren();c.states.forEach(v=>{const b=document.createElement('button');b.textContent=v;b.className=values[id]===v?'active':'';b.disabled=c.type==='gearLamp'||!!c.systemDriven;b.title=b.disabled?'System-driven indication; not manually selectable.':'';b.addEventListener('click',()=>setValue(id,v));choices.appendChild(b)});}
function angle(c,val){const i=c.states.indexOf(val);if(c.id==='autobrake')return [-140,-92,-50,0,49,90][i]??0;return c.type==='rotary' ? (-125 + 250*i/Math.max(1,c.states.length-1)):0}
function applyFCOM14Indications(){const armed=['RTO','1','2','3','MAX'].includes(values.autobrake);const inop=values['anti-skid']==='OFF';values['antiskid-inop']=inop?'ON':'OFF';values['autobrake-disarm']=armed&&inop?'ON':'OFF'}
function render(){applyFCOM14Indications();for(const c of controls){const val=values[c.id];if(c.rotor)c.rotor.style.transform='rotate('+angle(c,val)+'deg)';if(c.type==='toggle')c.lever.style.transform='translateY('+(val===c.states[0]?7:-7)+'px)';if(c.type==='gear')c.lever.style.transform='translateY('+(val==='UP'?-74:val==='OFF'?0:74)+'px)';if(c.type==='push')c.element.classList.toggle('pressed',val!==c.states[0]);if(c.type==='lamp')lampRender(c);c.element.setAttribute('aria-label',c.name+' '+val);}
 $('gearHandleState').textContent=values.gear;$('gearPosState').textContent=moving?'TRANSIT':gearPosition;$('brakeState').textContent=values.autobrake;$('lightsState').textContent='MANUAL TEST';
 if(selected)select(selected);gearLampRender();
}
function lampRender(c){if(!c.lamp)return;const on=values[c.id]==='ON'||lampTesting;const color=c.color==='red'?'#ed343a':c.color==='amber'?'#f4b31b':'#46dc66';c.lamp.setAttribute('fill',on?color:'#161916');c.lamp.classList.toggle('lit',on);c.lamp.style.color=color;}
let lampTesting=false,lampToken=0;
function gearLampRender(){for(const id of gearLampIDs){const c=byId[id];if(!c.lamp)continue;const transit=c.color==='red';const on=lampTesting||(moving?transit:(!transit&&gearPosition==='DOWN'));c.lamp.setAttribute('fill',on?(transit?'#f33c41':'#48da5a'):'#171b18');c.lamp.classList.toggle('lit',on);c.lamp.style.color=transit?'#ff4141':'#4be66a';values[id]=on?'ON':'OFF';}}
function testLamps(){lampTesting=true;const t=++lampToken;render();$('lampTest').classList.add('active');setTimeout(()=>{if(t!==lampToken)return;lampTesting=false;$('lampTest').classList.remove('active');render()},1400);}
function renderHistory(){$('history').replaceChildren();if(!log.length){$('history').textContent='No controls moved.';return}for(const row of log){const el=document.createElement('span');el.textContent=row;$('history').append(el)}}
function setZoom(n){zoom=Math.max(.75,Math.min(3,Math.round(n*10)/10));$('stage').style.width=Math.round(100*zoom)+'%';$('zoomValue').textContent=Math.round(zoom*100)+'%'}
function init(){load();controls.forEach(createControl);$('mapped').textContent=controls.length;render();renderHistory();select('autobrake');$('minus').onclick=()=>setZoom(zoom-.25);$('plus').onclick=()=>setZoom(zoom+.25);$('fit').onclick=()=>setZoom(1);$('targets').onclick=()=>{document.body.classList.toggle('hide-targets');$('targets').classList.toggle('active',!document.body.classList.contains('hide-targets'))};$('lampTest').onclick=testLamps;$('reset').onclick=()=>{values={};controls.forEach(c=>values[c.id]=c.initial);gearPosition='DOWN';version++;moving=false;log=[];render();renderHistory();save()};$('clearLog').onclick=()=>{log=[];renderHistory()};document.querySelectorAll('[data-set]').forEach(btn=>btn.onclick=()=>{const parts=btn.dataset.set.split(':');setValue(parts[0],parts[1])});}
init();
})();