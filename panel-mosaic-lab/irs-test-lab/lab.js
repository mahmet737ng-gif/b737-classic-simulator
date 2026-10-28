/* Presentation of the standalone, isolated QRH trainer. Unlike the owner-
 * frozen Unified panel, this is a NEW test-only interface, not a panel edit.
 */
(function(root){'use strict';
const api=root.B737IRSTestLabEngineV1;
const catalogue=root.B737IRSTestScenariosV1;
if(!api||!catalogue){
 document.body.textContent='IRS LAB LOAD ERROR — core/scenario modules unavailable';return;
}
const lab=api.create();
root.B737IRSTestLabV1=lab; // test-only debugging and inspector API
const by=id=>document.getElementById(id);
let group='ALL',search='',playing=false,speed=60;
const escape=t=>String(t??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=t=>Number.isFinite(t)?String(t):'—';
function clock(sec){const min=Math.floor(sec/60),ss=(sec%60).toFixed(1).padStart(4,'0');return String(min).padStart(2,'0')+':'+ss;}
function litTag(name,on,white,blink){const state=on===null?'null':String(!!on);return '<div class="lamp'+(white?' white':'')+
 '" data-on="'+state+'" data-blink="'+(blink?'true':'false')+'">'+escape(name)+'</div>';}
function selectedScenario(){return catalogue.byId(lab.snapshot().activeScenario);}
function showCases(){
 const items=catalogue.all.filter(x=>(group==='ALL'||x.group===group)&&
 (x.title+' '+x.subtitle+' '+x.id+' '+x.ref).toLowerCase().includes(search.toLowerCase()));
 const active=lab.snapshot().activeScenario;
 by('total').textContent=items.length+'/'+catalogue.all.length;
 by('case-list').innerHTML=items.map(x=>
 '<button type="button" class="case'+(x.id===active?' active':'')+'" data-action="scenario" data-id="'+escape(x.id)+'">'+
 '<span class="case-title">'+escape(x.title)+'<span class="pill'+(x.level==='INJECTED'?' injected':'')+'">'+escape(x.level)+'</span></span>'+
 '<span class="case-meta">'+escape(x.ref)+' · '+escape(x.id)+'</span>'+
 '<span class="case-desc">'+escape(x.subtitle)+'</span></button>').join('')||
 '<p class="hint">سناریویی با این جست‌وجو پیدا نشد.</p>';
 by('groups').innerHTML=[{id:'ALL',title:'همه'},...catalogue.groups].map(g=>
 '<button class="chip'+(g.id===group?' active':'')+'" data-action="filter" data-id="'+g.id+'" type="button">'+escape(g.title)+'</button>').join('');
}
function panel(id,u){
 const lights=litTag('ALIGN',u.alignLamp,true,u.alignLampFlashing)+
 litTag('ON DC',u.onDcLamp,false,false)+
 litTag('FAULT',u.faultLamp,false,false)+
 litTag('DC FAIL',u.dcFailLamp,false,false);
 by('lamps-'+id).innerHTML=lights;
 const display=u.alignStatusCode!==null?'0'+u.alignStatusCode:
   u.alignSecondsRemaining!==null?String(Math.min(7,Math.ceil(u.alignSecondsRemaining/60))):u.positionValid?'NAV':'--';
 by('digit-'+id).textContent=display;
 const fields=[['MSU',u.mode],['STATE',u.phase],['POWER',u.powerSource],
   ['NAV',u.positionValid?'VALID':'INVALID'],
   ['ALIGN',u.alignLampMode],['PPOS',u.entrySource||'NOT ENTERED']];
 by('state-'+id).innerHTML=fields.map(([k,v])=>
 '<span>'+escape(k)+'</span><strong class="'+(v==='NAV_READY'||v==='VALID'?'good':v==='POWER_LOST'||v==='INVALID'?'bad':'')+'">'+escape(v)+'</strong>').join('');
 by('unit-'+id).dataset.mode=u.mode;
}
function showControls(s){
 by('side-toggle').innerHTML=['L','R'].map(id=>
 '<button class="btn'+(s.selected===id?' active':'')+'" data-action="select" data-side="'+id+'" type="button">IRS '+id+'</button>').join('');
 by('modes').innerHTML=['OFF','ALIGN','NAV','ATT'].map(id=>
 '<button class="btn'+(s.units[s.selected].mode===id?' active':'')+'" data-action="mode" data-mode="'+id+'" type="button">'+id+'</button>').join('');
 const labels={acStandby:'AC STANDBY (L)',transfer2:'AC TRANSFER 2 (R)',
 switchedHotBattery:'SW HOT BATTERY DC',battery:'BATTERY BUS'};
 by('bus-controls').innerHTML=Object.entries(labels).map(([key,label])=>
 '<div class="bus-row"><span>'+escape(label)+'</span><button class="btn bus-btn'+(s.bus[key]?' on':'')+
 '" data-action="bus" data-bus="'+key+'" type="button">'+(s.bus[key]?'ON':'OFF')+'</button></div>').join('');
 by('sim-clock').textContent=clock(s.clock);
 by('play').textContent=playing?'⏸ PAUSE':'▶ RUN';
 by('transfer').value=s.transfer;
}
function showDiagnostics(s){
 const a=[
 ['IRS L POWER',s.units.L.powerSource],['IRS R POWER',s.units.R.powerSource],
 ['R DC BACKUP',Math.round(s.powerDiagnostics.rightBackupSeconds)+' / 300s'],
 ['NAV L / R',(s.units.L.positionValid?'VALID':'INVALID')+' / '+(s.units.R.positionValid?'VALID':'INVALID')]
 ];
 by('stats').innerHTML=a.map(([l,v])=>'<div class="stat"><span>'+escape(l)+'</span><strong>'+escape(v)+'</strong></div>').join('');
 let alerts=[];
 for(const id of ['L','R']){
  const u=s.units[id];
  if(u.alignStatusCode!==null)alerts.push('IRS '+id+': '+(u.cduMessage||'ALIGN BLOCKED')+' / ISDU '+String(u.alignStatusCode).padStart(2,'0'));
  if(u.faultLamp)alerts.push('IRS '+id+': FAULT '+(u.syntheticFault?'[INJECTED]':'[CORE]'));
  if(u.dcFailLamp)alerts.push('IRS '+id+': DC FAIL'+(u.syntheticDcFail?' [INJECTED]':''));
  if(u.onDcLamp&&u.phase!=='SELFTEST')alerts.push('IRS '+id+': ON DC');
 }
 if(s.error)alerts.unshift('ERROR: '+s.error);
 if(s.sim.cbCandidate)alerts.push('CB '+s.sim.cbCandidate+': PHOTO-ONLY / WIRING NOT VERIFIED');
 const el=by('fault-line');el.classList.toggle('bad',alerts.length>0);
 el.textContent=alerts.length?alerts.join(' · '):'NORMAL · هیچ خرابی فعالی وجود ندارد';
 by('diagnostic-badge').textContent=s.units.L.syntheticFault||s.units.R.syntheticFault||
   s.units.L.syntheticDcFail||s.units.R.syntheticDcFail||s.sim.cbCandidate?'CORE + INSTRUCTOR INJECTION':'LIVE CORE + ELECTRICAL MODEL';
}
function showCard(s){
 const item=catalogue.byId(s.activeScenario);
 by('scenario-title').textContent=item?.title||'IRS Ground Test';
 by('scenario-summary').textContent=item?.subtitle||'هر دو IRS را مستقل بررسی کنید. با انتخاب سناریو، خرابی و علائم همان مورد شبیه‌سازی می‌شود.';
 by('scenario-category').textContent=item?.group+' · '+item?.level||'LIVE TRAINER';
 by('qrh-ref').textContent=item?.ref||'B737 Classic · FCOM / MRG';
 const result=lab.checkStatus();
 const qa=by('qa-status');qa.textContent=result===null?'READY':result?'MATCH':'CHECK';
 qa.className=result===null?'':result?'pass':'fail';
 by('scenario-detail').innerHTML=item?
 '<div class="card-box"><strong>'+escape(item.title)+'</strong><p>'+escape(item.subtitle)+'</p>'+
 '<p class="source-line">'+escape(item.ref)+'</p><p class="source-line">'+
 (item.level==='CORE'?'CORE: وضعیت واقعی موتور IRS/برق':'INJECTED: خرابی مربی؛ هنوز مدل سخت‌افزاری مستقل ندارد')+
 '</p></div>':
 '<div class="card-box"><strong>انتخاب سناریو</strong><p>در ستون Fault Library روی یک سناریو کلیک کنید؛ سپس وضعیت چراغ‌ها، کدهای IRS، برق و QRH نمایش داده می‌شود.</p></div>';
 by('expected').innerHTML=item?item.expected.map(v=>'<div class="expected-item">'+escape(v)+'</div>').join(''):
 '<div class="hint">پس از انتخاب سناریو فعال می‌شود.</div>';
 by('steps').innerHTML=item?item.steps.map((line,i)=>
 '<label class="checklist-item"><input type="checkbox" data-step="'+i+'" '+(s.checklist[i]?'checked':'')+'><span>'+
 escape(line)+'</span></label>').join(''):'<div class="hint">یک سناریو را انتخاب کنید.</div>';
 by('events').innerHTML=s.log.slice(0,28).map(e=>'<div class="event '+escape(e.kind)+'"><b>'+
 escape(e.at)+'s</b>'+escape(e.kind)+' · '+escape(e.message)+'</div>').join('')||'<p class="hint">No events</p>';
}
function render(){
 const s=lab.snapshot();showCases();panel('L',s.units.L);panel('R',s.units.R);
 showControls(s);showDiagnostics(s);showCard(s);
}
function handleClick(node){
 const {action,id,side,mode,bus,seconds,kind,evidence,moving}=node.dataset;
 const s=lab.snapshot();
 const invoke=fn=>lab.safe(fn);
 switch(action){
 case 'scenario':
  playing=false;invoke(()=>lab.scenario(id,s.selected));
  try{const url=new URL(location.href);url.searchParams.set('scenario',id);history.replaceState({},'',url);}catch{}
  break;
 case 'filter':group=id;break;
 case 'select':lab.select(side);break;
 case 'mode':invoke(()=>lab.setMode(s.selected,mode));break;
 case 'bus':invoke(()=>lab.setBus(bus,!s.bus[bus]));break;
 case 'position':invoke(()=>lab.setPos(by('position').value,s.selected));break;
 case 'motion':lab.setMotion(moving==='true');break;
 case 'time':invoke(()=>lab.advance(Number(seconds)));break;
 case 'play':playing=!playing;break;
 case 'inject':invoke(()=>lab.inject(s.selected,kind,!s.sim[s.selected][kind]));break;
 case 'evidence':invoke(()=>lab.checks(s.selected,evidence==='stored'?
  {storedPositionConsistent:false,computedLatitudeConsistent:true}:
  {storedPositionConsistent:true,computedLatitudeConsistent:false}));break;
 case 'clear-evidence':invoke(()=>lab.checks(s.selected,{storedPositionConsistent:true,computedLatitudeConsistent:true}));break;
 }
 render();
}
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-action]');if(btn){handleClick(btn);return;}
 if(e.target.id==='reset'){playing=false;lab.reset();render();}
 if(e.target.id==='clear-log'){lab.reset();playing=false;render();}
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-step]')){lab.progressStep(Number(e.target.dataset.step),e.target.checked);render();}
 if(e.target.id==='speed'){speed=Number(e.target.value)||1;}
 if(e.target.id==='transfer'){lab.selectTransfer(e.target.value);render();}
});
by('search').addEventListener('input',e=>{search=e.target.value;showCases();});
by('position').addEventListener('keydown',e=>{if(e.key==='Enter'){lab.safe(()=>lab.setPos(e.target.value,lab.snapshot().selected));render();}});
setInterval(()=>{
 if(!playing)return;
 lab.safe(()=>lab.advance(Math.min(5,speed*.25)));
 if(speed>20){for(let i=1;i<Math.ceil(speed*.25/5);i++)lab.safe(()=>lab.advance(5));}
 render();
},250);
try{
 const q=new URLSearchParams(location.search),id=q.get('scenario');
 if(id&&catalogue.byId(id))lab.scenario(id);
}catch{}
render();
})(window);
