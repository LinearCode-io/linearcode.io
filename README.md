# linearcode.io

The public gateway for the Coco ecosystem — a local data engine that indexes
everything you own, keeps it encrypted on your own devices, and makes it
searchable across all of them.

This repository is the website: a static site with no build step, no
dependencies, and no third-party JavaScript. The hero is a working replica of
Coco Terminal's `⌘K` omnibar running against a small in-page corpus, and
research articles are plain Markdown files.

## Structure

```
.
├── public/                 # everything that gets deployed, as-is
│   ├── index.html          # the gateway — hero, live demo, three pillars, hiring
│   ├── research/
│   │   ├── index.html      # index AND article reader (one page, two views)
│   │   ├── research.js     # picks the view, fetches the post
│   │   ├── posts.json      # GENERATED — do not hand-edit
│   │   └── posts/*.md      # the articles; the only thing you add
│   ├── md.js               # Markdown + front-matter renderer
│   ├── styles.css          # design tokens + page styles
│   ├── demo.js             # omnibar demo, theme toggle, contact form
│   └── logo.svg
├── scripts/
│   └── build-index.py      # regenerates research/posts.json from front matter
├── nginx/                  # reference copy of the vhost (not deployed)
└── deploy.sh
```

## Local development

```bash
python3 -m http.server 8001 --directory public
```

Then open <http://localhost:8001>. There is nothing to install or compile.

## Publishing an article

Copy the Markdown file in. That is the whole workflow — there is no HTML to
write and no index entry to add.

```bash
cp ~/article/_posts/2026-06-30-my-post.md public/research/posts/
./scripts/build-index.py
```

`deploy.sh` runs `build-index.py` itself, so in practice a copy plus a deploy
is enough; run it by hand when you want the local preview to see a new post.
`--check` exits non-zero if `posts.json` is stale, for a pre-commit hook or CI.

Filenames follow the Jekyll convention `YYYY-MM-DD-slug.md`, and the slug half
becomes the URL: `/research/?p=<slug>`. Front matter drives everything shown on
the index and in the article header — `title`, `description`, `date`, `tags`.
Nothing else is read.

An article that is not published yet does not go on the index in any form, not
even as a title. An empty research page is a stronger claim than a fabricated
one.

### The Markdown renderer

`public/md.js` renders posts in the browser. It is written rather than
vendored, so no third-party parser ships to visitors, and it covers exactly the
subset these posts use:

> YAML-ish front matter · ATX headings · paragraphs · nested ordered and
> unordered lists · GFM tables · fenced code · blockquotes · thematic breaks ·
> links · images · inline code, bold, italic, strikethrough

Raw HTML in Markdown is **escaped, never emitted** — a post cannot inject
markup. Reference-style links, footnotes and setext headings are not supported.
A post that needs something missing is a reason to extend `md.js`, not to
smuggle HTML through the Markdown.

One consequence worth knowing: because articles render client-side, crawlers
and link-preview bots see the page shell rather than the prose. Per-article
`<title>`, `description` and canonical are set from front matter at runtime,
which modern crawlers execute. If organic search traffic to research ever
matters commercially, pre-render the posts to static HTML at deploy time — the
Markdown stays the source, so authoring would not change.

## Deployment

```bash
./deploy.sh --dry-run
```

```bash
./deploy.sh
```

`deploy.sh` regenerates the research index, validates the tree, then rsyncs
`public/` to the web root and reloads nginx. It uses `--delete`, so removing a
file here removes it on the server.

The host, SSH user and web root come from the environment so no infrastructure
is hardcoded:

| Variable | Default |
|---|---|
| `LC_SERVER` | `pns` (an SSH config alias) |
| `LC_SERVER_USER` | `ec2-user` |
| `LC_WEBSITE_DIR` | `/var/www/linearcode` |

TLS is managed by Certbot **on the server** and is never overwritten by a
deploy; `nginx/linearcode.conf` is the reference copy of what should be there.

## Design

Colour, radius and easing are CSS custom properties defined once at the top of
`styles.css`, mirroring the Coco Terminal application's own design tokens so
the site and the app do not drift. Light, dark and system themes are supported;
the manual toggle persists in `localStorage` under `lc-theme`.

The page is deliberately quiet: neutral greys throughout, with the brand indigo
reserved for the logo and primary calls to action.
