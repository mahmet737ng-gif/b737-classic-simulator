'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const Model=require('../panel-mosaic-lab/cockpit/flap-lever-model');
const read=path=>fs.readFileSync(path,'utf8');

test('physical flap gates require actual detent 1, then 15, then 30',()=>{
  let detent=0;
  const achieved=[];
  for(let attempt=0;attempt<3;attempt++){
    const travel=Model.sequence(detent,30);
    detent=travel.at(-1);
    achieved.push(detent);
  }
  assert.deepEqual(achieved,[1,15,30],
    'Never persist a requested 30 as an actual 30 while mechanical gates intervene');
});

test('crew replication sends physical settled Flap detent and suppresses echo from replay',()=>{
  const lever=read(path.join(root,'panel-mosaic-lab/cockpit/flap-lever-test.js'));
  const crew=read(path.join(root,'panel-mosaic-lab/cockpit/crew-cockpit-v1.js'));
  assert.match(lever,/b737:flap-lever-settled/);
  assert.match(lever,/detent:position,requested:Number\(target\),crewReplay/);
  assert.match(crew,/b737:flap-lever-settled/);
  assert.match(crew,/if \(!d\.crewReplay\) command\('flap','flap',d\.detent\)/);
  assert.match(crew,/B737FlapVisualTest\.request\(value,\{crewReplay:true\}\)/);
  assert.match(crew,/case 'flap': return win\.B737FlapVisualTest\.request/);
});
