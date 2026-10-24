(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNEngineGaugeModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Coordinates are in the untouched 1235 × 1274 engine-panel source image.
 // Angular scales are temporary training visualization, not instrument calibration.
 const source=Object.freeze({width:1235,height:1274});
 const gauges=Object.freeze([
  Object.freeze({id:'egt1',engine:'engine1',signal:'egt',cx:532,cy:741,radius:53,max:800}),
  Object.freeze({id:'egt2',engine:'engine2',signal:'egt',cx:730,cy:741,radius:53,max:800}),
  Object.freeze({id:'n2_1',engine:'engine1',signal:'n2',cx:532,cy:900,radius:55,max:100}),
  Object.freeze({id:'n2_2',engine:'engine2',signal:'n2',cx:730,cy:900,radius:55,max:100})
 ]);
 function angle(value,max){if(value===null||value===undefined)return null;
  if(!Number.isFinite(value))throw Error('Finite gauge value required');
  return -120+240*Math.max(0,Math.min(max,value))/max;
 }
 return Object.freeze({source,gauges,angle});
});
