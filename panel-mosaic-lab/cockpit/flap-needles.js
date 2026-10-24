(function(){
 'use strict';
 const model=window.B737FlapNeedlesModel;
 const engine=model.make();
 const ns='http://www.w3.org/2000/svg';
 const source={pieceId:'fo-inner',width:918,height:1713,centerX:95,centerY:291,overlaySize:145};
 let mounted=false,svg,groups={},status,leftInput,rightInput;
 function element(parent,tag,attrs={}){
  const node=document.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);return node;
 }
 function makePointer(label){
  // Paint order is part of the physical model: R must be added before L.
  const group=element(svg,'g',{class:'flap-pointer','data-side':label});
  element(group,'path',{class:'needle-body',d:'M 58 250 Q 91 243 122 234 L 247 232 L 247 268 L 122 266 Q 91 257 58 250 Z'});
  element(group,'path',{class:'needle-glint',d:'M 61 249 L 124 238 L 230 238 L 230 244 L 123 244 Z'});
  const text=element(group,'text',{class:'needle-letter',x:166,y:251});text.textContent=label;
  groups[label]=group;
 }
 function paint(){
  if(!mounted)return;
  const s=engine.read();
  groups.R.style.transform=`rotate(${s.rightAngle}deg)`;
  groups.L.style.transform=`rotate(${s.leftAngle}deg)`;
  if(status)status.textContent=`L ${s.left}° / R ${s.right}° · ${s.rightOccluded?'R OCCLUDED':'R VISIBLE'} · ${s.mode.toUpperCase()}`;
  if(leftInput)leftInput.value=String(s.left);
  if(rightInput)rightInput.value=String(s.right);
  svg.dataset.rOccluded=String(s.rightOccluded);
 }
 function common(v){const state=engine.setCommon(v);paint();return state;}
 function independent(p){const state=engine.setIndependent(p);paint();return state;}
 function controls(){
  const section=document.createElement('section');section.className='flap-needle-tools';section.id='unifiedFlapNeedles';
  section.innerHTML='<h2>Flap Indicator · L / R</h2><p class="muted">R همیشه زیر L است؛ در حرکت یکسان، R دیده نمی‌شود.</p><label>LEFT (L)<select id="flapLeftTest"></select></label><label>RIGHT (R)<select id="flapRightTest"></select></label><output class="flap-status" id="flapNeedleStatus"></output><button type="button" id="flapFollowCommon">بازگشت به سیگنال مشترک فلپ</button><small>اختلاف دو نیدل فقط تست تصویری است. تشخیص و هشدار FLAP SPLIT تابع آستانه‌های مستند سیستم فلپ خواهد بود.</small>';
  const before=document.querySelector('.cdu-tools')||document.querySelector('.overhead-tools');before.before(section);
  leftInput=section.querySelector('#flapLeftTest');rightInput=section.querySelector('#flapRightTest');status=section.querySelector('#flapNeedleStatus');
  for(const sel of [leftInput,rightInput])for(const stop of model.stops){const o=document.createElement('option');o.value=String(stop.value);o.textContent=stop.value===0?'UP':String(stop.value);sel.append(o);}
  const set=()=>independent({left:Number(leftInput.value),right:Number(rightInput.value)});
  leftInput.addEventListener('change',set);rightInput.addEventListener('change',set);
  section.querySelector('#flapFollowCommon').addEventListener('click',()=>common(window.B737CockpitLights?.getState()?.inputs?.trailingFlaps??0));
 }
 async function mount(){
  if(mounted)return;
  const assembly=await fetch('./assembly.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Flap gauge assembly unavailable');return r.json();});
  const main=assembly.regions.find(r=>r.id==='main'),piece=main?.placements.find(p=>p.id===source.pieceId);
  if(!piece||!main)throw Error('Flap gauge source piece missing');
  const native=document.querySelector('#region-main .region-native');if(!native)return;
  const factor=piece.w/assembly.assets[piece.asset].dimensions[0];
  const x=piece.x+source.centerX*factor,y=piece.y+source.centerY*factor;
  const size=source.overlaySize*factor;
  svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 500 500');svg.setAttribute('aria-label','Flap position needles: R behind L');svg.classList.add('flap-needle-overlay');
  Object.assign(svg.style,{left:(x-size/2)+'px',top:(y-size/2)+'px',width:size+'px',height:size+'px'});
  makePointer('R');makePointer('L');element(svg,'circle',{class:'needle-hub',cx:250,cy:250,r:60});native.append(svg);
  controls();mounted=true;paint();
 }
 // The model always keeps separate R/L values, even when the normal input drives both equally.
 window.B737FlapNeedles=Object.freeze({getState:()=>engine.read(),setPositions:independent,setCommon:common});
 window.addEventListener('b737:cockpit-mounted',()=>mount().catch(console.error),{once:true});
 window.addEventListener('b737:trailing-flaps',e=>{if(engine.read().mode==='common'&&Number.isFinite(e.detail?.position))common(e.detail.position);});
 window.addEventListener('b737:flap-positions',e=>{try{independent(e.detail);}catch(error){console.error('Invalid L/R flap sensor input',error);}});
 if(document.querySelector('#region-main .region-native'))mount().catch(console.error);
})();
