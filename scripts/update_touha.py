# -*- coding: utf-8 -*-
"""踏破記録（市区町村）を paint-map の書き出しから1回で更新する。2026-11-24 作成。

使い方：
    python scripts/update_touha.py <paint-mapのexport.csv>          … 確かめるだけ（何も書かない）
    python scripts/update_touha.py <paint-mapのexport.csv> --write  … 書きこんで GitHub に送る
    CSV を省くと、ダウンロードのいちばん新しい export*.csv を使う。

やること（--write のとき）：
  0. 変わった自治体を 自治体データ/20261124訪問の更新ログ.csv に追記する（更新日・前・後）
  1. ドライブの元データ（個人/趣味/20260903自治体データ/元データ/20260903訪問記録_市区町村.csv）を差し替える。前の版は _旧/ へ
  2. 自治体データの _分析スクリプト.py を回す（訪問シート.xlsx と指標CSV）
  3. サイトの data/touha_map.json を作り直す
     - 地図の塗り：CSV の全コード（区は区ごと）。CSV に無いコードの形は外す（例：浜松の旧7区）
     - 形が無いコードは、国土数値情報 N03（最新年）の県のデータから取って足す（例：太地町）
     - 一覧と数（1,741）：市町村と東京23区は CSV の値。政令市は「別の表」（元データ/20261115訪問記録_政令市.csv）の値
  4. touha.html と index.html に直書きしてある数（訪問・割合・通過も入れると・説明文）を直す
  5. 版の番号（version.txt と ?v=）を上げる。ブラウザに新しい main.js を読ませるため
  6. git commit と push

決まり：
  - 正は paint-map。直すのは paint-map で、このスクリプトは写すだけ。
  - 政令市は1市で数える。区は地図と「政令市の区」の表だけ（数に入れない）。
  - 北方領土6村は数えない（地図にも出さない）。
"""
import csv, datetime, glob, io, json, math, os, re, shutil, subprocess, sys, urllib.request, zipfile

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace("\\", "/") + "/"
DATA = "G:/マイドライブ/AItask/個人/趣味/20260903自治体データ/"
SRC = DATA + "元データ/20260903訪問記録_市区町村.csv"
SEIREI = DATA + "元データ/20261115訪問記録_政令市.csv"
LOG = DATA + "20261124訪問の更新ログ.csv"
WORD = {2: "降り立った", 1: "通過", 0: "なし"}
CACHE = os.path.expanduser("~/.cache/touha_n03/")
HOPPO = {"01695", "01696", "01697", "01698", "01699", "01700"}
TOTAL = 1741
TOL = 0.004   # 形の間引き（度）。今の地図と同じ細かさ


# ---------------------------------------------------------------- 形の間引き
def _dp(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    best, idx = -1, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / L if L else math.hypot(p[0] - a[0], p[1] - a[1])
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [a, b]
    return _dp(pts[: idx + 1], tol)[:-1] + _dp(pts[idx:], tol)


def _area(r):
    return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2


def _ring(r):
    h = len(r) // 2
    s = _dp(r[: h + 1], TOL)[:-1] + _dp(r[h:], TOL)
    s = [[round(x, 3), round(y, 3)] for x, y in s]
    out = [p for i, p in enumerate(s) if i == 0 or p != s[i - 1]]
    return out if len(out) >= 4 else None


def n03_shape(code):
    """国土数値情報 N03 の最新年から、そのコードの形を取る（県ごとに1回だけ落とす）"""
    pref = code[:2]
    os.makedirs(CACHE, exist_ok=True)
    gj = None
    for year in range(datetime.date.today().year, 2022, -1):
        path = f"{CACHE}N03-{year}0101_{pref}.geojson"
        if os.path.exists(path):
            gj = path
            break
        url = f"https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-{year}/N03-{year}0101_{pref}_GML.zip"
        try:
            z = f"{CACHE}{pref}_{year}.zip"
            urllib.request.urlretrieve(url, z)
            with zipfile.ZipFile(z) as zf:
                name = next(n for n in zf.namelist() if n.endswith(".geojson"))
                open(path, "wb").write(zf.read(name))
            os.remove(z)
            gj = path
            print(f"   N03 {year}年の県{pref}を取得")
            break
        except Exception:
            continue
    if not gj:
        return None
    polys = []
    for f in json.load(open(gj, encoding="utf-8"))["features"]:
        if f["properties"].get("N03_007") != code:
            continue
        g = f["geometry"]
        for poly in ([g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]):
            if _area(poly[0]) < 2e-5:
                continue
            rings = [_ring(r) for r in poly]
            if rings[0]:
                polys.append([r for r in rings if r])
    return polys or None


# ---------------------------------------------------------------- 読み込み
def find_csv():
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        return sys.argv[1]
    c = sorted(glob.glob(os.path.expanduser("~/Downloads/export*.csv")), key=os.path.getmtime)
    if not c:
        sys.exit("CSV が見つかりません。paint-map から書き出したファイルを指定してください。")
    return c[-1]


def load_rows(path):
    rows = {}
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        rows[r["識別コード"]] = (r["名称"], int(r["値"]))
    if len(rows) < 1800:
        sys.exit(f"CSV の行が少なすぎます（{len(rows)}行）。paint-map の書き出しか確かめてください。")
    return rows


WARD = re.compile(r"^(.+?市)(.+区)$")


def split(code, name, prefs):
    """(都道府県, 一覧での名前, 政令市の区なら市の名前)。都道府県はコードの頭2けたで決める
    （paint-map の名前は「札幌市中央区」のように県が付かないことがある）"""
    pref = prefs[int(code[:2]) - 1]
    rest = name[len(pref):] if name.startswith(pref) else name
    m = WARD.match(rest)
    if m and not code.startswith("131"):
        return pref, None, m.group(1)
    # 郡名を外すのは町村だけ（蒲郡市・大和郡山市・小郡市の「郡」は外さない）
    return pref, re.sub(r"^.+?郡(?=.+[町村]$)", "", rest), None


def full_name(code, name, prefs):
    pref = prefs[int(code[:2]) - 1]
    return name if name.startswith(pref) else pref + name


# ---------------------------------------------------------------- 本体
def main():
    sys.stdout.reconfigure(encoding="utf-8")
    write = "--write" in sys.argv
    src = find_csv()
    rows = load_rows(src)
    seirei = {r["名称"]: int(r["値"]) for r in csv.DictReader(open(SEIREI, encoding="utf-8-sig"))}
    print("CSV:", src, len(rows), "行")

    m = json.load(open(SITE + "data/touha_map.json", encoding="utf-8"))
    prefs = m["list"]["prefs"]
    shapes = {x[0]: x[3] for x in m["f"]}
    oldval = {x[0]: x[2] for x in m["f"]}
    oldname = {x[0]: x[1] for x in m["f"]}

    # 地図
    f, added = [], []
    for code in sorted(rows):
        if code in HOPPO:
            continue
        name, v = rows[code]
        shp = shapes.get(code)
        if shp is None:
            shp = n03_shape(code)
            if shp is None:
                print("   ⚠ 形が見つからない", code, name)
                continue
            added.append(f"{code} {name}")
        f.append([code, oldname.get(code) or full_name(code, name, prefs), v, shp])
    removed = [c for c in shapes if c not in rows]
    changed = [f"{x[0]} {x[1]} {oldval.get(x[0])}→{x[2]}" for x in f if x[0] in oldval and oldval[x[0]] != x[2]]

    # 一覧（1,741）
    items, cities = [], []
    for code in sorted(rows):
        if code in HOPPO:
            continue
        name, v = rows[code]
        pref, short, city = split(code, name, prefs)
        if city:
            if city not in cities:
                cities.append(city)
                if city not in seirei:
                    sys.exit(f"政令市の表に {city} がありません: {SEIREI}")
                items.append([prefs.index(pref), city, seirei[city]])
            continue
        items.append([prefs.index(pref), short, v])
    if len(items) != TOTAL:
        sys.exit(f"一覧が {len(items)} 件です（{TOTAL} のはず）。CSV か政令市の表を確かめてください。")
    old_items = {(i[0], i[1]): i[2] for i in m["list"]["items"]}
    list_changed = [f"{prefs[i[0]]}{i[1]} {old_items.get((i[0], i[1]))}→{i[2]}" for i in items if old_items.get((i[0], i[1])) != i[2]]

    c = {"landed": sum(i[2] == 2 for i in items), "passed": sum(i[2] == 1 for i in items), "none": sum(i[2] == 0 for i in items)}
    print("\n地図の塗りが変わる:", len(changed));  [print("  ", s) for s in changed]
    print("一覧が変わる:", len(list_changed));      [print("  ", s) for s in list_changed]
    print("形を足す:", added or "なし")
    print("形を外す（CSVに無いコード）:", removed or "なし")
    print("数:", m["counts"], "→", c)
    if not write:
        print("\n確かめるだけで終えました。書きこむときは --write を付けてください。")
        return

    # 0. 更新ログ（本人「自治体はログとしてのこしてほしい更新日付」2026-11-24）
    #    前の元データと新しいCSVの差を、1自治体1行で追記する。消さない・書きかえない
    prev = load_rows(SRC)
    today = datetime.date.today().isoformat()
    logrows = [[today, code, name, WORD[prev[code][1]] if code in prev else "（なし）", WORD[v], ""]
               for code, (name, v) in sorted(rows.items()) if code not in prev or prev[code][1] != v]
    new_log = not os.path.exists(LOG)
    with open(LOG, "a", encoding="utf-8-sig" if new_log else "utf-8", newline="") as fp:
        w = csv.writer(fp)
        if new_log:
            w.writerow(["更新日", "識別コード", "名称", "前", "後", "備考"])
        w.writerows(logrows)
    print("更新ログに", len(logrows), "行追記:", LOG)

    # 1. 元データの差し替え
    if os.path.abspath(src) != os.path.abspath(SRC):
        stamp = datetime.datetime.fromtimestamp(os.path.getmtime(SRC)).strftime("%Y%m%d%H%M")
        os.makedirs(DATA + "元データ/_旧", exist_ok=True)
        shutil.copy2(SRC, f"{DATA}元データ/_旧/{stamp}訪問記録_市区町村.csv")
        shutil.copy2(src, SRC)
        print("元データを差し替え（前の版は _旧/ へ）")
    # 2. 訪問シート
    subprocess.run([sys.executable, "_分析スクリプト.py"], cwd=DATA, check=True)

    # 3. 地図データ
    m["f"], m["list"]["items"], m["counts"] = f, items, c
    m["updated"] = datetime.date.today().isoformat()
    json.dump(m, open(SITE + "data/touha_map.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    # 4. ページの数
    L, P = c["landed"], c["passed"]
    lp, pp, ap = round(L / TOTAL * 100, 1), round(P / TOTAL * 100, 1), round((L + P) / TOTAL * 100, 1)
    reps = [
        (r'(<div class="num"><span data-count=")\d+(">0</span><span class="of">/ 1,741</span></div>)', rf"\g<1>{L}\g<2>", 1),
        (r'(<div class="meter duo"><i data-w=")[\d.]+("></i><i class="pass" data-w=")[\d.]+(")', rf"\g<1>{lp}\g<2>{pp}\g<3>", 1),
        (r'(<div class="meter duo">.*?\n\s*<div class="lbl">全国の )[\d.]+(%</div>)', rf"\g<1>{lp}\g<2>", 1),
        (r'(通過も入れると</span><b><span data-count=")\d+(")', rf"\g<1>{L + P}\g<2>", 1),
        (r'(<em id="passPct">)[\d.]+(</em>)', rf"\g<1>{ap}\g<2>", 1),
    ]
    for page in ["touha.html", "index.html"]:
        s = io.open(SITE + page, encoding="utf-8", newline="").read()
        for pat, rep, n in reps:
            s, k = re.subn(pat, rep, s, flags=re.S)
            if k != n:
                sys.exit(f"{page} で数の場所が見つかりません（{pat[:40]}…）。ページの形が変わったので、このスクリプトを直してください。")
        s = re.sub(r"訪問した市区町村\d+", f"訪問した市区町村{L}", s)
        io.open(SITE + page, "w", encoding="utf-8", newline="").write(s)

    # 5. 版の番号
    old = open(SITE + "version.txt", encoding="utf-8").read().strip()
    new = datetime.datetime.now().strftime("%Y%m%d%H%M")
    for p in glob.glob(SITE + "*.html") + glob.glob(SITE + "v/*.html") + [SITE + "version.txt"]:
        s = io.open(p, encoding="utf-8", newline="").read()
        if old in s:
            io.open(p, "w", encoding="utf-8", newline="").write(s.replace(old, new))

    # 6. 送る
    msg = f"踏破記録を paint-map の書き出しで更新（訪問{L}・通過も入れると{L + P}）\n\n" + "\n".join(list_changed[:40])
    subprocess.run(["git", "add", "-A"], cwd=SITE, check=True)
    subprocess.run(["git", "commit", "-q", "-m", msg + "\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"], cwd=SITE, check=True)
    subprocess.run(["git", "push", "-q"], cwd=SITE, check=True)
    print(f"\n送りました。訪問 {L}（{lp}%）／通過も入れると {L + P}（{ap}%）。数分で公開ページに出ます。")


if __name__ == "__main__":
    main()
