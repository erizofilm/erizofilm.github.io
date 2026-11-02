/* Inspector: secciones Fusión, Quitar fondo, Máscara, Recortar y Estabilizar (estilo Concat). */
(function () {
  "use strict";
  var ed, root, ctl = {}, lastSig = "", analyzing = null;
  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function toast(m) { var t = mk("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function vis() { return Anim.sel().filter(function (c) { return c.type === "video" || c.type === "image"; }); }
  function cur() { return vis()[0] || null; }
  function each(fn, label) {
    vis().forEach(function (c) { fn(Anim.trOf(c.id), c); ErizoLook.invalidate(c.id); });
    try { ed.syncToTimeline(); } catch (e) {} lastSig = "";
  }
  function hist(l) { try { ed.pushHistory(l); } catch (e) {} }

  /* ---------- piezas de interfaz ---------- */
  function section(title, o) {
    o = o || {};
    var s = mk("div", "isec"), h = mk("div", "isec-h"), b = mk("div", "isec-b"), chev = mk("i", "chev", "⌄"), t = mk("span", "ttl"), cb = null;
    if (o.check) { cb = mk("input"); cb.type = "checkbox"; cb.className = "isec-chk"; cb.onclick = function (e) { e.stopPropagation(); }; cb.onchange = function () { o.check(cb.checked); }; h.appendChild(cb); }
    t.textContent = title; h.appendChild(t);
    if (o.help) { var q = mk("span", "isec-q", "?"); q.title = o.help; q.onclick = function (e) { e.stopPropagation(); toast(o.help); }; h.appendChild(q); }
    h.appendChild(chev); s.append(h, b);
    h.onclick = function () { s.classList.toggle("closed"); };
    if (o.closed) s.classList.add("closed");
    return { root: s, body: b, check: cb };
  }
  function row(label, node, cls) { var r = mk("div", "irow" + (cls ? " " + cls : "")), l = mk("label"); l.textContent = label; r.append(l); if (node) r.appendChild(node); return r; }
  function num(min, max, step, unit, inp, chg) {
    var w = mk("div", "inum"), i = mk("input"), u = mk("span"); i.type = "number"; i.min = min; i.max = max; i.step = step; i.value = min; u.textContent = unit || "";
    i.oninput = function () { var v = parseFloat(i.value); if (isFinite(v)) inp(clamp(v, min, max)); }; i.onchange = function () { var v = parseFloat(i.value); i.value = clamp(isFinite(v) ? v : min, min, max); chg(); };
    w.append(i); if (unit) w.appendChild(u); w.input = i; return w;
  }
  function rng(min, max, step, inp, chg) {
    var i = mk("input", "irng"); i.type = "range"; i.min = min; i.max = max; i.step = step; i.oninput = function () { inp(parseFloat(i.value)); }; i.onchange = chg; return i;
  }
  function toggle(fn) { var l = mk("label", "itoggle"), i = mk("input"); i.type = "checkbox"; i.onchange = function () { fn(i.checked); }; l.append(i, mk("span", "knob")); l.input = i; return l; }
  function chk(txt, fn) { var l = mk("label", "ichk"), i = mk("input"); i.type = "checkbox"; i.onchange = function () { fn(i.checked); }; l.append(i, mk("span", "box"), mk("span", "", txt)); l.input = i; return l; }
  function setIfIdle(el, v) { if (document.activeElement !== el && el.value !== String(v)) el.value = v; }

  /* ---------- Fusión ---------- */
  function buildFusion() {
    var s = section("Fusión");
    var w = mk("div", "iop"), op = $("clip-op-num"), pc = mk("span", "unit", "%"), pv = mk("button", "ikf", "‹"), dm = mk("button", "ikf dia", "◇"), nx = mk("button", "ikf", "›");
    op.classList.add("iop-in"); w.append(op, pc, pv, dm, nx);
    var oldRow = $("clip-op") ? $("clip-op").closest(".transform-row") : null; if (oldRow) oldRow.style.display = "none";
    function kfl(c, make) { var m = ed.kfs[c.id] || (make ? (ed.kfs[c.id] = {}) : null); return m ? m.opacity || (make ? (m.opacity = []) : null) : null; }
    function rel(c) { return clamp(ed.timelineTime - c.start, 0, c.duration); }
    function near(l, t) { for (var i = 0; i < l.length; i++) if (Math.abs(l[i].t - t) < 0.05) return i; return -1; }
    dm.onclick = function () {
      var c = cur(); if (!c) return; var l = kfl(c, true), t = rel(c), i = near(l, t), tr = Anim.trOf(c.id);
      if (i >= 0) l.splice(i, 1); else { l.push({ t: t, v: tr.opacity == null ? 1 : tr.opacity }); l.sort(function (a, b) { return a.t - b.t; }); }
      if (!l.length) { delete ed.kfs[c.id].opacity; if (!Object.keys(ed.kfs[c.id]).length) delete ed.kfs[c.id]; }
      hist("Fotograma clave"); lastSig = "";
    };
    function jump(dir) { var c = cur(), l = c && kfl(c, false); if (!l) return; var t = rel(c), r = null; l.forEach(function (x) { if (dir < 0 && x.t < t - 0.02) r = x; if (dir > 0 && x.t > t + 0.02 && !r) r = x; }); if (r) { ed.timelineTime = c.start + r.t; ed.syncToTimeline(); ed.updatePlayheadPos(); } }
    pv.onclick = function () { jump(-1); }; nx.onclick = function () { jump(1); };
    ctl.dia = dm; ctl.kfl = kfl; ctl.rel = rel; ctl.near = near;
    var r1 = row("Opacidad", w); s.body.appendChild(r1);
    var sel = mk("select", "isel"); ErizoLook.BLEND.forEach(function (b) { var o = mk("option"); o.value = b[0]; o.textContent = b[1]; sel.appendChild(o); });
    sel.onchange = function () { each(function (tr) { tr.blend = sel.value; }); hist("Modo de fusión"); }; ctl.blend = sel; s.body.appendChild(row("Modo", sel));
    ctl.fh = toggle(function (v) { each(function (tr) { tr.flipX = v; }); hist("Voltear"); }); s.body.appendChild(row("Voltear horizontal", ctl.fh));
    ctl.fv = toggle(function (v) { each(function (tr) { tr.flipY = v; }); hist("Voltear"); }); s.body.appendChild(row("Voltear vertical", ctl.fv));
    return s;
  }

  /* ---------- Quitar fondo ---------- */
  function keyOf(tr) { return tr.key || (tr.key = { on: false, mode: "auto", color: "#00ff00", tol: 40, soft: 20, spill: true }); }
  function buildKey() {
    var s = section("Quitar fondo", { check: function (v) { each(function (tr) { var k = keyOf(tr); k.on = v; if (v && (!k.mode || k.mode === "none")) k.mode = "auto"; }); hist("Quitar fondo"); },
      help: "Quita el fondo sin IA: «automática» toma el color de los bordes del fotograma; «manual» y «croma» usan el color que elijas (también desde la vista previa)." });
    ctl.keyOn = s.check; ctl.key = {};
    var modes = [["auto", "Eliminación automática"], ["manual", "Eliminación manual"], ["chroma", "Croma"]];
    modes.forEach(function (m) {
      var c = chk(m[1], function (v) { each(function (tr) { var k = keyOf(tr); if (v) { k.mode = m[0]; k.on = true; } else if (k.mode === m[0]) k.on = false; }); hist("Quitar fondo"); });
      var r = mk("div", "irow mode"); r.appendChild(c);
      if (m[0] === "manual") { var rs = mk("button", "ireset", "⟲"); rs.title = "Restablecer color"; rs.onclick = function () { each(function (tr) { keyOf(tr).color = "#00ff00"; }); hist("Quitar fondo"); }; r.appendChild(rs); }
      s.body.appendChild(r); ctl.key[m[0]] = c;
    });
    var box = mk("div", "ikey"); ctl.keybox = box;
    var col = mk("input", "icol"); col.type = "color"; col.oninput = function () { each(function (tr) { keyOf(tr).color = col.value; }); }; col.onchange = function () { hist("Color de croma"); }; ctl.col = col;
    var pk = mk("button", "ibtn", "💧 Elegir en la vista previa"); pk.onclick = pickColor;
    var cr = mk("div", "ictl"); cr.append(col, pk); ctl.colrow = row("Color", cr);
    var pr = mk("div", "ipre"); [["#00ff00", "Verde"], ["#0000ff", "Azul"]].forEach(function (p) { var b = mk("button", "ibtn", p[1]); b.onclick = function () { each(function (tr) { keyOf(tr).color = p[0]; }); hist("Color de croma"); }; pr.appendChild(b); }); ctl.prerow = row("Predefinidos", pr);
    ctl.tol = rng(0, 100, 1, function (v) { each(function (tr) { keyOf(tr).tol = v; }); }, function () { hist("Quitar fondo"); });
    ctl.soft = rng(0, 100, 1, function (v) { each(function (tr) { keyOf(tr).soft = v; }); }, function () { hist("Quitar fondo"); });
    ctl.spill = chk("Reducir reflejo del color (spill)", function (v) { each(function (tr) { keyOf(tr).spill = v; }); hist("Quitar fondo"); });
    var sr = mk("div", "irow"); sr.appendChild(ctl.spill); ctl.spillrow = sr;
    box.append(ctl.colrow, ctl.prerow, row("Tolerancia", ctl.tol), row("Suavizado", ctl.soft), sr); s.body.appendChild(box);
    return s;
  }
  function pickColor() {
    var c = cur(), el = c && ed.layerElements[c.id]; if (!el) return toast("Selecciona un clip de video o imagen.");
    toast("Haz clic en el color que quieres quitar dentro de la vista previa.");
    var box = ed.previewBox; box.style.cursor = "crosshair";
    function done(e) {
      document.removeEventListener("mousedown", done, true); box.style.cursor = ""; e.preventDefault(); e.stopPropagation();
      var r = box.getBoundingClientRect(), W = box.offsetWidth, H = box.offsetHeight, tr = Anim.trOf(c.id);
      var px = (e.clientX - r.left) / r.width * W - W / 2 - (tr.x || 0), py = (e.clientY - r.top) / r.height * H - H / 2 - (tr.y || 0);
      var a = -(tr.rot || 0) * Math.PI / 180, rx = px * Math.cos(a) - py * Math.sin(a), ry = px * Math.sin(a) + py * Math.cos(a);
      var sx = (tr.scale || 1) * (tr.scaleX || 1) * (tr.flipX ? -1 : 1), sy = (tr.scale || 1) * (tr.scaleY || 1) * (tr.flipY ? -1 : 1);
      var lx = rx / sx + W / 2, ly = ry / sy + H / 2, mw = el.videoWidth || el.naturalWidth, mh = el.videoHeight || el.naturalHeight;
      var f = ErizoLook.fit(W, H, mw, mh), nx = (lx - f.x) / f.w, ny = (ly - f.y) / f.h;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return toast("Ese punto está fuera del clip.");
      var hx = ErizoLook.pick(el, nx, ny); if (!hx) return;
      each(function (t2) { var k = keyOf(t2); k.color = hx; k.on = true; if (k.mode === "auto") k.mode = "manual"; }); hist("Color de croma");
    }
    document.addEventListener("mousedown", done, true);
  }

  /* ---------- Máscara ---------- */
  var MASKS = [["none", "Sin máscara", '<path d="M6 6l12 12M18 6L6 18"/>'], ["top", "Lineal", '<path d="M5 12h14M8 7h8"/>'], ["band", "Espejo", '<path d="M5 8h14M5 16h14M12 8v8"/>'],
    ["circle", "Círculo", '<circle cx="12" cy="12" r="7"/>'], ["rect", "Rectángulo", '<rect x="5" y="6" width="14" height="12" rx="3"/>'],
    ["heart", "Corazón", '<path d="M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 1.5C19 14.6 12 19 12 19z"/>'], ["star", "Estrella", '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 19l1-5.4-4-3.8 5.4-.7z"/>']];
  function buildMask() {
    var s = section("Máscara"), r = mk("div", "imask"); ctl.mask = {};
    MASKS.forEach(function (m) {
      var b = mk("button", "imbtn", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' + m[2] + "</svg>"); b.title = m[1];
      b.onclick = function () { each(function (tr) { tr.mask = m[0]; }); hist("Máscara"); }; r.appendChild(b); ctl.mask[m[0]] = b;
    });
    s.body.appendChild(r); return s;
  }

  /* ---------- Recortar ---------- */
  function buildCrop() {
    var s = section("Recortar"); ctl.crop = {};
    [["l", "Izquierda"], ["t", "Arriba"], ["r", "Derecha"], ["b", "Abajo"]].forEach(function (p) {
      var n = num(0, 90, 1, "%", function (v) { each(function (tr) { (tr.crop || (tr.crop = {}))[p[0]] = v; }); }, function () { hist("Recortar"); });
      ctl.crop[p[0]] = n.input; s.body.appendChild(row(p[1], n));
    });
    return s;
  }

  /* ---------- Estabilizar ---------- */
  function stOf(tr) { return tr.stab || (tr.stab = { on: false, mode: "smooth", win: 1, strength: 100, auto: true, extra: 0, path: null }); }
  function buildStab() {
    var s = section("Estabilizar", { help: "Analiza el movimiento de la cámara cuadro a cuadro y lo compensa (solo desplazamiento, no rotación). Funciona mejor con temblor de mano, no con paneos largos." });
    ctl.stabNote = mk("div", "ihint"); s.body.appendChild(ctl.stabNote);
    ctl.stabOn = toggle(function (v) {
      var c = cur(); if (!c || c.type !== "video") return;
      var st = stOf(Anim.trOf(c.id));
      if (v && !(st.path && st.path.length)) { ctl.stabOn.input.checked = false; return analyze(); }
      each(function (tr) { stOf(tr).on = v; }); hist("Estabilizar");
    }); s.body.appendChild(row("Estabilizar", ctl.stabOn));
    var ab = mk("button", "ibtn wide", "▶ Analizar movimiento"); ab.onclick = function () { analyzing ? (analyzing.cancel = true) : analyze(); }; ctl.stabBtn = ab;
    var pb = mk("div", "iprog", "<i></i>"); ctl.stabProg = pb; var rb = mk("button", "ibtn wide", "Quitar análisis"); rb.onclick = function () { each(function (tr) { var st = stOf(tr); st.path = null; st.on = false; }); hist("Estabilizar"); }; ctl.stabClear = rb;
    s.body.append(ab, pb, rb);
    var md = mk("select", "isel"); [["smooth", "Suave (conserva el movimiento intencional)"], ["fixed", "Cámara fija (elimina todo el movimiento)"]].forEach(function (m) { var o = mk("option"); o.value = m[0]; o.textContent = m[1]; md.appendChild(o); });
    md.onchange = function () { each(function (tr) { stOf(tr).mode = md.value; }); hist("Estabilizar"); }; ctl.stabMode = md; s.body.appendChild(row("Modo", md));
    ctl.stabWin = rng(0.3, 3, 0.1, function (v) { each(function (tr) { stOf(tr).win = v; }); }, function () { hist("Estabilizar"); }); ctl.stabWinRow = row("Suavidad", ctl.stabWin); s.body.appendChild(ctl.stabWinRow);
    ctl.stabStr = rng(0, 100, 1, function (v) { each(function (tr) { stOf(tr).strength = v; }); }, function () { hist("Estabilizar"); }); s.body.appendChild(row("Intensidad", ctl.stabStr));
    ctl.stabAuto = chk("Recorte automático (ocultar bordes)", function (v) { each(function (tr) { stOf(tr).auto = v; }); hist("Estabilizar"); }); var ar = mk("div", "irow"); ar.appendChild(ctl.stabAuto); s.body.appendChild(ar);
    ctl.stabExtra = num(0, 30, 1, "%", function (v) { each(function (tr) { stOf(tr).extra = v; }); }, function () { hist("Estabilizar"); }); s.body.appendChild(row("Zoom extra", ctl.stabExtra));
    return s;
  }
  function analyze() {
    var c = cur(); if (!c || c.type !== "video") return toast("Selecciona un clip de video para estabilizar.");
    if (analyzing) return; analyzing = { cancel: false }; var bar = ctl.stabProg.firstChild; ctl.stabProg.style.display = "block"; ctl.stabBtn.textContent = "■ Cancelar análisis";
    ErizoStab.analyze(c, { signal: analyzing, onProgress: function (p) { bar.style.width = Math.round(p * 100) + "%"; } }).then(function (path) {
      var st = stOf(Anim.trOf(c.id)); st.path = path; st.on = true; ErizoLook.invalidate(c.id); hist("Estabilizar"); toast("Estabilización lista (" + path.length + " muestras).");
    }).catch(function (e) { if (e && e.message !== "cancelado") toast("No se pudo analizar: " + (e.message || e)); })
      .then(function () { analyzing = null; ctl.stabProg.style.display = "none"; bar.style.width = "0"; ctl.stabBtn.textContent = "▶ Analizar movimiento"; lastSig = ""; try { ed.syncToTimeline(); } catch (e) {} });
  }

  /* ---------- sincronizar controles con el clip seleccionado ---------- */
  function refresh() {
    var c = cur(); root.style.display = c ? "" : "none"; if (!c) return;
    var tr = Anim.trOf(c.id), st = tr.stab || {}, k = tr.key || {}, cr = tr.crop || {}, kf = kfl(c);
    var sig = JSON.stringify([c.id, c.type, tr.blend, tr.flipX, tr.flipY, tr.mask, k, cr, st.on, st.mode, st.win, st.strength, st.auto, st.extra, st.path ? st.path.length : 0, !!analyzing, kf]);
    if (sig === lastSig) return; lastSig = sig;
    ctl.dia.classList.toggle("on", !!(kf && ctl.near(kf, ctl.rel(c)) >= 0));
    setIfIdle(ctl.blend, tr.blend || "normal"); ctl.fh.input.checked = !!tr.flipX; ctl.fv.input.checked = !!tr.flipY;
    ctl.keyOn.checked = !!k.on; ["auto", "manual", "chroma"].forEach(function (m) { ctl.key[m].input.checked = !!k.on && k.mode === m; });
    ctl.keybox.style.display = k.on ? "" : "none"; var mode = k.mode;
    ctl.colrow.style.display = mode === "manual" || mode === "chroma" ? "" : "none"; ctl.prerow.style.display = mode === "chroma" ? "" : "none"; ctl.spillrow.style.display = mode === "chroma" ? "" : "none";
    setIfIdle(ctl.col, k.color || "#00ff00"); setIfIdle(ctl.tol, k.tol == null ? 40 : k.tol); setIfIdle(ctl.soft, k.soft == null ? 20 : k.soft); ctl.spill.input.checked = k.spill !== false;
    Object.keys(ctl.mask).forEach(function (m) { ctl.mask[m].classList.toggle("on", (tr.mask || "none") === m); });
    ["l", "t", "r", "b"].forEach(function (p) { setIfIdle(ctl.crop[p], cr[p] || 0); });
    var isVid = c.type === "video", has = !!(st.path && st.path.length);
    ctl.stabNote.textContent = !isVid ? "La estabilización solo está disponible para clips de video." : has ? "Movimiento analizado (" + st.path.length + " muestras). Ajusta cómo se compensa:" : "Primero analiza el movimiento del clip.";
    ctl.stabOn.input.checked = !!st.on && has; ctl.stabOn.style.opacity = isVid ? "" : "0.4";
    ctl.stabBtn.style.display = isVid ? "" : "none"; ctl.stabClear.style.display = isVid && has ? "" : "none";
    setIfIdle(ctl.stabMode, st.mode || "smooth"); ctl.stabWinRow.style.display = (st.mode || "smooth") === "smooth" ? "" : "none";
    setIfIdle(ctl.stabWin, st.win || 1); setIfIdle(ctl.stabStr, st.strength == null ? 100 : st.strength); ctl.stabAuto.input.checked = st.auto !== false; setIfIdle(ctl.stabExtra.input, st.extra || 0);
  }
  function kfl(c) { return ctl.kfl ? ctl.kfl(c, false) : null; }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      ed = window.editor; if (!ed || !window.ErizoLook || !$("clip-op-num")) return;
      try {
        root = mk("div", "look-sections");
        root.append(buildFusion().root, buildKey().root, buildMask().root, buildCrop().root, buildStab().root);
        var clipG = $("clip-speed").closest(".prop-group"), anchor = clipG ? clipG.previousElementSibling || clipG : document.querySelector(".right-panel").lastElementChild;
        anchor.parentNode.insertBefore(root, anchor);
        setInterval(refresh, 200); refresh();
      } catch (e) { console.error("[Erizo] inspector", e); }
    }, 0);
  });
})();
