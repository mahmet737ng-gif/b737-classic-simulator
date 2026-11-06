'use strict';
/* Pages-only cleanup. Never edit the checked-in owner photographs or their
 * immutable provenance; only remove archival files from the compiled copy. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'web-dist');
if(!fs.existsSync(path.join(out,'panel-mosaic-lab/cockpit/index.html')))
 throw Error('Compiled cockpit entry missing; refusing to prune');
const walk=(dir,files=[])=>{for(const name of fs.readdirSync(dir)){
 const full=path.join(dir,name),stat=fs.lstatSync(full);
 if(stat.isDirectory())walk(full,files);else if(stat.isFile())files.push(full);
 }return files;};
const all=walk(out),rel=f=>path.relative(out,f).replace(/\\/g,'/');
const runtime=all.filter(f=>/\.(?:js|mjs|css|html|json)$/.test(f)
 &&!/(?:^|\/)(?:tests?|docs|tools|unity|desktop)\//.test(rel(f)));
const references=runtime.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const ownerPhoto=/^panel-mosaic-lab\/assets\/locked\/.*\.(?:png|jpg|jpeg|webp)$/i;
const reserved=[
 /^panel-mosaic-lab\/assets\/locked\/2026-10-23\/Switches\//,
 /^panel-mosaic-lab\/cockpit\/assets\//,
 /^panel-mosaic-lab\/cockpit\/performance\//,
 /^panel-mosaic-lab\/le-devices\//,
 /^panel-mosaic-lab\/assets\/throttle-levers\//
];
const neverWeb=/^(?:docs|tests|tools|unity|desktop|\.github|\.vscode|\.claude)\//;
let count=0,bytes=0;
for(const file of all){
 const name=rel(file);if(reserved.some(re=>re.test(name)))continue;
 const unusedPhoto=ownerPhoto.test(name)&&
  !references.includes(path.posix.basename(name))&&!references.includes(name);
 const archive=neverWeb.test(name)||
  /\.(?:cjs|py|pyc|md|markdown|yml|yaml|ts|tsx|cs|ps1|bat|cmd|sh|patch|diff|lock|log)$/i.test(name)||
  /(?:^|\/)__tests__\//.test(name);
 if(!unusedPhoto&&!archive)continue;
 bytes+=fs.statSync(file).size;fs.rmSync(file);count++;
}
// Fail closed: every lossless or responsive texture and its original
// fallback must remain in the published tree, byte-identical to source.
for(const filename of ['panel-mosaic-lab/cockpit/performance/manifest.js',
 'panel-mosaic-lab/cockpit/performance/lossless/manifest.js']){
 const raw=fs.readFileSync(path.join(out,filename),'utf8');
 const manifest=JSON.parse(raw.slice(raw.indexOf('=')+1).replace(/;\s*$/,''));
 for(const [source,entry] of Object.entries(manifest.images||{})){
  if(!fs.existsSync(path.join(out,source)))throw Error('Missing original texture '+source);
  for(const url of entry.levels?.map(x=>x.url)||[entry.url].filter(Boolean))
   if(!fs.existsSync(path.join(out,url)))throw Error('Missing derivative '+url);
 }
}
console.log('Pages deployment-only pruning: '+count+' archived or unreferenced files removed, '+(bytes/1048576).toFixed(1)+' MiB saved. Original repository untouched.');