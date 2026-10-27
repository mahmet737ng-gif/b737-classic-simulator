/* Owner-supplied 18 guarded switches, no reconstructed guard hardware.
 * Renders eight approved photo masters with source-mapped placement + 0/-90/+90/180-degree rotation.
 * The original cockpit and overhead atlas images remain byte-identical.
 */
(function(){
'use strict';
const script=new URL(document.currentScript.src);
const manifestURL=new URL('./guard-owner18-v1.json',script);
const currentMode=document.getElementById('atlasAbsolute')?'overhead':'unified';
const STORE='B737-OWNER18-SWITCHES-20261027';
const mounted=new Map(),errors=[];
let config=null;
function saved(){try{return JSON.parse(sessionStorage.getItem(STORE)||'{}')}catch{return {}}}
const statuses=saved();
const css=(node,p)=>Object.assign(node.style,p);
function assetPath(c,position,closed){
 const map=config.imageFiles[c.color];
 const index=c.states.indexOf(position);
 const key=closed?'closed':(c.states.length===2?(index===0?'open_up':'open_down'):['open_up','open_center','open_down'][index]);
 return new URL(config.artworkRoot+'runtime/'+map[key],script).href;
}
function save(id,v){statuses[id]=v;try{sessionStorage.setItem(STORE,JSON.stringify(statuses))}catch{}}
function notify(c,status,action,previous=null,triggeredEffect=null){
 const detail={id:c.id,label:c.label,closed:status.closed,value:c.states[status.index],axis:c.axis,
  hinges:c.hinge,positions:c.states.slice(),source:'owner18-photo-v1',action,
  previousValue:previous?c.states[previous.index]:null,closeTarget:c.closePolicy.target,
  latchedEffects:{...status.effects},triggeredEffect};
 window.dispatchEvent(new CustomEvent('b737:guard-changed',{detail}));
 try{if(window.parent&&window.parent!==window)window.parent.dispatchEvent(new CustomEvent('b737:guard-changed',{detail}))}catch{}
}
function configure(c,box){
 const state=statuses[c.id];
 const policy=window.B737GuardClosePolicy;
 if(!policy)throw Error('Guard close policy module missing');
 let status=policy.initialState(c,state);
 const img=document.createElement('img');img.className='owner18-switch-photo';img.draggable=false;
 img.alt='';img.setAttribute('aria-hidden','true');
 const btn=document.createElement('button');btn.type='button';btn.className='owner18-guard-control';
 btn.dataset.guardId=c.id;btn.dataset.hinge=c.hinge;btn.dataset.color=c.color;
 btn.dataset.positions=String(c.states.length);btn.dataset.confidence=c.confidence;btn.dataset.provisional=String(c.hingeConfidence?.includes('UNCONFIRMED')||false);
 btn.setAttribute('title',c.label+' | '+c.states.join(' / ')+' | click to open / advance; double-click to close');
 btn.append(img);
 box.append(btn);
 function render(){
  const v=c.states[status.index];
  const path=assetPath(c,v,status.closed);
  if(img.src!==path)img.src=path;
  btn.dataset.value=v;btn.dataset.cover=status.closed?'closed':'open';
  btn.setAttribute('aria-label',c.label+' — '+v+' — cover '+(status.closed?'closed':'open'));
  btn.setAttribute('aria-pressed',String(!status.closed));
  save(c.id,status);
 }
 function change(action,detent){
  const r=policy.transition(c,status,action,detent);
  if(!r.accepted)return false;
  status=r.next;render();
  if(r.changed)notify(c,status,action,r.previous,r.triggeredEffect);
  return true;
 }
 btn.addEventListener('pointerdown',e=>{e.stopPropagation()});
 btn.addEventListener('pointerup',e=>{e.stopPropagation()});
 btn.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();change('close')});
 btn.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();change('close')});
 btn.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();change('close')}});
 btn.addEventListener('click',e=>{
   e.stopPropagation();e.preventDefault();if(e.detail>=2)return;change('cycle');
 });
 btn._set=(position,close)=>{
  if(!c.states.includes(position))throw Error('Invalid detent '+c.id+' / '+position);
  if(status.closed)change('open');
  if(!change('set',position))throw Error('Guard manipulation rejected '+c.id);
  if(close)change('close');
 };
 btn._state=()=>({value:c.states[status.index],closed:status.closed,
   closeTarget:c.closePolicy.target,effects:{...status.effects}});
 img.onerror=()=>{errors.push('image:'+c.id+':'+img.src);report()};
 render();
 mounted.set(c.id,btn);
 return btn;
}
function rotationFor(c){
 const angle=config.rules.rotateDegrees[c.hinge];
 if(!Number.isFinite(angle))throw Error('Unmapped guard hinge '+c.id+': '+c.hinge);
 return angle;
}
function resizeSprite(btn,w,h,angle){
 css(btn,{left:'0px',top:'0px',width:w+'px',height:h+'px'});
 const image=btn.firstElementChild;
 css(image,{width:(Math.abs(angle)===90?h:w)+'px',height:(Math.abs(angle)===90?w:h)+'px',
  transform:'translate(-50%, -50%) rotate('+angle+'deg)'});
}
function mainPlacement(c){
 const pieceId=c.panel==='FO_INNER_BACKGROUND'?'fo-inner':'pedestal-radio';
 const regionId=c.panel==='FO_INNER_BACKGROUND'?'main':'pedestal';
 const native=document.querySelector('#region-'+regionId+' .region-native');
 const piece=native?.querySelector('.texture-piece[data-piece="'+pieceId+'"]');
 if(!native||!piece)return false;
 const sizes=c.panel==='FO_INNER_BACKGROUND'?[918,1713]:[1122,1402];
 const rect=c.rectPx;let [x,y,w,h]=rect;
 const rx=piece.offsetWidth/sizes[0],ry=piece.offsetHeight/sizes[1];
 x=piece.offsetLeft+x*rx;y=piece.offsetTop+y*ry;
 w*=rx;h*=ry;
 const btn=configure(c,native);
 resizeSprite(btn,w,h,rotationFor(c));
 css(btn,{left:x+'px',top:y+'px'});
 return true;
}
let sourceLayout=null;
function overheadPlacement(c){
 const atlas=document.querySelector('#atlasAbsolute');
 const frame=atlas?.querySelector('.atlas-piece[data-key="'+c.panel+'"]');
 const windowEl=frame?.querySelector('.atlas-image-window');
 if(!sourceLayout||!windowEl||!window.B737OverheadToggleModel?.mapPoint)return false;
 const placement=sourceLayout.placements.find(x=>x.id===c.panel);
 if(!placement)return false;
 const map=(x,y)=>window.B737OverheadToggleModel.mapPoint({id:c.id,sourcePoint:[x,y],bezelSourceDiameter:0},placement);
 const [x,y,w,h]=c.rectPx;
 try{
  const a=map(x,y),b=map(x+w,y+h);
  const left=a.x-placement.x,top=a.y-placement.y;
  const btn=configure(c,windowEl);
  resizeSprite(btn,b.x-a.x,b.y-a.y,rotationFor(c));
  css(btn,{left:left+'px',top:top+'px'});
  return true;
 }catch(e){errors.push('map:'+c.id+':'+String(e));return false}
}
function report(){
 const intended=config?.controls.filter(c=>currentMode==='overhead'?!['FO_INNER_BACKGROUND','PEDESTAL_RADIO'].includes(c.panel):['FO_INNER_BACKGROUND','PEDESTAL_RADIO'].includes(c.panel))||[];
 const q={mode:currentMode,expected:intended.length,mounted:mounted.size,
  missing:intended.filter(c=>!mounted.has(c.id)).map(c=>c.id),
  errors:errors.slice(),isComplete:mounted.size===intended.length&&errors.length===0,
  masterImageFilesUnmodified:true};
 window.B737GuardOwner18={...q,inspect:()=>Object.fromEntries([...mounted].map(([id,node])=>[id,node._state()])),
  set:(id,value,close=false)=>{const node=mounted.get(id);if(!node)throw Error('Not mounted '+id);node._set(value,close);},
  refresh:()=>refresh()};
 document.documentElement.dataset.ownerGuardInstalled=String(q.mounted);
 document.documentElement.dataset.ownerGuardComplete=String(q.isComplete);
}
function refresh(){
 if(!config)return false;
 let all=true;
 for(const c of config.controls){
  const relevant=currentMode==='overhead'?!['FO_INNER_BACKGROUND','PEDESTAL_RADIO'].includes(c.panel):['FO_INNER_BACKGROUND','PEDESTAL_RADIO'].includes(c.panel);
  if(!relevant||mounted.has(c.id))continue;
  if(!(currentMode==='overhead'?overheadPlacement(c):mainPlacement(c)))all=false;
 }
 report();return all;
}
async function init(){
 try{
  const response=await fetch(manifestURL,{cache:'no-store'});if(!response.ok)throw Error('owner18 manifest unavailable');
  config=await response.json();
  if(config.controls.length!==18)throw Error('18 controls expected');
  window.B737GuardClosePolicy.validate(config.controls);
  if(currentMode==='overhead'){
   const r=await fetch(new URL('../all-overhead/atlas-layout.json',script));
   if(!r.ok)throw Error('atlas layout missing');sourceLayout=await r.json();
  }
  if(refresh())return;
  const observer=new MutationObserver(()=>{if(refresh())observer.disconnect()});
  observer.observe(document.body,{subtree:true,childList:true});
  window.addEventListener('b737:cockpit-mounted',refresh,{once:true});
 }catch(e){errors.push(String(e));report();console.error('Owner18 guarded switches:',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
