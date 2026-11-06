/* エフェクト（ゲーム・サイト共通）：紙吹雪・はじける光・浮かぶ文字・ゆれ・数字のカウントアップ
   動きを減らす設定（prefers-reduced-motion）の人には、紙吹雪とゆれを出さない */
(() => {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#f2b64c', '#e0533f', '#7fb8e6', '#fff1d6', '#7fd3a3', '#f07b3f'];
  let cv, cx, parts = [], raf = 0;

  function canvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'fx-canvas';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    cx = cv.getContext('2d');
    const fit = () => { const r = devicePixelRatio || 1; cv.width = innerWidth * r; cv.height = innerHeight * r; cx.setTransform(r, 0, 0, r, 0, 0); };
    fit(); addEventListener('resize', fit);
  }
  function loop() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += p.g; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      cx.save();
      cx.globalAlpha = Math.min(1, p.life / 30);
      cx.translate(p.x, p.y); cx.rotate(p.rot);
      cx.fillStyle = p.c;
      if (p.shape === 'star') { star(p.s); } else if (p.shape === 'dot') { cx.beginPath(); cx.arc(0, 0, p.s / 2, 0, 6.3); cx.fill(); } else cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      cx.restore();
    }
    raf = parts.length ? requestAnimationFrame(loop) : (cx.clearRect(0, 0, innerWidth, innerHeight), 0);
  }
  function star(s) {
    cx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s / 4 : s / 2, a = i * Math.PI / 5 - Math.PI / 2; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    cx.closePath(); cx.fill();
  }
  function add(list) { canvas(); parts.push(...list); if (!raf) raf = requestAnimationFrame(loop); }
  const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  const FX = {
    /* 画面の上から紙吹雪（big=true でたくさん） */
    confetti(big) {
      if (calm) return;
      const n = big ? 160 : 70, w = innerWidth;
      add(Array.from({ length: n }, () => ({
        x: Math.random() * w, y: -20 - Math.random() * 120, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 3,
        g: 0.06, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, s: 8 + Math.random() * 7,
        c: COLORS[Math.random() * COLORS.length | 0], shape: Math.random() < .2 ? 'star' : 'rect', life: 170 + Math.random() * 60,
      })));
    },
    /* 要素からはじける光（正解・タップ） */
    burst(el, color) {
      if (!el || calm) return;
      const [x, y] = center(el);
      add(Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2 + Math.random() * .3, sp = 3 + Math.random() * 4;
        return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.12, rot: 0, vr: .2, s: 6 + Math.random() * 6,
          c: color || COLORS[i % 3], shape: i % 3 ? 'dot' : 'star', life: 40 + Math.random() * 20 };
      }));
    },
    /* 要素の上に「+1」などを浮かべる */
    float(el, text, cls) {
      if (!el) return;
      const [x, y] = center(el);
      const s = document.createElement('span');
      s.className = 'fx-float ' + (cls || '');
      s.textContent = text;
      s.style.left = x + 'px'; s.style.top = y + 'px';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 900);
    },
    /* まちがい：ゆらす＋スマホは軽くふるえる */
    shake(el) {
      if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) { /* なくてよい */ }
      if (!el || calm) return;
      el.classList.remove('fx-shake'); void el.offsetWidth; el.classList.add('fx-shake');
      setTimeout(() => el.classList.remove('fx-shake'), 500);
    },
    /* ぽんっと出す */
    pop(el) { if (!el || calm) return; el.classList.remove('fx-pop'); void el.offsetWidth; el.classList.add('fx-pop'); },
    /* 数字を0から数えあげる */
    countUp(el, to, ms) {
      if (!el) return;
      if (calm || !to) { el.textContent = to; return; }
      const t0 = performance.now(), d = ms || 700;
      const step = t => { const k = Math.min(1, (t - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    },
    /* 連続正解のバッジ */
    combo(n, el) {
      if (n < 2) return;
      FX.float(el || document.body, n + '連続！', 'combo');
    },
  };
  window.NZFX = FX;

  /* ===== サイト全体の小さなエフェクト ===== */
  // ボタンを押したときの波紋
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn, .choice, .gp-card, .g-card, .tl-card');
    if (!b || calm) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const w = document.createElement('span');
    w.className = 'fx-ripple';
    w.style.width = w.style.height = s + 'px';
    w.style.left = (e.clientX - r.left - s / 2) + 'px'; w.style.top = (e.clientY - r.top - s / 2) + 'px';
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(w);
    setTimeout(() => w.remove(), 600);
  }, { passive: true });

  // カードの上でマウスを動かすと光が追いかける（パソコンだけ）
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', e => {
      const c = e.target.closest('.latest-card, .pop-card, .video, .gp-card, .g-card, .channel, .stat');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // トップの見出しのまわりに「？」がふわふわ
  const hero = document.querySelector('.hero .intro');
  if (hero && !calm) {
    const box = document.createElement('div');
    box.className = 'fx-q';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = Array.from({ length: 9 }, (_, i) => `<span style="--i:${i};left:${(i * 37 + 7) % 100}%;animation-delay:${-i * 1.7}s;font-size:${14 + (i * 7) % 22}px">${i % 3 ? '？' : '!'}</span>`).join('');
    hero.prepend(box);
  }
})();
