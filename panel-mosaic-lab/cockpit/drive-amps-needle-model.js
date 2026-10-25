(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737DriveAmpsNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Registered to the unchanged OH11 (1203x1308) and OH12 (1024x1536) artwork.
 // SOURCE NATIVE PIXELS: locked OH11/OH12 originals were checked side-by-side with
 // candidate pointer rays. 128/135px proposals crossed beyond the inner tick;
 // 64px proposals stopped short. Original near-98/102px reach is the
 // best source-image 0-tick approximation pending the full tick survey.
 // Sprite paths stay owner-approved and byte-identical.
 const panels=Object.freeze({OH11:Object.freeze({width:1203,height:1308}),OH12:Object.freeze({width:1024,height:1536})});
 // Upper edges of the grey half-round covers, traced from the unchanged source panels.
 // Clipping to these contours keeps every white blade exactly within the black dial.
 const windows=Object.freeze({
  OH11:Object.freeze({top:805,offset:523,edge:Object.freeze([[140,1012],[180,1012],[220,1012],[245,1009],[265,1003],[285,997],[305,993],[325,990],[345,990],[365,992],[385,997],[405,1003],[425,1009],[450,1012],[535,1012]])}),
  OH12:Object.freeze({top:84,offset:495,edge:Object.freeze([[105,252],[150,252],[185,251],[205,247],[225,240],[245,236],[265,235],[285,237],[305,242],[325,248],[350,252],[420,252]])}),
  OH12_APU:Object.freeze({top:1130,offset:0,edge:Object.freeze([[563,1324],[590,1326],[625,1326],[648,1325],[666,1318],[685,1310],[705,1305],[725,1303],[745,1305],[765,1311],[784,1319],[803,1325],[835,1326],[879,1326]])})
 });
 const needles=Object.freeze([
  Object.freeze({id:'driveOil1',label:'GEN DRIVE OIL TEMP 1',piece:'OH11',x:266,y:1021,tipRadius:98,initialAngle:-46}),
  Object.freeze({id:'driveOil2',label:'GEN DRIVE OIL TEMP 2',piece:'OH11',x:781,y:1021,tipRadius:98,initialAngle:-46}),
  Object.freeze({id:'acAmps1',label:'A.C. AMPS 1',piece:'OH12',x:210,y:265,tipRadius:102,initialAngle:-45}),
  Object.freeze({id:'acAmps2',label:'A.C. AMPS 2',piece:'OH12',x:705,y:265,tipRadius:102,initialAngle:-45}),
  Object.freeze({id:'apuAcAmps',label:'APU A.C. AMPS',piece:'OH12',window:'OH12_APU',x:724,y:1334,tipRadius:124,initialAngle:-47})
 ]);
 function angle(value){const n=Number(value);if(!Number.isFinite(n))throw Error('Needle angle must be finite');return Math.max(-90,Math.min(90,n));}
 function windowPath(needle){
  if(!needles.includes(needle))throw Error('Invalid drive/amps needle');
  const window=windows[needle.window||needle.piece],dx=(needle.id.endsWith('2')?window.offset:0);
  const edge=window.edge.map(([x,y])=>[x+dx,y]);
  const first=edge[0],last=edge[edge.length-1];
  return `M ${first[0]} ${window.top} L ${last[0]} ${window.top} L ${last[0]} ${last[1]} `+
   edge.slice(0,-1).reverse().map(([x,y])=>`L ${x} ${y}`).join(' ')+` Z`;
 }
 function placement(piece,needle){
  const source=panels[needle?.piece];
  if(!source||!needles.includes(needle)||!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid drive/amps needle placement');
  return {x:piece.x+needle.x*piece.w/source.width,y:piece.y+needle.y*piece.h/source.height,size:512*needle.tipRadius/220*piece.w/source.width};
 }
 return Object.freeze({panels,needles,angle,placement,windowPath});
});
