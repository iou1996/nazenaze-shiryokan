/* ゲームの効果音（音のファイルは使わず、Web Audio でその場で作る）
   - はじめは音なし（本人 2026-11-07「デフォルトは無音で」）。[data-sfx-tog] のボタンで切りかえ、端末に覚える
   - 使い方：NZSFX.play('jump') など。音なしのときは何もしない */
(function () {
  const KEY = 'nz_sfx';
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
  let ac = null, master = null;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.22; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  // 1音：波形・周波数（始→終）・長さ・開始のずれ・音量
  function tone(type, f1, f2, dur, at = 0, vol = 1) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t);
    if (f2 && f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  // ざらっとした音（ぶつかる・バリア）
  function noise(dur, at = 0, vol = 0.6, freq = 900) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + at, n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const notes = (type, list, step, dur, vol) => list.forEach((f, i) => tone(type, f, f, dur, i * step, vol));

  const SOUNDS = {
    jump:   () => tone('square', 380, 720, 0.11, 0, 0.35),
    jump2:  () => tone('square', 560, 1100, 0.11, 0, 0.3),
    card:   () => { tone('sine', 1046, 1046, 0.09, 0, 0.6); tone('sine', 1568, 1568, 0.16, 0.06, 0.5); },
    hit:    () => { noise(0.22, 0, 0.7, 600); tone('sawtooth', 180, 60, 0.25, 0, 0.35); },
    shield: () => { tone('triangle', 1400, 700, 0.18, 0, 0.5); noise(0.12, 0, 0.3, 3000); },
    gate:   () => notes('square', [523, 659, 784, 1046], 0.08, 0.14, 0.3),
    ok:     () => notes('triangle', [784, 1175], 0.1, 0.22, 0.7),
    ng:     () => notes('sawtooth', [300, 220], 0.12, 0.22, 0.3),
    ready:  () => tone('square', 523, 523, 0.12, 0, 0.3),
    go:     () => tone('square', 1046, 1046, 0.3, 0, 0.35),
    over:   () => notes('triangle', [659, 523, 440, 330], 0.16, 0.3, 0.55),
    fanfare:() => { notes('square', [523, 659, 784], 0.1, 0.16, 0.28); tone('square', 1046, 1046, 0.5, 0.3, 0.3); },
    tap:    () => tone('square', 900, 1300, 0.06, 0, 0.3),
    miss:   () => tone('sawtooth', 200, 120, 0.16, 0, 0.3),
    tick:   () => tone('square', 1500, 1500, 0.03, 0, 0.2),
    combo:  () => notes('sine', [1175, 1568, 2093], 0.05, 0.12, 0.45),
  };

  function play(name) {
    if (!on || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) {}
  }

  function paint() {
    document.querySelectorAll('[data-sfx-tog]').forEach(b => {
      const icon = b.hasAttribute('data-icon-only');
      b.textContent = icon ? (on ? '🔊' : '🔇') : (on ? '🔊 音あり' : '🔇 音なし');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? '効果音を消す' : '効果音を出す');
      b.classList.toggle('on', on);
    });
  }
  function toggle() {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    paint();
    if (on) { ctx(); play('ok'); }   // 押したその場で鳴らして、音が出ることを知らせる（スマホは操作の中でないと音を出せない）
  }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-sfx-tog]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    toggle();
  }, true);
  // ボタンでの操作のときも、ゲーム側のキー操作に横取りされないように
  document.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('[data-sfx-tog]')) e.stopPropagation();
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();

  window.NZSFX = { play, get on() { return on; }, toggle };
})();
