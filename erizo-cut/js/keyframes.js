/* Panel Fotogramas clave: escala, posición, rotación y opacidad animables en el tiempo. */
(function () {
  "use strict";
  var PROPS = [
    { k: "scale", n: "Escala", u: "%", to: function (v) { return v * 100; }, from: function (v) { return v / 100; }, d: 1, dec: 0 },
    { k: "x", n: "Posición X", u: "px", to: function (v) { return v; }, from: function (v) { return v; }, d: 0, dec: 0 },
    { k: "y", n: "Posición Y", u: "px", to: function (v) { return v; }, from: function (v) { return v; }, d: 0, dec: 0 },
    { k: "rot", n: "Rotación", u: "°", to: function (v) { return v; }, from: function (v) { return v; }, d: 0, dec: 1 },
    { k: "opacity", n: "Opacidad", u: "%", to: function (v) { return v * 100; }, from: function (v) { return v / 100; }, d: 1, dec: 0 }
  ];
  var ed, root, sig = "";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function cur() {
    var id = ed.selectedTextId || ed.selectedId, c = id ? Anim.clipOf(ed, id) : null;
    return c && c.type !== "audio" ? c : null;
  }
  function val(c, p) { var v = Anim.trOf(c.id)[p.k]; return v == null ? p.d : v; }
  function rel(c) { return Math.max(0, Math.min(c.duration, ed.timelineTime - c.start)); }
  function list(c, k, make) { var m = ed.kfs[c.id] || (make ? (ed.kfs[c.id] = {}) : null); return m ? m[k] || (make ? (m[k] = []) : null) : null; }
  function near(l, t) { for (var i = 0; i < l.length; i++) if (Math.abs(l[i].t - t) < 0.05) return i; return -1; }
  function save() { try { ed.pushHistory("Fotograma clave"); } catch (e) {} }
  function seek(t) { ed.timelineTime = t; try { ed.syncToTimeline(); ed.updatePlayheadPos(); } catch (e) {} redraw(true); }
  function prune(c, k) {
    var m = ed.kfs[c.id]; if (m && m[k] && !m[k].length) delete m[k]; if (m && !Object.keys(m).length) delete ed.kfs[c.id];
  }
  function toggle(c, p) {
    var l = list(c, p.k, true), t = rel(c), i = near(l, t);
    if (i >= 0) l.splice(i, 1); else { l.push({ t: t, v: val(c, p) }); l.sort(function (a, b) { return a.t - b.t; }); }
    prune(c, p.k); save(); redraw(true);
  }
  function setVal(c, p, uv) {
    var v = p.from(uv), l = list(c, p.k, false);
    if (l && l.length) { var t = rel(c), i = near(l, t); if (i >= 0) l[i].v = v; else { l.push({ t: t, v: v }); l.sort(function (a, b) { return a.t - b.t; }); } }
    else Anim.trOf(c.id)[p.k] = v;
    try { ed.syncToTimeline(); } catch (e) {} save(); redraw(true);
  }
  function jump(c, p, dir) {
    var l = list(c, p.k, false); if (!l || !l.length) return; var t = rel(c), r = null;
    l.forEach(function (x) { if (dir < 0 && x.t < t - 0.02) r = x; if (dir > 0 && x.t > t + 0.02 && !r) r = x; });
    if (r) seek(c.start + r.t);
  }
  function draw(c) {
    root.replaceChildren();
    var wrap = el("div", "kf-wrap"), head = el("div", "kf-head");
    if (!c) {
      var m = el("div", "lib-empty"); m.textContent = "Selecciona un clip de video, imagen o texto en la línea de tiempo para animarlo con fotogramas clave."; wrap.appendChild(m); root.appendChild(wrap); return;
    }
    var t = el("span", "kf-title"); t.textContent = c.name || (c.type === "text" ? "Texto" : "Clip");
    var clr = el("button", "kf-clear"); clr.textContent = "Quitar todos los fotogramas clave";
    clr.onclick = function () { delete ed.kfs[c.id]; save(); redraw(true); };
    head.append(t, clr); wrap.appendChild(head);
    var r0 = rel(c);
    PROPS.forEach(function (p) {
      var row = el("div", "kf-row"), lb = el("span", "kf-lb"), inp = el("input"), pv = el("button", "kf-b"), df = el("button", "kf-b kf-d0"), nx = el("button", "kf-b"), lane = el("div", "kf-lane");
      var l = list(c, p.k, false) || [], has = l.length > 0, on = has && near(l, r0) >= 0;
      lb.textContent = p.n; inp.type = "text"; inp.dataset.num = "1"; inp.setAttribute("inputmode", "decimal"); inp.value = Number(p.to(val(c, p))).toFixed(p.dec);
      pv.textContent = "‹"; nx.textContent = "›"; df.textContent = on ? "◆" : "◇"; df.classList.toggle("on", on);
      pv.title = "Fotograma anterior"; nx.title = "Fotograma siguiente"; df.title = on ? "Quitar fotograma clave aquí" : "Agregar fotograma clave en el cabezal";
      inp.onchange = function () { var v = parseFloat(inp.value); if (isFinite(v)) setVal(c, p, v); else redraw(true); };
      pv.onclick = function () { jump(c, p, -1); }; nx.onclick = function () { jump(c, p, 1); }; df.onclick = function () { toggle(c, p); };
      l.forEach(function (k) {
        var d = el("span", "kf-dia"); d.style.left = (c.duration ? k.t / c.duration * 100 : 0) + "%"; d.title = "Clic: ir aquí · Doble clic: quitar";
        d.onclick = function (e) { e.stopPropagation(); seek(c.start + k.t); };
        d.ondblclick = function (e) { e.stopPropagation(); l.splice(l.indexOf(k), 1); prune(c, p.k); save(); redraw(true); };
        lane.appendChild(d);
      });
      var ph = el("span", "kf-ph"); ph.style.left = (c.duration ? r0 / c.duration * 100 : 0) + "%"; lane.appendChild(ph);
      lane.onclick = function (e) { var b = lane.getBoundingClientRect(); seek(c.start + (e.clientX - b.left) / b.width * c.duration); };
      row.append(lb, inp, pv, df, nx, lane); wrap.appendChild(row);
    });
    var tip = el("div", "kf-tip"); tip.textContent = "Mueve el cabezal, cambia un valor y pulsa ◇ para fijarlo. Con fotogramas clave, el valor se anima entre ellos.";
    wrap.appendChild(tip); root.appendChild(wrap);
  }
  function redraw(force) {
    var c = cur(), s = c ? [c.id, Math.round(ed.timelineTime * 20), JSON.stringify(ed.kfs[c.id] || {}), PROPS.map(function (p) { return Math.round(val(c, p) * 100); }).join(",")].join("|") : "none";
    if (!force && (s === sig || (document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === "INPUT"))) return;
    sig = s; draw(c);
  }
  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; root = document.getElementById("panel-keyframes"); if (!ed || !root) return;
    try { draw(null); setInterval(function () { if (root.offsetParent) redraw(false); }, 150); } catch (e) { console.error("[Erizo] keyframes", e); }
  });
})();
