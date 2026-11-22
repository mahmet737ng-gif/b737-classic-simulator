/* B737 Classic owner's real fire-alarm.mp3 — one shared ENG1/ENG2/APU/fire-test bell.
 * Owner recording is stored locally in IndexedDB; no oscillator, TTS, or guessed fire logic.
 */
(function(root){'use strict';
  if(!root?.document)return;
  const Gate=root.B737FireBellAuralGateV1, Bank=root.B737RealAudioBank;
  if(!Gate||!Bank)return;
  const gate=new Gate.FireBellGate(),bank=new Bank.RealAudioBank();
  const $=id=>root.document.getElementById(id);
  let context=null,buffer=null,player=null,bankReady=false,assetReady=false,armed=false,panel=null;
  let latest='';
  class LoopPlayer{
    constructor(ctx,clip){this.ctx=ctx;this.clip=clip;this.playing=false;this.items=new Set();this.timer=null;this.next=0;}
    schedule(when,first){
      const ctx=this.ctx,clip=this.clip;
      const start=Math.min(.05,clip.duration/12),end=Math.max(start+.1,clip.duration-.05);
      const duration=end-start,fade=Math.min(.06,duration/10);
      const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=clip;
      src.connect(gain);gain.connect(ctx.destination);
      const level=.84;
      gain.gain.setValueAtTime(0,when);
      gain.gain.linearRampToValueAtTime(level,when+(first ? .014 : fade));
      gain.gain.setValueAtTime(level,when+duration-fade);
      gain.gain.linearRampToValueAtTime(0,when+duration);
      const item={src,gain};this.items.add(item);
      src.onended=()=>{this.items.delete(item);try{src.disconnect();gain.disconnect();}catch(_){}};
      src.start(when,start,duration);
      this.next=when+duration-fade;
    }
    pump(){
      if(!this.playing)return;
      while(this.next<this.ctx.currentTime+.45){this.schedule(this.next,false);}
    }
    start(){
      if(this.playing)return;
      this.playing=true;this.next=this.ctx.currentTime+.015;
      this.schedule(this.next,true);this.timer=setInterval(()=>this.pump(),90);
    }
    stop(){
      this.playing=false;
      if(this.timer!==null){clearInterval(this.timer);this.timer=null;}
      const now=this.ctx.currentTime;
      for(const {src,gain} of [...this.items]){
        try{gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(0,now,.012);src.stop(now+.065);}catch(_){}
      }
    }
    destroy(){this.stop();}
  }
  function status(){
    if(!panel)return;
    const s=gate.snapshot();
    const text=!bankReady?'INITIALIZING AUDIO BANK':!assetReady?'IMPORT fire-alarm.mp3 TO ENABLE ACTUAL BELL':
      !armed?'SOURCE READY · ENABLE AUDIO':'SOURCE READY · AUDIO ARMED';
    const signature=[text,s.active,s.sources.join(','),Boolean(player?.playing)].join('|');
    if(signature===latest)return;
    latest=signature;
    $('fireBellAudioStatus').textContent=text+' | FIRE BELL '+(s.active?'REQUESTED':'OFF')+
      (s.active?' ['+s.sources.join(' + ')+']':'') + (assetReady&&armed?' | '+(player?.playing?'PLAYING':'STANDBY'):'');
  }
  function sync(){
    const desired=gate.snapshot().active;
    if(assetReady&&armed&&player){
      if(desired&&!player.playing)player.start();
      else if(!desired&&player.playing)player.stop();
    } else if(player?.playing)player.stop();
    status();return gate.snapshot();
  }
  async function unlock(){
    const AC=root.AudioContext||root.webkitAudioContext;
    if(!AC)throw Error('WEB_AUDIO_UNAVAILABLE');
    if(!context)context=new AC();
    if(context.state==='suspended')await context.resume();
    armed=context.state==='running';sync();return armed;
  }
  async function useFile(file,save=true){
    if(!Bank.validAudioFile(file))throw Error('Please select the owner-approved fire-alarm.mp3');
    const AC=root.AudioContext||root.webkitAudioContext;if(!AC)throw Error('WEB_AUDIO_UNAVAILABLE');
    if(!context)context=new AC();
    const audio=await context.decodeAudioData(await file.arrayBuffer());
    if(!audio||audio.duration<1||audio.duration>12)throw Error('Invalid fire-bell sample duration');
    player?.destroy();buffer=audio;player=new LoopPlayer(context,buffer);
    if(save){if(!bankReady)throw Error('LOCAL_AUDIO_BANK_NOT_READY');await bank.add('fireBell',file);}
    assetReady=true;sync();return audio.duration;
  }
  function mount(){
    if(panel||!$('inspector'))return;
    panel=root.document.createElement('section');panel.id='ownerFireBellAudioV1';
    panel.style.cssText='border:1px solid #79534b;border-radius:8px;padding:10px;background:#271923;color:#f6e1dd;direction:ltr';
    panel.innerHTML='<h3 style="margin:0 0 7px">FIRE BELL · OWNER AUDIO</h3>'+
      '<p id="fireBellAudioStatus" role="status" style="font-size:12px;line-height:1.4">AUDIO INITIALIZING</p>'+
      '<label style="font-size:12px;display:block">Owner source fire-alarm.mp3'+
      '<input id="fireBellSource" type="file" accept="audio/mpeg,.mp3" style="display:block;max-width:100%;margin:5px 0 9px"></label>'+
      '<button id="fireBellEnable" type="button">ENABLE FIRE BELL AUDIO</button>'+
      '<small style="display:block;margin-top:7px">One shared loop for ENG 1, ENG 2, APU, wheel well and OVHT/FIRE test; stops at BELL CUTOUT. FAULT/INOP, EXT TEST and lamp push tests never trigger the bell.</small>';
    $('inspector').append(panel);
    $('fireBellSource').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{await unlock();await useFile(file);}
      catch(error){$('fireBellAudioStatus').textContent='IMPORT ERROR: '+error.message;}
      e.target.value='';
    });
    $('fireBellEnable').addEventListener('click',()=>unlock().catch(error=>{$('fireBellAudioStatus').textContent=error.message;}));
    status();
  }
  // Browser gestures unlock autoplay. A missing approved recording stays silent.
  root.document.addEventListener('pointerdown',()=>{if(assetReady&&!armed)unlock().catch(()=>{});},{capture:true});
  root.document.addEventListener('keydown',()=>{if(assetReady&&!armed)unlock().catch(()=>{});},{capture:true});
  root.addEventListener('pagehide',()=>{gate.reset();player?.destroy();context?.close().catch(()=>{});});
  root.addEventListener('b737:ata26-panel-state',e=>{gate.setDemand('aircraft',Gate.fromATA26(e.detail?.derived));sync();});
  root.addEventListener('b737:fire-lab-visibility',e=>{
    gate.setMuted('aircraft',e.detail===true);
    if(e.detail===false)gate.setDemand('lab',false);
    sync();
  });
  function init(){
    mount();
    const existing=root.B737UnifiedFireLights?.evaluate?.();
    if(existing)gate.setDemand('aircraft',Gate.fromATA26(existing));
    bank.init().then(async()=>{
      bankReady=true;
      const imported=bank.get('fireBell');
      if(imported?.blob)await useFile(imported.blob,false);
      status();
    }).catch(error=>{root.console?.warn?.('Fire Bell sample unavailable:',error);status();});
  }
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  root.B737UnifiedFireBellAudioV1=Object.freeze({
    setDemand(source,on){const s=gate.setDemand(source,on);sync();return s;},
    setMuted(source,on){const s=gate.setMuted(source,on);sync();return s;},
    unlock,useFile,
    getState(){return {...gate.snapshot(),bankReady,assetReady,armed,playing:Boolean(player?.playing)};}
  });
})(typeof window==='object'?window:null);
