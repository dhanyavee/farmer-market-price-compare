#!/usr/bin/env python3
"""
Scrape current Uzhavar Sandhai (farmer market) prices for Tamil Nadu from the
Department of Agricultural Marketing & Agri Business portal (agrimark.tn.gov.in)
and write a single JSON file the web app can read.

The portal exposes two JSON endpoints used by the site itself:
  POST /home/getUSList                 data: district=<dist_id>
       -> [{master_us_id, dist_id, us_name, tamil_us_name, us_code}, ...]
  POST /home/us_dist_report_api/<dd-mm-yyyy>/<crop_id>
       -> {"<market name>": {"qty","min","max","modal"}, ...}   (prices per kg)

Run:  python3 scripts/scrape_agrimark.py
Output: data/agrimark.json
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

BASE = "https://www.agrimark.tn.gov.in"
IST = timezone(timedelta(hours=5, minutes=30))
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "agrimark.json")
HISTORY_DAYS = 30

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FarmerMarketPriceCompare/1.0)",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": BASE + "/",
}

DISTRICTS = {
    "30": ("Ariyalur", 11.14, 79.08),
    "35": ("Chengalpattu", 12.69, 79.98),
    "32": ("Chennai", 13.08, 80.27),
    "11": ("Coimbatore", 11.02, 76.96),
    "4": ("Cuddalore", 11.75, 79.75),
    "12": ("Dharmapuri", 12.13, 78.16),
    "22": ("Dindigul", 10.37, 77.98),
    "10": ("Erode", 11.34, 77.72),
    "38": ("Kallakurichi", 11.74, 78.96),
    "2": ("Kancheepuram", 12.83, 79.70),
    "29": ("Kanniyakumari", 8.18, 77.43),
    "15": ("Karur", 10.96, 78.08),
    "13": ("Krishnagiri", 12.52, 78.21),
    "21": ("Madurai", 9.93, 78.12),
    "39": ("Mayiladuthurai", 11.10, 79.65),
    "19": ("Nagapattinam", 10.77, 79.84),
    "8": ("Namakkal", 11.22, 78.17),
    "16": ("Perambalur", 11.23, 78.88),
    "20": ("Pudukkottai", 10.38, 78.82),
    "25": ("Ramanathapuram", 9.36, 78.83),
    "36": ("Ranipet", 12.92, 79.33),
    "9": ("Salem", 11.66, 78.15),
    "24": ("Sivagangai", 9.85, 78.48),
    "34": ("Tenkasi", 8.96, 77.31),
    "17": ("Thanjavur", 10.79, 79.14),
    "23": ("Theni", 10.01, 77.48),
    "31": ("TheNilgiris", 11.41, 76.70),
    "7": ("Thiruvannamalai", 12.23, 79.07),
    "28": ("Thoothukudi", 8.76, 78.13),
    "14": ("Tiruchirapalli", 10.79, 78.70),
    "27": ("Tirunelveli", 8.71, 77.76),
    "37": ("Tirupattur", 12.50, 78.57),
    "33": ("Tiruppur", 11.11, 77.34),
    "3": ("Tiruvallur", 13.14, 79.91),
    "18": ("Tiruvarur", 10.77, 79.64),
    "6": ("Vellore", 12.92, 79.13),
    "5": ("Villupuram", 11.94, 79.49),
    "26": ("Virudhunagar", 9.59, 77.96),
}

CROPS = [
    (8, "Tomato"), (9, "Potato"), (10, "Small Onion"), (11, "Big Onion"),
    (12, "Green Chilli"), (13, "Brinjal"), (14, "Lady's Finger"), (15, "Drumstick"),
    (17, "Bottle Gourd"), (18, "Snake Gourd"), (19, "Bitter Gourd"), (20, "Coconut"),
    (21, "Radish"), (22, "Beans"), (23, "Avarai"), (24, "Carrot"),
    (26, "Mango"), (27, "Banana"), (34, "Sapota"), (35, "Guava"),
    (36, "Custard Apple"), (37, "Papaya"), (38, "Cluster Beans"), (39, "Ash Gourd"),
    (42, "Tapioca"), (44, "Amla"), (49, "Greens"), (50, "Coriander Leaf"),
    (51, "Curry Leaf"), (52, "Mint Leaf"), (53, "Pumpkin"), (55, "Lemon"),
    (56, "Beetroot"), (57, "Chow Chow"), (58, "Cabbage"), (59, "Garlic"),
    (60, "Cowpea"), (62, "Colacasia"), (63, "Sweet Potato"), (65, "Cucumber"),
    (66, "Cauliflower"), (67, "Groundnut"), (72, "Peas"), (74, "Capsicum"),
    (83, "Jackfruit"), (90, "Tamarind"), (100, "Red Chilli"),
    (116, "Tender Coconut"), (129, "Tomato (Local)"), (130, "Tomato (Bangalore)"),
]


def post(path, data=None, retries=3):
    url = BASE + path
    body = urllib.parse.urlencode(data).encode() if data else b""
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8", "replace").strip()
            if not raw or raw == "null":
                return None
            return json.loads(raw)
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (attempt + 1))
    print("  ! failed %s: %s" % (path, last), file=sys.stderr)
    return None


def fetch_markets():
    markets = {}
    for dist_id, (dist_name, lat, lon) in DISTRICTS.items():
        rows = post("/home/getUSList", {"district": dist_id}) or []
        for row in rows:
            name = (row.get("us_name") or "").strip()
            if not name:
                continue
            markets[name] = {
                "id": str(row.get("master_us_id") or ""),
                "name": name,
                "ta": (row.get("tamil_us_name") or "").strip(),
                "districtId": dist_id,
                "district": dist_name,
                "lat": lat,
                "lon": lon,
            }
        time.sleep(0.25)
    return markets


def fetch_prices(date_display):
    prices = {}
    averages = {}
    for crop_id, crop_name in CROPS:
        data = post("/home/us_dist_report_api/%s/%d" % (date_display, crop_id))
        if not data:
            time.sleep(0.2)
            continue
        clean = {}
        modals = []
        for market, rec in data.items():
            try:
                modal = float(rec.get("modal"))
            except (TypeError, ValueError):
                continue
            clean[market.strip()] = {
                "min": num(rec.get("min")),
                "max": num(rec.get("max")),
                "modal": modal,
                "qty": num(rec.get("qty")),
            }
            modals.append(modal)
        if clean:
            prices[str(crop_id)] = clean
            averages[str(crop_id)] = round(sum(modals) / len(modals), 2)
        time.sleep(0.2)
    return prices, averages


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def load_existing():
    try:
        with open(OUT_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def update_history(history, avg, today):
    for crop_id, value in avg.items():
        series = [e for e in history.get(crop_id, []) if e.get("date") != today]
        series.append({"date": today, "avg": value})
        history[crop_id] = sorted(series, key=lambda e: e["date"])[-HISTORY_DAYS:]
    return history


def main():
    now = datetime.now(IST)
    today = now.strftime("%Y-%m-%d")
    date_display = now.strftime("%d-%m-%Y")

    existing = load_existing()
    history = existing.get("history", {})

    print("Fetching markets for %d districts..." % len(DISTRICTS))
    markets = fetch_markets()
    print("  %d markets" % len(markets))

    print("Fetching prices for %d crops on %s..." % (len(CROPS), date_display))
    prices, averages = fetch_prices(date_display)
    print("  %d crops with data" % len(prices))

    history = update_history(history, averages, today)

    payload = {
        "source": "Department of Agricultural Marketing & Agri Business, Tamil Nadu",
        "sourceUrl": "https://www.agrimark.tn.gov.in/",
        "generated": now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "date": today,
        "dateDisplay": date_display,
        "unit": "Rs/kg",
        "districts": {
            did: {"name": name, "lat": lat, "lon": lon}
            for did, (name, lat, lon) in DISTRICTS.items()
        },
        "crops": [{"id": str(cid), "name": name} for cid, name in CROPS],
        "markets": markets,
        "prices": prices,
        "history": history,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    print("Wrote %s" % os.path.normpath(OUT_PATH))


if __name__ == "__main__":
    main()
