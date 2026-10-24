/**
 * Build bezel-free physical annunciator faces from the approved gallery SVGs.
 * Gallery artwork remains untouched. Physical faces fill the measured dark
 * aperture in each approved blank panel, without a second metal frame.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const base='assets/locked/2026-10-23/LIGHTS';
const gallery=read('lights-test/registry.json');
const style=read('lights-test/unified-v2-manifest.json');
const overrides=read('lights-test/mount-fitting-overrides.json');
const oh=read('interactive-overhead/lights.json');
const main=read('cockpit/lights.json');
const palette=new Map(style.lamps.map(l=>[l.id,l.palette]));
const paletteColors={
 amber:'#260f09',white:'#101217',red:'#20080d',green:'#071b0e',
 yellow:'#050505',blue:'#18569e'
};
const manifest={schema:'B737-mounted-annunciator-lens.v1',galleryVersion:gallery.version,version:'LGT-0016',
 reference:'B737 approved LIGHTS unified-v2; no plate, bezel, or second housing on mounted sockets',
 sourceRectCorrections:{main:Object.keys(overrides.main).length,overhead:Object.keys(overrides.overhead).length},
 types:gallery.lights.length,states:[],visualMode:'aperture-edge-to-edge'};
for(const lamp of gallery.lights){
 const color=palette.get(lamp.id);if(!color)throw Error('No palette '+lamp.id);
 const {width:w,height:h}=lamp.face;
 for(const state of lamp.states){
  const src=fs.readFileSync(path.join(root,base,lamp.assets[state]),'utf8');
  const defs=src.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
  if(!defs)throw Error('No defs '+lamp.id+' '+state);
  const rest=src.slice(src.indexOf(defs)+defs.length);
  const firstText=rest.indexOf('<g ');
  if(firstText<0)throw Error('No legend '+lamp.id+' '+state);
  const text=rest.slice(firstText).replace(/<\/svg>\s*$/,'').trim();
  const fill=(lamp.id==='ALIGN_WHITE'||lamp.id==='A_T_LIM_WHITE')?'#050505':state==='OFF'?(color==='yellow'?'#050505':'#0c0b0c')
    :color==='blue'&&state==='DIM_BLUE'?'#112f55':paletteColors[color];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${lamp.id} mounted ${state}">\n${defs}\n<rect width="${w}" height="${h}" fill="${fill}"/>\n${text}\n</svg>\n`;
  const rel=`unified-mounted-v1/${lamp.id}_${state}.svg`;
  write(path.join(root,base,rel),svg);
  const url=`../${base}/${rel}`;
  for(const target of [oh,main])if(target.assets[lamp.id]?.[state])target.assets[lamp.id][state]={url,sha256:sha(svg)};
  manifest.states.push({id:lamp.id,palette:color,state,asset:rel,sha256:sha(svg),face:lamp.face});
 }
}
const placed={main:0,overhead:0};
for(const [key,target] of [['main',main],['overhead',oh]]){
 for(const c of target.lights){const rect=overrides[key][c.id];if(rect){
    if(rect.length!==4||rect.some(v=>!Number.isInteger(v)||v<0))throw Error('Invalid rectangle '+c.id);
    c.sourceRect=[...rect];placed[key]++;
 }}
}
if(oh.version!=='LGT-0005')oh.previousVersion=oh.version;
oh.version='LGT-0005';
if(main.version!=='LGT-0009')main.previousVersion=main.version;
main.version='LGT-0009';
write(path.join(root,'interactive-overhead/lights.json'),JSON.stringify(oh,null,2)+'\n');
write(path.join(root,'cockpit/lights.json'),JSON.stringify(main,null,2)+'\n');
write(path.join(root,'lights-test/mounted-lenses-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({uniqueTypes:gallery.lights.length,mountedFaces:manifest.states.length,correctedRects:placed,overheadInstances:oh.lights.length,mainInstances:main.lights.length},null,2));
