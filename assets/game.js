/* ゲーム（1ゲーム1ページ）。各ページの要素があるときだけ、そのゲームを動かす
   quiz.html なぜなぜクイズ / daily.html 今日の1問 / saki.html どっちが先？ / narabe.html 年表ならべ / hit.html 反射ゲーム / game.html 一覧 */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const face = (who, n) => `images/chars/${who}_face${n}.png`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  const FX = window.NZFX || { confetti() {}, burst() {}, float() {}, shake() {}, pop() {}, countUp(el, n) { el.textContent = n; }, combo() {} };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const CH = { main: 'スポーツ編', jiji: '時事・地域編' };
  const PAGE_URL = (document.querySelector('link[rel=canonical]') || {}).href || location.href;
  const share = text => window.nzShareHTML ? window.nzShareHTML(text, PAGE_URL) : '';
  const yt = id => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const thumb = id => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;

  /* 動画の題名（一覧用） */
  const TITLES = {};
  const titlesReady = fetch('videos.json').then(r => r.json()).then(d => {
    for (const k of ['main', 'jiji', 'log']) (d[k] || []).forEach(v => { TITLES[v.id] = v.title; });
  }).catch(() => {});

  /* 動画の一覧の1行（○×つき） */
  const vRow = (o) => `<a class="q-vrow" href="${yt(o.video)}" target="_blank" rel="noopener">
      <span class="qv-th"><img src="${thumb(o.video)}" alt="" loading="lazy">${o.ok === undefined ? '' : `<span class="w-mark ${o.ok ? 'ok' : 'ng'}">${o.ok ? '○' : '×'}</span>`}</span>
      <span class="qv-txt">${o.no ? `<small>${esc(o.no)}</small>` : ''}<b>${esc(o.head)}</b>${o.sub ? `<span class="qv-ans">${esc(o.sub)}</span>` : ''}${TITLES[o.video] ? `<span class="qv-title">▶ ${esc(TITLES[o.video])}</span>` : ''}</span><span class="qv-go">見る ›</span></a>`;

  /* ゲームの一覧（一覧ページ・各ページ下の「ほかのゲーム」で使う） */
  const GAMES = [
    { id: 'run', href: 'run.html', name: '資料館ダッシュ', img: 'images/chars/kotoni_pose1.png', desc: '棚の間を走って「？」を集めよう', best: () => { const n = +(store.get('nz_run_best') || 0); return n ? `最高 ${n}点` : ''; } },
    { id: 'quiz', href: 'quiz.html', name: 'なぜなぜクイズ', img: face('kotoni', 4), desc: '動画で話した「なぜ？」を3択で。1回5問', best: () => { const n = Math.max(+(store.get('nz_quiz_best_main') || 0), +(store.get('nz_quiz_best_jiji') || 0)); return n ? `最高 ${n}問正解` : ''; } },
    { id: 'daily', href: 'daily.html', name: '今日の1問', img: face('shima', 1), desc: '1日1問だけ。毎日つづけて記録をのばそう', best: () => { const n = +(store.get('nz_daily_streak') || 0); return n ? `${n}日連続` : ''; } },
    { id: 'saki', href: 'saki.html', name: 'どっちが先？', img: face('kotoni', 2), desc: '2つの出来事、先に起きたのはどっち？何問つづけて当てられる？', best: () => { const n = +(store.get('nz_saki_best') || 0); return n ? `最高 ${n}連続` : ''; } },
    { id: 'narabe', href: 'narabe.html', name: '年表ならべ', img: face('shima', 3), desc: '4つの出来事を古い順にタップ。5回で何点とれる？', best: () => { const n = +(store.get('nz_narabe_best') || 0); return n ? `最高 ${n}点` : ''; } },
    { id: 'hit', href: 'hit.html', name: '反射ゲーム', img: face('shima', 2), desc: '出てきたシマ先生だけをタップ。30秒で何点とれる？', best: () => { const n = +(store.get('nz_hit_best') || 0); return n ? `最高 ${n}点` : ''; } },
  ];
  // 一覧ページ：自己ベストを出す
  document.querySelectorAll('[data-best]').forEach(el => { const g = GAMES.find(x => x.id === el.dataset.best); const t = g && g.best(); if (t) { el.textContent = t; el.hidden = false; } });
  // 各ゲームページの下：ほかのゲーム
  const more = $('moreGames');
  if (more) {
    const me = document.body.dataset.game;
    more.innerHTML = GAMES.filter(g => g.id !== me).map(g => `<a class="g-mini" href="${g.href}"><img src="${g.img}" alt=""><b>${g.name}</b></a>`).join('') + `<a class="g-mini all" href="game.html"><b>ゲーム一覧</b></a>`;
  }
  // 古いリンク（game.html#hit）を新しいページへ
  if (document.body.dataset.game === 'hub' && location.hash === '#hit') location.replace('hit.html');

  /* ===================== なぜなぜクイズ ===================== */
  const qBox = $('quizBox');
  if (qBox) {
    const ROUND = 5;
    const quiz = { all: [], qs: [], i: 0, score: 0, ch: 'main', res: [], streak: 0 };

    const start = ch => {
      if (typeof ch === 'string') quiz.ch = ch;
      const seen = new Set();   // 1回の中で同じ動画の問題は1問まで
      quiz.qs = shuffle(quiz.all.filter(q => q.channel === quiz.ch)).filter(q => !seen.has(q.video) && seen.add(q.video)).slice(0, ROUND);
      quiz.i = 0; quiz.score = 0; quiz.res = []; quiz.streak = 0;
      ask();
    };
    const ask = () => {
      const q = quiz.qs[quiz.i];
      qBox.innerHTML = `
        <div class="q-head"><span class="q-no">${CH[quiz.ch]}　第${quiz.i + 1}問 <small>/ ${quiz.qs.length}</small></span><span class="q-score">正解 <b>${quiz.score}</b></span></div>
        <div class="q-bar"><i style="width:${quiz.i / quiz.qs.length * 100}%"></i></div>
        <div class="talk fx-in"><img src="${face('kotoni', 4)}" alt="コトニちゃん"><p class="bubble">${esc(q.q)}</p></div>
        <div class="choices">${q.choices.map((c, k) => `<button class="choice fx-in" style="animation-delay:${80 + k * 70}ms" data-k="${k}">${'ABC'[k]}　${esc(c)}</button>`).join('')}</div>
        <div id="qAns"></div>`;
      qBox.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k, b)));
    };
    const answer = (k, btn) => {
      const q = quiz.qs[quiz.i];
      const ok = k === q.answer;
      if (ok) { quiz.score++; quiz.streak++; } else quiz.streak = 0;
      quiz.res[quiz.i] = ok;
      qBox.querySelectorAll('.choice').forEach(b => {
        b.disabled = true;
        const n = +b.dataset.k;
        if (n === q.answer) b.classList.add('right');
        else if (n === k) b.classList.add('wrong');
      });
      const sc = qBox.querySelector('.q-score b'); sc.textContent = quiz.score;
      if (ok) { FX.burst(btn); FX.pop(sc); FX.float(btn, '正解！', 'ok'); if (quiz.streak >= 2) setTimeout(() => FX.combo(quiz.streak, sc), 250); }
      else FX.shake(btn);
      qBox.querySelector('.q-bar i').style.width = (quiz.i + 1) / quiz.qs.length * 100 + '%';
      const last = quiz.i === quiz.qs.length - 1;
      $('qAns').innerHTML = `
        <div class="talk shima fx-in"><img src="${face('shima', ok ? 2 : 6)}" alt="シマ先生"><p class="bubble">${ok ? '正解です。' : `おしい。正解は「${esc(q.choices[q.answer])}」です。`}${esc(q.explain)}</p></div>
        <div class="q-next">
          ${q.video ? `<a class="q-vlink" href="${yt(q.video)}" target="_blank" rel="noopener">▶ この回の動画</a>` : ''}
          <button class="btn solid" id="qNext">${last ? '結果と動画一覧を見る' : '次の問題'} <span class="arr">→</span></button>
        </div>`;
      $('qNext').addEventListener('click', () => { if (last) end(); else { quiz.i++; ask(); } });
      $('qNext').focus({ preventScroll: true });
    };
    const end = () => {
      const n = quiz.score, all = quiz.qs.length;
      const [sf, msg] = n === all ? [2, 'ぜんぶ正解です。館長の席をゆずりましょうか。']
        : n >= all - 2 ? [1, 'なかなかです。まちがえたところは、動画で確かめてみてください。']
        : [6, 'ちなみに、どの問題も動画で話しています。新聞は強いです。'];
      const key = 'nz_quiz_best_' + quiz.ch;
      const prev = +(store.get(key) || 0), best = Math.max(n, prev);
      store.set(key, best);
      const other = quiz.ch === 'main' ? 'jiji' : 'main';
      qBox.innerHTML = `
        <div class="q-end">
          <p class="q-result">${all}問中 <b id="qEndN">0</b>問 正解　${n > prev && prev ? '<span class="best">自己ベスト！</span>' : ''}<small class="q-best">${CH[quiz.ch]}の最高：${best}問</small></p>
          <div class="talk shima"><img src="${face('shima', sf)}" alt="シマ先生"><p class="bubble">${msg}</p></div>
          <h3 class="q-vh">今回の問題の解説動画</h3>
          <div class="q-vlist">${quiz.qs.map((q, k) => q.video ? vRow({ video: q.video, ok: quiz.res[k], no: `第${k + 1}問`, head: q.q, sub: '正解：' + q.choices[q.answer] }) : '').join('')}</div>
          ${share(`なぜなぜクイズ（${CH[quiz.ch]}）で${all}問中${n}問正解しました！ #なぜなぜ資料館`)}
          <div class="q-next" style="justify-content:flex-start">
            <button class="btn solid" id="qAgain">もう1回やる <span class="arr">→</span></button>
            <button class="btn" id="qOther">${CH[other]}で遊ぶ</button>
          </div>
        </div>`;
      FX.countUp($('qEndN'), n);
      if (n === all) FX.confetti(true); else if (n >= all - 1) FX.confetti(false);
      $('qAgain').addEventListener('click', () => start(quiz.ch));
      $('qOther').addEventListener('click', () => start(other));
      qBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    fetch('data/quiz.json').then(r => r.json()).then(d => {
      quiz.all = (d.questions || []).filter(q => q.choices && q.choices.length === 3);
      if (!quiz.all.length) throw new Error('no questions');
      const nM = quiz.all.filter(q => q.channel === 'main').length, nJ = quiz.all.filter(q => q.channel === 'jiji').length;
      $('quizCount').textContent = `どちらで遊ぶ？　1回${ROUND}問です。`;
      $('qcMain').textContent = `全${nM}問`; $('qcJiji').textContent = `全${nJ}問`;
      document.querySelectorAll('.q-cat').forEach(b => { b.disabled = !quiz.all.some(q => q.channel === b.dataset.ch); });
      const qs = new URLSearchParams(location.search);
      const want = qs.get('ch');   // quiz.html?ch=jiji で時事から
      const only = qs.get('v');    // quiz.html?v=動画ID で、その回の問題だけ（解説ページから）
      const mine = only ? quiz.all.filter(q => q.video === only) : [];
      if (mine.length) { quiz.ch = mine[0].channel; quiz.qs = shuffle(mine); quiz.i = 0; quiz.score = 0; quiz.res = []; quiz.streak = 0; ask(); }
      else if (want && CH[want]) start(want);
    }).catch(() => { $('quizCount').textContent = '問題を準備中です。'; });
    document.querySelectorAll('.q-cat').forEach(b => b.addEventListener('click', () => start(b.dataset.ch)));
  }

  /* ===================== 今日の1問 ===================== */
  const dBox = $('dailyBox');
  if (dBox) {
    // 日本時間の日付
    const jst = (off = 0) => new Date(Date.now() + 9 * 3600e3 + off * 86400e3).toISOString().slice(0, 10);
    const today = jst(), yesterday = jst(-1);
    const dayNo = Math.floor(Date.parse(today) / 86400e3);
    const nextIn = () => { const ms = 86400e3 - ((Date.now() + 9 * 3600e3) % 86400e3); const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return `${h}時間${m}分`; };
    const done = () => { try { return JSON.parse(store.get('nz_daily_last') || 'null'); } catch (e) { return null; } };

    fetch('data/quiz.json').then(r => r.json()).then(d => {
      const all = (d.questions || []).filter(q => q.choices && q.choices.length === 3);
      // 日付から決まる1問（毎日かわり、だれが開いても同じ問題）
      const order = all.map((q, i) => i).sort((a, b) => ((a * 2654435761 + 97) % 1000003) - ((b * 2654435761 + 97) % 1000003));
      const q = all[order[dayNo % order.length]];
      const last = done();
      const head = `<div class="q-head"><span class="q-no">今日の1問　<small>${today.replace(/-/g, '.')}</small></span><span class="q-score">${CH[q.channel] || ''}</span></div>`;
      const streakNow = () => +(store.get('nz_daily_streak') || 0);

      const result = (k, fresh) => {
        const ok = k === q.answer;
        if (fresh) {
          const prev = done();
          const s = ok ? ((prev && prev.date === yesterday && prev.ok) ? streakNow() + 1 : 1) : 0;
          store.set('nz_daily_streak', s);
          store.set('nz_daily_best', Math.max(s, +(store.get('nz_daily_best') || 0)));
          store.set('nz_daily_last', JSON.stringify({ date: today, k, ok }));
        }
        const s = streakNow();
        dBox.querySelectorAll('.choice').forEach(b => {
          b.disabled = true;
          const n = +b.dataset.k;
          if (n === q.answer) b.classList.add('right'); else if (n === k) b.classList.add('wrong');
        });
        $('dAns').innerHTML = `
          <div class="talk shima ${fresh ? 'fx-in' : ''}"><img src="${face('shima', ok ? 2 : 6)}" alt="シマ先生"><p class="bubble">${ok ? '正解です。' : `おしい。正解は「${esc(q.choices[q.answer])}」です。`}${esc(q.explain)}</p></div>
          <div class="d-streak"><span class="flame">${ok ? '🔥' : '📚'}</span><span><b id="dS">${s}</b>日連続正解</span><small>最高 ${store.get('nz_daily_best') || 0}日</small></div>
          <p class="note">次の問題まで あと${nextIn()}（毎日0時に入れかわります）</p>
          ${q.video ? `<div class="q-vlist">${vRow({ video: q.video, head: '今日の問題の解説動画', sub: '' })}</div>` : ''}
          ${share(`今日の1問、${ok ? '正解' : '不正解'}でした！${s >= 2 ? `（${s}日連続正解）` : ''} #なぜなぜ資料館`)}
          <div class="q-next" style="justify-content:flex-start"><a class="btn solid" href="quiz.html">クイズをもっと解く <span class="arr">→</span></a></div>`;
        if (fresh) {
          const btn = dBox.querySelector(`.choice[data-k="${k}"]`);
          if (ok) { FX.burst(btn); FX.float(btn, '正解！', 'ok'); FX.confetti(s >= 3); } else FX.shake(btn);
        }
        titlesReady.then(() => { const r = $('dAns').querySelector('.q-vlist'); if (r && q.video) r.innerHTML = vRow({ video: q.video, head: '今日の問題の解説動画', sub: '' }); });
      };
      dBox.innerHTML = `${head}
        <div class="talk fx-in"><img src="${face('kotoni', 4)}" alt="コトニちゃん"><p class="bubble">${esc(q.q)}</p></div>
        <div class="choices">${q.choices.map((c, k) => `<button class="choice fx-in" style="animation-delay:${80 + k * 70}ms" data-k="${k}">${'ABC'[k]}　${esc(c)}</button>`).join('')}</div>
        <div id="dAns"></div>`;
      if (last && last.date === today) result(last.k, false);
      else dBox.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => result(+b.dataset.k, true), { once: true }));
    }).catch(() => { dBox.innerHTML = '<p class="note">問題を準備中です。</p>'; });
  }

  /* ===== 年表のデータ（どっちが先？・年表ならべ） ===== */
  const tlReady = (document.getElementById('sakiBox') || document.getElementById('narabeBox'))
    ? fetch('data/timeline.json').then(r => r.json()).then(d => (d.events || []).filter(e => e.y && e.text && !e.fy)) : Promise.resolve([]);
  const when = e => `${e.y}年${e.m ? e.m + '月' : ''}${e.m && e.d ? e.d + '日' : ''}`;
  const key = e => e.y * 10000 + (e.m || 0) * 100 + (e.d || 0);
  const tag = e => `<span class="tl-tag ${e.channel}">${CH[e.channel] || ''}</span>`;
  // 年が同じものは比べない（月・日が無い出来事どうしで順番が決められないため）
  const comparable = (a, b) => a.y !== b.y || (a.m && b.m && (a.m !== b.m || (a.d && b.d && a.d !== b.d)));

  /* ===================== どっちが先？ ===================== */
  const sBox = $('sakiBox');
  if (sBox) {
    const st = { ev: [], streak: 0, seen: [], hist: [], lock: false };
    const pick = () => {
      // 連続が伸びるほど、年の近い2つが出る
      const gap = st.streak < 3 ? 25 : st.streak < 6 ? 12 : st.streak < 10 ? 6 : 3;
      for (let t = 0; t < 400; t++) {
        const a = st.ev[Math.random() * st.ev.length | 0], b = st.ev[Math.random() * st.ev.length | 0];
        if (a === b || !comparable(a, b) || a.video === b.video && t < 200) continue;
        if (st.seen.includes(a.text) || st.seen.includes(b.text)) continue;
        if (Math.abs(a.y - b.y) > gap && t < 300) continue;
        if (a.y === b.y && st.streak < 8 && t < 350) continue;   // 同じ年（月日で比べる）は後半だけ
        return [a, b];
      }
      st.seen = [];
      return shuffle(st.ev).slice(0, 2);
    };
    const round = () => {
      const [a, b] = pick();
      st.lock = false;
      st.seen.push(a.text, b.text); if (st.seen.length > 40) st.seen.splice(0, 2);
      sBox.innerHTML = `
        <div class="q-head"><span class="q-no">先に起きたのはどっち？</span><span class="q-score">連続 <b>${st.streak}</b></span></div>
        <div class="vs">
          ${[a, b].map((e, i) => `<button class="tl-card fx-in" style="animation-delay:${i * 90}ms" data-i="${i}">${tag(e)}<span class="tl-text">${esc(e.text)}</span><span class="tl-year" aria-live="polite"></span></button>`).join('<span class="vs-mark" aria-hidden="true">VS</span>')}
        </div>
        <div id="sAns"></div>`;
      sBox.querySelectorAll('.tl-card').forEach(c => c.addEventListener('click', () => choose(+c.dataset.i, [a, b])));
    };
    const choose = (i, pair) => {
      if (st.lock) return; st.lock = true;
      const first = key(pair[0]) < key(pair[1]) ? 0 : 1;
      const ok = i === first;
      const cards = [...sBox.querySelectorAll('.tl-card')];
      cards.forEach((c, k) => {
        c.disabled = true;
        const y = c.querySelector('.tl-year');
        y.textContent = when(pair[k]);
        c.classList.add(k === first ? 'right' : (k === i ? 'wrong' : 'later'));
      });
      st.hist.push({ pair, ok });
      const sc = sBox.querySelector('.q-score b');
      if (ok) {
        st.streak++; sc.textContent = st.streak; FX.pop(sc); FX.burst(cards[i]); FX.float(cards[i], '+1', 'ok');
        if (st.streak % 5 === 0) FX.confetti(false);
        $('sAns').innerHTML = `<div class="q-next"><button class="btn solid" id="sNext">次へ <span class="arr">→</span></button></div>`;
        $('sNext').addEventListener('click', round); $('sNext').focus({ preventScroll: true });
      } else {
        FX.shake(cards[i]);
        setTimeout(over, 900);
      }
    };
    const over = () => {
      const n = st.streak, prev = +(store.get('nz_saki_best') || 0), best = Math.max(n, prev);
      store.set('nz_saki_best', best);
      const [f, msg] = n >= 15 ? [2, '年表が頭に入っていますね。資料館で働きませんか。']
        : n >= 7 ? [1, 'なかなかです。近い年どうしは、わたしでも迷います。']
        : [4, '年号は、出来事の「つながり」で覚えると強いです。動画でどうぞ。'];
      // 出てきた出来事の動画（重ならないように）
      const vids = []; st.hist.forEach(h => h.pair.forEach(e => { if (e.video && !vids.some(v => v.video === e.video)) vids.push(e); }));
      sBox.innerHTML = `
        <div class="q-end">
          <p class="q-result"><b id="sEndN">0</b>連続　${n > prev && n ? '<span class="best">自己ベスト！</span>' : ''}<small class="q-best">最高：${best}連続</small></p>
          <div class="talk shima"><img src="${face('shima', f)}" alt="シマ先生"><p class="bubble">${msg}</p></div>
          <h3 class="q-vh">出てきた出来事の解説動画</h3>
          <div class="q-vlist">${vids.slice(0, 8).map(e => vRow({ video: e.video, head: e.text, sub: when(e) })).join('')}</div>
          ${share(`「どっちが先？」で${n}連続正解！ 年表、得意？ #なぜなぜ資料館`)}
          <div class="q-next" style="justify-content:flex-start"><button class="btn solid" id="sAgain">もう1回 <span class="arr">→</span></button></div>
        </div>`;
      FX.countUp($('sEndN'), n);
      if (n > prev && n >= 5) FX.confetti(true);
      $('sAgain').addEventListener('click', begin);
    };
    const begin = () => { st.streak = 0; st.hist = []; round(); };
    tlReady.then(ev => {
      st.ev = ev;
      if (ev.length < 6) { sBox.innerHTML = '<p class="note">出来事を準備中です。</p>'; return; }
      $('sakiCount').textContent = `出来事 ${ev.length}個から出ます。`;
      $('sakiStart').disabled = false;
    }).catch(() => { sBox.innerHTML = '<p class="note">出来事を準備中です。</p>'; });
    sBox.addEventListener('click', e => { if (e.target.closest('#sakiStart')) begin(); });
  }

  /* ===================== 年表ならべ ===================== */
  const nBox = $('narabeBox');
  if (nBox) {
    const ROUNDS = 5, N = 4;
    const st = { ev: [], r: 0, score: 0, picks: [], set: [], hist: [] };
    const draw = () => {
      // 年がすべてちがう4つ（できれば別々の動画から）
      for (let t = 0; t < 500; t++) {
        const s = shuffle(st.ev).slice(0, N);
        const ys = new Set(s.map(e => e.y)), vs = new Set(s.map(e => e.video));
        if (ys.size === N && (vs.size === N || t > 250)) return s;
      }
      return shuffle(st.ev).slice(0, N);
    };
    const round = () => {
      st.set = draw(); st.picks = [];
      nBox.innerHTML = `
        <div class="q-head"><span class="q-no">古い順にタップ　第${st.r + 1}回 <small>/ ${ROUNDS}</small></span><span class="q-score">得点 <b>${st.score}</b></span></div>
        <div class="q-bar"><i style="width:${st.r / ROUNDS * 100}%"></i></div>
        <div class="nb-list">${st.set.map((e, i) => `<button class="tl-card nb fx-in" style="animation-delay:${i * 70}ms" data-i="${i}"><span class="nb-no"></span>${tag(e)}<span class="tl-text">${esc(e.text)}</span><span class="tl-year"></span></button>`).join('')}</div>
        <div id="nAns"><p class="note">いちばん古いものから順にタップ。もう一度タップで取り消し。</p></div>`;
      nBox.querySelectorAll('.tl-card').forEach(c => c.addEventListener('click', () => tap(+c.dataset.i, c)));
    };
    const tap = (i, c) => {
      if (st.picks.length === N && !c.classList.contains('picked')) return;
      const at = st.picks.indexOf(i);
      if (at >= 0) st.picks.splice(at, 1); else st.picks.push(i);
      nBox.querySelectorAll('.tl-card').forEach(b => {
        const k = st.picks.indexOf(+b.dataset.i);
        b.classList.toggle('picked', k >= 0);
        b.querySelector('.nb-no').textContent = k >= 0 ? k + 1 : '';
      });
      if (at < 0) FX.pop(c.querySelector('.nb-no'));
      if (st.picks.length === N - 1) {   // 最後の1つは自動で
        const rest = st.set.findIndex((_, k) => !st.picks.includes(k));
        st.picks.push(rest);
        const b = nBox.querySelector(`.tl-card[data-i="${rest}"]`);
        b.classList.add('picked'); b.querySelector('.nb-no').textContent = N;
        setTimeout(check, 250);
      }
    };
    const check = () => {
      const right = st.set.map((e, i) => i).sort((a, b) => key(st.set[a]) - key(st.set[b]));
      let pts = 0;
      st.picks.forEach((i, pos) => {
        const b = nBox.querySelector(`.tl-card[data-i="${i}"]`);
        const ok = right[pos] === i;
        if (ok) pts++;
        b.disabled = true;
        b.classList.add(ok ? 'right' : 'wrong');
        b.querySelector('.tl-year').textContent = when(st.set[i]);
        if (!ok) b.insertAdjacentHTML('beforeend', `<small class="nb-was">あなたの答え：${pos + 1}番目</small>`);
        setTimeout(() => ok ? FX.burst(b) : FX.shake(b), pos * 120);
      });
      // 正しい順にならべかえて見せる
      const list = nBox.querySelector('.nb-list');
      setTimeout(() => { right.forEach(i => list.appendChild(nBox.querySelector(`.tl-card[data-i="${i}"]`))); nBox.querySelectorAll('.tl-card').forEach((b, k) => { b.querySelector('.nb-no').textContent = k + 1; }); }, 1100);
      st.score += pts; st.hist.push(...st.set);
      const sc = nBox.querySelector('.q-score b'); sc.textContent = st.score; FX.pop(sc);
      FX.float(list, pts === N ? 'パーフェクト！' : `+${pts}`, pts === N ? 'ok big' : 'ok');
      if (pts === N) FX.confetti(false);
      nBox.querySelector('.q-bar i').style.width = (st.r + 1) / ROUNDS * 100 + '%';
      const last = st.r === ROUNDS - 1;
      $('nAns').innerHTML = `<p class="note">${pts}個が正しい位置でした。少しすると正しい順にならびます。</p>
        <div class="q-next"><button class="btn solid" id="nNext">${last ? '結果を見る' : '次へ'} <span class="arr">→</span></button></div>`;
      $('nNext').addEventListener('click', () => { if (last) over(); else { st.r++; round(); } });
    };
    const over = () => {
      const n = st.score, all = ROUNDS * N, prev = +(store.get('nz_narabe_best') || 0), best = Math.max(n, prev);
      store.set('nz_narabe_best', best);
      const [f, msg] = n === all ? [2, '満点です。年表を書いたのはあなたでしたか。']
        : n >= all * .7 ? [1, 'よくできました。ずれたのは、年の近い出来事ではありませんか。']
        : [4, '年表は、動画を見てからだと、ぐっと楽になります。'];
      const vids = []; st.hist.forEach(e => { if (e.video && !vids.some(v => v.video === e.video)) vids.push(e); });
      nBox.innerHTML = `
        <div class="q-end">
          <p class="q-result">${all}点中 <b id="nEndN">0</b>点　${n > prev && prev ? '<span class="best">自己ベスト！</span>' : ''}<small class="q-best">最高：${best}点</small></p>
          <div class="talk shima"><img src="${face('shima', f)}" alt="シマ先生"><p class="bubble">${msg}</p></div>
          <h3 class="q-vh">出てきた出来事の解説動画</h3>
          <div class="q-vlist">${vids.slice(0, 10).map(e => vRow({ video: e.video, head: e.text, sub: when(e) })).join('')}</div>
          ${share(`年表ならべで${all}点中${n}点でした！ #なぜなぜ資料館`)}
          <div class="q-next" style="justify-content:flex-start"><button class="btn solid" id="nAgain">もう1回 <span class="arr">→</span></button></div>
        </div>`;
      FX.countUp($('nEndN'), n);
      if (n === all) FX.confetti(true); else if (n >= all * .8) FX.confetti(false);
      $('nAgain').addEventListener('click', begin);
    };
    const begin = () => { st.r = 0; st.score = 0; st.hist = []; round(); };
    tlReady.then(ev => {
      st.ev = ev;
      if (new Set(ev.map(e => e.y)).size < N + 2) { nBox.innerHTML = '<p class="note">出来事を準備中です。</p>'; return; }
      $('narabeCount').textContent = `出来事 ${ev.length}個から出ます。1回4つ×5回。`;
      $('narabeStart').disabled = false;
    }).catch(() => { nBox.innerHTML = '<p class="note">出来事を準備中です。</p>'; });
    nBox.addEventListener('click', e => { if (e.target.closest('#narabeStart')) begin(); });
  }

  /* ===================== 反射ゲーム：シマ先生だけタップ ===================== */
  const board = $('hitBoard');
  if (board) {
    const TIME = 30;
    const holes = [...board.querySelectorAll('.hole')];
    const hit = {
      on: false, score: 0, left: TIME, timer: null, popT: null, tick: null, combo: 0,
      start() {
        this.stop();
        this.on = true; this.score = 0; this.left = TIME; this.combo = 0;
        $('hitScore').textContent = 0; $('hitTime').textContent = TIME;
        $('hitStart').hidden = true; $('hitMsg').hidden = true;
        board.classList.add('playing');
        this.tick = setInterval(() => {
          this.left--; $('hitTime').textContent = this.left;
          if (this.left <= 5) FX.pop($('hitTime'));
          if (this.left <= 0) this.end();
        }, 1000);
        this.pop();
      },
      pop() {
        if (!this.on) return;
        const free = holes.filter(h => !h.dataset.who);
        if (free.length) {
          const h = free[Math.floor(Math.random() * free.length)];
          const elapsed = TIME - this.left;
          const who = Math.random() < 0.68 ? 'shima' : 'kotoni';
          const stay = Math.max(520, 1050 - elapsed * 18);           // だんだん速くなる
          h.dataset.who = who;
          h.querySelector('img').src = face(who, 1);
          h.classList.add('up');
          h._t = setTimeout(() => { if (who === 'shima') this.combo = 0; this.hide(h); }, stay);
        }
        this.popT = setTimeout(() => this.pop(), Math.max(380, 780 - (TIME - this.left) * 12));
      },
      hide(h) {
        clearTimeout(h._t);
        h.classList.remove('up', 'got', 'miss');
        setTimeout(() => { if (!h.classList.contains('up')) delete h.dataset.who; }, 160);
      },
      tap(h) {
        if (!this.on || !h.classList.contains('up') || h.classList.contains('got') || h.classList.contains('miss')) return;
        const who = h.dataset.who;
        if (who === 'shima') {
          this.combo++;
          const add = this.combo >= 5 ? 2 : 1;   // 5連続から2点
          this.score += add; h.classList.add('got'); h.querySelector('img').src = face('shima', 2);
          FX.burst(h); FX.float(h, '+' + add + (add > 1 ? ' コンボ' : ''), 'ok');
        } else {
          this.combo = 0;
          this.score = Math.max(0, this.score - 1); h.classList.add('miss'); h.querySelector('img').src = face('kotoni', 6);
          FX.float(h, '−1', 'ng'); FX.shake(board);
        }
        $('hitScore').textContent = this.score; FX.pop($('hitScore'));
        clearTimeout(h._t);
        h._t = setTimeout(() => this.hide(h), 260);
      },
      end() {
        this.stop();
        const prev = +(store.get('nz_hit_best') || 0);
        const best = Math.max(this.score, prev);
        const isBest = this.score > 0 && this.score > prev;
        store.set('nz_hit_best', best);
        $('hitBest').textContent = best;
        const s = this.score;
        const [f, msg] = s >= 30 ? [2, 'はやい……！ 資料をめくる手より速いです。']
          : s >= 18 ? [1, 'いい反射です。新聞を読むのも、これくらいの速さでどうぞ。']
          : [4, 'ちなみに、コトニちゃんをタップすると減点です。'];
        $('hitMsg').innerHTML = `<p class="q-result"><b id="hitEndN">0</b>点${isBest ? '　<span class="best">自己ベスト！</span>' : ''}</p>
          <div class="talk shima"><img src="${face('shima', f)}" alt="シマ先生"><p class="bubble">${msg}</p></div>
          ${share(`なぜなぜ資料館の反射ゲームで${s}点でした！ シマ先生、つかまえられる？ #なぜなぜ資料館`)}`;
        $('hitMsg').hidden = false;
        FX.countUp($('hitEndN'), s);
        if (isBest) FX.confetti(s >= 20);
        $('hitStart').hidden = false;
        $('hitStart').innerHTML = 'もう1回 <span class="arr">→</span>';
      },
      stop() {
        this.on = false;
        clearInterval(this.tick); clearTimeout(this.popT);
        holes.forEach(h => this.hide(h));
        board.classList.remove('playing');
      },
    };
    holes.forEach(h => h.addEventListener('pointerdown', e => { e.preventDefault(); hit.tap(h); }));
    $('hitStart').addEventListener('click', () => hit.start());
    $('hitBest').textContent = store.get('nz_hit_best') || 0;
    document.addEventListener('visibilitychange', () => { if (document.hidden && hit.on) hit.end(); });
  }
})();
