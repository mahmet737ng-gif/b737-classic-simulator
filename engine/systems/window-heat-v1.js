/* 737 Classic Window Heat training core v1: FCOM 3.10/3.20, SP.3.1-2, MRG IV.3/IV.6.
 * Generic procedural trainer, NOT aircraft-specific WDM/AMM or certified dispatch logic.
 * No changes to approved panel artwork or switch mechanics.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737WindowHeatV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const CHANNELS=Object.freeze({
  'L_FWD':{switchId:'window-l-fwd',onId:'window-l-fwd-on',ovhtId:'window-l-fwd-overheat',heaterBus:'generator1',controllerAC:'main1',controllerDC:'dc1',heaterCB:'P6-11|ALL|B9',controllerCB:'P18-3|ALL|F1',target:40,cutout:63,restore:43,group:'L1'},
  'L_SIDE':{switchId:'window-l-side',onId:'window-l-side-on',ovhtId:'window-l-side-overheat',heaterBus:'generator2',controllerAC:'main2',controllerDC:'dc2',heaterCB:'P6-12|ALL|B9',controllerCB:'P18-3|ALL|F3',target:32,cutout:49,restore:27,group:'L2'},
  'R_FWD':{switchId:'window-r-fwd',onId:'window-r-fwd-on',ovhtId:'window-r-fwd-overheat',heaterBus:'generator2',controllerAC:'main2',controllerDC:'dc2',heaterCB:'P6-12|ALL|B8',controllerCB:'P18-3|ALL|E1',target:40,cutout:63,restore:43,group:'R1'},
  'R_SIDE':{switchId:'window-r-side',onId:'window-r-side-on',ovhtId:'window-r-side-overheat',heaterBus:'generator1',controllerAC:'main1',controllerDC:'dc1',heaterCB:'P6-11|ALL|B8',controllerCB:'P18-3|ALL|E3',target:32,cutout:49,restore:27,group:'R2'}
 });
 const AUX=Object.freeze({
  'L45':{switchId:'window-l-side',bus:'generator1',breaker:'P6-11|ALL|B7',label:'L4/L5 DEFOG'},
  'R45':{switchId:'window-r-side',bus:'generator2',breaker:'P6-12|ALL|B7',label:'R4/R5 DEFOG'}
 });
 const PHOTO_CB=Object.freeze({ 'P6-11|ALL|B9':'WINDOW ANTI-ICE L FRONT','P6-11|ALL|B8':'WINDOW ANTI-ICE R SIDE','P6-12|ALL|B9':'WINDOW ANTI-ICE L SIDE','P6-12|ALL|B8':'WINDOW ANTI-ICE R FRONT',
 'P18-3|ALL|F1':'WINDOW HEAT CONTROL L FRONT AC','P18-3|ALL|F3':'WINDOW HEAT CONTROL L SIDE AC','P18-3|ALL|E1':'WINDOW HEAT CONTROL R FRONT AC','P18-3|ALL|E3':'WINDOW HEAT CONTROL R SIDE AC' });
 const ALL_CBS=Object.freeze([...Object.keys(PHOTO_CB),AUX.L45.breaker,AUX.R45.breaker]);
 const FAULTS=Object.freeze(['HEATER_FAIL','CONTROLLER_FAIL','SENSOR_FAIL','STUCK_OVERHEAT','POWER_TEST_FAIL']);
 // Trainer behavior requested by the owner: clear test-generated amber after
 // 60 seconds, or immediately for one channel when its own switch goes OFF.
 // The timer is a simulator behavior choice; normal thermal overheat remains.
 const OVHT_TEST_DURATION_SECONDS=60;
 const OVHT_ON_EXPIRE_SECONDS=60;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function initialState(){return {schema:'b737-window-heat/1',elapsed:0,test:'NEUTRAL',ovhtTestElapsed:null,channels:Object.fromEntries(Object.keys(CHANNELS).map(k=>[k,{temp:18,heating:false,overheat:false,ovhtTestLatched:false,ovhtTestGreen:false,lastGreen:null,lastSwitch:false}])),aux:{L45:{temp:18,heating:false,thermostatOn:true},R45:{temp:18,heating:false,thermostatOn:true}},faults:Object.fromEntries(Object.keys(CHANNELS).map(k=>[k,{}]))};}
 function injectFault(s,channel,fault,active){if(!CHANNELS[channel]||!FAULTS.includes(fault)||typeof active!=='boolean')throw Error('Invalid Window Heat instructor fault');const n=copy(s);n.faults[channel][fault]=active;return n;}
 const breakerClosed=(cbs,key)=>!cbs||cbs[key]!==false;
 const busOk=(buses,key)=>!!buses&&buses[key]===true;
 function step(s,input={},seconds=0){
  if(!s||s.schema!=='b737-window-heat/1')throw Error('Invalid Window Heat state');
  if(!Number.isFinite(seconds)||seconds<0||seconds>300)throw Error('Invalid time step');
  const n=copy(s),sw=input.switches||{},b=input.buses||{},cb=input.breakers||{},test=['OVHT','PWR TEST'].includes(sw['window-power-test'])?sw['window-power-test']:'NEUTRAL';
  n.elapsed+=seconds;n.test=test;
  // Spring detent starts the timer only on entry; holding OVHT cannot
  // repeat the test. OFF->ON clears the associated channel independently.
  const startingOvhtTest=test==='OVHT'&&s.test!=='OVHT';
  if(startingOvhtTest)n.ovhtTestElapsed=0;
  else if(n.ovhtTestElapsed!==null)n.ovhtTestElapsed+=seconds;
  const ovhtExpired=n.ovhtTestElapsed!==null&&n.ovhtTestElapsed>=OVHT_TEST_DURATION_SECONDS;
  const outputs={},auxOut={};
  for(const [id,d] of Object.entries(CHANNELS)){
    const q=n.channels[id],f=n.faults[id]||{},selected=sw[d.switchId]==='ON';
    if(!selected||ovhtExpired){q.ovhtTestLatched=false;q.ovhtTestGreen=false;}
    if(!selected){q.overheat=false;q.lastGreen=false;q.lastSwitch=false;}
    const controller=busOk(b,d.controllerAC)&&busOk(b,d.controllerDC)&&breakerClosed(cb,d.controllerCB)&&!f.CONTROLLER_FAIL&&!f.SENSOR_FAIL;
    const heaterBus=busOk(b,d.heaterBus),heaterCB=breakerClosed(cb,d.heaterCB);
    // Only an electrically available channel may illuminate its green/amber
    // annunciators. Loss of MAIN/GEN/DC or heater/controller CB does NOT
    // represent a real thermal overheat. Keep real temperature state
    // independent of lamp power so a genuine hot window can be indicated
    // again when the electrical supply is restored.
    const indicationPowered=controller&&heaterBus&&heaterCB;
    const supply=indicationPowered&&!f.HEATER_FAIL;
    // OVHT test is a powered, per-channel latch. A loss of supply cancels
    // that channel's test without generating a deferred warning on restore.
    if(!indicationPowered){q.ovhtTestLatched=false;q.ovhtTestGreen=false;}
    if(startingOvhtTest&&selected&&indicationPowered){
      // Preserve the PRE-TEST ON indication. SP.3.2 does not turn an
      // extinguished green light ON during the overheat test; instead,
      // illuminated ON lights go out after approximately one minute.
      q.ovhtTestGreen=q.lastGreen===null
        ?(supply&&q.temp<d.target-1.5&&!q.overheat):q.lastGreen;
      q.ovhtTestLatched=true;
    }
    const forcedOverheat=Boolean(f.STUCK_OVERHEAT||q.ovhtTestLatched);
    if(!forcedOverheat&&q.overheat&&q.temp<=d.restore)q.overheat=false;
    if(q.temp>=d.cutout||f.STUCK_OVERHEAT)q.overheat=true;
    // Temperature control uses intentionally approximate targets, not asserted FCOM values.
    const requestingHeat=selected&&(test==='PWR TEST'&&!f.POWER_TEST_FAIL||q.temp<d.target-1.5);
    const blocked=forcedOverheat||q.overheat;
    const heater=supply&&requestingHeat&&!blocked;
    q.temp=Math.max(-50,Math.min(100,q.temp+(heater?(test==='PWR TEST'?0.20:0.08):-0.025)*seconds));
    if(q.temp>=d.cutout){q.overheat=true;}
    q.heating=heater&&!q.overheat;
    // A loss of electrical feed/controller/CB is NOT an overheat indication.
    // It suppresses normal heat/green ON; amber OVERHEAT is only a real
    // thermal condition or the explicitly initiated OVHT test.
    const overheat=selected&&indicationPowered&&(q.overheat||q.ovhtTestLatched);
    const pendingOvhtTest=q.ovhtTestLatched&&n.ovhtTestElapsed!==null&&n.ovhtTestElapsed<OVHT_ON_EXPIRE_SECONDS;
    // Green ON means the selected window's heating control is available,
    // NOT that current happens to be flowing through its thermostatically
    // cycled heater at this precise instant. The 32C side windows reach
    // their target before the 40C forward windows. Binding ON to q.heating
    // incorrectly caused side lamps to go dark and forward lamps to flash.
    // Keep the approved OVHT-test 60-second latch and OFF-switch PWR TEST.
    const green=test==='PWR TEST'
      ?(supply&&!blocked&&!f.POWER_TEST_FAIL)
      :selected&&(q.ovhtTestLatched
        ?(pendingOvhtTest&&q.ovhtTestGreen&&supply)
        :(supply&&!blocked));
    q.lastGreen=!!green;
    outputs[id]={id,selected,temperatureC:Math.round(q.temp*10)/10,heaterPower:q.heating,controllerPower:controller,heaterFeed:heaterBus,indicationPowered,cbHeaterClosed:heaterCB,cbControllerClosed:breakerClosed(cb,d.controllerCB),normalTargetApproxC:d.target,overheatLimitC:d.cutout,restoreLimitC:d.restore,greenOn:!!green,overheatOn:!!overheat,warning:!!overheat,source:'FCOM+MRG_GENERIC_TRAINER'};
    q.lastSwitch=selected;
  }
  // No electronic WHCU on L4/L5 and R4/R5; independent generator bus/CB and thermal cycling.
  for(const [id,d] of Object.entries(AUX)){
    const q=n.aux[id],selected=sw[d.switchId]==='ON',supply=busOk(b,d.bus)&&breakerClosed(cb,d.breaker);
    if(q.temp>=38)q.thermostatOn=false;else if(q.temp<=34)q.thermostatOn=true;
    q.heating=selected&&supply&&q.thermostatOn;
    q.temp=Math.max(-50,Math.min(70,q.temp+(q.heating?0.06:-0.02)*seconds));
    auxOut[id]={selected,heaterPower:q.heating,temperatureC:Math.round(q.temp*10)/10,cbClosed:breakerClosed(cb,d.breaker),busPowered:busOk(b,d.bus),label:d.label,thermostatTargetApproxC:38};
  }
  if(!Object.values(n.channels).some(q=>q.ovhtTestLatched))n.ovhtTestElapsed=null;
  const antiIceCaution=Object.values(outputs).some(v=>v.overheatOn);
  return {state:n,output:{schema:'B737_WINDOW_HEAT_V1_RESULT',channels:outputs,aux:auxOut,annunciations:{antiIceCaution,masterCautionRequest:antiIceCaution},test,elapsed:n.elapsed,notes:'generic simulator temperatures and timings; not dispatch authority'}};
 }
 return Object.freeze({CHANNELS,AUX,PHOTO_CB,ALL_CBS,FAULTS,OVHT_TEST_DURATION_SECONDS,OVHT_ON_EXPIRE_SECONDS,initialState,injectFault,step});
});
