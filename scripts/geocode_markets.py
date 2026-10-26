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

# agrimark market spelling -> the spelling OpenStreetMap actually uses
NAME_ALIASES = {
    "Jeyankondam": "Jayankondam",
    "Viruthachalam": "Virudhachalam",
    "Sathiyamagalam": "Sathyamangalam",
    "Kambam": "Cumbum",
    "Manachanullur": "Manachanallur",
    "Keelpennathur": "Kilpennathur",
    "Paramathivelur": "Paramathi Velur",
    "Pernampet": "Pernambut",
    "Avallapalli": "Avalapalli",
}

# Coordinates for markets OpenStreetMap does not have (filled in by hand from
# Google Maps). These always win, so re-running the geocoder keeps them.
MANUAL_COORDS = {
    "Jameenrayapettai": (12.9463, 80.1481),
    "A.Jattihalli": (12.1158, 78.1468),
    "Thathakapatti": (11.6375, 78.1503),
    "Tirupatthur": (10.1293, 78.6186),
    "Devaram": (9.9348, 77.2825),
    "Tamarainagar": (12.2471, 79.0526),
    "Kandiyaperi": (8.7315, 77.6828),
    # OSM had these but the free-text match picked the wrong place; corrected here.
    "NGO Colony": (8.788618, 78.124127),
    "Gingee": (12.254415, 79.415776),
}


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def nominatim(query, viewbox=None, retries=3):
    params = {
        "q": query, "format": "json", "limit": 1, "countrycodes": "in",
    }
    if viewbox:
        params["viewbox"] = viewbox
        params["bounded"] = 1
    qs = urllib.parse.urlencode(params)
    last = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(
                NOMINATIM + "?" + qs,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8", "replace") or "[]")
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5)
    raise last


def geocode(name, district, fallback):
    if name in MANUAL_COORDS:
        lat, lon = MANUAL_COORDS[name]
        return {"lat": lat, "lon": lon, "acc": "manual", "q": "manual"}
    qname = NAME_ALIASES.get(name, name)
    lon_c, lat_c = fallback[1], fallback[0]
    d = 0.6
    viewbox = "%f,%f,%f,%f" % (lon_c - d, lat_c + d, lon_c + d, lat_c - d)
    queries = [
        ("venue", "%s Uzhavar Sandhai, %s, Tamil Nadu, India" % (qname, district)),
        ("town", "%s, %s, Tamil Nadu, India" % (qname, district)),
        ("town", "%s, Tamil Nadu, India" % qname),
    ]
    for acc, query in queries:
        time.sleep(RATE_LIMIT)
        try:
            results = nominatim(query, viewbox=viewbox)
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
        centroid = districts.get(district_id, {}) or {}
        fallback = (centroid.get("lat", market.get("lat")), centroid.get("lon", market.get("lon")))
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
