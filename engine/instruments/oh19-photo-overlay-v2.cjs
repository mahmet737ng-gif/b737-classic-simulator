#!/usr/bin/env node
/* Creates self-contained high-resolution, native-coordinate original-photo
 * overlays for a human pixel reviewer. NEVER approves geometry or changes
 * cockpit artwork. Relies on source SHA-256, not a public stock image. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {build}=require('./oh19-photo-evidence-v2.js');
const ticks=require('./oh19-native-ticks-batch1.json');
const photo=require('./oh19-cab-alt-photo-anchors-v1.json');
const preview=require('./stage10-preview-scale-subset-v1.json');
const report=build({ticks,photo,preview});
const root=path.resolve(__dirname,'../..');
const original=path.resolve(root,report.source.asset);
const out=path.resolve(root,'artifacts/oh19-pixel-qa');
if(!fs.existsSync(original))throw Error('OH19 locked photo missing; no fallback source allowed');
const bytes=fs.readFileSync(original);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==report.source.sha256)throw Error('OH19 original source hash changed');
if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||
   bytes.readUInt32BE(16)!==report.source.width||
   bytes.readUInt32BE(20)!==report.source.height)
 throw Error('OH19 source is not the documented original PNG dimensions');
const f=n=>Number(n).toFixed(2);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const sourceImage='data:image/png;base64,'+bytes.toString('base64');
function overlay(ring,filename){
 const inner=ring==='inner';
 const arr=report[ring],title=inner?
  'CABIN ALTITUDE — INNER RING':'DIFFERENTIAL PRESSURE — OUTER RING';
 const circles=arr.map(t=>{
   const p=t.point;
   const tint=inner?(t.class==='UNKNOWN_MINOR_VALUE'?'#ffc05a':'#29e5ff'):'#ed69eb';
   const label=inner?(t.anchorPreviewValueFt===null?'?':t.anchorPreviewValueFt+'ft'):'?psi';
   const toolLabel=esc('index '+t.index+'; '+label+'; geometry UNAPPROVED');
   return '<g><title>'+toolLabel+'</title>'+
     '<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r="6.25" fill="none" stroke="'+tint+'" stroke-width="1.25"/>'+
     '<path d="M '+f(p.x-3)+' '+f(p.y)+' L '+f(p.x+3)+' '+f(p.y)+' M '+
      f(p.x)+' '+f(p.y-3)+' L '+f(p.x)+' '+f(p.y+3)+'" stroke="'+tint+'" stroke-width="1.25"/>'+
     '<text x="'+f(p.x+7)+'" y="'+f(p.y-5)+'" fill="'+tint+
      '" font-family="monospace" font-size="8" paint-order="stroke" stroke="#111" stroke-width="1.3">'+
      t.index+'</text></g>';
 }).join('\n');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+
  report.source.width+' '+report.source.height+'" width="'+report.source.width*2+
  '" height="'+report.source.height*2+'">'+
  '<image href="'+sourceImage+'" x="0" y="0" width="'+report.source.width+
   '" height="'+report.source.height+'"/>'+
  '<g>'+circles+'</g>'+
  '<g><circle cx="'+report.pivotCandidate.x+'" cy="'+report.pivotCandidate.y+
   '" r="12" fill="none" stroke="#ff5050" stroke-width="2" stroke-dasharray="3 3"/>'+
  '<path d="M '+(report.pivotCandidate.x-12)+' '+report.pivotCandidate.y+' H '+
   (report.pivotCandidate.x+12)+' M '+report.pivotCandidate.x+' '+
   (report.pivotCandidate.y-12)+' V '+(report.pivotCandidate.y+12)+
   '" stroke="#ff5050" stroke-width="1"/></g>'+
  '<rect x="12" y="12" width="1070" height="58" rx="6" fill="#080d1b" fill-opacity="0.93"/>'+
  '<text x="25" y="32" fill="#fff" font-size="19" font-family="Arial" font-weight="bold">'+title+'</text>'+
  '<text x="25" y="51" fill="#ffbf4a" font-size="13" font-family="Arial">'+
  'SOURCE PIXEL CANDIDATES ONLY; RED PIVOT UNVERIFIED; NO LIVE NEEDLE RELEASE</text>'+
  '<rect x="12" y="'+(report.source.height-42)+'" width="990" height="30" fill="#080d1b" fill-opacity="0.93"/>'+
  '<text x="22" y="'+(report.source.height-22)+'" fill="#fff" font-family="Arial" font-size="12">'+
   (inner?'Cyan: 15 preview anchors   Amber: 32 values unresolved':
    'Purple: 51 outer-stroke candidates; numeric labels still require review')+
   ' — original SHA-256 verified</text></svg>';
 fs.writeFileSync(path.join(out,filename),svg,'utf8');
}
fs.mkdirSync(out,{recursive:true});
overlay('inner','OH19_CAB_ALT_SOURCE_CANDIDATES.svg');
overlay('outer','OH19_DIFF_PRESS_SOURCE_CANDIDATES.svg');
fs.writeFileSync(path.join(out,'OH19_PIXEL_EVIDENCE_REPORT.json'),
 JSON.stringify({...report,sourceImageHashVerified:true,
   artifactNature:'SELF_CONTAINED_SOURCE_IMAGE_OVERLAY_NO_PIXEL_SIGNOFF'},null,2)+'\n');
console.log('OH19 original SHA-256:',sha);
console.log('OH19 original dimensions:',report.source.width,report.source.height);
console.log('INNER:',report.counts.inner,' OUTER:',report.counts.outer,
 'Unclassified CAB ALT values:',report.counts.innerUnclassifiedMinorValues);
console.log('Release approved:',report.counts.operationalApproved);
console.log('Review-only original-image overlays written to',out);
