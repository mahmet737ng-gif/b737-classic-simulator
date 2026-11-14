(function(){
 'use strict';
 const model=window.B737AirspeedPointersModel,ns='http://www.w3.org/2000/svg';
 const assets={airspeed:new URL('./'+model.pointers.airspeed.asset+'?v=ASP-0002',document.baseURI).href,vmoMmo:new URL('./'+model.pointers.vmoMmo.asset+'?v=ASP-0002',document.baseURI).href};
 const stations={captain:{airspeedKts:60,vmoMmoKts:340,blades:{},inputs:{},outputs:{}},firstOfficer:{airspeedKts:60,vmoMmoKts:340,blades:{},inputs:{},outputs:{}}};
 function svg(parent,tag,attrs={}){const el=document.createElementNS(ns,tag);for(const [name,value]of Object.entries(attrs))el.setAttribute(name,String(value));parent.append(el);return el;}
 function paint(station){const state=stations[station];if(!state)return;
  if(state.blades.airspeed)state.blades.airspeed.style.transform=`rotate(${model.bearing(state.airspeedKts,station)}deg)`;
  if(state.blades.vmoMmo)state.blades.vmoMmo.style.transform=`rotate(${model.vmoBearing(state.vmoMmoKts,station)}deg)`;
  for(const kind of ['airspeed','vmoMmo']){const value=state[kind+'Kts'];if(state.inputs[kind])state.inputs[kind].value=String(value);if(state.outputs[kind])state.outputs[kind].textContent=`${value} KT${kind==='vmoMmo'?' · visual limit':''}`;}
 }
 function setValue(kind,value,station){const n=model.speed(value);const targets=station?[station]:Object.keys(stations);for(const target of targets){if(!stations[target])throw Error('Unknown airspeed station');stations[target][kind+'Kts']=n;paint(target);}return n;}
 function setAirspeedKts(value,station){return setValue('airspeed',value,station);}
 function setVmoMmoKts(value,station){return setValue('vmoMmo',value,station);}
 function mountStation(station,pieceId,source,pivot,tipRadius,vmoTipRadius){
  const piece=document.querySelector(`.texture-piece[data-piece="${pieceId}"]`);if(!piece)return false;
  if(piece.querySelector(`[data-airspeed-pointers="${station}"]`))return true;
  const layer=svg(piece,'svg',{'data-airspeed-pointers':station,viewBox:`0 0 ${source.width} ${source.height}`,preserveAspectRatio:'none',role:'img','aria-label':`${station} independent airspeed and VMO MMO pointers`});
  Object.assign(layer.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',overflow:'hidden',zIndex:'2'});
  function pointer(def,src,id,radius){const assembly=svg(layer,'g',{transform:`translate(${pivot.x} ${pivot.y}) scale(${radius/def.assetTipRadius}) translate(-512 -512)`});const blade=svg(assembly,'g',{'data-airspeed-blade':id,'data-station':station});Object.assign(blade.style,{transformOrigin:'512px 512px',transition:'transform 320ms ease-out'});svg(blade,'image',{href:src,x:0,y:0,width:1024,height:1024});return blade;}
  stations[station].blades.vmoMmo=pointer(model.pointers.vmoMmo,assets.vmoMmo,'vmo-mmo',vmoTipRadius);
  stations[station].blades.airspeed=pointer(model.pointers.airspeed,assets.airspeed,'airspeed',tipRadius);
  svg(layer,'circle',{cx:pivot.x,cy:pivot.y,r:station==='captain'?26:12,fill:'#141511',stroke:'#33332e','stroke-width':station==='captain'?3:1.5});paint(station);return true;
 }
 function mount(){const captain=mountStation('captain',model.source.piece,model.source,model.pivot,model.pointers.airspeed.tipRadius,model.pointers.vmoMmo.tipRadius);
  const fo=model.firstOfficer;const firstOfficer=mountStation('firstOfficer',fo.piece,fo,fo.pivot,fo.tipRadius,fo.vmoTipRadius);return captain&&firstOfficer;}
 function controls(){const section=document.createElement('section');section.id='unifiedAirspeedPointers';const title=document.createElement('h2');title.textContent='AIRSPEED · VMO/MMO — CAPT / F/O';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='چهار نیدل مستقل روی دو گیج. موقعیت‌ها فعلاً تست تصویری‌اند و به دادهٔ واقعی پرواز متصل نیستند.';section.append(note);
  for(const station of ['captain','firstOfficer']){const heading=document.createElement('h3');heading.textContent=station==='captain'?'CAPTAIN':'FIRST OFFICER';section.append(heading);
   for(const [kind,labelText] of [['airspeed','Airspeed (KT)'],['vmoMmo','VMO/MMO visual marker (KT)']]){const label=document.createElement('label');label.textContent=labelText;label.style.display='block';label.style.direction='ltr';const input=document.createElement('input');Object.assign(input,{type:'range',min:'60',max:'400',step:'1',value:String(stations[station][kind+'Kts'])});input.style.width='100%';input.style.accentColor=kind==='vmoMmo'?'#c45c56':'#f2efe8';const output=document.createElement('output');output.style.display='block';output.style.direction='ltr';output.style.textAlign='left';input.addEventListener('input',()=>setValue(kind,Number(input.value),station));label.append(input,output);section.append(label);stations[station].inputs[kind]=input;stations[station].outputs[kind]=output;}}
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت هر دو سمت به وضعیت مرجع';reset.addEventListener('click',()=>{setAirspeedKts(model.pointers.airspeed.initialKts);setVmoMmoKts(model.pointers.vmoMmo.initialKts);});section.append(reset);
  const previous=document.querySelector('#unifiedOxygenPressureGauge');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);for(const station of Object.keys(stations))paint(station);
 }
 window.B737UnifiedAirspeedPointers=Object.freeze({getValues:(station)=>station?{airspeedKts:stations[station].airspeedKts,vmoMmoKts:stations[station].vmoMmoKts}:Object.fromEntries(Object.keys(stations).map(key=>[key,{airspeedKts:stations[key].airspeedKts,vmoMmoKts:stations[key].vmoMmoKts}])),setAirspeedKts,setVmoMmoKts});
 window.addEventListener('b737:airspeed-pointers-values',event=>{try{const detail=event.detail||{},station=detail.station;if(detail.airspeedKts!==undefined)setAirspeedKts(detail.airspeedKts,station);if(detail.vmoMmoKts!==undefined)setVmoMmoKts(detail.vmoMmoKts,station);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',mount);mount();if(document.querySelector('.inspector'))controls();
})();
