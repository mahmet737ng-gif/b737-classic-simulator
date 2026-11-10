'use strict';
const t=require('node:test'),a=require('node:assert/strict'),c=require('node:crypto');
const x=require('./a2.cjs'),z=require('./a1.cjs');
t('A/1',()=>{const k=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),s=x.a(k.privateKey);const r=z.k(s);a.equal(r.r.a,1);a.equal(r.r.d,42);a.equal(z.b(r.r.c).length,16)});
t('A/2',()=>{const k=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),v=x.a(k.privateKey);const r=JSON.parse(z.b(v.slice(3)).toString());r.a.c=z.a(c.randomBytes(16));a.throws(()=>z.k(z.X+z.a(Buffer.from(JSON.stringify(r)))))});
t('A/3',()=>{const k=c.generateKeyPairSync('ed25519');a.throws(()=>x.a(k.privateKey));for(const v of ['','G8.','G8.!','G8.'+'A'.repeat(12001)])a.throws(()=>x.b(v,k.privateKey,{}))});
t('A/4',()=>{const k=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),s=x.a(k.privateKey);a.throws(()=>x.b(s,k.privateKey,{}));a.throws(()=>z.k('G7.x'));});
