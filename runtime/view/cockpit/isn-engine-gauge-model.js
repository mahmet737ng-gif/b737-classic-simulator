(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNEngineGaugeModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Coordinates are in the untouched 1235 × 1274 engine-panel source image.
 // Angular scales are temporary training visualization, not instrument calibration.
 const source=Object.freeze({width:1235,height:1274});
 const gauges=Object.freeze([
  Object.freeze({id:'egt1',engine:'engine1',signal:'egt',cx:535,cy:723,radius:53,max:800}),
  Object.freeze({id:'egt2',engine:'engine2',signal:'egt',cx:724,cy:723,radius:53,max:800}),
  Object.freeze({id:'n2_1',engine:'engine1',signal:'n2',cx:535,cy:900,radius:55,max:100}),
  Object.freeze({id:'n2_2',engine:'engine2',signal:'n2',cx:724,cy:900,radius:55,max:100})
 ]);
 function angle(value,max){if(value===null||value===undefined)return null;
  if(!Number.isFinite(value))throw Error('Finite gauge value required');
  // Follow the visible long arc from upper-left through the bottom to upper-right.
  return -45-270*Math.max(0,Math.min(max,value))/max;
 }
 // Native EIS glass: eight primary and eight secondary dials. Angles use
 // an upward-pointing radial marker, clockwise from 12 o'clock. The older
 // four-gauge API above remains available to the start-system diagnostics.
 const rows=[
  {key:'n1',signal:'n1',y:542,x:[536,724],radius:55,min:0,max:120,start:45,sweep:270},
  {key:'egt',signal:'egt',y:724,x:[536,724],radius:55,min:0,max:800,start:45,sweep:270,valueText:true},
  {key:'n2',signal:'n2',y:896,x:[536,724],radius:55,min:0,max:120,start:45,sweep:270,valueText:true},
  {key:'fuelFlow',signal:'fuelFlow',y:1051,x:[536,724],radius:55,min:0,max:6000,start:45,sweep:270},
  {key:'oilPressure',signal:'oilPressure',y:496,x:[984,1118],radius:39,min:0,max:100,start:135,sweep:270},
  {key:'oilTemperature',signal:'oilTemperature',y:646,x:[984,1118],radius:39,min:0,max:200,start:195,sweep:210},
  {key:'vibration',signal:'vibration',y:839,x:[984,1118],radius:39,min:0,max:5,start:135,sweep:270},
  {key:'hydPressure',signal:'hydPressure',y:991,x:[982,1118],radius:39,min:0,max:4000,start:132,sweep:277}
 ];
 const eisGauges=Object.freeze(rows.flatMap(row=>[1,2].map(side=>Object.freeze({
  ...row,id:row.key+'_'+side,engine:'engine'+side,cx:row.x[side-1],cy:row.y,
  length:row.radius*.44,width:row.radius*.10,gap:row.radius*.06
 }))));
 const needle=Object.freeze({color:'#83a220',shape:'single-straight-line',linecap:'butt'});
 function eisAngle(spec,value){
  if(!Number.isFinite(value))return null;
  const fraction=Math.max(0,Math.min(1,(value-spec.min)/(spec.max-spec.min)));
  return spec.start+spec.sweep*fraction;
 }
 return Object.freeze({source,gauges,angle,eisGauges,eisAngle,needle});
});
