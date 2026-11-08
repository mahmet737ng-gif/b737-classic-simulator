/* EADI-FMA-FOUR-0001 | B737 Classic four-field FMA on EADI glass.
 * Layout order per B737-300/400/500 FCOM 4.20:
 * AUTOTHROTTLE, PITCH, ROLL, AUTOPILOT STATUS (left-to-right).
 * Active green, armed white; status CMD/FD green, CWS/1 CH amber.
 *
 * Four framed cells are visible on the upper black GLASS. We NEVER resize or
 * reposition locked EADI/ADI/FO photo geometry. This layer draws after the
 * 85%-size attitude picture and outside its scaled canvas transform.
 *
 * Event source: existing B737_MCP_AFDS_OUTPUT_V1 training model. Modes not
 * evidenced by the backend stay blank; no invented autopilot engagement.
 * Atomic explicit API supports later FMC/AFDS source integration. One timeout
 * per affected seat after an actual mode change for the FCOM 10-second box;
 * no repeating timers, polling, and no animation loop.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.B737EADIFmaFourV1=api;api.bind(root);}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const VERSION='EADI-FMA-FOUR-0001';
 const FIELDS=Object.freeze(['at','pitch','roll','afds']);
 const LABELS=Object.freeze(['A/T','PITCH','ROLL','A/P']);
 const LAYOUT=Object.freeze({x:18,y:12,w:864,h:88,columnWidth:216});
 const VALID=Object.freeze({
  at:Object.freeze(['','N1','GA','RETARD','FMC SPD','MCP SPD','THR HLD','ARM']),
  pitch:Object.freeze(['','TO/GA','V/S','ALT ACQ','ALT HOLD','VNAV','VNAV SPD','VNAV PTH','MCP SPD','G/S','FLARE']),
  roll:Object.freeze(['','HDG SEL','VOR/LOC','LNAV','TO/GA','B/CRS']),
  afds:Object.freeze(['','FD','CMD','CWS P','CWS R','1 CH','SINGLE CH'])
 });
 const initial=()=>Object.fromEntries(FIELDS.map(k=>[k,{active:'',armed:'',highlightUntil:0}]));
 const seats={CAPT:initial(),FO:initial()};
 const timers={CAPT:null,FO:null};
 let host=null,ready=false,unsubscribe=[];
 const COLOR=Object.freeze({green:'#40e08a',white:'#f0f3f5',amber:'#ffd34e',
  grid:'#5d696e',caption:'#9ba9ae',ground:'#080b12'});
 function seatId(value){
  const s=String(value||'').trim().toUpperCase();
  if(s==='CAPTAIN'||s==='LEFT')return 'CAPT';
  if(s==='FIRST OFFICER'||s==='FIRSTOFFICER'||s==='RIGHT')return 'FO';
  if(s==='CAPT'||s==='FO')return s;
  throw Error('FMA seat must be CAPT or FO');
 }
 function validate(field,mode){
  if(typeof mode!=='string'||!VALID[field]?.includes(mode))throw Error('Unsupported '+field+' FMA annunciation: '+String(mode));
  return mode;
 }
 function patchState(seat,patch,now=Date.now()){
  const id=seatId(seat);
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('FMA field updates required');
  if(!Number.isFinite(now))throw Error('Invalid FMA update time');
  // Validate ALL fields before mutation; a rejected source cannot partially
  // change the annunciations that pilots use to check the active mode.
  const upcoming=Object.fromEntries(FIELDS.map(k=>[k,{...seats[id][k]}]));
  let changed=false,highlighted=false;
  for(const [field,val]of Object.entries(patch)){
   if(!FIELDS.includes(field))throw Error('Unknown FMA field '+field);
   if(!val||typeof val!=='object'||Array.isArray(val))throw Error('FMA field must be a mode object');
   for(const key of Object.keys(val))if(!['active','armed'].includes(key))throw Error('Unknown FMA mode attribute '+key);
   for(const key of ['active','armed']){
    if(!Object.hasOwn(val,key))continue;
    if(key==='armed'&&field==='afds'&&val[key]!=='')throw Error('AFDS status cannot have armed mode');
    const next=validate(field,val[key]);
    if(upcoming[field][key]===next)continue;
    // Only actually engaged mode changes have a 10s outline, not stale
    // changes in armed mode and not a transition to blank.
    if(key==='active'){
     upcoming[field].highlightUntil=next?now+10000:0;
     if(next)highlighted=true;
    }
    upcoming[field][key]=next;changed=true;
   }
  }
  if(!changed)return false;
  seats[id]=upcoming;
  if(ready)host?.B737UnifiedEADIStage1?.mount?.(); // existing canvas remains mounted
  // The EADI render hook is invoked through a no-op future-mode refresh.
  // setAttitude re-paints but MUST preserve current pitch and bank.
  const eadi=host?.B737UnifiedEADIStage1;
  const snap=eadi?.snapshot?.()?.stations?.[id];
  if(snap) eadi.setAttitude(id,snap.pitch,snap.bank);
  if(timers[id]!==null){
   host?.clearTimeout?.(timers[id]);
   timers[id]=null;
  }
  const expiry=Math.min(...FIELDS.map(k=>upcoming[k].highlightUntil).filter(t=>t>now));
  if(Number.isFinite(expiry)&&typeof host?.setTimeout==='function'){
   timers[id]=host.setTimeout(()=>{
    timers[id]=null;
    // Exactly one repaint after 10s; no polling or repeated timer.
    const current=eadi?.snapshot?.()?.stations?.[id];
    if(current)eadi.setAttitude(id,current.pitch,current.bank);
   },Math.max(0,expiry-now));
  }
  return true;
 }
 function updateBoth(patch,now=Date.now()){
  // For shared engaged modes. Per-seat A/P status can be overridden in the
  // next individual call by an authoritative flight-director source.
  for(const field of Object.entries(patch))if(!FIELDS.includes(field[0]))throw Error('Unknown FMA field '+field[0]);
  patchState('CAPT',patch,now);
  patchState('FO',patch,now);
 }
 function snapshot(seat){
  if(seat!==undefined){
   const id=seatId(seat);
   return Object.freeze({version:VERSION,seat:id,fields:JSON.parse(JSON.stringify(seats[id]))});
  }
  return Object.freeze({version:VERSION,order:[...FIELDS],
   seats:{CAPT:JSON.parse(JSON.stringify(seats.CAPT)),FO:JSON.parse(JSON.stringify(seats.FO))}});
 }
 function displayMode(raw,lookup){
  return typeof raw==='string'&&Object.hasOwn(lookup,raw)?lookup[raw]:'';
 }
 function projectMcp(out,seat){
  const id=seatId(seat);
  if(!out||out.schema!=='B737_MCP_AFDS_OUTPUT_V1')return null;
  if(out.power!==true)return {at:{active:'',armed:''},pitch:{active:'',armed:''},
   roll:{active:'',armed:''},afds:{active:''}};
  const modes=out.modes||{},control=out.controls||{};
  const lateral=displayMode(modes.lateral,{HDG_SEL:'HDG SEL',LNAV:'LNAV',VOR_LOC:'VOR/LOC'});
  const vertical=displayMode(modes.vertical,{LVL_CHG:'MCP SPD',ALT_HLD:'ALT HOLD',VS:'V/S',VNAV:'VNAV'});
  const thrust=control.atArm===true?displayMode(modes.thrust,{N1:'N1',SPEED:'MCP SPD'}):'';
  const ap=displayMode(modes.autopilot,{CMD_A:'CMD',CMD_B:'CMD'});
  const fd=control.fd?.[id==='CAPT'?'left':'right']===true;
  return {
   at:{active:thrust,armed:control.atArm===true&&!thrust?'ARM':''},
   pitch:{active:vertical,armed:''},roll:{active:lateral,armed:''},
   afds:{active:ap||(fd?'FD':'')}
  };
 }
 function render(c,seat,now=Date.now()){
  const id=seatId(seat);
  c.save();
  // Entire stripe stays above the bank pointer (which starts at about y=110
  // after the 85% ADI artwork fit); do not inherit the ADI scale matrix.
  const {x,y,w,h,columnWidth}=LAYOUT;
  c.fillStyle=COLOR.ground;c.fillRect(x,y,w,h);
  c.strokeStyle=COLOR.grid;c.lineWidth=1.5;
  c.strokeRect(x+.75,y+.75,w-1.5,h-1.5);
  for(let i=1;i<4;i++){
   const sx=x+i*columnWidth;
   c.beginPath();c.moveTo(sx,y+1);c.lineTo(sx,y+h-1);c.stroke();
  }
  c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<4;i++){
   const field=FIELDS[i],entry=seats[id][field],cx=x+(i+.5)*columnWidth;
   c.font='600 16px Arial,sans-serif';c.fillStyle=COLOR.caption;
   c.fillText(LABELS[i],cx,y+14,200);
   if(entry.active){
    c.font='700 29px Arial,sans-serif';
    c.fillStyle=field==='afds'&&/^(?:CWS|1 CH|SINGLE CH)/.test(entry.active)?COLOR.amber:COLOR.green;
    c.fillText(entry.active,cx,y+47,202);
    if(entry.highlightUntil>now){
     c.strokeStyle=c.fillStyle;c.lineWidth=1.9;
     c.strokeRect(cx-94,y+29,188,37);c.strokeStyle=COLOR.grid;
    }
   }
   if(entry.armed){
    c.font='600 19px Arial,sans-serif';c.fillStyle=COLOR.white;
    c.fillText(entry.armed,cx,y+75,200);
   }
  }
  c.restore();
 }
 function applyAfds(out){
  const a=projectMcp(out,'CAPT'),b=projectMcp(out,'FO');
  if(!a||!b)return false;
  const now=Date.now();
  patchState('CAPT',a,now);patchState('FO',b,now);
  return true;
 }
 function bind(win){
  if(ready)return true;
  const eadi=win.B737UnifiedEADIStage1;
  if(!eadi?.registerLayer)return false;
  host=win;ready=true;
  for(const id of ['CAPT','FO'])
   unsubscribe.push(eadi.registerLayer(id,'fma',(canvas)=>render(canvas,id)));
  win.addEventListener('b737:mcp-afds-state',e=>applyAfds(e.detail));
  // MCP may have initialized before this late-loaded display extension.
  const initial=win.B737McpAFDSBridgeV1?.getOutput?.();
  if(initial)applyAfds(initial);
  return true;
 }
 return Object.freeze({VERSION,FIELDS,LABELS,LAYOUT,COLOR,VALID,render,
  setModes:patchState,setBoth:updateBoth,projectMcp,applyAfds,snapshot,bind});
});
