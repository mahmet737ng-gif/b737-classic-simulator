/* Offline static safety checks for isolated Cockpit Pro shell. Run: node --test panel-mosaic-lab/desktop-shell/shell-static.test.cjs */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),shell=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const profile=fs.readFileSync(path.join(root,'engine/config/aircraft-profile-v1.js'),'utf8');
function has(needle){assert.ok(shell.includes(needle),'missing '+needle)}
test('initial selector is abstract CSS only, no decorative cockpit or airplane photography',()=>{
 assert.match(shell,/<main id="setup">/);
 const front=shell.split('</main>')[0];
 assert.doesNotMatch(front,/<img\s/i);
 assert.doesNotMatch(front,/background-image\s*:/i);
 for(const x of ['Aircraft Variant','Cabin Pressurization','Engine Indication'])has(x);
});
test('all 8 option combinations use the single existing profile schema',()=>{
 has("storageKey='b737classic.aircraft-profile.v1'");
 has("schema:'b737-classic-aircraft-profile/1'");
 assert.match(profile,/const STORAGE_KEY = 'b737classic\.aircraft-profile\.v1'/);
 for(const val of ['B737-300-500','B737-400','CPCS','DCPCS','EIS','CONVENTIONAL']){
  assert.ok(shell.includes('data-value="'+val+'"'));
  assert.ok(profile.includes("id: '"+val+"'"));
 }
});
test('no existing cockpit assets or lock files rewritten',()=>{
 has("src(){return '../cockpit/index.html?desktop-shell=001';}");
 assert.doesNotMatch(shell,/innerHTML\s*=\s*.*guard-owner18/);
 assert.doesNotMatch(shell,/guard-redzone-lock\.json.*write/i);
});
test('preflight checks use actual asset and dependent system readiness, including visible textures',()=>{
 for(const id of ['readyConfig','readyMain','readyOverhead','readyCdu','sceneVisibleImagesReady','B737FlapVisualTest','throttle-position-controls'])has(id);
 assert.match(fs.readFileSync(path.join(__dirname,'startup-gate.js'),'utf8'),/images\.every\(img=>img\.complete&&img\.naturalWidth>0\)/);
});
test('CB buttons select real lab panels and selected pressure family',()=>{
 has("frame.src='../../cb-panel-lab/'");
 has("variant.value=profile.pressurization");
 has("selector.dispatchEvent(new Event('change'");
 for(const id of ['P6-1','P6-3','P6-4','P18-1','P18-2','P18-3'])has("'"+id+"'");
});
test('nine flap positions and gates are owned by existing B737FlapVisualTest',()=>{
 has("const f=w.B737FlapVisualTest");
 has("f.positions");
 has("f.request(target)");
});
test('throttle shortcuts drive existing five-position panel selection, no fake engine state',()=>{
 has("w.document.querySelectorAll('#throttle-position-controls select')");
 has("sel.dispatchEvent(new Event('change'");
 for(const key of ['F1','F2','F3','F4','F5','F6','F7','F8'])has("'"+key+"'");
});
test('do not fake presets, spoilers, full update mechanism or inaccessible audio',()=>{
 has('if(!engine?.apply)');
 has("Arm Spoilers");
 has("Landing Gear");
 has("صوتی");
 has('https://api.github.com/repos/');
 has('این نسخهٔ وب فقط بررسی می‌کند');
});
test('HTML structure contains matching scripting tags and essential shells',()=>{
 assert.equal((shell.match(/<script(?:\s[^>]*)?>/g)||[]).length,3);
 assert.equal((shell.match(/<\/script>/g)||[]).length,3);
 for(const id of ['workspace','setup','cockpit','loadcover','cbTool','audioTool','keysTool','update'])has('id="'+id+'"');
});
