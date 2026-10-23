'use strict';
const $=id=>document.getElementById(id);
let route=null,session=null,selected=null;
async function request(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Backend error');return j;}
function display(text){$('result').textContent=typeof text==='string'?text:JSON.stringify(text,null,2);}
function node(name,attrs={},parent=$('map')){const n=document.createElementNS('http://www.w3.org/2000/svg',name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));parent.appendChild(n);return n;}
function plot(){const svg=$('map');svg.replaceChildren();if(!route)return;
 const arr=route.reference_chords,points=arr.flatMap(v=>[v.from_point,v.to_point]);const midlat=points.reduce((s,p)=>s+p[0],0)/points.length;
 const cos=Math.max(.05,Math.cos(midlat*Math.PI/180)),xs=points.map(p=>p[1]*cos),ys=points.map(p=>p[0]);const rangeX=Math.max(.000001,Math.max(...xs)-Math.min(...xs)),rangeY=Math.max(.000001,Math.max(...ys)-Math.min(...ys));const scale=Math.min(510/rangeX,350/rangeY);const midX=(Math.max(...xs)+Math.min(...xs))/2,midY=(Math.max(...ys)+Math.min(...ys))/2;
 const xy=p=>[300+(p[1]*cos-midX)*scale,215-(p[0]-midY)*scale];const colors=['#61d6e8','#9fc8ee','#dfaf7d'];
 for(const [i,l] of arr.entries()){const a=xy(l.from_point),b=xy(l.to_point);const focus=Number($('index').value)===i;const line=node('path',{d:`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`,stroke:focus?'#ff95ed':colors[l.group%3],'stroke-width':focus?3.4:2.1,fill:'none'});line.setAttribute('data-group',l.group);}
 for(const p of points){const [x,y]=xy(p);node('circle',{cx:x,cy:y,r:2.5,fill:'#d6f7f8'});}
 const text=node('text',{x:14,y:426,fill:'#f4c48c','font-size':12});text.textContent='REFERENCE CHORDS ONLY · GAPS NEVER JOINED';
 $('gaps').textContent=`${arr.length} source chords; ${route.gaps.length} hard gaps. Not executable FMC procedure legs.`;
}
async function loadRef(){const id=Number($('plan').value);route=await request('/api/stage9/reference?id='+id);plot();const c=route.reference_chords[Number($('index').value)]||route.reference_chords[0];if(c){$('lat').value=c.from_point[0];$('lon').value=c.from_point[1];$('track').value=c.true_course_deg;}display({source:'PRIVATE AIRAC 2610',chords:route.reference_chords.length,gaps:route.gaps.length});}
async function init(){try{const s=await request('/api/stage9/status');$('status').textContent=`AIRAC ${s.airac}; ${s.private_plans} private plans; simulated output only`;const plans=await request('/api/stage9/plans');for(const p of plans.plans){const o=document.createElement('option');o.value=p.id;o.textContent=`#${p.id} ${p.origin} → ${p.destination}`;$('plan').append(o);}await loadRef();}catch(e){$('status').textContent=e.message;display(e.message)}}
$('plan').onchange=async()=>{if(session){display('DISENGAGE FIRST');return;}try{await loadRef()}catch(e){display(e.message)}};
$('index').onchange=plot;
$('atfix').onclick=()=>{if(!route)return;const c=route.reference_chords[Number($('index').value)];if(!c)return;$('lat').value=c.from_point[0];$('lon').value=c.from_point[1];$('track').value=c.true_course_deg};
$('start').onclick=async()=>{try{if(session)throw Error('Disengage before starting another session');const r=await request('/api/stage9/start',{plan_id:Number($('plan').value),leg_index:Number($('index').value),sim_only_consent:$('consent').checked});session=r.session;selected=Number($('plan').value);$('step').disabled=false;$('stop').disabled=false;display(r);}catch(e){display(e.message)}};
$('stop').onclick=async()=>{try{if(session)display(await request('/api/stage9/disengage',{session}));}catch(e){display(e.message)}finally{session=null;$('step').disabled=true;$('stop').disabled=true}};
$('step').onclick=async()=>{try{const data=await request('/api/stage9/step',{session,sensor:{source:'SIMULATOR_INTERNAL',integrity:$('integrity').value,lat:Number($('lat').value),lon:Number($('lon').value),gs_kt:Number($('gs').value),track_true_deg:Number($('track').value),sim_time_s:Number($('time').value)}});display(data); const frame=$('cdu').contentWindow; if(frame&&data.version==='NPE_STAGE9_SIMULATOR_REFERENCE_GUIDANCE_v1')frame.postMessage({type:'B737_STAGE9_SIM_REFERENCE',payload:data},location.origin);if(data.leg_index!==undefined){$('index').value=data.leg_index;plot();}if(data.mode==='SUSPENDED'||data.mode==='END_OF_CONTIGUOUS_GROUP'){$('step').disabled=true;}}catch(e){display(e.message)}};
init();