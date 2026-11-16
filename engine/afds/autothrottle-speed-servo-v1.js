/* B737 Classic A/T SPEED servo — training-only deterministic controller.
 * MCP remains sole owner of A/T ARM, speed window and thrust mode.
 * ISN-18 remains sole engine N1/N2/EGT/fuel dynamics owner.
 * Values/rates are illustrative, NOT certified CFM56-3B-1 or AFM schedules.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AutothrottleSpeedServoV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_AT_SPEED_SERVO_0001';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 const ENGINES=['engine1','engine2'];
 const IDLE_N1=32,FULL_N1=97;
 function holdN1(iasKt,vsFpm=0){
  if(!finite(iasKt,0,450)||!finite(vsFpm,-6000,6000))throw RangeError('INVALID_FLIGHT_VECTOR');
  // Consistent with the surrogate speed plant, NOT a CFM56 chart.
  return clamp(42+.105*iasKt+.0002*iasKt*iasKt+3*vsFpm/1000,IDLE_N1,92);
 }
 function throttleForN1(n1){
  return Math.pow(clamp((n1-IDLE_N1)/(FULL_N1-IDLE_N1),0,1),1/1.12);
 }
 function initial(){
  return {schema:VERSION,active:false,reason:'NOT_ACTIVE',integral:0,throttle:0,
   targetKt:null,iasKt:null,errorKt:null,demandN1:null,engineCount:0,revision:0};
 }
 function step(previous,input){
  if(previous?.schema!==VERSION)throw TypeError('INVALID_SERVO_STATE');
  const dt=input?.dtSec;
  if(!finite(dt,0,1))throw RangeError('INVALID_DT');
  const m=input.mcp||{},flight=input.flight||{},engines=input.engines||{};
  const out={...previous,revision:previous.revision+1,active:false,reason:'NOT_ACTIVE',
   targetKt:null,iasKt:null,errorKt:null,demandN1:null,engineCount:0,commands:[]};
  const deactivated=(reason)=>{out.reason=reason;out.integral=0;return out;};
  if(m.power!==true)return deactivated('MCP_NOT_POWERED');
  if(m.controls?.atArm!==true)return deactivated('AT_NOT_ARMED');
  if(m.modes?.thrust!=='SPEED')return deactivated('AT_SPEED_NOT_ENGAGED');
  if(m.speedDisplayMode!=='IAS'||m.displayBlank?.speed===true)return deactivated('IAS_TARGET_UNAVAILABLE');
  if(!finite(m.values?.speed,80,450))return deactivated('INVALID_SELECTED_IAS');
  if(input.inhibited===true)return deactivated('MANUAL_OVERRIDE');
  if(input.paused===true)return deactivated('SCENARIO_PAUSED');
  if(!finite(flight.iasKt,0,450)||!finite(flight.vsFpm??0,-6000,6000))
   return deactivated('MEASURED_AIRSPEED_UNAVAILABLE');
  const running=ENGINES.filter(id=>engines[id]?.running===true&&
   finite(engines[id]?.n1Percent,0,120)&&finite(engines[id]?.throttle,0,1));
  out.targetKt=m.values.speed;out.iasKt=flight.iasKt;out.errorKt=out.targetKt-out.iasKt;
  out.engineCount=running.length;
  if(!running.length)return deactivated('NO_RUNNING_ENGINES');
  const fresh=previous.active===true&&previous.engineCount===running.length;
  let integral=fresh?previous.integral:0;
  const kp=.48,ki=.014;
  const feedforward=holdN1(out.iasKt,flight.vsFpm??0);
  // Anti-windup: integrate only where the N1 range permits correction,
  // or when the error would move the demand back into the permitted range.
  const unsaturated=feedforward+kp*out.errorKt+ki*integral;
  const wouldWindup=unsaturated>92&&out.errorKt>0||unsaturated<IDLE_N1&&out.errorKt<0;
  if(!wouldWindup)integral=clamp(integral+dt*out.errorKt,-600,600);
  const n1=clamp(feedforward+kp*out.errorKt+ki*integral,IDLE_N1,92);
  const required=throttleForN1(n1);
  const measured=running.reduce((sum,id)=>sum+engines[id].throttle,0)/running.length;
  const baseline=fresh?previous.throttle:measured;
  // Training motorized-thrust-lever rate limit; engine N1 then follows
  // the independent ISN-18 response dynamics.
  const command=clamp(required,baseline-.22*dt,baseline+.22*dt);
  out.active=true;out.reason=running.length<2?'AT_SPEED_SINGLE_ENGINE_TRAINING':'AT_SPEED_ACTIVE';
  out.integral=integral;out.throttle=clamp(command,0,1);out.demandN1=n1;
  out.commands=running.map(engine=>({engine,throttle:out.throttle}));
  return out;
 }
 return Object.freeze({VERSION,initial,step,holdN1,throttleForN1});
});
