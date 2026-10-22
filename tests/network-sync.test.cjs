/* Network integration tests — 3 simulated remote browsers over HTTP+SSE. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {createServer}=require('node:net');
const {setTimeout:delay}=require('node:timers/promises');
const root=require('node:path').resolve(__dirname,'..');
const host='127.0.0.1';
let checks=0;
function check(name,fn){fn();console.log(`PASS ${++checks} ${name}`);}
async function freePort(){return new Promise((resolve,reject)=>{const s=createServer().listen(0,host,()=>{const n=s.address().port;s.close(()=>resolve(n));});s.on('error',reject)});}
class Stream {
 constructor(response){this.reader=response.body.getReader();this.buffer='';this.packets=[];this.closed=false;}
 async next(predicate=()=>true){let deadline=Date.now()+4000;while(Date.now()<deadline){
  while(this.packets.length){const p=this.packets.shift();if(predicate(p))return p;}
  const result=await Promise.race([this.reader.read(),delay(3500).then(()=>({timeout:true}))]);
  if(result.timeout)throw Error('SSE timed out');
  if(result.done)throw Error('SSE ended unexpectedly');
  this.buffer+=Buffer.from(result.value).toString('utf8');
  let pos;while((pos=this.buffer.indexOf('\n\n'))!==-1){const part=this.buffer.slice(0,pos);this.buffer=this.buffer.slice(pos+2);
   const lines=part.split('\n');if(lines.includes('event: snapshot')){const raw=lines.find(s=>s.startsWith('data: '));if(raw)this.packets.push(JSON.parse(raw.slice(6)));}
  }
 }throw Error('Timed out waiting for desired snapshot');}
 async close(){try{await this.reader.cancel();}catch(e){}}
}
(async()=>{
 const port=await freePort(),base=`http://${host}:${port}`;
 const child=spawn(process.execPath,['sync-server/server.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:host,ROOM_PIN:'123456',INSTRUCTOR_PIN:'987654'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 const streams=[];
 async function request(url,method='GET',body=null,cookie=null,extra={}){
  const h={...extra};if(body!==null)h['Content-Type']='application/json';if(cookie)h.Cookie=cookie;
  const r=await fetch(base+url,{method,headers:h,body:body===null?undefined:JSON.stringify(body)});
  let data;try{data=await r.json()}catch{data={};}
  return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
 }
 async function join(role,extra={}){return request('/api/join','POST',{role,roomPin:'123456',instructorPin:'987654',...extra});}
 async function cmd(cookie,command,expectedValue){const x={command};if(arguments.length>2)x.expectedValue=expectedValue;return request('/api/command','POST',x,cookie);}
 async function sub(cookie){const res=await fetch(base+'/api/events',{headers:{Cookie:cookie}});assert.equal(res.status,200);const s=new Stream(res);streams.push(s);return s;}
 try{
  for(let i=0;i<40;i++){if(child.exitCode!==null)throw Error('Server exited early '+output);try{const r=await request('/api/health');if(r.status===200)break;}catch{} await delay(65);}
  const health=await request('/api/health');check('server started and reports healthy',()=>assert.equal(health.data.ok,true));
  const file=await fetch(base+'/trainer-lab/network.html');check('network UI served over classroom HTTP',()=>assert.equal(file.status,200));
  const deniedStatic=await request('/package.json');check('server does not expose repository internals',()=>assert.equal(deniedStatic.status,404));
  const noSession=await request('/api/snapshot');check('unauthorized snapshot denied',()=>assert.equal(noSession.status,401));
  const badRoom=await join('captain',{roomPin:'bad'});check('classroom PIN required',()=>assert.equal(badRoom.status,403));
  const wrongInstructor=await join('instructor',{instructorPin:'bad'});check('instructor requires second PIN',()=>assert.equal(wrongInstructor.status,403));
  const cap=await join('captain'),fo=await join('first_officer'),ins=await join('instructor');
  check('three distinct seats joined',()=>{for(const v of [cap,fo,ins])assert.equal(v.status,200);assert.ok(new Set([cap.cookie,fo.cookie,ins.cookie]).size===3);});
  const already=await join('captain');check('duplicate seat claim denied',()=>assert.equal(already.status,409));
  const capStream=await sub(cap.cookie),foStream=await sub(fo.cookie),insStream=await sub(ins.cookie);
  const first=await Promise.all([capStream.next(),foStream.next(),insStream.next()]);
  check('initial aircraft state identical on all devices',()=>{
   assert.ok(first.every(p=>p.revision===0)); assert.deepEqual(first[0].derived,first[1].derived);assert.deepEqual(first[1].derived,first[2].derived);
   assert.equal(first[0].occupants.captain,true);assert.equal(first[0].occupants.first_officer,true);assert.equal(first[0].occupants.instructor,true);
  });
  const captainFlip=await cmd(cap.cookie,{type:'CONTROL',path:'busTransferAuto',value:false},true);
  check('captain permitted to operate flight-deck switch',()=>assert.equal(captainFlip.status,200));
  const updates1=await Promise.all([capStream.next(p=>p.revision===1),foStream.next(p=>p.revision===1),insStream.next(p=>p.revision===1)]);
  check('all 3 seats reflect captain switch within broadcast update',()=>{
   assert.ok(updates1.every(p=>p.state.controls.busTransferAuto===false));assert.deepEqual(updates1[0].state,updates1[2].state);
  });
  const foFault=await cmd(fo.cookie,{type:'FAULT',id:'gen1Failed',active:true});
  check('first officer cannot inject instructor faults',()=>assert.equal(foFault.status,403));
  const capReset=await cmd(cap.cookie,{type:'RESET'});
  check('captain cannot reset entire classroom',()=>assert.equal(capReset.status,403));
  const instrFault=await cmd(ins.cookie,{type:'FAULT',id:'gen1Failed',active:true},false);
  check('instructor can inject GEN1 fault',()=>assert.equal(instrFault.status,200));
  const updates2=await Promise.all([capStream.next(p=>p.revision===2),foStream.next(p=>p.revision===2),insStream.next(p=>p.revision===2)]);
  check('synchronized electrical + pumps + warnings consequences',()=>{
   for(const p of updates2){assert.equal(p.derived.indicators.busOff1,true);assert.equal(p.derived.transferBus[1],false);assert.equal(p.derived.hyd.elecB.operating,false);assert.equal(p.derived.fuel.leftFwd.lowPressure,true);}
  });
  const stale=await cmd(fo.cookie,{type:'CONTROL',path:'busTransferAuto',value:true},true);
  check('stale conflicting switch intent rejected without overwriting newer state',()=>assert.equal(stale.status,409));
  const unauthorized=await request('/api/command','POST',{command:{type:'FAULT',id:'gen1Failed',active:true}},cap.cookie,{Origin:'http://evil.invalid'});
  check('cross-origin command rejected',()=>assert.equal(unauthorized.status,403));
  const preset=await cmd(ins.cookie,{type:'PRESET',id:'bus1'});
  check('instructor preset applied as one broadcast revision',()=>assert.equal(preset.status,200));
  const updates3=await Promise.all([capStream.next(p=>p.revision===3),foStream.next(p=>p.revision===3),insStream.next(p=>p.revision===3)]);
  check('scenario identical and checklist present at every seat',()=>{for(const p of updates3){assert.equal(p.checklist.complete,false);assert.equal(p.checklist.id,'bus-off-1');assert.equal(p.latest.at(-1).seat,'instructor');}});
  const apuStart=await cmd(fo.cookie,{type:'CONTROL',path:'apuRunning',value:true},false);
  check('first officer starts synthetic APU source',()=>assert.equal(apuStart.status,200));
  const apuOn=await cmd(fo.cookie,{type:'CONTROL',path:'apuGen1Connected',value:true},false);
  check('first officer connects alternate generator',()=>assert.equal(apuOn.status,200));
  const final=await Promise.all([capStream.next(p=>p.revision===5),foStream.next(p=>p.revision===5),insStream.next(p=>p.revision===5)]);
  check('all seats share restored bus and completed scenario',()=>{for(const p of final){assert.equal(p.derived.generatorBus[1],'APU');assert.equal(p.derived.indicators.busOff1,false);assert.equal(p.checklist.complete,true);}});
  const late=await request('/api/snapshot','GET',null,ins.cookie);
  check('rejoin/resync snapshot shows authoritative latest state',()=>{assert.equal(late.data.revision,5);assert.equal(late.data.derived.generatorBus[1],'APU')});
  const leave=await request('/api/leave','POST',{},fo.cookie);
  check('seat can be released',()=>assert.equal(leave.status,200));
  const replace=await join('first_officer');check('released seat can be claimed by another browser',()=>assert.equal(replace.status,200));
  console.log(`PASS ALL ${checks} cross-device network integration assertions`);
 }finally{await Promise.all(streams.map(x=>x.close()));child.kill('SIGTERM');await delay(100);if(child.exitCode===null)child.kill('SIGKILL');}
})().catch(e=>{console.error('FAIL',e.stack||e);process.exitCode=1;});