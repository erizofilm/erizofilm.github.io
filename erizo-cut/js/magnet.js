/* Magnetizar: al arrastrar en el visor, el elemento se pega al centro vertical y horizontal con guías. */
(function () {
  "use strict";
  var KEY = "erizocut.magnet", on = localStorage.getItem(KEY) !== "0", gv, gh, btn;
  function sync() { if (btn) { btn.classList.toggle("on", on); btn.title = (on ? "Magnetizar activado" : "Magnetizar desactivado") + " (M)"; } try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {} }
  function toggle() { on = !on; sync(); if (!on) hide(); }
  function hide() { if (gv) gv.style.display = "none"; if (gh) gh.style.display = "none"; }
  window.Magnet = {
    toggle: toggle,
    snap: function (ed, t, el) {
      if (!on || !ed.previewBox) return;
      var fr = ed.previewBox.getBoundingClientRect(), r = el.getBoundingClientRect(), z = (ed.previewZoom || 1) * ((window.ErizoUI && window.ErizoUI.k) || 1), thr = 8;
      var px = el.__px == null ? t.x : el.__px, py = el.__py == null ? t.y : el.__py;
      var cx = r.left + r.width / 2 - (fr.left + fr.width / 2) - px * z, cy = r.top + r.height / 2 - (fr.top + fr.height / 2) - py * z, sx = false, sy = false;
      if (Math.abs(cx + t.x * z) < thr) { t.x = -cx / z; sx = true; }
      if (Math.abs(cy + t.y * z) < thr) { t.y = -cy / z; sy = true; }
      el.__px = t.x; el.__py = t.y;
      if (gv) gv.style.display = sx ? "block" : "none"; if (gh) gh.style.display = sy ? "block" : "none";
    }
  };
  document.addEventListener("DOMContentLoaded", function () {
    var ed = window.editor; if (!ed || !ed.previewBox) return;
    var pb = ed.previewBox; if (getComputedStyle(pb).position === "static") pb.style.position = "relative";
    gv = document.createElement("div"); gv.className = "mg-guide mg-v"; gh = document.createElement("div"); gh.className = "mg-guide mg-h"; pb.append(gv, gh);
    btn = document.getElementById("magnet-btn"); if (btn) btn.onclick = toggle; sync();
    document.addEventListener("mouseup", function () { hide(); document.querySelectorAll(".layer-item,.text-overlay").forEach(function (e) { e.__px = e.__py = null; }); });
    document.addEventListener("keydown", function (e) {
      var tg = e.target, tag = tg && tg.tagName;
      if (e.code === "KeyM" && !e.ctrlKey && !e.metaKey && !e.altKey && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") toggle();
    });
  });
})();
