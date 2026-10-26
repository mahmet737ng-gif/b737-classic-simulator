'use strict';
/* Human-review contact sheets: no artificial lamp RGB/opacity modification.
 * The same real mounted ON/OFF/DIM SVGs are sampled at 50% and 33% of their
 * photographic source aperture dimensions, allowing glyph-size evaluation.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const get=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const oh=get('panel-mosaic-lab/interactive-overhead/lights.json');
const main=get('panel-mosaic-lab/cockpit/lights.json');
const ohFits=get('panel-mosaic-lab/interactive-overhead/instance-faces.json');
const mainFits=get('panel-mosaic-lab/cockpit/instance-faces.json');
const selections=[
 'flight-recorder-off','irs-l-align','wing-valve-l','cowl-valve-1',
 'fuel-valve-closed-1','ground-power-available','ram-door-r','window-l-fwd-on',
 'main-pull-up-captain','main-at-lim','main-stab-trim','main-antiskid'];
const data=selections.map(id=>{
 const scope=id.startsWith('main-')?'main':'overhead';
 const reg=scope==='main'?main:oh,fit=scope==='main'?mainFits:ohFits;
 const lamp=reg.lights.find(x=>x.id===id);assert.ok(lamp,id);
 const frames=fit.instances[id]?.states||reg.assets[lamp.asset];
 const states=Object.keys(frames);
 return {id,scope,sourceRect:lamp.sourceRect,
   frames:states.map(state=>({state,url:frames[state].url}))};
});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const out='/tmp/b737-lamp-photometric-qa';fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1320,height:1080},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/',{waitUntil:'domcontentloaded'});
  const responses=[];
  for(const multiplier of [.5,.33]){
   const result=await page.evaluate(async ({data,multiplier})=>{
    document.body.replaceChildren();
    document.documentElement.style.cssText='background:#121920;color:#f2f4f8';
    document.body.style.cssText='margin:0;padding:15px 22px;background:#121920;color:#f2f4f8;font:14px/1.4 system-ui';
    const title=document.createElement('h2');
    title.textContent='B737 lamp optical review — '+Math.round(multiplier*100)+'% of photographic source size — source SVG color unchanged';
    title.style.cssText='font-size:17px;font-weight:700;margin:0 0 15px';
    document.body.append(title);
    const results=[];
    for(const d of data){
     const row=document.createElement('section');row.style.cssText='display:flex;gap:12px;align-items:center;min-height:62px;padding:6px;border-bottom:1px solid #344350';
     const label=document.createElement('div');label.textContent=d.id+'  ('+d.scope+')';
     label.style.cssText='font-size:12px;width:210px;flex:none;font-family:monospace;color:#c3d8e4';
     row.append(label);
     for(const frame of d.frames){
      const item=document.createElement('div');item.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;min-width:80px;';
      const base=d.scope==='main'?'./lights.json':'../interactive-overhead/lights.json';
      const src=new URL(frame.url,new URL(base,location.href)).href;
      const im=new Image();im.src=src;
      try{await im.decode()}catch(e){results.push({id:d.id,state:frame.state,error:String(e)});continue}
      const w=Math.max(16,Math.round(d.sourceRect[2]*multiplier)),
            h=Math.max(9,Math.round(d.sourceRect[3]*multiplier));
      im.width=w;im.height=h;im.style.cssText='display:block;object-fit:contain;max-width:none;max-height:none;image-rendering:auto;';
      const frameBox=document.createElement('div');frameBox.style.cssText='display:grid;place-items:center;min-width:80px;min-height:37px;background:#060708;border:1px solid #34383c;';
      frameBox.append(im);item.append(frameBox);
      const name=document.createElement('span');name.textContent=frame.state+' · '+w+'×'+h;
      name.style.cssText='font:10px monospace;color:#e0b875';item.append(name);
      row.append(item);results.push({id:d.id,state:frame.state,width:w,height:h,source:src,loaded:true});
     }
     document.body.append(row);
    }
    return results;
   },{data,multiplier});
   const width=1320,height=await page.evaluate(()=>Math.max(1024,Math.min(1800,document.body.scrollHeight+20)));
   await page.setViewportSize({width,height});
   const file=path.join(out,'readability-'+Math.round(multiplier*100)+'pct.png');
   await page.screenshot({path:file,fullPage:true,animations:'disabled'});
   const errors=result.filter(r=>r.error);
   assert.equal(errors.length,0,'All legend states must decode at '+multiplier);
   responses.push({scale:multiplier,rendered:result.length,errors});
  }
  fs.writeFileSync(path.join(out,'readability-sample.json'),JSON.stringify({schema:'b737.lamp.small-scale-readability.v1',
    representativeLamps:selections.length,scales:responses,originalSvgSourceUnchanged:true,
    conclusion:'Human optical review still required: 33% and 50% screenshots are comparative, not aircraft lamp photometry'},null,2)+'\n');
  console.log('LAMP_READABILITY_QA_SUCCESS',JSON.stringify({representativeLamps:selections.length,scales:responses,contactSheets:2}));
 }finally{await browser.close()}
})().catch(e=>{console.error('LAMP_READABILITY_QA_FAILED',e.stack||String(e));process.exitCode=1});
