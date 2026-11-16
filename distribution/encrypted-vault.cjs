'use strict';
// Encrypted local content-addressed vault for the native/Node adapter.
// Never stores decrypted assets or subscription keys. Integration with
// Electron's loopback server and a license API is a separate gated step.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('./content-core.cjs');
const ACTIVE='current-release.json';
async function isPresent(file){
  try{await fs.access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}
}
function locate(root,sha){return path.join(root,core.objectPath(sha));}
async function loadCurrent(root,keys){
  const filename=path.join(root,ACTIVE);
  if(!await isPresent(filename))return null;
  const envelope=JSON.parse(await fs.readFile(filename,'utf8'));
  return {envelope,manifest:core.verifyRelease(envelope,keys)};
}
async function readVerified(root,descriptor,key){
  const blob=await fs.readFile(locate(root,descriptor.objectSha256));
  core.decryptAsset(blob,descriptor,key); // validates hash, GCM tag and plaintext
  return blob;
}
async function syncEncryptedVault({root,envelope,publicKeys,encryptionKey,fetchObject,minimumSequence=0}){
  if(typeof fetchObject!=='function')throw Error('fetchObject is required');
  root=path.resolve(root);
  await fs.mkdir(root,{recursive:true});
  const lock=path.join(root,'.sync.lock');
  // No concurrent writes or pointer races. A crashed process may require
  // operator intervention to remove a stale lock after verifying no writer.
  const handle=await fs.open(lock,'wx',0o600);
  try{
    const old=await loadCurrent(root,publicKeys);
    const target=core.verifyRelease(envelope,publicKeys,
      Math.max(minimumSequence,old?.manifest.sequence||0));
    const planned=core.planUpdate(old?.manifest||null,target);
    let fetched=0,reused=0;
    const validated=new Set();
    for(const file of target.files){
      if(validated.has(file.objectSha256))continue;
      validated.add(file.objectSha256);
      const dest=locate(root,file.objectSha256);
      try{
        await readVerified(root,file,encryptionKey);
        reused++;
        continue;
      }catch(error){
        if(error.code!=='ENOENT'){
          // Never discard a ciphertext merely because a caller supplied
          // the wrong key: a valid previous release must remain readable.
          const existing=await fs.readFile(dest);
          if(core.hash(existing)===file.objectSha256)throw error;
          // A corrupted file may be replaced only after a new object
          // has been fetched and authenticated successfully.
        }
      }
      const blob=await fetchObject(file.objectSha256,core.objectPath(file.objectSha256));
      if(!Buffer.isBuffer(blob))throw Error('Downloader must return a Buffer');
      core.decryptAsset(blob,file,encryptionKey);
      await fs.mkdir(path.dirname(dest),{recursive:true});
      const temp=dest+'.partial-'+crypto.randomBytes(8).toString('hex');
      try{await fs.writeFile(temp,blob,{flag:'wx',mode:0o600});await fs.rename(temp,dest);}
      finally{await fs.rm(temp,{force:true});}
      fetched++;
    }
    // Only after every object has passed cryptographic verification do we
    // switch the active release. Old content remains usable on download errors.
    const pointer=path.join(root,ACTIVE),tmp=pointer+'.partial-'+crypto.randomBytes(8).toString('hex');
    try{
      await fs.writeFile(tmp,JSON.stringify(envelope)+'\n',{flag:'wx',mode:0o600});
      await fs.rename(tmp,pointer);
    }finally{await fs.rm(tmp,{force:true});}
    const keep=new Set(target.files.map(f=>f.objectSha256));
    for(const oldFile of old?.manifest.files||[]){
      if(!keep.has(oldFile.objectSha256))await fs.rm(locate(root,oldFile.objectSha256),{force:true});
    }
    return {version:target.version,sequence:target.sequence,fetchedObjects:fetched,
      reusedObjects:reused,removedPaths:planned.remove,activeAssetCount:target.files.length};
  }finally{await handle.close();await fs.rm(lock,{force:true});}
}
async function readEncryptedVaultAsset({root,relativePath,publicKeys,encryptionKey}){
  core.safePath(relativePath);
  const active=await loadCurrent(path.resolve(root),publicKeys);
  if(!active)throw Error('No active verified release');
  const descriptor=active.manifest.files.find(f=>f.path===relativePath);
  if(!descriptor)throw Error('Asset not present in current release');
  return core.decryptAsset(await fs.readFile(locate(root,descriptor.objectSha256)),
    descriptor,encryptionKey);
}
module.exports={syncEncryptedVault,readEncryptedVaultAsset,loadCurrent};
