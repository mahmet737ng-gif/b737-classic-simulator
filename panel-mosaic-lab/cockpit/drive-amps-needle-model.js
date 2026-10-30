(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737DriveAmpsNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Native original 1203x1308 / 1024x1536 photo fitted bezel centres; 
 // each centre independently matched across four Hough sensitivity settings. 
 // BEZEL-only provisional registration; physical spindle still unapproved. 
 // See engine/instruments/native-bezel-centre-evidence-v1.json.
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
  Object.freeze({id:'driveOil1',label:'GEN DRIVE OIL TEMP 1',piece:'OH11',x:326.4,y:1016.6,tipRadius:98,initialAngle:-46}),
  Object.freeze({id:'driveOil2',label:'GEN DRIVE OIL TEMP 2',piece:'OH11',x:861.8,y:1023.8,tipRadius:98,initialAngle:-46}),
  Object.freeze({id:'acAmps1',label:'A.C. AMPS 1',piece:'OH12',x:266.515,y:296.991,tipRadius:125,initialAngle:-49.51}),
  Object.freeze({id:'acAmps2',label:'A.C. AMPS 2',piece:'OH12',x:753.481,y:297.342,tipRadius:125,initialAngle:-49.5}),
  Object.freeze({id:'apuAcAmps',label:'APU A.C. AMPS',piece:'OH12',window:'OH12_APU',x:724,y:1334,tipRadius:124,initialAngle:-74})
 ]);

 // Source-native OH12 original white radial stroke axis intersections (21
 // source lines / gauge). Physical shaft is covered by the lower fairing:
 // this is an ARC-FITTED VISUAL PIVOT, not a hidden spindle certification.
 // Each interval is 10 A from the true printed 0/50/100/150/200 graduations.
 // Source ledger with per-line pixel endpoints and checksum:
 // engine/instruments/oh12-ac-amps-photo-graduations-v1.json
 const ampPhotoAngles=Object.freeze({
  acAmps1:Object.freeze([-49.51,-43.85,-38.7,-33.54,-28.56,-23.53,-18.14,-13.02,-8.12,-3.28,1.73,7.07,12.56,17.7,22.65,27.72,33.02,38.12,43.21,48.23,53.23]),
  acAmps2:Object.freeze([-49.5,-43.88,-38.75,-33.69,-28.68,-23.67,-18.49,-13.67,-8.76,-3.96,1.0,6.23,11.57,16.58,21.54,26.58,31.71,36.84,41.92,46.87,51.83])
 });
 // APU AC AMPS native photographed zero lies at the lower-left tick.
 // Interpolated 0/50/100/150/200 reference: owner's 2026-10-31 screenshot.
 // The dial, bearing/pivot, sprite and size stay untouched.
 const apuAmpPhotoAngles=Object.freeze([-74,-37,0,37,74]);
 function bearingForApuAmps(amps){
  if(typeof amps!=='number'||!Number.isFinite(amps))throw Error('APU A.C. AMPS must be finite');
  const v=Math.max(0,Math.min(200,amps)),i=Math.min(3,Math.floor(v/50));
  return apuAmpPhotoAngles[i]+(apuAmpPhotoAngles[i+1]-apuAmpPhotoAngles[i])*(v-i*50)/50;
 }
 const ampPhotoStatuses=Object.freeze({numericalMinorMarksObserved:21,majorMarksObserved:5,
  perMinorAmperes:10,sourcePhotoReviewed:true,physicalHiddenShaftCertified:false,
  sourcePhotoCalibrationNotCertifiedForFlight:true});
 function bearingForAmps(id,amps){
  if(!Object.hasOwn(ampPhotoAngles,id))throw Error('Unknown AC AMPS photo gauge '+id);
  if(typeof amps!=='number'||!Number.isFinite(amps))throw Error('A.C. AMPS must be finite');
  if(amps<0||amps>200)return null;
  const a=ampPhotoAngles[id],index=Math.min(19,Math.floor(amps/10)),t=(amps-index*10)/10;
  return a[index]+t*(a[index+1]-a[index]);
 }
 function ampsForBearing(id,degrees){
  if(!Object.hasOwn(ampPhotoAngles,id))throw Error('Unknown AC AMPS photo gauge '+id);
  if(typeof degrees!=='number'||!Number.isFinite(degrees))throw Error('A.C. AMPS bearing must be finite');
  const a=ampPhotoAngles[id];
  if(degrees<a[0]-1e-7||degrees>a[20]+1e-7)return null;
  for(let i=0;i<20;i++)if(degrees<=a[i+1])return i*10+
     10*(degrees-a[i])/(a[i+1]-a[i]);
  return 200;
 }
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
 return Object.freeze({panels,needles,angle,placement,windowPath,ampPhotoAngles,apuAmpPhotoAngles,ampPhotoStatuses,bearingForAmps,ampsForBearing,bearingForApuAmps});
});
