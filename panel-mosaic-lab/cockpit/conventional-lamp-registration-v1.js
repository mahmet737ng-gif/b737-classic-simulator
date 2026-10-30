/* Conventional-only lamp registration. Original PNG, EIS and guard geometry stay unchanged.
 * Rectangles measured at native 1463 x 1075 photo pixels, covering black socket borders.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root.document)api.install(root);})(typeof window==='object'?window:globalThis,function(){
'use strict';
const sockets=Object.freeze({
 'main-at-lim':[430,192,174,74],
 'main-reverser-1':[390,300,80,37], 'main-reverser-2':[565,300,81,37],
 'main-start-valve-1':[764,264,78,36], 'main-start-valve-2':[932,264,78,36],
 'main-low-oil-1':[722,303,81,37], 'main-oil-filter-1':[806,303,79,37],
 'main-low-oil-2':[889,303,80,37], 'main-oil-filter-2':[973,303,79,37],
 'main-le-transit':[1064,412,84,38], 'main-le-extended':[1152,412,79,38],
 'main-antiskid':[1109,495,89,43], 'main-autobrake':[1109,731,89,44],
 'main-speed-brake-armed':[18,600,76,35],
 'main-speed-brake-do-not-arm':[18,638,76,36], 'main-stab-trim':[243,600,80,61],
 'main-gear-nose-red':[1324,156,88,40], 'main-gear-nose-green':[1324,196,88,39],
 'main-gear-left-red':[1281,242,78,40], 'main-gear-left-green':[1281,282,78,40],
 'main-gear-right-red':[1367,242,86,40], 'main-gear-right-green':[1367,282,86,40]
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
 const flap=placement(layout,[1052,239,180,180]);
 rules.push(scope+`.flap-needle-overlay{left:${flap.x}px!important;top:${flap.y}px!important;width:${flap.w}px!important;height:${flap.h}px!important}`);
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
