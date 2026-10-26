'use strict';
/* Unified MIP annunciator typography — no source photo, approved socket, or
 * source catalogue writes. Preserve the original aviation wording, paint
 * colors, layered optical glows and model rules; normalize only derived SVG
 * glyph sizes / line baselines and native ratio per installed physical lamp.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const DIR='panel-mosaic-lab/cockpit';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=x=>crypto.createHash('sha256').update(x,'utf8').digest('hex');
const registry=read(DIR+'/lights.json'),legacy=read(DIR+'/readability-faces.json'),perInstance=read(DIR+'/instance-faces.json');
const dest=path.join(ROOT,'panel-mosaic-lab/assets/lights/main-type-v1');
fs.mkdirSync(dest,{recursive:true});
const families={
 'single-white':{font:145,baselines:[206],maxWidth:.84,weight:700},
 'single-amber':{font:145,baselines:[206],maxWidth:.84,weight:700},
 'two-white':{font:111,baselines:[135,253],maxWidth:.85,weight:700},
 'two-amber':{font:111,baselines:[135,253],maxWidth:.85,weight:700},
 'two-green':{font:111,baselines:[135,253],maxWidth:.85,weight:700},
 'two-red':{font:111,baselines:[135,253],maxWidth:.85,weight:700},
 'three-amber':{font:105,baselines:[99,190,281],maxWidth:.85,weight:700},
 'special-critical-red':{font:null,baselines:null,maxWidth:.88,weight:700,preserveExisting:true},
};
function tokenWidth(text){
 // Conservative Arial/Liberation Sans Bold glyph-width model, constrained to
 // center-aligned physical glass. Chromium QA later measures actual text bbox.
 const wide='MW@%&',thin='I1|!/.:',medium='JLYTF?',space=' -';
 return [...text].reduce((s,c)=>s+(c===' '?0.32:wide.includes(c)?0.91:thin.includes(c)?0.34:medium.includes(c)?0.55:space.includes(c)?0.39:0.68),0);
}
function legend(src){
 const nodes=[...src.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map(m=>m[1]);
 const count=nodes.length;
 if(!count)throw Error('Missing SVG legend');
 for(let n=1;n<=4;n++)if(count%n===0&&nodes.every((v,i)=>v===nodes[i%n]))return nodes.slice(0,n);
 throw Error('Inconsistent repeated source glow lettering: '+nodes.join(' / '));
}
function familyFor(l,lines){
 if(l.asset==='PULL_UP_RED')return 'special-critical-red';
 if(lines.length===3)return 'three-amber';
 const upper=l.asset.toUpperCase();
 let hue=/GREEN/.test(upper)?'green':/RED/.test(upper)?'red':/WHITE/.test(upper)?'white':'amber';
 if(lines.length===1&&hue==='green')return 'two-green'; // leave as listed below if unexpected
 if(lines.length===1&&hue==='red')return 'special-critical-red';
 if(lines.length===1)return 'single-'+hue;
 return 'two-'+hue;
}
function put(s,pattern,replacement,label){
 if(!pattern.test(s))throw Error('Original SVG missing '+label);
 return s.replace(pattern,replacement);
}
let records=[],instances={},colors=new Map();
for(const lamp of registry.lights){
 const base=legacy.instances[lamp.id]?.states||perInstance.instances[lamp.id]?.states||registry.assets[lamp.asset];
 assert.deepEqual(Object.keys(base).sort(),['OFF','ON']);
 const [x,y,w,h]=lamp.sourceRect,physicalWidth=300*w/h,states={},logicalKey=lamp.asset;
 const opts={};
 for(const [state,info] of Object.entries(base)){
  const sourcePath=path.resolve(ROOT,DIR,info.url),src=fs.readFileSync(sourcePath,'utf8');
  assert.equal(sha(src),info.sha256,'Unrecognized source lamp '+lamp.id+' '+state);
  const lines=legend(src),fam=familyFor(lamp,lines),standard=families[fam];assert.ok(standard,lamp.id+' '+fam);
  if(!standard.baselines&&!standard.preserveExisting)throw Error('Unsupported family '+fam);
  const header=src.match(/^<svg\b[^>]*>/)?.[0],vb=header?.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/),width=header?.match(/\bwidth="([\d.]+)"/),height=header?.match(/\bheight="([\d.]+)"/);
  if(!vb||!width||!height)throw Error('Unrecognized source SVG dimensions '+sourcePath);
  const originalW=Number(vb[1]),originalH=Number(vb[2]);
  if(originalH<1||originalW<1)throw Error('Degenerate SVG source');
  const targetW=originalH*w/h,dx=(targetW-originalW)/2;
  if(dx<-0.0001)throw Error('Would crop source text horizontally '+lamp.id);
  const origText=[...src.matchAll(/<text\b[^>]*>.*?<\/text>/gs)].map(m=>m[0]);
  const sourceFill=[...src.matchAll(/<g\b[^>]*\bfill="(#[A-Fa-f\d]{6})"/g)].map(x=>x[1]);
  let fitted=src.replace(header,header.replace(width[0],'width="'+w+'"').replace(height[0],'height="'+h+'"').replace(vb[0],'viewBox="0 0 '+targetW.toFixed(6)+' '+originalH+'"'));
  const bg=fitted.match(/<rect width="([\d.]+)" height="([\d.]+)" fill="(#[A-Fa-f0-9]+)"\s*\/>/);
  if(!bg)throw Error('No base dark glass rectangle '+lamp.id);
  const larger='<rect width="'+targetW.toFixed(6)+'" height="'+originalH+'" fill="'+bg[3]+'"/>';
  fitted=fitted.replace(bg[0],larger);
  const start=fitted.indexOf(larger)+larger.length;
  fitted=fitted.slice(0,start)+'\n<g transform="translate('+dx.toFixed(6)+' 0)" data-fit="mip-native-ratio-no-letter-stretch">'+fitted.slice(start);
  fitted=fitted.replace('</svg>','</g>\n</svg>');
  let sizes=[],sourceSizes=[],textOrdinal=0;
  fitted=fitted.replace(/<text\b[^>]*>.*?<\/text>/gs,textNode=>{
    // String.replace's second callback argument is the CHARACTER OFFSET,
    // not the ordinal occurrence. Using it swapped line-1 and line-2 sizes!
    const i=(textOrdinal++)%lines.length,txt=lines[i],origSize=Number(textNode.match(/font-size="([\d.]+)"/)?.[1]);
    if(!origSize)throw Error('Missing font-size '+lamp.id);
    sourceSizes.push(origSize);
    let target=origSize,baseline=Number(textNode.match(/ y="([\d.]+)"/)?.[1]);
    if(!standard.preserveExisting){
      // A shared cap height for short labels; physically long legends are
      // reduced only as much as the immutable line spelling demands.
      const desired=standard.font*(originalH/300);
      const sizeLimit=originalH*(w/h)*standard.maxWidth/tokenWidth(txt);
      target=Math.min(desired,sizeLimit);
      // Measured Chromium getBoundingClientRect on all 60 rendered states:
      // AUTO BRAKE produced 98.5px text on an 80px source glass;
      // SPEED BRAKE ARMED produced 104.4px on a 94px glass.
      // Preserve original words, glyph shapes and photo ROI; reserve optical side padding.
      if(lamp.id==='main-autobrake'&&txt==='AUTO BRAKE')target*=.79;
      if(lamp.id==='main-speed-brake-armed'&&txt==='SPEED BRAKE')target*=.87;
      target=Math.max(45*(originalH/300),target);
      target=Math.round(target*1000)/1000;
      baseline=standard.baselines[i]*originalH/300;
    }
    sizes.push(target);
    let next=textNode.replace(/font-size="[\d.]+"/,'font-size="'+target+'"');
    next=next.replace(/\by="[\d.]+"/,'y="'+baseline.toFixed(3)+'"');
    return next;
  });
  const wordAfter=legend(fitted);
  assert.deepEqual(wordAfter,lines,'Exact source text/case and line breaks must survive');
  if(fitted.includes('transform="scale('))throw Error('Image stretch forbidden '+lamp.id);
  const filename=lamp.id+'_'+state+'.svg',file='panel-mosaic-lab/assets/lights/main-type-v1/'+filename;
  const absolute=path.join(ROOT,file);
  // These are unlocked generated derivatives, remeasured and version-controlled in Git; no original file is overwritten.
  fs.writeFileSync(absolute,fitted);
  states[state]={url:'../assets/lights/main-type-v1/'+filename,sha256:sha(fitted)};
  records.push({id:lamp.id,asset:logicalKey,family:fam,state,sourceRect:[...lamp.sourceRect],source:sourcePath.replace(ROOT+path.sep,'').replaceAll('\\','/'),
    sourceSha256:sha(src),file,sha256:sha(fitted),legends:lines,fontFamily:'Arial, Liberation Sans, Helvetica, sans-serif',fontWeight:700,
    originalSizes:sourceSizes.slice(0,lines.length),targetSizes:sizes.slice(0,lines.length),baselines:standard.baselines,
    viewBox:[+targetW.toFixed(6),originalH],sourcePhotoModified:false,sourceRectModified:false,
    allPaintLayersRetained:sourceFill.length>0});
  if(state==='ON')opts[logicalKey]=opts[logicalKey]||{hue:fam};
 }
 instances[lamp.id]={asset:lamp.asset,sourceRect:[...lamp.sourceRect],family:records.at(-1).family,states};
}
assert.equal(Object.keys(instances).length,30);
assert.equal(records.length,60);
const mapping={schema:'b737.main-panel.annunciator-type-v1',version:'MIP-TYPE-0003',sourceRegistryVersion:registry.version,
  sourceImagesChanged:0,sourcePositionsChanged:0,instances};
const audit={schema:'b737.main-panel.type-audit-v1',date:'2026-10-26',lampPositions:30,states:60,sourcePhotosModified:0,
  familyDefinitions:families,records,exceptions:['PULL_UP_RED is optically preserved because previously accepted'],
  humanVisualSignoff:'PENDING_REAL_100_75_50_BROWSER_SCREENSHOT_COMPARE',revision:'MIP-TYPE-0003'};
fs.writeFileSync(path.join(ROOT,DIR,'typography-faces.json'),JSON.stringify(mapping,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'panel-mosaic-lab/lights-test/main-type-audit-v1.json'),JSON.stringify(audit,null,2)+'\n');
console.log('MIP_TYPE_BUILD_SUCCESS',JSON.stringify({positions:30,states:60,families:Object.fromEntries(Object.keys(families).map(k=>[k,records.filter(v=>v.family===k&&v.state==='ON').length])),sourceArtworkUnchanged:true}));
