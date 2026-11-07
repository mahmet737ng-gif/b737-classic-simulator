/* B737 Classic MCP numeric rules — Sepehran B737CL FCOM D6-27370-300/400/500-SHI.
 * Chapter 4: 4.10.3–4.10.4 (IAS/MACH), 4.10.7–4.10.8 (ALT/V/S),
 * 4.10.13–4.10.15 (heading/course). Numeric VMO/MMO 340/.820
 * corroborated by that FCOM's FMC 11.40.44; Chapter 4 describes
 * maximum IAS/MACH as Vmo/Mmo, not an unconditional aircraft-specific limit.
 * Heading/course 000–359 in 1° rotary detents are simulation angular
 * conventions; Chapter 4 describes selector action, not the explicit endpoints.
 * Trainer-only; NOT a source for aircraft operation.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737McpFCOMCh4NumericV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SPECS=Object.freeze({
  courseL:Object.freeze({min:0,max:359,step:1,slots:3,unit:'deg',source:'4.10.13–4.10.15; angle convention'}),
  courseR:Object.freeze({min:0,max:359,step:1,slots:3,unit:'deg',source:'4.10.13–4.10.15; angle convention'}),
  heading:Object.freeze({min:0,max:359,step:1,slots:3,unit:'deg',source:'4.10.13–4.10.15; angle convention'}),
  speed:Object.freeze({min:110,max:340,step:1,slots:3,unit:'KIAS',source:'4.10.3–4.10.4; Vmo reference 11.40.44'}),
  machHundredths:Object.freeze({min:60,max:82,step:1,slots:3,unit:'Mach/100',source:'4.10.4; Mmo reference 11.40.44'}),
  altitude:Object.freeze({min:0,max:50000,step:100,slots:5,unit:'feet',source:'4.10.7–4.10.8'}),
  verticalSpeed:Object.freeze({min:-7900,max:6000,step:null,slots:5,unit:'ft/min',source:'4.10.8'})
 });
 const INITIAL=Object.freeze({courseL:261,courseR:261,speed:110,
  machHundredths:60,heading:134,altitude:10000,verticalSpeed:0});
 function finite(v){return typeof v==='number'&&Number.isFinite(v)}
 function normalize(id,value){
  const spec=SPECS[id];if(!spec||!finite(value))return null;
  if(id==='courseL'||id==='courseR'||id==='heading')return ((Math.round(value)%360)+360)%360;
  const rounded=id==='verticalSpeed'?
   (Math.abs(value)<1000?Math.round(value/50)*50:Math.round(value/100)*100):
   Math.round(value/spec.step)*spec.step;
  return Math.min(spec.max,Math.max(spec.min,rounded));
 }
 function valid(id,value){
  const s=SPECS[id];if(!s||!finite(value)||!Number.isInteger(value)||value<s.min||value>s.max)return false;
  if(id==='verticalSpeed')return Math.abs(value)<1000?value%50===0:value%100===0;
  return value%s.step===0;
 }
 function nextVerticalSpeed(current,dir){
  const v=normalize('verticalSpeed',current);
  if(v===null)return null;
  const sign=Math.sign(dir);if(!sign)return v;
  const towardZero=v!==0&&Math.sign(v)!==sign;
  const increment=Math.abs(v)>1000||Math.abs(v)===1000&&!towardZero?100:50;
  return normalize('verticalSpeed',v+sign*increment);
 }
 function step(id,value,detents){
  if(!SPECS[id]||!finite(value)||!finite(detents))return null;
  let current=normalize(id,value);const count=Math.min(2000,Math.abs(Math.trunc(detents)));
  const sign=Math.sign(detents);
  for(let i=0;i<count;i++){
   if(id==='verticalSpeed')current=nextVerticalSpeed(current,sign);
   else if(id==='courseL'||id==='courseR'||id==='heading')current=((current+sign)%360+360)%360;
   else current=Math.max(SPECS[id].min,Math.min(SPECS[id].max,current+sign*SPECS[id].step));
  }
  return current;
 }
 function format(id,value,{mode='IAS',blank=false}={}){
  if(blank)return '';
  if(id==='speed'&&mode==='MACH'){
   const v=normalize('machHundredths',value);
   return v===null?'':'.'+String(v).padStart(2,'0');
  }
  if(!Object.hasOwn(SPECS,id))return '';
  const v=normalize(id,value);
  if(v===null)return '';
  if(id==='verticalSpeed')return (v===0?' ':v<0?'-':'+')+
   String(Math.abs(v)).padStart(4,'0');
  return String(v).padStart(SPECS[id].slots,'0');
 }
 return Object.freeze({VERSION:'MCP-FCOM4-0001',SPECS,INITIAL,normalize,valid,step,format,
  maxSpeed:{kias:340,machHundredths:82,source:'FCOM 11.40.44 maximum default; verify effectivity Vmo/Mmo'}});
});
