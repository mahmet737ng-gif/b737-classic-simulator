'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const T=require('../panel-mosaic-lab/cockpit/thrust-mode-annunciator-v1.js');
test('FCOM 7.10 supports all thrust-mode annunciations, no unsupported shorthand',()=>{
 assert.deepEqual(T.MODES,['TO','R-TO','CLB','R-CLB','CRZ','G/A','CON','----']);
 for(const mode of T.MODES){
  const r=T.resolve({fmcMode:mode,fmcConfirmed:true});
  assert.equal(r.mode,mode);assert.equal(r.confirmed,true);
 }
 assert.equal(T.resolve({fmcMode:'MCT',fmcConfirmed:true}).mode,'----');
 assert.equal(T.resolve({fmcMode:'R-CLB',fmcConfirmed:false}).mode,'----');
});
test('TO/GA is not mistaken for an FMC limit or the four-column FMA',()=>{
 assert.deepEqual(T.resolve({togaPhase:'GA',fmcMode:'CRZ',fmcConfirmed:true}),
  {mode:'G/A',origin:'SIMULATED_FCC_TOGA',confirmed:false});
 assert.equal(T.resolve({togaPhase:'TO'}).mode,'TO');
 assert.equal(T.resolve({phase:'INITIAL_CLIMB',elapsedSec:10}).mode,'----');
 assert.equal(T.resolve({phase:'INITIAL_CLIMB',elapsedSec:60}).mode,'CLB');
 assert.equal(T.resolve({phase:'CRUISE'}).mode,'CRZ');
});
test('Only rendered inside EIS primary plate, not in the engine oil panel or EADI',()=>{
 const base=path.join(__dirname,'../panel-mosaic-lab/cockpit');
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(base,'thrust-mode-annunciator-v1.css'),'utf8');
 const js=fs.readFileSync(path.join(base,'thrust-mode-annunciator-v1.js'),'utf8');
 assert.ok(html.includes('thrust-mode-annunciator-v1.js'));
 assert.ok(css.includes('.texture-piece[data-piece="engine"]'));
 assert.ok(js.includes("dataset.engineIndication!=='CONVENTIONAL'"));
 assert.ok(!js.includes('B737McpAFDSBridgeV1?.command'));
});

test('Both EIS N1 PULL TO SET knobs occupy lower FF/FU sockets, not oil quantity',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/manual-n1-live-v1.js'),'utf8');
 assert.match(source,/const coords=conventional\?\[\[\.318,\.404\],\[\.412,\.404\]\]:\[\[\.125,\.890\],\[\.690,\.890\]\]/);
});
