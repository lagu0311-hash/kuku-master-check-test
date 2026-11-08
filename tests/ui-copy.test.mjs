import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const app=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../docs/app.js'),'utf8');

test('agreed kanji text and intentional hiragana exceptions',()=>{
  for(const phrase of ['今日も九九にチャレンジ！','自分のペースで、一歩ずつ。','頑張った記録を見る',
    '詳しい記録と設定','答え合わせ','正解！　素敵だね！','次の問題 ▶'])
    assert.ok(app.includes(phrase),`Missing: ${phrase}`);
  assert.ok(app.includes('おうちのひと'));
  assert.ok(app.includes('よくできたね！'));
  assert.ok(app.includes('>10 もん</option>'));
  assert.ok(app.includes('>20 もん</option>'));
  assert.ok(app.includes('>ふつう（おすすめ）</option>'));
  assert.ok(app.includes('${i+1} のだん</option>'));
  assert.ok(app.includes('aria-label="ひみつの絵'));
});

test('ruby readings are hiragana and context-dependent 何 uses なん',()=>{
  const dict=app.match(/const readings=new Map\(Object.entries\(\{([\s\S]*?)\}\)\);/)?.[1];
  assert.ok(dict,'Missing ruby dictionary');
  const entries=[...dict.matchAll(/'([^']+)':'([^']+)'/g)];
  assert.ok(entries.length>50,'Unexpectedly small ruby dictionary');
  for(const [,key,reading] of entries)
    assert.match(reading,/^[ぁ-ゖー]+$/u,`Invalid reading for ${key}`);
  assert.ok(dict.includes("'何問':'なんもん'"));
  assert.ok(!dict.includes("'何':'") && !dict.includes("'分':'"));
  assert.ok((app.match(/<ruby>何<rt>なん<\/rt><\/ruby>の絵/g)||[]).length===2);
  assert.ok(app.includes('<ruby>何<rt>なん</rt></ruby>の段？'));
  assert.ok(app.includes("state.page==='parent'"));
});
