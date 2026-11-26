'use strict';
// Export the verified public browser compiler output for the authenticated
// Railway gateway with the public boot dependencies. Original photographs,
// private navigation data and credentials stay out of this archive.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {prepare}=require('./build-unified-web.cjs');
const root=path.resolve(__dirname,'..');
const target=path.resolve(process.argv[2]||'./gateway-fast-runtime');
if(target===root||!target.startsWith(root+path.sep))throw Error('Output must remain within checkout');
const sha=process.env.GITHUB_SHA;
if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Expected a full main-branch commit SHA');
const compiled=prepare(root);
const generated=new Map();
for(const bundle of [...compiled.bundles,...compiled.overhead.bundles]){
 const filename=bundle.path;
 if(!/^(?:[a-zA-Z0-9_-]+\/)+desktop-bundle-[a-f0-9]{16}\.js$/.test(filename))
  throw Error('Unexpected generated script path '+filename);
 const collision=generated.get(filename);
 if(collision&&collision!==bundle.content)throw Error('Bundle path conflict: '+filename);
 generated.set(filename,bundle.content);
}
const cockpit='panel-mosaic-lab/cockpit/';
const filesToPublish=new Map([
 [cockpit+'index.html',compiled.html],
 [cockpit+'overhead-stage.html',compiled.overhead.html],
 ...generated
]);
const origin='https://release.invalid/';
function add(relative){
 if(!/^(?:[a-zA-Z0-9._-]+\/)+[a-zA-Z0-9._-]+\.(?:html|js|cjs|css|json|webmanifest|svg|webp|png|ttf|woff2|mp3)$/.test(relative)||relative.includes('..'))
  throw Error('Bad release resource path '+relative);
 if(filesToPublish.has(relative))return;
 const bytes=fs.readFileSync(path.join(root,relative));
 filesToPublish.set(relative,bytes);
 if(relative.endsWith('.css')){
  const base=new URL(relative,origin);
  for(const match of bytes.toString('utf8').matchAll(/@import\s+(?:url\()?["']?([^"'\s;)]+\.css)(?:[?][^"')\s]*)?/g)){
   const url=new URL(match[1],base);
   if(url.origin===base.origin)add(url.pathname.slice(1));
  }
 }
}
add(cockpit+'cdu-stage.html');
for(const relative of [cockpit+'index.html',cockpit+'overhead-stage.html',cockpit+'cdu-stage.html']){
 const html=filesToPublish.get(relative).toString();
 const doc=new URL(relative,origin),base=new URL(html.match(/<base\s+href=["']([^"']+)/i)?.[1]||doc,doc);
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=(["'])([^"']+)\1[^>]*>/gi)){
  const url=new URL(match[2].replaceAll('&amp;','&'),base),name=url.pathname.slice(1);
  if(url.origin===doc.origin&&/\.(?:js|cjs|css|json|ttf|woff2)$/.test(name))add(name);
 }
}
for(const relative of [
 'audio-lab/assets/owner-ra-callouts-v1.mp3',
 cockpit+'assembly.json',cockpit+'boot-trace.js',cockpit+'sw.js',
 cockpit+'crew-room-v1.js',cockpit+'crew-room-v1.css',cockpit+'crew-cockpit-v1.js',
 cockpit+'vendor/qrcode-generator-2.0.4.js',
 cockpit+'brand/unified-icon-192.webp',
 ...['frame','aircraft','orbit','white','wordmark','still']
   .map(layer=>cockpit+'brand/unified-intro-'+layer+'.webp'),
 cockpit+'panel-photo-registry.v1.json',cockpit+'unified.webmanifest',cockpit+'performance/manifest.json',
 cockpit+'overhead-test-labs-catalog-v1.json',
 cockpit+'assets/p15-refuel-photo-v1.webp',
 cockpit+'assets/p15-toggle-photo-approved-v2.webp',
 cockpit+'assets/p15-approved-switch-5state-v3.webp',
 // Self-contained user-supplied parking brake lever, rendered over the photograph.
 cockpit+'assets/parking-brake-off-front-v1.svg',
 cockpit+'assets/parking-brake-on-top-left-v1.svg',
 // Authenticated TCAS Test Lab: keep its exact reference HTML, JS and CSS
 // on the same verified fast runtime as Unified (no broken Pages dependency).
 cockpit+'clock-test-lab-v3.html',
 cockpit+'clock-photo-unified-v3.js',
 ...['face','et','gmt','needle'].map(name=>cockpit+'clock-assets/'+name+'.png'),
 cockpit+'tcas-lab/index.html',
 cockpit+'tcas-lab/style.css',
 cockpit+'tcas-lab/app.js',
 cockpit+'tcas-lab/cruise-scenario-v1.js',
 cockpit+'tcas-lab/efis-physical-cp-v1.js',
 cockpit+'tcas-photo/ivsi.js',
 cockpit+'tcas-photo/ivsi.webp',
 cockpit+'tcas-photo/scale.webp',
 cockpit+'tcas-photo/brightness.png',
 cockpit+'tcas-photo/ta.png',
 cockpit+'efis-pedestal-raster-v1.css',
 'engine/afds/fma-mode-engine-v1.js',
 'engine/efis/classic-flap-speed-profile-v1.js',
 'engine/efis/classic-speed-tape-engine-v1.js',
 cockpit+'eadi-speed-tape-v1.js',
 cockpit+'eadi-fma-fcom-v2.js',
 'efis-display-lab/reference-geometry.js',
 'efis-display-lab/glyphs.js',
 'efis-display-lab/core.js',
 'efis-display-lab/eadi.js',
 'efis-display-lab/ehsi-v2.js',
 'engine/tcas/classic-tcas-v1.js',
 'engine/tcas/classic-tcas-v2.js',
 cockpit+'assets/oh21-737-400-owner-20261030.q100.webp',
 cockpit+'assets/oh21-737-300500-owner-20261030.q100.webp',
 'panel-mosaic-lab/lights-test/registry.json',
 cockpit+'performance/lossless/manifest.js',
 'panel-mosaic-lab/all-overhead/atlas-layout.json','panel-mosaic-lab/all-overhead/spec.json',
 'panel-mosaic-lab/upper-oh/geometry.json','panel-mosaic-lab/lights-reference-v2/manifest.json',
 ...['registry','rotary-guards','lights-controls','lights','instance-faces','readability-faces']
   .map(name=>'panel-mosaic-lab/interactive-overhead/'+name+'.json'),
 ...['BoeingCDU-Large','BoeingCDU-Small'].map(name=>'assets/fonts/boeing-cdu/'+name+'.ttf')
])add(relative);
const isn=fs.readFileSync(path.join(root,cockpit,'isn-cockpit.js'),'utf8');
for(const match of isn.matchAll(/\['B737[^']+','([^']+)'\]/g))
 add(new URL(match[1],origin+cockpit+'isn-cockpit.js').pathname.slice(1));
const preview=JSON.parse(fs.readFileSync(path.join(root,cockpit,'performance/manifest.json'),'utf8'));
for(const image of Object.values(preview.images))
 for(const level of image.levels)
  if(!level.original&&level.extent<=768)add(level.url);
for(const relative of Object.values(preview.patches))add(relative);
// These exact SVG masters are converted into many differently fitted lamps
// by the cockpit and Overhead. Send the source text once, compressed.
const lights='panel-mosaic-lab/lights-reference-v2/';
const lampManifest=JSON.parse(fs.readFileSync(path.join(root,lights,'manifest.json'),'utf8'));
const lampAssets=new Set(lampManifest.masters.flatMap(master=>Object.values(master.assets)));
const lampSources={};
for(const asset of [...lampAssets].sort()){
 if(!/^svg\/[A-Z0-9_]+\.svg$/.test(asset))throw Error('Bad lamp master path '+asset);
 const filename=lights+asset;
 lampSources['/'+filename]=fs.readFileSync(path.join(root,filename),'utf8');
}
filesToPublish.set(cockpit+'performance/boot-lamp-sources.json',JSON.stringify(lampSources));
const artIndex=cockpit+'performance/boot-art/manifest.json';
const art=JSON.parse(fs.readFileSync(path.join(root,artIndex),'utf8'));
for(const [id,asset] of Object.entries(art)){
 if(!['oh10','oh12','engine1','engine2'].includes(id)||
    !asset.url.startsWith(cockpit+'performance/boot-art/')||
    !asset.url.endsWith('-'+asset.sha256.slice(0,20)+'.webp'))
  throw Error('Invalid boot artwork entry '+id);
 add(asset.url);
 for(const [file,expected] of [[asset.source,asset.sourceSha256],[asset.url,asset.sha256]]){
  const check=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  if(check!==expected)throw Error('Stale boot artwork '+file);
 }
}
add(artIndex);
const entries=[...filesToPublish];
const totalBytes=entries.reduce((sum,[,data])=>sum+Buffer.byteLength(data),0);
if(totalBytes>20*1024*1024)throw Error('Unified boot release exceeds the 20 MiB package budget');
fs.rmSync(target,{recursive:true,force:true});
for(const [filename,content] of entries){
 const absolute=path.join(target,filename);
 fs.mkdirSync(path.dirname(absolute),{recursive:true});
 fs.writeFileSync(absolute,content);
}
const files=entries.map(([filename,content])=>({path:filename,sha256:crypto.createHash('sha256').update(content).digest('hex')}));
const manifest={schema:'b737-unified-fast-runtime/1',sourceCommit:sha,
 mainBefore:compiled.before,mainAfter:compiled.after,
 overheadBefore:compiled.overhead.before,overheadAfter:compiled.overhead.after,
 files};
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sha,main:[compiled.before,compiled.after],
 overhead:[compiled.overhead.before,compiled.overhead.after],files:files.length,
 bytes:totalBytes}));
