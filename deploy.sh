#!/bin/bash
#
# Deploy the LinearCode gateway site (linearcode.io).
#
# The site is static: everything under public/ is mirrored to the server's
# document root. Nginx + certbot config on the server is NOT touched — see
# nginx/linearcode.conf for the reference copy of what should be there.
#
# Host, user and web root come from the environment (LC_SERVER,
# LC_SERVER_USER, LC_WEBSITE_DIR) so no infrastructure is hardcoded here.
#
# Usage:
#   ./deploy.sh            deploy
#   ./deploy.sh --dry-run  report what would change; the server is not touched

set -euo pipefail

SERVER="${LC_SERVER:-pns}"          # ssh alias; ~/.ssh/config maps it to the host
SERVER_USER="${LC_SERVER_USER:-ec2-user}"
WEBSITE_DIR="${LC_WEBSITE_DIR:-/var/www/linearcode}"

ROOT="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="$ROOT/public"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  echo -e "${YELLOW}DRY RUN — the server will not be touched${NC}"
fi

echo -e "${YELLOW}Step 1: regenerating the research index…${NC}"
# Publishing an article is "copy the .md into public/research/posts/". This is
# the step that makes that true — posts.json is derived, never hand-edited.
"$ROOT/scripts/build-index.py"
echo ""

echo -e "${YELLOW}Step 2: validating local files…${NC}"
for file in index.html styles.css demo.js md.js logo.svg og-image.png sitemap.xml robots.txt \
            research/index.html research/research.js research/posts.json; do
  if [ ! -f "$PUBLIC_DIR/$file" ]; then
    echo -e "${RED}Error: public/$file not found${NC}"
    exit 1
  fi
done

# A stray localhost URL shipping to production is the mistake a visual check
# misses. Scoped to the site's own source: article Markdown is prose, and a
# post about running a local engine will legitimately say "localhost".
if grep -rniE --include='*.html' --include='*.js' --include='*.css' \
     "localhost|127\.0\.0\.1" "$PUBLIC_DIR" >/dev/null; then
  echo -e "${RED}Error: a localhost reference is still in public/ — refusing to deploy${NC}"
  grep -rnE --include='*.html' --include='*.js' --include='*.css' \
    "localhost|127\.0\.0\.1" "$PUBLIC_DIR"
  exit 1
fi
echo -e "${GREEN}✓ files present, no localhost references${NC}"
echo ""

echo -e "${YELLOW}Step 3: syncing public/ → $SERVER:$WEBSITE_DIR${NC}"
if [ "$DRY_RUN" = true ]; then
  # Read-only: no mkdir, no chown, no writes. rsync needs the destination to
  # exist to diff against it, so a first-ever dry run against a fresh host
  # reports every file as new — that is accurate, not an error.
  rsync -avz --delete --dry-run "$PUBLIC_DIR/" "$SERVER:$WEBSITE_DIR/"
  echo ""
  echo -e "${YELLOW}Dry run complete — nothing transferred, nginx not reloaded.${NC}"
  exit 0
fi

ssh "$SERVER" "sudo mkdir -p '$WEBSITE_DIR' && sudo chown '$SERVER_USER':'$SERVER_USER' '$WEBSITE_DIR'"
# --delete keeps the server an exact mirror, so a file removed here disappears
# there instead of lingering as a dead route. --delay-updates moves the new
# files into place at the end, which keeps the window where a visitor could
# see a half-updated site down to the final rename rather than the whole
# transfer. rsync gives no true atomic swap; this is as close as it gets.
rsync -avz --delete --delay-updates "$PUBLIC_DIR/" "$SERVER:$WEBSITE_DIR/"
echo -e "${GREEN}✓ files synced${NC}"
echo ""

echo -e "${YELLOW}Step 4: reloading nginx…${NC}"
# Nginx config is managed by certbot on the server and is deliberately not
# overwritten from here. nginx/linearcode.conf is the reference copy.
ssh "$SERVER" "sudo nginx -t && sudo systemctl reload nginx"
echo -e "${GREEN}✓ nginx reloaded${NC}"

echo ""
echo -e "${GREEN}=== Deployed ===${NC}"
echo "https://linearcode.io"
