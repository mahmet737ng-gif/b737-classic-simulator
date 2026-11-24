'use strict';
/* Standalone ATA24 lab gateway. No upstream application routes or cross-app writes. */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {performance} = require('node:perf_hooks');
const { Pool } = require('pg');
const PrivateNavData=require('./navdata-store.js');
const {createCrewRoomHandler}=require('./crew-rooms.js');
const NavdataBootstrap=require('./navdata-bootstrap.js');
const NavdataRelay=require('./navdata-relay.js');
const {OWNER_SESSION_SECONDS,GUEST_SESSION_SECONDS,DEVICE_SESSION_SECONDS,isDocumentNavigation,canRegisterDevice}=require('./auth-policy.js');

const PORT = Number(process.env.PORT || 3000);
const USER = process.env.LAB_USER || 'Ali.m';
const BUILTIN_SCRYPT = 'scrypt:e16e63d5777399754f7b87d6666a7768:575fd8471f434a6e088f38abde8e62ce9a9cec892bd70b69ff07593d0abed044b99e0b5cd93f36bd4c83e340e96fdc9d4ce2bbe2a762d6aa3098d2b1d680ba89';
const PASSWORD_HASH = process.env.LAB_PASSWORD_SCRYPT || BUILTIN_SCRYPT;
const MAX_DEVICES = 3;
// This owner-supplied navigation subset is held in Railway variables only.
// Never publish the route database as part of the public GitHub repository.
const AIRWAY_REFERENCE=(()=>{try{return JSON.parse(process.env.LAB_AIRWAY_DHN_VERIFIED||'{}');}
 catch(_){return {};}})();
// Owner's wpNavRTE.txt ordered fixes, populated privately in Railway. Unknown
// topology must fail closed; a global waypoint-name match is not sufficient.
const AIRWAY_POINTS=(()=>{try{return JSON.parse(process.env.LAB_AIRWAY_DHN_ROUTE_POINTS_V1||'{}');}
 catch(_){return {};}})();
const UNLIMITED_USER = 'Taregh';
// Disabled unless Railway provides the salted verifier via a protected variable.
const UNLIMITED_PASSWORD_SCRYPT = process.env.LAB_TAREGH_PASSWORD_SCRYPT || '';
// Additional Unified accounts live exclusively in the protected Railway environment.
// Only salted scrypt verifiers, never plaintext passwords, are stored here.
const EXTRA_USERS = Object.freeze(JSON.parse(process.env.LAB_ADDITIONAL_USERS_JSON || '{}'));
for (const [name, verifier] of Object.entries(EXTRA_USERS)) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$/.test(name) ||
      !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(verifier) ||
      [UNLIMITED_USER,USER].some(value => value.toLowerCase() === name.toLowerCase())) {
    throw new Error('Invalid additional Unified account configuration');
  }
}
if (new Set(Object.keys(EXTRA_USERS).map(name => name.toLowerCase())).size !== Object.keys(EXTRA_USERS).length)
  throw new Error('Duplicate additional Unified account username');
const TOKEN_COOKIE = 'ata24_session';
const DEVICE_COOKIE = 'ata24_device';
const folder = path.join(__dirname, 'public');
const runtimeDir = path.join(__dirname, 'runtime');
const runtimeFiles = new Set(require('./runtime/manifest.json'));

/* Version-matched optimized cockpit compiled by the same tested web compiler
 * used for GitHub Pages. The protected Railway session check still precedes
 * EVERY response. Only public JS and HTML from the main simulator are mirrored;
 * owner photographs and all private NAVDATA remain in their original routes. */
// A sibling directory keeps these three documents outside the legacy cockpit
// worker's scope. Their original relative asset bases and same-origin session
// remain valid. Only these documents are routed through the new entry.
const cockpitSource='panel-mosaic-lab/cockpit/';
const directPath='/panel-mosaic-lab/unified/';
const directDocuments=new Map([
 [directPath,cockpitSource+'index.html'],
 [directPath+'overhead-stage.html',cockpitSource+'overhead-stage.html'],
 [directPath+'cdu-stage.html',cockpitSource+'cdu-stage.html']
]);
const fastRuntimeDir=path.join(runtimeDir,'fast-unified');
const fastRuntime=(()=>{
 try {
  const disk=require('node:fs');
  const manifest=JSON.parse(disk.readFileSync(path.join(fastRuntimeDir,'manifest.json'),'utf8'));
  if(manifest.schema!=='b737-unified-fast-runtime/1'||
   !/^[a-f0-9]{40}$/.test(manifest.sourceCommit)||
   !Array.isArray(manifest.files))throw Error('Invalid compiled-runtime manifest');
  const bytes=new Map(),compressed=new Map(),digests=new Map();
  for(const entry of manifest.files){
   const relative=entry.path;
   if(typeof relative!=='string'||relative.includes('..')||
    !/^(?:[a-zA-Z0-9._-]+\/)+[a-zA-Z0-9._-]+\.(?:html|js|cjs|css|json|webmanifest|svg|webp|png|ttf|woff2|mp3|m4a)$/.test(relative)||
    !/^[a-f0-9]{64}$/.test(entry.sha256))
     throw Error('Invalid compiled-runtime resource path');
   const full=path.resolve(fastRuntimeDir,relative);
   if(!full.startsWith(fastRuntimeDir+path.sep))throw Error('Runtime path escapes directory');
   const body=disk.readFileSync(full);
   if(crypto.createHash('sha256').update(body).digest('hex')!==entry.sha256)
    throw Error('Invalid compiled-runtime digest: '+relative);
   if(bytes.has(relative))throw Error('Duplicate compiled-runtime resource');
   bytes.set(relative,body);digests.set(relative,entry.sha256);
   if(/\.(?:js|cjs|css|json)$/.test(relative)){
    compressed.set(relative,zlib.brotliCompressSync(body,{
     params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}
    }));
   }
  }
  if(!bytes.has('panel-mosaic-lab/cockpit/index.html')||
   !bytes.has('panel-mosaic-lab/cockpit/overhead-stage.html'))
    throw Error('Compiled cockpit or overhead entry missing');
  console.log('UNIFIED FAST RUNTIME LOADED: '+manifest.sourceCommit+' / '+bytes.size+' verified resources');
  return {sourceCommit:manifest.sourceCommit,bytes,compressed,digests};
 } catch(error){
  if(error.code==='ENOENT'&&!require('node:fs').existsSync(fastRuntimeDir))return null;
  throw Error('Invalid Unified release', {cause:error});
 }
})();
// Deployment activation, after manifest and digest validation, is the release
// boundary. Browser navigation must never consult the moving GitHub ref.
function optimizedSource(relative){
 return fastRuntime?.bytes.get(relative);
}

/* The protected guest is a live mirror of the original main-branch cockpit.
 * Railway authenticates and serves the same source URLs under its own origin.
 * No duplicated/stale overhead code or artwork is maintained here. */
const {Readable} = require('node:stream');
const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/mahmet737ng-gif/b737-classic-simulator/';
const GITHUB_RAW = GITHUB_RAW_ROOT+(fastRuntime?.sourceCommit||'main')+'/';
const GITHUB_PAGES = 'https://mahmet737ng-gif.github.io/b737-classic-simulator/';
const UPSTREAM_TIMEOUT_MS = 20000;
const ALLOWED_SOURCE_ROOTS = new Set([
  'acdc-metering-lab','approved-panel-stack','assets','audio','audio-lab',
  'branding','bus-consumer-test-lab','cb-panel-lab','cdu-font-test',
  'cdu-standalone','cdu-standalone-v3','cdu-standalone-v5','cdu-standalone-v6',
  'cpcs-lab','dcpcs-lab','eadi-attitude-lab','eadi-attitude-v5',
  'efis-display-lab', // EADI/EHSI renderers, glyphs, reference geometry
  'electrical-lab','electrical-load-lab','engine','fire-handle-lab',
  'fire-protection-lab','flight-controls-panel','fuel-panel','instrument-lab',
  'integration-lab','interactive-panel-test','isn-ecu-start-lab',
  'isn-electrical-pack-lab','isn-start-sequence-lab','main-panel-lab',
  'navigation','overhead-layout','panel-mosaic-lab','panels-stacked',
  'pneumatics-lab','shared-assets','stall-warning-lab','switch-lab',
  'systems-integration-lab','trainer-lab','vector-lab','technical-database',
  'data','navdata','mrg','aircon-lab','anti-ice-lab','apu-lab','hydraulic-lab'
]);
const PROXY_EXTENSIONS = new Set(['.html','.htm','.js','.mjs','.cjs','.css','.json','.svg',
 '.png','.jpg','.jpeg','.webp','.gif','.avif','.ico','.woff','.woff2','.ttf',
 '.webmanifest','.txt','.csv','.xml','.wasm','.bin','.b64','.mp3','.m4a','.mp4','.webm','.pdf']);
const PROXY_MIME = Object.freeze({
 '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.gif':'image/gif','.avif':'image/avif','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
 '.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8',
 '.csv':'text/csv; charset=utf-8','.xml':'application/xml',
 '.wasm':'application/wasm','.bin':'application/octet-stream',
 '.b64':'text/plain; charset=utf-8',
 '.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf'
});
function repoAssetPath(urlPath) {
  // Only fixed source roots; never proxy untrusted network addresses.
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch (_) { return null; }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.includes('//')) return null;
  const segments=decoded.split('/').filter(Boolean);
  // A few approved photo references live directly in the repository root.
  if(segments.length===1 && /^[A-Za-z0-9_.-]+\.(?:png|webp|svg|jpg|jpeg)$/i.test(segments[0]))
    return segments[0];
  if (!segments.length || !ALLOWED_SOURCE_ROOTS.has(segments[0])) return null;
  if (segments.some(p=>p==='..' || p==='.' || p.startsWith('.'))) return null;
  if (segments.length===1 || decoded.endsWith('/')) segments.push('index.html');
  const rel=segments.join('/');
  if (!PROXY_EXTENSIONS.has(path.posix.extname(rel).toLowerCase())) return null;
  return rel;
}
async function upstreamFetch(relative) {
  // Never resolve a release dependency against another revision. Generated
  // diagnostic Pages remain available by their explicit entry points.
  const pagesDiagnostic=/^panel-mosaic-lab\/cockpit\/(?:unified-(?:diagnostic-v6|diagnostic-static-v6|light-overhead-v10|no-cdu-v10|composite-test|static-controls-test|efis-v3)\.html|overhead-(?:real-f-in-unified-v10|composite-stage|static-controls-stage)\.html|(?:runtime-build\.json|startup-benchmark\.json))$/.test(relative);
  const origins=!fastRuntime||pagesDiagnostic?[GITHUB_RAW,GITHUB_PAGES]:[GITHUB_RAW];
  for (const origin of origins) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
    try {
      const response=await fetch(origin+relative,{signal:controller.signal,
        headers:{'User-Agent':'ATA24-guest-training-gateway','Accept':'*/*'},
        redirect:'follow',cache:'no-store'});
      clearTimeout(timer);
      if(response.ok)return response;
      await response.body?.cancel();
      if(response.status!==404)throw Error('GitHub upstream returned '+response.status);
    }catch(e){clearTimeout(timer);if(origin===origins.at(-1))throw e;}
  }
  return null;
}
// Authorized-only, bounded read-through cache for source JS/CSS. Never cache
// HTML, navigation data, credentials or session decisions. Each request still
// passes the database-backed authorization check BEFORE reaching this cache.
// A version change gets a distinct entry; unversioned and ts-busted files
// continue through the original uncached streaming source path.
const SOURCE_CACHE_TTL_MS=15*60*1000,SOURCE_CACHE_ENTRY_MAX=256*1024,SOURCE_CACHE_LIMIT=24*1024*1024;
const sourceCache=new Map(),sourceInFlight=new Map();
let sourceCacheBytes=0;
async function cachedSourceText(relative,requestUrl) {
  const parsed=new URL(requestUrl,'https://gateway.invalid');
  const version=parsed.searchParams.get('v');
  if(!version || parsed.searchParams.has('ts'))return null;
  const key=relative+'?v='+version+'@'+(typeof fastRuntime!=='undefined'&&fastRuntime?.sourceCommit||'main');
  const current=sourceCache.get(key);
  if(current){
    if(current.expires>Date.now()){
      sourceCache.delete(key);sourceCache.set(key,current);
      return current.bytes;
    }
    sourceCache.delete(key);sourceCacheBytes-=current.bytes.length;
  }
  if(sourceInFlight.has(key))return sourceInFlight.get(key);
  const task=(async()=>{
    const response=await upstreamFetch(relative);
    if(!response)return undefined;
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<=SOURCE_CACHE_ENTRY_MAX){
      while(sourceCacheBytes+bytes.length>SOURCE_CACHE_LIMIT && sourceCache.size){
        const oldest=sourceCache.keys().next().value;
        const item=sourceCache.get(oldest);sourceCache.delete(oldest);
        sourceCacheBytes-=item.bytes.length;
      }
      sourceCache.set(key,{bytes,expires:Date.now()+SOURCE_CACHE_TTL_MS});
      sourceCacheBytes+=bytes.length;
    }
    return bytes;
  })();
  sourceInFlight.set(key,task);
  try{return await task;}finally{sourceInFlight.delete(key);}
}
// Prewarm only public, explicitly revisioned JS/CSS referenced by the
// already-authenticated cockpit's compiled entry points. NO NAVDATA, HTML or
// protected user/session data is prefetched. Does not block server health.
async function prewarmFastRuntime(){
 if(!fastRuntime)return;
 const files=new Map(),origin='https://warm.invalid/';
 for(const entry of ['panel-mosaic-lab/cockpit/index.html','panel-mosaic-lab/cockpit/overhead-stage.html']){
  const markup=fastRuntime.bytes.get(entry)?.toString('utf8');
  if(!markup)continue;
  const doc=new URL(entry,origin);
  const baseMatch=markup.match(/<base\s+href=(["'])([^"']+)\1/i);
  const base=baseMatch?new URL(baseMatch[2],doc):doc;
  for(const match of markup.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=(["'])([^"']+)\1[^>]*>/gi)){
   try{
    const url=new URL(match[2].replaceAll('&amp;','&'),base);
    const relative=url.pathname.slice(1);
    if(url.origin!==base.origin||!/^[-a-zA-Z0-9_./]+\.(?:js|css)$/.test(relative)||
     !url.searchParams.has('v')||fastRuntime.bytes.has(relative)||relative.includes('..'))continue;
    files.set(relative+'?'+url.searchParams.get('v'),{relative,url:url.href});
   }catch{}
  }
 }
 const queue=[...files.values()].slice(0,160);
 let index=0,ok=0,errors=0;
 await Promise.all(Array.from({length:8},async()=>{
  while(index<queue.length){
   const item=queue[index++];
   try{if(await cachedSourceText(item.relative,item.url))ok++;else errors++;}
   catch{errors++;}
  }
 }));
 console.log('UNIFIED FAST PREWARM: '+ok+' source JS/CSS ready, '+errors+' unavailable');
}
function directBootSetup(){
 const layout=fastRuntime.bytes.get(cockpitSource+'assembly.json');
 if(!layout)return '';
 const assembly=JSON.parse(layout.toString('utf8'));
 for(const entry of [...assembly.regions,...assembly.embeddedInstruments]){
  const embedded=entry.embeddedUrl;
  if(typeof embedded==='string'&&/^\.\/(?:overhead|cdu)-stage\.html\?/.test(embedded))
   entry.embeddedUrl=directPath+embedded.slice(2);
 }
 const previewManifest=fastRuntime.bytes.get(cockpitSource+'performance/manifest.json');
 const photoRegistry=fastRuntime.bytes.get(cockpitSource+'panel-photo-registry.v1.json');
 const images=previewManifest?JSON.parse(previewManifest).images:{};
 const photos=photoRegistry?JSON.parse(photoRegistry).panels:{};
 // VISUAL FIRST: 384px fitted photos only, never raw 4K originals.
 const firstPaint={};
 for(const key of Object.keys(assembly.assets||{})){
  const level=images[key]?.levels?.find(item=>item.extent===384&&!item.original);
  if(level&&fastRuntime.bytes.has(level.url))firstPaint[key]='/'+level.url;
 }
 // Both CDU stations display their approved unlit image before FMC runtime
 // is connected. The real staged CDU frame replaces the placeholder later.
 const cduPreviewKey='cdu-standalone-v6/assets/cdu-approved-unlit.png';
 const cduPhoto=images[cduPreviewKey]?.levels?.find(item=>item.extent===384&&!item.original);
 if(cduPhoto&&fastRuntime.bytes.has(cduPhoto.url))
  firstPaint[cduPreviewKey]='/'+cduPhoto.url;
 const artIndex=fastRuntime.bytes.get(cockpitSource+'performance/boot-art/manifest.json');
 const art={};
 if(artIndex)for(const [id,asset] of Object.entries(JSON.parse(artIndex))){
  if(!fastRuntime.bytes.has(asset.url)||!asset.url.startsWith(cockpitSource+'performance/boot-art/'))
   throw Error('Missing verified Unified boot artwork '+id);
  art[id]={url:'/'+asset.url,width:asset.width,height:asset.height,changed:asset.changed};
 }
 const preview=filename=>{
  const entry=images['panel-mosaic-lab/assets/locked/2026-10-23/'+filename];
  const image=entry?.levels.find(item=>item.extent===384&&!item.original)?.url;
  return fastRuntime.bytes.has(image)?'/'+image:undefined;
 };
 const photo=key=>{
  const image=cockpitSource+'assets/'+photos[key]?.file;
  return fastRuntime.bytes.has(image)?'/'+image+'?v=OH21-DEDICATED-20261106':undefined;
 };
 const cockpitControls=Object.keys(images).filter(source=>
  /^panel-mosaic-lab\/assets\/throttle-levers\/engine-[12]-[^/]+\.png$/.test(source)||
  source.startsWith(cockpitSource+'assets/asp-controls-v1/')||
  /\/Switches\/Fire_Handles\/FIRE_HANDEL_(?:ENG1|ENG2|APU)_OFF\.webp$/.test(source)||
  source==='cdu-standalone-v6/assets/cdu-approved-unlit.png'
 ).map(source=>{
  const selected=images[source].levels.find(item=>item.extent===384&&!item.original);
  return selected&&fastRuntime.bytes.has(selected.url)?'/'+selected.url:null;
 }).filter(Boolean);
 const setup=JSON.stringify({
  assembly,art,firstPaint,
  previews:{
   aircon400:preview('Boeing-Style Environmental Control Panel.png'),
   dcpcs:preview('DCPCS_Background_Owner.png'),
   oh21_400:photo('OH21_400'),oh21_300500:photo('OH21_300500'),cockpitControls
  }
 });
 const main=assembly.regions.find(region=>region.id==='main');
 const photoURLs=[...new Set([...(main?.placements||[]).map(p=>firstPaint[p.asset]),firstPaint['cdu-standalone-v6/assets/cdu-approved-unlit.png']].filter(Boolean))];
 const photoPreloads=photoURLs.map(url=>'<link rel="preload" as="image" href="'+url+'" fetchpriority="high">').join('');
 return photoPreloads+'<script>window.B737GatewayBoot='+setup.replace(/</g,'\\u003c')+';</script>';
}
function transformCockpitHTML(content,{direct=false}={}) {
  // Preserve the original ordered simulator scripts. Direct mode embeds the
  // release layout and starts the same documents under the sibling route.
  // Start an immediate same-origin session renewal BEFORE the hundreds of
  // original deferred cockpit assets. If a cached page survives expiry,
  // show login rather than leaving a partially loaded white cockpit.
  const preflight='<script>(function(){fetch("/api/pulse",{method:"POST",credentials:"same-origin",cache:"no-store"})'+
    '.then(function(r){if(r.status===401)location.replace("/login?e=expired");})'+
    '.catch(function(){})})();</script>';
  const injection = '<base href="/panel-mosaic-lab/cockpit/">'+(direct?directBootSetup():'')+preflight+
    '<meta name="unified-navdata-seed" content="/api/navdata/local-reference">'+
    '<link rel="stylesheet" href="/static/guest-cockpit.css">'+
    '<script src="/static/guest-cockpit.js" defer></script>'+
    '<script src="/static/session.js" defer></script>';
  if(!/<head\b[^>]*>/i.test(content))throw Error('Source cockpit document is malformed');
  let result=content.replace(/<head\b[^>]*>/i,m=>m+injection);
  // Photo preloads win the first lane; remove speculative ECU preload burst.
  // Deferred simulator scripts retain their original ordering and behavior.
  if(direct)result=result.replace(/<link\s+rel="preload"\s+as="script"[^>]*>\s*/gi,'');
  // This source is part of the verified release, shared by the three
  // documents. Its repetitive SVG compresses with the HTML. Deferring it
  // to an extra network fetch can trigger hundreds of lamp fallback requests.
  const lampPack=direct&&fastRuntime.bytes.get(cockpitSource+'performance/boot-lamp-sources.json');
  if(lampPack){
   const json=lampPack.toString('utf8').replace(/</g,'\\u003c');
   result=result.replace(/<\/head>/i,closing=>
    '<script>window.B737BootLampSources=Promise.resolve('+json+');</script>'+closing);
  }
  result=result.replace(/<title>[\s\S]*?<\/title>/i,'<title>B737 Classic | Electrical Training Bench</title>');
  result=result.replace(/(<meta\b[^>]*name="(?:application-name|apple-mobile-web-app-title)"[^>]*content=")[^"]*(")/gi,'$1B737 Classic$2');
  if(direct){
    // Release-local correction: the existing yellow aircraft enters from the
    // right and holds in its final pose rather than fading out.
    const aircraftHold='<style id="unified-welcome-aircraft-hold">'+
      '@keyframes unified-intro-arrive {'+
      '0% { opacity:0; transform:translate(110%,-.8%) scale(1); }'+
      '18% { opacity:1; }'+
      '59% { opacity:1; transform:translate(-5.3%,-6%) scale(1.14); }'+
      '100% { opacity:1; transform:translate(-5.8%,-6.3%) scale(1.17); }'+
      '}'+
      '</style>';
    result=result.replace(/<\/head>/i,aircraftHold+'</head>');
  }
  return result;
}
// No session-specific values are embedded in the markup. Build each
// variant once per process and reuse the exact compressed representation.
function versionCompiledLinks(html,relative){
 const junction=new URL(relative,'http://release.invalid/');
 const declared=html.match(/<base\s+href=(["'])([^"']+)\1/i)?.[2];
 const baseUrl=declared?new URL(declared,junction):junction;
 return html.replace(/<(?:link|script)\b[^>]*>/gi,tag=>{
  // Owner mounts and preload URLs paired with dynamically appended scripts
  // keep the exact original URL. Release-tag ordinary deferred assets only.
  if(!/^<script\b/i.test(tag)&&!(/\brel=(["'])stylesheet\1/i.test(tag)))return tag;
  return tag.replace(/\b(?:src|href)=(["'])([^"']+)\1/i,(match,quote,value)=>{
   const asset=new URL(value.replaceAll('&amp;','&'),baseUrl);
   if(asset.origin!==junction.origin||asset.searchParams.has('ts')||
      /(?:irs-|guard|owner18)/i.test(asset.pathname)||
      !/\.(?:js|css)$/.test(asset.pathname)||!optimizedSource(asset.pathname.slice(1)))return match;
   const url=asset.pathname+asset.search.replaceAll('&','&amp;')+
    (asset.search?'&amp;':'?')+'unifiedRelease='+fastRuntime.sourceCommit+asset.hash;
   return match.slice(0,match.indexOf(quote)+1)+url+quote;
  });
 });
}
const compiledDocuments=new Map();
function compiledDocument(relative,bytes,cockpitDocument,direct){
 const key=direct?'direct:'+relative:relative;
 if(!compiledDocuments.has(key)){
  const original=bytes.toString('utf8');
  const rendered=cockpitDocument?transformCockpitHTML(original,{direct}):
   original.replace(/<head\b[^>]*>/i,m=>m+'<script src="/static/session.js" defer></script>');
  const html=direct?versionCompiledLinks(rendered,relative):rendered;
  const raw=Buffer.from(html);
  const brotli=zlib.brotliCompressSync(raw,{
   params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}
  });
  compiledDocuments.set(key,{html,brotli,gzip:zlib.gzipSync(raw,{level:4})});
 }
 return compiledDocuments.get(key);
}
async function serveFastCompiledResponse(req,res,relative,bytes,{cockpitDocument=false,direct=false,authMs}={}){
 const ext=path.posix.extname(relative).toLowerCase();
 if(ext!=='.html'){
  const releasePinned=/\.(?:js|css)$/.test(relative)&&
   new URL(req.url,'http://localhost').searchParams.get('unifiedRelease')===fastRuntime.sourceCommit;
  const immutable=releasePinned||/desktop-bundle-[a-f0-9]{16}\.js$|[a-f0-9]{20}-q96-(?:384|768|1536)\.webp$/.test(relative)||
   /^panel-mosaic-lab\/cockpit\/performance\/boot-art\/[a-z0-9-]+-[a-f0-9]{20}\.webp$/.test(relative);
  res.setHeader('Cache-Control',immutable?'private, max-age=31536000, immutable':'private, max-age=0, must-revalidate');
  if(immutable)res.removeHeader('Pragma');
  res.setHeader('Vary','Accept-Encoding');
  const brotli=fastRuntime.compressed.get(relative);
  const accepts=String(req.headers['accept-encoding']||'');
  const encode=/\bbr\b/.test(accepts)&&brotli;
  const etag='"'+fastRuntime.digests.get(relative)+(encode?'-br':'')+'"';
  res.setHeader('ETag',etag);
  if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
  if(encode)res.setHeader('Content-Encoding','br');
  res.writeHead(200,{'Content-Type':PROXY_MIME[ext]});
  if(req.method==='HEAD')res.end();else res.end(encode?brotli:bytes);
  return;
 }
 const mime='text/html; charset=utf-8';
 res.setHeader('X-Unified-Release',fastRuntime.sourceCommit);
 const timing=['unified-compiled;desc="'+fastRuntime.sourceCommit+'"'];
 if(direct)timing.push('unified-direct');
 if(Number.isFinite(authMs))timing.push('gateway-auth;dur='+authMs.toFixed(1));
 res.setHeader('Server-Timing',timing.join(', '));
 res.setHeader('Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
  "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
  "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
  "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
  "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
 const {html,brotli,gzip}=compiledDocument(relative,bytes,cockpitDocument,direct);
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Accept-Encoding');
 const accepts=String(req.headers['accept-encoding']||'');
 const encoding=/\bbr\b/.test(accepts)?'br':/\bgzip\b/.test(accepts)?'gzip':null;
 if(encoding)res.setHeader('Content-Encoding',encoding);
 res.writeHead(200,{'Content-Type':mime});
 if(req.method==='HEAD'){res.end();return;}
 res.end(encoding==='br'?brotli:encoding==='gzip'?gzip:html);
}
async function serveGitHubSource(req,res,relative,{cockpitDocument=false,authMs}={}) {
  const textExt=path.posix.extname(relative).toLowerCase();
  const compiled=optimizedSource(relative);
  if(compiled){
    // Content-addressed JS bundles and page HTML pass through the unchanged
    // CSP, session injection, MIME and security-header code below.
    return serveFastCompiledResponse(req,res,relative,compiled,{cockpitDocument,authMs});
  }
  if(req.method==='GET'&&(textExt==='.js'||textExt==='.css')){
    try{
      const bytes=await cachedSourceText(relative,req.url);
      if(bytes!==null){
        if(!bytes){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('File not available in source repository');return;}
        res.setHeader('Cache-Control','private, max-age=30');
        res.writeHead(200,{'Content-Type':PROXY_MIME[textExt]});
        res.end(bytes);return;
      }
    }catch(e){
      console.error('Cached source unavailable',relative,e.message);
      res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});
      res.end('Source repository is temporarily unavailable');return;
    }
  }
  let response;
  try { response=await upstreamFetch(relative); }
  catch(e) {
    console.error('GitHub source unavailable',relative,e.message);
    res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Source repository is temporarily unavailable');return;
  }
  if(!response) {
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('File not available in source repository');return;
  }
  const ext=path.posix.extname(relative).toLowerCase();
  const mime=PROXY_MIME[ext]||'application/octet-stream';
  // All original GitHub HTML documents may contain their own inline cockpit
  // and test-lab boot scripts. Preserve those contracts on the Railway origin.
  if(ext==='.html' || ext==='.htm') {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
      "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
      "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
  }
  if(cockpitDocument) {
    // The full cockpit runs with the scripts' original same-origin and inline
    // boot contracts; the separately protected static guest files only change
    // visible panels and startup focus.
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
      "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
      "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
    const html=transformCockpitHTML(await response.text());
    res.setHeader('Server-Timing','unified-source;desc="uncompiled"');
    res.setHeader('Cache-Control','private, no-store');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(html);return;
  }
  if(ext==='.html' || ext==='.htm') {
    const original=await response.text();
    const injected=original.replace(/<head\b[^>]*>/i,m=>m+'<script src="/static/session.js" defer></script>');
    res.setHeader('Cache-Control','private, no-store');
    res.writeHead(200,{'Content-Type':mime});
    res.end(injected);return;
  }
  res.setHeader('Cache-Control','private, max-age=30');
  res.writeHead(200,{'Content-Type':mime});
  if(req.method==='HEAD') {await response.body?.cancel();res.end();return;}
  if(!response.body){res.end();return;}
  const source=Readable.fromWeb(response.body);
  source.on('error',e=>{console.error('Upstream stream interrupted',relative,e.message);res.destroy(e);});
  source.pipe(res);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000 });
const navdata=PrivateNavData.create(pool);
const crewAssets=new Map([
  ['/crew/lobby.js', [cockpitSource+'crew-room-v1.js', 'text/javascript']],
  ['/crew/lobby.css', [cockpitSource+'crew-room-v1.css', 'text/css']]
]);
const crewDialog=optimizedSource(cockpitSource+'index.html')?.toString()
  .match(/<dialog id="crewRoomDialog"(?=[\s>])[\s\S]*?<\/dialog>/)?.[0];
const crewReady=crewDialog && [...crewAssets.values()].every(([file])=>optimizedSource(file));
const crewQrEncoder=cockpitSource+'vendor/qrcode-generator-2.0.4.js';
if(optimizedSource(crewQrEncoder))crewAssets.set('/crew/qrcode.js',[crewQrEncoder,'text/javascript']);
const crewCockpitReady=crewReady && crewDialog.includes('data-crew-enter') &&
  optimizedSource(cockpitSource+'crew-cockpit-v1.js');
const crewOrigin=process.env.CREW_ORIGIN || (process.env.RAILWAY_PUBLIC_DOMAIN ?
  'https://'+process.env.RAILWAY_PUBLIC_DOMAIN : 'http://127.0.0.1');
const roomStore={
  async findHostedRoom(manager, at) {
    const result=await pool.query(
      'SELECT room FROM unified_crew_rooms WHERE manager=$1 AND expires_at>$2',[manager,at]);
    return result.rows[0]?.room;
  },
  async findInvitedRoom(invitationHash, at) {
    const result=await pool.query(
      'SELECT room FROM unified_crew_rooms WHERE invitation_hash=$1 AND expires_at>$2',[invitationHash,at]);
    return result.rows[0]?.room;
  },
  async createRoom(record, invitationHash, at) {
    const result=await pool.query(`
      INSERT INTO unified_crew_rooms (manager, expires_at, invitation_hash, room)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (manager) DO UPDATE SET
        expires_at=EXCLUDED.expires_at, invitation_hash=EXCLUDED.invitation_hash, room=EXCLUDED.room
      WHERE unified_crew_rooms.expires_at<=$5
      RETURNING room`,[record.manager,record.expires,invitationHash,JSON.stringify(record),at]);
    return result.rows[0]?.room ?? roomStore.findHostedRoom(record.manager,at);
  }
};
const crew=createCrewRoomHandler({
  origin: crewOrigin,
  roomStore,
  ownerUsername: UNLIMITED_USER,
  reservedUsernames: [USER, ...Object.keys(EXTRA_USERS)],
  gatewayIdentity: unifiedIdentity,
  async gatewayLogin(req, username, password) {
    const result=await registerUnifiedDevice(req,username,password);
    if(result.error){
      const error=result.error;
      const messages={
        rate:[429,'Too many attempts. Retry in 15 minutes.'],
        full:[409,'All three Unified guest device slots are registered.'],
        invalid:[401,'Incorrect username or password.']
      };
      const [status,message]=messages[error];
      throw Object.assign(new Error(message),{status});
    }
    return {username,cookies:result.cookies};
  },
  accounts: {
    async get(key) {
      const result=await pool.query('SELECT username, verifier FROM unified_crew_accounts WHERE account_key=$1',[key]);
      return result.rows[0];
    },
    async add(key, username, verifier) {
      const result=await pool.query(
        'INSERT INTO unified_crew_accounts(account_key, username, verifier) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [key,username,verifier]);
      return result.rowCount===1;
    }
  }
});

function serveCrewEntry(req,res,url){
  const asset=crewAssets.get(url.pathname);
  if(!crewReady || (!asset && url.pathname!=='/crew/'))return false;
  if(req.method!=='GET' && req.method!=='HEAD')return false;
  if(asset){
    res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8'});
    res.end(req.method==='HEAD'?undefined:optimizedSource(asset[0]));
    return true;
  }
  const standalone=crewDialog.includes('data-crew-host-role');
  const content=standalone?crewDialog.replace(/^<dialog/,'<main').replace(/<\/dialog>$/,'</main>'):crewDialog;
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(req.method==='HEAD'?undefined:'<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Unified Crew Room</title>'+
    '<link rel="stylesheet" href="/crew/lobby.css"><script src="/crew/lobby.js" defer></script>'+
    '<body data-crew-entry'+(standalone?' data-crew-page':' style="background:#071016"')+'>'+
    (standalone?'':'<button type="button" data-crew-open>Crew Room</button>')+content+'</body></html>');
  return true;
}

const attemptMap = new Map();
const assets = Object.freeze({
  '/': ['index.html','text/html; charset=utf-8'],
  '/lab/': ['lab.html','text/html; charset=utf-8'],
  '/static/portal.css': ['portal.css','text/css; charset=utf-8'],
  '/static/portal.js': ['portal.js','text/javascript; charset=utf-8'],
  '/static/guest-cockpit.css': ['guest-cockpit.css','text/css; charset=utf-8'],
  '/static/guest-cockpit.js': ['guest-cockpit.js','text/javascript; charset=utf-8'],
  '/static/portal-overhead.css': ['portal-overhead.css','text/css; charset=utf-8'],
  '/static/portal-overhead.js': ['portal-overhead.js','text/javascript; charset=utf-8'],
  '/static/lab-injection.js': ['lab-injection.js','text/javascript; charset=utf-8'],
  '/static/app.js': ['app.js','text/javascript; charset=utf-8'],
  '/static/session.js': ['session.js','text/javascript; charset=utf-8'],
  '/static/style.css': ['style.css','text/css; charset=utf-8'],
  '/static/mrg-electrical-plate-v2.css': ['mrg-electrical-plate-v2.css','text/css; charset=utf-8'],
  '/static/electrical-v7.js': ['electrical-v7.js','text/javascript; charset=utf-8'],
  '/static/classic-multifeed-topology-v1.js': ['classic-multifeed-topology-v1.js','text/javascript; charset=utf-8'],
  '/static/classic-bus-consumer-engine-v1.js': ['classic-bus-consumer-engine-v1.js','text/javascript; charset=utf-8'],
  '/static/classic-bus-consumer-test-lab-v1.js': ['classic-bus-consumer-test-lab-v1.js','text/javascript; charset=utf-8'],
  '/static/mrg-electrical-plate-v2.js': ['mrg-electrical-plate-v2.js','text/javascript; charset=utf-8'],
  '/static/mrg-classic-340-consumer-bus-index-v1.json': ['mrg-classic-340-consumer-bus-index-v1.json','application/json; charset=utf-8']
});
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function random() { return crypto.randomBytes(32).toString('base64url'); }
function cookies(req) {
  const result = Object.create(null);
  for (const chunk of String(req.headers.cookie || '').split(';')) {
    const i = chunk.indexOf('=');
    if (i > 0) {
      try { result[chunk.slice(0,i).trim()] = decodeURIComponent(chunk.slice(i+1).trim()); } catch (_) {}
    }
  }
  return result;
}
function cookie(req, name, value, age, sameSite='Strict') {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=' + sameSite + '; Max-Age=' + age + (secure ? '; Secure' : '');
}
function commonHeaders(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-src 'self'; frame-ancestors 'self'");
  if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}
function redirect(res,location,extraHeaders={}) {
  res.writeHead(303,{Location:location,...extraHeaders});res.end();
}
function verifyPassword(pass, verifier=PASSWORD_HASH) {
  try {
    const bits = verifier.split(':');
    if (bits.length!==3 || bits[0]!=='scrypt') return false;
    const target = Buffer.from(bits[2],'hex');
    const actual = crypto.scryptSync(String(pass),bits[1],target.length);
    return target.length > 0 && crypto.timingSafeEqual(actual,target);
  } catch (_) { return false; }
}
function loginHTML(error) {
  const errorHTML = error === 'expired' ? '<div class="notice" role="alert">Your previous session expired. Sign in again to load all simulator panels.</div>'
    : error === 'full' ? '<div class="notice" role="alert">All 3 guest device slots are registered. Sign out on one of the three devices, or ask Taregh to revoke a device from /devices. Inactivity never frees a slot.</div>'
    : error === 'invalid' ? '<div class="notice" role="alert">Incorrect username or password.</div>'
    : error === 'rate' ? '<div class="notice" role="alert">Too many attempts. Retry in 15 minutes.</div>' : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow"><title>Secure Access | B737 Classic Simulator</title>'
    + '<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0%,#17384d,#09131f 55%,#060c14);color:#f1f6fa;font-family:system-ui,Arial,sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(100%,425px);background:#101f2c;border:1px solid #31556e;border-radius:18px;padding:34px;box-shadow:0 24px 80px #0008}.eyebrow{color:#67c8f8;font:700 11px monospace;letter-spacing:.16em}h1{font-size:27px;line-height:1.2;margin:10px 0 7px}p{color:#9eb6c7;font-size:13px;line-height:1.6;margin:0 0 26px}label{display:block;font-size:12px;font-weight:650;color:#bcd2e2;margin:17px 0 7px}input{width:100%;padding:13px 14px;border-radius:9px;background:#0a1723;color:#fff;border:1px solid #39566b;font:inherit}input:focus{outline:2px solid #63bdf7}button{width:100%;padding:14px;border-radius:10px;background:#2689ba;color:#fff;border:0;font-weight:750;cursor:pointer;margin-top:23px}button:hover{background:#3aa8dd}.private-room{display:block;text-align:center;color:#8ed9ff;margin-top:18px}.foot{font:11px monospace;color:#789aac;text-align:center;margin-top:23px}.notice{color:#ffbfbf;background:#4a2029;border:1px solid #a24b59;border-radius:8px;padding:12px;font-size:12px;margin-bottom:16px}</style></head>'
    + '<body><main class="card"><span class="eyebrow">B737 CLASSIC / ATA 24</span><h1>B737 Classic Simulator</h1><p>Authorized access to the complete simulator. Guests may register up to three browser profiles. A slot remains occupied until explicit sign out or owner revocation. Taregh has no device cap.</p>'
    + errorHTML + '<form method="post" action="/api/login" autocomplete="on"><label for="user">Username</label><input id="user" name="username" autocomplete="username" required maxlength="100" autofocus>'
    + '<label for="pass">Password</label><input id="pass" name="password" type="password" autocomplete="current-password" required maxlength="200">'
    + '<button type="submit">SIGN IN</button></form>'
    + (crewReady ? '<a class="private-room" href="/crew/">Join Private Room</a>' : '')
    + '<div class="foot">SESSION PROTECTED · INDEPENDENT TEST ENVIRONMENT</div></main></body></html>';
}
async function body(req) {
  return await new Promise((resolve,reject) => {
    let s='';
    req.on('data',d=>{ s+=d; if (s.length>4096) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); } });
    req.on('end',()=>resolve(s));
    req.on('error',reject);
  });
}
// Share only IN-FLIGHT lookups for a burst of static resources. There is no
// cached authorization decision: a completed query is immediately removed,
// keeping logout and owner revocation database-authoritative.
const authorizationInFlight = new Map();
async function authorized(req) {
  const token = cookies(req)[TOKEN_COOKIE];
  if (!token || token.length < 30 || token.length > 128) return false;
  const key = hash(token);
  let inFlight = authorizationInFlight.get(key);
  if (!inFlight) {
    inFlight = pool.query(
      "SELECT session_hash FROM ata24_devices WHERE session_hash=$1",
      [key]
    ).then(result=>result.rowCount===1).finally(()=>{
      authorizationInFlight.delete(key);
    });
    authorizationInFlight.set(key,inFlight);
  }
  return inFlight;
}
async function registerUnifiedDevice(req,username,password) {
  const now=Date.now(), ip=String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0,80);
  if (attemptMap.size>5000) attemptMap.clear();
  const bucket=attemptMap.get(ip)||{n:0,until:now+900000};
  if (bucket.until<now) { bucket.n=0; bucket.until=now+900000; }
  if (bucket.n>=8) return {error:'rate'};
  const normalizedUsername = username.toLowerCase();
  const additional = Object.entries(EXTRA_USERS).find(([name]) => name.toLowerCase() === normalizedUsername);
  const additionalTier = additional && verifyPassword(password, additional[1]) ?
    'user:' + additional[0].toLowerCase() : null;
  const tier=(username===UNLIMITED_USER&&UNLIMITED_PASSWORD_SCRYPT&&
    verifyPassword(password,UNLIMITED_PASSWORD_SCRYPT))?'unlimited':
    (username===USER&&verifyPassword(password,PASSWORD_HASH))?'guest':additionalTier;
  if (!tier) {
    bucket.n++;attemptMap.set(ip,bucket);
    return {error:'invalid'};
  }
  attemptMap.delete(ip);
  const existing=cookies(req)[DEVICE_COOKIE];
  const device=typeof existing==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(existing)?existing:random();
  const token=random();
  const client=await pool.connect();
  let allowed=false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(73724003)');
    // Every registered guest browser keeps its slot until explicit release.
    // The advisory lock serializes competing logins for the fourth slot.
    const same=await client.query('SELECT account_tier FROM ata24_devices WHERE device_hash=$1',[hash(device)]);
    const count=await client.query("SELECT count(*)::int AS total FROM ata24_devices WHERE account_tier=$1",[tier]);
    // Every named guest has its own three-device registry; re-login on an existing
    // device never consumes a second slot. The unlimited owner has no cap.
    if(canRegisterDevice(tier==='unlimited'?'unlimited':'guest',
      same.rows[0]?.account_tier===tier?'guest':null,count.rows[0].total,MAX_DEVICES)){
      const agent=String(req.headers['user-agent']||'Unknown browser').slice(0,320);
      await client.query(`INSERT INTO ata24_devices
        (device_hash,session_hash,last_seen,account_tier,device_user_agent,last_ip,registered_at)
        VALUES($1,$2,now(),$3,$4,$5,now())
        ON CONFLICT (device_hash) DO UPDATE SET session_hash=EXCLUDED.session_hash,
          last_seen=now(),account_tier=EXCLUDED.account_tier,
          device_user_agent=EXCLUDED.device_user_agent,last_ip=EXCLUDED.last_ip`,
        [hash(device),hash(token),tier,agent,ip]);
      allowed=true;
    }
    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    throw e;
  } finally { client.release(); }
  if (!allowed) return {error:'full'};
  return {cookies:[
    cookie(req,DEVICE_COOKIE,device,tier==='unlimited'?OWNER_SESSION_SECONDS:DEVICE_SESSION_SECONDS,'Lax'),
    cookie(req,TOKEN_COOKIE,token,tier==='unlimited'?OWNER_SESSION_SECONDS:GUEST_SESSION_SECONDS,'Lax')
  ]};
}

async function signIn(req,res) {
  const payload=new URLSearchParams(await body(req));
  const result=await registerUnifiedDevice(req,payload.get('username')||'',payload.get('password')||'');
  if(result.error){redirect(res,'/login?e='+result.error);return;}
  redirect(res,'/',{'Set-Cookie':result.cookies});
}
async function readPrivateNavData(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('JSON_REQUIRED');
 if(Number(req.headers['content-length']||0)>3_000_000)throw Error('NAVDATA_TOO_LARGE');
 const chunks=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>3_000_000)throw Error('NAVDATA_TOO_LARGE');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function sameOriginRequest(req){
 try{
  const origin=req.headers.origin;
  if(!origin||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))return false;
  const u=new URL(origin);return u.host===req.headers.host&&u.protocol==='https:';
 }catch{return false;}
}


function escapeHtml(value){
 return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function devicesHTML(rows){
 const body=rows.map((d,i)=>{
  const label=escapeHtml(d.device_user_agent||'Unknown browser');
  const ip=escapeHtml(d.last_ip||'Unknown');
  const registered=escapeHtml(d.registered_at?new Date(d.registered_at).toISOString():'Unknown');
  const seen=escapeHtml(d.last_seen?new Date(d.last_seen).toISOString():'Unknown');
  const id=escapeHtml(d.device_hash);
  const account=d.account_tier==='guest'?USER:
    Object.keys(EXTRA_USERS).find(name => 'user:' + name.toLowerCase() === d.account_tier) || 'Guest';
  return '<tr><td>'+String(i+1)+'</td><td>'+escapeHtml(account)+'</td><td>'+label+'<small>ID '+id.slice(0,12)+'</small></td>'+
   '<td>'+ip+'</td><td>'+registered+'</td><td>'+seen+'</td>'+
   '<td><form action="/api/devices/revoke" method="post"><input type="hidden" name="device" value="'+id+'"><button type="submit">REVOKE</button></form></td></tr>';
 }).join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="robots" content="noindex,nofollow"><title>Guest Device Registry | B737 Classic</title>'+
 '<style>body{background:#0a1420;color:#eaf5ff;font:14px system-ui,Arial,sans-serif;margin:auto;padding:24px;max-width:1100px}a{color:#70cbff}h1{font-size:24px}p,small{color:#a1bbcf}table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}th,td{text-align:left;padding:12px;border-bottom:1px solid #31485c;vertical-align:top}th{white-space:nowrap}small{display:block;margin-top:8px}button{border:0;border-radius:6px;padding:10px;background:#b94747;color:white;font-weight:700;cursor:pointer}td{overflow-wrap:anywhere}form{margin:0}</style></head><body>'+
 '<p><a href="/">BACK TO UNIFIED</a></p><h1>Registered Guest Devices — '+rows.length+' total</h1>'+
 '<p>Each guest account has up to three registered browser profiles. Slots persist until sign out or owner revocation. Clearing cookies does not free a registration.</p>'+
 '<table><thead><tr><th>#</th><th>Account</th><th>Browser / OS</th><th>Last IP</th><th>Registered (UTC)</th><th>Last Seen (UTC)</th><th>Control</th></tr></thead><tbody>'+body+'</tbody></table>'+
 (rows.length?'':'<p>No guest devices are registered.</p>')+'</body></html>';
}
async function unifiedIdentity(req){
 const token=cookies(req)[TOKEN_COOKIE];
 if(!token||token.length<30||token.length>128)return null;
 const result=await pool.query('SELECT account_tier FROM ata24_devices WHERE session_hash=$1',[hash(token)]);
 const tier=result.rows[0]?.account_tier;
 if (tier==='unlimited') return UNLIMITED_USER;
 if (tier==='guest') return USER;
 return Object.keys(EXTRA_USERS).find(name => 'user:' + name.toLowerCase() === tier) || null;
}

async function ownerAccess(req){
 return await unifiedIdentity(req)===UNLIMITED_USER;
}

function crewMayRead(url, role) {
  if (['/static/session.js','/static/guest-cockpit.js','/static/guest-cockpit.css'].includes(url.pathname) ||
      directDocuments.has(url.pathname) || navdata.supports(url.pathname)) return true;
  const asset = repoAssetPath(url.pathname);
  if (!asset) return false;
  if (role === 'instructor') return true;
  if (!asset.endsWith('.html')) return true;
  return ['panel-mosaic-lab/cockpit/overhead-stage.html',
    'panel-mosaic-lab/cockpit/cdu-stage.html','cdu-standalone-v6/index.html','cb-panel-lab/index.html'].includes(asset);
}

async function handle(req,res) {
  commonHeaders(req,res);
  const url=new URL(req.url,'http://localhost');
  if (url.pathname==='/healthz') { res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok');return; }
  if(crewReady && (url.pathname==='/api/crew' || url.pathname.startsWith('/api/crew/'))){
    crew.handle(req,res);return;
  }
  if(serveCrewEntry(req,res,url))return;

  if (req.method==='GET' && url.pathname==='/login') {
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(loginHTML(url.searchParams.get('e')));return;
  }
  if (req.method==='POST' && url.pathname==='/api/login') { await signIn(req,res);return; }
  // Public shell only: first top-level navigation changes the popup's site
  // from GitHub Pages to Railway. Lax cookies allow safe top-level links
  // without sending credentials on cross-site POSTs.
  if(req.method==='GET'&&url.pathname==='/navdata-relay/start'){
    const nonce=url.searchParams.get('nonce');
    if(!/^[a-f0-9]{32}$/.test(nonce||'')){
      res.writeHead(400,{'Content-Type':'text/plain'});res.end('INVALID_NONCE');return;
    }
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Opener-Policy','unsafe-none');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>'+ 
      '<script>location.replace("/navdata-relay?nonce='+nonce+'");</script></body></html>');
    return;
  }
  const authStarted=performance.now();
  const ok=await authorized(req);
  const authMs=performance.now()-authStarted;
  const crewGuest = !ok && crewCockpitReady ? crew.cockpitAccess(req) : null;
  if (crewGuest) {
    const assetRequest = ['GET','HEAD'].includes(req.method);
    const pulse = req.method==='POST' && url.pathname==='/api/pulse';
    if (pulse) { res.writeHead(204);res.end();return; }
    if (assetRequest && (url.pathname==='/' || url.pathname==='/'+cockpitSource)) {
      redirect(res,directPath+'?crewRoom='+crewGuest.roomId);return;
    }
    if (assetRequest && url.pathname===directPath && url.searchParams.get('crewRoom')!==crewGuest.roomId) {
      url.searchParams.set('crewRoom',crewGuest.roomId);
      redirect(res,url.pathname+url.search);return;
    }
    if (!assetRequest || !crewMayRead(url,crewGuest.role)) {
      res.writeHead(403,{'Content-Type':'text/plain'});res.end('Crew access denied');return;
    }
  }
  if (!ok && !crewGuest) {
    // Redirect only actual document navigations. Serving login HTML as a
    // redirected .js/.css/.image response previously produced a blank page
    // and hundreds of GET /login requests after an expired guest session.
    if (req.method==='GET'&&isDocumentNavigation(url.pathname,req.headers)) redirect(res,'/login?e=expired');
    else {
      res.writeHead(401,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      if(req.method==='HEAD')res.end();
      else res.end('Guest session expired; sign in again');
    }
    return;
  }
  if(req.method==='GET'&&url.pathname==='/devices'){
    if(!await ownerAccess(req)){res.writeHead(403,{'Content-Type':'text/plain'});res.end('Owner access required');return;}
    const result=await pool.query("SELECT device_hash,account_tier,device_user_agent,last_ip,registered_at,last_seen FROM ata24_devices WHERE account_tier<>'unlimited' ORDER BY registered_at ASC");
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(devicesHTML(result.rows));return;
  }
  if(req.method==='POST'&&url.pathname==='/api/devices/revoke'){
    if(!sameOriginRequest(req)){res.writeHead(403);res.end('Origin denied');return;}
    if(!await ownerAccess(req)){res.writeHead(403);res.end('Owner access required');return;}
    const device=String(new URLSearchParams(await body(req)).get('device')||'');
    if(!/^[a-f0-9]{64}$/.test(device)){res.writeHead(400);res.end('Invalid device ID');return;}
    await pool.query("DELETE FROM ata24_devices WHERE device_hash=$1 AND account_tier<>'unlimited'",[device]);
    redirect(res,'/devices');return;
  }
  if (req.method==='POST' && url.pathname==='/api/pulse') {
    const token=cookies(req)[TOKEN_COOKIE];
    if(token) {
      const updated=await pool.query(
        "UPDATE ata24_devices SET last_seen=now() WHERE session_hash=$1 RETURNING account_tier",
        [hash(token)]
      );
      // Keep persistent cookies refreshed for owners and registered guests.
      if(updated.rowCount===1){
        const owner=updated.rows[0].account_tier==='unlimited';
        const device=cookies(req)[DEVICE_COOKIE];
        const cookiesToSet=[cookie(req,TOKEN_COOKIE,token,owner?OWNER_SESSION_SECONDS:GUEST_SESSION_SECONDS,'Lax')];
        if(device&&/^[A-Za-z0-9_-]{32,128}$/.test(device))
          cookiesToSet.push(cookie(req,DEVICE_COOKIE,device,owner?OWNER_SESSION_SECONDS:DEVICE_SESSION_SECONDS,'Lax'));
        res.setHeader('Set-Cookie',cookiesToSet);
      }
    }
    res.writeHead(204);res.end();return;
  }
  if (req.method==='POST' && url.pathname==='/api/logout') {
    const token=cookies(req)[TOKEN_COOKIE];
    if (token) await pool.query('DELETE FROM ata24_devices WHERE session_hash=$1',[hash(token)]);
    redirect(res,'/login',{'Set-Cookie':cookie(req,TOKEN_COOKIE,'',0)});return;
  }
  // Source files stay in Railway PostgreSQL and require the established user session.
  if(req.method==='POST'&&url.pathname==='/api/navdata/import'){
    if(!sameOriginRequest(req)){
      res.writeHead(403,{'Content-Type':'application/json'});res.end('{"error":"CROSS_ORIGIN_DENIED"}');return;
    }
    try{
      const input=await readPrivateNavData(req),result=await navdata.importData(input);
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify(result));return;
    }catch(e){
      res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({error:String(e.message||'INVALID_NAVDATA').slice(0,120)}));return;
    }
  }
  // Session-gated top-level popup for private NAVDATA on GitHub Pages.
  if(req.method==='GET'&&url.pathname==='/navdata-relay'){
   const html=NavdataRelay.relayHtml(url.searchParams.get('nonce'));
   if(!html){res.writeHead(400,{'Content-Type':'text/plain'});res.end('INVALID_NONCE');return;}
   res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
   res.setHeader('Cross-Origin-Opener-Policy','unsafe-none');
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'});
   res.end(html);return;
  }
  // This authenticated import advertises only the local CDU/EHSI reference fields.
  if(req.method==='GET'&&url.pathname==='/api/navdata/local-reference'){
    const site=req.headers['sec-fetch-site'];
    if(req.headers['x-unified-navdata']!=='local-reference'||(site&&site!=='same-origin')){
      res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"error":"CROSS_ORIGIN_DENIED"}');return;
    }
    const {status,body}=await navdata.lookup(url);
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin',
      'X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(body));return;
  }
  // Airway names alone are not proof of connectivity. Confirm membership
  // at the preceding exact georeferenced fix; do not infer routable FMC legs.
  if(req.method==='GET'&&url.pathname==='/api/cdu/airway-check'){
    const from=String(url.searchParams.get('from')||'').toUpperCase();
    const airway=String(url.searchParams.get('airway')||'').toUpperCase();
    const toRaw=url.searchParams.get('to'),to=toRaw===null?null:String(toRaw).toUpperCase();
    const latitude=url.searchParams.get('lat'),longitude=url.searchParams.get('lon');
    const record=Object.hasOwn(AIRWAY_REFERENCE,from)?AIRWAY_REFERENCE[from]:null;
    const supplied=latitude!==null&&longitude!==null&&latitude!==''&&longitude!=='';
    const lat=supplied?Number(latitude):NaN,lon=supplied?Number(longitude):NaN;
    if(!/^[A-Z0-9]{2,8}$/.test(from)||!/^[A-Z0-9]{2,8}$/.test(airway)||
       (to!==null&&!/^[A-Z0-9]{2,8}$/.test(to))){
      res.writeHead(400,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"error":"INVALID ENTRY"}');return;
    }
    if(!record||!Array.isArray(record.airways)){
      res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"available":false,"error":"NAV DATA UNAVAILABLE"}');return;
    }
    const near=Number.isFinite(lat)&&Number.isFinite(lon)&&
      Math.abs(lat-record.lat)<=0.02&&Math.abs(lon-record.lon)<=0.02;
    const route=Object.hasOwn(AIRWAY_POINTS,airway)?AIRWAY_POINTS[airway]:null;
    // A VIA-only lookup verifies the entry; a VIA/TO lookup additionally
    // verifies that the exit fix is a *different* fix on the same ordered
    // airway segment. The source does not encode one-way restrictions.
    if(to!==null&&(!Array.isArray(route)||!route.every(x=>typeof x==='string'))){
      res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"available":false,"error":"NAV DATA UNAVAILABLE"}');return;
    }
    const fromIndices=Array.isArray(route)?route.flatMap((ident,i)=>ident===from?[i]:[]):[];
    const toIndices=Array.isArray(route)?route.flatMap((ident,i)=>ident===to?[i]:[]):[];
    const unambiguous=to===null||(fromIndices.length===1&&toIndices.length===1);
    const pathFixes=to!==null&&unambiguous&&fromIndices[0]!==toIndices[0]?
      (fromIndices[0]<toIndices[0]?
       route.slice(fromIndices[0]+1,toIndices[0]+1):
       route.slice(toIndices[0],fromIndices[0]).reverse()):[];
    const valid=near&&record.airways.includes(airway)&&
      (to===null||(unambiguous&&pathFixes.length>0&&pathFixes.at(-1)===to));
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'});
    res.end(JSON.stringify({source:'OWNER_WPNAVRTE_VERIFIED',fmc_executable:false,
      available:true,valid,from,airway,...(to!==null?{to,fixes:valid?pathFixes:[]}:{})}));return;
  }
  if(req.method==='GET'&&navdata.supports(url.pathname)){
    const {status,body}=await navdata.lookup(url);
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(body));return;
  }
  if ((req.method==='GET' || req.method==='HEAD') && url.pathname==='/') {
    redirect(res,fastRuntime?directPath:'/panel-mosaic-lab/cockpit/');return;
  }
  if (req.method==='GET' || req.method==='HEAD') {
    const document=directDocuments.get(url.pathname);
    const compiled=document&&optimizedSource(document);
    if(compiled){
      await serveFastCompiledResponse(req,res,document,compiled,{
       cockpitDocument:document===cockpitSource+'index.html',direct:true,authMs
      });
      return;
    }
    const sourcePath=repoAssetPath(url.pathname);
    if(sourcePath) {
      await serveGitHubSource(req,res,sourcePath,{
        cockpitDocument:sourcePath==='panel-mosaic-lab/cockpit/index.html',authMs
      });
      return;
    }
  }
  if (req.method==='GET' && Object.hasOwn(assets,url.pathname)) {
    const [filename,type]=assets[url.pathname];
    const contents=await fs.readFile(path.join(folder,filename));
    res.writeHead(200,{'Content-Type':type});
    res.end(contents);return;
  }
  // Authenticated, explicit manifest only. No fallback to the upstream project.
  // Preserve original folder structure for the photo-based overhead and CB engines.
  const rawRuntimePath = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  // Asset names may contain spaces and Unicode. Decode only after URL parsing;
  // an exact manifest match is required before reading a filesystem path.
  let runtimePath;
  try { runtimePath = decodeURIComponent(rawRuntimePath); }
  catch (_) {res.writeHead(400);res.end('Bad path');return;}
  if (req.method==='GET' && runtimeFiles.has(runtimePath)) {
    const rel = runtimePath.slice(1);
    const ext = path.extname(rel).toLowerCase();
    const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
      '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp',
      '.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext];
    if (!mime) {res.writeHead(404);res.end();return;}
    const contents = await fs.readFile(path.join(runtimeDir,rel));
    res.writeHead(200,{'Content-Type':mime});
    res.end(contents);return;
  }
  res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');
}
async function start() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required: attach a Postgres service.');
  await pool.query('CREATE TABLE IF NOT EXISTS ata24_devices(device_hash text PRIMARY KEY,session_hash text UNIQUE NOT NULL,last_seen timestamptz NOT NULL DEFAULT now())');
  // Migration preserves existing guest sessions and their original cap.
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'guest'");
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS device_user_agent text NOT NULL DEFAULT 'Unknown browser'");
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS last_ip text NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS registered_at timestamptz NOT NULL DEFAULT now()");
  if(crewReady)await pool.query('CREATE TABLE IF NOT EXISTS unified_crew_accounts ('+
    'account_key text PRIMARY KEY, username text NOT NULL, verifier text NOT NULL)');
  if(crewReady)await pool.query('CREATE TABLE IF NOT EXISTS unified_crew_rooms ('+
    'manager text PRIMARY KEY, expires_at bigint NOT NULL, invitation_hash text UNIQUE NOT NULL, room jsonb NOT NULL)');
  await navdata.initialize();
  // Imports owner-provided reference data into private PostgreSQL once;
  // never sends the source outside Railway or exposes it as a static asset.
  try{
    const result=await NavdataBootstrap.bootstrapPrivateNavdata(navdata);
    if(result.imported)console.log('Private CDU/SG NAVDATA imported:',result.airports.join(','),'procedures:',result.counts,
      'sha256:',result.sha256);
  }catch(error){
    console.error('Private CDU/SG NAVDATA import rejected:',String(error.message||error));
  }
  // Confirm that private PostgreSQL still contains source data after
  // deployment/restart, including when the one-time transfer is removed.
  try{
    const make=path=>new URL('http://localhost'+path);
    const status=await navdata.lookup(make('/api/source/status'));
    if(status.status===200){
      const sid=await navdata.lookup(make('/api/cdu/catalog?airport=OIII&kind=SID'));
      const approach=await navdata.lookup(make('/api/cdu/catalog?airport=OISS&kind=APP'));
      if(sid.status!==200||approach.status!==200||
         sid.body?.items?.length!==33||approach.body?.items?.length!==17)
        throw Error('PRIVATE_NAVDATA_CATALOG_CHECK_FAILED');
      console.log('Private CDU/SG NAVDATA READY: source status 200; OIII SID 33; OISS APP 17; source only');
    }else console.warn('Private CDU/SG NAVDATA pending import; status',status.status);
  }catch(error){console.error('Private CDU/SG NAVDATA validation failed:',String(error.message||error));}
  if(fastRuntime){
    for(const relative of directDocuments.values()){
      const main=relative===cockpitSource+'index.html';
      const bytes=optimizedSource(relative);
      if(bytes){
        compiledDocument(relative,bytes,main,true);
        compiledDocument(relative,bytes,main,false);
      }
    }
  }
  http.createServer((req,res)=>handle(req,res).catch(e=>{
    console.error('Gateway request failed:',e.message);
    if (!res.headersSent) {res.writeHead(503,{'Content-Type':'text/plain'});res.end('Service temporarily unavailable');}
    else res.end();
  })).listen(PORT,'0.0.0.0',()=>{
    console.log('ATA24 gateway listening on '+PORT);
    setTimeout(()=>prewarmFastRuntime().catch(e=>console.warn('UNIFIED FAST PREWARM: '+e.message)),1500);
   });
}
start().catch(e=>{console.error('Gateway startup failed:',e.message);process.exit(1);});
