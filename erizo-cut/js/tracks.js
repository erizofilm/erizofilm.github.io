/* Pistas: botón Agregar, selección, renombrar (doble clic) y menú de clic derecho (renombrar, ocultar, eliminar). */
(function () {
  "use strict";
  var ed, menu = null, selId = null;
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function toast(m) { var t = el("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800); }

  /* ---- menú contextual: un solo menú y listeners globales registrados UNA vez ---- */
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(x, y, items) {
    closeMenu();
    var m = el("div", "ctx-menu");
    items.forEach(function (it) {
      if (it === "-") return m.appendChild(el("hr"));
      var b = el("button", it.danger ? "danger" : ""); b.textContent = it.t;
      /* se cierra primero y la acción corre en el siguiente frame: el menú desaparece al instante */
      b.onclick = function (e) { e.stopPropagation(); closeMenu(); requestAnimationFrame(it.fn); };
      m.appendChild(b);
    });
    document.body.appendChild(m); menu = m;
    var k = (window.ErizoUI && window.ErizoUI.k) || 1, w = m.offsetWidth * k, h = m.offsetHeight * k;
    var px = Math.max(4, Math.min(x, window.innerWidth - w - 8)), py = Math.max(4, Math.min(y, window.innerHeight - h - 8));
    m.style.left = px / k + "px"; m.style.top = py / k + "px";
  }
  function bindGlobalClose() {
    document.addEventListener("pointerdown", function (e) { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); }, true);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    document.addEventListener("wheel", closeMenu, { passive: true, capture: true });
  }

  function track(id) { return ed.allTracksOrdered.filter(function (t) { return t.id === id; })[0]; }
  /* renderTracks ya programa renderClips; no se repite aquí para no duplicar trabajo */
  function refresh() { ed.renderTracks(); ed.updateMetrics(); try { ed.syncToTimeline(); } catch (e) {} }
  function renumber() {
    [ed.videoTracks, ed.audioTracks].forEach(function (arr, k) {
      arr.forEach(function (x, i) { if (/^[VA]\d+$/.test(x.name)) x.name = (k ? "A" : "V") + (i + 1); x.num = i + 1; });
    });
  }
  function remove(id) {
    var t = track(id); if (!t) return;
    var arr = t.type === "audio" ? ed.audioTracks : ed.videoTracks;
    if (arr.length <= 1) return toast("Debe quedar al menos una pista de " + (t.type === "audio" ? "audio" : "video") + ".");
    var mine = ed.clips.filter(function (c) { return c.trackId === id; });
    if (mine.length && !confirm("La pista " + t.name + " tiene " + mine.length + " clip(s). Se eliminarán junto con la pista. ¿Continuar?")) return;
    mine.forEach(function (c) {
      var e = ed.layerElements[c.id];
      if (e) { if (e.tagName === "VIDEO" || e.tagName === "AUDIO") { e.pause(); try { e.src = ""; } catch (x) {} } e.remove(); delete ed.layerElements[c.id]; }
      var te = ed.textElements[c.id]; if (te) { te.remove(); delete ed.textElements[c.id]; }
      var ae = ed.audioElements && ed.audioElements[c.id]; if (ae) { try { ae.pause(); ae.src = ""; } catch (x) {} delete ed.audioElements[c.id]; }
    });
    ed.clips = ed.clips.filter(function (c) { return c.trackId !== id; });
    arr.splice(arr.indexOf(t), 1);
    renumber();
    if (ed.selectedIds) ed.selectedIds.clear(); ed.selectedId = null; selId = null;
    refresh(); try { ed.pushHistory("Eliminar pista"); } catch (e) {}
  }
  function toggle(id) {
    var t = track(id); if (!t) return;
    t.enabled = t.enabled === false; refresh();
  }
  function rename(lbl, id) {
    var t = track(id), sp = lbl && lbl.querySelector(".num"); if (!t || !sp) return;
    var inp = el("input", "trk-edit"); inp.type = "text"; inp.value = t.name; inp.maxLength = 12; sp.replaceWith(inp); inp.focus(); inp.select();
    var done = false;
    function end(ok) {
      if (done) return; done = true;
      var changed = ok && inp.value.trim() && inp.value.trim() !== t.name;
      if (changed) t.name = inp.value.trim();
      /* solo se reemplaza el campo por su texto: no hace falta redibujar toda la línea de tiempo */
      var span = el("span", "num"); span.textContent = t.name; if (inp.isConnected) inp.replaceWith(span);
      if (changed) { try { ed.pushHistory("Renombrar pista"); } catch (e) {} }
    }
    inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === "Enter") end(true); if (e.key === "Escape") end(false); };
    inp.onblur = function () { end(true); }; inp.onclick = inp.ondblclick = inp.onmousedown = inp.onpointerdown = function (e) { e.stopPropagation(); };
  }
  function mark() {
    document.querySelectorAll(".track-label-item").forEach(function (l) { l.classList.toggle("sel", l.dataset.trackId === selId); });
  }
  window.ErizoTracks = { openMenu: function (x, y, items) { openMenu(x, y, items); } };
  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; if (!ed) return;
    renumber(); bindGlobalClose();
    var sb = document.getElementById("tracks-sidebar"), tk = document.getElementById("timeline-tracks"), lock = false;
    function link(x, y) { x.addEventListener("scroll", function () { if (lock) { lock = false; return; } if (y.scrollTop !== x.scrollTop) { lock = true; y.scrollTop = x.scrollTop; } }); }
    if (sb && tk) { link(sb, tk); link(tk, sb); }
    var rt = ed.renderTracks; ed.renderTracks = function () { var r = rt.apply(this, arguments); mark(); return r; };
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".add-menu-btn");
      if (b) {
        e.stopPropagation(); var r = b.getBoundingClientRect();
        return openMenu(r.left, r.bottom + 2, [{ t: "🎬 Pista de video", fn: function () { ed.addTrack("video"); } }, { t: "🎵 Pista de audio", fn: function () { ed.addTrack("audio"); } }]);
      }
      var l = e.target.closest(".track-label-item");
      if (l && !e.target.closest(".track-toggle,.trk-edit")) { selId = l.dataset.trackId; mark(); }
    });
    document.addEventListener("dblclick", function (e) {
      var l = e.target.closest(".track-label-item"); if (l && !e.target.closest(".track-toggle")) rename(l, l.dataset.trackId);
    });
    /* clic derecho en el nombre de una pista: responde al instante y siempre abre su menú */
    document.addEventListener("contextmenu", function (e) {
      var l = e.target.closest && e.target.closest(".track-label-item"); if (!l) return;
      e.preventDefault(); e.stopPropagation();
      var cm = document.getElementById("context-menu"); if (cm) cm.style.display = "none";
      var id = l.dataset.trackId, t = track(id); if (!t) return; selId = id; mark();
      openMenu(e.clientX, e.clientY, [
        { t: "✎ Renombrar pista", fn: function () { rename(document.querySelector('.track-label-item[data-track-id="' + id + '"]'), id); } },
        { t: t.enabled === false ? "👁 Mostrar pista" : "🚫 Ocultar pista", fn: function () { toggle(id); } },
        "-",
        { t: "🎬 Agregar pista de video", fn: function () { ed.addTrack("video"); } },
        { t: "🎵 Agregar pista de audio", fn: function () { ed.addTrack("audio"); } },
        "-",
        { t: t.type === "audio" ? "🗑 Eliminar pista de audio" : "🗑 Eliminar pista de video", danger: 1, fn: function () { remove(id); } }
      ]);
    }, true);
  });
})();
