'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const core=require('./content-core.cjs');
const {syncEncryptedVault,readEncryptedVaultAsset,loadCurrent}=require('./encrypted-vault.cjs');
function bundle(data,name,key){
  const encrypted=core.encryptAsset(Buffer.from(data),key);
  return {file:{path:name,sha256:encrypted.sha256,objectSha256:encrypted.objectSha256,
    bytes:encrypted.bytes,encrypted:true},blob:encrypted.blob};
}
function release(files,seq,privateKey){
  const manifest={schema:core.SCHEMA,product:'unified',version:'1.0.'+(seq-1),sequence:seq,
    keyId:'sign-v1',encryptionKeyId:'cohort-v1',files:files.map(f=>f.file).sort((a,b)=>a.path.localeCompare(b.path,'en'))};
  return core.signManifest(manifest,privateKey);
}
test('verified encrypted vault downloads delta only, activates atomically and deletes stale managed objects',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'unified-vault-'));
  try{
    const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519'),key=crypto.randomBytes(32);
    const keys={'sign-v1':publicKey};
    const a=bundle('STABLE PANEL','panel/a.png',key);
    const b=bundle('OLD','tests/old.json',key);
    const c=bundle('NEW','tests/new.json',key);
    const blobs=new Map([a,b,c].map(x=>[x.file.objectSha256,x.blob]));
    let requested=[];
    const fetchObject=async hash=>{requested.push(hash);return blobs.get(hash);};
    const v1=release([a,b],1,privateKey);
    const result1=await syncEncryptedVault({root,envelope:v1,publicKeys:keys,encryptionKey:key,fetchObject});
    assert.equal(result1.fetchedObjects,2);
    assert.equal((await readEncryptedVaultAsset({root,relativePath:a.file.path,publicKeys:keys,encryptionKey:key})).toString(),'STABLE PANEL');
    const v2=release([a,c],2,privateKey);
    requested=[];
    const result2=await syncEncryptedVault({root,envelope:v2,publicKeys:keys,encryptionKey:key,fetchObject});
    assert.equal(result2.fetchedObjects,1);
    assert.equal(result2.reusedObjects,1);
    assert.deepEqual(result2.removedPaths,['tests/old.json']);
    assert.deepEqual(requested,[c.file.objectSha256]);
    await assert.rejects(readEncryptedVaultAsset({root,relativePath:'tests/old.json',publicKeys:keys,encryptionKey:key}),/not present/);
    await assert.rejects(fs.stat(path.join(root,core.objectPath(b.file.objectSha256))),{code:'ENOENT'});
    assert.equal((await loadCurrent(root,keys)).manifest.sequence,2);
    await assert.rejects(syncEncryptedVault({root,envelope:v1,publicKeys:keys,encryptionKey:key,fetchObject}),/rollback/i);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('failed download does not replace active release',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'unified-rollback-'));
  try{
    const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519'),key=crypto.randomBytes(32);
    const keys={'sign-v1':publicKey};
    const a=bundle('EXISTING','a.png',key),b=bundle('NEXT','b.png',key);
    const old=release([a],1,privateKey);
    await syncEncryptedVault({root,envelope:old,publicKeys:keys,encryptionKey:key,fetchObject:async()=>a.blob});
    const next=release([a,b],2,privateKey);
    await assert.rejects(syncEncryptedVault({root,envelope:next,publicKeys:keys,
      encryptionKey:key,fetchObject:async()=>Buffer.from('corrupted')}),/hash mismatch/);
    const state=await loadCurrent(root,keys);
    assert.equal(state.manifest.sequence,1);
    assert.equal((await readEncryptedVaultAsset({root,relativePath:'a.png',publicKeys:keys,encryptionKey:key})).toString(),'EXISTING');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
