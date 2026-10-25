/* Convert a verified scale + ISM sensor sample into a display target.
   No implicit unit conversion, no invented failure parking position,
   and no fixed turn direction: signed target error determines motion. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737GaugeSignalDriverV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const canonicalUnit=x=>{
    if(typeof x!=='string')return null;
    const s=x.trim().toLowerCase().replace(/\s+/g,'');
    if(['hertz','hz','cps','cyclespersecond'].includes(s))return 'Hz';
    if(['c','°c','celsius','degc'].includes(s))return '°C';
    if(['psi'].includes(s))return 'psi';
    if(['v','volt','volts'].includes(s))return 'V';
    if(['a','amp','amps','ampere','amperes'].includes(s))return 'A';
    if(['ft/min','fpm'].includes(s))return 'ft/min';
    return s;
  };
  function make({id,calibration,motion}={}){
    if(!id||!calibration||typeof calibration.read!=='function')
      throw Error('Needle ID and compiled numeric scale are required');
    if(!motion||!['direct','slew','first_order'].includes(motion.mode))
      throw Error('Explicit physical response model required');
    if(motion.mode==='slew'&&(!finite(motion.degreesPerSecond)||motion.degreesPerSecond<=0))
      throw Error('Needle slew speed required');
    if(motion.mode==='first_order'&&(!finite(motion.tauSeconds)||motion.tauSeconds<=0))
      throw Error('Needle time constant required');
    let current=null,lastTarget=null;
    function advance(sample,seconds=0,options){
      if(!finite(seconds)||seconds<0)throw Error('Valid nonnegative time step required');
      if(!sample||!finite(sample.value)||sample.valid!==true)
        return Object.freeze({id,status:'unavailable',reason:'invalid_sensor',angleDeg:current});
      if(canonicalUnit(sample.unit)!==canonicalUnit(calibration.unit))
        return Object.freeze({id,status:'unavailable',reason:'unit_mismatch',angleDeg:current});
      const t=calibration.read(sample,options);
      if(t.status==='blocked'||t.status==='unavailable'||t.status==='out_of_range')
        return Object.freeze({id,status:t.status,reason:t.reason||t.status,angleDeg:current});
      if(!finite(t.angleDeg))
        return Object.freeze({id,status:'unavailable',reason:'not_rotary',angleDeg:current});
      lastTarget=t.angleDeg;
      if(current===null||motion.mode==='direct')current=lastTarget;
      else if(motion.mode==='slew'){
        const delta=lastTarget-current,limit=seconds*motion.degreesPerSecond;
        current+=Math.max(-limit,Math.min(limit,delta));
      }else{
        current+=(lastTarget-current)*(1-Math.exp(-seconds/motion.tauSeconds));
      }
      return Object.freeze({id,status:t.status,targetAngleDeg:lastTarget,angleDeg:current,
        moving:Math.abs(current-lastTarget)>1e-9,
        motionDirection:current<lastTarget?'clockwise':
          current>lastTarget?'counterclockwise':'stopped',
        numericalValue:t.value});
    }
    return Object.freeze({id,advance,read:()=>Object.freeze({angleDeg:current,targetAngleDeg:lastTarget})});
  }
  return Object.freeze({make,canonicalUnit});
});
