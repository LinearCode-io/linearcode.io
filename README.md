# linearcode.io

The gateway site for Coco — a local data engine that indexes everything you
own, keeps it encrypted on your own devices, and makes it searchable across
all of them.

**→ [linearcode.io](https://linearcode.io)**

Static HTML. No build step, no dependencies, no third-party JavaScript. The
hero is a working replica of Coco Terminal's `⌘K` omnibar, and research
articles are plain Markdown in `public/research/posts/`.

```bash
python3 -m http.server 8001 --directory public   # preview
./deploy.sh                                      # publish
```

To add an article, drop its Markdown file into `public/research/posts/` and
deploy. The article index, sitemap and robots.txt are generated from front
matter — never edit those by hand.

Every file explains its own constraints in its header comment.
