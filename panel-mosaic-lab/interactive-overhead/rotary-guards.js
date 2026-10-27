(function(){
 'use strict';
 const scriptURL=document.currentScript.src,url=p=>new URL(p,scriptURL).href;
 const model=window.B737RotaryGuardModel,points=window.B737OverheadToggleModel,motion=window.B737RotaryMotionRM0002;
 const STORAGE='b737-overhead-rotary-guards-RG-0001',byId=id=>document.getElementById(id);
 const SWIPE={firstThreshold:12,nextThreshold:28,minTravelPixels:9,tapSlopPixels:2.5};
 let registry,engine,layer,selected=null;
 const widgets=new Map(),angles=new Map(),legendWidgets=new Map();
 const persist=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(engine.snapshot()));}catch{}};
 const name=value=>String(value).toUpperCase();
 function interlocks(){
  for(const rule of registry.interlocks)window.B737OverheadToggles.setInterlock(rule.targetToggle,engine.guard(rule.sourceGuard).value===rule.enabledValue);
 }
 function stateValue(c){return c.kind==='rotary'?engine.rotary(c.id):engine.guard(c.id).value;}
 function refreshSelected(){
  if(!selected)return;const c=selected,value=stateValue(c);
  byId('rgValue').textContent=c.kind==='rotary'?name(value)+(c.mode==='continuous'?(c.unit==='deg'?'°':'%'):''):name(value)+' · GUARD '+engine.guard(c.id).guard.toUpperCase();
  for(const button of byId('rgStates').children){button.classList.toggle('active',button.dataset.value===String(value));button.disabled=c.kind==='guarded'&&engine.guard(c.id).guard!=='open';}
  const action=byId('rgGuardAction');action.classList.toggle('hidden',c.kind!=='guarded');
  if(c.kind==='guarded')action.textContent=engine.guard(c.id).guard==='closed'?'باز کردن گارد':'بستن گارد';
 }
 function choose(c){
  selected=c;byId('rgSelected').textContent=c.label;const root=byId('rgStates');root.replaceChildren();
  if(c.kind==='rotary'&&c.mode==='continuous'){
   for(const [label,delta]of [['−',-1],['+',1]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>engine.stepRotary(c.id,delta,'button');root.append(b);}
  }else for(const value of c.states){const b=document.createElement('button');b.type='button';b.textContent=name(value);b.dataset.value=String(value);b.onclick=()=>{if(c.kind==='guarded')engine.guardAction(c.id,'set',value);else engine.setRotary(c.id,value,'button');};root.append(b);}
  byId('rgGuardAction').onclick=()=>engine.guardAction(c.id,engine.guard(c.id).guard==='closed'?'open':'close');refreshSelected();
 }
 function render(c){
  const widget=widgets.get(c.id);if(!widget)return;
  if(c.kind==='rotary'){
   let a=engine.angle(c.id);if(c.wrap&&angles.has(c.id))a+=Math.round((angles.get(c.id)-a)/360)*360;angles.set(c.id,a);
   const img=widget.querySelector('img');img.style.transform='rotate('+a+'deg)';
   const value=engine.rotary(c.id),index=c.mode==='continuous'?value:c.states.indexOf(value);
   widget.dataset.value=String(value);widget.setAttribute('aria-valuenow',String(index));widget.setAttribute('aria-valuetext',String(value));widget.setAttribute('aria-label',c.label+' — '+value);
   for(const target of legendWidgets.get(c.id)||[])target.setAttribute('aria-pressed',String(target.dataset.detent===String(value)));
  }else if(c.presentation==='flight-recorder-left-hinge'){
   const current=engine.guard(c.id),index=c.states.indexOf(current.value);
   widget.dataset.guard=current.guard;widget.dataset.value=current.value;
   const recImage=widget.querySelector('.owner-recorder-guard-photo');
   if(recImage)recImage.src=url(registry.assets['owner-'+c.color+'-'+(current.guard==='closed'?'closed':'open')].url);
   const cover=widget.querySelector('.recorder-hinge-cover'),lever=widget.querySelector('.recorder-hinge-lever');
   cover.setAttribute('aria-expanded',String(current.guard==='open'));
   cover.setAttribute('aria-label',(current.guard==='open'?'Close':'Open')+' Flight Recorder left hinged guard');
   lever.disabled=current.guard!=='open';
   lever.setAttribute('aria-valuenow',String(index));
   lever.setAttribute('aria-valuetext',name(current.value));
   lever.setAttribute('aria-label','FLIGHT RECORDER '+name(current.value));
  }else if(c.presentation==='calibrated-horizontal-standby'){
   const current=engine.guard(c.id),index=c.states.indexOf(current.value),cover=widget.querySelector('.guard-cover'),lever=widget.querySelector('.guard-lever');
   widget.dataset.guard=current.guard;widget.dataset.value=current.value;
   const busPicture=widget.querySelector('.guard-picture');
   if(busPicture)busPicture.src=url(registry.assets['owner-'+c.color+'-'+(current.guard==='closed'?'closed':'open')].url);
   const left=Number(widget.dataset.mountLeft),top=Number(widget.dataset.mountTop),w=Number(widget.dataset.mountWidth),h=Number(widget.dataset.mountHeight);
   Object.assign(cover.style,current.guard==='closed'?{left:left+'px',top:top+'px',width:w+'px',height:h+'px'}:{left:left+'px',top:top+'px',width:w+'px',height:(h*.22)+'px'});
   Object.assign(lever.style,{left:(left+w*.13)+'px',top:(top+h*.31)+'px',width:(w*.74)+'px',height:(h*.53)+'px'});
   cover.setAttribute('aria-expanded',String(current.guard==='open'));cover.setAttribute('aria-label',(current.guard==='closed'?'OPEN ':'CLOSE ')+c.label+' GUARD');
   lever.disabled=current.guard!=='open';lever.setAttribute('aria-disabled',String(current.guard!=='open'));lever.setAttribute('aria-valuenow',String(index));lever.setAttribute('aria-valuetext',name(current.value));lever.setAttribute('aria-label',c.label+' — '+name(current.value));
  }else{
   const current=engine.guard(c.id),index=c.states.indexOf(current.value),frame=current.guard==='closed'?'CLOSED':index===0?'Open_UP':index===c.states.length-1?'Open_DOWN':'Open_CENTER';
   widget.dataset.guard=current.guard;widget.dataset.value=current.value;
   for(const img of widget.querySelectorAll('.guard-picture'))img.classList.toggle('active',img.dataset.frame===frame);
   const cover=widget.querySelector('.guard-cover'),lever=widget.querySelector('.guard-lever'),s=Number(widget.dataset.scale);
   Object.assign(cover.style,current.guard==='closed'?{left:(-130.5*s)+'px',top:(-179.5*s)+'px',width:(261*s)+'px',height:(359*s)+'px'}:{left:(-127*s)+'px',top:(-230*s)+'px',width:(254*s)+'px',height:(200*s)+'px'});
   cover.setAttribute('aria-label',(current.guard==='closed'?'OPEN GUARD ':'CLOSE GUARD ')+c.label);cover.setAttribute('aria-expanded',String(current.guard==='open'));
   lever.disabled=current.guard!=='open';lever.setAttribute('aria-disabled',String(current.guard!=='open'));lever.setAttribute('aria-valuenow',String(index));lever.setAttribute('aria-valuetext',name(current.value));lever.setAttribute('aria-label',c.label+' — '+name(current.value));
  }
  if(selected?.id===c.id)refreshSelected();
 }
 function rotaryInput(c,button,img){
  let drag=null;
  const pointerAngle=e=>{const b=button.getBoundingClientRect();return Math.atan2(e.clientY-(b.top+b.height/2),e.clientX-(b.left+b.width/2))*180/Math.PI;};
  button.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;e.preventDefault();e.stopPropagation();choose(c);button.focus({preventScroll:true});button.setPointerCapture(e.pointerId);
   const b=button.getBoundingClientRect(),radius=Math.hypot(e.clientX-(b.left+b.width/2),e.clientY-(b.top+b.height/2));
   drag={id:e.pointerId,x:e.clientX,y:e.clientY,previousX:e.clientX,previousY:e.clientY,last:pointerAngle(e),angle:engine.angle(c.id),start:engine.rotary(c.id),moved:false,
    radial:radius>=Math.min(b.width,b.height)*.19,
    gesture:c.mode==='detent'?motion.createDetentGesture(direction=>engine.stepRotary(c.id,direction,'detent-drag'),SWIPE):null};
   button.classList.add('dragging');
  });
  button.addEventListener('pointermove',e=>{
   if(!drag||drag.id!==e.pointerId)return;e.stopPropagation();const a=pointerAngle(e),dx=e.clientX-drag.previousX,dy=e.clientY-drag.previousY,delta=drag.radial?motion.deltaAngle(drag.last,a):dx*.85;
   drag.last=a;drag.previousX=e.clientX;drag.previousY=e.clientY;
   if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;
   if(!drag.moved)return;
   if(c.mode==='detent'){drag.gesture.feed(delta,Math.hypot(dx,dy));return;}
   drag.angle+=delta;
   if(!c.wrap)drag.angle=Math.max(c.mode==='continuous'?c.angleMin:c.angles[0],Math.min(c.mode==='continuous'?c.angleMax:c.angles.at(-1),drag.angle));
   engine.turnRotary(c.id,drag.angle);angles.set(c.id,drag.angle);img.style.transform='rotate('+drag.angle+'deg)';
  });
  const finish=(e,cancel)=>{
   if(!drag||drag.id!==e.pointerId)return;e.stopPropagation();
   if(cancel&&c.mode==='detent')engine.setRotary(c.id,drag.start,'cancel-drag');
   else if(!cancel&&!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<=SWIPE.tapSlopPixels){
    const b=button.getBoundingClientRect(),relativeX=e.clientX-(b.left+b.width/2);
    engine.stepRotary(c.id,relativeX<-(b.width*.12)?-1:1,'tap');
   }
   drag=null;button.classList.remove('dragging');render(c);
  };
  button.addEventListener('pointerup',e=>finish(e,false));button.addEventListener('pointercancel',e=>finish(e,true));button.addEventListener('lostpointercapture',e=>finish(e,true));
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(e.detail===0){choose(c);engine.cycleRotary(c.id);}});
  button.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();choose(c);engine.stepRotary(c.id,e.deltaY>0?1:-1,'wheel');},{passive:false});
  button.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End',' ','Enter'].includes(e.key))return;e.preventDefault();e.stopPropagation();choose(c);
   if(e.key==='Home')engine.setRotary(c.id,c.mode==='continuous'?c.min:c.states[0],'key');else if(e.key==='End')engine.setRotary(c.id,c.mode==='continuous'?c.max:c.states.at(-1),'key');else if(e.key===' '||e.key==='Enter'){if(!e.repeat)engine.cycleRotary(c.id);}else engine.stepRotary(c.id,['ArrowLeft','ArrowDown'].includes(e.key)?-1:1,'key');
  });
  button.addEventListener('blur',()=>{if(drag&&c.mode==='detent')engine.setRotary(c.id,drag.start,'cancel-blur');drag=null;button.classList.remove('dragging');render(c);});
 }
 function rotary(c,p){
  const b=document.createElement('button');b.type='button';b.className='mounted-rotary'+(c.mode==='detent'?' detent-motion':'');b.dataset.control=c.id;b.dataset.visualSize=c.visualSize||'Standard';b.setAttribute('role','slider');b.setAttribute('aria-valuemin',String(c.mode==='continuous'?c.min:0));b.setAttribute('aria-valuemax',String(c.mode==='continuous'?c.max:c.states.length-1));b.title=c.label;
  Object.assign(b.style,{left:p.x+'px',top:p.y+'px',width:(p.diameter*1.10)+'px',height:(p.diameter*1.25)+'px'});
  const pic=document.createElement('img'),isCustom=Boolean(c.imageAspect),w=(isCustom?p.diameter*1.5:p.diameter*288/204)*(c.renderScale||1),h=isCustom?w/c.imageAspect:w*279/288;
  pic.className='rotary-picture';if(window.B737ImageLoader)window.B737ImageLoader.assign(pic,url(registry.assets[c.asset].url));else pic.src=url(registry.assets[c.asset].url);pic.alt='';pic.draggable=false;
  const pivot=c.visualPivot||[.5,.44];
  Object.assign(pic.style,{left:'calc(50% - '+(w*pivot[0])+'px)',top:'calc(50% - '+(h*pivot[1])+'px)',width:w+'px',height:h+'px',transformOrigin:(pivot[0]*100)+'% '+(pivot[1]*100)+'%'});
  b.append(pic);rotaryInput(c,b,pic);return b;
 }
 function mountLegendTargets(c,placement){
  const targets=[];
  for(const hit of model.legendHotspots(c,placement,points.mapPoint)){
   const button=document.createElement('button');button.type='button';button.className='rg-detent-hit';
   button.dataset.control=c.id;button.dataset.detent=hit.state;
   button.setAttribute('aria-label',c.label+' → '+hit.state);
   button.setAttribute('aria-pressed',String(engine.rotary(c.id)===hit.state));
   button.title=c.label+' · '+hit.state;
   Object.assign(button.style,{left:hit.left+'px',top:hit.top+'px',width:hit.width+'px',height:hit.height+'px',clipPath:hit.clipPath});
   button.addEventListener('pointerdown',event=>event.stopPropagation());
   button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();choose(c);engine.setRotary(c.id,hit.state,'legend-tap');});
   layer.append(button);targets.push(button);
  }
  legendWidgets.set(c.id,targets);
 }
 function recorderHinged(c,placement){
  const [x,y,w,h]=c.sourceRect,point=window.B737OverheadToggleModel.mapPoint;
  const a=point({...c,sourcePoint:[x,y],bezelSourceDiameter:0},placement);
  const b=point({...c,sourcePoint:[x+w,y+h],bezelSourceDiameter:0},placement);
  const group=document.createElement('div');group.className='guard-node recorder-hinge-unit';group.dataset.control=c.id;
  group.dataset.sourceRect=c.sourceRect.join(',');
  Object.assign(group.style,{left:a.x+'px',top:a.y+'px',width:(b.x-a.x)+'px',height:(b.y-a.y)+'px'});
  const hinge=document.createElement('span');hinge.className='recorder-hinge-pivot';hinge.setAttribute('aria-hidden','true');
  const cradle=document.createElement('span');cradle.className='recorder-hinge-cradle';cradle.setAttribute('aria-hidden','true');
  const lever=document.createElement('button');lever.type='button';lever.className='recorder-hinge-lever';lever.setAttribute('role','slider');
  lever.setAttribute('aria-orientation','horizontal');lever.setAttribute('aria-valuemin','0');lever.setAttribute('aria-valuemax','1');
  const cover=document.createElement('button');cover.type='button';cover.className='recorder-hinge-cover';
  cover.title='FLIGHT RECORDER TEST/NORMAL — left hinge';
  for(const control of [cover,lever])control.addEventListener('pointerdown',e=>{e.stopPropagation();choose(c);});
  cover.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();choose(c);
   engine.guardAction(c.id,engine.guard(c.id).guard==='closed'?'open':'close');});
  lever.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();choose(c);
   engine.guardAction(c.id,'set',engine.guard(c.id).value==='normal'?'test':'normal');});
  lever.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();choose(c);
   engine.guardAction(c.id,'set',e.key==='ArrowLeft'||e.key==='Home'?'test':'normal');
  });
  const ownerPic=document.createElement('img');ownerPic.className='owner-recorder-guard-photo';ownerPic.alt='';ownerPic.draggable=false;
  ownerPic.src=url(registry.assets['owner-'+c.color+'-closed'].url);
  Object.assign(ownerPic.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',objectFit:'contain',transform:'rotate(-90deg)',pointerEvents:'none'});
  group.append(cradle,lever,hinge,cover,ownerPic);return group;
 }
 function guarded(c,p,placement){
  const group=document.createElement('div');group.className='guard-node';group.dataset.control=c.id;
  Object.assign(group.style,{left:p.x+'px',top:p.y+'px',transform:'rotate('+c.rotation+'deg)'});
  const scale=p.diameter/261;group.dataset.scale=String(scale);
  // The exterior housing uses owner-marked native pixel recess geometry, independently
  // of the approved, aspect-preserved original switch/guard artwork.
  if(c.mountingRectSource){
   const [rx,ry,rw,rh]=c.mountingRectSource;
   const a=points.mapPoint({...c,sourcePoint:[rx,ry],bezelSourceDiameter:0},placement);
   const b=points.mapPoint({...c,sourcePoint:[rx+rw,ry+rh],bezelSourceDiameter:0},placement);
   const left=a.x-p.x,top=a.y-p.y,w=b.x-a.x,h=b.y-a.y;
   Object.assign(group.dataset,{mountLeft:String(left),mountTop:String(top),mountWidth:String(w),mountHeight:String(h)});
   const housing=document.createElement('span');
   housing.className='guard-housing '+(c.presentation==='calibrated-horizontal-standby'?'guard-housing--horizontal':'guard-housing--vertical');
   Object.assign(housing.style,{left:left+'px',top:top+'px',width:w+'px',height:h+'px'});
   housing.setAttribute('aria-hidden','true');group.append(housing);
  }
  const dimensions={CLOSED:[261,c.color==='red'?354:359],Open_UP:[c.color==='red'?254:256,c.color==='red'?466:470],Open_CENTER:[254,c.color==='red'?467:469],Open_DOWN:[c.color==='red'?253:256,c.color==='red'?468:471]};
  for(const frame of (c.presentation==='calibrated-horizontal-standby'?[]:['CLOSED','Open_UP','Open_CENTER','Open_DOWN'])){
   const img=document.createElement('img'),[w,h]=dimensions[frame];img.className='guard-picture';img.dataset.frame=frame;if(window.B737ImageLoader)window.B737ImageLoader.assign(img,url(registry.assets['owner-'+c.color+'-'+(frame==='CLOSED'?'closed':'open')].url));else img.src=url(registry.assets[c.color+'-'+frame].url);img.alt='';img.draggable=false;
   Object.assign(img.style,{left:(-(frame==='CLOSED'?130.5:w/2)*scale)+'px',top:(-(frame==='CLOSED'?179.5:230)*scale)+'px',width:(w*scale)+'px',height:(h*scale)+'px'});group.append(img);
  }
  if(c.presentation==='calibrated-horizontal-standby'){
    const pic=document.createElement('img');pic.className='guard-picture active';pic.dataset.frame='CLOSED';
    pic.src=url(registry.assets['owner-'+c.color+'-closed'].url);pic.alt='';pic.draggable=false;
    const l=Number(group.dataset.mountLeft),t=Number(group.dataset.mountTop),w=Number(group.dataset.mountWidth),h=Number(group.dataset.mountHeight);
    Object.assign(pic.style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'});
    group.append(pic);
  }
  const cover=document.createElement('button'),lever=document.createElement('button');cover.type=lever.type='button';cover.className='guard-hit guard-cover';lever.className='guard-hit guard-lever';
  lever.setAttribute('role','slider');lever.setAttribute('aria-orientation',c.axis);lever.setAttribute('aria-valuemin','0');lever.setAttribute('aria-valuemax',String(c.states.length-1));
  Object.assign(lever.style,{left:(-72*scale)+'px',top:(5*scale)+'px',width:(144*scale)+'px',height:(175*scale)+'px'});
  for(const b of [cover,lever])b.addEventListener('pointerdown',e=>{e.stopPropagation();choose(c);});
  cover.addEventListener('click',e=>{e.stopPropagation();choose(c);engine.guardAction(c.id,engine.guard(c.id).guard==='closed'?'open':'close');});
  let leverDrag=null,suppressClick=false;
  lever.addEventListener('pointerdown',e=>{if(e.button!==0)return;lever.setPointerCapture(e.pointerId);leverDrag={id:e.pointerId,x:e.clientX,y:e.clientY,index:c.states.indexOf(engine.guard(c.id).value),moved:false};suppressClick=false;});
  lever.addEventListener('pointermove',e=>{if(!leverDrag||leverDrag.id!==e.pointerId)return;e.stopPropagation();const delta=c.axis==='horizontal'?e.clientX-leverDrag.x:e.clientY-leverDrag.y,b=lever.getBoundingClientRect(),size=c.axis==='horizontal'?b.width:b.height;if(Math.abs(delta)>4){leverDrag.moved=true;const index=Math.max(0,Math.min(c.states.length-1,leverDrag.index+Math.round(delta/Math.max(8,size*.35))));engine.guardAction(c.id,'set',c.states[index]);}});
  const finishLever=e=>{if(!leverDrag||leverDrag.id!==e.pointerId)return;e.stopPropagation();suppressClick=leverDrag.moved;leverDrag=null;};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])lever.addEventListener(event,finishLever);
  lever.addEventListener('click',e=>{e.stopPropagation();choose(c);if(suppressClick){suppressClick=false;return;}const v=engine.guard(c.id).value;engine.guardAction(c.id,'set',c.states[(c.states.indexOf(v)+1)%c.states.length]);});
  lever.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();choose(c);const index=c.states.indexOf(engine.guard(c.id).value)+Math.sign(e.deltaY);engine.guardAction(c.id,'set',c.states[Math.max(0,Math.min(c.states.length-1,index))]);},{passive:false});
  lever.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','g','G'].includes(e.key))return;e.preventDefault();e.stopPropagation();choose(c);
   if(e.key.toLowerCase()==='g'){engine.guardAction(c.id,'close');cover.focus({preventScroll:true});return;}
   const current=c.states.indexOf(engine.guard(c.id).value),delta=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;
   const index=e.key==='Home'?0:e.key==='End'?c.states.length-1:Math.max(0,Math.min(c.states.length-1,current+delta));engine.guardAction(c.id,'set',c.states[index]);
  });
  group.append(cover,lever);return group;
 }
 // Non-destructive label calibration: the approved atlas bitmap remains byte-for-byte locked.
 // The original FLT lettering on OH23-25 crowds CONT; replace only those two tiny regions.
 function mountEngineStartLabelCorrection(layout){
  const plate=layout.placements.find(p=>p.id==='OH23-25');if(!plate)return;
  const ns='http://www.w3.org/2000/svg',make=tag=>document.createElementNS(ns,tag),svg=make('svg');
  svg.classList.add('rg-start-label-correction');
  svg.setAttribute('viewBox','0 212 2170 297');svg.setAttribute('preserveAspectRatio','none');
  Object.assign(svg.style,{position:'absolute',left:plate.x+'px',top:plate.y+'px',width:plate.w+'px',height:plate.h+'px',zIndex:88,pointerEvents:'none',overflow:'hidden'});
  const defs=make('defs'),clip=make('clipPath');clip.id='rm0002-old-flt-letters';
  for(const [x,y,w,h] of [[1052,291,46,28],[1405,292,47,29]]){
   const mask=make('rect');for(const [k,v] of Object.entries({x,y,width:w,height:h}))mask.setAttribute(k,v);clip.append(mask);
  }
  defs.append(clip);svg.append(defs);
  const background=make('image');
  background.setAttribute('href',window.B737ImageLoader?.labelPatchURL()||url('../../panel-mosaic-lab/assets/locked/2026-10-23/OH23-25-LOWER-CONTROLS-fad696c845df.png'));
  background.setAttribute('x','0');background.setAttribute('y','-41');background.setAttribute('width','2170');background.setAttribute('height','725');
  background.setAttribute('clip-path','url(#rm0002-old-flt-letters)');svg.append(background);
  for(const [x,y] of [[1093,324],[1436,324]]){
   const label=make('text');label.textContent='FLT';label.setAttribute('x',x);label.setAttribute('y',y);
   label.setAttribute('font-family','Arial Narrow,Arial,sans-serif');label.setAttribute('font-size','16');
   label.setAttribute('font-weight','700');label.setAttribute('text-anchor','middle');
   label.setAttribute('fill','#f0eae0');label.setAttribute('stroke','#383632');label.setAttribute('stroke-width','.55');
   label.setAttribute('paint-order','stroke fill');svg.append(label);
  }
  byId('atlasAbsolute').append(svg);
 }
 function mount(layout){
  const section=document.createElement('section');section.className='rg-inspector';section.innerHTML='<strong>۲۰ روتری‌ناب · ۱۳ گارد · OWNER-PHOTO-0004</strong><h3 id="rgSelected">یک ناب یا گارد را انتخاب کن</h3><button id="rgGuardAction" class="hidden"></button><div id="rgStates" class="rg-actions"></div><p id="rgValue" role="status" aria-live="polite"></p>';
  byId('toggleInspector').after(section);
  mountEngineStartLabelCorrection(layout);
  layer=document.createElement('div');layer.className='rg-layer';layer.id='rotaryGuardLayer';const placements=new Map(layout.placements.map(p=>[p.id,p]));
  layer.dataset.debugDetents=String(new URLSearchParams(location.search).get('debugDetents')==='1');
  for(const c of [...registry.rotaries,...registry.guards]){const p=points.mapPoint(c,placements.get(c.placementId)),node=c.kind==='rotary'?rotary(c,p):c.presentation==='flight-recorder-left-hinge'?recorderHinged(c,placements.get(c.placementId)):guarded(c,p,placements.get(c.placementId));widgets.set(c.id,node);layer.append(node);render(c);}
  for(const c of registry.rotaries)if(c.legendAreas)mountLegendTargets(c,placements.get(c.placementId));
  layer.classList.toggle('hidden',!byId('toggleVisibility').checked);byId('atlasAbsolute').append(layer);interlocks();
  byId('resetToggles').addEventListener('click',()=>{engine.reset();interlocks();persist();});
  byId('toggleVisibility').addEventListener('change',e=>layer.classList.toggle('hidden',!e.target.checked));
  const label=byId('toggleVisibility').parentElement;label.lastChild.textContent=' نمایش کنترل‌ها';byId('resetToggles').textContent='بازنشانی کنترل‌ها';
  window.B737RotaryGuards=Object.freeze({getState:()=>engine.snapshot(),getRegistry:()=>JSON.parse(JSON.stringify(registry)),
   // Narrow 737-400 adapter: retain existing pneumatic control channel for outer two zones.
   // No geometry or behavior change for 737-300/500 when this adapter is not called.
   setAirconTemperature:(id,value)=>{
    if(!['control-cabin-temp','pass-cabin-temp'].includes(id)||
       !['MANUAL COOL','AUTO COOL','AUTO NORM','AUTO WARM','MANUAL WARM'].includes(value))return false;
    return engine.setRotary(id,value,'AIRCON400_ZONE_SELECTOR');
   },
   setDetent:(id,value)=>{if(!['engine-start-1','engine-start-2'].includes(id)||value!=='OFF')return false;
    return engine.setRotary(id,value,'ISN03_STARTER_CUTOUT');}});persist();
 }
 async function start(){
  try{
   if(!motion||typeof motion.createDetentGesture!=='function')throw Error('RM-0002 detent engine unavailable');
   const responses=await Promise.all([fetch(url('rotary-guards.json'),{cache:'no-store'}),fetch(url('../all-overhead/atlas-layout.json'),{cache:'no-store'})]);if(responses.some(r=>!r.ok))throw Error('Rotary/guard registry unavailable');
   registry=await responses[0].json();const extraResponse=await fetch(url('lights-controls.json'),{cache:'no-store'});if(!extraResponse.ok)throw Error('Upper light controls unavailable');const extra=await extraResponse.json();registry.rotaries.push(...extra.rotaries);registry.guards.push(...extra.guards);const layout=await responses[1].json();model.validate(registry,layout,points.mapPoint);
   let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{}
   engine=model.controller(registry,saved,event=>{const c=[...registry.rotaries,...registry.guards].find(c=>c.id===event.id);render(c);persist();if(window.B737OverheadToggles)interlocks();window.dispatchEvent(new CustomEvent('b737:'+event.kind+'-change',{detail:{...event,timestamp:new Date().toISOString()}}));},window.B737ControlMechanics);
   const root=byId('atlasAbsolute'),ready=()=>root.querySelector('.atlas-piece')&&window.B737OverheadToggles;
   if(ready())mount(layout);else{const observer=new MutationObserver(()=>{if(ready()){observer.disconnect();mount(layout);}});observer.observe(root,{childList:true,subtree:true});}
  }catch(error){console.error(error);const note=document.createElement('p');note.textContent='خطا در نصب ناب و گارد: '+error.message;note.setAttribute('role','alert');byId('toggleInspector').append(note);}
 }
 start();
})();
