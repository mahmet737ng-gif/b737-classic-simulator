/* Single-device electrical bridge, preserving independently versioned systems.
   Auto-handoff only for logical impossibility (global 115VAC absent).
   It does not mutate legacy systems or use their training-only bus assignment. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ElectricalIntegrationV8=api;})
(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 class Session{
  constructor({Electrical,Loads,Stall}={}){
   if(!Electrical?.initialState||!Electrical?.apply||!Electrical?.evaluate||!Loads?.project||!Stall?.initialState||!Stall?.evaluate)throw Error('Electrical V7, Loads V8 and Stall V3 required');
   this.Electrical=Electrical;this.Loads=Loads;this.Stall=Stall;this.reset();
  }
  reset(){this.eState=this.Electrical.initialState();this.sState=this.Stall.initialState();this.stallInputs={onGround:true,ac115Available:null,flaps:5,fmcGrossWeightAvailable:null,engineN1Pct:25,engineN2Pct:70};this.commands=[];return this.render();}
  send(cmd){if(!cmd||typeof cmd.type!=='string')throw Error('Action required');if(cmd.type==='RESET')return this.reset();
   if(cmd.type==='ELECTRICAL'){this.eState=this.Electrical.apply(this.eState,cmd.action);}
   else if(cmd.type==='STALL'){this.sState=this.Stall.apply(this.sState,cmd.action);}
   else if(cmd.type==='SENSOR'){
    if(cmd.key==='onGround'&&typeof cmd.value==='boolean'){this.stallInputs.onGround=cmd.value;this.eState=this.Electrical.apply(this.eState,{type:'CONTROL',key:'onGround',value:cmd.value});}
    else throw Error('Only shared onGround sensor is modeled');
   }else if(cmd.type==='INSTRUCTOR_TEST_POWER'){
    if(![true,false,null].includes(cmd.value)||cmd.instructor!==true)throw Error('Instructor override required');
    this.stallInputs.ac115Available=cmd.value;
   } else throw Error('Unknown composite action');
   this.commands.push(JSON.parse(JSON.stringify(cmd)));return this.render();
  }
  render(){const electrical=this.Electrical.evaluate(this.eState);const loads=this.Loads.project(electrical);const handoff=this.Loads.handoff(loads);
   const known=this.stallInputs.ac115Available;
   // When no 115VAC exists anywhere, an instructor cannot make a real test succeed.
   const ac115=handoff.stallGroundTest.ac115Available===false?false:known;
   // V3's input API demands a Boolean; when UNKNOWN, stall output isn't computed.
   const stall=ac115===null?null:this.Stall.evaluate(this.sState,{...this.stallInputs,ac115Available:ac115});
   return {schema:'B737_ELECTRICAL_CROSS_SYSTEM_V8',electrical,loads,handoff,stall,
    trainingInput:{stall115vAcOverride:known,stall115vAcEffective:ac115},
    limitations:['NO_PHYSICAL_LRU_BUS_MAP','UNKNOWN_IS_NOT_FALSE','STALL_OUTPUT_BLOCKED_UNTIL_POWER_EVIDENCE','DCPCS_POWER_INPUT_NOT_AUTOWIRED','OTHER_SYSTEM_STATES_UNCHANGED']};
  }
  replay(commands){this.reset();for(const c of commands)this.send(c);return this.render();}
 }
 return Object.freeze({Session});
});