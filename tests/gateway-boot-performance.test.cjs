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
 assert.match(source,/textExt==='\\.js'\\|\\|textExt==='\\.css'/,'Only JS/CSS may use accelerated upstream path');
 console.log('PASS: one in-flight DB check per session burst; no cached auth decisions; version-keyed JS/CSS source reuse behind auth');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
