/* Reference-matched EIS dot glyphs and numeric formatting. No simulator state. */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737EISDotDigitsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const patterns={
  '0':['0011100','0100010','1000001','1000001','1000001','1000001','1000001','1000001','1000001','0100010','0011100'],
  '1':['0001000','0011000','0101000','0001000','0001000','0001000','0001000','0001000','0001000','0001000','0111110'],
  '2':['0011100','0100010','1000001','0000001','0000010','0000100','0001000','0010000','0100000','1000000','1111111'],
  '3':['0111110','1000001','0000001','0000001','0000010','0011100','0000010','0000001','0000001','1000001','0111110'],
  '4':['0000010','0000110','0001010','0010010','0100010','1000010','1111111','0000010','0000010','0000010','0000010'],
  '5':['1111111','1000000','1000000','1000000','1111100','0000010','0000001','0000001','0000001','1000001','0111110'],
  '6':['0001110','0010000','0100000','1000000','1011100','1100010','1000001','1000001','1000001','0100010','0011100'],
  '7':['1111111','0000001','0000010','0000010','0000100','0000100','0001000','0001000','0010000','0010000','0010000'],
  '8':['0011100','0100010','1000001','1000001','0100010','0011100','0100010','1000001','1000001','0100010','0011100'],
  '9':['0011100','0100010','1000001','1000001','1000001','0100011','0011101','0000001','0000010','0000100','0111000'],
  '-':['0000000','0000000','0000000','0000000','0000000','0111110','0000000','0000000','0000000','0000000','0000000'],
  '.':['0','0','0','0','0','0','0','0','0','0','1']
 };
 const glyphs=Object.freeze(Object.fromEntries(Object.entries(patterns).map(([key,rows])=>{
  const points=[];rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')points.push(Object.freeze({x,y}));}));
  return [key,Object.freeze({width:rows[0].length,height:rows.length,points:Object.freeze(points)})];
 })));
 // Olive yellow of the reference, with lit-dot intensity compensated for
 // subpixel antialiasing at the native panel's much smaller display size.
 const style=Object.freeze({color:'#92913f',pitch:2,radius:.8,advance:9,decimalAdvance:3});
 function format(value,{decimals=0,integerDigits=3}={}){
  if(!Number.isFinite(value))return decimals?'--.-':'---';
  if(!Number.isInteger(decimals)||decimals<0||decimals>1)throw Error('EIS precision must be zero or one decimal');
  // Quantize before formatting so carry/rollover is atomic (99.96 -> 100.0).
  const factor=10**decimals,rounded=Math.round(value*factor)/factor;
  const text=(Object.is(rounded,-0)?0:rounded).toFixed(decimals);
  if(text.replace('-','').split('.')[0].length>integerDigits)return '---';
  return text;
 }
 function layout(text){
  let cursor=0;const cells=[];
  for(const character of String(text)){
   if(!glyphs[character])throw Error('Unsupported EIS character '+character);
   cells.push({character,x:cursor});
   cursor+=character==='.'?style.decimalAdvance:style.advance;
  }
  return {cells,width:Math.max(0,cursor-2),height:11};
 }
 return Object.freeze({VERSION:'EIS-DOT-DIGITS-0001',glyphs,style,format,layout});
});
