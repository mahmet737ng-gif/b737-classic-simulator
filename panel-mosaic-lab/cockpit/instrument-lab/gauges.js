(() => {
  'use strict';
  const assets = new URL('./', document.currentScript.src);
  const geometry = {"altimeter":{"size":[1117,1112],"pivot":[569,551],"parts":{"needle":{"box":[187,406,411,175],"origin":[382,145]},"alt-flag":{"box":[325,347,100,127]},"bug":{"box":[525,926,74,67],"origin":[44,-375]},"baro-knob":{"box":[68,869,184,184],"origin":[91.5,91.5]},"bug-knob":{"box":[865,866,189,191],"origin":[94.0,95.0]}}},"airspeed":{"size":[719,717],"pivot":[359,354],"parts":{"ias-needle":{"box":[335,102,49,277],"origin":[24,252]},"limit-needle":{"box":[103,316,241,44],"origin":[256,38]},"bug-1":{"box":[502,53,38,49],"origin":[-143,301]},"bug-2":{"box":[524,67,41,52],"origin":[-165,287]},"bug-3":{"box":[541,82,46,52],"origin":[-182,272]},"bug-4":{"box":[563,106,45,45],"origin":[-204,248]},"orange-1":{"box":[477,580,29,36],"origin":[-118,-226]},"orange-2":{"box":[493,573,29,34],"origin":[-134,-219]},"set-knob":{"box":[55,585,92,90],"origin":[45.5,44.5]}}},"rmi":{"size":[598,725],"pivot":[294,430],"parts":{"single-needle":{"box":[114,413,353,37],"origin":[180,17]},"double-needle":{"box":[203,279,180,303],"origin":[91,151]},"hub":{"box":[264,400,63,62]},"hdg-flag":{"box":[260,175,92,115]},"bearing-flag":{"box":[405,220,119,119]},"adf-inop":{"box":[273,732,319,50]},"card":{"box":[77,213,435,435]}}},"ivsi":{"size":[596,593],"pivot":[295,289],"parts":{"needle":{"box":[102,264,219,49],"origin":[193,25]},"off-flag":{"box":[329,268,111,46]}}},"standby":{"size":[1081,1067],"pivot":[503,381],"parts":{"needle":{"box":[475,166,56,360],"origin":[28,215]},"ias-stripes":{"box":[299,743,69,97]},"ias-tape-reference":{"box":[295,735,438,106]},"alt-stripes":{"box":[358,287,66,61]},"baro-knob":{"box":[75,827,176,177],"origin":[87.5,88.0]}}}};
  const ns = 'http://www.w3.org/2000/svg';
  let nextClipId=0;
  const defaults = Object.freeze({
    ias: 145, mach: 0.24, limit: 340, altitude: 2380, standbyAltitude: 2380,
    qnh: 1013.25, standbyQnh: 1013.25, vs: 0, hdg: 0, bearing1: 90, bearing2: 30,
    dme1: 12.4, dme2: 19.2, altitudeBug: 2500, bugs: [80, 95, 120, 145],
    orangeBugs: [160, 165], headingFlag: false, bearingFlag: false,
    ivsiOff: false, altFlag: false, airDataOff: false, standbyIasOff: false, adfInop: false
  });
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
    const pressure = (x1,x2,y,size) => [text(x1,y,size),text(x2,y,size)];
    function baro(nodes,qnh) {
      nodes[0].textContent=Math.round(qnh);
      nodes[1].textContent=(qnh*0.029529983).toFixed(2);
    }
    const altitudeText = value => Math.round(value/20)*20;
    let update;
    switch(kind) {
      case 'altimeter': {
        const alt = text(1005,1295,139);
        const qnh = pressure(783,1046,1601,62);
        ['alt-flag','bug','needle','baro-knob','bug-knob'].forEach(place);
        update = s => {
          alt.textContent=s.altFlag?'':altitudeText(s.altitude).toLocaleString('en-US');
          setVisible(sprite['alt-flag'],s.altFlag);
          setVisible(sprite.needle,!s.altFlag);
          baro(qnh,s.qnh);
          rotate('needle',(s.altitudeAngle ?? s.altitude*0.36)-290);
          rotate('bug',s.altitudeBug*0.36-180);
          rotate('baro-knob',(s.qnh-1013)*6,161,961);
          rotate('bug-knob',s.altitudeBug*.1,959,961);
        };
        break;
      }
      case 'airspeed': {
        const mach=text(504,682,41), ias=text(504,893,49,'#b4f77a');
        const bugNames=['bug-1','bug-2','bug-3','bug-4'], oranges=['orange-1','orange-2'];
        [...bugNames,...oranges,'limit-needle','ias-needle','set-knob'].forEach(place);
        update=s=>{
          mach.textContent=s.airDataOff?'':s.mach.toFixed(2).slice(1);
          ias.textContent=s.airDataOff?'':Math.round(s.ias);
          setVisible(sprite['ias-needle'],!s.airDataOff);
          rotate('ias-needle',interpolate(s.ias,iasScale));
          rotate('set-knob',(s.bugs[0]-80)*3,100,630);
          rotate('limit-needle',interpolate(s.limit,iasScale)-276);
          bugNames.forEach((name,i)=>rotate(name,interpolate(s.bugs[i],iasScale)-[30,35,40,46][i]));
          oranges.forEach((name,i)=>rotate(name,interpolate(s.orangeBugs[i],iasScale)-[152,148][i]));
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
        update=s=>{
          rotate('card',-s.hdg);
          rotate('single-needle',s.bearingAngle1 ?? s.bearing1-s.hdg-90);
          rotate('double-needle',s.bearingAngle2 ?? s.bearing2-s.hdg-30);
          setVisible(sprite['hdg-flag'],s.headingFlag);
          setVisible(sprite['bearing-flag'],s.bearingFlag);
          setVisible(placard,s.adfInop);
          setVisible(sprite['double-needle'],!s.bearingFlag&&!s.adfInop);
          [s.dme1,s.dme2].forEach((value,i)=>{
            const chars=Number.isFinite(value)?Math.round(value*10).toString().padStart(4,'0').slice(-4):'––––';
            dme[i].forEach((node,j)=>{node.textContent=chars[j];});
          });
        };
        break;
      }
      case 'standby': {
        const alt = text(883,1186,64);
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
        update=s=>{
          alt.textContent=String(altitudeText(s.standbyAltitude)).padStart(4,'0');
          setVisible(sprite['alt-stripes'],s.standbyAltitude>=0&&s.standbyAltitude<10000);
          baro(qnh,s.standbyQnh);
          rotate('needle',s.standbyAltitude*0.36);
          rotate('baro-knob',(s.standbyQnh-1013)*6,162,915);
          const travel = s.ias<60 ? s.ias*68/60 : 68+4.2*(s.ias-60);
          ticks.setAttribute('transform',`translate(${224-travel} 0)`);
          setVisible(tape,!s.standbyIasOff);
          setVisible(sprite['ias-stripes'],s.standbyIasOff||s.ias<60);
        };
        break;
      }
    }
    const render = (state, raw = false) => {
      update(state);
      setVisible(movable,!raw);
    };
    render(defaults,true);
    return {canvas,render};
  }
  window.B737PhotoGauges = {createGauge,defaults,geometry};
})();
