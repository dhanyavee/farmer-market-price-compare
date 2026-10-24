#!/usr/bin/env python3
"""
One-time geocoder: turn the Uzhavar Sandhai names published by the Tamil Nadu
agrimark portal into coordinates, using OpenStreetMap / Nominatim.

The government portal (agrimark.tn.gov.in) publishes the market NAMES (via
/home/getUSList) but no coordinates, so those names are resolved here against
OpenStreetMap and cached in data/markets_geo.json. The scraper then stamps those
coordinates into data/agrimark.json, so nothing is geocoded at runtime.

Resolution order per market:
  1. "<name> Uzhavar Sandhai, <district>, Tamil Nadu, India"   (acc = venue)
  2. "<name>, <district>, Tamil Nadu, India"                   (acc = town)
  3. "<name>, Tamil Nadu, India"                               (acc = town)
  4. district headquarter centroid                             (acc = district)

Respects the Nominatim usage policy: 1 request/second + identifying User-Agent.
Resumable: re-running skips markets already present in data/markets_geo.json.

Run:  python3 scripts/geocode_markets.py
Output: data/markets_geo.json
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "data", "agrimark.json")
OUT = os.path.join(HERE, "..", "data", "markets_geo.json")

NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "FarmerMarketPriceCompare/1.0 (+https://github.com/dhanyavee/farmer-market-price-compare)"
RATE_LIMIT = 1.1
LIMIT = int(os.environ.get("GEO_LIMIT", "0"))

# agrimark district spellings -> common OSM spellings
DISTRICT_FIX = {
    "TheNilgiris": "Nilgiris",
    "Kanniyakumari": "Kanyakumari",
    "Thiruvannamalai": "Tiruvannamalai",
    "Tiruchirapalli": "Tiruchirappalli",
    "Sivagangai": "Sivaganga",
    "Tuticorin": "Thoothukudi",
    "Nellai": "Tirunelveli",
}


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def nominatim(query):
    params = urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1, "countrycodes": "in",
    })
    req = urllib.request.Request(
        NOMINATIM + "?" + params,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8", "replace") or "[]")


def geocode(name, district, fallback):
    queries = [
        ("venue", "%s Uzhavar Sandhai, %s, Tamil Nadu, India" % (name, district)),
        ("town", "%s, %s, Tamil Nadu, India" % (name, district)),
        ("town", "%s, Tamil Nadu, India" % name),
    ]
    for acc, query in queries:
        time.sleep(RATE_LIMIT)
        try:
            results = nominatim(query)
        except Exception as exc:  # noqa: BLE001
            print("    ! %s" % exc, file=sys.stderr)
            continue
        if results:
            hit = results[0]
            return {
                "lat": round(float(hit["lat"]), 6),
                "lon": round(float(hit["lon"]), 6),
                "acc": acc,
                "q": query,
            }
    return {"lat": fallback[0], "lon": fallback[1], "acc": "district", "q": "district-centroid"}


def main():
    data = load_json(SRC, {})
    markets = data.get("markets")
    districts = data.get("districts", {})
    if not markets:
        sys.exit("No markets found in %s - run scripts/scrape_agrimark.py first." % os.path.normpath(SRC))

    out = load_json(OUT, {})
    pending = [name for name in markets if name not in out]
    if LIMIT > 0:
        pending = pending[:LIMIT]
    print("Markets: %d total, %d already cached, %d to geocode" % (len(markets), len(out), len(pending)))

    for index, name in enumerate(pending, 1):
        market = markets[name]
        district_id = market.get("districtId")
        raw_district = market.get("district") or (districts.get(district_id, {}) or {}).get("name") or ""
        district = DISTRICT_FIX.get(raw_district, raw_district)
        fallback = (market.get("lat"), market.get("lon"))
        result = geocode(name, district, fallback)
        out[name] = result
        print("  [%3d/%3d] %-32s -> %s %s (%s)" % (
            index, len(pending), name[:32], result["lat"], result["lon"], result["acc"]))
        if index % 10 == 0:
            with open(OUT, "w", encoding="utf-8") as fh:
                json.dump(out, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    counts = {}
    for rec in out.values():
        counts[rec["acc"]] = counts.get(rec["acc"], 0) + 1
    print("Wrote %s" % os.path.normpath(OUT))
    print("Accuracy: %s" % ", ".join("%s=%d" % kv for kv in sorted(counts.items())))


if __name__ == "__main__":
    main()
