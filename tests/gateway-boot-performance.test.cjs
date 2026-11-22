'use strict';
// Production gateway boot-path regression tests. No secrets, DB, or network.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
function extract(from,to){
 const begin=source.indexOf(from),end=source.indexOf(to,begin);
 assert.ok(begin>=0&&end>begin,'Gateway test source marker missing: '+from);
 return source.slice(begin,end);
}
(async()=>{
 let queries=0,release;
 const dbWait=new Promise(resolve=>{release=resolve;});
 const authContext={
   Map,Promise,
   TOKEN_COOKIE:'ata24_session',
   cookies:req=>req.cookies,
   hash:token=>'hash:'+token,
   pool:{query:()=>{queries++;return dbWait;}}
 };
 vm.runInNewContext(extract('const authorizationInFlight = new Map();','async function signIn(')+';this.check=authorized;',authContext);
 const req={cookies:{ata24_session:'A'.repeat(48)}};
 const first=authContext.check(req),second=authContext.check(req);
 assert.equal(queries,1,'Simultaneous requests for the same session must share one DB check');
 release({rowCount:1});
 assert.deepEqual(await Promise.all([first,second]),[true,true]);
 assert.equal(await authContext.check(req),true);
 assert.equal(queries,2,'Finished validation must not be cached (revocation remains immediate)');
 assert.equal(await authContext.check({cookies:{}}),false);
 assert.equal(queries,2,'Missing cookie must never query the database');
 const packaged=new Map([['panel-mosaic-lab/cockpit/index.html',Buffer.from('compiled')]]);
 const commit='a'.repeat(40),releaseContext={
  fastRuntime:{sourceCommit:commit,bytes:packaged},require,setTimeout,clearTimeout,AbortController,
  fetch:async url=>{releaseContext.urls.push(url);return {ok:false,status:403,body:{cancel:async()=>{}}};},
  urls:[]
 };
 vm.runInNewContext(extract('function optimizedSource(','function repoAssetPath(')+
  extract('async function upstreamFetch(','// Authorized-only, bounded')+
  ';this.compiled=optimizedSource;this.fetchSource=upstreamFetch;',releaseContext);
 assert.equal(releaseContext.compiled('panel-mosaic-lab/cockpit/index.html').toString(),'compiled');
 assert.equal(releaseContext.urls.length,0,'Serving a release must never block on GitHub ref discovery');
 await assert.rejects(()=>releaseContext.fetchSource('engine/test.js'),/403/);
 assert.equal(releaseContext.urls.length,1,'A pinned dependency must not fall back to moving Pages');
 assert.ok(releaseContext.urls[0].includes('/'+commit+'/engine/test.js'));
 assert.equal(releaseContext.compiled('panel-mosaic-lab/cockpit/index.html').toString(),'compiled',
  'GitHub 403 must not turn off the verified release');
 const crewFixture=fs.readFileSync(require('node:path').join(__dirname,
  '../runtime/fast-unified/panel-mosaic-lab/cockpit/index.html'),'utf8');
 if(crewFixture.includes('id="crewRoomDialog"')){
  const ctx={cockpitSource:'panel-mosaic-lab/cockpit/',optimizedSource:()=>Buffer.from(crewFixture)};
  const fixture={...ctx,crewAssets:new Map([['/crew/lobby.js',['crew-room-v1.js']],['/crew/lobby.css',['crew-room-v1.css']]])};
  vm.runInNewContext(extract('const crewDialog=','const crewOrigin=')+
   ';this.available=crewReady;this.dialog=crewDialog;',fixture);
  assert.equal(fixture.available,true);
  assert.match(fixture.dialog??'',/data-crew-accounts/,'Compiled Crew Room dialog is available to invited guests');
 }
 let downloads=0,finish;
 const downloadWait=new Promise(resolve=>{finish=resolve;});
 const ctx={
   Map,Promise,Date,URL,Buffer,
   upstreamFetch:()=>{downloads++;return downloadWait;}
 };
 vm.runInNewContext(extract('const SOURCE_CACHE_TTL_MS=','function transformCockpitHTML(')+';this.cached=cachedSourceText;',ctx);
 const route='panel-mosaic-lab/cockpit/efis-test.js';
 const url='/panel-mosaic-lab/cockpit/efis-test.js?v=BOOT-0001';
 const a=ctx.cached(route,url),b=ctx.cached(route,url);
 assert.equal(downloads,1,'Concurrent same-revision assets should make one upstream request');
 finish({arrayBuffer:async()=>Buffer.from('fixture')});
 assert.equal((await a).toString(),'fixture');
 assert.equal((await b).toString(),'fixture');
 assert.equal((await ctx.cached(route,url)).toString(),'fixture');
 assert.equal(downloads,1,'Warm, explicitly revisioned asset should reuse cache');
 assert.equal(await ctx.cached(route,'/efis-test.js?ts=5'),null,'Timestamp invalidates text cache');
 assert.ok(source.indexOf('const ok=await authorized(req);')<source.indexOf('await serveGitHubSource(req,res,sourcePath'), 'Authentication must precede EVERY source file response');
 assert.match(source,/textExt==='\.js'\|\|textExt==='\.css'/,'Only JS/CSS may use accelerated upstream path');
 console.log('PASS: one in-flight DB check per session burst; no cached auth decisions; version-keyed JS/CSS source reuse behind auth');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
