'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const http2=require('node:http2');
const {execFileSync}=require('node:child_process');

const hopHeaders=new Set(['connection','keep-alive','proxy-connection','transfer-encoding','upgrade']);

async function openHttpsFixture(upstream){
 // This loopback proxy reproduces Railway's client-side HTTP/2 connection
 // while keeping the tested Gateway on its normal HTTP/1.1 backend.
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'unified-fixture-tls-'));
 let key,cert;
 try{
  const keyFile=path.join(tmp,'key.pem');
  const certFile=path.join(tmp,'cert.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1',
   '-subj','/CN=127.0.0.1','-keyout',keyFile,'-out',certFile],{stdio:'ignore'});
  key=fs.readFileSync(keyFile);
  cert=fs.readFileSync(certFile);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 const server=http2.createSecureServer({key,cert,allowHTTP1:true});
 const sessions=new Set();
 server.on('session',session=>{
  sessions.add(session);
  session.once('close',()=>sessions.delete(session));
 });
 server.on('request',(req,res)=>{
  const headers=Object.fromEntries(Object.entries(req.headers).filter(([name])=>!name.startsWith(':')&&!hopHeaders.has(name)));
  headers.host=req.headers[':authority']||req.headers.host;
  headers['x-forwarded-proto']='https';
  const out=http.request(upstream,{path:req.url,method:req.method,headers},reply=>{
   if(res.destroyed){reply.destroy();return;}
   const responseHeaders=Object.fromEntries(Object.entries(reply.headers).filter(([name])=>!hopHeaders.has(name)));
   res.writeHead(reply.statusCode,responseHeaders);
   reply.on('error',()=>res.destroy());
   reply.pipe(res);
  });
  out.on('error',()=>{
   if(res.destroyed)return;
   if(!res.headersSent)res.writeHead(502);
   res.end();
  });
  req.on('error',()=>out.destroy());
  res.on('close',()=>out.destroy());
  req.pipe(out);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {origin:'https://127.0.0.1:'+server.address().port,close(){
  for(const session of sessions)session.destroy();
  return new Promise(resolve=>server.close(resolve));
 }};
}
module.exports={openHttpsFixture};
