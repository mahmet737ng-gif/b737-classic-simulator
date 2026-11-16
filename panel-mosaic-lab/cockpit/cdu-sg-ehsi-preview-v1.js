/* Non-executable CDU/SG reference geometry for the EHSI MAP and PLAN screens. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737CduSgEHSIPreviewV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',VERSION='CDU-SG-EHSI-REF-0001';
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
 function draw(svg,source,mode,range,powered,offset,project,anchor){
  if(!svg)return 0;
  svg.querySelector('[data-cdu-sg-reference]')?.remove();
  if(!powered||!['PLAN','MAP','CTR_MAP'].includes(mode)||!Number.isFinite(range)||range<=0||
     typeof offset!=='function')return 0;
  const segments=collect(source),fixes=collectFixes(source);
  if(!segments.length&&!fixes.length)return 0;
  const make=(parent,name,attrs)=>{const el=svg.ownerDocument.createElementNS(NS,name);
   for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
   parent.appendChild(el);return el};
  const state=source.modified?'MOD':'ACT';
  const color=source.modified?'#ffffff':'#ff47e1';
  const group=make(svg,'g',{'data-cdu-sg-reference':'true','pointer-events':'none',
   'data-route-state':state,'aria-label':'Reference geometry'});
  function label(reason=''){
   const tag=make(group,'text',{x:475,y:386,fill:color,'font-size':14,
    'text-anchor':'end','data-cdu-sg-status':reason||'REFERENCE_ONLY'});
   tag.textContent=state+' REF'+(reason?' '+reason:'');
  }
  const positioned=Number.isFinite(anchor?.lat)&&Number.isFinite(anchor?.lon);
  if(mode!=='PLAN'&&(!positioned||typeof project!=='function')){
   label(positioned?'NO TRK':'NO POS');return 0;
  }
  const runway=Object.values(source.geometries).find(g=>g.kind==='RUNWAY')?.fixes?.[0];
  const [lon,lat]=segments[0]?.[0]??[fixes[0].lon,fixes[0].lat];
  const ref=positioned?anchor:runway??{lat,lon};
  const scale=178/range;
  const xyFor=(lon,lat)=>{
   const d=offset(ref,{lat,lon});
   return typeof project==='function'?project(d.x,d.y):[252+d.x*scale,294-d.y*scale];
  };
  const plot=make(group,'g',{'data-cdu-sg-plot':'true'});
  let count=0;
  for(const pair of segments.slice(0,300)){
   const xy=clipSegment(pair.map(([lon,lat])=>xyFor(lon,lat)));
   if(!xy)continue;
   make(plot,'path',{d:'M'+xy[0].join(' ')+' L'+xy[1].join(' '),fill:'none',
    stroke:color,'stroke-width':1.8,'stroke-dasharray':'5 5',
    'data-reference-only':'true'});
   count++;
  }
  for(const fix of fixes){
   const xy=xyFor(fix.lon,fix.lat);
   if(!onPlot(xy,5))continue;
   const [x,y]=xy,right=x>450;
   make(plot,'circle',{cx:x,cy:y,r:3.2,fill:color,'data-sourced-fix':'true'});
   const tag=make(plot,'text',{x:x+(right?-6:6),y:y<65?y+15:y-5,fill:color,'font-size':12,
    'text-anchor':right?'end':'start','font-family':'monospace','data-source-ident':'true'});
   tag.textContent=fix.ident;
   count++;
  }
  label(count?'':'OFF MAP');
  return count;
 }
 return Object.freeze({VERSION,collect,collectFixes,draw});
});
