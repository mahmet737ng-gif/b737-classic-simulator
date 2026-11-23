/* Original locked EIS engine photograph control-hole registration.
 * SOURCE: panel-mosaic-lab/assets/locked/2026-10-23/
 *         B737_Engine_Standby_Instruments_Blank.png (1235 x 1274 px).
 * The source photo and approved knob/button art are NEVER modified.
 * All geometry is in natural source-photo pixels; the existing cockpit
 * texture-piece supplies the local scale and inherits native pan/zoom.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737EnginePhotoControlRegistrationV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='ENGINE-FOUR-SOCKETS-20261123-0001';
 const SOURCE=Object.freeze({width:1235,height:1274,
  path:'panel-mosaic-lab/assets/locked/2026-10-23/B737_Engine_Standby_Instruments_Blank.png',
  sha256:'7763f8f700ff42f2179d3f8f46eee06444b6439b71f428c328b14f48ac0f4856'});
 // Centers and diameters measured on the untouched PNG. N1 uses the
 // BLACK INTERIOR aperture, NOT the larger steel rim or colored screenshot
 // annotations. Fuel Used uses the entire photographed bezel; Reset is
 // smaller because its metal inset is physically smaller.
 const CONTROLS=Object.freeze({
  N1_MANUAL_1:Object.freeze({cx:441.7,cy:1135.2,diameter:25.0,
   kind:'PULL_ROTATE',asset:'./assets/manual-n1-photo-knob-v1.png'}),
  N1_MANUAL_2:Object.freeze({cx:813.9,cy:1133.4,diameter:25.0,
   kind:'PULL_ROTATE',asset:'./assets/manual-n1-photo-knob-v1.png'}),
  FUEL_USED_PUSH:Object.freeze({cx:627.0,cy:1175.2,diameter:30.0,
   kind:'RECESSED_MOMENTARY',asset:'./assets/recessed-pushbutton-v2.svg'}),
  RESET_FUEL_USED:Object.freeze({cx:691.3,cy:1175.6,diameter:23.0,
   kind:'RECESSED_MOMENTARY',asset:'./assets/recessed-pushbutton-v2.svg'})
 });
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function fit(id,rect){
  const def=CONTROLS[id];
  if(!def)throw new RangeError('Unknown EIS control '+id);
  if(!rect||![rect.w,rect.h].every(v=>finite(v)&&v>0))
   throw new TypeError('Valid engine photograph rectangle required');
  const sx=rect.w/SOURCE.width,sy=rect.h/SOURCE.height;
  return Object.freeze({id,asset:def.asset,kind:def.kind,
   // Local coordinates inside the SAME native engine-photo rectangle:
   x:def.cx*sx,y:def.cy*sy,cx:def.cx*sx,cy:def.cy*sy,
   width:def.diameter*sx,height:def.diameter*sy,
   leftPct:def.cx/SOURCE.width*100,topPct:def.cy/SOURCE.height*100,
   diameterSourcePx:def.diameter,sourceCenter:Object.freeze([def.cx,def.cy])});
 }
 function apply(element,id,rect){
  if(!element?.style)throw new TypeError('Existing hardware button required');
  const geo=fit(id,rect);
  Object.assign(element.style,{
   left:geo.leftPct+'%',top:geo.topPct+'%',
   width:geo.width+'px',height:geo.height+'px',
   minWidth:'0px',minHeight:'0px',maxWidth:'none',maxHeight:'none',
   margin:'0',padding:'0'
  });
  element.dataset.enginePhotoHole=id;
  element.dataset.enginePhotoSize=String(geo.diameterSourcePx);
  return geo;
 }
 function within(expected,actual,tolerancePx=.5){
  if(!expected||!actual)throw new TypeError('Missing expected or actual rectangle');
  const centerError=Math.hypot(actual.left+actual.width/2-expected.left,
    actual.top+actual.height/2-expected.top);
  return Object.freeze({centerError,widthError:Math.abs(actual.width-expected.width),
   heightError:Math.abs(actual.height-expected.height),
   pass:centerError<=tolerancePx&&Math.abs(actual.width-expected.width)<=tolerancePx&&
    Math.abs(actual.height-expected.height)<=tolerancePx});
 }
 return Object.freeze({version:VERSION,source:SOURCE,controls:CONTROLS,fit,apply,within});
});
