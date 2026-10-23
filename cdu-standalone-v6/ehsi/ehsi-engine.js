/* B737 Classic EFIS/EHSI training display v6.
 * Source: Sepehran B737CL FCOM Vol 2, 10.30.2-10.30.5; 10.40.9-10.40.13;
 *         EHSI symbology 10.32.x (PDF pp.1359-1390).
 * Only mode/orientation, labels, available selections, and remote switching are FCOM-grounded.
 * Physics/nav inputs remain explicitly simulated or unavailable.
 */
(function(g,f){const api=f();if(typeof module==='object'&&module.exports)module.exports=api;g.EHSI_ENGINE=api})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const MODES=['FULL_VOR_ILS','EXP_VOR_ILS','FULL_NAV','EXP_NAV','MAP','CTR_MAP','PLAN'];
const RANGES=[10,20,40,80,160,320];
const COLORS={white:'#eeeef0',magenta:'#ef6afc',green:'#41f585',cyan:'#65edfa',amber:'#ffb748',red:'#fa4554',gray:'#98a7b0'};
const NS='http://www.w3.org/2000/svg';
const MAP_OPTIONS=['vorAdf','navAid','arpt','rteData','wpt'];
function norm(a){return ((Number(a)%360)+360)%360}
function orientation(mode){return mode==='PLAN'?'TRUE_NORTH':mode.includes('VOR_ILS')?'HEADING_UP':'TRACK_UP'}
function isArc(mode){return ['MAP','EXP_NAV','EXP_VOR_ILS'].includes(mode)}
function defaultModel(){return {mode:'MAP',range:40,heading:0,track:0,course:0,aircraft:{x:0,y:0},nav:{valid:false,source:'VOR1',cdi:0,dme:null,toFrom:'',ident:'',frequency:''},route:{source:'none',points:[],activeIndex:0},options:{vorAdf:false,navAid:false,arpt:false,rteData:false,wpt:false,wxr:false,tfc:false,terr:false,demoRoute:false},efis:{headingValid:true,trackValid:true,sgValid:true,brightness:1,wxBrightness:1,eadiBrightness:1,dh:200,dhAlert:false,remoteWxr:false,wxrTransmitter:false}}}
function normalize(m={}){const d=defaultModel();const r={...d,...m,efis:{...d.efis,...m.efis},options:{...d.options,...m.options},nav:{...d.nav,...m.nav},route:{...d.route,...m.route}};r.mode=MODES.includes(r.mode)?r.mode:'MAP';r.range=RANGES.includes(Number(r.range))?Number(r.range):40;for(const key of ['heading','track','course'])r[key]=norm(r[key]);return r}
function geometry(mode){return isArc(mode)?{cx:220,cy:376,radius:264,full:false}:{cx:220,cy:222,radius:176,full:true}}
function computeDisplay(inp){const m=normalize(inp),ref=orientation(m.mode)==='TRUE_NORTH'?0:orientation(m.mode)==='HEADING_UP'?m.heading:m.track;
 const navAvail=m.nav.valid,wxEligible=['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(m.mode);
 return {mode:m.mode,range:m.range,reference:ref,orientation:orientation(m.mode),geometry:geometry(m.mode),navValid:navAvail,wxSelected:!!(m.options.wxr&&m.efis.remoteWxr),wxVisible:!!(wxEligible&&m.options.wxr&&m.efis.remoteWxr&&m.efis.wxrTransmitter),simRouteVisible:!!m.options.demoRoute&&m.route.points.length>0,showTfc:!!m.options.tfc,showTerr:!!m.options.terr,headingBug:norm(m.heading-ref),headingValid:!!m.efis.headingValid,trackValid:!!m.efis.trackValid,sgValid:!!m.efis.sgValid};}
function el(tag,attrs={},body){const x=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!=null)x.setAttribute(k,String(v));if(body!=null)x.textContent=String(body);return x}
function put(p,tag,a={},text){const n=el(tag,a,text);p.appendChild(n);return n}
function label(p,x,y,s,color=COLORS.white,size=14,anchor='start'){return put(p,'text',{x,y,fill:color,'font-family':'Lucida Console,monospace','font-size':size,'text-anchor':anchor,'font-weight':'normal','letter-spacing':'.25'},s)}
function seg(p,x1,y1,x2,y2,color=COLORS.white,w=2,dash){return put(p,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':w,...(dash?{'stroke-dasharray':dash}:{})})}
function polar(cx,cy,angle,r){const z=(angle-90)*Math.PI/180;return {x:cx+Math.cos(z)*r,y:cy+Math.sin(z)*r}}
function rose(root,c,ref){const {cx,cy,radius,full}=c;const grp=put(root,'g',{transform:`rotate(${-ref} ${cx} ${cy})`});
 for(let d=0;d<360;d+=5){const major=d%30===0;const p=polar(cx,cy,d,radius-(major?14:7));const q=polar(cx,cy,d,radius);seg(grp,p.x,p.y,q.x,q.y,major?COLORS.white:COLORS.gray,major?1.8:.8)}
 for(let d=0;d<360;d+=30){const compass={0:'N',90:'E',180:'S',270:'W'},q=polar(cx,cy,d,radius-36);label(grp,q.x,q.y+5,compass[d]||String(d/10),COLORS.white,17,'middle')}
 if(full)put(root,'circle',{cx,cy,r:radius,fill:'none',stroke:'#c8d1d5','stroke-width':1,opacity:.65});
 return grp;
}
function plane(root,c){const x=c.cx,y=c.cy;put(root,'path',{d:`M ${x} ${y-16} L${x-6} ${y+8} L${x-26} ${y+18} L${x-26} ${y+23} L${x-3} ${y+18} L${x-3} ${y+32} L${x-13} ${y+38} L${x-13} ${y+41} L${x} ${y+38} L${x+13} ${y+41} L${x+13} ${y+38} L${x+3} ${y+32} L${x+3} ${y+18} L${x+26} ${y+23} L${x+26} ${y+18} L${x+6} ${y+8} Z`,fill:COLORS.white})}
function headingLine(root,c,headingDelta){const g=put(root,'g',{transform:`rotate(${headingDelta} ${c.cx} ${c.cy})`});seg(g,c.cx,c.cy-75,c.cx,c.cy-110,COLORS.white,2);put(g,'path',{d:`M${c.cx-6} ${c.cy-110} L${c.cx} ${c.cy-124} L${c.cx+6} ${c.cy-110}`,fill:'none',stroke:COLORS.white,'stroke-width':2})}
function courseNeedle(root,c,m,ref){const a=norm(m.course-ref),g=put(root,'g',{transform:`rotate(${a} ${c.cx} ${c.cy})`});
 seg(g,c.cx,c.cy-c.radius+51,c.cx,c.cy+c.radius-54,COLORS.magenta,2.4);put(g,'polygon',{points:`${c.cx},${c.cy-c.radius+31} ${c.cx-8},${c.cy-c.radius+51} ${c.cx+8},${c.cy-c.radius+51}`,fill:COLORS.magenta});
 if(m.nav.valid){for(const i of [-2,-1,1,2])put(g,'circle',{cx:c.cx+i*24,cy:c.cy,r:3,stroke:COLORS.white,fill:'none'});
   const px=c.cx+Math.max(-2.5,Math.min(2.5,m.nav.cdi))*24;seg(g,px,c.cy-48,px,c.cy+48,COLORS.magenta,3)}
}
function getDemoPoints(m){return m.route.points||[]}
function routeGeometry(root,c,m,ref){const pts=getDemoPoints(m);if(!pts.length)return;
 let g=put(root,'g',{}),scale=(c.full?135:175)/Math.max(1,m.range),a=ref*Math.PI/180;
 const p=pt=>{const dx=pt.x-m.aircraft.x,dy=pt.y-m.aircraft.y;return [c.cx+(dx*Math.cos(a)-dy*Math.sin(a))*scale,c.cy-(dx*Math.sin(a)+dy*Math.cos(a))*scale]};
 const xy=pts.map(p);put(g,'polyline',{points:xy.map(pt=>pt.join(',')).join(' '),fill:'none',stroke:COLORS.magenta,'stroke-width':3,'stroke-linejoin':'round'});
 pts.forEach((pt,i)=>{const q=xy[i];if(q[0]<26||q[0]>416||q[1]<40||q[1]>404)return;
 put(g,'rect',{x:q[0]-4,y:q[1]-4,width:8,height:8,fill:'none',stroke:i===m.route.activeIndex?COLORS.magenta:COLORS.cyan,'stroke-width':1.5,transform:`rotate(45 ${q[0]} ${q[1]})`});label(g,q[0]+8,q[1]-9,pt.name||'FIX',i===m.route.activeIndex?COLORS.magenta:COLORS.cyan,11)});
}
function render(svg,source){if(!svg)return;const m=normalize(source),status=computeDisplay(m),c=status.geometry,ref=status.reference;
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 440 440');svg.style.background='#030506';
 put(svg,'rect',{x:0,y:0,width:440,height:440,fill:'#030609'});
 const defs=put(svg,'defs');const clip=put(defs,'clipPath',{id:'efis-screen-clip'});put(clip,'rect',{x:3,y:3,width:434,height:434,rx:2});
 const canvas=put(svg,'g',{'clip-path':'url(#efis-screen-clip)'});
 if(!status.sgValid){label(canvas,220,230,'SG FAIL',COLORS.amber,23,'middle');return status}
 if(m.mode==='PLAN'){label(canvas,220,42,'TRUE NORTH',COLORS.white,15,'middle');seg(canvas,220,50,220,73,COLORS.green);put(canvas,'polygon',{points:'220,42 212,54 228,54',fill:COLORS.green});}
 if(m.mode==='PLAN' || m.mode==='MAP' || m.mode==='CTR_MAP'){
   if(m.mode!=='PLAN'){rose(canvas,c,ref);headingLine(canvas,c,status.headingBug);}
   else{put(canvas,'circle',{cx:c.cx,cy:c.cy,r:164,fill:'none',stroke:'#48555e','stroke-width':1});for(const n of [0,90,180,270]){const q=polar(c.cx,c.cy,n,155);label(canvas,q.x,q.y+5,['N','E','S','W'][n/90],COLORS.white,14,'middle')}}
   routeGeometry(canvas,c,m,ref);
   if(m.mode!=='PLAN')plane(canvas,c);
   if(!m.route.points.length)label(canvas,220,215,'NO NAV POSITION DATA',COLORS.amber,13,'middle');
 }else{
   rose(canvas,c,ref);plane(canvas,c);courseNeedle(canvas,c,m,ref);
   if(!status.navValid)label(canvas,220,292,m.mode.includes('VOR_ILS')?'VOR / ILS DATA INVALID':'NAV DATA INVALID',COLORS.amber,14,'middle');
 }
 if(status.showTfc)label(canvas,390,52,'TFC',COLORS.green,13,'end');
 if(status.showTerr)label(canvas,220,390,'TERRAIN DATA UNAVAILABLE',COLORS.amber,12,'middle');
 if(status.wxSelected)label(canvas,220,369,status.wxVisible?'WXR SIGNAL NOT CONNECTED':'WXR NOT AVAILABLE',COLORS.amber,12,'middle');
 if(status.simRouteVisible)label(canvas,220,413,'SIM GEOMETRY — NOT REAL NAV',COLORS.amber,10,'middle');
 if(!status.headingValid)label(canvas,220,260,'HDG FLAG',COLORS.amber,15,'middle');
 if(!status.trackValid&&status.orientation==='TRACK_UP')label(canvas,220,277,'TRACK INVALID',COLORS.amber,13,'middle');
 label(canvas,20,29,m.mode.replaceAll('_',' '),COLORS.green,16);
 label(canvas,420,29,m.range+' NM',COLORS.cyan,15,'end');
 label(canvas,220,30,(status.orientation==='TRUE_NORTH'?'TRU':String(Math.round(ref)).padStart(3,'0')+' M'),COLORS.white,17,'middle');
 if(m.nav.valid&&!['MAP','CTR_MAP','PLAN'].includes(m.mode)){
   label(canvas,20,413,m.nav.ident||m.nav.source,COLORS.cyan,12);
   label(canvas,420,413,m.nav.dme!=null?Number(m.nav.dme).toFixed(1)+' DME':'--- DME',COLORS.white,12,'end');
 }
 svg.style.opacity=Math.max(0.12,Math.min(1,m.efis.brightness));
 return status;
}
function modelFor(st){const m=normalize(st.ehsi);st.ehsi=m;return st.ehsi}
function renderToDom(st,core,svg,doc){const m=modelFor(st);const active=!!st.active.ORIGIN&&!!st.active.DEST;
 if(m.options.demoRoute&&active){m.route={source:'TRAINER_SYNTHETIC_RELATIVE_NM',activeIndex:1,points:[{name:st.active.ORIGIN,x:-10,y:-8},{name:'DEMO',x:4,y:14},{name:st.active.DEST,x:17,y:28}]}}else{m.route={source:'none',activeIndex:0,points:[]}};
 render(svg,m);
 const v=(id,txt)=>{const x=doc.getElementById(id);if(x)x.textContent=txt};
 v('ehsi-heading-val',String(Math.round(m.heading)).padStart(3,'0'));
 v('ehsi-course-val',String(Math.round(m.course)).padStart(3,'0'));
 v('ehsi-mode-val',m.mode.replaceAll('_',' '));v('ehsi-range-val',m.range+' NM');
 v('ehsi-route-val',(core.readValue(st,'ORIGIN','RTE')||'----')+' → '+(core.readValue(st,'DEST','RTE')||'----'));
 v('ehsi-route-state',core.pendingCount(st)?'MOD (not executed)':core.hasStagedRoute(st)?'RTE STAGED':'ACT');
 syncPanel(st,doc);
}
function syncPanel(st,doc){const m=normalize(st.ehsi);const root=doc.getElementById('efis-control-panel');if(!root)return;
 root.querySelectorAll('[data-mode]').forEach(n=>n.classList.toggle('selected',n.dataset.mode===m.mode));
 root.querySelectorAll('[data-range]').forEach(n=>n.classList.toggle('selected',Number(n.dataset.range)===m.range));
 root.querySelectorAll('[data-option]').forEach(n=>{n.classList.toggle('selected',!!m.options[n.dataset.option]);n.setAttribute('aria-pressed',String(!!m.options[n.dataset.option]))});
 const sv=(id,v)=>{const el=doc.getElementById(id);if(el)el.textContent=v};
 sv('efis-mode-readout',m.mode.replaceAll('_',' '));sv('efis-range-readout',m.range+' NM');sv('efis-dh-display',String(Math.round(m.efis.dh)).padStart(3,'0'));
 sv('efis-ehsi-brt',Math.round(m.efis.brightness*100)+'%');sv('efis-wxr-brt',Math.round(m.efis.wxBrightness*100)+'%');
 sv('efis-adi-brt',Math.round(m.efis.eadiBrightness*100)+'%');
 root.querySelectorAll('[data-sim]').forEach(n=>{if(doc.activeElement!==n)n.value=String(m[n.dataset.sim]||0)});
 root.querySelectorAll('[data-efis-toggle]').forEach(n=>{const checked=!!m.efis[n.dataset.efisToggle];n.classList.toggle('selected',checked);n.setAttribute('aria-pressed',String(checked))});
}
function step(st,type,delta){const m=modelFor(st);
 if(type==='mode'){const i=MODES.indexOf(m.mode);m.mode=MODES[Math.max(0,Math.min(MODES.length-1,i+delta))]}
 else if(type==='range'){const i=RANGES.indexOf(m.range);m.range=RANGES[Math.max(0,Math.min(RANGES.length-1,i+delta))]}
 else if(type==='dh'){m.efis.dh=Math.max(-20,Math.min(999,(m.efis.dh===null?200:m.efis.dh)+delta))}
 else if(type==='eadiBrightness'||type==='brightness'||type==='wxBrightness'){m.efis[type]=Math.max(.12,Math.min(1,Math.round((m.efis[type]+delta*.08)*100)/100))}
 else if(type==='heading'||type==='track'||type==='course')m[type]=norm(m[type]+delta);
 return m;
}
function initControls(st,core,doc,onchange){const box=doc.getElementById('efis-control-panel');if(!box)return;
 box.innerHTML=`<div class="efis-machine">
  <div class="efis-left">
    <div class="efis-tiny">ADI</div><div class="dh-label">DH REF <output id="efis-dh-display">150</output></div>
    <div class="control-row"><button class="efis-small" data-step="dh:-1" aria-label="Decrease DH">−</button><button class="round-knob dh-knob" data-step="dh:1" title="DH selection: click or wheel">DH</button><button class="efis-small" data-step="dh:1" aria-label="Increase DH">+</button></div>
    <div class="efis-tiny">RST</div><button id="efis-rst" class="efis-round-push" title="DH alert reset">RST</button>
    <div class="efis-tiny">ADI BRT</div><div class="control-row"><button data-step="eadiBrightness:-1">−</button><button class="round-knob small-brt" data-step="eadiBrightness:1" title="ADI brightness">BRT</button><button data-step="eadiBrightness:1">+</button></div><output id="efis-adi-brt">100%</output>
  </div>
  <div class="efis-middle">
    <div class="efis-top-label">HSI • MODE</div><div class="mode-picker">
      <div class="mode-buttons">${MODES.map((v,i)=>`<button class="mode-detent" data-mode="${v}" title="${v}">${({FULL_VOR_ILS:'FULL VOR',EXP_VOR_ILS:'EXP VOR',FULL_NAV:'FULL NAV',EXP_NAV:'EXP NAV',MAP:'MAP',CTR_MAP:'CTR MAP',PLAN:'PLAN'})[v]}</button>`).join('')}</div>
      <div class="selector-center"><button type="button" class="selector-shaft" data-step="mode:1" title="Click to rotate Mode selector">MODE</button><output id="efis-mode-readout">MAP</output></div>
    </div>
    <div class="dual-brt-wrap"><div class="efis-tiny">EHSI BRT: OUTER / WXR BRT: INNER</div>
      <div class="dual-brt"><div class="dual-ring" role="button" tabindex="0" aria-label="EHSI brightness outer ring" data-step="brightness:1" title="Outer ring: EHSI brightness, click or wheel adjusts"><div class="dual-inner" role="button" tabindex="0" aria-label="WXR brightness inner shaft" data-step="wxBrightness:1" title="Inner shaft: WXR brightness, click or wheel adjusts">WXR</div></div></div>
      <div class="brightness-readouts"><label>EHSI <output id="efis-ehsi-brt">100%</output><button data-step="brightness:-1">−</button><button data-step="brightness:1">+</button></label><label>WXR <output id="efis-wxr-brt">100%</output><button data-step="wxBrightness:-1">−</button><button data-step="wxBrightness:1">+</button></label></div>
    </div>
  </div>
  <div class="efis-right"><div class="efis-top-label">RANGE • NM</div>
    <div class="range-picker"><div class="range-buttons">${RANGES.map(v=>`<button class="range-detent" data-range="${v}">${v}</button>`).join('')}</div><button type="button" class="range-shaft" data-step="range:1" title="Click to rotate Range selector">RANGE</button></div>
    <output id="efis-range-readout">40 NM</output><div class="efis-tiny">WXR • TFC</div>
    <div class="efis-row-buttons"><button class="efis-toggle" data-option="wxr">WXR<span class="lamp"></span></button><button class="efis-toggle" data-option="tfc">TFC<span class="lamp"></span></button></div>
    <div class="efis-tiny">SIM SENSOR CONTROLS</div><div class="efis-row-buttons"><button class="efis-toggle" data-efis-toggle="remoteWxr">REMOTE WXR</button><button class="efis-toggle" data-efis-toggle="wxrTransmitter">WXR TX</button></div>
  </div>
  <div class="efis-switch-row"><div class="efis-tiny">MAP SELECTIONS</div><div class="map-select-row">${MAP_OPTIONS.map(o=>`<button class="efis-toggle" data-option="${o}">${({vorAdf:'VOR / ADF',navAid:'NAV AID',arpt:'ARPT',rteData:'RTE DATA',wpt:'WPT'})[o]}<span class="lamp"></span></button>`).join('')}</div></div>
  <div class="efis-trainer-row"><strong>TEST SOURCES</strong><button class="efis-toggle" data-option="demoRoute">SIM ROUTE<span class="lamp"></span></button><label>HDG <input type="range" min="0" max="359" data-sim="heading" value="0"></label><label>TRK <input type="range" min="0" max="359" data-sim="track" value="0"></label><label>CRS <input type="range" min="0" max="359" data-sim="course" value="0"></label><button class="efis-toggle" data-option="terr">TERR</button></div>
 </div>`;
 box.addEventListener('click',ev=>{const b=ev.target.closest('button,[role=button][data-step]');if(!b)return;const m=modelFor(st);
 if(b.dataset.mode){m.mode=b.dataset.mode} else if(b.dataset.range){m.range=Number(b.dataset.range)}
 else if(b.dataset.option){const key=b.dataset.option;m.options[key]=!m.options[key];if(key==='wxr'&&m.options.wxr)m.options.terr=false;if(key==='terr'&&m.options.terr)m.options.wxr=false}
 else if(b.dataset.efisToggle){const k=b.dataset.efisToggle;m.efis[k]=!m.efis[k]}
 else if(b.dataset.step){const [key,inc]=b.dataset.step.split(':');step(st,key,Number(inc))}
 else if(b.id==='efis-rst')m.efis.dhAlert=false;
 onchange()});
 box.addEventListener('keydown',ev=>{if(!['Enter',' '].includes(ev.key))return;const b=ev.target.closest('[role=button][data-step]');if(!b)return;ev.preventDefault();const [key,inc]=b.dataset.step.split(':');step(st,key,Number(inc));onchange()});
 box.addEventListener('wheel',ev=>{const x=ev.target.closest('[data-step]');if(!x)return;ev.preventDefault();const [key]=x.dataset.step.split(':');step(st,key,ev.deltaY<0?1:-1);onchange()},{passive:false});
 box.querySelectorAll('[data-sim]').forEach(x=>x.addEventListener('input',()=>{modelFor(st)[x.dataset.sim]=Number(x.value);onchange()}));
 syncPanel(st,doc);
}
return {MODES,RANGES,COLORS,orientation,defaultModel,normalize,geometry,computeDisplay,render,renderToDom,modelFor,step,syncPanel,initControls};
});