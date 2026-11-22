/* B737 Classic fire-bell shared audio demand gate. ATA26 remains sole authority. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737FireBellAuralGateV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SOURCES=Object.freeze(['aircraft','lab']);
  class FireBellGate{
    constructor(){this.demand={aircraft:false,lab:false};this.muted={aircraft:false,lab:false};}
    setDemand(source,enabled){
      if(!SOURCES.includes(source)||typeof enabled!=='boolean')throw Error('INVALID_FIRE_BELL_DEMAND');
      this.demand[source]=enabled;return this.snapshot();
    }
    setMuted(source,muted){
      if(!SOURCES.includes(source)||typeof muted!=='boolean')throw Error('INVALID_FIRE_BELL_MUTE');
      this.muted[source]=muted;return this.snapshot();
    }
    snapshot(){
      const active=SOURCES.filter(id=>this.demand[id]&&!this.muted[id]);
      return {active:active.length>0,sources:active,demand:{...this.demand},muted:{...this.muted}};
    }
    reset(){for(const source of SOURCES){this.demand[source]=false;this.muted[source]=false;}return this.snapshot();}
  }
  // Never derive a bell from a lamp, an overheat cue, or the entire fire state.
  // The ATA26 engine's FIRE_BELL output already applies power/CB, OVHT/FIRE
  // test, alert re-arm and BELL CUTOUT / fire-warning acknowledge logic.
  function fromATA26(derived){return derived?.indications?.FIRE_BELL===true;}
  return Object.freeze({FireBellGate,fromATA26,SOURCES});
});
