/*  Markdown → HTML for LinearCode research posts.
 *
 *  Deliberately small and dependency-free: articles are authored as Jekyll
 *  posts (YAML front matter + GitHub-flavoured Markdown) and dropped into
 *  research/posts/, so the site has to understand that subset and nothing
 *  more. No third-party parser ships to visitors.
 *
 *  Supported: YAML-ish front matter (scalars, "quoted", [a, b] lists) ·
 *  ATX headings · paragraphs · fenced code · blockquotes · thematic breaks ·
 *  GFM tables · ordered/unordered lists with indent nesting · inline code,
 *  bold, italic, strikethrough, links, images.
 *
 *  NOT supported, on purpose: raw HTML in Markdown (it is escaped, never
 *  emitted), reference-style links, footnotes, setext headings. If a post
 *  needs one of those, extend this file rather than smuggling HTML through.
 */

window.MD = (function () {
  "use strict";

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  /* ── front matter ──────────────────────────────────────────────────── */

  function stripQuotes(value) {
    var t = value.trim();
    if ((t.charAt(0) === '"' && t.slice(-1) === '"') ||
        (t.charAt(0) === "'" && t.slice(-1) === "'")) {
      return t.slice(1, -1);
    }
    return t;
  }

  function parseFrontMatter(source) {
    var text = source.replace(/^﻿/, "");
    if (!/^---\r?\n/.test(text)) return { meta: {}, body: text };
    var end = text.indexOf("\n---", 3);
    if (end === -1) return { meta: {}, body: text };

    var head = text.slice(text.indexOf("\n") + 1, end);
    var body = text.slice(end + 4).replace(/^\r?\n/, "");
    var meta = {};

    head.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!m) return;
      var key = m[1];
      var raw = m[2].trim();
      if (raw.charAt(0) === "[" && raw.slice(-1) === "]") {
        meta[key] = raw
          .slice(1, -1)
          .split(",")
          .map(function (v) { return stripQuotes(v); })
          .filter(Boolean);
      } else {
        meta[key] = stripQuotes(raw);
      }
    });

    return { meta: meta, body: body };
  }

  /* ── inline ────────────────────────────────────────────────────────── */

  // U+0000 can never appear in a Markdown source we serve, so it is a safe
  // placeholder for stashed code spans.
  var NUL = "\u0000";

  function inline(text) {
    // Code spans are extracted before anything else so their contents are
    // never treated as emphasis or link syntax.
    var codes = [];
    var out = text.replace(/`([^`]+)`/g, function (_, code) {
      codes.push(code);
      return NUL + (codes.length - 1) + NUL;
    });

    out = escapeHtml(out);

    // Escaping turned every & into &amp;, which would corrupt query strings
    // in URLs — undo it inside href/src only.
    var url = function (u) { return u.replace(/&amp;/g, "&"); };

    out = out
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
        return '<img src="' + url(src) + '" alt="' + alt + '" loading="lazy">';
      })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
        var external = /^https?:\/\//.test(href);
        return '<a href="' + url(href) + '"' + (external ? ' rel="noopener"' : "") +
          ">" + label + "</a>";
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\n]+)_/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>");

    return out.replace(new RegExp(NUL + "(\\d+)" + NUL, "g"), function (_, i) {
      return "<code>" + escapeHtml(codes[Number(i)]) + "</code>";
    });
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  /* ── blocks ────────────────────────────────────────────────────────── */

  var LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  var isBlank = function (line) { return !line || !line.trim(); };
  var indentOf = function (text) { return text.replace(/\t/g, "    ").match(/^ */)[0].length; };

  // Renders one list starting at `start`, consuming every item at `base`
  // indentation and recursing into anything indented further.
  var isOrdered = function (marker) { return /\d/.test(marker); };

  function renderList(lines, start, base, result) {
    var first = lines[start].match(LIST_ITEM);
    var ordered = isOrdered(first[2]);
    var html = ordered ? "<ol>" : "<ul>";
    var i = start;
    var open = false;

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) {
        // A blank line ends the list unless a deeper- or equal-indented item
        // follows it — that is a loose list, not the end.
        var next = i + 1;
        while (next < lines.length && isBlank(lines[next])) next++;
        var lookahead = lines[next] && lines[next].match(LIST_ITEM);
        if (!lookahead || indentOf(lines[next]) < base) break;
        // "- a" then a blank line then "1. b" is two lists, not one loose
        // list — a marker switch at the same depth ends this one.
        if (indentOf(lines[next]) === base && isOrdered(lookahead[2]) !== ordered) break;
        i = next;
        continue;
      }

      var m = line.match(LIST_ITEM);
      if (!m) break;

      var indent = indentOf(line);
      if (indent < base) break;
      if (indent === base && isOrdered(m[2]) !== ordered) break;

      if (indent > base) {
        var nested = renderList(lines, i, indent, {});
        html += nested.html;
        i = nested.next;
        continue;
      }

      if (open) html += "</li>";
      html += "<li>" + inline(m[3]);
      open = true;
      i++;
    }

    if (open) html += "</li>";
    html += ordered ? "</ol>" : "</ul>";
    result.html = html;
    result.next = i;
    return result;
  }

  function isTableDelimiter(line) {
    return !!line && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
  }

  function splitRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(function (cell) { return cell.trim(); });
  }

  function render(markdown) {
    var lines = markdown.replace(/\r\n/g, "\n").split("\n");
    var html = "";
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) { i++; continue; }

      var fence = line.match(/^\s*```+\s*([\w-]*)\s*$/);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) code.push(lines[i++]);
        i++; // closing fence
        html += "<pre><code" + (fence[1] ? ' class="language-' + fence[1] + '"' : "") + ">" +
          escapeHtml(code.join("\n")) + "</code></pre>";
        continue;
      }

      var heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        var level = heading[1].length;
        // Rendered verbatim — the heading is the author's text, not ours to
        // tidy. slugify() drops the punctuation for the anchor id anyway.
        var title = heading[2].trim();
        html += "<h" + level + ' id="' + slugify(title) + '">' + inline(title) +
          "</h" + level + ">";
        i++;
        continue;
      }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html += "<hr>";
        i++;
        continue;
      }

      if (/^\s*>/.test(line)) {
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        html += "<blockquote>" + render(quote.join("\n")) + "</blockquote>";
        continue;
      }

      if (line.indexOf("|") !== -1 && isTableDelimiter(lines[i + 1])) {
        var head = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !isBlank(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        html += '<div class="table-wrap"><table><thead><tr>';
        head.forEach(function (cell) { html += "<th>" + inline(cell) + "</th>"; });
        html += "</tr></thead><tbody>";
        rows.forEach(function (row) {
          html += "<tr>";
          row.forEach(function (cell) { html += "<td>" + inline(cell) + "</td>"; });
          html += "</tr>";
        });
        html += "</tbody></table></div>";
        continue;
      }

      if (LIST_ITEM.test(line)) {
        var list = renderList(lines, i, indentOf(line), {});
        html += list.html;
        i = list.next;
        continue;
      }

      // Paragraph: runs on until a blank line or the start of another block.
      var para = [];
      while (
        i < lines.length &&
        !isBlank(lines[i]) &&
        !/^(#{1,6}\s|\s*```|\s*>)/.test(lines[i]) &&
        !LIST_ITEM.test(lines[i]) &&
        !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
        !(lines[i].indexOf("|") !== -1 && isTableDelimiter(lines[i + 1]))
      ) {
        para.push(lines[i]);
        i++;
      }
      if (para.length) html += "<p>" + inline(para.join(" ")) + "</p>";
    }

    return html;
  }

  /** Rough reading time, matching the convention used by Jekyll themes. */
  function readingTime(body) {
    var words = body.trim().split(/\s+/).filter(Boolean).length;
    return { words: words, minutes: Math.max(1, Math.round(words / 200)) };
  }

  function formatDate(value) {
    var date = new Date(String(value).replace(" ", "T").replace(/ \+\d{4}$/, "Z"));
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  }

  return {
    parse: parseFrontMatter,
    render: render,
    inline: inline,
    escapeHtml: escapeHtml,
    slugify: slugify,
    readingTime: readingTime,
    formatDate: formatDate,
  };
})();
