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
  rmi1:Object.freeze({asset:'rmi-needle-1-owner-white.svg',initialAngle:0}),
  rmi2:Object.freeze({asset:'rmi-needle-2-owner-white.svg',initialAngle:0})
 });
 // FLN-0003: exact needle shapes are immutable. Only installation geometry changes.
 // The source-photo hub is (216,218), not (216,240); the latter made the
 // upper and lower arms sit off-center in both cockpit instrument faces.
 const rmiRegistration=Object.freeze({
  referencePivot:Object.freeze({x:216,y:218}),
  sourceWidth:435,sourceHeight:436,sourceDialRadius:215,
  placementScale:0.57,sourceMaxTipRadius:167,
  // Source-photo tip pixel positions retained; no path redesign or recoloring.
  sourceTipBounds:Object.freeze({rmi1:161.4,rmi2:167.0})
 });
 function angle(value){const n=Number(value);if(!Number.isFinite(n))throw Error('Needle angle must be finite');return Math.max(-360,Math.min(360,n));}
 return Object.freeze({sources,needles,rmiRegistration,angle});
});
