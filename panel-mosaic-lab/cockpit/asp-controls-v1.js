/* Byte-identical owner sprites, registered to existing SVG aperture centers.
 * All three stations retain their own state. No audio/backend wiring implied.
 */
(function(root){
 'use strict';
 const model=root.B737ASPControlsModel;if(!model)return;
 const state=model.create(),mounted=new Map(),ns='http://www.w3.org/2000/svg';
 const ASSETS=Object.freeze({mic:['mic-off.png','mic-on.png'],volume:['volume-glass-off.png','volume-glass-on.png']});
 // Common source-space pivots; transparent padding is excluded from sizing.
 const SOURCE=Object.freeze({mic:{size:1254,pivot:[627,626.5],extent:1015},volume:{size:1254,pivot:[627,621],extent:990}});
 let observer;
 function preventPan(e){e.stopPropagation();}
 function paint(button){
  const {seat,kind,channel}=button.dataset,s=state.snapshot(seat,kind,channel);
  button.dataset.selected=String(s.selected);
  if(kind==='mic')button.setAttribute('aria-pressed',String(s.selected));
  else{
   button.dataset.angle=String(s.angle);button.dataset.volume=String(s.volume);
   button.setAttribute('aria-valuenow',String(Math.round(s.volume)));
   button.setAttribute('aria-valuetext',Math.round(s.volume)+'%, '+(s.selected?'selected':'off'));
   button.querySelector('.asp-control-rotor').style.transform='rotate('+s.angle+'deg)';
  }
 }
 function notify(button){paint(button);root.dispatchEvent(new CustomEvent('b737:asp-control',{detail:{...button.dataset,...state.snapshot(button.dataset.seat,button.dataset.kind,button.dataset.channel)}}));}
 function toggle(button){const d=button.dataset;state.toggle(d.seat,d.kind,d.channel);notify(button);}
 function volume(button,value){const d=button.dataset;state.setVolume(d.seat,d.channel,value);notify(button);}
 function pointerAngle(button,e){const b=button.getBoundingClientRect();return Math.atan2(e.clientX-b.left-b.width/2,-(e.clientY-b.top-b.height/2))*180/Math.PI;}
 function wire(button){
  let gesture=null,suppressClickUntil=0;
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend'])button.addEventListener(type,preventPan);
  button.addEventListener('click',e=>{e.stopPropagation();if(performance.now()<suppressClickUntil)return;toggle(button);});
  if(button.dataset.kind!=='volume')return;
  button.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   gesture={id:e.pointerId,x:e.clientX,y:e.clientY,last:pointerAngle(button,e),moved:false};button.setPointerCapture(e.pointerId);
  });
  button.addEventListener('pointermove',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   const next=pointerAngle(button,e),delta=model.angularDelta(gesture.last,next);gesture.last=next;
   if(!gesture.moved&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<3)return;
   gesture.moved=true;e.preventDefault();
   volume(button,state.snapshot(button.dataset.seat,'volume',button.dataset.channel).volume+delta/2.7);
  });
  const finish=e=>{if(gesture?.id!==e.pointerId)return;if(gesture.moved)suppressClickUntil=performance.now()+300;gesture=null;if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
  button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',finish);
  button.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();const s=state.snapshot(button.dataset.seat,'volume',button.dataset.channel);volume(button,s.volume+(e.deltaY<0?2:e.deltaY>0?-2:0));},{passive:false});
  button.addEventListener('keydown',e=>{
   const s=state.snapshot(button.dataset.seat,'volume',button.dataset.channel);
   const actions={ArrowRight:s.volume+1,ArrowUp:s.volume+1,ArrowLeft:s.volume-1,ArrowDown:s.volume-1,PageUp:s.volume+10,PageDown:s.volume-10,Home:0,End:100};
   if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();toggle(button);}
   else if(Object.hasOwn(actions,e.key)){e.preventDefault();e.stopPropagation();volume(button,actions[e.key]);}
  });
 }
 function sizeControls(host){
  const style=getComputedStyle(host),unit=Math.min(parseFloat(style.width)/1122,parseFloat(style.height)/888);
  for(const b of host.querySelectorAll('.asp-photo-control')){
   const source=SOURCE[b.dataset.kind],socket=model.sockets.find(s=>s.kind===b.dataset.kind&&s.channel===b.dataset.channel);
   const w=socket.w*unit,h=socket.h*unit,scale=(b.dataset.kind==='mic'?104:96)*unit/source.extent;
   b.style.width=w+'px';b.style.height=h+'px';
   for(const img of b.querySelectorAll('.asp-control-image'))Object.assign(img.style,{width:source.size*scale+'px',height:source.size*scale+'px',left:w/2-source.pivot[0]*scale+'px',top:h/2-source.pivot[1]*scale+'px'});
  }
 }
 function socketPatches(host){
  // Paint only the old empty apertures. Source panel, lettering and positions
  // remain untouched. This also prevents an elliptical hole behind round glass
  // on the nonuniformly mapped OH-04 face.
  const colors=host.dataset.region==='aft-overhead'?['#597083','#566e81','#526b7e']:['#6f7783','#727c89','#707987'];
  const id='asp-patch-'+host.dataset.seat;
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1122 888');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('asp-socket-patches');
  const clips=model.sockets.map(s=>s.kind==='mic'?'<rect x="'+(s.x-53.5)+'" y="110.5" width="107" height="111"/>':'<rect x="'+(s.x-49)+'" y="'+(s.y-49)+'" width="98" height="98"/>').join('');
  svg.innerHTML='<defs><clipPath id="'+id+'-clip">'+clips+'</clipPath><linearGradient id="'+id+'-p" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="46.72" y2="886"><stop stop-color="'+colors[0]+'"/><stop offset=".55" stop-color="'+colors[1]+'"/><stop offset="1" stop-color="'+colors[2]+'"/></linearGradient><filter id="'+id+'-grain"><feTurbulence type="fractalNoise" baseFrequency=".31" numOctaves="2" seed="6"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".055"/></feComponentTransfer></filter></defs><g clip-path="url(#'+id+'-clip)"><rect x="2" y="2" width="1118" height="884" fill="url(#'+id+'-p)"/><rect x="25" y="26" width="1072" height="826" filter="url(#'+id+'-grain)"/></g>';
  host.append(svg);
 }
 function mount(){
  for(const host of document.querySelectorAll('.asp-bare-mounted')){
   if(mounted.has(host.dataset.seat))continue;
   socketPatches(host);
   for(const s of model.sockets){
    const button=document.createElement('button');button.type='button';button.className='asp-photo-control';
    Object.assign(button.dataset,{seat:host.dataset.seat,kind:s.kind,channel:s.channel,cx:String(s.x),cy:String(s.y)});
    button.style.left=s.x/1122*100+'%';button.style.top=s.y/888*100+'%';
    button.setAttribute('aria-label','ASP '+host.dataset.seat+' '+s.kind+' '+s.channel);
    button.title=s.kind==='mic'?'Press to select / deselect':'Press: select / deselect · Drag / wheel: volume · 270° travel';
    if(s.kind==='volume'){button.setAttribute('role','slider');button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','100');}
    const rotor=document.createElement('span');rotor.className='asp-control-rotor';
    ASSETS[s.kind].forEach((name,i)=>{const img=document.createElement('img');img.src='./assets/asp-controls-v1/'+name;img.alt='';img.draggable=false;img.className='asp-control-image asp-image-'+(i?'on':'off');rotor.append(img);});
    button.append(rotor);host.append(button);wire(button);paint(button);
   }
   host.dataset.aspControlsVersion=model.version;host.dataset.aspLampTest=String(document.documentElement.dataset.lampVisualTest==='true');
   sizeControls(host);new ResizeObserver(()=>sizeControls(host)).observe(host);mounted.set(host.dataset.seat,host);
  }
  if(mounted.size===3){observer?.disconnect();return true;}return false;
 }
 function audit(){
  return [...mounted].map(([seat,host])=>{
   const r=host.getBoundingClientRect();
   const controls=[...host.querySelectorAll('.asp-photo-control')].map(b=>{
    const box=b.getBoundingClientRect(),expected={x:r.left+r.width*Number(b.dataset.cx)/1122,y:r.top+r.height*Number(b.dataset.cy)/888};
    return {kind:b.dataset.kind,channel:b.dataset.channel,errorCssPx:Math.hypot(box.left+box.width/2-expected.x,box.top+box.height/2-expected.y),roundnessCssPx:b.dataset.kind==='volume'?Math.abs(box.width-box.height):null};
   });return {seat,count:controls.length,controls};
  });
 }
 root.B737ASPControls=Object.freeze({version:model.version,audit});
 root.addEventListener('b737:cockpit-mounted',mount);
 root.addEventListener('b737:visual-test',e=>{for(const host of mounted.values())host.dataset.aspLampTest=String(e.detail?.active===true);});
 if(!mount()){observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});}
})(window);
