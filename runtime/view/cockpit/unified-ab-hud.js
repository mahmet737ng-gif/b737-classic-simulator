/* PERF-0005: identical live diagnostics on both comparison pages. */
(function(){
 'use strict';
 const mode=window.B737OverheadStaticTest?'STATIC':'FULL';
 const link=mode==='STATIC'?'./unified-composite-test.html':'./unified-static-controls-test.html';
 const label=mode==='STATIC'?'Full Interactive':'Static Visual';
 const shell=document.createElement('aside');
 shell.id='overheadABHud';
 shell.setAttribute('aria-label','PERF-0005 Overhead comparison diagnostics');
 shell.style.cssText='position:fixed;z-index:2147483600;left:12px;bottom:12px;direction:ltr;text-align:left;font:12px/1.5 system-ui;background:#081722ee;color:#e9f2f9;border:1px solid #628a9b;border-radius:8px;padding:10px 13px;max-width:260px;pointer-events:auto;box-shadow:0 6px 20px #0008';
 const title=document.createElement('b');title.textContent='PERF-0005 · '+mode+' CONTROLS';
 const info=document.createElement('div');info.textContent='Overhead starting...';
 const switchLink=document.createElement('a');switchLink.href=link;switchLink.textContent='Compare → '+label;switchLink.style.cssText='color:#86ddfa;text-decoration:underline;display:inline-block;margin-top:5px';
 shell.append(title,info,switchLink);
 (document.body||document.documentElement).append(shell);
 let last=0,gaps=[];
 function watch(t){if(last){const d=t-last;if(d>0&&d<2000){gaps.push(d);if(gaps.length>180)gaps.shift();}}last=t;requestAnimationFrame(watch);}
 requestAnimationFrame(watch);
 setInterval(()=>{
  const frame=document.getElementById('overheadFrame');
  let stage;try{stage=frame?.contentWindow?.B737ABStageMetrics?.snapshot();}catch{}
  const sum=gaps.reduce((a,b)=>a+b,0),main=sum?Math.round(gaps.length*10000/sum)/10:0;
  info.textContent='Unified: '+main+' FPS · OH: '+(stage?.fps??'loading')+' FPS'+
   (stage?' · slow '+stage.slowFrames+'/180 · engines '+(stage.enginesReady?'ON':'loading'):'');
 },900);
})();
