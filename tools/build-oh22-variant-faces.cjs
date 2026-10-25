'use strict';
/* Photo-specific OH22 annunciator faces. The original owner SVG and frozen OH22
 * reference photos are READ ONLY. Exactly 14 derivative files (7 lamps × OFF/ON).
 * Installed geometry stays at the calibrated model's independent CPCS/DCPCS positions.
 * The existing parent fit x/y is compensated in the SVG viewBox so physical glyphs
 * do not get stretched even when original CSS stretches its target canvas.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const model=require(path.join(ROOT,'panel-mosaic-lab/cockpit/pressurization-oh22-model.js'));
const parent=path.join(ROOT,'panel-mosaic-lab/assets/locked/2026-10-23/LIGHTS/unified-mounted-v1');
const dest=path.join(ROOT,'panel-mosaic-lab/assets/lights/oh22-profile-v1');
const manifestFile=path.join(ROOT,'panel-mosaic-lab/lights-test/oh22-profile-faces-v1.json');
const mapping={'auto-fail':'AUTO_FAIL','off-sched':'OFF_SCHED_DESCENT','standby':'STANDBY_GREEN','manual':'MANUAL_GREEN'};
const atlas=JSON.parse(fs.readFileSync(path.join(ROOT,'panel-mosaic-lab/all-overhead/atlas-layout.json'),'utf8'));
const tile=atlas.placements.find(p=>p.id==='OH22');
assert.ok(tile);fs.mkdirSync(dest,{recursive:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const glyphs=s=>[...s.matchAll(/<text\b[^>]*>.*?<\/text>/gs)].map(m=>m[0]);
const files=[];
for(const system of ['CPCS','DCPCS']){
 const cfg=model.config(system),fit=cfg.lampFit;
 for(const lamp of cfg.lamps){
  const asset=mapping[lamp.id];if(!asset)continue;
  const [x,y,w,h]=model.lampFace(system,lamp.id);
  const physicalRatio=(w*tile.w*fit.x)/(h*tile.h*fit.y);
  if(!Number.isFinite(physicalRatio)||physicalRatio<1.5||physicalRatio>5)throw Error('Implausible calibrated photo ratio '+lamp.id);
  for(const state of ['OFF','ON']){
   const originalPath=path.join(parent,asset+'_'+state+'.svg');
   const original=fs.readFileSync(originalPath,'utf8');
   const match=original.match(/^<svg\b[^>]*>/),head=match?.[0];
   if(!head)throw Error('Not owner SVG '+originalPath);
   const sizeX=head.match(/\bwidth="([\d.]+)"/),sizeY=head.match(/\bheight="([\d.]+)"/);
   const vb=head.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
   assert.ok(sizeX&&sizeY&&vb);
   const oldW=Number(vb[1]),oldH=Number(vb[2]);
   assert.ok(oldW>0&&oldH>0);
   let viewW=oldW,viewH=oldH,shiftX=0,shiftY=0;
   if(physicalRatio>=oldW/oldH){viewW=oldH*physicalRatio;shiftX=(viewW-oldW)/2}
   else{viewH=oldW/physicalRatio;shiftY=(viewH-oldH)/2}
   const width=Math.round(w*tile.w),height=Math.round(h*tile.h);
   const changed=head.replace(sizeX[0],'width="'+width+'"').replace(sizeY[0],'height="'+height+'"')
     .replace(vb[0],'viewBox="0 0 '+viewW.toFixed(6)+' '+viewH.toFixed(6)+'"');
   let svg=original.replace(head,changed);
   const rect=svg.match(/<rect width="([\d.]+)" height="([\d.]+)" fill="(#[a-fA-F0-9]+)"\s*\/>/);
   if(!rect||Number(rect[1])!==oldW||Number(rect[2])!==oldH)throw Error('Unexpected owner lamp background '+asset);
   const newRect='<rect width="'+viewW.toFixed(6)+'" height="'+viewH.toFixed(6)+'" fill="'+rect[3]+'"/>';
   svg=svg.replace(rect[0],newRect);
   const start=svg.indexOf(newRect)+newRect.length;
   svg=svg.slice(0,start)+'\n<g transform="translate('+shiftX.toFixed(6)+' '+shiftY.toFixed(6)+')" data-fit="oh22-profile-uniform-glyphs">'+svg.slice(start);
   svg=svg.replace('</svg>','</g>\n</svg>');
   assert.deepEqual(glyphs(svg),glyphs(original),'Source lettering changed');
   const name=system+'_'+lamp.id+'_'+state+'.svg';
   const outputPath=path.join(dest,name);
   if(fs.existsSync(outputPath)&&fs.readFileSync(outputPath,'utf8')!==svg)throw Error('Unexpected preexisting derivative '+name);
   fs.writeFileSync(outputPath,svg);
   files.push({system,lamp:lamp.id,asset,state,file:'panel-mosaic-lab/assets/lights/oh22-profile-v1/'+name,
     source:'panel-mosaic-lab/assets/locked/2026-10-23/LIGHTS/unified-mounted-v1/'+asset+'_'+state+'.svg',
     sourceSha:sha(original),sha256:sha(svg),faceNormalized:[x,y,w,h],tileDimensions:[tile.w,tile.h],
     parentFit:[fit.x,fit.y],physicalRatio:+physicalRatio.toFixed(6),
     viewBox:[+viewW.toFixed(6),+viewH.toFixed(6)],glyphNodesPreserved:true,sourceRectChanged:false});
  }
 }
}
if(files.length!==14)throw Error('Expected seven photo-position lamp designs with 14 OFF/ON states; got '+files.length);
fs.writeFileSync(manifestFile,JSON.stringify({schema:'b737.oh22.profile-specific-faces.v1',date:'2026-10-26',
  sourceImagesChanged:0,sourceGeometryChanged:0,states:files.length,
  strategy:'Unique CPCS/DCPCS native physical viewBox; compensate for CSS lampFit without changing approved photo coordinates, letters unchanged',
  browserVisualApproval:'REQUIRED',files},null,2)+'\n');
console.log('OH22_PROFILE_FACE_BUILD',JSON.stringify({states:files.length,systems:['CPCS','DCPCS'],photosUnmodified:true}));
