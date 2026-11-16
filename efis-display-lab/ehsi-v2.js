/* Classic EHSI render pipeline, grounded in Sepehran FCOM 10.31–10.32 and 10.40. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./glyphs.js'):root.EFISLabGlyphs);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.EFISClassicEHSIV2=api;
})(globalThis,function(glyph){
'use strict';
const VERSION='EHSI-CLASSIC-REBUILD-0007';
const COLORS=glyph.colors;
const W=512,H=512,NS='http://www.w3.org/2000/svg';
// Active EHSI aperture in the two 1920 x 1080 owner-supplied reference frames.
const FRAME=Object.freeze({left:390,top:64,width:900,height:837});
const px=n=>n*W/FRAME.width,py=n=>n*H/FRAME.height;
const screenX=n=>px(n-FRAME.left),screenY=n=>py(n-FRAME.top);
const atPixel=(x,y)=>[screenX(x),screenY(y)];
const PHOTO_COLORS=Object.freeze({white:'#ffffff',green:'#29ff84',cyan:'#00b5ff',magenta:'#ff00ff'});
function mapLayout(centerY,radiusX,radiusY,degrees){
 const center=atPixel(840,centerY);
 return {roseCenter:center,radius:py(radiusY),radiusX:px(radiusX),degrees,route:true,
  aircraft:center,calibrated:true};
}
const DISPLAY_ASPECT=350/411;
// Reference map identifiers have a cap height of approximately 2.3% of glass width.
const MAP_ID_SIZE=16,MAP_DETAIL_SIZE=13;
const EXPANDED=mapLayout(740,812,606,70);
const FULL_ROSE_SCALE=1.075;
const FULL=Object.freeze({roseCenter:[256,256],radius:Math.round(201*FULL_ROSE_SCALE),degrees:360,route:false,aircraft:[256,256],full:true});
const PLAN={...EXPANDED,aircraft:null,rose:false,planCompass:true,calibrated:false};
const LAYOUT=Object.freeze({
 MAP:EXPANDED,
 CTR_MAP:mapLayout(533,338*FULL_ROSE_SCALE,252*FULL_ROSE_SCALE,360),
 EXP_NAV:{...EXPANDED,route:false},
 FULL_NAV:FULL,
 EXP_VOR_ILS:{...EXPANDED,route:false},
 FULL_VOR_ILS:FULL,
 PLAN
});
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
 const m=model(input),l=LAYOUT[m.mode],plan=m.mode==='PLAN';
 const headingValid=m.efis.headingValid!==false,trackValid=m.efis.trackValid!==false;
 const compassValid=m.radio?headingValid:trackValid;
 const trafficMode=['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(m.mode);
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
 const g=make(p,'g',{'data-text':String(value),'aria-label':String(value)});
 make(g,'title',{},value);
 return make(g,'path',{d:glyph.svg(value,x,y,size,align),fill:'none',stroke:color,'stroke-width':Math.max(.8,size/12.5),'stroke-linecap':'round','stroke-linejoin':'round'});
}
function flag(p,value,x,y){
 const width=value.length*11+12;
 make(p,'rect',{x:x-width/2,y:y-12,width,height:24,fill:COLORS.black,stroke:COLORS.amber,'stroke-width':1.3});
 text(p,value,x,y,17,COLORS.amber,'middle');
}
function photoText(p,value,x,y,size,color=PHOTO_COLORS.white,align='start'){
 if(value===null||value===undefined||value==='')return;
 return make(p,'text',{x,y,fill:color,'font-family':'Arial, Liberation Sans, sans-serif',
  'font-size':size,'font-weight':'bold','text-anchor':align,'dominant-baseline':'central','data-text':String(value)},value);
}
const photoAt=(p,value,x,y,size,color,align)=>photoText(p,value,screenX(x),screenY(y),py(size),color,align);
function mapHeader(svg,m,status){
 const g=layer(svg,'header'),active=m.nav.valid?m.route.points[m.route.activeIndex]:null;
 const distance=active?Math.hypot(active.x,active.y).toFixed(1):'- - -';
 const eta=active?.eta?String(active.eta).replace(/^(\d{4})Z$/,'$1.0Z'):'- - - -.-Z';
 const upperLeft=m.radio?(m.nav.valid&&Number.isFinite(m.nav.dme)?'DME '+m.nav.dme.toFixed(1):'DME - - -'):distance+' NM';
 photoAt(g,upperLeft,574,99,35,PHOTO_COLORS.white,'end');
 if(!m.radio)photoAt(g,eta,1272,99,35,PHOTO_COLORS.white,'end');
 if(m.mode!=='PLAN'){
  photoAt(g,'TAS',407,130,32);
  photoAt(g,Number.isFinite(m.trueAirspeed)?Math.round(m.trueAirspeed):'---',553,130,32,PHOTO_COLORS.white,'end');
  photoAt(g,'GS',1152,130,32);
  photoAt(g,Number.isFinite(m.groundSpeed)?Math.round(m.groundSpeed):'---',1272,130,32,PHOTO_COLORS.white,'end');
 }
 const key=m.radio?'HDG':'TRK';
 if(!status.compassValid){flag(g,key,screenX(840),screenY(99));return;}
 const index=layer(g,'track-readout');
 stroke(index,[[780,84],[780,114],[814,114],[840,134],[866,114],[901,114],[901,84]].map(([x,y])=>atPixel(x,y)),PHOTO_COLORS.white,1.9);
 photoAt(index,key,771,103,36,PHOTO_COLORS.green,'end');
 photoAt(index,direction(m.reference),840,98,42,PHOTO_COLORS.white,'middle');
 photoAt(index,m.trueRef?'TRU':'M',917,103,36,PHOTO_COLORS.green);
}
function header(svg,m,status){
 const l=LAYOUT[m.mode];
 if(l.calibrated||l.planCompass){mapHeader(svg,m,status);return;}

 const g=layer(svg,'header'),active=m.route.points[m.route.activeIndex];
 if(m.radio){
  if(m.nav.valid&&Number.isFinite(m.nav.dme))text(g,'DME '+Number(m.nav.dme).toFixed(1),18,26,19);
 }else if(m.nav.valid&&active){
  text(g,Math.hypot(active.x,active.y).toFixed(1)+' NM',18,26,19);
  if(m.mode.endsWith('NAV'))text(g,active.name,18,46,18,COLORS.magenta);
  text(g,(active.eta||'').replace('Z','.0Z'),495,26,18,COLORS.white,'end');
 }
 text(g,m.radio?'HDG':'TRK',214,29,17,COLORS.green,'end');
 if(status.compassValid){
  stroke(g,[[224,17],[286,17],[286,42],[263,42],[255,50],[247,42],[224,42],[224,17]],COLORS.white);
  text(g,direction(m.reference),255,29,24,COLORS.white,'middle');
  text(g,m.trueRef?'TRU':'M',296,29,16,COLORS.green);
 }else flag(g,m.radio?'HDG':'TRK',254,30);
}
function mapRange(svg,m,l){
 const g=layer(svg,'range-scale'),[cx]=l.roseCenter,half=rosePoint(l,0,.5)[1];
 const centered=m.mode==='CTR_MAP';
 line(g,cx,screenY(134),cx,screenY(centered?470:665),PHOTO_COLORS.white,2.2);
 for(const fraction of centered?[.5]:[.25,.5,.75]){
  const y=rosePoint(l,0,fraction)[1];
  line(g,cx-px(17),y,cx+px(17),y,PHOTO_COLORS.white,1.65);
 }
 photoText(g,String(m.range/2),cx-px(18),half-(centered?0:py(17)),py(35),PHOTO_COLORS.white,'end');
 if(centered){
  const y=rosePoint(l,180,.5)[1];
  line(g,cx,y,cx,rosePoint(l,180)[1],PHOTO_COLORS.white,2.2);
  line(g,cx-px(17),y,cx+px(17),y,PHOTO_COLORS.white,1.65);
  photoText(g,String(m.range/2),cx-px(18),y,py(35),PHOTO_COLORS.white,'end');
 }
}
function mapMarker(p,l,angle,id){
 const [x,y]=rosePoint(l,angle);
 return layer(p,id,{transform:'translate('+x+' '+y+') rotate('+roseTangent(l,angle)+')'});
}
function mapCompass(svg,m,l){
 const g=layer(svg,l.planCompass?'plan-compass':'compass-rose'),half=l.degrees/2,centered=m.mode==='CTR_MAP';
 if(!centered){
  const points=Array.from({length:l.degrees+1},(_,i)=>rosePoint(l,i-half));
  stroke(g,points,PHOTO_COLORS.white,1.95);
 }
 const step=centered?10:5;
 for(let bearing=0;bearing<360;bearing+=step){
  const angle=rel(bearing-m.reference);
  if(Math.abs(angle)>half)continue;
  const length=centered ? .104 : bearing%10===0 ? .055 : .027;
  const numbered=bearing%30===0;
  if(!centered||!numbered)line(g,...rosePoint(l,angle),...rosePoint(l,angle,1-length),PHOTO_COLORS.white,centered?2:1.9);
  if(!numbered)continue;
  const [x,y]=rosePoint(l,angle,centered ? .914 : .904);
  const label=make(g,'g',{transform:'rotate('+roseTangent(l,angle)+' '+x+' '+y+')'});
  photoText(label,String(bearing/10),x,y,py(centered?35:42),PHOTO_COLORS.white,'middle');
 }
 if(!l.planCompass)mapRange(g,m,l);
 const heading=rel((m.radio?m.track:m.heading)-m.reference);
 const known=m.radio?m.efis.trackValid!==false:m.efis.headingValid!==false;
 if(known&&Math.abs(heading)<=half){
  const pointer=mapMarker(g,l,heading,'heading-pointer');
  polygon(pointer,[[0,0],[-px(27),py(29)],[-px(27),py(40)],[px(27),py(40)],[px(27),py(29)]],PHOTO_COLORS.white,'none',1.9);
  line(pointer,-px(27),py(29),px(27),py(29),PHOTO_COLORS.white,1.65);
 }
 const delta=Number.isFinite(m.selectedHeading)?rel(m.selectedHeading-m.reference):null;
 if(delta!==null&&Math.abs(delta)<=half){
  const bug=mapMarker(g,l,delta,'heading-bug');
  polygon(bug,[[-px(27),0],[px(27),0],[px(27),-py(18)],[-px(27),-py(18)]],PHOTO_COLORS.magenta,'none',1.9);
  line(bug,0,0,0,-py(18),PHOTO_COLORS.magenta,1.7);
 }
 if(l.planCompass||delta===null)return;
 const from=rosePoint(l,delta,.96),to=rosePoint(l,delta,.12);
 line(g,...from,...to,PHOTO_COLORS.magenta,1.55,{'stroke-dasharray':'12 15','data-segment':'heading-bug-vector'});
}
function fullCompass(svg,m,l){
 const g=layer(svg,'compass-rose'),[cx,cy]=l.roseCenter,r=l.radius;
 circle(g,cx,cy,r);
 for(let n=0;n<360;n+=5){
  const a=rel(n-m.reference),major=n%30===0;
  const first=polar(cx,cy,a,r),second=polar(cx,cy,a,r-(major?13:7));
  line(g,...first,...second);
  if(!major)continue;
  const [x,y]=polar(cx,cy,a,r-28);
  text(make(g,'g',{transform:'rotate('+a+' '+x+' '+y+')'}),String(n?n/10:36),x,y,22,COLORS.white,'middle');
 }
 const topY=cy-r;
 if(!m.radio&&m.efis.headingValid!==false){
  const a=rel(m.heading-m.reference);
  const pointer=layer(g,'heading-pointer',{transform:'rotate('+a+' '+cx+' '+cy+')'});
  polygon(pointer,[[cx,topY+4],[cx-13,topY+24],[cx+13,topY+24]]);
 }
 const delta=Number.isFinite(m.selectedHeading)?rel(m.selectedHeading-m.reference):null;
 if(delta!==null){
  const bug=layer(svg,'heading-bug',{transform:'rotate('+delta+' '+cx+' '+cy+')'});
  stroke(bug,[[cx-11,topY-5],[cx-11,topY+4],[cx-5,topY+4],[cx,topY],[cx+5,topY+4],[cx+11,topY+4],[cx+11,topY-5]],COLORS.magenta,2);
  line(bug,cx,topY+11,cx,cy-21,COLORS.magenta,1.25,{'stroke-dasharray':'7 7'});
 }
 if(m.radio&&m.efis.trackValid!==false){
  const drift=rel(m.track-m.heading);
  const p=polar(cx,cy,drift,r-4),left=polar(cx,cy,drift-3,r-19),right=polar(cx,cy,drift+3,r-19);
  polygon(layer(g,'drift'),[p,left,right]);
 }
}
function aircraft(svg,l,full){
 if(!l.aircraft)return;
 const [cx,cy]=l.aircraft,g=layer(svg,'aircraft');
 if(l.calibrated){
  polygon(g,[[cx,cy],[cx-px(37),cy+py(82)],[cx+px(37),cy+py(82)]],PHOTO_COLORS.white,'none',1.9);
 }else if(full){
  line(g,cx,cy-24,cx,cy+26,COLORS.white,2.5);
  line(g,cx-23,cy+3,cx+23,cy+3,COLORS.white,2.5);
  line(g,cx-10,cy+19,cx+10,cy+19,COLORS.white,2.1);
 }else polygon(g,[[cx,cy-22],[cx-12,cy+12],[cx+12,cy+12]],COLORS.white,COLORS.black,2.1);
}
function projection(m,l,plan=false){
 const [cx,cy]=plan?[252,294]:l.roseCenter;
 const scale=(plan?198:l.radius)/m.range,scaleX=plan?scale:(l.radiusX??l.radius)/m.range;
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
 }else polygon(g,Array.from({length:8},(_,i)=>{
  const angle=rad(i*45),size=i%2?7:24;
  return [x+px(Math.sin(angle)*size),y+py(Math.cos(angle)*size*.78)];
 }),color,'none',1.75);
 const dx=px(shape==='nav'?40:shape==='airport'?35:27),labelY=y+py(15);
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
function drawRoute(svg,m,l,status,plan){
 const project=projection(m,l,plan),points=m.route.points,g=layer(svg,plan?'plan-route':'active-route');
 const brightness=String(clamp(m.efis.wxBrightness??1,0,1));
 g.style.opacity=brightness;
 const colors=l.calibrated?PHOTO_COLORS:COLORS;
 const fits=xy=>symbolVisible(xy,l)&&(l.calibrated||plan||Math.hypot(xy[0]-l.roseCenter[0],xy[1]-l.roseCenter[1])<l.radius-33);
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
  positions.forEach(([x,y],i)=>{
   if(fits([x,y]))waypoint(g,x,y,points[i],i===m.route.activeIndex?colors.magenta:colors.white,m.options.rteData,'star',l.calibrated);
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
  if(pt.on&&fits(xy))waypoint(db,...xy,pt,colors.cyan,false,pt.shape,l.calibrated);
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
 if(m.options.vorAdf&&!plan&&m.showSyntheticBearing!==false){
  const [x,y]=l.roseCenter,to=rosePoint(l,rel(224-m.reference),.64);
  line(layer(db,'bearing-radial'),x,y,...to,COLORS.green,1.4,{'stroke-dasharray':'7 5'});
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
 const tip=cy-r+19,stub=full?52:48;
 if(full&&m.radio){
  polygon(n,[[cx,tip],[cx-9,tip+16],[cx-4,tip+16],[cx-4,cy-stub],[cx+4,cy-stub],[cx+4,tip+16],[cx+9,tip+16]],COLORS.white);
  polygon(n,[[cx-4,cy+stub],[cx+4,cy+stub],[cx+4,cy+r-20],[cx-4,cy+r-20]],COLORS.white);
 }else{
  polygon(n,[[cx,tip],[cx-8,tip+12],[cx+8,tip+12]],COLORS.white);
  line(n,cx,tip+13,cx,cy-stub,COLORS.magenta,2.2);
 }
 const spacing=full?21:29;
 if(m.nav.valid&&Number.isFinite(m.nav.cdi)){
  for(const i of [-2,-1,1,2])circle(n,cx+i*spacing,cy,3);
  const x=cx+clamp(m.nav.cdi||0,-2.4,2.4)*spacing;
  line(n,x,cy-stub,x,cy+stub,COLORS.magenta,3.2);
  if(m.radio&&m.nav.type==='VOR'&&m.nav.toFrom){
   if(full)polygon(n,[[cx+14,cy-12],[cx+21,cy-2],[cx+7,cy-2]].map(([x1,y])=>[x1,m.nav.toFrom==='TO'?y:2*cy-y]),COLORS.white);
   text(g,m.nav.toFrom,489,448,17,COLORS.white,'end');
  }
 }else flag(g,m.radio?(m.nav.type==='ILS'?'LOC':'VOR'):'XTK',full?344:357,full?256:379);
}
function vertical(svg,m){
 const isIls=m.radio&&m.nav.type==='ILS',vnav=!m.radio&&m.mode!=='PLAN'&&m.nav.valid&&m.nav.vnavActive;
 if(!isIls&&!vnav)return;
 const g=layer(svg,isIls?'glideslope':'vnav-path'),x=473,mid=isIls?(m.mode==='FULL_VOR_ILS'?281:364):341;
 for(let i=-2;i<=2;i++)circle(g,x,mid+i*18,2.8);
 if(isIls&&!m.nav.gsValid)return;
 const offset=isIls?m.nav.gsDev:m.nav.vnav/200,y=mid+clamp(offset,-2.4,2.4)*18;
 polygon(g,[[x-7,y],[x,y-8],[x+7,y],[x,y+8]],COLORS.magenta,COLORS.black,2);
 if(vnav&&Math.abs(m.nav.vnav)>400)text(g,Math.abs(m.nav.vnav),489,385,14,COLORS.white,'end');
}
function wind(svg,m){
 if(m.mode==='PLAN'||!Number.isFinite(m.windSpeed)||m.windSpeed<=0)return;
 const g=layer(svg,'wind');
 text(g,direction(m.windDirection)+'°/'+m.windSpeed,17,455,17);
 if(m.windSpeed<6)return;
 const arrow=make(g,'g',{transform:'rotate('+rel(m.windDirection+180-m.reference)+' 40 420)'});
 line(arrow,40,435,40,406);stroke(arrow,[[34,414],[40,405],[46,414]]);
}
function footer(svg,m){
 const g=layer(svg,'lower-data');
 wind(g,m);
 if(m.radio){
  text(g,m.nav.source,17,483,18,COLORS.green);
  if(m.nav.frequency!=null)text(g,Number(m.nav.frequency).toFixed(2),493,483,19,COLORS.white,'end');
 }else if(m.mode.endsWith('NAV'))text(g,'NAV',17,483,18,COLORS.green);

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
 if(advisories.length)text(g,'TRAFFIC',402,68,19,alerts,'middle');
 const labels={OFF:'TCAS OFF',FAIL:'TCAS FAIL',TA_ONLY:'TA ONLY',TEST:'TCAS TEST'};
 if(mode==='OFF'&&l.calibrated){
  photoAt(g,'TCAS',407,473,35);
  photoAt(g,'OFF',407,507,35);
 }else if(labels[mode]&&(mode!=='FAIL'||!m.traffic.failSuppressed)){
  text(g,labels[mode],494,88,17,mode==='OFF'||mode==='FAIL'?COLORS.amber:COLORS.white,'end');
 }
 if(!status.trafficOverlay)return;
 text(g,'TFC',18,76,16);
 let offscale=null;
 for(const t of visible){
  const delta=rel(t.bearing-m.reference);
  const xy=rosePoint(l,delta,t.distance/m.range);
  if(t.distance>m.range||Math.abs(delta)>l.degrees/2||!symbolVisible(xy,l)){
   if(t.kind==='RA'||(t.kind==='TA'&&offscale!==COLORS.red))offscale=t.kind==='RA'?COLORS.red:COLORS.amber;
   continue;
  }
  const [x,y]=xy,target=layer(g,'traffic-'+t.kind.toLowerCase());
  const color=t.kind==='RA'?COLORS.red:t.kind==='TA'?COLORS.amber:COLORS.white;
  if(t.kind==='TA')circle(target,x,y,6,color,color);
  else if(t.kind==='RA')make(target,'rect',{x:x-6,y:y-6,width:12,height:12,fill:color});
  else polygon(target,[[x,y-7],[x+7,y],[x,y+7],[x-7,y]],color,t.kind==='PROX'?color:COLORS.black);
  if(Number.isFinite(t.relativeAltitude)){
   const a=Math.round(t.relativeAltitude/100);
   text(target,(a>=0?'+':'-')+String(Math.abs(a)).padStart(2,'0'),x,y+(a>=0?-14:15),14,color,'middle');
  }
  if(Math.abs(t.verticalRate)>=500){
   const s=Math.sign(t.verticalRate);
   line(target,x+12,y+7*s,x+12,y-7*s,color);
   stroke(target,[[x+8,y-3*s],[x+12,y-7*s],[x+16,y-3*s]],color);
  }
 }
 if(offscale)text(g,'OFFSCALE',494,106,16,offscale,'end');
}
function fullLayer(svg,l,aspect){
 const y=l.roseCenter[1];
 return layer(svg,'full-projection',{transform:'translate(0 '+y*(1-aspect)+') scale(1 '+aspect+')'});
}
function render(svg,raw){
 if(!svg)return null;
 const m=model(raw),s=computeDisplay(raw),l=LAYOUT[m.mode];
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
 const plot=layer(svg,'plot',{'clip-path':'url(#'+clipId+')'});
 const aspect=m.efis.displayAspect??DISPLAY_ASPECT;
 const rose=l.full?fullLayer(svg,l,aspect):svg;
 header(svg,m,s);
 radar(plot,m,l,s);
 if(s.compassValid){
  if(l.full)fullCompass(rose,m,l);
  else mapCompass(svg,m,l);
 }
 if(l.route&&s.orientationValid)drawRoute(plot,m,l,s,m.mode==='PLAN');
 if(m.mode==='PLAN'){
  const n=layer(svg,'true-north');
  line(n,472,345,472,305);stroke(n,[[466,313],[472,305],[478,313]]);
  text(n,'N',472,295,17,COLORS.white,'middle');
 }
 if(s.compassValid&&m.mode!=='PLAN'){
  if(!l.route)course(l.full?fullLayer(plot,l,aspect):plot,m,l);
  trend(plot,m,l);
  altitudeArc(plot,m,l);
  aircraft(rose,l,l.degrees===360);
 }
 if(m.efis.verticalFailure&&!m.radio&&m.mode!=='PLAN')flag(svg,'VTK',473,341);
 if(l.route&&!m.nav.valid&&!m.efis.mapFailurePending&&!m.weather.disagreement?.includes('MAP'))flag(svg,'MAP',256,291);
 vertical(svg,m);
 footer(svg,m);
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
return {VERSION,COLORS,MODES,REFERENCE,LAYOUT,FRAME,DISPLAY_ASPECT,rosePoint,norm,rel,model,computeDisplay,render};
});
