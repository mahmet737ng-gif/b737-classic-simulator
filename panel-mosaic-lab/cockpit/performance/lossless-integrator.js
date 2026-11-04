/* Apply only verified, native-size alternatives. Original paths remain untouched. */
(function(){
 'use strict';
 const originals=globalThis.B737PerformanceAssets?.images;
 const alternatives=globalThis.B737LosslessAssets?.images;
 if(!originals||!alternatives)return;
 const prefix='panel-mosaic-lab/cockpit/performance/lossless/';
 for(const [source,optimized] of Object.entries(alternatives)){
  const asset=originals[source];
  if(!asset||!source.endsWith('.png')||!optimized||optimized.pixelIdentical!==true)continue;
  if(optimized.sourceSha256!==asset.sourceSha256||optimized.width!==asset.width||optimized.height!==asset.height)continue;
  if(!Number.isFinite(optimized.bytes)||optimized.bytes>=asset.sourceBytes||!optimized.url?.startsWith(prefix)||!optimized.url.endsWith('-exact.webp'))continue;
  const full=asset.levels?.at(-1);
  if(!full||full.url!==source||!full.original)continue;
  // Original image remains the loader's fallback; only the full-size URL changes.
  Object.assign(full,{url:optimized.url,bytes:optimized.bytes,sha256:optimized.sha256,losslessExact:true,originalSource:source});
 }
})();
