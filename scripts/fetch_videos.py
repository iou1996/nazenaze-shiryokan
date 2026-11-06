import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

CHANNELS = {
    "main": "UCb-sXnEYoj5ct9PKkdgUwsw",
    "jiji": "UC1-Dmk1fy6RNq1Ilp8UdqOQ",
}
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "m": "http://search.yahoo.com/mrss/"}
JST = timezone(timedelta(hours=9))
API_KEY = os.environ.get("YT_API_KEY", "")


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def item(vid, published_iso, title):
    published = datetime.fromisoformat(published_iso.replace("Z", "+00:00")).astimezone(JST)
    return {
        "id": vid,
        "url": f"https://www.youtube.com/watch?v={vid}",
        "published": published.strftime("%Y-%m-%d"),
        "title": title,
    }


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def is_short(vid):
    """/shorts/ID が 200 ならショート（通常の動画は /watch へ 303 で飛ぶ）"""
    req = urllib.request.Request(f"https://www.youtube.com/shorts/{vid}", headers={"User-Agent": "Mozilla/5.0"})
    try:
        return urllib.request.build_opener(_NoRedirect).open(req, timeout=20).status == 200
    except urllib.error.HTTPError:
        return False


def from_rss(channel_id):
    """RSS は新しい15本だけ・ショートも混ざるので、ショートを除く"""
    root = ET.fromstring(get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"))
    videos = [
        item(e.findtext("yt:videoId", "", NS), e.findtext("a:published", "", NS), e.findtext("a:title", "", NS))
        for e in root.findall("a:entry", NS)
    ]
    return [v for v in videos if not is_short(v["id"])]


def from_api(channel_id):
    q = urllib.parse.urlencode({
        "part": "snippet",
        "playlistId": "UU" + channel_id[2:],
        "maxResults": 50,
        "key": API_KEY,
    })
    data = json.loads(get(f"https://www.googleapis.com/youtube/v3/playlistItems?{q}"))
    return [
        item(s["resourceId"]["videoId"], s["publishedAt"], s["title"])
        for s in (i["snippet"] for i in data.get("items", []))
    ]


def walk(o):
    if isinstance(o, dict):
        if "lockupViewModel" in o:
            yield o["lockupViewModel"]
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


def from_page(channel_id):
    req = urllib.request.Request(
        f"https://www.youtube.com/channel/{channel_id}/videos",
        headers={"Accept-Language": "ja", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    videos = []
    for l in walk(json.loads(m.group(1))):
        vid = l.get("contentId")
        title = l.get("metadata", {}).get("lockupMetadataViewModel", {}).get("title", {}).get("content")
        if vid and title:
            videos.append({"id": vid, "url": f"https://www.youtube.com/watch?v={vid}", "published": "", "title": title})
    if not videos:
        raise ValueError("動画が見つからない")
    return videos


def fetch(channel_id):
    # 「動画」タブ（通常の動画だけ・新しい順）を先に。取れなければ RSS（ショートは除く）
    sources = ([from_api] if API_KEY else []) + [from_page, from_rss]
    for f in sources:
        try:
            return [v for v in f(channel_id) if "【リメイク前】" not in v["title"]]
        except Exception as e:
            print(f"{f.__name__} failed: {e}", file=sys.stderr)
    return None


try:
    with open("videos.json", encoding="utf-8") as f:
        out = json.load(f)
except FileNotFoundError:
    out = {}

changed = False
for key, cid in CHANNELS.items():
    videos = fetch(cid)
    if videos is None:
        print(f"{key}: 取得できなかったので前の一覧のまま")
        continue
    if all(v["published"] for v in videos):
        videos.sort(key=lambda v: v["published"], reverse=True)
    out[key] = videos
    changed = True
    print(key, len(videos))

# 人気（直近30日の通常の動画を再生数順に4本）と、お知らせ（新しい通常の動画3本）。RSSは各チャンネル新しい15本まで
def rss_stats(channel_id):
    root = ET.fromstring(get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"))
    rows = []
    for e in root.findall("a:entry", NS):
        st = e.find("m:group/m:community/m:statistics", NS)
        v = item(e.findtext("yt:videoId", "", NS), e.findtext("a:published", "", NS), e.findtext("a:title", "", NS))
        v["views"] = int(st.get("views", 0)) if st is not None else 0
        rows.append(v)
    return rows


try:
    recent = []
    for key, cid in CHANNELS.items():
        for v in rss_stats(cid):
            if "【リメイク前】" in v["title"] or is_short(v["id"]):
                continue
            v["channel"] = key
            recent.append(v)
    limit = (datetime.now(JST) - timedelta(days=30)).strftime("%Y-%m-%d")
    pop = sorted((v for v in recent if v["published"] >= limit), key=lambda v: v["views"], reverse=True)[:4]
    out["popular"] = [{k: v[k] for k in ("id", "title", "channel")} for v in pop]
    news = sorted(recent, key=lambda v: v["published"], reverse=True)[:3]
    out["news"] = [{k: v[k] for k in ("id", "title", "channel", "published")} for v in news]
    changed = True
    print("popular", [v["title"][:20] for v in pop])
    print("news", [(v["published"], v["title"][:20]) for v in news])
except Exception as e:
    print(f"人気・お知らせは取れなかったので前のまま: {e}", file=sys.stderr)

# ニュース一覧用の記録（通常の動画を日付つきでためる。消えた動画も記録には残す）
def upload_date(vid):
    req = urllib.request.Request(f"https://www.youtube.com/watch?v={vid}", headers={"Accept-Language": "ja", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", "replace")
    m = re.search(r'"(?:uploadDate|publishDate)":"([^"]+)"', html)
    return item(vid, m.group(1), "")["published"] if m else ""


def is_public(vid):
    """oEmbed が 200 なら公開（非公開・削除は 401/403/404）"""
    try:
        with urllib.request.urlopen(f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json", timeout=20) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return e.code not in (401, 403, 404)
    except Exception:
        return True   # 通信の失敗では消さない


log = {v["id"]: v for v in out.get("log", [])}
listed = {v["id"] for key in CHANNELS for v in out.get(key, [])}
for vid in [i for i in log if i not in listed]:
    if not is_public(vid):
        print("非公開・削除なので記録から外す", vid, log[vid]["title"][:20])
        del log[vid]
for v in (recent if "recent" in dir() else []):
    log[v["id"]] = {"id": v["id"], "title": v["title"], "channel": v["channel"], "published": v["published"]}
for key in CHANNELS:
    for v in out.get(key, []):
        if v["id"] in log:
            log[v["id"]]["title"] = v["title"]
        else:
            try:
                d = upload_date(v["id"])
            except Exception as e:
                print(f"日付が取れない {v['id']}: {e}", file=sys.stderr)
                d = ""
            if d:
                log[v["id"]] = {"id": v["id"], "title": v["title"], "channel": key, "published": d}
        if not v.get("published") and v["id"] in log:
            v["published"] = log[v["id"]]["published"]
out["log"] = sorted(log.values(), key=lambda v: v["published"], reverse=True)
changed = True
print("log", len(out["log"]))

if changed:
    out["updated"] = datetime.now(JST).strftime("%Y-%m-%d %H:%M")
    with open("videos.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

# 検索エンジン向けに、news.html にニュース一覧を直接書きこむ
try:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
    import render_static
    render_static.main()
except Exception as e:
    print(f"news.html は書きかえられなかった: {e}", file=sys.stderr)
