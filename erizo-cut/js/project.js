/* Proyecto: autoguardado en el navegador (con medios), guardar/abrir archivo .erizo, caché y atajos. */
(function () {
  "use strict";
  var KEY = "erizocut.project.v1", DB = "erizocut", ST = "media", blobMap = {}, fkOf = {}, stored = {}, ed, timer, dbp, noSave = false, inp;
  var oc = URL.createObjectURL; URL.createObjectURL = function (o) { var u = oc.call(URL, o); if (o instanceof Blob) blobMap[u] = o; return u; };
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function toast(m) { var t = el("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3000); }
  function db() {
    return dbp || (dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore(ST); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    }));
  }
  function tx(mode, fn) {
    return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(ST, mode), r = fn(t.objectStore(ST)); t.oncomplete = function () { res(r && r.result); }; t.onerror = function () { rej(t.error); }; }); });
  }
  function fk(u) { return fkOf[u] || (fkOf[u] = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); }
  function pool() { return window.ErizoMedia ? ErizoMedia.pool : []; }
  function autosaveOn() { return !(window.ErizoSettings && ErizoSettings.autosave === false); }
  /* medios únicos del proyecto: los que están en la línea de tiempo y los que solo están en la biblioteca */
  function mediaList() {
    var seen = {}, out = [];
    function add(u, name) { if (!u || seen[u]) return; seen[u] = 1; out.push({ url: u, name: name }); }
    ed.clips.forEach(function (c) { if (c.type !== "text" && c.type !== "fx") add(c.url, c.name); });
    pool().forEach(function (p) { add(p.url, p.name); });
    return out;
  }
  function snap() {
    var cl = ed.cloneClips().map(function (c) { if (c.type !== "text" && c.type !== "fx") c.fk = fk(c.url); delete c.url; return c; });
    var pl = pool().map(function (p) { return { id: p.id, name: p.name, type: p.type, mime: p.mime, dur: p.dur, w: p.w, h: p.h, src: p.src, fk: fk(p.url) }; });
    return { v: 2, clips: cl, pool: pl, transforms: ed.transforms, textStyles: ed.textStyles, kfs: ed.kfs, anim: ed.anim, vt: ed.videoTracks, at: ed.audioTracks };
  }
  function save(force) {
    if (!ed || noSave || (force !== true && !autosaveOn())) return;
    if (!ed.clips.length && !pool().length) { localStorage.removeItem(KEY); return; }
    var seen = {}, jobs = [];
    mediaList().forEach(function (m) {
      var k = fk(m.url); seen[k] = 1;
      if (!stored[k] && blobMap[m.url]) { stored[k] = 1; jobs.push(tx("readwrite", function (s) { return s.put(blobMap[m.url], k); }).catch(function () { stored[k] = 0; })); }
    });
    try { localStorage.setItem(KEY, JSON.stringify(snap())); } catch (e) {}
    return Promise.all(jobs).then(function () { return tx("readonly", function (s) { return s.getAllKeys(); }); }).then(function (ks) {
      (ks || []).forEach(function (k) { if (!seen[k]) { stored[k] = 0; tx("readwrite", function (s) { return s.delete(k); }); } });
    }).catch(function () {});
  }
  function touch() { clearTimeout(timer); timer = setTimeout(save, 1200); }
  function restore(s, getBlob) {
    var fks = {}, urls = {};
    s.clips.forEach(function (c) { if (c.fk) fks[c.fk] = 1; });
    (s.pool || []).forEach(function (p) { if (p.fk) fks[p.fk] = 1; });
    return Promise.all(Object.keys(fks).map(function (k) {
      return Promise.resolve(getBlob(k)).then(function (b) { if (b) { var u = URL.createObjectURL(b); urls[k] = u; fkOf[u] = k; stored[k] = 1; } });
    })).then(function () {
      var clips = s.clips.filter(function (c) { return c.type === "text" || c.type === "fx" || urls[c.fk]; }).map(function (c) { var n = Object.assign({}, c); if (c.type !== "text" && c.type !== "fx") n.url = urls[c.fk]; return n; });
      var list;
      if (s.pool) list = s.pool.filter(function (p) { return urls[p.fk]; }).map(function (p) { return { id: p.id, name: p.name, type: p.type, mime: p.mime, dur: p.dur, w: p.w, h: p.h, src: p.src, url: urls[p.fk] }; });
      else { /* proyecto guardado antes de existir la biblioteca: se reconstruye desde los clips */
        var seen = {}; list = [];
        s.clips.forEach(function (c) { if (c.type === "text" || c.type === "fx" || !urls[c.fk] || (seen[c.fk] && c.type === "audio")) return; if (seen[c.fk]) return; seen[c.fk] = 1; list.push({ name: c.name.replace(/^🔗 /, "").replace(/ \(audio\)$/, ""), type: c.type, dur: c.duration, url: urls[c.fk] }); });
      }
      if (window.ErizoMedia) ErizoMedia.restore(list);
      ed.videoTracks = s.vt; ed.audioTracks = s.at;
      ed.history.push({ clips: clips, transforms: s.transforms || {}, textStyles: s.textStyles || {}, kfs: s.kfs || {}, anim: s.anim || {}, selectedId: null, selectedIds: [], action: "Proyecto" });
      ed.historyIndex = ed.history.length - 1; ed.restoreHistory();
      ed.renderTracks(); ed.updateMetrics(); ed.renderClips(); ed.syncToTimeline(); try { ed.updateImportSelectors(); } catch (e) {}
      toast("Proyecto cargado (" + clips.length + " clips, " + list.length + " medios)");
    });
  }
  function saveFile(asName) {
    if (!ed.clips.length && !pool().length) return toast("No hay nada que guardar.");
    var s = snap(), media = {}, size = 0;
    mediaList().forEach(function (m) { var b = blobMap[m.url]; if (!b) return; size += b.size; media[fk(m.url)] = { name: m.name, blob: b }; });
    if (size > 300 * 1048576 && !confirm("Los medios pesan " + Math.round(size / 1048576) + " MB y el archivo será muy grande. ¿Guardar igualmente?")) return;
    toast("Preparando archivo…");
    Promise.all(Object.keys(media).map(function (k) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { media[k] = { name: media[k].name, data: fr.result }; res(); }; fr.readAsDataURL(media[k].blob); });
    })).then(function () {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ erizo: 1, project: s, media: media })], { type: "application/json" }));
      a.download = (typeof asName === "string" && asName ? asName : "proyecto") + ".erizo"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  }
  function openFile(f) {
    var fr = new FileReader();
    fr.onload = function () {
      try { var d = JSON.parse(fr.result); restore(d.project, function (k) { return d.media[k] ? fetch(d.media[k].data).then(function (r) { return r.blob(); }) : null; }); } catch (e) { toast("No se pudo abrir el archivo."); }
    };
    fr.readAsText(f);
  }
  function banner(raw) {
    var n = 0; try { var j = JSON.parse(raw); n = j.clips.length + (j.pool ? j.pool.length : 0); } catch (e) { return; }
    if (!n) return;
    var b = el("div", "ws-banner"); b.style.display = "flex"; var t = el("span"); t.textContent = "Se encontró un proyecto guardado.";
    var a = el("button"); a.textContent = "Restaurar"; var c = el("button"); c.textContent = "Descartar";
    a.onclick = function () { b.remove(); restore(JSON.parse(raw), function (k) { return tx("readonly", function (s) { return s.get(k); }); }); };
    c.onclick = function () { b.remove(); localStorage.removeItem(KEY); }; b.append(t, a, c); document.body.appendChild(b);
  }
  /* cerrar proyecto: borra el autoguardado y los medios guardados y recarga en blanco */
  function closeProject() {
    if (!confirm("¿Cerrar el proyecto? Se borra el actual (guárdalo antes si lo necesitas).")) return;
    noSave = true; localStorage.removeItem(KEY);
    tx("readwrite", function (s) { return s.clear(); }).catch(function () {}).then(function () { location.reload(); });
  }
  /* vaciar la caché: historial de deshacer, copias huérfanas y miniaturas; el proyecto actual se conserva */
  function clearCache() {
    var steps = Math.max(0, ed.history.length - 1), before = 0;
    return tx("readonly", function (s) { return s.getAllKeys(); }).then(function (ks) { before = (ks || []).length; })
      .then(function () { return tx("readwrite", function (s) { return s.clear(); }); })
      .then(function () {
        stored = {}; ed.history = [ed.history[ed.historyIndex]]; ed.historyIndex = 0;
        pool().forEach(function (p) { p.th = null; });
        if (window.ErizoMedia) ErizoMedia.changed();
        return save(true);
      }).then(function () { return tx("readonly", function (s) { return s.getAllKeys(); }); })
      .then(function (ks) { toast("Caché vaciada: historial (" + steps + " pasos) y " + Math.max(0, before - (ks || []).length) + " copia(s) sin uso."); })
      .catch(function () { toast("No se pudo vaciar la caché."); });
  }
  var KEYS = [["Espacio", "Reproducir / pausar"], ["S", "Dividir en el cabezal (con selección: solo lo seleccionado)"], ["Q / W", "Recortar inicio / final hasta el cabezal"], ["Supr / Retroceso", "Borrar selección"], ["Mayús + Supr", "Borrar y cerrar el hueco"], ["V / H", "Herramienta selección / mano"], ["N", "Imán de la línea de tiempo"], ["M", "Magnetizar al centro (vista previa)"], ["Ctrl + Z / Ctrl + Y", "Deshacer / rehacer"], ["Ctrl + C / X / V", "Copiar / cortar / pegar"], ["Ctrl + A", "Seleccionar todo"], ["Ctrl + Shift + L", "Enlazar / desenlazar audio y video"], ["Ctrl + rueda", "Zoom de la línea de tiempo / vista previa"], ["Ctrl + O", "Abrir proyecto"], ["Ctrl + I", "Importar medios"], ["Ctrl + S", "Guardar"], ["Ctrl + E", "Exportar"], ["Ctrl + ,", "Ajustes"], ["Doble clic en pista", "Renombrar pista"], ["Clic derecho en pista", "Renombrar, ocultar o eliminar pista"]];
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      ed = window.editor; if (!ed) return;
      try {
        var ph = ed.pushHistory; ed.pushHistory = function () { var r = ph.apply(this, arguments); touch(); return r; };
        window.addEventListener("beforeunload", function () { save(); });
        inp = el("input"); inp.type = "file"; inp.accept = ".erizo,application/json"; inp.style.display = "none"; document.body.appendChild(inp);
        inp.onchange = function () { if (inp.files[0]) openFile(inp.files[0]); inp.value = ""; };
        document.addEventListener("keydown", function (e) {
          if (!(e.ctrlKey || e.metaKey)) return;
          if (e.code === "KeyS") { e.preventDefault(); saveFile(); }
          if (e.code === "KeyO") { e.preventDefault(); inp.click(); }
          if (e.code === "KeyI") { e.preventDefault(); importMedia(); }
          if (e.code === "KeyE") { e.preventDefault(); exportVideo(); }
          if (e.code === "Comma") { e.preventDefault(); if (window.ErizoArchivo) ErizoArchivo.settings(); }
        });
        var raw = localStorage.getItem(KEY); if (raw && !ed.clips.length) banner(raw);
      } catch (e) { console.error("[Erizo] project", e); }
    }, 0);
  });
  function importMedia() { var b = document.getElementById("import-btn"); if (b) b.click(); }
  function exportVideo() { var b = document.getElementById("m-exp-dialog"); if (b) b.click(); }
  window.ErizoProject = {
    saveFile: saveFile, openDialog: function () { if (inp) inp.click(); }, importMedia: importMedia, exportVideo: exportVideo,
    closeProject: closeProject, clearCache: clearCache, touch: touch, flush: function () { return save(true); }, stopSaving: function () { noSave = true; }, KEYS: KEYS
  };
})();
