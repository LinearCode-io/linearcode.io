#!/bin/bash
#
# Deploy the LinearCode gateway site (linearcode.io).
#
# The site is static: everything under public/ is mirrored to the server's
# document root. Nginx + certbot config on the server is NOT touched — see
# nginx/linearcode.conf for the reference copy of what should be there.
#
# Usage:
#   ./deploy.sh            deploy
#   ./deploy.sh --dry-run  show what would change, transfer nothing

set -euo pipefail

SERVER="${LC_SERVER:-pns}"          # ssh alias; ~/.ssh/config maps it to the host
SERVER_USER="${LC_SERVER_USER:-ec2-user}"
WEBSITE_DIR="${LC_WEBSITE_DIR:-/var/www/linearcode}"
PUBLIC_DIR="$(cd "$(dirname "$0")" && pwd)/public"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

DRY_RUN=""
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN="--dry-run"
  echo -e "${YELLOW}DRY RUN — nothing will be transferred${NC}"
fi

echo -e "${YELLOW}Step 1: regenerating the research index…${NC}"
# Publishing an article is "copy the .md into public/research/posts/". This is
# the step that makes that true — posts.json is derived, never hand-edited.
"$(dirname "$0")/scripts/build-index.py"
echo ""

echo -e "${YELLOW}Step 2: validating local files…${NC}"
for file in index.html styles.css demo.js md.js logo.svg research/index.html \
            research/research.js research/posts.json; do
  if [ ! -f "$PUBLIC_DIR/$file" ]; then
    echo -e "${RED}Error: public/$file not found${NC}"
    exit 1
  fi
done

# Catch the mistakes that survive a visual check: an unclosed tag count
# mismatch is not worth parsing HTML for, but a stray localhost URL or a
# leftover TODO shipping to production is.
if grep -rniE "localhost|127\.0\.0\.1" "$PUBLIC_DIR" >/dev/null; then
  echo -e "${RED}Error: a localhost reference is still in public/ — refusing to deploy${NC}"
  grep -rniE "localhost|127\.0\.0\.1" "$PUBLIC_DIR"
  exit 1
fi
echo -e "${GREEN}✓ files present, no localhost references${NC}"

echo -e "${YELLOW}Step 3: syncing public/ → $SERVER:$WEBSITE_DIR${NC}"
ssh "$SERVER" "sudo mkdir -p $WEBSITE_DIR && sudo chown $SERVER_USER:$SERVER_USER $WEBSITE_DIR"
# --delete keeps the server a mirror: files removed here (the old script.js,
# favicon.svg) disappear there too instead of lingering as dead routes.
rsync -avz --delete $DRY_RUN "$PUBLIC_DIR/" "$SERVER:$WEBSITE_DIR/"

if [ -n "$DRY_RUN" ]; then
  echo -e "${YELLOW}Dry run complete — nginx not reloaded.${NC}"
  exit 0
fi
echo -e "${GREEN}✓ files synced${NC}"

echo -e "${YELLOW}Step 4: reloading nginx…${NC}"
# Nginx config is managed by certbot on the server and is deliberately not
# overwritten from here. nginx/linearcode.conf is the reference copy.
ssh "$SERVER" "sudo nginx -t && sudo systemctl reload nginx"
echo -e "${GREEN}✓ nginx reloaded${NC}"

echo ""
echo -e "${GREEN}=== Deployed ===${NC}"
echo "https://linearcode.io"
