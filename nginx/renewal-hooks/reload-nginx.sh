#!/bin/sh
# Certbot deploy hook — install at:
#   /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh   (chmod +x, root-owned)
#
# Certbot runs every executable in that directory after a successful renewal.
# Without this, renewal "succeeds" while nginx keeps the previous certificate
# in memory and serves it until something reloads the service — so the cert on
# disk is fresh and the cert visitors get is expired.
#
# It is not installed by deploy.sh: this is one-time server setup, and adding
# an ssh+sudo step to every deploy to re-check a static file is not worth it.
# It lives here so a rebuilt box can restore it from version control.
nginx -t && systemctl reload nginx
