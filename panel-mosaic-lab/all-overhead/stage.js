'use strict';
const $=id=>document.getElementById(id);
const SOURCE_WIDTH=2220,MIN_ZOOM=.16,MAX_ZOOM=4.5;
let spec=null,geometry=null,atlasLayout=null,zoom=1,fitMode=true,view='mosaic',selected='UPPER',loaded=new Set(),errored=new Set(),dragged=false;
const assetById=id=>spec.images.find(x=>x.id===id);
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;}
function summary(){$('sourceCount').textContent=spec?spec.images.length:'—';$('panelCount').textContent=spec?new Set(spec.images.flatMap(x=>x.panelIds)).size:'—';$('loadedCount').textContent=loaded.size+'/'+(spec?spec.images.length:0);$('missingCount').textContent=spec?(spec.columns.reduce((n,c)=>n+(c.missing||[]).length,0)+spec.bottomMissing.length):'—';}
function card(asset,style){const a=el('article','piece');a.tabIndex=0;a.dataset.key=asset.id;a.setAttribute('aria-label',asset.panelIds.join(', ')+' '+asset.title);
 const span=el('span','tag',asset.panelIds.length>1?asset.panelIds[0]+'–'+asset.panelIds.at(-1).slice(3):asset.panelIds[0]);a.append(span);
 const img=el('img');img.src=asset.url;img.alt=asset.title;img.loading='eager';img.decoding='async';img.draggable=false;
 img.addEventListener('load',()=>{loaded.add(asset.id);a.classList.remove('bad');summary();updateDimensions();if(selected===asset.id)showDetails();});
 img.addEventListener('error',()=>{errored.add(asset.id);loaded.delete(asset.id);a.classList.add('bad');img.remove();a.append(el('div','empty-image','⚠ Image load failed'));summary();updateDimensions();});
 if(style==='mosaic' && asset.display?.cropTopPx!=null){
 const cropped=el('div','crop-window');const d=asset.display;
 const visible=d.contentHeightPx||Math.max(1,asset.originalDimensions?.[1]-d.cropTopPx-(d.cropBottomPx||0));
 const naturalWidth=d.contentWidthPx||asset.originalDimensions?.[0];
 cropped.style.aspectRatio=naturalWidth+' / '+visible;
 img.style.width='100%';img.style.height='auto';img.style.maxWidth='none';
 img.style.marginTop=(-100*d.cropTopPx/naturalWidth)+'%';
 cropped.append(img);a.append(cropped);
 }else if(style==='mosaic' && asset.display?.cropLeftPct){
 const cropped=el('div','crop-window');cropped.append(img);a.append(cropped);
 }else{a.append(img);}
 a.onclick=()=>{if(!dragged)pick(asset.id);};a.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(asset.id);}};
 return a;}
function placeholder(ids){const d=el('div','placeholder');d.append(el('strong','',ids.join(' / ')),el('span','','Image is not yet available in the database'));return d;}
function populateUpper(){const root=$('upper');root.replaceChildren();
 const top=el('div','top-image');top.dataset.key='UPPER';
 const img=el('img');img.src=assetById('UPPER').url;img.alt='Overhead upper OH-01 to OH-06';img.draggable=false;
 img.onload=()=>{loaded.add('UPPER');summary();updateDimensions()};img.onerror=()=>{errored.add('UPPER');top.append(el('div','empty-image','Upper source image unavailable'));summary()};
 top.append(img,el('div','top-float','OH-01 → OH-06'));
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1731 909');svg.setAttribute('role','group');svg.setAttribute('aria-label','OH01 to OH06 provisional individual region selectors');
 for(const part of geometry.parts){for(const poly of part.polygons){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',poly.map((xy,i)=>(i?'L':'M')+xy[0]+','+xy[1]).join(' ')+' Z');p.dataset.part=part.id;p.setAttribute('tabindex','0');p.setAttribute('aria-label',part.id+' '+part.name);p.addEventListener('click',event=>{event.stopPropagation();if(!dragged)pick(part.id)});p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(part.id)}});svg.append(p)}}
 top.append(svg);top.onclick=()=>{if(!dragged)pick('UPPER')};
 root.append(top);}
function populateLegacyAssembly(){populateUpper();const columns=$('columns');columns.replaceChildren();
 for(const section of spec.columns){const col=el('section','column');col.append(el('div','column-title',section.name));
 for(const id of section.items)col.append(card(assetById(id),'mosaic'));
 for(const id of section.missing||[])col.append(placeholder([id]));
 columns.append(col)}
 const bottom=$('bottom');bottom.replaceChildren();for(const id of spec.bottomItems||[])bottom.append(card(assetById(id),'mosaic'));for(const id of spec.bottomMissing||[])bottom.append(placeholder([id]));}

/* OVH.png supplies lower-panel seam coordinates; upper OH01-OH06 is preserved.
   Adjacent panels share exact edges, independent of their source image aspect. */
function populateAssembly(){
 const root=$('atlasAbsolute');root.replaceChildren();
 const oldUpper=$('upper'),oldColumns=$('columns'),oldBottom=$('bottom');
 oldUpper.replaceChildren();oldColumns.replaceChildren();oldBottom.replaceChildren();
 $('assembly').classList.add('atlas-positioned');
 root.style.width=atlasLayout.canvas.width+'px';
 root.style.height=atlasLayout.canvas.height+'px';
 $('board').style.width=atlasLayout.canvas.width+'px';
 const src=new Map(spec.images.map(asset=>[asset.id,asset]));
 for(const place of atlasLayout.placements){
   const asset=src.get(place.sourceId||place.id);
   if(!asset)throw Error('Undefined atlas panel: '+place.id);
   const frame=el('article','atlas-piece');
   frame.dataset.key=place.id;
   frame.tabIndex=0;
   frame.setAttribute('role','button');
   frame.setAttribute('aria-label',(place.atlasPanelIds||asset.panelIds).join(', ')+' — '+asset.title);
   Object.assign(frame.style,{left:place.x+'px',top:place.y+'px',width:place.w+'px',height:place.h+'px',zIndex:String(place.zIndex||2)});
   const visible=el('div','atlas-image-window');
   const photo=el('img','atlas-photo');
   photo.src=asset.url;photo.alt=asset.title;photo.decoding='async';
   photo.loading='eager';photo.draggable=false;


   // Register each source to measured OVH.png seams. UPPER keeps its original placement.
   const [sourceW,sourceH]=place.sourceDimensions;
   const sourceRegion=place.sourceRect||{x:0,y:0,w:sourceW,h:sourceH};
   const crop=place.contentCrop||{left:0,top:0,right:0,bottom:0};
   const inset=place.artInset||{left:0,top:0,right:0,bottom:0};
   const leftInset=inset.left||0,rightInset=inset.right||0;
   const topInset=inset.top||0,bottomInset=inset.bottom||0;
   const contentW=sourceRegion.w-crop.left-crop.right;
   const contentH=sourceRegion.h-crop.top-crop.bottom;
   const innerW=place.w-leftInset-rightInset;
   const innerH=place.h-topInset-bottomInset;
   if(contentW<=0||contentH<=0||innerW<=0||innerH<=0)throw Error('Invalid image bounds: '+place.id);
   const rows=place.rowRegistration||[
     {sourceY:sourceRegion.y+crop.top,targetY:0},
     {sourceY:sourceRegion.y+sourceRegion.h-crop.bottom,targetY:innerH}
   ];
   for(let i=0;i<rows.length-1;i++){
     const from=rows[i],to=rows[i+1];
     const sourceHeight=to.sourceY-from.sourceY,targetHeight=to.targetY-from.targetY;
     if(sourceHeight<=0||targetHeight<=0)throw Error('Invalid registered image bounds: '+place.id);
     const strip=el('div','atlas-source-strip');
     Object.assign(strip.style,{position:'absolute',overflow:'hidden',left:leftInset+'px',top:(topInset+from.targetY)+'px',width:innerW+'px',height:targetHeight+'px'});
     const segment=i===0?photo:photo.cloneNode(false);
     if(i)segment.alt='';
     const sx=innerW/contentW,sy=targetHeight/sourceHeight;
     Object.assign(segment.style,{
       position:'absolute',width:(sourceW*sx)+'px',height:(sourceH*sy)+'px',
       maxWidth:'none',left:(-(sourceRegion.x+crop.left)*sx)+'px',
       top:(-from.sourceY*sy)+'px',objectFit:'fill',transform:'none'
     });
     strip.append(segment);visible.append(strip);
   }
   frame.dataset.atlasId=(place.atlasPanelIds||[]).join(',');
   frame.dataset.sourceAspect=(contentW/contentH).toFixed(3);
   frame.dataset.atlasAspect=(innerW/innerH).toFixed(3);
   frame.dataset.fit='OVH-measured-seams';
   frame.dataset.sourceSlice=[sourceRegion.x,sourceRegion.y,sourceRegion.w,sourceRegion.h].join(',');
   if(place.referenceRect)frame.dataset.referenceBounds=JSON.stringify(place.referenceRect);
   photo.addEventListener('load',()=>{loaded.add(asset.id);errored.delete(asset.id);summary();if(resolveAsset(selected)?.id===asset.id)showDetails()});
   photo.addEventListener('error',()=>{errored.add(asset.id);loaded.delete(asset.id);visible.append(el('div','atlas-missing','Image could not be loaded'));summary()});
   frame.append(visible);
   const tags=place.atlasPanelIds||asset.panelIds;
   const tag=el('span','tag',place.displayLabel|| (tags.length>1?tags[0]+'–'+tags.at(-1).slice(3):tags[0]));
   frame.append(tag);
   frame.onclick=()=>{if(!dragged)pick(place.id)};
   frame.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(place.id,true)}};
   root.append(frame);
 }
 const stamp=el('div','atlas-geometry-stamp','OVH REFERENCE · MEASURED SEAMS · UPD-0012');
 root.append(stamp);
 updateDimensions();
}

function populateGallery(){const gallery=$('gallery');gallery.replaceChildren();for(const a of spec.images)gallery.append(card(a,'gallery'));}
function fillList(){const term=$('search').value.trim().toLowerCase(),list=$('pieces');list.replaceChildren();
 const buttons=[];
 for(const asset of spec.images){if(term&&!([asset.id,...asset.panelIds,asset.title,asset.filename].join(' ').toLowerCase().includes(term)))continue;
 const b=el('button');b.dataset.key=asset.id;b.append(el('code','',asset.panelIds.length>1?asset.panelIds[0]+'–'+asset.panelIds.at(-1).slice(3):asset.panelIds[0]),el('span','',asset.title));
 b.onclick=()=>pick(asset.id,true);buttons.push(b);}
 list.append(...buttons);if(!buttons.length)list.append(el('p','', 'No results found'));highlight();}
function resolveAsset(id){const exact=assetById(id);if(exact)return exact;const mapped=atlasLayout?.placements?.find(p=>p.id===id);if(mapped)return assetById(mapped.sourceId||mapped.id);return spec.images.find(a=>a.panelIds.includes(id));}
function showDetails(){if(!spec)return;const a=resolveAsset(selected)||assetById('UPPER'),detail=$('detail');detail.replaceChildren();
 const region=geometry.parts.find(p=>p.id===selected);const physical=atlasLayout?.placements?.find(p=>p.id===selected);detail.append(el('h3','',region?selected+' — '+region.name:a.panelIds.join('–')+' — '+a.title));
 const detailRow=(title,value)=>{const d=el('div');d.append(el('b','',title+': '),document.createTextNode(value));detail.append(d)};
 detailRow('Atlas ID',physical?(physical.atlasPanelIds||[]).join(' / '):selected);
 if(physical?.referenceRect){const r=physical.referenceRect;detailRow('Boundary in OVH Photo',`x ${r.x} · y ${r.y} · ${r.w} × ${r.h} px`);}
 detailRow('Image ID',a.id);detailRow('Filename',a.filename);detailRow('Size',new Intl.NumberFormat('en-US').format(a.bytes)+' bytes');
 detailRow('Status',errored.has(a.id)?'Load Failure':loaded.has(a.id)?'Image Loaded':'Loading Image');
 if(region)detailRow('Region Boundary','Provisional polygon; not approved');
 if(physical&&physical.id!==physical.sourceId)detail.append(el('div','pending','Original filename differs from its atlas ID; placement follows photographic evidence.'));
 detail.append(el('code','',a.sha256?'SHA-256: '+a.sha256:'Git blob: '+a.gitBlobSha));
 const link=el('a','','Open Original Photo on GitHub');link.href=a.url;link.target='_blank';link.rel='noopener';detail.append(link);
 const note=el('p','', 'This region is aligned to physical boundaries in OVH. OH-01 through OH-06 retain their prior placements.');note.style.fontSize='11px';detail.append(note);}
function highlight(){document.querySelectorAll('[data-key]').forEach(x=>{if(x.classList.contains('piece')||x.classList.contains('atlas-piece')||x.parentElement?.id==='pieces')x.classList.toggle('selected',x.dataset.key===selected||!!(resolveAsset(selected)&&resolveAsset(selected).id===x.dataset.key))});
 document.querySelectorAll('[data-part]').forEach(x=>x.classList.toggle('selected',x.dataset.part===selected));}
function pick(id,scroll){selected=id;highlight();showDetails();if(scroll){let piece=[...document.querySelectorAll('.board:not(.hidden) .atlas-piece, .board:not(.hidden) .piece')].find(x=>x.dataset.key===id);
 if(piece){const viewport=$('viewport'),board=$('board');viewport.scrollTo({left:Math.max(0,(piece.offsetLeft+piece.offsetWidth/2)*zoom-viewport.clientWidth/2),top:Math.max(0,(piece.getBoundingClientRect().top-board.getBoundingClientRect().top+piece.offsetHeight/2)*zoom-viewport.clientHeight/2),behavior:'smooth'});}}}
function updateDimensions(){const board=$('board');const sizer=$('sizer');board.style.transform='scale('+zoom+')';sizer.style.width=Math.ceil(SOURCE_WIDTH*zoom)+'px';sizer.style.height=Math.ceil(board.offsetHeight*zoom)+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%';}
function fit(){const viewport=$('viewport');zoom=Math.min(1,(viewport.clientWidth-34)/SOURCE_WIDTH);fitMode=true;updateDimensions();viewport.scrollTo({left:0,top:0,behavior:'instant'});}
function setZoom(value){fitMode=false;zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));updateDimensions();}
function mode(next){if(!['mosaic','gallery','atlas'].includes(next))return;if(!spec||!geometry||!atlasLayout){$('status').textContent='Loading mosaic data…';return;}view=next;$('assembly').classList.toggle('hidden',next!=='mosaic');$('gallery').classList.toggle('hidden',next!=='gallery');$('atlasView').classList.toggle('hidden',next!=='atlas');
 $('modeMosaic').classList.toggle('active',next==='mosaic');$('modeGallery').classList.toggle('active',next==='gallery');$('modeAtlas').classList.toggle('active',next==='atlas');if(next==='gallery'&&!$('gallery').children.length)populateGallery();if(next==='mosaic'&&!$('atlasAbsolute').children.length)populateAssembly();highlight();if(fitMode)fit();else{updateDimensions();$('viewport').scrollTo({left:0,top:0,behavior:'instant'});}const name={mosaic:'Unified Layout',gallery:'Individual Photos',atlas:'Atlas Reference'}[next];$('viewModeStatus').textContent='Active Mode: '+name+' · '+spec.images.length+' images';}
async function start(){
 try{const [specResp,geoResp,atlasResp]=await Promise.all([fetch('./spec.json?ts='+Date.now(),{cache:'no-store'}),fetch('../upper-oh/geometry.json?ts='+Date.now(),{cache:'no-store'}),fetch('./atlas-layout.json?ts='+Date.now(),{cache:'no-store'})]);
 if(!specResp.ok||!geoResp.ok||!atlasResp.ok)throw Error('Atlas geometry/source metadata unavailable');spec=await specResp.json();geometry=await geoResp.json();atlasLayout=await atlasResp.json();
 if(!Array.isArray(spec.images)||!spec.images.length||!Array.isArray(spec.columns)||!Array.isArray(geometry.parts)||!geometry.parts.length||atlasLayout.canvas.width!==SOURCE_WIDTH||atlasLayout.placements.length<spec.images.length)throw Error('Atlas coordinates or images are incomplete');
 const available=new Set(spec.images.map(x=>x.id));for(const section of spec.columns){for(const id of section.items){if(!available.has(id))throw Error('Mosaic file undefined: '+id);}}
 populateAssembly();fillList();summary();showDetails();
 $('status').textContent=spec.images.length+' source photos for '+new Set(spec.images.flatMap(x=>x.panelIds)).size+' panel IDs — version '+spec.version+' — corrected atlas layout';
 fit();mode('mosaic');if('ResizeObserver'in window){new ResizeObserver(()=>updateDimensions()).observe($('board'));}
 }catch(e){console.error('Overhead mosaic initialization error:',e);$('status').textContent='Test data load failed: '+e.message;$('status').setAttribute('role','alert');}
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
