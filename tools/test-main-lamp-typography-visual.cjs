'use strict';
/* Actual Chromium typography inspection for all 30 MIP lights.
 * 100%, 75%, 50% OFF/ON: raster evidence + SVG getBoundingClientRect
 * geometry checks; full original source images and 142 lamp ROIs untouched.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT='/tmp/b737-main-typography-review';
fs.mkdirSync(OUT,{recursive:true});
const j=JSON.parse(fs.readFileSync(path.join(ROOT,'panel-mosaic-lab/cockpit/typography-faces.json'),'utf8'));
const reg=JSON.parse(fs.readFileSync(path.join(ROOT,'panel-mosaic-lab/cockpit/lights.json'),'utf8'));
assert.equal(Object.keys(j.instances).length,30);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 let page=await browser.newPage({viewport:{width:1510,height:1100},deviceScaleFactor:1});
 try{
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/',{waitUntil:'domcontentloaded',timeout:60000});
  let checks=await page.evaluate(async j=>{
   const failures=[],success=[],measurements=[];
   const base=new URL('./lights.json',location.href);
   for(const [id,face] of Object.entries(j.instances)){
    const before=[];
    for(const [state,record] of Object.entries(face.states)){
     const url=new URL(record.url,base).href;
     try{
      const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
      const svg=await response.text();
      const parsed=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
      const wrapper=document.createElement('div');
      wrapper.style.cssText='position:fixed;left:-2000px;top:-2000px;overflow:visible;';
      wrapper.append(document.importNode(parsed,true));document.body.append(wrapper);
      const tag=wrapper.querySelector('svg');
      const sr=face.sourceRect;
      tag.setAttribute('width',sr[2]);tag.setAttribute('height',sr[3]);
      const rect=tag.getBoundingClientRect();
      const texts=[...tag.querySelectorAll('text')];
      const labeltext=texts.map(t=>t.textContent);
      const minX=Math.min(...texts.map(t=>t.getBoundingClientRect().left-rect.left));
      const maxX=Math.max(...texts.map(t=>t.getBoundingClientRect().right-rect.left));
      const minY=Math.min(...texts.map(t=>t.getBoundingClientRect().top-rect.top));
      const maxY=Math.max(...texts.map(t=>t.getBoundingClientRect().bottom-rect.top));
      const weight=[...tag.querySelectorAll('g[font-family]')].map(t=>t.getAttribute('font-weight'));
      const allFonts=[...tag.querySelectorAll('g[font-family]')].map(t=>t.getAttribute('font-family'));
      if(!texts.length)failures.push({id,state,type:'NO_TEXT'});
      if(minX<.0||maxX>sr[2]+.5||minY<-.5||maxY>sr[3]+.5)
       failures.push({id,state,type:'TEXT_OUTSIDE_LENS',bounds:[minX,maxX,minY,maxY],size:[sr[2],sr[3]]});
      if(weight.some(v=>v!=='700')||allFonts.some(v=>!v.startsWith('Arial, Liberation Sans, Helvetica')))
       failures.push({id,state,type:'FONT_INCONSISTENT'});
      const image=new Image();image.src=url;await image.decode();
      if(image.naturalWidth!==sr[2]||image.naturalHeight!==sr[3])
       failures.push({id,state,type:'NATIVE_SIZE_MISMATCH',size:[image.naturalWidth,image.naturalHeight],expected:sr.slice(2)});
      success.push({id,state,textCount:texts.length,ratio:sr[2]/sr[3],family:face.family});
      measurements.push({id,state,family:face.family,sourceRect:sr,legends:labeltext,
       textBounds:[+minX.toFixed(2),+minY.toFixed(2),+maxX.toFixed(2),+maxY.toFixed(2)],
       topMargin:+minY.toFixed(2),bottomMargin:+(sr[3]-maxY).toFixed(2),
       leftMargin:+minX.toFixed(2),rightMargin:+(sr[2]-maxX).toFixed(2)});
      wrapper.remove();
     }catch(e){failures.push({id,state,type:'BROWSER_DECODE_OR_MEASURE',error:String(e)})}
    }
   }
   return {failures,success,measurements};
  },j);
  console.log('MIP_TEXT_BBOX_AUDIT',JSON.stringify({total:checks.success.length,failures:checks.failures.slice(0,25),count:checks.failures.length}));
  for(const scale of [1,.75,.50]){
   await page.evaluate(async({scale,j})=>{
    document.body.replaceChildren();
    document.documentElement.style.cssText='color-scheme:dark;background:#131b24;color:#e1edf7';
    document.body.style.cssText='margin:0;padding:19px;font:13px Arial,sans-serif;overflow:visible;background:#131b24;color:#e1edf7';
    const title=document.createElement('h1');title.style.cssText='font:bold 18px Arial;margin:0 0 6px';
    title.textContent='Boeing 737 Classic — MAIN INSTRUMENT PANEL — '+Math.round(scale*100)+'% actual photo-pixel light lens comparison';
    document.body.append(title);
    const note=document.createElement('p');note.style.cssText='font:12px Arial;margin:0 0 17px;color:#9ac0d5';
    note.textContent='30 installed position-specific annunciators · OFF and ON · native font weights and original colors · reference source photos untouched';
    document.body.append(note);
    const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 22px';
    for(const [id,face] of Object.entries(j.instances)){
     const block=document.createElement('div');
     block.style.cssText='display:flex;align-items:center;gap:7px;min-height:76px;background:#0b141d;border-bottom:1px solid #233948;padding:4px 8px';
     const label=document.createElement('span');label.textContent=id+'\\n'+face.family+' · '+face.sourceRect.slice(2).join('×');
     label.style.cssText='display:block;white-space:pre-line;flex:0 0 205px;font:11px/1.35 monospace;color:#bed3e5';block.append(label);
     for(const state of ['OFF','ON']){
      const item=document.createElement('div');item.style.cssText='display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;min-width:70px;flex:1';
      const image=new Image();image.src=new URL(face.states[state].url,new URL('./lights.json',location.href)).href;
      await image.decode();
      image.width=Math.max(8,Math.round(face.sourceRect[2]*scale));
      image.height=Math.max(6,Math.round(face.sourceRect[3]*scale));
      image.style.cssText='display:block;object-fit:contain;max-width:95%;image-rendering:auto';
      const caption=document.createElement('span');caption.textContent=state;caption.style.cssText='color:#b1b9bf;font:10px monospace';
      item.append(image,caption);block.append(item);
     }
     grid.append(block);
    }
    document.body.append(grid);
   },{scale,j});
   const h=await page.evaluate(()=>document.body.scrollHeight);
   await page.setViewportSize({width:1510,height:Math.max(1200,Math.min(3000,h+12))});
   const filepath=path.join(OUT,'mip-all-30-'+Math.round(scale*100)+'pct.png');
   await page.screenshot({path:filepath,fullPage:true,animations:'disabled'});
   console.log('MIP_VISUAL_MATRIX_IMAGE',Math.round(scale*100)+'pct',fs.statSync(filepath).size);
  }
  const report={schema:'b737.mip.typography.chromium-visual-v1',date:'2026-10-26',
    mountedPositions:30,lightStatesChecked:checks.success.length,
    scales:[100,75,50],fontPass:!checks.failures.some(e=>e.type==='FONT_INCONSISTENT'),
    fullPhotoApproval:'PENDING_HUMAN_REVIEW',opticalBoundsFailures:checks.failures,
    metrics:checks.measurements,photoGeometryChanged:false};
  fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify(report,null,2)+'\n');
  if(checks.failures.length)process.exitCode=1;
  console.log('MIP_VISUAL_QA_SUMMARY',JSON.stringify({positions:30,states:checks.success.length,
    failures:checks.failures.length,scales:[100,75,50],screenshots:3}));
 }finally{await browser.close()}
})().catch(e=>{console.error('MIP_VISUAL_QA_FAILURE',e.stack||String(e));process.exitCode=1});
