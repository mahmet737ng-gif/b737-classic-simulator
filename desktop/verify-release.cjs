'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),yaml=require('js-yaml');
const dir=path.join(__dirname,'dist'),pkg=require('./package.json');
const info=yaml.load(fs.readFileSync(path.join(dir,'latest.yml'),'utf8'));
assert.equal(info.version,pkg.version);
for(const file of info.files){
 assert.equal(path.basename(file.url),file.url,'Release assets must be basenames');
 const data=fs.readFileSync(path.join(dir,file.url));
 assert.equal(createHash('sha512').update(data).digest('base64'),file.sha512,'Installer checksum in update feed');
 assert.equal(data.length,file.size);assert.ok(data.length>80000000,'Full offline installer missing assets');
 assert.ok(fs.statSync(path.join(dir,file.url+'.blockmap')).size>0,'Differential update blockmap missing');
}
const result=JSON.parse(fs.readFileSync(path.join(dir,'startup-benchmark.json'),'utf8'));
assert.equal(result.samples.length,2);
assert.ok(result.samples.every(s=>s.spawnToUsableMs<=5000&&s.main&&s.controls&&s.interaction.responded));
console.log('Release feed, checksums, differential metadata and native startup budget verified.');
