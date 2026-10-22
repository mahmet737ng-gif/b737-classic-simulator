/* Boeing 737 Classic EHSI standalone training engine.
 * Fidelity boundary: FCOM vol 2 10.30.2–10.30.5, 10.40.9–10.40.13.
 * Simulated sensor and geographic data are explicitly non-operational.
 */
(function(g,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;g.EHSI_ENGINE=a;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const MODES=['MAP','CTR_MAP','FULL_NAV','EXP_NAV','FULL_VOR_ILS','EXP_VOR_ILS','PLAN'];
const RANGES=[10,20,40,80,160,320];
const NS='http://www.w3.org/2000/svg';
const COLORS={white:'#f6f5ef',magenta:'#de67fc',green:'#6ff87b',cyan:'#59eaff',amber:'#ffbb4f',gray:'#a3a9ad'};
function norm(a){return ((a%360)+360)%360}
function orientation(mode){return mode==='PLAN'?'TRUE_NORTH':mode.includes('VOR_ILS')?'HEADING_UP':'TRACK_UP'}
function defaultModel(){return {mode:'MAP',range:10,heading:0,track:0,course:0,aircraft:{x:0,y:0},headingBug:0,selectedCourse:0,wind:{direction:0,speed:0},nav:{valid:false,source:'VOR1',bearing:0,frequency:'',dme:null,cdi:0,gs:null,toFrom:'',ident:'',waypoint:'',distance:null},route:{source:'none',points:[],activeIndex:0},options:{vorAdf:false,navAid:false,arpt:false,rteData:false,wpt:false,wxr:false,tfc:false,terr:false,demoRoute:false},efis:{headingValid:true,trackValid:true,sgValid:true,irsSource:'L',sgSource:'1',brightness:1,wxBrightness:1}}}
function polar(deg,rad){const a=(deg-90)*Math.PI/180;return {x:150+Math.cos(a)*rad,y:150+Math.sin(a)*rad}}
function node(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!=null)n.textContent=String(text);return n}
function append(parent,tag,attrs={},text){const n=node(tag,attrs,text);parent.appendChild(n);return n}
function text(parent,x,y,value,color=COLORS.white,size=12,anchor='middle'){return append(parent,'text',{x,y,fill:color,'font-size':size,'text-anchor':anchor,'font-family':'Lucida Console,monospace','font-weight':'normal'},value)}
function line(parent,x1,y1,x2,y2,color=COLORS.white,width=1,dash){return append(parent,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})})}
function rose(parent,ref,full){const g=append(parent,'g',{transform:`rotate(${-ref} 150 150)`});for(let d=0;d<360;d+=5){const p=polar(d,d%30===0?119:d%10===0?125:129),q=polar(d,136);line(g,p.x,p.y,q.x,q.y,d%30===0?COLORS.white:COLORS.gray,d%30===0?2:1)}for(let d=0;d<360;d+=30){const labels={0:'N',90:'E',180:'S',270:'W'};const p=polar(d,107);text(g,p.x,p.y+4,labels[d]||String(d/10),COLORS.white,14)}if(!full){append(parent,'rect',{x:0,y:150,width:300,height:150,fill:'#06080b',opacity:0.94});}
 return g}
function indicator(parent,m,ref){const relative=norm(m.heading-ref),p=polar(relative,40);const shape=append(parent,'g',{transform:`rotate(${relative} 150 150)`});append(shape,'polygon',{points:'150,128 142,166 150,160 158,166',fill:COLORS.white});if(m.heading!==m.track){const tr=append(parent,'g',{transform:`rotate(${norm(m.track-ref)} 150 150)`});line(tr,150,125,150,96,COLORS.white,2);append(tr,'polygon',{points:'150,91 145,99 155,99',fill:COLORS.white});}}
function courseNeedle(parent,m,ref){const a=norm(m.course-ref);const g=append(parent,'g',{transform:`rotate(${a} 150 150)`});line(g,150,51,150,252,COLORS.magenta,2);append(g,'polygon',{points:'150,37 142,52 158,52',fill:COLORS.magenta});}
function deviation(parent,m,ref){const d=m.nav.cdi;const a=norm(m.course-ref);const g=append(parent,'g',{transform:`rotate(${a} 150 150)`});[-2,-1,1,2].forEach(i=>append(g,'circle',{cx:150+i*21,cy:150,r:2.4,stroke:COLORS.white,fill:'none'}));line(g,150+Math.max(-2.5,Math.min(2.5,d))*21,117,150+Math.max(-2.5,Math.min(2.5,d))*21,182,COLORS.magenta,3);}
function routePoints(parent,m,ref){if(!m.route.points.length){text(parent,150,235,'NO NAV POSITION DATA',COLORS.amber,10);return}
 const originY=m.mode==='CTR_MAP'?150:215,scale=110/Math.max(1,m.range);
 const local=(p)=>{let dx=p.x-(m.aircraft?.x||0),dy=p.y-(m.aircraft?.y||0);const a=-ref*Math.PI/180;let x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);return [150+x*scale,originY-y*scale]};
 let points=m.route.points.map(local);append(parent,'polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:COLORS.magenta,'stroke-width':2});m.route.points.forEach((p,i)=>{const q=points[i];if(q[0]<10||q[0]>290||q[1]<14||q[1]>287)return;const active=i===m.route.activeIndex;append(parent,'rect',{x:q[0]-4,y:q[1]-4,width:8,height:8,transform:`rotate(45 ${q[0]} ${q[1]})`,stroke:active?COLORS.magenta:COLORS.cyan,fill:'none'});text(parent,q[0]+6,q[1]-8,p.name||'WPT',active?COLORS.magenta:COLORS.cyan,11,'start')})}
function render(svg,source){const m=normalize(source);svg.replaceChildren();svg.setAttribute('viewBox','0 0 300 300');svg.style.background='#050607';append(svg,'circle',{cx:150,cy:150,r:144,fill:'#07090c',stroke:'#62717b','stroke-width':2});
 const o=orientation(m.mode),ref=o==='TRUE_NORTH'?0:o==='HEADING_UP'?m.heading:m.track;
 if(!m.efis.sgValid){text(svg,150,150,'SG FAIL',COLORS.amber,20);return m}
 const mapMode=['MAP','CTR_MAP','PLAN'].includes(m.mode),navMode=m.mode.includes('NAV'),vorMode=m.mode.includes('VOR_ILS');
 if(m.mode==='PLAN'){append(svg,'circle',{cx:150,cy:150,r:135,fill:'none',stroke:'#243545'});text(svg,150,29,'TRUE NORTH',COLORS.white,12);routePoints(svg,m,0);text(svg,150,285,'PLAN',COLORS.green,14);}
 else{
 rose(svg,ref,!['MAP','EXP_NAV','EXP_VOR_ILS'].includes(m.mode));
 if(mapMode){routePoints(svg,m,ref)}
 if(navMode){courseNeedle(svg,m,ref);if(m.nav.valid)deviation(svg,m,ref);else text(svg,150,211,'NAV DATA INVALID',COLORS.amber,10)}
 if(vorMode){if(m.nav.valid){courseNeedle(svg,m,ref);deviation(svg,m,ref);text(svg,150,203,m.nav.toFrom||'',COLORS.white,10)}else text(svg,150,211,'VOR/ILS DATA INVALID',COLORS.amber,10)}
 indicator(svg,m,ref);
 }
 const fmt=a=>String(Math.round(norm(a))).padStart(3,'0');
 text(svg,150,18,(m.mode==='PLAN'?'TRU':fmt(ref))+'°',COLORS.white,15);
 text(svg,17,21,m.mode.replaceAll('_',' '),COLORS.green,11,'start');
 text(svg,283,21,m.range+' NM',COLORS.cyan,11,'end');
 if(m.nav.valid && (navMode||vorMode)){text(svg,15,277,m.nav.ident||m.nav.source,COLORS.cyan,10,'start');text(svg,285,277,m.nav.dme!=null?m.nav.dme.toFixed(1)+' NM':'--- NM',COLORS.white,10,'end')}
 if(!m.efis.headingValid){text(svg,150,145,'HDG',COLORS.amber,16)}
 if(!m.efis.trackValid && o==='TRACK_UP'){text(svg,150,172,'TRACK INVALID',COLORS.amber,12)}
 if(m.options.wxr && !['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(m.mode)){text(svg,150,253,'WXR UNAVAILABLE IN MODE',COLORS.amber,9)}
 else if(m.options.wxr){text(svg,150,253,'WXR DATA NOT CONNECTED',COLORS.amber,9)}
 if(m.options.terr){text(svg,150,240,'TERRAIN DATA NOT CONNECTED',COLORS.amber,9)}
 return m}
function normalize(x){const d=defaultModel();const m={...d,...x,nav:{...d.nav,...x.nav},options:{...d.options,...x.options},efis:{...d.efis,...x.efis},route:{...d.route,...x.route}};if(!MODES.includes(m.mode))m.mode='MAP';if(!RANGES.includes(Number(m.range)))m.range=10;m.heading=norm(Number(m.heading)||0);m.track=norm(Number(m.track)||0);m.course=norm(Number(m.course)||0);return m}
function modelFor(st,core){let m=st.ehsi;const d=defaultModel();if(!m.options)m.options=d.options;if(!m.nav)m.nav=d.nav;if(!m.route)m.route=d.route;if(!m.efis)m.efis=d.efis;if(m.track==null)m.track=m.heading;return m}
function renderToDom(st,core,svg,documentRef){const m=modelFor(st,core);if(!svg)return;const orig=core.readValue(st,'ORIGIN','RTE'),dest=core.readValue(st,'DEST','RTE');if(m.options.demoRoute && st.active.ORIGIN && st.active.DEST){m.route={source:'synthetic-relative-NM',activeIndex:1,points:[{name:st.active.ORIGIN,x:-8,y:-12},{name:'DEMO',x:1,y:11},{name:st.active.DEST,x:15,y:28}]}}else{m.route={source:'none',points:[],activeIndex:0}}render(svg,m);if(m.options.demoRoute && st.active.ORIGIN && st.active.DEST){text(svg,150,270,'SIM GEOMETRY – NOT REAL NAV',COLORS.amber,9)}const val=(id,v)=>{const e=documentRef.getElementById(id);if(e)e.textContent=v};val('ehsi-heading-val',String(Math.round(m.heading)).padStart(3,'0'));val('ehsi-course-val',String(Math.round(m.course)).padStart(3,'0'));val('ehsi-mode-val',m.mode.replaceAll('_',' '));val('ehsi-range-val',m.range+' NM');val('ehsi-route-val',(core.readValue(st,'ORIGIN','RTE')||'----')+' → '+(core.readValue(st,'DEST','RTE')||'----'));val('ehsi-route-state',core.pendingCount(st)?'MOD (not executed)':core.hasStagedRoute(st)?'RTE not activated':'ACT');}
function initControls(st,core,doc,onchange){const box=doc.getElementById('ehsi-fcom-options');if(!box)return;const options=[['vorAdf','VOR/ADF'],['navAid','NAV AID'],['arpt','ARPT'],['rteData','RTE DATA'],['wpt','WPT'],['wxr','WXR'],['tfc','TFC'],['terr','TERR'],['demoRoute','SIM ROUTE']];for(const [id,label] of options){const lab=doc.createElement('label');const inp=doc.createElement('input');inp.type='checkbox';inp.addEventListener('change',()=>{modelFor(st,core).options[id]=inp.checked;onchange()});lab.append(inp,doc.createTextNode(label));box.appendChild(lab)}const msg=doc.createElement('p');msg.style.gridColumn='1/-1';msg.style.fontSize='11px';msg.style.color='#ffce75';msg.textContent='No aircraft/sensor nav feed: navigation/map returns remain unconnected; simulation preview only.';box.appendChild(msg)}
return {MODES,RANGES,COLORS,orientation,defaultModel,normalize,render,renderToDom,initControls};
});