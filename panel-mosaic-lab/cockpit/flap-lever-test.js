(function(){
 'use strict';
 // Visual-only FLAP detent test: uses the owner-approved original BMP-extracted PNG.
 // No simulated flap state is changed by this overlay.
 const root=document;
 const byId=id=>root.getElementById(id);
 let config=null,selected=0,overlay=null,selector=null,status=null;
 function render(){
   if(!config||!overlay)return;
   const frame=config.image.frameWidth,scale=config.mount.scale;
   overlay.style.backgroundPosition=(-selected*frame*scale)+'px 0';
   const detent=config.detents[selected].value;
   if(selector)selector.value=String(selected);
   if(status)status.textContent='FLAP '+detent+(detent===0?' / UP':'');
   overlay.setAttribute('aria-label','B737 FLAP lever, detent '+detent+' degrees; original BMP frame');
   root.dispatchEvent(new CustomEvent('b737:flap-detent-visual-test',{detail:{index:selected,detent,visualOnly:true}}));
 }
 function step(delta){ selected=Math.max(0,Math.min(config.detents.length-1,selected+delta));render(); }
 function controls(){
   const toolbar=root.querySelector('.toolbar .tools:last-child');
   if(!toolbar)return;
   const group=root.createElement('div');group.id='flapTestControls';group.className='flap-test-controls';group.dir='ltr';
   const prev=root.createElement('button');prev.type='button';prev.textContent='◀';prev.title='Previous flap detent';prev.setAttribute('aria-label','Previous flap detent');
   selector=root.createElement('select');selector.id='flapDetentSelect';selector.setAttribute('aria-label','FLAP detent position');
   for(const d of config.detents){const opt=root.createElement('option');opt.value=String(d.index);opt.textContent='FLAP '+d.value;selector.append(opt);}
   const next=root.createElement('button');next.type='button';next.textContent='▶';next.title='Next flap detent';next.setAttribute('aria-label','Next flap detent');
   status=root.createElement('output');status.id='flapDetentStatus';status.setAttribute('aria-live','polite');
   const focusPedestal=()=>root.querySelector('[data-focus="pedestal"]')?.click();
   prev.addEventListener('click',()=>{step(-1);focusPedestal();});
   next.addEventListener('click',()=>{step(+1);focusPedestal();});
   selector.addEventListener('change',()=>{selected=Number(selector.value);render();focusPedestal();});
   group.append(prev,selector,next,status);toolbar.append(group);
 }
 async function mount(){
   try {
     const response=await fetch('./flap-lever-test.json',{cache:'no-store'});
     if(!response.ok)throw Error('Manifest HTTP '+response.status);
     config=await response.json();
     const values=[0,1,2,5,10,15,25,30,40];
     if(config.detents.length!==9||!values.every((v,i)=>config.detents[i].value===v))throw Error('FLAP detent registry invalid');
     const native=root.querySelector('#region-pedestal .region-native');
     const texture=root.querySelector('[data-piece="throttle-quadrant"]');
     if(!native||!texture)throw Error('Unified throttle quadrant not mounted');
     const img=new Image();
     img.src=config.source;
     await img.decode();
     if(img.naturalWidth!==2160||img.naturalHeight!==908)throw Error('Unrecognized FLAP sprite image dimensions');
     const {frameWidth,cropHeight,width,height}=config.image,scale=config.mount.scale;
     overlay=root.createElement('div');overlay.id='flapLeverBmpOverlay';overlay.className='flap-bmp-overlay';
     Object.assign(overlay.style,{
       left:config.mount.x+'px',top:config.mount.y+'px',
       width:frameWidth*scale+'px',height:cropHeight*scale+'px',
       backgroundImage:'url("'+config.source+'")',backgroundSize:(width*scale)+'px '+(height*scale)+'px'
     });
     overlay.setAttribute('role','img');native.append(overlay);
     controls();render();
     window.B737FlapVisualTest=Object.freeze({
       get position(){return config.detents[selected].value;},
       select(value){const idx=config.detents.findIndex(d=>d.value===Number(value));if(idx<0)throw Error('Unknown FLAP detent: '+value);selected=idx;render();},
       positions:Object.freeze(values)
     });
   } catch(err){
     console.error('B737 FLAP visual test could not load',err);
     const ui=root.querySelector('.view-caption');
     if(ui){const m=root.createElement('span');m.className='flap-test-error';m.textContent='FLAP sprite test error: '+err.message;ui.append(m);}
   }
 }
 window.addEventListener('b737:cockpit-mounted',mount,{once:true});
})();
