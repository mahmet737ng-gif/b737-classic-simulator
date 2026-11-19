/* IRS-SYS-DSPL-0001 · Owner-approved L/R selector — VISUAL FRONTEND ONLY.
 * This is a separately cropped transparent image of the user's APPROVED top
 * view, not a redrawn or approximated alternative. The OH01–OH25 immutable
 * mosaic, original source image, keypad and OWNER18 protected guards remain untouched.
 * Hole measured on the ORIGINAL 1731 x 909 OH01–06 image: (471.27, 469.53).
 */
(function(root){
  'use strict';
  const centerSource=Object.freeze({x:471.27,y:469.53});
  const mapping=Object.freeze({sourceWidth:1731,sourceHeight:909,atlasWidth:2214,atlasHeight:1019,atlasOriginX:3,atlasOriginY:3});
  const toX=x=>mapping.atlasOriginX+x*mapping.atlasWidth/mapping.sourceWidth;
  const toY=y=>mapping.atlasOriginY+y*mapping.atlasHeight/mapping.sourceHeight;
  // 54 source-px diameter completely masks the original 30px black selector bore.
  const SIZE=Object.freeze({width:70.4,height:63.0});
  const position=Object.freeze({left:toX(centerSource.x)-SIZE.width/2,top:toY(centerSource.y)-SIZE.height/2,centerX:toX(centerSource.x),centerY:toY(centerSource.y)});
  const geometry=Object.freeze({source:centerSource,mapping,size:SIZE,position,sourceImage:'OH01-06-original-9d8ac0ac86bd.png',asset:'irs-sys-dspl-selector-approved-v1.avif',positions:Object.freeze(['L','R']),version:'IRS-SYS-DSPL-0001'});
  let state='L';
  let element=null;
  let tracking=null;
  let suppressClick=false;
  function emit(source){
    root.dispatchEvent(new CustomEvent('b737:irs-sys-dspl-visual-change',{
      detail:{selector:'SYS DSPL',system:state,source,frontendOnly:true}
    }));
  }
  function setSystem(next,source='visual-test'){
    if(next!=='L'&&next!=='R')throw new RangeError('SYS DSPL is L or R only');
    const changed=state!==next;
    state=next;
    if(element){
      element.dataset.system=state;
      const b=element.querySelector('.irs-sys-dspl-switch');
      if(b){
        b.setAttribute('aria-label','IRS SYS DSPL · '+state);
        b.setAttribute('aria-valuetext',state);
        b.setAttribute('title','IRS SYS DSPL: '+state+' (click, drag, wheel or arrow keys)');
      }
    }
    if(changed)emit(source);
    return state;
  }
  function setPointer(event){
    const button=event.currentTarget;
    if(event.button!==0&&event.pointerType==='mouse')return;
    tracking={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    if(typeof button.setPointerCapture==='function')button.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }
  function movePointer(event){
    if(!tracking||tracking.id!==event.pointerId)return;
    const delta=event.clientX-tracking.x;
    if(Math.abs(delta)>12){
      tracking.moved=true;
      setSystem(delta<0?'L':'R','drag');
    }
    event.stopPropagation();
  }
  function releasePointer(event){
    if(!tracking||tracking.id!==event.pointerId)return;
    if(tracking.moved)suppressClick=true;
    tracking=null;
    event.stopPropagation();
  }
  function mount(){
    const region=document.getElementById('region-overhead');
    if(!region)return null;
    const existing=region.querySelector('#irsSysDsplMounted');
    if(existing){
      element=existing;
      setSystem(state);
      return element;
    }
    element=document.createElement('div');
    element.id='irsSysDsplMounted';
    element.className='irs-sys-dspl-mount';
    element.dataset.version=geometry.version;
    element.dataset.backend='DISCONNECTED';
    Object.assign(element.style,{left:position.left+'px',top:position.top+'px',width:SIZE.width+'px',height:SIZE.height+'px'});
    const switchButton=document.createElement('button');
    switchButton.className='irs-sys-dspl-switch';
    switchButton.type='button';
    const photo=document.createElement('img');
    photo.className='irs-sys-dspl-approved-photo';
    photo.src='./assets/irs-sys-dspl-selector-approved-v1.avif';
    photo.alt='';
    photo.draggable=false;
    photo.setAttribute('aria-hidden','true');
    switchButton.append(photo);
    switchButton.addEventListener('pointerdown',setPointer);
    switchButton.addEventListener('pointermove',movePointer);
    switchButton.addEventListener('pointerup',releasePointer);
    switchButton.addEventListener('pointercancel',releasePointer);
    switchButton.addEventListener('click',event=>{
      event.stopPropagation();
      if(suppressClick){suppressClick=false;return;}
      setSystem(state==='L'?'R':'L','click');
    });
    switchButton.addEventListener('wheel',event=>{
      event.preventDefault();event.stopPropagation();
      setSystem(event.deltaY<0?'L':'R','wheel');
    },{passive:false});
    switchButton.addEventListener('keydown',event=>{
      const requested={
        ArrowLeft:'L',ArrowRight:'R',Home:'L',End:'R',l:'L',L:'L',r:'R',R:'R'
      }[event.key];
      if(requested){
        event.preventDefault();event.stopPropagation();setSystem(requested,'keyboard');
      }
    });
    element.append(switchButton);
    region.append(element);
    setSystem(state,'init');
    return element;
  }
  function boot(){
    if(mount())return;
    const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    root.addEventListener('b737:cockpit-mounted',mount);
  }
  root.B737IRSSysDspl=Object.freeze({mount,setSystem,getSystem:()=>state,geometry,getElement:()=>element});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})(window);
