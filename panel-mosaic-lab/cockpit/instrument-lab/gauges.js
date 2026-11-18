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
    const image = (name, x, y, w, h) => svg(canvas,'image',{
      href:new URL(kind+'/'+name+'.png', assets).href,x,y,width:w,height:h,'pointer-events':'none'
    });
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
          // Values progress upward. Lower place rotates continuously; upper
          // places roll across 9 -> 0 only when the lower digits carry.
          t.glyphs[0].textContent=String(f.previous);
          t.glyphs[1].textContent=String(f.digit);
          t.glyphs[2].textContent=String(f.next);
          t.moving.setAttribute('transform','translate(0 '+(-f.fraction*stride)+')');
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
