/* Non-executable CDU/SG reference geometry for the EHSI PLAN screen. */
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
 function draw(svg,source,mode,range,powered,offset){
  if(!svg)return 0;
  svg.querySelector('[data-cdu-sg-reference]')?.remove();
  if(!powered||mode!=='PLAN'||!Number.isFinite(range)||range<=0||typeof offset!=='function')return 0;
  const segments=collect(source);if(!segments.length)return 0;
  const make=(parent,name,attrs)=>{const el=svg.ownerDocument.createElementNS(NS,name);
   for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,String(v));
   parent.appendChild(el);return el};
  const group=make(svg,'g',{'data-cdu-sg-reference':'true','pointer-events':'none',
   'aria-label':'Unverified reference chords, not aircraft LNAV path'});
  const clip='cdu-sg-ref-clip-'+(svg.id||'SG'),def=make(group,'clipPath',{id:clip});
  make(def,'rect',{x:17,y:73,width:478,height:391});
  const lines=make(group,'g',{'clip-path':'url(#'+clip+')'});
  const [firstLon,firstLat]=segments[0][0],anchor={lat:firstLat,lon:firstLon},scale=178/range;
  let count=0;
  for(const pair of segments.slice(0,300)){
   const xy=pair.map(([lon,lat])=>{const d=offset(anchor,{lat,lon});return [252+d.x*scale,294-d.y*scale]});
   if(xy.some(pt=>!pt.every(Number.isFinite)))continue;
   make(lines,'path',{d:'M'+xy[0].join(' ')+' L'+xy[1].join(' '),fill:'none',
    stroke:'#6ce6f2','stroke-width':1.5,'stroke-dasharray':'5 5',
    'stroke-opacity':0.8,'data-reference-only':'true'});
   count++;
  }
  const label=make(group,'text',{x:476,y:99,fill:'#6ce6f2',
   'font-size':13,'text-anchor':'end','data-cdu-sg-status':'REFERENCE_ONLY'});
  label.textContent='REF ONLY';return count;
 }
 return Object.freeze({VERSION,collect,draw});
});
