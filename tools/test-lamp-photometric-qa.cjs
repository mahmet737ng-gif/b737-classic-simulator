'use strict';
/* Render-derived, reference-agnostic optical QA. Report brightness, chroma,
 * relative DIM/BRIGHT and small-screen letter energy. Never claim aircraft
 * photometric certification from browser pixels. Do not mutate source files.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const OUT='/tmp/b737-lamp-photometric-qa';
fs.mkdirSync(OUT,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const oh=read('panel-mosaic-lab/interactive-overhead/lights.json'),main=read('panel-mosaic-lab/cockpit/lights.json');
const oi=read('panel-mosaic-lab/interactive-overhead/instance-faces.json');
const mi=read('panel-mosaic-lab/cockpit/instance-faces.json');
const face14=read('panel-mosaic-lab/lights-test/oh22-profile-faces-v1.json');
const additional=[
 ...face14.files.map(f=>({id:f.system+'-'+f.lamp,asset:f.asset,state:f.state,
  source:'../'+f.file.replace('panel-mosaic-lab/',''),kind:'oh22-'+f.system})),
 ...['OFF','ON'].map(state=>({id:'737400-pack',asset:'PACK',state,kind:'737400-oh21',
  source:'../assets/737-400-PACK_FITTED_'+state+'.svg'}))
];
const fixtures=[];
for(const [kind,reg,overrides] of [['oh',oh,oi],['main',main,mi]]){
 for(const lamp of reg.lights){
  const states=overrides.instances[lamp.id]?.states||reg.assets[lamp.asset];
  if(!states)throw Error('Missing optical state '+lamp.id);
  for(const [state,f] of Object.entries(states)){
   fixtures.push({id:lamp.id,asset:lamp.asset,state,kind,source:f.url,photoROI:lamp.sourceRect});
  }
 }
}
for(const f of additional)fixtures.push(f);
const [total,three]=[fixtures.length,oh.lights.filter(l=>Object.keys(oh.assets[l.asset]).includes('DIM_BLUE')).length];
assert.equal(three,7);assert.ok(total>=300);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/',{waitUntil:'domcontentloaded',timeout:60000});
  const result=await page.evaluate(async jobs=>{
   const cache=new Map(),rows=[];
   function lumi(r,g,b){
    const c=v=>{let x=v/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};
    return .2126*c(r)+.7152*c(g)+.0722*c(b);
   }
   async function load(url){
    if(cache.has(url))return cache.get(url);
    const img=new Image();img.src=url;await img.decode();cache.set(url,img);return img;
   }
   for(const job of jobs){
    const base=job.kind==='oh'?'../interactive-overhead/lights.json':
      job.kind==='main'?'./lights.json':'./pressurization-oh22.js';
    const url=new URL(job.source,new URL(base,location.href)).href;
    try{
     const image=await load(url);
     const w=128,h=64,canvas=document.createElement('canvas');
     canvas.width=w;canvas.height=h;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});
     // Normalized source face. No CSS gamma hack.
     ctx.drawImage(image,0,0,w,h);
     const rgba=ctx.getImageData(0,0,w,h).data;
     const values=[],blue=[],rgbEnergy=[];
     let totalL=0,high=0,localContrast=0,cyanBlue=0;
     // Count only central 90% of the lamp face to exclude photographic bezels.
     for(let y=3;y<h-3;y++)for(let x=4;x<w-4;x++){
      let i=(y*w+x)*4,r=rgba[i],g=rgba[i+1],b=rgba[i+2];
      const l=lumi(r,g,b);values.push(l);totalL+=l;
      if(l>.18)high++;
      blue.push(Math.max(0,b-(r+g)/2)/255);
      rgbEnergy.push([r,g,b]);
     }
     values.sort((a,b)=>a-b);
     let bg=values[Math.floor(values.length*.12)]||0;
     let foreground=values[Math.floor(values.length*.98)]||0;
     let p90=values[Math.floor(values.length*.90)]||0;
     let energy=0,power=0,highContrastPixels=0;
     for(let i=0;i<values.length;i++){
      const d=Math.max(0,values[i]-bg);
      energy+=d;
      power+=d*d;
      if(d>.08)highContrastPixels++;
     }
     rows.push({id:job.id,asset:job.asset,state:job.state,kind:job.kind,
       width:image.naturalWidth,height:image.naturalHeight,
       source:job.source,photoROI:job.photoROI||null,
       metrics:{background:+bg.toFixed(5),p90:+p90.toFixed(5),
         p98:+foreground.toFixed(5),highlightEnergy:+(energy/values.length).toFixed(6),
         highlightPower:+(power/values.length).toFixed(6),
         signalPixels:highContrastPixels,pixelCount:values.length,
         meanLuma:+(totalL/values.length).toFixed(6),
         blueExcess:+(blue.reduce((a,b)=>a+b,0)/blue.length).toFixed(6)}});
    }catch(e){rows.push({id:job.id,asset:job.asset,state:job.state,kind:job.kind,error:String(e),source:job.source})}
   }
   return rows;
  },fixtures);
  const grouped=new Map(),faults=[],ambiguous=[];
  for(const r of result){
   const key=r.kind+'/'+r.id;
   if(!grouped.has(key))grouped.set(key,{});
   grouped.get(key)[r.state]=r;
   if(r.error)faults.push({id:r.id,state:r.state,error:r.error});
  }
  const stats={mounted:142,evaluated:result.length,threeStateBlue:three,failures:[],warnings:[],ratios:[]};
  for(const [key,states] of grouped){
   const off=states.OFF?.metrics;
   if(!off)continue;
   const on=states.ON?.metrics||states.BRIGHT_BLUE?.metrics;
   if(!on)continue;
   const ratio=on.highlightEnergy/Math.max(.0001,off.highlightEnergy);
   stats.ratios.push({id:key,onToOff:+ratio.toFixed(3),off:+off.highlightEnergy.toFixed(5),
                     on:+on.highlightEnergy.toFixed(5)});
   if(ratio<1.12)stats.failures.push({type:'ON_NOT_VISIBLY_BRIGHTER',id:key,ratio});
   else if(ratio<1.7)stats.warnings.push({type:'WEAK_ON_OFF_CONTRAST',id:key,ratio});
   if(states.DIM_BLUE?.metrics&&states.BRIGHT_BLUE?.metrics){
    const dim=states.DIM_BLUE.metrics,bright=states.BRIGHT_BLUE.metrics;
    const r=bright.highlightEnergy/Math.max(.0001,dim.highlightEnergy);
    stats.ratios.at(-1).brightToDim=+r.toFixed(3);
    if(r<1.07)stats.failures.push({type:'BRIGHT_BLUE_NOT_STRONGER_THAN_DIM_BLUE',id:key,ratio:r});
   }
  }
  stats.failures.push(...faults.map(x=>({type:'ASSET_DECODE_FAILED',...x})));
  const p=path.join(OUT,'measurements.json');
  fs.writeFileSync(p,JSON.stringify({schema:'b737.lamp.optical-browser-baseline.v1',
   date:'2026-10-26',note:'Browser-normalized pixels, not aircraft-certified brightness; p98 highlight and energy measured in linear-light sRGB.',stats,rows:result},null,2)+'\n');
  console.log('PHOTOMETRIC_QA_SUMMARY',JSON.stringify({mounted:stats.mounted,states:result.length,decodeFailed:faults.length,
    failures:stats.failures.length,warnings:stats.warnings.length,threeStateBlue:three,
    worst:stats.ratios.sort((a,b)=>a.onToOff-b.onToOff).slice(0,18)}));
  for(const x of stats.failures)console.log('PHOTOMETRIC_QA_FAILURE',JSON.stringify(x));
  for(const x of stats.warnings.slice(0,30))console.log('PHOTOMETRIC_QA_WARNING',JSON.stringify(x));
  if(stats.failures.length){process.exitCode=1}
 }finally{await browser.close()}
})().catch(e=>{console.error('PHOTOMETRIC_QA_EXCEPTION',e.stack||String(e));process.exitCode=1});
