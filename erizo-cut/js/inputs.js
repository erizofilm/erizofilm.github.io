/* Campos numéricos flexibles: permiten escribir "-", "." o "," sin número previo. */
(function () {
  "use strict";
  document.querySelectorAll('input[type="number"]').forEach(function (n) {
    n.type = "text"; n.setAttribute("inputmode", "decimal"); n.setAttribute("autocomplete", "off"); n.dataset.num = "1";
  });
  function isNum(t) { return t && t.dataset && t.dataset.num; }
  document.addEventListener("input", function (e) {
    var t = e.target; if (!isNum(t)) return;
    var v = t.value.replace(",", ".").replace(/[^\d.\-]/g, "").replace(/(?!^)-/g, "");
    var d = v.indexOf("."); if (d >= 0) v = v.slice(0, d + 1) + v.slice(d + 1).replace(/\./g, "");
    if (v !== t.value) t.value = v;
    if (!isFinite(parseFloat(v))) e.stopImmediatePropagation(); /* valor incompleto: no tocar el editor */
  }, true);
  document.addEventListener("keydown", function (e) {
    var t = e.target; if (!isNum(t)) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      var st = parseFloat(t.getAttribute("step")) || 1, dec = (String(st).split(".")[1] || "").length;
      t.value = ((parseFloat(t.value) || 0) + (e.key === "ArrowUp" ? 1 : -1) * st * (e.shiftKey ? 10 : 1)).toFixed(dec);
      t.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (e.key === "Enter") t.blur();
  });
  document.addEventListener("focusin", function (e) { if (isNum(e.target)) e.target.dataset.last = e.target.value; });
  document.addEventListener("focusout", function (e) {
    var t = e.target; if (!isNum(t) || isFinite(parseFloat(t.value))) return;
    t.value = t.dataset.last || "0"; t.dispatchEvent(new Event("input", { bubbles: true }));
  });
})();
