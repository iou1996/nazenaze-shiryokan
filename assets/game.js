/* ゲームページ：なぜなぜクイズ と 反射ゲーム */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const face = (who, n) => `images/chars/${who}_face${n}.png`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };

  /* ゲームの切りかえ */
  const gtabs = [...document.querySelectorAll('#gameTabs .tab')];
  const gpill = document.querySelector('#gameTabs .pill');
  const moveG = t => { gpill.style.width = t.offsetWidth + 'px'; gpill.style.transform = `translateX(${t.offsetLeft - 5}px)`; };
  gtabs.forEach(t => t.addEventListener('click', () => {
    gtabs.forEach(x => { x.setAttribute('aria-selected', x === t); $(x.dataset.panel).hidden = x !== t; });
    moveG(t);
    if (t.dataset.panel !== 'gHit') hit.stop();
  }));
  const placeG = () => moveG(gtabs.find(t => t.getAttribute('aria-selected') === 'true'));
  addEventListener('resize', placeG);
  document.fonts.ready.then(placeG);
  placeG();

  /* ===== なぜなぜクイズ ===== */
  const ROUND = 5;
  const quiz = { all: [], qs: [], i: 0, score: 0, ch: 'main', res: [] };
  const TITLES = {};
  fetch('videos.json').then(r => r.json()).then(d => { for (const k of ['main', 'jiji']) (d[k] || []).forEach(v => { TITLES[v.id] = v.title; }); }).catch(() => {});
  const watchCard = (id, mark) => `<a class="watch" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener">
      <span class="w-th"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg" alt="" loading="lazy"><span class="w-play"></span>${mark || ''}</span>
      <span class="w-txt"><span class="w-lbl">▶ この回の動画を見る</span><small>${esc(TITLES[id] || 'YouTubeで開く')}</small></span></a>`;
  const CH = { main: 'スポーツ編', jiji: '時事・地域編' };
  const GAME_URL = (document.querySelector('link[rel=canonical]') || {}).href || location.href;
  const qBox = $('quizBox');

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function quizStart(ch) {
    if (typeof ch === 'string') quiz.ch = ch;
    quiz.qs = shuffle(quiz.all.filter(q => q.channel === quiz.ch)).slice(0, ROUND);
    quiz.i = 0; quiz.score = 0; quiz.res = [];
    quizAsk();
  }

  function quizAsk() {
    const q = quiz.qs[quiz.i];
    qBox.innerHTML = `
      <div class="q-head"><span class="q-no">${CH[quiz.ch]}　第${quiz.i + 1}問 <small>/ ${quiz.qs.length}</small></span><span class="q-score">正解 ${quiz.score}</span></div>
      <div class="talk"><img src="${face('kotoni', 4)}" alt="コトニちゃん"><p class="bubble">${esc(q.q)}</p></div>
      <div class="choices">${q.choices.map((c, k) => `<button class="choice" data-k="${k}">${'ABC'[k]}　${esc(c)}</button>`).join('')}</div>
      <div id="qAns"></div>`;
    qBox.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => quizAnswer(+b.dataset.k)));
  }

  function quizAnswer(k) {
    const q = quiz.qs[quiz.i];
    const ok = k === q.answer;
    if (ok) quiz.score++;
    quiz.res[quiz.i] = ok;
    qBox.querySelectorAll('.choice').forEach(b => {
      b.disabled = true;
      const n = +b.dataset.k;
      if (n === q.answer) b.classList.add('right');
      else if (n === k) b.classList.add('wrong');
    });
    qBox.querySelector('.q-score').textContent = '正解 ' + quiz.score;
    const last = quiz.i === quiz.qs.length - 1;
    $('qAns').innerHTML = `
      <div class="talk shima"><img src="${face('shima', ok ? 2 : 6)}" alt="シマ先生"><p class="bubble">${ok ? '正解です。' : `おしい。正解は「${esc(q.choices[q.answer])}」です。`}${esc(q.explain)}</p></div>
      ${q.video ? watchCard(q.video) : ''}
      <div class="q-next">
        <button class="btn solid" id="qNext">${last ? '結果を見る' : '次の問題'} <span class="arr">→</span></button>
      </div>`;
    $('qNext').addEventListener('click', () => { if (last) quizEnd(); else { quiz.i++; quizAsk(); } });
    $('qNext').focus({ preventScroll: true });
  }

  function quizEnd() {
    const n = quiz.score, all = quiz.qs.length;
    const [sf, kf, msg] = n === all ? [2, 5, 'ぜんぶ正解です。館長の席をゆずりましょうか。']
      : n >= all - 2 ? [1, 3, 'なかなかです。まちがえたところは、動画で確かめてみてください。']
      : [6, 6, 'ちなみに、どの問題も動画で話しています。新聞は強いです。'];
    const key = 'nz_quiz_best_' + quiz.ch;
    const best = Math.max(n, +(store.get(key) || 0));
    store.set(key, best);
    const other = quiz.ch === 'main' ? 'jiji' : 'main';
    const share = window.nzShareHTML ? window.nzShareHTML(`なぜなぜクイズ（${CH[quiz.ch]}）で${all}問中${n}問正解しました！ #なぜなぜ資料館`, GAME_URL) : '';
    qBox.innerHTML = `
      <div class="q-end">
        <p class="q-result">${all}問中 <b>${n}</b>問 正解</p>
        <div class="talk shima"><img src="${face('shima', sf)}" alt="シマ先生"><p class="bubble">${msg}</p></div>
        <div class="talk"><img src="${face('kotoni', kf)}" alt="コトニちゃん"><p class="bubble">${n === all ? 'べつに、すごいとか思ってないけど。' : 'もう1回やる？　べつに付き合ってあげてもいいけど。'}</p></div>
        <p class="note">${CH[quiz.ch]}のこれまでの最高：${best}問</p>
        <h3 class="q-vh">今回の問題の動画</h3>
        <div class="q-videos">${quiz.qs.map((q, k) => q.video ? watchCard(q.video, `<span class="w-mark ${quiz.res[k] ? 'ok' : 'ng'}">${quiz.res[k] ? '○' : '×'}</span>`) : '').join('')}</div>
        ${share}
        <div class="q-next" style="justify-content:flex-start">
          <button class="btn solid" id="qAgain">もう1回やる <span class="arr">→</span></button>
          <button class="btn" id="qOther">${CH[other]}で遊ぶ</button>
        </div>
      </div>`;
    $('qAgain').addEventListener('click', () => quizStart(quiz.ch));
    $('qOther').addEventListener('click', () => quizStart(other));
  }

  fetch('data/quiz.json').then(r => r.json()).then(d => {
    quiz.all = (d.questions || []).filter(q => q.choices && q.choices.length === 3);
    if (!quiz.all.length) throw new Error('no questions');
    const nM = quiz.all.filter(q => q.channel === 'main').length, nJ = quiz.all.filter(q => q.channel === 'jiji').length;
    $('quizCount').textContent = `どちらで遊ぶ？　1回${ROUND}問です。`;
    $('qcMain').textContent = `全${nM}問`; $('qcJiji').textContent = `全${nJ}問`;
    document.querySelectorAll('.q-cat').forEach(b => { b.disabled = !quiz.all.some(q => q.channel === b.dataset.ch); });
  }).catch(() => { $('quizCount').textContent = '問題を準備中です。'; });
  document.querySelectorAll('.q-cat').forEach(b => b.addEventListener('click', () => quizStart(b.dataset.ch)));

  /* ===== 反射ゲーム：シマ先生だけタップ ===== */
  const TIME = 30;
  const holes = [...document.querySelectorAll('.hole')];
  const hit = {
    on: false, score: 0, left: TIME, timer: null, popT: null, tick: null,
    start() {
      this.stop();
      this.on = true; this.score = 0; this.left = TIME;
      $('hitScore').textContent = 0; $('hitTime').textContent = TIME;
      $('hitStart').hidden = true; $('hitMsg').hidden = true;
      $('hitBoard').classList.add('playing');
      this.tick = setInterval(() => {
        this.left--; $('hitTime').textContent = this.left;
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
        h._t = setTimeout(() => this.hide(h), stay);
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
      if (who === 'shima') { this.score++; h.classList.add('got'); h.querySelector('img').src = face('shima', 2); }
      else { this.score = Math.max(0, this.score - 1); h.classList.add('miss'); h.querySelector('img').src = face('kotoni', 6); }
      $('hitScore').textContent = this.score;
      clearTimeout(h._t);
      h._t = setTimeout(() => this.hide(h), 260);
    },
    end() {
      this.stop();
      const best = Math.max(this.score, +(store.get('nz_hit_best') || 0));
      const isBest = this.score > 0 && this.score >= best;
      store.set('nz_hit_best', best);
      $('hitBest').textContent = best;
      const s = this.score;
      const [f, msg] = s >= 30 ? [2, 'はやい……！ 資料をめくる手より速いです。']
        : s >= 18 ? [1, 'いい反射です。新聞を読むのも、これくらいの速さでどうぞ。']
        : [4, 'ちなみに、コトニちゃんをタップすると減点です。'];
      $('hitMsg').innerHTML = `<p class="q-result"><b>${s}</b>点${isBest ? '　<span class="best">自己ベスト！</span>' : ''}</p>
        <div class="talk shima"><img src="${face('shima', f)}" alt="シマ先生"><p class="bubble">${msg}</p></div>
        ${window.nzShareHTML ? window.nzShareHTML(`なぜなぜ資料館の反射ゲームで${s}点でした！ シマ先生、つかまえられる？ #なぜなぜ資料館`, GAME_URL) : ''}`;
      $('hitMsg').hidden = false;
      $('hitStart').hidden = false;
      $('hitStart').innerHTML = 'もう1回 <span class="arr">→</span>';
    },
    stop() {
      this.on = false;
      clearInterval(this.tick); clearTimeout(this.popT);
      holes.forEach(h => this.hide(h));
      $('hitBoard').classList.remove('playing');
    },
  };
  holes.forEach(h => h.addEventListener('pointerdown', e => { e.preventDefault(); hit.tap(h); }));
  $('hitStart').addEventListener('click', () => hit.start());
  $('hitBest').textContent = store.get('nz_hit_best') || 0;
  document.addEventListener('visibilitychange', () => { if (document.hidden && hit.on) hit.end(); });
})();
