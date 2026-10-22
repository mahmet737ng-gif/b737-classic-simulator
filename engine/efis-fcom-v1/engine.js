/* Source-bound EFIS control-panel state model; FCOM Vol.2 10.30.2-.5.
   Test-harness fields are kept separate from aircraft-control geometry.
   No artificial NAV, radar, weather, traffic, or terrain return is created. */
(function (root, factory) {const moduleApi=factory(); if (typeof module==='object' && module.exports) module.exports=moduleApi; root.EFIS=moduleApi;})(typeof globalThis==='object'?globalThis:this, function(){
'use strict';
const MODE=['FULL_NAV','EXP_NAV','FULL_VOR_ILS','EXP_VOR_ILS','MAP','CTR_MAP','PLAN'];
const RANGE=[10,20,40,80,160,320];
const SWITCH=['VOR_ADF','NAV_AID','ARPT','RTE_DATA','WPT'];
const FCOM_REF={DH_REF_SELECTOR:'10.30.3 #2',DH_RST:'10.30.3 #3',EADI_BRT:'10.30.3 #4',EHSI_BRT_OUTER:'10.30.3 #5',WXR_BRT_INNER:'10.30.4 #6',EHSI_MODE:'10.30.4 #7',EHSI_RANGE:'10.30.4 #8',WXR:'10.30.4 #9',TFC:'10.30.5 #11',VOR_ADF:'10.30.4 #10',NAV_AID:'10.30.4 #10',ARPT:'10.30.4 #10',RTE_DATA:'10.30.4 #10',WPT:'10.30.5 #10'};
function initial(){return {mode:'MAP',range:10,wxr:false,tfc:false, switches:{VOR_ADF:false,NAV_AID:false,ARPT:false,RTE_DATA:false,WPT:false}, brightnessTurns:{EADI_BRT:0,EHSI_BRT_OUTER:0,WXR_BRT_INNER:0}, dhTurn:0, dhResetCount:0, dhAlert:false, selectedDH:150, dhValueSource:'FCOM figure shown value (manual test input)', events:[], selected:'EHSI_MODE', lastEvent:''};}
function wrap(i,len){return ((i%len)+len)%len;}
function operate(st,id,step=1){
 if(!FCOM_REF[id]) throw Error('Not in FSI 10.30.2 figure: '+id);
 st.selected=id; let event='';
 if(id==='EHSI_MODE'){st.mode=MODE[wrap(MODE.indexOf(st.mode)+Math.sign(step),MODE.length)];event='MODE '+st.mode;}
 else if(id==='EHSI_RANGE'){st.range=RANGE[wrap(RANGE.indexOf(st.range)+Math.sign(step),RANGE.length)];event='RANGE '+st.range+' NM';}
 else if(id==='WXR'){st.wxr=!st.wxr;event='WXR '+(st.wxr?'SELECTED':'OFF')+'; no radar data simulated';}
 else if(id==='TFC'){st.tfc=!st.tfc;event='TFC '+(st.tfc?'SELECTED':'OFF')+'; no traffic data simulated';}
 else if(SWITCH.includes(id)){st.switches[id]=!st.switches[id];event=id+' '+(st.switches[id]?'SELECTED':'OFF');}
 else if(id==='DH_RST'){st.dhAlert=false;st.dhResetCount++;event='DH ALERT RESET request (EADI not modeled)';}
 else if(id==='DH_REF_SELECTOR'){st.dhTurn+=Math.sign(step);event='DH selector rotated '+(step>0?'CW':'CCW')+'; FCOM does not specify step size';}
 else if(id in st.brightnessTurns){st.brightnessTurns[id]+=Math.sign(step);event=id+' '+(step>0?'CW':'CCW')+'; relative training rotation only';}
 else throw Error('No handler for '+id);
 st.lastEvent=event;st.events.unshift({control:id,event,source:FCOM_REF[id]});st.events=st.events.slice(0,50);
 return st;
}
function setMode(st,mode){if(!MODE.includes(mode))throw Error('Unknown mode');st.mode=mode;st.selected='EHSI_MODE';st.lastEvent='MODE '+mode;return st;}
function setRange(st,value){value=Number(value);if(!RANGE.includes(value))throw Error('Unknown range');st.range=value;st.selected='EHSI_RANGE';st.lastEvent='RANGE '+value+' NM';return st;}
function setDHTestValue(st,v){v=Number(v);if(!Number.isInteger(v)||v<-99||v>999)throw Error('Input outside display test-field guard');st.selectedDH=v;st.dhValueSource='Manual test-console input; increments not defined by FCOM';return st;}
function displayAvailability(st){return {
  wxr:st.wxr?'WXR selected; transmitter/weather returns not connected':'WXR not selected',
  tfc:st.tfc?'TCAS display requested; TCAS data not connected':'TFC off',
  navaid:st.switches.NAV_AID?(st.range>=80?'High-altitude navaids only (database unavailable)':'All database navaids (database unavailable)'):'NAV AID off',
  wpt:st.switches.WPT?(st.range<=40?'WPT selection allowed by FCOM; database unavailable':'WPT outside FCOM scale <=40 NM'):'WPT off',
  arpt:st.switches.ARPT?'Airport selection requested; FMC database unavailable':'ARPT off',
  rte:st.switches.RTE_DATA?'Active-route altitude constraint and ETA requested; FMC not connected':'RTE DATA off',
  vor:st.switches.VOR_ADF?'Requires valid tuned VOR/ADF receiver data':'VOR/ADF off'
};}
return {MODE,RANGE,SWITCH,FCOM_REF,initial,operate,setMode,setRange,setDHTestValue,displayAvailability};
});