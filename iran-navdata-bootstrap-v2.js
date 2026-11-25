'use strict';
const crypto=require('node:crypto');
const {decodeLZW16}=require('./navdata-bootstrap.js');
const {validate}=require('./iran-navdata-v2.js');
function read(env=process.env){
 const count=Number(env.IRAN_NAVDATA_V2_PART_COUNT||0);
 if(!count)return null;
 if(!Number.isInteger(count)||count<1||count>32)throw Error('IRAN_IMPORT_PART_COUNT');
 const expected=String(env.IRAN_NAVDATA_V2_SHA256||'').toLowerCase();
 if(!/^[a-f0-9]{64}$/.test(expected))throw Error('IRAN_IMPORT_SHA');
 const parts=Array.from({length:count},(_,i)=>{
  const v=env['IRAN_NAVDATA_V2_PART_'+String(i).padStart(2,'0')];
  if(typeof v!=='string'||!v||v.length>32768||!/^[A-Za-z0-9+/=]+$/.test(v))throw Error('IRAN_IMPORT_PART_'+i);
  return v;
 });
 const raw=decodeLZW16(Buffer.from(parts.join(''),'base64'));
 const sha=crypto.createHash('sha256').update(raw).digest('hex');
 if(sha!==expected)throw Error('IRAN_IMPORT_HASH_MISMATCH');
 return {data:validate(JSON.parse(raw)),sha};
}
async function bootstrap(store,env=process.env){
 const source=read(env);
 if(!source)return {imported:false,available:!!await store.getData()};
 const prior=await store.getData();
 // JSONB can reorder keys, so only compare counts and exact data via stable keys,
 // never compare the source hash with a raw JSONB serialization.
 const stable=o=>o&&typeof o==='object'?(Array.isArray(o)?o.map(stable):Object.fromEntries(Object.keys(o).sort().map(k=>[k,stable(o[k])]))):o;
 if(prior&&JSON.stringify(stable(prior))===JSON.stringify(stable(source.data)))return {imported:false,available:true,sha:source.sha};
 const summary=await store.importData(source.data);
 return {imported:true,available:true,sha:source.sha,summary};
}
module.exports={read,bootstrap};
