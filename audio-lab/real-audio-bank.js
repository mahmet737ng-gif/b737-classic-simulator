/* Owner-mapped 737 sample importer. No remote download or automatic sound assignment.
   New blank v2 bank; legacy v1 browser recordings are left untouched but are not loaded. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.B737RealAudioBank=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const TYPES=["wav","mp3","ogg","m4a","aac","flac","opus","webm"];
function keyFor(kind,message){
  const k=String(kind||"").trim();
  if(!k) throw Error("Sound type is required");
  const phrase=String(message||"").trim().toUpperCase();
  return phrase?k+"|"+phrase:k;
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
      const r=indexedDB.open("b737cl-real-audio-bank-v2-owner-map",1);
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
return {RealAudioBank,keyFor,validAudioFile};
});
