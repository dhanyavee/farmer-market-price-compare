#!/usr/bin/env bash
#
# Point the app at a live API base URL (your Cloudflare Tunnel hostname).
#
#   bash scripts/set_live_api.sh https://agri-api.your-domain.com
#   bash scripts/set_live_api.sh ""        # reset back to the offline default
#
set -euo pipefail

URL="${1-}"
URL="${URL%/}"

CFG="$(cd "$(dirname "$0")/.." && pwd)/js/config.js"
[ -f "$CFG" ] || { echo "config not found: $CFG" >&2; exit 1; }

python3 - "$CFG" "$URL" <<'PY'
import re
import sys

path, url = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    src = fh.read()

new, n = re.subn(r'(?m)^(\s*)liveApiBase:\s*"[^"]*"', r'\1liveApiBase: "%s"' % url, src)
if n == 0:
    sys.exit("liveApiBase not found in " + path)
with open(path, "w", encoding="utf-8") as fh:
    fh.write(new)
print("set liveApiBase = %r in %s" % (url, path))
PY
