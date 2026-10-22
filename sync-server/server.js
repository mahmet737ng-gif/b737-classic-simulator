/* B737 multi-device trainer server v0.1 — Node.js built-ins only.
 * One authoritative state, role-guarded commands, SSE updates, local LAN.
 * NOT an aircraft trainer accuracy certification; no external cloud dependency.
 */
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const Engine=require('../engine/trainer/core.js');

const ROOT=path.resolve(__dirname,'..');
const PORT=Number(process.env.PORT||8787);
const HOST=process.env.HOST||'0.0.0.0';
const ROLES=new Set(['captain','first_officer','instructor']);
const ROOM_PIN=process.env.ROOM_PIN||String(crypto.randomInt(100000,1000000));
const INSTRUCTOR_PIN=process.env.INSTRUCTOR_PIN||String(crypto.randomInt(100000,1000000));
const MAX_POST=8192;
const LEASE_MS=120000;
const CLIENT_HEADERS={
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY'
};
const STATIC_FILES={
 '/trainer-lab/network.html':{file:'trainer-lab/network.html',type:'text/html; charset=utf-8'},
 '/trainer-lab/network.js':{file:'trainer-lab/network.js',type:'text/javascript; charset=utf-8'},
 '/trainer-lab/style.css':{file:'trainer-lab/style.css',type:'text/css; charset=utf-8'},
 '/trainer-lab/network.css':{file:'trainer-lab/network.css',type:'text/css; charset=utf-8'},
 '/engine/trainer/core.js':{file:'engine/trainer/core.js',type:'text/javascript; charset=utf-8'}
};
let state=Engine.initialState(),revision=0;
const sessions=new Map();
const listeners=new Set();
const history=[];
function json(res,status,body,headers={}){res.writeHead(status,{...CLIENT_HEADERS,...headers});res.end(JSON.stringify(body));}
function fail(res,status,code,detail){json(res,status,{ok:false,error:code,detail});}
function getCookies(req){const o={};for(const part of (req.headers.cookie||'').split(';')){const p=part.indexOf('=');if(p>=0)o[part.slice(0,p).trim()]=part.slice(p+1).trim();}return o;}
function sessionFrom(req){const token=getCookies(req).b737_session;const s=sessions.get(token);if(s)s.lastSeen=Date.now();return s||null;}
function roleOccupants(){const now=Date.now(),x={captain:false,first_officer:false,instructor:false};for(const s of sessions.values())if(now-s.lastSeen<LEASE_MS)x[s.role]=true;return x;}
function snapshot(){return {type:'snapshot',revision,state,derived:Engine.derive(state),checklist:Engine.checklist(state),occupants:roleOccupants(),latest:history.slice(-20)};}
function sendSSE(res,data){if(res.destroyed||res.writableEnded)return;res.write('event: snapshot\ndata: '+JSON.stringify(data)+'\n\n');}
function broadcast(){const data=snapshot();for(const l of [...listeners]){try{sendSSE(l.res,data);}catch(e){listeners.delete(l);}}}
function publish(command,actor){revision++;history.push({revision,seat:actor,command,at:new Date().toISOString()});if(history.length>100)history.shift();broadcast();}
function cleanup(){let changed=false;const now=Date.now();for(const [token,s] of sessions)if(now-s.lastSeen>LEASE_MS){sessions.delete(token);changed=true;}
 if(changed)broadcast();}
function originCheck(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host&&['http:','https:'].includes(new URL(origin).protocol);}catch{return false;}}
async function readJSON(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_POST){const e=new Error('Body too large');e.status=413;throw e;}chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{const e=new Error('Invalid JSON');e.status=400;throw e;}}
function peek(o,p){return p.split('.').reduce((x,k)=>x&&Object.hasOwn(x,k)?x[k]:undefined,o);}
function roleAllows(s,c){if(c.type==='CONTROL')return ROLES.has(s.role);
 return s.role==='instructor'&&['FAULT','SCENARIO','RESET','PRESET'].includes(c.type);}
function serve(req,res,url){const found=STATIC_FILES[url.pathname];if(!found)return fail(res,404,'NOT_FOUND','Only the network trainer UI is served');
 const target=path.join(ROOT,found.file);fs.readFile(target,(err,bytes)=>{if(err)return fail(res,404,'MISSING','Static asset not found');res.writeHead(200,{'Content-Type':found.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(bytes);});}
async function route(req,res){
 let url;try{url=new URL(req.url,'http://localhost');}catch{return fail(res,400,'INVALID_URL','Bad URL');}
 if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/trainer-lab/')){res.writeHead(302,{Location:'/trainer-lab/network.html'});return res.end();}
 if(req.method==='GET'&&STATIC_FILES[url.pathname])return serve(req,res,url);
 if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,service:'b737-network-trainer',version:1,revision});
 if(req.method==='POST'){
   if(!originCheck(req))return fail(res,403,'CROSS_ORIGIN','Must use same-origin classroom interface');
   if(!(req.headers['content-type']||'').startsWith('application/json'))return fail(res,415,'CONTENT_TYPE','application/json required');
   let body;try{body=await readJSON(req);}catch(e){return fail(res,e.status||400,'BAD_BODY',e.message);}
   if(!body||typeof body!=='object'||Array.isArray(body))return fail(res,400,'BAD_BODY','Expected object');
   if(url.pathname==='/api/join'){
     const role=body.role;
     if(!ROLES.has(role))return fail(res,400,'BAD_ROLE','Choose captain, first_officer or instructor');
     if(typeof body.roomPin!=='string'||!crypto.timingSafeEqual(Buffer.from(body.roomPin.padEnd(12,' ').slice(0,12)),Buffer.from(ROOM_PIN.padEnd(12,' ').slice(0,12)))||body.roomPin!==ROOM_PIN)return fail(res,403,'WRONG_ROOM_PIN','Incorrect room PIN');
     if(role==='instructor'&&(typeof body.instructorPin!=='string'||body.instructorPin!==INSTRUCTOR_PIN))return fail(res,403,'WRONG_INSTRUCTOR_PIN','Incorrect instructor PIN');
     cleanup();
     const previous=sessionFrom(req);
     if(previous&&previous.role===role)return json(res,200,{ok:true,role,revision,occupants:roleOccupants()});
     for(const s of sessions.values())if(s.role===role&&s!==previous)return fail(res,409,'SEAT_OCCUPIED','Seat is in use. Ask the existing device to leave, or wait for its session to expire.');
     if(previous)sessions.delete(getCookies(req).b737_session);
     const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{role,lastSeen:Date.now()});
     json(res,200,{ok:true,role,revision,occupants:roleOccupants()}, {'Set-Cookie':`b737_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`});broadcast();return;
   }
   const ses=sessionFrom(req);if(!ses)return fail(res,401,'NOT_JOINED','Join a role first');
   if(url.pathname==='/api/leave'){
     sessions.delete(getCookies(req).b737_session);json(res,200,{ok:true},{'Set-Cookie':'b737_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'});broadcast();return;
   }
   if(url.pathname==='/api/command'){
     const cmd=body.command;
     if(!cmd||typeof cmd.type!=='string'||!roleAllows(ses,cmd))return fail(res,403,'ROLE_DENIED','Only instructor may inject faults, reset or create scenarios');
     if(cmd.type==='CONTROL'&&Object.hasOwn(body,'expectedValue')){
       if(peek(state.controls,cmd.path)!==body.expectedValue)return json(res,409,{ok:false,error:'STALE_CONTROL',revision,state:snapshot()});
     }
     if(cmd.type==='FAULT'&&Object.hasOwn(body,'expectedValue')){
       if(state.faults[cmd.id]!==body.expectedValue)return json(res,409,{ok:false,error:'STALE_FAULT',revision,state:snapshot()});
     }
     try{
       if(cmd.type==='PRESET'){
         if(cmd.id!=='bus1'&&cmd.id!=='bus2')return fail(res,400,'BAD_PRESET','Choose bus1 or bus2');
         const n=cmd.id.slice(-1);let next=Engine.initialState();next=Engine.apply(next,{type:'SCENARIO',id:cmd.id});next=Engine.apply(next,{type:'FAULT',id:'gen'+n+'Failed',active:true});state=next;
       }else state=Engine.apply(state,cmd);
     }catch(e){return fail(res,422,'INVALID_COMMAND',e.message);}
     publish(cmd,ses.role);return json(res,200,{ok:true,revision});
   }
   return fail(res,404,'NOT_FOUND','Unknown API path');
 }
 if(req.method==='GET'&&url.pathname==='/api/session'){
   const s=sessionFrom(req);return json(res,200,{joined:!!s,role:s?.role||null,revision,occupants:roleOccupants()});
 }
 if(req.method==='GET'&&url.pathname==='/api/snapshot'){
   const s=sessionFrom(req);if(!s)return fail(res,401,'NOT_JOINED','Join a role first');return json(res,200,snapshot());
 }
 if(req.method==='GET'&&url.pathname==='/api/events'){
   const s=sessionFrom(req);if(!s)return fail(res,401,'NOT_JOINED','Join a role first');
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
   res.write('retry: 1500\n\n');const client={res,session:s};listeners.add(client);sendSSE(res,snapshot());
   req.on('close',()=>{listeners.delete(client);});return;
 }
 return fail(res,404,'NOT_FOUND','No such endpoint');
}
const server=http.createServer((req,res)=>{route(req,res).catch(e=>fail(res,500,'SERVER_ERROR','Unexpected server exception'));});
const ticker=setInterval(()=>{cleanup();for(const l of [...listeners]){if(l.res.writableEnded||l.res.destroyed)listeners.delete(l);else{l.session.lastSeen=Date.now();try{l.res.write(': keepalive\n\n');}catch{listeners.delete(l);}}}},12000);
ticker.unref();
server.on('close',()=>clearInterval(ticker));
if(require.main===module){server.listen(PORT,HOST,()=>{
 console.log('B737 Shared Trainer — local classroom server');
 console.log('ROOM PIN       : '+ROOM_PIN);console.log('INSTRUCTOR PIN : '+INSTRUCTOR_PIN);
 for(const net of Object.values(os.networkInterfaces()).flat())if(net?.family==='IPv4'&&!net.internal)console.log('Join on Wi-Fi : http://'+net.address+':'+PORT+'/trainer-lab/network.html');
 console.log('Local         : http://127.0.0.1:'+PORT+'/trainer-lab/network.html');
 console.log('Use only on a trusted local network. Plain HTTP is not secure across the Internet.');
});}
module.exports={server, snapshot};