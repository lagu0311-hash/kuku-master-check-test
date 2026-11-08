import { BANK, newStore, validateStore, buildQuestions, masteryOf, masteryCounts, stageStats, median, csvOf, localDate, scoreBand, awardPerfect, REWARD_PICTURES, currentRewardIndex, totalRewardTiles } from './core.js';
import { animalSvg } from './animals.js';

const STORAGE_KEY = 'kuku-master-check-preview:v4';
const PREVIEW_REWARD_FOCUS_KEY = `${STORAGE_KEY}:focusRewardIndex`;
const OLD_STORAGE_KEYS = []; // Preview must never delete production records.
const $app = document.querySelector('#app');
const names = { stage:'段ごと',mixed:'まぜこぜ',full:'全部',weak:'苦手克服',practice:'練習',challenge:'力試し' };
const masteryNames = { unseen:'まだ',practice:'練習中',learning:'おぼえてきた',mastered:'ばっちり！' };
const state = { page:new URLSearchParams(location.search).get('preview')==='reward'?'reward':'home', mode:'practice', kind:'stage', stage:2, count:10, answer:'', paused:false, feedback:null, lastSessionId:null, selectedCell:null, notice:'',variant:null,lastAward:null,previousVariant:{},awardAnimation:false,expandedRewardIndex:null };
let store = newStore();
let clockSince = null;
let busy = false;

try {
  const saved=localStorage.getItem(STORAGE_KEY);
  if (saved) {
    store=validateStore(JSON.parse(saved));
  }
} catch (err) { state.notice = '保存済みデータを読み込めませんでした。バックアップを確認してください。今回の操作では上書きしません。'; store = newStore(); }
let storageBlocked = Boolean(state.notice);
function save() {
  if (storageBlocked) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
  catch { storageBlocked = true; state.notice = 'このブラウザでは自動保存できません。別のブラウザを使用するか、空き容量・プライベートブラウズを確認してください。'; }
}
function startClock() {
  if (store.active && !state.paused && !state.feedback && !document.hidden && clockSince === null) clockSince = performance.now();
}
function freezeClock() {
  if (clockSince !== null && store.active) {
    store.active.elapsedMs = Math.min(3600000, store.active.elapsedMs + Math.max(0, performance.now() - clockSince));
    clockSince = null;
    save();
  }
}
function elapsedNow() { return store.active ? Math.min(3600000, store.active.elapsedMs + (clockSince === null ? 0 : Math.max(0, performance.now() - clockSince))) : 0; }

const variantSets = {
  correct:[['cat','jump'],['cat','clap'],['cat','spin'],['cat','star'],['cat','jump'],['cat','clap']],
  wrong:[['cat','weights'],['dog','weights'],['squirrel','coach'],['rabbit','coach'],['cat','coach'],['dog','coach']],
  good:[['cat','jump'],['cat','star'],['cat','clap'],['cat','spin']],
  cheer:[['cat','coach'],['rabbit','coach'],['dog','weights'],['squirrel','coach']]
};
const positiveMessages=['やったね！','すごい！','その調子！','ばっちり！','よくできたね！','正解！'];
const encouragingMessages=['大丈夫、次いこう！','練習で強くなる！','頑張っていてえらい！','次もチャレンジ！','一緒に覚えよう！','その一歩が素敵！'];
function pickVariant(set) {
  const arr=variantSets[set];let n=Math.floor(Math.random()*arr.length);
  if (arr.length>1 && n===state.previousVariant[set]) n=(n+1+Math.floor(Math.random()*(arr.length-1)))%arr.length;
  state.previousVariant[set]=n;
  return {type:arr[n][0],pose:arr[n][1],message:(set==='wrong'||set==='cheer'?encouragingMessages:positiveMessages)[n%6]};
}
function confetti(kind='small') {
  const mode=store.settings.effects;
  if(mode==='off') return '';
  const n=mode==='low'?8:kind==='grand'?46:22;
  const palette=['#ffb7ca','#88cbef','#f9db75','#b9dca7','#c5b5e9','#ffbea1'];
  return `<div class="confetti" aria-hidden="true">${Array.from({length:n},(_,i)=>{
    const x=(i*37+13)%100, dx=(i%2?1:-1)*(22+(i*19)%95), delay=(i*13)%45/100;
    return `<i style="--x:${x}%;--drift:${dx}px;--delay:${delay}s;--color:${palette[i%6]};--turn:${(i*47)%360}deg"></i>`;
  }).join('')}</div>`;
}
function animalScene(variant, kind='success') {
  if (!variant) return '';
  return `<div class="animal-scene ${kind} ${store.settings.effects==='off'?'still':store.settings.effects==='low'?'gentle':''}">
    <span class="scene-spark left" aria-hidden="true">✦</span>${animalSvg(variant.type,variant.pose)}<span class="scene-spark right" aria-hidden="true">✧</span></div>`;
}
const pictureNames=['花畑の猫ちゃん','星空の猫ちゃん','みんなでピクニック','青い風船の猫ちゃん'];
// Approved JPEG artwork is displayed byte-for-byte. Animations are separate
// DOM/CSS overlays and appear only after a picture is completely unlocked.
function imagePath(index){return `./assets/${REWARD_PICTURES[index].image}`;}
const rewardThemes=['flower','stars','picnic','balloon'];
const rewardDecorations=[
  ['glimmer one','glimmer two','soft-light three'],
  ['twinkle one','twinkle two','shooting-star three'],
  ['glimmer one','soft-light two','glimmer three'],
  ['glimmer one','glimmer two','soft-light three']
];
function rewardEffectMarkup(index) {
  if(store.settings.effects==='off') return '';
  return rewardDecorations[index].map(part=>`<span class="reward-effect ${part}" aria-hidden="true"></span>`).join('');
}
function rewardArt(index, galleryView=false, expandable=false){
  const setting=store.settings.effects;
  const effectClass=setting==='off'?'no-motion':setting==='low'?'low-motion':'';
  const frameClass=galleryView?'reward-gallery-art reward-art-frame':'reward-complete-art reward-art-frame';
  const art=`<div class="${frameClass} theme-${rewardThemes[index]} ${effectClass}">
    <img src="${imagePath(index)}" alt="${pictureNames[index]}" width="1254" height="1254"${galleryView?' loading="lazy"':''} decoding="async">${rewardEffectMarkup(index)}
  </div>`;
  if(!expandable) return art;
  return `<button type="button" class="reward-zoom-btn" data-action="expand-reward" data-index="${index}" aria-label="${pictureNames[index]}を大きく見る">
    ${art}<span class="reward-zoom-hint">タップで大きく見る</span>
  </button>`;
}
function rewardLightbox() {
  if(state.expandedRewardIndex===null) return '';
  const index=state.expandedRewardIndex;
  return `<div class="reward-modal-backdrop" data-action="close-reward-modal" aria-hidden="true"></div>
    <div class="reward-modal" role="dialog" aria-modal="true" aria-label="${pictureNames[index]}を大きく表示">
      <div class="reward-modal-card">
        <div class="reward-modal-header"><strong>${pictureNames[index]}</strong><button type="button" class="reward-modal-close" data-action="close-reward-modal" aria-label="閉じる">✕</button></div>
        <div class="reward-modal-body">${rewardArt(index,false,false)}</div>
      </div>
    </div>`;
}
function puzzle(index,newest=false) {
  const picture=store.reward.pictures[index];
  const revealed=new Set(picture.order.slice(0,picture.unlocked));
  const last=picture.unlocked?picture.order[picture.unlocked-1]:-1;
  return `<div class="reward-puzzle" role="img" aria-label="ひみつの絵 ${index+1}、${picture.unlocked}マス開いたよ">
    ${Array.from({length:4},(_,idx)=>revealed.has(idx)
      ? `<div class="reward-tile open ${newest&&idx===last&&store.settings.effects!=='off'?'just-opened':''}" style="--bx:${idx%2*100}%;--by:${Math.floor(idx/2)*100}%;background-image:url('${imagePath(index)}')"></div>`
      : `<div class="reward-tile locked"><span aria-hidden="true">${['✿','★','♥','✦'][idx]}</span></div>`).join('')}
  </div>`;
}
function rewardPanel(index,newest=false) {
  const p=store.reward.pictures[index];
  return `<section class="panel reward-section"><h2>${p.unlocked===4?pictureNames[index]:`秘密の絵 ${index+1}`}</h2>
    ${p.unlocked===4?`<p class="muted">絵が完成したよ！</p>
    ${rewardArt(index,false,true)}`:
    `<p class="muted">満点を取るたびに、1マス開くよ。<ruby>何<rt>なん</rt></ruby>の絵かは、お楽しみ！</p>${puzzle(index,newest)}`}
    <p class="reward-progress">${p.unlocked===4?'完成！ おめでとう！':`${p.unlocked} / 4 マス　あと ${4-p.unlocked} 回で完成！`}</p>
  </section>`;
}
function gallery() {
  const r=store.reward;
  return `<section class="panel"><h2>秘密の絵 コレクション</h2><p class="muted">4つの絵があるよ。どんな絵かは、完成するまで秘密！</p>
  <div class="gallery-grid">${r.pictures.map((p,i)=>`<div class="gallery-card ${p.unlocked===4?'complete':''}">
    ${p.unlocked===4?`${rewardArt(i,true,true)}<strong>${pictureNames[i]}</strong>`:
    `<div class="gallery-secret" aria-hidden="true">🎁</div><strong>秘密の絵 ${i+1}</strong>`}
    <small>${p.unlocked===4?'完成！':p.unlocked?`${p.unlocked} / 4 マス`:currentRewardIndex(r)===i?'これから開くよ！':'まだ秘密'}</small>
  </div>`).join('')}</div></section>`;
}
function rubyText(root) {
  if (state.page==='parent') return;
  // The DOM is created solely from trusted UI strings and validated numeric records.
  const readings=new Map(Object.entries({
    // Longest phrases first at the same position. Avoid context-free readings for 何/分.
    '答え合わせ':'こたえあわせ','苦手克服':'にがてこくふく','何問':'なんもん',
    '時間制限':'じかんせいげん','一歩':'いっぽ','一つ':'ひとつ',
    '九九':'くく','正解':'せいかい','不正解':'ふせいかい','満点':'まんてん','問題':'もんだい',
    '練習':'れんしゅう','挑戦':'ちょうせん','力試し':'ちからだめし','結果':'けっか','全部':'ぜんぶ',
    '記録':'きろく','完成':'かんせい','ご褒美':'ごほうび','花畑':'はなばたけ','星空':'ほしぞら',
    '猫':'ねこ','犬':'いぬ','動物':'どうぶつ','風船':'ふうせん','秘密':'ひみつ',
    '今日':'きょう','時間':'じかん','答え':'こたえ','開く':'ひらく','開いた':'ひらいた',
    '自分':'じぶん','回':'かい','絵':'え','枚':'まい','段':'だん','次':'つぎ',
    '星':'ほし','休憩':'きゅうけい','再開':'さいかい','応援':'おうえん','問':'もん',
    '調子':'ちょうし','大丈夫':'だいじょうぶ','強く':'つよく','頑張った':'がんばった',
    '頑張って':'がんばって','頑張り':'がんばり','一緒':'いっしょ',
    '覚えてきた':'おぼえてきた','覚えよう':'おぼえよう','覚えた':'おぼえた',
    '確かめ':'たしかめ','詳しい':'くわしい','設定':'せってい','素敵':'すてき',
    '見る':'みる','見える':'みえる','増えて':'ふえて',
    '続き':'つづき','続けよう':'つづけよう','続ける':'つづける','選ぼう':'えらぼう',
    '進める':'すすめる','最後':'さいご','間違え':'まちがえ','優先':'ゆうせん',
    '順番':'じゅんばん','途中':'とちゅう','戻る':'もどる',
    '答える':'こたえる','入れて':'いれて','制限':'せいげん','考えて':'かんがえて',
    '第':'だい','休み':'やすみ','準備':'じゅんび','休む':'やすむ',
    '少し':'すこし','やり遂げた':'やりとげた','お疲れ':'おつかれ',
    '最近':'さいきん','試して':'ためして','楽しみ':'たのしみ','楽しもう':'たのしもう',
    '覚えて':'おぼえて','覚える':'おぼえる','端末':'たんまつ',
    '保存':'ほぞん','少ない':'すくない','出る':'でる','取る':'とる',
  }));
  const keys=[...readings.keys()].sort((a,b)=>b.length-a.length);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()) {
    const node=walker.currentNode;
    if(!node.nodeValue || !keys.some(k=>node.nodeValue.includes(k)))continue;
    if(node.parentElement?.closest('ruby,rt,script,style,option'))continue;
    nodes.push(node);
  }
  for(const node of nodes) {
    const text=node.nodeValue,fragment=document.createDocumentFragment();let idx=0;
    while(idx<text.length) {
      let best=null,where=text.length;
      for(const word of keys) {const at=text.indexOf(word,idx);if(at>=0&&at<where){best=word;where=at;}}
      if(!best){fragment.append(document.createTextNode(text.slice(idx)));break;}
      if(where>idx)fragment.append(document.createTextNode(text.slice(idx,where)));
      const ruby=document.createElement('ruby');ruby.append(document.createTextNode(best));
      const rt=document.createElement('rt');rt.textContent=readings.get(best);ruby.append(rt);fragment.append(ruby);
      idx=where+best.length;
    }
    node.replaceWith(fragment);
  }
}

function shell(body, narrow=false) {
  $app.innerHTML = `<div class="shell ${narrow ? 'narrow' : ''}">
    <header class="masthead"><span class="brand-mark" aria-hidden="true">★</span><span class="brand">九九マスターチェック</span></header>
    ${state.notice ? `<div class="notice" role="alert">${state.notice}</div>` : ''}
    ${body}<footer>${state.page==='parent'?'頑張った分だけ、できることが増えていくよ。':'頑張った<ruby>分<rt>ぶん</rt></ruby>だけ、できることが増えていくよ。'}<span class="footnote"> 記録はこの端末に保存されます。</span></footer>
  </div>${rewardLightbox()}`;
  document.body.classList.toggle('reward-modal-open',state.expandedRewardIndex!==null);
  rubyText($app);
}
const btn = (action, text, cls='', extra='') => `<button class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;
const secondary = (action,text)=>btn(action,text,'secondary');
const header = (title,desc='')=>`<div class="section-heading"><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div>`;
function renderHome() {
  const progress = masteryCounts(store.records);
  const resumed = store.active ? `<div class="resume-panel"><div><b>続きのテストがあるよ</b><p>${names[store.active.kind]} ・ ${store.active.index + 1} / ${store.active.questions.length} 問</p></div>${btn('resume-active','続きから ▶','primary')}</div>` : '';
  shell(`${header('今日も九九にチャレンジ！','自分のペースで、一歩ずつ。')}
  <div class="hero"><div class="hero-cat">${animalSvg('cat','home')}</div><div><b>${progress.mastered} / 81 問</b><small>「ばっちり！」になった問題</small></div></div>
  ${resumed}
  <div class="home-grid">
    <button class="home-card mint" data-action="setup-practice"><span class="home-icon">✏️</span><strong>練習</strong><small>答えを確かめながら</small></button>
    <button class="home-card lavender" data-action="setup-challenge"><span class="home-icon">🏅</span><strong>力試し</strong><small>どのくらい覚えたかな？</small></button>
    <button class="home-card peach" data-action="child"><span class="home-icon">⭐</span><strong><ruby>私<rt>わたし</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby></strong><small>頑張った記録を見る</small></button>
    <button class="home-card gray" data-action="parent"><span class="home-icon">📊</span><strong>おうちのひと</strong><small>詳しい記録と設定</small></button>
  </div>`,false);
}
function renderSetup() {
  shell(`${header(state.mode === 'practice' ? '練習を選ぼう' : '81問の力試し',
    state.mode === 'practice' ? '答えを確かめながら進めるよ。' : '81問すべてにチャレンジ！ 最後に答え合わせ！')}
    <div class="panel">${state.mode==='practice'?`<h2>どのテストにする？</h2><div class="choice-grid">
      ${[['stage','段ごと','9問'],['mixed','まぜこぜ','10・20問'],['weak','苦手克服','10・20問']]
       .map(([kind,label,sub])=>`<button class="choice ${state.kind===kind?'picked':''}" data-action="choose-kind" data-kind="${kind}" aria-pressed="${state.kind===kind}"><strong>${label}</strong><small>${sub}</small></button>`).join('')}
    </div>
    ${state.kind === 'stage'?`<label class="control-label" for="stage"><ruby>何<rt>なん</rt></ruby>の段？</label><select id="stage" data-setting="stage">${Array.from({length:9},(_,i)=>`<option value="${i+1}" ${state.stage===i+1?'selected':''}>${i+1} のだん</option>`).join('')}</select>`:''}
    ${['mixed','weak'].includes(state.kind)?`<label class="control-label" for="count">何問やる？</label><select id="count" data-setting="count"><option value="10" ${state.count===10?'selected':''}>10 もん</option><option value="20" ${state.count===20?'selected':''}>20 もん</option></select>`:''}
    ${state.kind==='weak'?`<p class="muted small">間違えた問題や、答えるのに時間がかかった問題を優先するよ。まだ記録が少ないときは、ほかの問題も出るよ。</p>`:''}`:
    `<h2>全部で81問</h2><p class="muted small">1の段から9の段まで、順番はランダム！</p>`}
    ${state.mode==='challenge'?`<p class="muted small">9問ごとにお休みできるよ。途中でやめても、続きからできるよ。</p>`:''}
    ${btn('start','スタート！','primary wide big')}
    ${secondary('home','← 戻る')}
    </div>`,true);
}
function renderQuiz() {
  const active=store.active;
  if (state.feedback) {
    const f=state.feedback;
    const atEnd=!active;
    const v=state.variant || pickVariant(f.correct?'correct':'wrong');
    shell(`<div class="quiz-top">${secondary('home','← ホーム')}<span>答え合わせ</span></div>
      <div class="panel centered feedback ${f.correct?'is-correct':'is-incorrect'}">
      ${f.correct?confetti('small'):''}${animalScene(v,f.correct?'success':'encourage')}
      <h1>${f.correct?v.message:'間違えても大丈夫！'}</h1>
      <p class="equation">${f.a} × ${f.b} = ${f.a*f.b}</p>
      ${!f.correct?`<p>${v.message}　答えは <strong>${f.a*f.b}</strong> だよ。</p>`:'<p>正解！　素敵だね！</p>'}
      ${btn('next',atEnd?'結果を見る ▶':'次の問題 ▶','primary wide big')}</div>`,true);
    return;
  }
  if (!active) return renderHome();
  const total=active.questions.length;
  const idx=active.index;
  const q=active.questions[idx];
  const percent=Math.round(idx/total*100);
  if (state.paused) {
    shell(`<div class="panel centered pause"><span class="large-emoji">☕</span><h1>ひと休み</h1><p>準備ができたら続けよう！</p>
     <p class="muted">${idx+1} / ${total} 問</p>${btn('unpause','続ける ▶','primary wide big')}${secondary('home','ホームへ')}</div>`,true);
    return;
  }
  shell(`<div class="quiz-top">${secondary('home','← ホーム')}<span>${names[active.mode]} ・ ${idx+1} / ${total} 問</span>${secondary('pause','休む')}</div>
    <div class="progress"><div class="progress-fill" style="width:${percent}%"></div></div>
    <section class="quiz-card" aria-label="もんだい"><div class="question-label">第${idx+1}問</div><h1 class="equation">${q.a} × ${q.b} = <span class="question-mark">？</span></h1>
    <div class="answer-box" aria-live="polite" aria-label="入力した答え">${state.answer || '<span class="placeholder">答えを入れてね</span>'}</div>
    <div class="numberpad">${['1','2','3','4','5','6','7','8','9','けす','0','⌫'].map(v=>`<button class="numkey ${v==='けす'||v==='⌫'?'utility':''}" data-action="digit" data-value="${v}" aria-label="${v==='⌫'?'ひとつけす':v}">${v}</button>`).join('')}</div>
    ${btn('answer','答える！','primary wide big',state.answer?'':'disabled')}
    <p class="muted small center">時間制限はないよ。ゆっくり考えてね。</p></section>`,true);
  startClock();
}
function renderResult() {
  const session = store.sessions.find(s=>s.id===state.lastSessionId) || store.sessions.at(-1);
  if (!session) return renderHome();
  const records=store.records.filter(r=>r.sessionId===session.id);
  const band=scoreBand(session.correct,session.total);
  const bands={
    perfect:{title:'パーフェクト！',subtitle:'全部正解！ すごい！',type:'good',confetti:'grand'},
    great:{title:'すごい！',subtitle:'とっても頑張ったね！',type:'good',confetti:'small'},
    good:{title:'頑張ったね！',subtitle:'次もチャレンジしよう！',type:'good'},
    keepgoing:{title:'一つずつ強くなる！',subtitle:'練習すると もっと できるよ！',type:'cheer'},
    training:{title:'少しずつ 覚えていこう！',subtitle:'筋トレ動物と一緒に練習だ！',type:'cheer'},
    courage:{title:'チャレンジ できたね！',subtitle:'一緒に少しずつ覚えよう！',type:'cheer'}
  };
  const b=bands[band];
  const variant=state.variant || pickVariant(b.type);
  const celebration=session.mode==='challenge' && band==='perfect';
  shell(`${header('よく頑張ったね！','最後までやり遂げたね！')}
    <div class="panel centered result result-${band}">
      ${b.confetti?confetti(b.confetti):''}
      ${animalScene(variant,['keepgoing','training','courage'].includes(band)?'encourage':'success')}
      <h2>${session.mode==='challenge'?b.title:'練習お疲れさま！'}</h2>
      <div class="score">${session.correct} <span>/ ${session.total} 問</span></div>
      <p>${session.mode==='challenge'?b.subtitle:'今日もたくさん頑張ったね！'}</p>
      <p class="muted small">${names[session.mode]} ・ ${names[session.kind]}</p>
      ${celebration?`<div class="reward-alert">${state.lastAward?state.lastAward.collectionComplete?'4枚の絵が全部完成！ コンプリート！':state.lastAward.pictureComplete?'秘密の絵が 完成したよ！':'ご褒美の絵が 1マス 開いたよ！':'4枚の絵はもう全部完成しているよ！'}</div>`:''}
    </div>
    ${celebration&&state.lastAward?rewardPanel(state.lastAward.pictureIndex,true):''}${celebration&&state.lastAward?.collectionComplete?'<div class="panel centered full-collection-banner"><h2>コンプリート！</h2><p>4枚の絵が 全部完成したよ！</p></div>':''}
    ${session.mode === 'challenge' ? `<details class="panel"><summary>答え合わせ（${session.total}問）</summary>
      <div class="answer-list">${records.map(r=>`<div class="answer-item ${r.correct?'ok':'no'}"><span>${r.a} × ${r.b} = ${r.a*r.b}</span><span>${r.correct?'○':`×（${r.input}）`}</span></div>`).join('')}</div></details>` : ''}
    ${btn('setup-practice','また練習する','primary wide')}
    ${session.mode==='challenge'?secondary('reward','ご褒美の絵を 見る'):''}
    ${secondary('home','ホームへ')}`,true);
}
function renderReward() {
  const idx=currentRewardIndex(store.reward);
  const count=totalRewardTiles(store.reward);
  const previewMode=new URLSearchParams(location.search).get('preview')==='reward';
  const focusRaw=previewMode?localStorage.getItem(PREVIEW_REWARD_FOCUS_KEY):null;
  const focusIndex=focusRaw===null?null:Number(focusRaw);
  const panelIndex=Number.isInteger(focusIndex) && focusIndex>=0 && focusIndex<store.reward.pictures.length && store.reward.pictures[focusIndex]?.unlocked===4
    ? focusIndex
    : idx;
  shell(`${header('秘密のご褒美の絵','満点を取ると、絵が1マスずつ開くよ！')}
  <div class="panel centered"><h2>${count===16?'コンプリート！ 4枚全部完成！':`${count} / 16 マス 開いたよ！`}</h2>
  <p class="muted"><ruby>何<rt>なん</rt></ruby>の絵かは、完成してからのお楽しみ！</p></div>
  ${panelIndex>=0?rewardPanel(panelIndex):'<div class="panel centered full-collection-banner"><h2>大成功！</h2><p>4枚全部集めたね！</p></div>'}
  ${gallery()}
  ${secondary('home','← ホームへ')}`,false);
}

function renderChild() {
  const counts = masteryCounts(store.records);
  const recent = store.sessions.slice(-5).reverse();
  shell(`${header('<ruby>私<rt>わたし</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby>','今日までの頑張りが見えるよ！')}
    <div class="panel centered"><div class="award-stars">★ ★ ★</div><h2>「ばっちり！」は${counts.mastered}問</h2>
    <p>覚えてきた問題：${counts.learning}問</p><p class="muted small">これからも自分のペースでね。</p></div>
    <div class="panel"><h2>最近のチャレンジ</h2>
    ${recent.length?recent.map(s=>`<div class="history-item"><span>${new Date(s.completedAt).toLocaleDateString('ja-JP')}　${names[s.kind]}</span><b>${s.correct} / ${s.total}</b></div>`).join(''):'<p class="muted">まだ記録がないよ。試してみよう！</p>'}</div>
    ${secondary('reward','秘密のご褒美の絵')}
    ${secondary('home','← ホームへ')}`,true);
}
function renderParent() {
  const counts = masteryCounts(store.records);
  const stats = stageStats(store.records);
  const challenges = store.records.filter(r=>r.mode==='challenge');
  const correct = challenges.filter(r=>r.correct);
  const secMedian = median(correct.map(r=>r.elapsedMs));
  const detail = state.selectedCell;
  const details = detail ? store.records.filter(r=>r.a===detail.a&&r.b===detail.b).slice(-10).reverse():[];
  shell(`${header('おうちのひと向け','習得状況・学習記録・バックアップ')}
    <div class="stat-grid">
      <div class="stat"><b>${counts.mastered}<small> / 81</small></b><span>ばっちり</span></div>
      <div class="stat"><b>${81-counts.unseen}<small> / 81</small></b><span>出題済み</span></div>
      <div class="stat"><b>${challenges.length?Math.round(correct.length/challenges.length*100)+'%':'—'}</b><span>力試し累計正答率</span></div>
      <div class="stat"><b>${secMedian===null?'—':(secMedian/1000).toFixed(1)+'秒'}</b><span>正解時の回答時間中央値</span></div>
    </div>
    <div class="panel"><h2>81問の習得マップ</h2><p class="muted small">行が「○の段」、列が「×□」。マスを押すとその問題の記録を表示します。</p>
    <div class="legend"><span><i class="dot unseen"></i>未出題</span><span><i class="dot practice"></i>練習中</span><span><i class="dot learning"></i>覚えてきた</span><span><i class="dot mastered"></i>ばっちり</span></div>
    <div class="map-wrap"><div class="mastery-map"><div class="map-axis">×</div>${Array.from({length:9},(_,i)=>`<div class="map-axis">${i+1}</div>`).join('')}
    ${Array.from({length:9},(_,i)=>`<div class="map-axis">${i+1}</div>${Array.from({length:9},(_,j)=>`<button class="map-cell ${masteryOf(i+1,j+1,store.records)} ${detail?.a===i+1&&detail?.b===j+1?'selected':''}" data-action="cell" data-a="${i+1}" data-b="${j+1}" title="${i+1}×${j+1}: ${masteryNames[masteryOf(i+1,j+1,store.records)]}" aria-label="${i+1}かける${j+1}: ${masteryNames[masteryOf(i+1,j+1,store.records)]}">${j+1}</button>`).join('')}`).join('')}
    </div></div>
    ${detail?`<div class="cell-details"><h3>${detail.a} × ${detail.b} = ${detail.a*detail.b}（${masteryNames[masteryOf(detail.a,detail.b,store.records)]}）</h3>
      ${details.length?details.map(r=>`<p>${new Date(r.answeredAt).toLocaleString('ja-JP')}　${names[r.mode]}：${r.correct?'正解':'不正解'}（回答 ${r.input} ／ ${(r.elapsedMs/1000).toFixed(1)}秒）</p>`).join(''):'<p class="muted">まだ出題されていません。</p>'}</div>`:''}
    </div>
    <div class="panel"><h2>段別の状況</h2><table><thead><tr><th>段</th><th>出題済み</th><th>直近正解</th><th>ばっちり</th></tr></thead><tbody>
      ${stats.map(s=>`<tr><th>${s.stage}の段</th><td>${s.tested}/9</td><td>${s.latestCorrect}/9</td><td>${s.mastered}/9</td></tr>`).join('')}
    </tbody></table><p class="muted small">この集計は「力試し」の回答のみを対象にします。未出題は正解数に含めません。</p></div>
    <div class="panel"><h2>履歴とデータ管理</h2><p class="muted small">保存先はこのブラウザです。主にAndroidタブレットのChromeで使います。端末間で自動同期はされません。</p>
      <label class="control-label" for="effects">アニメーションの おおきさ</label>
      <select id="effects" data-setting="effects"><option value="normal" ${store.settings.effects==='normal'?'selected':''}>ふつう（おすすめ）</option><option value="low" ${store.settings.effects==='low'?'selected':''}>ひかえめ</option><option value="off" ${store.settings.effects==='off'?'selected':''}>オフ</option></select>
      <p class="muted small">紙吹雪やどうぶつの動きを調整できます。画像や正誤表示は残ります。</p>
      <div class="actions">${btn('export-json' ,'JSONバックアップ','secondary')}${btn('export-csv','CSV書き出し','secondary')}
      ${btn('import','JSONを復元','secondary')}</div><input type="file" id="import-input" accept="application/json,.json" class="visually-hidden" aria-label="バックアップファイルを選ぶ">
      <hr><p class="muted small">記録を消すと元に戻せません。必要であれば先にバックアップしてください。</p>
      ${btn('erase','この端末の記録をすべて削除','danger-outline')}</div>
    ${secondary('home','← ホームへ')}`,false);
}
function render() {
  switch(state.page) {
    case 'home':renderHome();break;
    case 'setup':renderSetup();break;
    case 'quiz':renderQuiz();break;
    case 'result':renderResult();break;
    case 'reward':renderReward();break;
    case 'child':renderChild();break;
    case 'parent':renderParent();break;
    default: renderHome();
  }
}
function navigate(page) {
  freezeClock();state.page=page;state.feedback=null;state.paused=false;state.answer='';state.expandedRewardIndex=null;render();
}
function startTest() {
  if (store.active && !confirm('とちゅうのテストをやめて、新しいテストをはじめますか？\n（すでに答えた問題の記録は残ります）')) return;
  const kind=state.mode==='challenge'?'full':state.kind;
  if(state.mode==='practice' && !['stage','mixed','weak'].includes(kind)) return;
  const questions=buildQuestions({kind,stage:state.stage,count:state.count,records:store.records});
  if(state.mode==='challenge' && questions.length!==81) throw new Error('力試しは81問である必要があります。');
  store.active = { id: crypto.randomUUID(),mode:state.mode,kind,questions,index:0,elapsedMs:0 };
  state.answer='';state.paused=false;state.feedback=null;state.variant=null;state.lastAward=null;clockSince=null;state.page='quiz';save();render();
}
function answer() {
  if (!store.active || state.paused || state.feedback || busy || !/^\d{1,3}$/.test(state.answer)) return;
  busy=true;
  try {
    freezeClock();
    const a=store.active;const q=a.questions[a.index];const value=Number(state.answer);
    const r={ sessionId:a.id,mode:a.mode,kind:a.kind,a:q.a,b:q.b,input:value,correct:value===q.a*q.b,
      elapsedMs:Math.round(elapsedNow()),answeredAt:new Date().toISOString(),localDate:localDate() };
    store.records.push(r);a.index++;a.elapsedMs=0;state.answer='';
    if (a.index===a.questions.length) {
      const records=store.records.filter(x=>x.sessionId===a.id);
      store.sessions.push({id:a.id,mode:a.mode,kind:a.kind,total:a.questions.length,
        correct:records.filter(x=>x.correct).length,completedAt:new Date().toISOString()});
      state.lastSessionId=a.id;
      const session=store.sessions.at(-1);
      state.lastAward=awardPerfect(store,session);
      store.active=null;state.paused=false;
      if(a.mode==='practice'){
        state.feedback=r;state.variant=pickVariant(r.correct?'correct':'wrong');state.page='quiz';
      } else {
        state.page='result';state.feedback=null;
        state.variant=pickVariant(['keepgoing','training','courage'].includes(scoreBand(session.correct,session.total))?'cheer':'good');
      }
    } else if (a.mode==='practice') {
      state.feedback=r;state.variant=pickVariant(r.correct?'correct':'wrong');
    } else if (a.kind==='full' && a.index%9===0) {
      state.paused=true;
    }
    save();render();
  } finally { busy=false; }
}
function digit(value) {
  if (state.page!=='quiz'||!store.active||state.paused||state.feedback) return;
  if (value==='けす') state.answer='';
  else if (value==='⌫') state.answer=state.answer.slice(0,-1);
  else if (/^[0-9]$/.test(value) && state.answer.length<3) state.answer+=value;
  render();
}
function download(name,contents,type) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function onClick(ev) {
  const el=ev.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action;
  switch(action){
    case 'home':navigate('home');break;
    case 'setup-practice':state.mode='practice';if(!['stage','mixed','weak'].includes(state.kind))state.kind='stage';navigate('setup');break;
    case 'setup-challenge':state.mode='challenge';state.kind='full';navigate('setup');break;
    case 'choose-kind':if(state.mode==='practice'&&['stage','mixed','weak'].includes(el.dataset.kind)){state.kind=el.dataset.kind;render();}break;
    case 'start':startTest();break;
    case 'resume-active':state.page='quiz';state.paused=false;state.feedback=null;state.answer='';state.variant=null;render();break;
    case 'digit':digit(el.dataset.value);break;
    case 'answer':answer();break;
    case 'pause':freezeClock();state.paused=true;render();break;
    case 'unpause':state.paused=false;render();break;
    case 'next':state.feedback=null;state.answer='';state.variant=null;if(!store.active){state.page='result';state.variant=pickVariant('good');}render();break;
    case 'child':navigate('child');break;
    case 'expand-reward':{
      const index=Number(el.dataset.index);
      if(!Number.isInteger(index)||index<0||index>=store.reward.pictures.length||store.reward.pictures[index].unlocked!==4)break;
      state.expandedRewardIndex=index;render();
      $app.querySelector('.reward-modal-close')?.focus();
      break;
    }
    case 'close-reward-modal':{
      const index=state.expandedRewardIndex;
      state.expandedRewardIndex=null;render();
      $app.querySelector(`[data-action="expand-reward"][data-index="${index}"]`)?.focus();
      break;
    }
    case 'reward':navigate('reward');break;
    case 'parent':navigate('parent');break;
    case 'cell':state.selectedCell={a:Number(el.dataset.a),b:Number(el.dataset.b)};render();break;
    case 'export-json':download(`kuku-backup-${localDate()}.json`,JSON.stringify({...store,exportedAt:new Date().toISOString()},null,2),'application/json');break;
    case 'export-csv':download(`kuku-history-${localDate()}.csv`,csvOf(store.records),'text/csv;charset=utf-8');break;
    case 'import':document.querySelector('#import-input')?.click();break;
    case 'erase':
      if(confirm('この端末の九九の記録を全部消します。よろしいですか？')) {
        try {
          for(const key of [...OLD_STORAGE_KEYS,STORAGE_KEY]) localStorage.removeItem(key);
          if([...OLD_STORAGE_KEYS,STORAGE_KEY].some(key=>localStorage.getItem(key)!==null))
            throw new Error('削除後の確認に失敗しました。');
        } catch {
          storageBlocked=true;
          state.notice='記録の削除を完了できませんでした。一部のデータだけが削除された可能性があります。この画面では自動保存を停止しています。再読み込みの前に必要な記録を確認してください。';
          render();break;
        }
        store=newStore();storageBlocked=false;clockSince=null;
        state.mode='practice';state.kind='stage';state.stage=2;state.count=10;
        state.answer='';state.paused=false;state.feedback=null;state.lastSessionId=null;
        state.selectedCell=null;state.variant=null;state.lastAward=null;
        state.previousVariant={};state.awardAnimation=false;state.notice='';
        navigate('parent');
      } break;
  }
}
$app.addEventListener('click',onClick);
$app.addEventListener('change',async ev=>{
  const t=ev.target;
  if(t.dataset.setting==='stage'){state.stage=Number(t.value);return;}
  if(t.dataset.setting==='count'){state.count=Number(t.value);return;}
  if(t.dataset.setting==='effects'){store.settings.effects=t.value;save();return;}
  if(t.id==='import-input' && t.files?.[0]){
    try{
      if(t.files[0].size>8*1024*1024)throw new Error('8MBを超えるファイルは読み込めません。');
      const loaded=validateStore(JSON.parse(await t.files[0].text()));
      if(!confirm('現在の記録をバックアップの内容で置き換えます。続けますか？'))return;
      freezeClock();store=loaded;storageBlocked=false;state.notice='バックアップを復元しました。';state.selectedCell=null;save();navigate('parent');
    }catch(e){alert(`読み込みできませんでした：${e.message}`);}finally{t.value='';}
  }
});
window.addEventListener('keydown',ev=>{
  if(ev.key==='Escape' && state.expandedRewardIndex!==null){
    ev.preventDefault();const index=state.expandedRewardIndex;state.expandedRewardIndex=null;render();
    $app.querySelector(`[data-action="expand-reward"][data-index="${index}"]`)?.focus();return;
  }
  if(state.page!=='quiz'||!store.active||state.paused||state.feedback||ev.ctrlKey||ev.metaKey||ev.altKey)return;
  if(document.activeElement?.matches('input,select,textarea'))return;
  if(/^[0-9]$/.test(ev.key)){ev.preventDefault();digit(ev.key);}
  else if(ev.key==='Backspace'){ev.preventDefault();digit('⌫');}
  else if(ev.key==='Enter'){ev.preventDefault();answer();}
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)freezeClock();
  else if(state.page==='quiz'&&!state.paused&&!state.feedback)startClock();
});
window.addEventListener('pagehide',freezeClock);
render();
