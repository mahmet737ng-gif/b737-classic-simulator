'use strict';
// Desktop-only response compilation. Original HTML/JS and owner imports stay intact.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const ENTRY='panel-mosaic-lab/cockpit/index.html';
const protectedName=/(?:irs|guard|owner|le-devices|conventional)/i;
function compile(root){
 const html=fs.readFileSync(path.join(root,ENTRY),'utf8'),base=new URL('https://desktop.invalid/'+ENTRY);
 const re=/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>\s*<\/script>/gi;
 const scoped=code=>/^(?:\(function\b|\(\(\)\s*=>)/.test(code.replace(/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*/,''));
 const tags=[...html.matchAll(re)].map(m=>{
  const url=new URL(m[2],base),file=url.pathname.slice(1),code=fs.readFileSync(path.join(root,file),'utf8');
  return {tag:m[0],url:m[2],file,code,start:m.index,end:m.index+m[0].length,dir:path.posix.dirname(file),
   eligible:scoped(code)&&/\sdefer(?:\s|>)/i.test(m[0])&&!/\s(?:async|type)\b/i.test(m[0])&&!protectedName.test(file)&&!code.includes('currentScript')&&!code.includes('document.scripts')&&!/\bimport\s*\(|getElementsByTagName\(['"]script|querySelector(?:All)?\(['"]script/.test(code)&&!/querySelector[^\n]*script\[/.test(code)};
 });
 const groups=[];let group=[];
 function flush(){if(group.length>1)groups.push(group);group=[];}
 for(const tag of tags){
  if(!tag.eligible){flush();continue;}
  const previous=group.at(-1);
  if(previous&&(html.slice(previous.end,tag.start).trim()||group.length>=8))flush();
  group.push(tag);
 }
 flush();let result='',cursor=0;const bundles=[];
 for(const g of groups){
  const content='(async()=>{\n'+g.map(t=>';\n/* '+t.url+' */\ntry{\n'+t.code+'\n}catch(error){queueMicrotask(()=>{throw error});}\n;await 0;\n').join('')+'})();\n';
  new vm.Script(content,{filename:'desktop-bundle'});
  const hash=crypto.createHash('sha256').update(content).digest('hex').slice(0,16);
  const file=g[0].dir+'/desktop-bundle-'+hash+'.js';
  const relative=path.posix.relative(path.posix.dirname(ENTRY),file);
  const url=(relative.startsWith('.')?relative:'./'+relative)+'?v=DESKTOP-'+hash;
  result+=html.slice(cursor,g[0].start)+'<script src="'+url+'" defer></script>';cursor=g.at(-1).end;
  bundles.push({path:file,url,content,sources:g.map(t=>t.url)});
 }
 result+=html.slice(cursor);
 const expanded=[...result.matchAll(re)].flatMap(m=>bundles.find(b=>b.url===m[2])?.sources||[m[2]]);
 if(JSON.stringify(expanded)!==JSON.stringify(tags.map(t=>t.url)))throw Error('Desktop compilation changed script execution order');
 for(const tag of tags.filter(t=>protectedName.test(t.file)))if(!result.includes(tag.tag))throw Error('Protected owner mount was changed: '+tag.url);
 return {html:result,bundles,before:tags.length,after:[...result.matchAll(re)].length};
}
function build(root){
 const result=compile(root),dir=path.join(root,'desktop-runtime');fs.mkdirSync(dir,{recursive:true});
 let previous;try{previous=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));}catch{}
 for(const name of previous?.generated||[]){
  if(!/^(?:[a-zA-Z0-9_-]+\/)+desktop-bundle-[a-f0-9]{16}\.js$/.test(name))throw Error('Invalid generated bundle path');
  fs.rmSync(path.join(root,name),{force:true});
 }
 for(const bundle of result.bundles)fs.writeFileSync(path.join(root,bundle.path),bundle.content);
 fs.writeFileSync(path.join(dir,'cockpit-index.html'),result.html);
 const manifest={schema:'cockpit-desktop-runtime/1',overrides:{[ENTRY]:'desktop-runtime/cockpit-index.html'},
  generated:result.bundles.map(b=>b.path),requests:{before:result.before,after:result.after}};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('Desktop ordered script requests: '+result.before+' -> '+result.after+'; all owner mount tags preserved');
 return manifest;
}
if(require.main===module)build(path.resolve(__dirname,'..'));
module.exports={compile,build};
