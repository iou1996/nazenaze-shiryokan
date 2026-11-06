/* なぜなぜ資料館 共通スクリプト。ページにある部品だけ動かす */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => n.toLocaleString('ja-JP');

  /* メニュー（スマホ）と、下へスクロールしたらヘッダーを隠す */
  const hdr = document.getElementById('hdr');
  const menuBtn = document.getElementById('menuBtn');
  menuBtn.addEventListener('click', () => {
    const open = hdr.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('#nav a').forEach(a => a.addEventListener('click', () => hdr.classList.remove('open')));
  let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    hdr.classList.toggle('hide', y > lastY && y > 400 && !hdr.classList.contains('open'));
    lastY = y;
  }, { passive: true });

  /* いまのページをメニューで光らせる */
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === page));

  /* ふわっと出す＋数字のカウントアップ＋メーター */
  const countUp = el => {
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), t0 = performance.now(), dur = 1400;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 3));
      el.textContent = v.toLocaleString('ja-JP', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    el.querySelectorAll('[data-count]').forEach(countUp);
    el.querySelectorAll('[data-w]').forEach(i => i.style.width = i.dataset.w + '%');
    io.unobserve(el);
  }), { threshold: 0.15 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  /* ポーズの帯：つなぎ目なく流すために中身を2周分にする */
  const track = document.getElementById('track');
  if (track) track.innerHTML += track.innerHTML;

  /* 表情の切りかえ */
  document.querySelectorAll('.char').forEach(card => {
    const key = card.dataset.char;
    const main = card.querySelector('.main-pic');
    const row = document.createElement('div');
    row.className = 'faces';
    card.dataset.faces.split(',').forEach((label, i) => {
      const b = document.createElement('button');
      b.className = 'face';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', i === 0);
      const img = document.createElement('img');
      img.src = `images/chars/${key}_face${i + 1}.png`;
      img.alt = '';
      b.append(img);
      b.addEventListener('click', () => {
        main.src = img.src;
        row.querySelectorAll('.face').forEach(x => x.setAttribute('aria-pressed', x === b));
        main.classList.add('pop');
        setTimeout(() => main.classList.remove('pop'), 250);
      });
      row.append(b);
    });
    card.querySelector('.txt').append(row);
  });

  /* 数字のカード：踏破記録ページならタブを切りかえ、ほかのページなら踏破記録ページへ */
  document.querySelectorAll('.stat[data-go]').forEach(c => c.addEventListener('click', () => {
    const t = document.querySelector(`#logTabs .tab[data-panel="${c.dataset.go}"]`);
    if (!t) { location.href = 'touha.html?tab=' + c.dataset.go; return; }
    t.click();
    document.getElementById('logTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  /* トップの数字をデータに合わせる */
  if (document.getElementById('nStad') && !document.getElementById('logTabs')) {
    fetch('data/touha_lists.json').then(r => r.json()).then(d => {
      for (const [id, n] of [['nStad', d.stadium.stadiums.length], ['nSki', d.ski.areas.length]]) { const el = document.getElementById(id); el.dataset.count = n; if (el.textContent !== '0') el.textContent = n; }
    }).catch(() => {});
  }

  if (document.getElementById('grid')) {
    /* 動画一覧（videos.json は GitHub Actions が毎日更新） */
    const MORE = {
      main: 'https://www.youtube.com/@hghg1996iou/videos',
      jiji: 'https://www.youtube.com/@nazenaze-chiiki/videos',
    };
    let DATA = null;
    const pill = document.getElementById('pill');
    const movePill = t => { pill.style.width = t.offsetWidth + 'px'; pill.style.transform = `translateX(${t.offsetLeft - 5}px)`; };

    function render(key) {
      const grid = document.getElementById('grid');
      grid.replaceChildren();
      const list = (DATA[key] || []).slice(0, +grid.dataset.limit || 100);
      if (!list.length) {
        const d = document.createElement('div');
        d.className = 'empty';
        d.textContent = 'まもなく公開します。';
        grid.append(d);
      }
      list.forEach((v, i) => {
        const a = document.createElement('a');
        a.className = 'video';
        a.style.animationDelay = (i * 0.05) + 's';
        a.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id);
        a.target = '_blank';
        a.rel = 'noopener';
        const th = document.createElement('div');
        th.className = 'th';
        const img = document.createElement('img');
        img.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg';
        img.alt = '';
        img.loading = 'lazy';
        const play = document.createElement('span');
        play.className = 'play';
        th.append(img, play);
        const p = document.createElement('p');
        p.textContent = v.title;
        a.append(th, p);
        grid.append(a);
      });
      document.getElementById('more').href = MORE[key];
    }

    const tabs = [...document.querySelectorAll('#tabs .tab')];
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', x === t));
      movePill(t);
      if (DATA) render(t.dataset.key);
    }));
    const placePill = () => movePill(tabs.find(t => t.getAttribute('aria-selected') === 'true'));
    addEventListener('resize', placePill);
    document.fonts.ready.then(placePill);
    placePill();

    fetch('videos.json')
      .then(r => r.json())
      .then(d => {
        DATA = d;
        render('main');
        if (d.updated) document.getElementById('updated').textContent = '一覧の自動更新：' + d.updated;
      })
      .catch(() => {
        const grid = document.getElementById('grid');
        grid.innerHTML = '<div class="empty">一覧を読みこめませんでした。</div>';
      });
  }

  if (document.getElementById('logTabs')) {
    /* ===== 踏破記録：タブ ===== */
    const logTabs = [...document.querySelectorAll('#logTabs .tab')];
    const logPill = document.querySelector('#logTabs .pill');
    const moveLogPill = t => { logPill.style.width = t.offsetWidth + 'px'; logPill.style.transform = `translateX(${t.offsetLeft - 5}px)`; };
    logTabs.forEach(t => t.addEventListener('click', () => {
      logTabs.forEach(x => { x.setAttribute('aria-selected', x === t); document.getElementById(x.dataset.panel).hidden = x !== t; });
      moveLogPill(t);
    }));
    const placeLogPill = () => moveLogPill(logTabs.find(t => t.getAttribute('aria-selected') === 'true'));
    addEventListener('resize', placeLogPill);
    document.fonts.ready.then(placeLogPill);
    placeLogPill();


    /* ===== 地図（地理院タイルの白地図に重ねる） ===== */
    const map = L.map('map', { preferCanvas: true, zoomSnap: 0.5, minZoom: 4.5, maxZoom: 14, maxBounds: [[18, 115], [50, 160]], scrollWheelZoom: false })
      .fitBounds([[30.5, 128.5], [45.6, 146.0]]);
    const JAPAN = [[30.5, 128.5], [45.6, 146.0]];
    const GSI = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png', { minZoom: 5, maxNativeZoom: 14, maxZoom: 14, attribution: GSI + '（白地図）' }).addTo(map);
    const Home = L.Control.extend({ options: { position: 'topleft' }, onAdd() {
      const b = L.DomUtil.create('a', 'leaflet-bar leaflet-control map-home');
      b.href = '#'; b.title = '日本全体を表示'; b.setAttribute('role', 'button'); b.textContent = '⌂';
      L.DomEvent.on(b, 'click', e => { L.DomEvent.preventDefault(e); map.fitBounds(JAPAN); });
      return b;
    } });
    new Home().addTo(map);
    let touched = false;
    ['mousedown', 'touchstart', 'wheel'].forEach(ev => document.getElementById('map').addEventListener(ev, () => touched = true, { passive: true }));
    new ResizeObserver(() => { map.invalidateSize(); if (!touched) map.fitBounds(JAPAN); }).observe(document.getElementById('map'));
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    const LAYERS = { muni: L.layerGroup().addTo(map), rail: L.layerGroup().addTo(map), stad: L.layerGroup().addTo(map), ski: L.layerGroup().addTo(map), air: L.layerGroup().addTo(map) };
    document.getElementById('layers').addEventListener('change', e => {
      const g = LAYERS[e.target.dataset.l];
      if (g) e.target.checked ? g.addTo(map) : map.removeLayer(g);
    });
    logTabs.forEach(t => t.addEventListener('click', () => { if (t.dataset.panel === 'pMap') setTimeout(() => { map.invalidateSize(); }, 0); }));
    const ll = ring => ring.map(([x, y]) => [y, x]);
    map.createPane('pts').style.zIndex = 650;            // 点はいつも線路より上
    const PTS = L.canvas({ pane: 'pts' });
    const tt = { sticky: true, className: 'tt', direction: 'top', offset: [0, -6] };

    // 市区町村
    fetch('data/touha_map.json').then(r => r.json()).then(d => {
      document.getElementById('cL').textContent = fmt(d.counts.landed);
      document.getElementById('cP').textContent = fmt(d.counts.passed);
      document.getElementById('cN').textContent = fmt(d.counts.none);
      const FILL = ['#ffffff', '#fbe7bf', '#f5b98a'], LABEL = ['まだ', '通過', '降り立った'];
      for (const [code, name, st, shape] of d.f) {
        if (st === 0) continue;                           // 「まだ」は白地図のまま見せる
        L.polygon(shape.map(poly => poly.map(ll)), { color: '#b9ad97', weight: 0.4, fillColor: FILL[st], fillOpacity: 0.75 })
          .bindTooltip(esc(name) + '　' + LABEL[st], tt).addTo(LAYERS.muni);
      }
    }).catch(() => {});

    // 鉄道：乗った区間＝赤、乗っていない線路＝灰（正は乗車記録のCSV）
    fetch('data/rail_map.json').then(r => r.json()).then(d => {
      const STYLE = [{ color: '#8d8d8d', weight: 1.3, opacity: 0.85, dashArray: '3 3' }, { color: '#b3261e', weight: 2, opacity: 0.95 }];
      const groups = new Map();
      for (const [op, st, pts] of d.s) {
        const k = op * 2 + st;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(ll(pts));
      }
      for (const st of [0, 1]) {
        for (const [k, lines] of groups) {
          if (k % 2 !== st) continue;
          L.polyline(lines, STYLE[st]).bindTooltip(esc(d.ops[Math.floor(k / 2)]) + (st ? '　乗った' : '　乗っていない'), tt).addTo(LAYERS.rail);
        }
      }
      if (d.ridden_km) document.getElementById('cR').textContent = fmt(Math.round(d.ridden_km)) + 'km';
      if (d.unridden_km != null) document.getElementById('cU').textContent = fmt(Math.round(d.unridden_km)) + 'km';
    }).catch(() => {});

    // 点（スタジアム・スキー場・空港）は一覧のデータと一緒に置く
    const dot = (lat, lon, color, html, tip, layer) => {
      if (lat == null || lon == null) return;
      L.circleMarker([lat, lon], { renderer: PTS, radius: 6.5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(tip, tt).bindPopup(html).addTo(layer);
    };

    /* 地域順：都道府県を北から南へ。見出しで区切る */
    const PREF47 = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
    const REGIONS = [['北海道', 0], ['東北', 1], ['関東', 7], ['中部', 14], ['近畿', 23], ['中国', 30], ['四国', 35], ['九州・沖縄', 39]];
    const prefIdx = p => {
      p = String(p || '').replace(/[（(].*$/, '').trim();
      const i = PREF47.findIndex(x => x === p || x.replace(/[都府県]$/, '') === p);
      return i < 0 ? 99 : i;
    };
    const regionOf = i => i >= 99 ? '海外' : REGIONS.filter(r => r[1] <= i).pop()[0];
    const byRegion = (list, getPref, card) => {
      const sorted = list.map((x, k) => [prefIdx(getPref(x)), k, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let cur = null, html = '';
      for (const [i, , x] of sorted) {
        const r = regionOf(i);
        if (r !== cur) { html += `<h4 class="region">${r}</h4>`; cur = r; }
        html += card(x);
      }
      return html;
    };

    /* ===== 鉄道路線・スタジアム ===== */
    fetch('data/touha_lists.json').then(r => r.json()).then(d => {
      // 鉄道：会社ごとにたたむ。検索したら当たった会社を開く
      // 鉄道：まだ乗っていない区間 → 会社の種類ごと（距離の長い順）→ 開くと路線ごと
      const cos = d.rail.companies;
      const unr = d.rail.unridden || [];
      if (unr.length) {
        const ukm = unr.reduce((a, u) => a + u[4], 0);
        document.getElementById('railUnr').innerHTML = `<h4>まだ乗っていない区間 <small>${unr.length}区間・${ukm.toFixed(1)}km</small></h4><ul>` +
          unr.map(u => `<li><b>${esc(u[0])}</b><span class="ln">${esc(u[1])}</span><span class="sec">${esc(u[2])} 〜 ${esc(u[3])}</span><span class="km">${u[4].toFixed(1)}km</span></li>`).join('') + '</ul>';
      }
      const BIG = ['東武鉄道', '西武鉄道', '京成電鉄', '京王電鉄', '小田急電鉄', '東急電鉄', '京浜急行電鉄', '東京地下鉄', '相模鉄道', '名古屋鉄道', '近畿日本鉄道', '南海電気鉄道', '京阪電気鉄道', '阪急電鉄', '阪神電気鉄道', '西日本鉄道'];
      const CABLE = /鋼索|ケーブル|ロープウェイ|トロリーバス|斜坑|天橋立/;
      const MONO = /モノレール|新交通|ゆりかもめ|シーサイド|ガイドウェイ|伊奈線|ポートアイランド|六甲アイランド|アストラム|東部丘陵|ユーカリ|スカイレール|ディズニー|日暮里・舎人|ニュートラム|臨海線/;
      const groupOf = c => {
        if (c.name.startsWith('JR')) return 'JR';
        if (c.lines.every(l => CABLE.test(l[0]))) return 'ケーブルカーなど';
        if (BIG.includes(c.name)) return '大手私鉄';
        if (c.lines.every(l => MONO.test(c.name + l[0]))) return 'モノレール・新交通';
        if (/交通局|交通部|大阪市高速電気軌道/.test(c.name)) return '地下鉄・公営交通';
        return 'その他の私鉄・第三セクター';
      };
      const GROUPS = ['JR', '大手私鉄', '地下鉄・公営交通', 'その他の私鉄・第三セクター', 'モノレール・新交通', 'ケーブルカーなど'];
      const railList = document.getElementById('railList'), railSum = document.getElementById('railSum');
      const drawRail = q => {
        q = q.trim();
        let nCo = 0, km = 0, html = '';
        for (const g of GROUPS) {
          const items = cos.filter(c => groupOf(c) === g).sort((a, b) => b.km - a.km).map(c => {
            const hit = q ? c.lines.filter(l => (c.name + l[0] + l[1] + l[2]).includes(q)) : c.lines;
            if (!hit.length) return '';
            nCo++; km += hit.reduce((a, l) => a + l[3], 0);
            const byLine = new Map();
            for (const l of hit) { if (!byLine.has(l[0])) byLine.set(l[0], []); byLine.get(l[0]).push(l); }
            return `<details class="co"${q ? ' open' : ''}><summary>${esc(c.name)}<small>${byLine.size}路線・${fmt(Math.round(c.km * 10) / 10)}km</small></summary><ul>` +
              [...byLine].map(([name, ls]) => `<li><div><b>${esc(name)}</b><em>${ls.map(l => esc(l[1]) + '〜' + esc(l[2])).join('、')}</em></div><span>${ls.reduce((a, l) => a + l[3], 0).toFixed(1)}km</span></li>`).join('') + '</ul></details>';
          }).join('');
          if (items) html += `<h4 class="region">${g}</h4>` + items;
        }
        railList.innerHTML = html || '<div class="empty">見つかりませんでした。</div>';
        railSum.textContent = `${fmt(nCo)}社・${fmt(Math.round(km))}km`;
      };
      document.getElementById('railQ').addEventListener('input', e => drawRail(e.target.value));
      drawRail('');

      // スタジアム：競技で絞れる。行った回数の多い順
      const st = d.stadium.stadiums.slice();   // 観戦箱の順（北から南）
      const KIND = { '⚽': 'サッカー', '⚾': '野球', '⛷': 'スキー', '🏐': 'バレー', '🏀': 'バスケ' };
      const kinds = ['すべて', ...['⚽', '⚾', '🏀', '🏐', '⛷'].filter(k => st.some(s => (s.kinds || []).includes(k)))];
      let kind = 'すべて';
      const chips = document.getElementById('stadKinds'), stadList = document.getElementById('stadList'), stadQ = document.getElementById('stadQ');
      const drawStad = () => {
        const q = stadQ.value.trim();
        const hit = st.filter(s => (kind === 'すべて' || (s.kinds || []).includes(kind)) && (s.name + (s.full || '') + (s.alias || '') + s.pref).includes(q));
        stadList.innerHTML = byRegion(hit, s => s.pref, s => `<div class="sd"><span class="ic" title="${esc(KIND[s.kind] || '')}">${s.kind || '🏟'}</span><div><b>${esc(s.full || s.name)}</b>${s.alias ? `<small class="aka">${esc(s.alias)}</small>` : ''}<small>${esc(s.pref || '')}</small></div></div>`)
          || '<div class="empty">見つかりませんでした。</div>';
      };
      chips.innerHTML = kinds.map(k => `<button aria-pressed="${k === kind}" data-k="${esc(k)}">${k === 'すべて' ? 'すべて' : k + ' ' + (KIND[k] || '')}　${k === 'すべて' ? st.length : st.filter(s => (s.kinds || []).includes(k)).length}</button>`).join('');
      chips.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        kind = b.dataset.k;
        chips.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
        drawStad();
      });
      stadQ.addEventListener('input', drawStad);
      drawStad();
      // スキー場：日数の多い順
      const ski = (d.ski ? d.ski.areas : []).slice();
      const skiList = document.getElementById('skiList'), skiQ = document.getElementById('skiQ');
      const skiDays = ski.reduce((a, s) => a + s.days, 0);
      document.getElementById('skiSum').textContent = `${ski.length}か所・のべ ${fmt(Math.round(skiDays * 10) / 10)}日・SAJ 1級`;
      const season = s => s === '00-14' ? '〜2014' : '20' + s.replace('-', '–');
      const drawSki = () => {
        const q = skiQ.value.trim();
        const hit = ski.filter(s => (s.name + (s.full || '') + (s.alias || '') + s.pref).includes(q));
        skiList.innerHTML = byRegion(hit, s => s.pref, s => `<div class="sd"><span class="ic">⛷</span><div><b>${esc(s.full || s.name)}</b><small>${esc(s.pref)}</small></div><span class="n">${s.days ? fmt(s.days) + '<small>日</small>' : '<small>〜2014</small>'}</span></div>`)
          || '<div class="empty">見つかりませんでした。</div>';
      };
      skiQ.addEventListener('input', drawSki);
      drawSki();
      if (d.updated) document.getElementById('logUpdated').textContent = '記録の更新：' + d.updated;

      // 空港（国内）
      const air = d.airport ? d.airport.airports : [];
      const dom = air.filter(a => a.area === '国内');
      document.getElementById('airSum').textContent = `国内 ${dom.length}か所（空港内に入っただけ ${dom.filter(a => a.mark !== '利用').length} を含む）`;
      document.getElementById('airList').innerHTML = byRegion(dom, a => a.region, a => `<div class="sd"><span class="ic">🛫</span><div><b>${esc(a.full || a.name)}</b><small>${esc(a.region)}${a.code ? '・' + esc(a.code) : ''}${a.mark !== '利用' ? '・空港内のみ' : ''}</small></div></div>`);

      // 海外：国ごとに空港とスタジアム
      const PREFS = '北海道青森県岩手県宮城県秋田県山形県福島県茨城県栃木県群馬県埼玉県千葉県東京都神奈川県新潟県富山県石川県福井県山梨県長野県岐阜県静岡県愛知県三重県滋賀県京都府大阪府兵庫県奈良県和歌山県鳥取県島根県岡山県広島県山口県徳島県香川県愛媛県高知県福岡県佐賀県長崎県熊本県大分県宮崎県鹿児島県沖縄県';
      const US = ['メリーランド', 'マサチューセッツ', 'ニューヨーク', 'カリフォルニア', 'イリノイ', 'ワシントン'];
      const abroadSt = st.filter(s => s.pref && !PREFS.includes(s.pref));
      const byC = new Map();
      const add = (c, item) => { c = c.trim(); if (!byC.has(c)) byC.set(c, []); byC.get(c).push(item); };
      air.filter(a => a.area !== '国内').forEach(a => add(a.region, `<li><span>空港</span>${esc(a.full || a.name)}${a.code ? '（' + esc(a.code) + '）' : ''}</li>`));
      abroadSt.forEach(s => add(US.includes(s.pref) ? 'アメリカ' : s.pref, `<li><span>${s.kind || '観戦'}</span>${esc(s.full || s.name)}（${esc(s.pref)}）</li>`));
      document.getElementById('abroadSum').textContent = `${byC.size}の国・地域`;
      document.getElementById('abroadList').innerHTML = [...byC].map(([c, items]) => `<div class="country"><h3>${esc(c)}</h3><ul>${items.join('')}</ul></div>`).join('');

      // 地図に点を置く
      st.filter(s => !abroadSt.includes(s)).forEach(s => dot(s.lat, s.lon, '#2e86de', `<b>${esc(s.full || s.name)}</b>${s.alias ? '<br>' + esc(s.alias) : ''}<br>${esc(s.pref || '')}`, esc(s.full || s.name), LAYERS.stad));
      ski.forEach(s => dot(s.lat, s.lon, '#16a085', `<b>${esc(s.full || s.name)}</b><br>${esc(s.pref)}　${s.days ? fmt(s.days) + '日' : '〜2014'}`, esc(s.full || s.name) + (s.days ? '　' + fmt(s.days) + '日' : ''), LAYERS.ski));
      dom.forEach(a => dot(a.lat, a.lon, '#8e44ad', `<b>${esc(a.full || a.name)}</b><br>${esc(a.region)}${a.code ? '　' + esc(a.code) : ''}${a.mark !== '利用' ? '<br>空港内に入っただけ' : ''}`, esc(a.full || a.name), LAYERS.air));

      // 上の数字もデータに合わせる
      for (const [id, n] of [['nStad', st.length], ['nSki', ski.length]]) { const el = document.getElementById(id); el.dataset.count = n; el.textContent = n; }
    }).catch(() => { document.getElementById('railList').textContent = '一覧を読みこめませんでした。'; });
    const want = new URLSearchParams(location.search).get('tab');
    if (want) { const t = logTabs.find(x => x.dataset.panel === want); if (t) setTimeout(() => { t.click(); document.getElementById('logTabs').scrollIntoView({ block: 'start' }); }, 300); }
  }
