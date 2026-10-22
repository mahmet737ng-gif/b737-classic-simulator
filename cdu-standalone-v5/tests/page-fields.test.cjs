const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const engine=require('../engine/cdu-engine.js');const pages=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/page-definitions.json'))).pages;
const index=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/ch11-page-index.json')));
const keys=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/cdu-map.json'))).controls;
assert.equal(index.count,409);assert.equal(index.pages[0].pdf_page,1414);assert.equal(index.pages.at(-1).pdf_page,1822);
assert.equal(new Set(index.pages.map(x=>x.pdf_page)).size,409);assert.ok(Object.keys(pages).length>=30);
assert.equal(keys.length,70);let populated=0,editable=0,nav=0;
for(const [id,p] of Object.entries(pages)){
 assert.equal(p.rows.length,6,id);
 assert.ok(index.pages.some(x=>x.pdf_page===p.source_ref.pdf_page_near),id);
 for(let n=0;n<6;n++){assert.equal(p.rows[n].length,2);for(const c of p.rows[n]){
  assert.ok(c.lsk===('L'+(n+1))||c.lsk===('R'+(n+1)));
  if(c.field){editable++;assert.ok(c.format,id+' '+c.lsk)}
  if(c.action){nav++;assert.ok(pages[c.action.page],id+' '+c.lsk+' -> '+c.action.page)}
  if(c.field||c.action||c.value)populated++;
 }}
}
const st=engine.makeState();const press=k=>engine.press(st,pages,'CDU_CAPT_'+k);
const type=str=>[...str].forEach(c=>press('KEY_'+(/[A-Z0-9]/.test(c)?c:({'.':'DOT','/':'SLASH',' ':'SP'})[c])));
press('RTE');assert.equal(st.page,'RTE');type('OIII');press('LSK_L1');assert.equal(engine.readValue(st,'ORIGIN'),'OIII');assert.equal(engine.pendingCount(st),0);assert.equal(engine.lights(st).EXEC,false);press('LSK_L5');assert.equal(engine.pendingCount(st),1);assert.equal(engine.lights(st).EXEC,true);
press('EXEC');assert.equal(st.active.ORIGIN,'OIII');assert.equal(engine.lights(st).EXEC,false);
press('INIT_REF');assert.equal(st.page,'INDEX');press('LSK_R2');assert.equal(st.page,'PERF_INIT');
type('201');press('LSK_L5');assert.equal(st.message,'INVALID ENTRY');assert.equal(engine.lights(st).MSG,true);press('KEY_CLR');assert.equal(st.message,'');assert.equal(engine.lights(st).MSG,false);press('KEY_CLR');press('KEY_CLR');press('KEY_CLR');type('100');press('LSK_L5');assert.equal(engine.readValue(st,'CI'),'100');
press('EXEC');assert.equal(st.active.CI,'100');assert.equal(engine.lights(st).EXEC,false);
press('KEY_PLUS_MINUS');assert.equal(st.scratch,'-');press('KEY_PLUS_MINUS');assert.equal(st.scratch,'+');
press('KEY_CLR');assert.equal(st.scratch,'');
press('RTE');type('KJFK');press('LSK_R1');assert.equal(engine.readValue(st,'DEST'),'KJFK');assert.equal(engine.lights(st).EXEC,false);press('NEXT_PAGE');assert.equal(st.page,'FLIGHT_PLAN');press('PREV_PAGE');assert.equal(st.page,'RTE');
assert.equal(engine.render(st,pages).length,14);assert.ok(engine.render(st,pages).every(s=>s.length<=24));
// Every page's 12 LSKs must either execute a declared action or emit inactive (never assume missing data).
for(const [id,p] of Object.entries(pages))for(let i=1;i<=6;i++)for(const lr of 'LR'){const c=p.rows[i-1][lr==='L'?0:1];let x=engine.makeState(id);engine.press(x,pages,'CDU_CAPT_LSK_'+lr+i);if(!c.field&&!c.action)assert.equal(x.message,'KEY INACTIVE',id+lr+i);}
console.log(`PASS: ${index.count} FCOM-page source refs, ${Object.keys(pages).length} page templates, ${populated} defined slots (${editable} editable, ${nav} links), 70 controls; v3 CDU state tests`);