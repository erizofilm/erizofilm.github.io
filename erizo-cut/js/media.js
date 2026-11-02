/* Biblioteca de medios: los archivos importados se quedan aquí y el usuario los arrastra a la línea de tiempo. */
(function () {
  "use strict";
  var MIME = "application/x-erizo-media", ed, origHandle, listeners = [];
  var pool = [], sel = new Set(), seq = 0;
  function K() { return (window.ErizoUI && window.ErizoUI.k) || 1; }
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function toast(m) { var t = el("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800); }
  function changed() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); try { if (window.ErizoProject) ErizoProject.touch(); } catch (e) {} }
  function typeOf(f) {
    var t = f.type || "", n = f.name || "";
    if (t.indexOf("image/") === 0 || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(n)) return "image";
    if (t.indexOf("audio/") === 0 || /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus)$/i.test(n)) return "audio";
    if (t.indexOf("video/") === 0 || /\.(mp4|m4v|mov|webm|mkv|avi|ogv)$/i.test(n)) return "video";
    return null;
  }
  function probe(it) {
    if (it.type === "image") { var im = new Image(); im.onload = function () { it.w = im.naturalWidth; it.h = im.naturalHeight; changed(); }; im.src = it.url; return; }
    var m = document.createElement(it.type === "video" ? "video" : "audio"); m.preload = "metadata";
    m.onloadedmetadata = function () { it.dur = isFinite(m.duration) ? m.duration : 0; it.w = m.videoWidth || 0; it.h = m.videoHeight || 0; changed(); };
    m.src = it.url;
  }
  function newItem(o) {
    var it = Object.assign({ id: "m" + Date.now().toString(36) + (seq++).toString(36), dur: 0, w: 0, h: 0, src: "import", mime: "", t: Date.now() }, o);
    pool.push(it); return it;
  }
  function addFile(file, src) {
    var type = typeOf(file); if (!type) return null;
    var now = Date.now();
    if (pool.some(function (p) { return p.file === file && now - p.t < 1500; })) return null; /* el mismo evento llegó dos veces */
    var it = newItem({ name: file.name, type: type, url: URL.createObjectURL(file), file: file, mime: file.type || "", src: src || "import" });
    probe(it); return it;
  }
  /* reconstruye la biblioteca al abrir/restaurar un proyecto */
  function restore(list) {
    pool.length = 0; sel.clear();
    list.forEach(function (o) { var it = newItem(o); if (!it.dur && it.type !== "image") probe(it); });
    changed();
  }
  function byId(id) { return pool.filter(function (p) { return p.id === id; })[0]; }
  function usedBy(it) { return ed ? ed.clips.filter(function (c) { return c.url && c.url === it.url; }) : []; }

  /* poner un medio de la biblioteca en la línea de tiempo (reutiliza la lógica de clips del editor) */
  function place(it, trackId, start) {
    var fake = { name: it.name, type: it.mime || (it.type + "/x") }, prev = ed.timelineTime, oc = URL.createObjectURL, n0 = ed.clips.length;
    URL.createObjectURL = function (o) { return o === fake ? it.url : oc.call(URL, o); };
    ed.timelineTime = start;
    try { origHandle.call(ed, [fake], trackId); } finally { URL.createObjectURL = oc; ed.timelineTime = prev; }
    var clip = ed.clips[n0];
    if (clip && clip.type === "image") {
      var d = (window.ErizoSettings && ErizoSettings.imgDur) || 5; clip.duration = clip.srcDuration = d;
      try { ed.updateMetrics(); ed.renderClips(); ed.syncToTimeline(); } catch (e) {}
    }
    return clip;
  }
  function addAt(list, start, trackId) {
    if (!list.length) return toast("Selecciona un medio de la biblioteca primero.");
    var t = start == null ? ed.timelineTime : start, last = null;
    list.forEach(function (it) {
      var tid = trackId || ed.findFreeTrack(it.type === "audio" ? "audio" : it.type, t);
      var c = place(it, tid, t); last = c;
      t += (c && c.duration ? c.duration : it.dur || 5);
    });
    try { ed.pushHistory("Agregar a la línea de tiempo"); } catch (e) {}
    changed();
  }
  function selected() { return pool.filter(function (p) { return sel.has(p.id); }); }
  function addSelected() { addAt(selected()); }
  function remove(items) {
    var ids = []; items.forEach(function (it) { usedBy(it).forEach(function (c) { ids.push(c.id); }); });
    if (ids.length && !confirm("Se usa en " + ids.length + " clip(s) de la línea de tiempo. Se quitarán también. ¿Continuar?")) return;
    if (ids.length) { ed.selectedIds = new Set(ids); ed.selectedId = ids[0]; ed.deleteSelected(); }
    items.forEach(function (it) { pool.splice(pool.indexOf(it), 1); sel.delete(it.id); });
    changed();
  }

  /* ---- arrastrar de la biblioteca a la línea de tiempo ---- */
  function has(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, MIME) >= 0; }
  function onTl(e) { return e.target.closest && e.target.closest("#timeline-wrapper,#tracks-sidebar,.timeline-tracks"); }
  function bindDrop() {
    document.addEventListener("dragover", function (e) { if (has(e) && onTl(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }, true);
    document.addEventListener("drop", function (e) {
      if (!has(e)) return;
      document.body.classList.remove("fx-dragging");
      if (!onTl(e)) return;
      e.preventDefault(); e.stopPropagation();
      var ids; try { ids = JSON.parse(e.dataTransfer.getData(MIME)); } catch (x) { return; }
      var items = ids.map(byId).filter(Boolean); if (!items.length) return;
      var tid = ed.getTrackAtY(e.clientY), content = document.querySelector(".track-content"), start = ed.timelineTime;
      if (content && !e.target.closest("#tracks-sidebar")) {
        var r = content.getBoundingClientRect(); start = Math.max(0, (e.clientX - r.left) / K() / ed.pixelsPerSecond);
        try { start = Math.max(0, ed.applySnap(start, [])); } catch (x) {}
      }
      addAt(items, start, tid || null);
    }, true);
    document.addEventListener("dragend", function () { document.body.classList.remove("fx-dragging"); });
  }

  /* ---- grabar voz → WAV en la biblioteca ---- */
  var rec = null;
  function wav(buf) {
    var ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate, out = new DataView(new ArrayBuffer(44 + n * 2)), i, c;
    function s(o, t) { for (var k = 0; k < t.length; k++) out.setUint8(o + k, t.charCodeAt(k)); }
    s(0, "RIFF"); out.setUint32(4, 36 + n * 2, true); s(8, "WAVEfmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); s(36, "data"); out.setUint32(40, n * 2, true);
    var data = []; for (c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    for (i = 0; i < n; i++) { var v = 0; for (c = 0; c < ch; c++) v += data[c][i]; v = Math.max(-1, Math.min(1, v / ch)); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    return new Blob([out], { type: "audio/wav" });
  }
  function toggleRecord(onState) {
    if (rec) { rec.mr.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast("Tu navegador no permite grabar audio.");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr = new MediaRecorder(stream), t0 = Date.now(), tick;
      rec = { mr: mr };
      mr.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        clearInterval(tick); stream.getTracks().forEach(function (t) { t.stop(); }); rec = null; onState(null);
        var AC = window.AudioContext || window.webkitAudioContext, blob = new Blob(chunks, { type: mr.mimeType });
        blob.arrayBuffer().then(function (ab) { return new AC().decodeAudioData(ab); }).then(function (buf) {
          var n = pool.filter(function (p) { return p.src === "voice"; }).length + 1;
          var f = new File([wav(buf)], "Voz " + n + ".wav", { type: "audio/wav" }), it = addFile(f, "voice");
          if (it) { it.dur = buf.duration; changed(); toast("Grabación guardada en la Biblioteca (Medios → Voz)."); }
        }).catch(function () { toast("No se pudo procesar la grabación."); });
      };
      mr.start(); onState(0);
      tick = setInterval(function () { onState(Math.floor((Date.now() - t0) / 1000)); }, 500);
    }).catch(function () { toast("No hay permiso para usar el micrófono."); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; if (!ed) return;
    origHandle = ed.handleFiles;
    /* toda importación va a la Biblioteca; solo soltar archivos directamente sobre una pista también los coloca */
    ed.handleFiles = function (fileList, forcedTrackId) {
      var items = Array.from(fileList || []).map(function (f) { return addFile(f); }).filter(Boolean);
      if (!items.length) return;
      if (forcedTrackId) addAt(items, ed.timelineTime, forcedTrackId);
      else toast(items.length + " archivo(s) agregado(s) a la Biblioteca. Arrástralos a la línea de tiempo.");
      changed();
    };
    bindDrop();
  });

  window.ErizoMedia = {
    pool: pool, sel: sel, MIME: MIME, addFile: addFile, restore: restore, byId: byId, usedBy: usedBy, selected: selected,
    addAt: addAt, addSelected: addSelected, remove: remove, toggleRecord: toggleRecord, isRecording: function () { return !!rec; },
    onChange: function (f) { listeners.push(f); }, changed: changed
  };
})();
