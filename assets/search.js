/* サイト内検索（search.html）2026-11-08
   解説・用語・年表・クイズ・出典・動画を、ブラウザの中で一度に探す。サーバーは使わない（data/*.json と videos.json を読むだけ）
   ひらがな／カタカナ、全角／半角、大文字／小文字は区別しない。スペースで区切ると「全部ふくむ」 */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 1文字ずつそろえる（あとで元の文字の位置に戻せるように、文字数を変えない変換だけ）
  const n1 = c => {
    let x = c.normalize('NFKC').toLowerCase();
    if (x.length !== 1) x = x.length ? x[0] : c;
    const k = x.charCodeAt(0);
    if (k >= 0x30a1 && k <= 0x30f6) x = String.fromCharCode(k - 0x60);   // カタカナ → ひらがな
    return x;
  };
  const norm = s => Array.from(String(s), n1).join('');
  const CH = { main: 'スポーツ編', jiji: '時事・地域編' };
  const TYPES = [
    ['ep', '解説'], ['yg', '用語'], ['tl', '年表'], ['qz', 'クイズ'], ['src', '出典'], ['vd', '動画'],
  ];
  const TNAME = Object.fromEntries(TYPES);
  let IDX = [];

  async function load() {
    const get = u => fetch(u).then(r => r.json());
    const [E, Y, T, Q, V] = await Promise.all(['data/episodes.json', 'data/yougo.json', 'data/timeline.json', 'data/quiz.json', 'videos.json'].map(get));
    const page = {}, title = {};
    E.episodes.forEach(e => { page[e.id] = `v/${e.id}.html`; title[e.id] = e.title; });
    const add = (type, o) => IDX.push(Object.assign({ type }, o, { nt: norm(o.title + ' ' + (o.alt || '')), nb: norm(o.body || '') }));
    E.episodes.forEach(e => add('ep', {
      title: e.title, body: [e.lead, ...(e.points || []).map(p => p.h + '。' + p.t)].join(' '), url: page[e.id], ch: e.channel, meta: e.published,
    }));
    Y.terms.forEach(t => add('yg', { title: t.term, alt: t.yomi, body: t.def, url: 'yougo.html#w-' + t.yomi, meta: t.cat }));
    T.events.forEach(e => add('tl', {
      title: `${e.y}年${e.m ? e.m + '月' : ''}${e.d ? e.d + '日' : ''}`, body: e.text, url: page[e.video] || 'nenpyo.html', ch: e.channel,
      meta: title[e.video] ? '出てくる回：' + title[e.video] : '', bodyFirst: true,
    }));
    Q.questions.forEach(q => add('qz', { title: q.q, body: '', url: 'quiz.html?v=' + q.video, ch: q.channel, meta: title[q.video] ? 'この回のクイズ：' + title[q.video] : '' }));
    E.episodes.forEach(e => (e.sources || []).forEach(s => add('src', {
      title: s.title, alt: s.by, body: '', url: s.url, ext: true, ch: e.channel,
      meta: [s.by, s.year].filter(Boolean).join('・'), sub: { url: page[e.id], t: e.title },
    })));
    const seen = new Set();
    ['main', 'jiji'].forEach(ch => (V[ch] || []).forEach(v => {
      if (page[v.id] || seen.has(v.id)) return; seen.add(v.id);
      add('vd', { title: v.title, body: '', url: v.url, ext: true, ch, meta: v.published || '' });
    }));
  }

  function search(q) {
    const terms = norm(q).split(/[\s　]+/).filter(Boolean);
    if (!terms.length) return [];
    const out = [];
    for (const d of IDX) {
      let sc = 0, ok = true;
      for (const t of terms) {
        const it = d.nt.indexOf(t), ib = d.nb.indexOf(t);
        if (it < 0 && ib < 0) { ok = false; break; }
        sc += it >= 0 ? (it === 0 ? 14 : 10) : 2;
      }
      if (ok) out.push({ d, sc });
    }
    return out.sort((a, b) => b.sc - a.sc).map(x => x.d);
  }

  // 元の文字列のうち、検索語に当たるところを <mark> にする
  function mark(s, terms, around) {
    s = String(s);
    const chars = Array.from(s), ns = chars.map(n1).join('');
    const hit = new Array(chars.length).fill(false);
    let first = -1;
    terms.forEach(t => {
      let i = ns.indexOf(t);
      while (i >= 0) { for (let j = i; j < i + t.length; j++) hit[j] = true; if (first < 0 || i < first) first = i; i = ns.indexOf(t, i + 1); }
    });
    let a = 0, b = chars.length, pre = '', post = '';
    if (around && chars.length > around * 2) {
      const c = first < 0 ? 0 : first;
      a = Math.max(0, c - Math.floor(around / 2)); b = Math.min(chars.length, a + around * 2);
      if (a > 0) pre = '…'; if (b < chars.length) post = '…';
    }
    let h = '', on = false;
    for (let i = a; i < b; i++) {
      if (hit[i] && !on) { h += '<mark>'; on = true; }
      if (!hit[i] && on) { h += '</mark>'; on = false; }
      h += esc(chars[i]);
    }
    if (on) h += '</mark>';
    return pre + h + post;
  }

  let tab = 'all', LAST = [], LIMIT = {};
  function item(d, terms) {
    const tag = d.ch ? `<span class="tl-tag ${d.ch}">${CH[d.ch]}</span>` : '';
    const ext = d.ext ? ' target="_blank" rel="noopener"' : '';
    const t = mark(d.title, terms, d.type === 'qz' ? 60 : 0);
    const body = d.body ? `<p class="sr-b">${mark(d.body, terms, 46)}</p>` : '';
    const alt = d.type === 'yg' && d.alt ? `<small class="sr-yomi">${esc(d.alt)}</small>` : '';
    const meta = d.meta ? `<p class="sr-m">${d.type === 'src' ? mark(d.meta, terms) : esc(d.meta)}</p>` : '';
    const sub = d.sub && d.sub.url ? `<p class="sr-m"><a href="${d.sub.url}">この資料を使った回 ›</a></p>` : '';
    return `<li class="sr-it ${d.type}"><div class="sr-h"><span class="sr-type">${TNAME[d.type]}</span>${tag}</div><a class="sr-t" href="${esc(d.url)}"${ext}>${t}${alt}${d.ext ? '<span class="sr-ext" aria-label="外部のサイト">↗</span>' : ''}</a>${body}${meta}${sub}</li>`;
  }

  function draw() {
    const q = $('#srQ').value.trim();
    const terms = norm(q).split(/[\s　]+/).filter(Boolean);
    const res = $('#srRes'), tabs = $('#srTabs');
    if (!terms.length) { res.innerHTML = ''; tabs.hidden = true; $('#srN').textContent = ''; $('#srHint').hidden = false; return; }
    $('#srHint').hidden = true;
    const by = {}; TYPES.forEach(([k]) => by[k] = []);
    LAST.forEach(d => by[d.type].push(d));
    tabs.hidden = false;
    tabs.innerHTML = [['all', 'すべて', LAST.length], ...TYPES.map(([k, n]) => [k, n, by[k].length])]
      .map(([k, n, c]) => `<button type="button" role="tab" aria-selected="${tab === k}" data-t="${k}"${c ? '' : ' disabled'}>${n}<small>${c}</small></button>`).join('');
    $('#srN').textContent = LAST.length ? `${LAST.length}件` : '';
    if (!LAST.length) { res.innerHTML = `<p class="sr-none">「${esc(q)}」は見つかりませんでした。言葉を短くするか、ひらがなで試してください。</p>`; return; }
    if (tab === 'all') {
      res.innerHTML = TYPES.filter(([k]) => by[k].length).map(([k, n]) => {
        const list = by[k].slice(0, 4);
        const more = by[k].length > 4 ? `<button type="button" class="sr-more" data-t="${k}">${n}をもっと見る（あと${by[k].length - 4}件）</button>` : '';
        return `<div class="sr-g"><h2>${n}<small>${by[k].length}件</small></h2><ol class="sr-list">${list.map(d => item(d, terms)).join('')}</ol>${more}</div>`;
      }).join('');
    } else {
      const lim = LIMIT[tab] || 30, list = by[tab];
      res.innerHTML = `<ol class="sr-list">${list.slice(0, lim).map(d => item(d, terms)).join('')}</ol>` +
        (list.length > lim ? `<button type="button" class="sr-more" data-more="1">もっと見る（あと${list.length - lim}件）</button>` : '');
    }
  }

  let timer = 0;
  function run(push) {
    const q = $('#srQ').value.trim();
    LAST = search(q); LIMIT = {};
    if (tab !== 'all' && !LAST.some(d => d.type === tab)) tab = 'all';
    draw();
    const u = new URL(location.href);
    if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
    document.title = (q ? `「${q}」の検索結果｜` : 'サイト内検索｜') + 'シマ先生とコトニちゃんのなぜなぜ資料館';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inp = $('#srQ');
    const q0 = new URLSearchParams(location.search).get('q') || '';
    inp.value = q0;
    $('#srForm').addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); run(); inp.blur(); });
    inp.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 140); });
    $('#srTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; tab = b.dataset.t; draw(); });
    $('#srRes').addEventListener('click', e => {
      const b = e.target.closest('.sr-more'); if (!b) return;
      if (b.dataset.t) { tab = b.dataset.t; draw(); $('#srTabs').scrollIntoView({ block: 'nearest' }); }
      else { LIMIT[tab] = (LIMIT[tab] || 30) + 30; draw(); }
    });
    document.querySelectorAll('.sr-chip').forEach(c => c.addEventListener('click', () => { inp.value = c.textContent; run(); }));
    load().then(() => {
      $('#srN').textContent = '';
      inp.disabled = false; inp.placeholder = '言葉を入れてください（例：ドラフト、クマ、1988）';
      if (q0) run(); else inp.focus({ preventScroll: true });
    }).catch(() => { $('#srN').textContent = 'データを読みこめませんでした。ページを読みなおしてください。'; });
  });
})();
