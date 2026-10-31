'use strict';
// Run on Windows AFTER packaging. Fresh Chromium cache followed by a retained-cache launch.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 const executable=path.resolve(__dirname,'dist/win-unpacked/CockpitPro.exe');
 const userData=await fs.mkdtemp(path.join(os.tmpdir(),'cockpit-native-'));
 const samples=[];
 try{
  for(const kind of ['fresh-cache','retained-cache']){
   const reportFile=path.join(userData,'startup-report.json');await fs.rm(reportFile,{force:true});
   const began=Date.now();const child=spawn(executable,['--startup-smoke','--smoke-user-data='+userData],{stdio:'ignore'});
   let exit,spawnError;const exited=new Promise(r=>{child.on('error',e=>{spawnError=e;r();});child.on('exit',code=>{exit=code;r();});});
   let report;
   try{
    while(Date.now()-began<20000){
     try{report=JSON.parse(await fs.readFile(reportFile,'utf8'));break;}catch{}
     if(spawnError)throw spawnError;if(exit!==undefined)throw Error('Application exited before usable: '+exit);
     await sleep(25);
    }
    assert.ok(report,'No usable cockpit report within 20 seconds');
    report.spawnToUsableMs=report.readyAtMs-began;report.cache=kind;
    samples.push(report);
    await fs.copyFile(path.join(userData,'startup.png'),path.join(__dirname,'dist/startup-'+kind+'.png'));
    console.log(JSON.stringify(report));
    assert.ok(report.main&&report.controls&&report.interaction.responded&&report.interaction.restored,'Visible controls must actually respond');
    assert.ok(report.spawnToUsableMs<=5000,'Five-second startup budget exceeded: '+report.spawnToUsableMs+'ms');
    assert.ok(report.interaction.roundTripMs<200,'Control response exceeded 200ms');
    await Promise.race([exited,sleep(5000)]);
   }finally{
    if(exit===undefined){if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F']);else child.kill();await Promise.race([exited,sleep(2000)]);}
   }
  }
 }finally{
  await fs.writeFile(path.join(__dirname,'dist/startup-benchmark.json'),JSON.stringify({targetMs:5000,network:'external requests blocked',samples},null,2));
  await fs.rm(userData,{recursive:true,force:true}).catch(()=>{});
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
