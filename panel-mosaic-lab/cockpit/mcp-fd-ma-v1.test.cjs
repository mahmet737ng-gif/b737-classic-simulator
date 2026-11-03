/* MCP-FD-MA-0001 | FCOM 4.10.13 / 4.20.3 */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const M=require("./mcp-fd-ma-v1.js");
const ev={kind:"NORMAL",fccAvailable:{left:null,right:null}};
const o=(left,right,ap=null,power=true)=>({schema:"B737_MCP_AFDS_OUTPUT_V1",
 power,controls:{fd:{left,right}},modes:{autopilot:ap}});
const assertLamps=(s,left,right)=>assert.deepEqual(s.lamps,{left,right});
test("FD master first ON, slave, transfer",()=>{
 let s=M.evaluate(M.initialState(),o(false,false),ev);assertLamps(s,false,false);
 s=M.evaluate(s,o(true,false),ev);assertLamps(s,true,false);
 s=M.evaluate(s,o(true,true),ev);assertLamps(s,true,false);
 s=M.evaluate(s,o(false,true),ev);assertLamps(s,false,true);
});
test("First officer as first FD master",()=>{
 let s=M.evaluate(M.initialState(),o(false,true),ev);
 s=M.evaluate(s,o(true,true),ev);assertLamps(s,false,true);
});
test("Autopilot CMD overrides; CWS does not",()=>{
 let s=M.evaluate(M.initialState(),o(false,true),ev);
 s=M.evaluate(s,o(true,true,"CMD_A"),ev);assertLamps(s,true,false);
 s=M.evaluate(s,o(true,true,"CMD_B"),ev);assertLamps(s,false,true);
 s=M.evaluate(s,o(true,true,"CWS_A"),ev);assertLamps(s,false,true);
});
test("Independent TO/GA only with valid RA below 400",()=>{
 let s=M.evaluate(M.initialState(),o(true,false),ev);
 s=M.evaluate(s,o(true,true),{...ev,kind:"TO",radioAltitudeFt:399});assertLamps(s,true,true);
 s=M.evaluate(s,o(true,true),{...ev,kind:"GA",radioAltitudeFt:400});assertLamps(s,true,false);
});
test("Independent APP requires both LOC and GS capture",()=>{
 let s=M.evaluate(M.initialState(),o(true,false),ev);
 s=M.evaluate(s,o(true,true),{...ev,kind:"APP",locCaptured:true,gsCaptured:false});assertLamps(s,true,false);
 s=M.evaluate(s,o(true,true),{...ev,kind:"APP",locCaptured:true,gsCaptured:true});assertLamps(s,true,true);
});
test("CMD inhibits independent dual",()=>{
 let s=M.evaluate(M.initialState(),o(true,false),ev);
 s=M.evaluate(s,o(true,true,"CMD_A"),{...ev,kind:"APP",locCaptured:true,gsCaptured:true});
 assertLamps(s,true,false);
});
test("Power unverified, or lost, extinguishes MA",()=>{
 for(const p of [null,false])assertLamps(M.evaluate(M.initialState(),o(true,false,null,p),ev),false,false);
});
test("FCC failure transfers MA and inhibits dual",()=>{
 let s=M.evaluate(M.initialState(),o(true,false),ev);
 s=M.evaluate(s,o(true,true),{...ev,kind:"TO",radioAltitudeFt:200,fccAvailable:{left:false,right:true}});
 assertLamps(s,false,true);
});
test("Simultaneous FD ON with no ordering evidence stays unresolved",()=>{
 const s=M.evaluate(M.initialState(),o(true,true),ev);
 assertLamps(s,false,false);assert.equal(s.reason,"MASTER_UNRESOLVED");
});
test("Live AC proxy is available on either transfer bus",()=>{
 const bus={transfer1:false,transfer2:true,main1:false,main2:false,acStandby:false};
 assert.equal(M.acEvidence({schema:"B737_ELECTRICAL_V7_RESULT",bus}),true);
 assert.deepEqual(M.maSupply(o(true,false,null,null),{schema:"B737_ELECTRICAL_V7_RESULT",bus}),{
  powered:true,source:"LIVE_AC_BUS_PROXY"});
});
test("MA dark when live AC proved off even with FD selected",()=>{
 const electrical={schema:"B737_ELECTRICAL_V7_RESULT",
  bus:{transfer1:false,transfer2:false,main1:false,main2:false,acStandby:false}};
 const supply=M.maSupply(o(true,false,null,null),electrical);
 const state=M.evaluate(M.initialState(),{...o(true,false,null,null),maPower:supply.powered},ev);
 assertLamps(state,false,false);
});
test("MA follows physical FD when live AC on without instructor-power button",()=>{
 const electrical={schema:"B737_ELECTRICAL_V7_RESULT",bus:{transfer1:true}};
 const supply=M.maSupply(o(true,false,null,null),electrical);
 let state=M.evaluate(M.initialState(),{...o(false,false,null,null),maPower:supply.powered},ev);
 assertLamps(state,false,false);
 state=M.evaluate(state,{...o(true,false,null,null),maPower:supply.powered},ev);
 assertLamps(state,true,false);
 state=M.evaluate(state,{...o(false,false,null,null),maPower:supply.powered},ev);
 assertLamps(state,false,false);
});
test("Unknown power cannot turn on MA from a switch alone",()=>{
 const out=o(true,false,null,null),supply=M.maSupply(out,null);
 const result=M.evaluate(M.initialState(),{...out,maPower:supply.powered},ev);
 assertLamps(result,false,false);
});
