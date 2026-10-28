#!/usr/bin/env node
'use strict';
/* Fail-closed LE DEVICES owner lock. This file is pinned by GitHub Pages workflow. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const manifestPath=path.join(__dirname,'le-devices-final-lock-v1.json');
const lock=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(lock.id!=='LEDEV-FINAL-2026-10-28')throw Error('Unexpected owner lock identity');
const blobHash=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const actualPaths=Object.keys(lock.frozenFiles);
let errors=[];
for(const p of actualPaths){
 const pathname=path.join(root,p);
 if(!fs.existsSync(pathname)){errors.push('Missing locked file: '+p);continue;}
 const hash=blobHash(fs.readFileSync(pathname));
 if(hash!==lock.frozenFiles[p])errors.push('Unapproved locked file change: '+p+' expected '+lock.frozenFiles[p]+' got '+hash);
}
const segmentRoot=path.join(root,'panel-mosaic-lab/le-devices/segments');
const currentSegments=fs.readdirSync(segmentRoot).filter(x=>x.endsWith('.svg')).map(x=>'panel-mosaic-lab/le-devices/segments/'+x).sort();
const lockedSegments=actualPaths.filter(x=>x.startsWith('panel-mosaic-lab/le-devices/segments/')).sort();
if(currentSegments.length!==lock.frozenSegmentCount||JSON.stringify(currentSegments)!==JSON.stringify(lockedSegments))
 errors.push('Locked 96-segment inventory changed (renamed, deleted, or additional graphics)');
for(const [name,required] of [
 ['panel-mosaic-lab/cockpit/overhead-stage.html',['../le-devices/trainer-bridge-v1.js','../../engine/systems/le-devices-classic-v1.js','../../engine/systems/te-flap-actuator-v1.js']],
 ['panel-mosaic-lab/cockpit/index.html',['le-devices-live-link-v1.js','lights.js']],
 ['panel-mosaic-lab/cockpit/app.js',['ledev=LEDEV','overheadFrame']],
 ['panel-mosaic-lab/cockpit/lights-model.js',['leDirectValid','leDirectTransit','leDirectExtended']]
]){
 const content=fs.readFileSync(path.join(root,name),'utf8');
 for(const marker of required)if(!content.includes(marker))errors.push('LE integration mount marker missing: '+name+' / '+marker);
}
if(process.argv.includes('--negative-self-test')){
 const first=actualPaths[0],original=fs.readFileSync(path.join(root,first));
 assert.notEqual(blobHash(Buffer.concat([original,Buffer.from('tamper')])),lock.frozenFiles[first]);
 console.log('LE DEVICES tamper detection self-test passed');
}
if(errors.length){for(const e of errors)console.error('OWNER LE DEVICES RED ZONE: '+e);process.exitCode=1;}
else console.log('LEDEV FINAL LOCK OK: '+actualPaths.length+' exact Git blobs ('+currentSegments.length+' standalone lamp assets), integration ports remain open.');
