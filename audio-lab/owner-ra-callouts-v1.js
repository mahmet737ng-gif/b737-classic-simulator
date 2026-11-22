/* B737 Classic RA voice player — owner-supplied a.mp3, trimmed before unidentified end beep.
 * Shared by the Audio Test Lab and Unified live RA bridge. Original MP3, no synthesis; training audio, not a certified avionics source.
 * Each timeslice below is grounded in the actual uploaded voice recording.
 * The unverified last beep (after ~10.85 s) remains in the MP3 source but is excluded from all playback ranges.
 */
(function(root,factory){
  const mod=factory();
  if(typeof module==="object"&&module.exports)module.exports=mod;
  if(root)root.B737OwnerRACallouts=mod;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const URL_PATH="./assets/owner-ra-callouts-v1.mp3";
const TIMELINE=Object.freeze({
  "radioAltitude|ONE THOUSAND":[0.000,0.960],
  "radioAltitude|500":[1.440,2.250],
  "minimums|APPROACHING MINIMUMS":[2.620,4.090],
  "minimums|MINIMUMS":[4.380,5.110],
  "radioAltitude|100":[5.540,6.400],
  "radioAltitude|50":[6.900,7.360],
  "radioAltitude|40":[7.680,8.040],
  "radioAltitude|30":[8.530,8.950],
  "radioAltitude|20":[9.140,9.610],
  "radioAltitude|10":[10.040,10.470],
  "radioAltitude|COLLECTION":[0.000,10.500]
});
function keyFor(kind,message){
  const phrase=String(message||"").trim().toUpperCase();
  return phrase?String(kind)+"|"+phrase:String(kind);
}
class Player{
  constructor(url=URL_PATH,audioFactory=null){
    this.audio=audioFactory?audioFactory(url):typeof Audio==="function"?new Audio(url):null;
    this.queue=[];this.active=null;this.timer=null;
    this.lastError=null;
    if(this.audio){
      this.audio.preload="auto";
      this.audio.addEventListener("ended",()=>this.finish());
      try{this.audio.load();}catch(_){}
    }
  }
  async enable(){
    if(!this.audio)return false;
    if(this.active)return true;
    this.audio.muted=true;
    try{
      await this.audio.play();
      this.audio.pause();
      this.audio.currentTime=0;
      return true;
    }catch(err){
      this.lastError=String(err&&err.message||err);
      return false;
    }finally{
      this.audio.muted=false;
    }
  }
  has(kind,message){const key=message===undefined?kind:keyFor(kind,message);return Object.prototype.hasOwnProperty.call(TIMELINE,key);}
  get(key){return TIMELINE[key]||null;}
  enqueue(key,volume=.17){
    if(!this.has(key))return false;
    this.queue.push({key,volume});
    if(!this.active)this.next();
    return true;
  }
  play(kind,message,volume=.17){
    this.stop();
    return this.enqueue(keyFor(kind,message),volume);
  }
  async next(){
    if(!this.audio||this.active||!this.queue.length)return;
    const item=this.queue.shift();
    const [start,end]=TIMELINE[item.key];
    this.active=item;
    try{
      this.audio.pause();
      if(this.audio.readyState<1){
        await new Promise((resolve,reject)=>{
          const ready=()=>{clean();resolve();}, fail=()=>{clean();reject(new Error("audio load error"));};
          const clean=()=>{this.audio.removeEventListener("loadedmetadata",ready);this.audio.removeEventListener("error",fail);};
          this.audio.addEventListener("loadedmetadata",ready,{once:true});
          this.audio.addEventListener("error",fail,{once:true});
          this.audio.load();
        });
      }
      if(this.active!==item)return;
      this.audio.volume=Math.max(0,Math.min(1,Number(item.volume)||.17));
      this.audio.currentTime=start;
      await this.audio.play();
      if(this.active!==item)return;
      this.timer=setInterval(()=>{
        if(this.audio.currentTime>=end-.025||this.audio.ended)this.finish();
      },25);
    }catch(err){
      this.lastError=String(err&&err.message||err);
      this.finish();
    }
  }
  finish(){
    if(this.timer!==null){clearInterval(this.timer);this.timer=null;}
    if(this.audio)this.audio.pause();
    this.active=null;
    if(this.queue.length)this.next();
  }
  stop(){
    this.queue=[];
    if(this.timer!==null){clearInterval(this.timer);this.timer=null;}
    if(this.audio)this.audio.pause();
    this.active=null;
  }
  setVolume(v){if(this.audio)this.audio.volume=Math.max(0,Math.min(1,Number(v)||.17));}
}
return Object.freeze({Player,TIMELINE,URL_PATH,keyFor});
});