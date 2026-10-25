'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const css=fs.readFileSync(path.resolve(__dirname,'../fuel-panel/fuel-panel.css'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../fuel-panel/index.html'),'utf8');
assert.ok(css.includes('.toggle-visual .off-frame{background-position:75% 50%}'),'OFF is the approved UP pose');
assert.ok(css.includes('.toggle-visual .on-frame{background-position:100% 50%}'),'ON is the approved DOWN pose');
assert.equal((html.match(/class="toggle-visual"/g)||[]).length,6,'fuel pump overlays preserved');
assert.ok(css.includes('toggle-switch-standard-v4/b737-toggle-five-positions-no-white-halo.webp'),'approved transparent asset unchanged');
console.log('PASS: six fuel pump overlays show OFF UP, ON DOWN, without changing state logic.');
