(function (win, doc) {
  'use strict';

  const roomId = new URLSearchParams(win.location.search).get('crewRoom');
  if (!/^[A-Za-z0-9_-]{32}$/.test(roomId ?? '')) return;

  const byId = id => doc.getElementById(id);
  const client = Array.from(crypto.getRandomValues(new Uint8Array(16)),
    n => n.toString(16).padStart(2, '0')).join('');
  const labels = {captain: 'Captain · Left Seat', firstOfficer: 'First Officer · Right Seat',
    instructor: 'Instructor', observer: 'Observer · View Only'};
  const hooked = new WeakSet();
  const queue = [];
  let role = null;
  let controller = null;
  let online = false;
  let replay = false;
  let lastSequence = 0;
  let latestFlight,lastFlightPacket=null,lastFlightAt=0,serverOffset=0,clockSeeded=false,auditBusy=false,pendingWrites=0;
  const clockSequences=new Map();
  const roomNow=()=>Date.now()+serverOffset;
  const crosscheck={altitudeDeltaFt:null,iasDeltaKt:null,headingDeltaDeg:null,lastSampleAgeMs:null,corrections:0};

  let commandWrites = Promise.resolve();
  let requestSerial = 0;
  const outbound=[],pendingOverhead=new Map();
  let writing=false,scenarioGeneration=0,pendingScenario=false;
  let commandSocket=null,socketRetry=null,socketSerial=0;
  const socketBatches=new Map();
  const socketOpen=()=>commandSocket?.readyState===1;
  const transportBusy=()=>writing||outbound.length>0||socketBatches.size>0;
  const ohKey=(type,id)=>['toggle','rotary','guard'].includes(type)?type+':'+id:null;
  let flightWrite = false;
  let flightChangedAt = 0;
  let roster = null;
  let currentOverhead = null;
  let lastPublishedOverhead = null;
  let lastReceivedOverhead = null;
  let snapshotTimer = null;
  let activeScenario = null, reportingScenario = false, lastScenarioReport = '';
  let lastScenarioProbeAt = 0;
  const applyDurations = [], syncFailures = [], networkDurations = [], longTasks = [];
  if (typeof win.PerformanceObserver === 'function' &&
      win.PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    try {
      new win.PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          longTasks.push({at:Number(e.startTime.toFixed(1)),durationMs:Number(e.duration.toFixed(1))});
          if (longTasks.length>90) longTasks.shift();
        }
      }).observe({entryTypes:['longtask']});
    } catch {}
  }
  async function profileRender(durationMs=2500) {
    const duration=Math.min(6000,Math.max(500,Number(durationMs)||2500));
    return new Promise(resolve=>{
      const started=performance.now(),frames=[],longTasksBefore=longTasks.length;
      let previous=null;
      const step=time=>{
        if(previous!==null) frames.push(time-previous);
        previous=time;
        if(time-started<duration){win.requestAnimationFrame(step);return;}
        const ordered=frames.slice().sort((a,b)=>a-b);
        const p95=ordered[Math.max(0,Math.ceil(ordered.length*.95)-1)]??null;
        resolve({durationMs:Number((time-started).toFixed(1)),frames:frames.length,
          approximateFps:frames.length?Number((1000*frames.length/(time-started)).toFixed(1)):0,
          frameP95Ms:p95===null?null:Number(p95.toFixed(1)),
          framesOver50ms:frames.filter(ms=>ms>50).length,
          longTasksObserved:Math.max(0,longTasks.length-longTasksBefore)});
      };
      win.requestAnimationFrame(step);
    });
  }
  let lastSharedSequence = 0, lastAppliedSequence = 0;
  // Physical readiness and network delivery are separate states. This gate
  // is consumed by the FLT PHASE START button and stays local to crew sessions.
  win.B737CrewScenarioReadyV1 = Object.freeze({
    canStart: () => !pendingScenario && (!activeScenario?.active ||
      activeScenario.config?.preset !== 'FINAL_10' || activeScenario.ready === true),
    getState: () => activeScenario ? JSON.parse(JSON.stringify(activeScenario)) : null
  });
  doc.documentElement.dataset.crewRole = 'pending';

  const status = doc.createElement('span');
  status.id = 'crewCockpitStatus';
  status.setAttribute('role', 'status');
  status.textContent = 'Connecting to Crew Room…';
  doc.querySelector('.unified-minimal-header .header-settings')?.append(status);

  function guardInput(event, nested) {
    if (role && role !== 'observer' && (role === 'instructor' || !event.target.closest?.(
      '#workspaceLabsToggle,#workspaceLabsMenu,#failuresHeaderOpen,#failuresHeaderPopover,#unifiedLiveFailurePanel'))) return;
    const source = event.target;
    if (!source.closest) return;
    // Every crew member sees the host's aircraft installation; a guest
    // cannot change just their local EIS/CPCS/737 family and diverge.
    if (role && !roster?.manager && source.closest('#aircraftSettingsOpen,#aircraftSettingsDialog')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!nested && source.closest('#crewRoomDialog,[data-crew-open],[data-focus],#zoomIn,#zoomOut,#zoomReset,#fit,#zoom,#unifiedWelcomeRetry')) return;
    const control = source.closest('button,input,select,textarea,a[href],[role="button"],[role="switch"],[role="slider"],[tabindex]:not([id="viewport"])');
    if (event.type === 'wheel' && (event.ctrlKey || event.metaKey || !control)) return;
    if (event.type === 'touchstart' && event.touches.length > 1) return;
    const keyboard = event.type === 'keydown' || event.type === 'keyup';
    if (!control && !(nested && event.type === 'click')) return;
    if (keyboard && ['Tab', 'Escape'].includes(event.key)) return;
    if (event.type === 'wheel' && /zoom/i.test(control?.id || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function protect(document, nested = false) {
    if (hooked.has(document)) return;
    hooked.add(document);
    for (const type of ['click', 'dblclick', 'pointerdown', 'pointerup', 'touchstart', 'wheel', 'keydown', 'keyup', 'change', 'submit']) {
      document.addEventListener(type, event => guardInput(event, nested), {capture: true, passive: false});
    }
  }

  function syncLabAccess() {
    const labs = byId('workspaceLabsToggle');
    if (labs && role) labs.hidden = role !== 'instructor';
  }

  // Each iframe has its own JS heap and can reload independently of SSE.
  // Reconcile mounted physical owners against the last known shared detents.
  function reconcileMountedOverhead() {
    const expected = lastReceivedOverhead ?? currentOverhead;
    const actual = byId('overheadFrame')?.contentWindow?.B737CrewOverheadV1?.snapshot?.();
    if (!expected || !actual || pendingScenario || (activeScenario?.config?.preset==='FINAL_10'&&!activeScenario.ready)) return;
    for (const [type, groupName] of [['guard','guards'],['rotary','rotaries'],['toggle','toggles']]) {
      for (const [id, state] of Object.entries(expected[groupName] ?? {})) {
        if (JSON.stringify(actual[groupName]?.[id]) === JSON.stringify(state)) continue;
        // A newer queued change for this control always beats the cache.
        if (pendingOverhead.has(ohKey(type,id)) || queue.some(entry => entry.type === type && entry.id === id)) continue;
        const value = type === 'guard' ? {open: state.guard === 'open', value: state.value} : state;
        queue.push({type, id, value, client: 'crew-restore'});
      }
    }
    drain();
  }
  function rememberSharedOverhead(type, id, value) {
    const group = type === 'guard' ? 'guards' : type === 'rotary' ? 'rotaries' :
      type === 'toggle' ? 'toggles' : null;
    const expected = lastReceivedOverhead ?? currentOverhead;
    if (!group || !expected?.[group] || !id) return;
    expected[group][id] = type === 'guard' ?
      {guard: value.open ? 'open' : 'closed', value: value.value} : value;
  }
  function bindFrames() {
    for (const frame of doc.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument) protect(frame.contentDocument, true);
        // The real Overhead is progressively injected after the main photo.
        // Ask the mounted child for a fresh state even if its initial ready
        // event occurred before this crew listener was installed.
        if (frame.id === 'overheadFrame' && frame.hasAttribute('src')) {
          frame.contentWindow?.postMessage({
            type: 'b737:cockpit-command', action: 'crew-sync-request'
          }, win.location.origin);
          drain();
          reconcileMountedOverhead();
        }
      } catch (error) {
        console.warn('Crew Overhead frame handshake deferred', error);
      }
    }
  }
  protect(doc);
  doc.addEventListener('load', event => {
    if (event.target.tagName === 'IFRAME') bindFrames();
  }, true);

  function refreshStatus(message) {
    if (message) {
      status.textContent = message;
      return;
    }
    const duty = role === roster?.flying ? ' · PF' :
      ['captain', 'firstOfficer'].includes(role) ? ' · PM' : '';
    const pending = queue.filter(entry => entry.client !== client).length;
    const connection = !online ? ' · Reconnecting…' : pending ? ' · Sync pending (' + pending + ')' : ' · Connected';
    const phase = activeScenario?.config?.preset === 'FINAL_10' ?
      (activeScenario.ready ? ' · FINAL 10 READY (CPT+FO)' :
        ' · FINAL 10 PREPARING (CPT/FO)') : '';
    const next = (labels[role] ?? 'Crew Room') + duty + connection + phase;
    if (status.textContent !== next) status.textContent = next;
  }

  async function send(action, body = {}) {
    const payload = JSON.stringify({roomId, client, ...body});
    const requestStart = performance.now();
    let retries = 0;
    const retryable = action === 'command' && (typeof body.requestId === 'string' || Array.isArray(body.commands));
    for (;;) {
      let reply;
      try {
        reply = await fetch('/api/crew/' + action, {method: 'POST', cache: 'no-store',
          headers: {'Content-Type': 'application/json'}, body: payload});
      } catch (error) {
        if (!retryable || retries >= 5) throw error;
        await new Promise(resolve => setTimeout(resolve,Math.min(1200,250*2**retries++)));
        continue;
      }
      // The stable requestId prevents duplicate execution even if the first
      // POST committed before a network failure or lost 5xx response.
      if (retryable && (reply.status === 429 || reply.status >= 500) && retries < 5) {
        await new Promise(resolve => setTimeout(resolve,Math.min(1200,250*2**retries++)));
        continue;
      }
      if (!reply.ok) {
        const failure = await reply.json().catch(() => ({}));
        throw Error(failure.error || 'Crew Room connection unavailable.');
      }
      if (action === 'command') {
        networkDurations.push(Number((performance.now()-requestStart).toFixed(2)));
        if (networkDurations.length>400) networkDurations.shift();
      }
      return reply.json();
    }
  }

  function failed(item,error) {
    const {type,id}=item.command,key=ohKey(type,id);
    if(key&&pendingOverhead.get(key)===item.requestId)pendingOverhead.delete(key);
    if(type==='loadFlight')pendingScenario=false;
    syncFailures.push({at:Date.now(),type,id,reason:error.message});
    if(syncFailures.length>60)syncFailures.shift();
    refreshStatus('Sync command failed: '+error.message);
  }
  function acceptResults(batch,reply) {
    if(!Array.isArray(reply.results)||reply.results.length!==batch.length)throw Error('Invalid command batch response');
    batch.forEach((item,n)=>{
      const result=reply.results[n],key=ohKey(item.command.type,item.command.id);
      if(result.error)failed(item,Error(result.error));
      else if(key&&pendingOverhead.get(key)===item.requestId&&result.sequence<=lastSequence)pendingOverhead.delete(key);
    });
  }
  function reconnectCommands() {
    if(socketRetry||role==='observer'||!win.WebSocket)return;
    socketRetry=win.setTimeout(()=>{socketRetry=null;openCommandSocket();},1600);
  }
  function openCommandSocket() {
    if(commandSocket||!role||role==='observer'||!win.WebSocket)return;
    const url=new URL('/api/crew/socket',win.location.href);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    url.searchParams.set('room',roomId);
    url.searchParams.set('client',client);
    let ws;
    try{ws=new win.WebSocket(url);}catch{reconnectCommands();return;}
    commandSocket=ws;
    const connectTimer=win.setTimeout(()=>{if(ws.readyState!==1)ws.close();},5000);
    ws.addEventListener('open',()=>{win.clearTimeout(connectTimer);flushCommands();refreshStatus();});
    ws.addEventListener('message',event=>{
      let response;try{response=JSON.parse(event.data);}catch{ws.close();return;}
      const pending=socketBatches.get(response.id);
      if(!pending)return;
      if(response.status===429||response.status>=500){ws.close();return;}
      socketBatches.delete(response.id);win.clearTimeout(pending.timer);
      try{
        if(response.status!==200)throw Error(response.body?.error||'Crew command rejected');
        acceptResults(pending.batch,response.body);
        networkDurations.push(Number((performance.now()-pending.started).toFixed(2)));
        if(networkDurations.length>400)networkDurations.shift();
      }catch(error){pending.batch.forEach(item=>failed(item,error));}
      flushCommands();publishHostSnapshot();
    });
    ws.addEventListener('error',()=>{try{ws.close();}catch{}});
    ws.addEventListener('close',()=>{
      win.clearTimeout(connectTimer);
      if(commandSocket!==ws)return;
      commandSocket=null;
      const retry=[];
      for(const pending of socketBatches.values()){win.clearTimeout(pending.timer);retry.push(...pending.batch);}
      socketBatches.clear();
      outbound.unshift(...retry);
      flushCommands();reconnectCommands();refreshStatus();
    });
  }
  function flushCommands() {
    if(writing||!outbound.length)return;
    if(socketOpen()){
      while(outbound.length&&socketBatches.size<32&&commandSocket.bufferedAmount<65536){
        const batch=outbound.splice(0,24),id=++socketSerial;
        const pending={batch,started:performance.now(),timer:win.setTimeout(()=>{commandSocket?.close();},5000)};
        socketBatches.set(id,pending);
        try{commandSocket.send(JSON.stringify({id,commands:batch}));}
        catch{commandSocket.close();break;}
      }
      return;
    }
    if(socketBatches.size)return;
    writing=true;
    // HTTP fallback preserves FIFO and idempotent request IDs.
    (async()=>{
      while(outbound.length&&!socketOpen()){
        const batch=outbound.splice(0,24);
        try{acceptResults(batch,await send('command',{commands:batch}));}
        catch(error){batch.forEach(item=>failed(item,error));}
      }
    })().finally(()=>{writing=false;if(outbound.length)flushCommands();publishHostSnapshot();});
  }
  function command(type,id,value) {
    if(!role||role==='observer'||replay||value===undefined||value===null)return;
    const requestId=client+'-'+(++requestSerial).toString(36),key=ohKey(type,id);
    if(key)pendingOverhead.set(key,requestId);
    if(type==='loadFlight')pendingScenario=true;
    rememberSharedOverhead(type,id,value);
    outbound.push({requestId,command:{type,id,value}});
    flushCommands();
  }
  function publishHostSnapshot() {
    if (snapshotTimer || transportBusy() || !roster?.manager || !online || !currentOverhead || pendingScenario || (activeScenario?.config?.preset==='FINAL_10'&&!activeScenario.ready)) return;
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      if (transportBusy() || !roster?.manager || !online || !currentOverhead || pendingScenario || (activeScenario?.config?.preset==='FINAL_10'&&!activeScenario.ready)) return;
      const overhead = currentOverhead;
      const serialized = JSON.stringify(overhead);
      if (serialized === lastPublishedOverhead) return;
      lastPublishedOverhead = serialized;
      // Preserve ordering with all interactive changes already accepted locally.
      send('snapshot', {overhead})
        .catch(error => { lastPublishedOverhead = null; refreshStatus(error.message); });
    }, 350);
  }

  const flight = () => win.B737UnifiedFlightScenarioV1;
  const radio = () => win.B737UnifiedVHFDualV1;
  function available(entry) {
    if (['toggle', 'rotary', 'guard'].includes(entry.type)) {
      return byId('overheadFrame')?.contentWindow?.B737CrewOverheadV1?.ready();
    }
    if (['loadFlight', 'flightTargets', 'pauseFlight', 'stopFlight'].includes(entry.type)) return flight();
    if (entry.type === 'profile') return win.B737AircraftProfileStore;
    if (entry.type === 'cdu') return byId('cduFrame' + entry.id)?.contentWindow?.B737CrewCduV1;
    if (entry.type === 'frequency') return radio()?.getState(entry.id);
    if (entry.type === 'commTransfer') return win.B737UnifiedVHFCommTFRV1;
    if (entry.type === 'navMode') return win.B737UnifiedVHFNavControlsV1;
    if (entry.type === 'firePanel') return typeof win.B737UnifiedFireLights?.dispatch === 'function';
    if (entry.type === 'efis') return typeof win.B737UnifiedEFISPedestalV1?.operate === 'function';
    if (entry.type === 'clock') return !!win.B737ClassicClockPhotoV3?.snapshot?.(entry.id);
    if (entry.type === 'sixpack') return !!win.B737SixPack;
    if (entry.type === 'mcpValue') return typeof win.B737McpAFDSBridgeV1?.applyCrewControl === 'function';
    if (entry.type === 'mcpHardware') return typeof win.B737McpAFDSBridgeV1?.applyCrewControl === 'function';
    if (entry.type === 'mcpMode') return typeof win.B737McpAFDSBridgeV1?.press === 'function';
    if (entry.type === 'autobrake') return typeof win.B737AutobrakeUnified?.setSelector === 'function';
    if (entry.type === 'trim') return typeof win.B737StabilizerTrim?.set === 'function';
    if (entry.type === 'cb') return typeof win.B737UnifiedCB?.snapshot === 'function' &&
      !!win.B737UnifiedCircuitGatesV1?.STORAGE;
    if (entry.type === 'flap') return win.B737FlapVisualTest?.ready();
    if (entry.type === 'speedbrake') return win.B737SpeedbrakeLever?.mounted();
    if (entry.type === 'throttle') return win.B737ThrottlePositions?.mounted();
    if (entry.type === 'startLever') return win.B737EngineStartLevers;
    if (entry.type === 'gear') return win.B737LandingGearUnifiedV1;
    if(entry.type==='engineFailure')return !!win.B737ISNCockpitV1?.injectFlightEngineFailure;
    if (entry.type === 'failure' || entry.type === 'failureScenario') {
      return win.B737UnifiedInstructorNonNormalV1 && win.B737UnifiedAdvancedInstructorV1;
    }
    return true;
  }

  function apply(entry) {
    const {type, id, value} = entry;
    switch (type) {
      case 'toggle':
      case 'rotary':
      case 'guard':
        return byId('overheadFrame').contentWindow.B737CrewOverheadV1.apply(type, id, value);
      case 'profile': win.B737AircraftProfileStore.set(value); break;
      case 'cdu': byId('cduFrame' + id).contentWindow.B737CrewCduV1.press(value); break;
      case 'efis': {
        const [seat, key] = id.split('.');
        win.B737UnifiedEFISPedestalV1.operate(seat, key, value);
        break;
      }
      case 'frequency': radio().setFrequency(id, value); break;
      case 'commTransfer': win.B737UnifiedVHFCommTFRV1.setActive(id, value); break;
      case 'navMode': win.B737UnifiedVHFNavControlsV1.setMode(id, value); break;
      case 'autobrake': win.B737AutobrakeUnified?.setSelector(value); break;
      case 'trim': win.B737StabilizerTrim?.set(value, id); break;
      case 'firePanel':
        if (['SELECT_LOOP','PULL','ROTATE','OVERRIDE','BELL_CUTOUT','TEST','EXT_TEST'].includes(id)) {
          const native = {...value, type: id};
          if (value.released) native.value = null;
          win.B737UnifiedFireLights.dispatch(native);
        }
        break;
      case 'cb': {
        const current = win.B737UnifiedCB?.snapshot();
        const key = win.B737UnifiedCircuitGatesV1?.STORAGE;
        if (!current || !key) return false;
        const old = current.breakers.find(entry => entry.id === id);
        if (old && !value && old.fault) break;
        if (value) lastBreakers.add(id);
        else lastBreakers.delete(id);
        current.breakers = current.breakers.filter(entry => entry.id !== id);
        if (value) current.breakers.push({id, pulled: true, tripped: old?.tripped ?? false, fault: old?.fault ?? null});
        localStorage.setItem(key, JSON.stringify(current));
        win.B737UnifiedCB.refresh();
        break;
      }
      case 'mcpValue':
      case 'mcpHardware': return win.B737McpAFDSBridgeV1.applyCrewControl(type,id,value);
      case 'clock': {
        const ok=win.B737ClassicClockPhotoV3.apply(id,value,Math.max(0,roomNow()-value.at));
        if(ok)clockSequences.set(id,entry.sequence??0);
        return ok;
      }
      case 'sixpack': {
        const owner=win.B737SixPack;
        if(id==='ack')owner.acknowledge('crew-replay');
        else if(id==='fireAck')owner.acknowledgeFire('crew-replay');
        else if(id==='recall')owner.recall(value);
        else if(id==='hold')owner.press(value);
        else if(id==='release')owner.release(value);
        return true;
      }

      case 'mcpMode': win.B737McpAFDSBridgeV1?.press(id); break;
      case 'throttle': win.B737ThrottlePositions.set(Number(id), value); break;
      case 'flap': return win.B737FlapVisualTest.request(value,{crewReplay:true});
      case 'gear': win.B737LandingGearUnifiedV1.select(id, {lockOverride: value}); break;
      case 'speedbrake': win.B737SpeedbrakeLever.set(value); break;
      case 'startLever': win.B737EngineStartLevers.request(id, value); break;
      case 'toga': win.dispatchEvent(new CustomEvent('b737:toga-request', {detail: {source: id}})); break;
      case 'loadFlight': flight().loadScenario(value,{crewReplay:true}); scenarioGeneration=Math.max(scenarioGeneration,entry.sequence??0); break;
      case 'flightTargets':
        if (flight().getState()) {
          flight().command({type: 'SPEED', value: value.speedKt});
          flight().command({type: 'HEADING', value: value.headingDeg});
          if (Math.abs(flight().getState().altitudeFt - value.altitudeFt) > 50) {
            flight().command({type: 'ALTITUDE', value: value.altitudeFt});
          }
        }
        break;
      case 'pauseFlight': flight().pause(value); break;
      case 'stopFlight': flight().stop(); break;
      case 'engineFailure': {
        const owner=win.B737ISNCockpitV1;
        if(owner.getPropulsionSnapshot?.()?.engines?.[id]?.flightFailure===value)return true;
        return owner.injectFlightEngineFailure({engine:id,type:value})?.accepted===true;
      }
      case 'failure': {
        const [group, fault] = id.split('.');
        if (group === 'advanced') win.B737UnifiedAdvancedInstructorV1.setFailure(id.slice(9), value);
        else if (fault) win.B737UnifiedInstructorNonNormalV1.toggle(group, fault, value);
        break;
      }
      case 'failureScenario':
        if (id.startsWith('advanced.')) win.B737UnifiedAdvancedInstructorV1.launchScenario(id.slice(9), value);
        else win.B737UnifiedInstructorNonNormalV1.startScenario(id, value);
        break;
      default: return false;
    }
    return true;
  }

  function receiveHostSnapshot(snapshot) {
    if (snapshot.client === client || !Number.isSafeInteger(snapshot.sequence) ||
        snapshot.sequence < lastSequence || !snapshot.overhead) return;
    const {toggles, rotaries, guards} = snapshot.overhead;
    if (!toggles || !rotaries || !guards) return;
    // A snapshot covers overhead only. It must never discard pending MCP,
    // flight or CDU commands waiting for independent instruments to hydrate.
    lastSequence = Math.max(lastSequence, snapshot.sequence);
    const previous = lastReceivedOverhead;
    // Check the real child owner's detents, not only the last SSE message.
    // A stale local storage value or a recreated iframe needs correction
    // even when the host snapshot JSON itself has not changed.
    const installed = byId('overheadFrame')?.contentWindow?.B737CrewOverheadV1?.snapshot?.();
    for (const [type, group] of [['guard', guards], ['rotary', rotaries], ['toggle', toggles]]) {
      const groupName = type === 'guard' ? 'guards' : type === 'rotary' ? 'rotaries' : 'toggles';
      for (const [id, value] of Object.entries(group)) {
        const desired = type === 'guard' ? {guard: value.guard, value: value.value} : value;
        const previouslySent = previous &&
          JSON.stringify(previous[groupName]?.[id]) === JSON.stringify(desired);
        const alreadyApplied = installed &&
          JSON.stringify(installed[groupName]?.[id]) === JSON.stringify(desired);
        if (alreadyApplied || pendingOverhead.has(ohKey(type,id))) continue;
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i].type === type && queue[i].id === id &&
              (queue[i].sequence === undefined || queue[i].sequence <= snapshot.sequence)) {
            queue.splice(i, 1);
          }
        }
        queue.push({type, id, value: type === 'guard' ?
          {open: value.guard === 'open', value: value.value} : value});
      }
    }
    lastReceivedOverhead = snapshot.overhead;
    drain();
  }

  // The latest room projection is authoritative; never replay stale
  // historical A/B toggles over a newer switch state after reconnect.
  function receiveShared(shared) {
    if (!Number.isSafeInteger(shared?.sequence) || !shared.overhead ||
        shared.sequence < lastSharedSequence) return;
    lastSharedSequence = shared.sequence;
    lastSequence = Math.max(lastSequence, shared.sequence);
    lastReceivedOverhead = shared.overhead;
    const actual = byId('overheadFrame')?.contentWindow?.B737CrewOverheadV1?.snapshot?.();
    const push = (entry, actualValue, desired) => {
      if(pendingOverhead.has(ohKey(entry.type,entry.id)))return;
      for (let i=queue.length-1;i>=0;i--) {
        if (queue[i].type === entry.type && queue[i].id === entry.id &&
            (queue[i].sequence === undefined || queue[i].sequence <= shared.sequence))
          queue.splice(i,1);
      }
      if (JSON.stringify(actualValue) !== JSON.stringify(desired))
        queue.push({...entry,client:'crew-shared',sequence:shared.sequence});
    };
    for (const [type,name] of [['guard','guards'],['rotary','rotaries'],['toggle','toggles']]) {
      for (const [id, state] of Object.entries(shared.overhead[name] ?? {})) {
        push({type,id,value:type==='guard' ?
          {open:state.guard==='open',value:state.value}:state},actual?.[name]?.[id],state);
      }
    }
    // One latest value per instrument; never include non-idempotent button
    // presses such as TOGA or CDU keystrokes in this state projection.
    for (const entry of shared.controls ?? []) {
      const existing = queue.findIndex(item=>item.type===entry.type&&item.id===entry.id&&
        (item.sequence===undefined||item.sequence<=shared.sequence));
      if (existing!==-1) queue.splice(existing,1);
      if(entry.type==='clock'&&(clockSequences.get(entry.id)??-1)>=entry.sequence)continue;
      if(entry.type==='mcpValue'&&win.B737McpAFDSBridgeV1?.getOutput?.()?.values?.[entry.id]===entry.value&&win.B737McpVisualV3?.getState?.()?.[entry.id]===entry.value)continue;
      if(entry.type==='mcpHardware'&&['CO','SPD_INTV','ALT_INTV'].includes(entry.id))continue;
      if(entry.type==='mcpHardware'&&win.B737McpHardwareV1?.getState?.()?.[entry.id]===entry.value)continue;
      queue.push({...entry,client:'crew-shared'});
    }
    drain();
  }
  function receiveScenario(scenario) {
    const previousGeneration = activeScenario?.generation ?? null;
    activeScenario = scenario?.active ? scenario : null;
    if ((activeScenario?.generation ?? null) !== previousGeneration)
      lastScenarioReport = '';
    if(activeScenario&&activeScenario.generation>scenarioGeneration&&!queue.some(item=>item.type==='loadFlight'&&item.sequence===activeScenario.generation)){
      queue.push({type:'loadFlight',id:'flight',value:activeScenario.config,sequence:activeScenario.generation,client:'crew-scenario'});
    }
    drain();
    refreshStatus();
    publishHostSnapshot();
    reportScenarioReadiness();
  }
  function reportScenarioReadiness() {
    if (!online || reportingScenario || !['captain','firstOfficer'].includes(role) ||
        !activeScenario?.active || activeScenario.config?.preset !== 'FINAL_10' || scenarioGeneration!==activeScenario.generation) return;
    const now=performance.now();
    if (now-lastScenarioProbeAt < 750) return;
    lastScenarioProbeAt=now;
    const sc=activeScenario, flightState=flight()?.getState?.();
    const config=sc.config;
    const matching=flightState?.preset === config.preset &&
      flightState?.icao === config.airport && flightState?.runway === config.runway;
    const check=matching?win.B737Final10ApproachPresetV1?.getStatus?.():null;
    const missing=matching && check && Array.isArray(check.missing) ?
      check.missing.slice(0,64) : ['SCENARIO_OWNER_NOT_READY'];
    const complete=matching && check?.complete===true && missing.length===0;
    const key=JSON.stringify({generation:sc.generation,complete,missing});
    if (lastScenarioReport === key) return;
    reportingScenario = true;
    send('scenarioStatus',{generation:sc.generation,complete,missing})
      .then(()=>{lastScenarioReport=key;})
      .catch(error=>{
        if (!/flight scenario has changed/i.test(error.message)) {
          syncFailures.push({at:Date.now(),type:'scenarioStatus',reason:error.message});
          if (syncFailures.length>60) syncFailures.shift();
        }
      })
      .finally(()=>{reportingScenario=false;});
  }
  function receiveFlight() {
    if (!latestFlight || !flight() || pendingScenario || (activeScenario&&scenarioGeneration<activeScenario.generation) || queue.some(entry =>
      ['profile', 'loadFlight', 'flightTargets', 'pauseFlight', 'stopFlight'].includes(entry.type))) return;
    const update = latestFlight;
    latestFlight = null;
    lastFlightPacket=update;lastFlightAt=performance.now();
    if (update.client !== client && role !== controller) flight().followCrew(update.state, update.paused);
  }

  function crossCheckFlight(){
    if(!lastFlightPacket||role===controller||!flight()?.getState||queue.some(e=>['profile','loadFlight','stopFlight','pauseFlight','flightTargets'].includes(e.type)))return;
    const expected=lastFlightPacket.state,actual=flight().getState();
    crosscheck.lastSampleAgeMs=Math.round(performance.now()-lastFlightAt);
    if(!actual||crosscheck.lastSampleAgeMs>2500)return;
    crosscheck.altitudeDeltaFt=actual.altitudeFt-expected.altitudeFt;
    crosscheck.iasDeltaKt=actual.iasKt-expected.iasKt;
    crosscheck.headingDeltaDeg=((actual.trueHeadingDeg-expected.trueHeadingDeg+540)%360)-180;
    if(Math.abs(crosscheck.altitudeDeltaFt)>1||Math.abs(crosscheck.iasDeltaKt)>.1||Math.abs(crosscheck.headingDeltaDeg)>.1){
      flight().followCrew(expected,lastFlightPacket.paused);crosscheck.corrections++;
    }
  }
  async function auditShared(){
    if(!online||auditBusy||(transportBusy()||pendingScenario)||(activeScenario?.config?.preset==='FINAL_10'&&!activeScenario.ready))return;
    auditBusy=true;const before=Date.now();
    try{
      const data=await send('cockpit');const after=Date.now();
      if(Number.isFinite(data.serverAt))serverOffset=data.serverAt-(before+after)/2;
      if(!(transportBusy()||pendingScenario)&&data.shared?.sequence===lastSequence){
        receiveShared({...data.shared,controls:(data.shared.controls??[]).filter(e=>['clock','mcpValue','mcpHardware'].includes(e.type))});
        if(!clockSeeded&&roster?.manager){
          const seats=['captain','firstOfficer'];const missing=seats.filter(seat=>!data.shared.controls?.some(e=>e.type==='clock'&&e.id===seat));
          if(missing.every(seat=>win.B737ClassicClockPhotoV3?.snapshot?.(seat))){
            clockSeeded=true;for(const seat of missing){const value=win.B737ClassicClockPhotoV3.snapshot(seat);value.at=roomNow();command('clock',seat,value);}
          }
        }
      }
      if(!pendingScenario&&data.flight&&role!==controller&&(!lastFlightPacket||data.flight.serverAt>lastFlightPacket.serverAt)){latestFlight=data.flight;receiveFlight();}
    }catch(error){syncFailures.push({at:Date.now(),type:'audit',reason:error.message});if(syncFailures.length>60)syncFailures.shift();}
    finally{auditBusy=false;}
  }
  function drain() {
    // Do not lose a remote command because its instrument has not mounted.
    // Commands for unrelated controls may pass a pending instrument.
    const blocked = new Set();
    let changed = false;
    for (let index = 0; index < queue.length;) {
      const entry = queue[index];
      const key = entry.type + ':' + entry.id;
      if (entry.client === client && entry.type!=='clock') {
        const oh=ohKey(entry.type,entry.id);
        if(oh&&pendingOverhead.get(oh)===entry.requestId)pendingOverhead.delete(oh);
        if(['loadFlight','stopFlight','failureScenario'].includes(entry.type)){lastFlightPacket=null;latestFlight=null;lastFlightAt=0;}
        if(entry.type==='loadFlight'){scenarioGeneration=entry.sequence;pendingScenario=false;}
        queue.splice(index, 1);
        changed = true;
        continue;
      }
      if(pendingOverhead.has(ohKey(entry.type,entry.id))){queue.splice(index,1);changed=true;continue;}
      if(entry.type!=='loadFlight'&&queue.some(other=>other.type==='loadFlight'&&other.sequence!==undefined&&(entry.sequence??0)>other.sequence)){index++;continue;}
      if (blocked.has(key) || (entry.retryAt && performance.now() < entry.retryAt) || !available(entry)) {
        blocked.add(key);
        index++;
        continue;
      }
      replay = true;
      try {
        const started = performance.now();
        if (apply(entry) === false) throw Error('Control declined the remote value');
        // Explicitly verify the installed switch owner's real detent before
        // acknowledging that a replicated Overhead change was successful.
        if (['toggle','rotary','guard'].includes(entry.type)) {
          const observed=byId('overheadFrame')?.contentWindow?.B737CrewOverheadV1?.snapshot?.();
          const group=entry.type==='toggle'?'toggles':entry.type==='rotary'?'rotaries':'guards';
          const target=entry.type==='guard' ?
            {guard:entry.value.open?'open':'closed',value:entry.value.value}:entry.value;
          if (JSON.stringify(observed?.[group]?.[entry.id])!==JSON.stringify(target))
            throw Error('Physical Overhead detent mismatch');
          if (Number.isSafeInteger(entry.sequence) &&
              !['crew-shared','crew-restore'].includes(entry.client)) {
            send('applied',{sequence:entry.sequence,status:'VERIFIED'})
              .catch(error=>{
                syncFailures.push({at:Date.now(),type:'applied',reason:error.message});
                if (syncFailures.length>60) syncFailures.shift();
              });
          }
        }
        applyDurations.push(Number((performance.now()-started).toFixed(2)));
        if (applyDurations.length>400) applyDurations.shift();
        lastAppliedSequence=Math.max(lastAppliedSequence,entry.sequence??0);
        queue.splice(index, 1);
        changed = true;
      } catch (error) {
        const now = performance.now();
        entry.retryAt = now + 400;
        if (!entry.lastWarning || now - entry.lastWarning > 10000) {
          entry.lastWarning = now;
          console.warn('Crew cockpit command pending; will retry', entry.type, entry.id, error.message);
          syncFailures.push({at:Date.now(),type:entry.type,id:entry.id,reason:error.message});
          if (syncFailures.length>60) syncFailures.shift();
        }
        blocked.add(key);
        index++;
      } finally {
        replay = false;
      }
    }
    receiveFlight();
    if (changed) refreshStatus();
  }

  function readRoster(data) {
    roster = {...roster, ...data};
    const previous=controller;controller = data.controller;
    if(previous!==controller&&role===controller&&lastFlightPacket&&flight()?.followCrew)flight().followCrew(lastFlightPacket.state,lastFlightPacket.paused);
    flight()?.crewFollower(role !== controller);
    refreshStatus();
    syncLabAccess();
    publishHostSnapshot();
  }

  win.addEventListener('message', event => {
    if (event.origin !== win.location.origin) return;
    const data = event.data;
    if (data?.type === 'b737:cockpit-overhead' && data.kind === 'controls-state' &&
        event.source === byId('overheadFrame')?.contentWindow) {
      if (data.toggles && data.rotaries && data.guards) {
        currentOverhead = {toggles: data.toggles, rotaries: data.rotaries, guards: data.guards};
        if (!replay) publishHostSnapshot();
        // Never reconcile a local input against an older host state on every child report.
      }
      return;
    }
    if (data?.type === 'b737:cb-state-changed' && event.source === byId('cbPanelFrame')?.contentWindow) {
      const state = win.B737UnifiedCB?.snapshot();
      const next = new Set(state?.breakers.filter(entry => entry.pulled || entry.tripped).map(entry => entry.id));
      for (const id of next) if (!lastBreakers.has(id)) command('cb', id, true);
      for (const id of lastBreakers) if (!next.has(id)) command('cb', id, false);
      lastBreakers = next;
      return;
    }
    if (data?.type === 'b737:unified-cdu' && data.kind === 'crew-key' &&
        ['CAPT', 'FO'].includes(data.seat) && event.source === byId('cduFrame' + data.seat)?.contentWindow) {
      command('cdu', data.seat, data.key);
      return;
    }
    if (event.source !== byId('overheadFrame')?.contentWindow) return;
    if (data?.type === 'b737:cockpit-overhead' && data.kind === 'ready') {
      // Request an explicit full-state snapshot after the child finishes
      // hydration, instead of waiting for a future pilot switch input.
      event.source.postMessage({type:'b737:cockpit-command',
        action:'crew-sync-request'}, win.location.origin);
      drain();
      reconcileMountedOverhead();
      return;
    }
    if (data?.type !== 'b737:cockpit-overhead' || data.kind !== 'control-event' || data.crewReplay) return;
    const {kind, id, next, reason} = data.event ?? {};
    if (['meter-owner-sync', 'aircon-variant-change', 'ISN03_STARTER_CUTOUT', 'flight-scenario-instructor'].includes(reason)) return;
    if (kind === 'guarded' && next) command('guard', id, {open: next.guard === 'open', value: next.value});
    if (kind === 'toggle' || kind === 'rotary') command(kind, id, next);
  });

  const listen = (target, name, project) => target.addEventListener(name, event => project(event.detail ?? {}));
  listen(win, 'b737:aircraft-profile-change', d => {
    if (d.reason === 'updated' && roster?.manager) {
      command('profile', 'aircraft', d.profile);
      // The newly selected airframe may alter valid Overhead detents/artwork.
      // Re-publish its settled switches after the profile command.
      lastPublishedOverhead = null;
      publishHostSnapshot();
    }
  });
  listen(win, 'b737:unified-efis-control', d => {
    const key = d.control;
    if (key && key !== 'engine-view') command('efis', d.seat + '.' + key,
      key === 'rst' ? true : d.state[key] ?? d.state.brightness[key] ?? d.state.options[key]);
  });
  let lastBreakers = new Set((win.B737UnifiedCB?.snapshot?.()?.breakers || []).map(entry => entry.id));
  let lastAutobrake = win.B737AutobrakeUnified?.getState?.()?.selector;
  listen(win, 'b737:autobrake-state', d => {
    if (d.selector !== lastAutobrake) command('autobrake', 'selector', d.selector);
    lastAutobrake = d.selector;
  });
  listen(win, 'b737:stabilizer-trim-position', d => {
    if (['MANUAL', 'MAIN_ELECTRIC'].includes(d.source)) command('trim', d.source, d.units);
  });
  listen(win, 'b737:unified-vhf-frequency', d => {
    if (d.part !== 'external') command('frequency', d.id, d.frequencyKhz);
  });
  listen(win, 'b737:vhf-comm-tfr', d => {
    if (d.reason === 'transfer') command('commTransfer', d.seat, d.activeSide);
  });
  listen(win, 'b737:vhf-nav-mode', d => {
    if (d.reason === 'select') command('navMode', d.seat, d.mode);
  });
  listen(win, 'b737:crew-fire-panel-command', d => {
    const {type, ...native} = d;
    if (native.value === null) {
      delete native.value;
      native.released = true;
    }
    command('firePanel', type, native);
  });
  listen(win,'b737:crew-clock-control',d=>{if(d.state){command('clock',d.seat,{...d.state,at:roomNow()});}});
  listen(win,'b737:sixpack-acknowledge',d=>{if(d.source!=='crew-replay')command('sixpack','ack','CAPT');});
  listen(win,'b737:sixpack-fire-acknowledge',d=>{if(d.source!=='crew-replay')command('sixpack','fireAck','CAPT');});
  listen(win,'b737:sixpack-recall',d=>command('sixpack','recall',d.side));
  listen(win,'b737:sixpack-lamp-test',d=>command('sixpack',d.held?'hold':'release',d.side));
  listen(win, 'b737:mcp-value-change', d => {
    if (d.method !== 'external') command('mcpValue', d.control, d.value);
  });
  listen(win, 'b737:mcp-hardware-change', d => {
    if (d.method !== 'external') command('mcpHardware', d.id, d.value);
  });
  listen(win, 'b737:mcp-button-request', d => command('mcpMode', d.id, true));
  listen(doc, 'b737:throttle-position', d => command('throttle', String(d.engine), d.percent));
  listen(doc, 'b737:flap-lever-command', d => {
    if (!d.crewReplay) command('flap','flap',d.detent);
  });
  // Source of truth for a pilot-selected Flap is the DETENT actually reached
  // after crossing mechanical gates 1 and 15, not the requested target.
  listen(doc, 'b737:flap-lever-settled', d => {
    if (!d.crewReplay) command('flap','flap',d.detent);
  });
  listen(doc, 'b737:speedbrake-position', d => command('speedbrake', 'speedbrake', d.position));
  listen(win, 'b737:landing-gear-command', d => command('gear', d.position, d.lockOverride));
  listen(win, 'b737:engine-start-lever-command', d => command('startLever', d.device, d.position));
  listen(win, 'b737:toga-request', d => command('toga', d.source, true));
  listen(win, 'b737:crew-flight-command', d => command(d.type, 'flight', d.value));
  listen(win,'b737:crew-engine-failure',d=>{if(role==='instructor')command('engineFailure',d.engine,d.type);});
  listen(win, 'b737:instructor-failure-change', d => {
    if (role === 'instructor') command('failure', d.group + '.' + d.id, d.active);
  });
  let advancedFaults = new Set();
  listen(win, 'b737:advanced-failures-changed', d => {
    const next = new Set(d.failures);
    if (role === 'instructor') {
      for (const id of next) if (!advancedFaults.has(id)) command('failure', 'advanced.' + id, true);
      for (const id of advancedFaults) if (!next.has(id)) command('failure', 'advanced.' + id, false);
    }
    advancedFaults = next;
  });
  listen(win, 'b737:instructor-scenario-loaded', d => {
    if (role !== 'instructor' || !d.id) return;
    command('failureScenario', 'advanced.' + d.id, {...(d.cause && {cause: d.cause}),
      ...(d.severity && {severity: d.severity})});
  });
  listen(win, 'b737:instructor-scenario-change', d => {
    const names = {EMERGENCY_DESCENT: 'emergency', BOTH_BUS_OFF_CLIMB: 'bothBus', HYDRAULIC_LOSS_CRUISE: 'hydraulic'};
    if (role !== 'instructor' || !names[d.id]) return;
    command('failureScenario', names[d.id], {...(d.cause && {cause: d.cause}),
      ...(d.severity && {severity: d.severity}), ...(d.failure && {system: d.failure})});
  });
  listen(win, 'b737:flight-scenario-state', state => {
    const time = performance.now();
    if (!online || replay || pendingScenario || role !== controller || !state?.target || flightWrite || time - flightChangedAt < 200) return;
    flightChangedAt = time;
    flightWrite = true;
    send('flight', {state, paused: flight().getDiagnostics().paused})
      .catch(error=>{syncFailures.push({at:Date.now(),type:'flight',reason:error.message});if(syncFailures.length>60)syncFailures.shift();}).finally(()=>{flightWrite=false;});
  });

  async function connect() {
    try {
      const started=Date.now();const data=await send('cockpit');
      if(Number.isFinite(data.serverAt))serverOffset=data.serverAt-(started+Date.now())/2;
      role = data.role;
      doc.documentElement.dataset.crewRole = role;
      readRoster(data);
      // This initial view is provisional; the SSE shared event that follows
      // becomes authoritative after all replay traffic and host snapshots.
      // Apply the scenario only after ordered SSE command replay.
      const url = new URL('/api/crew/events', win.location.href);
      url.searchParams.set('room', roomId);
      url.searchParams.set('cockpit', '1');
      const feed = new EventSource(url);
      feed.addEventListener('open', () => {
        online = true; refreshStatus(); openCommandSocket(); flushCommands(); publishHostSnapshot();
      });
      feed.addEventListener('roster', event => readRoster(JSON.parse(event.data)));
      feed.addEventListener('snapshot', event => receiveHostSnapshot(JSON.parse(event.data)));
      feed.addEventListener('shared', event => receiveShared(JSON.parse(event.data)));
      feed.addEventListener('scenario', event => receiveScenario(JSON.parse(event.data)));
      feed.addEventListener('command', event => {
        const entry = JSON.parse(event.data);
        if (entry.sequence <= lastSequence) return;
        lastSequence = entry.sequence;
        if(entry.type==='loadFlight'){
          lastReceivedOverhead=null;lastPublishedOverhead=null;latestFlight=null;
          for(let n=queue.length-1;n>=0;n--)if(queue[n].sequence===undefined||(queue[n].sequence<entry.sequence&&['loadFlight','flightTargets','pauseFlight','stopFlight','flap','gear','autobrake','speedbrake','throttle','startLever','mcpMode','mcpValue','mcpHardware','trim','frequency','navMode','commTransfer','engineFailure'].includes(queue[n].type)))queue.splice(n,1);
        }
        queue.push(entry);
        if (['toggle','rotary','guard'].includes(entry.type))
          rememberSharedOverhead(entry.type, entry.id, entry.value);
        drain();
      });
      feed.addEventListener('flight', event => {
        latestFlight = JSON.parse(event.data);
        receiveFlight();
      });
      feed.addEventListener('error', () => {
        online = false;refreshStatus();
        if (feed.readyState === EventSource.CLOSED) refreshStatus('Crew Room disconnected. Rejoin to continue.');
      });
      setInterval(() => {drain();flushCommands();syncLabAccess();reportScenarioReadiness();crossCheckFlight();}, 120);
      setInterval(()=>{if(!pendingScenario&&!transportBusy()){reconcileMountedOverhead();auditShared();}},2000);
      bindFrames();
    } catch (error) {
      refreshStatus(error.message);
    }
  }

  win.B737CrewDiagnosticsV1 = Object.freeze({
    profileRender,
    report: () => {
      const sorted=[...applyDurations].sort((a,b)=>a-b);
      const network=[...networkDurations].sort((a,b)=>a-b);
      const quantile=(numbers,f)=>numbers.length ? numbers[Math.max(0,Math.ceil(numbers.length*f)-1)] : null;
      return {online,role,controller,lastSequence,lastSharedSequence,lastAppliedSequence,
        transport:socketOpen()?'WEBSOCKET':'HTTP_FALLBACK',socketInflight:socketBatches.size,
        outbound:outbound.length,pendingOverhead:pendingOverhead.size,scenarioGeneration,
        queued:queue.map(e=>({sequence:e.sequence??null,type:e.type,id:e.id,
          retryAt:e.retryAt??null})),applyP50Ms:quantile(sorted,.5),applyP95Ms:quantile(sorted,.95),
        applyP99Ms:quantile(sorted,.99),networkP50Ms:quantile(network,.5),
        networkP95Ms:quantile(network,.95),networkP99Ms:quantile(network,.99),
        recentLongTasks:longTasks.slice(),failures:syncFailures.slice(),
        crosscheck:{...crosscheck,stale:role!==controller&&(!lastFlightAt||performance.now()-lastFlightAt>2500)},
        scenario:win.B737CrewScenarioReadyV1.getState(),
        final10:win.B737Final10ApproachPresetV1?.getStatus?.()??null};
    }
  });
  connect();
})(window, document);
