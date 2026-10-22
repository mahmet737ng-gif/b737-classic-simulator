/* Source-rule executable interpreter; rules/data remain private. Three-valued T/F/UNKNOWN. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737RuleInterpreter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const owns=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const num=x=>typeof x==='number'&&Number.isFinite(x);
function unknown(){return null}
class Interpreter{
 constructor(){this.holds=new Map()}
 clear(){this.holds.clear()}
 evaluate(rule,state,previous={},nowMs=0){
  if(!rule||!rule.rule_id)throw new Error('Rule ID is required');
  const expr=typeof rule.logic_json==='string'?JSON.parse(rule.logic_json):rule.logic_json;
  const actions=typeof rule.action_json==='string'?JSON.parse(rule.action_json):rule.action_json;
  if(!rule.executable)return {rule:rule.rule_id,matched:null,actions:{},reason:'NON_EXECUTABLE_REQUIRES_SOURCE',source:rule.source_id};
  const matched=this.test(expr,state,previous,nowMs,rule.rule_id);
  return {rule:rule.rule_id,matched,actions:matched===true?actions:{},reason:matched===null?'INPUT_UNKNOWN':null,source:rule.source_id};
 }
 test(x,s={},prev={},t=0,id='anonymous'){
  if(!x||typeof x!=='object')return null;
  if(owns(x,'all')){const q=x.all.map(a=>this.test(a,s,prev,t,id));return q.includes(false)?false:q.every(v=>v===true)?true:null}
  if(owns(x,'any')){const q=x.any.map(a=>this.test(a,s,prev,t,id));return q.includes(true)?true:q.every(v=>v===false)?false:null}
  if(owns(x,'external_decision'))return null;
  if(owns(x,'exists'))return owns(s,x.exists)&&s[x.exists]!==null&&s[x.exists]!==undefined;
  if(owns(x,'eq')){const [k,v]=x.eq;return owns(s,k)?s[k]===v:null}
  if(owns(x,'gt_field')){const [a,b]=x.gt_field;return num(s[a])&&num(s[b])?s[a]>s[b]:null}
  for(const op of ['gt','lt','gte','lte'])if(owns(x,op)){
   const [k,v]=x[op];if(!num(s[k])||!num(v))return null;
   return op==='gt'?s[k]>v:op==='lt'?s[k]<v:op==='gte'?s[k]>=v:s[k]<=v;
  }
  for(const op of ['between','not_between'])if(owns(x,op)){
   const [k,lo,hi]=x[op];if(!num(s[k]))return null;const inRange=s[k]>=lo&&s[k]<=hi;return op==='between'?inRange:!inRange;
  }
  if(owns(x,'held_for_ms')){
   const val=this.test(x.of,s,prev,t,id),key=id+':'+JSON.stringify(x.of);
   if(val===true){if(!this.holds.has(key))this.holds.set(key,t);return t-this.holds.get(key)>=x.held_for_ms}
   this.holds.delete(key);return val===null?null:false;
  }
  for(const op of ['crosses_abs_diff_below','crosses_abs_diff_above'])if(owns(x,op)){
   const [a,b,threshold]=x[op];if(!num(s[a])||!num(s[b])||!num(prev[a])||!num(prev[b]))return null;
   const before=Math.abs(prev[a]-prev[b]),after=Math.abs(s[a]-s[b]);
   return op==='crosses_abs_diff_below'?before>threshold&&after<=threshold:before<=threshold&&after>threshold;
  }
  throw new Error('Unsupported rule expression '+JSON.stringify(x));
 }
}
return Object.freeze({Interpreter});
});