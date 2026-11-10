'use strict';
const u=require('./a1.cjs');
function a(k){u.g(k);const q={a:1,b:u.h(k),c:u.a(u.z.randomBytes(16)),d:42};const s=u.z.sign('sha256',u.m(u.J,q),k);return u.X+u.a(Buffer.from(JSON.stringify({a:q,b:u.a(s)}),'utf8'))}
function b(x,k,t,n={}){
 u.g(k);
 if(typeof x!=='string'||!x.startsWith(u.Y)||x.length>12000)throw Error('G7/20');
 const r=u.c(x.slice(3),8192);u.d(r,['a','b']);u.d(r.a,['a','b','c']);u.d(r.a.a,['a','b','c','d','e','f']);
 const v=r.a,h=v.a;
 if(h.a!==1||typeof h.b!=='string'||!/^[a-zA-Z0-9._-]{1,64}$/.test(h.b))throw Error('G7/21');
 const p=t instanceof Map?t.get(h.b):t?.[h.b];
 if(!p||p.asymmetricKeyType!=='ed25519')throw Error('G7/22');
 const q=u.b(r.b,256);
 if(q.length!==64||!u.z.verify(null,u.m(u.K,v),p,q))throw Error('G7/23');
 const w=u.f(h.c),s=u.b(h.d,32),iv=u.b(h.e,32),ct=u.b(v.b,8192),tag=u.b(v.c,32);
 if(s.length!==16||iv.length!==12||tag.length!==16||typeof h.f!=='string'||!/^[a-f0-9]{64}$/.test(h.f))throw Error('G7/24');
 const raw=u.z.diffieHellman({privateKey:k,publicKey:w});
 const aes=Buffer.from(u.z.hkdfSync('sha256',raw,s,u.L,32));
 const dc=u.z.createDecipheriv('aes-256-gcm',aes,iv);
 dc.setAAD(Buffer.from(JSON.stringify(h)));dc.setAuthTag(tag);
 let info;try{info=JSON.parse(Buffer.concat([dc.update(ct),dc.final()]).toString('utf8'))}catch{throw Error('G7/25')}
 u.d(info,['a','b','c','d','e','f','g','h','i']);
 if(info.a!==1||info.h!==42||info.b!==u.e(Buffer.from(u.h(k),'base64url'))||info.i!==h.f||typeof info.f!=='string'||!/^[0-9a-f]{32}$/.test(info.f))throw Error('G7/26');
 if(typeof info.e!=='string'||info.e.length>128||!Array.isArray(info.g)||info.g.length>32||info.g.some(x=>typeof x!=='string'||x.length>64)|| !Number.isSafeInteger(info.c)||!Number.isSafeInteger(info.d)||info.c<0||info.d<=info.c)throw Error('G7/27');
 const now=u.j(n.nowSeconds??Math.floor(Date.now()/1000));
 if(now<info.c||now>=info.d)throw Error('G7/28');
 if(n.lastSeenSeconds!==undefined&&now+Math.max(0,Math.min(300,u.j(n.skewSeconds??0)))<u.j(n.lastSeenSeconds))throw Error('G7/29');
 if(n.requestCode&&info.i!==u.e(Buffer.from(n.requestCode,'utf8')))throw Error('G7/30');
 return Object.freeze({a:info.e,b:info.g.slice(),c:info.c,d:info.d,e:info.f,f:Math.max(now,n.lastSeenSeconds??0)});
}
module.exports=Object.freeze({a,b});
