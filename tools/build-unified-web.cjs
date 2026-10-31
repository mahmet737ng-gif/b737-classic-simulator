'use strict';
// Share the verified desktop compiler; publish to a separate static tree.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {compile}=require('../desktop/build-runtime.cjs');
const ENTRY='panel-mosaic-lab/cockpit/index.html';
const OVERHEAD='panel-mosaic-lab/cockpit/overhead-stage.html';
const protectedName=/(?:irs|guard|owner|le-devices|conventional)/i;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
function revisioned(compiled,root,entry){
 const generated=new Map(compiled.bundles.map(b=>[b.path,b.content]));
 const source=fs.readFileSync(path.join(root,entry),'utf8');
 const baseMatch=source.match(/<base\s+href=(["'])([^"']+)\1/i);
 const doc=new URL('https://unified.invalid/'+entry),base=baseMatch?new URL(baseMatch[2],doc):doc;
 const html=compiled.html.replace(/<(?:script|link)\b[^>]*>/gi,tag=>{
  const match=tag.match(/\b(?:src|href)=(["'])([^"']+)\1/i);if(!match)return tag;
  const url=new URL(match[2],base),file=url.pathname.slice(1);
  if(url.origin!==base.origin||protectedName.test(file)||!/[.](?:js|css)$/.test(file))return tag;
  const bytes=generated.get(file)??fs.readFileSync(path.join(root,file));
  const relative=new URL(match[2],base);relative.searchParams.set('v','WEB-'+hash(bytes));
  const original=match[2].split(/[?#]/)[0];
  return tag.replace(match[2],original+relative.search+relative.hash);
 });
 return {...compiled,html,revision:hash(html)};
}
function prepare(root){
 const result=revisioned(compile(root),root,ENTRY);
 const overhead=revisioned(compile(root,OVERHEAD),root,OVERHEAD);
 return {...result,overhead};
}
function build(root,out=path.join(root,'web-dist')){
 root=path.resolve(root);out=path.resolve(out);
 if(out===root||!out.startsWith(root+path.sep))throw Error('Web output must be inside the checkout');
 const result=prepare(root);
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 // Only repository-owned files enter the public artifact, never caches,
 // installed dependencies, local fixtures or native packaging outputs.
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:8*1024*1024}).toString().split('\0').filter(Boolean);
 for(const file of files){
  if(file.startsWith('.')||file.startsWith('desktop/')||file.startsWith('web-dist/'))continue;
  const source=path.join(root,file),stat=fs.lstatSync(source);if(!stat.isFile())continue;
  const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
 }
 for(const b of [...result.bundles,...result.overhead.bundles]){
  const dest=path.join(out,b.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b.content);
 }
 fs.writeFileSync(path.join(out,ENTRY),result.html);
 fs.writeFileSync(path.join(out,OVERHEAD),result.overhead.html);
 const manifest={schema:'b737-unified-web/1',revision:result.revision,requests:{before:result.before,after:result.after},generated:[...result.bundles,...result.overhead.bundles].map(b=>b.path),overhead:{revision:result.overhead.revision,requests:{before:result.overhead.before,after:result.overhead.after}}};
 fs.writeFileSync(path.join(out,'panel-mosaic-lab/cockpit/runtime-build.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'.nojekyll'),'');
 console.log('Unified web '+result.revision+': main '+result.before+' -> '+result.after+', overhead '+result.overhead.before+' -> '+result.overhead.after+' ordered scripts; owner mounts preserved');
 return manifest;
}
if(require.main===module)build(path.resolve(__dirname,'..'));
module.exports={prepare,build,ENTRY};
