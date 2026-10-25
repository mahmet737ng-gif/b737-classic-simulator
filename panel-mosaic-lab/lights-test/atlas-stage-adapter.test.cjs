'use strict';
/* The live interactive overhead stage must not request nonexistent ./spec.json or ./atlas-layout.json. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const engine=read('panel-mosaic-lab/all-overhead/stage.js');
const adapter=read('panel-mosaic-lab/interactive-overhead/stage.js');
const html=read('panel-mosaic-lab/interactive-overhead/index.html');
assert.match(html,/<script src="\.\/stage\.js\?/,'The interactive page must load the actual stage adapter');
const pure=adapter.slice(adapter.indexOf("'use strict';"));
assert.equal(pure,engine.replace("fetch('./spec.json?ts='","fetch('../all-overhead/spec.json?ts='").replace("fetch('./atlas-layout.json?ts='","fetch('../all-overhead/atlas-layout.json?ts='"),'The interactive stage adapter must match the source atlas engine apart from its two location-specific fetch paths');
for(const p of ['panel-mosaic-lab/all-overhead/spec.json','panel-mosaic-lab/all-overhead/atlas-layout.json','panel-mosaic-lab/upper-oh/geometry.json'])
 assert.ok(fs.existsSync(path.join(root,p)),'Missing photo-stage config: '+p);
console.log('PASS: interactive overhead stage script exists; both atlas configuration URLs resolve; approved atlas algorithm and immutable image mapping preserved.');
