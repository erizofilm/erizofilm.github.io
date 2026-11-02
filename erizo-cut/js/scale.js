/* Escala de la interfaz (menú Escala: 100 / 125 / 150 %) y opciones de escala de la Vista previa. */
(function () {
  "use strict";
  var KEY = "erizocut.uiscale", SIZES = [100, 125, 150];
  var pct = 100;
  try { pct = parseInt(localStorage.getItem(KEY), 10) || 100; } catch (e) {}
  if (SIZES.indexOf(pct) < 0) pct = 100;
  /* k = cuántos píxeles de pantalla mide 1 px CSS (los eventos del ratón usan píxeles de pantalla) */
  var UI = (window.ErizoUI = { scale: pct, s: pct / 100, k: 1, set: function (p) { setScale(p); } });

  function probe() {
    var d = document.createElement("div");
    d.style.cssText = "position:absolute;left:0;top:0;width:100px;height:1px;visibility:hidden;pointer-events:none";
    document.body.appendChild(d); var w = d.getBoundingClientRect().width; d.remove();
    return w > 0 ? w / 100 : 1;
  }
  function fit() {
    var b = document.body; if (!b) return;
    if (UI.scale === 100) { b.style.height = b.style.width = ""; return; }
    UI.k = probe();
    b.style.width = window.innerWidth / UI.k + "px"; b.style.height = window.innerHeight / UI.k + "px";
  }
  function refitPreview() { try { if (window.editor) editor.updatePreviewBoxSize(); } catch (e) {} }
  function setScale(p, silent) {
    UI.scale = p; UI.s = p / 100;
    document.documentElement.style.zoom = p === 100 ? "" : String(UI.s);
    UI.k = 1; fit();
    try { localStorage.setItem(KEY, String(p)); } catch (e) {}
    menu();
    if (!silent) setTimeout(refitPreview, 60);
  }
  function menu() {
    var m = document.getElementById("scale-menu"); if (!m) return; m.replaceChildren();
    var l = document.createElement("div"); l.className = "ws-mlabel"; l.textContent = "Escala de la interfaz"; m.appendChild(l);
    SIZES.forEach(function (p) {
      var b = document.createElement("button");
      b.innerHTML = '<span class="ws-check">' + (UI.scale === p ? "✓" : "") + "</span>" + p + "%";
      b.onclick = function () { setScale(p); };
      m.appendChild(b);
    });
  }
  /* se aplica antes de que cargue el resto, para evitar un salto visual */
  document.documentElement.style.zoom = pct === 100 ? "" : String(pct / 100);
  window.addEventListener("resize", fit);

  /* ---------- Vista previa: Ajustar, 25, 50, 75, 100 (tamaño real) y 200 % ---------- */
  var STEPS = [25, 50, 75, 100, 200];
  function previewUI(ed) {
    var sel = document.getElementById("preview-scale-select"); if (!sel) return;
    sel.replaceChildren();
    function opt(v, txt) { var o = document.createElement("option"); o.value = v; o.textContent = txt; sel.appendChild(o); }
    opt("fit", "Ajustar"); STEPS.forEach(function (p) { opt(String(p), p === 100 ? "100 % · tamaño real" : p + " %"); });
    opt("c", "Personalizado"); sel.querySelector('option[value="c"]').hidden = true;
    function pct() { return ed.previewPct != null ? ed.previewPct * 100 : (ed.previewZoom || 1) * (ed.fitScale || 1) * 100; }
    function sync() {
      var c = sel.querySelector('option[value="c"]');
      if (ed.previewPct == null && Math.abs((ed.previewZoom || 1) - 1) < 0.001) { c.hidden = true; sel.value = "fit"; return; }
      var p = Math.round(pct()); if (STEPS.indexOf(p) >= 0 && ed.previewPct != null) { c.hidden = true; sel.value = String(p); return; }
      c.textContent = p + " %"; c.hidden = false; sel.value = "c";
    }
    sel.onchange = function () { if (sel.value === "fit") ed.setPreviewZoom(1); else if (sel.value !== "c") ed.setPreviewPercent(parseInt(sel.value, 10) / 100); };
    UI.onPreview = sync;
    UI.stepPreview = function (dir) {
      var cur = pct(), next = null, i;
      if (dir > 0) { for (i = 0; i < STEPS.length; i++) if (STEPS[i] > cur + 0.5) { next = STEPS[i]; break; } if (next == null) next = STEPS[STEPS.length - 1]; }
      else { for (i = STEPS.length - 1; i >= 0; i--) if (STEPS[i] < cur - 0.5) { next = STEPS[i]; break; } if (next == null) next = STEPS[0]; }
      ed.setPreviewPercent(next / 100);
    };
    sync();
  }

  document.addEventListener("DOMContentLoaded", function () {
    menu(); setScale(UI.scale, true);
    var ed = window.editor; if (!ed) return;
    try {
      previewUI(ed);
      /* menú contextual del editor: posición correcta con cualquier escala */
      ed.showContextMenu = function (x, y) {
        var m = document.getElementById("context-menu"); if (!m) return;
        m.style.display = "block"; var k = UI.k || 1, w = m.offsetWidth * k, h = m.offsetHeight * k;
        m.style.left = Math.max(0, Math.min(x, window.innerWidth - w - 4)) / k + "px";
        m.style.top = Math.max(0, Math.min(y, window.innerHeight - h - 4)) / k + "px";
      };
      refitPreview();
    } catch (e) { console.error("[Erizo] escala", e); }
  });
})();
