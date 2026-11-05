(function(){
  'use strict';
  const replacement=new URL('./assets/lower-panel-repair-v1/engine-detents-inboard-restored-v2.webp',document.currentScript.src).href;
  function apply(){
    document.querySelectorAll('#atlasAbsolute .atlas-piece[data-key="OH23-25"] img').forEach(img=>{
      if(img.src!==replacement) img.src=replacement;
    });
  }
  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  [0,100,500,1500,3000].forEach(delay=>setTimeout(apply,delay));
})();
