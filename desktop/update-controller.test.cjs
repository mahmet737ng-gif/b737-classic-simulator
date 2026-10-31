'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createUpdateController}=require('./update-controller.cjs');
test('updater is lazy, concurrent checks/downloads coalesce, install requires verified download',async()=>{
 const fake=new EventEmitter();let loads=0,checks=0,downloads=0,installs=0,releaseCheck,releaseDownload;
 fake.checkForUpdates=()=>{checks++;return new Promise(r=>releaseCheck=r);};
 fake.downloadUpdate=()=>{downloads++;return new Promise(r=>releaseDownload=r);};
 fake.quitAndInstall=()=>installs++;
 const c=createUpdateController({version:'0.2.0',packaged:true,getUpdater:()=>{loads++;return fake;}});
 assert.equal(loads,0);assert.equal(c.install().accepted,false);
 const a=c.check(),b=c.check();assert.equal(checks,1);assert.equal(loads,1);
 assert.equal(fake.autoDownload,false);assert.equal(fake.autoInstallOnAppQuit,false);assert.equal(fake.allowDowngrade,false);
 fake.emit('update-available',{version:'0.2.1'});releaseCheck();await Promise.all([a,b]);
 const d=c.download(),e=c.download();assert.equal(downloads,1);
 fake.emit('error',{code:'ERR_SHA512_MISMATCH'});assert.equal(c.install().accepted,false);
 fake.emit('update-downloaded',{version:'0.2.1'});releaseDownload();await Promise.all([d,e]);
 assert.equal(c.install().accepted,true);assert.equal(c.install().accepted,false);
 await new Promise(r=>setImmediate(r));assert.equal(installs,1);
});
test('offline failures are recoverable and never request installation',async()=>{
 const fake=new EventEmitter();let calls=0,installs=0;
 fake.checkForUpdates=async()=>{if(!calls++)throw Error('offline');fake.emit('update-not-available');};
 fake.quitAndInstall=()=>installs++;
 const c=createUpdateController({version:'0.2.0',packaged:true,getUpdater:()=>fake});
 assert.equal((await c.check()).status,'error');assert.equal((await c.check()).status,'current');assert.equal(installs,0);
});
test('development mode does not load privileged update dependency',async()=>{
 const c=createUpdateController({version:'0.2.0',packaged:false,getUpdater:()=>{throw Error('must remain lazy');}});
 assert.equal((await c.check()).status,'development');assert.equal(c.install().accepted,false);
});
