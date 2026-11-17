const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=__dirname;
test('two VHF COMM transfer selectors remain independent',()=>{
 const events=[],listeners={},window={addEventListener:(n,fn)=>{listeners[n]=fn},dispatchEvent:e=>events.push(e)};
 const document={readyState:'loading',addEventListener:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.join(base,'pedestal-vhf-comm-tfr-v1.js'),'utf8'),{
  window,document,MutationObserver:class{},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail}}
 });
 const api=window.B737UnifiedVHFCommTFRV1;
 assert.equal(api.getState('CAPT').activeSide,'left');
 assert.equal(api.getState('FO').activeSide,'left');
 assert.equal(api.setActive('CAPT','right'),true);
 assert.equal(api.getState('CAPT').activeWindowId,'comm-capt-right');
 assert.equal(api.getState('FO').activeWindowId,'comm-fo-left');
 assert.equal(events[0].type,'b737:vhf-comm-tfr');
 assert.equal(events[0].detail.reason,'transfer');
 assert.equal(api.setActive('CAPT','center'),false);
 assert.equal(api.setActive('UNKNOWN','left'),false);
 listeners['b737:unified-vhf-frequency']({detail:{kind:'COMM',seat:'CAPT',position:'right'}});
 assert.equal(events.at(-1).detail.reason,'active-tuned');
});
test('visible orange frequency bar is thick, photo-colored, and exclusive',()=>{
 const css=fs.readFileSync(path.join(base,'pedestal-vhf-comm-tfr-v1.css'),'utf8');
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 assert.match(css,/\[data-kind="COMM"\]\s+\.pd-freq-index\{display:none\}/);
 assert.match(css,/\[data-tfr-active="left"\].*?-left/);
 assert.match(css,/\[data-tfr-active="right"\].*?-right/);
 assert.match(css,/height:14%/);assert.match(css,/#fc884d/i);
 assert.match(html,/pedestal-vhf-comm-tfr-v1\.js/);
 assert.match(html,/pedestal-vhf-comm-tfr-v1\.css/);
});
