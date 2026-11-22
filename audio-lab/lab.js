/* Standalone warning-logic lab. No synthesized sound or browser TTS; only owner-assigned recordings can play. */
(() => {
  "use strict";
  const { WarningEngine } = window.B737WarningEngine;
  const { RealAudioBank, keyFor, validAudioFile } = window.B737RealAudioBank;
  const realBank = new RealAudioBank();
  const ownerRA = window.B737OwnerRACallouts ? new window.B737OwnerRACallouts.Player() : null;
  let realReady = false;
  let model = new WarningEngine({ variant: "737-300" });
  let log = [];
  const byId = id => document.getElementById(id);
  const SOUND_TESTS = [
    ["altitude", "Altitude Alert — Acquisition", "Unassigned — awaiting owner definition", "ALTITUDE ACQUISITION"],
    ["intermittentHorn", "Takeoff Config", "Unassigned — awaiting owner definition", null],
    ["intermittentHorn", "Cabin Altitude", "Unassigned — awaiting owner definition", null],
    ["gearHorn", "Landing Gear", "Unassigned — awaiting owner definition", null],
    ["fireBell", "Fire Warning", "Unassigned — awaiting owner definition", null],
    ["overspeed", "Mach/Airspeed", "Unassigned — awaiting owner definition", null],
    ["shaker", "Stall", "Unassigned — awaiting owner definition", null],
    ["apDisconnect", "Autopilot Disconnect", "Unassigned — awaiting owner definition", null],
    ["atDisconnect", "A/T Disconnect", "Unassigned — awaiting owner definition", null],
    ["gpws", "EGPWS · PULL UP", "Unassigned — awaiting owner definition", "PULL UP"],
    ["gpws", "EGPWS · SINK RATE", "Unassigned — awaiting owner definition", "SINK RATE"],
    ["gpws", "EGPWS · WINDSHEAR (TONE + 3 CALLOUTS)", "Unassigned — complete source sequence pending approval", "WINDSHEAR"],
    ["gpws", "EGPWS · TOO LOW GEAR", "Unassigned — awaiting owner definition", "TOO LOW GEAR"],
    ["gpws", "EGPWS · TERRAIN TERRAIN PULL UP", "Unassigned — compound recording", "TERRAIN TERRAIN PULL UP"],
    ["gpws", "EGPWS · SINK RATE PULL UP", "Unassigned — compound recording", "SINK RATE PULL UP"],
    ["gpws", "EGPWS · TERRAIN PULL UP", "Unassigned — compound recording", "TERRAIN PULL UP"],
    ["gpws", "EGPWS · DON'T SINK", "Unassigned — awaiting owner definition", "DON'T SINK"],
    ["tcas", "TCAS · TRAFFIC", "Unassigned — awaiting owner definition", "TRAFFIC TRAFFIC"],
    ["radioAltitude", "RA · FIVE HUNDRED", "Unassigned — awaiting owner definition", "500"],
    ["minimums", "Approaching Minimums", "Unassigned — awaiting owner definition", "APPROACHING MINIMUMS"],
    ["minimums", "MINIMUMS", "Unassigned — awaiting owner definition", "MINIMUMS"],
    ["gpws", "GPWS · TERRAIN", "Unassigned — awaiting owner definition", "TERRAIN"],
    ["gpws", "GPWS · TERRAIN AHEAD", "Unassigned — awaiting owner definition", "TERRAIN AHEAD"],
    ["gpws", "GPWS · CAUTION TERRAIN", "Unassigned — awaiting owner definition", "CAUTION TERRAIN"],
    ["gpws", "GPWS · DON'T SINK", "Unassigned — awaiting owner definition", "DON'T SINK"],
    ["gpws", "GPWS · TOO LOW FLAPS", "Unassigned — awaiting owner definition", "TOO LOW FLAPS"],
    ["gpws", "GPWS · TOO LOW TERRAIN", "Unassigned — awaiting owner definition", "TOO LOW TERRAIN"],
    ["gpws", "GPWS · BANK ANGLE", "Unassigned — awaiting owner definition", "BANK ANGLE"],
    ["gpws", "GPWS · GLIDESLOPE", "Unassigned — awaiting owner definition", "GLIDESLOPE"],
    ["tcas", "TCAS · CLIMB", "Unassigned — awaiting owner definition", "CLIMB"],
    ["tcas", "TCAS · DESCEND", "Unassigned — awaiting owner definition", "DESCEND"],
    ["tcas", "TCAS · MAINTAIN VERTICAL SPEED", "Unassigned — awaiting owner definition", "MAINTAIN VERTICAL SPEED"],
    ["tcas", "TCAS · CLEAR OF CONFLICT", "Unassigned — awaiting owner definition", "CLEAR OF CONFLICT"],
    ["radioAltitude", "RA · 2500", "Unassigned — awaiting owner definition", "TWO THOUSAND FIVE HUNDRED"],
    ["radioAltitude", "RA · 1000", "Unassigned — awaiting owner definition", "ONE THOUSAND"],
    ["radioAltitude", "RA · 100", "Unassigned — awaiting owner definition", "100"],
    ["radioAltitude", "RA · 50", "Unassigned — awaiting owner definition", "50"],
    ["radioAltitude", "RA · 40", "Unassigned — awaiting owner definition", "40"],
    ["radioAltitude", "RA · 30", "Unassigned — awaiting owner definition", "30"],
    ["radioAltitude", "RA · 20", "Unassigned — awaiting owner definition", "20"],
    ["radioAltitude", "RA · 10", "Unassigned — awaiting owner definition", "10"],
    ["altitude", "Altitude Alert — Deviation", "Unassigned — awaiting owner definition", "ALTITUDE DEVIATION"],
    ["radioAltitude", "RA · FULL CALL OUT COLLECTION", "Owner a.mp3 recording — segmented preview", "COLLECTION"]
  ];
  const matrix = byId("soundMatrix");
  for (const [id, label, desc, phrase] of SOUND_TESTS) {
    const b = document.createElement("button");
    b.className = "sound";
    b.type = "button";
    b.innerHTML = '<span class="chip">PLAY ▶</span><b></b><small></small>';
    b.querySelector("b").textContent = label;
    b.querySelector("small").textContent = ownerRA && ownerRA.has(keyFor(id, phrase)) ? "OWNER RA RECORDING · READY FOR REVIEW" : desc;
    b.addEventListener("click", () => play(id, phrase));
    matrix.appendChild(b);
  }
  function clearSound() {
    realBank.stop();
    if (ownerRA) ownerRA.stop();
  }
  function play(kind, message) {
    const soundKey = keyFor(kind, message);
    clearSound();
    const volume=Number(byId("reviewVolume").value)/100;
    if (realReady && realBank.has(soundKey)) {
      realBank.play(soundKey,volume).then(entry => {
        byId("realImportStatus").textContent = "Playing manually assigned recording: "+entry.name;
      }).catch(err => {
        byId("realImportStatus").textContent = "Assigned recording playback failed: "+err.message;
      });
      return true;
    }
    if (ownerRA && ownerRA.has(soundKey)) {
      ownerRA.enqueue(soundKey,volume);
      byId("realImportStatus").textContent="OWNER RA RECORDING: "+soundKey;
      return true;
    }
    byId("realImportStatus").textContent =
      "NO SOUND ASSIGNED: "+soundKey+" — awaiting owner-provided recording.";
    return false;
  }
  function state() {
    const s = {};
    for (const id of [
      "pressureAltitudeFt", "selectedAltitudeFt", "cabinAltitudeFt", "radioAltitudeFt",
      "flaps", "iasKt", "vmoKt", "thrustLever1Angle", "thrustLever2Angle"
    ]) s[id] = Number(byId(id).value);
    for (const id of [
      "onGround", "takeoffThrust", "gearDownLocked", "engine1Fire", "stallWarning",
      "glideslopeCaptured", "leadingEdgeTakeoff", "speedbrakeDown",
      "parkingBrakeSet", "stabilizerTrimTakeoff", "approachActive"
    ]) s[id] = byId(id).checked;
    s.egpwsMessage = byId("egpwsMessage").value;
    s.minimumsRadioFt = Number(byId("raDhFt").value);
    return s;
  }
  function evaluate(noSound) {
    const out = model.update(state());
    const lines = out.active.map(v => "▶ " + v.id + " · " + (realReady && realBank.has(keyFor(v.id)) ? "SAMPLE ASSIGNED" : "NO SOUND ASSIGNED"));
    lines.push(...Object.entries(out.lamps).filter(([,v]) => v).map(([k]) => "● LAMP " + k));
    if (!out.status.takeoffConfigEvaluated) lines.push("ⓘ Takeoff config not validated for this variant");
    if (out.status.altitudeInhibited) lines.push("ⓘ Altitude alert inhibited");
    byId("active").textContent = lines.join("\n") || "No active audible warning";
    for (const evt of out.events) log.unshift(evt.id + ": " + (evt.message || "triggered"));
    log = log.slice(0, 10);
    byId("events").textContent = log.join("\n") || "No one-shot transitions yet";
    if (!noSound) {
      const voices = out.events.filter(v => v.group === "voice").sort((a,b)=>b.priority-a.priority);
      if (voices.length && ownerRA && voices.every(v=>ownerRA.has(keyFor(v.id,v.message)))) {
        for (const event of voices) ownerRA.enqueue(keyFor(event.id,event.message), Number(byId("reviewVolume").value)/100);
      }
      else if (voices.length) play(voices[0].id, voices[0].message);
      else if (out.active.length) play([...out.active].sort((a,b)=>b.priority-a.priority)[0].id);
      else if (out.events.length) play(out.events[0].id, out.events[0].message);
      // Do not cut off the tail of an RA callout merely because there is no new event.
    }
  }
  byId("evaluate").addEventListener("click", () => evaluate(false));
  byId("cutCabin").addEventListener("click", () => { model.cutoutCabin(); evaluate(false); });
  byId("cutGear").addEventListener("click", () => { model.cutoutGear(); evaluate(false); });
  byId("cutFire").addEventListener("click", () => { model.acknowledgeFire(); evaluate(false); });
  byId("stopAudio").addEventListener("click", clearSound);
  byId("reset").addEventListener("click", () => {
    model.reset(); log = []; clearSound(); evaluate(true);
  });
  byId("variant").addEventListener("change", () => {
    model = new WarningEngine({ variant: byId("variant").value });
    log = []; clearSound(); evaluate(true);
  });
  evaluate(true);

  // Guided A/B approval workflow; no integration into the main cockpit.
  const REVIEW_KEY = "b737cl-audio-listening-review-v2-owner-reset";
  let review = [];
  let reviewIndex = 0;
  try { const saved = JSON.parse(localStorage.getItem(REVIEW_KEY) || "null");
    if (Array.isArray(saved)) review = saved; } catch (_) {}
  function saveReview() {
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(review)); } catch (_) {}
  }
  function curReview() {
    return review[reviewIndex] || { status: "untested", note: "" };
  }
  function renderReview() {
    const [id, title, desc] = SOUND_TESTS[reviewIndex];
    const approved = review.filter(x => x && x.status === "approved").length;
    const fix = review.filter(x => x && x.status === "fix").length;
    const complete = approved + fix;
    byId("reviewCounter").textContent = (reviewIndex + 1) + " / " + SOUND_TESTS.length;
    byId("reviewNumber").textContent = String(reviewIndex + 1).padStart(2, "0");
    byId("reviewTitle").textContent = title;
    const liveKey = keyFor(id,SOUND_TESTS[reviewIndex][3]);
    byId("reviewDescription").textContent = desc +
       (realReady && realBank.has(liveKey) ? " · Imported file: " + realBank.getSummary(liveKey).name
         : (ownerRA && ownerRA.has(liveKey)) ? " · OWNER RA recording — ready to preview"
         : " · No sample assigned — awaiting owner definition");

    byId("reviewNote").value = curReview().note || "";
    byId("reviewProgressFill").style.width = (100 * complete / SOUND_TESTS.length) + "%";
    byId("reviewSummary").textContent = "Reviewed: " + complete + " of " + SOUND_TESTS.length +
      " | Approved: " + approved + " | Needs revision: " + fix +
      " | Current status: " + ({ approved: "Approved", fix: "Needs Revision", untested: "Not Tested" }[curReview().status] || "Not Tested");
    const hasSample=(realReady && realBank.has(liveKey)) || (ownerRA && ownerRA.has(liveKey));
    byId("reviewApprove").disabled = !hasSample;
    byId("reviewFix").disabled = !hasSample;
    byId("reviewPrev").disabled = reviewIndex === 0;
    byId("reviewNext").disabled = reviewIndex === SOUND_TESTS.length - 1;
    byId("reviewApprove").style.borderColor = curReview().status === "approved" ? "#80e4bd" : "";
    byId("reviewFix").style.borderColor = curReview().status === "fix" ? "#f1b47b" : "";
  }
  function writeStatus(status) {
    review[reviewIndex] = { status, note: byId("reviewNote").value, label: SOUND_TESTS[reviewIndex][1] };
    saveReview(); renderReview();
  }
  function navReview(delta) {
    reviewIndex = Math.max(0, Math.min(SOUND_TESTS.length - 1, reviewIndex + delta));
    clearSound(); renderReview();
  }
  function reportReview() {
    const rows = SOUND_TESTS.map(([id,label,desc],i) => {
      const entry = review[i] || { status:"untested", note:"" };
      return { no:i+1,id,label,description:desc,status:entry.status || "untested",notes:entry.note || "" };
    });
    return { project:"B737 Classic Audio Warning Lab",version:"0.3",
      provenance:"RA owner audio from uploaded a.mp3; other unmapped slots remain silent.",
      results:rows.map((r,i)=>({...r,audioFile:realReady?realBank.getSummary(keyFor(SOUND_TESTS[i][0],SOUND_TESTS[i][3])):null})) };
  }
  byId("reviewPlay").addEventListener("click", () => {
    const s = SOUND_TESTS[reviewIndex]; play(s[0],s[3]);
  });
  byId("reviewStop").addEventListener("click", clearSound);
  byId("reviewVolume").addEventListener("input", () => {
    const v = Number(byId("reviewVolume").value);
    byId("reviewVolumeValue").textContent = v + "%";
    if (ownerRA)ownerRA.setVolume(v/100);
  });
  byId("reviewApprove").addEventListener("click", () => writeStatus("approved"));
  byId("reviewFix").addEventListener("click", () => writeStatus("fix"));
  byId("reviewPrev").addEventListener("click", () => navReview(-1));
  byId("reviewNext").addEventListener("click", () => navReview(1));
  byId("reviewNote").addEventListener("input", () => {
    const e = curReview();
    review[reviewIndex] = { ...e, note: byId("reviewNote").value, label: SOUND_TESTS[reviewIndex][1] };
    saveReview();
  });
  byId("reviewCopy").addEventListener("click", async () => {
    const result = reportReview();
    const lines = result.results.map(r => r.no + ". " + r.label + ": " + r.status +
      (r.notes ? " — " + r.notes : "")).join("\n");
    const report = "B737 Classic Audio Review\n" + lines;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(report);
      else {const t=document.createElement("textarea");t.value=report;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();}
      byId("reviewSummary").textContent = "Report copied; it can be shared in chat.";
    } catch (_) { byId("reviewSummary").textContent = "Automatic copy failed; download the JSON report."; }
  });
  byId("reviewDownload").addEventListener("click", () => {
    const data = new Blob([JSON.stringify(reportReview(),null,2)],{type:"application/json"});
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");a.href=url;a.download="b737-audio-review.json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),250);
  });
  byId("reviewReset").addEventListener("click", () => {
    if (!confirm("Clear all sound test results?")) return;
    review = []; reviewIndex = 0; saveReview(); clearSound(); renderReview();
  });

  // Source-file import: non-destructive, never publishes third-party recordings.
  const optionKeys = new Set();
  for (const [kind,title,desc,message] of SOUND_TESTS){
    const k = keyFor(kind,message);
    if(optionKeys.has(k))continue;
    optionKeys.add(k);
    const opt=document.createElement("option");
    opt.value=k;opt.textContent=title;
    byId("realTarget").appendChild(opt);
  }
  function refreshImportUI(){
    const key=byId("realTarget").value;
    const entry=realReady?realBank.getSummary(key):null;
    byId("realImportStatus").textContent = realReady
      ? "Imported recordings in this browser: "+realBank.count+" / "+optionKeys.size+
      " | Unassigned warning slots remain silent."
      : "IndexedDB unavailable; no fallback sound is generated.";
    byId("realCurrentClip").textContent = entry
      ? "Selected file: "+entry.name+" ("+Math.round(entry.bytes/1024)+" KB)"
      : "No recording imported for this warning.";
    renderReview();
  }
  const persistOne=async(key,file)=>{
    if(!realReady)throw Error("Browser database not ready");
    if(!validAudioFile(file))throw Error("Unsupported file format or size greater than 40 MB.");
    // Decode before saving to catch invalid WAV/MP3. Decode also acts as a playback integrity check.
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)throw Error("No audio decoder supported");
    const ctx=new AC();
    let decoded;
    try{
      const arrayBuffer=await file.arrayBuffer();
      decoded=await ctx.decodeAudioData(arrayBuffer);
      if(!decoded||decoded.duration<=0||!Number.isFinite(decoded.duration))throw Error("Invalid audio duration");
    }finally{await ctx.close().catch(()=>{});}
    await realBank.add(key,file);
    return decoded.duration.toFixed(2)+"s";
  };
  byId("realTarget").addEventListener("change",refreshImportUI);
  byId("importOne").addEventListener("click",()=>byId("realSingleFile").click());
  byId("realSingleFile").addEventListener("change",async()=>{
    const input=byId("realSingleFile"),file=input.files&&input.files[0];
    if(!file)return;
    try{
      const duration=await persistOne(byId("realTarget").value,file);
      byId("realImportStatus").textContent = "Loaded and decoded: "+file.name+" ("+duration+")";
      refreshImportUI();
    }catch(e){byId("realImportStatus").textContent="Error: "+e.message;}
    input.value="";
  });

  byId("diagnoseImported").addEventListener("click",async()=>{
    if(!realReady||realBank.count===0){
      byId("realDiagnostics").textContent="No recordings have been imported for testing.";
      return;
    }
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC){byId("realDiagnostics").textContent="AudioContext unavailable in this browser.";return;}
    const ctx=new AC();
    let pass=0;const issues=[];
    try{
      for(const [key,item] of realBank.cache.entries()){
        byId("realDiagnostics").textContent="Test "+(pass+issues.length+1)+" / "+realBank.count+": "+item.name;
        try{
          const decoded=await ctx.decodeAudioData(await item.blob.arrayBuffer());
          if(!decoded||!Number.isFinite(decoded.duration)||decoded.duration<=0)
            throw Error("Invalid duration or audio data");
          let peak=0,energy=0,n=0,hardClip=0;
          for(let ch=0;ch<decoded.numberOfChannels;ch++){
            const samples=decoded.getChannelData(ch);
            const step=Math.max(1,Math.floor(samples.length/250000));
            for(let k=0;k<samples.length;k+=step){
              const v=Math.abs(samples[k]);
              peak=Math.max(peak,v);energy+=v*v;n++;
              if(v>=.9999)hardClip++;
            }
          }
          const rms=n?Math.sqrt(energy/n):0;
          if(rms<.0003)issues.push(item.name+": is nearly silent");
          else if(hardClip>n*.02)issues.push(item.name+": possible severe clipping");
          else pass++;
        }catch(e){issues.push(item.name+": "+e.message);}
      }
    }finally{await ctx.close().catch(()=>{});}
    byId("realDiagnostics").textContent="Analysis completed: "+pass+" healthy of "+
      realBank.count+" files. "+(issues.length?"Warnings: "+issues.join(" | "):"No preliminary issues detected.")+
      " (This test does not verify the origin or accuracy of 737 sounds.)";
  });

  byId("deleteCurrent").addEventListener("click",async()=>{
    if(!realReady)return;
    try{await realBank.remove(byId("realTarget").value);refreshImportUI();}
    catch(e){byId("realImportStatus").textContent="Error: "+e.message;}
  });
  realBank.init().then(()=>{realReady=true;refreshImportUI();})
    .catch((e)=>{realReady=false;refreshImportUI();
      byId("realImportStatus").textContent="Storage unavailable: "+e.message;});

  renderReview();
})();