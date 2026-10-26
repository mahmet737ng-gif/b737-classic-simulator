'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'engine/maps/guarded-switches-fcom-visual-audit-v1.json'),'utf8'));
const quiz=JSON.parse(fs.readFileSync(path.join(root,'engine/maps/guarded-switch-owner-hinge-quiz-v1.json'),'utf8'));
test('Owner hinge quiz always lists all 17 cockpit guarded controls exactly once',()=>{
 assert.equal(quiz.questions.length,17);
 const actual=quiz.questions.map(q=>q.controlId).sort(),expected=source.controls.map(q=>q.id).sort();
 assert.deepEqual(actual,expected);
 assert.equal(new Set(actual).size,17);
 assert.deepEqual(quiz.ownerAnswerOptions,['Up','Down','Left','Right']);
});
test('Only authoritative owner-selected hinge directions populate answers',()=>{
 let count=0;
 for(const q of quiz.questions){
  assert.equal(typeof q.label,'string');
  if(q.selection){
   count++;
   assert.ok(quiz.ownerAnswerOptions.includes(q.selection),q.controlId);
   assert.ok(q.answerSource.startsWith('OWNER_'),q.controlId);
   assert.notEqual(q.answerStatus,'UNANSWERED');
  }else{
   assert.equal(q.answerStatus,'UNANSWERED',q.controlId);
   assert.equal(q.answerSource,'PENDING_OWNER_QUIZ',q.controlId);
  }
  assert.equal(q.oldSpriteUse,'FORBIDDEN_FOR_NEW_DESIGN');
  assert.equal(q.designStatus,'NOT_DESIGNED_NEW_ASSETS');
  assert.equal(q.physicalSizeMm,null);
 }
 assert.equal(count,quiz.summary.ownerConfirmed);
 assert.equal(quiz.summary.unanswered,17-count);
});
test('No unapproved hinge or single-size graphic can creep into fresh design registry',()=>{
 assert.match(quiz.oldAssetsPolicy,/DISREGARD/);
 assert.match(quiz.newDesignPolicy,/Unique independent/);
 assert.match(quiz.newDesignPolicy,/fixed hinge axis/);
 assert.match(quiz.answerRecording,/GitHub connector commits/);
 const recorder=quiz.questions.find(q=>q.controlId==='flight-recorder-test');
 assert.equal(recorder.selection,'Left','owner already explicitly verified lateral opening');
 assert.ok(quiz.questions.every(q=>q.targetAssetFamily.endsWith(q.controlId+'/')));
});
