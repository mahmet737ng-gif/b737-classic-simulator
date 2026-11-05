/* OH23-25 photo only; the frozen atlas renderer, controls and geometry are untouched. */
(function(){
  'use strict';
  const script=document.currentScript;
  const replacement=new URL('./assets/lower-panel-repair-v1/engine-detents-inboard-restored-v2.webp',script.src).href;
  const selector='.atlas-piece[data-key="OH23-25"] img, .piece[data-key="OH23-25"] img';
  const root=document.getElementById('atlasAbsolute');
  let mounted=0;
  function apply(){
    const loader=window.B737ImageLoader;
    if(!loader || typeof loader.assign!=='function')return;
    document.querySelectorAll(selector).forEach(img=>{
      if(img.dataset.perfSource===replacement)return;
      /* A plain img.src change loses to the progressive image loader.
         Reassign its *tracked source* so refreshes and cloned strips stay corrected. */
      loader.assign(img,replacement);
      img.dataset.lowerPanelPhoto='engine-detents-inboard-restored-v2';
      mounted++;
    });
  }
  if(root)new MutationObserver(apply).observe(root,{childList:true,subtree:true});
  for(const id of ['bottom','gallery']){
    const container=document.getElementById(id);
    if(container)new MutationObserver(apply).observe(container,{childList:true,subtree:true});
  }
  window.B737LowerPanelPhoto={apply,source:replacement,get mounted(){return mounted;}};
  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('load',apply,{once:true});
})();
