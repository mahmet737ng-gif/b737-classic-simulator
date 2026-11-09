'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const core=require('./content-core.cjs');
const {packageRelease,inventory}=require('./build-content.cjs');
const pair=()=>crypto.generateKeyPairSync('ed25519');
const entry=(name,data,key)=>{
  const asset=core.encryptAsset(Buffer.from(data),key);
  return {file:{path:name,sha256:asset.sha256,objectSha256:asset.objectSha256,bytes:asset.bytes,encrypted:true},blob:asset.blob};
};
const manifest=(files,sequence=1)=>({schema:core.SCHEMA,product:'unified',
  version:'1.0.'+(sequence-1),sequence,keyId:'signer-1',encryptionKeyId:'cohort-1',files});
test('signature verification rejects tampering, unknown signer and rollback',()=>{
  const {privateKey,publicKey}=pair(),key=crypto.randomBytes(32);
  const a=entry('panel-mosaic-lab/cockpit/a.js','original',key);
  const doc=manifest([a.file]);
  const sealed=core.signManifest(doc,privateKey);
  assert.deepEqual(core.verifyRelease(sealed,{'signer-1':publicKey}),doc);
  assert.throws(()=>core.verifyRelease(sealed,{'signer-1':publicKey},2),/rollback/i);
  assert.throws(()=>core.verifyRelease(sealed,{'other':publicKey}),/Unknown signing/);
  assert.throws(()=>core.verifyRelease({...sealed,manifest:{...doc,version:'2.0.0'}},{'signer-1':publicKey}),/signature mismatch/);
  assert.throws(()=>core.verifyRelease({...sealed,signature:'!!!'},{'signer-1':publicKey}),/Malformed/);
});
test('AES-256-GCM rejects wrong keys and tampered ciphertext',()=>{
  const key=crypto.randomBytes(32),a=entry('cockpit/a.png','123\0valid',key);
  assert.equal(core.decryptAsset(a.blob,a.file,key).toString(),'123\0valid');
  assert.throws(()=>core.decryptAsset(a.blob,a.file,crypto.randomBytes(32)));
  const altered=Buffer.from(a.blob);altered[altered.length-1]^=1;
  assert.throws(()=>core.decryptAsset(altered,a.file,key),/object hash mismatch/i);
  assert.throws(()=>core.decryptAsset(a.blob,{...a.file,sha256:'0'.repeat(64)},key));
});
test('strict path and manifest checks block traversal and case collisions',()=>{
  for(const p of ['../secrets.txt','/private/file','folder\\file','a//b','a/./b',
    'COM1.txt','a/..','a/COn.txt','bad:name','folder/trailing.']){
    assert.throws(()=>core.safePath(p),/Unsafe/);
  }
  const key=crypto.randomBytes(32),a=entry('X/file.png','A',key).file;
  const b=entry('x/File.png','B',key).file;
  assert.throws(()=>core.canonical(manifest([a,b])),/collision/i);
  assert.throws(()=>core.canonical(manifest([{...a,bytes:-1}])),/Invalid/);
  assert.throws(()=>core.canonical({...manifest([a]),unknown:'x'}),/Unexpected/);
});
test('delta plan keeps bytes and removes only obsolete managed paths',()=>{
  const key=crypto.randomBytes(32),a=entry('a.js','A',key).file;
  const b=entry('b.css','B',key).file,c=entry('c.png','C',key).file;
  const before=manifest([a,b]),after=manifest([a,c],2);
  const plan=core.planUpdate(before,after);
  assert.deepEqual(plan.download.map(x=>x.path),['c.png']);
  assert.deepEqual(plan.retain.map(x=>x.path),['a.js']);
  assert.deepEqual(plan.remove,['b.css']);
  assert.equal(plan.countToDownload,1);
  assert.deepEqual(core.planUpdate(before,after,[c.objectSha256]).download,[]);
  assert.throws(()=>core.planUpdate(after,before),/rollback/i);
  assert.throws(()=>core.planUpdate(before,{...before,version:'9.0.0'}),/same sequence/i);
  assert.throws(()=>core.planUpdate(before,{...after,encryptionKeyId:'another'}),/key lineage/i);
});
test('real encrypted pack reuses old encrypted object after one-file update',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'unified-packs-'));
  try{
    const input=path.join(temp,'input'),v1=path.join(temp,'v1'),v2=path.join(temp,'v2');
    fs.mkdirSync(input);
    fs.writeFileSync(path.join(input,'stable.png'),Buffer.alloc(10000,17));
    fs.writeFileSync(path.join(input,'removed.txt'),'old');
    const {privateKey,publicKey}=pair(),secret=crypto.randomBytes(32);
    const settings={input,version:'1.0.0',sequence:1,keyId:'signer-1',
      encryptionKeyId:'cohort-1',privateKey,encryptionKey:secret};
    const first=packageRelease({...settings,output:v1});
    const stable=first.manifest.files.find(f=>f.path==='stable.png');
    assert.ok(fs.existsSync(path.join(v1,core.objectPath(stable.objectSha256))));
    fs.rmSync(path.join(input,'removed.txt'));
    fs.writeFileSync(path.join(input,'new.js'),'new rules');
    const second=packageRelease({...settings,output:v2,version:'1.0.1',sequence:2,previous:v1});
    const current=second.manifest.files.find(f=>f.path==='stable.png');
    assert.equal(current.objectSha256,stable.objectSha256,'unchanged encrypted bytes reused');
    assert.deepEqual(second.download.download.map(f=>f.path),['new.js']);
    assert.deepEqual(second.download.remove,['removed.txt']);
    const signed=JSON.parse(fs.readFileSync(path.join(v2,'release.json'),'utf8'));
    assert.deepEqual(core.verifyRelease(signed,{'signer-1':publicKey},2),second.manifest);
    for(const f of second.manifest.files){
      const blob=fs.readFileSync(path.join(v2,core.objectPath(f.objectSha256)));
      assert.equal(core.hash(core.decryptAsset(blob,f,secret)),f.sha256);
    }
    assert.throws(()=>packageRelease({...settings,output:v2,previous:v1}),/already exists/i);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('packager fails closed for symlinks',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'unified-symlinks-'));
  try{
    fs.writeFileSync(path.join(temp,'safe.txt'),'okay');
    fs.symlinkSync(path.join(temp,'safe.txt'),path.join(temp,'bad-link'));
    assert.throws(()=>inventory(temp),/symbolic link/i);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
