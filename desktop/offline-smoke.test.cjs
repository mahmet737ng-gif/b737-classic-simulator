'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const entry=path.join(root,'panel-mosaic-lab/desktop-shell/index.html');
const allPages=[
 'panel-mosaic-lab/cockpit/index.html',
 'panel-mosaic-lab/interactive-overhead/index.html',
 'cb-panel-lab/index.html',
 'cpcs-lab/index.html','dcpcs-lab/index.html',
 'stall-warning-lab/index.html','isn-ecu-start-lab/index.html',
 'isn-electrical-pack-lab/index.html',
 'audio-lab/index.html'
];
test('offline entry and core panels/labs exist',()=>{
 assert.ok(fs.existsSync(entry),'Missing desktop shell');
 for(const file of allPages)assert.ok(fs.existsSync(path.join(root,file)),file);
});
test('engine and aircraft profile modules available',()=>{
 for(const file of ['engine/config/aircraft-profile-v1.js','engine/integration/isn-13-18-ecu-testbench-v1.js','audio/warning-engine.js']){
  assert.ok(fs.existsSync(path.join(root,file)),file);
 }
});
test('source remains owner-locked, pending audio is disclosed',()=>{
 const lock=JSON.parse(fs.readFileSync(path.join(root,'branding/cockpit-pro/official-logo-lock.json'),'utf8'));
 assert.ok(lock.approved&&lock.official_master.sha256);
 const audio=JSON.parse(fs.readFileSync(path.join(root,'audio/user-recordings/manifest.json'),'utf8'));
 assert.match(audio.description,/raw audio files are intentionally NOT checked into this public repository/i);
});
test('no remote runtime dependency for the static shell',()=>{
 const html=fs.readFileSync(entry,'utf8');
 assert.match(html,/src\(\)\{return '\.\.\/cockpit\/index\.html\?desktop-shell=001'/);
 assert.match(html,/function sceneVisibleImagesReady/);
 assert.match(html,/function checkReady/);
});
