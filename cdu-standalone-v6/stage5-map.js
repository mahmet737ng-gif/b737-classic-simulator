/* Only contiguous sourced FIX-to-FIX reference chords on EHSI PLAN.
 * Explicit ROUTE DISCONTINUITY breaks polylines. No aircraft positioning. */
(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('./stage5-model.js'):root?.NPE_STAGE5_MODEL);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CDU_STAGE5_MAP=api;})(typeof window==='undefined'?null:window,function(model){
'use strict';const ns='http://www.w3.org/2000/svg';
function project(groups){const all=groups.flat();if(!all.length)return [];
 let prev=null,x=0;const world=all.map(p=>{if(prev===null)x=p.lon;else x+=((p.lon-prev+540)%360)-180;prev=p.lon;return {...p,lonUnwrapped:x}});
 const meanLat=world.reduce((a,p)=>a+p.lat,0)/world.length;const cos=Math.max(.05,Math.cos(meanLat*Math.PI/180));world.forEach(p=>{p.x=p.lonUnwrapped*cos;p.y=p.lat});
 let minX=Math.min(...world.map(p=>p.x)),maxX=Math.max(...world.map(p=>p.x)),minY=Math.min(...world.map(p=>p.y)),maxY=Math.max(...world.map(p=>p.y));
 const scale=Math.min(246/Math.max(0.0001,maxX-minX),246/Math.max(0.0001,maxY-minY));const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 let i=0;return groups.map(g=>g.map(_=>{const p=world[i++];return {x:220+(p.x-cx)*scale,y:210-(p.y-cy)*scale,ident:p.ident}}));
}
function accepted(state){return !!state?.stage5Committed&&state.ehsi?.mode==='PLAN'&&model.validate(state.stage5Committed).executable===false;}
function render(state,svg){
 if(!svg)return {displayed:false};svg.querySelector?.('[data-npe-stage5]')?.remove?.();
 if(!accepted(state))return {displayed:false,reason:'NO_COMMITTED_REFERENCE_PLAN'};
 const lines=project(model.safeReferenceLines(state.stage5Committed));
 const doc=svg.ownerDocument||document;
 const el=(parent,tag,attrs,label)=>{const node=doc.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));if(label!==undefined)node.textContent=label;parent.appendChild(node);return node};
 const g=el(svg,'g',{'data-npe-stage5':'SOURCE_COORDINATE_ONLY'});
 for(const line of lines){el(g,'polyline',{points:line.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' '),fill:'none',stroke:'#ee73e2','stroke-width':2.4});for(const p of line){el(g,'circle',{cx:p.x,cy:p.y,r:3,fill:'#72e7e9'})}}
 el(g,'rect',{x:39,y:334,width:363,height:65,fill:'#07131a',opacity:.95,rx:5});
 el(g,'text',{x:220,y:354,'text-anchor':'middle',fill:'#ffa963','font-size':11},'AIRAC 2610 · ACT REFERENCE ONLY');
 el(g,'text',{x:220,y:370,'text-anchor':'middle',fill:'#fff','font-size':10},'DISCONTINUITIES NOT CONNECTED');
 el(g,'text',{x:220,y:386,'text-anchor':'middle',fill:'#ffa963','font-size':10},'NO LNAV / VNAV / AFDS GUIDANCE');
 return {displayed:true,segments:lines.length,referenceOnly:true};
}
return Object.freeze({accepted,project,render});
});