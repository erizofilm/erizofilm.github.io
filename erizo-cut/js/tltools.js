/* Herramientas de la línea de tiempo: barra de iconos, corte fiable, recortes, borrado con ondulación, mano e imán. */
(function () {
  "use strict";
  var ed, tool = "select", bar, btn = {};
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function toast(m) { var t = el("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2400); }
  function K() { return (window.ErizoUI && window.ErizoUI.k) || 1; }
  function trackOn(c) { for (var i = 0; i < ed.allTracks.length; i++) if (ed.allTracks[i].id === c.trackId) return ed.allTracks[i].enabled !== false; return true; }
  function selClips() {
    var ids = ed.selectedIds && ed.selectedIds.size ? Array.from(ed.selectedIds) : ed.selectedId ? [ed.selectedId] : [];
    return ids.map(function (id) { return ed.clips.filter(function (c) { return c.id == id; })[0]; }).filter(Boolean);
  }
  function crosses(c, t) { return t > c.start + 0.02 && t < c.start + c.duration - 0.02; }
  /* Con selección: solo lo seleccionado que cruce el cabezal. Si ninguno lo cruza (o no hay selección): todos los clips bajo el cabezal. */
  function targets(t) {
    var s = selClips().filter(function (c) { return crosses(c, t); });
    if (!s.length) s = ed.clips.filter(function (c) { return crosses(c, t) && trackOn(c); });
    var out = s.slice();
    s.forEach(function (c) { var p = ed.getLinkedClip(c); if (p && out.indexOf(p) < 0 && crosses(p, t)) out.push(p); });
    return out;
  }
  function interp(l, x) {
    if (!l.length) return 0; if (x <= l[0].t) return l[0].v; var n = l.length - 1; if (x >= l[n].t) return l[n].v;
    for (var i = 0; i < n; i++) if (x <= l[i + 1].t) return l[i].v + (l[i + 1].v - l[i].v) * (x - l[i].t) / (l[i + 1].t - l[i].t);
  }
  var seq = 0;
  function splitOne(cl, t) {
    var off = t - cl.start, orig = cl.duration, sp = cl.speed || 1, id = Date.now() + Math.random() + (seq++);
    var still = cl.type === "image" || cl.type === "text" || cl.type === "fx";
    var nc = Object.assign({}, cl, { id: id, start: t, duration: orig - off, srcStart: still ? 0 : (cl.srcStart || 0) + off * sp, linkId: null, linkedTo: null });
    cl.duration = off;
    ed.transforms[id] = JSON.parse(JSON.stringify(ed.transforms[cl.id] || ed.defaultTransform));
    if (cl.type === "text") ed.textStyles[id] = Object.assign({}, ed.textStyles[cl.id] || {}, { id: id });
    if (cl.type === "audio") ed.audioElements[id] = new Audio(nc.url);
    var a = ed.anim && ed.anim[cl.id];
    if (a) { ed.anim[id] = Object.assign({}, a, { inT: "", inD: 0 }); a.outT = ""; a.outD = 0; }
    var k = ed.kfs && ed.kfs[cl.id];
    if (k) {
      var nk = {}; Object.keys(k).forEach(function (p) {
        var l = k[p]; if (!l || !l.length) return; var v = interp(l, off);
        nk[p] = [{ t: 0, v: v }].concat(l.filter(function (x) { return x.t > off + 0.001; }).map(function (x) { return { t: x.t - off, v: x.v }; }));
        k[p] = l.filter(function (x) { return x.t < off - 0.001; }).concat([{ t: off, v: v }]);
      });
      ed.kfs[id] = nk;
    }
    ed.clips.splice(ed.clips.indexOf(cl) + 1, 0, nc);
    return nc;
  }
  function split() {
    var t = ed.timelineTime, list = targets(t);
    if (!list.length) return toast("No hay ningún clip bajo el cabezal para cortar.");
    var made = new Map();
    list.forEach(function (c) { made.set(c, splitOne(c, t)); });
    list.forEach(function (c) { /* reenlazar las mitades derechas entre sí */
      var p = ed.getLinkedClip(c); var n = made.get(c), np = p && made.get(p);
      if (n && np) { n.linkId = n.linkedTo = np.id; }
    });
    ed.selectedIds = new Set(); ed.selectedId = null; ed.selectedTextId = null;
    refresh("Dividir " + list.length);
  }
  function trim(side) {
    var t = ed.timelineTime, list = targets(t);
    if (!list.length) return toast("No hay ningún clip bajo el cabezal para recortar.");
    list.forEach(function (c) {
      var off = t - c.start, still = c.type === "image" || c.type === "text" || c.type === "fx";
      if (side === "start") { c.start = t; c.duration -= off; if (!still) c.srcStart = (c.srcStart || 0) + off * (c.speed || 1); }
      else c.duration = off;
    });
    refresh(side === "start" ? "Recortar inicio" : "Recortar final");
  }
  function rippleDelete() {
    var list = selClips(); if (!list.length) return toast("Selecciona clips para eliminar.");
    var all = new Set(list); list.forEach(function (c) { var p = ed.getLinkedClip(c); if (p) all.add(p); });
    var gaps = Array.from(all).map(function (c) { return { tr: c.trackId, s: c.start, e: c.start + c.duration }; });
    ed.selectedIds = new Set(Array.from(all).map(function (c) { return c.id; })); ed.selectedId = list[0].id;
    ed.deleteSelected();
    gaps.sort(function (a, b) { return b.s - a.s; }).forEach(function (g) {
      ed.clips.forEach(function (c) { if (c.trackId === g.tr && c.start >= g.e - 0.001) c.start = Math.max(0, c.start - (g.e - g.s)); });
    });
    refresh("Borrar con ondulación");
  }
  function refresh(label) {
    try { ed.renderAll(); ed.updateMetrics(); ed.syncToTimeline(); ed.updateSelectionInfo(); ed.pushHistory(label); } catch (e) { console.error("[Erizo] tltools", e); }
  }

  /* ---- herramienta mano ---- */
  function setTool(t) {
    tool = t; document.body.classList.toggle("tool-hand", t === "hand");
    if (btn.sel) { btn.sel.classList.toggle("on", t === "select"); btn.hand.classList.toggle("on", t === "hand"); }
  }
  function bindHand() {
    var tk = ed.tracksContainer, pan = null;
    tk.addEventListener("mousedown", function (e) {
      if (tool !== "hand" || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation(); pan = { x: e.clientX, y: e.clientY, l: tk.scrollLeft, t: tk.scrollTop }; document.body.classList.add("panning");
    }, true);
    document.addEventListener("mousemove", function (e) { if (!pan) return; tk.scrollLeft = pan.l - (e.clientX - pan.x) / K(); tk.scrollTop = pan.t - (e.clientY - pan.y) / K(); });
    document.addEventListener("mouseup", function () { pan = null; document.body.classList.remove("panning"); });
  }

  /* ---- imán (ajuste a bordes de clips y cabezal) ---- */
  function setSnap(on) {
    ed.snapEnabled = !!on; if (btn.snap) btn.snap.classList.toggle("on", !!on);
    try { localStorage.setItem("erizocut.snap", on ? "1" : "0"); } catch (e) {}
    if (window.ErizoSettings) { ErizoSettings.snap = !!on; }
  }

  /* ---- barra de iconos ---- */
  function add(id, icon, title, fn, cls) {
    var b = el("button", "tt-btn" + (cls ? " " + cls : "")); b.innerHTML = icon; b.title = title; b.onclick = fn; bar.appendChild(b); btn[id] = b; return b;
  }
  function sep() { bar.appendChild(el("span", "tt-sep")); }
  function build() {
    var head = document.querySelector(".timeline-header"); if (!head) return;
    bar = el("div", "tl-tools");
    add("add", "＋", "Agregar pista o texto", function (e) {
      var r = e.currentTarget.getBoundingClientRect();
      ErizoTracks.openMenu(r.left, r.bottom + 2, [{ t: "🎬 Pista de video", fn: function () { ed.addTrack("video"); } }, { t: "🎵 Pista de audio", fn: function () { ed.addTrack("audio"); } }, "-", { t: "T Texto en el cabezal", fn: function () { ed.addText(); } }]);
    }); sep();
    add("undo", "↶", "Deshacer (Ctrl+Z)", function () { ed.undo(); });
    add("redo", "↷", "Rehacer (Ctrl+Shift+Z)", function () { ed.redo(); }); sep();
    add("split", '<svg viewBox="0 0 24 24"><path d="M5 5h4v14H5zM15 5h4v14h-4zM12 3v18" fill="none" stroke="currentColor" stroke-width="2"/></svg>', "Dividir en el cabezal (S)", split);
    add("trimS", '<svg viewBox="0 0 24 24"><path d="M4 5v14M4 12h9M10 8l4 4-4 4M17 5v14" fill="none" stroke="currentColor" stroke-width="2"/></svg>', "Recortar el inicio hasta el cabezal (Q)", function () { trim("start"); });
    add("trimE", '<svg viewBox="0 0 24 24"><path d="M20 5v14M20 12h-9M14 8l-4 4 4 4M7 5v14" fill="none" stroke="currentColor" stroke-width="2"/></svg>', "Recortar el final desde el cabezal (W)", function () { trim("end"); });
    add("del", '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2"/></svg>', "Eliminar selección (Supr)", function () { ed.deleteSelected(); });
    add("rip", '<svg viewBox="0 0 24 24"><path d="M4 6h6v12H4zM14 12h7M18 8l3 4-3 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>', "Eliminar y cerrar el hueco (Mayús+Supr)", rippleDelete); sep();
    add("sel", "➤", "Herramienta de selección (V)", function () { setTool("select"); }, "on");
    add("hand", "✋", "Herramienta mano: arrastra para mover la línea de tiempo (H)", function () { setTool("hand"); }); sep();
    add("snap", "🧲", "Imán: ajustar a bordes de clips y cabezal (N)", function () { setSnap(!ed.snapEnabled); }, "on");
    add("link", "🔗", "Enlazar / desenlazar audio y video de la selección", function () {
      var s = selClips(); if (!s.length) return toast("Selecciona clips primero.");
      if (s.some(function (c) { return c.linkId || c.linkedTo; })) ed.unlinkSelected(); else ed.linkSelected();
    }); sep();
    add("text", "T", "Agregar texto en el cabezal", function () { ed.addText(); });
    add("audio", "🔊", "Importar audio a la Biblioteca", function () {
      var i = document.getElementById("file-input"); if (!i) return; var old = i.accept; i.accept = "audio/*"; i.click(); setTimeout(function () { i.accept = old; }, 800);
    });
    add("mic", "🎤", "Grabar voz (se guarda en la Biblioteca)", function () {
      ErizoMedia.toggleRecord(function (s) { btn.mic.classList.toggle("rec", s != null); btn.mic.textContent = s == null ? "🎤" : "⏹ " + s + "s"; });
    });
    var zc = head.querySelector(".zoom-controls"); head.insertBefore(bar, zc);
  }
  function syncState() {
    if (!ed || !btn.undo) return;
    btn.undo.disabled = ed.historyIndex <= 0; btn.redo.disabled = ed.historyIndex >= ed.history.length - 1;
    var none = !ed.clips.length; ["split", "trimS", "trimE"].forEach(function (k) { btn[k].disabled = none; });
    var nosel = !selClips().length; btn.del.disabled = nosel; btn.rip.disabled = nosel;
    btn.snap.classList.toggle("on", !!ed.snapEnabled);
  }

  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; if (!ed) return;
    try {
      ed.splitAtPlayhead = split; ed.trimToPlayhead = trim; ed.rippleDelete = rippleDelete;
      build(); bindHand();
      var s = localStorage.getItem("erizocut.snap"); setSnap(s == null ? true : s === "1");
      setInterval(syncState, 250);
      document.addEventListener("keydown", function (e) {
        var tg = e.target, tag = tg && tg.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.code === "KeyQ") { e.preventDefault(); trim("start"); }
        else if (e.code === "KeyW") { e.preventDefault(); trim("end"); }
        else if (e.code === "KeyV") setTool("select");
        else if (e.code === "KeyH") setTool("hand");
        else if (e.code === "KeyN") setSnap(!ed.snapEnabled);
        else if ((e.code === "Delete" || e.code === "Backspace") && e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); rippleDelete(); }
      }, true);
    } catch (e) { console.error("[Erizo] tltools", e); }
  });
  window.ErizoTools = { setSnap: setSnap, setTool: setTool, split: split };
})();
