# Farmer Market Price Compare

A mobile-first web app (PWA) that helps farmers in Tamil Nadu decide **which market
to sell at** after transport and market fees. The farmer enters crop, quantity and
transport cost; the app compares sample market prices and recommends the market with
the highest **net amount**.

Production data source: [AGMARKNET](https://agmarknet.gov.in) /
[data.gov.in](https://data.gov.in) / [e-NAM](https://www.enam.gov.in).
The app ships with generated sample data so it works offline; the **Fetch live prices**
button is a best-effort bonus.

## The calculation

```
gross          = modal_price_per_quintal / 100 * quantity_kg
transport      = distance_km * rate_per_km_per_quintal * (quantity_kg / 100)
fees           = loading + unloading + (commission% of gross) + market_fee
net_amount     = gross - transport - fees
```

The recommendation ranks markets by `net_amount`, only recommending markets that are
**open today**, and reports the gain versus the farmer's nearest market.

## Map

Each candidate market is plotted with **MapLibre GL** on an **OpenFreeMap**
basemap (free, no API key, no signup, open-source). Pins show the modal price
(e.g. `₹3.2k`/quintal) and are colour-coded (your market = amber, open = green,
closed = grey, best = highlighted). Nearby markets are grouped into **clusters**
(click a cluster to zoom in); clicking a pin opens a popup with price, distance,
net amount and status, plus a **Use as my market** button that re-runs the
comparison. A few **major markets across the state** (configurable via
`APP_CONFIG.majorMarkets` in `js/config.js`) are also plotted in blue so the map
covers all of Tamil Nadu — only those with a price for the selected crop appear.

The style is set in `js/config.js` (`APP_CONFIG.mapStyle`); default is OpenFreeMap
`bright`. Other free styles: `liberty`, `positron`:

```js
window.APP_CONFIG = {
  mapStyle: "https://tiles.openfreemap.org/styles/liberty"
};
```

OpenFreeMap is a best-effort, donation-funded service (no key/limits) and can also
be self-hosted if it is ever unavailable.

Market **names** come from the Tamil Nadu agrimark portal. That portal publishes no
coordinates, so positions were resolved once and are stored in
`data/markets_coords.json` (hand-verified exact locations for all 194 markets);
`scripts/geocode_markets.py` + `data/markets_geo.json` are a fallback for any new
market. The scraper stamps the coordinates into `data/agrimark.json`. Nothing is
geocoded at runtime.

## Live prices (Tamil Nadu Agricultural Marketing Dept)

The clearest source for Tamil Nadu is the Department of Agricultural Marketing &
Agri Business portal **<https://www.agrimark.tn.gov.in/>**, which publishes current
Uzhavar Sandhai prices for every district.

That portal has **no CORS headers**, so a browser page cannot call it directly.
Two pieces handle that:

- `scripts/scrape_agrimark.py` fetches, for all 38 districts:
  - `POST /home/getUSList` (`district=<id>`) - the market list (English + Tamil names)
  - `POST /home/us_dist_report_api/<dd-mm-yyyy>/<crop_id>` - prices per market
  and writes `data/agrimark.json` (markets, crops, prices and a rolling 30-day
  history). This ships with the app as the **offline fallback** and as the seed
  for the live API's market list and history. Run it once (and periodically) on
  the server:
  ```
  python3 scripts/scrape_agrimark.py
  ```
- `server/agrimark_api.py` is a small server-side proxy that fetches the portal
  live and serves it **with CORS headers**. Run it on your own server (e.g.
  Oracle Cloud, Hyderabad) behind a Cloudflare Tunnel and point `liveApiBase`
  in `js/config.js` at it. Full steps: [server/README.md](server/README.md).

In the app, press **Load TN Agri live prices**: it reads the live proxy if
configured, otherwise the bundled `data/agrimark.json`, and falls back to the
built-in sample data if neither is available. The badge shows the source date.
Prices from the portal are per **kg**; the app converts them to per quintal.

### Why not scrape in the browser?

A GitHub Pages site is served from a different origin than `agrimark.tn.gov.in`,
and that server sends no `Access-Control-Allow-Origin` header, so browsers block
the request. Scraping on a schedule and publishing a JSON file is the reliable,
standard workaround.

A server-side proxy is the other option: it fetches the portal server-to-server
and returns the data to the browser *with* CORS headers, giving true real-time
prices. This project includes one such proxy:

- `server/` - a dependency-free Python service for **your own server** (e.g.
  Oracle Cloud, Hyderabad). Its Indian IP is accepted by agrimark. See
  [server/README.md](server/README.md).

## Live API on your own server

`server/agrimark_api.py` is a small stdlib-only Python service that mirrors the
Worker and has no subrequest limits (all 50 crops in one build). Expose it
through a Cloudflare Tunnel (no open ports, no certificates to manage) and point
the app at it. Full steps: [server/README.md](server/README.md).

```js
// js/config.js
window.APP_CONFIG = { liveApiBase: "https://agri-api.your-domain.com" };
```

## Run it

Option A - just open the file:

```
open index.html
```

Option B - serve locally (needed for offline service worker + install):

```
python3 -m http.server 8000
# visit http://localhost:8000
```

## Project structure

```
index.html               UI: form, recommendation, charts, map, table
css/style.css            responsive styling
js/config.js             runtime config (optional live API URL)
js/data.js               sample + agrimark data layer, distance (haversine)
js/calc.js               net-amount math (unit-safe)
js/recommend.js          ranking engine + human-readable reason
js/charts.js             Chart.js net comparison + 7-day trend
js/map.js                MapLibre map: price pins + popups (OpenFreeMap)
js/i18n.js               English / Tamil strings
js/app.js                wiring
scripts/scrape_agrimark.py   scraper for agrimark.tn.gov.in -> data/agrimark.json
scripts/geocode_markets.py   one-time OSM geocoder -> data/markets_geo.json
scripts/set_live_api.sh  point js/config.js at a live API URL
data/agrimark.json       base market data + offline fallback
data/markets_geo.json    market name -> coordinates lookup (OSM, fallback)
data/markets_coords.json exact market name -> coordinates (hand-verified, all 194)
server/agrimark_api.py   live CORS API proxy (stdlib Python) for your own server
server/agrimark-api.service / README.md   server deploy files (Cloudflare Tunnel)
assets/vendor/           Chart.js + MapLibre (vendored for offline use)
assets/icons/            app icon
manifest.webmanifest     PWA metadata
sw.js                    offline cache (network-first for data/, cache for tiles)
```

## Deploy (free)

1. Push this folder to a GitHub repository.
2. Enable GitHub Pages (Settings -> Pages -> deploy from `main` / root).
3. Or drag-and-drop the folder into [Netlify Drop](https://app.netlify.com/drop).
4. Open the site on a phone and use **Add to Home Screen** so it installs like an app.
5. Generate a QR code of the URL for judges to scan.

## Demo script (3 minutes)

1. "A farmer has 100 kg of tomato. The nearby mandi looks fine - but is it the best?"
2. Enter: crop **Tomato**, quantity **100 kg**, transport rate **4 Rs/km/quintal**.
3. Hit **Compare markets**. Point at the recommendation:
   _Oddanchatram - Open today - 36 km away - +Rs.188 vs your local market._
4. Show the **net amount by market** bar chart (your market in amber, open markets in green).
5. Show the **map**: every market is a price pin on an OpenFreeMap basemap, grouped
   into clusters when zoomed out. Click a pin
   for its popup (price, distance, net) and tap **Use as my market** to re-compare from there.
6. Show the **7-day price trend** to say the price is rising/falling.
7. Sustainability: fewer wasted trips, faster selling at the right market, less spoilage
   and food waste, higher farmer income. Tap **தமிழ்** to show local-language support.
8. Tap **Load TN Agri live prices** to switch to today's real Uzhavar Sandhai
   prices for all 38 districts (badge shows the date), then press **Compare markets**.

## Notes

- Two data sources: the built-in **sample** data (offline, 15 big mandis) and the
  **agrimark** live file (194 Uzhavar Sandhais, real per-kg prices). Press
  **Load TN Agri live prices** to switch; the sample data loads by default.
- In agrimark mode, distances use each market's **geocoded coordinates** (OpenStreetMap,
  see `data/markets_geo.json`), and the comparison is limited to markets within 150 km
  (plus the whole local district). The 7-day trend uses the crop's TN-wide average from
  the scraper's history.
- Sample prices are generated deterministically relative to today's date, so results
  are stable per day but vary across days (prices and market open-days).
