'use strict';
// Export the verified public browser compiler output for the authenticated
// Railway gateway. NO cockpit images, private navigation data or credentials
// are duplicated into this artifact.
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
const entries=[
 ['panel-mosaic-lab/cockpit/index.html',compiled.html],
 ['panel-mosaic-lab/cockpit/overhead-stage.html',compiled.overhead.html],
 ...generated
];
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
 bytes:entries.reduce((x,[,c])=>x+Buffer.byteLength(c),0)}));
