# nginx reference

`linearcode.conf` is a reference copy of the vhost that serves this site.

It is **not** deployed by `deploy.sh` — the live config is managed by Certbot
on the server, and overwriting it from here would clobber the TLS block.
Keep this copy in sync by hand when the server config changes, so the repo
records what the site expects:

- `try_files $uri $uri.html $uri/` so `/research/` resolves to its `index.html`
- `.md` served as `text/markdown` via `default_type` in a `location`, never a
  `types { }` block (that would replace the inherited MIME map for the whole
  server and break css/js)
- `.md` and `.json` kept out of the immutable cache bucket, since both change
  on every publish

To check a change before applying it on the server:

```bash
ssh <host> "sudo nginx -t && sudo systemctl reload nginx"
```
