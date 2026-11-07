/* 資料館ダッシュ（run.html）
   コトニちゃんが棚の間を走る。タップ／スペースでジャンプ（2段まで）。本の山をよけ、「？」カードを集める。
   カード5枚で「なぜなぜゲート」→ クイズ1問。正解でボーナスとバリア（1回ぶつかっても平気）。ライフ3つ。 */
(() => {
  const wrap = document.getElementById('runWrap');
  if (!wrap) return;
  const cv = document.getElementById('runCanvas'), cx = cv.getContext('2d');
  const ov = document.getElementById('runOverlay');
  const FX = window.NZFX || { confetti() {}, burst() {}, float() {}, shake() {}, pop() {}, countUp(el, n) { el.textContent = n; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const URL_ = (document.querySelector('link[rel=canonical]') || {}).href || location.href;
  const img = src => { const i = new Image(); i.src = src; return i; };
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  const SPR = { kotoni: img('images/game/kotoni_run.png?v=2'), shima: img('images/game/shima.png') };
  const face = (w, n) => `images/chars/${w}_face${n}.png`;
  // flow=true：キャンバスを隠して、パネルを普通の流れで出す（クイズ・結果・休み）
  function showOv(html, flow) { ov.innerHTML = html; ov.hidden = false; wrap.classList.toggle('flow', !!flow); }
  function hideOv() { ov.hidden = true; ov.innerHTML = ''; wrap.classList.remove('flow'); }

  /* ---------- 画面の大きさ ---------- */
  let W = 800, H = 340, GROUND = 290, DPR = 1;
  // 画面の大きさに合わせて、絵ごと拡大する。ゲームの中の大きさは「高さ360・幅380以上」を基準にして、倍率 K をかける
  let K = 1;
  function fit() {
    const full = wrap.classList.contains('full');
    const cw = full ? innerWidth : wrap.clientWidth;
    const hdr = (document.getElementById('hdr') || {}).offsetHeight || 0;
    const room = Math.max(300, innerHeight - hdr - 24);          // 画面に収まる高さ
    const ch = full ? innerHeight : Math.min(room, cw < 600 ? Math.round(cw * 1.15) : Math.round(Math.min(560, Math.max(380, cw * 0.5))));
    K = Math.min(ch / 360, cw / 380);
    const oldG = GROUND;
    W = cw / K; H = ch / K; GROUND = H - 46;
    DPR = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cx.setTransform(DPR * K, 0, 0, DPR * K, 0, 0);
    makeShelves();
    // 遊んでいる途中で大きさが変わったら、床の高さの差だけ全部ずらす
    if (st && oldG !== GROUND) { const d = GROUND - oldG; st.p.y += d; st.obs.forEach(o => { o.y += d; }); st.items.forEach(it => { it.y += d; }); }
  }

  /* ---------- 背景：棚の絵を一度だけ描いておく ---------- */
  const COLS = ['#8c3b2e', '#c9822f', '#2f5e7a', '#5b7a3a', '#7a4f8c', '#a8452f', '#d4a84a', '#3e6e6a', '#9b6a3a', '#6b2f2f'];
  let far, near;
  function shelfTile(w, h, rows, scale, dark) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = dark ? '#21170f' : '#2e2016'; g.fillRect(0, 0, w, h);
    const rh = h / rows;
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let r = 0; r < rows; r++) {
      const y0 = r * rh;
      // 板
      g.fillStyle = dark ? '#3a2818' : '#5a3d24'; g.fillRect(0, y0 + rh - 8 * scale, w, 8 * scale);
      // 本
      let x = 4;
      while (x < w - 4) {
        const bw = (8 + rnd() * 12) * scale, bh = rh * (0.55 + rnd() * 0.33);
        if (rnd() < 0.08) { x += bw * 1.5; continue; }               // すきま
        g.fillStyle = COLS[rnd() * COLS.length | 0];
        g.globalAlpha = dark ? 0.45 : 0.85;
        const lean = rnd() < 0.07;
        if (lean) { g.save(); g.translate(x, y0 + rh - 8 * scale); g.rotate(-0.25); g.fillRect(0, -bh, bw, bh); g.restore(); x += bw * 1.6; continue; }
        g.fillRect(x, y0 + rh - 8 * scale - bh, bw, bh);
        g.fillStyle = 'rgba(255,240,215,.25)'; g.fillRect(x + 2, y0 + rh - 8 * scale - bh * 0.8, bw - 4, 2);
        g.globalAlpha = 1;
        x += bw + 1;
      }
      g.globalAlpha = 1;
    }
    // 柱
    g.fillStyle = dark ? '#2b1d12' : '#4a321e'; g.fillRect(0, 0, 10 * scale, h); g.fillRect(w - 10 * scale, 0, 10 * scale, h);
    return c;
  }
  function makeShelves() {
    far = shelfTile(900, GROUND - 40, 4, 0.7, true);
    // 奥の棚の真ん中に、月の見える丸い窓（バナーと同じ夜の資料館）
    const g = far.getContext('2d'), wx = 450, wy = Math.min(110, (GROUND - 40) * .32), r = Math.min(64, (GROUND - 40) * .22);
    g.save(); g.beginPath(); g.arc(wx, wy, r, 0, 6.3); g.clip();
    const sky = g.createLinearGradient(0, wy - r, 0, wy + r); sky.addColorStop(0, '#0d1a33'); sky.addColorStop(1, '#22365c');
    g.fillStyle = sky; g.fillRect(wx - r, wy - r, r * 2, r * 2);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${.4 + Math.random() * .5})`; g.fillRect(wx - r + Math.random() * r * 2, wy - r + Math.random() * r * 2, 1.6, 1.6); }
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(wx + r * .35, wy - r * .25, r * .3, 0, 6.3); g.fill();
    g.fillStyle = '#22365c'; g.beginPath(); g.arc(wx + r * .47, wy - r * .33, r * .27, 0, 6.3); g.fill();
    g.restore();
    g.strokeStyle = '#5a3d24'; g.lineWidth = 9; g.beginPath(); g.arc(wx, wy, r, 0, 6.3); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(wx - r, wy); g.lineTo(wx + r, wy); g.moveTo(wx, wy - r); g.lineTo(wx, wy + r); g.stroke();
    near = shelfTile(700, GROUND + 10, 3, 1, false);
  }
  // ふわふわ舞うほこり（ずっとある）
  const motes = Array.from({ length: 28 }, () => ({ x: Math.random(), y: Math.random(), s: .6 + Math.random() * 1.6, v: .2 + Math.random() * .6, ph: Math.random() * 6 }));

  /* ---------- 状態 ---------- */
  const G = 2300, J1 = -820, J2 = -620, CEIL = 10;
  let st, last = 0, raf = 0, qs = [], qAll = [], TITLES = {};
  const CHL = { main: 'スポーツ編', jiji: '時事・地域編' };
  let CHN = store.get('nz_run_ch') === 'jiji' ? 'jiji' : 'main';
  // 自己ベストはチャンネルごと（前の版の nz_run_best はスポーツ編として読む）
  const best = (c = CHN) => +(store.get('nz_run_best_' + c) || (c === 'main' ? store.get('nz_run_best') : 0) || 0);
  function reset() {
    st = {
      mode: 'play', t: 0, speed: 330, dist: 0, score: 0, lives: 3, cards: 0, total: 0, shield: false, inv: 0,
      p: { x: 70, y: GROUND, vy: 0, jumps: 0, sz: 66, squash: 0 },
      obs: [], items: [], parts: [], gate: null, nextObs: 1.2, nextCard: 0.6, scrollF: 0, scrollN: 0, shake: 0, flash: 0,
      asked: [], msg: null, buf: 0,
    };
  }

  /* ---------- 入力 ---------- */
  function jump() {
    if (!st || st.mode !== 'play') return;
    const p = st.p;
    if (p.jumps < 2) { p.vy = p.jumps ? J2 : J1; p.jumps++; st.buf = 0; dust(p.x + 20, p.y, 6); }
    else st.buf = 0.16;   // 2段ジャンプを使い切っていたら、着地の直前に押した分として覚えておく
  }
  // ゲームの枠のどこをタップしても跳ぶ（ボタンの上はのぞく）
  wrap.addEventListener('pointerdown', e => {
    if (!st || st.mode !== 'play' || e.target.closest('button, a')) return;
    e.preventDefault(); jump();
  });
  addEventListener('keydown', e => {
    if (!st || st.mode !== 'play') return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); }
  });

  /* ---------- 出てくるもの ---------- */
  function spawnObs() {
    const lvl = Math.min(1, st.t / 70);
    const r = Math.random();
    let o;
    if (r < 0.55) o = { kind: 'stack', w: 38 + Math.random() * 18, h: 34 + Math.random() * 26 };
    else if (r < 0.85) o = { kind: 'stack', w: 44, h: 70 + Math.random() * 30 * (0.4 + lvl) };   // 高い山は2段ジャンプ
    else o = { kind: 'cart', w: 70, h: 40 };                                                  // 本のワゴン（横に長い）
    o.x = W + 20; o.y = GROUND - o.h; o.books = Array.from({ length: Math.ceil(o.h / 12) }, () => ({ c: COLS[Math.random() * COLS.length | 0], dx: (Math.random() - .5) * 8 }));
    st.obs.push(o);
    // 山の上に「？」を置くこともある
    if (Math.random() < 0.45) for (let k = 0; k < 3; k++) st.items.push({ x: o.x - 30 + k * 34, y: o.y - 50 - Math.sin((k / 2) * Math.PI) * 30, r: 13, bob: Math.random() * 6 });
  }
  function spawnCards() {
    const y = GROUND - 40 - Math.random() * 110, n = 3 + (Math.random() * 3 | 0);
    for (let k = 0; k < n; k++) st.items.push({ x: W + 30 + k * 34, y, r: 13, bob: k * .6 });
  }
  function spawnGate() { st.gate = { x: W + 40, w: 70, h: GROUND - 30 }; }

  function dust(x, y, n) { for (let i = 0; i < n; i++) st.parts.push({ x, y, vx: -60 - Math.random() * 120, vy: -40 - Math.random() * 80, life: .5, c: 'rgba(230,210,180,.7)', s: 3 + Math.random() * 3 }); }
  function sparkle(x, y, c) { for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 180; st.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .6, c: c || '#f2b64c', s: 3 + Math.random() * 3 }); } }
  function say(text, color) { st.msg = { text, color: color || '#f2b64c', life: 1.3 }; }

  /* ---------- 1コマ進める ---------- */
  function step(dt) {
    const p = st.p;
    st.t += dt;
    st.speed = Math.min(760, 330 + st.t * 7);
    const dx = st.speed * dt;
    st.dist += dx / 40;
    st.scrollF = (st.scrollF + dx * 0.25) % far.width;
    st.scrollN = (st.scrollN + dx * 0.6) % near.width;

    // コトニちゃん
    p.vy += G * dt; p.y += p.vy * dt;
    if (p.y - p.sz < CEIL) { p.y = CEIL + p.sz; if (p.vy < 0) p.vy = 0; }      // 天井：画面の上に出ない
    if (p.y >= GROUND) {
      if (p.vy > 600) { dust(p.x + 20, GROUND, 8); p.squash = 0.18; }
      p.y = GROUND; p.vy = 0; p.jumps = 0;
      if (st.buf > 0) { st.buf = 0; jump(); }
    }
    if (st.buf > 0) st.buf -= dt;
    p.squash = Math.max(0, p.squash - dt);
    if (st.inv > 0) st.inv -= dt;

    // 出す
    if (!st.gate) {
      st.nextObs -= dt; st.nextCard -= dt;
      if (st.nextObs <= 0) { spawnObs(); st.nextObs = Math.max(0.62, 1.5 - st.t / 90) + Math.random() * 0.7; }
      if (st.nextCard <= 0) { spawnCards(); st.nextCard = 2.2 + Math.random() * 2; }
    }
    // 動かす
    st.obs.forEach(o => { o.x -= dx; });
    st.items.forEach(it => { it.x -= dx; it.bob += dt * 5; });
    st.obs = st.obs.filter(o => o.x + o.w > -20);
    st.items = st.items.filter(it => it.x > -30 && !it.got);
    st.parts.forEach(q => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; q.life -= dt; });
    st.parts = st.parts.filter(q => q.life > 0);
    if (st.msg) { st.msg.life -= dt; if (st.msg.life <= 0) st.msg = null; }
    st.shake = Math.max(0, st.shake - dt); st.flash = Math.max(0, st.flash - dt);

    // 当たり
    const hb = { x: p.x + 14, y: p.y - p.sz + 12, w: p.sz - 30, h: p.sz - 16 };
    for (const o of st.obs) {
      if (o.hit) continue;
      if (hb.x < o.x + o.w - 6 && hb.x + hb.w > o.x + 6 && hb.y + hb.h > o.y + 4) {
        o.hit = true;
        if (st.inv > 0) continue;
        if (st.shield) { st.shield = false; st.inv = 1; sparkle(p.x + 30, p.y - 30, '#86bde0'); say('バリアで守った！', '#86bde0'); }
        else {
          st.lives--; st.inv = 1.6; st.shake = 0.35; st.flash = 0.25;
          if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
          say(st.lives > 0 ? 'いたっ！' : 'もうだめ……', '#e0533f');
          if (st.lives <= 0) { over(); return; }
        }
      }
    }
    for (const it of st.items) {
      const cy = it.y + Math.sin(it.bob) * 4;
      if (Math.abs(it.x - (hb.x + hb.w / 2)) < it.r + hb.w / 2 && cy > hb.y - it.r && cy < hb.y + hb.h + it.r) {
        it.got = true; st.cards++; st.total++; st.score += 10; sparkle(it.x, cy);
        if (st.cards >= 5 && !st.gate) { spawnGate(); say('なぜなぜゲートが来る！'); }
      }
    }
    // ゲート
    if (st.gate) {
      st.gate.x -= dx;
      // ゲートを通ったら、いきなりクイズにしない。いったん止めて「なぜなぜゲート！」を見せる（連打のまま選択肢を押さないように）
      if (st.gate.x < p.x + 20) { st.gate = null; st.cards = 0; st.mode = 'gate'; st.gateT = 0.9; say('なぜなぜゲート！'); st.msg.life = 1; }
    }
    st.score = Math.max(st.score, 0);
  }

  /* ---------- 描く ---------- */
  function draw() {
    cx.save();
    if (st && st.shake > 0) cx.translate((Math.random() - .5) * 10 * st.shake / .35, (Math.random() - .5) * 8 * st.shake / .35);
    // 奥の棚
    const sF = st ? st.scrollF : 0, sN = st ? st.scrollN : 0;
    for (let x = -sF; x < W; x += far.width) cx.drawImage(far, x, 0);
    // 吊りランプ（ゆれる）と明かり
    const tnow = performance.now() / 1000, sL = (st ? st.scrollF * 1.6 : 0) % 340;
    for (let x = -sL + 120; x < W + 60; x += 340) {
      const sw = Math.sin(tnow * 1.3 + x * .01) * .06, len = Math.min(70, H * .2);
      cx.save(); cx.translate(x, 0); cx.rotate(sw);
      cx.strokeStyle = '#3a2818'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(0, len); cx.stroke();
      const glow = cx.createRadialGradient(0, len + 10, 4, 0, len + 10, 150);
      glow.addColorStop(0, 'rgba(255,205,120,.35)'); glow.addColorStop(1, 'rgba(255,205,120,0)');
      cx.fillStyle = glow; cx.fillRect(-150, len - 140, 300, 300);
      cx.fillStyle = '#c94a35'; cx.beginPath(); cx.moveTo(-16, len + 10); cx.quadraticCurveTo(0, len - 8, 16, len + 10); cx.closePath(); cx.fill();
      cx.fillStyle = '#ffe2a0'; cx.beginPath(); cx.arc(0, len + 13, 5, 0, 6.3); cx.fill();
      cx.restore();
    }
    // ほこり
    for (const m of motes) {
      const mx = ((m.x * W - (st ? st.scrollN * .3 : 0) * m.v) % W + W) % W, my = (m.y * GROUND + Math.sin(tnow * m.v + m.ph) * 12);
      cx.fillStyle = `rgba(255,230,180,${.18 + Math.sin(tnow * 2 + m.ph) * .1})`; cx.fillRect(mx, my, m.s, m.s);
    }
    // 手前の棚（下半分だけ見える）
    cx.globalAlpha = .9;
    for (let x = -sN; x < W; x += near.width) cx.drawImage(near, x, GROUND - near.height * 0.55, near.width, near.height * 0.55 + 10);
    cx.globalAlpha = 1;
    // 床（板）と赤いじゅうたん
    cx.fillStyle = '#6b4a2c'; cx.fillRect(0, GROUND, W, H - GROUND);
    cx.fillStyle = '#7d5634'; for (let x = -(sN * 1.4 % 80); x < W; x += 80) cx.fillRect(x, GROUND, 2, H - GROUND);
    const cy0 = GROUND + 10, ch = Math.max(14, (H - GROUND) * .45);
    cx.fillStyle = '#8f2f25'; cx.fillRect(0, cy0, W, ch);
    cx.fillStyle = '#d9a441'; cx.fillRect(0, cy0 + 3, W, 2); cx.fillRect(0, cy0 + ch - 5, W, 2);
    cx.fillStyle = 'rgba(217,164,65,.35)';
    for (let x = -(sN * 1.4 % 40); x < W; x += 40) { cx.beginPath(); cx.moveTo(x, cy0 + ch / 2); cx.lineTo(x + 6, cy0 + ch / 2 - 4); cx.lineTo(x + 12, cy0 + ch / 2); cx.lineTo(x + 6, cy0 + ch / 2 + 4); cx.fill(); }
    cx.fillStyle = 'rgba(0,0,0,.28)'; cx.fillRect(0, GROUND, W, 4);
    // 足もとの影
    if (st) { const p = st.p, k = Math.max(.3, 1 - (GROUND - p.y) / 200); cx.fillStyle = `rgba(0,0,0,${.3 * k})`; cx.beginPath(); cx.ellipse(p.x + p.sz / 2, GROUND + 3, 26 * k, 6 * k, 0, 0, 6.3); cx.fill(); }

    if (st) {
      // ゲート
      if (st.gate) {
        const g = st.gate, t = performance.now() / 300;
        const gl = cx.createLinearGradient(g.x, 0, g.x + g.w, 0);
        gl.addColorStop(0, 'rgba(242,182,76,.0)'); gl.addColorStop(.5, `rgba(242,182,76,${.35 + Math.sin(t) * .1})`); gl.addColorStop(1, 'rgba(242,182,76,0)');
        cx.fillStyle = gl; cx.fillRect(g.x - 20, 20, g.w + 40, GROUND - 20);
        cx.strokeStyle = '#f2b64c'; cx.lineWidth = 6; cx.beginPath();
        cx.moveTo(g.x, GROUND); cx.lineTo(g.x, 60); cx.arc(g.x + g.w / 2, 60, g.w / 2, Math.PI, 0); cx.lineTo(g.x + g.w, GROUND); cx.stroke();
        cx.fillStyle = '#fff1d6'; cx.font = '800 26px "M PLUS Rounded 1c", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.fillText('？', g.x + g.w / 2, 70);
        cx.fillStyle = '#5a3d24'; cx.fillRect(g.x - 18, 84, g.w + 36, 24); cx.strokeStyle = '#f2b64c'; cx.lineWidth = 2; cx.strokeRect(g.x - 18, 84, g.w + 36, 24);
        cx.fillStyle = '#f2b64c'; cx.font = '800 12px "M PLUS Rounded 1c", sans-serif'; cx.fillText('なぜなぜゲート', g.x + g.w / 2, 101);
        for (let i = 0; i < 6; i++) { const a = t * 1.5 + i; cx.fillStyle = 'rgba(255,241,214,.8)'; cx.fillRect(g.x + g.w / 2 + Math.cos(a) * 30, 150 + Math.sin(a * 1.3) * 60, 3, 3); }
        if (SPR.shima.complete) cx.drawImage(SPR.shima, g.x + g.w + 6, GROUND - 92, 86, 92);
      }
      // 本の山
      for (const o of st.obs) {
        if (o.kind === 'cart') {
          cx.fillStyle = '#4a3423'; cx.fillRect(o.x, o.y + 10, o.w, o.h - 18);
          cx.fillStyle = '#2a1f16'; cx.beginPath(); cx.arc(o.x + 12, GROUND - 6, 6, 0, 6.3); cx.arc(o.x + o.w - 12, GROUND - 6, 6, 0, 6.3); cx.fill();
          o.books.slice(0, 5).forEach((b, i) => { cx.fillStyle = b.c; cx.fillRect(o.x + 6 + i * 12, o.y, 9, 14); });
        } else {
          o.books.forEach((b, i) => {
            const y = GROUND - (i + 1) * (o.h / o.books.length);
            cx.fillStyle = b.c; cx.fillRect(o.x + b.dx, y, o.w, o.h / o.books.length - 1);
            cx.fillStyle = 'rgba(255,240,215,.35)'; cx.fillRect(o.x + b.dx + o.w - 5, y + 2, 3, o.h / o.books.length - 5);
          });
        }
      }
      // 「？」カード
      for (const it of st.items) {
        const y = it.y + Math.sin(it.bob) * 4;
        cx.save(); cx.translate(it.x, y); cx.rotate(Math.sin(it.bob * .7) * .15);
        cx.fillStyle = '#fff1d6'; cx.strokeStyle = '#f2b64c'; cx.lineWidth = 3;
        cx.beginPath(); cx.roundRect ? cx.roundRect(-11, -14, 22, 28, 4) : cx.rect(-11, -14, 22, 28); cx.fill(); cx.stroke();
        cx.fillStyle = '#e0533f'; cx.font = '800 17px "M PLUS Rounded 1c", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('？', 0, 1);
        cx.restore();
      }
      // コトニちゃん
      const p = st.p;
      if (!(st.inv > 0 && Math.floor(st.inv * 12) % 2)) {
        const sq = p.squash > 0 ? 1 - p.squash : 1, bob = p.y >= GROUND ? Math.abs(Math.sin(st.t * 16)) * 3 : 0;
        cx.save(); cx.translate(p.x + p.sz / 2, p.y - bob);
        if (p.y < GROUND) cx.rotate(p.vy < 0 ? -0.12 : 0.08);
        cx.scale(1 / sq, sq);
        if (SPR.kotoni.complete) cx.drawImage(SPR.kotoni, -p.sz / 2 - 6, -p.sz - 6, p.sz + 12, p.sz + 12);
        cx.restore();
        if (st.shield) { cx.strokeStyle = `rgba(134,189,224,${.6 + Math.sin(st.t * 8) * .2})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(p.x + p.sz / 2, p.y - p.sz / 2, p.sz * .62, 0, 6.3); cx.stroke(); }
      }
      // 粒
      for (const q of st.parts) { cx.globalAlpha = Math.max(0, q.life / .6); cx.fillStyle = q.c; cx.fillRect(q.x, q.y, q.s, q.s); }
      cx.globalAlpha = 1;
      // 上の表示
      hud();
      // ぶつかったときの赤い光（rgba に 2e-17 のような小さい数を入れると色が無効になり、前の色でぬりつぶされるので globalAlpha で）
      if (st.flash > 0.01) { cx.globalAlpha = Math.min(1, st.flash); cx.fillStyle = '#e0533f'; cx.fillRect(0, 0, W, H); cx.globalAlpha = 1; }
    }
    cx.restore();
  }
  function hud() {
    if (wrap.classList.contains('full') && H > W * 1.25 && st.t < 5) {
      cx.textAlign = 'center'; cx.textBaseline = 'top'; cx.font = '700 14px "Zen Kaku Gothic New", sans-serif';
      cx.fillStyle = 'rgba(255,241,214,.85)'; cx.fillText('📱 横向きにすると、広く遊べます', W / 2, 84);
    }
    const f = '800 16px "M PLUS Rounded 1c", sans-serif';
    cx.font = f; cx.textBaseline = 'top'; cx.textAlign = 'left';
    cx.fillStyle = 'rgba(22,16,11,.65)'; cx.beginPath(); cx.roundRect ? cx.roundRect(10, 10, 210, 66, 12) : cx.rect(10, 10, 210, 66); cx.fill();
    cx.fillStyle = '#fff1d6'; cx.fillText(`${Math.floor(st.score + st.dist)} 点`, 22, 18);
    cx.fillStyle = '#e0533f'; cx.fillText('♥'.repeat(Math.max(0, st.lives)) + '♡'.repeat(Math.max(0, 3 - st.lives)), 130, 18);
    // カード 5枚
    for (let i = 0; i < 5; i++) { cx.fillStyle = i < st.cards ? '#f2b64c' : 'rgba(255,240,215,.2)'; cx.fillRect(22 + i * 22, 44, 16, 16); }
    cx.fillStyle = '#bfae95'; cx.font = '700 11px "Zen Kaku Gothic New", sans-serif'; cx.fillText('→ゲート', 134, 46);
    cx.fillStyle = CHN === 'jiji' ? '#86bde0' : '#f2b64c'; cx.font = '700 10px "Zen Kaku Gothic New", sans-serif'; cx.fillText(CHL[CHN], 134, 60);
    if (st.shield) { cx.fillStyle = '#86bde0'; cx.font = f; cx.fillText('🛡', 190, 40); }
    if (st.msg) {
      cx.globalAlpha = Math.min(1, st.msg.life * 2); cx.textAlign = 'center'; cx.font = '800 22px "M PLUS Rounded 1c", sans-serif';
      cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillText(st.msg.text, W / 2 + 2, 82); cx.fillStyle = st.msg.color; cx.fillText(st.msg.text, W / 2, 80);
      cx.globalAlpha = 1;
    }
  }

  /* ---------- ループ ---------- */
  function loop() {
    // 時間は performance.now() で測る（rAF の時刻はボタンを押した時刻より前のことがあり、最初の1コマがマイナスになるため）
    const now = performance.now(), dt = Math.max(0, Math.min(0.033, (now - last) / 1000 || 0)); last = now;
    if (st && st.mode === 'play') step(dt);
    else if (st && st.mode === 'gate') { st.gateT -= dt; if (st.gateT <= 0) ask(); }
    else if (st && st.mode === 'ready') {
      st.readyT -= dt;
      if (st.msg) { st.msg.life -= dt; if (st.msg.life <= 0) st.msg = null; }
      if (st.readyT <= 0.45 && st.msg && st.msg.text !== 'ドン！') { say('ドン！'); st.msg.life = 0.8; }
      if (st.readyT <= 0) { st.mode = 'play'; }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- クイズ（なぜなぜゲート） ---------- */
  // 出てすぐは押せないボタン（ジャンプの連打がそのまま当たらないように）
  // ゲームの枠がヘッダーのすぐ下に来るようにスクロール（instant：走りだすときは一瞬で戻す）
  function toGame(instant) {
    if (wrap.classList.contains('full')) return;
    const hdr = (document.getElementById('hdr') || {}).offsetHeight || 0;
    scrollTo({ top: Math.max(0, wrap.getBoundingClientRect().top + scrollY - hdr - 10), behavior: instant ? 'instant' : 'smooth' });
  }
  function waitBtns(els, ms, then) {
    els.forEach(b => { b.disabled = true; b.classList.add('wait'); });
    setTimeout(() => { els.forEach(b => { b.disabled = false; b.classList.remove('wait'); }); if (then) then(); }, ms);
  }
  function ask() {
    if (!qs.length) qs = shuffle(qAll.filter(x => x.channel === CHN));
    const q = qs.pop();
    if (!q) { st.score += 50; say('ボーナス +50'); st.mode = 'play'; last = performance.now(); return; }
    st.mode = 'quiz';
    showOv(`<div class="run-card fx-in">
      <p class="run-gate">なぜなぜゲート</p>
      <div class="talk"><img src="${face('kotoni', 4)}" alt="コトニちゃん"><p class="bubble">${esc(q.q)}</p></div>
      <p class="run-wait" id="runWait">問題を読んでから選んでね</p>
      <div class="choices">${q.choices.map((c, k) => `<button class="choice" data-k="${k}">${'ABC'[k]}　${esc(c)}</button>`).join('')}</div>
      <div id="runAns"></div></div>`, true);
    toGame();
    waitBtns([...ov.querySelectorAll('.choice')], 1200, () => { const w = document.getElementById('runWait'); if (w) w.textContent = 'どれだと思う？'; });
    ov.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.k, ok = k === q.answer;
      st.asked.push({ q, ok });
      ov.querySelectorAll('.choice').forEach(x => { x.disabled = true; const n = +x.dataset.k; if (n === q.answer) x.classList.add('right'); else if (n === k) x.classList.add('wrong'); });
      if (ok) { st.score += 100; st.shield = true; FX.burst(b); FX.float(b, '+100 バリア！', 'ok'); }
      else FX.shake(b);
      // 「走りだす」は選択肢のすぐ下（指を大きく動かさなくていいように）。解説はその下
      document.getElementById('runAns').innerHTML = `<div class="run-go-row"><button class="btn solid" id="runGo">走りだす <span class="arr">→</span></button><span class="run-ok ${ok ? 'ok' : 'ng'}">${ok ? '○ 正解！ バリア獲得' : '× おしい'}</span></div>
        <div class="talk shima"><img src="${face('shima', ok ? 2 : 6)}" alt="シマ先生"><p class="bubble">${ok ? '正解です。バリアをどうぞ。' : `おしい。正解は「${esc(q.choices[q.answer])}」です。`}${esc(q.explain)}</p></div>`;
      const go = document.getElementById('runGo');
      go.addEventListener('click', resume);
      waitBtns([go], 800, () => go.focus({ preventScroll: true }));
    }, { once: true }));
  }
  function resume() {
    hideOv();
    toGame(true);
    // いきなり走らせず「よーい……ドン！」をはさむ
    st.mode = 'ready'; st.readyT = 1.1; st.inv = 1.6; st.obs = st.obs.filter(o => o.x > st.p.x + 260); st.nextObs = 1.2;
    say('よーい……', '#fff1d6'); st.msg.life = 0.7;
    last = performance.now();
  }

  /* ---------- 始める・終わる ---------- */
  function start(c) {
    if (c === 'main' || c === 'jiji') { if (c !== CHN) qs = []; CHN = c; store.set('nz_run_ch', c); }
    fit(); reset();
    hideOv();
    last = performance.now();
    cv.focus({ preventScroll: true });
    // スマホは自動で全画面にする（クイズ・結果も全画面の中で出る）。✕ でいつでも戻れる
    if (TOUCH && !wrap.classList.contains('full')) goFull(false); else toGame();
  }
  function over() {
    st.mode = 'over';
    const s = Math.floor(st.score + st.dist), prev = best(), b = Math.max(s, prev);
    store.set('nz_run_best_' + CHN, b);
    const okN = st.asked.filter(a => a.ok).length;
    const [f, msg] = s >= 2500 ? [2, '走りながら答えるなんて。資料館の新記録かもしれません。']
      : s >= 1000 ? [1, 'いい走りです。ゲートのクイズで、バリアを取るのがコツです。']
      : [4, '本の山は、2回タップで高く飛べます。ゆっくりどうぞ。'];
    const rows = st.asked.map((a, i) => `<a class="q-vrow" href="https://www.youtube.com/watch?v=${encodeURIComponent(a.q.video)}" target="_blank" rel="noopener">
      <span class="qv-th"><img src="https://i.ytimg.com/vi/${encodeURIComponent(a.q.video)}/mqdefault.jpg" alt="" loading="lazy"><span class="w-mark ${a.ok ? 'ok' : 'ng'}">${a.ok ? '○' : '×'}</span></span>
      <span class="qv-txt"><small>ゲート${i + 1}</small><b>${esc(a.q.q)}</b><span class="qv-ans">正解：${esc(a.q.choices[a.q.answer])}</span>${TITLES[a.q.video] ? `<span class="qv-title">▶ ${esc(TITLES[a.q.video])}</span>` : ''}</span><span class="qv-go">見る ›</span></a>`).join('');
    setTimeout(() => {
      showOv(`<div class="run-card fx-in">
        <p class="q-result"><b id="runEndN">0</b>点　${s > prev && prev ? '<span class="best">自己ベスト！</span>' : ''}<small class="q-best">${CHL[CHN]}の最高：${b}点</small></p>
        <p class="run-stat">走った距離 ${Math.floor(st.dist)}m ・ 集めた「？」${st.total}枚 ・ ゲートのクイズ ${okN}/${st.asked.length}問正解</p>
        <div class="talk shima"><img src="${face('shima', f)}" alt="シマ先生"><p class="bubble">${msg}</p></div>
        ${rows ? `<h3 class="q-vh">ゲートで出た問題の解説動画</h3><div class="q-vlist">${rows}</div>` : ''}
        ${window.nzShareHTML ? window.nzShareHTML(`資料館ダッシュ（${CHL[CHN]}）で${s}点！ コトニちゃんと${Math.floor(st.dist)}m走りました #なぜなぜ資料館`, URL_) : ''}
        <div class="q-next" style="justify-content:flex-start"><button class="btn solid" id="runAgain">もう1回 <span class="arr">→</span></button><button class="btn" id="runOther">${CHL[CHN === 'main' ? 'jiji' : 'main']}で走る</button></div></div>`, true);
      FX.countUp(document.getElementById('runEndN'), s);
      if (s > prev && prev) FX.confetti(true);
      const again = document.getElementById('runAgain'), oth = document.getElementById('runOther');
      again.addEventListener('click', () => start(CHN));
      oth.addEventListener('click', () => start(CHN === 'main' ? 'jiji' : 'main'));
      waitBtns([again, oth], 1000);
    }, 700);
  }

  /* ---------- 準備 ---------- */
  fetch('data/quiz.json').then(r => r.json()).then(d => { qAll = (d.questions || []).filter(q => q.choices && q.choices.length === 3); }).catch(() => {});
  fetch('videos.json').then(r => r.json()).then(d => { for (const k of ['main', 'jiji', 'log']) (d[k] || []).forEach(v => { TITLES[v.id] = v.title; }); }).catch(() => {});
  fit();
  addEventListener('resize', fit);
  /* ---------- 全画面 ---------- */
  const fsBtn = document.getElementById('runFs');
  function setFull(on) {
    wrap.classList.toggle('full', on);
    document.documentElement.classList.toggle('run-lock', on);
    if (fsBtn) { fsBtn.textContent = on ? '✕' : '⛶'; fsBtn.setAttribute('aria-label', on ? '全画面をやめる' : '全画面で遊ぶ'); }
    fit();
  }
  async function goFull(lockLand) {
    setFull(true);
    try { if (wrap.requestFullscreen) await wrap.requestFullscreen({ navigationUI: 'hide' }); } catch (err) { /* iPhone はページの上に広げるだけ */ }
    if (lockLand) try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (err) { /* 横向き固定できない端末もある */ }
    setTimeout(fit, 300);
  }
  if (fsBtn) fsBtn.addEventListener('click', async e => {
    e.stopPropagation();
    const on = !wrap.classList.contains('full');
    if (on) {
      await goFull(true);
    } else {
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (err) {}
      setFull(false);
    }
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && wrap.classList.contains('full')) setFull(false); else setTimeout(fit, 100); });
  addEventListener('orientationchange', () => setTimeout(fit, 300));
  document.addEventListener('visibilitychange', () => { if (document.hidden && st && st.mode === 'play') { st.mode = 'pause'; showOv(`<div class="run-card"><p class="run-gate">ひと休み中</p><button class="btn solid" id="runRe">つづける <span class="arr">→</span></button></div>`, true); document.getElementById('runRe').addEventListener('click', resume); } });
  // はじめの画面：どちらのチャンネルで走るか
  ov.querySelectorAll('[data-run-ch]').forEach(b => b.addEventListener('click', () => start(b.dataset.runCh)));
  const bM = document.getElementById('runBestMain'), bJ = document.getElementById('runBestJiji');
  if (bM) bM.textContent = best('main'); if (bJ) bJ.textContent = best('jiji');
  raf = requestAnimationFrame(loop);
  // 確かめ用（_dbg2.html が run.html?debug=1 で使う。ふだんは何もしない）
  if (/[?&]debug=1/.test(location.search)) { window.__runDbg = () => st; window.__runStep = dt => { if (st.mode === 'play') step(dt); else if (st.mode === 'gate') { st.gateT -= dt; if (st.gateT <= 0) ask(); } else if (st.mode === 'ready') { st.readyT -= dt; if (st.readyT <= 0) st.mode = 'play'; } draw(); }; window.__runJump = jump; }
})();
