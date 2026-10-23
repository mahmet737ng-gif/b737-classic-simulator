// Regression guard for independently updateable Panel Mosaic Lab.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const here=__dirname;
const registry=JSON.parse(fs.readFileSync(path.join(here,'registry.json'),'utf8'));
const html=fs.readFileSync(path.join(here,'index.html'),'utf8');
assert.equal(registry.panels.length,3,'exactly 3 source sections');
assert.equal(registry.tiles.length,59,'59 draft regions');
const expected={OH:25,MP:13,PD:21};
const seen=new Set();
for(const p of registry.panels){
 assert.ok(fs.existsSync(path.resolve(here,p.image)),'source image missing '+p.id);
 const list=registry.tiles.filter(t=>t.id.startsWith(p.code+'-'));
 assert.equal(list.length,expected[p.code],'count '+p.code);
 for(const t of list){
  assert.ok(!seen.has(t.id),'duplicate '+t.id);seen.add(t.id);
  assert.match(t.id,/^(OH|MP|PD)-\d\d$/);
  assert.ok(Number.isFinite(t.x)&&Number.isFinite(t.y)&&Number.isFinite(t.w)&&Number.isFinite(t.h));
  assert.ok(t.x>=0&&t.y>=0&&t.w>0&&t.h>0&&t.x+t.w<=p.w&&t.y+t.h<=p.h,'box outside source: '+t.id);
  assert.ok(['mapped','artwork','review','approved','locked'].includes(t.status),'invalid status '+t.id);
  if(t.artwork)assert.ok(fs.existsSync(path.resolve(here,t.artwork)),'artwork missing '+t.id);
 }
}
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,1,'standalone one-script viewer');
new vm.Script(scripts[0][1],{filename:'panel-mosaic-lab/index.html (inline script)'});
assert.ok(html.includes('registry.json'),'viewer must load updatable registry');
console.log('Panel Mosaic QA PASS: 59 unique regions / 3 sources / valid inline JS');
