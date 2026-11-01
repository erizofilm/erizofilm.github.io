/* Workspace: 6 espacios (2 filas x 3), paneles intercambiables, bloqueables y redimensionables. */
(function () {
  "use strict";
  var KEY = "erizocut.layout.v2";
  var P = { library: "🗂 Biblioteca", preview: "🖼 Vista previa", inspector: "⚙ Inspector", keyframes: "◇ Fotogramas clave", timeline: "☰ Línea de tiempo" };
  var IDS = Object.keys(P);
  function def() {
    return { tools: 1, rows: [1.7, 1], slots: [
      { p: "library", v: 1, l: 0, g: 0.8 }, { p: "preview", v: 1, l: 0, g: 2 }, { p: "inspector", v: 1, l: 0, g: 1.1 },
      { p: "timeline", v: 1, l: 0, g: 1 }, { p: null, v: 0, l: 0, g: 1 }, { p: null, v: 0, l: 0, g: 1 } ] };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY)), seen = {};
      if (s && s.slots && s.slots.length === 6 && s.rows) {
        s.slots.forEach(function (x) { if (x.p && (!P[x.p] || seen[x.p])) x.p = null; if (x.p) seen[x.p] = 1; });
        return s;
      }
    } catch (e) {}
    return def();
  }
  var S = load(), nodes = {}, ws, rowEl = [], hs, slotEl = [], timer;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function el(t, c, a) { var e = document.createElement(t); if (c) e.className = c; if (a) for (var k in a) e.setAttribute(k, a[k]); return e; }
  function refit() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      window.dispatchEvent(new Event("resize"));
      var b = document.getElementById("preview-fit"); if (b) b.click();
    }, 150);
  }
  function commit() { render(); save(); refit(); }
  function slotOf(pid) { return S.slots.findIndex(function (s) { return s.v && s.p === pid; }); }
  function flash(i) { var r = slotEl[i].root; r.classList.remove("shake"); void r.offsetWidth; r.classList.add("shake"); }

  function assign(i, pid) {
    var s = S.slots[i]; if (s.l) return flash(i);
    if (pid) {
      var j = S.slots.findIndex(function (x, k) { return k !== i && x.p === pid; });
      if (j >= 0) { if (S.slots[j].l) return flash(j); S.slots[j].p = s.p; }
    }
    s.p = pid; s.v = 1; commit();
  }
  function closeSlot(i) { var s = S.slots[i]; if (s.l) return flash(i); s.v = 0; s.p = null; commit(); }
  function place(pid) {
    var i = slotOf(pid); if (i >= 0) return closeSlot(i);
    var t = S.slots.findIndex(function (s) { return s.v && !s.p; });
    if (t < 0) t = S.slots.findIndex(function (s) { return !s.v; });
    if (t < 0) t = S.slots.findIndex(function (s) { return !s.l; });
    if (t < 0) return;
    S.slots[t].v = 1; S.slots[t].p = null; assign(t, pid);
  }

  function mkSlot(i) {
    var root = el("div", "ws-slot"), head = el("div", "ws-head"), body = el("div", "ws-body");
    var grip = el("span", "ws-grip"); grip.textContent = "⋮⋮";
    var sel = el("select", "", { title: "Elegir panel" });
    sel.innerHTML = '<option value="">— vacío —</option>' + IDS.map(function (k) { return '<option value="' + k + '">' + P[k] + "</option>"; }).join("");
    var lock = el("button", "ws-btn ws-lock", { title: "Bloquear / desbloquear" }), cls = el("button", "ws-btn", { title: "Quitar espacio" });
    cls.textContent = "✕";
    head.append(grip, sel, lock, cls); root.append(head, body);
    sel.onchange = function () { assign(i, sel.value || null); sel.value = S.slots[i].p || ""; };
    lock.onclick = function () { S.slots[i].l = S.slots[i].l ? 0 : 1; commit(); };
    cls.onclick = function () { closeSlot(i); };
    head.onmousedown = function (e) { root.draggable = !S.slots[i].l && !e.target.closest("select,button"); };
    root.ondragstart = function (e) { if (!root.draggable) return e.preventDefault(); e.dataTransfer.setData("text/plain", String(i)); root.classList.add("dragging"); };
    root.ondragend = function () { root.draggable = false; root.classList.remove("dragging"); slotEl.forEach(function (x) { x.root.classList.remove("over"); }); };
    root.ondragover = function (e) { e.preventDefault(); root.classList.add("over"); };
    root.ondragleave = function () { root.classList.remove("over"); };
    root.ondrop = function (e) {
      e.preventDefault(); root.classList.remove("over");
      var a = parseInt(e.dataTransfer.getData("text/plain"), 10); if (isNaN(a) || a === i) return;
      if (S.slots[a].l || S.slots[i].l) return flash(S.slots[i].l ? i : a);
      var t = S.slots[a].p; S.slots[a].p = S.slots[i].p; S.slots[i].p = t; commit();
    };
    return { root: root, body: body, sel: sel, lock: lock, cls: cls };
  }

  function vsplit(sp, a, b) {
    sp.onpointerdown = function (e) {
      e.preventDefault(); sp.setPointerCapture(e.pointerId); sp.classList.add("active"); document.body.classList.add("ws-dragging");
      var x0 = e.clientX, wa = slotEl[a].root.offsetWidth, wb = slotEl[b].root.offsetWidth, sum = S.slots[a].g + S.slots[b].g;
      sp.onpointermove = function (ev) {
        var nw = Math.max(110, Math.min(wa + wb - 110, wa + ev.clientX - x0));
        S.slots[a].g = nw / (wa + wb) * sum; S.slots[b].g = sum - S.slots[a].g;
        slotEl[a].root.style.flex = S.slots[a].g + " 1 0px"; slotEl[b].root.style.flex = S.slots[b].g + " 1 0px";
      };
      sp.onpointerup = function () {
        sp.onpointermove = sp.onpointerup = null; sp.classList.remove("active"); document.body.classList.remove("ws-dragging"); save(); refit();
      };
    };
    sp.ondblclick = function () { var m = (S.slots[a].g + S.slots[b].g) / 2; S.slots[a].g = S.slots[b].g = m; commit(); };
  }
  function hsplit(sp) {
    sp.onpointerdown = function (e) {
      e.preventDefault(); sp.setPointerCapture(e.pointerId); sp.classList.add("active"); document.body.classList.add("ws-dragging");
      var y0 = e.clientY, ha = rowEl[0].offsetHeight, hb = rowEl[1].offsetHeight, sum = S.rows[0] + S.rows[1];
      sp.onpointermove = function (ev) {
        var nh = Math.max(90, Math.min(ha + hb - 90, ha + ev.clientY - y0));
        S.rows[0] = nh / (ha + hb) * sum; S.rows[1] = sum - S.rows[0];
        rowEl[0].style.flex = S.rows[0] + " 1 0px"; rowEl[1].style.flex = S.rows[1] + " 1 0px";
      };
      sp.onpointerup = function () {
        sp.onpointermove = sp.onpointerup = null; sp.classList.remove("active"); document.body.classList.remove("ws-dragging"); save(); refit();
      };
    };
    sp.ondblclick = function () { S.rows = [1.7, 1]; commit(); };
  }

  function render() {
    [0, 1].forEach(function (r) {
      var row = rowEl[r], ids = [0, 1, 2].map(function (k) { return r * 3 + k; });
      var vis = ids.filter(function (i) { return S.slots[i].v; }), hid = ids.filter(function (i) { return !S.slots[i].v; });
      row.replaceChildren();
      vis.forEach(function (i, k) {
        if (k) { var sp = el("div", "ws-split v", { title: "Arrastra para redimensionar · doble clic = igualar" }); row.appendChild(sp); vsplit(sp, vis[k - 1], i); }
        row.appendChild(slotEl[i].root); slotEl[i].root.style.flex = S.slots[i].g + " 1 0px";
      });
      if (hid.length) {
        var add = el("button", "ws-add", { title: "Agregar espacio" }); add.textContent = "＋";
        add.onclick = function () { S.slots[hid[0]].v = 1; S.slots[hid[0]].g = 1; commit(); };
        row.appendChild(add);
      }
      row.style.display = vis.length ? "flex" : "none"; row.style.flex = S.rows[r] + " 1 0px";
    });
    hs.style.display = rowEl[0].style.display !== "none" && rowEl[1].style.display !== "none" ? "" : "none";
    S.slots.forEach(function (s, i) {
      var x = slotEl[i], p = s.p;
      x.root.classList.toggle("locked", !!s.l); x.sel.value = p || ""; x.sel.disabled = !!s.l; x.cls.disabled = !!s.l;
      x.lock.textContent = s.l ? "🔒" : "🔓";
      if (p) x.body.replaceChildren(nodes[p]);
      else {
        var em = el("div", "ws-empty"); em.innerHTML = "<div>Espacio vacío</div>";
        IDS.filter(function (k) { return slotOf(k) < 0; }).forEach(function (k) {
          var b = el("button"); b.textContent = "＋ " + P[k]; b.onclick = function () { assign(i, k); }; em.appendChild(b);
        });
        x.body.replaceChildren(em);
      }
    });
    var tb = document.querySelector(".sidebar"); if (tb) tb.style.display = S.tools ? "" : "none";
    renderMenu();
  }

  function renderMenu() {
    var m = document.getElementById("ws-menu"); if (!m) return; m.replaceChildren();
    function item(txt, on, fn) {
      var b = el("button"); b.innerHTML = (on === null ? "" : '<span class="ws-check">' + (on ? "✓" : "") + "</span>") + txt;
      b.onclick = function () { fn(); }; m.appendChild(b);
    }
    function hr() { m.appendChild(el("hr")); }
    IDS.forEach(function (k) { item(P[k], slotOf(k) >= 0, function () { place(k); }); });
    hr();
    S.slots.forEach(function (s, i) { item("Espacio " + (i + 1) + (s.l ? " 🔒" : ""), !!s.v, function () { if (s.v) closeSlot(i); else { s.v = 1; s.g = 1; commit(); } }); });
    hr();
    item("Barra de herramientas", !!S.tools, function () { S.tools = S.tools ? 0 : 1; commit(); });
    item("6 paneles (3×2)", null, function () {
      S.slots.forEach(function (s) { s.v = 1; s.g = 1; }); S.rows = [1, 1];
      IDS.forEach(function (k) { if (slotOf(k) < 0) { var t = S.slots.findIndex(function (s) { return !s.p && !s.l; }); if (t >= 0) S.slots[t].p = k; } });
      commit();
    });
    item("↺ Restablecer disposición", null, function () { S = def(); commit(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".main"), right = document.querySelector(".right-panel");
    var center = document.querySelector(".center"), tl = document.querySelector(".timeline-container");
    if (!main || !right || !center || !tl) return;
    var lib = el("div", "ws-lib"), first = right.querySelector(".prop-group"); if (first) lib.appendChild(first);
    var kf = el("div", "ws-kf");
    kf.innerHTML = "<div style=\"font-size:22px\">◇</div><b>Fotogramas clave</b><p>Panel reservado para animar propiedades (posición, escala, rotación, perspectiva) a lo largo del tiempo. Próximamente.</p>";
    nodes = { library: lib, preview: center, inspector: right, keyframes: kf, timeline: tl };
    ws = el("div", "", { id: "ws" });
    rowEl = [el("div", "ws-row"), el("div", "ws-row")];
    hs = el("div", "ws-split h", { title: "Arrastra para redimensionar · doble clic = restablecer" });
    ws.append(rowEl[0], hs, rowEl[1]); main.appendChild(ws); hsplit(hs);
    for (var i = 0; i < 6; i++) slotEl.push(mkSlot(i));
    render(); refit();
    window.addEventListener("resize", refit);
  });
})();
