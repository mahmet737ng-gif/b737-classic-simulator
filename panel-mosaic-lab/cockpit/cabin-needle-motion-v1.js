/* OH19 cabin ALT / PRESS needle animation: visual interpolation only.
 * The physical CPCS/DCPCS plant remains the sole source of target bearings.
 * Repeated unchanged telemetry never restarts an in-flight transition.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737CabinNeedleMotionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  class Motion{
    constructor(initial={},options={}){
      this.durationMs=finite(options.durationMs)?Math.max(100,Math.min(3000,options.durationMs)):960;
      this.points={};
      for(const [id,angle] of Object.entries(initial)){
        if(!finite(angle))throw Error('INVALID_INITIAL_CABIN_NEEDLE_ANGLE');
        this.points[id]={from:angle,target:angle,visible:angle,start:0,end:0};
      }
    }
    advance(now){
      if(!finite(now))throw Error('INVALID_CABIN_NEEDLE_CLOCK');
      for(const point of Object.values(this.points)){
        if(point.end<=point.start){point.visible=point.target;continue;}
        const t=Math.max(0,Math.min(1,(now-point.start)/(point.end-point.start)));
        point.visible=point.from+(point.target-point.from)*t;
        if(t===1){point.from=point.target;point.start=point.end;}
      }
      return this.view();
    }
    retarget(id,angle,now){
      const point=this.points[id];
      if(!point||!finite(angle)||!finite(now))throw Error('INVALID_CABIN_NEEDLE_TARGET');
      this.advance(now);
      // The flight model publishes unchanged samples repeatedly between
      // physical pressure ticks. Never reset the animation clock for those.
      if(Math.abs(point.target-angle)<1e-7)return point.visible;
      point.from=point.visible;point.target=angle;point.start=now;
      point.end=now+this.durationMs;
      return point.visible;
    }
    snap(id,angle){
      const point=this.points[id];
      if(!point||!finite(angle))throw Error('INVALID_CABIN_NEEDLE_SNAP');
      point.from=angle;point.target=angle;point.visible=angle;
      point.start=point.end=0;return angle;
    }
    get(id){if(!this.points[id])throw Error('UNKNOWN_CABIN_NEEDLE');return this.points[id].visible;}
    target(id){if(!this.points[id])throw Error('UNKNOWN_CABIN_NEEDLE');return this.points[id].target;}
    moving(now){return Object.values(this.points).some(p=>p.end>p.start&&now<p.end&&Math.abs(p.target-p.visible)>1e-5);}
    view(){return Object.fromEntries(Object.entries(this.points).map(([id,p])=>[id,p.visible]));}
  }
  return Object.freeze({Motion});
});
