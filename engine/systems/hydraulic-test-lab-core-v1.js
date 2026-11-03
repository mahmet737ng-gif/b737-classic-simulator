/* HYD-LAB-CORE-0001
 * B737 Classic 300/400/500 trainer / ATA 29.
 * Pure deterministic hydraulic simulation: independently testable, no DOM and
 * no dependency on full cockpit. NOT APPROVED FOR FLIGHT/MAINTENANCE.
 *
 * Source backed architecture: A=ENG1+ELEC2, B=ELEC1+ENG2,
 * normal 3000 psi, 2800 psi dispatch check, 3500 psi maximum,
 * reservoir quantities displayed in %, brake accumulator charged by B.
 * Transients, leakage rates, switch failures, thresholds and heat-up rates
 * are EXPLICIT TRAINING APPROXIMATIONS, not certified aircraft dynamics.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicHydraulicLabCoreV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const COPY=x=>JSON.parse(JSON.stringify(x));
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const PUMP=Object.freeze({
  'hyd-eng-1':{system:'A',kind:'ENG',feed:'eng1',label:'ENG 1 · SYSTEM A'},
  'hyd-elec-2':{system:'A',kind:'ELEC',feed:'ac2',label:'ELEC 2 · SYSTEM A'},
  'hyd-elec-1':{system:'B',kind:'ELEC',feed:'ac1',label:'ELEC 1 · SYSTEM B'},
  'hyd-eng-2':{system:'B',kind:'ENG',feed:'eng2',label:'ENG 2 · SYSTEM B'}
 });
 const LAMP={ 'hyd-eng-1':'hyd-eng-1','hyd-elec-2':'hyd-elec-2','hyd-elec-1':'hyd-elec-1','hyd-eng-2':'hyd-eng-2' };
 const CATALOG=[];
 function add(id,label,category,effect,options={}){
  CATALOG.push(Object.freeze({id,label,category,effect,...options}));
 }
 // Normal modes are complete scenarios; individual failures can be stacked.
 const PRESETS=Object.freeze([
  {id:'healthy',label:'All systems healthy',category:'NORMAL',env:{eng1:true,eng2:true,ac1:true,ac2:true,onGround:true},switches:'ON',charge:true},
  {id:'cold',label:'Cold & Dark · zero pressure',category:'NORMAL',env:{eng1:false,eng2:false,ac1:false,ac2:false,onGround:true},switches:'OFF',charge:false},
  {id:'preflight',label:'Preflight · ENG pumps ON / ELEC OFF',category:'NORMAL',env:{eng1:false,eng2:false,ac1:true,ac2:true,onGround:true},switches:'ENG_ONLY',charge:false},
  {id:'eng1',label:'ENG 1 only · EDP A',category:'NORMAL',env:{eng1:true,eng2:false,ac1:false,ac2:false,onGround:true},switches:'ENG_ONLY'},
  {id:'eng2',label:'ENG 2 only · EDP B',category:'NORMAL',env:{eng1:false,eng2:true,ac1:false,ac2:false,onGround:true},switches:'ENG_ONLY'},
  {id:'electric',label:'Electric pumps only · ground',category:'NORMAL',env:{eng1:false,eng2:false,ac1:true,ac2:true,onGround:true},switches:'ELEC_ONLY'},
  {id:'pushback',label:'Pushback · System A isolated, B electric ON',category:'NORMAL',env:{eng1:false,eng2:false,ac1:true,ac2:true,onGround:true},switches:'B_ELEC_ONLY'},
  {id:'airborne',label:'Airborne · both engines / all pumps ON',category:'NORMAL',env:{eng1:true,eng2:true,ac1:true,ac2:true,onGround:false},switches:'ON'},
  {id:'a-lost',label:'System A LOST · B operating',category:'EMERGENCY',preset:'healthy',faults:['A_RAPID_LEAK']},
  {id:'b-lost',label:'System B LOST · A operating',category:'EMERGENCY',preset:'healthy',faults:['B_RAPID_LEAK']},
  {id:'dual-lost',label:'DUAL A + B HYD LOSS',category:'EMERGENCY',preset:'healthy',faults:['A_RAPID_LEAK','B_RAPID_LEAK']},
  {id:'engine-out1',label:'ENGINE 1 failure · electric pump A available',category:'ABNORMAL',preset:'healthy',env:{eng1:false}},
  {id:'engine-out2',label:'ENGINE 2 failure · electric pump B available',category:'ABNORMAL',preset:'healthy',env:{eng2:false}},
  {id:'dual-ac-loss',label:'AC GENERATOR / BUS 1+2 LOSS',category:'ABNORMAL',preset:'healthy',faults:['BOTH_AC_LOST']},
  {id:'brake-accum',label:'BRAKE ACCUMULATOR depleted',category:'EMERGENCY',preset:'healthy',faults:['ACCUMULATOR_LEAK']},
  {id:'standby',label:'STANDBY RUDDER selected',category:'ABNORMAL',preset:'healthy',env:{standbySelected:true}},
  {id:'reservoir-air',label:'Both hydraulic reservoirs unpressurized',category:'ABNORMAL',preset:'healthy',faults:['RES_A_AIR_LOSS','RES_B_AIR_LOSS']}
 ]);
 for(const [id,label,sys] of [
  ['ENG1_PUMP_FAIL','ENG 1 pump failed','A'],['ELEC2_PUMP_FAIL','ELEC 2 pump failed','A'],
  ['ELEC1_PUMP_FAIL','ELEC 1 pump failed','B'],['ENG2_PUMP_FAIL','ENG 2 pump failed','B'],
  ['ENG1_PUMP_LOW','ENG 1 pump low output','A'],['ELEC2_PUMP_LOW','ELEC 2 pump low output','A'],
  ['ELEC1_PUMP_LOW','ELEC 1 pump low output','B'],['ENG2_PUMP_LOW','ENG 2 pump low output','B'],
  ['ENG1_SHUTOFF_STUCK','ENG 1 EDP shutoff valve stuck closed','A'],
  ['ENG2_SHUTOFF_STUCK','ENG 2 EDP shutoff valve stuck closed','B'],
  ['ELEC2_CB_OPEN','ELEC 2 pump CB open','A'],['ELEC1_CB_OPEN','ELEC 1 pump CB open','B'],
  ['ELEC2_OVHT','ELEC 2 pump overheat','A'],['ELEC1_OVHT','ELEC 1 pump overheat','B'],
  ['ELEC2_THERMAL_TRIP','ELEC 2 motor thermal trip','A'],
  ['ELEC1_THERMAL_TRIP','ELEC 1 motor thermal trip','B']]){
  add(id,label,'PUMPS',id.endsWith('OVHT')?'OVERHEAT':id.includes('CB')?'ELECTRICAL':'PUMP', {system:sys});
 }
 for(const [id,label,cat,effect] of [
  ['AC1_BUS_LOST','AC BUS 1 loss · ELEC 1','POWER','ELECTRICAL'],
  ['AC2_BUS_LOST','AC BUS 2 loss · ELEC 2','POWER','ELECTRICAL'],
  ['BOTH_AC_LOST','AC BUS 1 + 2 loss','POWER','ELECTRICAL'],
  ['RES_A_AIR_LOSS','System A reservoir air pressure lost','POWER','SUPPLY'],
  ['RES_B_AIR_LOSS','System B reservoir air pressure lost','POWER','SUPPLY'],
  ['A_LEAK','Hydraulic System A slow leak','SYSTEM','LEAK'],
  ['B_LEAK','Hydraulic System B slow leak','SYSTEM','LEAK'],
  ['A_RAPID_LEAK','System A major hydraulic leak','SYSTEM','LEAK'],
  ['B_RAPID_LEAK','System B major hydraulic leak','SYSTEM','LEAK'],
  ['A_LOW_QTY','System A fluid quantity low','SYSTEM','QUANTITY'],
  ['B_LOW_QTY','System B fluid quantity low','SYSTEM','QUANTITY'],
  ['A_FLUID_OVERHEAT','System A fluid overheated','SYSTEM','THERMAL'],
  ['B_FLUID_OVERHEAT','System B fluid overheated','SYSTEM','THERMAL'],
  ['STBY_PUMP_FAIL','Standby hydraulic pump failed','STANDBY','PUMP'],
  ['STBY_QTY_LOW','Standby reservoir low quantity','STANDBY','QUANTITY'],
  ['STBY_PUMP_CB_OPEN','Standby pump CB open','STANDBY','ELECTRICAL'],
  ['STBY_LEAK','Standby hydraulic reservoir leak','STANDBY','LEAK'],
  ['AUTO_STBY_FAIL','Automatic standby activation failed','STANDBY','CONTROLLER'],
  ['STBY_PRESS_SENSOR_FAIL','Standby pressure sensor failed','STANDBY','SENSOR'],
  ['PTU_FAIL','PTU failure','FLIGHT_CONTROLS','CONTROLLER'],
  ['LGTU_FAIL','Landing gear transfer unit failure','FLIGHT_CONTROLS','CONTROLLER'],
  ['FLIGHT_CTRL_A_ISOLATED','Flight control A hydraulic isolation','FLIGHT_CONTROLS','VALVE'],
  ['FLIGHT_CTRL_B_ISOLATED','Flight control B hydraulic isolation','FLIGHT_CONTROLS','VALVE'],
  ['ALT_FLAP_BYPASS_FAIL','Alternate flap bypass valve failed','FLIGHT_CONTROLS','VALVE'],
  ['YAW_DAMPER_HYD_FAIL','Yaw damper hydraulic supply failure','FLIGHT_CONTROLS','CONTROLLER'],
  ['A_PRESS_SENSOR_OPEN','System A pressure sensor open','SENSORS','SENSOR'],
  ['B_PRESS_SENSOR_OPEN','System B pressure sensor open','SENSORS','SENSOR'],
  ['A_PRESS_SENSOR_STUCK','System A pressure sensor frozen at 3000','SENSORS','SENSOR'],
  ['B_PRESS_SENSOR_STUCK','System B pressure sensor frozen at 3000','SENSORS','SENSOR'],
  ['A_QTY_SENSOR_FAIL','System A quantity sensor failed','SENSORS','SENSOR'],
  ['B_QTY_SENSOR_FAIL','System B quantity sensor failed','SENSORS','SENSOR'],
  ['BRAKE_INDICATOR_FAIL','Brake pressure indicator failed','SENSORS','INDICATION'],
  ['ACCUMULATOR_LEAK','Brake accumulator internal leak','BRAKES','LEAK'],
  ['ACCUMULATOR_PRECHARGE_LOW','Brake accumulator nitrogen precharge low','BRAKES','PNEUMATIC'],
  ['BRAKE_SELECTOR_STUCK_B','Brake selector stuck normal','BRAKES','VALVE'],
  ['BRAKE_SELECTOR_STUCK_A','Brake selector stuck alternate','BRAKES','VALVE'],
  ['BRAKE_PIPE_LEAK','Brake pressure supply line leak','BRAKES','LEAK'],
  ['BRAKE_PEDAL_FAIL','Brake pedal metering valve failed','BRAKES','VALVE'],
  ['ANTISKID_FAIL','Anti-skid controller failed','BRAKES','CONTROLLER'],
  ['MASTER_CAUTION_HYD_FAIL','HYD Master Caution output failed','WARNINGS','INDICATION'],
  ['SIXPACK_HYD_LAMP_FAIL','FO HYD sixpack lamp failed','WARNINGS','INDICATION'],
  ['SIXPACK_HYD_STUCK_ON','FO HYD sixpack lamp stuck on','WARNINGS','INDICATION'],
  ['ENG1_LOW_LAMP_FAIL','ENG 1 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ELEC2_LOW_LAMP_FAIL','ELEC 2 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ELEC1_LOW_LAMP_FAIL','ELEC 1 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ENG2_LOW_LAMP_FAIL','ENG 2 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ELEC2_OVHT_LAMP_FAIL','ELEC 2 OVERHEAT lamp failed','WARNINGS','INDICATION'],
  ['ELEC1_OVHT_LAMP_FAIL','ELEC 1 OVERHEAT lamp failed','WARNINGS','INDICATION']
 ])add(id,label,cat,effect);
 const FAULTS=Object.freeze(CATALOG);
 const ALLOWED=new Set(FAULTS.map(f=>f.id));
 const DEFAULT_ENV=()=>({eng1:true,eng2:true,ac1:true,ac2:true,onGround:true,
  reservoirAir:true,standbySelected:false,alternateFlapsArmed:false,
  fireHandle1:false,fireHandle2:false,flapsDeg:0,airspeedKt:0});
 const SWITCHES=()=>Object.fromEntries(Object.keys(PUMP).map(id=>[id,'ON']));
 const initial=()=>({schema:'HYD-LAB-CORE-0001',time:0,env:DEFAULT_ENV(),switches:SWITCHES(),
  faults:[],pressure:{A:3000,B:3000,STBY:0},quantity:{A:100,B:100,STBY:100},
  brakeAccumulator:3000,brakeCount:0,masterAcknowledged:false,
  pumpHeat:{'hyd-elec-1':30,'hyd-elec-2':30}});
 const faulted=(s,id)=>s.faults.includes(id);
 const command=(state,cmd)=>{
  if(!cmd||typeof cmd!=='object')throw Error('Hydraulic command required');
  const s=COPY(state),id=cmd.id;
  switch(cmd.type){
   case 'SET_SWITCH':
    if(!PUMP[id]||!['ON','OFF'].includes(cmd.value))throw Error('Invalid physical hydraulic switch');
    s.switches[id]=cmd.value;break;
   case 'SET_ENV':
    if(!Object.hasOwn(s.env,id))throw Error('Unknown hydraulic environment input');
    if(['flapsDeg','airspeedKt'].includes(id)){if(!Number.isFinite(cmd.value))throw Error('Invalid numeric environment input');s.env[id]=clamp(cmd.value,0,id==='flapsDeg'?40:550);}
    else if(typeof cmd.value==='boolean')s.env[id]=cmd.value;else throw Error('Boolean environment input required');
    break;
   case 'INJECT':
    if(!ALLOWED.has(id))throw Error('Unknown hydraulic failure '+id);
    if(!s.faults.includes(id))s.faults.push(id);break;
   case 'CLEAR':
    if(!ALLOWED.has(id))throw Error('Unknown hydraulic failure '+id);
    s.faults=s.faults.filter(x=>x!==id);break;
   case 'CLEAR_ALL':s.faults=[];break;
   case 'ACK':s.masterAcknowledged=true;break;
   case 'RECALL':s.masterAcknowledged=false;break;
   case 'BRAKE':
    if(!Number.isFinite(cmd.count)||cmd.count<1||cmd.count>50)throw Error('Invalid brake application count');
    s.brakeCount+=Math.round(cmd.count);
    const bSupply=s.pressure.B>2400&&!faulted(s,'BRAKE_PIPE_LEAK');
    const aSupply=s.pressure.A>2400&&!faulted(s,'BRAKE_SELECTOR_STUCK_B');
    if(!bSupply&&!aSupply&&!faulted(s,'BRAKE_PEDAL_FAIL'))s.brakeAccumulator=clamp(s.brakeAccumulator-340*cmd.count,0,3500);
    break;
   case 'SET_QTY':
    if(!['A','B','STBY'].includes(id)||!Number.isFinite(cmd.value))throw Error('Invalid hydraulic reservoir quantity');
    s.quantity[id]=clamp(cmd.value,0,106);break;
   case 'RESET':return initial();
   default:throw Error('Unknown hydraulic command '+cmd.type);
  }
  return s;
 };
 function loadPreset(id){
  const p=PRESETS.find(x=>x.id===id);
  if(!p)throw Error('Unknown hydraulic scenario '+id);
  let s=initial();
  const base=PRESETS.find(x=>x.id===p.preset)||p;
  s.env={...s.env,...base.env,...p.env};
  const mode=base.switches||'ON';
  for(const key of Object.keys(s.switches)){
   const kind=PUMP[key].kind,sys=PUMP[key].system;
   s.switches[key]=mode==='ON'?'ON':mode==='OFF'?'OFF':
    mode==='ENG_ONLY'?(kind==='ENG'?'ON':'OFF'):
    mode==='ELEC_ONLY'?(kind==='ELEC'?'ON':'OFF'):
    mode==='B_ELEC_ONLY'?(key==='hyd-elec-1'?'ON':'OFF'):'OFF';
  }
  s.faults=[...(p.faults||[])];
  if(p.charge===false){s.pressure={A:0,B:0,STBY:0};s.brakeAccumulator=p.id==='preflight'?2800:0;}
  if(p.id==='brake-accum'){
   // Depleted accumulator cannot remain depleted with a healthy, charging B supply.
   s.env.eng2=false;s.env.ac1=false;
   s.pressure.B=0;s.brakeAccumulator=1000;
  }
  return s;
 }
 function onePump(s,id){
  const p=PUMP[id],env=s.env,sys=p.system,engNum=id==='hyd-eng-1'?'1':id==='hyd-eng-2'?'2':null;
  const token=engNum?'ENG'+engNum:id==='hyd-elec-1'?'ELEC1':'ELEC2';
  const fail=faulted(s,token+'_PUMP_FAIL')||faulted(s,token+'_THERMAL_TRIP')||
   faulted(s,token+'_SHUTOFF_STUCK')||faulted(s,token+'_CB_OPEN');
  const bus= p.kind==='ELEC'? (p.feed==='ac1'?env.ac1:env.ac2) &&
   !faulted(s,p.feed==='ac1'?'AC1_BUS_LOST':'AC2_BUS_LOST')&&!faulted(s,'BOTH_AC_LOST'):true;
  const running=p.kind==='ENG'?(engNum==='1'?env.eng1:env.eng2):true;
  const blocked=p.kind==='ENG'&&(engNum==='1'?env.fireHandle1:env.fireHandle2);
  const q=s.quantity[sys];
  const inletOk=env.reservoirAir&&!faulted(s,'RES_'+sys+'_AIR_LOSS');
  const active=s.switches[id]==='ON'&&running&&bus&&!blocked&&!fail&&q>3;
  let strength=active?1:0;
  if(faulted(s,token+'_PUMP_LOW'))strength=.48;
  if(!inletOk)strength*=.5;
  if(q<15)strength*=clamp(q/15,0,1);
  if(faulted(s,token+'_OVHT'))strength*=.65;
  const outPressure=clamp(3000*strength,0,3500);
  const overheat=faulted(s,token+'_OVHT');
  return {id,system:sys,kind:p.kind,switch:s.switches[id],powered:bus,running,blocked,
   active,delivering:outPressure>1500,pressurePsi:outPressure,overheat,
   lowPressure:outPressure<2000,fireLampInhibited:blocked&&p.kind==='ENG'};
 }
 function evaluate(s){
  if(s?.schema!=='HYD-LAB-CORE-0001')throw Error('Invalid hydraulic state');
  const pumps=Object.fromEntries(Object.keys(PUMP).map(id=>[id,onePump(s,id)]));
  const pressure={...s.pressure},q={...s.quantity};
  const pa=faulted(s,'A_PRESS_SENSOR_OPEN')?null:faulted(s,'A_PRESS_SENSOR_STUCK')?3000:Math.round(pressure.A);
  const pb=faulted(s,'B_PRESS_SENSOR_OPEN')?null:faulted(s,'B_PRESS_SENSOR_STUCK')?3000:Math.round(pressure.B);
  const qa=faulted(s,'A_QTY_SENSOR_FAIL')?null:Math.round(q.A);
  const qb=faulted(s,'B_QTY_SENSOR_FAIL')?null:Math.round(q.B);
  const brake=faulted(s,'BRAKE_INDICATOR_FAIL')?null:Math.round(s.brakeAccumulator);
  const normalBrakes=pressure.B>2200&&!faulted(s,'BRAKE_SELECTOR_STUCK_A')&&!faulted(s,'BRAKE_PIPE_LEAK');
  const alternateBrakes=!normalBrakes&&pressure.A>2200&&!faulted(s,'BRAKE_SELECTOR_STUCK_B')&&!faulted(s,'BRAKE_PIPE_LEAK');
  const brakeMode=faulted(s,'BRAKE_PEDAL_FAIL')?'FAILED':normalBrakes?'NORMAL_B':alternateBrakes?'ALTERNATE_A':brake>1000?'ACCUMULATOR_ONLY':'UNAVAILABLE';
  const standbyDemand=s.env.standbySelected||s.env.alternateFlapsArmed||
   (!s.env.onGround&&s.env.flapsDeg>0&&(pressure.A<1800||pressure.B<1800)&&!faulted(s,'AUTO_STBY_FAIL'));
  const alertLowPump=Object.values(pumps).some(p=>p.lowPressure&&!p.fireLampInhibited);
  const alertHyd=alertLowPump||pressure.A<2200||pressure.B<2200||q.A<20||q.B<20;
  const failedLamp=id=>faulted(s,id);
  const lamps={};
  for(const [id,p] of Object.entries(pumps)){
   const k=id==='hyd-eng-1'?'ENG1':id==='hyd-eng-2'?'ENG2':id==='hyd-elec-1'?'ELEC1':'ELEC2';
   lamps[id]=p.lowPressure&&!p.fireLampInhibited&&!failedLamp(k+'_LOW_LAMP_FAIL');
  }
  for(const id of ['hyd-elec-1','hyd-elec-2']){
   const k=id==='hyd-elec-1'?'ELEC1':'ELEC2';
   lamps[id+'-overheat']=pumps[id].overheat&&!failedLamp(k+'_OVHT_LAMP_FAIL');
  }
  lamps['flight-pressure-a']=pressure.A<1800&&!faulted(s,'FLIGHT_CTRL_A_ISOLATED');
  lamps['flight-pressure-b']=pressure.B<1800&&!faulted(s,'FLIGHT_CTRL_B_ISOLATED');
  lamps['stby-pressure']=standbyDemand&&(pressure.STBY<1800||faulted(s,'STBY_PRESS_SENSOR_FAIL'));
  lamps['stby-quantity']=q.STBY<25||faulted(s,'STBY_QTY_LOW');
  lamps['stby-rudder']=standbyDemand&&pressure.STBY>1800;
  const sixPackHyd=failedLamp('SIXPACK_HYD_STUCK_ON')||
   (alertHyd&&!failedLamp('SIXPACK_HYD_LAMP_FAIL'));
  return Object.freeze({schema:'HYD-LAB-CORE-0001/OUT',time:s.time,
   pressurePsi:{A:Math.round(pressure.A),B:Math.round(pressure.B),STBY:Math.round(pressure.STBY),BRAKE:Math.round(s.brakeAccumulator)},
   quantityPct:{A:Math.round(q.A),B:Math.round(q.B),STBY:Math.round(q.STBY)},
   indications:{'eng.hyd_pressure.a':pa,'eng.hyd_pressure.b':pb,
    'eng.hyd_qty.a':qa,'eng.hyd_qty.b':qb,'fo.hyd_brake_pressure':brake},
   lamps,alerts:{sixPackHyd,masterCaution:alertHyd&&!failedLamp('MASTER_CAUTION_HYD_FAIL')&&!s.masterAcknowledged,
    recallHyd:alertHyd,acknowledged:s.masterAcknowledged,masterCautionAuthority:'LAB_TRAINING_APPROX'},
   pumps,brakes:{mode:brakeMode,normalBrakes,alternateBrakes,accumulatorPsi:Math.round(s.brakeAccumulator)},
   standby:{selected:standbyDemand,active:pressure.STBY>1800},
   warnings:{systemA:pressure.A<2200,systemB:pressure.B<2200,
    reservoirA:q.A<40,reservoirB:q.B<40},
   faults:[...s.faults],quality:'TRAINING_SIMULATION_ONLY',
   sourceNote:'ATA 29 / B737 Classic FCOM principles; pressure transients, thresholds, leaks and warning timing approximate'});
 }
 function step(state,seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>60)throw Error('Invalid hydraulic elapsed seconds');
  let s=COPY(state);
  let left=seconds;
  while(left>0){
   const dt=Math.min(.1,left);left=Math.max(0,left-dt);
   const pp=Object.fromEntries(Object.keys(PUMP).map(id=>[id,onePump(s,id)]));
   for(const sys of ['A','B']){
    const options=Object.values(pp).filter(p=>p.system===sys);
    const strong=Math.max(...options.map(p=>p.pressurePsi));
    const leak=faulted(s,sys+'_RAPID_LEAK')?5.0:faulted(s,sys+'_LEAK')?0.9:0;
    if(leak)s.quantity[sys]=clamp(s.quantity[sys]-leak*dt,0,106);
    if(faulted(s,sys+'_LOW_QTY'))s.quantity[sys]=Math.min(s.quantity[sys],24);
    const target=clamp(strong*(1-(faulted(s,sys+'_RAPID_LEAK')?.68:faulted(s,sys+'_LEAK')?.15:0)),0,3500);
    const tau=target>s.pressure[sys]?(options.some(p=>p.kind==='ENG'&&p.delivering)?1.4:2.8):3.3;
    const gain=1-Math.exp(-dt/tau);
    s.pressure[sys]+= (target-s.pressure[sys])*gain;
    if(s.pressure[sys]<.1)s.pressure[sys]=0;
   }
   const standbySelected=s.env.standbySelected||s.env.alternateFlapsArmed||
     (!s.env.onGround&&s.env.flapsDeg>0&&(s.pressure.A<1800||s.pressure.B<1800)&&!faulted(s,'AUTO_STBY_FAIL'));
   if(faulted(s,'STBY_LEAK'))s.quantity.STBY=clamp(s.quantity.STBY-1.3*dt,0,106);
   if(faulted(s,'STBY_QTY_LOW'))s.quantity.STBY=Math.min(s.quantity.STBY,20);
   const sOn=standbySelected&&s.env.ac1&&!faulted(s,'BOTH_AC_LOST')&&!faulted(s,'AC1_BUS_LOST')&&
     !faulted(s,'STBY_PUMP_FAIL')&&!faulted(s,'STBY_PUMP_CB_OPEN')&&s.quantity.STBY>4;
   const targetS=sOn?3000:0;
   s.pressure.STBY+=(targetS-s.pressure.STBY)*(1-Math.exp(-dt/(sOn?1.8:3.2)));
   // A/B pressure is not a direct brake accumulator gauge. B charges it;
   // loss of B preserves trapped pressure until use or leakage.
   const charging=s.pressure.B>2400&&!faulted(s,'BRAKE_PIPE_LEAK');
   const targetAcc=clamp(s.pressure.B,0,3500);
   if(charging)s.brakeAccumulator+=(targetAcc-s.brakeAccumulator)*(1-Math.exp(-dt/2));
   if(faulted(s,'ACCUMULATOR_LEAK'))s.brakeAccumulator=clamp(s.brakeAccumulator-150*dt,0,3500);
   if(faulted(s,'ACCUMULATOR_PRECHARGE_LOW'))s.brakeAccumulator=Math.min(s.brakeAccumulator,1400);
   s.time+=dt;
  }
  return s;
 }
 return Object.freeze({
  VERSION:'HYD-LAB-CORE-0001',PUMP,FAULTS,PRESETS,
  initial,loadPreset,command,step,evaluate,
  getFault:id=>FAULTS.find(x=>x.id===id)||null,clone:COPY
 });
});
