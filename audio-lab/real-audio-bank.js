/* User-owned 737 sample importer. No remote download, scraping or third-party sound redistribution.
   Browser IndexedDB persists audio under this browser profile only. v1. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.B737RealAudioBank=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VOICE_TYPES=new Set(["gpws","tcas","radioAltitude","minimums"]);
const TYPES=["wav","mp3","ogg","m4a","aac","flac","opus","webm"];
function keyFor(kind,message){
  const k=String(kind||"").trim();
  if(!k) throw Error("Sound type is required");
  return VOICE_TYPES.has(k)?k+"|"+String(message||"").trim().toUpperCase():k;
}
function fileNameBase(name){
  return String(name||"").toLowerCase().replace(/\.[^.]+$/,"")
    .replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}
function suggestKey(filename,tests){
  const base=fileNameBase(filename);
  // Owner-confirmed A/RA, C/EGPWS and E/Stick Shaker labels; b.mp3 remains absent.
  if(base === 'a') return 'radioAltitude|COLLECTION';
  if(base === 'e') return 'shaker';
  if(base === 'c') return 'gpws|COLLECTION';
  const tokens=base.split("_");
  if(/^(?:sfx|sound|b737|boeing|737|b737ng|737ng)_/.test(base)) {
    // intentional: preserve original tokens for matching
  }
  const candidates=[];
  const seen=new Set();
  for(const row of tests) {
    const kind=row[0], title=row[1], msg=row[3];
    const key=keyFor(kind,msg);
    if(seen.has(key))continue;
    seen.add(key);
    let score=0;
    const titleWords=fileNameBase(title).split("_").filter(w=>w.length>2 && !["the","and","warning","737","egpws"].includes(w));
    const messageWords=fileNameBase(msg||"").split("_").filter(w=>w.length>2);
    if(base.includes(fileNameBase(kind)))score+=3;
    if(messageWords.length && messageWords.every(w=>tokens.includes(w)))score+=7;
    if(titleWords.length && titleWords.every(w=>tokens.includes(w)))score+=5;
    for(const w of titleWords) if(tokens.includes(w))score++;
    if(score>=5)candidates.push({key,score});
  }
  const fixes=[
    [/fire|bell/, "fireBell"],
    [/overspeed|clacker/, "overspeed"],
    [/stick_shak|stall/, "shaker"],
    [/takeoff_config|cabin_altitude|intermittent_horn/, "intermittentHorn"],
    [/landing_gear_horn|gear_warning/, "gearHorn"],
    [/autopilot_disconnect|ap_disconnect/, "apDisconnect"],
    [/autothrottle_disconnect|at_disconnect/, "atDisconnect"],
    [/altitude_alert|altitude_tone/, "altitude"]
  ];
  for(const [regex,k] of fixes) if(regex.test(base))candidates.push({key:k,score:12});
  candidates.sort((a,b)=>b.score-a.score);
  return candidates.length===1 || (candidates.length>1 && candidates[0].score>candidates[1].score)
    ? candidates[0].key:null;
}
function validAudioFile(file){
  if(!file||typeof file.name!=="string")return false;
  const ext=file.name.split(".").pop().toLowerCase();
  return TYPES.includes(ext)&&Number(file.size)>0&&Number(file.size)<=40*1024*1024;
}
class RealAudioBank {
  constructor(){
    this.cache=new Map();
    this.db=null;
    this.currentAudio=null;
    this.currentUrl=null;
  }
  async init(){
    if(typeof indexedDB==="undefined")throw Error("IndexedDB unavailable");
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open("b737cl-real-audio-bank",1);
      r.onupgradeneeded=()=>{
        if(!r.result.objectStoreNames.contains("clips"))r.result.createObjectStore("clips",{keyPath:"key"});
      };
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    this.db=db;
    const items=await new Promise((resolve,reject)=>{
      const req=db.transaction("clips","readonly").objectStore("clips").getAll();
      req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
    });
    this.cache=new Map(items.map(item=>[item.key,item]));
    return this.cache.size;
  }
  has(key){return this.cache.has(key);}
  get(key){return this.cache.get(key)||null;}
  getSummary(key){
    const item=this.get(key);
    return item?{name:item.name,bytes:item.bytes,addedAt:item.addedAt,format:item.format}:null;
  }
  get count(){return this.cache.size;}
  async add(key,file){
    if(!validAudioFile(file))throw Error("Unsupported/empty audio or file above 40MB");
    if(!this.db)throw Error("Audio library storage not initialized");
    const entry={
      key,name:file.name,bytes:file.size,format:file.type||"unknown",addedAt:new Date().toISOString(),blob:file
    };
    await new Promise((resolve,reject)=>{
      const req=this.db.transaction("clips","readwrite").objectStore("clips").put(entry);
      req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);
    });
    this.cache.set(key,entry);
    return this.getSummary(key);
  }
  async remove(key){
    if(!this.db)throw Error("Audio library storage not initialized");
    await new Promise((resolve,reject)=>{
      const req=this.db.transaction("clips","readwrite").objectStore("clips").delete(key);
      req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);
    });
    this.cache.delete(key);
  }
  stop(){
    if(this.currentAudio){this.currentAudio.pause();this.currentAudio.src="";this.currentAudio=null;}
    if(this.currentUrl){URL.revokeObjectURL(this.currentUrl);this.currentUrl=null;}
  }
  async play(key,volume){
    const entry=this.get(key);
    if(!entry)throw Error("No imported audio clip for "+key);
    this.stop();
    const url=URL.createObjectURL(entry.blob);
    const el=new Audio(url);
    el.volume=Math.max(0,Math.min(1,Number(volume)||.17));
    this.currentAudio=el;this.currentUrl=url;
    el.onended=()=>{if(this.currentAudio===el)this.stop();};
    el.onerror=()=>{if(this.currentAudio===el)this.stop();};
    try{await el.play();return entry;}catch(e){this.stop();throw e;}
  }
}
return {RealAudioBank,keyFor,suggestKey,validAudioFile};
});
