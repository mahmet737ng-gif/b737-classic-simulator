/* Phrase selector for B737CL audio sources — no copyrighted audio payloads.
   Input: evaluated warning events from source aircraft subsystem, not raw terrain estimates.
   It never resolves an unconfirmed RA/EGPWS compilation segment, nor entire a.mp3/c.mp3.
*/
(function(root,factory){const v=factory();if(typeof module==="object"&&module.exports)module.exports=v;if(root)root.B737PhraseSelector=v;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const RA_BASE="radioAltitude|",GPWS_BASE="gpws|",MIN_BASE="minimums|";
const DIRECT=Object.freeze({
  fireBell:"fire-alarm.mp3",intermittentHorn:"takeoff-config-and-cabin-altitude.mp3",
  shaker:"e.mp3",apDisconnect:"i-autopilot-disconnect.mp3",
  "gpws|PULL UP":"g-pull-up.mp3","gpws|BANK ANGLE":"h-bank-angle.mp3",
  "gpws|GLIDESLOPE":"glideslope-alarm.mp3",
  trimMotor:"aircraft-trim-spinning-power-assisted-steering-aircraft-control-board-2.mp3"
});
const category=key=>key.startsWith(RA_BASE)||key.startsWith(MIN_BASE)?"a.mp3":key.startsWith(GPWS_BASE)?"c.mp3":null;
const meta=key=>({key,lane:key.startsWith(GPWS_BASE)||key.startsWith(RA_BASE)||key.startsWith(MIN_BASE)?"egpws":key.startsWith("tcas|")?"tcas":"aural-module"});
class PhraseSelector{
  constructor(){this.approved=new Map();this.sustained=new Set();}
  confirm(segmentId,phraseKey){
    if(!/^(RA-(0[1-9]|1[01])|EGPWS-(0[1-9]|1[0-9]))$/.test(segmentId))throw Error("Unknown split segment");
    if((segmentId.startsWith("RA-")?"a.mp3":"c.mp3")!==category(phraseKey))throw Error("Wrong source family");
    if([...this.approved].some(([k,v])=>k!==phraseKey&&v===segmentId))throw Error("One segment cannot represent two phrases");
    if(this.approved.has(phraseKey)&&this.approved.get(phraseKey)!==segmentId)throw Error("Phrase already mapped");
    this.approved.set(phraseKey,segmentId);
  }
  importConfirmed(review){
    let approved=0;
    for(const [segmentId,record] of Object.entries(review||{})){
      if(!record||record.confirmed!==true)continue;
      try{this.confirm(segmentId,record.key);approved++;}catch(_){}
    }
    return approved;
  }
  asset(key){
    if(DIRECT[key])return "audio/original/"+DIRECT[key];
    const segmentId=this.approved.get(key);
    if(segmentId)return "audio/segments/"+segmentId+".mp3";
    return null;
  }
  update({active=[],oneshot=[]}={}){
    const wanted=new Map();
    for(const e of active)if(e&&typeof e.key==="string")wanted.set(e.key,{...meta(e.key),continuous:true});
    for(const e of oneshot)if(e&&typeof e.key==="string"&&!wanted.has(e.key))wanted.set(e.key,{...meta(e.key),continuous:false});
    const next=new Set(),play=[],stop=[],hold=[],missing=[];
    for(const e of wanted.values()){
      const asset=this.asset(e.key);
      if(!asset){missing.push({key:e.key,reason:"UNCONFIRMED_PHRASE_SAMPLE"});continue;}
      if(/(?:^|\/)(?:a|c)\.mp3$/i.test(asset))throw Error("Full compilation playback forbidden");
      if(e.continuous){next.add(e.key);if(this.sustained.has(e.key))hold.push(e);else play.push({...e,asset,mode:"hold-while-asserted"});}
      else play.push({...e,asset,mode:"once"});
    }
    for(const key of this.sustained)if(!next.has(key))stop.push({key,reason:"condition-cleared"});
    this.sustained=next;
    return {play,stop,hold,missing};
  }
  reset(){this.sustained.clear();}
}
return {PhraseSelector,DIRECT};
});
