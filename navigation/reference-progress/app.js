'use strict';
const $=id=>document.getElementById(id);
let current=null,selected=0;
async function api(path,init){const r=await fetch(path,{cache:'no-store',...init});let v=await r.json();if(!r.ok||v.error)throw Error(v.error||r.status);return v;}
function clear(el){el.replaceChildren()}
function format(n){return Number(n).toFixed(2)}
function project(chords){
 const p=chords.flatMap(x=>[x.from_point,x.to_point]);
 const ref=p[0]?.[1]??0;
 const unwrapped=p.map(([lat,lon])=>({x:ref+((((lon-ref)+540)%360)-180),y:lat}));
 const cos=Math.max(.1,Math.cos(unwrapped.reduce((s,x)=>s+x.y,0)/Math.max(1,unwrapped.length)*Math.PI/180));
 const xx=unwrapped.map(x=>x.x*cos),yy=unwrapped.map(x=>x.y);
 const loX=Math.min(...xx),hiX=Math.max(...xx),loY=Math.min(...yy),hiY=Math.max(...yy);
 const scale=Math.min(650/Math.max(.001,hiX-loX),290/Math.max(.001,hiY-loY));
 return unwrapped.map((x,i)=>({x:360+(xx[i]-(loX+hiX)/2)*scale,y:180-(yy[i]-(loY+hiY)/2)*scale}));
}
function render(){
 const plot=$('plot');clear(plot);if(!current)return;
 const arr=current.reference_chords;if(!arr.length){$('mapNote').textContent='No joined reference points in this plan';return;}
 const pts=project(arr);const ns='http://www.w3.org/2000/svg';
 const make=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;plot.append(e)};
 arr.forEach((l,i)=>{
  const [a,b]=pts.slice(i*2,i*2+2);
  make('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:i===selected?'#ffd28b':'#e36bd3','stroke-width':i===selected?4:2.5});
  make('circle',{cx:a.x,cy:a.y,r:4,fill:'#67ddec'});
  make('circle',{cx:b.x,cy:b.y,r:4,fill:'#67ddec'});
  if(i===selected)make('text',{x:b.x+8,y:b.y-7,fill:'#ffd28b','font-size':12},l.to);
 });
 $('mapNote').textContent=`${arr.length} source reference chords · ${current.gaps.length} hard discontinuities · TRUE geographic overview · no LNAV`;
 const list=$('chords');clear(list);
 arr.forEach((leg,i)=>{
  const b=document.createElement('button');b.className='route'+(i===selected?' active':'');
  b.textContent=`${String(i+1).padStart(2,'0')} ${leg.from} → ${leg.to} · ${format(leg.distance_nm)} NM${i>0 && leg.group!==arr[i-1].group?' [NEW GROUP]':''}`;
  b.onclick=()=>{selected=i;render();};list.appendChild(b);
 });
}
async function load(){
 try{current=await api('/api/stage8/reference?id='+encodeURIComponent($('plan').value));selected=0;render();$('diagnostic').textContent='Choose a chord and position, then Evaluate.'}
 catch(e){$('diagnostic').textContent=e.message;current=null;clear($('plot'));}
}
async function evaluatePosition(){
 if(!current){$('diagnostic').textContent='Load reference plan first';return;}
 try{const v=await api('/api/stage8/position',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:Number($('plan').value),reference_leg_index:selected,position:{lat:Number($('lat').value),lon:Number($('lon').value)}})});
 $('diagnostic').textContent=`${v.from} → ${v.to}\nDTG ${v.distance_to_fix_nm} NM\nXTK ${v.signed_cross_track_nm} NM (right positive)\nALONG ${v.along_track_nm} NM\n${v.position_status}\n${v.status}\nNO AUTO SEQUENCING`;}
 catch(e){$('diagnostic').textContent=e.message;}
}
async function init(){try{const status=await api('/api/stage8/status');$('status').textContent=`AIRAC ${status.airac} • Private source • ${status.plans} plans • ${status.guidance}`;
 const p=await api('/api/stage8/plans');p.plans.forEach(x=>{const opt=document.createElement('option');opt.value=x.id;opt.textContent=`${x.id}: ${x.origin} → ${x.destination} (${x.discontinuities} gaps)`;$('plan').append(opt)});
 if(p.plans.length)await load();}catch(e){$('status').textContent='Local private server unavailable: '+e.message;}}
$('load').onclick=load;$('evaluate').onclick=evaluatePosition;init();