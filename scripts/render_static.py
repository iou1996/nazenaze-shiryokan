"""検索エンジン向けに、ニュース一覧（動画の題名・日付・リンク）を news.html に直接書きこむ。
JavaScript が動くと同じ見た目の一覧に置きかわる。動画の構造化データ（VideoObject）も書く。
fetch_videos.py の最後に呼ぶ（毎朝の自動更新で news.html と sitemap.xml も更新される）。
"""
import html
import io
import json
import re
from datetime import date

BASE = "https://iou1996.github.io/nazenaze-shiryokan/"
CHL = {"main": "スポーツ編", "jiji": "時事・地域編", "notice": "お知らせ"}
WD = "月火水木金土日"


def rows():
    v = json.load(io.open("videos.json", encoding="utf-8"))
    try:
        nt = json.load(io.open("data/notices.json", encoding="utf-8")).get("notices", [])
    except FileNotFoundError:
        nt = []
    out = [{"kind": "notice", "date": n["date"], "text": n["text"], "url": n.get("url", "index.html")} for n in nt]
    out += [{"kind": x["channel"], "date": x["published"], "id": x["id"], "title": x["title"]}
            for x in v.get("log", v.get("news", [])) if x.get("published")]
    out.sort(key=lambda r: (r["date"], r["kind"] == "notice"), reverse=True)
    return out


def row_html(r):
    y, m, d = (int(s) for s in r["date"].split("-"))
    w = WD[date(y, m, d).weekday()]
    meta = (f'<span class="nl-meta"><time datetime="{r["date"]}">{y}.{m}.{d}（{w}）</time>'
            f'<span class="nl-tag {r["kind"]}">{CHL[r["kind"]]}</span></span>')
    if r["kind"] == "notice":
        return (f'<a class="nl-row notice" href="{html.escape(r["url"])}"><span class="nl-th"><img src="images/icon.png" alt=""></span>'
                f'<span class="nl-body">{meta}<span class="nl-t">{html.escape(r["text"])}</span></span><span class="nl-go">›</span></a>')
    i = r["id"]
    return (f'<a class="nl-row {r["kind"]}" href="https://www.youtube.com/watch?v={i}" target="_blank" rel="noopener">'
            f'<span class="nl-th"><img src="https://i.ytimg.com/vi/{i}/mqdefault.jpg" alt="" loading="lazy"><span class="nl-play"></span></span>'
            f'<span class="nl-body">{meta}<span class="nl-t">「{html.escape(r["title"])}」を解説しました</span></span><span class="nl-go">›</span></a>')


def list_html(rs):
    out, mon = [], ""
    for r in rs:
        y, m, _ = r["date"].split("-")
        if f"{y}-{m}" != mon:
            mon = f"{y}-{m}"
            out.append(f'<h2 class="nl-month">{int(y)}年{int(m)}月</h2>')
        out.append(row_html(r))
    return "\n".join(out)


def ld_json(rs):
    vids = [r for r in rs if r["kind"] != "notice"]
    items = [{
        "@type": "ListItem", "position": k + 1,
        "item": {
            "@type": "VideoObject",
            "name": r["title"],
            "description": f'{CHL[r["kind"]]}「{r["title"]}」。シマ先生とコトニちゃんの掛け合いで「なぜ？」を記録からたどる解説動画です。',
            "thumbnailUrl": f'https://i.ytimg.com/vi/{r["id"]}/hqdefault.jpg',
            "uploadDate": r["date"] + "T00:00:00+09:00",
            "url": f'https://www.youtube.com/watch?v={r["id"]}',
            "embedUrl": f'https://www.youtube.com/embed/{r["id"]}',
        },
    } for k, r in enumerate(vids)]
    data = {"@context": "https://schema.org", "@type": "ItemList", "name": "なぜなぜ資料館の解説動画", "itemListElement": items}
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def put(s, tag, body):
    pat = re.compile(rf"<!--S:{tag}-->.*?<!--E:{tag}-->", re.S)
    assert pat.search(s), tag
    return pat.sub(lambda _: f"<!--S:{tag}-->\n{body}\n<!--E:{tag}-->", s, count=1)


def main():
    rs = rows()
    s = io.open("news.html", encoding="utf-8").read()
    s = put(s, "news", list_html(rs))
    s = put(s, "ld", f'<script type="application/ld+json">{ld_json(rs)}</script>')
    io.open("news.html", "w", encoding="utf-8", newline="\n").write(s)
    # sitemap の lastmod（トップ・ニュース・動画は毎日かわる）
    today = date.today().isoformat()
    sm = io.open("sitemap.xml", encoding="utf-8").read()
    for page in ("", "news.html", "videos.html"):
        sm = re.sub(rf"(<loc>{re.escape(BASE + page)}</loc><lastmod>)[^<]*", rf"\g<1>{today}", sm)
    io.open("sitemap.xml", "w", encoding="utf-8", newline="\n").write(sm)
    print("news.html", len(rs), "件")


if __name__ == "__main__":
    main()
