'use strict';
/* Small-font optical remediation, performed ONLY on unlocked derived SVG files.
 * Exact legend text and ON/OFF color, original panel photos, control position and
 * source-catalog lamp SVGs remain immutable. No physical position correction here.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),REL="panel-mosaic-lab/assets/lights/readability-v1";
const out=path.join(ROOT,REL);fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const registry={
 overhead:read('panel-mosaic-lab/interactive-overhead/lights.json'),
 main:read('panel-mosaic-lab/cockpit/lights.json')
};
const other={
 overhead:read('panel-mosaic-lab/interactive-overhead/instance-faces.json'),
 main:read('panel-mosaic-lab/cockpit/instance-faces.json')
};
const target={
 'flight-recorder-off':{scope:'overhead',size:{"OFF":236,"ON":236},baseline:238},
 'irs-l-align':{scope:'overhead',size:{"OFF":190,"ON":190},baseline:216},
 'irs-r-align':{scope:'overhead',size:{"OFF":190,"ON":190},baseline:216},
 'main-stab-trim':{scope:'main',wordSizes:{STAB:103,'OUT OF':74,TRIM:103},wordBaselines:{STAB:100,'OUT OF':187,TRIM:283}},
 'main-antiskid':{scope:'main',wordSizes:{'ANTI SKID':128,INOP:158},wordBaselines:{'ANTI SKID':144,INOP:278}},
 'main-at-lim':{scope:'main',size:{"OFF":162,"ON":162},baseline:216,resize:[82,35,702.857143,300,51.428571]}
};
function textContent(svg){return [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map(m=>m[1])}
function fit(file,spec,state){
 let output=file;
 if(spec.resize){
  const [w,h,vw,vh,dx]=spec.resize;
  const m=output.match(/^<svg\b[^>]*>/);
  assert.ok(m,'Source SVG root');
  const newHead=m[0].replace(/width="[\d.]+"/,'width="'+w+'"').replace(/height="[\d.]+"/,'height="'+h+'"')
    .replace(/viewBox="0 0 [\d.]+ [\d.]+"/,'viewBox="0 0 '+vw.toFixed(6)+' '+vh+'"');
  output=output.replace(m[0],newHead);
  const bg=output.match(/<rect width="[\d.]+" height="[\d.]+" fill="(#[0-9a-fA-F]+)"\/>/);
  if(!bg)throw Error('No original dark backing');
  const repl='<rect width="'+vw.toFixed(6)+'" height="'+vh+'" fill="'+bg[1]+'"/>';
  output=output.replace(bg[0],repl);
  const i=output.indexOf(repl)+repl.length;
  output=output.slice(0,i)+'\n<g transform="translate('+dx.toFixed(6)+' 0)" data-fit="nonstretched-legends">'+output.slice(i);
  output=output.replace('</svg>','</g>\n</svg>');
 }
 let count=0;
 output=output.replace(/<text\b[^>]*>.*?<\/text>/gs,m=>{
  const key=m.match(/>(.*?)<\/text>/s)?.[1];if(!key)throw Error('Missing text contents');
  let size=spec.wordSizes?.[key]||spec.size?.[state];
  let y=spec.wordBaselines?.[key]??spec.baseline;
  if(!size||!y)throw Error('Unknown target legend '+key);
  let next=m.replace(/\bfont-size="[\d.]+"/,'font-size="'+size+'"').replace(/\by="[\d.]+"/,'y="'+y+'"');
  if(next===m)throw Error('Font size unchanged '+key);
  count++;return next;
 });
 if(count<1)throw Error('No font elements changed');
 if(JSON.stringify(textContent(output))!==JSON.stringify(textContent(file)))throw Error('Changed FAA/737 annunciator legend text');
 if(/transform="scale\(/.test(output))throw Error('Nonuniform source scaling introduced');
 return output;
}
const manifest={schema:'b737.lamps.readability-derivatives.v1',date:'2026-10-26',originalPhotoChanges:0,
  originalArtworkChanges:0,states:[],status:'SMALL_SCALE_COMPARISON_REQUIRED'};
for(const [scope,reg] of Object.entries(registry)){
 const overrides={schema:'b737.lamps.readability-face-overrides.v1',revision:'READABILITY-0001',sourceRegistrationVersion:reg.version,instances:{}};
 for(const [id,spec] of Object.entries(target)){
  if(scope!==spec.scope)continue;
  const lamp=reg.lights.find(l=>l.id===id);assert.ok(lamp,id);
  const base=other[scope].instances[id]?.states||reg.assets[lamp.asset];
  const states={};
  for(const [state,record]of Object.entries(base)){
   const src=(path.resolve(ROOT,'panel-mosaic-lab',scope==='main'?'cockpit':'interactive-overhead',record.url));
   const original=fs.readFileSync(src,'utf8');
   assert.equal(sha(original),record.sha256,id+' input digest');
   const fitted=fit(original,spec,state);
   const name=id+'_'+state+'.svg',dest=path.join(out,name);
   if(fs.existsSync(dest)&&fs.readFileSync(dest,'utf8')!==fitted)throw Error('Conflicting output exists '+dest);
   fs.writeFileSync(dest,fitted);
   const url='../assets/lights/readability-v1/'+name,h=sha(fitted);
   states[state]={url,sha256:h};
   manifest.states.push({scope,id,asset:lamp.asset,state,sourceRect:lamp.sourceRect,
    originalSource:path.relative(ROOT,src),originalSha256:record.sha256,
    derived:REL+'/'+name,derivedSha256:h,legend:textContent(fitted),
    geometryChanged:false,readabilityStatus:'QA_REQUIRED'});
  }
  overrides.instances[id]={asset:lamp.asset,sourceRect:lamp.sourceRect,states};
 }
 fs.writeFileSync(path.join(ROOT,'panel-mosaic-lab',scope==='main'?'cockpit':'interactive-overhead','readability-faces.json'),
   JSON.stringify(overrides,null,2)+'\n');
}
assert.equal(manifest.states.length,12);
fs.writeFileSync(path.join(ROOT,'panel-mosaic-lab/lights-test/readability-derivatives-v1.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('READABILITY_BUILD_SUCCESS',JSON.stringify({lamps:Object.keys(target).length,states:manifest.states.length,lockedChanges:0}));
