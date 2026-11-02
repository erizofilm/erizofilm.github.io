/* Workspace por acoplamiento: los paneles se insertan en cualquier lado y empujan a los vecinos. */
(function () {
  "use strict";
  var KEY = "erizocut.layout.v6";
  var P = {
    library: { n: "Biblioteca", i: "🗂" }, preview: { n: "Vista previa", i: "🖼" }, inspector: { n: "Inspector", i: "⚙" },
    keyframes: { n: "Fotogramas clave", i: "◇" }, timeline: { n: "Línea de tiempo", i: "☰" }
  };
  var IDS = Object.keys(P);
  function L(id) { return { t: "p", id: id }; }
  function B(dir, a) { return { t: "s", dir: dir, kids: a.map(function (x) { return x[0]; }), w: a.map(function (x) { return x[1]; }) }; }
  var PRESETS = {
    default: { n: "Predeterminada", mk: function () { return B("v", [[B("h", [[L("library"), 1], [L("preview"), 2.3], [L("inspector"), 1.1]]), 1.5], [L("timeline"), 1]]); } },
    short: { n: "Short", mk: function () { return B("h", [[B("v", [[L("library"), 1], [L("timeline"), 1.25]]), 2.3], [L("preview"), 1], [L("inspector"), 1]]); } },
    anim: { n: "Animación", mk: function () { return B("v", [[B("h", [[L("preview"), 2], [L("inspector"), 1.1]]), 1.4], [B("h", [[L("keyframes"), 1.3], [L("timeline"), 2]]), 1]]); } },
    all: { n: "Todo a la vista", mk: function () { return B("v", [[B("h", [[L("library"), 1], [L("preview"), 1.6], [L("inspector"), 1]]), 1.3], [B("h", [[L("keyframes"), 1], [L("timeline"), 2.6]]), 1]]); } },
    focus: { n: "Vista previa grande", mk: function () { return B("h", [[B("v", [[L("preview"), 1.7], [L("timeline"), 1]]), 2], [L("inspector"), 1]]); } }
  };
  var S, nodes = {}, rootEl, park, banner, placing = null, dragId = null, timer;

  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function valid(n, seen) {
    if (!n) return false;
    if (n.t === "p") { if (!P[n.id] || seen[n.id]) return false; seen[n.id] = 1; return true; }
    return n.t === "s" && (n.dir === "h" || n.dir === "v") && n.kids && n.kids.length >= 2 && n.w && n.w.length === n.kids.length &&
      n.w.every(function (x) { return x > 0; }) && n.kids.every(function (k) { return valid(k, seen); });
  }
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!S || !("root" in S) || (S.root !== null && !valid(S.root, {}))) S = { root: PRESETS.default.mk() };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function refit() {
    clearTimeout(timer);
    timer = setTimeout(function () { try { if (window.editor && window.editor.setPreviewZoom) window.editor.updatePreviewBoxSize(); } catch (e) {} }, 150);
  }
  function commit() { if (S.root) S.root = norm(S.root); render(); save(); refit(); }

  /* ---- árbol de paneles ---- */
  function leaves(n, o) { o = o || []; if (!n) return o; if (n.t === "p") o.push(n); else n.kids.forEach(function (k) { leaves(k, o); }); return o; }
  function byId(id) { return leaves(S.root).filter(function (x) { return x.id === id; })[0]; }
  function where(t, n, p, i) {
    if (!n) return null; if (n === t) return { p: p, i: i };
    if (n.t === "s") for (var k = 0; k < n.kids.length; k++) { var r = where(t, n.kids[k], n, k); if (r) return r; }
    return null;
  }
  function norm(n) {
    if (n.t === "p") return n;
    var kids = [], w = [];
    n.kids.forEach(function (k, i) {
      k = norm(k);
      if (k.t === "s" && k.dir === n.dir) { var s = sum(k.w); k.kids.forEach(function (c, j) { kids.push(c); w.push(n.w[i] * k.w[j] / s); }); }
      else { kids.push(k); w.push(n.w[i]); }
    });
    n.kids = kids; n.w = w; return n;
  }
  function insert(T, N, zone) {
    var dir = zone === "l" || zone === "r" ? "h" : "v", before = zone === "l" || zone === "t", f = where(T, S.root, null, 0);
    if (f.p && f.p.dir === dir) {
      var k = f.p.kids.indexOf(T), w = f.p.w[k] / 2;
      f.p.w[k] = w; f.p.kids.splice(before ? k : k + 1, 0, N); f.p.w.splice(before ? k : k + 1, 0, w);
    } else {
      var box = { t: "s", dir: dir, kids: before ? [N, T] : [T, N], w: [1, 1] };
      if (f.p) f.p.kids[f.i] = box; else S.root = box;
    }
  }
  function remove(T) {
    var f = where(T, S.root, null, 0); if (!f) return;
    if (!f.p) { S.root = null; return; }
    var P0 = f.p; P0.kids.splice(f.i, 1); P0.w.splice(f.i, 1);
    if (P0.kids.length === 1) { var g = where(P0, S.root, null, 0); if (g.p) g.p.kids[g.i] = P0.kids[0]; else S.root = P0.kids[0]; }
  }
  function move(id, T, zone) {
    var A = byId(id); if (!A || A === T) return;
    if (zone === "c") { var t = A.id; A.id = T.id; T.id = t; return commit(); }
    remove(A); insert(T, A, zone); commit();
  }
  function autoPlace(id) {
    var dir = id === "timeline" ? "v" : "h";
    S.root = S.root ? B(dir, [[S.root, dir === "v" ? 2.2 : 3.2], [L(id), 1]]) : L(id); commit();
  }

  function bindBar(sp, n, i) {
    sp.title = "Arrastra para cambiar el tamaño · doble clic = igualar";
    sp.onpointerdown = function (ev) {
      ev.preventDefault(); sp.setPointerCapture(ev.pointerId); sp.classList.add("active"); document.body.classList.add("ws-dragging");
      var a = sp.previousElementSibling, b = sp.nextElementSibling, h = n.dir === "h", wa = h ? a.offsetWidth : a.offsetHeight, wb = h ? b.offsetWidth : b.offsetHeight;
      var p0 = h ? ev.clientX : ev.clientY, tot = n.w[i] + n.w[i + 1], min = h ? 100 : 80;
      sp.onpointermove = function (me) {
        var kk = (window.ErizoUI && window.ErizoUI.k) || 1, x = Math.max(min, Math.min(wa + wb - min, wa + ((h ? me.clientX : me.clientY) - p0) / kk));
        n.w[i] = x / (wa + wb) * tot; n.w[i + 1] = tot - n.w[i]; a.style.flex = n.w[i] + " 1 0px"; b.style.flex = n.w[i + 1] + " 1 0px";
      };
      sp.onpointerup = function () { sp.onpointermove = sp.onpointerup = null; sp.classList.remove("active"); document.body.classList.remove("ws-dragging"); save(); refit(); };
    };
    sp.ondblclick = function () { n.w[i] = n.w[i + 1] = (n.w[i] + n.w[i + 1]) / 2; commit(); };
  }

  /* ---- zonas de acoplamiento ---- */
  function zoneOf(e, root, center) {
    var r = root.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (center && x > 0.28 && x < 0.72 && y > 0.28 && y < 0.72) return "c";
    var dx = (x - 0.5) * r.width, dy = (y - 0.5) * r.height;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "l" : "r") : (dy < 0 ? "t" : "b");
  }
  function showDrop(root, z) {
    var d = root.querySelector(".ws-drop"), s = d.style; s.display = "block";
    s.left = z === "r" ? "50%" : z === "c" ? "20%" : "0"; s.top = z === "b" ? "50%" : z === "c" ? "20%" : "0";
    s.width = z === "l" || z === "r" ? "50%" : z === "c" ? "60%" : "100%"; s.height = z === "t" || z === "b" ? "50%" : z === "c" ? "60%" : "100%";
  }
  function hideDrops() { rootEl.querySelectorAll(".ws-drop").forEach(function (d) { d.style.display = "none"; }); }
  function startPlace(id) {
    if (!S.root) { S.root = L(id); return commit(); }
    placing = id; document.body.classList.add("ws-placing"); banner.replaceChildren();
    var t = el("span"); t.textContent = "Elige dónde poner «" + P[id].n + "»: haz clic en el lado de un panel donde quieras insertarlo.";
    var a = el("button"); a.textContent = "Automático"; a.onclick = function () { var i = placing; endPlace(); autoPlace(i); };
    var c = el("button"); c.textContent = "Cancelar"; c.onclick = endPlace; banner.append(t, a, c); banner.style.display = "flex";
  }
  function endPlace() { placing = null; document.body.classList.remove("ws-placing"); banner.style.display = "none"; hideDrops(); }

  /* ---- DOM ---- */
  function panelEl(n) {
    var root = el("div", "ws-panel"), head = el("div", "ws-head"), body = el("div", "ws-body"), drop = el("div", "ws-drop"), cover = el("div", "ws-cover");
    var t = el("span", "t"), cl = el("button", "ws-btn", { title: "Cerrar panel" });
    t.textContent = P[n.id].i + " " + P[n.id].n; cl.textContent = "✕"; cl.title = "Cerrar panel";
    cl.onclick = function () { remove(n); commit(); };
    head.draggable = true; head.title = "Arrastra a cualquier lado de otro panel (o al centro para intercambiar)";
    head.ondragstart = function (e) { dragId = n.id; e.dataTransfer.setData("text/plain", n.id); e.dataTransfer.effectAllowed = "move"; root.classList.add("dragging"); };
    head.ondragend = function () { dragId = null; root.classList.remove("dragging"); hideDrops(); };
    root.ondragover = function (e) { if (dragId && dragId !== n.id) { e.preventDefault(); showDrop(root, zoneOf(e, root, true)); } };
    root.ondragleave = function (e) { if (!root.contains(e.relatedTarget)) drop.style.display = "none"; };
    root.ondrop = function (e) { e.preventDefault(); var id = dragId, z = zoneOf(e, root, true); dragId = null; hideDrops(); move(id, n, z); };
    cover.onmousemove = function (e) { if (placing) showDrop(root, zoneOf(e, root, false)); };
    cover.onmouseleave = function () { drop.style.display = "none"; };
    cover.onclick = function (e) {
      e.stopPropagation(); if (!placing) return; var id = placing, z = zoneOf(e, root, false); endPlace(); insert(n, L(id), z); commit();
    };
    head.append(t, cl); body.appendChild(nodes[n.id]); root.append(head, body, drop, cover);
    return root;
  }
  function build(n) {
    if (n.t === "p") return panelEl(n);
    var box = el("div", "ws-box " + n.dir);
    n.kids.forEach(function (k, i) {
      if (i) { var sp = el("div", "ws-split " + (n.dir === "h" ? "v" : "h")); box.appendChild(sp); bindBar(sp, n, i - 1); }
      var c = build(k); c.style.flex = n.w[i] + " 1 0px"; box.appendChild(c);
    });
    return box;
  }
  function render() {
    IDS.forEach(function (k) { park.appendChild(nodes[k]); });
    rootEl.replaceChildren();
    if (S.root) rootEl.appendChild(build(S.root));
    else { var m = el("div", "ws-none"); m.textContent = "No hay paneles. Ábrelos desde Ver → Paneles o elige un modo de estudio."; rootEl.appendChild(m); }
    renderMenus();
  }
  function item(box, txt, on, fn) {
    var b = el("button"); b.innerHTML = (on === null ? "" : '<span class="ws-check">' + (on ? "✓" : "") + "</span>") + txt; b.onclick = fn; box.appendChild(b);
  }
  function renderMenus() {
    var ver = document.getElementById("ws-ver"), win = document.getElementById("ws-menu");
    if (ver) {
      ver.replaceChildren(); var d = el("div", "ws-mlabel"); d.textContent = "Paneles"; ver.appendChild(d);
      IDS.forEach(function (k) {
        var n = byId(k);
        item(ver, P[k].i + " " + P[k].n, !!n, function () { if (!n) return startPlace(k); remove(n); commit(); });
      });
    }
    if (win) {
      win.replaceChildren();
      Object.keys(PRESETS).forEach(function (k) { item(win, PRESETS[k].n, null, function () { endPlace(); S = { root: PRESETS[k].mk() }; commit(); }); });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".main"), right = document.querySelector(".right-panel");
    var center = document.querySelector(".center"), tl = document.querySelector(".timeline-container");
    if (!main || !right || !center || !tl) return;
    nodes = {
      library: document.getElementById("panel-library"), preview: center, inspector: right,
      keyframes: document.getElementById("panel-keyframes"), timeline: tl
    };
    rootEl = el("div"); rootEl.id = "ws"; park = el("div"); park.id = "ws-park"; banner = el("div", "ws-banner"); banner.style.display = "none";
    main.appendChild(rootEl); document.body.append(park, banner);
    document.addEventListener("keydown", function (e) { if (placing && e.key === "Escape") endPlace(); }, true);
    render(); refit(); window.addEventListener("resize", refit);
  });
})();
