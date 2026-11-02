/* Motor de animación: fotogramas clave, entradas/salidas, opacidad, velocidad, volumen y filtros en un solo bucle. */
(function () {
  "use strict";
  var ed;
  function $(id) { return document.getElementById(id); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function clipOf(e, id) { return e.clips.filter(function (c) { return c.id == id; })[0]; }
  function sel() {
    var ids = ed.selectedIds && ed.selectedIds.size ? Array.from(ed.selectedIds) : [];
    if (!ids.length && ed.selectedId) ids = [ed.selectedId];
    if (!ids.length && ed.selectedTextId) ids = [ed.selectedTextId];
    return ids.map(function (i) { return clipOf(ed, i); }).filter(Boolean);
  }
  function trOf(id) { return ed.transforms[id] || (ed.transforms[id] = Object.assign({}, ed.defaultTransform)); }

  /* entradas y salidas (transiciones de clip y animaciones de texto) */
  function part(type, p, o) {
    var e = clamp(p, 0, 1); e = e * e * (3 - 2 * e);
    if (type === "fade") o.op *= e;
    else if (type === "left") o.dx -= 1 - e;
    else if (type === "right") o.dx += 1 - e;
    else if (type === "up") o.dy -= 1 - e;
    else if (type === "down") o.dy += 1 - e;
    else if (type === "zoom") { o.z *= 0.6 + 0.4 * e; o.op *= e; }
  }
  function mod(e, clip, t) {
    var a = e.anim && e.anim[clip.id], x = window.ErizoTL ? window.ErizoTL.trans(e, clip) : null;
    if (!a && !x) return null;
    if (x) a = Object.assign({ inT: "", inD: 0, outT: "", outD: 0 }, a || {}, x);
    var o = { op: 1, dx: 0, dy: 0, z: 1 }, dt = t - clip.start, rem = clip.start + clip.duration - t;
    if (a.inT && a.inD > 0 && dt < a.inD) part(a.inT, dt / a.inD, o);
    if (a.outT && a.outD > 0 && rem < a.outD) part(a.outT, rem / a.outD, o);
    return o;
  }
  function text(e, clip, t, st) {
    var s = String(st.text || ""), a = e.anim && e.anim[clip.id];
    if (a && a.inT === "type" && a.inD > 0) s = s.slice(0, Math.ceil(clamp((t - clip.start) / a.inD, 0, 1) * s.length));
    return s;
  }
  function typed(el, st) {
    if (!ed) return; var id = el.dataset.clipId, c = clipOf(ed, id), a = ed.anim && ed.anim[id];
    if (c && a && a.inT === "type") el.textContent = text(ed, c, ed.timelineTime, st);
  }

  /* fotogramas clave */
  function interp(l, t) {
    if (t <= l[0].t) return l[0].v; var n = l.length - 1; if (t >= l[n].t) return l[n].v;
    for (var i = 0; i < n; i++) if (t <= l[i + 1].t) return l[i].v + (l[i + 1].v - l[i].v) * (t - l[i].t) / (l[i + 1].t - l[i].t);
  }
  function apply(e, t) {
    var k = e.kfs; if (!k) return;
    for (var id in k) {
      var c = clipOf(e, id); if (!c) continue;
      var tr = e.transforms[id] || (e.transforms[id] = Object.assign({}, e.defaultTransform));
      for (var p in k[id]) if (k[id][p] && k[id][p].length) tr[p] = interp(k[id][p], t - c.start);
    }
  }

  /* volumen por clip sin pisar el silencio que decide el editor */
  function vol(el, c) {
    var v = c.vol == null ? 1 : c.vol;
    if (el.volume !== el.__v) el.__b = el.volume;
    var nv = (el.__b == null ? 1 : el.__b) * v; if (el.volume !== nv) el.volume = nv; el.__v = el.volume;
  }
  function tick() {
    try {
      var t = ed.timelineTime, W = ed.previewBox ? ed.previewBox.offsetWidth : 0, H = ed.previewBox ? ed.previewBox.offsetHeight : 0, by = {};
      ed.clips.forEach(function (c) { by[c.id] = c; });
      if (ed.layersBox) { var lf = window.ErizoTL ? window.ErizoTL.mix("", t) : ""; if (ed.layersBox.__fx !== lf) { ed.layersBox.style.filter = lf; ed.layersBox.__fx = lf; } }
      [[ed.layerElements, false], [ed.textElements, true]].forEach(function (pair) {
        var map = pair[0];
        for (var id in map) {
          var el = map[id], c = by[id]; if (!el || !c) continue;
          var tr = ed.transforms[id] || {}, m = mod(ed, c, t), op = (tr.opacity == null ? 1 : tr.opacity) * (m ? m.op : 1), o = op === 1 ? "" : String(op);
          if (el.__o !== o) { el.style.opacity = o; el.__o = o; }
          var dxp = m ? m.dx * W : 0, dyp = m ? m.dy * H : 0, zz = m ? m.z : 1;
          if (!pair[1] && window.ErizoLook) { var lk = ErizoLook.frame(el, c, tr, t, W, H); dxp += lk.dx; dyp += lk.dy; zz *= lk.z; }
          var tx = dxp || dyp ? dxp + "px " + dyp + "px" : ""; if (el.__t !== tx) { el.style.translate = tx; el.__t = tx; }
          var sc = zz !== 1 ? String(zz) : ""; if (el.__s !== sc) { el.style.scale = sc; el.__s = sc; }
          if (!pair[1]) {
            var f = tr.filter || ""; if (el.__fx !== f) { el.style.filter = f; el.__fx = f; }
            if (el.tagName === "VIDEO") { var sp = c.speed || 1; if (el.playbackRate !== sp) el.playbackRate = sp; vol(el, c); }
            if (window.ErizoLook) ErizoLook.after(el);
          }
        }
      });
      for (var id in ed.audioElements) {
        var a = ed.audioElements[id], c = by[id]; if (!a || !c) continue;
        var sp = c.speed || 1; if (a.playbackRate !== sp) a.playbackRate = sp; vol(a, c);
      }
    } catch (e) {}
    requestAnimationFrame(tick);
  }

  /* Inspector: opacidad, velocidad, volumen */
  function setSpeed(c, s) {
    if (c.type !== "video" && c.type !== "audio") return;
    var old = c.speed || 1; if (old === s) return; c.duration = c.duration * old / s; c.speed = s;
  }
  function bindInspector() {
    var op = $("clip-op"), opn = $("clip-op-num"), sp = $("clip-speed"), vo = $("clip-vol"), von = $("clip-vol-num"); if (!op) return;
    function hist(l) { try { ed.pushHistory(l); } catch (e) {} }
    function setOp(v) { op.value = opn.value = v; sel().forEach(function (c) { trOf(c.id).opacity = v / 100; }); }
    function setVol(v) { vo.value = von.value = v; sel().forEach(function (c) { if (c.type === "video" || c.type === "audio") c.vol = v / 100; var l = c.linkId || c.linkedTo; if (l) { var p = clipOf(ed, l); if (p) p.vol = v / 100; } }); }
    [op, opn].forEach(function (e) { e.oninput = function () { var v = parseFloat(e.value); if (isFinite(v)) setOp(clamp(v, 0, 100)); }; e.onchange = function () { hist("Opacidad"); }; });
    [vo, von].forEach(function (e) { e.oninput = function () { var v = parseFloat(e.value); if (isFinite(v)) setVol(clamp(v, 0, 100)); }; e.onchange = function () { hist("Volumen"); }; });
    sp.onchange = function () {
      var s = parseFloat(sp.value);
      sel().forEach(function (c) { setSpeed(c, s); var l = c.linkId || c.linkedTo; if (l) { var p = clipOf(ed, l); if (p) setSpeed(p, s); } });
      try { ed.renderClips(); ed.updateMetrics(); ed.syncToTimeline(); } catch (e) {} hist("Velocidad");
    };
    setInterval(function () {
      if (!op.offsetParent || document.activeElement === op || document.activeElement === opn || document.activeElement === vo || document.activeElement === von) return;
      var c = sel()[0]; if (!c) return; var tr = ed.transforms[c.id] || {};
      op.value = opn.value = Math.round((tr.opacity == null ? 1 : tr.opacity) * 100);
      vo.value = von.value = Math.round((c.vol == null ? 1 : c.vol) * 100); sp.value = String(c.speed || 1);
    }, 250);
  }

  window.Anim = { apply: apply, mod: mod, text: text, typed: typed, sel: sel, trOf: trOf, clipOf: clipOf };
  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; if (!ed) return; window.Anim.ed = ed;
    try {
      var s = ed.syncToTimeline; ed.syncToTimeline = function () { try { apply(this, this.timelineTime); } catch (e) {} return s.apply(this, arguments); };
      bindInspector(); requestAnimationFrame(tick);
    } catch (e) { console.error("[Erizo] anim", e); }
  });
})();
