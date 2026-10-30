(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737ApuEgtNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // OH12 source pixels, not atlas display pixels. The artwork remains unchanged.
 // Photo-calibrated angular zero follows the 0..8 °C×100 scale, unwrapped
 // clockwise from lower right to top. Sprite, shaft, size and centre unchanged.
 const source=Object.freeze({piece:'OH12',width:1024,height:1536});
 const needle=Object.freeze({id:'apuEgt',label:'APU EGT',x:300,y:1324,tipRadius:124,initialAngle:-241.5});
 function angle(value){const n=Number(value);if(!Number.isFinite(n))throw Error('APU EGT angle must be finite');return Math.max(-250,Math.min(145,n));}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid APU EGT placement');
  return {x:piece.x+needle.x*piece.w/source.width,y:piece.y+needle.y*piece.h/source.height,size:512*needle.tipRadius/220*piece.w/source.width};
 }
 return Object.freeze({source,needle,angle,placement});
});
