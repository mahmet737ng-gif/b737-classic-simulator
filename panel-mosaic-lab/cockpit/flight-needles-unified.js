(function(){
 'use strict';
 const model=window.B737FlightNeedlesModel,ns='http://www.w3.org/2000/svg';
 const state={captain:{},firstOfficer:{}};const blades={captain:{},firstOfficer:{}};const controls={captain:{},firstOfficer:{}};
 for(const station of Object.keys(state))for(const [key,def] of Object.entries(model.needles))state[station][key]=def.initialAngle;
 const images=Object.fromEntries(Object.entries(model.needles).map(([key,def])=>[key,new URL('./'+def.asset+'?v=FLN-0004',document.baseURI).href]));
 function svg(parent,tag,attrs={}){const el=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));parent.append(el);return el;}
 function paint(station,key){const blade=blades[station]?.[key],angle=state[station]?.[key];if(blade)blade.style.transform=`rotate(${angle}deg)`;const control=controls[station]?.[key];if(control){control.input.value=String(angle);control.output.textContent=`${angle}°`;}}
 function setAngle(station,key,value){if(!state[station]||!model.needles[key])throw Error('Unknown station or needle');const n=model.angle(value);state[station][key]=n;paint(station,key);return n;}
 function addNeedle(layer,station,key,gauge){
  const isRmi=key==='rmi1'||key==='rmi2';
  // Resize, but never redraw, the two photographed RMI assets. Both share the
  // physical pivot and touch the inner ends of the scale tick lines (not the numeral labels).
  const rmi=model.rmiRegistration;
  const rmiScale=(gauge.radius/rmi.sourceDialRadius)*rmi.placementScale;
  const group=isRmi
   ? svg(layer,'g',{transform:`translate(${gauge.x} ${gauge.y}) scale(${rmiScale})`})
   : svg(layer,'g',{transform:`translate(${gauge.x} ${gauge.y}) scale(${gauge.radius/229}) translate(-256 -256)`});
  const blade=svg(group,'g',{'data-flight-needle':key,'data-station':station});
  Object.assign(blade.style,{transformOrigin:isRmi?'0px 0px':'256px 256px',transition:'transform 320ms ease-out'});
  svg(blade,'image',isRmi?{href:images[key],x:-rmi.referencePivot.x,y:-rmi.referencePivot.y,width:rmi.sourceWidth,height:rmi.sourceHeight}:{href:images[key],x:0,y:0,width:512,height:512});
  blades[station][key]=blade;paint(station,key);
 }
 function mountPiece(source,station){const piece=document.querySelector(`.texture-piece[data-piece="${source.piece}"]`);if(!piece)return false;if(piece.querySelector('[data-flight-needles]'))return true;
  const layer=svg(piece,'svg',{'data-flight-needles':source.piece,viewBox:`0 0 ${source.width} ${source.height}`,preserveAspectRatio:'none',role:'img','aria-label':`${station} isolated instrument needles`});
  Object.assign(layer.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',overflow:'hidden',zIndex:'3'});
  for(const [gaugeName,gauge] of Object.entries(source.gauges)){const keys=gaugeName==='rmi'?['rmi2','rmi1']:[gaugeName];for(const key of keys)addNeedle(layer,station,key,gauge);
   // Do not add a synthetic RMI center cap: the photographed dial retains its own original hub.
   if(gaugeName!=='rmi')svg(layer,'circle',{cx:gauge.x,cy:gauge.y,r:source.piece==='captain'?9:5,fill:'#2b2b26'});
  }return true;
 }
 function mount(){mountPiece(model.sources.captain,'captain');mountPiece(model.sources.firstOfficerOuter,'firstOfficer');mountPiece(model.sources.firstOfficerInner,'firstOfficer');}
 function inspector(){const section=document.createElement('section');section.id='unifiedFlightNeedles';const heading=document.createElement('h2');heading.textContent='ALT · VSI · CLOCK · RMI NEEDLES';section.append(heading);
  const note=document.createElement('p');note.className='muted';note.textContent='فقط عقربه‌ها روی تصاویر اصلی قرار گرفته‌اند. زاویه‌ها تست تصویری‌اند و هنوز ورودی سیستم پرواز نیستند.';section.append(note);
  for(const station of ['captain','firstOfficer']){const label=document.createElement('h3');label.textContent=station==='captain'?'CAPTAIN':'FIRST OFFICER';section.append(label);
   for(const key of Object.keys(model.needles)){const row=document.createElement('label');row.style.display='block';row.style.direction='ltr';row.textContent=key==='rmi1'?'RMI 1 · thin dashed':key==='rmi2'?'RMI 2 · broad hollow':key;
    const input=document.createElement('input');Object.assign(input,{type:'range',min:'-180',max:'360',step:'1',value:String(state[station][key])});input.style.width='100%';const output=document.createElement('output');output.style.display='block';output.style.textAlign='left';input.addEventListener('input',()=>setAngle(station,key,input.value));row.append(input,output);section.append(row);controls[station][key]={input,output};paint(station,key);}
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت عقربه‌ها به موقعیت مرجع';reset.addEventListener('click',()=>{for(const station of Object.keys(state))for(const [key,def] of Object.entries(model.needles))setAngle(station,key,def.initialAngle);});section.append(reset);
  const previous=document.querySelector('#unifiedAirspeedPointers');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);
 }
 window.B737UnifiedFlightNeedles=Object.freeze({getAngles:()=>({captain:{...state.captain},firstOfficer:{...state.firstOfficer}}),setAngle});
 window.addEventListener('b737:flight-needle-angle',event=>{try{const {station,key,angle}=event.detail||{};setAngle(station,key,angle);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',mount);mount();if(document.querySelector('.inspector'))inspector();
})();
