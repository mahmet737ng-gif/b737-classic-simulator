/* FCOM 11.31.21–22 pilot-defined waypoints. Training-only coordinates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737PilotWaypointsV1=api;})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const R=3440.065,r=Math.PI/180,wrap=x=>(x%360+360)%360,clamp=x=>Math.max(-1,Math.min(1,x));
const good=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const distance=(a,b)=>2*R*Math.asin(Math.sqrt(Math.min(1,Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2)));
function bearing(a,b){let p=a.lat*r,q=b.lat*r,l=(b.lon-a.lon)*r;return wrap(Math.atan2(Math.sin(l)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(l))/r);}
function destination(a,b,d){let p=a.lat*r,l=a.lon*r,h=b*r,t=d/R,q=Math.asin(clamp(Math.sin(p)*Math.cos(t)+Math.cos(p)*Math.sin(t)*Math.cos(h)));return {lat:q/r,lon:wrap((l+Math.atan2(Math.sin(h)*Math.sin(t)*Math.cos(p),Math.cos(t)-Math.sin(p)*Math.sin(q)))/r+180)-180};}
const vec=p=>[Math.cos(p.lat*r)*Math.cos(p.lon*r),Math.cos(p.lat*r)*Math.sin(p.lon*r),Math.sin(p.lat*r)];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mag=a=>Math.hypot(...a);
function intersect(a,ha,b,hb){const A=cross(vec(a),vec(destination(a,ha,10))),B=cross(vec(b),vec(destination(b,hb,10))),c=cross(A,B),m=mag(c);if(m<1e-10)throw Error('NO INTERSECTION');let hits=[1,-1].map(s=>{const p=c.map(x=>s*x/m);return {lat:Math.asin(clamp(p[2]))/r,lon:Math.atan2(p[1],p[0])/r};}).filter(p=>[ [a,ha],[b,hb] ].every(([q,h])=>distance(q,p)>.001&&Math.abs(wrap(bearing(q,p)-h+180)-180)<.01));if(hits.length!==1)throw Error('NO INTERSECTION');return hits[0];}
function parse(input){
 const s=String(input||'').trim().toUpperCase();
 let m=/^([NS])(\d{2})(?:(\d{2}\.\d))?([EW])(\d{3})(?:(\d{2}\.\d))?$/.exec(s);
 if(m){let a=+m[2],b=+m[5],am=+(m[3]||0),bm=+(m[6]||0);if(a>90||b>180||am>=60||bm>=60||a===90&&am||b===180&&bm)throw Error('INVALID ENTRY');return {kind:'LATLON',prefix:'WPT',lat:(a+am/60)*(m[1]==='S'?-1:1),lon:(b+bm/60)*(m[4]==='W'?-1:1)};}
 m=/^([A-Z0-9._-]{2,16})(\d{3})\/([A-Z0-9._-]{2,16})(\d{3})$/.exec(s);
 if(m){if(+m[2]>360||+m[4]>360)throw Error('INVALID ENTRY');return {kind:'PBPB',place:m[1],bearing:+m[2],other:m[3],otherBearing:+m[4],prefix:m[1]};}
 m=/^([A-Z0-9._-]{2,16})(\d{3})\/(\d+(?:\.\d)?)$/.exec(s);
 if(m){if(+m[2]>360||!(+m[3]>0)||+m[3]>9999)throw Error('INVALID ENTRY');return {kind:'PBD',place:m[1],bearing:+m[2],distance:+m[3],prefix:m[1]};}
 m=/^([A-Z0-9._-]{2,16})\/(-?\d+(?:\.\d)?)$/.exec(s);
 if(m){if(+m[2]===0)throw Error('INVALID ENTRY');return {kind:'ATW',place:m[1],offset:+m[2],prefix:m[1]};}
 throw Error('INVALID ENTRY');
}
function name(prefix,used=[]){const p=String(prefix).padEnd(3,'X');for(let i=1;i<=999;i++){let id=i<100?p.slice(0,3)+String(i).padStart(2,'0'):p.slice(0,2)+i;if(!used.includes(id))return id;}throw Error('WAYPOINT LIMIT');}
async function resolve(spec,{lookup,variation,route=[],index=null,used=[]}={}){
 const id=name(spec.prefix,used);
 if(spec.kind==='LATLON')return {ident:id,lat:spec.lat,lon:spec.lon,pilotType:spec.kind};
 if(spec.kind==='ATW'){
  let matches=route.map((p,i)=>p.ident===spec.place?i:-1).filter(i=>i>=0),i=index??(matches.length===1?matches[0]:-1);
  const a=route[i],b=route[i+Math.sign(spec.offset)];
  if(a?.ident!==spec.place||!good(a)||!good(b)||a.conditional||b.conditional||a.pilotType==='LATLON'||a.gap||b.gap||Math.abs(spec.offset)>=distance(a,b))throw Error('INVALID ALONG TRACK');
  return {ident:id,...destination(a,bearing(a,b),Math.abs(spec.offset)),pilotType:spec.kind,insertIndex:spec.offset>0?i+1:i};
 }
 if(typeof lookup!=='function'||typeof variation!=='function')throw Error('NAV DATA UNAVAILABLE');
 const a=await lookup(spec.place);if(!good(a))throw Error('NOT IN DATABASE');
 const va=await variation(a);if(!Number.isFinite(va))throw Error('MAG VAR UNAVAILABLE');
 let point;if(spec.kind==='PBD')point=destination(a,spec.bearing+va,spec.distance);
 else {const b=await lookup(spec.other);if(!good(b))throw Error('NOT IN DATABASE');const vb=await variation(b);if(!Number.isFinite(vb))throw Error('MAG VAR UNAVAILABLE');point=intersect(a,spec.bearing+va,b,spec.otherBearing+vb);}
 return {ident:id,...point,pilotType:spec.kind};
}
function conditional(raw){const t=raw.Type??raw.type,id=String(raw.Name??raw.ident??''),h=Number(raw.Hdg_Crs_value??raw.heading),mode=String(raw.Hdg_Crs??'0'),headingLabel=Number.isFinite(h)?String(Math.round(h)%360).padStart(3,'0')+(mode==='0'?' HDG':'°'):'';
 let label=null;if(t==='ConstHdgtoAlt')label='('+Number(raw.Altitude??raw.alt)+')';else if(t==='DmeIntc')label='('+id.replace(/[()]/g,'')+'-'+Number(raw.DMEtoIntercept??raw.dme)+')';else if(t==='Intc')label='(INTC)';else if(t==='VorRadialIntc')label='('+id.replace(/[()]/g,'')+String(raw.RadialtoIntercept??raw.radial).padStart(3,'0')+')';else if(t==='Vectors')label='(VECTOR)';return label?{ident:label,headingLabel,conditional:true,sourceOnly:true,conditionType:t}:null;
}
return Object.freeze({parse,resolve,name,distance,bearing,destination,intersect,conditional});
});