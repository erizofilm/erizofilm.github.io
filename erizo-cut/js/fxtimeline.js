/* Transiciones, efectos y filtros como elementos de la línea de tiempo.
 * - Filtros / efectos: se aplican a todo el video mientras el elemento está bajo el cabezal.
 * - Transiciones: afectan a los clips que empiezan o terminan dentro del rango del elemento. */
(function () {
  "use strict";
  var ed, panel, FX, ICON;
  var MIME = "application/x-erizo-fx";
  var KIND = { filters: "Filtro", effects: "Efecto", transitions: "Transición" };
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function toast(m) { var t = el("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function K() { return (window.ErizoUI && window.ErizoUI.k) || 1; }
  function trackOn(c) {
    for (var i = 0; i < ed.allTracks.length; i++) if (ed.allTracks[i].id === c.trackId) return ed.allTracks[i].enabled !== false;
    return true;
  }

  /* ---------- lectura (la usan la vista previa y la exportación) ---------- */
  function active(t) {
    var out = [];
    for (var i = 0; i < ed.clips.length; i++) {
      var c = ed.clips[i];
      if (c.type === "fx" && c.fxKind !== "transitions" && c.fxVal && t >= c.start - 0.001 && t < c.start + c.duration && trackOn(c)) out.push(c);
    }
    return out;
  }
  function mix(base, t) {
    var parts = []; if (base) parts.push(base);
    active(t).forEach(function (c) { parts.push(c.fxVal); });
    return parts.join(" ");
  }
  function trans(e, clip) {
    if (clip.type !== "video" && clip.type !== "image" && clip.type !== "text") return null;
    var out = null, end = clip.start + clip.duration;
    for (var i = 0; i < e.clips.length; i++) {
      var c = e.clips[i];
      if (c.type !== "fx" || c.fxKind !== "transitions" || !c.fxVal || !trackOn(c)) continue;
      var d = c.fxDur > 0 ? c.fxDur : 0.5, a = c.start - 0.02, b = c.start + c.duration + 0.02, mode = c.fxMode || "both";
      if (mode !== "out" && clip.start >= a && clip.start <= b) { out = out || {}; out.inT = c.fxVal; out.inD = Math.min(d, clip.duration); }
      if (mode !== "in" && end >= a && end <= b) { out = out || {}; out.outT = c.fxVal; out.outD = Math.min(d, clip.duration); }
    }
    return out;
  }

  /* ---------- agregar a la línea de tiempo ---------- */
  function isVisual(c) { return c.type === "video" || c.type === "image" || c.type === "text"; }
  function boundaries() {
    var b = [];
    ed.clips.forEach(function (c) { if (isVisual(c)) { b.push(c.start); b.push(c.start + c.duration); } });
    return b;
  }
  function centerOn(time, dur) {
    var best = null, bd = 1.5;
    boundaries().forEach(function (x) { var d = Math.abs(x - time); if (d < bd) { bd = d; best = x; } });
    return Math.max(0, (best == null ? time : best) - dur / 2);
  }
  function freeOn(track, start, dur) {
    return !ed.clips.some(function (c) { return c.trackId === track.id && c.start < start + dur - 0.001 && c.start + c.duration > start + 0.001; });
  }
  function pickTrack(start, dur, wanted) {
    var vt = ed.videoTracks, i;
    if (wanted) for (i = 0; i < vt.length; i++) if (vt[i].id === wanted) return vt[i].id;
    for (i = vt.length - 1; i >= 0; i--) if (freeOn(vt[i], start, dur)) return vt[i].id;
    ed.addTrack("video");
    return ed.videoTracks[ed.videoTracks.length - 1].id;
  }
  function selectedVisual() {
    var s = window.Anim ? Anim.sel().filter(function (c) { return c.type === "video" || c.type === "image"; }) : [];
    return s[0] || null;
  }
  function add(kind, idx, opt) {
    opt = opt || {};
    var def = FX && FX[kind] && FX[kind][idx]; if (!def || !def[1]) return;
    var tm = window.ErizoFx && ErizoFx.tm ? ErizoFx.tm() : { mode: "both", dur: 0.5 };
    var sv = opt.start == null ? selectedVisual() : null, start, dur;
    if (kind === "transitions") {
      dur = Math.max(1, tm.dur * 2);
      if (opt.start != null) start = centerOn(opt.start, dur);
      else if (sv) start = Math.max(0, (tm.mode === "out" ? sv.start + sv.duration : sv.start) - dur / 2);
      else start = centerOn(ed.timelineTime, dur);
    } else if (opt.start != null) {
      start = Math.max(0, opt.start); dur = 3;
      var under = ed.clips.filter(function (c) { return (c.type === "video" || c.type === "image") && start >= c.start && start < c.start + c.duration; })[0];
      if (under && under.start + under.duration - start >= 0.5) dur = under.start + under.duration - start;
    } else if (sv) { start = sv.start; dur = sv.duration; }
    else { start = ed.timelineTime; dur = 3; }
    var id = Date.now() + Math.random();
    var trackId = pickTrack(start, dur, opt.trackId);
    var clip = {
      id: id, name: (ICON[def[1]] && kind === "transitions" ? ICON[def[1]] : kind === "filters" ? "◐" : "✦") + " " + def[0], type: "fx",
      fxKind: kind, fxIdx: idx, fxName: def[0], fxVal: def[1], fxMode: tm.mode, fxDur: tm.dur,
      url: "", start: start, duration: dur, srcStart: 0, srcDuration: dur, trackId: trackId, origW: 0, origH: 0, linkId: null, linkedTo: null
    };
    ed.clips.push(clip);
    ed.transforms[id] = Object.assign({}, ed.defaultTransform);
    try { ed.updateMetrics(); ed.renderClips(); ed.selectClip(id); ed.syncToTimeline(); ed.pushHistory("Agregar " + KIND[kind].toLowerCase()); } catch (e) { console.error("[Erizo] fx", e); }
    toast(KIND[kind] + " «" + def[0] + "» agregado a la línea de tiempo");
  }

  /* ---------- soltar desde la biblioteca sobre la línea de tiempo ---------- */
  function hasFx(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, MIME) >= 0; }
  function onTimeline(e) { return e.target.closest && e.target.closest("#timeline-wrapper,#tracks-sidebar,.timeline-tracks"); }
  function bindDrop() {
    document.addEventListener("dragover", function (e) {
      if (!hasFx(e) || !onTimeline(e)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "copy";
    }, true);
    document.addEventListener("drop", function (e) {
      if (!hasFx(e)) return;
      var inTl = onTimeline(e); document.body.classList.remove("fx-dragging");
      if (!inTl) return;
      e.preventDefault(); e.stopPropagation();
      var data; try { data = JSON.parse(e.dataTransfer.getData(MIME)); } catch (x) { return; }
      var tid = ed.getTrackAtY(e.clientY), tr = tid ? ed.allTracks.filter(function (t) { return t.id === tid; })[0] : null;
      if (tr && tr.type === "audio") return toast("Suéltalo en una pista de video, no de audio.");
      var content = document.querySelector(".track-content"), start = null;
      if (content && !e.target.closest("#tracks-sidebar")) {
        var r = content.getBoundingClientRect(); start = Math.max(0, (e.clientX - r.left) / K() / ed.pixelsPerSecond);
      } else start = ed.timelineTime;
      add(data.kind, data.i, { start: start, trackId: tr ? tr.id : null });
    }, true);
    document.addEventListener("dragend", function () { document.body.classList.remove("fx-dragging"); });
  }

  /* ---------- Inspector: ajustes de una transición seleccionada ---------- */
  function buildPanel() {
    var rp = document.querySelector(".right-panel"); if (!rp) return;
    panel = el("div", "prop-group fx-prop"); panel.style.display = "none";
    panel.innerHTML = '<div class="prop-label" id="fxp-title">Transición</div>' +
      '<div class="transform-row" id="fxp-mode-row"><label>Aplicar a</label><select id="fxp-mode"><option value="in">Entrada del clip</option><option value="out">Salida del clip</option><option value="both">Entrada y salida</option></select></div>' +
      '<div class="transform-row" id="fxp-dur-row"><label>Duración</label><select id="fxp-dur"><option value="0.3">0.3 s</option><option value="0.5">0.5 s</option><option value="1">1 s</option><option value="2">2 s</option></select></div>' +
      '<div class="help" id="fxp-help"></div>';
    rp.insertBefore(panel, rp.firstChild);
    function cur() { var s = window.Anim ? Anim.sel()[0] : null; return s && s.type === "fx" ? s : null; }
    function commit(label) { try { ed.pushHistory(label); ed.syncToTimeline(); } catch (e) {} }
    panel.querySelector("#fxp-mode").onchange = function (e) { var c = cur(); if (c) { c.fxMode = e.target.value; commit("Transición"); } };
    panel.querySelector("#fxp-dur").onchange = function (e) { var c = cur(); if (c) { c.fxDur = parseFloat(e.target.value); commit("Transición"); } };
    var last = "";
    setInterval(function () {
      var c = cur(), sig = c ? [c.id, c.fxKind, c.fxMode, c.fxDur].join("|") : "";
      if (sig === last) return; last = sig;
      if (!c) { panel.style.display = "none"; return; }
      panel.style.display = "block";
      var tr = c.fxKind === "transitions";
      panel.querySelector("#fxp-title").textContent = KIND[c.fxKind] + ": " + c.fxName;
      panel.querySelector("#fxp-mode-row").style.display = tr ? "flex" : "none";
      panel.querySelector("#fxp-dur-row").style.display = tr ? "flex" : "none";
      panel.querySelector("#fxp-mode").value = c.fxMode || "both";
      panel.querySelector("#fxp-dur").value = String(c.fxDur || 0.5);
      panel.querySelector("#fxp-help").textContent = tr
        ? "Afecta a los clips que empiezan o terminan dentro de este elemento. Arrástralo o estira sus bordes en la línea de tiempo."
        : "Se aplica a todo el video mientras este elemento esté bajo el cabezal. Arrástralo o estira sus bordes para cambiar cuándo actúa.";
    }, 200);
  }

  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; if (!ed || !window.ErizoFx) return;
    FX = ErizoFx.FX; ICON = ErizoFx.ICON;
    try {
      /* clase por tipo de elemento para colorearlo en la línea de tiempo */
      var rc = ed.renderClips;
      ed.renderClips = function () {
        var r = rc.apply(this, arguments), self = this;
        document.querySelectorAll(".clip.fx").forEach(function (d) {
          var c = self.clips.filter(function (x) { return String(x.id) === d.dataset.id; })[0];
          if (c) { d.classList.add("k-" + (c.fxKind || "filters")); d.title = KIND[c.fxKind] + ": " + c.fxName; }
        });
        return r;
      };
      bindDrop(); buildPanel();
    } catch (e) { console.error("[Erizo] fxtimeline", e); }
  });

  window.ErizoTL = { add: add, mix: mix, trans: trans, active: active, MIME: MIME };
})();
