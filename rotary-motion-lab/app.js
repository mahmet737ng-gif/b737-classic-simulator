(function () {
  'use strict';
  const standard = '../panel-mosaic-lab/assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.webp';
  const specs = [
    { id:'crossfeed-motion', title:'کراس‌فید · دوحالته', description:'چرخش یک‌چهارم دور؛ توقف روی دو انتها', mode:'detent', angles:[0,90], labels:['CLOSED','OPEN'], initial:0, image:'../panel-mosaic-lab/assets/locked/2026-10-23/Switches/Rotary/Cross_Feed_Knob.png', pivot:[.498,.498], aspect:1333/1180, width:1.45 },
    { id:'selector-motion', title:'روتاری چندپله‌ای', description:'حرکت آزاد با انگشت؛ نشستن روی نزدیک‌ترین پله', mode:'detent', angles:[-120,-60,0,60,120], labels:['1','2','3','4','5'], initial:2, image:standard, pivot:[.5,.44], aspect:288/279, width:1.35 },
    { id:'continuous-motion', title:'روتاری پیوسته', description:'تنظیم نرم از حداقل تا حداکثر؛ بدون چرخش اضافه', mode:'continuous', min:0, max:100, step:1, angleMin:-135, angleMax:135, unit:'%', initial:50, image:standard, pivot:[.5,.44], aspect:288/279, width:1.35 }
  ];
  const widgets = [];
  for (const spec of specs) {
    const card = document.createElement('article'); card.className='card';
    card.innerHTML='<h2></h2><p class="subtitle"></p><div class="well"><div class="knob" tabindex="0" role="slider"><img alt="" draggable="false"></div></div><div class="reading" aria-live="off"></div><div class="angle"></div><div class="steps"></div>';
    card.querySelector('h2').textContent=spec.title; card.querySelector('.subtitle').textContent=spec.description;
    const knob=card.querySelector('.knob'), img=knob.querySelector('img'), steps=card.querySelector('.steps');
    img.src=spec.image;
    const w=spec.width*100, h=w/spec.aspect;
    Object.assign(img.style,{width:w+'%',height:h+'%',left:(50-w*spec.pivot[0])+'%',top:(50-h*spec.pivot[1])+'%'});
    img.style.setProperty('--pivot-x',spec.pivot[0]*100+'%');img.style.setProperty('--pivot-y',spec.pivot[1]*100+'%');
    const model=B737RotaryMotion.create(spec, event=>{
      document.getElementById('event').textContent=JSON.stringify(event,null,2);
      window.dispatchEvent(new CustomEvent('b737:rotary-motion-command',{detail:event}));
    });
    knob.dataset.control=spec.id;knob.setAttribute('aria-label',spec.title);knob.setAttribute('aria-valuemin',model.min);knob.setAttribute('aria-valuemax',model.max);
    const buttons=[];
    function render() {
      img.style.transform='rotate('+model.angle+'deg)';
      card.querySelector('.reading').textContent=model.text;
      card.querySelector('.angle').textContent=model.angle.toFixed(1)+'°';
      knob.setAttribute('aria-valuenow',model.value);knob.setAttribute('aria-valuetext',model.text);
      for(const {button,value} of buttons)button.classList.toggle('active',model.value===value);
    }
    function addButton(label,action,value) {const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{action();render();};steps.append(b);if(value!==undefined)buttons.push({button:b,value});}
    if(spec.mode==='detent')spec.labels.forEach((label,i)=>addButton(label,()=>model.set(i,'button'),i));
    else {addButton('−',()=>model.step(-1,'button'));addButton('+',()=>model.step(1,'button'));}
    let drag=null;
    const bearing=(x,y)=>{const r=knob.getBoundingClientRect();return Math.atan2(y-r.top-r.height/2,x-r.left-r.width/2)*180/Math.PI;};
    knob.addEventListener('pointerdown',e=>{
      if(e.button!==0||drag)return;
      e.preventDefault();knob.focus({preventScroll:true});knob.setPointerCapture(e.pointerId);
      const r=knob.getBoundingClientRect(),radius=Math.hypot(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2);
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastAngle:bearing(e.clientX,e.clientY),moved:false,mode:radius<r.width*.27?'linear':'circular'};
      model.begin();knob.classList.add('dragging');
    });
    knob.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const angle=bearing(e.clientX,e.clientY);
      if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5)return;
      drag.moved=true;
      const r=knob.getBoundingClientRect();
      const delta=drag.mode==='linear'?(e.clientX-drag.lastX)*270/r.width:B737RotaryMotion.deltaAngle(drag.lastAngle,angle);
      drag.lastX=e.clientX;drag.lastAngle=angle;model.drag(delta);render();
    });
    function finish(e,cancel) {
      if(!drag||e.pointerId!==drag.id)return;
      const old=drag;drag=null;knob.classList.remove('dragging');model.finish(cancel);
      if(!cancel&&!old.moved){const r=knob.getBoundingClientRect();model.step(old.x<r.left+r.width/2?-1:1,'tap');}
      render();if(knob.hasPointerCapture(e.pointerId))knob.releasePointerCapture(e.pointerId);
    }
    knob.addEventListener('pointerup',e=>finish(e,false));
    for(const event of ['pointercancel','lostpointercapture'])knob.addEventListener(event,e=>finish(e,true));
    knob.addEventListener('blur',()=>{if(drag)finish({pointerId:drag.id},true);});
    knob.addEventListener('wheel',e=>{e.preventDefault();if(drag)return;model.step(Math.sign(e.deltaY),'wheel');render();},{passive:false});
    knob.addEventListener('keydown',e=>{
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter',' ','Escape'].includes(e.key))return;
      e.preventDefault();
      if(drag){if(e.key==='Escape')finish({pointerId:drag.id},true);return;}
      if(e.key==='Home')model.set(model.min,'key');
      else if(e.key==='End')model.set(model.max,'key');
      else if(e.key==='Escape')return;
      else if((e.key==='Enter'||e.key===' ')&&e.repeat)return;
      else model.step(['ArrowLeft','ArrowDown'].includes(e.key)||e.shiftKey?-1:1,'key');
      render();
    });
    document.getElementById('controls').append(card);render();widgets.push({spec,model,render});
  }
  const duration=document.getElementById('duration');duration.oninput=()=>{document.documentElement.style.setProperty('--duration',duration.value+'ms');document.getElementById('durationText').textContent=duration.value+' ms';};
  document.getElementById('reset').onclick=()=>widgets.forEach(({spec,model,render})=>{model.set(spec.initial,'reset');render();});
  window.B737RotaryMotionLab={version:'RM-0001',specs,widgets};
})();
