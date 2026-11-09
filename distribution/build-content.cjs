'use strict';
// Offline packaging tool: encrypt new assets; reuse unchanged encrypted blobs.
// This is a BUILD tool, not an application or license server.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('./content-core.cjs');

function inventory(dir, prefix='') {
  const entries=[];
  for(const d of fs.readdirSync(path.join(dir,prefix),{withFileTypes:true})){
    const relative=prefix?prefix+'/'+d.name:d.name;
    core.safePath(relative);
    const full=path.join(dir,relative);
    const stat=fs.lstatSync(full);
    if(stat.isSymbolicLink())throw Error('Refusing symbolic link: '+relative);
    if(stat.isDirectory())entries.push(...inventory(dir,relative));
    else if(stat.isFile())entries.push(relative);
    else throw Error('Refusing unsupported file type: '+relative);
  }
  return entries.sort();
}
function packageRelease({input,output,version,sequence,keyId,encryptionKeyId,privateKey,encryptionKey,previous}) {
  input=path.resolve(input);output=path.resolve(output);
  if(!fs.statSync(input).isDirectory())throw Error('Input is not a directory');
  if(output===input || output.startsWith(input+path.sep) || input.startsWith(output+path.sep))
    throw Error('Input/output must be independent');
  if(fs.existsSync(output))throw Error('Output already exists: releases are immutable');
  const publicKey=crypto.createPublicKey(privateKey);
  let old, oldByPlain=new Map();
  if(previous){
    previous=path.resolve(previous);
    if(previous===output)throw Error('Previous and output directories must differ');
    old=core.verifyRelease(JSON.parse(fs.readFileSync(path.join(previous,'release.json'),'utf8')), {[keyId]:publicKey});
    if(old.keyId!==keyId || old.encryptionKeyId!==encryptionKeyId ||
      !Number.isSafeInteger(sequence) || sequence<=old.sequence)
      throw Error('Invalid previous release or sequence');
    for(const file of old.files){
      const items=oldByPlain.get(file.sha256)||[];
      items.push(file);oldByPlain.set(file.sha256,items);
    }
  }
  fs.mkdirSync(output,{recursive:true});
  const files=[];
  const written=new Set();
  for(const relative of inventory(input)){
    const plain=fs.readFileSync(path.join(input,relative));
    const digest=core.hash(plain);
    let asset, blob;
    const candidates=oldByPlain.get(digest)||[];
    for(const oldFile of candidates){
      if(oldFile.bytes!==plain.length)continue;
      const oldBlobPath=path.join(previous,core.objectPath(oldFile.objectSha256));
      const oldBlob=fs.readFileSync(oldBlobPath);
      // A matching signing/encryption key ID is not proof the encryption key
      // is the same. Authenticate it before reusing a ciphertext.
      if(!core.decryptAsset(oldBlob,oldFile,encryptionKey).equals(plain))continue;
      asset={sha256:oldFile.sha256,objectSha256:oldFile.objectSha256,bytes:oldFile.bytes,encrypted:true};
      blob=oldBlob;break;
    }
    if(!asset){const fresh=core.encryptAsset(plain,encryptionKey);asset={
      sha256:fresh.sha256,objectSha256:fresh.objectSha256,bytes:fresh.bytes,encrypted:true};blob=fresh.blob;}
    const descriptor={path:relative,...asset};
    if(!written.has(asset.objectSha256)){
      const destination=path.join(output,core.objectPath(asset.objectSha256));
      fs.mkdirSync(path.dirname(destination),{recursive:true});
      fs.writeFileSync(destination,blob,{flag:'wx'});
      written.add(asset.objectSha256);
    }
    files.push(descriptor);
  }
  files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const manifest={schema:core.SCHEMA,product:'unified',version,sequence,keyId,encryptionKeyId,files};
  const release=core.signManifest(manifest,privateKey);
  core.verifyRelease(release,{[keyId]:publicKey});
  fs.writeFileSync(path.join(output,'release.json'),JSON.stringify(release,null,2)+'\n',{flag:'wx'});
  return {manifest,objects:written.size,download:old?core.planUpdate(old,manifest,old.files.map(f=>f.objectSha256)):null};
}
function main(args=process.argv.slice(2)){
  if(args.length!==6 && args.length!==7)throw Error(
    'Usage: node distribution/build-content.cjs <input-directory> <new-output-directory> <version> <sequence> <signing-key-id> <encryption-key-id> [previous-release-directory]');
  const keyHex=process.env.UNIFIED_CONTENT_KEY_HEX;
  const privateKeyFile=process.env.UNIFIED_SIGNING_KEY_FILE;
  if(!/^[a-fA-F0-9]{64}$/.test(keyHex||'') || !privateKeyFile)
    throw Error('Missing 256-bit content encryption key or signing private key (environment only)');
  const privateKey=fs.readFileSync(privateKeyFile,'utf8');
  const result=packageRelease({input:args[0],output:args[1],version:args[2],
    sequence:Number(args[3]),keyId:args[4],encryptionKeyId:args[5],
    privateKey,encryptionKey:Buffer.from(keyHex,'hex'),previous:args[6]});
  console.log(JSON.stringify({version:result.manifest.version,sequence:result.manifest.sequence,
    assetCount:result.manifest.files.length,objectCount:result.objects,
    changedObjects:result.download?.countToDownload ?? result.objects},null,2));
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={inventory,packageRelease,main};
