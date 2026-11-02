/* Biblioteca (estilo Concat): pestañas, árbol, búsqueda y cuadrícula de medios que se arrastran a la línea de tiempo. */
(function () {
  "use strict";
  var TABS = [["media", "🗂", "Medios"], ["audio", "♪", "Audio"], ["text", "T", "Texto"], ["transitions", "⇄", "Transiciones"], ["effects", "✦", "Efectos"], ["filters", "◐", "Filtros"]];
  var TREE = [["all", "Todos los medios"], ["video", "Video"], ["audio", "Audio"], ["image", "Imágenes"], ["voice", "Voz"]];
  var tab = "media", cat = "all", q = "", ed, M, tabsEl, mainEl, t, sig = "", ctx = null;
  function el(tg, c) { var e = document.createElement(tg); if (c) e.className = c; return e; }
  function fmt(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function list(kind) {
    return M.pool.filter(function (p) {
      if (kind === "audio" && p.type !== "audio") return false;
      if (kind === "media" && cat !== "all" && (cat === "voice" ? p.src !== "voice" : p.type !== cat)) return false;
      return !q || p.name.toLowerCase().indexOf(q) >= 0;
    });
  }
  function signature() {
    return [tab, cat, q, M.pool.map(function (p) { return p.id + ":" + p.name + ":" + Math.round(p.dur) + ":" + (M.usedBy(p).length ? 1 : 0) + ":" + (M.sel.has(p.id) ? 1 : 0); }).join(",")].join("|");
  }
  function closeCtx() { if (ctx) { ctx.remove(); ctx = null; } }
  function itemMenu(e, it) {
    e.preventDefault(); closeCtx();
    if (!M.sel.has(it.id)) { M.sel.clear(); M.sel.add(it.id); drawMain(); }
    var m = el("div", "ctx-menu"), k = (window.ErizoUI && ErizoUI.k) || 1;
    [["➕ Agregar a la línea de tiempo", function () { M.addSelected(); }],
     ["✎ Renombrar", function () { var n = prompt("Nuevo nombre:", it.name); if (n && n.trim()) { it.name = n.trim(); M.changed(); } }],
     ["🗑 Eliminar de la biblioteca", function () { M.remove(M.selected()); }]].forEach(function (a, i) {
      var b = el("button", i === 2 ? "danger" : ""); b.textContent = a[0]; b.onclick = function () { closeCtx(); requestAnimationFrame(a[1]); }; m.appendChild(b);
    });
    document.body.appendChild(m); ctx = m;
    m.style.left = Math.min(e.clientX, innerWidth - m.offsetWidth * k - 8) / k + "px"; m.style.top = Math.min(e.clientY, innerHeight - m.offsetHeight * k - 8) / k + "px";
  }
  function thumb(it) {
    if (it.th) return it.th;
    var th;
    if (it.type === "image") { th = el("div", "th"); th.style.backgroundImage = "url('" + it.url + "')"; }
    else if (it.type === "video") { th = el("div", "th"); var v = el("video"); v.src = it.url + "#t=0.5"; v.muted = true; v.preload = "metadata"; v.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:5px;pointer-events:none"; th.appendChild(v); }
    else { th = el("div", "th"); th.textContent = it.src === "voice" ? "🎤" : "♪"; }
    return (it.th = th);
  }
  function grid(items) {
    if (!items.length) { var e = el("div", "lib-empty"); e.textContent = M.pool.length ? "Nada coincide con el filtro." : "La biblioteca está vacía. Pulsa Importar o arrastra archivos aquí; luego arrástralos a la línea de tiempo."; return e; }
    var g = el("div", "lib-grid");
    items.forEach(function (it) {
      var d = el("div", "lib-item" + (M.sel.has(it.id) ? " sel" : "")), n = el("span"), th = thumb(it), badge = el("em");
      n.textContent = it.name; badge.textContent = it.type === "image" ? "IMG" : fmt(it.dur);
      d.title = it.name + " — arrastra a la línea de tiempo · doble clic: agregar en el cabezal";
      d.draggable = true; d.append(th, n, badge);
      if (M.usedBy(it).length) { var u = el("i"); u.title = "Usado en la línea de tiempo"; d.appendChild(u); }
      d.onclick = function (e) {
        if (e.ctrlKey || e.metaKey) { M.sel.has(it.id) ? M.sel.delete(it.id) : M.sel.add(it.id); } else { M.sel.clear(); M.sel.add(it.id); }
        drawMain();
      };
      d.ondblclick = function () { M.sel.clear(); M.sel.add(it.id); M.addSelected(); };
      d.oncontextmenu = function (e) { itemMenu(e, it); };
      d.ondragstart = function (e) {
        if (!M.sel.has(it.id)) { M.sel.clear(); M.sel.add(it.id); }
        e.dataTransfer.setData(M.MIME, JSON.stringify(M.selected().map(function (p) { return p.id; })));
        e.dataTransfer.setData("text/plain", it.name); e.dataTransfer.effectAllowed = "copy"; document.body.classList.add("fx-dragging");
      };
      g.appendChild(d);
    });
    return g;
  }
  function tools() {
    var bar = el("div", "lib-bar"), imp = el("button", "lib-import"), s = el("input"), mic = el("button", "lib-import");
    imp.textContent = "⤓ Importar"; imp.onclick = function () { var x = document.getElementById("import-btn"); if (x) x.click(); };
    mic.className = "lib-import lib-mic" + (M.isRecording() ? " rec" : ""); mic.textContent = M.isRecording() ? "⏹ Detener" : "🎤 Grabar voz";
    mic.onclick = function () { M.toggleRecord(function (s2) { mic.className = "lib-import lib-mic" + (s2 == null ? "" : " rec"); mic.textContent = s2 == null ? "🎤 Grabar voz" : "⏹ Detener · " + s2 + " s"; }); };
    s.type = "text"; s.placeholder = "Buscar…"; s.value = q; s.className = "lib-search";
    s.oninput = function () { q = s.value.trim().toLowerCase(); clearTimeout(t); t = setTimeout(function () { drawMain(); var n = mainEl.querySelector(".lib-search"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 150); };
    bar.append(imp, mic, s); return bar;
  }
  function drawTabs() {
    tabsEl.replaceChildren();
    TABS.forEach(function (x) {
      var b = el("button", "lib-tab" + (x[0] === tab ? " on" : "")); b.innerHTML = "<b>" + x[1] + "</b>" + x[2];
      b.onclick = function () { tab = x[0]; drawTabs(); drawMain(); }; tabsEl.appendChild(b);
    });
  }
  function drawMain() {
    var keep = mainEl.querySelector(".lib-content"), sc = keep ? keep.scrollTop : 0;
    mainEl.replaceChildren(); sig = signature();
    var box = el("div", "lib-content");
    if (tab === "media") {
      var tree = el("div", "lib-tree");
      TREE.forEach(function (x) {
        var n = M.pool.filter(function (c) { return x[0] === "all" || (x[0] === "voice" ? c.src === "voice" : c.type === x[0]); }).length, b = el("button", cat === x[0] ? "on" : "");
        if (x[0] === "voice") { var g = el("div", "grp"); g.textContent = "Generado"; tree.appendChild(g); }
        b.innerHTML = "<span>" + x[1] + "</span><span>" + (n || "") + "</span>"; b.onclick = function () { cat = x[0]; drawMain(); }; tree.appendChild(b);
      });
      mainEl.appendChild(tree); box.append(tools(), grid(list("media")));
    } else if (tab === "audio") box.append(tools(), grid(list("audio")));
    else if (tab === "text") {
      var b2 = el("button", "lib-import"); b2.textContent = "＋ Agregar texto"; b2.onclick = function () { var x = document.getElementById("tb-text"); if (x) x.click(); };
      var h = el("div", "lib-empty"); h.textContent = "Se agrega en la pista de video. Edítalo en el Inspector."; box.append(b2, h);
    } else if (window.ErizoFx) window.ErizoFx.render(box, tab);
    mainEl.appendChild(box); box.scrollTop = sc;
  }
  function refreshIfChanged() { clearTimeout(t); t = setTimeout(function () { if ((tab === "media" || tab === "audio") && signature() !== sig) drawMain(); }, 80); }
  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("panel-library"); ed = window.editor; M = window.ErizoMedia; if (!root || !ed || !M) return;
    root.replaceChildren(); tabsEl = el("div", "lib-tabs"); mainEl = el("div", "lib-main"); root.append(tabsEl, mainEl);
    drawTabs(); drawMain(); M.onChange(refreshIfChanged);
    document.addEventListener("pointerdown", function (e) { if (ctx && !ctx.contains(e.target)) closeCtx(); }, true);
    ["renderTracks", "renderClips"].forEach(function (fn) { var o = ed[fn]; ed[fn] = function () { var r = o.apply(this, arguments); refreshIfChanged(); return r; }; });
    /* soltar archivos del sistema sobre la propia biblioteca */
    root.addEventListener("dragover", function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") >= 0) e.preventDefault(); });
    root.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); ed.handleFiles(e.dataTransfer.files); } });
  });
})();
