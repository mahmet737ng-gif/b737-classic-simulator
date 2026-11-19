(function(root,factory){
 'use strict';const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737AirspeedPointersModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const source=Object.freeze({piece:'captain',width:3942,height:3591});
 const pivot=Object.freeze({x:1108,y:973});
 const firstOfficer=Object.freeze({piece:'fo-inner',width:918,height:1713,pivot:Object.freeze({x:741,y:577}),tipRadius:145,vmoTipRadius:138});
 const pointers=Object.freeze({
  airspeed:Object.freeze({asset:'airspeed-pointer.svg',tipRadius:328,assetTipRadius:462,initialKts:60}),
  vmoMmo:Object.freeze({asset:'vmo-mmo-pointer.svg',tipRadius:312,assetTipRadius:382,initialKts:340})
 });
 // Visual positions transcribed from the photographed scale. This is not an AFM speed limit.
 const ticks=Object.freeze([
  [60,0],[80,28],[100,58],[120,90],[140,123],[160,151],
  [180,171],[200,185],[250,231],[300,260],[350,286],[400,310]
 ].map(([kts,bearing])=>Object.freeze({kts,bearing})));
 const firstOfficerTicks=Object.freeze([
  [60,20],[80,30],[100,50],[120,70],[140,92],[160,116],
  [180,154],[200,180],[250,220],[300,250],[350,281],[400,311]
 ].map(([kts,bearing])=>Object.freeze({kts,bearing})));
 function speed(value){const n=Number(value);if(!Number.isFinite(n))throw Error('Airspeed must be finite');return Math.max(60,Math.min(400,n));}
 function interpolate(value,scale){const n=speed(value);for(let i=1;i<scale.length;i++)if(n<=scale[i].kts){const a=scale[i-1],b=scale[i];return a.bearing+(n-a.kts)*(b.bearing-a.bearing)/(b.kts-a.kts);}return scale.at(-1).bearing;}
 function bearing(value,station='captain'){return interpolate(value,station==='firstOfficer'?firstOfficerTicks:ticks);}
 function vmoBearing(value,station='captain'){return bearing(value,station)-360;}
 function placement(piece){if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid captain-panel placement');return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};}
 return Object.freeze({source,pivot,firstOfficer,pointers,ticks,firstOfficerTicks,speed,bearing,vmoBearing,placement});
});
