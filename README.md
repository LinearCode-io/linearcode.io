# linearcode.io

The public gateway for the Coco ecosystem — a local data engine that indexes
everything you own, keeps it encrypted on your own devices, and makes it
searchable across all of them.

Static site. No build step, no dependencies, no third-party JavaScript.

## Develop

```bash
python3 -m http.server 8001 --directory public
```

## Publish an article

Copy the Markdown file in. There is no HTML to write and no index entry to add.

```bash
cp ~/article/_posts/2026-06-30-my-post.md public/research/posts/
./scripts/build-index.py
```

Jekyll conventions: `YYYY-MM-DD-slug.md`, front matter for `title`,
`description`, `date`, `tags`. The slug becomes `/research/?p=<slug>`.
`build-index.py` derives `posts.json`, `sitemap.xml` and `robots.txt` — never
edit those by hand. `deploy.sh` runs it for you.

## Deploy

```bash
./deploy.sh --dry-run   # report only; the server is not touched
./deploy.sh
```

Rsyncs `public/` to the web root, reloads nginx, then curls `/`,
`/research/` and `/sitemap.xml` and fails if any is not 200 — rsync exiting 0
only means files copied. `LC_SERVER`, `LC_SERVER_USER`, `LC_WEBSITE_DIR` and
`LC_SITE_URL` override the target.

Server-side config is **not** deployed by this script. TLS is managed by
Certbot on the box, and `nginx/` holds reference copies only:

- `nginx/linearcode.conf` — the vhost. Currently **not identical** to the
  server's; check with `ssh <host> "sudo cat /etc/nginx/conf.d/linearcode.conf"`
  and `nginx -T` to see the fully resolved config.
- `nginx/renewal-hooks/reload-nginx.sh` — install once at
  `/etc/letsencrypt/renewal-hooks/deploy/`. Without it a renewed certificate
  sits on disk while nginx keeps serving the expired one.

## Layout

| Path | |
|---|---|
| `public/index.html` | the gateway — hero, live demo, pillars, hiring |
| `public/research/` | article index and reader; `posts/*.md` is the only thing you add |
| `public/md.js` | Markdown renderer, written not vendored; escapes raw HTML |
| `public/demo.js` | omnibar demo, theme toggle |
| `public/styles.css` | design tokens mirroring Coco Terminal, light/dark/system |
| `scripts/build-index.py` | regenerates the derived files |
| `scripts/build-og.sh` | re-renders `public/og-image.png` from `og-card.html` |

Each file's header comment explains its own constraints and the tradeoffs
behind them — including why articles render client-side and what that costs.
