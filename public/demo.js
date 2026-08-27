/*  LinearCode gateway — interactive Coco Terminal demo.
 *
 *  Mirrors coco-terminal's SearchModal: one omnibar over a fixed local
 *  corpus, results grouped "this device first, then one section per linked
 *  device" (SearchModal.tsx), each row carrying its kind badge and origin.
 *
 *  Autoplay runs a scripted query loop until the visitor touches the input;
 *  from that point the demo is theirs and never types on its own again.
 *
 *  The corpus is fabricated sample data for illustration — no request ever
 *  leaves the page, which is also the product's claim.
 */

(function () {
  "use strict";

  /* ── theme ─────────────────────────────────────────────────────────── */

  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("lc-theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) {
    /* private mode / blocked storage — system preference still applies */
  }

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var explicit = root.getAttribute("data-theme");
      var isDark = explicit
        ? explicit === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = isDark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("lc-theme", next);
      } catch (e) {
        /* not persisting is fine; the toggle still works this visit */
      }
    });
  }

  /* ── demo corpus ───────────────────────────────────────────────────── */

  var ICONS = {
    file: '<path d="M9 2H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M9 2v6h6"/>',
    image: '<rect x="2.5" y="3.5" width="14" height="12" rx="2"/><circle cx="7" cy="8" r="1.4"/><path d="M3 13.5 7.5 9.5l3 2.6L13 10l3.5 3.5"/>',
    key: '<circle cx="7" cy="12" r="3.2"/><path d="m9.4 9.6 5.4-5.4M13 6l1.8 1.8M11.4 7.6l1.8 1.8"/>',
    scan: '<path d="M3 6V4.5A1.5 1.5 0 0 1 4.5 3H6M14 3h1.5A1.5 1.5 0 0 1 17 4.5V6M17 13v1.5a1.5 1.5 0 0 1-1.5 1.5H14M6 16H4.5A1.5 1.5 0 0 1 3 14.5V13"/><path d="M6 8.5h8M6 11.5h5"/>',
    chat: '<path d="M16.5 11.5a2 2 0 0 1-2 2H7l-3.5 3v-3a2 2 0 0 1-1-2v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    app: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/>',
  };

  var MAC = "MacBook Pro";
  var PHONE = "iPhone";

  // device: null = this device. score: mirrors merlin's hybrid rank score.
  var CORPUS = [
    { icon: "scan",  badge: "OCR",      title: "IMG_4417.HEIC — Blue Bottle receipt", sub: "~/Pictures/Screenshots", snippet: "BLUE BOTTLE COFFEE · Total $18.40 · Visa ••4417 · 14 Mar 2026", device: PHONE, score: 0.94, kw: "receipt coffee blue bottle visa total expense march" },
    { icon: "file",  badge: "PDF",      title: "AmEx-statement-2026-03.pdf",          sub: "~/Documents/Finance",     snippet: "Statement period 01–31 Mar. New balance $2,184.06. Payment due 18 Apr.", device: null, score: 0.91, kw: "receipt amex statement finance balance payment card invoice march" },
    { icon: "scan",  badge: "OCR",      title: "hardware-invoice-scan.png",           sub: "~/Documents/Receipts",    snippet: "INVOICE #A-9910 · Apple Studio Display · $1,599.00 · paid", device: null, score: 0.88, kw: "receipt invoice hardware apple display paid purchase" },
    { icon: "key",   badge: "Vault",    title: "AWS — root account",                  sub: "Vault · linearcode-prod", snippet: "••••••••••••••••  ·  TOTP enabled  ·  rotated 12 days ago", device: null, score: 0.97, kw: "aws key password root account credential vault secret login prod" },
    { icon: "key",   badge: "Vault",    title: "Stripe — live secret key",            sub: "Vault · linearcode-prod", snippet: "sk_live_••••••••••••••••••••  ·  last used 2h ago", device: null, score: 0.95, kw: "stripe key password secret credential vault api live payment" },
    { icon: "key",   badge: "Vault",    title: "Postgres — pns.linearcode.io",        sub: "Vault · infrastructure",  snippet: "postgres://coco@pns:5432  ·  password ••••••••••••", device: null, score: 0.9,  kw: "postgres password key credential vault database pns server login" },
    { icon: "key",   badge: "Vault",    title: "Apple ID — developer",                sub: "Vault · personal",        snippet: "••••••••••••  ·  passkey + hardware key  ·  synced to " + PHONE, device: PHONE, score: 0.86, kw: "apple id password key credential vault passkey developer login" },
    { icon: "file",  badge: "Markdown", title: "PRODUCT_VISION.md",                   sub: "~/projects/coco/docs",    snippet: "Rite is building a personal content operating system — own, search, transform, act.", device: null, score: 0.84, kw: "vision product roadmap engine local first notes docs coco" },
    { icon: "file",  badge: "Rust",     title: "merlin/src/search/hybrid.rs",         sub: "~/projects/coco/merlin",  snippet: "FTS5 candidates ∪ vector top-k, reciprocal-rank fused, ~20ms p50", device: null, score: 0.82, kw: "search engine code rust merlin hybrid vector fts index local" },
    { icon: "image", badge: "Photo",    title: "whiteboard-fleet-sync.jpg",           sub: "Photos · 8 Aug 2026",     snippet: "Handwriting recognised: “one device → whole portfolio, E2E, no server”", device: PHONE, score: 0.8,  kw: "whiteboard photo fleet sync device notes drawing image" },
    { icon: "file",  badge: "Keynote",  title: "Seed-round-narrative.key",            sub: "~/Documents/Company",     snippet: "Slide 4 — the local data engine: your machine is the datacenter.", device: null, score: 0.78, kw: "deck pitch company seed narrative slides vision engine" },
    { icon: "chat",  badge: "Chat",     title: "Where did the March card charges go?", sub: "Coco chat · 6 messages", snippet: "Grounded in 3 local files · AmEx statement, two OCR'd receipts.", device: null, score: 0.76, kw: "chat march receipt card charges question answer expense" },
    { icon: "image", badge: "Screenshot", title: "passport-page.png",                 sub: "~/Documents/Travel",      snippet: "OCR: surname, given names, passport no. ••••••, expires 2031", device: null, score: 0.74, kw: "passport travel document scan id image ocr personal" },
    { icon: "file",  badge: "Audio",    title: "standup-2026-08-24.m4a",              sub: "~/Recordings",            snippet: "Transcript: “merlin lands cross-device search on iPhone this week.”", device: MAC, score: 0.72, kw: "audio standup transcript meeting recording merlin device" },
    { icon: "app",   badge: "App",      title: "Open Settings",                       sub: "Language, appearance, and this device", snippet: "", device: null, score: 0.4, kw: "settings preferences appearance language device app" },
  ];

  var els = {
    input: document.getElementById("omniInput"),
    caret: document.getElementById("omniCaret"),
    results: document.getElementById("omniResults"),
    count: document.getElementById("omniCount"),
    latency: document.getElementById("omniLatency"),
    hint: document.getElementById("takeoverHint"),
  };
  if (!els.input || !els.results) return;

  var activeIndex = 0;
  var flatRows = [];
  var userOwns = false;

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function highlight(text, terms) {
    var html = escapeHtml(text);
    terms.forEach(function (term) {
      if (term.length < 2) return;
      var re = new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }

  function query(text) {
    var terms = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return CORPUS.map(function (item) {
      var haystack = (item.title + " " + item.sub + " " + item.snippet + " " + item.kw).toLowerCase();
      var hits = terms.filter(function (term) {
        return haystack.indexOf(term) !== -1;
      });
      // Every term must land — same conjunctive posture as the FTS5 query
      // merlin builds, so partial-word noise never fills the list.
      if (hits.length !== terms.length) return null;
      var titleBoost = terms.some(function (t) {
        return item.title.toLowerCase().indexOf(t) !== -1;
      })
        ? 0.06
        : 0;
      return { item: item, score: Math.min(0.99, item.score + titleBoost) };
    })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 8);
  }

  function svg(paths) {
    return (
      '<svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>"
    );
  }

  function render(text) {
    var terms = text.toLowerCase().split(/\s+/).filter(Boolean);
    var matches = query(text);
    flatRows = [];

    if (!text.trim()) {
      els.results.innerHTML =
        '<div class="omni-empty">Everything you own, one keystroke away.<br>' +
        "Try <b>receipt</b>, <b>password</b>, or <b>whiteboard</b>.</div>";
      els.count.textContent = CORPUS.length.toLocaleString() + " items indexed";
      els.latency.textContent = "100% local";
      return;
    }

    if (!matches.length) {
      els.results.innerHTML =
        '<div class="omni-empty">Nothing matched “' + escapeHtml(text) + '”.<br>' +
        "Coco says so instead of inventing an answer.</div>";
      els.count.textContent = "0 results";
      els.latency.textContent = "—";
      return;
    }

    // This device first, then one labelled section per linked device.
    var local = matches.filter(function (m) { return !m.item.device; });
    var byDevice = {};
    matches.forEach(function (m) {
      if (!m.item.device) return;
      (byDevice[m.item.device] = byDevice[m.item.device] || []).push(m);
    });

    var html = "";
    function section(label, rows) {
      if (!rows.length) return;
      if (label) html += '<div class="omni-section">' + escapeHtml(label) + "</div>";
      rows.forEach(function (row) {
        var i = flatRows.length;
        flatRows.push(row);
        html +=
          '<div class="res" role="option" data-i="' + i + '">' +
          '<div class="res-icon">' + svg(ICONS[row.item.icon]) + "</div>" +
          '<div class="res-body">' +
          '<div class="res-title-row"><span class="res-title">' +
          highlight(row.item.title, terms) +
          '</span><span class="res-badge">' + escapeHtml(row.item.badge) + "</span></div>" +
          '<div class="res-sub">' + escapeHtml(row.item.sub) + "</div>" +
          (row.item.snippet
            ? '<div class="res-snippet">' + highlight(row.item.snippet, terms) + "</div>"
            : "") +
          "</div>" +
          '<div class="res-meta">' + row.score.toFixed(2) + "</div>" +
          "</div>";
      });
    }

    section("", local);
    Object.keys(byDevice).forEach(function (device) {
      section("From " + device, byDevice[device]);
    });

    els.results.innerHTML = html;
    var deviceCount = Object.keys(byDevice).length + (local.length ? 1 : 0);
    els.count.textContent =
      matches.length + (matches.length === 1 ? " result" : " results") +
      " · " + deviceCount + (deviceCount === 1 ? " device" : " devices");
    // Deterministic per-query "latency" — honest about being illustrative
    // by staying in merlin's measured 14–26ms band rather than faking 0ms.
    els.latency.textContent = (14 + (text.length * 7) % 13) + "ms · on-device";

    if (activeIndex >= flatRows.length) activeIndex = 0;
    paintActive();
  }

  function paintActive() {
    var rows = els.results.querySelectorAll(".res");
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle("is-active", i === activeIndex);
    }
    var current = rows[activeIndex];
    if (current && userOwns) {
      current.scrollIntoView({ block: "nearest" });
    }
  }

  /* ── input handling ────────────────────────────────────────────────── */

  function takeOver() {
    if (userOwns) return;
    userOwns = true;
    stopAutoplay();
    els.input.removeAttribute("readonly");
    els.caret.classList.add("hidden");
    if (els.hint) {
      els.hint.classList.add("gone");
      window.setTimeout(function () { els.hint.remove(); }, 400);
    }
    els.input.focus();
  }

  els.input.addEventListener("focus", takeOver);
  els.input.addEventListener("pointerdown", takeOver);
  els.results.addEventListener("pointerdown", takeOver);

  els.input.addEventListener("input", function () {
    activeIndex = 0;
    render(els.input.value);
  });

  els.input.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!flatRows.length) return;
      activeIndex =
        (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + flatRows.length) % flatRows.length;
      paintActive();
    } else if (event.key === "Escape") {
      els.input.value = "";
      activeIndex = 0;
      render("");
    }
  });

  els.results.addEventListener("click", function (event) {
    var row = event.target.closest(".res");
    if (!row) return;
    activeIndex = Number(row.dataset.i);
    paintActive();
  });

  // ⌘K / Ctrl+K anywhere on the page focuses the omnibar, exactly as it
  // opens SearchModal in the app.
  window.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("demo").scrollIntoView({ block: "center" });
      takeOver();
    }
  });

  /* ── autoplay ──────────────────────────────────────────────────────── */

  var SCRIPT = ["receipt", "password", "whiteboard"];
  var timers = [];
  var playing = false;

  function later(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function stopAutoplay() {
    playing = false;
    timers.forEach(window.clearTimeout);
    timers = [];
  }

  function typeQuery(text, done) {
    var i = 0;
    (function step() {
      if (!playing) return;
      els.input.value = text.slice(0, ++i);
      render(els.input.value);
      if (i < text.length) later(step, 78 + Math.random() * 55);
      else later(done, 2600);
    })();
  }

  function eraseQuery(done) {
    (function step() {
      if (!playing) return;
      var value = els.input.value;
      if (!value) return later(done, 480);
      els.input.value = value.slice(0, -1);
      render(els.input.value);
      later(step, 34);
    })();
  }

  function loop(index) {
    if (!playing) return;
    timers = []; // the only timer that could be pending here is the one that
    // just fired to call us — safe to drop the ids and keep the list short.
    typeQuery(SCRIPT[index % SCRIPT.length], function () {
      eraseQuery(function () {
        loop(index + 1);
      });
    });
  }

  function startAutoplay() {
    if (userOwns || playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.input.value = SCRIPT[0];
      render(SCRIPT[0]);
      return;
    }
    playing = true;
    loop(0);
  }

  render("");

  // Only start once the demo is actually on screen — no typing into a
  // window the visitor has already scrolled past.
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            later(startAutoplay, 700);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );
    observer.observe(document.getElementById("demo"));
  } else {
    later(startAutoplay, 900);
  }
})();
