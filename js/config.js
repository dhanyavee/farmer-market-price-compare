/*
 * Runtime configuration.
 *
 * Set liveApiBase to the live API base URL to make the
 * "Load TN Agri live prices" button fetch real-time data from agrimark.tn.gov.in
 * through your server-side proxy (server/agrimark_api.py, exposed via a
 * Cloudflare Tunnel). Leave it empty to read the daily-scraped
 * data/agrimark.json instead (offline-safe default).
 *
 * Example:
 *   window.APP_CONFIG = { liveApiBase: "https://agri-api.your-domain.com" };
 */
window.APP_CONFIG = {
  liveApiBase: ""
};
