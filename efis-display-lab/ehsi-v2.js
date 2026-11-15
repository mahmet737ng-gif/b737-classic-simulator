/* 737 CLASSIC EHSI RECONSTRUCTION V2 — source-aware training only.
 * Supported renderers: MAP (10.31.2), FULL NAV (10.31.8), PLAN (10.31.18).
 * Source grammar: FCOM 10.32.1–4, 10.40.9–11. No NG/MAX symbology.
 * This vector artwork is a reconstructed teaching representation, not a scan or
 * approved pixel reproduction of proprietary Boeing / Cockpit Companion images.
 * Unsupported modes are explicitly blocked; never relabel the old generic SVG.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.EFISClassicEHSIV2=api;
})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const VERSION='EHSI-CLASSIC-REBUILD-0002';
const MODES=Object.freeze(['MAP','FULL_NAV','PLAN']);
const REFERENCE=Object.freeze({
 MAP:'B737 CL FCOM Vol 2 10.31.2–3; 10.32.1–3; 10.40.9–11',
 FULL_NAV:'B737 CL FCOM Vol 2 10.31.8–9; 10.32.1–4; 10.40.9–11',
 PLAN:'B737 CL FCOM Vol 2 10.31.18–19; 10.32.1–3; 10.40.9–11'
});
const COLORS=Object.freeze({white:'#eff3f7',dim:'#9caab6',green:'#38de78',magenta:'#ee57e9',cyan:'#5bcbe8',amber:'#f8c551',red:'#ec545b',black:'#000000'});
const NS='http://www.w3.org/2000/svg',W=512,H=512;
const LAYOUT=Object.freeze({
 MAP:{name:'Expanded MAP / 70°',reference:'TRACK_UP',roseCenter:[256,438],radius:364,aircraft:[256,433],degrees:70,rose:true,route:true},
 FULL_NAV:{name:'FULL NAV / 360°',reference:'TRACK_UP',roseCenter:[256,269],radius:183,aircraft:[256,269],degrees:360,rose:true,route:false},
 PLAN:{name:'PLAN / true-north chart',reference:'TRUE_NORTH',roseCenter:null,radius:null,aircraft:null,degrees:0,rose:false,route:true}
});
const norm=n=>((Number(n)||0)%360+360)%360;
const rel=n=>((Number(n)+540)%360)-180;
const num=(n, fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
const fmt=(n,pad=3)=>String(Math.round(norm(n))).padStart(pad,'0');
const clamp=(n,min,max)=>Math.max(min,Math.min(max,num(n,min)));
function model(input={}){
 const opts=input.options||{},nav=input.nav||{},efis=input.efis||{},route=input.route||{};
 return {
  mode:String(input.mode||'MAP'),range:Math.max(1,num(input.range,40)),
  heading:norm(input.heading),track:norm(input.track),selectedHeading:norm(input.selectedHeading??input.heading),
  course:norm(input.course),nav:{valid:!!nav.valid,source:nav.source||'NAV',ident:nav.ident||'',cdi:clamp(nav.cdi||0,-2.5,2.5)},
  route:{source:String(route.source||'none'),points:Array.isArray(route.points)?route.points.map((p,i)=>({
   name:String(p.name||'FIX'+i).slice(0,9),x:clamp(p.x,-320,320),y:clamp(p.y,-320,320)})).slice(0,24):[],activeIndex:clamp(route.activeIndex||0,0,23)},
  options:{wpt:!!opts.wpt,arpt:!!opts.arpt,navAid:!!opts.navAid,vorAdf:!!opts.vorAdf,rteData:!!opts.rteData,wxr:!!opts.wxr,terr:!!opts.terr,tfc:!!opts.tfc},
  flags:{sgValid:efis.sgValid!==false,headingValid:efis.headingValid!==false,trackValid:efis.trackValid!==false,displayPower:efis.displayPower!==false},
  brightness:clamp(efis.brightness??1,.18,1)
 };
}
function computeDisplay(input){
 const m=model(input),supported=MODES.includes(m.mode);
 const ref=m.mode==='PLAN'?'TRUE_NORTH':m.mode==='FULL_NAV'?'TRACK_UP':'TRACK_UP';
 const orientationValid=m.mode==='PLAN'?true:!!m.flags.headingValid&&!!m.flags.trackValid;
 const routeValid=!!m.nav.valid && orientationValid && m.route.points.length>0;
 return {version:VERSION,mode:m.mode,supported,orientation:ref,
  compassHeadingReference:m.mode==='FULL_NAV'?'HEADING':'TRACK',
  has70DegreeArc:m.mode==='MAP',hasFullCompass:m.mode==='FULL_NAV',
  northUp:m.mode==='PLAN',layout:supported?LAYOUT[m.mode]:null,
  powered:m.flags.displayPower,sgValid:m.flags.sgValid,
  orientationValid,headingValid:m.flags.headingValid,trackValid:m.flags.trackValid,
  navValid:m.nav.valid,routeValid,
  wptDatabaseEligible:m.options.wpt&&m.range<=40,
  headingBugLineVisible:supported&&m.mode!=='PLAN'&&orientationValid,
  range:m.range,source:REFERENCE[m.mode]||'PENDING CLASSIC FCOM AUDIT',
  approval:'VISUAL_REFERENCE_PIXEL_QA_PENDING'};
}
function make(parent,tag,attrs={},value){
 const doc=parent.ownerDocument||document;
 const n=doc.createElementNS(NS,tag);
 for(const [key,raw] of Object.entries(attrs))if(raw!==undefined&&raw!==null)n.setAttribute(key,String(raw));
 if(value!==undefined)n.textContent=String(value);
 parent.appendChild(n);return n;
}
function layer(svg,id){return make(svg,'g',{'data-segment':id});}
function path(svg,d,color=COLORS.white,width=1.5,fill='none',more={}){
 return make(svg,'path',{d,stroke:color,'stroke-width':width,fill,'stroke-linecap':'round','stroke-linejoin':'round',...more});
}
function line(svg,x1,y1,x2,y2,color=COLORS.white,width=1.7,more={}){
 return make(svg,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,'stroke-linecap':'round',...more});
}
function text(svg,value,x,y,size=15,color=COLORS.white,align='start',other={}){
 return make(svg,'text',{x,y,fill:color,'font-family':'Arial Narrow, Roboto Condensed, Helvetica Neue, Arial, sans-serif',
 'font-size':size,'font-weight':'400','text-anchor':align,'dominant-baseline':'middle','letter-spacing':'.35',...other},value);
}
function dot(svg,x,y,r=2.3,color=COLORS.white){
 return make(svg,'circle',{cx:x,cy:y,r,stroke:color,'stroke-width':1.3,fill:'none'});
}
function polar(cx,cy,angle,r){const t=(angle-90)*Math.PI/180;return [cx+Math.cos(t)*r,cy+Math.sin(t)*r]}
function arrowTop(svg,x,y,color=COLORS.white,size=8,fill='none'){
 path(svg,'M'+(x-size)+' '+(y+size)+' L'+x+' '+(y-size)+' L'+(x+size)+' '+(y+size),color,2,fill);
}
function plane(svg,cx,cy){
 const g=layer(svg,'aircraft');
 // Boeing CL EHSI uses a small hollow triangle, NOT a detailed jet silhouette.
 path(g,'M'+cx+' '+(cy-19)+' L'+(cx-12)+' '+(cy+14)+' L'+(cx+12)+' '+(cy+14)+' Z',COLORS.white,2.4,'#000000');
 return g;
}
function header(svg,m,status){
 const g=layer(svg,'header');
 const named=m.route.points[m.route.activeIndex]||m.route.points[0];
 if(m.nav.valid&&named){
  const distance=Math.hypot(named.x,named.y).toFixed(1);
  text(g,distance+' NM',18,19,17,COLORS.white);
  text(g,named.name,18,43,15,COLORS.magenta);
 } else {
  text(g,m.nav.valid?'DME ----':'---.- NM',18,19,15,COLORS.white);
 }
 text(g,'TRK',188,20,18,COLORS.green,'end');
 if(m.flags.trackValid){
  text(g,fmt(m.track),254,20,22,COLORS.white,'middle');
  line(g,218,7,218,34,COLORS.white,1.2);
  line(g,293,7,293,34,COLORS.white,1.2);
 }else{text(g,'---',254,20,22,COLORS.amber,'middle');}
 text(g,'M',312,20,18,COLORS.green);
 text(g,'----.-Z',493,19,16,COLORS.white,'end');
 // Static test values must not masquerade as a flight-computer time or ETA.
 text(g,'TRAINING',494,40,11,COLORS.dim,'end');
 return g;
}
function bottom(svg,m,mode){
 const g=layer(svg,'lower-data');
 if(mode==='PLAN'){
  text(g,'PLAN',18,489,14,COLORS.green);
  text(g,'NORTH UP',494,489,13,COLORS.cyan,'end');
  return;
 }
 text(g,'---°/--',18,454,14,COLORS.dim);
 text(g,mode==='FULL_NAV'?'NAV':'FMC',18,478,16,COLORS.green);
 if(mode==='MAP')text(g,'DME ----',18,499,12,COLORS.dim);
 if(mode==='FULL_NAV')text(g,'0.5',430,458,13,COLORS.white,'end');
 if(mode==='FULL_NAV')text(g,'0.6',430,480,13,COLORS.white,'end');
}
function headingBug(svg,cx,cy,r,delta,drawLine=true){
 const g=layer(svg,'heading-bug');
 // A bracket around the selected heading on the ring plus a magenta dashed radial.
 const a=rel(delta);
 if(drawLine==='ARC'&&Math.abs(a)>35)return g;
 const marker=make(g,'g',{transform:'rotate('+a+' '+cx+' '+cy+')'});
 const y=cy-r;
 path(marker,'M'+(cx-10)+' '+(y-9)+' V'+(y+4)+' H'+(cx+10)+' V'+(y-9),COLORS.magenta,2.6);
 if(drawLine)line(marker,cx,y+15,cx,cy-24,COLORS.magenta,1.5,{'stroke-dasharray':'3 7',opacity:.82});
 return g;
}
function headingPointer(svg,cx,cy,r,delta){
 const g=layer(svg,'heading-pointer');
 const marker=make(g,'g',{transform:'rotate('+rel(delta)+' '+cx+' '+cy+')'});
 const y=cy-r;
 path(marker,'M'+(cx-7)+' '+(y-2)+' L'+cx+' '+(y+13)+' L'+(cx+7)+' '+(y-2),COLORS.white,1.8);
 return g;
}
function arcRose(svg,m){
 const g=layer(svg,'compass-rose');
 const cx=256,cy=438,r=364,ref=m.track;
 // Exactly 70° compass arc; show ticks every five degrees on the moving scale.
 const parts=[];for(let a=-35;a<=35;a+=1){const p=polar(cx,cy,a,r);parts.push((a===-35?'M':'L')+p[0].toFixed(2)+' '+p[1].toFixed(2))}
 path(g,parts.join(' '),COLORS.white,1.8);
 for(let hdg=0;hdg<360;hdg+=5){
  const delta=rel(hdg-ref);if(Math.abs(delta)>35)continue;
  const major=hdg%10===0,size=major?14:7;
  const [x1,y1]=polar(cx,cy,delta,r),[x2,y2]=polar(cx,cy,delta,r-size);
  line(g,x1,y1,x2,y2,COLORS.white,major?1.9:1.1);
  if(major){const [x,y]=polar(cx,cy,delta,r-35);text(g,String(hdg/10),x,y+2,18,COLORS.white,'middle')}
 }
 // Track line and dual half/quarter numeric range scales, not radar sweep circles.
 const range=layer(svg,'range-scale');
 line(range,cx,80,cx,415,COLORS.white,1.3,{opacity:.85});
 for(const fraction of [.25,.5]){
  const yy=438-r*fraction;
  line(range,cx-11,yy,cx+11,yy,COLORS.white,1.2);
  text(range,String(m.range*fraction).replace(/\.0$/,''),cx+20,yy-1,16,COLORS.white);
 }
 return {cx,cy,r};
}
function fullRose(svg,m){
 const g=layer(svg,'compass-rose');
 const cx=256,cy=270,r=183,ref=m.heading;
 make(g,'circle',{cx,cy,r,fill:'none',stroke:COLORS.white,'stroke-width':'1.45'});
 for(let hdg=0;hdg<360;hdg+=5){
  const a=rel(hdg-ref),major=hdg%30===0;
  const [x,y]=polar(cx,cy,a,r),[x2,y2]=polar(cx,cy,a,r-(major?14:7));
  line(g,x,y,x2,y2,COLORS.white,major?1.8:1.0);
  if(major){const [tx,ty]=polar(cx,cy,a,r-33);text(g,String(hdg/10===0?36:hdg/10),tx,ty+2,17,COLORS.white,'middle')}
 }
 // Fixed 45-degree angle indices, independent from rotating rose.
 const fixed=layer(svg,'fixed-index');
 for(let a=0;a<360;a+=45){const [x1,y1]=polar(cx,cy,a,r+8),[x2,y2]=polar(cx,cy,a,r+16);line(fixed,x1,y1,x2,y2,COLORS.white,2);}
 return {cx,cy,r};
}
function routePoint(svg,x,y,name,active){
 const col=active?COLORS.magenta:COLORS.cyan;
 const g=layer(svg,'waypoint');
 path(g,'M'+x+' '+(y-6)+' L'+(x+6)+' '+y+' L'+x+' '+(y+6)+' L'+(x-6)+' '+y+' Z',col,1.9,'#000000');
 text(g,name,x+10,y-11,13,col);
 return g;
}
function navOptions(svg,m,cx,cy,scale,clip='expanded'){
 const g=layer(svg,'database-options');
 if(m.options.wpt&&m.range<=40){const x=cx-16*scale,y=cy-16*scale;if(x>15&&x<495&&y>70&&y<450){
  routePoint(g,x,y,'WPT',false);
 }}
 if(m.options.arpt){const x=cx+14*scale,y=cy-17*scale;if(x>18&&x<494&&y>68&&y<442){
  make(g,'circle',{cx:x,cy:y,r:6,fill:'none',stroke:COLORS.cyan,'stroke-width':1.4});
  text(g,'ARPT',x+9,y-5,13,COLORS.cyan);
 }}
 if(m.options.navAid){const x=cx-11*scale,y=cy-26*scale;if(x>18&&x<494&&y>69&&y<442){
  path(g,'M'+x+' '+(y-7)+' L'+(x-7)+' '+(y+5)+' L'+(x+7)+' '+(y+5)+' Z',COLORS.green,1.3);
  text(g,'VOR',x+9,y-8,13,COLORS.green);
 }}
 return g;
}
function routeExpanded(svg,m){
 const map=layer(svg,'active-route'),cx=256,cy=438,scale=364/m.range;
 const pts=m.route.points.map(pt=>({x:cx+pt.x*scale,y:cy-pt.y*scale,name:pt.name}));
 const filtered=pts.filter(pt=>pt.x>-25&&pt.x<540&&pt.y>52&&pt.y<490);
 // SVG clip prevents a route leg from spilling into upper textual headings.
 const g=make(map,'g',{'clip-path':'url(#classic-ehsi-map-clip)'});
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],active=i-1<=m.route.activeIndex;
  line(g,a.x,a.y,b.x,b.y,active?COLORS.magenta:COLORS.cyan,2.0,active?{}:{'stroke-dasharray':'6 6'});
 }
 for(let i=0;i<pts.length;i++){
  const p=pts[i];
  if(p.x<25||p.x>474||p.y<85||p.y>415)continue;
  routePoint(g,p.x,p.y,p.name,i===m.route.activeIndex);
 }
 return {points:filtered.length,segments:Math.max(0,pts.length-1),screenPositions:pts};
}
function drawMap(svg,m){
 const g=layer(svg,'map-presentation'),{cx,cy,r}=arcRose(g,m);
 headingPointer(g,cx,cy,r,rel(m.heading-m.track));
 if(Math.abs(rel(m.selectedHeading-m.track))<=35)headingBug(g,cx,cy,r,rel(m.selectedHeading-m.track),true);
 if(m.nav.valid&&m.route.points.length)routeExpanded(g,m);
 if(m.nav.valid)navOptions(g,m,cx,cy,r/m.range);
 plane(g,cx,432);
 bottom(g,m,'MAP');
}
function courseNeedle(svg,m,cx,cy,r){
 const g=layer(svg,'course-deviation');
 const delta=rel(m.course-m.heading);
 const n=make(g,'g',{transform:'rotate('+delta+' '+cx+' '+cy+')'});
 line(n,cx,cy-r+55,cx,cy-r+102,COLORS.magenta,2.2);
 path(n,'M'+(cx-8)+' '+(cy-r+60)+' L'+cx+' '+(cy-r+44)+' L'+(cx+8)+' '+(cy-r+60),COLORS.magenta,1.4,COLORS.magenta);
 line(n,cx,cy+58,cx,cy+r-51,COLORS.magenta,2.2);
 for(let i=-2;i<=2;i++)if(i!==0)dot(n,cx+i*27,cy,3,COLORS.white);
 const dev=clamp(m.nav.cdi,-2.5,2.5)*27;
 if(m.nav.valid)line(n,cx+dev,cy-49,cx+dev,cy+49,COLORS.magenta,3);
}
function drawFullNav(svg,m){
 const g=layer(svg,'full-nav-presentation'),{cx,cy,r}=fullRose(g,m);
 headingPointer(g,cx,cy,r,rel(m.track-m.heading));
 headingBug(g,cx,cy,r,rel(m.selectedHeading-m.heading),true);
 courseNeedle(g,m,cx,cy,r);
 plane(g,cx,cy);
 bottom(g,m,'FULL_NAV');
 if(!m.nav.valid)text(g,'FMC DATA',256,415,16,COLORS.amber,'middle');
}
function planRoute(svg,m){
 const g=layer(svg,'plan-route'),pts=m.route.points;
 if(!pts.length)return;
 // Source test points are east/north NM; PLAN intentionally ignores aircraft track.
 // Route is centered in a true-north frame and does not rotate with heading.
 const centerX=pts.reduce((a,p)=>a+p.x,0)/pts.length;
 const centerY=pts.reduce((a,p)=>a+p.y,0)/pts.length;
 const scale=212/m.range;
 const coord=p=>[256+(p.x-centerX)*scale,276-(p.y-centerY)*scale];
 const positions=pts.map(coord);
 for(let i=1;i<positions.length;i++){
  const [x1,y1]=positions[i-1],[x2,y2]=positions[i];
  line(g,x1,y1,x2,y2,i-1<=m.route.activeIndex?COLORS.magenta:COLORS.cyan,2.0);
 }
 for(let i=0;i<positions.length;i++){
  const [x,y]=positions[i];if(x<35||x>470||y<78||y>465)continue;
  routePoint(g,x,y,pts[i].name,i===m.route.activeIndex);
 }
 return positions;
}
function drawPlan(svg,m){
 const g=layer(svg,'plan-presentation');
 // The PLAN page does not inherit the expanded/map compass rose, range circles,
 // track-up airplane or magenta heading-to-airplane dashed line.
 // Heading/track info stays in the fixed header; route geometry is north up.
 const north=layer(g,'true-north');
 text(north,'N',462,118,18,COLORS.white,'middle');
 line(north,462,140,462,178,COLORS.white,1.8);
 path(north,'M455 153 L462 140 L469 153',COLORS.white,1.8,COLORS.white);
 // Frame corner references remain restrained and do not imply radar range arcs.
 line(g,40,82,472,82,COLORS.dim,.8,{opacity:.35});
 line(g,40,463,472,463,COLORS.dim,.8,{opacity:.35});
 if(m.nav.valid&&m.route.points.length)planRoute(g,m);
 bottom(g,m,'PLAN');
}
function render(svg,raw){
 if(!svg)return null;
 const m=model(raw),s=computeDisplay(raw); // Preserve raw EFIS flags; never normalize a normalized model twice.
 svg.replaceChildren();
 svg.setAttribute('viewBox','0 0 512 512');
 svg.setAttribute('data-renderer',VERSION);
 svg.setAttribute('data-mode',m.mode);
 svg.setAttribute('data-approved','false');
 svg.setAttribute('aria-label','B737 Classic '+m.mode+' EHSI reconstructed display, simulated inputs');
 svg.style.background=COLORS.black;
 svg.style.opacity=String(m.brightness);
 make(svg,'rect',{x:0,y:0,width:W,height:H,fill:COLORS.black,'data-segment':'background'});
 if(!s.powered)return s;
 if(!s.sgValid){text(layer(svg,'failure'),'SG FAIL',256,256,25,COLORS.amber,'middle');return s}
 if(!s.supported){
  text(layer(svg,'pending'),'CLASSIC '+m.mode.replaceAll('_',' '),256,212,20,COLORS.white,'middle');
  text(layer(svg,'pending'),'PENDING MODE REBUILD',256,253,21,COLORS.amber,'middle');
  text(layer(svg,'pending'),'NO GENERIC FALLBACK',256,283,15,COLORS.dim,'middle');
  return s;
 }
 const defs=make(svg,'defs');
 const clip=make(defs,'clipPath',{id:'classic-ehsi-map-clip'});
 make(clip,'rect',{x:8,y:62,width:496,height:405});
 header(svg,m,s);
 if(!s.orientationValid){
  text(layer(svg,'failure'),'HEADING / TRACK INVALID',256,262,19,COLORS.amber,'middle');
  return s;
 }
 if(m.mode==='MAP')drawMap(svg,m);
 else if(m.mode==='FULL_NAV')drawFullNav(svg,m);
 else if(m.mode==='PLAN')drawPlan(svg,m);
 if(!m.nav.valid)text(layer(svg,'failure'),'FMC / NAV DATA',256,382,18,COLORS.amber,'middle');
 if(m.options.wxr)text(layer(svg,'weather-status'),'WXR DATA UNAVAILABLE',256,397,13,COLORS.amber,'middle');
 if(m.options.terr)text(layer(svg,'terrain-status'),'TERRAIN DATA UNAVAILABLE',256,419,12,COLORS.amber,'middle');
 if(m.options.tfc)text(layer(svg,'traffic-status'),'TFC',18,92,12,COLORS.green);
 return s;
}
return {VERSION,COLORS,MODES,REFERENCE,LAYOUT,norm,rel,model,computeDisplay,render};
});
