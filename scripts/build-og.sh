#!/bin/bash
#
# Render scripts/og-card.html to public/og-image.png.
#
# The card is the picture Slack, iMessage, X, LinkedIn and Discord show when
# someone pastes a link to the site. Regenerate it whenever the card source or
# the branding changes; it is committed, so a deploy does not depend on having
# a browser installed.
#
# Rendered at 2x and downsampled, because text drawn at 1200x630 directly comes
# out soft — link previews are the one place the image is never scaled up.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CARD="$ROOT/og-card.html"
OUT="$(cd "$ROOT/.." && pwd)/public/og-image.png"
TMP="${TMPDIR:-/tmp}/og-card-2x.png"

BROWSER="${OG_BROWSER:-}"
if [ -z "$BROWSER" ]; then
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
    "$(command -v chromium || true)" \
    "$(command -v google-chrome || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then BROWSER="$candidate"; break; fi
  done
fi

if [ -z "$BROWSER" ]; then
  echo "No Chromium-based browser found. Set OG_BROWSER=/path/to/chrome" >&2
  exit 1
fi

echo "Rendering with: $BROWSER"
"$BROWSER" \
  --headless \
  --disable-gpu \
  --hide-scrollbars \
  --force-device-scale-factor=2 \
  --window-size=1200,630 \
  --screenshot="$TMP" \
  "file://$CARD" >/dev/null 2>&1

python3 - "$TMP" "$OUT" <<'PY'
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGB")
if img.size != (1200, 630):
    img = img.resize((1200, 630), Image.LANCZOS)
# optimize=True costs a second and buys a smaller card; unfurlers fetch this
# synchronously while rendering the preview, so bytes matter more than usual.
img.save(dst, "PNG", optimize=True)
print(f"{dst}  {img.size[0]}x{img.size[1]}")
PY

rm -f "$TMP"
ls -lh "$OUT" | awk '{print "  size:", $5}'
