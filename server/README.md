# Live API on your own server (Oracle Cloud, Hyderabad) via Cloudflare Tunnel

This runs a small dependency-free Python service on your server and exposes it
through a **Cloudflare Tunnel**. It is a server-side proxy: it fetches
`agrimark.tn.gov.in` (which the browser cannot, due to missing CORS headers) and
returns the data to your site **with** CORS.

```
Browser (GitHub Pages)  ->  https://agri-api.your-domain.com
                                  |   Cloudflare edge (HTTPS)
                                  v
                           Cloudflare Tunnel (cloudflared, outbound only)
                                  v
                          127.0.0.1:8080  agrimark_api.py  ->  agrimark.tn.gov.in
   reads JSON                 CORS added                      (Indian server IP)
```

Why this works: the **outbound** request to agrimark comes from your **Indian**
server IP, which the portal accepts. The tunnel only carries inbound traffic.

## 0. Why the tunnel means no Caddy, no open ports

The tunnel terminates TLS at Cloudflare's edge and connects *outbound* to your
box, so:

- No Caddy / Let's Encrypt.
- No inbound 80/443 rules in the VCN or instance firewall.
- The service binds to `127.0.0.1` only (only the tunnel can reach it).

## 1. Get the code and base data onto the server

```
sudo mkdir -p /opt/farmer-market-price-compare
sudo chown $USER /opt/farmer-market-price-compare
git clone <your-repo-url> /opt/farmer-market-price-compare
cd /opt/farmer-market-price-compare

# create the base file (market list + 30-day history) once
python3 scripts/scrape_agrimark.py
```

`data/agrimark.json` supplies the market list, coordinates and price history;
the live prices themselves are fetched on demand.

## 2. Install and start the service

```
sudo cp server/agrimark-api.service /etc/systemd/system/
# edit User/Group/paths/ALLOWED_ORIGINS if needed:
sudo nano /etc/systemd/system/agrimark-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now agrimark-api
sudo systemctl status agrimark-api --no-pager

# smoke test on the box
curl -s http://127.0.0.1:8080/api/health
curl -s "http://127.0.0.1:8080/api/prices?crop=8" | head -c 200
```

## 3. Expose it through your Cloudflare Tunnel

If you already have a tunnel for your domain, just add (or edit) a public
hostname. In the **Cloudflare dashboard**: Zero Trust -> Networks -> Tunnels ->
your tunnel -> **Public Hostnames** -> **Add a public hostname**:

- Subdomain / Domain: `agri-api.your-domain.com`
- Path: (leave empty)
- **Service: `HTTP` -> `localhost:8080`**

Or via `~/.cloudflared/config.yml`:

```yaml
tunnel: <your-tunnel-name>
credentials-file: /home/ubuntu/.cloudflared/<tunnel-uuid>.json
ingress:
  - hostname: agri-api.your-domain.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Reload the tunnel service after editing the config:

```
sudo systemctl restart cloudflared     # or wherever you run cloudflared
```

That's all the exposure you need. No DNS work beyond the tunnel route (the
dashboard/`cloudflared tunnel route dns` creates the CNAME for you).

## 4. Verify from outside

```
curl -s https://agri-api.your-domain.com/api/health
curl -s "https://agri-api.your-domain.com/api/prices?crop=8" | head -c 200
curl -s https://agri-api.your-domain.com/api/agrimark.json | head -c 200
```

## 5. Point the app at it

Use the helper (or edit `js/config.js` by hand):

```
bash scripts/set_live_api.sh https://agri-api.your-domain.com
```

```js
// js/config.js
window.APP_CONFIG = { liveApiBase: "https://agri-api.your-domain.com" };
```

Commit + push; GitHub Pages redeploys. Open the site, press **Load TN Agri live
prices** — the badge shows "Live data · <date>".

## 6. Keep the base data fresh (optional cron)

The API fetches prices live on every request (cached `CACHE_TTL` seconds), but
the market list and 30-day history come from `data/agrimark.json`. Refresh it
hourly so history keeps growing:

```
crontab -e
```
Add:
```
0 * * * * cd /opt/farmer-market-price-compare && /usr/bin/python3 scripts/scrape_agrimark.py >> /var/log/agrimark-scrape.log 2>&1
```

## Configuration

All settings are environment variables (see `server/agrimark-api.service`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `BASE_DATA` | `../data/agrimark.json` | base payload with markets + history |
| `HOST` | `127.0.0.1` | bind address (the tunnel connects locally) |
| `PORT` | `8080` | listen port (tunnel connects to it) |
| `CACHE_TTL` | `600` | seconds the full payload is cached |
| `CROP_CACHE_TTL` | `300` | seconds a single-crop result is cached |
| `MAX_CROPS` | `0` | crops per full build, `0` = all 50 |
| `CONCURRENCY` | `8` | parallel upstream requests |
| `ALLOWED_ORIGINS` | `*` | comma-separated allow-list, or `*` |

## Endpoints

- `GET /api/health`
- `GET /api/agrimark.json` — full payload (same shape as `data/agrimark.json`)
- `GET /api/prices?crop=<id>`
- `GET /api/debug?crop=<id>` — raw upstream status/preview
