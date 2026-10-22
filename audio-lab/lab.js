/* Standalone sound audition lab. Generated waveforms/TTS are intentionally NOT aircraft-accurate. */
(() => {
  "use strict";
  const { WarningEngine, AUDIO } = window.B737WarningEngine;
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
    ["radioAltitude", "RA · FIVE HUNDRED", "Placeholder voice", "FIVE HUNDRED"],
    ["minimums", "Minimums", "Placeholder voice", "APPROACHING MINIMUMS"]
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
})();