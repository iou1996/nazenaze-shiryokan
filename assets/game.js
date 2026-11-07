/* ゲーム（1ゲーム1ページ）。各ページの要素があるときだけ、そのゲームを動かす
   quiz.html なぜなぜクイズ / daily.html 今日の1問 / hit.html 反射ゲーム / game.html 一覧 */
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
