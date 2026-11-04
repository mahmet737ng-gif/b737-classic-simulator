/* MCP-RETINA-0001: backwards-compatible, no-logic asset quality negotiation. */
(function(){
"use strict";
const root=document.documentElement;
const base=new URL("./assets/mcp-switches/retina/",document.currentScript.src);
const names=["course-480.webp","ias-480.webp","altitude-480.webp","bank-ring-480.webp","heading-sel-480.webp"];
Promise.all(names.map(name=>new Promise((resolve,reject)=>{
 const img=new Image();
 img.onload=()=>img.naturalWidth>=320&&img.naturalHeight>=320?resolve():reject(Error("undersized "+name));
 img.onerror=()=>reject(Error("missing "+name));
 img.src=new URL(name,base).href;
}))).then(()=>{
 root.classList.add("mcp-retina-ready");
 root.dataset.mcpRetina="ready";
}).catch(e=>{
 root.dataset.mcpRetina="fallback";
 console.info("MCP photo fallback; high-detail textures not all available:",String(e));
});
})();
