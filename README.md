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

## Live prices (why it failed, and how to fix it)

The **Fetch live prices** button calls the data.gov.in mandi-price API. It reports
`Live fetch failed` when the request cannot be used. The most common cause is:

**HTTP 429 - "Rate limit exceeded".** The API key shipped in the app is data.gov.in's
*shared demo key*; it is used by everyone and is almost always rate-limited now.

Fix it with your **own free key**:

1. Register at <https://data.gov.in/user/register> and confirm your email.
2. Log in and open **My Account** - your **API key** is shown there.
3. In the app, open **Live data settings**, paste the key into
   *Your data.gov.in API key*, and press **Fetch live prices** again.

The key is saved in your browser (localStorage), so you only enter it once.

Other error reasons the app now reports:

| Message | Meaning |
| --- | --- |
| `API rate limit reached (HTTP 429)` | Key is throttled - use your own key |
| `API key rejected (HTTP 403)` | Wrong/unauthorised key |
| `Live fetch failed` | Network down, or the browser blocked the request (CORS) |
| `Live prices loaded, but none matched...` | API returned data but not for the selected crops/markets |

**If it still fails with a plain network error (CORS):** some browsers block direct
calls to data.gov.in. Put a CORS-proxy prefix in *CORS proxy prefix (optional)*, for
example:

```
https://api.allorigins.win/raw?url=
https://corsproxy.io/?url=
```

The app wraps the API URL with that prefix. The sample data remains the reliable
default for the exhibition, so the demo never depends on the network.

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
index.html               UI: input form, recommendation, charts, table
css/style.css            responsive styling
js/data.js               sample crops/markets, prices, distance (haversine)
js/calc.js               net-amount math (unit-safe)
js/recommend.js          ranking engine + human-readable reason
js/charts.js             Chart.js net comparison + 7-day trend
js/i18n.js               English / Tamil strings
js/app.js                wiring
assets/vendor/           Chart.js (vendored for offline use)
assets/icons/            app icon
manifest.webmanifest     PWA metadata
sw.js                    offline cache
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
5. Show the **7-day price trend** to say the price is rising/falling.
6. Sustainability: fewer wasted trips, faster selling at the right market, less spoilage
   and food waste, higher farmer income. Tap **தமிழ்** to show local-language support.
7. Optional: tap **Fetch live prices** to show the AGMARKNET/data.gov.in integration path.

## Notes

- Sample prices are generated deterministically relative to today's date, so results
  are stable per day but vary across days (prices and market open-days).
- The live button calls the data.gov.in mandi resource and maps records by crop and
  market name; if the network or the API is unavailable it silently keeps sample data.
