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
   {stage:'ACT',color:'#ff47e1',dash:null,geometries:Object.values(active).filter(valid)},
   ...(changed?[{stage:'MOD',color:'#00c8f2',dash:'7 5',
    geometries:Object.values(changed).filter(valid)}]:[])
  ].filter(layer=>layer.geometries.length);
  if(!layers.length)return 0;
  const state=pending?'MOD':'ACT',color=pending?'#00c8f2':'#ff47e1';
  const make=(parent,name,attrs={})=>{
   const el=svg.ownerDocument.createElementNS(NS,name);
   for(const [k,v] of Object.entries(attrs))if(v!==null&&v!==undefined)el.setAttribute(k,String(v));
   parent.appendChild(el);return el;
  };
  const group=make(svg,'g',{'data-cdu-sg-reference':'true','pointer-events':'none',
   'data-route-state':state,'data-source-only':'true','aria-label':'Non-executable CDU route reference'});
  function label(reason=''){
   const tag=make(group,'text',{x:475,y:386,fill:color,'font-size':14,
    'text-anchor':'end','data-cdu-sg-status':reason||'REFERENCE_ONLY'});
   tag.textContent=state+' REF'+(reason?' '+reason:'');
  }
  const positioned=Number.isFinite(anchor?.lat)&&Number.isFinite(anchor?.lon);
  if(mode!=='PLAN'&&(!positioned||typeof project!=='function')){
   label(positioned?'NO TRK':'NO POS');return 0;
  }
  // Prefer the selected runway threshold when there is no active PLAN anchor.
  // Never manufacture a leg from a single unsourced airport point.
  const all=layers.flatMap(x=>x.geometries);
  const runway=all.find(x=>x.kind==='RUNWAY'&&x.fixes?.length)?.fixes[0];
  const fix=all.find(x=>x.fixes?.length)?.fixes[0];
  const pair=all.find(x=>x.segments?.length)?.segments[0]?.[0];
  const first=runway||fix||(pair&&{lon:pair[0],lat:pair[1]});
  if(!first){label('NO VERIFIED POINT');return 0;}
  const ref=positioned?anchor:first,scale=178/range;
  const xyFor=(lon,lat)=>{
   const d=offset(ref,{lat,lon});
   return typeof project==='function'?project(d.x,d.y):[252+d.x*scale,294-d.y*scale];
  };
  let count=0;
  for(const layer of layers){
   const plot=make(group,'g',{'data-cdu-sg-plot':'true','data-reference-stage':layer.stage});
   for(const g of layer.geometries){
    for(const segment of (g.segments||[]).slice(0,300)){
     if(!Array.isArray(segment)||segment.length!==2||!segment.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))continue;
     const xy=clipSegment(segment.map(([lon,lat])=>xyFor(lon,lat)));
     if(!xy)continue;
     make(plot,'path',{d:'M'+xy[0].join(' ')+' L'+xy[1].join(' '),fill:'none',
      stroke:layer.color,'stroke-width':2.1,'stroke-dasharray':layer.dash,
      'data-reference-stage':layer.stage,'data-reference-only':'true',
      'data-cdu-sg-geometry':g.kind==='RUNWAY'?'RUNWAY':'PROCEDURE'});
     count++;
    }
    for(const point of (g.fixes||[]).slice(0,150)){
     if(!Number.isFinite(point.lon)||!Number.isFinite(point.lat))continue;
     const xy=xyFor(point.lon,point.lat);
     if(!onPlot(xy,7))continue;
     const [x,y]=xy,right=x>450;
     if(g.kind==='RUNWAY'){
      // Source threshold marker: not a fabricated centerline or turn arc.
      const pin=make(plot,'g',{'data-cdu-sg-runway':g.ident,'data-airport':g.airport,
       'data-reference-stage':layer.stage,'data-reference-only':'true'});
      make(pin,'path',{d:'M'+x+' '+(y-9)+' L'+(x-8)+' '+(y+7)+' L'+(x+8)+' '+(y+7)+' Z',
       fill:'none',stroke:layer.color,'stroke-width':1.9});
      const t=make(pin,'text',{x:x+(right?-12:12),y:y-4,fill:layer.color,'font-size':13,
       'text-anchor':right?'end':'start','font-family':'monospace'});
      t.textContent=g.airport+' RWY '+g.ident;
     }else{
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
  label(count?'':'OFF MAP');
  return count;
 }

 return Object.freeze({VERSION,collect,collectFixes,draw});
});
