'use strict';
/* PERF-0009: progressive REAL Overhead frontend bottleneck isolation.
 * This deliberately uses the original approved cockpit/overhead-stage.html
 * plus original physical switch/guard renderers. NO original source change.
 * F: native runtime/frontend and exact approved lamp faces (no backend)
 * G: F + event-driven lamp face updates (NOT Boeing annunciator logic)
 * H: G + V7 electrical and existing training interpolation kernels
 * I: refer to original compiled complete Unified (existing route).
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../');
const out=path.join(root,'web-dist/panel-mosaic-lab/cockpit');
const input=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/overhead-stage.html'),'utf8');
const whitelist=[
'../cockpit/performance/manifest.js',
'../cockpit/performance-loader.js',
'../cockpit/performance/overhead-renderer.js',
'../interactive-overhead/model.js',
'../interactive-overhead/app.js',
'../../flight-controls-panel/fcom-control-mechanics.js',
'../../engine/interaction/rotary-motion-rm0002.js',
'../interactive-overhead/rotary-guards-model.js',
'../interactive-overhead/rotary-guards.js',
'../cockpit/guard-close-policy-v2.js',
'../cockpit/guard-owner18-v1.js'
];
function build(){
 assert.ok(fs.existsSync(path.join(out,'assets/overhead-composite-test.webp')),'PERF-0004 approved 2220x3312 WebP must exist before PERF-0009 stage export');
 const allowed=new Set(whitelist);
 const withoutBackends=input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>{
  const src=tag.match(/\bsrc=["']([^"']+)/i)?.[1]?.split('?')[0];
  return src&&allowed.has(src)?tag:'';
 });
 assert.equal((withoutBackends.match(/<script\b/gi)||[]).length,whitelist.length,'Only approved presentation scripts may remain in F');
 for(const kind of ['F','G','H']){
  let html=withoutBackends.replace('B737 Classic — Embedded Overhead — CKP-0003','PERF-0009 '+kind+' — Actual Overhead Frontend');
  html=html.replace('</head>',
   '<link rel="stylesheet" href="../cockpit/overhead-composite-test.css?v=PERF-0009">'+
   '<link rel="stylesheet" href="../cockpit/overhead-real-v9.css?v=PERF-0009">'+
   '<script>document.documentElement.dataset.perf9Stage="'+kind+'";</script>'+
   '<script src="../cockpit/overhead-composite-test.js?v=PERF-0009" defer></script>'+
   '</head>');
  if(kind==='H')html=html.replace('</body>',
   '<script src="../../engine/systems/electrical-v7.js?v=PERF-0009" defer></script>'+
   '<script src="../../engine/integration/isn-engine-start-dynamics-v1.js?v=PERF-0009" defer></script>'+
   '<script src="../../engine/integration/isn-apu-load-dynamics-v1.js?v=PERF-0009" defer></script></body>');
  html=html.replace('</body>','<script src="../cockpit/overhead-real-v9.js?v=PERF-0009" defer></script></body>');
  const count=(html.match(/<script\b/gi)||[]).length;
  if(kind==='F')assert.equal(count,14,'F includes 11 approved controls/renderer, image shim, runner, metadata only');
  if(kind==='G')assert.equal(count,14,'G differs only in event response mode');
  if(kind==='H')assert.equal(count,17,'H adds ONLY 3 source-backed simulator kernels');
  const pathToFile=path.join(out,'overhead-real-'+kind.toLowerCase()+'-v9.html');
  fs.writeFileSync(pathToFile,html);
 }
 fs.writeFileSync(path.join(out,'overhead-real-v9-meta.json'),JSON.stringify({
  schema:'PERF-0009/real-overhead-A-B/1',
  lanes:{F:'original control frontend + physical source image lamp faces, NO backend',
   G:'F + event-driven display updates, no electrical simulation',
   H:'G + source-backed Electrical V7 and training interpolation kernels',
   I:'existing complete Unified diagnostic route; not isolated from other panels'},
  expectedControls:{toggles:59,rotaries:20,overheadOwnerGuards:13,lamps:112},
  immutableSources:true, approvedOriginalStageUnmodified:true
 },null,2)+'\n');
 console.log('PERF-0009 original frontend F/G/H isolated pages generated');
}
if(require.main===module)build();
module.exports={build};
