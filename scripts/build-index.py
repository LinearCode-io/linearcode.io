#!/usr/bin/env python3
"""Regenerate public/research/posts.json from the Markdown posts.

Publishing an article is "drop the Jekyll .md into public/research/posts/".
This script is what makes that true: it reads the front matter of every post
and writes the manifest the site fetches, so no HTML or index entry is ever
hand-maintained. deploy.sh runs it before syncing; run it yourself when you
want the local preview to pick a new post up.

    ./scripts/build-index.py           # rewrite posts.json
    ./scripts/build-index.py --check   # exit 1 if posts.json is stale

Filenames follow the Jekyll convention, YYYY-MM-DD-slug.md; the slug half
becomes the article's URL (/research/?p=<slug>).
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "public" / "research" / "posts"
MANIFEST = ROOT / "public" / "research" / "posts.json"

FILENAME = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-(?P<slug>.+)\.(?:md|markdown)$")
SCALAR = re.compile(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$")


def strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_front_matter(text: str) -> dict:
    """Parse the leading `---` block. Deliberately not a YAML parser: posts use
    scalars and inline `[a, b]` lists, and pulling in PyYAML for that would add
    a dependency to a repo that currently needs none."""
    text = text.lstrip("﻿")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}

    meta: dict = {}
    for line in text[text.find("\n") + 1 : end].splitlines():
        match = SCALAR.match(line)
        if not match:
            continue
        key, raw = match.group(1), match.group(2).strip()
        if raw.startswith("[") and raw.endswith("]"):
            meta[key] = [strip_quotes(v) for v in raw[1:-1].split(",") if v.strip()]
        else:
            meta[key] = strip_quotes(raw)
    return meta


def parse_date(value: str, fallback: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(value).strip(), fmt).replace(tzinfo=None)
        except (ValueError, TypeError):
            continue
    return datetime.strptime(fallback, "%Y-%m-%d")


def build() -> list:
    if not POSTS_DIR.is_dir():
        return []

    posts = []
    for path in sorted(POSTS_DIR.iterdir()):
        match = FILENAME.match(path.name)
        if not match:
            if path.suffix in {".md", ".markdown"}:
                print(
                    f"  ! skipped {path.name}: expected YYYY-MM-DD-slug.md",
                    file=sys.stderr,
                )
            continue

        meta = parse_front_matter(path.read_text(encoding="utf-8"))
        slug = match.group("slug")
        file_date = "-".join(match.group(1, 2, 3))
        date = parse_date(meta.get("date", ""), file_date)

        posts.append(
            {
                "slug": slug,
                "file": path.name,
                "title": meta.get("title") or slug.replace("-", " "),
                "description": meta.get("description", ""),
                "date": date.strftime("%Y-%m-%d"),
                "dateShort": date.strftime("%b %Y"),
                "tags": meta.get("tags", []),
                "categories": meta.get("categories", []),
            }
        )

    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


def main() -> int:
    posts = build()
    payload = json.dumps(posts, indent=2, ensure_ascii=False) + "\n"

    if "--check" in sys.argv:
        current = MANIFEST.read_text(encoding="utf-8") if MANIFEST.exists() else ""
        if current != payload:
            print("posts.json is stale — run ./scripts/build-index.py", file=sys.stderr)
            return 1
        print(f"posts.json up to date ({len(posts)} post(s))")
        return 0

    MANIFEST.write_text(payload, encoding="utf-8")
    print(f"posts.json written ({len(posts)} post(s))")
    for post in posts:
        print(f"  {post['dateShort']}  {post['slug']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
