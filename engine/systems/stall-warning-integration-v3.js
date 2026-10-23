/* Isolated adapter. Shares existing Systems Integration V2 session; root UI unchanged. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737StallIntegrationV3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 class StallSession{
  constructor({Stall,Session,core,WarningEngine}={}){
   if(!Stall||!Session||!core||!WarningEngine)throw Error('Existing trainer dependencies required');
   this.Stall=Stall;this.base=new Session({core,WarningEngine});this.state=Stall.initialState();
   this.input={onGround:true,ac115Available:true,flaps:5,fmcGrossWeightAvailable:null,engineN1Pct:25,engineN2Pct:70};this.log=[];
   this._sync();
  }
  _sync(){
   const stall=this.Stall.evaluate(this.state,this.input);
   this.base.send({type:'ENV',key:'onGround',value:this.input.onGround});
   this.base.send({type:'ENV',key:'stallWarning',value:stall.physical.flightShakerRequested,instructor:true});
   this.base.send({type:'ENV',key:'wingFlaps',value:this.input.flaps});
   this.output={stall,systems:this.base.render(),audioRequested:stall.physical.flightShakerRequested};
   return this.output;
  }
  send(action){
   if(!action||typeof action.type!=='string')throw Error('Action required');
   if(action.type==='RESET'){
    this.state=this.Stall.initialState();this.base.send({type:'RESET'});
    this.input={onGround:true,ac115Available:true,flaps:5,fmcGrossWeightAvailable:null,engineN1Pct:25,engineN2Pct:70};this.log=[];return this._sync();
   }
   if(action.type==='INPUT'){
    if(!Object.prototype.hasOwnProperty.call(this.input,action.key))throw Error('Unknown sensor');
    if(['onGround','ac115Available'].includes(action.key)&&typeof action.value!=='boolean')throw Error('Boolean expected');
    if(['flaps','engineN1Pct','engineN2Pct'].includes(action.key)&&!Number.isFinite(action.value))throw Error('Finite number expected');
    if(action.key==='fmcGrossWeightAvailable'&&![true,false,null].includes(action.value))throw Error('Boolean or null expected');
    this.input[action.key]=action.value;
   }else this.state=this.Stall.apply(this.state,action);
   this.log.push(JSON.parse(JSON.stringify(action)));return this._sync();
  }
  replay(commands){this.send({type:'RESET'});for(const c of commands)this.send(c);return this.output;}
 }
 return Object.freeze({StallSession});
});