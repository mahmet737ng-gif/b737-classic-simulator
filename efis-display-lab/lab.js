/* B737CL EADI/EHSI test-lab controller — no recurring polling. */
(function(){
'use strict';
const core=window.EFISDisplayLabCore,view=window.EFISDisplayLabEadi,engine=window.EFISClassicEHSIV2;
const $=id=>document.getElementById(id);
if(!core||!view||!engine){document.body.insertAdjacentHTML('afterbegin','<p style="color:red">Lab dependency missing: core/eadi/EHSI renderer</p>');return}
let state=core.initial(),selected=null;
$('fcomLink').href=core.FCOM;
const refs={eadi:null,ehsi:null};
function node(tag,attrs={},value){
 const e=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){if(k==='text')e.textContent=v;else if(k==='className')e.className=v;else e.setAttribute(k,String(v))}
 if(value!==undefined)e.value=value;
 return e;
}
function addSelect(host,label,path,options){
 const outer=node('div',{className:'field'}),caption=node('label',{text:label}),select=node('select',{'data-path':path});
 options.forEach(v=>{const opt=node('option',{value:v,text:v.replaceAll('_',' ')});select.appendChild(opt)});
 outer.append(caption,select);host.appendChild(outer);
}
function addRange(host,label,path,min,max,step){
 const outer=node('div',{className:'field'}),caption=node('label',{text:label}),slider=node('input',{type:'range',min,max,step,'data-path':path}),out=node('output',{class:'small'});
 slider.addEventListener('input',()=>out.textContent=slider.value);
 outer.append(caption,slider,out);host.appendChild(outer);
}
function addNumber(host,label,path,min,max,step){
 const outer=node('div',{className:'field'}),caption=node('label',{text:label}),input=node('input',{type:'number',min,max,step,'data-path':path});
 outer.append(caption,input);host.appendChild(outer);
}
function addCheck(host,label,path,kind='set'){
 const outer=node('label',{className:'toggle'}),check=node('input',{type:'checkbox','data-path':path,'data-kind':kind});
 outer.append(check,document.createTextNode(label));host.appendChild(outer);
}
const ai=$('eadiInputs'),hi=$('ehsiInputs'),opts=$('ehsiOptions'),sources=$('sourceSelects'),fails=$('failInputs');
addSelect(sources,'Crew side / symbol generator','seat',['CAPT','FO']);
addSelect(sources,'EFI SG transfer (test)','power.source',['NORMAL','SG1','SG2']);
addNumber(ai,'PITCH °','eadi.pitch',-90,90,1);
addNumber(ai,'BANK °','eadi.bank',-60,60,1);
addNumber(ai,'IAS kt','eadi.ias',0,450,1);
addNumber(ai,'MCP speed kt','eadi.selectedSpeed',0,450,1);
addNumber(ai,'MACH','eadi.mach',0,.95,.01);
addNumber(ai,'Ground speed kt','eadi.groundSpeed',0,600,1);
addNumber(ai,'RADIO ALT ft','eadi.radioAlt',0,2500,1);
addNumber(ai,'Decision height ft','eadi.dh',-20,999,1);
addNumber(ai,'FD pitch cmd °','eadi.fdPitch',-35,35,.5);
addNumber(ai,'FD roll cmd °','eadi.fdRoll',-30,30,.5);
addNumber(ai,'LOC deviation dots','eadi.locDev',-2.5,2.5,.1);
addNumber(ai,'GS deviation dots','eadi.gsDev',-2.5,2.5,.1);
addRange(ai,'Slip / skid (sim)','eadi.slip',-10,10,1);
addSelect(ai,'TCAS avoid zone','eadi.tcas',['OFF','UP','DOWN']);
addSelect(ai,'A/T FMA (injected)','eadi.at',['','FMC SPD','MCP SPD','N1','ARM']);
addSelect(ai,'PITCH FMA (injected)','eadi.pitchMode',['','VNAV PTH','ALT HOLD','V/S','LVL CHG','G/S','TO/GA']);
addSelect(ai,'ROLL FMA (injected)','eadi.rollMode',['','LNAV','HDG SEL','VOR/LOC','TO/GA']);
addSelect(ai,'AFDS status (injected)','eadi.afds',['','FD','CMD','CWS P','CWS R']);
addSelect(hi,'Display MODE','ehsi.mode',core.MODES);
addSelect(hi,'Range NM','ehsi.range',core.RANGES.map(String));
addNumber(hi,'Heading ° MAG','ehsi.heading',0,359,1);
addNumber(hi,'MCP selected HDG °','ehsi.selectedHeading',0,359,1);
addNumber(hi,'Track ° MAG','ehsi.track',0,359,1);
addNumber(hi,'Selected CRS °','ehsi.course',0,359,1);
addRange(hi,'EHSI brightness','ehsi.brightness',.2,1,.05);
[['wpt','WPT'],['arpt','ARPT'],['navAid','NAV AID'],['vorAdf','VOR / ADF'],['rteData','RTE DATA'],['tfc','TFC'],['wxr','WXR REQUEST'],['terr','TERR REQUEST']].forEach(([id,label])=>addCheck(opts,label,id,'option'));
addCheck(opts,'Synthetic route','ehsi.showSyntheticRoute');
[['eadi','EADI AC'],['ehsi','EHSI AC'],['sg1','SG 1'],['sg2','SG 2'],['att','IRS attitude'],['heading','IRS heading'],['track','IRS track'],['adc','ADC / IAS'],['nav','NAV data'],['fd','FD commands'],['loc','Localizer'],['gs','Glideslope'],['ra','Radio altimeter']].forEach(([id,label])=>addCheck(fails,label,'power.'+id));
[['fd','FD engaged'],['descent','Descending'],['frontCourse','Front-course ILS'],['windshear','Windshear warning'],['pullup','PULL UP warning'],['pli','Pitch-limit demonstration']].forEach(([id,label])=>addCheck(fails,label,'eadi.'+id));
function getValue(path){
 if(path==='seat')return state.seat;
 return path.split('.').reduce((o,p)=>o?.[p],state);
}
function syncControls(){
 document.querySelectorAll('[data-path]').forEach(el=>{
  const val=el.dataset.kind==='option'?state.ehsi.options[el.dataset.path]:getValue(el.dataset.path);
  if(val===undefined)return;
  if(el.type==='checkbox')el.checked=!!val;else el.value=String(val);
  if(el.type==='range'&&el.nextElementSibling?.tagName==='OUTPUT')el.nextElementSibling.textContent=el.value;
 });
}
function sourceChange(e){
 const el=e.target.closest('[data-path]');if(!el)return;
 let val=el.type==='checkbox'?el.checked:el.type==='number'||el.type==='range'?Number(el.value):el.value;
 if(el.dataset.path==='ehsi.range')val=Number(val);
 if(el.dataset.path==='seat')state={...state,seat:val};
 else if(el.dataset.kind==='option')state=core.apply(state,{type:'option',name:el.dataset.path,value:val});
 else state=core.apply(state,{type:'set',path:el.dataset.path,value:val});
 render();
}
for(const h of [ai,hi,opts,sources,fails]){h.addEventListener('change',sourceChange);h.addEventListener('input',e=>{if(e.target.type==='range')sourceChange(e)});}
function render(){
 const status=core.evaluate(state);
 view.render($('eadi'),state,core);
 const ehsimodel=core.ehsiModel(state);
 const ehsiStatus=engine.render($('ehsi'),ehsimodel);
 $('eadiStatus').textContent=!status.powered?'NO POWER':!status.sg?'SG FAILURE':'SIMULATED INPUT';
 $('ehsiStatus').textContent=!state.power.ehsi?'NO POWER':!status.sg?'SG FAILURE':!ehsiStatus.supported?'MODE REBUILD PENDING':(state.ehsi.mode+' · '+ehsiStatus.orientation.replace('_',' ')+' · V2');
 document.querySelectorAll('[data-ehsi-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ehsiMode===state.ehsi.mode)));
 $('stateDump').textContent=JSON.stringify({version:core.VERSION,seat:state.seat,status:{eadi:status,ehsi:ehsiStatus},state},null,2);
 $('auditCount').textContent=Object.values(state.audit).filter(x=>x==='ACCEPTED').length+' / '+core.items.length+' visually accepted (manual)';
 if(selected)showHighlight(selected);
 syncControls();
 window.dispatchEvent(new CustomEvent('efislab-state',{detail:state}));
}
$('presets').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.scenario)state=core.apply(state,{type:'scenario',name:b.dataset.scenario});
 else if(b.id==='dhReset')state=core.apply(state,{type:'dhReset'});
 else if(b.id==='runTests')tests();
 render();
});
$('ehsiQuickModes').addEventListener('click',e=>{
 const b=e.target.closest('[data-ehsi-mode]');if(!b)return;
 state=core.apply(state,{type:'set',path:'ehsi.mode',value:b.dataset.ehsiMode});
 render();
});
function row(item){
 const tr=node('tr'),which=node('td',{text:item.display.toUpperCase()});
 const seg=node('td'),button=node('button',{type:'button',text:item.name});
 button.addEventListener('click',()=>{selected=item;showHighlight(item);$(item.display+'Stage').scrollIntoView({behavior:'smooth',block:'center'})});
 seg.appendChild(button);
 const ref=node('td'),link=node('a',{href:core.FCOM,target:'_blank',rel:'noreferrer',text:item.folio});ref.appendChild(link);
 const status=node('td',{className:item.status==='RULE_ONLY'?'verify':'status',text:item.status==='RULE_ONLY'?'Rule located / visual pending':'Visual comparison pending'});
 const result=node('td'),select=node('select',{'aria-label':'Visual review status for '+item.name});
 ['PENDING','REVIEWED','ACCEPTED'].forEach(x=>select.appendChild(node('option',{value:x,text:x})));
 select.addEventListener('change',()=>{state=core.apply(state,{type:'audit',key:item.display+'.'+item.id,status:select.value});render()});
 result.appendChild(select);tr.append(which,seg,ref,status,result);return tr;
}
core.items.forEach(item=>$('auditRows').appendChild(row(item)));
function showHighlight(item){
 for(const id of ['eadi','ehsi'])$(id+'Highlight').style.display='none';
 const mark=$(item.display+'Highlight'),[x,y,w,h]=item.box;
 Object.assign(mark.style,{display:'block',left:x+'%',top:y+'%',width:w+'%',height:h+'%'});
}
const refPick=(id,display)=>{
 $(id).addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/'))return;
  if(refs[display])URL.revokeObjectURL(refs[display]);
  refs[display]=URL.createObjectURL(file);
  $(display+'Ref').src=refs[display];
  $(display+'Ref').style.opacity=Number($('overlayOpacity').value)/100;
 });
};
refPick('fileEadi','eadi');refPick('fileEhsi','ehsi');
$('overlayOpacity').addEventListener('input',()=>{
 const val=Number($('overlayOpacity').value);$('opacityRead').textContent=val+'%';
 for(const id of ['eadi','ehsi'])$(id+'Ref').style.opacity=val/100;
});
$('clearRef').addEventListener('click',()=>{
 for(const id of ['eadi','ehsi']){if(refs[id])URL.revokeObjectURL(refs[id]);refs[id]=null;$(id+'Ref').removeAttribute('src');$(id+'Ref').style.opacity=0;}
 $('fileEadi').value='';$('fileEhsi').value='';$('overlayOpacity').value=0;$('opacityRead').textContent='0%';
});
function tests(){
 const result=core.selfTest();$('testSummary').textContent=result.checks.filter(x=>x.pass).length+'/'+result.checks.length+' tests PASSED · Structural rules only, not pixel acceptance';
 $('testResults').replaceChildren();
 result.checks.forEach(item=>$('testResults').appendChild(node('div',{className:'check'+(item.pass?'':' fail'),text:(item.pass?'PASS ':'FAIL ')+item.id})));
 return result;
}
$('testAgain').addEventListener('click',tests);
$('copyState').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(state,null,2));$('copyState').textContent='Copied'}catch(e){$('copyState').textContent='Copy unavailable'}});
tests();render();
window.B737EFISDisplayLab={getState:()=>JSON.parse(JSON.stringify(state)),dispatch:event=>{state=core.apply(state,event);render();return state},runTests:tests,version:core.VERSION};
})();
