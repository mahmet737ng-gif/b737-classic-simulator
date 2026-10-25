/* Gauge tick inference / continuous value targets.
   A long tick is NOT intrinsically '10' and a short tick is NOT
   intrinsically '5'. Values come from bracket endpoints and count
   of EQUAL subdivisions; geometry comes from the source-image scan.
   Never promote geometric estimates to aircraft-approved calibration. */
(function(root,factory){
  'use strict';const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737TickInference=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const round=x=>Number(x.toPrecision(12));
  function subdivide(from,to,positions,options={}){
    if(!finite(from)||!finite(to)||to<=from)throw Error('Increasing numeric anchors required');
    if(!Array.isArray(positions)||positions.some(p=>!finite(p)||p<=0||p>=1))
      throw Error('Intermediate ticks require normalized 0..1 positions');
    const ps=[...positions].sort((a,b)=>a-b);
    for(let i=1;i<ps.length;i++)if(ps[i]-ps[i-1]<1e-8)throw Error('Duplicate tick');
    const intervals=ps.length+1;
    // Equal-value divisions are only valid where the physical tick geometry
    // is reasonably equally spaced; do not assume all visual scales are linear.
    if(options.equalSubdivisions!==true)
      return ps.map((position,i)=>({value:null,position,index:i+1,reason:'interval_not_verified'}));
    const expected=Array.from({length:ps.length},(_,i)=>(i+1)/intervals);
    if(options.validateSpacing!==false){
      const tol=options.spacingTolerance??0.035;
      for(let i=0;i<ps.length;i++)
        if(Math.abs(ps[i]-expected[i])>tol)
          throw Error('Unequal tick spacing: manual or source-backed values needed');
    }
    return ps.map((position,i)=>({
      value:round(from+(to-from)*(i+1)/intervals),
      position,index:i+1,classification:options.classes?.[i]||'unknown',
      provenance:'inferred_equal_numeric_subdivision'
    }));
  }
  // Measured native-image angles are signed and can span the wrap at +/-180.
  function inferInterval(a,b,intermediate,options={}){
    if(!a||!b||!finite(a.value)||!finite(b.value)||!finite(a.angle)||!finite(b.angle))
      throw Error('Two measured numeric/angular anchors required');
    if(!Array.isArray(intermediate))throw Error('Intermediate tick angles required');
    const direction=options.direction==='counterclockwise'?-1:1;
    const unwrap=(value,reference)=>{
      while((value-reference)*direction<0)value+=360*direction;
      return value;
    };
    let end=unwrap(b.angle,a.angle),span=end-a.angle;
    if(span*direction<=0||span*direction>180)throw Error('Bad angular bracket');
    const points=intermediate.map(p=>{
      let angle=unwrap(p.angle,a.angle);
      if(!finite(angle)||((angle-a.angle)*direction<=0)||((end-angle)*direction<=0))
        throw Error('Tick is not inside anchor bracket');
      return {position:(angle-a.angle)/span,angle,classification:p.classification||'unknown'};
    }).sort((x,y)=>x.position-y.position);
    const assigned=subdivide(a.value,b.value,points.map(p=>p.position),{
      equalSubdivisions:options.equalSubdivisions===true,
      validateSpacing:options.validateSpacing,
      spacingTolerance:options.spacingTolerance,
      classes:points.map(p=>p.classification)
    });
    return assigned.map((x,i)=>({...x,angle:points[i].angle}));
  }
  function oneUnitGrid(min,max,angleFor,options={}){
    if(!finite(min)||!finite(max)||max<min||!Number.isInteger(min)||!Number.isInteger(max))
      throw Error('Integer grid requires integral min and max');
    if(max-min>100000)throw Error('Excessive grid span');
    if(typeof angleFor!=='function')throw Error('Measured or provisional mapping function required');
    const points=[];
    for(let n=min;n<=max;n++){
      const angle=angleFor(n);
      if(!finite(angle))throw Error('Invalid target angle for '+n);
      points.push({value:n,angleDeg:angle,source:options.source||'uncertified_preview'});
    }
    return Object.freeze(points);
  }
  function needleMotion(previousValue,nextValue,scaleDirection){
    if(!finite(previousValue)||!finite(nextValue))throw Error('Finite readings required');
    if(!['clockwise','counterclockwise'].includes(scaleDirection))throw Error('Direction required');
    if(previousValue===nextValue)return 'hold';
    const inc=previousValue<nextValue;
    return (inc===(scaleDirection==='clockwise'))?'clockwise':'counterclockwise';
  }
  return Object.freeze({subdivide,inferInterval,oneUnitGrid,needleMotion});
});