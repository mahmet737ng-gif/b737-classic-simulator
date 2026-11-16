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
 function draw(svg,source,mode,range,powered,offset,project,anchor){
  if(!svg)return 0;
  svg.querySelector('[data-cdu-sg-reference]')?.remove();
  if(!powered||!['PLAN','MAP','CTR_MAP'].includes(mode)||!Number.isFinite(range)||range<=0||
     typeof offset!=='function'||(mode!=='PLAN'&&(!anchor||typeof project!=='function')))return 0;
  const segments=collect(source),fixes=collectFixes(source);
  if(!segments.length&&!fixes.length)return 0;
  const make=(parent,name,attrs)=>{const el=svg.ownerDocument.createElementNS(NS,name);
   for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,String(v));
   parent.appendChild(el);return el};
  const group=make(svg,'g',{'data-cdu-sg-reference':'true','pointer-events':'none',
   'data-route-state':source.modified?'MOD':'ACT','aria-label':'Reference geometry'});
  const clip='cdu-sg-ref-clip-'+(svg.id||'SG'),def=make(group,'clipPath',{id:clip});
  make(def,'rect',{x:17,y:73,width:478,height:391});
  const lines=make(group,'g',{'clip-path':'url(#'+clip+')'});
  const [firstLon,firstLat]=segments.length?segments[0][0]:[fixes[0].lon,fixes[0].lat];
  const ref=Number.isFinite(anchor?.lat)&&Number.isFinite(anchor?.lon)?anchor:{lat:firstLat,lon:firstLon};
  const scale=178/range, color=source.modified?'#ffffff':'#ff47e1';
  const xyFor=(lon,lat)=>{
   const d=offset(ref,{lat,lon});
   return typeof project==='function'?project(d.x,d.y):[252+d.x*scale,294-d.y*scale];
  };
  let count=0;
  for(const pair of segments.slice(0,300)){
   const xy=pair.map(([lon,lat])=>xyFor(lon,lat));
   if(xy.some(pt=>!pt.every(Number.isFinite)))continue;
   make(lines,'path',{d:'M'+xy[0].join(' ')+' L'+xy[1].join(' '),fill:'none',
    stroke:color,'stroke-width':1.5,'stroke-dasharray':'5 5',
    'stroke-opacity':0.8,'data-reference-only':'true'});
   count++;
  }
  let marked=0;
  for(const fix of fixes){
   const [x,y]=xyFor(fix.lon,fix.lat);
   if(!Number.isFinite(x)||!Number.isFinite(y)||x<20||x>492||y<76||y>460)continue;
   make(lines,'circle',{cx:x,cy:y,r:3.2,fill:color,'data-sourced-fix':'true'});
   const tag=make(lines,'text',{x:x+6,y:y-5,fill:color,'font-size':11,
    'font-family':'monospace','data-source-ident':'true'});
   tag.textContent=fix.ident;marked++;
  }
  const label=make(group,'text',{x:476,y:99,fill:color,
   'font-size':13,'text-anchor':'end','data-cdu-sg-status':'REFERENCE_ONLY'});
  label.textContent=source.modified?'MOD REF':'ACT REF';return count+marked;
 }
 return Object.freeze({VERSION,collect,collectFixes,draw});
});
