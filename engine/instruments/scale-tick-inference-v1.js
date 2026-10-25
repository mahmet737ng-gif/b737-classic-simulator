/* B737 Classic instrument scale graduation inference.
   IMPORTANT: minor/major tick length is a visual classification, not a fixed
   numeric increment. Numeric increments are determined BETWEEN KNOWN ANCHORS.
   Physical pointer geometry is approved separately, per source image. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737GaugeTickInferenceV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const rounded=n=>Number(n.toPrecision(13));
  const midpoint=(x,y,t)=>x+(y-x)*t;
  function lengthClasses(ticks){
    const lengths=ticks.map(t=>t.lengthPx).filter(n=>finite(n)&&n>0).sort((a,b)=>a-b);
    if(lengths.length<2)return ticks.map(()=> 'unknown');
    const median=lengths.length%2?lengths[(lengths.length-1)/2]:
      (lengths[lengths.length/2-1]+lengths[lengths.length/2])/2;
    // Classification is relative: do not infer numerical delta from blade size.
    const largest=lengths.at(-1);
    if(largest/lengths[0]<1.18)return ticks.map(t=>finite(t.lengthPx)?'similar':'unknown');
    const threshold=(largest+median)/2;
    return ticks.map(t=>!finite(t.lengthPx)?'unknown':
      t.lengthPx>=threshold?'long':'short');
  }
  // Input ticks are already ordered along increasing NUMERIC value;
  // clockwise/counterclockwise only controls their angular orientation.
  // A labelValue is a physically read number; null means an unnumbered tick.
  function inferTicks(config){
    if(!config||!Array.isArray(config.ticks)||config.ticks.length<2)
      throw Error('At least two physically detected tick marks required');
    if(!['clockwise','counterclockwise','linear'].includes(config.direction))
      throw Error('Increase direction must be declared');
    const ticks=config.ticks;
    if(!finite(ticks[0].labelValue)||!finite(ticks.at(-1).labelValue))
      throw Error('First and last ticks must have source-backed numeric labels');
    const labels=[];
    for(let i=0;i<ticks.length;i++){
      const t=ticks[i];
      if(!t||!((finite(t.x)&&finite(t.y))||finite(t.angleDeg)))
        throw Error('Tick '+i+' needs measured position or angle');
      if(t.labelValue!==null&&t.labelValue!==undefined){
        if(!finite(t.labelValue))throw Error('Nonfinite label at '+i);
        labels.push(i);
      }
    }
    if(labels.length<2)throw Error('Two printed numeric anchors required');
    for(let i=1;i<labels.length;i++){
      if(ticks[labels[i]].labelValue<=ticks[labels[i-1]].labelValue)
        throw Error('Printed labels must increase in the declared direction');
    }
    const values=new Array(ticks.length);
    const intervals=[];
    for(let i=1;i<labels.length;i++){
      const a=labels[i-1],b=labels[i],lo=ticks[a].labelValue,hi=ticks[b].labelValue,
        numberOfGaps=b-a,increment=(hi-lo)/numberOfGaps;
      if(!(increment>0)||!finite(increment))throw Error('Invalid graduation increment');
      for(let k=a;k<=b;k++){
        const val=rounded(lo+(k-a)*increment);
        if(values[k]!==undefined&&Math.abs(values[k]-val)>1e-8)
          throw Error('Conflicting adjacent labeled spans');
        values[k]=val;
      }
      intervals.push(Object.freeze({
        from:lo,to:hi,numberOfGaps,unlabeledTicks:numberOfGaps-1,
        increment:rounded(increment)
      }));
    }
    let angles=null;
    if(ticks.every(t=>finite(t.angleDeg))){
      const direction=config.direction;
      if(direction==='linear')throw Error('Linear indicator cannot supply rotary angles');
      const sign=direction==='clockwise'?1:-1;
      angles=[ticks[0].angleDeg];
      for(let i=1;i<ticks.length;i++){
        let angle=ticks[i].angleDeg;
        while((angle-angles.at(-1))*sign<=0)angle+=360*sign;
        const delta=(angle-angles.at(-1))*sign;
        if(delta>(config.maxGapDeg||120))
          throw Error('Tick angle jump exceeds configured local scale gap');
        angles.push(angle);
      }
      if((angles.at(-1)-angles[0])*sign>360+1e-8)
        throw Error('Total scale sweep exceeds one turn');
    }
    const classes=lengthClasses(ticks);
    const marks=ticks.map((tick,i)=>Object.freeze({
      index:i, value:values[i], labelPrinted:finite(tick.labelValue),
      tickClass:classes[i],lengthPx:finite(tick.lengthPx)?tick.lengthPx:null,
      x:finite(tick.x)?tick.x:null,y:finite(tick.y)?tick.y:null,
      angleDeg:angles?angles[i]:null,
      valueOrigin:finite(tick.labelValue)?'read_label':'inferred_tick_division',
      positionOrigin:config.positionOrigin||'unverified'
    }));
    return Object.freeze({direction:config.direction,
      marks:Object.freeze(marks),intervals:Object.freeze(intervals),
      allValuesInferred:marks.every(m=>finite(m.value)),
      visualApproved:false // Requires independent source image QA.
    });
  }
  function mapValue(inferred,value,{outOfRange='clamp'}={}){
    if(!inferred||!Array.isArray(inferred.marks)||!inferred.allValuesInferred)
      throw Error('Complete measured tick map required');
    if(!finite(value))throw Error('Reading must be a finite number');
    const marks=inferred.marks,lo=marks[0].value,hi=marks.at(-1).value;
    if((value<lo||value>hi)&&outOfRange==='reject')
      return Object.freeze({status:'out_of_range',input:value,min:lo,max:hi});
    const v=Math.min(hi,Math.max(lo,value));
    let i=1;
    while(i<marks.length-1&&v>marks[i].value)i++;
    const a=marks[i-1],b=marks[i],t=(v-a.value)/(b.value-a.value);
    const angleDeg=finite(a.angleDeg)&&finite(b.angleDeg)?
      midpoint(a.angleDeg,b.angleDeg,t):null;
    const position=finite(a.x)&&finite(a.y)&&finite(b.x)&&finite(b.y)?
      Object.freeze({x:midpoint(a.x,b.x,t),y:midpoint(a.y,b.y,t)}):null;
    if(angleDeg===null&&position===null)throw Error('Measured geometry required for target');
    return Object.freeze({input:value,value:v,
      status:v!==value?'pegged':'ok',angleDeg,position,
      fromTick:a.value,toTick:b.value,localFraction:t,
      precision:'unverified_until_image_QA'});
  }
  // Integer targets [-40,...,+40] are positions BETWEEN registered ticks,
  // NOT 81 assumed printed ticks.
  function denseTable(inferred,{min,max,step=1}={}){
    if(!finite(step)||step<=0)throw Error('Positive step required');
    const first=min??inferred.marks[0].value,last=max??inferred.marks.at(-1).value;
    if(!finite(first)||!finite(last)||last<first)throw Error('Invalid dense table range');
    const count=Math.round((last-first)/step);
    if(count>100000||Math.abs(first+count*step-last)>1e-7)
      throw Error('Dense table range must be divisible by step');
    return Object.freeze(Array.from({length:count+1},(_,i)=>mapValue(inferred,
      rounded(first+i*step))));
  }
  return Object.freeze({inferTicks,mapValue,denseTable,lengthClasses});
});
