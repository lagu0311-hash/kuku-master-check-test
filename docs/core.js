// Pure logic for 九九マスターチェック. No network calls or external dependencies.
export const VERSION = 4;
export const BANK = Object.freeze(Array.from({ length: 9 }, (_, i) =>
  Array.from({ length: 9 }, (_, j) => Object.freeze({ a: i + 1, b: j + 1 }))
).flat());
export const MODES = Object.freeze(['practice', 'challenge']);
export const KINDS = Object.freeze(['stage', 'mixed', 'full', 'weak']);
export const keyOf = (a, b) => `${a}x${b}`;
export const localDate = (d = new Date()) => {
  const y = d.getFullYear();
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const REWARD_PICTURES = Object.freeze([
  {id:'flower-cat', image:'rewards/01_flower_cat__7D87821B-0515-4E82-B91C-AFCD6444CC38.jpeg'},
  {id:'starry-cat', image:'rewards/02_starry_cat__E011D51A-3ACD-4527-A4D8-2C1536AE6F7E.jpeg'},
  {id:'picnic-friends', image:'rewards/03_picnic_friends__1067876E-2918-4A31-98E9-E59F62885D4E.jpeg'},
  {id:'balloon-cat', image:'rewards/04_balloon_cat__751C9A4F-F0E0-4CBF-8F8C-A6E1B398D1A1.jpeg'}
]);
export const EFFECTS = Object.freeze(['normal','low','off']);
export function randomOrder(random=Math.random) { return shuffle([0,1,2,3],random); }
export function newReward(random=Math.random) {
  return {pictures:REWARD_PICTURES.map(p=>({id:p.id,unlocked:0,order:randomOrder(random)})),earnedSessionIds:[]};
}
export const newStore = (random=Math.random) => ({schemaVersion:VERSION,records:[],sessions:[],active:null,
  settings:{effects:'normal'},reward:newReward(random)});
export function currentRewardIndex(reward) { return reward.pictures.findIndex(p=>p.unlocked<4); }
export function totalRewardTiles(reward) { return reward.pictures.reduce((sum,p)=>sum+p.unlocked,0); }
export function scoreBand(correct,total) {
  if (!Number.isInteger(correct)||!Number.isInteger(total)||total<1||correct<0||correct>total) throw new Error('Invalid score');
  const pct=correct/total*100;
  return pct===100?'perfect':pct>=80?'great':pct>=60?'good':pct>=40?'keepgoing':pct>=20?'training':'courage';
}
// A unique, perfect 81-question challenge unlocks one tile.
// Returns the newly opened tile, or null for duplicate/non-perfect/finished collection.
export function awardPerfect(store,session) {
  const r=store.reward;
  if(session.mode!=='challenge'||session.kind!=='full'||session.total!==81||session.correct!==81||
     r.earnedSessionIds.includes(session.id)) return null;
  r.earnedSessionIds.push(session.id);
  const pictureIndex=currentRewardIndex(r);
  if(pictureIndex<0) return null;
  const picture=r.pictures[pictureIndex];
  const tileIndex=picture.order[picture.unlocked++];
  return {pictureIndex,tileIndex,unlocked:picture.unlocked,pictureComplete:picture.unlocked===4,
    collectionComplete:totalRewardTiles(r)===16};
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function testRecordsFor(a, b, records) {
  return records.filter(r => r.mode === 'challenge' && r.a === a && r.b === b);
}
export function masteryOf(a, b, records) {
  const tests = testRecordsFor(a, b, records);
  if (tests.length === 0) return 'unseen';
  const latest = tests[tests.length - 1];
  if (!latest.correct) return 'practice';
  const correctDays = new Set(tests.filter(r => r.correct).map(r => r.localDate));
  return correctDays.size >= 2 ? 'mastered' : 'learning';
}
export function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const at = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[at] : (sorted[at - 1] + sorted[at]) / 2;
}

export function buildQuestions({ kind, stage = 2, count = 10, records = [], random = Math.random }) {
  if (!KINDS.includes(kind)) throw new Error('Unknown test kind');
  if (kind === 'stage') {
    if (!Number.isInteger(stage) || stage < 1 || stage > 9) throw new Error('Invalid stage');
    return shuffle(BANK.filter(q => q.a === stage), random);
  }
  if (kind === 'full') return shuffle(BANK, random);
  if (![10, 20].includes(count)) throw new Error('Invalid count');
  if (kind === 'mixed') return shuffle(BANK, random).slice(0, count);

  const lastTests = new Map();
  for (const r of records.filter(x => x.mode === 'challenge')) lastTests.set(keyOf(r.a, r.b), r);
  const pool = BANK.map(q => {
    const latest = lastTests.get(keyOf(q.a, q.b));
    // Prioritize recent errors, then slow but correct answers. No random false 'weak' label for unseen questions.
    const score = latest && !latest.correct ? 4 : latest && latest.elapsedMs >= 10000 ? 3 :
      latest && latest.elapsedMs >= 6000 ? 2 : latest ? 0 : 1;
    return { ...q, score };
  });
  const randomized = shuffle(pool, random);
  randomized.sort((a, b) => b.score - a.score);
  return randomized.slice(0, count).map(({ a, b }) => ({ a, b }));
}

export function stageStats(records) {
  return Array.from({ length: 9 }, (_, i) => {
    const row = BANK.filter(q => q.a === i + 1);
    const seen = row.filter(q => testRecordsFor(q.a, q.b, records).length);
    const latestCorrect = seen.filter(q => testRecordsFor(q.a, q.b, records).at(-1).correct).length;
    const mastered = row.filter(q => masteryOf(q.a, q.b, records) === 'mastered').length;
    return { stage: i + 1, tested: seen.length, latestCorrect, mastered };
  });
}
export function masteryCounts(records) {
  const counts = { unseen: 0, practice: 0, learning: 0, mastered: 0 };
  for (const q of BANK) counts[masteryOf(q.a, q.b, records)]++;
  return counts;
}

export function validateStore(raw) {
  if (!raw || typeof raw!=='object' || raw.schemaVersion!==VERSION) {
    throw new Error('旧形式または対応していない保存データです。v4形式のバックアップを選んでください。');
  }
  if (!Array.isArray(raw.records) || !Array.isArray(raw.sessions) || raw.records.length>200000 ||
      raw.sessions.length>20000) throw new Error('対応していない保存データです。');
  const validQuestion=q=>q && Number.isInteger(q.a)&&q.a>=1&&q.a<=9&&Number.isInteger(q.b)&&q.b>=1&&q.b<=9;
  const shortString=(s,limit=128)=>typeof s==='string'&&s.length>0&&s.length<=limit;
  const validTime=s=>shortString(s,40)&&Number.isFinite(Date.parse(s));
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
  const validKind=(mode,kind)=>mode==='challenge'?kind==='full':mode==='practice'&&['stage','mixed','weak'].includes(kind);
  const validRecord=r=>validQuestion(r)&&shortString(r.sessionId)&&validKind(r.mode,r.kind)&&
    Number.isInteger(r.input)&&r.input>=0&&r.input<=999&&typeof r.correct==='boolean'&&
    r.correct===(r.input===r.a*r.b)&&Number.isFinite(r.elapsedMs)&&r.elapsedMs>=0&&r.elapsedMs<=3600000&&
    validTime(r.answeredAt)&&validDate(r.localDate);
  if (!raw.records.every(validRecord)) throw new Error('回答履歴に不正なデータがあります。');
  if (!raw.sessions.every(s=>s&&shortString(s.id)&&validKind(s.mode,s.kind)&&
    Number.isInteger(s.total)&&(
      s.mode==='challenge'?s.total===81:s.kind==='stage'?s.total===9:[10,20].includes(s.total))&&
    Number.isInteger(s.correct)&&s.correct>=0&&s.correct<=s.total&&validTime(s.completedAt)))
    throw new Error('テスト履歴に不正なデータがあります。');
  if(raw.active!==null) {
    const a=raw.active;
    if(!a||!shortString(a.id)||!validKind(a.mode,a.kind)||
       !Array.isArray(a.questions)||a.questions.length<1||a.questions.length>81||
       (a.mode==='challenge'?a.questions.length!==81:
        a.kind==='stage'?a.questions.length!==9:![10,20].includes(a.questions.length))||
       !a.questions.every(validQuestion)||new Set(a.questions.map(q=>keyOf(q.a,q.b))).size!==a.questions.length||
       !Number.isInteger(a.index)||a.index<0||a.index>=a.questions.length||
       !Number.isFinite(a.elapsedMs)||a.elapsedMs<0||a.elapsedMs>3600000)
       throw new Error('途中のテストに不正なデータがあります。');
  }
  const effects=raw.settings?.effects;
  if(!EFFECTS.includes(effects)) throw new Error('演出設定が不正です。');
  const reward=raw.reward;
  const validOrder=o=>Array.isArray(o)&&o.length===4&&o.every(n=>Number.isInteger(n)&&n>=0&&n<4)&&new Set(o).size===4;
  if(!reward||!Array.isArray(reward.pictures)||reward.pictures.length!==4||
     !reward.pictures.every((p,i)=>p&&p.id===REWARD_PICTURES[i].id&&Number.isInteger(p.unlocked)&&p.unlocked>=0&&p.unlocked<=4&&validOrder(p.order))||
     !Array.isArray(reward.earnedSessionIds)||reward.earnedSessionIds.length>20000||
     !reward.earnedSessionIds.every(id=>shortString(id))||new Set(reward.earnedSessionIds).size!==reward.earnedSessionIds.length||
     totalRewardTiles(reward)>reward.earnedSessionIds.length ||
     reward.pictures.some((p,i)=>p.unlocked>0 && reward.pictures.slice(0,i).some(prev=>prev.unlocked!==4)))
     throw new Error('ご褒美データが不正です。');
  return {
    schemaVersion:VERSION,settings:{effects},
    reward:{pictures:reward.pictures.map(p=>({id:p.id,unlocked:p.unlocked,order:[...p.order]})),earnedSessionIds:[...reward.earnedSessionIds]},
    records:raw.records.map(r=>({sessionId:r.sessionId,mode:r.mode,kind:r.kind,a:r.a,b:r.b,
      input:r.input,correct:r.correct,elapsedMs:r.elapsedMs,answeredAt:r.answeredAt,localDate:r.localDate})),
    sessions:raw.sessions.map(s=>({id:s.id,mode:s.mode,kind:s.kind,total:s.total,correct:s.correct,completedAt:s.completedAt})),
    active:raw.active===null?null:{id:raw.active.id,mode:raw.active.mode,kind:raw.active.kind,
      questions:raw.active.questions.map(q=>({a:q.a,b:q.b})),index:raw.active.index,elapsedMs:raw.active.elapsedMs}
  };
}

export function csvOf(records) {
  const header = ['出題日時','実施日','モード','テスト種類','式','入力回答','正答','正誤','回答秒数'];
  const lines = records.map(r => [r.answeredAt,r.localDate,r.mode,r.kind,`${r.a}×${r.b}`,r.input,r.a*r.b,
    r.correct ? '正解' : '不正解', (r.elapsedMs / 1000).toFixed(2)]);
  // All values are derived from validated fields; quote for broad spreadsheet compatibility.
  return '\ufeff' + [header, ...lines].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
