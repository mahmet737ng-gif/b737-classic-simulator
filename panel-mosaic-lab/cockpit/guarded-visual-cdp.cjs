'use strict';
/* Real overhead visual inspection via Chrome DevTools Protocol.
 * Scrolls the actual mounted control into view, captures CLOSED and OPEN
 * screenshots, and records computed size/colors/texture/hinge in JSON.
 * Requires Node >=22, headless Chrome and local HTTP server at port 8765.
 */
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const out=path.resolve(process.env.GUARD_CAPTURE_DIR||'/tmp/guard-captures-v2');
fs.mkdirSync(out,{recursive:true});
const chrome=process.env.CHROME_BIN||'google-chrome';
const port=9229;
const child=spawn(chrome,[
 '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
 '--remote-allow-origins=*','--remote-debugging-port='+port,
 '--user-data-dir=/tmp/b737-guard-chrome-cdp','--window-size=1600,1050',
 '--hide-scrollbars','http://127.0.0.1:8765/panel-mosaic-lab/cockpit/overhead-stage.html'
],{stdio:'ignore'});
const pending=new Map();let serial=0,conn;
async function connect(){
 for(let retry=0;retry<45;retry++){
  try{
   const response=await fetch('http://127.0.0.1:'+port+'/json/list');
   const list=await response.json();
   const target=list.find(x=>x.type==='page'&&x.url.includes('overhead-stage'));
   if(target){
    conn=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{conn.addEventListener('open',resolve,{once:true});conn.addEventListener('error',reject,{once:true});});
    conn.addEventListener('message',event=>{
     let m;try{m=JSON.parse(event.data)}catch{return}
     if(!m.id||!pending.has(m.id))return;
     const p=pending.get(m.id);pending.delete(m.id);
     if(m.error)p.reject(new Error(JSON.stringify(m.error)));else p.resolve(m.result);
    });
    return;
   }
  }catch{}
  await delay(500);
 }
 throw new Error('Chrome CDP target unavailable');
}
function call(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++serial;
  pending.set(id,{resolve,reject});
  conn.send(JSON.stringify({id,method,params}));
  setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error('CDP timeout '+method));}},22000).unref();
 });
}
async function evaluate(expr){
 const r=await call('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);
 return r.result.value;
}
async function capture(name){
 const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
 fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));
}
async function focus(id){
 const expr=`(function(){
 const node=document.querySelector('#rotaryGuardLayer .guard-node[data-control="${id}"]');
 if(!node)return {found:false};
 node.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
 const cover=node.querySelector('.g17-native-cover'),hardware=node.querySelector('.g17-native-hardware');
 const pos=(cover||node).getBoundingClientRect();
 const cs=cover?getComputedStyle(cover):null;
 return {found:true,id:'${id}',calibration:hardware?.dataset.calibration,
  hinge:hardware?.dataset.hinge,surface:hardware?.dataset.surface,
  coverWidth:pos.width,coverHeight:pos.height,screenX:pos.x,screenY:pos.y,
  texture:cs?.backgroundImage,guardOpen:hardware?.dataset.open};
 })()`;
 const info=await evaluate(expr);
 if(!info.found)throw Error('Guard not found in live browser: '+id);
 await delay(450);
 return info;
}
async function main(){
 await connect();await call('Page.enable');await call('Runtime.enable');
 let ready=false;
 for(let i=0;i<45;i++){
  const status=await evaluate('window.B737NativeGuards && ({installed:window.B737NativeGuards.installed,failures:window.B737NativeGuards.mountingFailures})');
  if(status&&status.installed===12){ready=true;break;}
  await delay(500);
 }
 if(!ready)throw Error('Native guards did not report 12 mounted objects');
 const samples=[
  'flight-control-a','spoiler-a','alternate-flaps-master',
  'generator-disconnect-1','standby-power','passenger-oxygen'
 ];
 const report={samples:[],version:'NATIVE-G17-PHOTO-V2',ownerProof:'PREVIEW_NOT_FINAL_PIXEL_CALIBRATION'};
 for(const id of samples){
  const initial=await focus(id);
  report.samples.push(initial);
  await capture(id+'-closed');
  const toggled=await evaluate(`(function(){
   const btn=document.querySelector('.g17-native-hardware[data-control="${id}"] .g17-native-cover');
   if(!btn)return false;btn.click();return true;
  })()`);
  if(!toggled)throw Error('No guard click for '+id);
  await delay(700);
  const open=await focus(id);
  report.samples.push({...open,pose:'OPEN'});
  await capture(id+'-open');
  await evaluate(`(function(){const btn=document.querySelector('.g17-native-hardware[data-control="${id}"] .g17-native-cover');btn.click()})()`);
 }
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(report,null,2));
 console.log('PHOTO QA: captured '+report.samples.length+' actual overhead poses for '+samples.length+' representative guards.');
 console.log(JSON.stringify(report.samples.map(x=>({id:x.id,pose:x.pose||'CLOSED',surface:x.surface,hinge:x.hinge,size:[Math.round(x.coverWidth),Math.round(x.coverHeight)]}))));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 try{conn?.close()}catch{}
 child.kill('SIGTERM');
});
