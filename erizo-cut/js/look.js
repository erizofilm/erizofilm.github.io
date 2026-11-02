/* Motor visual del Inspector: fusión, voltear, recorte, máscara, quitar fondo (croma) y estabilización.
 * Se usa igual en la vista previa (CSS / canvas gemelo) y en la exportación (canvas). */
(function () {
  "use strict";
  var twins = new WeakMap(), expCanvas = {}, stabCache = {};
  var BLEND = [["normal", "Normal"], ["multiply", "Multiplicar"], ["screen", "Trama"], ["overlay", "Superponer"], ["darken", "Oscurecer"], ["lighten", "Aclarar"],
    ["color-dodge", "Sobreexponer color"], ["color-burn", "Subexponer color"], ["hard-light", "Luz fuerte"], ["soft-light", "Luz suave"], ["difference", "Diferencia"], ["exclusion", "Exclusión"]];
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------- formas (recorte + máscara) en coordenadas normalizadas del medio ---------- */
  function rectPts(l, t, r, b) { return [[l, t], [r, t], [r, b], [l, b]]; }
  function roundRect(l, t, r, b, rad) {
    var pts = [], k, a, cs = [[r - rad, t + rad, -90], [r - rad, b - rad, 0], [l + rad, b - rad, 90], [l + rad, t + rad, 180]];
    cs.forEach(function (c) { for (k = 0; k <= 8; k++) { a = (c[2] + 90 * k / 8) * Math.PI / 180; pts.push([c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)]); } });
    return pts;
  }
  function shape(mask, L, T, R, B) {
    var w = R - L, h = B - T, cx = L + w / 2, cy = T + h / 2, pts = [], i, a;
    if (mask === "top") return rectPts(L, T, R, T + h / 2);
    if (mask === "band") return rectPts(L, T + h / 3, R, T + 2 * h / 3);
    if (mask === "circle") { for (i = 0; i < 72; i++) { a = i * Math.PI / 36; pts.push([cx + w / 2 * Math.cos(a), cy + h / 2 * Math.sin(a)]); } return pts; }
    if (mask === "rect") { var ix = w * 0.08, iy = h * 0.08; return roundRect(L + ix, T + iy, R - ix, B - iy, Math.min(w, h) * 0.12); }
    if (mask === "heart") {
      for (i = 0; i < 72; i++) {
        a = i * Math.PI / 36; var x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        pts.push([cx + (x / 17) * w / 2 * 0.94, cy + ((y + 2.5) / 15) * h / 2 * 0.94]);
      }
      return pts;
    }
    if (mask === "star") { for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; var r = i % 2 ? 0.42 : 1; pts.push([cx + w / 2 * r * Math.cos(a), cy + h / 2 * r * Math.sin(a)]); } return pts; }
    return rectPts(L, T, R, B);
  }
  function crop(tr) { var c = tr.crop || {}; return [clamp((c.l || 0) / 100, 0, 0.95), clamp((c.t || 0) / 100, 0, 0.95), clamp((c.r || 0) / 100, 0, 0.95), clamp((c.b || 0) / 100, 0, 0.95)]; }
  function poly(tr) {
    var c = crop(tr), has = c[0] || c[1] || c[2] || c[3], m = tr.mask && tr.mask !== "none" ? tr.mask : "";
    if (!has && !m) return null;
    var L = c[0], T = c[1], R = Math.max(L + 0.02, 1 - c[2]), B = Math.max(T + 0.02, 1 - c[3]);
    return shape(m, L, T, R, B);
  }
  function fit(W, H, mw, mh) {
    var dw, dh; if (mw / mh > W / H) { dw = W; dh = W * mh / mw; } else { dh = H; dw = H * mw / mh; }
    return { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh };
  }

  /* ---------- estabilización: ruta de cámara → compensación ---------- */
  function stabData(c, tr) {
    var s = tr.stab; if (!s || !s.on || !s.path || s.path.length < 2) return null;
    var sig = [c.id, s.path.length, s.mode, s.win, s.strength, s.auto, s.extra].join("|"), hit = stabCache[c.id];
    if (hit && hit.sig === sig) return hit;
    var P = s.path, n = P.length, S = [], i, j, comp = [], mx = 0, my = 0;
    if (s.mode === "fixed") {
      var ax = 0, ay = 0; P.forEach(function (p) { ax += p[1]; ay += p[2]; }); ax /= n; ay /= n; for (i = 0; i < n; i++) S.push([ax, ay]);
    } else {
      var step = P[1][0] - P[0][0] || 0.08, half = Math.max(1, Math.round((s.win || 1) / step / 2));
      for (i = 0; i < n; i++) { var sx = 0, sy = 0, k = 0; for (j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) { sx += P[j][1]; sy += P[j][2]; k++; } S.push([sx / k, sy / k]); }
    }
    var st = clamp((s.strength == null ? 100 : s.strength) / 100, 0, 1);
    for (i = 0; i < n; i++) { var cx = (S[i][0] - P[i][1]) * st, cy = (S[i][1] - P[i][2]) * st; comp.push([P[i][0], cx, cy]); mx = Math.max(mx, Math.abs(cx)); my = Math.max(my, Math.abs(cy)); }
    var z = s.auto === false ? 1 : 1 + 2 * Math.max(mx, my) + 0.01;
    if (z > 1.5) { var f = 0.25 / Math.max(mx, my); comp.forEach(function (q) { q[1] *= Math.min(1, f); q[2] *= Math.min(1, f); }); z = 1.5; }
    z *= 1 + (s.extra || 0) / 100;
    return (stabCache[c.id] = { sig: sig, comp: comp, z: z });
  }
  function stabAt(c, tr, t) {
    var d = stabData(c, tr); if (!d) return null;
    var st = (c.srcStart || 0) + (t - c.start) * (c.speed || 1), a = d.comp, n = a.length, lo = 0, hi = n - 1;
    if (st <= a[0][0]) return { dx: a[0][1], dy: a[0][2], z: d.z };
    if (st >= a[n - 1][0]) return { dx: a[n - 1][1], dy: a[n - 1][2], z: d.z };
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (a[m][0] <= st) lo = m; else hi = m; }
    var u = (st - a[lo][0]) / (a[hi][0] - a[lo][0] || 1);
    return { dx: a[lo][1] + (a[hi][1] - a[lo][1]) * u, dy: a[lo][2] + (a[hi][2] - a[lo][2]) * u, z: d.z };
  }

  /* ---------- quitar fondo ---------- */
  function hex(h) { h = String(h || "#00ff00"); return [parseInt(h.slice(1, 3), 16) || 0, parseInt(h.slice(3, 5), 16) || 0, parseInt(h.slice(5, 7), 16) || 0]; }
  function ycc(r, g, b) { return [0.299 * r + 0.587 * g + 0.114 * b, -0.1687 * r - 0.3313 * g + 0.5 * b, 0.5 * r - 0.4187 * g - 0.0813 * b]; }
  function borderColor(d, w, h) {
    var th = Math.max(2, Math.round(Math.min(w, h) * 0.03)), pts = [], x, y, i;
    for (y = 0; y < h; y += 2) for (x = 0; x < w; x += 2) { if (x < th || y < th || x >= w - th || y >= h - th) { i = (y * w + x) * 4; pts.push([d[i], d[i + 1], d[i + 2]]); } }
    var m = [0, 0, 0], k;
    for (var pass = 0; pass < 3; pass++) {
      var s = [0, 0, 0], n = 0;
      pts.forEach(function (p) { if (!pass || Math.abs(p[0] - m[0]) + Math.abs(p[1] - m[1]) + Math.abs(p[2] - m[2]) < 90) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; n++; } });
      if (!n) break; for (k = 0; k < 3; k++) m[k] = s[k] / n;
    }
    return m;
  }
  function keyData(d, w, h, k) {
    var kc = k.mode === "auto" ? borderColor(d, w, h) : hex(k.color), key = ycc(kc[0], kc[1], kc[2]);
    var chromaKey = Math.hypot(key[1], key[2]) > 22, tol = (k.tol == null ? 40 : k.tol) / 100, soft = (k.soft == null ? 20 : k.soft) / 100;
    var T = tol * 150, S = Math.max(2, soft * 110), lw = chromaKey ? 0.15 : 0.9;
    var dom = kc[1] >= kc[0] && kc[1] >= kc[2] ? 1 : kc[2] >= kc[0] && kc[2] >= kc[1] ? 2 : 0, despill = k.mode === "chroma" && k.spill !== false && chromaKey;
    for (var i = 0, n = w * h * 4; i < n; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], p = ycc(r, g, b);
      var dist = Math.sqrt((p[1] - key[1]) * (p[1] - key[1]) + (p[2] - key[2]) * (p[2] - key[2]) + lw * (p[0] - key[0]) * lw * (p[0] - key[0]));
      var a = dist <= T ? 0 : dist >= T + S ? 1 : (dist - T) / S; a = a * a * (3 - 2 * a);
      if (despill && a > 0) {
        if (dom === 1) { var m1 = Math.max(r, b); if (g > m1) d[i + 1] = m1; }
        else if (dom === 2) { var m2 = Math.max(r, g); if (b > m2) d[i + 2] = m2; }
        else { var m0 = Math.max(g, b); if (r > m0) d[i] = m0; }
      }
      d[i + 3] = d[i + 3] * a;
    }
  }
  function keyedInto(src, cv, mw, mh, k, maxW) {
    var s = Math.min(1, maxW / mw), w = Math.max(2, Math.round(mw * s)), h = Math.max(2, Math.round(mh * s));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var x = cv.getContext("2d", { willReadFrequently: true }); x.clearRect(0, 0, w, h); x.drawImage(src, 0, 0, w, h);
    var id = x.getImageData(0, 0, w, h); keyData(id.data, w, h, k); x.putImageData(id, 0, 0);
    return cv;
  }
  function keyOn(tr) { var k = tr && tr.key; return !!(k && k.on && k.mode && k.mode !== "none"); }

  /* ---------- vista previa: llamado por anim.js en cada fotograma ---------- */
  function frame(el, c, tr, t, W, H) {
    var out = { dx: 0, dy: 0, z: 1 }, mw = el.videoWidth || el.naturalWidth || 0, mh = el.videoHeight || el.naturalHeight || 0;
    var bl = tr.blend && tr.blend !== "normal" ? tr.blend : ""; if (el.__bl !== bl) { el.style.mixBlendMode = bl; el.__bl = bl; }
    var fr = mw && mh ? fit(W, H, mw, mh) : null;
    var so = fr ? stabAt(c, tr, t) : null;
    if (so) { var sx = (tr.scale || 1) * (tr.scaleX || 1), sy = (tr.scale || 1) * (tr.scaleY || 1); out.dx = so.dx * fr.w * sx; out.dy = so.dy * fr.h * sy; out.z = so.z; }
    var cp = "", pts = fr ? poly(tr) : null;
    if (pts) cp = "polygon(" + pts.map(function (p) { return (fr.x + p[0] * fr.w).toFixed(1) + "px " + (fr.y + p[1] * fr.h).toFixed(1) + "px"; }).join(",") + ")";
    if (el.__cp !== cp) { el.style.clipPath = cp; el.__cp = cp; }
    var tw = twins.get(el);
    if (keyOn(tr) && mw) {
      if (!tw) { tw = document.createElement("canvas"); tw.className = "layer-item layer-twin"; tw.dataset.clipId = el.dataset.clipId; el.parentNode.insertBefore(tw, el.nextSibling); twins.set(el, tw); }
      var ready = el.tagName === "IMG" ? el.complete : el.readyState >= 2, sig = JSON.stringify(tr.key) + "|" + (el.currentTime || 0).toFixed(3) + "|" + mw + "x" + mh;
      if (ready && tw.__sig !== sig) { try { keyedInto(el, tw, mw, mh, tr.key, 900); tw.__sig = sig; } catch (e) {} }
      tw.__on = true; el.style.visibility = "hidden";
    } else if (tw && tw.__on) { tw.__on = false; tw.style.display = "none"; el.style.visibility = ""; }
    return out;
  }
  /* copia los estilos ya calculados del elemento a su canvas gemelo */
  function after(el) {
    var tw = twins.get(el); if (!tw) return;
    if (!el.isConnected) { tw.remove(); twins.delete(el); return; }
    if (!tw.__on) return;
    var cs = el.style.cssText.replace(/visibility:[^;]*;?/g, ""); if (tw.__cs !== cs) { tw.style.cssText = cs; tw.__cs = cs; }
  }
  function pick(el, fx, fy) { /* color del medio original en una posición normalizada del medio */
    var mw = el.videoWidth || el.naturalWidth, mh = el.videoHeight || el.naturalHeight; if (!mw) return null;
    var cv = document.createElement("canvas"); cv.width = 1; cv.height = 1; var x = cv.getContext("2d");
    x.drawImage(el, clamp(fx, 0, 1) * mw, clamp(fy, 0, 1) * mh, 1, 1, 0, 0, 1, 1);
    var d = x.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
  }

  /* ---------- exportación ---------- */
  function prep(ctx, clip, tr, t, source, mw, mh, dw, dh) {
    var bl = tr.blend && tr.blend !== "normal" ? tr.blend : "source-over"; ctx.globalCompositeOperation = bl;
    var so = stabAt(clip, tr, t);
    if (so) { ctx.translate(so.dx * dw * (tr.flipX ? -1 : 1), so.dy * dh * (tr.flipY ? -1 : 1)); if (so.z !== 1) ctx.scale(so.z, so.z); }
    var pts = poly(tr);
    if (pts) { ctx.beginPath(); pts.forEach(function (p, i) { var x = -dw / 2 + p[0] * dw, y = -dh / 2 + p[1] * dh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.clip(); }
    if (keyOn(tr)) { var cv = expCanvas[clip.id] || (expCanvas[clip.id] = document.createElement("canvas")); try { return keyedInto(source, cv, mw, mh, tr.key, 1280); } catch (e) {} }
    return source;
  }

  window.ErizoLook = { BLEND: BLEND, frame: frame, after: after, prep: prep, poly: poly, pick: pick, keyOn: keyOn, fit: fit, invalidate: function (id) { delete stabCache[id]; } };
})();
