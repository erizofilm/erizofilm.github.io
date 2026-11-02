/* Menú Archivo (opciones al estilo Concat), plantillas, ajustes y salir. */
(function () {
  "use strict";
  var TPL = "erizocut.templates.v1", ed;
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function toast(m) { var t = el("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3000); }
  function modal(title, wide) {
    var m = el("div", "kb-modal"), box = el("div", "kb-box" + (wide ? " wide" : "")), h = el("h3"), x = el("button", "kb-x");
    h.textContent = title; x.textContent = "✕"; x.onclick = function () { m.remove(); }; box.append(x, h); m.appendChild(box);
    m.onclick = function (e) { if (e.target === m) m.remove(); }; document.body.appendChild(m); return box;
  }
  function row(label, ctl) { var r = el("div", "set-row"), l = el("label"); l.textContent = label; r.append(l, ctl); return r; }

  /* ---------- plantillas (estructura sin medios: texto, efectos, pistas, formato) ---------- */
  function tplList() { try { return JSON.parse(localStorage.getItem(TPL)) || []; } catch (e) { return []; } }
  function tplStore(a) { try { localStorage.setItem(TPL, JSON.stringify(a)); return true; } catch (e) { toast("No hay espacio para guardar la plantilla."); return false; } }
  function tplSave() {
    var cl = ed.cloneClips().filter(function (c) { return c.type === "text" || c.type === "fx"; });
    var n = prompt("Nombre de la plantilla:", "Plantilla " + (tplList().length + 1)); if (n === null || !n.trim()) return;
    var ids = {}; cl.forEach(function (c) { ids[c.id] = 1; delete c.url; });
    function pick(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { if (ids[k]) r[k] = o[k]; }); return JSON.parse(JSON.stringify(r)); }
    var t = { name: n.trim(), date: Date.now(), clips: cl, transforms: pick(ed.transforms), textStyles: pick(ed.textStyles), kfs: pick(ed.kfs), anim: pick(ed.anim),
      vt: JSON.parse(JSON.stringify(ed.videoTracks)), at: JSON.parse(JSON.stringify(ed.audioTracks)), ratio: ed.aspectRatio, res: ed.resolution };
    var a = tplList(); a.push(t); if (tplStore(a)) toast("Plantilla «" + t.name + "» guardada (" + cl.length + " elementos de texto/efectos).");
  }
  function tplApply(t) {
    var vmap = {}, amap = {};
    while (ed.videoTracks.length < t.vt.length) ed.addTrack("video");
    while (ed.audioTracks.length < t.at.length) ed.addTrack("audio");
    t.vt.forEach(function (x, i) { vmap[x.id] = ed.videoTracks[i].id; }); t.at.forEach(function (x, i) { amap[x.id] = ed.audioTracks[i].id; });
    t.clips.forEach(function (c, i) {
      var id = Date.now() + Math.random() + i, nc = Object.assign({}, c, { id: id, url: "", linkId: null, linkedTo: null, trackId: vmap[c.trackId] || amap[c.trackId] || ed.videoTracks[0].id });
      ed.clips.push(nc);
      ed.transforms[id] = Object.assign({}, ed.defaultTransform, t.transforms[c.id] || {});
      if (t.textStyles[c.id]) ed.textStyles[id] = Object.assign({}, t.textStyles[c.id], { id: id });
      if (t.kfs[c.id]) ed.kfs[id] = JSON.parse(JSON.stringify(t.kfs[c.id]));
      if (t.anim[c.id]) ed.anim[id] = JSON.parse(JSON.stringify(t.anim[c.id]));
    });
    if (t.ratio && t.ratio !== ed.aspectRatio) { var b = document.querySelector('.aspect-btn[data-ratio="' + t.ratio + '"]'); if (b) b.click(); }
    if (t.res && t.res !== ed.resolution) { var rs = document.getElementById("res-select"); if (rs) { rs.value = t.res; rs.dispatchEvent(new Event("change")); } }
    ed.renderAll(); ed.updateMetrics(); ed.syncToTimeline(); ed.pushHistory("Plantilla");
    toast("Plantilla «" + t.name + "» aplicada.");
  }
  function tplDialog() {
    var a = tplList(); if (!a.length) return toast("Aún no hay plantillas. Usa «Guardar como plantilla…».");
    var box = modal("Plantillas", true);
    function draw() {
      box.querySelectorAll(".tpl-row").forEach(function (n) { n.remove(); });
      tplList().forEach(function (t, i) {
        var r = el("div", "tpl-row"), s = el("span"), ap = el("button", "al-btn"), de = el("button", "al-btn");
        s.textContent = t.name + " · " + t.clips.length + " elem. · " + new Date(t.date).toLocaleDateString();
        ap.textContent = "Aplicar"; ap.onclick = function () { box.parentNode.remove(); tplApply(t); };
        de.textContent = "Eliminar"; de.onclick = function () { var l = tplList(); l.splice(i, 1); tplStore(l); draw(); };
        r.append(s, ap, de); box.appendChild(r);
      });
    }
    var hint = el("div", "set-hint"); hint.textContent = "Una plantilla guarda textos, efectos, transiciones, pistas y formato (no los medios). Al aplicarla se suma al proyecto actual.";
    box.appendChild(hint); draw();
  }

  /* ---------- ajustes ---------- */
  function settings() {
    var S = window.ErizoSettings, box = modal("Ajustes", true);
    var esc = el("select"); [100, 125, 150].forEach(function (p) { var o = el("option"); o.value = p; o.textContent = p + " %"; esc.appendChild(o); });
    esc.value = String((window.ErizoUI && ErizoUI.scale) || 100); esc.onchange = function () { ErizoUI.set(parseInt(esc.value, 10)); };
    var auto = el("input"); auto.type = "checkbox"; auto.checked = S.autosave !== false; auto.onchange = function () { S.autosave = auto.checked; S.save(); };
    var dur = el("input"); dur.type = "number"; dur.min = "0.5"; dur.step = "0.5"; dur.value = S.imgDur; dur.onchange = function () { var v = parseFloat(dur.value); if (v >= 0.5) { S.imgDur = v; S.save(); } else dur.value = S.imgDur; };
    var snap = el("input"); snap.type = "checkbox"; snap.checked = !!ed.snapEnabled; snap.onchange = function () { ErizoTools.setSnap(snap.checked); };
    var rst = el("button", "al-btn"); rst.textContent = "Restablecer paneles"; rst.onclick = function () { var b = document.querySelector("#ws-menu button"); if (b) b.click(); toast("Paneles restablecidos."); };
    box.append(row("Escala de la interfaz", esc), row("Autoguardado en el navegador", auto), row("Duración de las imágenes al agregarlas (s)", dur),
      row("Imán de la línea de tiempo", snap), row("Diseño de paneles", rst));
    var h = el("h4"); h.textContent = "Atajos de teclado"; box.appendChild(h);
    ErizoProject.KEYS.forEach(function (k) { var r = el("div", "kb-row"), a = el("kbd"), b = el("span"); a.textContent = k[0]; b.textContent = k[1]; r.append(a, b); box.appendChild(r); });
  }

  /* ---------- salir ---------- */
  function exit() {
    if (!confirm("¿Salir del editor? Tu proyecto queda guardado automáticamente en este navegador.")) return;
    Promise.resolve(ErizoProject.flush()).then(function () {
      ErizoProject.stopSaving(); window.close();
      setTimeout(function () {
        var o = el("div", "kb-modal"), b = el("div", "kb-box"); b.innerHTML = "<h3>🦔 Erizo Cut</h3><p>Proyecto guardado. Ya puedes cerrar esta pestaña.</p>";
        var r = el("button", "al-btn"); r.textContent = "Volver al editor"; r.onclick = function () { location.reload(); }; b.appendChild(r); o.appendChild(b); document.body.appendChild(o);
      }, 250);
    });
  }

  /* ---------- menú ---------- */
  function build() {
    var m = document.getElementById("proj-menu"); if (!m) return; m.replaceChildren();
    function item(icon, txt, hint, fn, id) {
      var b = el("button"); if (id) b.id = id;
      b.innerHTML = '<span class="mi">' + icon + "</span><span class=\"ml\">" + txt + "</span>" + (hint ? '<span class="kbd">' + hint + "</span>" : "");
      b.onclick = fn; m.appendChild(b); return b;
    }
    item("＋", "Añadir la selección a la línea de tiempo", "", function () { ErizoMedia.addSelected(); }, "ar-add");
    m.appendChild(el("hr"));
    item("⤓", "Abrir proyecto…", "Ctrl+O", function () { ErizoProject.openDialog(); });
    item("🗂", "Importar medios…", "Ctrl+I", function () { ErizoProject.importMedia(); });
    item("💾", "Guardar", "Ctrl+S", function () { ErizoProject.saveFile(); });
    item("⬆", "Exportar…", "Ctrl+E", function () { ErizoProject.exportVideo(); });
    item("▣", "Guardar como plantilla…", "", tplSave);
    item("▤", "Aplicar plantilla…", "", tplDialog);
    item("🧹", "Vaciar la caché del proyecto", "", function () { ErizoProject.clearCache(); });
    m.appendChild(el("hr"));
    item("⚙", "Ajustes…", "Ctrl+,", settings);
    m.appendChild(el("hr"));
    item("✕", "Cerrar proyecto", "", function () { ErizoProject.closeProject(); });
    item("⏻", "Salir", "", exit);
    var btn = m.parentNode.querySelector(".menu-btn");
    btn.addEventListener("click", function () { document.getElementById("ar-add").disabled = !ErizoMedia.selected().length; });
  }
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () { ed = window.editor; if (!ed || !window.ErizoProject) return; build(); }, 0);
  });
  window.ErizoArchivo = { settings: settings };
})();
