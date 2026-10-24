(function(){
 'use strict';
 const model=window.B737EngineStartLeverModel;
 const positions={engine1:'CUTOFF',engine2:'CUTOFF'};
 const controls=new Map();
 function position(device,next){
  if(!model.SLOTS[device]||!['CUTOFF','IDLE'].includes(next))throw Error('Unknown physical start lever state');
  positions[device]=next;
  const entry=controls.get(device);if(!entry)return;
  const {button,piece}=entry;
  const placement=model.placement(piece,device,next);
  Object.assign(button.style,{left:placement.left+'px',top:placement.top+'px',width:placement.width+'px',height:placement.height+'px'});
  button.dataset.position=next;button.setAttribute('aria-pressed',String(next==='IDLE'));
  button.setAttribute('aria-label','ENGINE '+model.SLOTS[device].label+' START LEVER · '+next+' · click for '+(next==='IDLE'?'CUTOFF':'IDLE'));
  button.title='ENGINE '+model.SLOTS[device].label+' START LEVER · '+next;
 }
 function request(device){
  const next=positions[device]==='CUTOFF'?'IDLE':'CUTOFF';
  const button=controls.get(device)?.button;if(button)button.dataset.pending='true';
  // The ISN-03 session alone decides whether IDLE is permitted at this N2.
  // No immediate optimistic lever movement is allowed on a rejected command.
  window.dispatchEvent(new CustomEvent('b737:engine-start-lever-command',{detail:{device,position:next,source:'PEDESTAL_PHYSICAL'}}));
  if(button)delete button.dataset.pending;
 }
 function mount(){
  const native=document.querySelector('#region-pedestal .region-native');
  const texture=native?.querySelector('[data-piece="throttle-quadrant"]');
  if(!texture||!native){console.error('ISN-03: throttle quadrant is not mounted');return;}
  const piece={x:texture.offsetLeft,y:texture.offsetTop,w:texture.offsetWidth,h:texture.offsetHeight};
  try{for(const device of ['engine1','engine2']){
   model.placement(piece,device,'CUTOFF');
   const button=document.createElement('button');button.type='button';button.className='engine-start-lever';
   button.dataset.device=device;button.innerHTML='<span class="lever-number"></span>';
   button.querySelector('span').textContent=model.SLOTS[device].label;
   button.addEventListener('pointerdown',event=>event.stopPropagation());
   button.addEventListener('click',event=>{event.stopPropagation();request(device);});
   native.append(button);controls.set(device,{button,piece});position(device,positions[device]);
  }}catch(error){console.error('ISN-03 pedestal lever registration:',error);}
 }
 window.addEventListener('b737:engine-start-lever-state',event=>{
  const feedback=event.detail?.levers;if(!feedback)return;
  for(const device of ['engine1','engine2'])if(['CUTOFF','IDLE'].includes(feedback[device]))position(device,feedback[device]);
 });
 window.addEventListener('b737:cockpit-mounted',mount,{once:true});
 window.B737EngineStartLevers=Object.freeze({getPosition:device=>positions[device],request,
  positions:Object.freeze(['CUTOFF','IDLE'])});
})();
