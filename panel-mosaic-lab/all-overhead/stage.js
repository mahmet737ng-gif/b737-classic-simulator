'use strict';
const $=id=>document.getElementById(id);
const SOURCE_WIDTH=1731,MIN_ZOOM=.25,MAX_ZOOM=4.5;
let spec=null,geometry=null,zoom=1,fitMode=true,view='mosaic',selected='UPPER',loaded=new Set(),errored=new Set(),dragged=false;
const assetById=id=>spec.images.find(x=>x.id===id);
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;}
function summary(){$('sourceCount').textContent=spec?spec.images.length:'—';$('panelCount').textContent=spec?new Set(spec.images.flatMap(x=>x.panelIds)).size:'—';$('loadedCount').textContent=loaded.size+'/'+(spec?spec.images.length:0);$('missingCount').textContent=spec?(spec.columns.reduce((n,c)=>n+(c.missing||[]).length,0)+spec.bottomMissing.length):'—';}
function card(asset,style){const a=el('article','piece');a.tabIndex=0;a.dataset.key=asset.id;a.setAttribute('aria-label',asset.panelIds.join(', ')+' '+asset.title);
 const span=el('span','tag',asset.panelIds.length>1?asset.panelIds[0]+'–'+asset.panelIds.at(-1).slice(3):asset.panelIds[0]);a.append(span);
 const img=el('img');img.src=asset.url;img.alt=asset.title;img.loading='eager';img.decoding='async';img.draggable=false;
 img.addEventListener('load',()=>{loaded.add(asset.id);a.classList.remove('bad');summary();updateDimensions();if(selected===asset.id)showDetails();});
 img.addEventListener('error',()=>{errored.add(asset.id);loaded.delete(asset.id);a.classList.add('bad');img.remove();a.append(el('div','empty-image','⚠ بارگذاری تصویر ناموفق بود'));summary();updateDimensions();});
 if(style==='mosaic' && asset.display?.cropLeftPct){const cropped=el('div','crop-window');cropped.append(img);a.append(cropped);}else{a.append(img);}
 a.onclick=()=>{if(!dragged)pick(asset.id);};a.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(asset.id);}};
 return a;}
function placeholder(ids){const d=el('div','placeholder');d.append(el('strong','',ids.join(' / ')),el('span','','تصویر هنوز در دیتابیس موجود نیست'));return d;}
function populateUpper(){const root=$('upper');root.replaceChildren();
 const top=el('div','top-image');top.dataset.key='UPPER';
 const img=el('img');img.src=assetById('UPPER').url;img.alt='Overhead upper OH-01 to OH-06';img.draggable=false;
 img.onload=()=>{loaded.add('UPPER');summary();updateDimensions()};img.onerror=()=>{errored.add('UPPER');top.append(el('div','empty-image','تصویر بالایی قابل دریافت نیست'));summary()};
 top.append(img,el('div','top-float','OH-01 → OH-06'));
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1731 909');svg.setAttribute('role','group');svg.setAttribute('aria-label','OH01 to OH06 provisional individual region selectors');
 for(const part of geometry.parts){for(const poly of part.polygons){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',poly.map((xy,i)=>(i?'L':'M')+xy[0]+','+xy[1]).join(' ')+' Z');p.dataset.part=part.id;p.setAttribute('tabindex','0');p.setAttribute('aria-label',part.id+' '+part.name);p.addEventListener('click',event=>{event.stopPropagation();if(!dragged)pick(part.id)});p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(part.id)}});svg.append(p)}}
 top.append(svg);top.onclick=()=>{if(!dragged)pick('UPPER')};
 root.append(top);}
function populateAssembly(){populateUpper();const columns=$('columns');columns.replaceChildren();
 for(const section of spec.columns){const col=el('section','column');col.append(el('div','column-title',section.name));
 for(const id of section.items)col.append(card(assetById(id),'mosaic'));
 for(const id of section.missing||[])col.append(placeholder([id]));
 columns.append(col)}
 const bottom=$('bottom');bottom.replaceChildren(...spec.bottomMissing.map(id=>placeholder([id])));}
function populateGallery(){const gallery=$('gallery');gallery.replaceChildren();for(const a of spec.images)gallery.append(card(a,'gallery'));}
function fillList(){const term=$('search').value.trim().toLowerCase(),list=$('pieces');list.replaceChildren();
 const buttons=[];
 for(const asset of spec.images){if(term&&!([asset.id,...asset.panelIds,asset.title,asset.filename].join(' ').toLowerCase().includes(term)))continue;
 const b=el('button');b.dataset.key=asset.id;b.append(el('code','',asset.panelIds.length>1?asset.panelIds[0]+'–'+asset.panelIds.at(-1).slice(3):asset.panelIds[0]),el('span','',asset.title));
 b.onclick=()=>pick(asset.id,true);buttons.push(b);}
 list.append(...buttons);if(!buttons.length)list.append(el('p','', 'نتیجه‌ای پیدا نشد'));highlight();}
function resolveAsset(id){const exact=assetById(id);if(exact)return exact;return spec.images.find(a=>a.panelIds.includes(id));}
function showDetails(){if(!spec)return;const a=resolveAsset(selected)||assetById('UPPER'),detail=$('detail');detail.replaceChildren();
 const region=geometry.parts.find(p=>p.id===selected);detail.append(el('h3','',region?selected+' — '+region.name:a.panelIds.join('–')+' — '+a.title));
 const detailRow=(title,value)=>{const d=el('div');d.append(el('b','',title+': '),document.createTextNode(value));detail.append(d)};
 detailRow('شناسهٔ تصویر',a.id);detailRow('نام فایل',a.filename);detailRow('اندازه',new Intl.NumberFormat('en-US').format(a.bytes)+' bytes');
 detailRow('وضعیت',errored.has(a.id)?'خطا در بارگذاری':loaded.has(a.id)?'تصویر بارگذاری شد':'در حال دریافت تصویر');
 if(region)detailRow('مرز این بخش','Polygon آزمایشی، هنوز تأیید نشده');
 if(selected==='OH18'||selected==='OH-18'||a.id==='OH18')detail.append(el('div','pending','OH-18 طبق اطلس زیر OH-14 قرار گرفت: GRD CALL / RAIN REPELLENT / WIPER.'));
 detail.append(el('code','',a.sha256?'SHA-256: '+a.sha256:'Git blob: '+a.gitBlobSha));
 const link=el('a','','باز کردن تصویر اصلی در GitHub ↗');link.href=a.url;link.target='_blank';link.rel='noopener';detail.append(link);
 const note=el('p','', 'جایگاه ستون‌ها برای ارزیابی اولیه است؛ هندسهٔ دقیق پیچ‌ها و درزهای پنل‌ها هنوز تأیید نشده.');note.style.fontSize='11px';detail.append(note);}
function highlight(){document.querySelectorAll('[data-key]').forEach(x=>{if(x.classList.contains('piece')||x.parentElement?.id==='pieces')x.classList.toggle('selected',x.dataset.key===selected||!!(resolveAsset(selected)&&resolveAsset(selected).id===x.dataset.key))});
 document.querySelectorAll('[data-part]').forEach(x=>x.classList.toggle('selected',x.dataset.part===selected));}
function pick(id,scroll){selected=id;highlight();showDetails();if(scroll){let piece=[...document.querySelectorAll('.board:not(.hidden) .piece')].find(x=>x.dataset.key===id);
 if(piece){const viewport=$('viewport'),board=$('board');viewport.scrollTo({left:Math.max(0,(piece.offsetLeft+piece.offsetWidth/2)*zoom-viewport.clientWidth/2),top:Math.max(0,(piece.getBoundingClientRect().top-board.getBoundingClientRect().top+piece.offsetHeight/2)*zoom-viewport.clientHeight/2),behavior:'smooth'});}}}
function updateDimensions(){const board=$('board');const sizer=$('sizer');board.style.transform='scale('+zoom+')';sizer.style.width=Math.ceil(SOURCE_WIDTH*zoom)+'px';sizer.style.height=Math.ceil(board.offsetHeight*zoom)+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%';}
function fit(){const viewport=$('viewport');zoom=Math.min(1,(viewport.clientWidth-34)/SOURCE_WIDTH);fitMode=true;updateDimensions();viewport.scrollTo({left:0,top:0,behavior:'instant'});}
function setZoom(value){fitMode=false;zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));updateDimensions();}
function mode(next){if(view===next)return;view=next;$('assembly').classList.toggle('hidden',next!=='mosaic');$('gallery').classList.toggle('hidden',next!=='gallery');$('atlasView').classList.toggle('hidden',next!=='atlas');
 $('modeMosaic').classList.toggle('active',next==='mosaic');$('modeGallery').classList.toggle('active',next==='gallery');$('modeAtlas').classList.toggle('active',next==='atlas');if(next==='gallery'&&!$('gallery').children.length)populateGallery();highlight();updateDimensions();}
async function start(){
 try{const [specResp,geoResp]=await Promise.all([fetch('./spec.json?ts='+Date.now(),{cache:'no-store'}),fetch('../upper-oh/geometry.json?ts='+Date.now(),{cache:'no-store'})]);
 if(!specResp.ok||!geoResp.ok)throw Error('Source metadata unavailable');spec=await specResp.json();geometry=await geoResp.json();
 if(spec.images.length!==16||geometry.parts.length!==6)throw Error('Invalid source count');
 populateAssembly();fillList();summary();showDetails();
 $('status').textContent=spec.images.length+' تصویر منبع برای '+new Set(spec.images.flatMap(x=>x.panelIds)).size+' شناسهٔ پنل — نسخهٔ '+spec.version+' — منطبق با مرجع اطلس';
 fit();if('ResizeObserver'in window){new ResizeObserver(()=>updateDimensions()).observe($('board'));}
 }catch(e){$('status').textContent='خطای بارگذاری داده‌های تست: '+e.message;}
}
$('modeMosaic').onclick=()=>mode('mosaic');$('modeGallery').onclick=()=>mode('gallery');$('modeAtlas').onclick=()=>mode('atlas');
$('fit').onclick=fit;$('plus').onclick=()=>setZoom(zoom*1.25);$('minus').onclick=()=>setZoom(zoom/1.25);
$('borders').onchange=e=>$('board').classList.toggle('show-borders',e.target.checked);
$('tags').onchange=e=>$('board').classList.toggle('hide-tags',!e.target.checked);
$('search').oninput=fillList;
$('reload').onclick=()=>location.reload();
$('viewport').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(zoom*(e.deltaY<0?1.12:1/1.12))}},{passive:false});
let mouse=null;const vp=$('viewport');
vp.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;mouse={x:e.clientX,y:e.clientY,left:vp.scrollLeft,top:vp.scrollTop};dragged=false;});
vp.addEventListener('pointermove',e=>{if(!mouse)return;const dx=e.clientX-mouse.x,dy=e.clientY-mouse.y;if(Math.abs(dx)+Math.abs(dy)>7){dragged=true;vp.classList.add('dragging');vp.scrollLeft=mouse.left-dx;vp.scrollTop=mouse.top-dy;}});
document.addEventListener('pointerup',()=>{if(mouse){mouse=null;vp.classList.remove('dragging');setTimeout(()=>dragged=false,0)}});
let pinch=null;
vp.addEventListener('touchstart',e=>{if(e.touches.length===2){const t=e.touches;pinch={distance:Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY),zoom}}},{passive:true});
vp.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){e.preventDefault();const t=e.touches,d=Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);setZoom(pinch.zoom*d/pinch.distance)}},{passive:false});
vp.addEventListener('touchend',e=>{if(e.touches.length<2)pinch=null},{passive:true});
window.addEventListener('resize',()=>{if(fitMode)fit();else updateDimensions()});
start();
