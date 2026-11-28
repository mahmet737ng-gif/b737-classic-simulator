'use strict';
// GitHub-only standalone release: publish the pinned verified browser runtime,
// never Railway's server, environment, database, or authenticated API payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),os=require('node:os'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'web-dist');
const RELEASE='159b868108df49f598c8c1ab620c610ad0f845e2';
const PROJECT='/b737-classic-simulator/';
const COCKPIT='panel-mosaic-lab/cockpit/';
const run=(args,opts={})=>execFileSync('git',args,{cwd:ROOT,...opts});
function exact(source,from,to){
 if(source.split(from).length!==2)throw Error('GitHub release marker mismatch: '+from.slice(0,100));
 return source.replace(from,to);
}
function standalone(html){
 const redirect=/<script id="unified-gateway-entry-v1">[\s\S]*?<\/script>/;
 if(!redirect.test(html))throw Error('Expected gateway redirect not found');
 html=html.replace(redirect,'<script>(function(){window.B737GitHubStandalone=true;const u=new URL(location.href);if(u.searchParams.has("crewRoom")){u.searchParams.delete("crewRoom");history.replaceState(history.state,"",u);}})();</script>');
 html=exact(html,"const live=location.hostname==='ata24-review-gateway-production.up.railway.app'&&\n  /^\\/panel-mosaic-lab\\/(?:unified|cockpit)\\/(?:index\\.html)?$/.test(location.pathname);","const live=true; // GitHub standalone entry");
 // The private database connector is not a public data source.
 html=html.replace(/<script\b[^>]*src="[^"]*iran-navdata-client-v2\.js[^"]*"[^>]*><\/script>/g,'');
 const notice='<script>window.B737StandaloneRelease=Object.freeze({commit:"'+RELEASE+'",mode:"GITHUB_ONLY",privateRoom:"P2P_TRIAL",privateNavdata:false});</script><script src="./peer-authority-v2.js?v=P2P-2" defer></script><script src="./peer-room-v2.js?v=P2P-2" defer></script>';
 html=exact(html,'</head>',notice+'</head>');
 if(html.includes('ata24-review-gateway-production.up.railway.app'))throw Error('Railway redirect survived');
 return html;
}
function localPaths(html){
 return html.replace(/(\b(?:src|href)=["'])\/(?!\/)(?=(?:panel-mosaic-lab|cdu-standalone-v6|assets|engine|audio|audio-lab|cb-panel-lab|efis-display-lab|flight-controls-panel)\/)/g,'$1'+PROJECT);
}
function publish(){
 if(!fs.existsSync(path.join(OUT,COCKPIT,'index.html')))throw Error('Build the existing Pages artifact before the release overlay');
 try{run(['cat-file','-e',RELEASE+'^{commit}']);}
 catch{run(['fetch','--no-tags','origin','unified-engine-out-final10-20261125'],{stdio:'inherit'});}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unified-pages-'));
 try{
  const archive=path.join(dir,'runtime.tar'),fd=fs.openSync(archive,'w');
  try{run(['archive',RELEASE,'runtime/fast-unified'],{stdio:['ignore',fd,'inherit']});}finally{fs.closeSync(fd);}
  execFileSync('tar',['-xf',archive,'-C',dir],{stdio:'inherit'});
  const source=path.join(dir,'runtime','fast-unified');
  const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
  if(manifest.schema!=='b737-unified-fast-runtime/1'||!Array.isArray(manifest.files))throw Error('Invalid pinned runtime manifest');
  const bytes=new Map(),digests=new Map(),compressed=new Map();
  for(const e of manifest.files){
   if(typeof e.path!=='string'||e.path.includes('..')||! /^(?:[a-zA-Z0-9._-]+\/)+[a-zA-Z0-9._-]+\.(?:html|js|cjs|css|json|webmanifest|svg|webp|png|ttf|woff2|mp3|m4a)$/.test(e.path)||
    !/^[a-f0-9]{64}$/.test(e.sha256)||bytes.has(e.path))throw Error('Unexpected runtime path: '+e.path);
   const body=fs.readFileSync(path.join(source,e.path));
   if(crypto.createHash('sha256').update(body).digest('hex')!==e.sha256)throw Error('Runtime digest mismatch: '+e.path);
   bytes.set(e.path,body);digests.set(e.path,e.sha256);
  }
  // Apply the same approved physical-CDU/Cold & Dark visual correction
  // that the pinned release applies to verified resources on startup.
  const server=run(['show',RELEASE+':server.js'],{encoding:'utf8',maxBuffer:2*1024*1024});
  const begin=server.indexOf('function applyColdDarkVisualFix('),end=server.indexOf('\nconst fastRuntime=',begin);
  if(begin<0||end<0)throw Error('Pinned visual correction not found');
  const context={Buffer,crypto,zlib,bytes,digests,compressed};
  vm.runInNewContext(server.slice(begin,end)+'\napplyColdDarkVisualFix(bytes,compressed,digests);',context,{timeout:10000});
  const entry=COCKPIT+'index.html';
  if(!bytes.has(entry)||!bytes.has(COCKPIT+'overhead-stage.html'))throw Error('Missing cockpit entry');
  let h=standalone(bytes.get(entry).toString('utf8'));
  const lamps=bytes.get(COCKPIT+'performance/boot-lamp-sources.json');
  if(lamps)h=exact(h,'</head>','<script>window.B737BootLampSources=Promise.resolve('+lamps.toString('utf8').replace(/</g,'\\u003c')+');</script></head>');
  bytes.set(entry,Buffer.from(h));
  const lobby=bytes.get(COCKPIT+'crew-room-v1.js').toString('utf8').trim();
  const crew=bytes.get(COCKPIT+'crew-cockpit-v1.js').toString('utf8').trim();
  const bundleName=COCKPIT+'desktop-bundle-fa87fb95723b69b3.js';
  let bundle=bytes.get(bundleName).toString('utf8');
  bundle=exact(bundle,lobby,'/* P2P lobby is mounted separately. */');
  bundle=exact(bundle,crew,'/* Native crew adapter starts after P2P pairing. */');
  bytes.set(bundleName,Buffer.from(bundle));
  for(const file of ['peer-authority-v2.js','peer-room-v2.js','peer-cockpit-v2.js']){
   const source=path.join(ROOT,'tools','peer-room',file);
   bytes.set(COCKPIT+file,fs.readFileSync(source));
  }
  // Static resources are served within the repository's project URL, not /.
  // Only browser runtime files are overlaid; the existing public Pages tree
  // supplies original reference artwork and shared source dependencies.
  for(const [relative,body] of bytes){
   if(/\.cjs$/.test(relative))continue;
   let data=body;
   if(/\.html$/.test(relative)){
    let html=localPaths(body.toString('utf8'));
    html=html.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=["'])([^"']+\.(?:js|css)(?:\?[^"']*)?)(["'])/g,(all,start,url,close)=>{
     if(/^(?:https?:|\/\/)/.test(url))return all;
     return start+url+(url.includes('?')?'&amp;':'?')+'ghRelease='+RELEASE.slice(0,12)+close;
    });
    data=Buffer.from(html);
   }
   const dest=path.join(OUT,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);
  }
  // Canonical alias with no Railway redirect and no room credentials.
  const alias=path.join(OUT,'panel-mosaic-lab','unified','index.html');
  fs.mkdirSync(path.dirname(alias),{recursive:true});
  fs.writeFileSync(alias,'<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=../cockpit/"><title>Unified Standalone</title></head><body><a href="../cockpit/">Open Unified</a></body></html>');
  fs.writeFileSync(path.join(OUT,COCKPIT,'github-release.json'),JSON.stringify({commit:RELEASE,sourceCommit:manifest.sourceCommit,mode:'GITHUB_ONLY',privateRoom:'P2P_TRIAL',privateNavdata:false,verifiedFiles:bytes.size},null,2)+'\n');
  // Validate all local resource URLs on the three primary documents.
  for(const relative of [entry,COCKPIT+'overhead-stage.html',COCKPIT+'cdu-stage.html']){
   const html=fs.readFileSync(path.join(OUT,relative),'utf8'),doc=new URL(PROJECT+relative,'https://static.invalid');
   const base=new URL(html.match(/<base\s+href="([^"]+)"/i)?.[1]||doc.href,doc);
   for(const match of html.matchAll(/<(?:script|link|img|iframe)\b[^>]*?(?:src|href)="([^"]+)"/g)){
    const val=match[1];if(/^(?:https?:|data:|#|blob:)/i.test(val))continue;
    const u=new URL(val.replaceAll('&amp;','&'),base);
    if(u.origin!==doc.origin||!u.pathname.startsWith(PROJECT))throw Error('Non-project asset URL: '+val);
    const file=decodeURIComponent(u.pathname.slice(PROJECT.length));
    if(!fs.existsSync(path.join(OUT,file)))throw Error('Static resource missing: '+file+' from '+relative);
   }
  }
  console.log('GitHub-only Unified release '+RELEASE+' verified '+bytes.size+' runtime files.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)publish();
module.exports={standalone,localPaths,publish};
