'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const crypto=require('node:crypto');
const {decodeLZW16,readPrivateImport,bootstrapPrivateNavdata}=require('../navdata-bootstrap.js');
function encode(s){
 const dict=new Map();let next=256,w=s[0],codes=[];
 for(let i=1;i<s.length;i++){
  const c=s[i],wc=w+c;
  if(dict.has(wc)){w=wc;continue;}
  codes.push(w.length===1?w.charCodeAt(0):dict.get(w));
  if(next<65536)dict.set(wc,next++);
  w=c;
 }
 codes.push(w.length===1?w.charCodeAt(0):dict.get(w));
 const b=Buffer.alloc(codes.length*2);
 codes.forEach((c,i)=>b.writeUInt16LE(c,i*2));
 return b.toString('base64');
}
test('private LZW16 blob roundtrip and SHA256 validation',()=>{
 const raw=JSON.stringify({schema:'CDU_SG_CATALOG_V1',reference_only:true,
 fmc_executable:false,data:'OIII OIMM OISS '.repeat(800)});
 const payload=encode(raw),sha=crypto.createHash('sha256').update(raw).digest('hex');
 const env={CDU_SG_IMPORT_PART_COUNT:'2',CDU_SG_IMPORT_SHA256:sha,
  CDU_SG_IMPORT_PART_00:payload.slice(0,Math.floor(payload.length/2)),
  CDU_SG_IMPORT_PART_01:payload.slice(Math.floor(payload.length/2))};
 assert.equal(decodeLZW16(Buffer.from(payload,'base64')),raw);
 assert.deepEqual(readPrivateImport(env).data,JSON.parse(raw));
 assert.throws(()=>readPrivateImport({...env,CDU_SG_IMPORT_SHA256:'f'.repeat(64)}),/HASH_MISMATCH/);
 assert.throws(()=>readPrivateImport({...env,CDU_SG_IMPORT_PART_01:''}),/MISSING_PART/);
});
test('bootstrap imports validated data only when the private parts exist',async()=>{
 const raw=JSON.stringify({schema:'CDU_SG_CATALOG_V1',reference_only:true,fmc_executable:false,
 airports:{OIII:{},OIMM:{},OISS:{}}});
 const env={CDU_SG_IMPORT_PART_COUNT:'1',
  CDU_SG_IMPORT_SHA256:crypto.createHash('sha256').update(raw).digest('hex'),
  CDU_SG_IMPORT_PART_00:encode(raw)};
 let imports=0;
 const store={importData:async(data)=>{imports++;assert.deepEqual(data,JSON.parse(raw));
 return {procedures:274,airports:['OIII','OIMM','OISS']};}};
 assert.equal((await bootstrapPrivateNavdata(store,{})).imported,false);
 const result=await bootstrapPrivateNavdata(store,env);
 assert.equal(result.imported,true);
 assert.equal(result.counts,274);
 assert.equal(imports,1);
});
