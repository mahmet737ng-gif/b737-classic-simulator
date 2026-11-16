(() => {
  const {createGauge,defaults} = window.B737PhotoGauges;
  let state = {...defaults};
  const rack = document.getElementById('rack');
  const form = document.getElementById('inputs');
  const raw = document.getElementById('raw');
  const gauges = Object.entries({
    airspeed:'Mach / Airspeed',altimeter:'Altimeter',ivsi:'IVSI',rmi:'RMI',standby:'Standby Altimeter / IAS'
  }).map(([kind,label])=>{
    const figure=document.createElement('figure');
    rack.append(figure);
    const gauge=createGauge(figure,kind,{label,onChange:(key,value,initial)=>{
      if(key==='cursorManual'&&value) state.cursor=initial;
      write(key,value); sync(); render();
    }});
    const caption=document.createElement('figcaption');
    caption.textContent=label;
    figure.append(caption);
    return gauge;
  });
  function render() {
    gauges.forEach(gauge=>gauge.render(state,raw.checked));
    const {mach,tasKt}=window.B737PhotoGauges.airData(state.ias,state.altitude,state.oat);
    const alt=window.B737PhotoGauges.indicatedAltitude(state.altitude,state.qnh);
    document.getElementById('computed').textContent=`TAS ${tasKt.toFixed(1)} kt · Mach ${mach.toFixed(3)} · ALT ${Math.round(alt)} ft · BARO Δ ${Math.round(alt-state.altitude)} ft`;

  }
  const groups = {
    'Air data': [
      ['ias','IAS (kt)',0,400,1],['oat','Static air temperature (°C)',-85,60,1],['limit','Limit pointer (kt)',60,400,1],
      ['altitude','Pressure altitude (ft)',-1000,45000,20],['qnh','QNH (hPa)',870,1085,0.25],
      ['vs','Vertical speed (fpm)',-6000,6000,100],['altitudeBug','Altitude bug (ft)',0,45000,20]
    ],
    'Standby': [
      ['standbyAltitude','Pressure altitude (ft)',-1000,45000,20],['standbyQnh','QNH (hPa)',870,1085,0.25]
    ],
    'RMI': [
      ['hdg','Magnetic heading (°)',0,360,1],['bearing1','VOR 1 bearing (°)',0,360,1],
      ['bearing2','VOR 2 bearing (°)',0,360,1],['dme1','DME 1 (NM)',0,999.9,0.1],['dme2','DME 2 (NM)',0,999.9,0.1],
      ['adfBearing1','ADF 1 bearing (°)',0,360,1],['adfBearing2','ADF 2 bearing (°)',0,360,1],
      ['headingFlag','HDG'],['bearingFlag','Bearing flag'],['adfInop','ADF INOP']
    ],
    'Airspeed bugs': [
      ['bugs.0','White 1 (kt)',60,400,1],['bugs.1','White 2 (kt)',60,400,1],
      ['bugs.2','White 3 (kt)',60,400,1],['bugs.3','White 4 (kt)',60,400,1],
      ['orangeBugs.0','Orange 1 (kt)',60,400,1],['orangeBugs.1','Orange 2 (kt)',60,400,1]
    ],
    'Flags': [['altFlag','ALT flag'],['ivsiOff','IVSI OFF'],['airDataOff','ASI data invalid']]
  };
  function read(key) {
    const [name,index]=key.split('.');
    return index===undefined?state[name]:state[name][index];
  }
  function write(key,value) {
    const [name,index]=key.split('.');
    if(index===undefined) state[name]=value;
    else state[name]=state[name].map((old,i)=>i===Number(index)?value:old);
  }
  for(const [title,fields] of Object.entries(groups)){
    const group=document.createElement('fieldset');
    const legend=document.createElement('legend');
    legend.textContent=title;
    group.append(legend);
    form.append(group);
    for(const [key,name,min,max,step] of fields){
      const label=document.createElement('label');
      const input=document.createElement('input');
      input.name=key;
      input.type=min===undefined?'checkbox':'number';
      label.className=min===undefined?'check':'input';
      if(min!==undefined) Object.assign(input,{min,max,step});
      label.append(name,input);
      group.append(label);
      input.addEventListener('input',()=>{
        if(input.type==='checkbox') write(key,input.checked);
        else if(Number.isFinite(input.valueAsNumber)) write(key,Math.min(max,Math.max(min,input.valueAsNumber)));
        render();
      });
    }
  }
  const presets={
    normal:{},climb:{ias:260,oat:-10,altitude:7340,standbyAltitude:7340,vs:1800,hdg:315},
    descent:{ias:180,oat:5,altitude:4780,standbyAltitude:4780,vs:-1200,hdg:105,qnh:1004,standbyQnh:1004},
    failed:{altFlag:true,ivsiOff:true,headingFlag:true,bearingFlag:true,adfInop:true,
      airDataOff:true,dme1:null,dme2:null,ias:0}
  };
  function sync() {
    for(const input of form.querySelectorAll('input')){
      if(input.type==='checkbox') input.checked=read(input.name);
      else input.value=read(input.name)??'';
    }
  }
  function preset(name) { state={...defaults,...presets[name]}; sync(); render(); }
  document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>preset(btn.dataset.preset)));
  raw.addEventListener('change',render);
  form.addEventListener('submit',event=>event.preventDefault());
  preset('normal');
})();
