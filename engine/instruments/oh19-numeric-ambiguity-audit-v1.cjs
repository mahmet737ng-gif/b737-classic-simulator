#!/usr/bin/env node
'use strict';
// Conservatively bracket the 32 source-photo marks not assigned any real
// numeric legend. No interpolated numbers are certified or used in motion.
const fs=require('node:fs'),path=require('node:path');
const ledger=require('./oh19-native-ticks-batch1.json');
const photo=require('./oh19-cab-alt-photo-anchors-v1.json');
const chk=require('./stage10-preview-scale-subset-v1.json');
const cab=ledger.scales.find(s=>s.mode==='cabinAltitude');
const press=ledger.scales.find(s=>s.mode==='diffPressure');
const altLabels=photo.marks.map(x=>({valueFt:x.valueFt,angleDeg:x.angleDeg}));
const ambiguous=[];
for(const mark of cab.allVisibleTickCandidates){
 const exact=altLabels.some(a=>Math.abs(a.angleDeg-mark.angleDeg)<.015);
 if(exact)continue;
 const before=altLabels.filter(a=>a.angleDeg<mark.angleDeg).at(-1);
 const after=altLabels.find(a=>a.angleDeg>mark.angleDeg);
 if(!before||!after)throw Error('No true bracket for ambiguous mark '+mark.index);
 if(before.valueFt>=after.valueFt)throw Error('Invalid original photo bracket');
 ambiguous.push({index:mark.index,bearingDeg:mark.angleDeg,
  printedValueFt:null,
  knownLowerBracketFt:before.valueFt,knownUpperBracketFt:after.valueFt,
  inferredLegacyFtMustNotBeUsed:true,
  status:'UNRESOLVED_NONNUMERIC_PHOTO_STROKE'});
}
if(ambiguous.length!==32)throw Error('Unexpected count of ambiguous CAB ALT strokes');
const stage=chk.calibrations['oh.cabin.diff_pressure_altitude:diffPressure'].anchors;
const byValue=new Map(stage.map(a=>[a.value,a]));
const diff=press.allVisibleTickCandidates.filter(x=>x.labelOrigin==='printed_major').map(p=>{
 const a=byValue.get(p.interpretedValuePsi);
 if(!a)throw Error('Outer source number missing from stage10 '+p.interpretedValuePsi);
 const stageAngle=((a.angleDeg%360)+360)%360;
 const delta=((((p.angleDeg-stageAngle+540)%360)+360)%360)-180;
 return {psi:p.interpretedValuePsi,ledgerAngle:p.angleDeg,
  stage10Angle:stageAngle,angularDisagreementDeg:Number(Math.abs(delta).toFixed(3)),
  sourceCandidateConflict:Math.abs(delta)>2};
});
const conflicts=diff.filter(x=>x.sourceCandidateConflict);
const result={
 schema:'b737.oh19.unresolved-numeric-photo-ambiguities.v1',
 source:{path:ledger.source.asset,sha256:ledger.source.sha256},
 ownerStack:{rear:'press',front:'cabAlt'},
 printedScales:{inner:'cabinAltitudeFt',outer:'differentialPsid'},
 count:{CAB_ALT_ambiguous:ambiguous.length,altCandidateAnchors:15,
  pressurePrintedMajors:11,pressureConflictingAngles:conflicts.length},
 sourceReferenceOnly:true,allPhysicalTicksCertified:false,
 releasePermitted:false,unknownNumericMarkCandidates:ambiguous,
 crossRegistryPressureMajorComparisons:diff
};
const dest=path.resolve(__dirname,'../../artifacts/oh19-pixel-qa/OH19_NUMERIC_AMBIGUITIES.json');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
console.log('OH19 CAB ALT unresolved numeric values:',ambiguous.length);
console.log('OH19 PRESS angular source candidate disagreements >2 deg:',conflicts.length);
console.log('OH19 preview needle flight-accepted:',result.releasePermitted);
