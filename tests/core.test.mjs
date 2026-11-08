import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK, buildQuestions, masteryOf, stageStats, newStore, validateStore, csvOf, localDate } from '../docs/core.js';
const record = (a,b,input,day='2026-11-08',mode='challenge') => ({
  sessionId:'sample', mode,kind:mode==='challenge'?'full':'mixed',a,b,input,correct:input===a*b,elapsedMs:2500,
  answeredAt:`${day}T12:00:00.000Z`,localDate:day
});
test('81 unique ordered expressions', () => {
  assert.equal(BANK.length,81);assert.equal(new Set(BANK.map(q=>`${q.a},${q.b}`)).size,81);
  assert.ok(BANK.some(q=>q.a===7&&q.b===8)); assert.ok(BANK.some(q=>q.a===8&&q.b===7));
});
test('stage and full contain no duplicates', () => {
  const stage=buildQuestions({kind:'stage',stage:7,random:()=>.5});
  assert.equal(stage.length,9);assert.ok(stage.every(q=>q.a===7));
  const full=buildQuestions({kind:'full'});
  assert.equal(full.length,81);assert.equal(new Set(full.map(q=>`${q.a},${q.b}`)).size,81);
});
test('mixed 10 and 20 lengths', () => {
  assert.equal(buildQuestions({kind:'mixed',count:10}).length,10);
  assert.equal(buildQuestions({kind:'mixed',count:20}).length,20);
});
test('mastery is based only on challenge and distinct days', () => {
  const p=[record(7,8,56,'2026-11-06','practice')];
  assert.equal(masteryOf(7,8,p),'unseen');
  const d1=[...p,record(7,8,56,'2026-11-07'),record(7,8,56,'2026-11-07')];
  assert.equal(masteryOf(7,8,d1),'learning');
  const d2=[...d1,record(7,8,56,'2026-11-08')];
  assert.equal(masteryOf(7,8,d2),'mastered');
  assert.equal(masteryOf(7,8,[...d2,record(7,8,54,'2026-11-08')]),'practice');
});
test('weak question prioritizes latest incorrect',()=>{
 const history=[record(7,8,54)];
 const qs=buildQuestions({kind:'weak',count:10,records:history,random:()=>.5});
 assert.ok(qs.some(q=>q.a===7&&q.b===8));
});
test('stage stats count only unique tested expressions',()=>{
 const s=stageStats([record(3,4,12),record(3,4,12),record(3,5,10)]);
 assert.equal(s[2].tested,2);assert.equal(s[2].latestCorrect,1);
});
test('backup validates, prevents changed correctness and prototype pollution',()=>{
 const store=newStore();store.records.push(record(7,8,56));
 assert.equal(validateStore(store).records.length,1);
 const bad=structuredClone(store);bad.records[0].correct=false;
 assert.throws(()=>validateStore(bad));
 const injected=structuredClone(store);injected.surprise='ignore';
 assert.equal('surprise' in validateStore(injected),false);
});
test('CSV has header and safe escaped data',()=>{
 const csv=csvOf([record(7,8,56)]);
 assert.ok(csv.includes('7×8'));assert.ok(csv.startsWith('\ufeff'));
});
test('calendar date uses local day',()=>{
 assert.equal(localDate(new Date(2026,10,8,12)), '2026-11-08');
});

import { scoreBand, awardPerfect, REWARD_PICTURES, totalRewardTiles, currentRewardIndex } from '../docs/core.js';
test('six score bands: 100, 80-99, 60-79, 40-59, 20-39, 0-19',()=>{
 const bands=[[0,'courage'],[1,'courage'],[2,'training'],[3,'training'],[4,'keepgoing'],[5,'keepgoing'],[6,'good'],[7,'good'],[8,'great'],[9,'great'],[10,'perfect']];
 for(const [score,band] of bands)assert.equal(scoreBand(score,10),band);
 assert.equal(scoreBand(9,9),'perfect');
 assert.equal(scoreBand(65,81),'great');
 assert.throws(()=>scoreBand(11,10));
});
test('four rewards fixed in a secret order with four unique tiles each',()=>{
 const s=newStore();
 assert.deepEqual(s.reward.pictures.map(p=>p.id),REWARD_PICTURES.map(p=>p.id));
 assert.equal(s.reward.pictures.length,4);
 for(const p of s.reward.pictures)assert.deepEqual([...p.order].sort(),[0,1,2,3]);
 assert.equal(currentRewardIndex(s.reward),0);
});
test('only full-score 81-question challenge unlocks a tile',()=>{
 const s=newStore();
 for(const bad of [
  {id:'practice',mode:'practice',kind:'full',correct:81,total:81},
  {id:'stage',mode:'challenge',kind:'stage',correct:9,total:9},
  {id:'mixed',mode:'challenge',kind:'mixed',correct:10,total:10},
  {id:'weak',mode:'challenge',kind:'weak',correct:20,total:20},
  {id:'partial',mode:'challenge',kind:'full',correct:80,total:81},
  {id:'forged',mode:'challenge',kind:'full',correct:9,total:9}
 ])assert.equal(awardPerfect(s,bad),null);
 assert.equal(totalRewardTiles(s.reward),0);
 const won=awardPerfect(s,{id:'ok',mode:'challenge',kind:'full',correct:81,total:81});
 assert.equal(won.pictureIndex,0);
 assert.equal(won.unlocked,1);
 assert.equal(awardPerfect(s,{id:'ok',mode:'challenge',kind:'full',correct:81,total:81}),null);
 assert.equal(totalRewardTiles(s.reward),1);
});
test('16 unique 81/81 challenges complete four rewards and never double-count',()=>{
 const s=newStore(()=>0.37),seen=[];
 for(let i=0;i<16;i++){
  const result=awardPerfect(s,{id:`reward-${i}`,mode:'challenge',kind:'full',correct:81,total:81});
  assert.equal(result.pictureIndex,Math.floor(i/4));
  seen.push(`${result.pictureIndex}:${result.tileIndex}`);
  assert.equal(result.pictureComplete,i%4===3);
  assert.equal(result.collectionComplete,i===15);
 }
 assert.equal(new Set(seen).size,16);
 assert.equal(currentRewardIndex(s.reward),-1);
 assert.equal(totalRewardTiles(s.reward),16);
 assert.equal(awardPerfect(s,{id:'after',mode:'challenge',kind:'full',correct:81,total:81}),null);
 assert.equal(totalRewardTiles(s.reward),16);
});
test('v4 backup validates and round-trips while legacy versions are rejected',()=>{
 const v4=newStore(()=>0.37);v4.records.push(record(7,8,56));
 v4.sessions.push({id:'sample',mode:'challenge',kind:'full',total:81,correct:81,completedAt:'2026-11-08T12:00:00.000Z'});
 awardPerfect(v4,v4.sessions[0]);
 const again=validateStore(JSON.parse(JSON.stringify(v4)));
 assert.equal(again.schemaVersion,4);
 assert.equal(again.records.length,1);
 assert.equal(again.reward.pictures[0].unlocked,1);
 assert.equal(again.reward.earnedSessionIds.length,1);
 assert.equal(again.settings.effects,'normal');
 for(const v of [1,2,3]) {
  const legacy=structuredClone(v4);legacy.schemaVersion=v;
  assert.throws(()=>validateStore(legacy),/旧形式/);
 }
 const bad=structuredClone(v4);bad.reward.pictures[0].order=[0,0,1,2];
 assert.throws(()=>validateStore(bad),/ご褒美/);
 const inconsistent=structuredClone(v4);inconsistent.reward.pictures[1].unlocked=1;
 assert.throws(()=>validateStore(inconsistent),/ご褒美/);
 const fake=structuredClone(v4);fake.sessions[0].total=9;
 assert.throws(()=>validateStore(fake),/テスト履歴/);
 const wrong=structuredClone(v4);wrong.records[0].kind='mixed';
 assert.throws(()=>validateStore(wrong),/回答履歴/);
});
test('in-progress 81-question challenge is valid and malformed challenge is rejected',()=>{
 const s=newStore();const questions=buildQuestions({kind:'full',random:()=>.5});
 s.active={id:'now',mode:'challenge',kind:'full',questions,index:9,elapsedMs:45};
 assert.equal(validateStore(s).active.questions.length,81);
 const bad=structuredClone(s);bad.active.questions.pop();
 assert.throws(()=>validateStore(bad),/途中のテスト/);
 const invalidMode=structuredClone(s);invalidMode.active.kind='weak';
 assert.throws(()=>validateStore(invalidMode),/途中のテスト/);
});
test('completed collection remains valid after an extra unique full-score challenge',()=>{
 const s=newStore();
 for(let i=0;i<17;i++)awardPerfect(s,{id:`won-${i}`,mode:'challenge',kind:'full',correct:81,total:81});
 assert.equal(totalRewardTiles(validateStore(s).reward),16);
});

// C05 artwork integration: no code-drawn SVG replacement and all approved crops exist.
import { animalSvg } from '../docs/animals.js';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const assetBase=resolve(dirname(fileURLToPath(import.meta.url)),'../docs/assets/characters');
test('approved watercolor sprite exists for every animal and used pose',()=>{
  for(const type of ['cat','dog','rabbit','squirrel']){
    for(const pose of ['home','jump','spin','clap','star','weights','coach']){
      const markup=animalSvg(type,pose);
      const filename=markup.match(/src="\.\/assets\/characters\/([a-z-]+\.webp)"/)?.[1];
      assert.ok(filename,`${type}/${pose}: missing relative image`);
      const file=resolve(assetBase,filename);
      assert.ok(existsSync(file),`${filename}: missing asset`);
      assert.ok(statSync(file).size>1000,`${filename}: empty sprite`);
      assert.match(markup,/class="animal-friend"/);
      assert.doesNotMatch(markup,/https?:\/\//i);
      assert.doesNotMatch(markup,/<svg\b/i);
    }
  }
});
test('home artwork uses the approved cat and source keeps both arms',()=>{
  const html=animalSvg('cat','home');
  assert.match(html,/cat-home\.webp/);
  assert.match(html,/aria-label="ねこのイラスト"/);
});
