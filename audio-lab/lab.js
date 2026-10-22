/* Standalone sound audition lab. Generated waveforms/TTS are intentionally NOT aircraft-accurate. */
(() => {
  "use strict";
  const { WarningEngine, AUDIO } = window.B737WarningEngine;
  const { RealAudioBank, keyFor, suggestKey, validAudioFile } = window.B737RealAudioBank;
  const realBank = new RealAudioBank();
  let realReady = false;
  let model = new WarningEngine({ variant: "737-300" });
  let audioContext = null;
  let master = null;
  let currentNodes = [];
  let currentSamples = [];
  let log = [];
  const byId = id => document.getElementById(id);
  const SOUND_TESTS = [
    ["altitude", "Altitude Alert", "Momentary tone", "ALTITUDE ACQUISITION"],
    ["intermittentHorn", "Takeoff Config", "Intermittent horn — shared with cabin", null],
    ["intermittentHorn", "Cabin Altitude", "Same shared horn", null],
    ["gearHorn", "Landing Gear", "Steady horn", null],
    ["fireBell", "Fire Warning", "Repeated bell", null],
    ["overspeed", "Mach/Airspeed", "Clacker", null],
    ["shaker", "Stall", "Stick-shaker rumble", null],
    ["apDisconnect", "Autopilot Disconnect", "Alert tone", null],
    ["atDisconnect", "A/T Disconnect", "Indicative tone only", null],
    ["gpws", "EGPWS · PULL UP", "Placeholder voice", "PULL UP"],
    ["gpws", "EGPWS · SINK RATE", "Placeholder voice", "SINK RATE"],
    ["gpws", "EGPWS · WINDSHEAR", "Placeholder voice", "WINDSHEAR"],
    ["gpws", "EGPWS · TOO LOW GEAR", "Placeholder voice", "TOO LOW GEAR"],
    ["tcas", "TCAS · TRAFFIC", "Placeholder voice", "TRAFFIC TRAFFIC"],
    ["radioAltitude", "RA · FULL CALLOUT COLLECTION", "User-identified a.mp3; listening preview only — not mapped to individual height thresholds", "COLLECTION"],
    ["radioAltitude", "RA · FIVE HUNDRED", "Placeholder voice", "FIVE HUNDRED"],
    ["minimums", "Minimums", "Placeholder voice", "APPROACHING MINIMUMS"],
    ["minimums", "MINIMUMS", "Radio minima", "MINIMUMS"],
    ["gpws", "GPWS · TERRAIN", "Terrain closure", "TERRAIN"],
    ["gpws", "GPWS · TERRAIN AHEAD", "Terrain ahead", "TERRAIN AHEAD"],
    ["gpws", "GPWS · CAUTION TERRAIN", "Caution terrain", "CAUTION TERRAIN"],
    ["gpws", "GPWS · DON'T SINK", "Altitude loss", "DON'T SINK"],
    ["gpws", "GPWS · TOO LOW FLAPS", "Unsafe flap configuration", "TOO LOW FLAPS"],
    ["gpws", "GPWS · TOO LOW TERRAIN", "Unsafe clearance", "TOO LOW TERRAIN"],
    ["gpws", "GPWS · BANK ANGLE", "Excessive bank", "BANK ANGLE"],
    ["gpws", "GPWS · GLIDESLOPE", "Deviation", "GLIDESLOPE"],
    ["tcas", "TCAS · CLIMB", "TCAS advisory", "CLIMB"],
    ["tcas", "TCAS · DESCEND", "TCAS advisory", "DESCEND"],
    ["tcas", "TCAS · MAINTAIN VERTICAL SPEED", "TCAS advisory", "MAINTAIN VERTICAL SPEED"],
    ["tcas", "TCAS · CLEAR OF CONFLICT", "TCAS advisory", "CLEAR OF CONFLICT"],
    ["radioAltitude", "RA · 2500", "EGPWS radio-altitude", "TWO THOUSAND FIVE HUNDRED"],
    ["radioAltitude", "RA · 1000", "EGPWS radio-altitude", "ONE THOUSAND"],
    ["radioAltitude", "RA · 100", "EGPWS radio-altitude", "100"],
    ["radioAltitude", "RA · 50", "EGPWS radio-altitude", "50"],
    ["radioAltitude", "RA · 40", "EGPWS radio-altitude", "40"],
    ["radioAltitude", "RA · 30", "EGPWS radio-altitude", "30"],
    ["radioAltitude", "RA · 20", "EGPWS radio-altitude", "20"],
    ["radioAltitude", "RA · 10", "EGPWS radio-altitude", "10"],
    ["altitude", "Altitude Deviation", "Momentary alert on deviation from MCP selected altitude", "ALTITUDE DEVIATION"]
  ];
  const matrix = byId("soundMatrix");
  for (const [id, label, desc, phrase] of SOUND_TESTS) {
    const b = document.createElement("button");
    b.className = "sound";
    b.type = "button";
    b.innerHTML = '<span class="chip">PLAY ▶</span><b></b><small></small>';
    b.querySelector("b").textContent = label;
    b.querySelector("small").textContent = desc;
    b.addEventListener("click", () => play(id, phrase));
    matrix.appendChild(b);
  }
  function ensureAudio() {
    if (!audioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { alert("Web Audio is not available in this browser."); return false; }
      audioContext = new AC();
      master = audioContext.createGain();
      master.gain.value = 0.17; // conservative output level to avoid startling headphone users
      master.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return true;
  }
  function clearSound() {
    realBank.stop();
    for (const src of currentSamples) { try { src.stop(); } catch (_) {} }
    for (const osc of currentNodes) { try { osc.stop(); } catch (_) {} }
    currentNodes = [];
    currentSamples = [];
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  function oscillator(hz, start, duration, type, vol, endHz) {
    const o = audioContext.createOscillator(), g = audioContext.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(hz, start);
    if (endHz) o.frequency.exponentialRampToValueAtTime(endHz, start + duration);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(vol || 0.4, start + .012);
    g.gain.setTargetAtTime(0.0001, start + duration - .07, .017);
    o.connect(g); g.connect(master);
    o.start(start); o.stop(start + duration + .02);
    currentNodes.push(o);
  }
  function noiseAt(start, duration, level, cutoff) {
    const rate = audioContext.sampleRate, size = Math.ceil(rate * duration);
    const b = audioContext.createBuffer(1, size, rate), c = b.getChannelData(0);
    for (let i = 0; i < size; i++) c[i] = (Math.random() * 2 - 1);
    const n = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter();
    const g = audioContext.createGain();
    n.buffer = b; filter.type = "lowpass"; filter.frequency.value = cutoff || 850;
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(level || 0.6, start + .01);
    g.gain.exponentialRampToValueAtTime(.001, start + duration);
    n.connect(filter); filter.connect(g); g.connect(master); n.start(start);
    currentSamples.push(n);
  }
  function voice(message) {
    if (!("speechSynthesis" in window)) {
      byId("events").textContent = "This browser has no TTS capability for preview voice.";
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message || "PULL UP");
    utterance.lang = "en-US";
    utterance.pitch = 0.80;
    utterance.rate = 1.04;
    utterance.volume = 0.65;
    speechSynthesis.speak(utterance);
  }
  function play(kind, message) {
    const soundKey = keyFor(kind, message);
    if (realReady && realBank.has(soundKey)) {
      clearSound();
      realBank.play(soundKey, Number(byId("reviewVolume").value) / 100).catch(err => {
        byId("realImportStatus").textContent = "خطا در پخش فایل واقعی: " + err.message;
      });
      return;
    }
    if (!ensureAudio()) return;
    clearSound();
    const t = audioContext.currentTime + .035;
    switch (kind) {
      case "altitude":
        oscillator(775, t, .29, "sine", .7); break;
      case "intermittentHorn":
        for (let i = 0; i < 5; i++) {
          oscillator(470, t + i * .78, .51, "sawtooth", .38);
          oscillator(485, t + i * .78, .51, "triangle", .25);
        } break;
      case "gearHorn":
        oscillator(445, t, 3, "sawtooth", .30);
        oscillator(462, t, 3, "square", .16); break;
      case "fireBell":
        for (let i = 0; i < 5; i++) {
          oscillator(950, t + i * .6, .47, "sine", .5, 800);
          oscillator(1550, t + i * .6, .40, "triangle", .4, 1300);
        } break;
      case "overspeed":
        for (let i = 0; i < 10; i++) noiseAt(t + i * .25, .055, .8, 4500);
        break;
      case "shaker":
        for (let i = 0; i < 18; i++) noiseAt(t + i * .14, .12, .53, 500);
        break;
      case "apDisconnect":
        for (let i = 0; i < 3; i++) {
          oscillator(610, t + i * .52, .26, "square", .28);
          oscillator(540, t + i * .52 + .27, .21, "square", .27);
        } break;
      case "atDisconnect":
        oscillator(690, t, .28, "triangle", .45);
        oscillator(560, t + .3, .28, "triangle", .38); break;
      case "gpws": case "tcas": case "radioAltitude": case "minimums":
        voice(message || "CHECK"); break;
    }
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
    return s;
  }
  function evaluate(noSound) {
    const out = model.update(state());
    const lines = out.active.map(v => "▶ " + v.id + " · " + v.asset);
    lines.push(...Object.entries(out.lamps).filter(([,v]) => v).map(([k]) => "● LAMP " + k));
    if (!out.status.takeoffConfigEvaluated) lines.push("ⓘ Takeoff config not validated for this variant");
    if (out.status.altitudeInhibited) lines.push("ⓘ Altitude alert inhibited");
    byId("active").textContent = lines.join("\n") || "No active audible warning";
    for (const evt of out.events) log.unshift(evt.id + ": " + (evt.message || "triggered"));
    log = log.slice(0, 10);
    byId("events").textContent = log.join("\n") || "No one-shot transitions yet";
    if (!noSound) {
      const voices = out.events.filter(v => v.group === "voice").sort((a,b)=>b.priority-a.priority);
      if (voices.length) play(voices[0].id, voices[0].message);
      else if (out.active.length) play([...out.active].sort((a,b)=>b.priority-a.priority)[0].id);
      else if (out.events.length) play(out.events[0].id, out.events[0].message);
      else clearSound();
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
  const REVIEW_KEY = "b737cl-audio-listening-review-v1";
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
       (realReady && realBank.has(liveKey) ? " · فایل واردشده: " + realBank.getSummary(liveKey).name
         : " · صدای اصلی بارگذاری نشده (نسخه مصنوعی)");

    byId("reviewNote").value = curReview().note || "";
    byId("reviewProgressFill").style.width = (100 * complete / SOUND_TESTS.length) + "%";
    byId("reviewSummary").textContent = "ارزیابی‌شده: " + complete + " از " + SOUND_TESTS.length +
      " | تأیید: " + approved + " | نیاز به اصلاح: " + fix +
      " | وضعیت فعلی: " + ({ approved: "تأیید", fix: "اصلاح", untested: "تست‌نشده" }[curReview().status] || "تست‌نشده");
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
    return { project:"B737 Classic Audio Warning Lab",version:"0.2",
      provenance:"User-imported files are local to this browser; fallback is synthetic/TTS.",
      results:rows.map((r,i)=>({...r,audioFile:realReady?realBank.getSummary(keyFor(SOUND_TESTS[i][0],SOUND_TESTS[i][3])):null})) };
  }
  byId("reviewPlay").addEventListener("click", () => {
    const s = SOUND_TESTS[reviewIndex]; play(s[0],s[3]);
    const v = Number(byId("reviewVolume").value) / 100;
    if (master) master.gain.value = v;
  });
  byId("reviewStop").addEventListener("click", clearSound);
  byId("reviewVolume").addEventListener("input", () => {
    const v = Number(byId("reviewVolume").value);
    byId("reviewVolumeValue").textContent = v + "%";
    if (master) master.gain.value = v / 100;
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
      byId("reviewSummary").textContent = "گزارش کپی شد؛ می‌توانی آن را در چت بفرستی.";
    } catch (_) { byId("reviewSummary").textContent = "کپی خودکار ممکن نیست؛ از دانلود JSON استفاده کن."; }
  });
  byId("reviewDownload").addEventListener("click", () => {
    const data = new Blob([JSON.stringify(reportReview(),null,2)],{type:"application/json"});
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");a.href=url;a.download="b737-audio-review.json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),250);
  });
  byId("reviewReset").addEventListener("click", () => {
    if (!confirm("تمام نتایج تست صدا پاک شوند؟")) return;
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
      ? "فایل‌های واقعی واردشده در این مرورگر: "+realBank.count+" / "+optionKeys.size+
      " | بقیه هشدارها صدای آزمایشی دارند."
      : "IndexedDB در دسترس نیست؛ می‌توان صداها را به صورت مصنوعی تست کرد.";
    byId("realCurrentClip").textContent = entry
      ? "فایل انتخابی: "+entry.name+" ("+Math.round(entry.bytes/1024)+" KB)"
      : "برای این هشدار هنوز فایل واقعی وارد نشده است.";
    renderReview();
  }
  const persistOne=async(key,file)=>{
    if(!realReady)throw Error("Browser database not ready");
    if(!validAudioFile(file))throw Error("فرمت فایل نامعتبر است یا حجم آن بیش از ۴۰ مگابایت است.");
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
  byId("importMany").addEventListener("click",()=>byId("realMultipleFiles").click());
  byId("realSingleFile").addEventListener("change",async()=>{
    const input=byId("realSingleFile"),file=input.files&&input.files[0];
    if(!file)return;
    try{
      const duration=await persistOne(byId("realTarget").value,file);
      byId("realImportStatus").textContent = "بارگذاری و دیکد موفق: "+file.name+" ("+duration+")";
      refreshImportUI();
    }catch(e){byId("realImportStatus").textContent="خطا: "+e.message;}
    input.value="";
  });
  byId("realMultipleFiles").addEventListener("change",async()=>{
    const input=byId("realMultipleFiles");
    const files=[...(input.files||[])];let success=0;
    const failed=[];
    for(const file of files){
      const key=suggestKey(file.name,SOUND_TESTS);
      if(!key||!optionKeys.has(key)){failed.push(file.name+": نام قابل تطبیق نیست");continue;}
      try{await persistOne(key,file);success++;}catch(e){failed.push(file.name+": "+e.message);}
    }
    refreshImportUI();
    byId("realImportStatus").textContent="ورود دسته‌جمعی: "+success+" فایل ثبت شد. "+(failed.length? "موارد ناموفق: "+failed.join(" | "):"");
    input.value="";
  });

  byId("diagnoseImported").addEventListener("click",async()=>{
    if(!realReady||realBank.count===0){
      byId("realDiagnostics").textContent="هیچ فایل واقعی برای آزمایش وارد نشده است.";
      return;
    }
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC){byId("realDiagnostics").textContent="مرورگر AudioContext ندارد.";return;}
    const ctx=new AC();
    let pass=0;const issues=[];
    try{
      for(const [key,item] of realBank.cache.entries()){
        byId("realDiagnostics").textContent="آزمون "+(pass+issues.length+1)+" / "+realBank.count+": "+item.name;
        try{
          const decoded=await ctx.decodeAudioData(await item.blob.arrayBuffer());
          if(!decoded||!Number.isFinite(decoded.duration)||decoded.duration<=0)
            throw Error("زمان یا دادهٔ نامعتبر");
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
          if(rms<.0003)issues.push(item.name+": تقریباً بی‌صداست");
          else if(hardClip>n*.02)issues.push(item.name+": احتمال کلیپینگ شدید");
          else pass++;
        }catch(e){issues.push(item.name+": "+e.message);}
      }
    }finally{await ctx.close().catch(()=>{});}
    byId("realDiagnostics").textContent="بررسی پایان یافت: "+pass+" سالم از "+
      realBank.count+" فایل. "+(issues.length?"هشدار: "+issues.join(" | "):"هیچ اشکال اولیه‌ای تشخیص داده نشد.")+
      " (این تست اصالت ضبط یا صحت صدای 737 را تأیید نمی‌کند.)";
  });

  byId("deleteCurrent").addEventListener("click",async()=>{
    if(!realReady)return;
    try{await realBank.remove(byId("realTarget").value);refreshImportUI();}
    catch(e){byId("realImportStatus").textContent="خطا: "+e.message;}
  });
  realBank.init().then(()=>{realReady=true;refreshImportUI();})
    .catch((e)=>{realReady=false;refreshImportUI();
      byId("realImportStatus").textContent="Storage unavailable: "+e.message;});

  renderReview();
})();