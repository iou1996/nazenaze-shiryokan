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
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
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

if changed:
    out["updated"] = datetime.now(JST).strftime("%Y-%m-%d %H:%M")
    with open("videos.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
