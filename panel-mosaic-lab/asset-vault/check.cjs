'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../');
const rel='panel-mosaic-lab/asset-vault/';
const current=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog.json'),'utf8'));
const history=JSON.parse(fs.readFileSync(path.join(__dirname,'history.json'),'utf8'));
const idset=new Set();
const fixedFields=['asset_id','section','version','source_filename','size_bytes','sha256','github_path','technical_database_library_path','immutable'];
assert.ok(Array.isArray(current.assets)&&current.assets.length>0,'Non-empty image catalog is required');
assert.ok(Array.isArray(history.events),'History events must be an array');
for(const a of current.assets){
 assert.ok(!idset.has(a.asset_id),'Duplicate asset ID '+a.asset_id);idset.add(a.asset_id);
 assert.match(a.sha256,/^[0-9a-f]{64}$/);
 assert.ok(Number.isSafeInteger(a.size_bytes)&&a.size_bytes>0);
 assert.ok(a.immutable===true,'Every source asset must be locked');
 assert.ok(['uploaded_verified','awaiting_binary_upload'].includes(a.github_status),'Truthful GitHub status required');
 assert.ok(a.github_path.startsWith('panel-mosaic-lab/assets/locked/'),'Asset must be in locked-asset namespace');
 if(a.github_status==='uploaded_verified'){
  const disk=path.join(root,a.github_path);
  assert.ok(fs.existsSync(disk),'Verified GitHub image missing: '+a.asset_id);
  const buf=fs.readFileSync(disk);
  assert.equal(buf.length,a.size_bytes,'Byte count mismatch for '+a.asset_id);
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),a.sha256,'Locked original was modified: '+a.asset_id);
 }
}
const base=process.env.GITHUB_BASE_SHA;
if(base && !/^0+$/.test(base)){
 let old=null,oldEvents=null;
 try{old=JSON.parse(cp.execFileSync('git',['show',base+':'+rel+'catalog.json'],{cwd:root,encoding:'utf8'}));}catch(e){console.log('Initial image catalog; no old catalog at '+base);}
 try{oldEvents=JSON.parse(cp.execFileSync('git',['show',base+':'+rel+'history.json'],{cwd:root,encoding:'utf8'}));}catch(e){console.log('Initial image history; no old history at '+base);}
 if(old){
  for(const prev of old.assets){
   const next=current.assets.find(x=>x.asset_id===prev.asset_id);
   assert.ok(next,'Historical asset ID deleted: '+prev.asset_id);
   for(const field of fixedFields) assert.deepEqual(next[field],prev[field],'Historical field overwritten: '+prev.asset_id+'.'+field);
   const validTransition=prev.github_status===next.github_status||prev.github_status==='awaiting_binary_upload'&&next.github_status==='uploaded_verified';
   assert.ok(validTransition,'A GitHub image cannot be downgraded: '+prev.asset_id);
  }
 }
 if(oldEvents){
  assert.ok(history.events.length>=oldEvents.events.length,'Cannot truncate historical changes');
  oldEvents.events.forEach((event,i)=>assert.deepEqual(history.events[i],event,'Old update-history entry mutated: '+i));
 }
 const diff=cp.execFileSync('git',['diff','--name-status','--diff-filter=DMRT',base,'HEAD','--','panel-mosaic-lab/assets/locked/'],{cwd:root,encoding:'utf8'}).trim();
 assert.equal(diff,'','Previously committed locked image files were deleted or changed:\n'+diff);
}
console.log('PASS: '+current.assets.length+' SHA-indexed references; '+current.assets.filter(a=>a.github_status==='uploaded_verified').length+' GitHub binaries verified; historical versions preserved.');
