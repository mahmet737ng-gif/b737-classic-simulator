/* Two independent stall-warning demand sources feeding one approved shaker sound.
 * Training adapter: speed-tape lower red band and AFT OH STALL WARN TEST 1/2.
 * FCOM-based test eligibility: ground + 115V AC (unknown AC is explicitly provisional).
 * No guessed stall/AoA law. Uses an already computed red-band threshold only.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ShakerAuralLogicV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const isNum=x=>typeof x==='number'&&Number.isFinite(x);
 function evaluate(input={}){
  const onGround=input.onGround;
  const airValid=onGround===false;
  const speedValid=airValid&&isNum(input.iasKt)&&isNum(input.shakerBoundaryKt)&&input.shakerBoundaryKt>0;
  const speedDemand=speedValid&&input.iasKt<=input.shakerBoundaryKt;
  const explicitDemand=airValid&&input.flightStallDemand===true;
  const ac=input.ac115Available;
  const testEligible=onGround===true&&ac!==false;
  const channels={1:testEligible&&input.test1===true,2:testEligible&&input.test2===true};
  const active=speedDemand||explicitDemand||channels[1]||channels[2];
  return Object.freeze({active,realStall:speedDemand||explicitDemand,
   speedDemand,explicitDemand,groundTest:channels[1]||channels[2],channels,
   testEligible,testPowerUnverified:testEligible&&ac===null,
   speedValid,reason:active?speedDemand?'LOWER_RED_BAND':explicitDemand?'STALL_WARNING_SIGNAL':channels[1]&&channels[2]?'BOTH_TEST_CHANNELS':channels[1]?'TEST_1':'TEST_2':'OFF'});
 }
 return Object.freeze({evaluate});
});
