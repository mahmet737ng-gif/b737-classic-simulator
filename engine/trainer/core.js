/* B737 Classic switch/fault/checklist trainer v0.1.
 * Pure, deterministic, offline-capable. All outputs are TRAINING-ONLY.
 * Copyright-free software implementation; no manual wording copied.
 * Provenance: Sepehran FCOM 6.10.8-9, 6.20.1-4, 12.10.1-3,
 * 13.10.1-2; Sepehran QRH 6.1-6.4; in-scope generalizations
 * and explicitly labeled surrogate equipment-to-transfer-bus mappings.
 */
(function (root, factory) {
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.B737TrainerCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FUEL=['leftFwd','leftAft','rightFwd','rightAft','centerLeft','centerRight'];
  const HYD=['elecA','elecB'];
  const CONFIG=Object.freeze({
    // These downstream bus assignments are TRAINING ASSUMPTIONS, not asserted as
    // exact installed circuit wiring. Requires configuration-specific electrical load schedule.
    loadBus:Object.freeze({leftFwd:1,leftAft:1,rightFwd:2,rightAft:2,centerLeft:1,centerRight:2,elecA:2,elecB:1}),
    loadBusStatus:'TRAINING_SURROGATE_NOT_FCOM_WIRING_VERIFIED'
  });
  const FAULTS=Object.freeze(['gen1Failed','gen2Failed','apuGeneratorFailed','externalPowerFailed','transfer1Failed','transfer2Failed','elecAFailed','elecBFailed','elecAOverheat','elecBOverheat',...FUEL.map(x=>'fuel_'+x+'_Failed')]);
  const LABELS=Object.freeze({
    gen1Failed:'GEN 1 unavailable',gen2Failed:'GEN 2 unavailable',apuGeneratorFailed:'APU generator failed',externalPowerFailed:'External AC failed',
    transfer1Failed:'AC transfer bus 1 fault',transfer2Failed:'AC transfer bus 2 fault',
    elecAFailed:'Electric hydraulic pump A failed',elecBFailed:'Electric hydraulic pump B failed',
    elecAOverheat:'Hydraulic pump A overheat',elecBOverheat:'Hydraulic pump B overheat',
    leftFwd:'MAIN 1 FWD',leftAft:'MAIN 1 AFT',rightFwd:'MAIN 2 FWD',rightAft:'MAIN 2 AFT',centerLeft:'CENTER LEFT',centerRight:'CENTER RIGHT',elecA:'ELEC 2 / SYS A',elecB:'ELEC 1 / SYS B'
  });
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function isKey(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
  function initialState(){return {
    version:'b737-cl-trainer/1',seq:0,controls:{battery:true,busTransferAuto:true,externalAvailable:true,externalConnected:false,
      engine1Running:true,engine2Running:true,gen1Connected:true,gen2Connected:true,apuRunning:false,apuGen1Connected:false,apuGen2Connected:false,
      fuel:{leftFwd:true,leftAft:true,rightFwd:true,rightAft:true,centerLeft:false,centerRight:false},
      hyd:{elecA:true,elecB:true},
      // Engine-driven hydraulic pumps remain available even if electric motor pumps fail.
      engineHyd:{A:true,B:true}},
    faults:Object.fromEntries(FAULTS.map(f=>[f,false])),instructor:{scenario:'none'},events:[]};}
  function validBool(value){if(typeof value!=='boolean')throw new Error('Expected boolean');}
  function normalize(s){
    if(!s||s.version!=='b737-cl-trainer/1'||!s.controls||!s.faults||!Array.isArray(s.events))throw new Error('Invalid trainer state');
    return s;
  }
  function setPath(o,path,value){const p=path.split('.');let target=o;for(const part of p.slice(0,-1)){if(!target||!isKey(target,part))throw new Error('Unknown control '+path);target=target[part];}const key=p[p.length-1];if(!target||!isKey(target,key))throw new Error('Unknown control '+path);validBool(value);target[key]=value;}
  function apply(state,command){
    normalize(state);
    if(!command||typeof command.type!=='string')throw new Error('Invalid command');
    if(command.type==='RESET')return initialState();
    const next=clone(state);
    switch(command.type){
      case 'CONTROL':
        setPath(next.controls,command.path,command.value);
        // Source selection is exclusive per generator bus (FCOM 6.20.1-4).
        if(command.value===true){
          if(command.path==='apuGen1Connected'){next.controls.gen1Connected=false;next.controls.externalConnected=false;}
          if(command.path==='apuGen2Connected'){next.controls.gen2Connected=false;next.controls.externalConnected=false;}
          if(command.path==='gen1Connected'){next.controls.apuGen1Connected=false;next.controls.externalConnected=false;}
          if(command.path==='gen2Connected'){next.controls.apuGen2Connected=false;next.controls.externalConnected=false;}
          if(command.path==='externalConnected'){
            if(!next.controls.battery)throw new Error('Ground power connection requires BATTERY ON (FCOM 6.20.2)');
            next.controls.gen1Connected=false;next.controls.gen2Connected=false;
            next.controls.apuGen1Connected=false;next.controls.apuGen2Connected=false;
          }
        }
        if(command.path==='battery'&&command.value===false)next.controls.externalConnected=false;
        break;
      case 'FAULT': if(!isKey(next.faults,command.id))throw new Error('Unknown fault '+command.id);validBool(command.active);next.faults[command.id]=command.active;break;
      case 'SCENARIO': if(command.id!=='bus1'&&command.id!=='bus2'&&command.id!=='none')throw new Error('Unknown scenario');
        next.instructor.scenario=command.id;break;
      default:throw new Error('Unknown command type '+command.type);
    }
    next.seq++;
    next.events.push({seq:next.seq,command:clone(command)});
    if(next.events.length>400)next.events.shift();
    return next;
  }
  function derive(s){
    normalize(s);const c=s.controls,f=s.faults;
    const src={gen1:c.gen1Connected&&c.engine1Running&&!f.gen1Failed,
      gen2:c.gen2Connected&&c.engine2Running&&!f.gen2Failed,
      apu:c.apuRunning&&!f.apuGeneratorFailed,
      external:c.externalAvailable&&c.battery&&!f.externalPowerFailed};
    // Each AC generator bus has a single connected source. Source selection never parallels.
    // Instructor can explicitly select GND/APU/gen with switches; preferred generator for a side
    // is an original training simplification of automatic source arbitration.
    const bus=(side)=>{
      if(side===1&&src.gen1)return 'GEN 1';
      if(side===2&&src.gen2)return 'GEN 2';
      if(src.apu&&(side===1?c.apuGen1Connected:c.apuGen2Connected))return 'APU';
      if(src.external&&c.externalConnected)return 'EXTERNAL';
      return null;
    };
    const generatorBus={1:bus(1),2:bus(2)};
    const transferBus={1:Boolean((generatorBus[1]||(c.busTransferAuto&&generatorBus[2]))&&!f.transfer1Failed),
      2:Boolean((generatorBus[2]||(c.busTransferAuto&&generatorBus[1]))&&!f.transfer2Failed)};
    const mainBus={1:Boolean(generatorBus[1]),2:Boolean(generatorBus[2])};
    const acStandby=transferBus[1]||c.battery; // static inverter / battery standby simplified.
    const dc={bus1:transferBus[1],bus2:transferBus[2],battery:c.battery,standby:c.battery||transferBus[1]};
    const fuel={};
    for(const id of FUEL){const selected=c.fuel[id];const hasPower=transferBus[CONFIG.loadBus[id]];
      const operational=selected&&hasPower&&!f['fuel_'+id+'_Failed'];
      const center=id.startsWith('center');
      fuel[id]={switchOn:selected,powered:hasPower,operational,
        // FCOM 12.10.2-3: CENTER annunciates low pressure only with switch ON;
        // MAIN annunciates with switch OFF or low output pressure.
        lowPressure:center?selected&&!operational:!operational};
    }
    const hyd={};for(const id of HYD){const hasPower=transferBus[CONFIG.loadBus[id]];
      const operating=c.hyd[id]&&hasPower&&!f[id+'Failed']&&!f[id+'Overheat'];
      hyd[id]={switchOn:c.hyd[id],powered:hasPower,operating,lowPressure:!operating,overheat:f[id+'Overheat']};
    }
    const systemHyd={A:c.engineHyd.A&&c.engine1Running||hyd.elecA.operating,
      B:c.engineHyd.B&&c.engine2Running||hyd.elecB.operating};
    const fuelMainCaution=[['leftFwd','leftAft'],['rightFwd','rightAft']].some(pair=>pair.every(k=>fuel[k].lowPressure));
    const ctrFuelCaution=Object.keys(fuel).filter(k=>k.startsWith('center')).some(k=>fuel[k].lowPressure)&&
      (c.fuel.centerLeft||c.fuel.centerRight); // simplified: verifies one center low with either CTR switch active
    const indicators={
      busOff1:!mainBus[1],busOff2:!mainBus[2],transferBusOff1:!transferBus[1],transferBusOff2:!transferBus[2],
      genOffBus1:!generatorBus[1]||generatorBus[1]!=='GEN 1',genOffBus2:!generatorBus[2]||generatorBus[2]!=='GEN 2',
      groundPowerAvailable:src.external,
      masterCautionFuel:fuelMainCaution||ctrFuelCaution,
      masterCautionHyd:false, // Non-Normal/MASTER CAUTION logic NOT yet validated from FCOM
      systemAnnunciatorFuel:fuelMainCaution||ctrFuelCaution
    };
    return {sourceAvailable:src,generatorBus,transferBus,mainBus,acStandby,dc,fuel,hyd,systemHyd,indicators,
      qa:{loadRouting:CONFIG.loadBusStatus,masterCautionHyd:'NOT_MODELED',
        scope:'TRAINER_ONLY',sourceLocations:['FCOM 6.10.8-9 PDF1147-1148','FCOM 6.20.1-4 PDF1150-1153','FCOM 12.10.2-3 PDF1826-1827','FCOM 13.10.1 PDF1842']}};
  }
  function checklist(s){
    const d=derive(s),side=s.instructor.scenario==='bus2'?2:1;
    if(s.instructor.scenario==='none')return {id:'none',title:'Select a training scenario',steps:[],complete:false};
    const other=side===1?2:1;
    const stepData=[
      {id:'diagnose',title:'Identify the affected generator bus',done:d.indicators['busOff'+side],detail:'QRH condition, BUS OFF single, section 6.1; training cue'},
      {id:'isolation',title:'Confirm opposite generator bus remains available',done:Boolean(d.generatorBus[other]),detail:'Transfer bus status and source indication'},
      {id:'retry',title:'Attempt engine generator reconnect (if source healthy)',done:Boolean(d.generatorBus[side]),detail:'QRH branch: recovery can stop here; when fault persists proceed with alternate source'},
      {id:'alternate',title:'Restore affected bus using APU or external source',done:Boolean(d.generatorBus[side]),detail:'On this ground trainer, APU or external power can supply bus; route availability is simulated'},
      {id:'outcome',title:'Confirm BUS OFF extinguished and load state recalculated',done:!d.indicators['busOff'+side],detail:'Recheck fuel/hydraulic derived pump and warning states'}
    ];
    // Retry and alternate are alternative educational paths, not sequential checklist commands.
    const recovered=!d.indicators['busOff'+side];
    return {id:'bus-off-'+side,title:'BUS OFF ('+side+') — instructor-guided trainer',steps:stepData,
      complete:recovered,branch:recovered?'BUS RESTORED':'BUS STILL OFF',
      limitation:'Paraphrased training flow; not the actual QRH checklist. Original QRH 6.1-6.4 PDF 133-136.'};
  }
  function replay(commands){let s=initialState();for(const cmd of commands)s=apply(s,cmd);return s;}
  return Object.freeze({FUEL,HYD,FAULTS,LABELS,CONFIG,initialState,apply,derive,checklist,replay});
});