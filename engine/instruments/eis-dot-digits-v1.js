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
  // Re-sample connected strokes on a twice-denser 13 x 21 matrix. These
  // are individual dots, including midpoints, rather than enlarged pixels.
  const points=new Map(),add=(x,y)=>points.set(x+','+y,Object.freeze({x,y}));
  rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v!=='1')return;
   add(2*x,2*y);
   for(const [dx,dy]of [[1,0],[0,1],[1,1],[-1,1]])
    if(rows[y+dy]?.[x+dx]==='1')add(2*x+dx,2*y+dy);
  }));
  return [key,Object.freeze({width:2*rows[0].length-1,height:2*rows.length-1,points:Object.freeze([...points.values()])})];
 })));
 // Olive yellow of the reference, with lit-dot intensity compensated for
 // subpixel antialiasing at the native panel's much smaller display size.
 const style=Object.freeze({color:'#92913f',pitch:.8,radius:.36,advance:18,decimalAdvance:6,
  height:21,drumStride:24,windowTop:-8,windowHeight:36,bodyTop:-1,bodyHeight:22});
 function format(value,{decimals=0,integerDigits=3,divisor=1}={}){
  if(!Number.isInteger(decimals)||decimals<0||decimals>2)throw Error('EIS precision must be zero, one or two decimals');
  if(!Number.isFinite(divisor)||divisor<=0)throw Error('Positive unit divisor required');
  if(!Number.isFinite(value))return decimals===2?'-.--':decimals?'--.-':'---';
  // Quantize before formatting so carry/rollover is atomic (99.96 -> 100.0).
  // Scale before division: 565 kg/h -> 56.5 hundredths -> 0.57 t/h.
  const factor=10**decimals,rounded=Math.round(value*factor/divisor)/factor;
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
  return {cells,width:Math.max(0,cursor-4),height:style.height};
 }
 function createWheel(initial,{omega=16,maxSpeed=26}={}){
  if(!Number.isInteger(initial)||!Number.isFinite(omega)||omega<=0||!Number.isFinite(maxSpeed)||maxSpeed<=0)
   throw Error('Integer wheel column and positive motion settings required');
  const mod=n=>((n%10)+10)%10;
  let column=initial,phase=mod(initial),target=phase,velocity=0;
  const moving=()=>Math.abs(target-phase)>.001||Math.abs(velocity)>.015;
  function snapshot(){return {column,phase,target,velocity,moving:moving(),
   direction:!moving()?'REST':target>phase?'UP':'DOWN'};}
  function snap(next=column){
   if(!Number.isInteger(next))throw Error('Integer wheel column required');
   column=next;phase=target=mod(next);velocity=0;return snapshot();
  }
  function setColumn(next){
   if(!Number.isInteger(next))throw Error('Integer wheel column required');
   const delta=next-column;if(delta===0)return snapshot();
   column=next;const digit=mod(next);
   // Keep the requested direction through 9->0 and 0->9. Big source jumps
   // make at most two visible turns instead of queuing hundreds of digits.
   const steps=Math.abs(delta)>20?Math.sign(delta)*(10+Math.abs(delta)%10):delta;
   target+=steps;
   if(Math.abs(target-phase)>20){
    const direction=Math.sign(target-phase);
    const distance=direction>0?mod(digit-mod(phase)):mod(mod(phase)-digit);
    target=phase+direction*(distance+10);
   }
   if(Math.sign(velocity)!==Math.sign(target-phase))velocity=0;
   return snapshot();
  }
  function step(seconds){
   if(!Number.isFinite(seconds)||seconds<0)throw Error('Nonnegative wheel timestep required');
   if(!moving()||seconds===0)return snapshot();
   const dt=Math.min(seconds,.05),old=phase,offset=phase-target;
   const term=velocity+omega*offset,decay=Math.exp(-omega*dt);
   let next=target+(offset+term*dt)*decay;
   velocity=(velocity-omega*term*dt)*decay;
   const travel=next-old,limit=maxSpeed*dt;
   if(Math.abs(travel)>limit){next=old+Math.sign(travel)*limit;velocity=Math.sign(travel)*maxSpeed;}
   if((target-old)*(target-next)<=0){next=target;velocity=0;}
   phase=next;
   if(!moving()){phase=target=mod(target);velocity=0;}
   return snapshot();
  }
  return Object.freeze({setColumn,step,snap,snapshot});
 }
 return Object.freeze({VERSION:'EIS-ROLLING-DRUM-0003',glyphs,style,format,layout,createWheel});
});
