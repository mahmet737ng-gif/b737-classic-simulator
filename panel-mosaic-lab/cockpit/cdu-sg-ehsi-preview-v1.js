/* Non-executable CDU/SG reference geometry for the EHSI MAP and PLAN screens. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737CduSgEHSIPreviewV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',VERSION='CDU-SG-EHSI-ROUTE-TRAJECTORY-0002';
 const Trajectory=(typeof globalThis==='object'?globalThis.B737UnifiedSGProcedureTrajectoryV1:null)||
  (typeof module==='object'&&typeof require==='function'?require('../../engine/fmc/sg-procedure-trajectory-v1.js'):null);
 function collect(s){
  if(!s?.connected||s.sourceOnly!==true||s.fmcExecutable!==false)return [];
  return Object.values(s.geometries||{}).flatMap(x=>x?.renderStyle==='DASHED_REFERENCE_CHORDS_ONLY'?
   (x.segments||[]):[]).filter(a=>Array.isArray(a)&&a.length===2);
 }
 function collectFixes(s){
  if(!s?.connected||s.sourceOnly!==true||s.fmcExecutable!==false)return [];
  return Object.values(s.geometries||{}).flatMap(x=>x?.renderStyle==='DASHED_REFERENCE_CHORDS_ONLY'?
   (x.fixes||[]):[]).filter(x=>x&&Number.isFinite(x.lon)&&Number.isFinite(x.lat)&&
     Math.abs(x.lon)<=180&&Math.abs(x.lat)<=90&&typeof x.ident==='string').slice(0,150);
 }
 // Match the calibrated EHSI plot aperture and clip the actual coordinates.
 // This also keeps visibility independent of a document's HTML base URL.
 const PLOT={left:1,right:511,top:49,bottom:511};
 const onPlot=([x,y],pad=0)=>x>=PLOT.left+pad&&x<=PLOT.right-pad&&
  y>=PLOT.top+pad&&y<=PLOT.bottom-pad;
 function clipSegment([[x,y],[endX,endY]]){
  if(![x,y,endX,endY].every(Number.isFinite))return null;
  const dx=endX-x,dy=endY-y;
  let start=0,end=1;
  for(const [direction,distance] of [
   [-dx,x-PLOT.left],[dx,PLOT.right-x],[-dy,y-PLOT.top],[dy,PLOT.bottom-y]
  ]){
   if(direction<0)start=Math.max(start,distance/direction);
   else if(direction>0)end=Math.min(end,distance/direction);
   else if(distance<0)return null;
   if(start>=end)return null;
  }
  return [[x+start*dx,y+start*dy],[x+end*dx,y+end*dy]];
 }
 function draw(svg,source,mode,range,powered,offset,project,anchor,flight=null){
  if(!svg)return 0;
  svg.querySelector('[data-cdu-sg-reference]')?.remove();
  if(!powered||!['PLAN','MAP','CTR_MAP','EXP_NAV','FULL_NAV'].includes(mode)||!Number.isFinite(range)||range<=0||
     typeof offset!=='function'||source?.connected!==true||source?.sourceOnly!==true||
     source?.fmcExecutable!==false)return 0;

  // ACT is the last confirmed, reference-only plan. MOD is a preview overlay:
  // unchanged elements of the confirmed plan remain solid magenta while new
  // or altered geometry is cyan dashed. EXEC promotes MOD to ACT atomically.
  const active=source.active?.geometries||{},pending=source.modified?.geometries||null;
  const changed=pending?Object.fromEntries(Object.entries(pending).filter(([key,value])=>
   JSON.stringify(value)!==JSON.stringify(active[key]))):null;
  const valid=x=>x?.renderStyle==='DASHED_REFERENCE_CHORDS_ONLY';
  const layers=[
   {stage:'ACT',color:'#ff47e1',dash:null,geometries:Object.entries(active)
    .filter(([k,g])=>valid(g)&&!(g.kind==='RUNWAY'&&pending?.[k]&&
      JSON.stringify(g)!==JSON.stringify(pending[k]))).map(([,g])=>g)},
   ...(changed?[{stage:'MOD',color:'#00c8f2',dash:'7 5',
    geometries:Object.values(changed).filter(valid)}]:[])
  ].filter(layer=>layer.geometries.length);
  if(!layers.length)return 0;
  const state=pending?'MOD':'ACT';
  const make=(parent,name,attrs={})=>{
   const el=svg.ownerDocument.createElementNS(NS,name);
   for(const [k,v] of Object.entries(attrs))if(v!==null&&v!==undefined)el.setAttribute(k,String(v));
   parent.appendChild(el);return el;
  };
  const group=make(svg,'g',{'data-cdu-sg-reference':'true','pointer-events':'none',
   'data-route-state':state,'data-source-only':'true','aria-label':'Non-executable CDU route reference'});
  const positioned=Number.isFinite(anchor?.lat)&&Number.isFinite(anchor?.lon);
  if(mode!=='PLAN'&&(!positioned||typeof project!=='function'))return 0;

  // Prefer the selected runway threshold when there is no active PLAN anchor.
  // Never manufacture a leg from a single unsourced airport point.
  const all=layers.flatMap(x=>x.geometries);
  const runway=all.find(x=>x.kind==='RUNWAY'&&x.fixes?.length)?.fixes[0];
  const fix=all.find(x=>x.fixes?.length)?.fixes[0];
  const pair=all.find(x=>x.segments?.length)?.segments[0]?.[0];
  const first=runway||fix||(pair&&{lon:pair[0],lat:pair[1]});
  if(!first)return 0;
  const ref=positioned?anchor:first,scale=178/range;
  const xyFor=(lon,lat)=>{
   const d=offset(ref,{lat,lon});
   return typeof project==='function'?project(d.x,d.y):[252+d.x*scale,294-d.y*scale];
  };
  let count=0;
  for(const layer of layers){
   const plot=make(group,'g',{'data-cdu-sg-plot':'true','data-reference-stage':layer.stage});
   for(const g of layer.geometries){
    if(g.kind==='RUNWAY'){
     const axis=g.segments?.[0],threshold=g.fixes?.[0];
     const shape=make(plot,'g',{'data-cdu-sg-runway':g.ident,'data-airport':g.airport,
      'data-reference-stage':layer.stage,'data-reference-only':'true'});
     if(Array.isArray(axis)&&axis.length===2&&axis.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))){
      const a=xyFor(...axis[0]),b=xyFor(...axis[1]);
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(Number.isFinite(len)&&len>.25){
       const ux=dx/len,uy=dy/len,nx=-uy,ny=ux,half=Math.max(3,Math.min(5,len*.22));
       const edge=(p,k)=>[p[0]+k*nx*half,p[1]+k*ny*half];
       const corners=[edge(a,1),edge(b,1),edge(b,-1),edge(a,-1)];
       make(shape,'path',{d:corners.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')+' Z',
        fill:'none',stroke:'#f4f7fa','stroke-width':2.1,
        'data-cdu-sg-geometry':'RUNWAY','data-runway-outline':'true'});count++;
       const extension=Math.max(45,Math.min(150,1200/range));
       for(const [name,from,to] of [
        ['FINAL',[a[0]-ux*extension,a[1]-uy*extension],a],
        ['UPWIND',b,[b[0]+ux*extension,b[1]+uy*extension]]
       ]){
        const line=clipSegment([from,to]);if(!line)continue;
        make(shape,'path',{d:'M'+line[0].join(' ')+' L'+line[1].join(' '),
         fill:'none',stroke:'#f4f7fa','stroke-width':2,'stroke-dasharray':'10 8',
         'data-runway-extension':name,'data-reference-only':'true'});count++;
       }
      }
     }
     if(Number.isFinite(threshold?.lon)&&Number.isFinite(threshold?.lat)){
      const xy=xyFor(threshold.lon,threshold.lat);
      if(onPlot(xy,7)){
       const [x,y]=xy,right=x>450;
       if(!axis?.length){
        make(shape,'circle',{cx:x,cy:y,r:5,stroke:'#f4f7fa',fill:'none',
         'data-runway-threshold-only':'true'});count++;
       }
       const name=make(shape,'text',{x:x+(right?-12:12),y:y-9,fill:'#f4f7fa',
        'font-size':12,'text-anchor':right?'end':'start','font-family':'monospace'});
       name.textContent=g.airport+' '+g.ident;count++;
      }
     }
     continue;
    }
    // Source-command leg programs take priority over raw fix-to-fix chords.
    const model=g.program?Trajectory?.trajectory?.(g.program,flight):null;
    if(model&&Array.isArray(model.segments)){
     for(const leg of model.segments){
      if(!Array.isArray(leg.points)||leg.points.length<2)continue;
      const paths=[];
      for(let i=1;i<leg.points.length;i++){
       const a=leg.points[i-1],b=leg.points[i];
       if(!Number.isFinite(a?.lon)||!Number.isFinite(a?.lat)||
          !Number.isFinite(b?.lon)||!Number.isFinite(b?.lat))continue;
       const clipped=clipSegment([xyFor(a.lon,a.lat),xyFor(b.lon,b.lat)]);
       if(clipped)paths.push('M'+clipped[0].join(' ')+' L'+clipped[1].join(' '));
      }
      if(!paths.length)continue;
      make(plot,'path',{d:paths.join(' '),fill:'none',stroke:layer.color,
       'stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round',
       'stroke-dasharray':layer.dash,'data-trajectory-leg':leg.type,
       'data-trajectory-profile':model.profile,
       'data-cdu-sg-geometry':'PROCEDURE','data-reference-stage':layer.stage,
       'data-reference-only':'true'});count++;
     }
    }
    if(!g.program)for(const segment of (g.segments||[]).slice(0,300)){
     if(!Array.isArray(segment)||segment.length!==2||!segment.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))continue;
     const xy=clipSegment(segment.map(([lon,lat])=>xyFor(lon,lat)));
     if(!xy)continue;
     make(plot,'path',{d:'M'+xy[0].join(' ')+' L'+xy[1].join(' '),fill:'none',
      stroke:layer.color,'stroke-width':2.1,'stroke-dasharray':layer.dash,
      'data-reference-stage':layer.stage,'data-reference-only':'true',
      'data-cdu-sg-geometry':'PROCEDURE'});
     count++;
    }
    for(const point of (g.fixes||[]).slice(0,150)){
     if(!Number.isFinite(point.lon)||!Number.isFinite(point.lat))continue;
     const xy=xyFor(point.lon,point.lat);
     if(!onPlot(xy,7))continue;
     const [x,y]=xy,right=x>450;
     {
      make(plot,'circle',{cx:x,cy:y,r:3.2,fill:layer.color,'data-sourced-fix':'true'});
      const t=make(plot,'text',{x:x+(right?-6:6),y:y<65?y+15:y-5,fill:layer.color,
       'font-size':12,'text-anchor':right?'end':'start','font-family':'monospace',
       'data-source-ident':'true'});
      t.textContent=point.ident;
     }
     count++;
    }
   }
  }
  return count;
 }

 return Object.freeze({VERSION,collect,collectFixes,draw});
});
