/* B737 Classic — isolated circuit-breaker kernel.
 * No inferred aircraft bus/consumer feed is accepted; tracing requires evidence.
 * Browser global B737_CB_Kernel / CommonJS.
 */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.B737_CB_Kernel=factory();})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VARIANTS=["CPCS","DCPCS"];
function keyFor(panel,position,variant){return panel+"|"+(panel==="P6-4"?(variant||"CPCS"):"ALL")+"|"+position;}
function entries(src){return String(src||"").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const t=x.split("|"),k=t[0].split(":"),position=k[0],rating=Number(k[1]),label=(t[1]||"").trim();if(!/^(?:[A-F]\d{1,2}|CB\d+)$/.test(position)||!Number.isFinite(rating)||rating<=0||!label)throw Error("Bad catalogue "+x);return {position,rating,label};});}
function parseCatalog(catalog){
if(!catalog||!Array.isArray(catalog.panels))throw Error("Missing CB catalog");
const out=[],seen=new Set(),panels=new Set();
for(const p of catalog.panels){
if(!p.id||panels.has(p.id))throw Error("Duplicate panel");
panels.add(p.id);
for(const variant of (p.id==="P6-4"?VARIANTS:["ALL"])){
let es=entries(p.breakers).filter(e=>!(p.id==="P6-4"&&variant==="DCPCS"&&/^F[1-6]$/.test(e.position)));
if(p.id==="P6-4"&&variant==="DCPCS")es=es.concat(entries(p.altBreakers));
for(const e of es){const id=keyFor(p.id,e.position,variant);if(seen.has(id))throw Error("Duplicate CB "+id);seen.add(id);out.push(Object.assign({id,panel:p.id,variant},e));}
}}
return out;
}
class BreakerNetwork{
constructor(catalog,opts){
this.variant=VARIANTS.includes(opts&&opts.variant)?opts.variant:"CPCS";
this.inventory=parseCatalog(catalog);this.breakers=new Map(this.inventory.map(b=>[b.id,Object.assign({},b,{pulled:false,tripped:false,fault:null})]));
this.routes=[];this.busStates=new Map();this.events=[];this.seq=0;this.listeners=[];
}
isActive(b){return !!b&&(b.panel!=="P6-4"||b.variant===this.variant);}
subscribe(cb){this.listeners.push(cb);return ()=>{this.listeners=this.listeners.filter(x=>x!==cb);};}
emit(type,data){const e=Object.assign({seq:++this.seq,type},data||{});this.events.push(e);if(this.events.length>1500)this.events.shift();for(const fn of this.listeners.slice())fn(e);}
setVariant(v){if(!VARIANTS.includes(v))return {ok:false,reason:"INVALID_VARIANT"};this.variant=v;this.emit("VARIANT",{variant:v});return {ok:true};}
state(id){const b=this.breakers.get(id);return b?Object.assign({},b):null;}
activeEntries(){return [...this.breakers.values()].filter(b=>this.isActive(b)).map(b=>Object.assign({},b));}
action(id,verb,reason){
const b=this.breakers.get(id);if(!b)return {ok:false,reason:"UNKNOWN_CB"};
if(!this.isActive(b))return {ok:false,reason:"INACTIVE_VARIANT"};
if(verb==="PULL")b.pulled=true;
else if(verb==="PUSH"){if(b.fault!==null)return {ok:false,reason:"FAULT_ACTIVE"};b.pulled=false;b.tripped=false;}
else if(verb==="INJECT_TRIP"){if(typeof reason!=="string"||!reason.trim())return {ok:false,reason:"FAULT_REASON_REQUIRED"};b.fault=reason.trim().slice(0,200);b.tripped=true;b.pulled=true;}
else if(verb==="CLEAR_FAULT")b.fault=null;
else return {ok:false,reason:"INVALID_ACTION"};
this.emit(verb,{id,pulled:b.pulled,tripped:b.tripped,reason:reason||null});return {ok:true,state:this.state(id)};
}
reset(){for(const b of this.breakers.values()){b.pulled=false;b.tripped=false;b.fault=null;}this.emit("RESET",{});return {ok:true};}
addRoute(r){
if(!r||!this.breakers.has(r.breaker)||!r.bus||!r.consumer)return {ok:false,reason:"INVALID_ROUTE"};
if(!["VERIFIED","SANDBOX"].includes(r.mode))return {ok:false,reason:"UNVERIFIED_ROUTE_REJECTED"};
if(r.mode==="VERIFIED"&&(!r.provenance||!r.provenance.manual||!r.provenance.page||!r.provenance.effectivity))return {ok:false,reason:"PROVENANCE_REQUIRED"};
const k=r.breaker+"|"+r.bus+"|"+r.consumer;if(this.routes.some(x=>x.key===k))return {ok:false,reason:"DUPLICATE_ROUTE"};
this.routes.push(Object.assign({key:k},r));this.emit("ROUTE",{key:k,mode:r.mode});return {ok:true};
}
setBus(bus,powered,source){if(typeof bus!=="string"||typeof powered!=="boolean"||!["SANDBOX","EXTERNAL_AUTHORITY"].includes(source))return {ok:false,reason:"INVALID_BUS_SOURCE"};this.busStates.set(bus,{powered,source});this.emit("BUS",{bus,powered,source});return {ok:true};}
consumer(consumer,mode){
const kind=mode||"VERIFIED";if(!["VERIFIED","SANDBOX"].includes(kind))return {status:"UNKNOWN",reason:"BAD_MODE"};
const paths=this.routes.filter(r=>r.consumer===consumer&&r.mode===kind&&this.isActive(this.breakers.get(r.breaker)));
if(!paths.length)return {status:"UNKNOWN",reason:"NO_TRACED_ROUTE"};
const results=paths.map(r=>{const b=this.breakers.get(r.breaker),s=this.busStates.get(r.bus);
if(!s||(kind==="VERIFIED"&&s.source!=="EXTERNAL_AUTHORITY"))return {key:r.key,status:"UNKNOWN"};
return {key:r.key,status:!b.pulled&&!b.tripped&&s.powered?"POWERED":"UNPOWERED"};});
return {status:results.some(x=>x.status==="POWERED")?"POWERED":results.some(x=>x.status==="UNKNOWN")?"UNKNOWN":"UNPOWERED",paths:results};
}
report(){const a=this.activeEntries();return {panels:new Set(a.map(e=>e.panel)).size,breakers:a.length,pulled:a.filter(e=>e.pulled).length,tripped:a.filter(e=>e.tripped).length,verifiedRoutes:this.routes.filter(r=>r.mode==="VERIFIED").length,sandboxRoutes:this.routes.filter(r=>r.mode==="SANDBOX").length,variant:this.variant};}
snapshot(){return {schema:1,variant:this.variant,breakers:[...this.breakers.values()].filter(e=>e.pulled||e.tripped||e.fault).map(e=>({id:e.id,pulled:e.pulled,tripped:e.tripped,fault:e.fault})),buses:[...this.busStates.entries()].map(([id,s])=>({id,powered:s.powered,source:s.source}))};}
restore(s){
if(!s||s.schema!==1||!VARIANTS.includes(s.variant)||!Array.isArray(s.breakers))return {ok:false,reason:"BAD_SNAPSHOT"};
for(const e of s.breakers){if(!this.breakers.has(e.id)||typeof e.pulled!=="boolean"||typeof e.tripped!=="boolean"||(e.fault!==null&&typeof e.fault!=="string")||(e.tripped&&!e.pulled)||(e.fault!==null&&!e.tripped))return {ok:false,reason:"BAD_BREAKER_STATE"};}
for(const b of this.breakers.values()){b.pulled=false;b.tripped=false;b.fault=null;}
for(const e of s.breakers)Object.assign(this.breakers.get(e.id),{pulled:e.pulled,tripped:e.tripped,fault:e.fault});
this.variant=s.variant;this.busStates.clear();
for(const sBus of (Array.isArray(s.buses)?s.buses:[])){if(typeof sBus.id==="string"&&typeof sBus.powered==="boolean"&&["SANDBOX","EXTERNAL_AUTHORITY"].includes(sBus.source))this.busStates.set(sBus.id,{powered:sBus.powered,source:sBus.source});}
this.emit("RESTORE",{count:s.breakers.length});return {ok:true};
}
}
return {BreakerNetwork,parseCatalog,keyFor};
});