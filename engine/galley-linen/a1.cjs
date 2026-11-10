'use strict';
const z=require('node:crypto');
const X='G7.',Y='G8.',J=Buffer.from('G7/A\0'),K=Buffer.from('G7/B\0'),L=Buffer.from('G7/C\0');
function a(x){return Buffer.from(x).toString('base64url')}
function b(x,n=16384){if(typeof x!=='string'||x.length>n*2||!/^[A-Za-z0-9_-]+$/.test(x))throw Error('G7/01');const y=Buffer.from(x,'base64url');if(y.length>n||a(y)!==x)throw Error('G7/02');return y}
function c(x,n=16384){const y=b(x,n);let r;try{r=JSON.parse(y.toString('utf8'))}catch{throw Error('G7/03')}if(!r||typeof r!=='object'||Array.isArray(r)||Buffer.from(JSON.stringify(r)).length>n)throw Error('G7/04');return r}
function d(o,ks){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join('|')!==ks.slice().sort().join('|'))throw Error('G7/05')}
function e(x){return z.createHash('sha256').update(x).digest('hex')}
function f(x){const k=z.createPublicKey({key:b(x,512),format:'der',type:'spki'});if(k.asymmetricKeyType!=='ec'||k.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('G7/06');return k}
function g(x){if(!x||typeof x!=='object'||x.type!=='private'||x.asymmetricKeyType!=='ec'||x.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('G7/07')}
function h(x){const k=z.createPublicKey(x);if(k.asymmetricKeyType!=='ec'||k.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('G7/08');return a(k.export({format:'der',type:'spki'}))}
function i(x){if(typeof x!=='string'||x.length<1||x.length>200||/[^\x20-\x7E]/.test(x))throw Error('G7/09');return x}
function j(x){if(!Number.isSafeInteger(x)||x<0)throw Error('G7/10');return x}
function k(t){if(typeof t!=='string'||!t.startsWith(X)||t.length>3000)throw Error('G7/11');const r=c(t.slice(3),2048);d(r,['a','b']);d(r.a,['a','b','c','d']);if(r.a.a!==1||r.a.d!==42)throw Error('G7/12');const p=f(r.a.b),n=b(r.a.c,64),s=b(r.b,256);if(n.length!==16||!z.verify('sha256',Buffer.concat([J,Buffer.from(JSON.stringify(r.a))]),p,s))throw Error('G7/13');return {r:r.a,p};}
function m(x,y){return Buffer.concat([x,Buffer.from(JSON.stringify(y),'utf8')])}
module.exports=Object.freeze({a,b,c,d,e,f,g,h,i,j,k,m,z,X,Y,J,K,L});
