/* Conventional-only lamp registration. Original PNG, EIS and guard geometry stay unchanged.
 * Rectangles measured at native 1182 x 1330 photo pixels, covering black socket borders.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root.document)api.install(root);})(typeof window==='object'?window:globalThis,function(){
'use strict';
const sockets=Object.freeze({
 'main-at-lim':[142,149,209,97],
 'main-reverser-1':[90,282,109,56],
 'main-reverser-2':[308,280,110,57],
 'main-start-valve-1':[536,223,107,55],
 'main-start-valve-2':[738,222,112,56],
 'main-low-oil-1':[487,280,107,56],
 'main-oil-filter-1':[594,280,99,56],
 'main-low-oil-2':[696,280,104,56],
 'main-oil-filter-2':[800,280,108,56],
 'main-le-transit':[925,479,104,61],
 'main-le-extended':[1035,479,119,61],
 'main-antiskid':[987,602,113,69],
 'main-autobrake':[980,941,123,67]
});
function placement(layout,box){const [a,b,c,d,e,f]=layout.matrix,[x,y,w,h]=box;return{x:layout.x+a*x+c*y+e,y:layout.y+b*x+d*y+f,w:a*w,h:d*h,skew:c/d};}
function install(win){const doc=win.document;let pending=false;
 function mount(){const layout=win.B737EngineIndicationModeV1?.layout();if(!layout)return;
 let style=doc.getElementById('conventional-lamp-registration-v1');if(!style){style=doc.createElement('style');style.id='conventional-lamp-registration-v1';doc.head.append(style);}
 const scope='html[data-engine-indication="CONVENTIONAL"] #region-main ';
 const rules=[];
 for(const[id,box]of Object.entries(sockets)){const p=placement(layout,box),sel=scope+'[data-cockpit-light="'+id+'"]';
 rules.push(sel+`{left:${p.x}px!important;top:${p.y}px!important;width:${p.w}px!important;height:${p.h}px!important;transform:matrix(1,0,${p.skew},1,0,0)!important;transform-origin:0 0!important;z-index:45!important}`);
 rules.push(sel+' img{object-fit:fill!important}');
 }
 const text=rules.join('\n');if(style.textContent!==text)style.textContent=text;
 }
 function queue(){if(pending)return;pending=true;win.requestAnimationFrame(()=>{pending=false;mount();});}
 for(const event of ['b737:engine-indication-view','b737:cockpit-mounted','resize'])win.addEventListener(event,queue);
 new win.MutationObserver(queue).observe(doc.getElementById('scene')||doc.body,{childList:true,subtree:true});
 win.B737ConventionalLampRegistrationV1={sockets,placement,inspect:()=>{const l=win.B737EngineIndicationModeV1?.layout();return Object.entries(sockets).map(([id,box])=>{const n=doc.querySelector('[data-cockpit-light="'+id+'"]'),s=n&&win.getComputedStyle(n),p=l&&placement(l,box);return{id,sourceRect:box,expected:p,mounted:!!n,actual:s&&{x:parseFloat(s.left),y:parseFloat(s.top),w:parseFloat(s.width),h:parseFloat(s.height)}};});}};
 queue();
}
return{ sockets,placement,install };
});
