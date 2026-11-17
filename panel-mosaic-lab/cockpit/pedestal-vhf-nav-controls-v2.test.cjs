const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=__dirname;
test('NAV AUTO frequency remains readable in MANUAL and the asset is original Small Silver',()=>{
 const css=fs.readFileSync(path.join(dir,'pedestal-vhf-nav-controls-v1.css'),'utf8');
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
 assert.match(css,/Small_Silver_5Positions\.webp/);
 assert.match(css,/background-size:500% 100%/);
 for(const pose of ['25%','75%','100%'])assert(css.includes('background-position:'+pose+' 50%'));
 assert.match(css,/data-nav-mode="manual".*?-auto/);
 assert.match(html,/PD-NAV-CTRL-0002/);
});
test('NAV AUTO and MANUAL independently tune and indicators remain scoped to seat',()=>{
 const script=fs.readFileSync(path.join(dir,'pedestal-vhf-nav-controls-v1.js'),'utf8');
 const handlers={},events=[],frequency=new Map([
  ['nav-capt-auto',110300],['nav-fo-auto',111300],
  ['nav-capt-manual',113900],['nav-fo-manual',114400]
 ]);
 const window={addEventListener:(n,f)=>{handlers[n]=f},dispatchEvent:e=>events.push(e),
  B737UnifiedMechanicalFrequencyV1:{
   getState:id=>({frequencyKhz:frequency.get(id)??null}),
   setNavAuto:(seat,khz)=>{frequency.set('nav-'+seat.toLowerCase()+'-auto',khz);return true}
  },
  B737UnifiedVHFDualV1:{
   nextFrequency:(kind,khz,part,dir)=>{
    const whole=Math.floor(khz/1000),fraction=khz%1000;
    return part==='outer'?(108+(((whole-108+dir)%10+10)%10))*1000+fraction:
     whole*1000+(((fraction/50+dir)%20+20)%20)*50;
   }
  }
 };
 const document={readyState:'loading',addEventListener:()=>{},querySelector:()=>null};
 vm.runInNewContext(script,{window,document,MutationObserver:class{},
  CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}}});
 const api=window.B737UnifiedVHFNavControlsV1;
 assert.equal(api.getState('CAPT').autoFrequencyKhz,110300);
 assert.equal(api.setMode('CAPT','manual'),true);
 assert.equal(api.getState('CAPT').activeFrequencyKhz,113900);
 assert.equal(api.tuneAuto('CAPT','inner',1),true);
 assert.equal(api.getState('CAPT').autoFrequencyKhz,110350);
 assert.equal(api.getState('CAPT').inactiveFrequencyKhz,110350);
 assert.equal(api.getState('CAPT').activeFrequencyKhz,113900);
 assert.equal(api.getState('FO').mode,'auto');
 assert.equal(api.getState('FO').autoFrequencyKhz,111300);
 assert.equal(events.at(-1).detail.reason,'auto-window-tuned');
 assert.equal(api.tuneAuto('CAPT','outer',-1),true);
 assert.equal(api.getState('CAPT').autoFrequencyKhz,109350);
 assert.equal(api.setTest('CAPT','vorDme','up'),true);
 assert.equal(api.getState('CAPT').activeTest.vorDme,'up');
 assert.equal(api.setTest('CAPT','vorDme','center'),true);
 assert.equal(api.getState('CAPT').activeTest.vorDme,'center');
});
