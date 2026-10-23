'use strict';
const NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
let data=null,selected=null,view='source',zoom=1,labels=false;
function node(tag,attributes={},text){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
function bbox(polygons){const pts=polygons.flat();const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}
function path(points){return points.map((pt,i)=>(i?'L':'M')+pt[0]+' '+pt[1]).join(' ')+' Z';}
function showPart(part){selected=part.id;draw();fillList();fillDetails();}
function sourceArt(svg){svg.appendChild(node('image',{href:data.source,x:0,y:0,width:1731,height:909,preserveAspectRatio:'xMidYMid meet'}));}
function overlays(svg){const defs=node('defs');svg.appendChild(defs);
 for(const p of data.parts){const id='cut_'+p.id;const clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});for(const shape of p.polygons)clip.appendChild(node('path',{d:path(shape)}));defs.appendChild(clip);
 if(p.asset){const b=bbox(p.polygons),g=node('g',{'clip-path':`url(#${id})`});g.appendChild(node('image',{href:p.asset,x:b.x,y:b.y,width:b.w,height:b.h,preserveAspectRatio:'xMidYMid meet'}));svg.appendChild(g);}
 for(const shape of p.polygons){const el=node('path',{d:path(shape),class:'outline notvalid'+(selected===p.id?' active':''),fill:'none',stroke:labels?'#6edaf8':'transparent'});
 el.style.stroke=labels?(selected===p.id?'#ffe4a4':'#6edaf8'):'transparent';el.style.fill='transparent';el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',p.id+' '+p.name);
 el.addEventListener('click',()=>showPart(p));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPart(p);}});el.appendChild(node('title',{},p.id+' — '+p.name));svg.appendChild(el);}
 }
}
function draw(){if(!data)return;
 const wide=1731,sourceHeight=909,scale=1731/748,restStart=350,totalH=Math.round(sourceHeight+(1200-restStart)*scale);
 const svg=node('svg',{viewBox:'0 0 1731 '+(view==='assembly'?totalH:909),role:'img','aria-label':'OH01 to OH06 source artwork'});
 if(view==='assembly'){const defs=node('defs'),clip=node('clipPath',{id:'restSection'});clip.appendChild(node('rect',{x:0,y:909,width:wide,height:totalH-909}));defs.appendChild(clip);svg.appendChild(defs);svg.appendChild(node('image',{href:'../../assets/overhead.webp',x:0,y:909-350*scale,width:wide,height:1200*scale,preserveAspectRatio:'none','clip-path':'url(#restSection)'}));}
 sourceArt(svg);overlays(svg);$('art').replaceChildren(svg);$('art').style.width=Math.round(zoom*100)+'%';$('zoomLabel').textContent=Math.round(zoom*100)+'%';
 $('btnSource').classList.toggle('active',view==='source');$('btnAssembled').classList.toggle('active',view==='assembly');
 $('caption').textContent=view==='source'?'عکس دقیق ارسالی (بدون تغییر پیکسل). محدوده‌ها با تپ قابل انتخاب‌اند. شکل‌ خطوط و محل اتصال هنوز نیازمند QA است.':'پیش‌نمایش اتصال شش قطعهٔ بالایی به تصویر اورهد قبلی، بدون کشیدن عکس جدید. محل اتصال با بخش پایین آزمایشی است.';
}
function fillList(){$('pieces').replaceChildren(...data.parts.map(p=>{const b=document.createElement('button');b.className='piece'+(selected===p.id?' selected':'');const id=document.createElement('code');id.textContent=p.id;const label=document.createElement('span');label.textContent=p.name;b.append(id,label);b.addEventListener('click',()=>showPart(p));return b;}));}
function fillDetails(){const t=data.parts.find(p=>p.id===selected);if(!t){$('details').innerHTML='یک پنل را انتخاب کنید تا نام، هندسه و تصویر فعال آن مشخص شود.';return;}
 $('details').innerHTML='';const h=document.createElement('h3');h.textContent=t.id+' — '+t.name;const stat=document.createElement('p');stat.textContent='وضعیت: '+(t.asset?'تصویر مستقل جایگزین شده':'بخشی از تصویر اصلی شش‌پنلی');const src=document.createElement('p');src.textContent='پیکسل اصلی: محفوظ و قفل‌شده';const count=document.createElement('p');count.textContent='تعداد مرزهای مستقل: '+t.polygons.length;const sha=document.createElement('pre');sha.textContent='SHA256: '+data.sourceSha256;const link=document.createElement('a');link.href=t.asset||data.source;link.target='_blank';link.rel='noopener';link.textContent='نمایش فایل تصویر ↗';$('details').append(h,stat,src,count,sha,link);}
async function refresh(){try{const [geom,history]=await Promise.all([fetch('./geometry.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('geometry '+r.status);return r.json();}),fetch('./history.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('history '+r.status);return r.json();})]);if(geom.parts.length!==6)throw Error('6 parts required');data=geom;$('build').textContent=geom.version;draw();fillList();fillDetails();$('history').replaceChildren(...history.events.map(e=>{const p=document.createElement('p');p.textContent=e.version+' — '+e.date+' — '+e.description;return p;}));}catch(e){$('history').textContent='خطا در خواندن نسخه: '+e.message;}}
function setZoom(v){zoom=Math.max(.5,Math.min(3,v));draw();}
$('refresh').addEventListener('click',refresh);$('btnSource').onclick=()=>{view='source';zoom=1;draw();};$('btnAssembled').onclick=()=>{view='assembly';zoom=1;draw();};$('outlines').onchange=e=>{labels=e.target.checked;draw();};$('zoomIn').onclick=()=>setZoom(zoom+.25);$('zoomOut').onclick=()=>setZoom(zoom-.25);$('zoomReset').onclick=()=>setZoom(1);
$('viewport').addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();setZoom(zoom+(e.deltaY<0?.1:-.1));}},{passive:false});
refresh();