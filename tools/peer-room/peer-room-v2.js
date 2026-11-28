'use strict';
(function(win,doc){
 const protocol='B737-P2P-2',build='159b868108df',uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
 const wrap=x=>btoa(unescape(encodeURIComponent(JSON.stringify(x)))),unwrap=s=>JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
 const config={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
 let pc=null,control=null,telemetry=null,role=null,roomId=null,authority=null,feed=null,active=false,closed=false,serial=0,localClient=null,remoteClient=null,remoteHello=false,helloSent=false,flightSerial=0,generation=0,waiting=new Map(),backlog=[],rtt=null,started=false;
 const root=new URL('.',doc.baseURI);
 const dialog=doc.createElement('dialog');dialog.id='peerRoomDialog';
 dialog.style.cssText='width:min(570px,92vw);max-height:85vh;overflow:auto;background:#14202d;color:#e9f5ff;border:1px solid #5e7e99;border-radius:12px;padding:18px;box-sizing:border-box;font:14px system-ui';
 dialog.innerHTML='<h2 style="margin:0 0 8px">Private Room · P2P Trial</h2><p>Captain creates an offer. First Officer pastes it and returns an answer. Use the same release on both devices.</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button data-p="host">1 · CREATE AS CAPTAIN</button><button data-p="join">2 · JOIN AS FO</button></div><p><label>Received code<textarea data-p="input" rows="4" style="box-sizing:border-box;width:100%"></textarea></label></p><button data-p="answer">3 · CAPTAIN: APPLY ANSWER</button><p><label>Your code<textarea data-p="output" rows="4" readonly style="box-sizing:border-box;width:100%"></textarea></label></p><button data-p="copy">COPY CODE</button> <button data-p="diag">DIAGNOSTICS</button><p role="status" data-p="status">Not connected. Start inside the cockpit on both devices.</p><pre data-p="stats" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><p><button data-p="close">CLOSE</button> <button data-p="leave">LEAVE / RESET</button></p><small>Experimental: Captain and FO only. No TURN relay; some networks cannot connect. After pairing, Captain loads a fresh FLT PHASE scenario. A disconnect pauses the session; reload both devices and pair again.</small>';
 const el=k=>dialog.querySelector('[data-p="'+k+'"]'),status=s=>{el('status').textContent=s;};
 doc.body.append(dialog);
 function open(){if(!dialog.open)dialog.showModal();}
 doc.addEventListener('click',e=>{if(e.target.closest?.('[data-crew-open]')){e.preventDefault();e.stopImmediatePropagation();open();}},true);
 function wireEvent(name,value){
  if(name==='scenario'){const next=value.active?value.generation:0;if(next!==generation){generation=next;flightSerial=0;}}
  if(name==='flight'){if(value.generation!==generation||value.flightSerial<=flightSerial)return;flightSerial=value.flightSerial;}
  if(feed){queueMicrotask(()=>feed.dispatchEvent(new MessageEvent(name,{data:JSON.stringify(value)})));}
  else{backlog.push([name,value]);if(backlog.length>1000)backlog.shift();}
 }
 function sendWire(packet,channel=control){
  if(channel?.readyState!=='open')throw Error('P2P channel not open');
  const raw=JSON.stringify(packet);
  if(raw.length>262144||channel.bufferedAmount>524288)throw Error('P2P buffer limit');
  channel.send(raw);
 }
 function emit(name,value){
  wireEvent(name,value);
  if(name==='flight'){
   if(telemetry?.readyState==='open'){if(telemetry.bufferedAmount<65536)sendWire({kind:'event',name,value},telemetry);}
   else sendWire({kind:'event',name,value});
  }else sendWire({kind:'event',name,value});
 }
 function fail(message){
  if(closed)return;closed=true;active=false;status(message);
  for(const p of waiting.values()){clearTimeout(p.timer);p.reject(Error(message));}waiting.clear();
  try{pc?.close();}catch{}
  if(feed){feed.readyState=2;feed.dispatchEvent(new Event('error'));}
  win.B737UnifiedFlightScenarioV1?.pause?.(true);
 }
 function activate(){
  if(started||!remoteHello||control?.readyState!=='open'||closed)return;
  started=true;active=true;
  if(role==='captain')authority=win.B737PeerAuthorityV2.createAuthority(roomId,emit);
  win.B737PeerRoomV2=Object.freeze({request,feed:createFeed,diagnostics:()=>({role,roomId,connection:pc.connectionState,ice:pc.iceConnectionState,control:control.readyState,telemetry:telemetry?.readyState,rttMs:rtt,waiting:waiting.size})});
  const url=new URL(win.location.href);url.searchParams.set('crewRoom',roomId);history.replaceState(history.state,'',url);
  const script=doc.createElement('script');script.src=new URL('peer-cockpit-v2.js?v='+build,root).href;script.onerror=()=>fail('Native cockpit adapter could not load');doc.head.append(script);
  status('P2P CONNECTED · '+(role==='captain'?'Captain / authority':'First Officer')+' · Close this dialog; Captain loads a new scenario.');
 }
 function hello(){
  if(helloSent||control?.readyState!=='open')return;
  helloSent=true;sendWire({kind:'hello',protocol,build,roomId,role});
 }
 function acceptMessage(event,fromTelemetry=false){
  if(typeof event.data!=='string'||event.data.length>262144){fail('Invalid peer packet');return;}
  let msg;try{msg=JSON.parse(event.data);}catch{return;}
  if(!msg||typeof msg!=='object')return;
  if(fromTelemetry){if(role==='firstOfficer'&&active&&msg.kind==='event'&&msg.name==='flight')wireEvent('flight',msg.value);return;}
  if(msg.kind==='hello'){
   if(msg.protocol!==protocol||msg.build!==build||msg.roomId!==roomId||msg.role===(role)||!['captain','firstOfficer'].includes(msg.role)){fail('Peer release or role mismatch');return;}
   remoteHello=true;hello();activate();return;
  }
  if(!active)return;
  if(msg.kind==='request'&&role==='captain'){
   let body,error;
   try{
    if(!Number.isSafeInteger(msg.id)||!msg.data||typeof msg.action!=='string')throw Error('Invalid request');
    if(msg.action==='cockpit'){if(remoteClient&&remoteClient!==msg.data.client)throw Error('Remote seat already bound');remoteClient=msg.data.client;}
    if(msg.data.client!==remoteClient)throw Error('Wrong peer identity');
    body=authority.request('firstOfficer',msg.action,msg.data);
   }catch(e){error=e.message;}
   try{sendWire({kind:'response',id:msg.id,body,error});}catch(e){fail(e.message);}
  }else if(msg.kind==='response'&&role==='firstOfficer'){
   const p=waiting.get(msg.id);if(!p)return;waiting.delete(msg.id);clearTimeout(p.timer);if(msg.error)p.reject(Error(msg.error));else p.resolve(msg.body);
  }else if(msg.kind==='event'&&role==='firstOfficer'&&['command','snapshot','shared','scenario','flight'].includes(msg.name))wireEvent(msg.name,msg.value);
 }
 function request(action,data){
  if(!active||closed)return Promise.reject(Error('P2P disconnected'));
  localClient=data.client;
  if(role==='captain'){try{return Promise.resolve(authority.request(role,action,data));}catch(e){return Promise.reject(e);}}
  if(waiting.size>=128)return Promise.reject(Error('P2P request limit'));
  return new Promise((resolve,reject)=>{
   const id=++serial,timer=setTimeout(()=>{waiting.delete(id);reject(Error('Peer response timed out'));fail('P2P command timeout — flight paused');},5000);
   waiting.set(id,{resolve,reject,timer});try{sendWire({kind:'request',id,action,data});}catch(e){waiting.delete(id);clearTimeout(timer);reject(e);fail(e.message);}
  });
 }
 function createFeed(){
  if(feed)throw Error('P2P feed already attached');
  feed=new EventTarget();feed.readyState=1;
  setTimeout(async()=>{
   try{
    const data=await request('cockpit',{roomId,client:localClient});
    feed.dispatchEvent(new MessageEvent('roster',{data:JSON.stringify(data)}));
    // Initial state first; commands already present in the initial snapshot are idempotently reconciled.
    if(data.scenario?.active)feed.dispatchEvent(new MessageEvent('scenario',{data:JSON.stringify(data.scenario)}));
    feed.dispatchEvent(new MessageEvent('shared',{data:JSON.stringify(data.shared)}));
    if(data.flight)feed.dispatchEvent(new MessageEvent('flight',{data:JSON.stringify(data.flight)}));
    const events=backlog;backlog=[];
    for(const [name,value] of events)if(name!=='command'||value.sequence>data.shared.sequence)feed.dispatchEvent(new MessageEvent(name,{data:JSON.stringify(value)}));
    feed.dispatchEvent(new Event('open'));
   }catch(e){fail(e.message);}
  },0);
  return feed;
 }
 function attach(ch){
  if(ch.label==='control'){control=ch;ch.addEventListener('open',()=>{hello();activate();});ch.addEventListener('message',acceptMessage);ch.addEventListener('close',()=>fail('P2P disconnected — flight paused'));ch.addEventListener('error',()=>fail('P2P data channel failed'));}
  else if(ch.label==='flight'){telemetry=ch;ch.addEventListener('message',e=>acceptMessage(e,true));}
  else ch.close();
 }
 function make(which,id){
  if(pc)throw Error('Leave / reset before creating another session');
  if(!win.RTCPeerConnection)throw Error('WebRTC unavailable in this browser');
  role=which;roomId=id;pc=new RTCPeerConnection(config);
  pc.addEventListener('datachannel',e=>attach(e.channel));
  pc.addEventListener('connectionstatechange',()=>{if(['failed','closed','disconnected'].includes(pc.connectionState)){if(pc.connectionState==='disconnected')setTimeout(()=>{if(pc.connectionState==='disconnected')fail('Network disconnected — flight paused');},2500);else fail('P2P connection failed. Try another network.');}});
  if(which==='captain'){attach(pc.createDataChannel('control',{ordered:true}));attach(pc.createDataChannel('flight',{ordered:false,maxRetransmits:0}));}
 }
 async function gather(){
  if(pc.iceGatheringState==='complete')return;
  await new Promise(resolve=>{const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve();},check=()=>{if(pc.iceGatheringState==='complete')done();},timer=setTimeout(done,12000);pc.addEventListener('icegatheringstatechange',check);});
 }
 function code(type){el('output').value=wrap({protocol,build,roomId,type,sdp:pc.localDescription.sdp});}
 function parse(type){const v=unwrap(el('input').value);if(v.protocol!==protocol||v.build!==build||v.type!==type||! /^[a-f0-9]{32}$/.test(v.roomId)||typeof v.sdp!=='string'||v.sdp.length>100000)throw Error('Invalid '+type+' code or different release');return v;}
 async function busy(fn){try{for(const k of ['host','join','answer'])el(k).disabled=true;await fn();}catch(e){status(e.message);}finally{for(const k of ['host','join','answer'])el(k).disabled=false;}}
 el('host').onclick=()=>busy(async()=>{make('captain',uid());status('Gathering ICE candidates…');await pc.setLocalDescription(await pc.createOffer());await gather();code('offer');status('Copy this OFFER and send it to First Officer.');});
 el('join').onclick=()=>busy(async()=>{const v=parse('offer');make('firstOfficer',v.roomId);status('Creating answer…');await pc.setRemoteDescription({type:'offer',sdp:v.sdp});await pc.setLocalDescription(await pc.createAnswer());await gather();code('answer');status('Copy this ANSWER and return it to Captain.');});
 el('answer').onclick=()=>busy(async()=>{const v=parse('answer');if(role!=='captain'||v.roomId!==roomId)throw Error('Answer does not match this room');await pc.setRemoteDescription({type:'answer',sdp:v.sdp});status('Connecting…');});
 el('copy').onclick=async()=>{try{await navigator.clipboard.writeText(el('output').value);status('Code copied.');}catch{el('output').select();status('Select and copy the code manually.');}};
 el('close').onclick=()=>dialog.close();el('leave').onclick=()=>{fail('Room ended');const u=new URL(location.href);u.searchParams.delete('crewRoom');location.replace(u.href);};
 el('diag').onclick=async()=>{const d=win.B737CrewDiagnosticsV1?.report?.()||{};let pair=null;try{const stats=await pc?.getStats();stats?.forEach(s=>{if(s.type==='candidate-pair'&&s.state==='succeeded'&&(s.nominated||s.selected))pair=s;});if(pair&&Number.isFinite(pair.currentRoundTripTime))rtt=Math.round(pair.currentRoundTripTime*1000);}catch{}el('stats').textContent=JSON.stringify({...win.B737PeerRoomV2?.diagnostics(),rttMs:rtt,cockpit:d},null,2);};
})(window,document);
