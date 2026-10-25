'use strict';
/* The interactive page reuses the frozen atlas by <base href>, and redirects
 * to unified unless standalone=1. Guard both behaviors without copying stage.js.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('panel-mosaic-lab/interactive-overhead/index.html');
assert.match(html,/<base href="\.\.\/all-overhead\/">/,'Interactive page must resolve original atlas resources');
assert.match(html,/<script src="\.\/stage\.js\?/,'The stage script must resolve through the HTML base element');
assert.match(html,/get\("standalone"\)!=="1"/,'Default route is intentionally Unified; standalone opt-in must stay available');
assert.match(html,/location\.replace\(target\.href\)/,'Unified redirect must remain explicit');
for(const p of ['panel-mosaic-lab/all-overhead/stage.js','panel-mosaic-lab/all-overhead/spec.json','panel-mosaic-lab/all-overhead/atlas-layout.json','panel-mosaic-lab/upper-oh/geometry.json'])
 assert.ok(fs.existsSync(path.join(root,p)),'Missing approved original atlas path '+p);
console.log('PASS: interactive overhead intentionally redirects to Unified by default; standalone=1 retains original atlas via <base href>, with all resource paths present.');
