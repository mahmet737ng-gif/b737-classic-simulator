/* OH10 P5-13 source-selectors: owner-confirmed clockwise physical order.
 * NO change to original photograph, guarded switches, or meter needle sprite.
 * This model manages selecting an instrument's measured SOURCE, not switching
 * aircraft electrical buses. Measurements must be supplied by a real system
 * adapter; Electrical V7 Boolean buses cannot invent DC amps or AC frequency.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AcDcSelectorModel=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const VERSION='ACDC-DETENT-0001';
 const DETENTS=Object.freeze({
  DC:Object.freeze(['STBY PWR','BAT BUS','BAT','APU BAT','TR1','TR2','TR3']),
  AC:Object.freeze(['STBY PWR','GND PWR','GEN1','APU GEN','GEN2','INV','TEST'])
 });
 // Seven physical stops on the visible selector arc, from lower-left through
 // top-center to lower-right, clockwise, with positive rotation clockwise.
 const ANGLES=Object.freeze([-135,-90,-45,0,45,90,135]);
 const SOCKETS=Object.freeze({
  DC:Object.freeze({x:306,y:1029,r:84,confidence:'PROVISIONAL_NATIVE_PIXEL_SOCKET'}),
  AC:Object.freeze({x:783,y:1029,r:84,confidence:'PROVISIONAL_NATIVE_PIXEL_SOCKET'})
 });
 const safeSide=side=>{if(!Object.hasOwn(DETENTS,side))throw Error('Unknown selector '+side);return side;};
 const indexOf=(side,position)=>{safeSide(side);const i=DETENTS[side].indexOf(position);if(i<0)throw Error('Unknown '+side+' detent '+position);return i;};
 const label=(side,index)=>{safeSide(side);if(!Number.isInteger(index)||index<0||index>=7)throw Error('Out of-range detent');return DETENTS[side][index];};
 const angle=(side,index)=>{label(side,index);return ANGLES[index];};
 const fromAngle=(side,degrees)=>{safeSide(side);if(!Number.isFinite(degrees))throw Error('Invalid angle');return Math.max(0,Math.min(6,Math.round((degrees+135)/45)));};
 const suffix=(side,pos)=>side==='DC'?'dc':'ac';
 function create(){
  let indexes={DC:2,AC:2}; // BAT and GEN1, stable initial choices; no asserted electrical measurements
  const sources={DC:Object.create(null),AC:Object.create(null)};
  let revision=0;
  function read(side){safeSide(side);const index=indexes[side];return Object.freeze({side,index,position:label(side,index),angle:angle(side,index),revision});}
  function select(side,index){
   label(side,index);
   if(index!==indexes[side]){indexes[side]=index;revision++;}
   return read(side);
  }
  function choose(side,position){return select(side,indexOf(side,position));}
  function step(side,delta){safeSide(side);if(!Number.isInteger(delta))throw Error('Step must be integer');return select(side,Math.min(6,Math.max(0,indexes[side]+delta)));}
  function setSourceMeasurement(side,position,measurement){
   indexOf(side,position);
   if(measurement!==null&&(typeof measurement!=='object'||Array.isArray(measurement)))throw Error('Measurement must be object or null');
   const allowed=side==='DC'?['volts','amps']:['volts','cps'];
   const valid=Object.create(null);
   if(measurement!==null)for(const [key,v] of Object.entries(measurement)){
    if(!allowed.includes(key))throw Error('Unknown meter field '+key);
    if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('Meter value must be finite or null');
    valid[key]=v;
   }
   sources[side][position]=measurement===null?null:valid;
   revision++;
   return read(side);
  }
  function readings(){
   const dc=read('DC'),ac=read('AC');
   const d=sources.DC[dc.position],a=sources.AC[ac.position];
   // Unavailable data = null (unverified), NOT invented 28V/115V/400Hz.
   // STBY PWR / BAT BUS voltmeter taps do not imply a DC ammeter feed.
   return Object.freeze({
    dcAmps:(dc.position==='STBY PWR'||dc.position==='BAT BUS')?null:(d?.amps??null),
    dcVolts:d?.volts??null,
    cps:a?.cps??null,
    acVolts:a?.volts??null
   });
  }
  function snapshot(){return Object.freeze({version:VERSION,revision,dc:read('DC'),ac:read('AC'),readings:readings()});}
  return Object.freeze({read,select,choose,step,setSourceMeasurement,readings,snapshot});
 }
 return Object.freeze({version:VERSION,detents:DETENTS,angles:ANGLES,sockets:SOCKETS,indexOf,label,angle,fromAngle,create});
});
