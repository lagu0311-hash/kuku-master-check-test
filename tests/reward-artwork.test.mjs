import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {REWARD_PICTURES,newStore,validateStore} from '../docs/core.js';

const approved=[
  ['flower-cat','01_flower_cat__7D87821B-0515-4E82-B91C-AFCD6444CC38.jpeg',872288,'ee6048851351503c348d6f860b1de89f0cfe8109c43f6fa4da8070e7593dc883'],
  ['starry-cat','02_starry_cat__E011D51A-3ACD-4527-A4D8-2C1536AE6F7E.jpeg',946773,'3dd2cb20e82b65b0705f1fd1d68c4c4baf8e8cb34281c5609b32520b34ae530e'],
  ['picnic-friends','03_picnic_friends__1067876E-2918-4A31-98E9-E59F62885D4E.jpeg',817595,'3b0d43f376a31479f918e78928dbd5b7eadce9613033697d0570443e95283320'],
  ['balloon-cat','04_balloon_cat__751C9A4F-F0E0-4CBF-8F8C-A6E1B398D1A1.jpeg',855521,'da85caa1e94ba4dc882d5a2c28cfe1205fff93580373d59577635cabecb92ee3']
];

for(let i=0;i<approved.length;i++) {
  const [id,filename,size,digest]=approved[i];
  test(`approved unmodified JPEG ${i+1} (${id}) is packaged exactly`,()=>{
    assert.deepEqual(REWARD_PICTURES[i],{id,image:`rewards/${filename}`});
    const path=new URL(`../docs/assets/rewards/${filename}`,import.meta.url);
    assert.equal(statSync(path).size,size);
    const b=readFileSync(path);
    assert.equal(createHash('sha256').update(b).digest('hex'),digest);
    assert.equal(b[0],0xff);assert.equal(b[1],0xd8);
  });
}

test('changing reward image paths leaves v4 saved reward IDs and tile order valid',()=>{
  const s=newStore(()=>.3);
  assert.equal(s.schemaVersion,4);
  assert.deepEqual(s.reward.pictures.map(p=>p.id),approved.map(x=>x[0]));
  assert.deepEqual(validateStore(s).reward,s.reward);
});

test('only completed rewards have motion overlays and existing tiles stay still',()=>{
  const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');
  assert.match(app,/p\.unlocked===4\?\`<p class="muted">絵が完成したよ！<\/p>/);
  assert.match(app,/rewardDecorations\[index\]/);
  assert.match(app,/store\.settings\.effects==='off'\) return ''/);
  assert.match(app,/newest&&idx===last&&store\.settings\.effects!=='off'/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.reward-art-frame \.reward-effect\{display:none!important\}\}/);
  assert.match(css,/\.reward-art-frame\.low-motion \.reward-effect:not\(:nth-of-type\(1\)\)/);
  assert.doesNotMatch(css,/\.reward-complete-art\.low-motion img\{animation:gentle-art/);
});
