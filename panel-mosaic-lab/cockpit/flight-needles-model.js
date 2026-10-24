(function(root,factory){
 'use strict';const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;if(root)root.B737FlightNeedlesModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const sources=Object.freeze({
  captain:Object.freeze({piece:'captain',width:3942,height:3591,gauges:Object.freeze({
   altimeter:Object.freeze({x:3082,y:980,radius:207}),
   verticalSpeed:Object.freeze({x:3080,y:1610,radius:196}),
   clock:Object.freeze({x:3713,y:1610,radius:193}),
   rmi:Object.freeze({x:1183,y:1838,radius:215})
  })}),
  firstOfficerOuter:Object.freeze({piece:'fo-outer',width:1123,height:1400,gauges:Object.freeze({
   altimeter:Object.freeze({x:618,y:343,radius:106}),
   verticalSpeed:Object.freeze({x:619,y:611,radius:102}),
   clock:Object.freeze({x:869,y:609,radius:103})
  })}),
  firstOfficerInner:Object.freeze({piece:'fo-inner',width:918,height:1713,gauges:Object.freeze({
   rmi:Object.freeze({x:771,y:954,radius:128})
  })})
 });
 const needles=Object.freeze({
  altimeter:Object.freeze({asset:'altimeter-needle.svg',initialAngle:0}),
  verticalSpeed:Object.freeze({asset:'vertical-speed-needle.svg',initialAngle:-90}),
  clock:Object.freeze({asset:'clock-hand.svg',initialAngle:0}),
  rmi1:Object.freeze({asset:'rmi-needle-1-dashed.svg',initialAngle:57}),
  rmi2:Object.freeze({asset:'rmi-needle-2-hollow.svg',initialAngle:58})
 });
 function angle(value){const n=Number(value);if(!Number.isFinite(n))throw Error('Needle angle must be finite');return Math.max(-360,Math.min(360,n));}
 return Object.freeze({sources,needles,angle});
});
