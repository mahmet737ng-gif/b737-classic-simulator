(async()=>{
;
/* ../../engine/instruments/mechanical-number-wheels-v1.js?v=MECH-ROLL-0020 */
try{
/* Continuous carry-driven mechanical drum digit phases.
 * Units roll with measured motion; tens/hundreds turn only at carry.
 * Stateless, deterministic, SVG/Canvas-independent.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737MechanicalNumberWheelsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='MECHANICAL_NUMBER_WHEELS_0001';
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function frames(value,digits,{carryStart=.82}={}){
  if(!Number.isFinite(value)||value<0||!Number.isInteger(digits)||digits<1||digits>6||
     !Number.isFinite(carryStart)||carryStart<.5||carryStart>=1)
    throw RangeError('MECHANICAL_DIGITS_SOURCE');
  const out=[];
  for(let i=0;i<digits;i++){
   const magnitude=10**(digits-i-1),scaled=value/magnitude,whole=Math.floor(scaled);
   const lower=scaled-whole;
   // For higher places use carry over the final fraction of lower digits.
   const fraction=magnitude===1?lower:clamp((lower-carryStart)/(1-carryStart),0,1);
   const digit=((whole%10)+10)%10;
   out.push({digit,next:(digit+1)%10,previous:(digit+9)%10,
    fraction,magnitude,digitPosition:i});
  }
  return out;
 }
 // Altimeters with 20 ft graduations: the low printed wheel advances
 // 00→20→40→60→80→00. Higher drums start their carry only during the FINAL
 // 20 ft before the next hundred/thousand, never 180 ft in advance.
 function framesTwenty(value,digits){
  if(!Number.isFinite(value)||value<0||!Number.isInteger(digits)||digits<3||digits>6)
   throw RangeError('MECHANICAL_20FT_SOURCE');
  const steps=Math.floor(value/20),phase=(value-steps*20)/20,shown=steps*20;
  return Array.from({length:digits},(_,i)=>{
   const magnitude=10**(digits-i-1);
   if(magnitude===1)return {digit:0,previous:0,next:0,fraction:0,magnitude,digitPosition:i};
   if(magnitude===10){
    const decade=steps%5;
    return {digit:decade*2,previous:((decade+4)%5)*2,
     next:((decade+1)%5)*2,fraction:phase,magnitude,digitPosition:i};
   }
   const whole=Math.floor(shown/magnitude),lower=value-whole*magnitude;
   const fraction=clamp((lower-(magnitude-20))/20,0,1);
   return {digit:whole%10,next:(whole+1)%10,previous:(whole+9)%10,
    fraction,magnitude,digitPosition:i};
  });
 }
 return Object.freeze({VERSION,frames,framesTwenty});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./instrument-lab/gauges.js?v=PHOTO-GAUGES-ALT20-0002-DOWN-0002 */
try{
(() => {
  'use strict';
  const labLink = document.getElementById('instrumentPhotoLabOpen');
  const assets = new URL(labLink?.getAttribute('href') || './', document.baseURI);
  const geometry = {"altimeter":{"size":[1117,1112],"pivot":[569,551],"parts":{"needle":{"box":[187,406,411,175],"origin":[382,145]},"alt-flag":{"box":[325,347,100,127]},"bug":{"box":[525,926,74,67],"origin":[44,-375]},"baro-knob":{"box":[68,869,184,184],"origin":[91.5,91.5]},"bug-knob":{"box":[865,866,189,191],"origin":[94.0,95.0]}}},"airspeed":{"size":[719,717],"pivot":[359,354],"parts":{"ias-needle":{"box":[335,102,49,277],"origin":[24,252]},"limit-needle":{"box":[103,316,241,44],"origin":[256,38]},"bug-1":{"box":[502,53,38,49],"origin":[-143,301]},"bug-2":{"box":[524,67,41,52],"origin":[-165,287]},"bug-3":{"box":[541,82,46,52],"origin":[-182,272]},"bug-4":{"box":[563,106,45,45],"origin":[-204,248]},"orange-1":{"box":[477,580,29,36],"origin":[-118,-226]},"orange-2":{"box":[493,573,29,34],"origin":[-134,-219]},"set-knob":{"box":[55,585,92,90],"origin":[45.5,44.5]}}},"rmi":{"size":[598,725],"pivot":[294,430],"parts":{"single-needle":{"box":[114,413,353,37],"origin":[180,17]},"double-needle":{"box":[203,279,180,303],"origin":[91,151]},"hub":{"box":[264,400,63,62]},"hdg-flag":{"box":[260,175,92,115]},"bearing-flag":{"box":[405,220,119,119]},"adf-inop":{"box":[273,732,319,50]},"card":{"box":[77,213,435,435]}}},"ivsi":{"size":[596,593],"pivot":[295,289],"parts":{"needle":{"box":[102,264,219,49],"origin":[193,25]},"off-flag":{"box":[329,268,111,46]}}},"standby":{"size":[1081,1067],"pivot":[503,381],"parts":{"needle":{"box":[475,166,56,360],"origin":[28,215]},"ias-stripes":{"box":[299,743,69,97]},"ias-tape-reference":{"box":[295,735,438,106]},"alt-stripes":{"box":[358,287,66,61]},"baro-knob":{"box":[75,827,176,177],"origin":[87.5,88.0]}}}};
  const ns = 'http://www.w3.org/2000/svg';
  let nextClipId=0;
  const defaults = Object.freeze({
    ias: 145, oat: null, cursor: 145, cursorManual: false, adf1: false, adf2: false, adfBearing1: 230, adfBearing2: 300, limit: 340, altitude: 2380, standbyAltitude: 2380,
    qnh: 1013.25, standbyQnh: 1013.25, vs: 0, hdg: 0, bearing1: 90, bearing2: 30,
    dme1: 12.4, dme2: 19.2, altitudeBug: 2500, bugs: [80, 95, 120, 145],
    orangeBugs: [160, 165], headingFlag: false, bearingFlag: false,
    ivsiOff: false, altFlag: false, airDataOff: false, adfInop: false
  });
  const STD = 1013.25;
  const INHG = 33.8638866667;
  const T0 = 288.15, lapse = 0.0065, tropopause = 11000;
  const exponent = 9.80665 / (287.05287 * lapse);
  const standardSound = Math.sqrt(1.4 * 287.05287 * T0);
  function pressureAt(feet) {
    const meters=feet*.3048;
    const t=T0-lapse*Math.min(meters,tropopause);
    return STD*(t/T0)**exponent*Math.exp(-9.80665*Math.max(0,meters-tropopause)/(287.05287*t));
  }
  function indicatedAltitude(pressureAltitude, qnh) {
    const ratio=pressureAt(pressureAltitude)/qnh;
    const tt=T0-lapse*tropopause;
    const tropRatio=(tt/T0)**exponent;
    const meters=ratio>=tropRatio ? (T0/lapse)*(1-ratio**(1/exponent)) :
      tropopause-287.05287*tt/9.80665*Math.log(ratio/tropRatio);
    return meters/.3048;
  }
  function airData(ias, pressureAltitude, oat) {
    const p=pressureAt(pressureAltitude);
    const impact=STD*((1+.2*(ias*.5144444444/standardSound)**2)**3.5-1);
    const mach=Math.sqrt(5*((1+impact/p)**(2/7)-1));
    const temperature=Number.isFinite(oat) ? oat+273.15 : T0-lapse*Math.min(tropopause,pressureAltitude*.3048);
    return {mach,tasKt:mach*Math.sqrt(1.4*287.05287*temperature)/.5144444444};
  }
  function calibratedSpeed(mach,pressureAltitude) {
    const impact=pressureAt(pressureAltitude)*((1+.2*mach**2)**3.5-1);
    return standardSound*Math.sqrt(5*((1+impact/STD)**(2/7)-1))/.5144444444;
  }
  const iasScale = [[60,0],[80,22],[100,52],[120,90],[140,120],[160,149],
    [180,167],[200,186],[250,229],[300,256],[350,282],[400,313]];
  const vsiScale = [[0,0],[500,31],[1000,61],[2000,103],[4000,151],[6000,180]];
  function interpolate(value, scale) {
    for (let i=1; i<scale.length; i++) {
      const [min, a] = scale[i-1], [max, b] = scale[i];
      if (value <= max) return a + (b-a) * Math.max(0, value-min) / (max-min);
    }
    return scale.at(-1)[1];
  }
  function svg(parent, tag, attrs) {
    const node = document.createElementNS(ns, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    parent.append(node);
    return node;
  }
  function setVisible(node, visible) {
    node.setAttribute('display', visible ? 'inline' : 'none');
  }
  function createGauge(host, kind, options = {}) {
    const def = geometry[kind];
    const [width,height] = def.size;
    const [cx,cy] = def.pivot;
    const canvas = svg(host,'svg',{viewBox:`0 0 ${width} ${height}`, role:'img',
      'aria-label':options.label || kind, 'data-gauge':kind});
    const image = (name, x, y, w, h) => {
      const href=new URL(kind+'/'+name+'.png',assets).href;
      const node=svg(canvas,'image',{x,y,width:w,height:h,'pointer-events':'none'});
      if(name==='face'&&options.fitPhoto&&window.B737ImageLoader?.assignPreview)
        window.B737ImageLoader.assignPreview(node,href,384);
      else node.setAttribute('href',href);
      return node;
    };
    image('face',0,0,width,height);
    const movable = svg(canvas,'g',{});
    const sprite = {};
    const offset = {altimeter:[356,825],airspeed:[149,412],rmi:[205,376],ivsi:[211,473],standby:[369,843]}[kind];
    const place = name => {
      const node = image(name,...def.parts[name].box);
      movable.append(node);
      sprite[name]=node;
      return node;
    };
    const rotate = (name,angle, centerX=cx, centerY=cy) =>
      sprite[name].setAttribute('transform',`rotate(${angle} ${centerX} ${centerY})`);
    const text = (x,y,size,fill='#f3f2ea') => svg(movable,'text',{
      x:x-offset[0],y:y-offset[1],fill,'font-size':size,'font-family':'Arial, sans-serif',
      'font-variant-numeric':'tabular-nums','text-anchor':'middle'
    });
    function rollingReadout(x,y,size,digits,fill='#f3f2ea'){
      const roller=window.B737MechanicalNumberWheelsV1;
      if(!roller)throw Error('MECHANICAL_WHEEL_ENGINE_MISSING');
      const baseX=x-offset[0],baseline=y-offset[1];
      const charWidth=size*.61,stride=size*1.045;
      const all=svg(movable,'g',{'data-rolling-digits':kind,
       'data-rolling-count':digits,'aria-label':kind+' rolling number'});
      const tracks=[];
      for(let i=0;i<digits;i++){
        const cx=baseX+(i-(digits-1)/2)*charWidth;
        const id='b737-wheel-'+(++nextClipId);
        const clipping=svg(svg(canvas,'defs',{}),'clipPath',{id});
        svg(clipping,'rect',{x:cx-charWidth/2-2,y:baseline-size*.86,
          width:charWidth+4,height:size*1.08});
        const clipped=svg(all,'g',{'clip-path':'url(#'+id+')'});
        const moving=svg(clipped,'g',{'data-rolling-column':i});
        const glyphs=[];
        for(const relative of [-1,0,1]){
          const node=svg(moving,'text',{x:cx,y:baseline+relative*stride,
            fill,'font-size':size,'font-family':'Arial, sans-serif',
            'font-variant-numeric':'tabular-nums','text-anchor':'middle'});
          glyphs.push(node);
        }
        tracks.push({moving,glyphs});
      }
      return {element:all,set(value,visible=true){
        setVisible(all,visible);
        if(!visible||!Number.isFinite(value))return;
        const frames=(kind==='altimeter'||kind==='standby')?
         roller.framesTwenty(Math.max(0,value),digits):roller.frames(Math.max(0,value),digits);
        frames.forEach((f,i)=>{
          const t=tracks[i];
          // Increasing altitude/IAS moves the printed digit strip DOWN.
          // Next numeral enters from ABOVE; previous remains BELOW.
          // 20-ft altitude carry still originates in framesTwenty().
          t.glyphs[0].textContent=String(f.next);
          t.glyphs[1].textContent=String(f.digit);
          t.glyphs[2].textContent=String(f.previous);
          t.moving.setAttribute('transform','translate(0 '+(f.fraction*stride)+')');
        });
      }};
    }
    const pressure = (x1,x2,y,size) => [text(x1,y,size),text(x2,y,size)];
    function baro(nodes,qnh) {
      nodes[0].textContent=Math.round(qnh);
      nodes[1].textContent=(qnh*0.029529983).toFixed(2);
    }
    const altitudeText = value => Math.round(value/20)*20;
    let state, update;
    const change = (key,value) => options.onChange?.(key,value);
    const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
    function control(x,y,w,h,label, onClick, onTurn, onPosition) {
      const hit=svg(movable,'rect',{x,y,width:w,height:h,rx:5,fill:'transparent',
        tabindex:0,role:onClick&&!onTurn?'button':'slider','aria-label':label});
      Object.assign(hit.style,{pointerEvents:'all',touchAction:'none',cursor:onClick?'pointer':'grab'});
      let drag;
      hit.addEventListener('pointerdown',event=>{
        if(event.button!==0) return;
        event.stopPropagation();
        hit.setPointerCapture(event.pointerId);
        drag={x:event.clientX,y:event.clientY,moved:false};
      });
      hit.addEventListener('pointermove',event=>{
        if(!drag) return;
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
        if(Math.hypot(dx,dy)<4) return;
        drag.moved=true;
        if(onPosition) onPosition(event);
        else onTurn?.(Math.trunc((Math.abs(dx)>Math.abs(dy)?dx:-dy)/4),event);
        drag.x=event.clientX; drag.y=event.clientY;
      });
      hit.addEventListener('pointerup',event=>{
        if(!drag) return;
        event.stopPropagation();
        if(!drag.moved) onClick?.();
        drag=null;
      });
      hit.addEventListener('lostpointercapture',()=>{drag=null;});
      hit.addEventListener('wheel',event=>{
        if(!onTurn) return;
        event.preventDefault(); event.stopPropagation();
        onTurn(Math.sign(-event.deltaY),event);
      },{passive:false});
      hit.addEventListener('keydown',event=>{
        if(['Enter',' '].includes(event.key)&&onClick){event.preventDefault();onClick();}
        if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key)&&onTurn){
          event.preventDefault();onTurn(['ArrowLeft','ArrowDown'].includes(event.key)?-1:1,event);
        }
      });
      return hit;
    }
    const knob=(name,label,onTurn,onClick) => control(...def.parts[name].box,label,onClick,onTurn);
    function baroTurn(key) {
      return (delta,event)=>change(key,clamp(state[key]+delta*(event.shiftKey ? INHG/100 : 1),870,1085));
    }
    function jumpBug(key,index,value) {
      change(key,state[key].map((old,i)=>i===index?clamp(Math.round(value),60,400):old));
    }
    const inverseScale=iasScale.map(([speed,angle])=>[angle,speed]);
    const angleFromPointer=event=>{
      const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(canvas.getScreenCTM().inverse());
      return (Math.atan2(point.x-cx,cy-point.y)*180/Math.PI+360)%360;
    };
    function bugControl(name,key,index) {
      const [x,y,w,h]=def.parts[name].box;
      return control(x-8,y-8,w+16,h+16,name,undefined,
        delta=>jumpBug(key,index,state[key][index]+delta),
        event=>{const a=angleFromPointer(event);jumpBug(key,index,a>336?60:interpolate(a,inverseScale));});
    }
    switch(kind) {
      case 'altimeter': {
        const alt4=rollingReadout(1000,1299,155,4);
        const alt5=rollingReadout(948,1299,145,5);
        const caution = text(930,1280,90,'#ffb744');
        const neg = text(750,1277,67);
        caution.textContent='OFF'; neg.textContent='NEG';
        const qnh = pressure(783,1046,1601,62);
        ['alt-flag','bug','needle','baro-knob','bug-knob'].forEach(place);
        if(options.onChange){
          knob('baro-knob','BARO',baroTurn('qnh'));
          knob('bug-knob','Altitude reference',d=>change('altitudeBug',clamp(state.altitudeBug+d*20,0,45000)));
        }
        update = s => {
          const altitude=indicatedAltitude(s.altitude,s.qnh);
          const small=altitude>=0&&altitude<10000;
          const digits=Math.abs(altitude);
          const useFive=digits>=10000;
          alt4.set(Math.min(digits,9999.999),!s.altFlag&&!useFive);
          alt5.set(Math.min(digits,99999.999),!s.altFlag&&useFive);
          setVisible(caution,s.altFlag);
          setVisible(neg,!s.altFlag&&altitude<0);

          setVisible(sprite['alt-flag'],!s.altFlag&&small);
          setVisible(sprite.needle,!s.altFlag);
          baro(qnh,s.qnh);
          rotate('needle',(s.altitudeAngle ?? altitude*0.36)-290);
          rotate('bug',s.altitudeBug*0.36-180);
          rotate('baro-knob',(s.qnh-1013)*6,161,961);
          rotate('bug-knob',s.altitudeBug*.1,959,961);
        };
        break;
      }
      case 'airspeed': {
        const mach=text(504,682,41),ias=rollingReadout(504,893,49,3,'#b4f77a');
        const bugNames=['bug-1','bug-2','bug-3','bug-4'], oranges=['orange-1','orange-2'];
        [...bugNames,...oranges,'limit-needle','ias-needle','set-knob'].forEach(place);
        const cursor=svg(movable,'path',{d:`M ${cx-13} ${cy-251} l 13 -18 l 13 18 l -13 19 Z`,fill:'#f5f3e7',stroke:'#202327','stroke-width':3});
        const manual=svg(movable,'text',{x:143,y:662,fill:'#ffcc79','font-size':16});
        manual.textContent='MAN';
        const hit={};
        if(options.onChange){
          const editableBugs=options.lockOrangeBugs===true?bugNames:[...bugNames,...oranges];
          editableBugs.forEach((name,i)=>{
            hit[name]=bugControl(name,i<4?'bugs':'orangeBugs',i<4?i:i-4);
          });
          knob('set-knob','Pull to set airspeed cursor',d=>{
            if(state.cursorManual) change('cursor',clamp(Math.round(state.cursor)+d,60,400));
          },()=>options.onChange('cursorManual',!state.cursorManual,state.autoCursor??state.cursor));
        }
        update=s=>{
          const air=airData(s.ias,s.altitude,s.oat);
          mach.textContent=s.airDataOff||air.mach<.4?'':Math.min(.99,air.mach).toFixed(2).slice(1);
          cursor.setAttribute('transform',`rotate(${interpolate(s.cursorManual?s.cursor:(s.autoCursor??s.cursor),iasScale)} ${cx} ${cy})`);
          setVisible(manual,s.cursorManual);
          ias.set(Math.max(0,Math.min(s.ias,999.999)),!s.airDataOff&&s.ias>45);
          setVisible(sprite['ias-needle'],!s.airDataOff);
          rotate('ias-needle',interpolate(s.ias,iasScale));
          rotate('set-knob',(s.cursor-145)*3,100,630);
          sprite['set-knob'].setAttribute('transform',(s.cursorManual?'translate(0 5) ':'')+sprite['set-knob'].getAttribute('transform'));
          rotate('limit-needle',interpolate(s.limit,iasScale)-276);
          [...bugNames,...oranges].forEach((name,i)=>{
            const speed=i<4?s.bugs?.[i]:s.orangeBugs?.[i-4];
            setVisible(sprite[name],Number.isFinite(speed));
            if(Number.isFinite(speed))
              rotate(name,interpolate(speed,iasScale)-[30,35,40,46,152,148][i]);
            hit[name]?.setAttribute('transform',sprite[name].getAttribute('transform'));
          });
        };
        break;
      }
      case 'ivsi': {
        ['needle','off-flag'].forEach(place);
        update=s=>{
          setVisible(sprite['off-flag'],s.ivsiOff);
          rotate('needle',s.ivsiOff ? 0 : (s.vsiAngle!==undefined ? s.vsiAngle+90 : Math.sign(s.vs)*interpolate(Math.abs(s.vs),vsiScale)));
        };
        break;
      }
      case 'rmi': {
        const dme = [[],[]];
        for (const [i, xs] of [[0,[296,345,395,445]],[1,[550,600,650,700]]]) {
          dme[i] = xs.map((x,j)=>text(x,539,49,j===3?'#191d25':'#fff9e4'));
        }
        ['card','double-needle','single-needle','hub','hdg-flag','bearing-flag'].forEach(place);
        const placard=image('adf-inop',240,660,166,26);
        movable.append(placard);
        const selectors=[[78,564,56,43,45],[507,564,56,43,-45]].map(([x,y,w,h,angle],i)=>{
          const key='adf'+(i+1);
          const label=svg(movable,'text',{x,y:y+5,transform:`rotate(${angle} ${x} ${y})`,'text-anchor':'middle','font-size':18,fill:'#fff'});
          if(options.onChange) control(x-55,y+19,w+45,h+55,'VOR/ADF '+(i+1),()=>change(key,!state[key]));
          return label;
        });
        update=s=>{
          selectors.forEach((label,i)=>label.textContent=s['adf'+(i+1)]?'ADF':'VOR');
          rotate('card',-s.hdg);
          rotate('single-needle',s.adf1 ? s.adfBearing1-s.hdg-90 : (s.bearingAngle1 ?? s.bearing1-s.hdg-90));
          rotate('double-needle',s.adf2 ? s.adfBearing2-s.hdg-30 : (s.bearingAngle2 ?? s.bearing2-s.hdg-30));
          setVisible(sprite['hdg-flag'],s.headingFlag);
          setVisible(sprite['bearing-flag'],s.bearingFlag);
          setVisible(placard,s.adfInop);
          setVisible(sprite['double-needle'],!s.bearingFlag&&(!s.adf2||!s.adfInop)&&Number.isFinite(s.adf2?s.adfBearing2:s.bearing2));
          setVisible(sprite['single-needle'],(!s.adf1||!s.adfInop)&&Number.isFinite(s.adf1?s.adfBearing1:s.bearing1));
          [s.dme1,s.dme2].forEach((value,i)=>{
            const chars=Number.isFinite(value)?Math.round(value*10).toString().padStart(4,'0').slice(-4):'––––';
            dme[i].forEach((node,j)=>{node.textContent=chars[j];});
          });
        };
        break;
      }
      case 'standby': {
        const alt4=rollingReadout(883,1186,64,4);
        const alt5=rollingReadout(875,1186,61,5);
        const qnh = pressure(608,1169,1418,61);
        const clipId = 'b737-standby-tape-'+(++nextClipId);
        const clip = svg(svg(canvas,'defs',{}),'clipPath',{id:clipId});
        svg(clip,'rect',{x:0,y:0,width:438,height:103});
        const tape = svg(movable,'g',{transform:'translate(295 734)'});
        const viewport = svg(tape,'g',{'clip-path':'url(#'+clipId+')'});
        const ticks = svg(viewport,'g',{});
        for (let speed=0; speed<=430; speed+=10) {
          if (speed>0 && speed<60) continue;
          const major=speed%20===0;
          const x = speed===0 ? 0 : 4.2*(speed-60)+68;
          svg(ticks,'line',{x1:x,x2:x,y1:major?53:77,y2:102,stroke:'#eee','stroke-width':major?6:3});
          if (major) svg(ticks,'text',{x,y:47,fill:'#fff','font-size':46,'font-family':'Arial','text-anchor':'middle'}).textContent=speed;
        }
        ['ias-stripes','alt-stripes','needle','baro-knob'].forEach(place);
        viewport.append(sprite['ias-stripes']);
        sprite['ias-stripes'].setAttribute('x',0);
        sprite['ias-stripes'].setAttribute('y',7);
        ticks.prepend(sprite['ias-stripes']);
        sprite['ias-stripes'].setAttribute('x',-222);
        if(options.onChange) knob('baro-knob','Standby BARO',baroTurn('standbyQnh'));
        update=s=>{
          const altitude=indicatedAltitude(s.standbyAltitude,s.standbyQnh);
          alt4.set(Math.abs(altitude),Math.abs(altitude)<10000);
          alt5.set(Math.abs(altitude),Math.abs(altitude)>=10000);
          setVisible(sprite['alt-stripes'],altitude>=0&&altitude<10000);
          baro(qnh,s.standbyQnh);
          rotate('needle',altitude*0.36);
          rotate('baro-knob',(s.standbyQnh-1013)*6,162,915);
          const travel = s.ias<60 ? s.ias*68/60 : 68+4.2*(s.ias-60);
          ticks.setAttribute('transform',`translate(${224-travel} 0)`);

        };
        break;
      }
    }
    const render = (sample, raw = false) => {
      state=sample;
      update(state);
      setVisible(movable,!raw);
    };
    render(defaults,true);
    return {canvas,render};
  }
  window.B737PhotoGauges = {createGauge,defaults,geometry,airData,calibratedSpeed,indicatedAltitude};
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./instrument-lab/photo-gauge-registration-v1.js?v=PHOTO-GAUGE-REG-0002-NATIVE-BEZEL */
try{
/* PHOTO-GAUGE-REGISTRATION-0002-NATIVE-BEZEL — exact photo-source coordinate spaces.
 * Mount a photo gauge on the visible native photo, never an EIS piece hidden
 * by the F/O conventional owner plate. All positions are image SOURCE pixels:
 * the existing assembly and FO proportional-scale engine own final transforms.
 * No guessed viewport-pixel coordinates or one-sided CSS aspect corrections.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737PhotoGaugeRegistrationV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='PHOTO-GAUGE-REGISTRATION-0002-NATIVE-BEZEL';
 const ref=Object.freeze({airspeed:304,altimeter:456,ivsi:240,rmi:213});
 const kinds=Object.freeze(['airspeed','altimeter','ivsi','rmi']);
 const layouts=Object.freeze({
  EIS:Object.freeze({
   captain:Object.freeze({
    // Calibrated to the original 3942 x 3591 cockpit photo bezel,
    // not to the legacy airspeed needle's 328px tip-radius.
    airspeed:['captain',3942,3591,1108,973,340],
    altimeter:['captain',3942,3591,3082,980,249],
    ivsi:['captain',3942,3591,3080,1610,248],
    rmi:['captain',3942,3591,1183,1838,223]
   }),
   firstOfficer:Object.freeze({
    airspeed:['fo-inner',918,1713,741,577,145],
    altimeter:['fo-outer',1123,1400,618,343,106],
    ivsi:['fo-outer',1123,1400,619,611,102],
    // F/O RMI original photographed housing is ~281 native source px
    // across; 128 was a NEEDLE radius and enlarged its 598x725 face
    // to ~359px, physically colliding with the ASI/DME face above.
    rmi:['fo-inner',918,1713,771,954,100]
   })
  }),
  CONVENTIONAL:Object.freeze({
   firstOfficer:Object.freeze({
    // Owner-calibrated F/O source photo (2026-10-30) — same original
    // pivot reference used by the protected FO owner/needles modules.
    airspeed:['fo-owner',1286,1223,310,422,100],
    altimeter:['fo-owner',1286,1223,933,405,86],
    ivsi:['fo-owner',1286,1223,932,605,86],
    rmi:['fo-owner',1286,1223,330,714,73]
   })
  })
 });
 const modeOf=doc=>doc?.documentElement?.dataset?.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
 function get(mode,station,kind){
  if(!['EIS','CONVENTIONAL'].includes(mode))throw Error('UNKNOWN_GAUGE_MODE');
  if(!['captain','firstOfficer'].includes(station)||!kinds.includes(kind))throw Error('UNKNOWN_GAUGE_TARGET');
  const seatLayout=layouts[mode][station]||
   (mode==='CONVENTIONAL'&&station==='captain'?layouts.EIS.captain:null);
  const a=seatLayout?.[kind];
  if(!a)throw Error('UNREGISTERED_PHOTO_GAUGE');
  const [piece,width,height,x,y,radius]=a;
  return Object.freeze({mode,station,kind,piece,width,height,x,y,radius,
   anchor:mode==='CONVENTIONAL'&&station==='firstOfficer'?'OWNER_20261030':'SOURCE_IMAGE'});
 }
 function selector(entry){
  return entry.piece==='fo-owner'?'#fo-owner-panel-v1':
   '.texture-piece[data-piece="'+entry.piece+'"]';
 }
 function rectangle(entry,photoGeometry){
  if(!entry||!photoGeometry)throw Error('MISSING_GAUGE_LAYOUT');
  const {size,pivot}=photoGeometry,ratio=entry.radius/ref[entry.kind];
  if(!Array.isArray(size)||!Array.isArray(pivot)||!Number.isFinite(ratio)||ratio<=0)
   throw Error('INVALID_PHOTO_GAUGE_GEOMETRY');
  const x=entry.x-pivot[0]*ratio,y=entry.y-pivot[1]*ratio;
  const width=size[0]*ratio,height=size[1]*ratio;
  if([x,y,width,height].some(v=>!Number.isFinite(v))||width<=0||height<=0)
   throw Error('INVALID_PHOTO_GAUGE_RECT');
  // An inner-panel photographic RMI bezel extends across the panel seam
  // in the old renderer. The overlay cannot paint on the neighboring EHSI
  // glass or other owner's texture. Clip in *native source photo* space,
  // leaving the needle pivot and accepted aircraft reference untouched.
  const clip=Object.freeze({
   left:100*Math.max(0,-x)/width,top:100*Math.max(0,-y)/height,
   right:100*Math.max(0,x+width-entry.width)/width,
   bottom:100*Math.max(0,y+height-entry.height)/height
  });
  return Object.freeze({x,y,width,height,
   left:100*x/entry.width,top:100*y/entry.height,
   widthPct:100*width/entry.width,heightPct:100*height/entry.height,
   centerX:entry.x,centerY:entry.y,clip});
 }
 return Object.freeze({VERSION,ref,kinds,layouts,modeOf,get,selector,rectangle});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./instrument-lab/unified.js?v=PHOTO-GAUGES-0005-FIT-SOURCES */
try{
(() => {
  'use strict';
  const photos=window.B737PhotoGauges;
  const airspeed=window.B737AirspeedPointersModel;
  const registration=window.B737PhotoGaugeRegistrationV1;
  if(!photos||!airspeed||!registration)return;
  const stations=['captain','firstOfficer'];
  const gauges=new Map();
  const settings={captain:{},firstOfficer:{},standby:{}};
  let standby, queued=false;
  function change(station,key,value,initial){
    if(key==='cursorManual'&&value) settings[station].cursor=initial;
    settings[station][key]=value;
    repaint();
  }
  function mountGauge(station,kind,mode){
    const key=station+':'+kind;
    const entry=registration.get(mode,station,kind);
    const host=document.querySelector(registration.selector(entry));
    const original=gauges.get(key);
    // The EIS outer photo is deliberately hidden in Conventional mode.
    // Never retain its overlay instead of painting on the visible owner photo.
    if(!host){
      if(original){original.canvas.remove();gauges.delete(key);}
      return false;
    }
    const rect=registration.rectangle(entry,photos.geometry[kind]);
    let gauge=original;
    if(!gauge||gauge.canvas.parentNode!==host){
      gauge?.canvas.remove();
      gauge=photos.createGauge(host,kind,{
        label:station+' '+kind,fitPhoto:true,
        lockOrangeBugs:kind==='airspeed',
        onChange:(...args)=>change(station,...args)
      });
      gauges.set(key,gauge);
    }
    Object.assign(gauge.canvas.style,{
      position:'absolute',
      left:rect.left.toFixed(7)+'%',top:rect.top.toFixed(7)+'%',
      width:rect.widthPct.toFixed(7)+'%',height:rect.heightPct.toFixed(7)+'%',
      overflow:'visible',pointerEvents:'none',zIndex:'4'
    });
    gauge.canvas.setAttribute('preserveAspectRatio','xMidYMid meet');
    const clip=rect.clip;
    gauge.canvas.style.clipPath='inset('+[
      clip.top,clip.right,clip.bottom,clip.left
    ].map(n=>n.toFixed(5)+'%').join(' ')+')';
    gauge.canvas.dataset.gaugeRegistration=registration.VERSION;
    gauge.canvas.dataset.gaugePiece=entry.piece;
    gauge.canvas.dataset.gaugeMode=mode;
    gauge.canvas.dataset.gaugeCenter=entry.x+','+entry.y;
    gauge.canvas.dataset.gaugeSource=entry.anchor;
    if(kind==='airspeed')
      host.querySelectorAll('[data-airspeed-pointers]').forEach(layer=>{
        layer.setAttribute('display','none');
        layer.setAttribute('aria-hidden','true');
      });
    const oldKind={altimeter:['altimeter'],ivsi:['verticalSpeed'],rmi:['rmi1','rmi2']}[kind]||[];
    for(const old of oldKind)
      host.querySelectorAll('[data-flight-needle="'+old+'"]').forEach(n=>n.setAttribute('display','none'));
    return true;
  }
  let lastMode=null;
  function mount(){
    const mode=registration.modeOf(document);
    for(const station of stations)
      for(const kind of registration.kinds)
        mountGauge(station,kind,mode);
    lastMode=mode;
    const slot=document.querySelector('.flight-gauge-bridge .flight-standby-row');
    if(slot && standby?.canvas.parentNode!==slot){
      standby=photos.createGauge(slot,'standby',{label:'Standby altimeter and IAS',fitPhoto:true,onChange:(...args)=>change('standby',...args)});
      standby.canvas.classList.add('flight-standby-dial');
      standby.canvas.style.cssText='width:clamp(110px,23vw,190px);height:auto';
      slot.querySelector('svg:not([data-gauge])')?.remove();
      const heading=slot.querySelector('strong');
      const copy=slot.querySelector('p');
      if(heading) heading.textContent='STANDBY ALT / IAS';
      if(copy) copy.textContent='Flight Scenario training data';
      slot.prepend(standby.canvas);
    }
    repaint();
  }
  function repaint(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      const source=window.B737UnifiedFlightDisplayMotionV1?.sample?.();
      const original=window.B737UnifiedFlightGaugeBridgeV1?.getState()?.sample;
      const live=source?{
        indicatedSpeedKt:source.iasKt,altitudeFt:source.altitudeFt,
        standbyAltitudeFt:source.altitudeFt,verticalSpeedFpm:source.vsFpm
       }:original;
      const scene=source|| (live?window.B737UnifiedFlightScenarioV1?.getState?.():null);
      const needles=window.B737UnifiedFlightNeedles?.getAngles?.();
      const speeds=window.B737UnifiedAirspeedPointers?.getValues?.();
      const snapshot=window.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
      const mcp=snapshot?.['mcp.state']?.quality==='VALID'?
        snapshot['mcp.state'].value:null;
      const fmc=snapshot?.['fmc.computed']?.value;
      const valid=(topic)=>snapshot?.[topic]?.quality==='VALID'?snapshot[topic].value:null;
      const base={...photos.defaults, ias:0, mach:0, altitude:0, standbyAltitude:0,
        altitudeBug:500, dme1:null, dme2:null, ivsiOff:false,
        bugs:[85,92,100,107],orangeBugs:[null,null]};
      for(const station of stations){
        const angles=needles?.[station];
        const speedsForStation=speeds?.[station];
        const nav=window.B737UnifiedEfisSources?.project(station==='captain'?'CAPT':'FO',snapshot);
        const hdg=nav?.heading??scene?.headingMagDeg??0;
        const bearing=n=>nav?.bearings?.find(x=>x.channel===n)?.angle??null;
        const adc=valid('airdata.adc'+(station==='captain'?1:2));
        const adf=n=>{
          const signal=valid('navigation.adf'+n);
          if(!Number.isFinite(signal?.bearingDeg)) return null;
          if(signal.bearingReference==='RELATIVE') return hdg+signal.bearingDeg;
          if(signal.bearingReference==='TRUE') return Number.isFinite(nav?.magneticVariationDeg) ?
            signal.bearingDeg-nav.magneticVariationDeg : null;
          return signal.bearingDeg;
        };
        const altitude=live?.altitudeFt??adc?.pressureAltitudeFt??0;
        const selectedCas=mcp?.powered===true&&mcp.speedBlank!==true?
          (mcp.speedDisplayMode==='MACH'&&Number.isFinite(mcp.selectedMachHundredths)?
           photos.calibratedSpeed(mcp.selectedMachHundredths/100,altitude):
           mcp.speedDisplayMode==='IAS'?mcp.selectedSpeedKt:null):null;
        const state={...base,...settings[station],
          orangeBugs:Number.isFinite(selectedCas)?[selectedCas,selectedCas]:[null,null],
          ias:live?.indicatedSpeedKt??adc?.casKt??speedsForStation?.airspeedKts??0,
          limit:speedsForStation?.vmoMmoKts??base.limit,
          altitude,
          vs:live?.verticalSpeedFpm??0,
          autoCursor:Number.isFinite(selectedCas)?selectedCas:fmc?.targets?.speedKt,
          oat:adc?.satC??scene?.oatC??null,hdg,
          bearing1:bearing(1),bearing2:bearing(2),
          adfBearing1:adf(1),adfBearing2:adf(2),
          dme1:valid('navigation.dme1')?.distanceNm??null,dme2:valid('navigation.dme2')?.distanceNm??null

        };
        gauges.get(station+':airspeed')?.render(state);
        gauges.get(station+':altimeter')?.render(state);
        gauges.get(station+':ivsi')?.render({...state,
          vsiAngle:live?undefined:angles?.verticalSpeed});
        gauges.get(station+':rmi')?.render(state);
      }
      standby?.render({...base,...settings.standby,ias:live?.indicatedSpeedKt??0,standbyAltitude:live?.standbyAltitudeFt??0});
    });
  }
  for(const name of ['b737:flight-presentation-frame',
    'b737:photo-needle-update','b737:photo-airspeed-update',
    'b737:standby-altimeter-sample','b737:flight-scenario-stopped','b737:mcp-afds-state','b737:avionics-data']){
    window.addEventListener(name,repaint);
  }
  // Owner F/O image and mode transforms mount in an animation frame.
  // The second frame is event-driven and handles an asynchronously created
  // owner photo without polling or changing any accepted photo layers.
  let mountQueued=false;
  function scheduleMount(){
    if(mountQueued)return;
    mountQueued=true;
    requestAnimationFrame(()=>{
      mountQueued=false;
      mount();
      requestAnimationFrame(()=>{
        const mode=registration.modeOf(document);
        const expected=mode==='CONVENTIONAL'?'fo-owner':'fo-inner';
        if(gauges.get('firstOfficer:airspeed')?.canvas?.dataset.gaugePiece!==expected)mount();
      });
    });
  }
  for(const event of ['b737:cockpit-mounted','b737:engine-indication-view',
    'b737:aircraft-profile-change'])window.addEventListener(event,scheduleMount);
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',scheduleMount,{once:true});
  else scheduleMount();
  window.B737UnifiedPhotoGaugeBridgeV1=Object.freeze({
    getPlacements:()=>Object.fromEntries([...gauges].map(([key,g])=>[key,{
      piece:g.canvas.dataset.gaugePiece,
      mode:g.canvas.dataset.gaugeMode,
      center:g.canvas.dataset.gaugeCenter,
      source:g.canvas.dataset.gaugeSource,
      connected:g.canvas.isConnected
    }])),
    getMcpSelectedCas:()=>{
      const mcp=window.B737UnifiedAvionicsNetworkV1?.getSnapshot?.()?.['mcp.state']?.value;
      if(mcp?.powered!==true||mcp.speedBlank===true)return null;
      if(mcp.speedDisplayMode==='IAS')return Number.isFinite(mcp.selectedSpeedKt)?mcp.selectedSpeedKt:null;
      const alt=window.B737UnifiedFlightDisplayMotionV1?.sample?.()?.altitudeFt??0;
      return mcp.speedDisplayMode==='MACH'&&Number.isFinite(mcp.selectedMachHundredths)?
       photos.calibratedSpeed(mcp.selectedMachHundredths/100,alt):null;
    }
  });
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/tcas/classic-tcas-v1.js?v=TCAS-CLASSIC-0001 */
try{
/* Scripted TCAS II 7.1 instructor model, not DO-185B collision-avoidance logic.
 * FCOM SHI 10.30.12-13, 10.32.29-34, 15.20.29-32; EUROCONTROL ACAS Guide 5.0.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B737ClassicTcasV1=api;})(globalThis,function(){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),norm=x=>(x%360+360)%360;
 const RA=Object.freeze({
  CLIMB:{callout:'CLIMB, CLIMB',min:1500,max:null},
  DESCEND:{callout:'DESCEND, DESCEND',min:null,max:-1500},
  INCREASE_CLIMB:{callout:'INCREASE CLIMB, INCREASE CLIMB',min:2500,max:null,subsequent:true},
  INCREASE_DESCENT:{callout:'INCREASE DESCENT, INCREASE DESCENT',min:null,max:-2500,subsequent:true},
  REVERSAL_CLIMB:{callout:'CLIMB, CLIMB NOW, CLIMB, CLIMB NOW',min:1500,max:null,subsequent:true},
  REVERSAL_DESCEND:{callout:'DESCEND, DESCEND NOW, DESCEND, DESCEND NOW',min:null,max:-1500,subsequent:true},
  CROSSING_CLIMB:{callout:'CLIMB, CROSSING CLIMB, CLIMB, CROSSING CLIMB',min:1500,max:null},
  CROSSING_DESCEND:{callout:'DESCEND, CROSSING DESCEND, DESCEND, CROSSING DESCEND',min:null,max:-1500},
  LEVEL_OFF_CLIMB:{callout:'LEVEL OFF, LEVEL OFF',min:null,max:0},
  LEVEL_OFF_DESCENT:{callout:'LEVEL OFF, LEVEL OFF',min:0,max:null},
  MONITOR_CLIMB:{callout:'MONITOR VERTICAL SPEED',min:null,max:0,preventive:true},
  MONITOR_DESCENT:{callout:'MONITOR VERTICAL SPEED',min:0,max:null,preventive:true},
  MAINTAIN_CLIMB:{callout:'MAINTAIN VERTICAL SPEED, MAINTAIN',min:1500,max:null,maintain:true},
  MAINTAIN_DESCENT:{callout:'MAINTAIN VERTICAL SPEED, MAINTAIN',min:null,max:-1500,maintain:true},
  CROSSING_MAINTAIN_CLIMB:{callout:'MAINTAIN VERTICAL SPEED, CROSSING MAINTAIN',min:1500,max:null,maintain:true},
  CROSSING_MAINTAIN_DESCENT:{callout:'MAINTAIN VERTICAL SPEED, CROSSING MAINTAIN',min:null,max:-1500,maintain:true},
  MULTI_LEVEL:{callout:'LEVEL OFF, LEVEL OFF',min:-250,max:250}
 });
 const def=(label,ra,next=null,flags={})=>({label,ra,next,...flags});
 const SCENARIOS=Object.freeze({
  TA_ONLY:def('TA only / passing traffic',null),
  CLIMB:def('TA > CLIMB > LEVEL OFF','CLIMB','LEVEL_OFF_CLIMB'),
  DESCEND:def('TA > DESCEND > LEVEL OFF','DESCEND','LEVEL_OFF_DESCENT'),
  INCREASE_CLIMB:def('CLIMB > INCREASE CLIMB','CLIMB','INCREASE_CLIMB'),
  INCREASE_DESCENT:def('DESCEND > INCREASE DESCENT','DESCEND','INCREASE_DESCENT'),
  REVERSAL_CLIMB:def('DESCEND > CLIMB NOW (reversal)','DESCEND','REVERSAL_CLIMB'),
  REVERSAL_DESCEND:def('CLIMB > DESCEND NOW (reversal)','CLIMB','REVERSAL_DESCEND'),
  CROSSING_CLIMB:def('Altitude crossing climb','CROSSING_CLIMB'),
  CROSSING_DESCEND:def('Altitude crossing descent','CROSSING_DESCEND'),
  LEVEL_OFF_CLIMB:def('LEVEL OFF while climbing','LEVEL_OFF_CLIMB'),
  LEVEL_OFF_DESCENT:def('LEVEL OFF while descending','LEVEL_OFF_DESCENT'),
  MONITOR_CLIMB:def('Preventive: do not climb','MONITOR_CLIMB'),
  MONITOR_DESCENT:def('Preventive: do not descend','MONITOR_DESCENT'),
  MAINTAIN_CLIMB:def('Maintain climb (>=1500 fpm)','MAINTAIN_CLIMB'),
  MAINTAIN_DESCENT:def('Maintain descent (<=-1500 fpm)','MAINTAIN_DESCENT'),
  CROSSING_MAINTAIN_CLIMB:def('Maintain crossing climb','CROSSING_MAINTAIN_CLIMB'),
  CROSSING_MAINTAIN_DESCENT:def('Maintain crossing descent','CROSSING_MAINTAIN_DESCENT'),
  MULTI_THREAT:def('Multiple threats / level-off corridor','MULTI_LEVEL',null,{multi:true}),
  NO_BEARING:def('No-bearing threat','CLIMB',null,{noBearing:true}),
  OFFSCALE:def('Offscale threat','CLIMB',null,{offscale:true}),
  NO_ALTITUDE:def('Non-altitude-reporting traffic (TA only)',null,null,{noAltitude:true})
 });
 function thresholds(own,mode='TA_RA'){
  const a=Number.isFinite(own.pressureAltitudeFt)?own.pressureAltitudeFt:own.altitudeFt,h=own.radioAltitudeFt;
  if(mode==='TA_ONLY'||h<1000)return {sl:2,taSec:20,raSec:null,taNm:.30,raNm:null,taFt:850,raFt:null,alimFt:null};
  const row=h<2350?[3,25,15,.33,.20,850,600,300]:a<5000?[4,30,20,.48,.35,850,600,300]:
   a<10000?[5,40,25,.75,.55,850,600,350]:a<20000?[6,45,30,1,.8,850,600,400]:
   a<42000?[7,48,35,1.3,1.1,850,700,600]:[7,48,35,1.3,1.1,1200,800,700];
  const [sl,taSec,raSec,taNm,raNm,taFt,raFt,alimFt]=row;return {sl,taSec,raSec,taNm,raNm,taFt,raFt,alimFt};
 }
 function gates(own,mode='TA_RA',priorityWarning=false){
  const height=own?.radioAltitudeFt;
  const valid=own?.airborne===true&&Number.isFinite(height)&&Number.isFinite(own.altitudeFt)&&Number.isFinite(own.tasKt)&&own.tasKt>0&&Number.isFinite(own.pitchDeg)&&Number.isFinite(own.vsFpm);
  const reasons=[];
  if(!valid)reasons.push('AIRBORNE FLIGHT / RADIO ALTITUDE REQUIRED');
  if(priorityWarning)reasons.push('GPWS / WINDSHEAR PRIORITY');
  if(height<1000)reasons.push('RA INHIBIT BELOW 1000 FT RA');
  if(mode==='TA_ONLY')reasons.push('TA ONLY SELECTED');
  return {valid,raAllowed:valid&&height>=1000&&mode==='TA_RA'&&!priorityWarning,
   voiceAllowed:valid&&height>=500&&!priorityWarning,
   descendAllowed:height>=1100,increaseDescentAllowed:height>=1500,
   effectiveMode:mode==='TA_RA'&&valid&&height<1000?'TA_ONLY':mode,reasons};
 }
 function pitchForVs(vs,own){
  // Training flight-path-to-pitch conversion retains observed pitch/AoA.
  const speed=Math.max(own.tasKt*6076.11549/60,1);
  const gamma=v=>Math.asin(clamp(v/speed,-.7,.7))*180/Math.PI;
  return clamp(own.pitchDeg+gamma(vs)-gamma(own.vsFpm),-35,35);
 }
 function guidance(id,own){
  const raw=RA[id];if(!raw)return null;
  const r={...raw,id};
  if(raw.maintain){
   if(id.includes('CLIMB'))r.min=Math.max(1500,own.vsFpm-250);
   else r.max=Math.min(-1500,own.vsFpm+250);
  }
  r.avoid=[];
  if(r.min!==null)r.avoid.push({side:'BELOW',pitchDeg:pitchForVs(r.min,own)});
  if(r.max!==null)r.avoid.push({side:'ABOVE',pitchDeg:pitchForVs(r.max,own)});
  return r;
 }
 function evaluate({scenario='CLIMB',elapsedSec=0,own,mode='TA_RA',priorityWarning=false,powered=true}={}){
  if(!SCENARIOS[scenario])throw RangeError('UNKNOWN_TCAS_SCENARIO');
  const g=gates(own,mode,priorityWarning),spec=SCENARIOS[scenario];
  const out={schema:'B737_CLASSIC_TCAS_OUTPUT_V1',version:'7.1',source:'SCRIPTED_INSTRUCTOR_ENCOUNTER',
   mode:powered?g.effectiveMode:'FAIL',altitudeSource:Number.isFinite(own?.pressureAltitudeFt)?'PRESSURE_ALTITUDE':'SCENARIO_MSL_SURROGATE',stage:'OFF',advisory:null,ra:null,targets:[],callout:null,
   voiceAllowed:g.voiceAllowed&&powered,inhibits:[...g.reasons],thresholds:g.valid?thresholds(own,g.effectiveMode):null,complete:false};
  if(!powered||!g.valid||['OFF','FAIL'].includes(mode))return out;
  if(mode==='TEST')return {...out,stage:'TEST',targets:[
   {kind:'RA',bearing:own.trueHeadingDeg-10,distance:2,relativeAltitude:-200,verticalRate:1000},
   {kind:'TA',bearing:own.trueHeadingDeg+10,distance:3,relativeAltitude:200,verticalRate:-1000},
   {kind:'PROX',bearing:own.trueHeadingDeg+20,distance:4,relativeAltitude:500,verticalRate:0},
   {kind:'OTHER',bearing:own.trueHeadingDeg-20,distance:5,relativeAltitude:1500,verticalRate:0}]};
  const taDuration=Math.max(10,out.thresholds.taSec-(out.thresholds.raSec??10));
  const first=3+taDuration,change=first+7,end=first+18,clear=end+5;
  let kind=elapsedSec<3?'OTHER':elapsedSec<first?'TA':elapsedSec<end&&spec.ra?'RA':elapsedSec<end?'TA':'PROX';
  let id=kind==='RA'?(elapsedSec>=change&&spec.next?spec.next:spec.ra):null;
  if(kind==='RA'&&!g.raAllowed){kind='TA';id=null;}
  if(id&&RA[id].max!==null&&RA[id].max<0&&!g.descendAllowed){kind='TA';id=null;out.inhibits.push('DESCEND INHIBIT BELOW 1100 FT RA');}
  if(id==='INCREASE_DESCENT'&&!g.increaseDescentAllowed){id='DESCEND';out.inhibits.push('INCREASE DESCENT INHIBIT BELOW 1500 FT RA');}
  if(id&&RA[id].maintain&&((id.includes('CLIMB')&&own.vsFpm<1500)||(id.includes('DESCENT')&&own.vsFpm> -1500))){
   id=id.includes('CLIMB')?'CLIMB':'DESCEND';out.inhibits.push('MAINTAIN REQUIRES EXISTING VERTICAL RATE');
  }
  if(spec.noAltitude&&own.altitudeFt>=15500){kind='OTHER';id=null;out.inhibits.push('NON-ALTITUDE TRAFFIC TA INHIBIT AT / ABOVE FL155');}
  if(priorityWarning){kind='PROX';id=null;}
  out.stage=elapsedSec>=end?'CLEAR':kind;out.complete=elapsedSec>=clear;
  out.advisory=kind==='RA'?'RA':kind==='TA'?'TA':null;
  out.ra=id?guidance(id,own):null;
  out.callout=elapsedSec>=end&&spec.ra?'CLEAR OF CONFLICT':out.ra?.callout??(kind==='TA'?'TRAFFIC, TRAFFIC':null);
  const below=spec.ra&&(/CLIMB/.test(spec.ra))?-200:200;
  const target={kind,bearing:spec.noBearing?null:norm((own.trueTrackDeg??own.trueHeadingDeg)+15),
   distance:spec.offscale?Math.max(45,90-elapsedSec):Math.max(.4,(out.thresholds.taSec+3-elapsedSec)*.12),
   relativeAltitude:spec.noAltitude?null:below,verticalRate:spec.noAltitude?null:below<0?800:-800};
  if(kind==='OTHER'&&target.distance<=6&&Math.abs(target.relativeAltitude??Infinity)<=1200){target.kind='PROX';out.stage='PROX';}
  if(!out.complete){out.targets=[target];if(spec.multi)out.targets.push({...target,bearing:norm(target.bearing-30),relativeAltitude:-below});}
  return out;
 }
 return Object.freeze({RA,SCENARIOS,thresholds,gates,pitchForVs,guidance,evaluate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/tcas/classic-tcas-v2.js?v=TCAS-MOTION-0002 */
try{
/* Classic TCAS encounter plant. Sources: owner's FCOM SHI 10.30/10.32,
 * 11.10.27-33, SP.11.1, 15.10.19-26, 15.20.29-32; MRG CL pp136,173,188,373.
 * Nominal 40/25s warning model and pitch conversion are instructor approximations.
 * No external ACAS threshold table, DO-185 implementation or WDM is claimed. */
(function(root,factory){const api=factory(root.B737ClassicTcasV1||(typeof require==='function'?require('./classic-tcas-v1.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.B737ClassicTcasV2=api;})(globalThis,function(V1){
 'use strict';
 const norm=n=>(n%360+360)%360,rad=n=>n*Math.PI/180,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const copy=x=>JSON.parse(JSON.stringify(x));
 const DEFAULT_FEEDS=Object.freeze({xpdr1:true,xpdr2:true,adc1:true,adc2:true,radioAlt:true,irs:true,aligned:true,computer:true});
 const MODES=['STBY','ALT_OFF','ALT_ON','TA_ONLY','TA_RA','TEST'];
 const legacy=Object.fromEntries(Object.entries(V1.SCENARIOS).map(([id,s])=>[id,{...s,label:s.label,vertical:'LEVEL'}]));
 const SCENARIOS=Object.freeze({...legacy,
  CLIMB:{...legacy.CLIMB,label:'TA > CLIMB > CLEAR OF CONFLICT'},
  DESCEND:{...legacy.DESCEND,label:'TA > DESCEND > CLEAR OF CONFLICT'},
  SAME_LEVEL:{label:'Same level / zero vertical rate',ra:'CLIMB',vertical:'LEVEL',relativeAltitude:0},
  CONVERGING_ABOVE:{label:'Above / descending toward own altitude',ra:'DESCEND',vertical:'CONVERGING',relativeAltitude:900},
  CONVERGING_BELOW:{label:'Below / climbing toward own altitude',ra:'CLIMB',vertical:'CONVERGING',relativeAltitude:-900},
  DIVERGING_ABOVE:{label:'Above / climbing away',ra:null,vertical:'DIVERGING',relativeAltitude:900},
  DIVERGING_BELOW:{label:'Below / descending away',ra:null,vertical:'DIVERGING',relativeAltitude:-900},
  NO_TRANSPONDER:{label:'Intruder transponder OFF / invisible',ra:null,noTransponder:true},
  INVALID_RA:{label:'MRG suppression-interface failure / own echo',ra:null,invalidRa:true},
  DISPLAY_TYPES:{label:'Traffic symbol / altitude / trend demonstration',ra:null,demo:true}
 });
 function controls(){return {mode:'TA_RA',unit:1,altSource:1,code:'2000',filter:'NORM',rangeNm:5,identUntil:0,absoluteUntil:0,
  failures:{computer:false,xpdr1:false,xpdr2:false,antenna:false,adc1:false,adc2:false,radioAlt:false,irs:false,suppression1:false,suppression2:false},priorityWarning:false};}
 function transponder(c,own,feeds=DEFAULT_FEEDS){
  if(!MODES.includes(c.mode)||![1,2].includes(c.unit)||![1,2].includes(c.altSource))throw RangeError('TRANSPONDER_SELECTION');
  if(!/^[0-7]{4}$/.test(c.code))throw RangeError('SQUAWK_REQUIRES_FOUR_OCTAL_DIGITS');
  const f=c.failures||{},power=feeds['xpdr'+c.unit]===true,failed=f['xpdr'+c.unit]===true||!power;
  const adc=feeds['adc'+c.altSource]===true&&f['adc'+c.altSource]!==true;
  const enabled=c.mode!=='STBY'&&!failed;
  const surveillance=['TA_ONLY','TA_RA'].includes(c.mode)&&enabled&&!f.computer&&!f.antenna&&feeds.computer===true;
  const altitudeReporting=enabled&&adc&&!['ALT_OFF','TEST'].includes(c.mode)&&own.airborne===true;
  return {selectedUnit:c.unit,altitudeSource:c.altSource,code:c.code,displayedCode:c.mode==='TEST'&&power?'8888':c.code,mode:c.mode,powered:power,failed,
   modeS:enabled,modeAC:enabled&&own.airborne===true,altitudeReporting,altitudeValid:adc,
   transmittedAltitudeFt:altitudeReporting?(own.pressureAltitudeFt??own.altitudeFt):null,
   surveillance,raCapable:surveillance&&adc&&c.mode==='TA_RA',
   ident:(own.elapsedSec??0)<c.identUntil,absolute:(own.elapsedSec??0)<c.absoluteUntil,
   test:c.mode==='TEST',atcFailLight:failed||c.mode==='TEST'};
 }
 function vector(speed,heading){return {n:Math.cos(rad(heading))*speed/3600,e:Math.sin(rad(heading))*speed/3600};}
 function offset(anchor,own){
  return Number.isFinite(anchor.lat)&&Number.isFinite(own.lat)&&Number.isFinite(anchor.lon)&&Number.isFinite(own.lon)?
   {n:(own.lat-anchor.lat)*60,e:(own.lon-anchor.lon)*60*Math.cos(rad(anchor.lat))}:{n:0,e:0};
 }
 function create(id,own,options={}){
  const spec=SCENARIOS[id];if(!spec)throw RangeError('UNKNOWN_TCAS_SCENARIO');
  for(const [key,value] of Object.entries(options)){
   if(key==='converging'||key==='progressive'){if(typeof value!=='boolean')throw RangeError('INVALID_INTRUDER_'+key);continue;}
   if(key==='lateralSide'){if(!['LEFT','RIGHT'].includes(value))throw RangeError('INVALID_INTRUDER_lateralSide');continue;}
   if(!Number.isFinite(value))throw RangeError('INVALID_INTRUDER_'+key);
  }
  if(options.distanceNm!==undefined&&options.distanceNm<=0)throw RangeError('INVALID_INTRUDER_DISTANCE');
  const heading=own.trueTrackDeg??own.trueHeadingDeg??0,forward=vector(1,heading),side=vector(1,heading+90);
  const converging=options.converging===true&&id!=='TA_ONLY';
  // Lab-only sequence: choose a physically intersecting relative trajectory at
  // cruise while keeping the alert thresholds untouched.  A crossing aircraft
  // with a similar GS gives an initial OTHER -> PROX -> TA -> RA progression.
  // Passing traffic remains a lateral near miss even if CONVERGING was checked.
  const stagedProgression=options.progressive===true&&!spec.demo&&!spec.offscale;
  const progressive=stagedProgression&&!converging;
  const range=options.distanceNm??(stagedProgression?8.2:5.5);
  // Converging traffic flies across the OWN flight path, arriving from the
  // chosen left/right side at horizontal CPA. Its relative altitude crosses
  // from -300 to +300 ft (or reverse) during the approach without manual VS.
  // A passing-traffic TA is an actual lateral near-miss: inside the TA
  // distance envelope, outside the RA envelope. Do not suppress RA solely
  // because of a scenario label; an explicit CONVERGING override may still
  // generate a genuine RA.
  const limits=V1.thresholds(own,'TA_RA');
  const passingMiss=(limits.taNm+limits.raNm)/2;
  const lateral=id==='TA_ONLY'&&!converging?passingMiss:(spec.ra===null?.72:0);
  let speedKt=options.speedKt??(progressive?(own.gsKt??own.tasKt):220);
  let targetHeading=norm(heading+(progressive?40:180));
  let initialN=forward.n*3600*range+side.n*3600*lateral;
  let initialE=forward.e*3600*range+side.e*3600*lateral;
  let estimatedCpaSec=range*3600/Math.max(1,(own.gsKt??own.tasKt)+speedKt);
  if(progressive){
   const ownV=vector(own.gsKt??own.tasKt,heading),intruderV=vector(speedKt,targetHeading);
   const relN=intruderV.n-ownV.n,relE=intruderV.e-ownV.e;
   const relSpeed=Math.max(1e-6,Math.hypot(relN,relE));
   estimatedCpaSec=range/relSpeed;
   initialN=-relN*estimatedCpaSec-relE/relSpeed*lateral;
   initialE=-relE*estimatedCpaSec+relN/relSpeed*lateral;
  }
  if(converging){
   // At cruise a shallow real crossing with matched GS gives an early
   // WHITE -> PROX -> TA -> RA trajectory instead of an immediate red alert.
   const crossingAngle=stagedProgression?40:90;
   targetHeading=norm(heading+(options.lateralSide==='LEFT'?crossingAngle:-crossingAngle));
   if(stagedProgression&&options.speedKt===undefined)speedKt=own.gsKt??own.tasKt;
   const ownV=vector(own.gsKt??own.tasKt,heading),intruderV=vector(speedKt,targetHeading);
   const relN=intruderV.n-ownV.n,relE=intruderV.e-ownV.e;
   estimatedCpaSec=range/Math.max(1e-6,Math.hypot(relN,relE));
   initialN=-relN*estimatedCpaSec;
   initialE=-relE*estimatedCpaSec;
  }
  const sense=spec.ra?.includes('CLIMB')?1:spec.ra?.includes('DESCEN')?-1:
   spec.vertical==='CONVERGING'&&spec.relativeAltitude>0?-1:1;
  const relative=options.relativeAltitudeFt??(converging?-(stagedProgression?600:300)*sense:
   spec.relativeAltitude??(spec.ra?.includes('CLIMB')?-200:200));
  let rate=options.verticalRateFpm??(converging?
   (own.vsFpm??0)-2*relative*60/estimatedCpaSec:
   spec.vertical==='CONVERGING'?-Math.sign(relative)*1200:
   spec.vertical==='DIVERGING'?Math.sign(relative)*1200:0);
  const target={id:'INTRUDER1',n:initialN,e:initialE,
   altitudeFt:own.altitudeFt+relative,speedKt,headingDeg:targetHeading,verticalRate:rate,
   reportsAltitude:!spec.noAltitude,transponder:!spec.noTransponder,bearingValid:!spec.noBearing};
  if(spec.offscale){target.n=Math.cos(rad(heading+45))*range;target.e=Math.sin(rad(heading+45))*range;target.headingDeg=norm(heading+270);target.speedKt=own.gsKt??own.tasKt;}
  const targets=[target];if(spec.multi)targets.push({...target,id:'INTRUDER2',altitudeFt:own.altitudeFt-relative,n:target.n+.4,e:target.e-.4});
  if(spec.demo){targets.splice(0,1,...[
   {id:'OTHER',distance:7,relative:1800,vr:0,angle:-22},{id:'PROX',distance:5,relative:-1000,vr:-700,angle:22},
   {id:'TA',distance:3,relative:500,vr:0,angle:-12},{id:'RA',distance:1.6,relative:-500,vr:800,angle:12}
  ].map(x=>({...target,id:x.id,n:Math.cos(rad(heading+x.angle))*x.distance,e:Math.sin(rad(heading+x.angle))*x.distance,
   altitudeFt:own.altitudeFt+x.relative,verticalRate:x.vr,demoKind:x.id,speedKt:0})));}
  return {schema:'B737_CLASSIC_TCAS_ENCOUNTER_V2',scenario:id,anchor:{lat:own.lat,lon:own.lon},targets,time:0,
   ownN:0,ownE:0,firstRaTime:null,raId:null,raTargetIds:[],hadRA:false,clearTime:0,cleared:false,maneuvered:false,output:null};
 }
 function geometry(state,t,own){
  const p=offset(state.anchor,own),ov=vector(own.gsKt??own.tasKt,own.trueTrackDeg??own.trueHeadingDeg),iv=vector(t.speedKt,t.headingDeg);
  const n=t.n-p.n-state.ownN,e=t.e-p.e-state.ownE,distance=Math.hypot(n,e),vn=iv.n-ov.n,ve=iv.e-ov.e;
  const vv=vn*vn+ve*ve,dot=n*vn+e*ve,tcpa=vv>1e-10?-dot/vv:Infinity;
  const cpaTime=Number.isFinite(tcpa)?Math.max(0,tcpa):0;
  const miss=Math.hypot(n+vn*cpaTime,e+ve*cpaTime);
  const relative=t.altitudeFt-own.altitudeFt,relativeRate=t.verticalRate-own.vsFpm;
  return {id:t.id,bearing:t.bearingValid?norm(Math.atan2(e,n)*180/Math.PI):null,distance,
   relativeAltitude:t.reportsAltitude?relative:null,absoluteAltitudeFt:t.reportsAltitude?t.altitudeFt:null,
   verticalRate:t.reportsAltitude?t.verticalRate:null,relativeVerticalRate:t.reportsAltitude?relativeRate:null,
   verticalRelation:Math.abs(relativeRate)<1?'LEVEL_RATE':relative*relativeRate<0?'CONVERGING':'DIVERGING',
   tcpaSec:tcpa,missDistanceNm:miss,relativeSpeedKt:Math.sqrt(vv)*3600,
   closingKt:distance>.0001?-dot/distance*3600:0,
   predictedSeparationFt:t.reportsAltitude?Math.abs(relative+relativeRate*cpaTime/60):null};
 }
 // Simultaneous future horizontal/vertical protected-volume approach
 // under constant relative velocity. Not a certified TCAS II algorithm.
 function trajectoryIntersection(g,radiusNm,verticalFt){
  if(!Number.isFinite(radiusNm)||radiusNm<=0)return {timeSec:Infinity,reason:'INVALID_THRESHOLD'};
  const speed=g.relativeSpeedKt/3600;
  let hEnter=0,hExit=Infinity;
  if(speed<1e-8){
   if(g.distance>radiusNm)return {timeSec:Infinity,reason:'HORIZONTAL_MISS'};
  }else{
   const perp=Math.sqrt(Math.max(0,g.distance*g.distance-(speed*g.tcpaSec)**2));
   if(perp>radiusNm)return {timeSec:Infinity,reason:'HORIZONTAL_MISS'};
   const dt=Math.sqrt(Math.max(0,radiusNm*radiusNm-perp*perp))/speed;
   hEnter=Math.max(0,g.tcpaSec-dt);hExit=g.tcpaSec+dt;
   if(hExit<0||hExit<hEnter)return {timeSec:Infinity,reason:'HORIZONTAL_PASSED'};
  }
  if(g.relativeAltitude===null||verticalFt===null)
   return {timeSec:hEnter,exitSec:hExit,reason:'HORIZONTAL_ONLY'};
  const alt=g.relativeAltitude,rate=g.relativeVerticalRate/60;
  let vEnter=0,vExit=Infinity;
  if(Math.abs(rate)<1e-8){
   if(Math.abs(alt)>verticalFt)return {timeSec:Infinity,reason:'VERTICAL_MISS'};
  }else{
   const times=[(-verticalFt-alt)/rate,(verticalFt-alt)/rate].sort((a,b)=>a-b);
   vEnter=Math.max(0,times[0]);vExit=times[1];
   if(vExit<0||vExit<vEnter)return {timeSec:Infinity,reason:'VERTICAL_PASSED'};
  }
  const entry=Math.max(hEnter,vEnter),exit=Math.min(hExit,vExit);
  if(entry>exit)return {timeSec:Infinity,reason:'NO_3D_OVERLAP'};
  return {timeSec:entry,exitSec:exit,reason:'PREDICTED_3D_PROXIMITY'};
 }
 function output(state,own,c=controls(),feeds=DEFAULT_FEEDS){
  const spec=SCENARIOS[state.scenario],xpdr=transponder(c,own,feeds),f=c.failures||{},height=own.radioAltitudeFt;
  const thresholds=V1.thresholds(own,c.mode);
  const flightValid=own.airborne===true&&[own.altitudeFt,own.vsFpm,own.pitchDeg,own.tasKt].every(Number.isFinite)&&own.tasKt>0;
  const radioValid=Number.isFinite(height)&&!f.radioAlt&&feeds.radioAlt===true;
  const irsValid=!f.irs&&feeds.irs===true;
  const testOk=!xpdr.failed&&!f.computer&&!f.antenna&&feeds.computer===true&&irsValid&&feeds.aligned===true;
  const inhibits=[];
  let mode=c.mode==='STBY'||['ALT_OFF','ALT_ON'].includes(c.mode)?'OFF':c.mode==='TEST'?'TEST':c.mode;
  if(xpdr.failed||f.computer||f.antenna||feeds.computer!==true)mode='FAIL';
  if(!flightValid&&c.mode!=='TEST')inhibits.push('AIRBORNE FLIGHT DATA REQUIRED');
  if(!radioValid||height<1000){if(mode==='TA_RA')mode='TA_ONLY';inhibits.push(radioValid?'RA INHIBIT <1000 FT RA':'RADIO ALTITUDE INVALID / RA INHIBIT');}
  if(!xpdr.altitudeValid){if(mode==='TA_RA')mode='TA_ONLY';inhibits.push('SELECTED ADC INVALID / ALTITUDE REPORTING LOST');}
  if(!irsValid)inhibits.push('IRS BEARING / ATTITUDE INVALID');
  if(c.priorityWarning)inhibits.push('GPWS / WINDSHEAR PRIORITY');
  const out={schema:'B737_CLASSIC_TCAS_OUTPUT_V2',source:'FCOM_MRG_KINEMATIC_TRAINER',mode,stage:'MONITOR',advisory:null,
   ra:null,targets:[],callout:null,transponder:xpdr,inhibits,voiceAllowed:flightValid&&radioValid&&height>=500&&!c.priorityWarning,
   nominalTaSec:thresholds.taSec,nominalRaSec:thresholds.raSec,complete:false,clearOfConflict:false};
  if(mode==='TEST')return {...out,stage:testOk?'TEST OK':'TEST FAIL',callout:testOk?'TCAS SYSTEM TEST OK':'TCAS SYSTEM TEST FAIL',
   voiceAllowed:true,targets:testOk?[{kind:'RA',bearing:own.trueHeadingDeg+12,distance:2,relativeAltitude:-500,verticalRate:600},
    {kind:'TA',bearing:own.trueHeadingDeg-12,distance:3,relativeAltitude:500,verticalRate:0},
    {kind:'PROX',bearing:own.trueHeadingDeg+24,distance:4,relativeAltitude:-1000,verticalRate:-600},
    {kind:'OTHER',bearing:own.trueHeadingDeg-24,distance:5,relativeAltitude:1800,verticalRate:0}]:[]};
  if(['OFF','FAIL'].includes(mode)||!flightValid||!xpdr.surveillance)return out;
  const raAllowed=mode==='TA_RA'&&radioValid&&height>=1000&&xpdr.altitudeValid&&!c.priorityWarning;
  for(const t of state.targets){
   if(!t.transponder)continue;
   const g=geometry(state,t,own),alt=g.relativeAltitude,pred=g.predictedSeparationFt;
   let kind=g.distance<=6&&alt!==null&&Math.abs(alt)<=1200?'PROX':'OTHER';
   // CPA/tau warning times and SL-specific DMOD/ZTHR protection envelopes
   // are both required; present altitude difference alone is never an RA.
   const taPrediction=trajectoryIntersection(g,thresholds.taNm??.75,thresholds.taFt??850);
   const raPrediction=trajectoryIntersection(g,thresholds.raNm??.55,thresholds.raFt??600);
   const separatingSafely=g.verticalRelation==='DIVERGING'&&
    pred!==null&&pred>=thresholds.raFt;
   const ta=!separatingSafely&&taPrediction.timeSec<=(thresholds.taSec??0);
   const threat=alt!==null&&!separatingSafely&&raPrediction.timeSec<=(thresholds.raSec??-1);
   g.timeToTaProximitySec=Number.isFinite(taPrediction.timeSec)?taPrediction.timeSec:null;
   g.timeToRaProximitySec=Number.isFinite(raPrediction.timeSec)?raPrediction.timeSec:null;
   g.predictionReason=threat?raPrediction.reason:taPrediction.reason;
   g.timeToCoAltitudeSec=alt===null?null:
    (alt*g.relativeVerticalRate<0?-60*alt/g.relativeVerticalRate:null);
   if(ta)kind='TA';if(threat&&raAllowed)kind='RA';
   if(spec.demo)kind=t.demoKind==='RA'&&!raAllowed?'TA':t.demoKind;
   if(c.priorityWarning&&(kind==='RA'||kind==='TA'))kind='PROX';
   if(!irsValid)g.bearing=null;
   const band=c.filter==='ABOVE'?[-2700,9900]:c.filter==='BELOW'?[-9900,2700]:[-2700,2700];
   // Threats remain visible regardless of the selected non-threat altitude band.
   if(alt!==null&&(alt<band[0]||alt>band[1])&&!['TA','RA'].includes(kind))continue;
   out.targets.push({...g,kind,displayAltitude:xpdr.absolute&&g.absoluteAltitudeFt!==null?Math.round(g.absoluteAltitudeFt/100):null});
  }
  if(((spec.invalidRa&&c.unit===1)||f['suppression'+c.unit])&&xpdr.surveillance){
   out.targets.push({id:'OWN_ECHO',kind:'RA',bearing:own.trueHeadingDeg,distance:0,relativeAltitude:0,verticalRate:0,invalidEcho:true});
   out.advisory='RA';out.stage='INVALID RA / SUPPRESSION INTERFACE';out.voiceAllowed=false;out.invalidRa=true;
   return out;
  }
  const threats=out.targets.filter(t=>t.kind==='RA'),tas=out.targets.filter(t=>t.kind==='TA');
  // Instructor RA continuity: an improved *prediction* during pilot
  // response does not prove observed separation. Keep the same RA/IVSI
  // sectors while tracked 3-D geometry has not safely diverged.
  // Recovery margins are simulation-only, not certified ACAS thresholds.
  const heldIds=state.raTargetIds||[];
  const heldContacts=out.targets.filter(t=>heldIds.includes(t.id));
  const exitAltFt=Math.max((thresholds.taFt??850)+150,(thresholds.raFt??600)+300);
  const recovered=t=>{
   const verticallySafe=Number.isFinite(t.relativeAltitude)&&
    Math.abs(t.relativeAltitude)>=exitAltFt&&
    t.relativeAltitude*(t.relativeVerticalRate??0)>0;
   const horizontallySafe=Number.isFinite(t.tcpaSec)&&t.tcpaSec< -5&&
    t.closingKt< -25&&t.distance>Math.max(thresholds.taNm??.6,thresholds.raNm??.4);
   return verticallySafe||horizontallySafe;
  };
  const recoveryReady=state.hadRA&&!threats.length&&
   (!heldContacts.length||heldContacts.every(recovered));
  out.recoveryReady=recoveryReady;
  out.recoveryVerifySec=4;
  const holdRA=state.hadRA&&!state.cleared&&!!state.raId&&raAllowed&&
   !threats.length&&(!recoveryReady||state.clearTime<out.recoveryVerifySec);
  if(threats.length||holdRA){
   if(threats.length){
    state.raTargetIds=threats.map(t=>t.id);
    state.cleared=false;state.clearTime=0;
   }else for(const t of heldContacts)t.kind='RA';
   state.hadRA=true;
   if(state.firstRaTime===null)state.firstRaTime=state.time;
   const raContacts=threats.length?threats:heldContacts;
   let id=state.raId||spec.ra||(raContacts[0]?.relativeAltitude>=0?'DESCEND':'CLIMB');
   const age=state.time-state.firstRaTime;
   if(spec.next&&age>=7){
    const next=spec.next;
    if(next.startsWith('REVERSAL')){
     const min=next.includes('CLIMB')?1500:-1500;
     const now=raContacts[0],horizon=clamp(now?.tcpaSec??25,1,25);
     const projected=rate=>Math.abs(now.relativeAltitude+(now.verticalRate-rate)*horizon/60);
     if(now&&projected(min)>projected(-min))id=next;
    }else if(next.startsWith('INCREASE')&&threats.some(t=>t.predictedSeparationFt<400))id=next;
    // Keep the initial sense until measured separation permits recovery;
    // an elapsed timer alone must not weaken a live conflict.
   }
   if(id.includes('DESCEN')&&height<1100){id='MONITOR_DESCENT';inhibits.push('DESCEND INHIBIT <1100 FT RA');}
   if(id==='INCREASE_DESCENT'&&height<1500){id='DESCEND';inhibits.push('INCREASE DESCENT INHIBIT <1500 FT RA');}
   if(id.includes('MAINTAIN')&&(id.includes('CLIMB')?own.vsFpm:-own.vsFpm)<1500)id=id.includes('CLIMB')?'CLIMB':'DESCEND';
   state.raId=id;out.ra=V1.guidance(id,own);out.advisory='RA';out.stage=id;out.callout=out.ra?.callout;
   out.raContinuity=holdRA?'AWAIT VERIFIED SEPARATION':'ACTIVE TRAJECTORY THREAT';
  }else if(state.hadRA&&recoveryReady&&state.clearTime>=out.recoveryVerifySec){
   state.cleared=true;out.clearOfConflict=true;out.stage='CLEAR OF CONFLICT';out.callout='CLEAR OF CONFLICT';
  }else if(tas.length){out.advisory='TA';out.stage='TA';out.callout=state.hadRA?null:'TRAFFIC, TRAFFIC';}
  return out;
 }
 function step(prior,own,dt,c=controls(),feeds=DEFAULT_FEEDS){
  const s=copy(prior);dt=clamp(Number(dt)||0,0,2);s.time+=dt;
  if(!Number.isFinite(s.anchor.lat)||!Number.isFinite(own.lat)){
   const v=vector(own.gsKt??own.tasKt,own.trueTrackDeg??own.trueHeadingDeg);s.ownN+=v.n*dt;s.ownE+=v.e*dt;
  }
  const spec=SCENARIOS[s.scenario];
  if(spec.next?.startsWith('REVERSAL')&&s.firstRaTime!==null&&s.time-s.firstRaTime>=7&&!s.maneuvered){
   for(const t of s.targets)t.verticalRate=spec.next==='REVERSAL_CLIMB'?-3000:3000;s.maneuvered=true;
  }
  for(const t of s.targets){const v=vector(t.speedKt,t.headingDeg);t.n+=v.n*dt;t.e+=v.e*dt;t.altitudeFt+=t.verticalRate*dt/60;}
  s.output=output(s,own,c,feeds);
  // Four seconds of continuously observed safe geometry, not merely
  // four seconds without a predicted RA, are required before clearing.
  if(s.hadRA)s.clearTime=s.output.recoveryReady?s.clearTime+dt:0;
  else s.clearTime=0;
  return s;
 }
 return Object.freeze({MODES,SCENARIOS,controls,transponder,create,step,output,geometry,trajectoryIntersection,nominalThresholds:{taSec:40,raSec:25},pitchForVs:V1.pitchForVs});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./tcas-training-unified-v1.js?v=FLT-UI-SLIM-0001 */
try{
/* Shared Classic TCAS kinematic trainer, transponder and source-failure adapter. */
(function(win){
 'use strict';
 const Core=win.B737ClassicTcasV2,doc=win.document;if(!Core)return;
 let state=null,latest=null,previousTime=null,mode=Core.controls(),voice=false,lastAural='',prepareDisplay=true;
 const by=id=>doc.getElementById(id),copy=x=>x?JSON.parse(JSON.stringify(x)):null;
 const flight=()=>win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active?win.B737UnifiedFlightScenarioV1.getState():null;
 function feeds(){
  const supply=win.B737UnifiedBusConsumerLiveV1,training=win.B737UnifiedEfisSources?.trainingSupply;
  const bus=id=>{const known=supply?.getBus?.(id,'115VAC')?.powered;
   return known===false&&!training?.(id,'115VAC')?false:known===true||training?.(id,'115VAC')?true:null;};
  const snapshot=win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
  const signal=id=>snapshot?.[id]?.quality==='VALID';
  const irs=win.B737IRSTrainerUnified?.getState?.();
  const closed=id=>win.B737UnifiedCB?.closed?.(id)!==false;
  return {xpdr1:closed('P18-1|ALL|B3')?bus('electronic1'):false,xpdr2:win.B737UnifiedCB?.closed?.('P6-1|ALL|D16')===false?false:bus('electronic2'),
   adc1:snapshot?signal('airdata.adc1'):null,adc2:snapshot?signal('airdata.adc2'):null,
   radioAlt:snapshot?signal('airdata.radioAltitude'+mode.altSource):null,
   aligned:irs?['L','R'].every(s=>irs.units?.[s]?.positionValid):null,
   irs:irs?Object.values(irs.units||{}).some(u=>u.positionValid):null,
   computer:closed('P18-1|ALL|B2')&&closed('P18-1|ALL|B6')&&!mode.failures.computer};
 }
 function getState(){
  const health=win.B737UnifiedFlightScenarioV1?.getDiagnostics?.();
  if(state&&(!health?.active||health.lastPublishAgeMs>3000))return {mode:'FAIL',stage:'SOURCE STALE',targets:[],ra:null,advisory:null};
  if(latest)return copy(latest);
  const own=flight()||{airborne:false,elapsedSec:performance.now()/1000};
  const idle={scenario:'SAME_LEVEL',targets:[]};
  const output=Core.output(idle,own,mode,feeds());
  if(mode.mode!=='TEST')output.stage='IDLE';
  return output;

 }
 function getControls(){return copy(mode);}
 function renderStatus(){
  const field=by('tcasTrainingMode');
  if(field&&doc.activeElement!==field&&field.value!==mode.mode)field.value=mode.mode;
 }
 function notify(){renderStatus();win.dispatchEvent(new CustomEvent('b737:tcas-state',{detail:getState()}));}
 function announce(){const s=getState(),key=[s.mode,s.advisory,s.ra?.id,s.callout].join('|');
  if(key===lastAural)return;lastAural=key;if(!voice||!s.callout||!s.voiceAllowed)return;
  win.dispatchEvent(new CustomEvent('b737:tcas-aural',{detail:{text:s.callout,synthetic:true}}));
  if(win.speechSynthesis&&win.SpeechSynthesisUtterance){const u=new win.SpeechSynthesisUtterance(s.callout);u.lang='en-US';win.speechSynthesis.speak(u);}
 }
 function update(own=flight()){
  if(!state){announce();notify();return;}if(!own){stop();return;}
  const now=own.elapsedSec??0;if(previousTime!==null&&now<previousTime){stop();return;}
  const delta=previousTime===null?0:Math.max(0,now-previousTime);previousTime=now;
  let remaining=Math.min(delta,30);if(!remaining)state=Core.step(state,own,0,mode,feeds());
  while(remaining>0){const dt=Math.min(1,remaining);state=Core.step(state,own,dt,mode,feeds());remaining-=dt;}latest=state.output;announce();notify();
 }
 function prepare(){if(!prepareDisplay)return;
  const panel=win.B737UnifiedEFISPedestalV1;
  for(const seat of ['CAPT','FO']){
   const current=panel?.getState?.(seat);
   if(current&&!['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(current.mode))panel.operate(seat,'mode','MAP');
   panel?.operate?.(seat,'tfc',true);panel?.operate?.(seat,'range',10);
  }
 }
 function start(id='SAME_LEVEL',options={}){
  const own=flight();if(!own||!own.airborne&&mode.mode!=='TEST')throw Error('Load an airborne flight scenario; TEST also permits an aligned ground scenario.');
  state=Core.create(id,own,options);previousTime=own.elapsedSec??0;lastAural='';prepare();update(own);return getState();
 }
 function stop(){state=null;latest=null;previousTime=null;lastAural='';notify();}
 function configure(patch){
  const next={...mode,...patch,failures:{...mode.failures,...patch.failures}};
  Core.transponder(next,flight()||{airborne:false,elapsedSec:0});mode=next;update();return getControls();
 }
 const pulseTimers={};
 function pulse(key,seconds){
  const elapsed=flight()?.elapsedSec??performance.now()/1000;
  configure({[key]:elapsed+seconds});
  clearTimeout(pulseTimers[key]);
  pulseTimers[key]=setTimeout(()=>configure({[key]:0}),seconds*1000);
 }
 const ident=()=>pulse('identUntil',1),absolute=()=>pulse('absoluteUntil',15);
 function next(){
  const own=flight();if(!state||!own)return;
  for(let i=0;i<10;i++)state=Core.step(state,own,1,mode,feeds());
  latest=state.output;announce();notify();return getState();
 }
 function mount(){
  const dialog=by('flightScenarioDialog');if(!dialog||by('tcasTrainingControls'))return;
  const section=doc.createElement('fieldset');section.id='tcasTrainingControls';
  section.innerHTML='<legend>TCAS / TRANSPONDER</legend><div class="flight-grid">'+
   '<label>Transponder mode<select id="tcasTrainingMode">'+Core.MODES.map(m=>'<option value="'+m+'"'+(m==='TA_RA'?' selected':'')+'>'+m.replaceAll('_',' ')+'</option>').join('')+'</select></label>'+
   '<label>Encounter<select id="tcasTrainingScenario">'+Object.entries(Core.SCENARIOS).map(([id,s])=>'<option value="'+id+'">'+s.label+'</option>').join('')+'</select></label></div>'+
   '<div class="flight-actions"><button id="tcasTrainingStart" type="button">START ENCOUNTER</button><button id="tcasTrainingNext" type="button">ADVANCE INTRUDER 10 S</button><button id="tcasTrainingStop" type="button">CLEAR ENCOUNTER</button></div>';
  dialog.append(section);
  const run=fn=>()=>{try{fn();}catch(e){
   const status=by('flightScenarioStatus');
   if(status){status.textContent='TCAS: '+String(e.message||e);status.dataset.error='true';}
  }};
  by('tcasTrainingStart').addEventListener('click',run(()=>start(by('tcasTrainingScenario').value)));
  by('tcasTrainingNext').addEventListener('click',run(next));
  by('tcasTrainingStop').addEventListener('click',stop);
  by('tcasTrainingMode').addEventListener('change',run(()=>configure({mode:by('tcasTrainingMode').value})));
  notify();
 }
 for(const event of ['b737:bus-consumer-snapshot','b737:cb-snapshot','b737:cb-state-change','b737:efis-preset-change','b737:efis-source-change'])win.addEventListener(event,()=>update());
 win.addEventListener('b737:flight-scenario-state',e=>update(e.detail));win.addEventListener('b737:flight-scenario-stopped',stop);
 win.B737UnifiedTcasV1=Object.freeze({start,stop,next,getState,getControls,configure,ident,absolute,
  setMode(value){configure({mode:value==='OFF'?'STBY':value});},setPriorityWarning(value){configure({priorityWarning:value===true});},
  getDiagnostics:()=>({active:!!state,scenario:state?.scenario,elapsedSec:state?.time,mode:mode.mode,feeds:feeds()})});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./tcas-photo/panel.js */
try{
/* Source-pixel registration of the removable panel hardware. */
(() => {
 'use strict';
 const base=new URL('./tcas-photo/',document.baseURI);
 const url=name=>new URL(name,base).href;
 const api=window.B737UnifiedTcasV1;
 const modes=['TEST','STBY','ALT_OFF','ALT_ON','TA_ONLY','TA_RA'];
 const ranges=[3,5,10,15],filters=['ABOVE','NORM','BELOW'];
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const style=(node,css)=>Object.assign(node.style,css);
 function part(host,tag,x,y,w,h,W,H){
  const n=document.createElement(tag);
  style(n,{position:'absolute',left:100*x/W+'%',top:100*y/H+'%',width:100*w/W+'%',height:100*h/H+'%',boxSizing:'border-box',margin:'0',padding:'0',border:'0',maxWidth:'none'});
  host.append(n);return n;
 }
 function hardware(host,W,H){
  function image(name,x,y,w,h){
   const img=part(host,'img',x-w/2,y-h/2,w,h,W,H);
   img.src=url(name);img.alt='';img.draggable=false;img.style.pointerEvents='none';return img;
  }
  function control(label,x,y,w,h,step,tap){
   const b=part(host,'button',x-w/2,y-h/2,w,h,W,H);
   b.type='button';b.title=label;b.setAttribute('aria-label',label);
   style(b,{background:'transparent',pointerEvents:'auto',touchAction:'none',cursor:'pointer',minWidth:0,minHeight:0});
   let drag=null;
   b.onpointerdown=e=>{e.stopPropagation();b.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,moved:false};};
   b.onpointermove=e=>{
    if(!drag||!step)return;
    const dx=e.clientX-drag.x,dy=drag.y-e.clientY;
    const ticks=Math.trunc((Math.abs(dx)>Math.abs(dy)?dx:dy)/8);
    if(ticks){step(ticks);drag={x:e.clientX,y:e.clientY,moved:true};}
   };
   b.onpointerup=e=>{e.stopPropagation();if(drag&&!drag.moved)(tap||(()=>step(1)))();drag=null;};
   b.onpointercancel=()=>{drag=null;};
   b.onclick=e=>{e.stopPropagation();if(e.detail===0)(tap||(()=>step(1)))();};
   b.onkeydown=e=>{if(step&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();step(['ArrowUp','ArrowRight'].includes(e.key)?1:-1);}};
   b.addEventListener('wheel',e=>{if(step){e.preventDefault();e.stopPropagation();step(e.deltaY<0?1:-1);}},{passive:false});
   return b;
  }
  return {image,control};
 }
 let redraw=()=>{};
 function mount(){
  const frame=document.querySelector('[data-faceplate="transponder-tcas"]');
  if(!frame||frame.dataset.operational)return;
  frame.dataset.operational='true';
  const plate=frame.querySelector('img');plate.src=url('plate.webp');plate.alt='Transponder / TCAS control panel';
  const {image,control}=hardware(frame,1006,394);
  const mode=image('mode.png',215,118,120,120),range=image('range.png',797,118,116,116);
  image('fl.png',797,118,49,49);
  const unit=image('toggle.png',179,309,21,40),band=image('toggle.png',823,309,21,40);
  const fail=image('fail.png',680,104,32,32),ident=image('ident.png',508,309,44,44);
  // Unlit INOP lens retains the engraved lettering.
  const inop=part(frame,'div',786,186,102,55,1006,394);
  style(inop,{background:'#12141a',borderRadius:'10%',pointerEvents:'none'});
  const rotors=[];
  const change=(key,value)=>api.configure({[key]:value});
  function selector(key,values){return d=>{
   const i=values.indexOf(api.getControls()[key]);change(key,values[clamp(i+d,0,values.length-1)]);
  };}
  control('Transponder mode',215,118,113,113,selector('mode',modes));
  control('TCAS range',797,118,113,113,selector('rangeNm',ranges));
  control('FL · absolute altitude',797,118,49,49,null,()=>api.absolute());
  const labels=(key,values,positions,width,height)=>positions.forEach(([x,y],i)=>
   control(String(values[i]).replaceAll('_',' '),x,y,width,height,null,()=>change(key,values[i])));
  labels('mode',modes,[[124,118],[133,68],[161,26],[259,26],[285,69],[307,119]],65,30);
  labels('rangeNm',ranges,[[735,69],[768,37],[818,37],[860,68]],34,32);
  control('ATC 1 / 2',179,309,52,52,null,()=>change('unit',3-api.getControls().unit));
  labels('unit',[1,2],[[179,264],[179,356]],42,30);
  control('Altitude band',823,309,54,49,selector('filter',filters),()=>change('filter',filters[(filters.indexOf(api.getControls().filter)+1)%3]));
  labels('filter',filters,[[823,260],[895,309],[823,357]],72,30);
  control('ATC IDENT',508,309,52,52,null,()=>api.ident());
  for(const [pair,x] of [353,660].entries()){
   for(const [ring,size] of [148,93].entries()){
    const index=pair*2+ring;
    rotors.push(image(ring?'inner.png':'outer.png',x,292,size,size));
    control('Squawk digit '+(index+1),x,292,size,size,d=>{
     const digits=api.getControls().code.split('');
     digits[index]=String(((Number(digits[index])+d)%8+8)%8);change('code',digits.join(''));
    }).style.borderRadius='50%';
   }
  }
  const lcd=part(frame,'canvas',402,40,205,125,1006,394);lcd.width=205;lcd.height=125;
  const g=lcd.getContext('2d');
  const glyph=new Image(),legend=new Image();glyph.onload=legend.onload=()=>redraw();glyph.src=url('segments.png');legend.src=url('legends.png');
  const segments=[[4,0,27,9],[25,4,10,22],[25,31,10,22],[4,47,27,9],[0,31,10,22],[0,4,10,22],[4,23,27,9]];
  const masks=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg'];
  redraw=()=>{
   const c=api.getControls(),state=api.getState(),xp=state.transponder;
   const mi=modes.indexOf(c.mode),ri=ranges.indexOf(c.rangeNm);
   mode.style.transform='rotate('+([-180,-149,-108,-66,-32,0][mi]+139)+'deg)';
   range.style.transform='rotate('+([-141,-109,-75,-37][ri]+109)+'deg)';
   unit.style.transform='rotate('+(c.unit===1?180:0)+'deg)';
   band.style.transform=c.filter==='NORM'?'scaleY(.56)':'rotate('+(c.filter==='ABOVE'?180:0)+'deg)';
   inop.style.opacity=xp?.powered&&(state.mode==='FAIL'||state.mode==='TEST')?'0':'.62';
   fail.style.filter=xp?.powered&&xp.atcFailLight?'':'brightness(.22)';
   ident.style.filter=xp?.ident?'brightness(.65)':'';
   rotors.forEach((img,i)=>img.style.transform='rotate('+Number(c.code[i])*45+'deg)');
   g.fillStyle='#26151e';g.fillRect(0,0,205,125);
   if(!xp?.powered)return;
   if(legend.naturalWidth){
    g.drawImage(legend,0,0,59,22,9,9,59,22);
    if(xp.test)g.drawImage(legend,64,0,32,22,72,9,32,22);
    else {const sx=c.unit===1?64:77;g.drawImage(legend,sx,0,16,22,74,9,16,22);}
    if(xp.test||xp.ident&&xp.modeS)g.drawImage(legend,149,0,19,22,167,9,19,22);
   }
   if(glyph.naturalWidth)[...xp.displayedCode].forEach((n,i)=>{
    for(const ch of masks[Number(n)]){const [x,y,w,h]=segments[ch.charCodeAt(0)-97];g.drawImage(glyph,x,y,w,h,12+46*i+x,57+y,w,h);}
   });
   frame.dataset.atcCode=xp.displayedCode;
  };
  redraw();
 }
 window.B737TcasPhotoHardware={hardware,part,url};
 window.addEventListener('b737:pedestal-faceplates-mounted',mount);
 window.addEventListener('b737:tcas-state',()=>redraw());
 mount();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
