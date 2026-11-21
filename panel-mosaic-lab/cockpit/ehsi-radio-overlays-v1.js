/* Unified EHSI valid-radio overlays. Read-only; no synthetic NAV/ADF signal.
 * Independent valid NAV1/NAV2 + powered MCP CRS1/CRS2 -> two dashed green courses on each EHSI.
 * EFIS VOR/ADF option + valid receiver -> solid green station bearing.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.B737UnifiedEhsiRadioOverlayV1=api;
})(globalThis,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',NM=3440.065;
 const norm=n=>((n%360)+360)%360;
 const valid=rec=>rec?.quality==='VALID'&&rec.value&&typeof rec.value==='object'?rec.value:null;
 const coords=o=>Number.isFinite(o?.lat)&&Math.abs(o.lat)<=90&&
  Number.isFinite(o?.lon)&&Math.abs(o.lon)<=180;
 const station=o=>Number.isFinite(o?.stationLat)&&Number.isFinite(o?.stationLon)?
  {lat:o.stationLat,lon:o.stationLon}:null;
 function positionDelta(from,to){
  const r=Math.PI/180,lat1=from.lat*r,lat2=to.lat*r,dl=norm(to.lon-from.lon+180)*r-180*r;
  const dLat=lat2-lat1;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dl/2)**2;
  const arc=2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
  const bearing=Math.atan2(Math.sin(dl)*Math.cos(lat2),
   Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dl));
  const distance=arc*NM;
  return {x:distance*Math.sin(bearing),y:distance*Math.cos(bearing),distance,bearingTrue:norm(bearing/r)};
 }
 function adfMagnetic(data,src){
  const bearing=data?.bearingDeg;
  if(!Number.isFinite(bearing))return null;
  if(data.bearingReference==='MAGNETIC')return norm(bearing);
  if(data.bearingReference==='TRUE'&&Number.isFinite(src?.magneticVariationDeg))
   return norm(bearing-src.magneticVariationDeg);
  if(data.bearingReference==='RELATIVE'&&Number.isFinite(src?.heading))
   return norm(bearing+src.heading);
  return null;
 }
 function plan({snapshot,src,position,options={},range=40,mode='MAP'}={}){
  const result={courses:[],pointers:[]};
  // The twin green MCP CRS1/CRS2 lines are an owner-requested MAP overlay.
  // FCOM 10.31.8 FULL NAV must display the FMC-selected course instead.
  if(!['MAP','CTR_MAP','EXP_NAV'].includes(mode)||
   !coords(position)||!Number.isFinite(range)||range<=0||!src)return result;
  const decl=src.magneticVariationDeg;
  const mcp=valid(snapshot?.['mcp.state']);
  // Both MCP windows are shared aircraft selections. Display CRS1 and CRS2
  // on BOTH EHSIs, independent of the receiving seat, transfer switch, SG or
  // EFIS VOR/ADF pointer selection. Each radio course uses its OWN NAV channel.
  for(const channel of [1,2]){
   const powered=channel===1?mcp?.powered===true:mcp?.course2Powered===true;
   const selectedCourse=channel===1?mcp?.courseL:mcp?.courseR;
   const vor=valid(snapshot?.['navigation.vor'+channel]);
   const ils=valid(snapshot?.['navigation.ils'+channel]);
   const selected=station(vor)?vor:station(ils)?ils:null;
   if(!powered||!Number.isFinite(selectedCourse)||!Number.isFinite(decl)||!selected)continue;
   const delta=positionDelta(position,station(selected));
   result.courses.push({channel,type:selected===vor?'VOR':'ILS',
    degree:norm(selectedCourse),trueDegree:norm(selectedCourse+decl),
    delta,near:delta.distance<=range*.9});
  }
  if(options.vorAdf!==true)return result;
  for(const channel of [1,2]){
   const vor=valid(snapshot?.['navigation.vor'+channel]);
   if(station(vor)){
    const delta=positionDelta(position,station(vor));
    const radial=Number.isFinite(vor.radialDeg)?norm(vor.radialDeg):
     Number.isFinite(decl)?norm(positionDelta(station(vor),position).bearingTrue-decl):null;
    result.pointers.push({channel,type:'V',delta,degree:radial,label:radial===null?
     'V'+channel:'V'+channel+'-'+String(Math.round(radial)%360).padStart(3,'0')});
   }
   const adf=valid(snapshot?.['navigation.adf'+channel]);
   if(adf){
    const bearing=adfMagnetic(adf,src);
    if(bearing===null)continue;
    const target=station(adf);
    // With a valid ADF bearing but no station coordinates, the line extends
    // to the selected EHSI scale; it is NOT labeled as a located station.
    const delta=target?positionDelta(position,target):{
     x:Math.sin(bearing*Math.PI/180)*range,
     y:Math.cos(bearing*Math.PI/180)*range,distance:range};
    const label='A'+channel+'-'+String(Math.round(bearing)%360).padStart(3,'0');
    result.pointers.push({channel,type:'A',delta,degree:bearing,label,
     stationLocated:!!target});
   }
  }
  return result;
 }
 function draw(svg,model,src,snapshot,position,renderer){
  if(!svg||!renderer)return null;
  svg.querySelector('[data-radio-nav-overlay]')?.remove();
  const selection=plan({snapshot,src,position,options:model?.options,
   range:model?.range,mode:model?.mode});
  if(!selection.courses.length&&!selection.pointers.length)return selection;
  const projector=renderer.routeProjection?.(model);
  const layout=renderer.LAYOUT?.[model?.mode];
  if(!projector||!layout?.roseCenter)return selection;
  const doc=svg.ownerDocument,make=(parent,tag,props={},value)=>{
   const e=doc.createElementNS(NS,tag);
   for(const [k,v] of Object.entries(props))e.setAttribute(k,String(v));
   if(value!==undefined)e.textContent=String(value);
   parent.append(e);return e;
  };
  const color=renderer.COLORS?.green||'#41f585';
  const clipId=(svg.id||'unified-ehsi')+'-radio-clip';
  const root=make(svg,'g',{'data-radio-nav-overlay':'true','pointer-events':'none'});
  const defs=make(root,'defs'),clip=make(defs,'clipPath',{id:clipId});
  const [cx,cy]=layout.roseCenter;
  make(clip,'ellipse',{cx,cy,rx:(layout.radiusX??layout.radius)-3,ry:layout.radius-3});
  const lines=make(root,'g',{'clip-path':'url(#'+clipId+')'});
  const line=(name,xy1,xy2,dashed=false,extra={})=>make(lines,'line',{
   x1:xy1[0],y1:xy1[1],x2:xy2[0],y2:xy2[1],
   stroke:color,'stroke-width':dashed?1.8:2.25,
   ...(dashed?{'stroke-dasharray':'9 12'}:{}),'data-segment':name,...extra});
  const label=(text,xy,kind)=>make(lines,'text',{x:xy[0]+9,y:xy[1]-8,
   fill:color,'font-size':17,'font-weight':500,
   'font-family':'Lucida Console, monospace','stroke':'#030405',
   'stroke-width':.75,'paint-order':'stroke',
   'data-segment':kind},text);
  const maxNm=Math.max(5,model.range*2.2);
  for(const c of selection.courses){
   const r=c.trueDegree*Math.PI/180;
   const dx=Math.sin(r)*maxNm,dy=Math.cos(r)*maxNm;
   const p1=projector(c.delta.x-dx,c.delta.y-dy),p2=projector(c.delta.x+dx,c.delta.y+dy);
   line('nav-selected-course',p1,p2,true,{'data-channel':c.channel,'data-course':c.degree});
   if(c.near){
    const p=projector(c.delta.x,c.delta.y);
    // Keep the two selected course numbers readable when NAV1 and NAV2
    // happen to be tuned to the same station.
    const xy=[p[0]+(c.channel===1?-20:20),p[1]+(c.channel===1?-9:9)];
    if(xy[0]>28&&xy[0]<466&&xy[1]>86&&xy[1]<455){
     const printed=label(String(Math.round(c.degree)%360).padStart(3,'0'),xy,'nav-course-number');
     printed.setAttribute('data-channel',String(c.channel));
    }
   }
  }
  const own=projector(0,0);
  for(const target of selection.pointers){
   const d=target.delta,point=projector(d.x,d.y);
   line('nav-station-bearing',own,point,false,
    {'data-channel':target.channel,'data-source':target.type,'data-degree':target.degree??''});
   const factor=d.distance>0?Math.min(.82,.78*model.range/d.distance):.5;
   const p=projector(d.x*factor,d.y*factor);
   if(p[0]>26&&p[0]<467&&p[1]>83&&p[1]<460)
    label(target.label,p,'nav-bearing-label');
  }
  return selection;
 }
 return Object.freeze({version:'EHSI-RADIO-OVERLAYS-0003-FULL-NAV-FCOM-GATE',positionDelta,adfMagnetic,plan,draw});
});
