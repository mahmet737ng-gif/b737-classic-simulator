'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js'),'utf8');
const rows=Array.from({length:13},()=>({left:{textContent:''},right:{textContent:''},
 querySelector(q){return q==='.fmc-left'?this.left:q==='.fmc-right'?this.right:null}}));
const calls=[],forwarded=[];
const trainer={
 setFmcPosition(s){calls.push(s);if(s.includes('N99999'))throw Error('Coordinate degrees or minutes out of range');return {ok:true}},
 getState(){return {units:{L:{positionValid:true,position:{lat:35+39.5/60,lon:51+25.4/60},gsKt:190},
  R:{positionValid:true,position:{lat:35+39.4/60,lon:51+25.3/60},gsKt:188}},lastCDUSource:'FMC'};}
};
const realm=vm.createContext({window:{},parent:{B737IRSTrainerUnified:trainer},URLSearchParams,
 location:{search:'?seat=CAPT'},setInterval(){},
 document:{getElementById(id){return id==='fmc-lines'?{querySelectorAll(){return rows}}:null}},
 forwarded});
vm.runInContext("'use strict'; const state={page:'POS_INIT',scratch:'N35395 E051254',message:'',active:{},pending:{}};function update(){};function send(k){forwarded.push(k)}",realm);
vm.runInContext(script,realm,{timeout:1000});
vm.runInContext("send('CDU_CAPT_LSK_R4')",realm);
assert.deepEqual(calls,['N35395 E051254']);
assert.equal(vm.runInContext('state.active.IRS_POS',realm),'N35395 E051254');
assert.equal(vm.runInContext('state.scratch',realm),'');
assert.deepEqual(forwarded,[],'4R must NOT fall through to unrelated staged CDU engine entry');
vm.runInContext("state.scratch='N99999 E051254';send('CDU_CAPT_LSK_R4')",realm);
assert.match(vm.runInContext('state.message',realm),/degrees or minutes/);
vm.runInContext("state.page='POS_REF';window.B737CDUIRSAdapterV1.patchPositionPages()",realm);
assert.equal(rows[2].left.textContent,'IRS L LAT');
assert.equal(rows[3].left.textContent,'N3539.5');
assert.equal(rows[3].right.textContent,'E05125.4');
assert.equal(rows[4].left.textContent,'IRS R LAT');
assert.equal(rows[5].left.textContent,'N3539.4');
assert.equal(rows[5].right.textContent,'E05125.3');
assert.equal(rows[7].left.textContent,'190.0 KT');
assert.equal(rows[7].right.textContent,'188.0 KT');
vm.runInContext("state.page='INDEX';send('CDU_CAPT_LSK_L1')",realm);
assert.deepEqual(forwarded,['CDU_CAPT_LSK_L1'],'Unrelated CDU LSKs remain untouched');
// Live CDU indication bridge consumes IRS backend status outputs while
// respecting the current scratchpad and independent L/R evidence.
const sync=vm.runInContext('window.B737CDUIRSAdapterV1.syncIrsAlerts',realm);
const message=()=>vm.runInContext('state.message',realm);
vm.runInContext("state.message=''",realm);
assert.equal(sync({units:{L:{alignStatusCode:3},R:{alignStatusCode:null}}}),true);
assert.equal(message(),'IRS MOTION','MRG 03 is shown on CDU');
assert.equal(sync({units:{L:{alignStatusCode:8},R:{alignStatusCode:null}}}),true);
assert.equal(message(),'ENTER IRS POS','MRG 08 is shown on CDU');
assert.equal(sync({units:{L:{alignStatusCode:12},R:{alignStatusCode:4}}}),false);
assert.equal(message(),'ENTER IRS POS','MRG 04/12 route to entry prompt');
assert.equal(sync({units:{L:{alignStatusCode:null},R:{cduMessage:'VERIFY POSITION'}}}),true);
assert.equal(message(),'VERIFY POSITION','FMC origin advisory remains separate from IRS internal code 12');
assert.equal(sync({units:{L:{alignStatusCode:null},R:{alignStatusCode:null}}}),true);
assert.equal(message(),'','Resolved IRS message is cleared');
vm.runInContext("state.message='UNRELATED FMC ADVISORY'",realm);
assert.equal(sync({units:{L:{alignStatusCode:3},R:{}}}),false);
assert.equal(message(),'UNRELATED FMC ADVISORY','Unrelated CDU message not overwritten');
console.log('PASS CDU IRS Unified: actual POS INIT LSK 4R sends validated present-position to parent; bad entry retains warning; independent L/R POS REF; original keys remain intact');
