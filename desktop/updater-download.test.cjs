'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const {NsisUpdater}=require('electron-updater'),{ElectronHttpExecutor}=require('electron-updater/out/electronHttpExecutor');
const {createUpdateController}=require('./update-controller.cjs');
test('real NSIS updater rejects corrupt bytes and stages a checksum-verified download',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cockpit-updater-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const payload=Buffer.from('MZ Cockpit Pro updater checksum fixture\n'.repeat(400));let corrupt=true;
 const sha=createHash('sha512').update(payload).digest('base64');
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/latest')&&req.url.includes('.yml')){res.setHeader('content-type','text/yaml');return res.end('version: 0.2.1\npath: update.exe\nsha512: '+sha+'\nfiles:\n  - url: update.exe\n    sha512: '+sha+'\n    size: '+payload.length+'\nreleaseDate: 2026-10-31T00:00:00.000Z\n');}
  if(req.url.startsWith('/update.exe'))return res.end(corrupt?Buffer.alloc(payload.length):payload);
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url='http://127.0.0.1:'+server.address().port+'/';
 const config=path.join(dir,'app-update.yml');await fs.writeFile(config,'provider: generic\nurl: '+url+'\nupdaterCacheDirName: cockpit-test\n');
 const app={version:'0.2.0',name:'cockpit-test',isPackaged:true,appUpdateConfigPath:config,userDataPath:dir,baseCachePath:dir,whenReady:async()=>{},onQuit(){},quit(){},relaunch(){}};
 const native=new NsisUpdater(null,app);native.httpExecutor=new(class extends ElectronHttpExecutor{createRequest(options,callback){assert.equal(options.hostname,'127.0.0.1');return http.request(options,callback);}})();native.disableDifferentialDownload=true;native.disableWebInstaller=true;
 native.logger={info(){},warn(){},error(){},debug(){}};
 let installed=false;native.quitAndInstall=()=>{installed=true;};
 const c=createUpdateController({version:'0.2.0',packaged:true,getUpdater:()=>native});
 assert.equal((await c.check()).status,'available');
 const rejected=await c.download();assert.equal(rejected.status,'error');assert.equal(rejected.error,'ERR_CHECKSUM_MISMATCH');assert.equal(c.install().accepted,false);assert.equal(installed,false);
 corrupt=false;await c.check();assert.equal((await c.download()).status,'downloaded');
 const downloaded=native.downloadedUpdateHelper.file;
 assert.deepEqual(await fs.readFile(downloaded),payload);
 assert.equal(c.install().accepted,true);await new Promise(r=>setImmediate(r));assert.equal(installed,true);
});
