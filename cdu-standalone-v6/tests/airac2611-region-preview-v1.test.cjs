'use strict';
// Derived metadata only. Does not contain licensed NAVDATA or procedure rows.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const api=require('../../engine/ch11/airac2611-middle-east-preview-v1');
assert.equal(api.intake.cycle,'2611');
assert.equal(api.intake.scope,'IRAN_IRAQ_MIDDLE_EAST');
assert.equal(api.intake.regionalProcedureFileCount,256);
assert.equal(api.intake.regionalAirportCoordinateCount,407);
assert.equal(api.intake.sourceCycleConflictInRegion,0);
assert.equal(api.intake.excludedOutOfRegionLegacyCycleFiles,6);
assert.equal(api.intake.sourceOnly,true);
assert.equal(api.intake.fmcActive,false);
assert.equal(api.intake.fmcInstalled,false);
assert.equal(api.intake.fmcExecutable,false);
assert.equal(api.intake.validFrom,'2026-10-29');
assert.equal(api.intake.lastValid,'2026-11-25');
assert.equal(api.intake.expiresFrom,'2026-11-26');
assert.deepEqual(api.identPreviewRow(2),{labelL:'NAV SOURCE',valueL:'2611 ME REF',labelR:'VALID FROM',valueR:'29OCT2026'});
assert.deepEqual(api.identPreviewRow(3),{labelL:'LAST VALID',valueL:'25NOV2026',labelR:'EXPIRES',valueR:'26NOV2026'});
assert.equal(api.identPreviewRow(1),null);
assert.equal(api.identPreviewRow(6),null);
assert.throws(()=>api.identPreviewRow(7),/INVALID_IDENT_ROW/);
for(const line of [api.identPreviewRow(2),api.identPreviewRow(3)])
 for(const t of Object.values(line))assert.ok(t.length<=11,'Source preview must fit LSK 11-column side: '+t);
const app=read('cdu-standalone-v6/app.js');
assert.match(app,/showRegionalSource2611&&regionalSource\?\.intake\?\.sourceOnly===true/);
assert.match(app,/core\.choose\(state,pages,'IDENT'\);update\(\)/);
assert.match(app,/getRegionalSourcePreview/);
assert.ok(!/regionalSource\?\.intake[\s\S]*?fmcNavDataBanks\.activeCycle\s*=/.test(app),
 'Source preview must not mutate an ACTIVE FMC bank');
const standalone=read('cdu-standalone-v6/index.html'),embedded=read('panel-mosaic-lab/cockpit/cdu-stage.html');
for(const html of [standalone,embedded]){
 assert.match(html,/airac2611-middle-east-preview-v1\.js\?v=AIRAC2611-ME-IDENT-PREVIEW-20261031-01/);
 assert.match(html,/app\.js\?v=AIRAC2611-ME-IDENT-PREVIEW-20261031-01/);
}
console.log('PASS: private AIRAC 2611 regional metadata dates displayed as opt-in IDENT source preview; no false ACTIVE bank.');
