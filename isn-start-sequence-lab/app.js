/* ISN-03 stage 2 standalone browser test interface, outside locked mosaic. */
(function(){'use strict';
  const $=id=>document.getElementById(id);
  const Start=window.B737ISNStartSequenceV1;
  const system=new Start.Session({
    EngineAPU:window.B737ISNEngineAPUV1,
    ElectricalPack:window.B737ISNElectricalPackV1,
    Electrical:window.B737ElectricalV7,
    Loads:window.B737ElectricalLoadsV8,
    TrainerCore:window.B737TrainerCore,
    WarningEngine:window.B737WarningEngine.WarningEngine,
    Pneumatics:window.B737PneumaticsV6
  });
  const labels={engine1:'ENGINE 1',engine2:'ENGINE 2',apu:'APU'};
  function present(device,key,type){
    const id=device+'-'+key;
    const row=document.createElement('div');row.className='feedback-row';
    const label=document.createElement('label');label.htmlFor=id;label.textContent=key.replace(/([A-Z])/g,' $1');
    const control=type==='NUMBER'||type==='NONNEGATIVE_NUMBER' ? document.createElement('input') : document.createElement('select');
    control.id=id;control.dataset.device=device;control.dataset.key=key;
    if(control.nodeName==='INPUT'){
      control.type='number';control.step='any';control.placeholder='Unknown';
      if(type==='NONNEGATIVE_NUMBER')control.min='0';
    }else{
      const options=type==='FUEL_LEVER'?['UNKNOWN','CUTOFF','IDLE']:['UNKNOWN','TRUE','FALSE'];
      for(const val of options){const option=document.createElement('option');option.value=val;option.textContent=val;control.append(option);}
    }
    const button=document.createElement('button');button.textContent='Set';button.dataset.setFeedback=id;
    row.append(label,control,button);return row;
  }
  function build(){
    for(const option of Start.IGNITION_SELECTORS){
      const btn=document.createElement('button');btn.textContent=option;btn.dataset.ignition=option;
      $('ignitionControls').append(btn);
    }
    for(const [key,type] of Object.entries(Start.POWER_FIELDS)){
      $('powerControls').append(present('power',key,type));
    }
    for(const device of Start.DEVICES){
      const section=document.createElement('section');section.className='source';
      section.id='card-'+device;
      const header=document.createElement('header');
      const title=document.createElement('h2');title.textContent=labels[device];
      const phase=document.createElement('div');phase.className='phase';phase.id='phase-'+device;
      header.append(title,phase);
      const observed=document.createElement('div');observed.className='observed';observed.id='running-'+device;
      const actions=document.createElement('div');actions.className='control-row';
      const detents=device==='apu'?Start.APU_SWITCHES:Start.START_SWITCHES;
      const switchGroup=document.createElement('div');switchGroup.className='control-row';
      for(const position of detents){const b=document.createElement('button');b.textContent=position;
        b.dataset.detent=position;b.dataset.device=device;switchGroup.append(b);}
      for(const [action,label] of [['START','START'],['SHUTDOWN','SHUTDOWN']]){
        const b=document.createElement('button');b.textContent=label;b.dataset.request=action;b.dataset.device=device;actions.append(b);
      }
      for(const [value,label] of [['true','Observe RUN'],['false','Observe STOP'],['null','Clear status']]){
        const b=document.createElement('button');b.textContent=label;b.dataset.running=value;b.dataset.device=device;actions.append(b);
      }
      const feedback=document.createElement('div');
      const fields=device==='apu'?Start.APU_FIELDS:Start.ENGINE_FIELDS;
      for(const [key,type] of Object.entries(fields))feedback.append(present(device,key,type));
      const rules=document.createElement('pre');rules.className='rules';rules.id='rules-'+device;
      section.append(header,observed,switchGroup,actions,feedback,rules);$('sources').append(section);
    }
  }
  function send(command){
    try{system.send(command);render();}catch(err){window.alert(err.message||String(err));}
  }
  function observed(device,running){return {type:'SOURCE_OBSERVATION',device,running,
    origin:'INSTRUCTOR_OBSERVATION',instructor:true};}
  function render(){
    const o=system.get();
    $('networkStatus').textContent=o.network.status;
    $('networkStatus').classList.toggle('ready',o.network.status==='SOURCE_GATED_ACTIVE');
    $('unresolved').textContent=o.network.unresolved.length?o.network.unresolved.map(id=>labels[id]).join(', '):'None';
    for(const device of Start.DEVICES){
      const d=o.observation[device];
      $('phase-'+device).textContent=d.phase;
      $('phase-'+device).classList.toggle('running',d.running===true);
      $('running-'+device).textContent='Running: '+(d.running===null?'UNKNOWN':String(d.running).toUpperCase());
      $('rules-'+device).textContent=JSON.stringify(d.rules,null,2);
    }
    if(o.network.electrical){
      const e=o.network.electrical,p=o.network.pneumatics;
      $('outputs').textContent=JSON.stringify({generatorBus:e.bus,selectedSources:e.source,
        bleed:p.bleed,pack:p.pack,
        pumpState:Object.fromEntries(Object.entries(o.network.fuelAndHydraulicPumps).map(([id,v])=>
          [id,{operating:v.operating,powered:v.powered,evidence:v.powerEvidence}])),
        warnings:o.network.warnings.qa},null,2);
    }else $('outputs').textContent='Derived states withheld (UNKNOWN sources): '+o.network.unresolved.join(', ');
    $('trace').textContent=o.recentEvents.length?o.recentEvents.slice(-14).map(e=>
      '#'+e.seq+' '+e.command.type+' '+(e.command.device||'')+'\n'+
      e.changes.map(x=>'  '+x.path+': '+x.from+' → '+x.to+' ['+x.evidence+']').join('\n')).join('\n\n'):'No events yet.';
  }
  document.addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    if(btn.id==='reset'){system.reset();render();return;}
    if(btn.id==='cold'){for(const device of Start.DEVICES)system.send(observed(device,false));render();return;}
    if(btn.dataset.request) return send({type:'SOURCE_REQUEST',device:btn.dataset.device,request:btn.dataset.request});
    if(btn.dataset.detent)return send(btn.dataset.device==='apu'?{type:'APU_SWITCH',position:btn.dataset.detent}:
      {type:'ENGINE_START_SWITCH',device:btn.dataset.device,position:btn.dataset.detent});
    if(btn.dataset.ignition)return send({type:'IGNITION_SELECTOR',position:btn.dataset.ignition});
    if(btn.dataset.running) return send(observed(btn.dataset.device,btn.dataset.running==='null'?null:btn.dataset.running==='true'));
    if(btn.dataset.setFeedback){
      const input=$(btn.dataset.setFeedback);let value=null;
      if(input.nodeName==='INPUT')value=input.value.trim()===''?null:Number(input.value);
      else if(input.value!=='UNKNOWN') value=input.value==='TRUE'?true:input.value==='FALSE'?false:input.value;
      return send({type:input.dataset.device==='power'?'POWER_FEEDBACK':'FEEDBACK',
        device:input.dataset.device==='power'?undefined:input.dataset.device,key:input.dataset.key,value,
        origin:'INSTRUCTOR_OBSERVATION',instructor:true});
    }
    if(btn.dataset.electrical) return send({type:'ELECTRICAL',action:{type:'FAULT',id:btn.dataset.electrical,
      active:btn.dataset.fault==='true',instructor:true}});
    if(btn.dataset.apugen) return send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:Number(btn.dataset.apugen)}});
    if(btn.dataset.apubleed) return send({type:'PNEUMATIC',action:{type:'CONTROL',key:'apuBleed',value:btn.dataset.apubleed}});
  });
  build();render();
})();
