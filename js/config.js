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
  mapStyle: "",
  // Big markets shown across the state on the map (a few per region), even when
  // they are outside the 150 km comparison. Only those with a price for the
  // selected crop appear.
  majorMarkets: [
    "Ambattur", "Tiruvallur", "Kancheepuram", "Vellore", "Krishnagiri", "Hosur",
    "Udhagamandalam", "R.S.Puram", "Tiruppur (North)", "Periyar Nagar", "Hasthampatti",
    "Thiruverumbur", "Thanjavur", "Kumbakonam", "Karur", "Namakkal", "Tiruvannamalai",
    "Dindigul", "Chokkikulam", "Sivakasi", "Virudhunagar", "Palayamkottai", "Tuticorin",
    "Vadaseri", "Cuddalore", "Nagapattinam", "Pudukottai", "Ramanathapuram"
  ]
};
