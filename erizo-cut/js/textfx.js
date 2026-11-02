/* Texto: alineación, sombra, contorno, animaciones de entrada/salida y estilos guardados. */
(function () {
  "use strict";
  var ed, F = {}, PKEY = "erizocut.textpresets";
  var BASE = { shOn: false, stW: 0 };
  var BUILT = {
    "Título": { font: "'Montserrat', sans-serif", size: 64, color: "#ffffff", weight: "900", bgAlpha: 0, align: "center", shOn: true, shColor: "#000000", shBlur: 8, shX: 3, shY: 3, shA: 0.8 },
    "Subtítulo": { font: "Inter, system-ui, sans-serif", size: 32, color: "#e5e7eb", weight: "700", bgAlpha: 0, align: "center", shOn: true, shColor: "#000000", shBlur: 4, shX: 2, shY: 2, shA: 0.7 },
    "Lower third": { font: "'Oswald', sans-serif", size: 36, color: "#ffffff", weight: "700", bg: "#7c3aed", bgAlpha: 0.85, align: "left" },
    "Neón": { font: "'Orbitron', sans-serif", size: 48, color: "#22d3ee", weight: "900", bgAlpha: 0, align: "center", shOn: true, shColor: "#22d3ee", shBlur: 18, shX: 0, shY: 0, shA: 1 },
    "Cómic": { font: "'Bangers', cursive", size: 60, color: "#facc15", weight: "400", bgAlpha: 0, align: "center", stColor: "#000000", stW: 6, shOn: true, shColor: "#000000", shBlur: 0, shX: 4, shY: 4, shA: 1 },
    "Minimal": { font: "'Poppins', sans-serif", size: 28, color: "#ffffff", weight: "400", bg: "#000000", bgAlpha: 0.5, align: "center" }
  };
  var KEEP = ["font", "size", "color", "bg", "bgAlpha", "weight", "align", "shOn", "shColor", "shBlur", "shX", "shY", "shA", "stColor", "stW"];
  function $(id) { return document.getElementById(id); }
  function cur() { var id = ed.selectedTextId || ed.selectedId, st = ed.textStyles[id]; return st ? { id: id, st: st } : null; }
  function user() { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; } }
  function apply(c) {
    var e = ed.textElements[c.id]; if (!e) return;
    __txtFx(e, c.st);
    var tr = ed.transforms[c.id] || ed.defaultTransform, sx = (tr.scale || 1) * (tr.scaleX || 1), sy = (tr.scale || 1) * (tr.scaleY || 1);
    e.style.transform = e.dataset.baseTransform + " translate(" + tr.x + "px," + tr.y + "px) scaleX(" + sx + ") scaleY(" + sy + ") rotate(" + tr.rot + "deg)" + __persp(tr);
  }
  function sync() {
    var c = cur(); if (!c) return; var st = c.st, a = ed.anim[c.id] || {};
    F.on.value = st.shOn ? "1" : "0"; F.color.value = st.shColor || "#000000"; F.stc.value = st.stColor || "#000000";
    F.pairs.forEach(function (p) { var v = st[p[1]] === undefined ? p[2] : Math.round(st[p[1]] * p[3]); p[4].value = v; p[5].value = v; });
    F.ain.value = a.inT || ""; F.aout.value = a.outT || ""; F.ad.value = String(a.inD || a.outD || 0.5);
    document.querySelectorAll(".al-btn[data-al]").forEach(function (b) { b.classList.toggle("on", b.dataset.al === (st.align || "center")); });
  }
  function fillPresets() {
    var s = F.preset; s.replaceChildren(); var o = document.createElement("option"); o.value = ""; o.textContent = "Elegir estilo…"; s.appendChild(o);
    var all = Object.assign({}, BUILT, user());
    Object.keys(all).forEach(function (k) { var x = document.createElement("option"); x.value = k; x.textContent = (BUILT[k] ? "" : "★ ") + k; s.appendChild(x); });
  }
  document.addEventListener("DOMContentLoaded", function () {
    ed = window.editor; if (!ed || !$("txt-sh-on")) return;
    try {
      F = { on: $("txt-sh-on"), color: $("txt-sh-color"), stc: $("txt-st-color"), ain: $("txt-an-in"), aout: $("txt-an-out"), ad: $("txt-an-d"), preset: $("txt-preset") };
      F.pairs = [["a", "shA", 70, 100, $("txt-sh-a"), $("txt-sh-a-num")], ["blur", "shBlur", 6, 1, $("txt-sh-blur"), $("txt-sh-blur-num")],
        ["x", "shX", 3, 1, $("txt-sh-x"), $("txt-sh-x-num")], ["y", "shY", 3, 1, $("txt-sh-y"), $("txt-sh-y-num")], ["w", "stW", 0, 1, $("txt-st-w"), $("txt-st-w-num")]];
      function set(fn, hist) { var c = cur(); if (!c) return; fn(c.st); apply(c); if (hist) { try { ed.pushHistory("Texto"); } catch (e) {} } }
      function shDefaults(st) { if (st.shA === undefined) { st.shA = 0.7; st.shBlur = 6; st.shX = 3; st.shY = 3; st.shColor = "#000000"; } }
      F.on.onchange = function () { set(function (st) { st.shOn = F.on.value === "1"; if (st.shOn) shDefaults(st); }, 1); sync(); };
      F.color.oninput = function () { set(function (st) { shDefaults(st); st.shColor = F.color.value; }); };
      F.stc.oninput = function () { set(function (st) { st.stColor = F.stc.value; if (!st.stW) st.stW = 3; }); sync(); };
      F.color.onchange = F.stc.onchange = function () { set(function () {}, 1); };
      F.pairs.forEach(function (p) {
        function from(src) {
          var v = parseFloat(src.value); if (!isFinite(v)) return; p[4].value = v; p[5].value = v;
          set(function (st) { st[p[1]] = v / p[3]; if (p[0] === "w") { if (!st.stColor) st.stColor = "#000000"; } else { shDefaults(st); st[p[1]] = v / p[3]; if (!st.shOn) { st.shOn = true; F.on.value = "1"; } } });
        }
        p[4].oninput = function () { from(p[4]); }; p[5].oninput = function () { from(p[5]); };
        p[4].onchange = p[5].onchange = function () { set(function () {}, 1); };
      });
      document.querySelectorAll(".al-btn[data-al]").forEach(function (b) {
        b.onclick = function () { var s = $("txt-align"); s.value = b.dataset.al; s.dispatchEvent(new Event("change", { bubbles: true })); };
      });
      $("txt-align").addEventListener("change", function () { var c = cur(); if (c) { apply(c); sync(); } });
      function setAnim(fn) {
        var c = cur(); if (!c) return; var a = ed.anim[c.id] || (ed.anim[c.id] = { inT: "", inD: 0.5, outT: "", outD: 0.5 }); fn(a);
        if (!a.inT && !a.outT) delete ed.anim[c.id]; try { ed.syncToTimeline(); ed.pushHistory("Animación de texto"); } catch (e) {}
      }
      F.ain.onchange = function () { setAnim(function (a) { a.inT = F.ain.value; }); };
      F.aout.onchange = function () { setAnim(function (a) { a.outT = F.aout.value; }); };
      F.ad.onchange = function () { var d = parseFloat(F.ad.value); setAnim(function (a) { a.inD = a.outD = d; }); };
      fillPresets();
      F.preset.onchange = function () {
        var c = cur(), k = F.preset.value; if (!c || !k) return;
        var p = Object.assign({}, BUILT, user())[k]; Object.assign(c.st, BASE, p);
        try { ed.syncToTimeline(); ed.selectText(c.id); ed.pushHistory("Estilo de texto"); } catch (e) {} F.preset.value = ""; setTimeout(sync, 0);
      };
      $("txt-preset-save").onclick = function () {
        var c = cur(); if (!c) return; var n = prompt("Nombre del estilo:"); if (!n) return;
        var u = user(), o = {}; KEEP.forEach(function (k) { if (c.st[k] !== undefined) o[k] = c.st[k]; }); u[n.trim()] = o;
        try { localStorage.setItem(PKEY, JSON.stringify(u)); } catch (e) {} fillPresets();
      };
      ["selectText", "selectClip"].forEach(function (m) { var o = ed[m]; if (o) ed[m] = function () { var r = o.apply(this, arguments); setTimeout(sync, 0); return r; }; });
      Array.prototype.forEach.call($("txt-font").options, function (o) { try { document.fonts.load("700 32px " + o.value); } catch (e) {} });
    } catch (e) { console.error("[Erizo] textfx", e); }
  });
})();
