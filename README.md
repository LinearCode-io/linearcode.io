# linearcode.io

The public gateway for the Coco ecosystem — a local data engine that indexes
everything you own, keeps it encrypted on your own devices, and makes it
searchable across all of them.

A static site: no build step, no dependencies, no third-party JavaScript. The
hero is a working replica of Coco Terminal's `⌘K` omnibar running on an in-page
corpus. Research articles are plain Markdown files.

## Structure

```
public/                  everything that gets deployed, as-is
  index.html             the gateway — hero, live demo, pillars, hiring
  styles.css             design tokens + page styles
  demo.js                omnibar demo, theme toggle, contact form
  md.js                  Markdown + front-matter renderer
  research/
    index.html           index AND article reader (one page, two views)
    research.js          picks the view, fetches the post
    posts.json           GENERATED — do not hand-edit
    posts/*.md           the articles; the only thing you add
scripts/build-index.py   regenerates posts.json from front matter
nginx/linearcode.conf    reference copy of the vhost (not deployed)
deploy.sh
```

## Develop

```bash
python3 -m http.server 8001 --directory public
```

<http://localhost:8001>. Nothing to install or compile.

## Publish an article

Copy the Markdown file in. There is no HTML to write and no index entry to add.

```bash
cp ~/article/_posts/2026-06-30-my-post.md public/research/posts/
./scripts/build-index.py
```

`deploy.sh` runs `build-index.py` itself, so a copy plus a deploy is enough;
run it by hand when you want the local preview to see a new post. `--check`
exits non-zero if `posts.json` is stale, for a pre-commit hook or CI.

Filenames follow the Jekyll convention `YYYY-MM-DD-slug.md`; the slug half
becomes the URL `/research/?p=<slug>`. Front matter drives the index card and
article header — `title`, `description`, `date`, `tags`. Nothing else is read.

An article that is not published yet does not go on the index in any form, not
even as a title.

**The renderer.** `md.js` is written rather than vendored, so no third-party
parser ships to visitors. It covers front matter, headings, paragraphs, nested
ordered and unordered lists, GFM tables, fenced code, blockquotes, thematic
breaks, links, images, and inline emphasis. Raw HTML in Markdown is escaped,
never emitted — a post cannot inject markup. Anything missing is a reason to
extend `md.js`, not to smuggle HTML through the Markdown.

**Tradeoff.** Articles render client-side, so crawlers see the page shell
rather than the prose; `<title>`, `description` and canonical are set from
front matter at runtime. If organic search to research ever matters
commercially, pre-render the posts at deploy time — the Markdown stays the
source, so authoring would not change.

## Deploy

```bash
./deploy.sh --dry-run   # report what would change, touch nothing
./deploy.sh
```

Regenerates the index, validates the tree, rsyncs `public/` to the web root,
reloads nginx. `--delete` keeps the server an exact mirror, so removing a file
here removes it there.

Host, SSH user and web root come from the environment, so no infrastructure is
hardcoded:

| Variable | Default |
|---|---|
| `LC_SERVER` | `pns` (an SSH config alias) |
| `LC_SERVER_USER` | `ec2-user` |
| `LC_WEBSITE_DIR` | `/var/www/linearcode` |

TLS is managed by Certbot **on the server** and is never overwritten by a
deploy. `nginx/linearcode.conf` is a reference copy of what should be there —
keep it in sync by hand. Three things in it are load-bearing:

- `try_files $uri $uri.html $uri/`, so `/research/` resolves to its `index.html`
- `.md` served as `text/markdown` via `default_type` inside a `location` — never
  a `types { }` block, which would replace the inherited MIME map for the whole
  server and break css/js
- `.md` and `.json` kept out of the immutable cache bucket, since both change on
  every publish

## Design

Colour, radius and easing are CSS custom properties defined once at the top of
`styles.css`, mirroring Coco Terminal's own design tokens so the site and the
app do not drift. Light, dark and system themes; the manual toggle persists in
`localStorage` under `lc-theme`. Neutral greys throughout, with the brand indigo
reserved for the logo and primary calls to action.
