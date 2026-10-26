'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'unity/preview/index.html'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root,'unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json'),'utf8'));
const stylesheet = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('Standalone preview is valid JavaScript and references ONLY the approved owner catalog',()=>{
 assert.ok(stylesheet);
 assert.ok(script);
 assert.doesNotThrow(()=>new vm.Script(script,{filename:'unity/preview/index.html'}));
 assert.ok(script.includes("GuardedSwitchBlueprints.json"));
 assert.equal(script.includes('Red_Guarded_'),false);
 assert.equal(script.includes('Black_Guarded_'),false);
 assert.equal(script.includes('oldSprites'),false);
 assert.equal(catalog.controls.length,17);
});

test('Open/closed preview body inherits identical shape, dimensions, material and texture',()=>{
 assert.ok(stylesheet.includes('.cover{'));
 const base=stylesheet.split('.cover{')[1].split('}')[0];
 for(const t of ['width:var(--w)','height:var(--h)','border-radius:var(--r)','background:var(--swatch)'])
  assert.ok(base.includes(t),t);
 for(const m of stylesheet.matchAll(/\.cover\.hinge-[a-z]+\.open\{([^}]+)\}/g)){
  assert.match(m[1],/^transform:/);
  assert.doesNotMatch(m[1],/background|border-radius|width:|height:|opacity:|filter:/,'pose-only transform');
 }
 assert.equal([...stylesheet.matchAll(/\.cover\.hinge-[a-z]+\.open\{/g)].length,4);
 assert.match(script,/mat\.swatchHex/);
 assert.ok(script.includes('frame.append(under,cover,hinge)'),'fixed hinge must be sibling, not inside rotating guard');
 assert.ok(!script.includes('cover.append(hinge)'),'hinge barrel cannot rotate with lid');
 assert.ok(script.includes('cover.style.clipPath=profiles[g.contourProfile]'),'same contour used in both poses');
});

test('Browser mockup is independent of immutable original overhead and old guards',()=>{
 assert.ok(html.includes('پیش‌نمایش'));
 assert.ok(html.includes('تأیید نشده'));
 assert.ok(!html.includes('all-overhead'));
 assert.ok(!html.includes('Black_Guarded_CLOSED'));
 assert.ok(!html.includes('Red_Guarded_CLOSED'));
});
