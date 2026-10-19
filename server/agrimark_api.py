#!/usr/bin/env python3
"""
agrimark live API proxy for the Tamil Nadu agrimark portal.

This is the Oracle-server equivalent of the Cloudflare Worker: it runs
server-side (no browser CORS restriction), fetches agrimark.tn.gov.in, and
returns the data to the browser WITH CORS headers.

Endpoints (GET):
    /api/health              service info
    /api/agrimark.json       full payload (same shape as data/agrimark.json)
    /api/prices?crop=<id>    live prices for a single crop
    /api/debug?crop=<id>     raw upstream status/preview (diagnostics)

Configuration (environment variables):
    BASE_DATA        path to data/agrimark.json used for markets/history
                     [default: ../data/agrimark.json relative to this file]
    HOST             bind address [127.0.0.1]  (the tunnel connects locally)
    PORT             listen port [8080]
    CACHE_TTL        seconds the full payload is cached [600]
    CROP_CACHE_TTL   seconds a single crop is cached [300]
    MAX_CROPS        max crops per full build, 0 = all [0]
    CONCURRENCY      parallel upstream requests [8]
    ALLOWED_ORIGINS  comma-separated allow-list, or * [*]

stdlib only - no pip install needed. Run:  python3 agrimark_api.py
"""

import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = "https://www.agrimark.tn.gov.in"
REPORT_PATH = "/home/us_dist_report_api/"
IST = timezone(timedelta(hours=5, minutes=30))
HISTORY_DAYS = 30

HERE = os.path.dirname(os.path.abspath(__file__))
BASE_DATA = os.environ.get("BASE_DATA") or os.path.join(HERE, "..", "data", "agrimark.json")
PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "127.0.0.1")
CACHE_TTL = int(os.environ.get("CACHE_TTL", "600"))
CROP_CACHE_TTL = int(os.environ.get("CROP_CACHE_TTL", "300"))
MAX_CROPS = int(os.environ.get("MAX_CROPS", "0"))
CONCURRENCY = int(os.environ.get("CONCURRENCY", "8"))
ALLOWED = os.environ.get("ALLOWED_ORIGINS", "*")

REQ_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FarmerMarketPriceCompare/1.0)",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": BASE + "/",
}

_lock = threading.Lock()
_cache = {}


def num(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def post(path, data=None, retries=2):
    url = BASE + path
    body = urllib.parse.urlencode(data).encode() if data else b""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers=REQ_HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8", "replace").strip()
            if not raw or raw == "null":
                return None
            return json.loads(raw)
        except Exception:
            if attempt < retries:
                time.sleep(1.0)
    return None


def fetch_crop_report(crop_id, date_display):
    data = post(REPORT_PATH + date_display + "/" + crop_id)
    if not data:
        return None, None
    clean = {}
    modals = []
    for market, rec in data.items():
        modal = num((rec or {}).get("modal"))
        if modal is None:
            continue
        clean[market.strip()] = {
            "min": num(rec.get("min")),
            "max": num(rec.get("max")),
            "modal": modal,
            "qty": num(rec.get("qty")),
        }
        modals.append(modal)
    if not modals:
        return None, None
    return clean, round(sum(modals) / len(modals), 2)


def load_base():
    try:
        with open(BASE_DATA, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def merge_history(history, averages, today):
    out = {k: v for k, v in (history or {}).items()}
    for crop_id, value in averages.items():
        series = [e for e in out.get(crop_id, []) if e and e.get("date") != today]
        series.append({"date": today, "avg": value})
        series.sort(key=lambda e: e["date"])
        out[crop_id] = series[-HISTORY_DAYS:]
    return out


def build_full():
    base = load_base()
    if not base or not base.get("markets") or not base.get("crops"):
        return None

    crops = base["crops"]
    if MAX_CROPS > 0:
        crops = crops[:MAX_CROPS]

    now = datetime.now(IST)
    date = now.strftime("%Y-%m-%d")
    date_display = now.strftime("%d-%m-%Y")

    prices = {}
    averages = {}
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = [(str(c["id"]), pool.submit(fetch_crop_report, str(c["id"]), date_display)) for c in crops]
        for crop_id, fut in futures:
            clean, avg = fut.result()
            if clean:
                prices[crop_id] = clean
                averages[crop_id] = avg

    return {
        "source": base.get("source"),
        "sourceUrl": base.get("sourceUrl") or BASE + "/",
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "date": date,
        "dateDisplay": date_display,
        "unit": "Rs/kg",
        "live": True,
        "partial": MAX_CROPS > 0 and MAX_CROPS < len(base["crops"]),
        "districts": base.get("districts", {}),
        "crops": [{"id": str(c["id"]), "name": c["name"]} for c in base["crops"]],
        "markets": base["markets"],
        "prices": prices,
        "history": merge_history(base.get("history", {}), averages, date),
    }


def cache_get(key):
    with _lock:
        item = _cache.get(key)
        if item and item[0] > time.time():
            return item[1]
    return None


def cache_put(key, body, ttl):
    with _lock:
        _cache[key] = (time.time() + ttl, body)


def full_bytes():
    hit = cache_get("full")
    if hit is not None:
        return hit, "HIT"
    payload = build_full()
    if payload is None:
        return None, "NO_BASE"
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    cache_put("full", body, CACHE_TTL)
    return body, "MISS"


def crop_bytes(crop_id):
    date_display = datetime.now(IST).strftime("%d-%m-%Y")
    key = "crop:%s:%s" % (crop_id, date_display)
    hit = cache_get(key)
    if hit is not None:
        return hit, "HIT"
    clean, avg = fetch_crop_report(crop_id, date_display)
    payload = {
        "crop": str(crop_id),
        "date": datetime.now(IST).strftime("%Y-%m-%d"),
        "dateDisplay": date_display,
        "unit": "Rs/kg",
        "prices": clean or {},
        "average": avg,
    }
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    cache_put(key, body, CROP_CACHE_TTL)
    return body, "MISS"


def debug_probe(crop_id):
    date_display = datetime.now(IST).strftime("%d-%m-%Y")
    url = BASE + REPORT_PATH + date_display + "/" + crop_id
    out = {"url": url, "method": "POST"}
    try:
        req = urllib.request.Request(url, data=b"", headers=REQ_HEADERS, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", "replace")
            out.update({"status": resp.status, "bytes": len(raw), "preview": raw[:300]})
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:300]
        out.update({"status": exc.code, "error": str(exc), "preview": body})
    except Exception as exc:  # noqa: BLE001
        out.update({"error": str(exc)})
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "agrimark-api/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def cors_headers(self):
        origin = self.headers.get("Origin", "")
        if ALLOWED == "*":
            acao = "*"
        else:
            allow = [o.strip() for o in ALLOWED.split(",") if o.strip()]
            acao = origin if origin in allow else (allow[0] if allow else "null")
        return {
            "Access-Control-Allow-Origin": acao,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
            "Vary": "Origin",
        }

    def send_body(self, status, body, extra=None):
        self.send_response(status)
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": str(len(body)),
        }
        headers.update(self.cors_headers())
        if extra:
            headers.update(extra)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(body)
            except BrokenPipeError:
                pass

    def send_json(self, status, obj, extra=None):
        self.send_body(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), extra)

    def do_OPTIONS(self):
        self.send_body(204, b"")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if path in ("/", "/api/health"):
                self.send_json(200, {
                    "ok": True,
                    "service": "farmer-market-price-compare-agrimark-api",
                    "source": BASE + "/",
                    "endpoints": ["/api/agrimark.json", "/api/prices?crop=<id>", "/api/debug?crop=<id>"],
                })
                return
            if path == "/api/agrimark.json":
                body, state = full_bytes()
                if body is None:
                    self.send_json(503, {
                        "error": "base_data_missing",
                        "message": "Run scripts/scrape_agrimark.py first (BASE_DATA=%s)" % os.path.normpath(BASE_DATA),
                    })
                    return
                self.send_body(200, body, {"X-Cache": state, "Cache-Control": "public, max-age=300"})
                return
            if path == "/api/prices":
                crop = (query.get("crop") or [None])[0]
                if not crop:
                    self.send_json(400, {"error": "missing_crop"})
                    return
                body, state = crop_bytes(crop)
                self.send_body(200, body, {"X-Cache": state})
                return
            if path == "/api/debug":
                crop = (query.get("crop") or ["8"])[0]
                self.send_json(200, debug_probe(crop))
                return
            self.send_json(404, {"error": "not_found"})
        except Exception as exc:  # noqa: BLE001
            self.send_json(500, {"error": "server_error", "message": str(exc)})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("agrimark API listening on %s:%d" % (HOST, PORT), file=sys.stderr)
    print("base data: %s" % os.path.normpath(BASE_DATA), file=sys.stderr)
    print("origins: %s | max_crops: %d | ttl: %ds" % (ALLOWED, MAX_CROPS, CACHE_TTL), file=sys.stderr)
    server.serve_forever()


if __name__ == "__main__":
    main()
