/* Source-coordinate FMC route on EHSI PLAN, simulator/reference only.
 * Uses only source-identified ACT-route lat/lon; no guessed aircraft position,
 * no inferred procedure legs and no LNAV, VNAV or AFDS commands.
 * Deliberately independent of locked EFIS CP v3 input assets and geometry. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CDU_NAV_MAP=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const SOURCE='PMDG_WORLD_2610_WITH_PROCEDURES_R1';
 const validCoord=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
 const normDelta=(x)=>((x+540)%360)-180;
 function acceptedRoute(route){
  return !!route&&route.airac==='2610'&&route.sourceId===SOURCE&&
   route.fmcExecutable===false&&route.afdsCommands===false&&
   /^[A-Z0-9]{4}$/.test(route.origin||'')&&
   validCoord(route.originPosition?.lat,-90,90)&&validCoord(route.originPosition?.lon,-180,180)&&
   Array.isArray(route.legs)&&route.legs.length>0&&route.legs.length<=250&&
   route.legs.every(l=>/^[A-Z0-9]{2,8}$/.test(l.to||'')&&
    validCoord(l.lat,-90,90)&&validCoord(l.lon,-180,180)&&
    Number.isFinite(l.distanceNm)&&l.distanceNm>=0);
 }
 function projectRoute(route){
  if(!acceptedRoute(route))throw Error('Not a source-validated reference route');
  const nodes=[{ident:route.origin,lat:route.originPosition.lat,lon:route.originPosition.lon},
     ...route.legs.map(l=>({ident:l.to,lat:l.lat,lon:l.lon}))];
  // Unwrap longitude around each preceding fix so routes crossing the dateline
  // remain near one another on the *reference* overview.
  let unwrapped=nodes[0].lon;
  const values=nodes.map((n,i)=>{
   if(i)unwrapped+=normDelta(n.lon-nodes[i-1].lon);
   return {...n,x:unwrapped,y:n.lat};
  });
  const meanLat=values.reduce((s,n)=>s+n.lat,0)/values.length;
  const cos=Math.max(.02,Math.cos(meanLat*Math.PI/180));
  values.forEach(n=>n.x*=cos);
  const minX=Math.min(...values.map(p=>p.x)),maxX=Math.max(...values.map(p=>p.x));
  const minY=Math.min(...values.map(p=>p.y)),maxY=Math.max(...values.map(p=>p.y));
  const midX=(minX+maxX)/2,midY=(minY+maxY)/2;
  const width=Math.max(1e-8,maxX-minX),height=Math.max(1e-8,maxY-minY);
  const scale=Math.min(252/width,252/height);
  // PLAN is North-up, compass centered on 220/222; reference route is auto-fit,
  // never aircraft/IRS-centered or claimed range-to-scale.
  return values.map(n=>({ident:n.ident,lat:n.lat,lon:n.lon,
    x:220+(n.x-midX)*scale,y:222-(n.y-midY)*scale}));
 }
 function append(doc,parent,tag,attrs,txt){
  const el=doc.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,String(v));
  if(txt!==undefined)el.textContent=String(txt);
  parent.appendChild(el);return el;
 }
 function render(state,svg){
  if(!svg||!state||!state.ehsi)return {displayed:false};
  const prior=svg.querySelector?.('[data-navdb-reference]');
  prior?.remove?.();
  if(state.ehsi.mode!=='PLAN')return {displayed:false,reason:'PLAN_ONLY_NO_AIRCRAFT_POSITION'};
  const route=state.navdbActive;
  if(!acceptedRoute(route))return {displayed:false,reason:'NO_SOURCE_VERIFIED_COMMITTED_ROUTE'};
  const pts=projectRoute(route);
  const doc=svg.ownerDocument||document;
  const group=append(doc,svg,'g',{'data-navdb-reference':'ACT_SOURCE_ROUTE','aria-label':'Read-only AIRAC 2610 reference map'});
  append(doc,group,'polyline',{points:pts.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' '),
     fill:'none',stroke:'#ed76e8','stroke-width':2.6,'stroke-linejoin':'round'});
  const showNames=state.ehsi.options?.wpt===true&&Number(state.ehsi.range)<=40;
  pts.forEach((p,i)=>{
   append(doc,group,i===0?'circle':'rect',i===0?{cx:p.x,cy:p.y,r:4,fill:'#65edfa'}:
      {x:p.x-3.5,y:p.y-3.5,width:7,height:7,stroke:'#65edfa','stroke-width':1.3,fill:'#101b23'});
   if(showNames||i===0||i===pts.length-1){
    append(doc,group,'text',{x:p.x+6,y:p.y-8,fill:'#76dbe8','font-size':11,
       'font-family':'monospace'},p.ident);
   }
  });
  append(doc,group,'rect',{x:50,y:335,width:340,height:66,rx:6,fill:'#051018',opacity:.96});
  append(doc,group,'text',{x:220,y:354,'text-anchor':'middle',fill:'#ffbf76',
      'font-size':11,'font-family':'monospace'},'ACT AIRAC 2610 — REFERENCE ROUTE');
  append(doc,group,'text',{x:220,y:370,'text-anchor':'middle',fill:'#eeeeee',
      'font-size':10,'font-family':'monospace'},'AUTO-FIT · NOT AIRCRAFT-CENTERED · NO IRS');
  append(doc,group,'text',{x:220,y:386,'text-anchor':'middle',fill:'#ffbf76',
      'font-size':11,'font-family':'monospace'},'NOT LNAV / VNAV / AFDS GUIDANCE');
  return {displayed:true,count:pts.length,mode:'PLAN',navGuidance:false,source:SOURCE};
 }
 return Object.freeze({SOURCE,acceptedRoute,projectRoute,render});
});