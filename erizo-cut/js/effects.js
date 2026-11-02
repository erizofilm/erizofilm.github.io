/* Catálogo de transiciones, efectos y filtros (se muestra solo en la Biblioteca).
 * Clic o arrastrar → se agrega a la línea de tiempo (ver fxtimeline.js).
 * Mayús + clic → se aplica directamente al clip seleccionado. */
(function () {
  "use strict";
  var FX = {
    filters: [["Ninguno", ""], ["Blanco y negro", "grayscale(1)"], ["Sepia", "sepia(0.9)"], ["Vintage", "sepia(0.4) contrast(1.1) saturate(0.8)"],
      ["Frío", "hue-rotate(-15deg) saturate(1.2)"], ["Cálido", "sepia(0.3) saturate(1.3) hue-rotate(-10deg)"], ["Dramático", "contrast(1.4) saturate(0.8) brightness(0.9)"]],
    effects: [["Desenfoque", "blur(4px)"], ["Brillo +", "brightness(1.3)"], ["Contraste +", "contrast(1.4)"], ["Saturación +", "saturate(1.8)"], ["Invertir", "invert(1)"], ["Cambio de tono", "hue-rotate(90deg)"]],
    transitions: [["Ninguna", ""], ["Fundido", "fade"], ["Desde la izquierda", "left"], ["Desde la derecha", "right"], ["Desde arriba", "up"], ["Desde abajo", "down"], ["Zoom", "zoom"]]
  };
  var ICON = { "": "∅", fade: "◐", left: "→", right: "←", up: "↓", down: "↑", zoom: "⤢" };
  var tm = { mode: "both", dur: 0.5 }, views = [], ed;
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function toast(m) { var t = el("div", "fx-toast"); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function clips() { return Anim.sel().filter(function (c) { return c.type !== "fx"; }); }
  function media() { return clips().filter(function (c) { return c.type === "video" || c.type === "image"; }); }
  function firstClip() { return clips()[0]; }
  function build(tr) {
    var look = FX.filters.filter(function (f) { return f[0] === tr.look; })[0], parts = [];
    if (look && look[1]) parts.push(look[1]);
    (tr.fx || []).forEach(function (n) { var e = FX.effects.filter(function (x) { return x[0] === n; })[0]; if (e) parts.push(e[1]); });
    return parts.join(" ");
  }
  /* aplicar directamente al clip seleccionado (Mayús+clic, o "Ninguno"/"Ninguna") */
  function applyToClip(kind, i) {
    var list = kind === "transitions" ? clips() : media();
    if (!list.length) return toast(kind === "transitions" ? "Selecciona un clip en la línea de tiempo." : "Selecciona un clip de video o imagen en la línea de tiempo.");
    list.forEach(function (c) {
      if (kind === "transitions") {
        var type = FX.transitions[i][1], a = ed.anim[c.id] || (ed.anim[c.id] = { inT: "", inD: tm.dur, outT: "", outD: tm.dur });
        if (tm.mode !== "out") { a.inT = type; a.inD = tm.dur; }
        if (tm.mode !== "in") { a.outT = type; a.outD = tm.dur; }
        if (!a.inT && !a.outT) delete ed.anim[c.id];
        return;
      }
      var tr = Anim.trOf(c.id);
      if (kind === "filters") tr.look = i ? FX.filters[i][0] : "";
      else { var a2 = tr.fx || (tr.fx = []), p = a2.indexOf(FX.effects[i][0]); if (p >= 0) a2.splice(p, 1); else a2.push(FX.effects[i][0]); }
      tr.filter = build(tr);
    });
    try { ed.pushHistory(kind === "transitions" ? "Transición" : "Efecto"); ed.syncToTimeline(); } catch (e) {}
    refresh();
  }
  function chips(box, items, cur, fn) {
    var row = el("div", "fx-chips");
    items.forEach(function (x) { var b = el("button", "fx-chip" + (x[0] === cur ? " on" : "")); b.textContent = x[1]; b.onclick = function () { fn(x[0]); }; row.appendChild(b); });
    box.appendChild(row);
  }
  function draw(v) {
    var kind = v.kind, box = v.box, first = firstClip(), tr = first ? ed.transforms[first.id] || {} : {}, an = first ? ed.anim[first.id] || {} : {};
    box.replaceChildren();
    if (kind === "transitions") {
      chips(box, [["in", "Entrada"], ["out", "Salida"], ["both", "Ambas"]], tm.mode, function (m) { tm.mode = m; refresh(); });
      chips(box, [[0.3, "0.3 s"], [0.5, "0.5 s"], [1, "1 s"], [2, "2 s"]], tm.dur, function (d) { tm.dur = d; refresh(); });
    }
    var h = el("div", "fx-hint");
    h.textContent = "Haz clic o arrástralo a una pista de video para agregarlo a la línea de tiempo. Mayús + clic lo aplica solo al clip seleccionado.";
    box.appendChild(h);
    var grid = el("div", "fx-grid");
    FX[kind].forEach(function (f, i) {
      var c = el("button", "fx-card"), sw = el("div", "fx-sw"), n = el("span"), isNone = kind !== "effects" && i === 0;
      n.textContent = f[0];
      var on = false;
      if (kind === "filters") on = (tr.look || "") === (i ? f[0] : "");
      else if (kind === "effects") on = (tr.fx || []).indexOf(f[0]) >= 0;
      else on = i ? (tm.mode !== "out" && an.inT === f[1]) || (tm.mode !== "in" && an.outT === f[1]) : !an.inT && !an.outT;
      if (on && first) c.classList.add("on");
      if (kind === "transitions") { sw.textContent = ICON[f[1]]; sw.classList.add("ico"); } else sw.style.filter = f[1];
      c.append(sw, n);
      if (isNone) c.title = "Quitar del clip seleccionado";
      else {
        c.title = "Clic o arrastrar: agregar a la línea de tiempo · Mayús+clic: aplicar al clip seleccionado";
        c.draggable = true;
        c.ondragstart = function (e) {
          e.dataTransfer.setData("application/x-erizo-fx", JSON.stringify({ kind: kind, i: i }));
          e.dataTransfer.setData("text/plain", f[0]); e.dataTransfer.effectAllowed = "copy";
          document.body.classList.add("fx-dragging");
        };
      }
      c.onclick = function (e) {
        if (isNone || e.shiftKey || !window.ErizoTL) applyToClip(kind, i);
        else ErizoTL.add(kind, i);
      };
      grid.appendChild(c);
    });
    box.appendChild(grid);
  }
  function refresh() { views = views.filter(function (v) { return v.box.isConnected; }); views.forEach(draw); }
  function render(box, kind) { var v = { box: box, kind: kind }; views.push(v); draw(v); }
  window.ErizoFx = { render: render, refresh: refresh, FX: FX, ICON: ICON, tm: function () { return tm; } };

  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; if (!ed) return;
    try {
      var sc = ed.selectClip; ed.selectClip = function () { var r = sc.apply(this, arguments); setTimeout(refresh, 0); return r; };
    } catch (e) { console.error("[Erizo] effects", e); }
  });
})();
