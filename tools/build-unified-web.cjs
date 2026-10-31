'use strict';
// Share the verified desktop compiler; publish to a separate static tree.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {compile}=require('../desktop/build-runtime.cjs');
const ENTRY='panel-mosaic-lab/cockpit/index.html';
const OVERHEAD='panel-mosaic-lab/cockpit/overhead-stage.html';
const protectedName=/(?:irs|guard|owner|le-devices|conventional)/i;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
function revisioned(compiled,root,entry){
 const generated=new Map(compiled.bundles.map(b=>[b.path,b.content]));
 const source=fs.readFileSync(path.join(root,entry),'utf8');
 const baseMatch=source.match(/<base\s+href=(["'])([^"']+)\1/i);
 const doc=new URL('https://unified.invalid/'+entry),base=baseMatch?new URL(baseMatch[2],doc):doc;
 const html=compiled.html.replace(/<(?:script|link)\b[^>]*>/gi,tag=>{
  const match=tag.match(/\b(?:src|href)=(["'])([^"']+)\1/i);if(!match)return tag;
  const url=new URL(match[2],base),file=url.pathname.slice(1);
  if(url.origin!==base.origin||protectedName.test(file)||!/[.](?:js|css)$/.test(file))return tag;
  const bytes=generated.get(file)??fs.readFileSync(path.join(root,file));
  const relative=new URL(match[2],base);relative.searchParams.set('v','WEB-'+hash(bytes));
  const original=match[2].split(/[?#]/)[0];
  return tag.replace(match[2],original+relative.search+relative.hash);
 });
 return {...compiled,html,revision:hash(html)};
}
function prepare(root){
 const result=revisioned(compile(root),root,ENTRY);
 const overhead=revisioned(compile(root,OVERHEAD),root,OVERHEAD);
 return {...result,overhead};
}
function build(root,out=path.join(root,'web-dist')){
 root=path.resolve(root);out=path.resolve(out);
 if(out===root||!out.startsWith(root+path.sep))throw Error('Web output must be inside the checkout');
 const result=prepare(root);
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 // Only repository-owned files enter the public artifact, never caches,
 // installed dependencies, local fixtures or native packaging outputs.
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:8*1024*1024}).toString().split('\0').filter(Boolean);
 for(const file of files){
  if(file.startsWith('.')||file.startsWith('desktop/')||file.startsWith('web-dist/'))continue;
  const source=path.join(root,file),stat=fs.lstatSync(source);if(!stat.isFile())continue;
  const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
 }
 for(const b of [...result.bundles,...result.overhead.bundles]){
  const dest=path.join(out,b.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b.content);
 }
 fs.writeFileSync(path.join(out,ENTRY),result.html);
 fs.writeFileSync(path.join(out,OVERHEAD),result.overhead.html);
 // A/B experiment: same compiled Unified modules, separate URL, original entry untouched.
 const testEntry='panel-mosaic-lab/cockpit/unified-composite-test.html';
 const testStage='panel-mosaic-lab/cockpit/overhead-composite-stage.html';
 const testHTML=result.html.replace('</head>','<script>window.B737OverheadCompositeTest=true;</script></head>');
 if(testHTML===result.html)throw Error('Composite Unified injection failed');
 // Keep the approved embedded stage byte-identical; only publish a compiled test copy.
 const stageHTML=result.overhead.html.replace('</head>',
  '<link rel="stylesheet" href="../cockpit/overhead-composite-test.css?v=PERF-0004-COMPOSITE-TEST">'+
  '<script src="../cockpit/overhead-composite-test.js?v=PERF-0004-COMPOSITE-TEST" defer></script></head>');
 fs.writeFileSync(path.join(out,testEntry),testHTML);
 fs.writeFileSync(path.join(out,testStage),stageHTML);
 // PERF-0005 A/B: same composite image, avionics and simulator engines;
 // static lane hides only interactive *visual layers* in an isolated test stage.
 const staticEntry='panel-mosaic-lab/cockpit/unified-static-controls-test.html';
 const staticStage='panel-mosaic-lab/cockpit/overhead-static-controls-stage.html';
 const staticHTML=result.html.replace('</head>',
  '<script>window.B737OverheadStaticTest=true;window.B737OverheadCompositeTest=true;</script></head>');
 const staticStageHTML=stageHTML.replace('</head>',
  '<link rel="stylesheet" href="../cockpit/overhead-ab-static.css?v=AB-CONTROLS-0001">'+
  '<script>document.documentElement.dataset.overheadRenderAb="static";</script></head>');
 const fullStageHTML=stageHTML.replace('</head>',
  '<script>document.documentElement.dataset.overheadRenderAb="full";</script></head>');
 // Minimal identical on-device diagnostics (same cost in both lanes).
 const hud='<script src="./unified-ab-hud.js?v=AB-CONTROLS-0001" defer></script>';
 const iframeMetrics='<script src="../cockpit/overhead-ab-metrics.js?v=AB-CONTROLS-0001" defer></script>';
 fs.writeFileSync(path.join(out,testEntry),testHTML.replace('</head>',hud+'</head>'));
 fs.writeFileSync(path.join(out,testStage),fullStageHTML.replace('</head>',iframeMetrics+'</head>'));
 fs.writeFileSync(path.join(out,staticEntry),staticHTML.replace('</head>',hud+'</head>'));
 fs.writeFileSync(path.join(out,staticStage),staticStageHTML.replace('</head>',iframeMetrics+'</head>'));
 // PERF-0006: dedicated instrumentation pages; do not change live production,
 // existing A/B comparisons, approved panels, images or interaction engines.
 const diagnostic='<script>window.B737PerfDiagnosticV6=true;</script>'+
  '<script src="./perf-diagnostic-v6.js?v=PERF-0006" defer></script>';
 fs.writeFileSync(path.join(out,'panel-mosaic-lab/cockpit/unified-diagnostic-v6.html'),
  testHTML.replace('</head>',hud+diagnostic+'</head>'));
 fs.writeFileSync(path.join(out,'panel-mosaic-lab/cockpit/unified-diagnostic-static-v6.html'),
  staticHTML.replace('</head>',hud+diagnostic+'</head>'));
 // PERF-0010: same FULL compiled Unified, with exactly one substantial
 // iframe isolated per experiment. Production and approved panel art unchanged.
 // The matched PERF-0006 probe allows exact on-device fixed/pan comparisons.
 const noCDU='panel-mosaic-lab/cockpit/unified-no-cdu-v10.html';
 const lightOH='panel-mosaic-lab/cockpit/unified-light-overhead-v10.html';
 const flags=(name)=>'<script>window.B737PerfDiagnosticV6=true;window.'+name+'=true;</script>';
 const instrument='<script src="./perf-diagnostic-v6.js?v=PERF-0010" defer></script>';
 fs.writeFileSync(path.join(out,noCDU),testHTML.replace('</head>',
  flags('B737UnifiedNoCduTest')+instrument+'</head>'));
 fs.writeFileSync(path.join(out,lightOH),testHTML.replace('</head>',
  flags('B737UnifiedLightOverheadTest')+instrument+'</head>'));
 const manifest={schema:'b737-unified-web/1',revision:result.revision,requests:{before:result.before,after:result.after},generated:[...result.bundles,...result.overhead.bundles].map(b=>b.path),overhead:{revision:result.overhead.revision,requests:{before:result.overhead.before,after:result.overhead.after}}};
 fs.writeFileSync(path.join(out,'panel-mosaic-lab/cockpit/runtime-build.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'.nojekyll'),'');
 console.log('Unified web '+result.revision+': main '+result.before+' -> '+result.after+', overhead '+result.overhead.before+' -> '+result.overhead.after+' ordered scripts; owner mounts preserved');
 return manifest;
}
if(require.main===module)build(path.resolve(__dirname,'..'));
module.exports={prepare,build,ENTRY};
