/* Classic EHSI render pipeline, grounded in Sepehran FCOM 10.31–10.32 and 10.40. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./glyphs.js'):root.EFISLabGlyphs,
  typeof module==='object'&&module.exports?require('./reference-geometry.js').ehsi:root.B737EfisReferenceGeometry.ehsi);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.EFISClassicEHSIV2=api;
})(globalThis,function(glyph,G){
'use strict';
const VERSION='EHSI-CLASSIC-REBUILD-0011-FCOM-1031-FULL-NAV';
const COLORS=glyph.colors;
const W=512,H=512,NS='http://www.w3.org/2000/svg';
// Active EHSI aperture in the two 1920 x 1080 owner-supplied reference frames.
const FRAME=Object.freeze({left:390,top:64,width:900,height:837});
const px=n=>n*W/FRAME.width,py=n=>n*H/FRAME.height;
const PHOTO_COLORS=Object.freeze({...COLORS,...G.palette});
const DISPLAY_ASPECT=350/411;
const MAP_ID_SIZE=G.labels.waypoint,MAP_DETAIL_SIZE=G.labels.detail;
const EXPANDED=Object.freeze({...G.expanded,route:true,aircraft:G.expanded.roseCenter,calibrated:true});
const FULL=Object.freeze({...G.full,route:false,aircraft:G.full.roseCenter,full:true});
const PLAN={...EXPANDED,aircraft:null,rose:false,planCompass:true};
const LAYOUT=Object.freeze({
 MAP:EXPANDED,
 CTR_MAP:{...G.centerMap,route:true,aircraft:G.centerMap.roseCenter,calibrated:true},
 EXP_NAV:{...EXPANDED,route:false},
 FULL_NAV:FULL,
 EXP_VOR_ILS:{...EXPANDED,route:false},
 FULL_VOR_ILS:FULL,
 PLAN
});
// Opt-in TCAS trainer geometry, leaving validated Unified/EFIS Lab unchanged.
function layoutFor(m){
 const base=LAYOUT[m.mode];
 if(!m.trainingRoseLarge)return base;
 if(m.mode==='CTR_MAP')return {...base,roseCenter:[256,290],aircraft:[256,290],radius:189,radiusX:211};
 if(m.mode==='EXP_NAV')return {...base,route:true};
 if(m.mode==='FULL_NAV')return {...base,roseCenter:[256,288],aircraft:[256,288],
  radius:183,radiusX:199,route:m.routeOnFull===true,calibrated:true};
 return base;
}
const MODES=Object.freeze(Object.keys(LAYOUT));
const REFERENCE=Object.freeze({
 MAP:'10.31.2–3',CTR_MAP:'10.31.4–5',EXP_NAV:'10.31.6–7',FULL_NAV:'10.31.8–9',
 EXP_VOR_ILS:'10.31.10–11 / 10.31.14–15',FULL_VOR_ILS:'10.31.12–13 / 10.31.16–17',PLAN:'10.31.18–19'
});
const norm=n=>((Number(n)||0)%360+360)%360;
const rel=n=>norm(Number(n)+180)-180;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const direction=n=>String(norm(Math.round(n))).padStart(3,'0');
const rad=n=>n*Math.PI/180;
const polar=(cx,cy,a,r)=>[cx+Math.sin(rad(a))*r,cy-Math.cos(rad(a))*r];
function rosePoint(l,angle,fraction=1){
 const [cx,cy]=l.roseCenter;
 return [cx+Math.sin(rad(angle))*(l.radiusX??l.radius)*fraction,cy-Math.cos(rad(angle))*l.radius*fraction];
}
function roseTangent(l,angle){
 return Math.atan2(l.radius*Math.sin(rad(angle)),(l.radiusX??l.radius)*Math.cos(rad(angle)))*180/Math.PI;
}

function model(input={}){
 const {nav={},options={},route={},efis={},weather={},traffic={}}=input;
 const mode=MODES.includes(input.mode)?input.mode:'MAP',radio=mode.includes('VOR_ILS');
 return {...input,mode,range:input.range||40,nav,options,
  route:{points:[],activeIndex:0,centerIndex:0,...route},efis,weather,traffic,
  radio,modeName:radio?mode.replace('VOR_ILS',nav.type==='ILS'?'ILS':'VOR'):mode,
  reference:radio?norm(input.heading):norm(input.track)};
}
function computeDisplay(input){
 const m=model(input),l=layoutFor(m),plan=m.mode==='PLAN';
 const headingValid=m.efis.headingValid!==false,trackValid=m.efis.trackValid!==false;
 const compassValid=m.radio?headingValid:trackValid;
 const trafficMode=['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(m.mode)||
  (m.mode==='FULL_NAV'&&m.routeOnFull===true);
 return {version:VERSION,mode:m.mode,presentation:m.modeName,supported:MODES.includes(input.mode),
  orientation:plan?'TRUE_NORTH':m.radio?'HEADING_UP':'TRACK_UP',
  compassHeadingReference:m.radio?'HEADING':'TRACK',has70DegreeArc:l.degrees===70,
  hasFullCompass:l.degrees===360,northUp:plan,layout:l,
  powered:m.efis.displayPower!==false,sgValid:m.efis.sgValid!==false,
  orientationValid:plan||compassValid,compassValid,headingValid,trackValid,
  trackSource:m.efis.trackSource,navValid:!!m.nav.valid,
  routeValid:l.route&&!!m.nav.valid&&(plan||compassValid)&&m.route.points.length>0,
  wptDatabaseEligible:l.route&&!!m.options.wpt&&m.range<=40,
  headingBugLineVisible:!plan&&compassValid,
  wxrVisible:!!m.weather.visible&&compassValid,terrainVisible:!!m.weather.terrain&&compassValid,
  trafficOverlay:trafficMode&&compassValid&&!!m.options.tfc&&['TA_RA','TA_ONLY','TEST'].includes(m.traffic.mode),
  range:m.range,source:'Sepehran FCOM '+REFERENCE[m.mode],approval:'VISUAL_REFERENCE_PIXEL_QA_PENDING'};
}
function make(parent,tag,attrs={},value){
 const e=parent.ownerDocument.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)e.setAttribute(k,String(v));
 if(value!==undefined)e.textContent=String(value);
 parent.appendChild(e);return e;
}
const layer=(parent,id,attrs={})=>make(parent,'g',{'data-segment':id,...attrs});
const line=(p,x1,y1,x2,y2,color=COLORS.white,w=1.7,attrs={})=>make(p,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':w,...attrs});
const circle=(p,cx,cy,r,color=COLORS.white,fill='none')=>make(p,'circle',{cx,cy,r,stroke:color,'stroke-width':1.65,fill});
const polygon=(p,pts,color=COLORS.white,fill='none',w=1.8)=>make(p,'polygon',{points:pts.map(q=>q.join(',')).join(' '),fill,stroke:color,'stroke-width':w,'stroke-linejoin':'round'});
function stroke(p,points,color=COLORS.white,w=1.65,attrs={}){
 return make(p,'polyline',{points:points.map(q=>q.map(k=>k.toFixed(2)).join(',')).join(' '),stroke:color,'stroke-width':w,fill:'none','stroke-linejoin':'round',...attrs});
}
function text(p,value,x,y,size=17,color=COLORS.white,align='start'){
 if(value===null||value===undefined||value==='')return;
 const g=make(p,'g',{'data-text':String(value),'aria-label':String(value),'font-size':size,'data-x':x,'data-y':y});
 make(g,'title',{},value);
 return make(g,'path',{d:glyph.svg(value,x,y,size,align,.84),fill:'none',stroke:color,'stroke-width':Math.max(.8,size/12.5),'stroke-linecap':'round','stroke-linejoin':'round'});
}
function flag(p,value,x,y){
 const width=value.length*11+12;
 make(p,'rect',{x:x-width/2,y:y-12,width,height:24,fill:COLORS.black,stroke:COLORS.amber,'stroke-width':1.3});
 text(p,value,x,y,17,COLORS.amber,'middle');
}
const photoText=(p,value,x,y,size,color=PHOTO_COLORS.white,align='start')=>text(p,value,x,y,size,color,align);
const numberText=(n,digits=0)=>Number.isFinite(n)?n.toFixed(digits):'---';
function header(svg,m,status){
 const l=layoutFor(m),h=G.header;
 const active=m.nav.valid?m.route.points[m.route.activeIndex]:null;
 const distance=active?Math.hypot(active.x,active.y):null;
 const fmcDistance=Number.isFinite(m.nav.activeDistanceNm)?m.nav.activeDistanceNm:distance;
 const left=m.radio?'DME'+numberText(m.nav.valid?m.nav.dme:null,1):
  numberText(fmcDistance,1)+' NM';
 const g=layer(svg,'header');
 photoText(g,left,h.left+70,h.top,23,PHOTO_COLORS.white,'end');
 if(!m.radio){
  const eta=m.nav.activeEta??active?.eta??'----Z';
  photoText(g,String(eta),h.right,h.top,23,PHOTO_COLORS.white,'end');
  if(m.mode==='FULL_NAV'){
   const name=m.nav.activeWaypoint??active?.name;
   if(name&&m.nav.valid)photoText(g,String(name),h.left,h.top+27,22,PHOTO_COLORS.magenta);
  }
  // Instructor FMC route may supply dynamic time-to-go; unchanged if absent.
  if(m.nav.timeToGo)photoText(g,'TTG '+String(m.nav.timeToGo),76,485,18,PHOTO_COLORS.white);
 }
 if(m.mode==='PLAN')return;
 // FULL NAV 10.31.8 has waypoint name/distance and ETA, not TAS/GS
 // (the latter belong to other instrument presentations).
 if(m.mode!=='FULL_NAV'){
  photoText(g,'TAS'+numberText(m.trueAirspeed),h.left,h.second,22);
  photoText(g,'GS'+numberText(m.groundSpeed),h.right,h.second,22,PHOTO_COLORS.white,'end');
 }
 const key=m.radio?'HDG':'TRK',y=l.full?h.radioFullHeading:h.heading;
 if(!status.compassValid){flag(g,key,256,y);return;}
 const index=layer(g,'track-readout');
 stroke(index,[[225,y-17],[225,y+14],[241,y+14],[256,y+26],[271,y+14],[287,y+14],[287,y-17]],PHOTO_COLORS.white,1.75);
 photoText(index,key,219,y+2,23,PHOTO_COLORS.green,'end');
 photoText(index,direction(m.reference),256,y,27,PHOTO_COLORS.white,'middle');
 photoText(index,m.trueRef?'TRU':'M',294,y+2,23,PHOTO_COLORS.green);
 const end=l.roseCenter[1]-l.radius;
 const spine=l.route?l.roseCenter[1]-4:end-6;
 if(spine>y+26)line(index,256,y+26,256,spine,PHOTO_COLORS.white,1.5);
}
function mapRange(svg,m,l){
 const g=layer(svg,'range-scale'),[cx,cy]=l.roseCenter;
 const centered=m.mode==='CTR_MAP';
 if(!centered){
  for(const fraction of [.25,.5,.75]){
   const edge=Math.asin(Math.min(1,198/(l.radiusX*fraction)))*180/Math.PI;
   stroke(g,Array.from({length:61},(_,i)=>rosePoint(l,edge*(i/30-1),fraction)),PHOTO_COLORS.white,1.65);
  }
 }
 const half=rosePoint(l,0,.5)[1];
 photoText(g,String(m.range/2),cx-6,half-(centered?0:13),23,PHOTO_COLORS.white,'end');
 if(centered){
  line(g,cx-8,half,cx+6,half,PHOTO_COLORS.white,1.6);
  const bottom=rosePoint(l,180,.5)[1];
  line(g,cx-8,bottom,cx+6,bottom,PHOTO_COLORS.white,1.6);
  line(g,cx,bottom,cx,cy+l.radius-4,PHOTO_COLORS.white,1.6);
  photoText(g,String(m.range/2),cx-9,bottom,23,PHOTO_COLORS.white,'end');
 }
}
function mapMarker(p,l,angle,id,fraction=1){
 const [x,y]=rosePoint(l,angle,fraction);
 return layer(p,id,{transform:'translate('+x+' '+y+') rotate('+roseTangent(l,angle)+')'});
}
function selectedHeadingPresentation(m,l){
 // The expanded compass displays only 70° at a time, but the selected MCP
 // heading is a circular 000...359° command. Never gate the radial magenta
 // heading vector on whether its triangle currently fits on that 70° arc.
 // See owner FSX reference: an off-scale selected heading retains its dashed
 // direction cue inside the glass while the off-arc triangle is withheld.
 const delta=Number.isFinite(m.selectedHeading)?rel(m.selectedHeading-m.reference):null;
 const onArc=delta!==null&&Math.abs(delta)<=l.degrees/2;
 return {delta,onArc,offScale:delta!==null&&!onArc,
  // FCOM 10.32.2: dashed magenta selected-heading reference line in
  // every mode except PLAN, including the 360-degree FULL NAV rose.
  vectorVisible:delta!==null&&!l.planCompass,
  vectorLength:onArc ? 0.92 : 1.25};
}
function compass(svg,m,l){
 const g=layer(svg,l.planCompass?'plan-compass':'compass-rose');
 const half=l.degrees/2,centered=m.mode==='CTR_MAP',full=l.degrees===360,ref=l.planCompass?0:m.reference;
 if(!full)stroke(g,Array.from({length:l.degrees+1},(_,i)=>rosePoint(l,i-half)),PHOTO_COLORS.white,1.9);
 for(let bearing=0;bearing<360;bearing+=centered?10:5){
  const angle=rel(bearing-ref);
  if(Math.abs(angle)>half)continue;
  const numbered=bearing%30===0,major=bearing%10===0;
  const length=centered?.054:full?(major?.15:.09):(major?.058:.027);
  if(!centered||!numbered)line(g,...rosePoint(l,angle),...rosePoint(l,angle,1-length),PHOTO_COLORS.white,1.65);
  if(!numbered)continue;
  const [x,y]=rosePoint(l,angle,centered?1.008:full?.73:.855);
  const label=make(g,'g',{transform:'rotate('+roseTangent(l,angle)+' '+x+' '+y+')'});
  photoText(label,String(bearing/10),x,y,full?(centered?G.labels.center:G.labels.full):G.labels.expanded,PHOTO_COLORS.white,'middle');
 }
 // 10.32.23: MAP range arcs are always present; expanded NAV/VOR-ILS
 // range arcs require WXR or TFC selected on the EFIS control panel.
 if((l.route&&!l.planCompass)||
  (['EXP_NAV','EXP_VOR_ILS'].includes(m.mode)&&(m.options.wxr||m.options.tfc)))mapRange(g,m,l);
 const otherAngle=rel((m.radio?m.track:m.heading)-ref);
 const known=m.radio?m.efis.trackValid!==false:m.efis.headingValid!==false;
 if(!l.planCompass&&known&&Math.abs(otherAngle)<=half){
  const mark=mapMarker(g,l,otherAngle,'heading-pointer',1.035);
  polygon(mark,[[0,-6],[4,0],[0,6],[-4,0]],PHOTO_COLORS.white,'none',1.7);
 }
 const heading=selectedHeadingPresentation(m,l);
 if(heading.onArc&&!l.planCompass){
  const bug=mapMarker(g,l,heading.delta,'heading-bug');
  const size=full?8:7;
  polygon(bug,[[0,-2],[-size,12],[size,12]],PHOTO_COLORS.magenta,'none',1.9);
 }

 // Off-scale: ONLY the dashed heading vector remains. Neither a
 // magenta edge triangle nor an arrow is drawn until the selected MCP
 // heading re-enters the visible compass arc.
 if(heading.vectorVisible){
  // Clip the vector to the calibrated EHSI glass, NOT to the ±35° compass
  // arc. A selected heading at 100/180/260 degrees off the bow still gives
  // an angular directional cue (even after crossing 359° -> 000°).
  const vector=layer(g,'selected-heading-vector',{
   'clip-path':'url(#'+(svg.id||'ehsi')+'-plot)'});
  line(vector,...rosePoint(l,heading.delta,heading.vectorLength),
   ...rosePoint(l,heading.delta,.08),PHOTO_COLORS.magenta,1.5,
   {'stroke-dasharray':'8 18','data-segment':'heading-bug-vector',
    'data-heading-offscale':String(heading.offScale),
    'data-relative-heading':heading.delta});
 }
}
function navPointers(svg,m,l){
 if(m.mode==='PLAN'||(l.route&&!m.options.vorAdf))return;
 const g=layer(svg,'nav-bearing-pointers'),limit=l.degrees/2;
 for(const entry of m.bearings||[]){
  if(!Number.isFinite(entry.angle)||![1,2].includes(entry.channel))continue;
  const angle=rel(entry.angle-m.reference);
  if(Math.abs(angle)<=limit){
   const h=mapMarker(g,l,angle,'nav'+entry.channel+'-head',1.035);
   if(entry.channel===1)stroke(h,[[-5,2],[0,-5],[5,2],[0,-5],[0,26]],PHOTO_COLORS.green,1.9);
   else polygon(h,[[0,-6],[-5,1],[-5,24],[5,24],[5,1]],PHOTO_COLORS.green,'none',1.8);
  }
  const tailAngle=rel(angle+180);
  if(Math.abs(tailAngle)>limit)continue;
  const t=mapMarker(g,l,tailAngle,'nav'+entry.channel+'-tail',1.02);
  const base=entry.channel===1?[[-9,-10],[-3,-10],[-3,-3],[3,-3],[3,-10],[9,-10],[9,-4],[4,2],[4,23],[0,27],[-4,23],[-4,2],[-9,-4]]:
   [[-9,-10],[0,-5],[9,-10],[9,-2],[4,4],[4,23],[0,27],[-4,23],[-4,4],[-9,-2]];
  polygon(t,base,PHOTO_COLORS.green,'none',1.85);
 }
}
function waypointBearingPointer(svg,m,l){
 // 10.31.9 item 11 / 10.32.6: magenta pointer only for an active,
 // validated FMC waypoint. This is separate from green ADF heads/tails.
 if(!['FULL_NAV','EXP_NAV'].includes(m.mode)||m.nav.valid!==true||
  !Number.isFinite(m.waypointBearing))return;
 const angle=rel(m.waypointBearing-m.reference);
 if(Math.abs(angle)>l.degrees/2)return;
 const g=layer(svg,'active-waypoint-bearing');
 const h=mapMarker(g,l,angle,'waypoint-bearing-pointer',.93);
 polygon(h,[[0,-12],[-6,2],[0,-1],[6,2]],PHOTO_COLORS.magenta,'none',1.9);
}
function aircraft(svg,l,full){
 if(!l.aircraft)return;
 const [cx,cy]=l.aircraft,g=layer(svg,'aircraft');
 if(l.calibrated){
  polygon(g,[[cx,cy],[cx-13,cy+33],[cx+13,cy+33]],PHOTO_COLORS.white,'none',1.7);
 }else if(full){
  line(g,cx,cy-24,cx,cy+26,COLORS.white,2.5);
  line(g,cx-23,cy+3,cx+23,cy+3,COLORS.white,2.5);
  line(g,cx-10,cy+19,cx+10,cy+19,COLORS.white,2.1);
 }else polygon(g,[[cx,cy-22],[cx-12,cy+12],[cx+12,cy+12]],COLORS.white,COLORS.black,2.1);
}
function projection(m,l,plan=false){
 const [cx,cy]=plan?[252,294]:l.roseCenter;
 const scale=l.radius/m.range,scaleX=(l.radiusX??l.radius)/m.range;
 const anchor=plan?m.route.points[clamp(m.route.centerIndex,0,m.route.points.length-1)]:null;
 return (east,north)=>{
  const a=rad(plan?0:m.geoTrack??m.reference);
  const e=east-(anchor?.x??0),n=north-(anchor?.y??0);
  return [cx+scaleX*(e*Math.cos(a)-n*Math.sin(a)),cy-scale*(n*Math.cos(a)+e*Math.sin(a))];
 };
}
const symbolVisible=([x,y],l)=>l.calibrated?x>=0&&x<=W&&y>=49&&y<=H:x>=25&&x<=482&&y>=89&&y<=462;
function mapWaypoint(g,x,y,pt,color,showData,shape){
 if(shape==='airport')make(g,'ellipse',{cx:x,cy:y,rx:px(22),ry:py(16),fill:'none',stroke:color,'stroke-width':1.9});
 else if(shape==='nav'){
  const mark=layer(g,'map-navaid');
  const vertices=[[-18,0],[-12,-11],[12,-11],[18,0],[11,14],[-11,14]];
  const place=points=>points.map(([dx,dy])=>[x+px(dx),y+py(dy)]);
  polygon(mark,place(vertices),color,'none',1.75);
  for(const spoke of [[[-12,-11],[-27,-17],[-37,-5],[-18,0]],[[12,-11],[27,-17],[37,-5],[18,0]],[[-11,14],[-11,27],[11,27],[11,14]]])
   stroke(mark,place(spoke),color,1.75);
 }else if(pt.symbol==='CONSTRAINT')circle(g,x,y,5.8,color);
 else polygon(g,Array.from({length:8},(_,i)=>{
  const angle=rad(i*45),radius=i%2?2.2:9.5;
  return [x+Math.sin(angle)*radius,y+Math.cos(angle)*radius];
 }),color,'none',1.55);
 const dx=shape==='nav'?19:shape==='airport'?16:10,labelY=y+3;
 photoText(g,pt.name,x+dx,labelY,MAP_ID_SIZE,color);
 if(showData){
  photoText(g,pt.altitude,x+dx,labelY+14,MAP_DETAIL_SIZE,color);
  photoText(g,pt.eta,x+dx,labelY+28,MAP_DETAIL_SIZE,color);
 }
}
function waypoint(parent,x,y,pt,color,showData,shape='star',calibrated=false){
 const g=layer(parent,'waypoint');
 if(calibrated){mapWaypoint(g,x,y,pt,color,showData,shape);return;}
 if(shape==='star')polygon(g,Array.from({length:8},(_,i)=>polar(x,y,i*45,i%2?2.5:7)),color,COLORS.black);
 else if(shape==='airport')circle(g,x,y,6,color);
 else polygon(g,Array.from({length:6},(_,i)=>polar(x,y,i*60,6)),color);
 text(g,pt.name,x+10,y-7,15,color);
 if(showData){
  text(g,pt.altitude,x+10,y+7,13,color);
  text(g,pt.eta,x+10,y+20,13,color);
 }
}
// Measure a conservative glyph footprint before drawing so that a fix ID
// cannot be partly erased by the circular/sector compass crop. Label positions
// are re-evaluated on every render as the ownship moves and the range changes.
function routeFixLabel(x,y,name,l,occupied=[]){
 const size=MAP_ID_SIZE,width=Math.max(22,String(name).length*size*.75),height=size*.94;
 const cx=l.roseCenter[0],cy=l.roseCenter[1],rx=Math.max(1,(l.radiusX??l.radius)-9),
  ry=Math.max(1,l.radius-9);
 const fitsBox=([left,top,right,bottom])=>{
  if(left<12||right>W-12||top<86||bottom>H-21)return false;
  for(const px of [left,right])for(const py of [top,bottom]){
   const dx=(px-cx)/rx,dy=(py-cy)/ry;
   if(dx*dx+dy*dy>1)return false;
   if(l.degrees<360&&Math.abs(Math.atan2(dx,-dy)*180/Math.PI)>l.degrees/2-2)return false;
  }
  return !occupied.some(([a,b,c,d])=>left<c+7&&right>a-7&&top<d+4&&bottom>b-4);
 };
 const candidates=[
  [x+15,y+4,'start'],[x-15,y+4,'end'],
  [x+15,y-18,'start'],[x-15,y-18,'end'],
  [x+15,y+24,'start'],[x-15,y+24,'end'],
  [x-width/2,y-22,'start'],[x-width/2,y+29,'start'],
  [x-width/2,y-40,'start'],[x-width/2,y+44,'start']
 ];
 for(const [atX,atY,align] of candidates){
  const left=align==='end'?atX-width:atX;
  const box=[left,atY-height,left+width,atY+3];
  if(fitsBox(box))return {x:atX,y:atY,align,box};
 }
 return null; // Never draw a half-visible identifier.
}
function drawRoute(svg,m,l,status,plan){
 const project=projection(m,l,plan),points=m.route.points;
 const rangeClip=m.routeClipToScale&&!plan?'url(#'+(svg.id||'ehsi')+'-route-range)':null;
 const g=layer(svg,plan?'plan-route':'active-route',rangeClip?{'clip-path':rangeClip}:{});

 const brightness=String(clamp(m.efis.wxBrightness??1,0,1));
 g.style.opacity=brightness;
 const colors=l.calibrated?PHOTO_COLORS:COLORS;
 const fits=xy=>{
  if(!symbolVisible(xy,l))return false;
  if(m.routeClipToScale&&!plan){
   const dx=(xy[0]-l.roseCenter[0])/Math.max(1,(l.radiusX??l.radius)-17);
   const dy=(xy[1]-l.roseCenter[1])/Math.max(1,l.radius-17);
   if(dx*dx+dy*dy>1)return false;
   if(l.degrees<360&&Math.abs(Math.atan2(dx,-dy)*180/Math.PI)>l.degrees/2-2)return false;
  }
  return l.calibrated||plan||Math.hypot(xy[0]-l.roseCenter[0],xy[1]-l.roseCenter[1])<l.radius-33;
 };
 if(status.routeValid){
  const positions=points.map(pt=>project(pt.x,pt.y));
  const segments=layer(g,'route-segments');
  positions.slice(1).forEach((to,i)=>{
   const leg=points[i+1].leg||'ACTIVE';
   if(leg==='DISCONTINUITY')return;
   const styles={ACTIVE:[colors.magenta,null],MOD:[colors.white,'6 5'],INACTIVE:[colors.cyan,'12 8'],OFFSET:[colors.magenta,'10 4 2 4']};
   const [color,dash]=styles[leg]||styles.ACTIVE;
   line(segments,...positions[i],...to,color,2.1,{'stroke-dasharray':dash});
  });
  const occupied=[];
  positions.forEach(([x,y],i)=>{
   if(!fits([x,y])||points[i].hidden)return;
   const color=i===m.route.activeIndex?colors.magenta:colors.white;
   if(m.routeClipToScale&&!plan&&l.calibrated){
    // Symbol and label are separate. Use a fully legible, in-scale label
    // placement instead of letting the SVG clip cut half of its letters.
    waypoint(g,x,y,{...points[i],name:''},color,false,'star',true);
    const placement=routeFixLabel(x,y,points[i].name,l,occupied);
    if(placement){
     const label=layer(g,'route-fix-label',{'data-fix':points[i].name,
      'data-label-fitted':'true','data-label-side':placement.align});
     photoText(label,points[i].name,placement.x,placement.y,MAP_ID_SIZE,color,placement.align);
     // FCOM 10.32.17: RTE DATA displays altitude constraints and waypoint ETA
     // on calibrated photo glass too, not only in the uncalibrated lab.
     if(m.options.rteData===true){
      const fields=[points[i].altitude,points[i].eta]
       .filter(value=>value!==null&&value!==undefined&&String(value)!=='').slice(0,2);
      fields.forEach((field,j)=>{
       const y=placement.y+(j+1)*(MAP_DETAIL_SIZE+3);
       const width=String(field).length*MAP_DETAIL_SIZE*.73;
       const left=placement.align==='end'?placement.x-width:placement.x;
       const right=placement.align==='end'?placement.x:placement.x+width;
       const radiusX=Math.max(1,(l.radiusX??l.radius)-9),radiusY=Math.max(1,l.radius-9);
       const inside=[left,right].every(x=>{
        const dx=(x-l.roseCenter[0])/radiusX,dy=(y-l.roseCenter[1])/radiusY;
        return x>12&&x<500&&y>86&&y<491&&dx*dx+dy*dy<=1;
       });
       if(inside)photoText(label,String(field),placement.x,y,MAP_DETAIL_SIZE,color,placement.align);
      });
     }
     occupied.push(placement.box);
    }
   }else waypoint(g,x,y,points[i],color,m.options.rteData,'star',l.calibrated);
  });
 }
 if(!m.nav.valid)return;
 const sample=m.mapObjects??[
  {name:'MAHAN',x:-10,y:-12,on:status.wptDatabaseEligible,shape:'star'},
  {name:'LAR',x:-7,y:-5,on:m.options.arpt,shape:'airport'},
  {name:'SYZ',x:-13,y:3,on:m.options.navAid,shape:'nav'},
  {name:'KRN',x:-78,y:-38,on:m.options.navAid,shape:'nav'}
 ];
 const db=layer(svg,'database-options');
 db.style.opacity=brightness;
 for(const pt of sample){
  const xy=project(pt.x,pt.y);
  if(pt.on&&fits(xy)&&!(pt.shape==='star'&&m.range>40))
   waypoint(db,...xy,pt,pt.tuned===true?colors.green:colors.cyan,false,pt.shape,l.calibrated);
 }
 if(status.routeValid&&m.syntheticAirport!==false){
  const xy=project(-33,-8);
  if(fits(xy)){
   const [x,y]=xy,a=layer(g,'route-airport');
   circle(a,x,y,6);
   line(a,x-7,y+8,x+7,y-8,COLORS.white,2.2);
   if(l.calibrated)photoText(a,'SIMX',x+11,y+12,MAP_ID_SIZE);
   else text(a,'SIMX',x+11,y+12,15);
  }
 }
}
function course(svg,m,l){
 const [cx,cy]=l.roseCenter,r=l.radius,full=l.degrees===360;
 const g=layer(svg,'course-deviation');
 if(!Number.isFinite(m.course))return;
 const delta=rel(m.course-m.reference);
 const stretch=l.radiusX?l.radiusX/l.radius:1;
 const rotation='translate('+cx+' '+cy+') scale('+stretch+' 1) rotate('+delta+') scale('+(1/stretch)+' 1) translate('+(-cx)+' '+(-cy)+')';
 const n=make(g,'g',{transform:rotation});
 const tip=cy-r+20,stub=full?52:48;
 if(full){
  polygon(n,[[cx,tip],[cx-4,tip+8],[cx-4,cy-stub],[cx+4,cy-stub],[cx+4,tip+8]],PHOTO_COLORS.white,'none',1.6);
  polygon(n,[[cx-4,cy+stub],[cx+4,cy+stub],[cx+4,cy+r-20],[cx-4,cy+r-20]],PHOTO_COLORS.white,'none',1.6);
 }else{
  polygon(n,[[cx,tip],[cx-8,tip+12],[cx+8,tip+12]],COLORS.white);
  line(n,cx,tip+13,cx,cy-stub,COLORS.magenta,2.2);
 }
 const spacing=full?21:29;
 if(m.nav.valid&&Number.isFinite(m.nav.cdi)){
  for(const i of [-2,-1,1,2])circle(n,cx+i*spacing,cy,3);
  const x=cx+clamp(m.nav.cdi||0,-2.4,2.4)*spacing;
  if(full)polygon(n,[[x-3,cy-stub],[x+3,cy-stub],[x+3,cy+stub],[x-3,cy+stub]],PHOTO_COLORS.magenta,'none',1.8);
  else line(n,x,cy-stub,x,cy+stub,PHOTO_COLORS.magenta,2.2);
  if(m.radio&&m.nav.type==='VOR'&&m.nav.toFrom){
   if(full)polygon(n,[[cx+14,cy-12],[cx+21,cy-2],[cx+7,cy-2]].map(([x1,y])=>[x1,m.nav.toFrom==='TO'?y:2*cy-y]),COLORS.white);
   text(g,m.nav.toFrom,489,448,17,COLORS.white,'end');
  }
 }else flag(g,m.radio?(m.nav.type==='ILS'?'LOC':'VOR'):'XTK',full?344:357,full?256:379);
}
function vertical(svg,m){
 const isIls=m.radio&&m.nav.type==='ILS',vnav=!m.radio&&m.mode!=='PLAN'&&m.nav.valid&&m.nav.vnavActive&&m.nav.descent===true;
 if(!isIls&&!vnav)return;
 const g=layer(svg,isIls?'glideslope':'vnav-path'),x=473,mid=isIls?(m.mode==='FULL_VOR_ILS'?281:364):341;
 for(let i=-2;i<=2;i++)circle(g,x,mid+i*18,2.8);
 if(isIls&&!m.nav.gsValid)return;
 const offset=isIls?m.nav.gsDev:m.nav.vnav/200,y=mid+clamp(offset,-2.4,2.4)*18;
 polygon(g,[[x-7,y],[x,y-8],[x+7,y],[x,y+8]],COLORS.magenta,COLORS.black,2);
 if(vnav&&Math.abs(m.nav.vnav)>400)text(g,Math.abs(m.nav.vnav),489,385,14,COLORS.white,'end');
}
function wind(svg,m){
 if(m.mode==='PLAN'||!Number.isFinite(m.windDirection)||!Number.isFinite(m.windSpeed)||m.windSpeed<=0)return;
 const l=layoutFor(m),g=layer(svg,'wind');
 const [x,y]=l.full?G.wind.full:m.mode==='CTR_MAP'?G.wind.center:G.wind.expanded;
 photoText(g,direction(m.windDirection)+'°/'+Math.round(m.windSpeed),x,y,23);
 if(m.windSpeed<6)return;
 const ax=x+13,ay=y-33;
 const arrow=make(g,'g',{transform:'translate('+ax+' '+ay+') rotate('+rel(m.windDirection+180-m.reference)+')'});
 line(arrow,0,15,0,-15,PHOTO_COLORS.white,1.8);stroke(arrow,[[-5,-8],[0,-15],[5,-8]],PHOTO_COLORS.white,1.8);
}
function footer(svg,m){
 const g=layer(svg,'lower-data');
 wind(g,m);
 if(m.radio){
  const x=layoutFor(m).full?75:57;
  photoText(g,m.nav.source,x,459,22,PHOTO_COLORS.green);
  if(m.nav.frequency!=null)photoText(g,Number(m.nav.frequency).toFixed(2),440,459,23,PHOTO_COLORS.green,'end');
 }else if(m.mode.endsWith('NAV'))photoText(g,'NAV',72,459,21,PHOTO_COLORS.green);
}
function positionDifferenceDisplay(svg,m){
 // FCOM 10.31.9 item 14 / 10.32.22: display only verified FMC-vs-IRS
 // differences beyond an externally supplied limit. Selected IRS first.
 if(!['MAP','CTR_MAP','FULL_NAV','EXP_NAV'].includes(m.mode)||
  !Array.isArray(m.positionDifferences)||!m.positionDifferences.length)return;
 const g=layer(svg,'fmc-irs-position-difference');
 m.positionDifferences.slice(0,2).forEach((entry,i)=>{
  if(!Number.isFinite(entry.distanceNm)||!['L','R'].includes(entry.side))return;
  const y=440+i*24,x=447;
  photoText(g,entry.distanceNm.toFixed(1),x-25,y,18,PHOTO_COLORS.white,'end');
  photoText(g,entry.side,x,y,18,PHOTO_COLORS.white);
  if(Number.isFinite(entry.bearingTrueDeg)&&Number.isFinite(m.reference)){
   const a=rel(entry.bearingTrueDeg-m.reference);
   const arrow=make(g,'g',{transform:'translate('+(x+13)+' '+(y-7)+') rotate('+a+')'});
   stroke(arrow,[[0,7],[0,-7],[-3,-2],[0,-7],[3,-2]],PHOTO_COLORS.white,1.4);
  }
 });
}
function radar(svg,m,l,status){
 if(!status.wxrVisible&&!status.terrainVisible)return;
 const g=layer(svg,status.wxrVisible?'weather-returns':'terrain-returns',{opacity:m.efis.wxBrightness??1});
 const project=projection(m,l),[x,y]=project(-6,-10);
 const palette=status.wxrVisible?['#167738','#dba628','#b32b26']:['#136e30','#ba9025','#8e2b26'];
 const shape=[[-44,10],[-52,-16],[-27,-40],[0,-32],[28,-43],[47,-19],[38,3],[20,24],[-17,28]];
 palette.forEach((color,i)=>{
  const scale=1-i*.31;
  polygon(g,shape.map(([dx,dy])=>[x+dx*scale,y+dy*scale]),color,color,0);
 });
}
function trend(svg,m,l){
 if(!['MAP','CTR_MAP'].includes(m.mode)||!(m.groundSpeed>0))return;
 const g=layer(svg,'position-trend'),[cx,cy]=l.roseCenter;
 const speed=m.groundSpeed*.514444,omega=9.80665*Math.tan(rad(clamp(m.bank||0,-60,60)))/speed,scale=l.radius/m.range/1852;
 const tMax=m.range===10?30:m.range===20?60:90;
 const position=t=>Math.abs(omega)<.000001?[cx,cy-speed*t*scale]:[cx+speed/omega*(1-Math.cos(omega*t))*scale*((l.radiusX??l.radius)/l.radius),cy-speed/omega*Math.sin(omega*t)*scale];
 for(let base=0;base<tMax;base+=30){
  stroke(g,Array.from({length:7},(_,i)=>position(base+3+i*4)),COLORS.white,1.45);
 }
}
function altitudeArc(svg,m,l){
 const a=m.altitudeArc;
 if(!a||!['MAP','CTR_MAP'].includes(m.mode)||!a.verticalSpeed)return;
 const minutes=(a.target-a.current)/a.verticalSpeed,distance=minutes*m.groundSpeed/60;
 if(!Number.isFinite(distance)||distance<=0||distance>m.range)return;
 const r=l.radius*distance/m.range;
 const half=Math.min(17,52/r*180/Math.PI),g=layer(svg,'altitude-range-arc');
 stroke(g,Array.from({length:25},(_,i)=>rosePoint(l,(i/12-1)*half,distance/m.range)),COLORS.green,2);
}
function traffic(svg,m,l,status){
 const {mode,targets=[]}=m.traffic,g=layer(svg,'traffic-status');
 const enabled=['TA_RA','TA_ONLY','TEST'].includes(mode);
 const visible=enabled?targets.filter(t=>mode!=='TA_ONLY'||t.kind!=='RA'):[];
 const advisories=visible.filter(t=>t.kind==='TA'||t.kind==='RA');
 const alerts=advisories.some(t=>t.kind==='RA')?COLORS.red:COLORS.amber;
 if(advisories.length){make(g,'rect',{x:343,y:196,width:97,height:22,fill:COLORS.black});text(g,'TRAFFIC',437,214,21,alerts,'end');}
 const labels={OFF:'TCAS OFF',FAIL:'TCAS FAIL',TA_ONLY:'TA ONLY',TEST:'TCAS TEST'};
 if(mode==='OFF'&&l.calibrated){
  photoText(g,'TCAS',64,205,22);
  photoText(g,'OFF',64,226,22);
 }else if(labels[mode]&&(mode!=='FAIL'||!m.traffic.failSuppressed)){
  text(g,labels[mode],64,226,18,mode==='FAIL'?COLORS.amber:mode==='TA_ONLY'?COLORS.green:COLORS.white,'start');
 }
 if(!status.trafficOverlay)return;
 photoText(g,'TFC',G.header.left,184+(Number.isFinite(m.trafficLabelOffsetY)?m.trafficLabelOffsetY:0),21,PHOTO_COLORS.green);
 let offscale=null;
 let noBearingRow=0;
 for(const t of visible){
  if(!Number.isFinite(t.bearing)){
   if(t.kind==='RA'||t.kind==='TA'){
    const color=t.kind==='RA'?COLORS.red:COLORS.amber;
    const altitude=Number.isFinite(t.displayAltitude)?String(t.displayAltitude).padStart(3,'0'):Number.isFinite(t.relativeAltitude)?
     (t.relativeAltitude>=0?'+':'-')+String(Math.round(Math.abs(t.relativeAltitude)/100)).padStart(2,'0'):'';
    const y=236+noBearingRow++*21;
    text(g,t.kind+' '+t.distance.toFixed(1)+' '+altitude,437,y,16,color,'end');
    if(Math.abs(t.verticalRate)>=500){
     const s=Math.sign(t.verticalRate);
     line(g,464,y+7*s,464,y-7*s,color);
     stroke(g,[[460,y-3*s],[464,y-7*s],[468,y-3*s]],color);
    }
   }
   continue;
  }
  const delta=rel(t.bearing-m.reference);
  const xy=rosePoint(l,delta,t.distance/m.range);
  if(t.distance>m.range||Math.abs(delta)>l.degrees/2||!symbolVisible(xy,l)){
   if(t.kind==='RA'||(t.kind==='TA'&&offscale!==COLORS.red))offscale=t.kind==='RA'?COLORS.red:COLORS.amber;
   continue;
  }
  const [x,y]=xy,target=layer(g,'traffic-'+t.kind.toLowerCase(),{'data-target-id':t.id||'',
   'data-relative-altitude':t.relativeAltitude??'UNKNOWN','data-bearing':t.bearing,'data-range':t.distance});
  const color=t.kind==='RA'?COLORS.red:t.kind==='TA'?COLORS.amber:COLORS.white;
  if(t.kind==='TA')circle(target,x,y,6,color,color);
  else if(t.kind==='RA')make(target,'rect',{x:x-6,y:y-6,width:12,height:12,fill:color});
  else polygon(target,[[x,y-7],[x+7,y],[x,y+7],[x-7,y]],color,t.kind==='PROX'?color:COLORS.black);
  if(Number.isFinite(t.relativeAltitude)){
   const a=Math.round(Math.abs(t.relativeAltitude)/100),above=t.relativeAltitude>=0;
   text(target,Number.isFinite(t.displayAltitude)?String(t.displayAltitude).padStart(3,'0'):
    (above?'+':'-')+String(a).padStart(2,'0'),x,y+(above?-14:15),16,color,'middle');
  }
  if(Math.abs(t.verticalRate)>=500){
   const s=Math.sign(t.verticalRate),arrow=layer(target,'traffic-trend',{'data-trend':s>0?'UP':'DOWN'});
   line(arrow,x+12,y+7*s,x+12,y-7*s,color);
   stroke(arrow,[[x+8,y-3*s],[x+12,y-7*s],[x+16,y-3*s]],color);
  }
 }
 if(offscale)text(g,'OFFSCALE',437,192,18,offscale,'end');
}
function render(svg,raw){
 if(!svg)return null;
 const m=model(raw),s=computeDisplay(raw),l=layoutFor(m);
 svg.replaceChildren();
 svg.setAttribute('viewBox','0 0 512 512');
 svg.setAttribute('preserveAspectRatio','none');
 svg.setAttribute('data-renderer',VERSION);
 svg.setAttribute('data-mode',m.mode);
 svg.setAttribute('data-presentation',m.modeName);
 svg.setAttribute('data-approved','false');
 svg.setAttribute('aria-label','Classic EHSI '+m.modeName);
 svg.style.opacity=String(m.efis.brightness??1);
 make(svg,'rect',{x:0,y:0,width:W,height:H,fill:COLORS.black});
 if(!s.powered)return s;
 if(!s.sgValid){text(svg,'SG FAIL',256,256,28,COLORS.amber,'middle');return s;}
 const defs=make(svg,'defs'),clipId=(svg.id||'ehsi')+'-plot';
 const clip=make(defs,'clipPath',{id:clipId});
 make(clip,'rect',l.calibrated?{x:0,y:49,width:W,height:H-49,rx:px(25),ry:py(25)}:{x:13,y:73,width:486,height:391});
 // FMC path, fix symbols and labels must not escape the compass scale.
 // Expanded: the 70-degree elliptical sector. Full: the 360-degree ellipse.
 if(m.routeClipToScale&&l.route&&m.mode!=='PLAN'){
  const rc=make(defs,'clipPath',{id:(svg.id||'ehsi')+'-route-range',clipPathUnits:'userSpaceOnUse'});
  if(l.degrees===360){
   make(rc,'ellipse',{cx:l.roseCenter[0],cy:l.roseCenter[1],
    rx:(l.radiusX??l.radius)-3,ry:l.radius-3});
  }else{
   const outline=[[...l.roseCenter]];
   for(let a=-l.degrees/2;a<=l.degrees/2;a+=.5){
    outline.push(rosePoint(l,Math.min(a,l.degrees/2),.991));
   }
   make(rc,'polygon',{points:outline.map(([x,y])=>x.toFixed(2)+','+y.toFixed(2)).join(' ')});
  }
 }
 const plot=layer(svg,'plot',{'clip-path':'url(#'+clipId+')'});
 header(svg,m,s);
 radar(plot,m,l,s);
 if(s.compassValid){
  compass(svg,m,l);
  navPointers(svg,m,l);
  waypointBearingPointer(svg,m,l);
 }
 if(l.route&&s.orientationValid)drawRoute(plot,m,l,s,m.mode==='PLAN');
 if(m.mode==='PLAN'){
  const n=layer(svg,'true-north');
  line(n,472,345,472,305);stroke(n,[[466,313],[472,305],[478,313]]);
  text(n,'N',472,295,17,COLORS.white,'middle');
 }
 if(s.compassValid&&m.mode!=='PLAN'){
  if(!l.route)course(plot,m,l);
  trend(plot,m,l);
  altitudeArc(plot,m,l);
  aircraft(svg,l,l.degrees===360);
 }
 if(m.efis.verticalFailure&&!m.radio&&m.mode!=='PLAN')flag(svg,'VTK',473,341);
 if(l.route&&!m.nav.valid&&!m.efis.mapFailurePending&&!m.weather.disagreement?.includes('MAP'))flag(svg,'MAP',256,291);
 vertical(svg,m);
 footer(svg,m);
 positionDifferenceDisplay(svg,m);
 traffic(svg,m,l,s);
 const w=layer(svg,'weather-status');
 if(m.weather.selected&&!m.weather.healthy)text(w,'WXR FAIL',495,49,16,COLORS.amber,'end');
 else if(m.weather.displayCooling)text(w,'WXR DSPY',495,49,16,COLORS.amber,'end');
 if(s.wxrVisible)text(w,'WX',495,49,16,COLORS.green,'end');
 if(s.terrainVisible)text(w,'TERR',495,49,16,COLORS.cyan,'end');
 if(m.weather.terrainFailure)text(w,'TERR FAIL',495,49,16,COLORS.amber,'end');
 if(m.weather.disagreement)text(w,m.weather.disagreement+' RANGE DISAGREE',256,386,17,COLORS.amber,'middle');
 return s;
}
function routeProjection(input){
 const m=model({...input,route:{points:[]}});
 // The normal NAV glyph contract remains unchanged; source-only overlays
  // also need accurate projections for centered/expanded NAV rose modes.
  return ['PLAN','MAP','CTR_MAP','EXP_NAV','FULL_NAV'].includes(m.mode)?
   projection(m,layoutFor(m),m.mode==='PLAN'):null;
}
return {VERSION,COLORS,MODES,REFERENCE,LAYOUT,FRAME,DISPLAY_ASPECT,rosePoint,norm,rel,selectedHeadingPresentation,model,computeDisplay,render,routeProjection,routeFixLabel};
});
