/* PHOTO-GAUGE-REGISTRATION-0002-NATIVE-BEZEL — exact photo-source coordinate spaces.
 * Mount a photo gauge on the visible native photo, never an EIS piece hidden
 * by the F/O conventional owner plate. All positions are image SOURCE pixels:
 * the existing assembly and FO proportional-scale engine own final transforms.
 * No guessed viewport-pixel coordinates or one-sided CSS aspect corrections.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737PhotoGaugeRegistrationV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='PHOTO-GAUGE-REGISTRATION-0001';
 const ref=Object.freeze({airspeed:304,altimeter:456,ivsi:240,rmi:213});
 const kinds=Object.freeze(['airspeed','altimeter','ivsi','rmi']);
 const layouts=Object.freeze({
  EIS:Object.freeze({
   captain:Object.freeze({
    // Calibrated to the original 3942 x 3591 cockpit photo bezel,
    // not to the legacy airspeed needle's 328px tip-radius.
    airspeed:['captain',3942,3591,1108,973,340],
    altimeter:['captain',3942,3591,3082,980,249],
    ivsi:['captain',3942,3591,3080,1610,248],
    rmi:['captain',3942,3591,1183,1838,223]
   }),
   firstOfficer:Object.freeze({
    airspeed:['fo-inner',918,1713,741,577,145],
    altimeter:['fo-outer',1123,1400,618,343,106],
    ivsi:['fo-outer',1123,1400,619,611,102],
    // F/O RMI original photographed housing is ~281 native source px
    // across; 128 was a NEEDLE radius and enlarged its 598x725 face
    // to ~359px, physically colliding with the ASI/DME face above.
    rmi:['fo-inner',918,1713,771,954,100]
   })
  }),
  CONVENTIONAL:Object.freeze({
   firstOfficer:Object.freeze({
    // Owner-calibrated F/O source photo (2026-10-30) — same original
    // pivot reference used by the protected FO owner/needles modules.
    airspeed:['fo-owner',1286,1223,310,422,100],
    altimeter:['fo-owner',1286,1223,933,405,86],
    ivsi:['fo-owner',1286,1223,932,605,86],
    rmi:['fo-owner',1286,1223,330,714,73]
   })
  })
 });
 const modeOf=doc=>doc?.documentElement?.dataset?.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
 function get(mode,station,kind){
  if(!['EIS','CONVENTIONAL'].includes(mode))throw Error('UNKNOWN_GAUGE_MODE');
  if(!['captain','firstOfficer'].includes(station)||!kinds.includes(kind))throw Error('UNKNOWN_GAUGE_TARGET');
  const seatLayout=layouts[mode][station]||
   (mode==='CONVENTIONAL'&&station==='captain'?layouts.EIS.captain:null);
  const a=seatLayout?.[kind];
  if(!a)throw Error('UNREGISTERED_PHOTO_GAUGE');
  const [piece,width,height,x,y,radius]=a;
  return Object.freeze({mode,station,kind,piece,width,height,x,y,radius,
   anchor:mode==='CONVENTIONAL'&&station==='firstOfficer'?'OWNER_20261030':'SOURCE_IMAGE'});
 }
 function selector(entry){
  return entry.piece==='fo-owner'?'#fo-owner-panel-v1':
   '.texture-piece[data-piece="'+entry.piece+'"]';
 }
 function rectangle(entry,photoGeometry){
  if(!entry||!photoGeometry)throw Error('MISSING_GAUGE_LAYOUT');
  const {size,pivot}=photoGeometry,ratio=entry.radius/ref[entry.kind];
  if(!Array.isArray(size)||!Array.isArray(pivot)||!Number.isFinite(ratio)||ratio<=0)
   throw Error('INVALID_PHOTO_GAUGE_GEOMETRY');
  const x=entry.x-pivot[0]*ratio,y=entry.y-pivot[1]*ratio;
  const width=size[0]*ratio,height=size[1]*ratio;
  if([x,y,width,height].some(v=>!Number.isFinite(v))||width<=0||height<=0)
   throw Error('INVALID_PHOTO_GAUGE_RECT');
  // An inner-panel photographic RMI bezel extends across the panel seam
  // in the old renderer. The overlay cannot paint on the neighboring EHSI
  // glass or other owner's texture. Clip in *native source photo* space,
  // leaving the needle pivot and accepted aircraft reference untouched.
  const clip=Object.freeze({
   left:100*Math.max(0,-x)/width,top:100*Math.max(0,-y)/height,
   right:100*Math.max(0,x+width-entry.width)/width,
   bottom:100*Math.max(0,y+height-entry.height)/height
  });
  return Object.freeze({x,y,width,height,
   left:100*x/entry.width,top:100*y/entry.height,
   widthPct:100*width/entry.width,heightPct:100*height/entry.height,
   centerX:entry.x,centerY:entry.y,clip});
 }
 return Object.freeze({VERSION,ref,kinds,layouts,modeOf,get,selector,rectangle});
});
