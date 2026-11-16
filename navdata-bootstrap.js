/* Temporary private Railway import channel: LZW16 binary via base64 env chunks.
 * Does not expose the source file via a public URL or commit its data to Git.
 * After successful import, clear CDU_SG_IMPORT_* variables.
 */
'use strict';
const crypto=require('node:crypto');
const MAX_SOURCE_BYTES=3_000_000;
function decodeLZW16(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<2||bytes.length%2!==0||bytes.length>1_000_000)
  throw Error('NAVDATA_INVALID_COMPRESSED_LENGTH');
 const dictionary=new Array(65536);
 let next=256,previous=String.fromCharCode(bytes.readUInt16LE(0));
 const output=[previous];
 for(let offset=2;offset<bytes.length;offset+=2){
  const code=bytes.readUInt16LE(offset);
  const value=code<256?String.fromCharCode(code):
   (dictionary[code]===undefined?(code===next?previous+previous[0]:null):dictionary[code]);
  if(value===null)throw Error('NAVDATA_INVALID_LZW_CODE');
  output.push(value);
  if(next<65536)dictionary[next++]=previous+value[0];
  previous=value;
 }
 const decoded=output.join('');
 if(decoded.length>MAX_SOURCE_BYTES||/[^\\x00-\\x7F]/.test(decoded))
  throw Error('NAVDATA_INVALID_DECODED_TEXT');
 return decoded;
}
function readPrivateImport(env=process.env){
 const count=Number(env.CDU_SG_IMPORT_PART_COUNT||0);
 if(!count)return null;
 if(!Number.isInteger(count)||count<1||count>32)throw Error('NAVDATA_INVALID_PART_COUNT');
 const sha=String(env.CDU_SG_IMPORT_SHA256||'').toLowerCase();
 if(!/^[a-f0-9]{64}$/.test(sha))throw Error('NAVDATA_INVALID_SHA256');
 const parts=[];
 for(let i=0;i<count;i++){
  const key='CDU_SG_IMPORT_PART_'+String(i).padStart(2,'0');
  const piece=env[key];
  if(typeof piece!=='string'||!piece||piece.length>50000||!/^[A-Za-z0-9+/=]+$/.test(piece))
   throw Error('NAVDATA_MISSING_PART_'+i);
  parts.push(piece);
 }
 const raw=Buffer.from(parts.join(''),'base64');
 const decoded=decodeLZW16(raw);
 const observed=crypto.createHash('sha256').update(decoded).digest('hex');
 if(observed!==sha)throw Error('NAVDATA_IMPORT_HASH_MISMATCH');
 const data=JSON.parse(decoded);
 if(data?.schema!=='CDU_SG_CATALOG_V1'||data?.reference_only!==true||
   data?.fmc_executable!==false)throw Error('NAVDATA_UNEXPECTED_DATASET');
 return {data,sha256:observed};
}
async function bootstrapPrivateNavdata(store,env=process.env){
 const source=readPrivateImport(env);
 if(!source)return {imported:false,reason:'NO_PENDING_IMPORT'};
 const result=await store.importData(source.data);
 return {imported:true,sha256:source.sha256,counts:result.procedures,airports:result.airports};
}
module.exports={decodeLZW16,readPrivateImport,bootstrapPrivateNavdata};
