'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../fuel-panel'),css=fs.readFileSync(path.join(dir,'fuel-panel.css'),'utf8'),html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),js=fs.readFileSync(path.join(dir,'fuel-panel.js'),'utf8');
assert.equal((html.match(/class="toggle-visual"/g)||[]).length,6);
assert.ok(!html.includes('class="off-frame"')&&!html.includes('class="on-frame"'));
assert.ok(!css.includes('toggle-switch-standard-'));assert.ok(css.includes('.toggle-visual,.toggle-visual img{display:none!important'));
assert.ok(js.includes("visual.classList.toggle('on'"));
console.log('PASS: six pump toggle states kept without sprite imagery');
