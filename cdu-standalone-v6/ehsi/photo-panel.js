/* B737 Classic Captain EFIS photo layer — source: user supplied 1536x977 panel photograph.
   Instrument geometry is calibrated against that photograph, not recreated in CSS.
   Photo is supplied separately as assets/efis-cp-reference.webp.
   Physical hardware input simulation only; not approved for navigation. */
(function(){
'use strict';
const api=window.EHSI_ENGINE;
if(!api)return;
const ORIGINAL={init:api.initControls,sync:api.syncPanel,render:api.renderToDom};
const W=1536,H=977;
const MODE_CW=['EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN','FULL_NAV','FULL_VOR_ILS'];
const MODE_DEG={EXP_NAV:-110,EXP_VOR_ILS:-66,MAP:-20,CTR_MAP:26,PLAN:74,FULL_NAV:151,FULL_VOR_ILS:207};
const RANGES=[10,20,40,80,160,320];
const RANGE_DEG={10:148,20:180,40:211,80:243,160:270,320:297};
const PHOTO='assets/efis-cp-reference.webp';
const CACHE_KEY='b737_efis_uploaded_photo_v1';
let activePhoto=PHOTO;
try{const src=localStorage.getItem(CACHE_KEY);if(src?.startsWith('data:image/'))activePhoto=src}catch{}
const geom={
 dh:{x:245,y:394,w:183,h:158,title:'DH REF selector'},
 adi:{x:258,y:787,w:139,h:125,title:'ADI brightness'},
 mode:{x:732,y:200,w:208,h:192,title:'HSI MODE selector'},
 hsi:{x:511,y:465,w:199,h:189,title:'HSI EHSI BRT (outer) / WXR BRT (inner)'},
 range:{x:1127,y:194,w:235,h:191,title:'RANGE selector'},
 rst:{x:292,y:660,w:52,h:48,title:'DH RESET'},
 wxr:{x:1124,y:448,w:218,h:216,title:'WXR pushbutton'},
 vorAdf:{x:487,y:749,w:187,h:205,title:'VOR/ADF map pushbutton'},
 navAid:{x:677,y:751,w:178,h:201,title:'NAV AID map pushbutton'},
 arpt:{x:859,y:751,w:177,h:204,title:'ARPT map pushbutton'},
 rteData:{x:1039,y:751,w:166,h:205,title:'RTE DATA map pushbutton'},
 wpt:{x:1212,y:752,w:166,h:205,title:'WPT map pushbutton'}
};
const angles={mode:null,range:null,dh:0,adi:0,hsi:0,wxInner:0};
let lastMode=null,lastRange=null,lastDH=null,lastBRT=null,lastWxBRT=null,lastAdiBRT=null,refresh=()=>{};
const pct=(n,d)=>n/d*100+'%';
const button=(cls,area,name,attrs={})=>{
 const el=document.createElement('button');el.type='button';el.className='photo-hotspot '+cls;
 const g=geom[area];Object.assign(el.style,{left:pct(g.x,W),top:pct(g.y,H),width:pct(g.w,W),height:pct(g.h,H)});
 el.title=g.title;el.setAttribute('aria-label',name);
 for(const [k,v] of Object.entries(attrs))el.dataset[k]=v;
 return el;
};
function targetAngle(last,a){if(last===null)return a;return a+360*Math.round((last-a)/360)}
function sprite(btn,g){
 const el=document.createElement('span');el.className='photo-sprite';
 // Percentage background size/position remains registered when panel scales.
 Object.assign(el.style,{
  backgroundImage:'url("'+activePhoto+'")',
  backgroundSize:(W/g.w*100)+'% '+(H/g.h*100)+'%',
  backgroundPosition:(g.x/(W-g.w)*100)+'% '+(g.y/(H-g.h)*100)+'%'
 });
 btn.appendChild(el);return el;
}
function renderKnob(key,degrees,buttonEl){
 if(!buttonEl)return;
 const value=targetAngle(angles[key],degrees);
 angles[key]=value;
 const spriteEl=buttonEl.querySelector('.photo-sprite');
 if(spriteEl)spriteEl.style.transform='rotate('+value+'deg)';
}
function edgeRefresh(st,doc){
 const m=api.modelFor(st),root=doc.getElementById('efis-control-panel');
 if(!root?.querySelector('.photo-face'))return;
 const modeTarget=MODE_DEG[m.mode]-MODE_DEG.MAP;
 const rangeTarget=RANGE_DEG[m.range]-RANGE_DEG[10];
 const modeEl=root.querySelector('[data-knob="mode"]');
 const rangeEl=root.querySelector('[data-knob="range"]');
 if(lastMode!==m.mode){renderKnob('mode',modeTarget,modeEl);lastMode=m.mode}
 if(lastRange!==m.range){renderKnob('range',rangeTarget,rangeEl);lastRange=m.range}
 for(const [name,k] of [['dh','dh'],['adi','eadiBrightness'],['hsi','brightness']]){
  const current=name==='dh'?m.efis.dh:m.efis[k];
  if(name==='dh'&&lastDH!==current){const diff=lastDH===null?0:(Number(current)-Number(lastDH));angles.dh+=Math.max(-90,Math.min(90,diff*15));lastDH=current}
  if(name==='adi'&&lastAdiBRT!==current){angles.adi=current*240-120;lastAdiBRT=current}
  if(name==='hsi'&&lastBRT!==current){angles.hsi=current*240-120;lastBRT=current}
  const target=root.querySelector('[data-knob="'+name+'"] .photo-sprite');
  if(target)target.style.transform='rotate('+angles[name]+'deg)';
 }
 if(lastWxBRT!==m.efis.wxBrightness){angles.wxInner=m.efis.wxBrightness*220-110;lastWxBRT=m.efis.wxBrightness}
 const inner=root.querySelector('.photo-wxr-inner');
 if(inner)inner.style.transform='rotate('+angles.wxInner+'deg)';
 const display=root.querySelector('.photo-dh-digits');
 if(display){
  const val=m.efis.dh;
  display.textContent=val===null?'':String(Math.trunc(val)).padStart(3,'0');
  display.classList.toggle('blank',val===null);
 }
 for(const key of ['wxr','vorAdf','navAid','arpt','rteData','wpt']){
  const control=root.querySelector('[data-option="'+key+'"]');if(!control)continue;
  const on=!!m.options[key];control.classList.toggle('lit',on);
  control.setAttribute('aria-pressed',String(on));
 }
 const readout=root.querySelector('.photo-state-line');
 if(readout)readout.textContent='HSI '+m.mode.replaceAll('_',' ')+'  ·  '+m.range+' NM  ·  DH '+(m.efis.dh===null?'BLANK':m.efis.dh+' FT');
 const opts=root.querySelectorAll('[data-test-option]');
 for(const el of opts){el.setAttribute('aria-pressed',String(!!m.options[el.dataset.testOption]));el.classList.toggle('selected',!!m.options[el.dataset.testOption])}
 root.querySelectorAll('[data-efis-test]').forEach(n=>{n.setAttribute('aria-pressed',String(!!m.efis[n.dataset.efisTest]));n.classList.toggle('selected',!!m.efis[n.dataset.efisTest])});
 root.querySelectorAll('[data-test-range]').forEach(n=>{if(document.activeElement!==n)n.value=String(m[n.dataset.testRange]??0)});
}
function rotate(st,key,step){
 const m=api.modelFor(st);
 if(key==='mode')m.mode=MODE_CW[Math.max(0,Math.min(MODE_CW.length-1,MODE_CW.indexOf(m.mode)+step))];
 else if(key==='range')m.range=RANGES[Math.max(0,Math.min(RANGES.length-1,RANGES.indexOf(m.range)+step))];
 else if(key==='dh'){m.efis.dh=Math.min(999,Math.max(-20,(m.efis.dh===null?200:m.efis.dh)+step))}
 else if(key==='adi')m.efis.eadiBrightness=Math.max(0,Math.min(1,Math.round((m.efis.eadiBrightness+step*.04)*100)/100));
 else if(key==='hsi')m.efis.brightness=Math.max(0,Math.min(1,Math.round((m.efis.brightness+step*.04)*100)/100));
 else if(key==='wxInner')m.efis.wxBrightness=Math.max(0,Math.min(1,Math.round((m.efis.wxBrightness+step*.04)*100)/100));
 refresh();
}
function init(st,core,doc,onchange){
 const box=doc.getElementById('efis-control-panel');if(!box)return;
 refresh=onchange;box.replaceChildren();box.classList.add('photo-efis-root');
 const face=document.createElement('div');face.className='photo-face';
 const img=document.createElement('img');img.src=activePhoto;img.className='photo-base';img.alt='Captain EFIS Control Panel — owner supplied original photograph';img.draggable=false;
 img.onerror=()=>{face.classList.add('missing-photo');document.getElementById('efis-photo-alert').hidden=false};
 face.append(img);
 const dh=document.createElement('div');dh.className='photo-dh-digits';dh.setAttribute('role','status');dh.setAttribute('aria-label','Decision height reference display');
 Object.assign(dh.style,{left:pct(218,W),top:pct(177,H),width:pct(196,W),height:pct(101,H)});
 face.appendChild(dh);
 for(const key of ['dh','adi','mode','hsi','range']){
  const b=button('knob-'+key,key,geom[key].title,{knob:key});
  sprite(b,geom[key]);
  if(key==='hsi'){
   const inner=document.createElement('span');inner.className='photo-wxr-inner';inner.setAttribute('aria-label','Weather radar brightness inner shaft');b.append(inner);
  }
  b.addEventListener('click',e=>{if(b.dataset.dragged==='1'){b.dataset.dragged='0';return}rotate(st,key,e.shiftKey?-1:1)});
  b.addEventListener('wheel',e=>{e.preventDefault();rotate(st,key,e.deltaY>0?-1:1)},{passive:false});
  b.addEventListener('keydown',e=>{if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown'].includes(e.key)){e.preventDefault();rotate(st,key,['ArrowRight','ArrowUp'].includes(e.key)?1:-1)}});
  let start=null;
  b.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};b.setPointerCapture?.(e.pointerId)});
  b.addEventListener('pointerup',e=>{if(!start)return;let dist=e.clientX-start.x,dy=e.clientY-start.y;start=null;
   if(Math.max(Math.abs(dist),Math.abs(dy))>14){b.dataset.dragged='1';const sign=Math.abs(dist)>Math.abs(dy)?Math.sign(dist):-Math.sign(dy);rotate(st,key,sign);}});
  face.appendChild(b);
 }
 const rst=button('photo-press photo-rst','rst','Decision height reset');
 rst.addEventListener('pointerdown',()=>rst.classList.add('held'));
 for(const evt of ['pointerup','pointercancel','pointerleave'])rst.addEventListener(evt,()=>rst.classList.remove('held'));
 rst.addEventListener('click',()=>{api.modelFor(st).efis.dhAlert=false;refresh()});face.append(rst);
 const labels={wxr:'WXR',vorAdf:'VOR/ADF',navAid:'NAV AID',arpt:'ARPT',rteData:'RTE DATA',wpt:'WPT'};
 for(const key of Object.keys(labels)){
  const b=button('photo-press photo-latch photo-'+key,key,labels[key],{option:key});
  b.setAttribute('aria-pressed','false');
  const lamp=document.createElement('span');lamp.className='photo-key-lamp';lamp.textContent=key==='wxr'?'WXR':labels[key];lamp.setAttribute('aria-hidden','true');b.append(lamp);
  b.addEventListener('pointerdown',()=>b.classList.add('held'));
  for(const evt of ['pointerup','pointercancel','pointerleave'])b.addEventListener(evt,()=>b.classList.remove('held'));
  b.addEventListener('click',()=>{
   const m=api.modelFor(st);m.options[key]=!m.options[key];
   if(key==='wxr'&&m.options.wxr)m.options.terr=false;
   refresh();
  });face.append(b);
 }
 box.append(face);
 const filePanel=document.createElement('label');filePanel.className='photo-source-picker';
 filePanel.textContent='Original photo: ';
 const fileField=document.createElement('input');fileField.type='file';fileField.accept='image/jpeg,image/png,image/webp';
 fileField.setAttribute('aria-label','Load approved EFIS panel photograph');
 filePanel.appendChild(fileField);box.append(filePanel);
 fileField.addEventListener('change',()=>{
  const file=fileField.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){alert('Please select the original EFIS JPG, PNG or WebP under 8 MB.');return}
  const reader=new FileReader();
  reader.onload=()=>{if(typeof reader.result!=='string')return;activePhoto=reader.result;
   img.src=activePhoto;face.classList.remove('missing-photo');
   const alert=doc.getElementById('efis-photo-alert');if(alert)alert.hidden=true;
   face.querySelectorAll('.photo-sprite').forEach(el=>el.style.backgroundImage='url("'+activePhoto+'")');
   try{localStorage.setItem(CACHE_KEY,activePhoto)}catch(e){filePanel.title='Photo loaded for this session (browser storage full)'}
  };
  reader.readAsDataURL(file);
 });
 const strip=document.createElement('div');strip.className='photo-efis-feedback';
 strip.innerHTML='<output class="photo-state-line"></output><span>Click / wheel / drag / touch knobs • Shift+click to reverse • keyboard arrows</span>';
 box.append(strip);
 // Training-only controls are deliberately OUTSIDE the photographed hardware.
 const details=document.createElement('details');details.className='photo-sim-controls';
 details.innerHTML='<summary>SIMULATOR DATA SOURCES (not part of physical EFIS panel)</summary>'+
 '<div class="photo-sim-row"><button data-test-option="demoRoute">SIM ROUTE</button><button data-test-option="tfc">SIM TFC</button><button data-test-option="terr">SIM TERR</button><button data-efis-test="remoteWxr">REMOTE WXR</button><button data-efis-test="wxrTransmitter">WXR TX</button></div>'+
 '<div class="photo-sim-row"><label>HDG <input data-test-range="heading" type="range" min="0" max="359" value="0"></label><label>TRK <input data-test-range="track" type="range" min="0" max="359" value="0"></label><label>CRS <input data-test-range="course" type="range" min="0" max="359" value="0"></label></div>'+
 '<p>These sliders and simulator data switches are synthetic test inputs. They are not present in the supplied EFIS panel photo.</p>';
 box.append(details);
 details.addEventListener('click',e=>{
  const b=e.target.closest('[data-test-option],[data-efis-test]');if(!b)return;
  const m=api.modelFor(st);
  if(b.dataset.testOption){const k=b.dataset.testOption;m.options[k]=!m.options[k];if(k==='terr'&&m.options.terr)m.options.wxr=false;}
  if(b.dataset.efisTest){const k=b.dataset.efisTest;m.efis[k]=!m.efis[k]}
  refresh();
 });
 details.querySelectorAll('[data-test-range]').forEach(el=>el.addEventListener('input',()=>{api.modelFor(st)[el.dataset.testRange]=Number(el.value);refresh()}));
 edgeRefresh(st,doc);
}
api.initControls=init;
api.syncPanel=function(st,doc){edgeRefresh(st,doc)};
api.renderToDom=function(st,core,svg,doc){const value=ORIGINAL.render(st,core,svg,doc);edgeRefresh(st,doc);return value};
api.photo={geometry:geom,photo:PHOTO,modeClockwise:MODE_CW,modeAngle:MODE_DEG,rangeAngle:RANGE_DEG,dhRange:{defaultValue:200,min:-20,max:999,step:1},rotate};
})();
