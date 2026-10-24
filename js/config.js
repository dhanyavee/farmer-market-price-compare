/*
 * Runtime configuration.
 *
 * liveApiBase
 *   Base URL of the live agrimark API (server/agrimark_api.py, exposed via a
 *   Cloudflare Tunnel). Leave it empty to read the daily-scraped
 *   data/agrimark.json instead (offline-safe default).
 *
 * mapStyle
 *   Optional MapLibre style URL. Default is OpenFreeMap "bright" (free, no key).
 *   Other OpenFreeMap styles: "liberty", "positron". Full URL form:
 *     https://tiles.openfreemap.org/styles/<style>
 */
window.APP_CONFIG = {
  liveApiBase: "https://agri-api.cloudnodes.cc",
  mapStyle: ""
};
