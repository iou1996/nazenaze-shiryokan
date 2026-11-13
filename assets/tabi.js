/* なぜなぜ日本一周（tabi.html）
   サイコロで日本地図の上を進み、都道府県のスタンプを集めるすごろくRPG。
   地図の形は data/touha_map.json の市区町村の形を、都道府県ごとにまとめて描く（踏破の色は使わない）。
   セーブはこの端末のブラウザだけ（localStorage）。 */
(() => {
  const $ = id => document.getElementById(id);
  if (!$('tabiCanvas')) return;
  const SFX = n => { if (window.NZSFX) window.NZSFX.play(n); };
  const FX = window.NZFX || { confetti() {}, burst() {}, float() {}, shake() {}, pop() {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* なにもしない */ } },
  };
  const SAVE_KEY = 'nz_tabi_save';
  const PAGE_URL = (document.querySelector('link[rel=canonical]') || {}).href || location.href;
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const yen = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ja-JP') + '円';
  const FACE = { s: n => `images/chars/shima_face${n}.png`, k: n => `images/chars/kotoni_face${n}.png` };
  // 顔の番号：1 にこにこ / 2 きらきら（コトニは照れ） / 3 ひらめき / 4 はてな / 5 びっくり / 6 ため息（コトニはじと目）

  /* ------------------------------------------------------------ 都道府県（県庁所在地の位置） */
  // [名前, 県庁所在地, 経度, 緯度, 8地方]
  const P = [
    null,
    ['北海道', '札幌市', 141.35, 43.06, '北海道'], ['青森県', '青森市', 140.74, 40.82, '東北'], ['岩手県', '盛岡市', 141.15, 39.70, '東北'],
    ['宮城県', '仙台市', 140.87, 38.27, '東北'], ['秋田県', '秋田市', 140.10, 39.72, '東北'], ['山形県', '山形市', 140.36, 38.24, '東北'],
    ['福島県', '福島市', 140.47, 37.75, '東北'], ['茨城県', '水戸市', 140.45, 36.34, '関東'], ['栃木県', '宇都宮市', 139.88, 36.57, '関東'],
    ['群馬県', '前橋市', 139.06, 36.39, '関東'], ['埼玉県', 'さいたま市', 139.65, 35.86, '関東'], ['千葉県', '千葉市', 140.12, 35.61, '関東'],
    ['東京都', '新宿区', 139.69, 35.69, '関東'], ['神奈川県', '横浜市', 139.64, 35.45, '関東'], ['新潟県', '新潟市', 139.02, 37.90, '中部'],
    ['富山県', '富山市', 137.21, 36.70, '中部'], ['石川県', '金沢市', 136.63, 36.59, '中部'], ['福井県', '福井市', 136.22, 36.07, '中部'],
    ['山梨県', '甲府市', 138.57, 35.66, '中部'], ['長野県', '長野市', 138.18, 36.65, '中部'], ['岐阜県', '岐阜市', 136.72, 35.39, '中部'],
    ['静岡県', '静岡市', 138.38, 34.98, '中部'], ['愛知県', '名古屋市', 136.91, 35.18, '中部'], ['三重県', '津市', 136.51, 34.73, '近畿'],
    ['滋賀県', '大津市', 135.87, 35.00, '近畿'], ['京都府', '京都市', 135.76, 35.02, '近畿'], ['大阪府', '大阪市', 135.52, 34.69, '近畿'],
    ['兵庫県', '神戸市', 135.18, 34.69, '近畿'], ['奈良県', '奈良市', 135.83, 34.69, '近畿'], ['和歌山県', '和歌山市', 135.17, 34.23, '近畿'],
    ['鳥取県', '鳥取市', 134.24, 35.50, '中国'], ['島根県', '松江市', 133.05, 35.47, '中国'], ['岡山県', '岡山市', 133.93, 34.66, '中国'],
    ['広島県', '広島市', 132.46, 34.40, '中国'], ['山口県', '山口市', 131.47, 34.19, '中国'], ['徳島県', '徳島市', 134.56, 34.07, '四国'],
    ['香川県', '高松市', 134.04, 34.34, '四国'], ['愛媛県', '松山市', 132.77, 33.84, '四国'], ['高知県', '高知市', 133.53, 33.56, '四国'],
    ['福岡県', '福岡市', 130.42, 33.61, '九州'], ['佐賀県', '佐賀市', 130.30, 33.25, '九州'], ['長崎県', '長崎市', 129.87, 32.74, '九州'],
    ['熊本県', '熊本市', 130.74, 32.79, '九州'], ['大分県', '大分市', 131.61, 33.24, '九州'], ['宮崎県', '宮崎市', 131.42, 31.91, '九州'],
    ['鹿児島県', '鹿児島市', 130.56, 31.56, '九州'], ['沖縄県', '那覇市', 127.68, 26.21, '九州'],
  ];
  const AREAS8 = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州'];
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const MODES = {
    tohoku: { name: '北海道・東北めぐり', prefs: range(1, 7), start: 4 },
    kanto: { name: '関東めぐり', prefs: range(8, 14), start: 13 },
    chubu: { name: '中部めぐり', prefs: range(15, 23), start: 23 },
    kinki: { name: '近畿めぐり', prefs: range(24, 30), start: 27 },
    chushi: { name: '中国・四国めぐり', prefs: range(31, 39), start: 34 },
    kyushu: { name: '九州・沖縄めぐり', prefs: range(40, 47), start: 40 },
    all: { name: '日本一周', prefs: range(1, 47), start: 13 },
  };
  // となりどうし（s＝海をわたる道）
  const EDGES = [
    [1, 2, 's'], [2, 3], [2, 5], [3, 5], [3, 4], [4, 5], [4, 6], [4, 7], [5, 6], [6, 7], [6, 15], [7, 15], [7, 9], [7, 8],
    [8, 9], [8, 11], [8, 12], [9, 10], [9, 11], [10, 11], [10, 15], [10, 20], [11, 12], [11, 13], [11, 19], [11, 20], [12, 13],
    [13, 14], [13, 19], [14, 19], [14, 22], [15, 16], [15, 20], [16, 17], [16, 20], [16, 21], [17, 18], [17, 21], [18, 21],
    [18, 25], [18, 26], [19, 20], [19, 22], [20, 21], [20, 22], [20, 23], [21, 23], [21, 24], [21, 25], [22, 23], [23, 24],
    [24, 25], [24, 26], [24, 29], [24, 30], [25, 26], [26, 27], [26, 28], [26, 29], [27, 28], [27, 29], [27, 30], [28, 31],
    [28, 33], [28, 36, 's'], [29, 30], [31, 32], [31, 33], [32, 33], [32, 34], [32, 35], [33, 34], [33, 37, 's'], [34, 35],
    [34, 38, 's'], [35, 40, 's'], [36, 37], [36, 38], [36, 39], [37, 38], [38, 39], [40, 41], [40, 43], [40, 44], [41, 42],
    [42, 43, 's'], [43, 44], [43, 45], [43, 46], [44, 45], [45, 46], [46, 47, 's'],
  ];

  /* ------------------------------------------------------------ 仲間 */
  const MATES = {
    ekiben: { name: '駅弁屋のミナミさん', skill: '毎日の旅費が半分になる', face: '🍱' },
    shasho: { name: '車掌のタカハシさん', skill: 'サイコロを2回ふって、好きな目を選べる', face: '🚃' },
    chizu: { name: '地図好きのユウくん', skill: '出た目の1つ前・1つ先にも止まれる', face: '🗺️' },
    shashin: { name: '写真家のアキさん', skill: 'スタンプのたびに知識+2', face: '📷' },
    hoken: { name: '保健室のハル先生', skill: '戦いのあと元気+8', face: '🩹' },
  };

  /* ------------------------------------------------------------ 盤（マス）を作る */
  function mulberry(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const km = (a, b) => {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  // マスの種類：blue＝旅費が増える / red＝旅費が減る / ev＝できごと / mate＝出会い / moya＝モヤモヤ（戦い）
  const TYPES = [['blue', 38], ['red', 20], ['ev', 22], ['mate', 6], ['moya', 14]];
  function buildBoard(seed) {
    const rnd = mulberry(seed);
    const nodes = [];
    for (let i = 1; i <= 47; i++) nodes[i] = { id: i, pref: i, lon: P[i][2], lat: P[i][3], adj: [] };
    let next = 48;
    const segs = [];
    for (const [a, b, s] of EDGES) {
      const d = km([P[a][2], P[a][3]], [P[b][2], P[b][3]]);
      const n = Math.max(1, Math.min(4, Math.round(d / 75))) + (s ? 1 : 0);
      let prev = a;
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1);
        let r = rnd() * 100, type = 'blue';
        for (const [ty, w] of TYPES) { if (r < w) { type = ty; break; } r -= w; }
        const id = next++;
        nodes[id] = { id, pref: 0, lon: P[a][2] + (P[b][2] - P[a][2]) * t, lat: P[a][3] + (P[b][3] - P[a][3]) * t, adj: [], type, between: [a, b] };
        nodes[prev].adj.push(id); nodes[id].adj.push(prev);
        segs.push([prev, id, !!s]);
        prev = id;
      }
      nodes[prev].adj.push(b); nodes[b].adj.push(prev);
      segs.push([prev, b, !!s]);
    }
    return { nodes, segs };
  }

  // ちょうど n マス進んで止まれる所（同じマスは通らない。行き止まりでは、そこで止まる）
  function reach(nodes, from, n) {
    const out = new Map();
    const walk = (cur, path, left) => {
      if (left === 0) { if (!out.has(cur)) out.set(cur, path); return; }
      const nx = nodes[cur].adj.filter(x => !path.includes(x));
      if (!nx.length) { if (cur !== from && !out.has(cur)) out.set(cur, path); return; }
      for (const x of nx) walk(x, path.concat(x), left - 1);
    };
    walk(from, [from], n);
    return out;
  }

  /* ------------------------------------------------------------ 状態 */
  let S = null;          // セーブする中身
  let B = null;          // 盤
  let quizBank = [];
  const ui = { phase: 'title', targets: null, moving: null, busy: false };

  function newGame(mode) {
    const m = MODES[mode];
    S = { v: 1, mode, seed: rint(1, 1e9), pos: m.start, stamps: [], money: 20000, hp: 30, maxhp: 30, lv: 1, exp: 0,
      day: 1, mates: [], skip: 0, wins: 0, done: false };
    B = buildBoard(S.seed);
    stamp(m.start, true);
    save();
  }
  function load() {
    try { const s = JSON.parse(store.get(SAVE_KEY) || 'null'); if (s && s.v === 1 && MODES[s.mode] && !s.done) return s; } catch (e) { /* こわれたセーブは使わない */ }
    return null;
  }
  const save = () => { if (S) store.set(SAVE_KEY, JSON.stringify(S)); };
  const goal = () => MODES[S.mode].prefs;
  const left = () => goal().filter(p => !S.stamps.includes(p)).length;
  const has = m => S.mates.includes(m);
  const needExp = () => S.lv * 12;

  /* ------------------------------------------------------------ 画面（ステータス・会話・ボタン） */
  function status() {
    const g = goal();
    $('tbDay').textContent = S.day + '日め';
    $('tbMoney').textContent = yen(S.money);
    $('tbMoney').classList.toggle('neg', S.money < 0);
    $('tbHp').textContent = `${S.hp}/${S.maxhp}`;
    $('tbHpBar').style.width = Math.max(0, S.hp / S.maxhp * 100) + '%';
    $('tbLv').textContent = `Lv${S.lv}`;
    $('tbExpBar').style.width = Math.min(100, S.exp / needExp() * 100) + '%';
    $('tbStamp').textContent = `${g.filter(p => S.stamps.includes(p)).length}/${g.length}`;
    $('tbMates').innerHTML = S.mates.length ? S.mates.map(m => `<span title="${esc(MATES[m].name)}：${esc(MATES[m].skill)}">${MATES[m].face}</span>`).join('') : '<small>まだいない</small>';
    $('tbMode').textContent = MODES[S.mode].name;
  }
  function talk(lines) {
    $('tbTalk').innerHTML = lines.map(([w, f, t]) => `<div class="tb-say ${w}"><img src="${FACE[w](f)}" alt=""><p><b>${w === 's' ? 'シマ先生' : 'コトニ'}</b>${t}</p></div>`).join('');
  }
  function actions(html) { $('tbAct').innerHTML = html; }
  function logLine(t) {
    const el = $('tbLog');
    el.insertAdjacentHTML('afterbegin', `<p><span>${S.day}日め</span>${t}</p>`);
    while (el.children.length > 40) el.lastElementChild.remove();
  }
  const placeName = id => {
    const n = B.nodes[id];
    if (n.pref) return P[n.pref][0];
    return `${P[n.between[0]][0].replace(/[都府県]$/, '')}と${P[n.between[1]][0].replace(/[都府県]$/, '')}のあいだ`;
  };
  const TYPE_NAME = { blue: '青マス', red: '赤マス', ev: '？マス', mate: '出会いマス', moya: 'モヤモヤ' };

  /* ------------------------------------------------------------ 1日の流れ */
  function startTurn() {
    if (S.done) return;
    status();
    if (S.skip > 0) {
      S.skip--;
      ui.phase = 'rest';
      actions(`<button class="btn solid tb-big" id="tbNext">つぎの日へ</button>`);
      $('tbNext').onclick = endDay;
      return;
    }
    if (S.money < 0) {
      ui.phase = 'rest';
      talk([['k', 6, '先生、旅費がマイナス……'], ['s', 6, 'しかたありません。1日、駅前でアルバイトです。']]);
      actions(`<button class="btn solid tb-big" id="tbWork">アルバイトをする（旅費+8,000円・1日）</button>`);
      $('tbWork').onclick = () => { S.money += 8000; logLine('アルバイトで旅費+8,000円'); SFX('card'); endDay(); };
      return;
    }
    ui.phase = 'roll';
    actions(`<button class="btn solid tb-big" id="tbRoll">🎲 サイコロをふる</button>`);
    $('tbRoll').onclick = roll;
  }

  function roll() {
    ui.phase = 'rolling';
    SFX('tap');
    const twice = has('shasho');
    const a = rint(1, 6), b = twice ? rint(1, 6) : 0;
    let t = 0;
    actions(`<div class="tb-dice" id="tbDice">🎲</div>`);
    const iv = setInterval(() => {
      $('tbDice').textContent = rint(1, 6);
      if (++t > 9) {
        clearInterval(iv);
        if (twice) {
          actions(`<p class="tb-hint">車掌のタカハシさん「どっちの目にします？」</p>
            <div class="tb-row"><button class="btn solid tb-big" data-d="${a}">${a}</button><button class="btn solid tb-big" data-d="${b}">${b}</button></div>`);
          $('tbAct').querySelectorAll('[data-d]').forEach(x => { x.onclick = () => showTargets(+x.dataset.d); });
        } else showTargets(a);
      }
    }, 60);
  }

  function showTargets(n) {
    const ns = has('chizu') ? [n - 1, n, n + 1].filter(x => x >= 1) : [n];
    const map = new Map();
    for (const k of ns) for (const [id, path] of reach(B.nodes, S.pos, k)) if (!map.has(id)) map.set(id, path);
    ui.phase = 'choose';
    ui.targets = map;
    ui.dice = n;
    const items = [...map.keys()].sort((x, y) => {
      const gx = B.nodes[x].pref && goal().includes(B.nodes[x].pref) && !S.stamps.includes(B.nodes[x].pref) ? 0 : 1;
      const gy = B.nodes[y].pref && goal().includes(B.nodes[y].pref) && !S.stamps.includes(B.nodes[y].pref) ? 0 : 1;
      return gx - gy;
    });
    actions(`<p class="tb-hint"><b class="tb-dn">${n}</b>が出た！ 地図の光っているマスか、下から行き先を選んでね。</p>
      <div class="tb-dest">${items.map(id => {
        const nd = B.nodes[id];
        const lab = nd.pref ? `${esc(P[nd.pref][0])}${S.stamps.includes(nd.pref) ? '' : (goal().includes(nd.pref) ? ' <em>スタンプ</em>' : '')}` : `<i class="tb-dot ${nd.type}"></i>${TYPE_NAME[nd.type]}<small>${esc(placeName(id))}</small>`;
        return `<button type="button" data-go="${id}">${lab}</button>`;
      }).join('')}</div>`);
    $('tbAct').querySelectorAll('[data-go]').forEach(x => { x.onclick = () => go(+x.dataset.go); });
    // 行き先が見えるように、地図を引く
    fitTo([S.pos, ...map.keys()]);
    talk(n >= 5 ? [['k', 1, `${n}！ いっぱい進める！`]] : [['s', 1, `${n}ですね。どこへ行きましょう。`]]);
    draw();
  }

  function go(id) {
    if (ui.phase !== 'choose' || !ui.targets.has(id)) return;
    const path = ui.targets.get(id);
    ui.phase = 'moving';
    ui.targets = null;
    actions('<p class="tb-hint">いどう中……</p>');
    let i = 1;
    const step = () => {
      S.pos = path[i];
      const nd = B.nodes[S.pos];
      SFX('tap');
      if (nd.pref && i < path.length - 1 && !S.stamps.includes(nd.pref)) stamp(nd.pref, false, true);
      follow(true);
      draw();
      if (++i < path.length) setTimeout(step, 230);
      else setTimeout(() => land(S.pos), 260);
    };
    step();
  }

  function endDay() {
    const cost = has('ekiben') ? 500 : 1000;
    S.money -= cost;
    S.day++;
    if (left() === 0) return finish();
    save();
    startTurn();
  }

  /* ------------------------------------------------------------ 止まったマス */
  function land(id) {
    ui.phase = 'event';
    const nd = B.nodes[id];
    if (nd.pref) return landPref(nd.pref);
    const f = { blue: landBlue, red: landRed, ev: landEvent, mate: landMate, moya: () => battle() }[nd.type];
    f();
  }
  const okBtn = (label = 'OK') => { actions(`<button class="btn solid tb-big" id="tbOk">${label}</button>`); $('tbOk').onclick = endDay; };

  function landBlue() {
    const n = rint(2, 5) * 1000;
    S.money += n; SFX('card');
    logLine(`青マス：旅費+${yen(n)}`);
    talk([['k', 1, pick(['道の駅で、おつりのいい話を聞いた！', '泊まった宿が、思ったより安かった！', '地元のお祭りで、手伝いのお礼をもらった！'])], ['s', 1, `旅費が${yen(n)}ふえました。`]]);
    status(); okBtn();
  }
  function landRed() {
    const n = rint(1, 4) * 1000;
    S.money -= n; SFX('ng');
    logLine(`赤マス：旅費−${yen(n)}`);
    talk([['k', 6, pick(['おみやげ、買いすぎた……', 'タクシーに乗ったら、遠回りだった……', '雨で、かさを2本も買っちゃった……'])], ['s', 6, `旅費が${yen(n)}へりました。`]]);
    status(); okBtn();
  }

  const EVENTS = [
    { t: '駅のベンチで、ふたりでひと休み。', s: [['k', 1, '風が気持ちいいね。'], ['s', 1, '元気が10もどりました。']], f: () => { S.hp = Math.min(S.maxhp, S.hp + 10); } },
    { t: '古本屋で、地元の古い資料を見つけた。', s: [['s', 2, 'これは……！ 資料館に置きたい一冊です。'], ['k', 4, '先生、目がきらきらしてる。']], f: () => gainExp(4) },
    { t: '地元の人に道を聞いたら、近道を教えてもらった。', s: [['k', 3, 'もう1回、サイコロふっていいって！']], again: true },
    { t: 'ローカル線が、雪で止まってしまった。', s: [['k', 6, '動くまで、1日待ちだって。'], ['s', 4, 'こういう日は、駅の時刻表を読むのが楽しいんです。']], f: () => { S.skip = 1; } },
    { t: 'シマ先生が、駅の看板の字の話を始めて止まらない。', s: [['k', 6, '先生……もう夕方だよ。'], ['s', 3, '知識が3ふえました。日も1日すすみました。']], f: () => { gainExp(3); S.day++; } },
    { t: 'コトニが、しっぽで道案内の看板をたおしてしまった。', s: [['k', 5, 'わ、わざとじゃないよ！'], ['s', 1, '直すのを手伝って、旅費を少しもらいました。']], f: () => { S.money += 1500; } },
    { t: 'おいしそうな屋台に、つい並んでしまった。', s: [['k', 2, 'ぜんぶおいしかった……'], ['s', 1, '旅費−1,500円。元気は+15です。']], f: () => { S.money -= 1500; S.hp = Math.min(S.maxhp, S.hp + 15); } },
    { t: '道に迷って、山道を歩きつづけた。', s: [['k', 6, 'つかれた……'], ['s', 6, '元気が8へりました。']], f: () => { S.hp = Math.max(1, S.hp - 8); } },
  ];
  function landEvent() {
    const e = pick(EVENTS);
    if (e.f) e.f();
    logLine('？マス：' + e.t);
    talk([['s', 4, e.t], ...e.s]);
    SFX('combo');
    status();
    if (e.again) {
      actions(`<button class="btn solid tb-big" id="tbAgain">🎲 もう1回ふる</button>`);
      $('tbAgain').onclick = roll;
    } else okBtn();
  }
  function landMate() {
    const rest = Object.keys(MATES).filter(m => !has(m));
    if (!rest.length) {
      S.money += 3000;
      logLine('出会いマス：仲間のみんなから差し入れ（旅費+3,000円）');
      talk([['k', 1, 'みんなから差し入れが届いた！'], ['s', 1, '旅費+3,000円です。']]);
      status(); return okBtn();
    }
    const m = pick(rest);
    S.mates.push(m);
    SFX('ok'); FX.confetti && FX.confetti();
    logLine(`仲間：${MATES[m].name}が加わった`);
    talk([['k', 5, `${MATES[m].face} ${MATES[m].name}が、いっしょに来てくれるって！`], ['s', 1, `とくいなこと：${MATES[m].skill}。`]]);
    status(); okBtn('いっしょに行こう');
  }

  /* ------------------------------------------------------------ スタンプと県のクイズ */
  function stamp(p, quiet, passing) {
    if (S.stamps.includes(p)) return false;
    S.stamps.push(p);
    if (has('shashin')) gainExp(2, true);
    if (!quiet) {
      SFX('ok');
      logLine(`${passing ? '通りがけに' : ''}スタンプ：${P[p][0]}${goal().includes(p) ? '' : '（寄り道）'}`);
    }
    return true;
  }
  function prefQuiz(p) {
    const area = P[p][4];
    if (Math.random() < 0.6) {
      const near = shuffle(range(1, 47).filter(i => i !== p && P[i][4] === area));
      const far = shuffle(range(1, 47).filter(i => i !== p && P[i][4] !== area));
      const wrong = near.concat(far).slice(0, 2).map(i => P[i][1]);
      const q = p === 13 ? '東京都の都庁があるのは、どこ？' : `${P[p][0]}の県庁があるのは、どこ？`.replace('府の県庁', '府の府庁').replace('道の県庁', '道の道庁');
      const ch = p === 13 ? shuffle(['新宿区', '千代田区', '渋谷区']) : shuffle([P[p][1], ...wrong]);
      return { q, choices: ch, answer: ch.indexOf(P[p][1]), explain: `${P[p][0]}の${p === 1 ? '道庁' : p === 13 ? '都庁' : (p === 26 || p === 27) ? '府庁' : '県庁'}は${P[p][1]}にあります。` };
    }
    const wrong = shuffle(AREAS8.filter(a => a !== area)).slice(0, 2);
    const ch = shuffle([area, ...wrong]);
    return { q: `${P[p][0]}は、ふつう何地方にふくまれる？（8つに分けたとき）`, choices: ch.map(a => a + '地方'), answer: ch.indexOf(area), explain: `${P[p][0]}は${area}地方です。` };
  }
  function landPref(p) {
    const first = stamp(p, false);
    const inGoal = goal().includes(p);
    status(); draw();
    if (first) {
      FX.confetti && FX.confetti();
      talk([['k', 2, `${P[p][0]}のスタンプ、ゲット！${inGoal ? '' : '（寄り道だけど）'}`], ['s', 1, 'せっかくなので、1問どうぞ。']]);
    } else {
      talk([['k', 1, `${P[p][0]}、また来たね。`], ['s', 1, '2回めでも、1問どうぞ。']]);
    }
    quiz(prefQuiz(p), ok => {
      if (ok) { gainExp(first ? 3 : 1); S.money += first ? 2000 : 500; logLine(`${P[p][0]}のクイズに正解（旅費+${yen(first ? 2000 : 500)}）`); }
      status();
      if (left() === 0) return finish();
      okBtn();
    });
  }

  /* ------------------------------------------------------------ クイズ（共通） */
  function quiz(q, done) {
    actions(`<div class="tb-quiz"><p class="tb-q">${esc(q.q)}</p>
      <div class="tb-ch">${q.choices.map((c, i) => `<button type="button" data-c="${i}" disabled>${esc(c)}</button>`).join('')}</div><div id="tbQx"></div></div>`);
    const bs = [...$('tbAct').querySelectorAll('[data-c]')];
    setTimeout(() => bs.forEach(b => { b.disabled = false; }), 500);   // 連打の押しまちがいをふせぐ
    bs.forEach(b => {
      b.onclick = () => {
        const i = +b.dataset.c, ok = i === q.answer;
        bs.forEach((x, j) => { x.disabled = true; if (j === q.answer) x.classList.add('ok'); else if (j === i) x.classList.add('ng'); });
        SFX(ok ? 'ok' : 'ng');
        $('tbQx').innerHTML = `<p class="tb-ex"><b>${ok ? '正解！' : 'ざんねん'}</b>${esc(q.explain || '')}</p><button class="btn solid tb-big" id="tbQn">つぎへ</button>`;
        $('tbQn').onclick = () => done(ok);
      };
    });
  }
  function videoQuiz() {
    if (!quizBank.length) return null;
    const x = pick(quizBank);
    return { q: x.q, choices: x.choices, answer: x.answer, explain: x.explain };
  }

  /* ------------------------------------------------------------ 経験とレベル */
  function gainExp(n, quiet) {
    S.exp += n;
    while (S.exp >= needExp()) {
      S.exp -= needExp(); S.lv++; S.maxhp += 6; S.hp = S.maxhp;
      if (!quiet) logLine(`レベルアップ！ Lv${S.lv}（元気の上限+6）`);
      SFX('ok');
    }
  }

  /* ------------------------------------------------------------ モヤモヤとの戦い */
  const MOYA = ['ちびモヤ', 'モヤモヤ', 'もくもくモヤ', '大モヤモヤ', 'モヤモヤ大王'];
  function battle() {
    const tier = Math.min(5, 1 + Math.floor(S.stamps.length / 9) + (Math.random() < 0.25 ? 1 : 0));
    const E = { name: MOYA[tier - 1], tier, hp: 10 + tier * 9, maxhp: 10 + tier * 9, atk: 2 + tier * 2 };
    SFX('combo');
    logLine(`${E.name}があらわれた`);
    talk([['k', 5, `わっ、${E.name}！ なんだかわからない気持ちのかたまりだ！`], ['s', 1, '調べれば晴れます。いきましょう。']]);
    const box = () => `<div class="tb-bt">
        <div class="tb-moya t${E.tier}"><span class="eye"></span><span class="eye"></span></div>
        <div class="tb-bt-info"><b>${E.name}</b><div class="tb-bar red"><i style="width:${Math.max(0, E.hp / E.maxhp * 100)}%"></i></div></div>
      </div>`;
    const menu = msg => {
      status();
      actions(`${box()}${msg ? `<p class="tb-hint">${msg}</p>` : ''}
        <div class="tb-cmd">
          <button type="button" data-a="setsumei"><img src="${FACE.s(3)}" alt="">説明する<small>先生。かならず効く</small></button>
          <button type="button" data-a="hirameki"><img src="${FACE.k(3)}" alt="">ひらめく<small>コトニ。当たると大きい</small></button>
          <button type="button" data-a="quiz"><img src="${FACE.s(2)}" alt="">クイズで調べる<small>正解でいちばん効く</small></button>
          <button type="button" data-a="nige"><span class="tb-run">🏃</span>にげる<small>旅費−1,000円</small></button>
        </div>`);
      $('tbAct').querySelectorAll('[data-a]').forEach(b => { b.onclick = () => act(b.dataset.a); });
    };
    const hit = (dmg, msg) => {
      E.hp -= dmg;
      FX.shake && FX.shake($('tbAct'));
      if (E.hp <= 0) return win(msg);
      enemy(msg);
    };
    const enemy = msg => {
      const d = Math.max(1, E.atk + rint(-1, 2));
      S.hp -= d;
      if (S.hp <= 0) return lose();
      menu(`${msg}<br>${E.name}のモヤモヤ攻撃！ 元気−${d}`);
    };
    const act = a => {
      if (a === 'setsumei') { SFX('tap'); return hit(4 + S.lv * 2 + rint(0, 3), 'シマ先生の説明！'); }
      if (a === 'hirameki') {
        SFX('tap');
        if (Math.random() < 0.45) return hit(10 + S.lv * 3, 'コトニがひらめいた！ 大きく効いた！');
        return hit(1, 'コトニ「……あれ、ひらめかなかった」');
      }
      if (a === 'nige') {
        S.money -= 1000;
        if (Math.random() < 0.7) { logLine(`${E.name}からにげた（旅費−1,000円）`); talk([['k', 6, 'にげきれた……'], ['s', 6, '次は晴らしましょう。']]); status(); return okBtn(); }
        return enemy('にげられなかった！');
      }
      const q = videoQuiz() || prefQuiz(rint(1, 47));
      talk([['s', 2, '動画で話した「なぜ？」から1問です。']]);
      quiz(q, ok => { if (ok) { gainExp(2); hit(12 + S.lv * 3, '正解！ モヤモヤが晴れていく！'); } else enemy('まちがえた……'); });
    };
    const win = msg => {
      const ex = 4 + E.tier * 3, mo = E.tier * 1000;
      S.wins++; S.money += mo; gainExp(ex);
      if (has('hoken')) S.hp = Math.min(S.maxhp, S.hp + 8);
      SFX('ok'); FX.confetti && FX.confetti();
      logLine(`${E.name}を晴らした（知識+${ex}・旅費+${yen(mo)}）`);
      talk([['k', 1, `${msg} ${E.name}、晴れた！`], ['s', 2, `知識+${ex}、旅費+${yen(mo)}です。`]]);
      status(); okBtn();
    };
    const lose = () => {
      S.hp = S.maxhp; S.money -= 3000; S.skip = 1;
      SFX('ng');
      logLine(`${E.name}に負けて、宿で休んだ（旅費−3,000円・1日休み）`);
      talk([['k', 6, 'もう動けない……'], ['s', 6, '宿で1日休みましょう。元気はもどります。']]);
      status(); okBtn('宿で休む');
    };
    menu('');
  }

  /* ------------------------------------------------------------ おわり */
  function finish() {
    S.done = true;
    store.del(SAVE_KEY);
    const key = 'nz_tabi_best_' + S.mode, prev = +(store.get(key) || 0);
    const best = prev ? Math.min(prev, S.day) : S.day;
    store.set(key, best);
    SFX('fanfare'); FX.confetti && FX.confetti();
    status(); draw();
    const text = `なぜなぜ日本一周「${MODES[S.mode].name}」を${S.day}日でクリア！ Lv${S.lv}・仲間${S.mates.length}人・モヤモヤ${S.wins}体を晴らした`;
    talk([['k', 2, `${MODES[S.mode].name}、ぜんぶまわった！`], ['s', 2, `${S.day}日の旅でした。知らない町は、行くとなぜが増えますね。`]]);
    actions(`<div class="tb-end"><p class="tb-end-n"><b>${S.day}</b>日でクリア${prev && S.day < prev ? '　<span class="best">自己ベスト！</span>' : ''}</p>
      <p>Lv${S.lv}・仲間${S.mates.length}人・モヤモヤ${S.wins}体・この遊び方の最高 ${best}日</p>
      ${window.nzShareHTML ? window.nzShareHTML(text, PAGE_URL) : ''}
      <button class="btn solid tb-big" id="tbAgainAll">もういちど遊ぶ</button></div>`);
    $('tbAgainAll').onclick = title;
  }

  /* ------------------------------------------------------------ はじめの画面 */
  function title() {
    ui.phase = 'title';
    const sv = load();
    const best = m => { const n = +(store.get('nz_tabi_best_' + m) || 0); return n ? `<small>最高 ${n}日</small>` : ''; };
    $('tbOv').hidden = false;
    $('tbOv').innerHTML = `<div class="tb-card">
      <div class="tb-heroes"><img src="images/chars/shima_pose2.png" alt=""><img src="images/chars/kotoni_pose3.png" alt=""></div>
      <p class="tb-title">なぜなぜ日本一周 <span class="tb-soon">準備中</span></p>
      <p class="tb-how">サイコロで日本地図の上を進んで、都道府県のスタンプを集めよう。とちゅうで仲間に会ったり、モヤモヤと戦ったり。少ない日数でまわれたら上手。</p>
      ${sv ? `<button class="btn solid tb-big" id="tbCont">続きから（${esc(MODES[sv.mode].name)}・${sv.day}日め）</button>` : ''}
      <p class="tb-q2">${sv ? '新しく始める（いまの続きは消えます）' : 'どこをまわる？'}</p>
      <div class="tb-modes">${Object.entries(MODES).map(([k, m]) => `<button type="button" data-m="${k}" class="${k === 'all' ? 'all' : ''}">${m.name}<small>${m.prefs.length}都道府県${k === 'all' ? '・長め' : '・短め'}</small>${best(k)}</button>`).join('')}</div>
    </div>`;
    if (sv) $('tbCont').onclick = () => { S = sv; B = buildBoard(S.seed); begin(); };
    $('tbOv').querySelectorAll('[data-m]').forEach(b => {
      b.onclick = () => {
        if (sv && !confirm('いまの続きは消えます。新しく始めますか？')) return;
        newGame(b.dataset.m); begin(true);
      };
    });
  }
  function begin(fresh) {
    $('tbOv').hidden = true;
    $('tbLog').innerHTML = '';
    status();
    fitTo(goal().concat(S.pos), true);
    setTimeout(() => { follow(); }, fresh ? 900 : 300);
    if (fresh) {
      logLine(`${MODES[S.mode].name}のはじまり。${P[S.pos][0]}から出発`);
      talk([['k', 3, `${MODES[S.mode].name}、しゅっぱーつ！`], ['s', 1, `${P[S.pos][0]}から出発です。光っている県のスタンプを、ぜんぶ集めましょう。`]]);
    } else {
      talk([['k', 1, 'おかえり！ 続きからだね。'], ['s', 1, `いまは${placeName(S.pos)}です。`]]);
    }
    startTurn();
  }

  /* ------------------------------------------------------------ 地図を描く */
  const cv = $('tabiCanvas'), ctx = cv.getContext('2d');
  const W0 = { lon: 127, lat: 46 }, KY = 1.24;   // 経度1度＝100、緯度は1.24倍（だいたいの見た目をそろえる）
  const wx = lon => (lon - W0.lon) * 100, wy = lat => (W0.lat - lat) * 100 * KY;
  let PATHS = null;        // 都道府県ごとの Path2D（世界座標）
  const cam = { x: 1300, y: 1300, z: 0.3, tx: 1300, ty: 1300, tz: 0.3, follow: true };
  let vw = 300, vh = 300, dpr = 1;
  const img = src => { const i = new Image(); i.src = src; i.onload = () => draw(); return i; };
  const PIECE = { s: img('images/game/shima.png'), k: img('images/game/kotoni_run.png') };

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    vw = Math.max(240, r.width); vh = Math.max(240, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    draw();
  }
  function fitTo(ids, instant) {
    const pts = ids.map(id => (typeof id === 'number' && B.nodes[id]) ? B.nodes[id] : null).filter(Boolean);
    if (!pts.length) return;
    const xs = pts.map(n => wx(n.lon)), ys = pts.map(n => wy(n.lat));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const z = Math.min(1.6, (vw - 80) / Math.max(120, x1 - x0), (vh - 80) / Math.max(120, y1 - y0));
    cam.tx = (x0 + x1) / 2; cam.ty = (y0 + y1) / 2; cam.tz = z; cam.follow = false;
    if (instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
    kick();
  }
  function follow(keepZoom) {
    const n = B.nodes[S.pos];
    cam.follow = true;
    cam.tx = wx(n.lon); cam.ty = wy(n.lat);
    if (!keepZoom || cam.tz < 0.9) cam.tz = Math.max(cam.tz, 1.1);
    kick();
  }
  const toScreen = (x, y) => [(x - cam.x) * cam.z + vw / 2, (y - cam.y) * cam.z + vh / 2];
  const toWorld = (sx, sy) => [(sx - vw / 2) / cam.z + cam.x, (sy - vh / 2) / cam.z + cam.y];

  let raf = 0;
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick() {
    raf = 0;
    const k = 0.18;
    cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z += (cam.tz - cam.z) * k;
    const moving = Math.abs(cam.tx - cam.x) > 0.5 || Math.abs(cam.ty - cam.y) > 0.5 || Math.abs(cam.tz - cam.z) > 0.002;
    draw();
    if (moving || ui.phase === 'choose') kick();
  }

  const COL = {
    sea: '#dfe9ee', land: '#f4efe2', landLine: '#d8cfb8', goal: '#fffaf0', done: '#f2c2b0', other: '#e6e2d8',
    road: '#8a7a62', blue: '#2c6fb0', red: '#c0392b', ev: '#e0a800', mate: '#2e9d62', moya: '#6d5c8a',
  };
  function draw() {
    if (!S || !B) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = COL.sea; ctx.fillRect(0, 0, vw, vh); return; }
    const t = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COL.sea; ctx.fillRect(0, 0, vw, vh);
    const g = goal();
    // 陸
    if (PATHS) {
      ctx.save();
      ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (vw / 2 - cam.x * cam.z), dpr * (vh / 2 - cam.y * cam.z));
      ctx.lineWidth = 0.8 / cam.z;
      ctx.strokeStyle = COL.landLine;
      for (let p = 1; p <= 47; p++) {
        if (!PATHS[p]) continue;
        ctx.fillStyle = S.stamps.includes(p) ? COL.done : g.includes(p) ? COL.goal : COL.other;
        ctx.fill(PATHS[p]); ctx.stroke(PATHS[p]);
      }
      ctx.restore();
    }
    // 道
    ctx.lineCap = 'round';
    for (const [a, b, sea] of B.segs) {
      const A = B.nodes[a], Bn = B.nodes[b];
      const [x1, y1] = toScreen(wx(A.lon), wy(A.lat)), [x2, y2] = toScreen(wx(Bn.lon), wy(Bn.lat));
      if (Math.max(x1, x2) < -20 || Math.min(x1, x2) > vw + 20 || Math.max(y1, y2) < -20 || Math.min(y1, y2) > vh + 20) continue;
      ctx.strokeStyle = COL.road; ctx.lineWidth = 2.2;
      ctx.setLineDash(sea ? [5, 5] : []);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.setLineDash([]);
    // マス
    const r = Math.max(4, Math.min(9, 7 * Math.sqrt(cam.z)));
    for (let id = 48; id < B.nodes.length; id++) {
      const n = B.nodes[id];
      const [x, y] = toScreen(wx(n.lon), wy(n.lat));
      if (x < -20 || x > vw + 20 || y < -20 || y > vh + 20) continue;
      ctx.fillStyle = COL[n.type]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (n.type === 'ev' || n.type === 'moya' || n.type === 'mate') {
        if (r >= 6) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * 1.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.type === 'ev' ? '?' : n.type === 'mate' ? '★' : '!', x, y + 0.5); }
      }
    }
    // 都道府県の駅
    const pr = Math.max(6, Math.min(14, 11 * Math.sqrt(cam.z)));
    for (let p = 1; p <= 47; p++) {
      const n = B.nodes[p];
      const [x, y] = toScreen(wx(n.lon), wy(n.lat));
      if (x < -40 || x > vw + 40 || y < -40 || y > vh + 40) continue;
      const got = S.stamps.includes(p), want = g.includes(p) && !got;
      if (want) { ctx.fillStyle = 'rgba(184,56,42,.18)'; ctx.beginPath(); ctx.arc(x, y, pr + 5 + Math.sin(t / 300) * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = got ? '#b8382a' : '#fff'; ctx.strokeStyle = '#2a2017'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (got) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(pr * 1.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('済', x, y + 1); }
      if (cam.z > 0.55 || want) {
        ctx.font = `800 ${cam.z > 0.9 ? 13 : 11}px "Zen Kaku Gothic New", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(P[p][0], x, y + pr + 2);
        ctx.fillStyle = want ? '#b8382a' : '#2a2017'; ctx.fillText(P[p][0], x, y + pr + 2);
      }
    }
    // 行き先
    if (ui.phase === 'choose' && ui.targets) {
      for (const id of ui.targets.keys()) {
        const n = B.nodes[id];
        const [x, y] = toScreen(wx(n.lon), wy(n.lat));
        ctx.strokeStyle = '#f5b700'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(x, y, (n.pref ? pr : r) + 6 + Math.sin(t / 180) * 2.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 2人のコマ
    const me = B.nodes[S.pos];
    const [mx, my] = toScreen(wx(me.lon), wy(me.lat));
    const sz = 46;
    if (PIECE.s.complete && PIECE.s.naturalWidth) ctx.drawImage(PIECE.s, mx - sz * 0.95, my - sz - 4, sz, sz);
    if (PIECE.k.complete && PIECE.k.naturalWidth) ctx.drawImage(PIECE.k, mx - sz * 0.1, my - sz - 2, sz, sz);
  }

  /* 地図の形：touha_map.json の市区町村を都道府県ごとの Path2D にまとめる（遠い島は省く） */
  fetch('data/touha_map.json').then(r => r.json()).then(d => {
    const paths = [];
    for (const f of d.f || []) {
      const p = +String(f[0]).slice(0, 2);
      if (!(p >= 1 && p <= 47)) continue;
      const path = paths[p] || (paths[p] = new Path2D());
      for (const poly of f[3] || []) {
        const ring = poly[0];
        if (!ring || ring.length < 3) continue;
        const [lon0, lat0] = ring[0];
        if (lon0 < 122 || lat0 < 24) continue;
        if (p === 13 && lat0 < 33) continue;        // 小笠原などは描かない（地図が広がりすぎる）
        path.moveTo(wx(lon0), wy(lat0));
        for (let i = 1; i < ring.length; i++) path.lineTo(wx(ring[i][0]), wy(ring[i][1]));
        path.closePath();
      }
    }
    PATHS = paths;
    draw();
  }).catch(() => { $('tbMapErr').hidden = false; });
  fetch('data/quiz.json').then(r => r.json()).then(d => { quizBank = (d.questions || []).filter(q => q && q.q && Array.isArray(q.choices) && q.choices.length >= 2 && Number.isInteger(q.answer)); }).catch(() => {});

  /* ------------------------------------------------------------ 地図の操作（ドラッグ・ピンチ・ホイール・タップ） */
  const pts = new Map();
  let drag = null, moved = 0, pinch = null;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    moved = 0;
    if (pts.size === 1) drag = { x: e.offsetX, y: e.offsetY, cx: cam.tx, cy: cam.ty };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.tz }; drag = null; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      cam.tz = Math.max(0.15, Math.min(3, pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
      cam.z = cam.tz; cam.follow = false; moved = 99; kick(); return;
    }
    if (!drag) return;
    const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    moved = Math.max(moved, Math.hypot(dx, dy));
    if (moved > 6) {
      cam.tx = drag.cx - dx / cam.z; cam.ty = drag.cy - dy / cam.z;
      cam.x = cam.tx; cam.y = cam.ty; cam.follow = false; kick();
    }
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) {
      if (moved <= 6 && ui.phase === 'choose' && ui.targets) {
        let best = null, bd = 26;
        for (const id of ui.targets.keys()) {
          const n = B.nodes[id];
          const [x, y] = toScreen(wx(n.lon), wy(n.lat));
          const d = Math.hypot(x - e.offsetX, y - e.offsetY);
          if (d < bd) { bd = d; best = id; }
        }
        if (best !== null) go(best);
      }
      drag = null;
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [wx0, wy0] = toWorld(e.offsetX, e.offsetY);
    const z = Math.max(0.15, Math.min(3, cam.tz * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    cam.tx = wx0 - (e.offsetX - vw / 2) / z; cam.ty = wy0 - (e.offsetY - vh / 2) / z; cam.tz = z; cam.follow = false;
    kick();
  }, { passive: false });
  $('tbZin').onclick = () => { cam.tz = Math.min(3, cam.tz * 1.3); kick(); };
  $('tbZout').onclick = () => { cam.tz = Math.max(0.15, cam.tz / 1.3); kick(); };
  $('tbAllMap').onclick = () => { if (S) fitTo(goal().concat(S.pos)); };
  $('tbMe').onclick = () => { if (S) follow(); };
  $('tbMenu').onclick = () => { if (['moving', 'rolling', 'event', 'choose'].includes(ui.phase)) return; save(); title(); };

  window.addEventListener('resize', resize);
  resize();
  title();
})();
