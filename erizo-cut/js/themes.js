/* Temas: paleta + estilo de esquinas, guardados en el navegador. */
(function () {
  "use strict";
  var KEY = "erizocut.theme.v1";
  var T = {
    erizo: { n: "Erizo (morado)", v: { bg0: "#0a0a0f", bg1: "#0f0f17", bg2: "#14141c", bg3: "#1a1a24", bg4: "#1c1c26", bg5: "#2a2a3c", line: "#2a2a36", line2: "#3a3a4a", acc: "#7c3aed", acc2: "#8b5cf6", acc3: "#a78bfa", accbg: "#261b45", hi: "#a3e635", hi2: "#bef264", tx: "#f1f1f7", tx2: "#cfcfe0", tx3: "#8b8ba3", tx4: "#6b6b85" } },
    lima: { n: "Lima (estilo Concat)", v: { bg0: "#0d0d0e", bg1: "#121213", bg2: "#171718", bg3: "#1d1d1f", bg4: "#242426", bg5: "#303033", line: "#2a2a2d", line2: "#3d3d42", acc: "#84cc16", acc2: "#a3e635", acc3: "#bef264", accbg: "#1f2a0e", hi: "#a3e635", hi2: "#d9f99d", tx: "#f4f4f5", tx2: "#d4d4d8", tx3: "#9a9aa3", tx4: "#71717a" } },
    medianoche: { n: "Medianoche (azul)", v: { bg0: "#070b14", bg1: "#0b1220", bg2: "#0f1729", bg3: "#131d33", bg4: "#19253f", bg5: "#22304f", line: "#1e2b47", line2: "#2f4166", acc: "#3b82f6", acc2: "#60a5fa", acc3: "#93c5fd", accbg: "#12254a", hi: "#22d3ee", hi2: "#67e8f9", tx: "#eef4ff", tx2: "#c7d6ef", tx3: "#8396b8", tx4: "#5f7194" } },
    grafito: { n: "Grafito (gris)", v: { bg0: "#0c0c0c", bg1: "#111111", bg2: "#171717", bg3: "#1d1d1d", bg4: "#262626", bg5: "#303030", line: "#2b2b2b", line2: "#404040", acc: "#6b7280", acc2: "#9ca3af", acc3: "#d1d5db", accbg: "#2a2a2a", hi: "#f59e0b", hi2: "#fbbf24", tx: "#f5f5f5", tx2: "#d4d4d4", tx3: "#a3a3a3", tx4: "#737373" } },
    bosque: { n: "Bosque (verde)", v: { bg0: "#070d0a", bg1: "#0b1410", bg2: "#101a15", bg3: "#15221b", bg4: "#1b2b22", bg5: "#25382d", line: "#1f3027", line2: "#2f4a3b", acc: "#10b981", acc2: "#34d399", acc3: "#6ee7b7", accbg: "#0d2a20", hi: "#fbbf24", hi2: "#fcd34d", tx: "#ecfdf5", tx2: "#c6e6d6", tx3: "#82a393", tx4: "#5f8070" } },
    rosa: { n: "Rosa neón", v: { bg0: "#0d070d", bg1: "#140a14", bg2: "#1a0f1c", bg3: "#221427", bg4: "#2c1a33", bg5: "#3a2345", line: "#33203d", line2: "#4f2f5e", acc: "#ec4899", acc2: "#f472b6", acc3: "#f9a8d4", accbg: "#3b0f2a", hi: "#22d3ee", hi2: "#67e8f9", tx: "#fdf2f8", tx2: "#ebcde0", tx3: "#a98aa0", tx4: "#8a6a82" } },
    atardecer: { n: "Atardecer (naranja)", v: { bg0: "#0e0805", bg1: "#150d08", bg2: "#1c120b", bg3: "#241711", bg4: "#2e1e16", bg5: "#3d281c", line: "#35221a", line2: "#54382a", acc: "#f97316", acc2: "#fb923c", acc3: "#fdba74", accbg: "#3a1c0a", hi: "#facc15", hi2: "#fde047", tx: "#fff7ed", tx2: "#f0d8c4", tx3: "#b39580", tx4: "#8f745f" } },
    contraste: { n: "Alto contraste", v: { bg0: "#000000", bg1: "#000000", bg2: "#0a0a0a", bg3: "#111111", bg4: "#1a1a1a", bg5: "#262626", line: "#5c5c5c", line2: "#8a8a8a", acc: "#2563eb", acc2: "#3b82f6", acc3: "#93c5fd", accbg: "#0b1f4d", hi: "#facc15", hi2: "#fde047", tx: "#ffffff", tx2: "#f5f5f5", tx3: "#d4d4d4", tx4: "#a3a3a3" } }
  };
  var S = { theme: "erizo", round: true, acc: null };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY))); } catch (e) {}
  function mix(h, w) { var n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(function (x) { return Math.round(x + (255 - x) * w); }); return "#" + c.map(function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }
  function apply() {
    var d = document.documentElement.style, v = (T[S.theme] || T.erizo).v;
    Object.keys(v).forEach(function (k) { d.setProperty("--" + k, v[k]); });
    if (S.acc) { d.setProperty("--acc", S.acc); d.setProperty("--acc2", mix(S.acc, 0.15)); d.setProperty("--acc3", mix(S.acc, 0.4)); }
    d.setProperty("--r", S.round ? "8px" : "2px");
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  apply();
  function menu() {
    var m = document.getElementById("theme-menu"); if (!m) return; m.replaceChildren();
    function btn(html, fn) { var b = document.createElement("button"); b.innerHTML = html; b.onclick = fn; m.appendChild(b); }
    Object.keys(T).forEach(function (k) {
      var v = T[k].v;
      btn('<span class="ws-check">' + (S.theme === k ? "✓" : "") + '</span><span class="th-sw" style="background:linear-gradient(135deg,' + v.bg2 + " 50%," + v.acc + ' 50%)"></span>' + T[k].n, function () { S.theme = k; S.acc = null; apply(); menu(); });
    });
    m.appendChild(document.createElement("hr"));
    btn('<span class="ws-check">' + (S.round ? "✓" : "") + "</span>Esquinas redondeadas", function () { S.round = true; apply(); menu(); });
    btn('<span class="ws-check">' + (!S.round ? "✓" : "") + "</span>Esquinas rectas", function () { S.round = false; apply(); menu(); });
    m.appendChild(document.createElement("hr"));
    var l = document.createElement("label"); l.className = "th-custom"; l.innerHTML = "Color de acento propio <input type=\"color\" value=\"" + (S.acc || T[S.theme].v.acc) + "\" />";
    l.onclick = function (e) { e.stopPropagation(); };
    l.querySelector("input").oninput = function (e) { S.acc = e.target.value; apply(); };
    m.appendChild(l);
  }
  document.addEventListener("DOMContentLoaded", menu);
})();
