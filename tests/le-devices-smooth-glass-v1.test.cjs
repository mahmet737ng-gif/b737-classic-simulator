'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const blob=buf=>crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');

test('smooth glass adapter recolors only all 26 existing inset lens faces',()=>{
 class Element {
  constructor(localName){this.localName=localName;this.attributes={};this.children=[];this.isConnected=true;
   this.classList={items:new Set(),add:name=>this.classList.items.add(name),contains:name=>this.classList.items.has(name)};}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]||null;}
  append(child){this.children.push(child);}
  querySelector(name){return name==='defs'?this.children.find(x=>x.localName==='defs'):null;}
  querySelectorAll(name){return name==='g[data-lens-id]'?this.children.filter(x=>x.localName==='g'):[];}
 }
 const lens=new Element('svg');lens.append(new Element('defs'));
 const original=[];
 for(let i=0;i<26;i++){
  const group=new Element('g');
  group.setAttribute('data-lens-id','SLAT_'+(i+1)+'|'+(i%3===0?'TRANSIT':'FULL_EXT'));
  const first=new Element('path'),second=new Element('path');
  first.setAttribute('fill','url(#original)');second.setAttribute('fill','url(#original-sheen)');
  group.append(first);group.append(second);lens.append(group);original.push({group,first,second});
 }
 const document={readyState:'loading',addEventListener(){},
  createElementNS(_ns,tag){return new Element(tag);},
  querySelectorAll(query){return query==='svg.b737-le-photolens-v2'?[lens]:[];}};
 const window={addEventListener(){}};
 const code=read('panel-mosaic-lab/le-devices/smooth-glass-v1.js');
 vm.runInNewContext(code,{window,document,MutationObserver:class{}},{filename:'smooth-glass-v1.js'});
 window.B737LESmoothGlassV1.refresh();
 assert.equal(original.length,26);
 const defs=lens.querySelector('defs');
 assert.equal(defs.children.length,3,'two radial gradients and one very mild sheen');
 assert.deepEqual(defs.children.map(x=>x.localName),['radialGradient','radialGradient','linearGradient']);
 assert.equal(lens.getAttribute('data-glass-version'),'LE-SMOOTHGLASS-0001');
 for(const {group,first,second} of original){
  assert.equal(group.children.length,2,'no switch, geometry, or lens replacement');
  assert.match(first.getAttribute('fill'),/^url\(#lesmooth\d+-(a|g)\)$/);
  assert.match(second.getAttribute('fill'),/^url\(#lesmooth\d+-s\)$/);
 }
 window.B737LESmoothGlassV1.refresh();
 assert.equal(defs.children.length,3,'idempotent remount');
 assert.equal(window.B737LESmoothGlassV1.status()[0].windows,26);
});
test('only new presentation assets mounted in Unified; immutable owner locks preserved',()=>{
 const lock=JSON.parse(read('engine/locks/le-devices-final-lock-v1.json'));
 const v3=JSON.parse(read('engine/locks/le-photolens-runtime-v3-lock.json'));
 const panel=fs.readFileSync(path.join(root,'panel-mosaic-lab/le-devices/panel.js'));
 const lens=fs.readFileSync(path.join(root,v3.asset));
 assert.equal(blob(panel),lock.frozenFiles['panel-mosaic-lab/le-devices/panel.js']);
 assert.equal(blob(lens),v3.assetGitBlobSha);
 for(const [p,rel] of [
  ['panel-mosaic-lab/le-devices/index.html','./smooth-glass-v1'],
  ['panel-mosaic-lab/cockpit/overhead-stage.html','../le-devices/smooth-glass-v1']
 ]){
  const html=read(p);
  assert.ok(html.includes(rel+'.js?v=LE-SMOOTHGLASS-0001'),p);
  assert.ok(html.includes(rel+'.css?v=LE-SMOOTHGLASS-0001'),p);
  assert.ok(html.indexOf('photo-lens-v3.js')<html.indexOf(rel+'.js'), 'lens driver must load first');
 }
 const a=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 assert.match(a.regions.find(x=>x.id==='overhead').embeddedUrl,/LE-SMOOTHGLASS-0001/);
 const js=read('panel-mosaic-lab/le-devices/smooth-glass-v1.js');
 assert.doesNotMatch(js,/setDevice\(|setWindow\(|setLampTest\(|setPower\(/,'adapter must never mutate lamp logic');
});
