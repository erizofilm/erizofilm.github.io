/* Análisis de movimiento para estabilizar: estima el desplazamiento de cámara entre fotogramas muestreados. */
(function () {
  "use strict";
  var GW = 96, R = 8; /* ancho de análisis y radio de búsqueda (px del análisis) */
  function gray(ctx, w, h) {
    var d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
    for (var i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return g;
  }
  function seek(v, t) {
    return new Promise(function (res) {
      var done = false, to = setTimeout(fin, 4000);
      function fin() { if (done) return; done = true; clearTimeout(to); v.removeEventListener("seeked", fin); res(); }
      v.addEventListener("seeked", fin); try { v.currentTime = t; } catch (e) { fin(); }
    });
  }
  /* desplazamiento (dx,dy) tal que cur(x,y) ≈ prev(x+dx, y+dy); mínimo SAD con refinado subpíxel */
  function shift(prev, cur, w, h) {
    var m = R + 1, best = 1e12, bx = 0, by = 0, costs = {}, dx, dy, x, y;
    for (dy = -R; dy <= R; dy++) for (dx = -R; dx <= R; dx++) {
      var s = 0, n = 0;
      for (y = m; y < h - m; y += 2) for (x = m; x < w - m; x += 2) { s += Math.abs(cur[y * w + x] - prev[(y + dy) * w + x + dx]); n++; }
      s /= n; costs[dx + "," + dy] = s; if (s < best) { best = s; bx = dx; by = dy; }
    }
    function sub(c0, c1, c2) { var d = c0 - 2 * c1 + c2; return d > 1e-6 ? 0.5 * (c0 - c2) / d : 0; }
    var fx = bx > -R && bx < R ? sub(costs[(bx - 1) + "," + by], best, costs[(bx + 1) + "," + by]) : 0;
    var fy = by > -R && by < R ? sub(costs[bx + "," + (by - 1)], best, costs[bx + "," + (by + 1)]) : 0;
    return [bx + fx, by + fy];
  }
  /* devuelve [[tFuente, x, y]...] con la ruta de cámara acumulada (fracción del ancho/alto del fotograma) */
  function analyze(clip, opt) {
    opt = opt || {};
    return new Promise(function (resolve, reject) {
      var v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.src = clip.url;
      v.onerror = function () { reject(new Error("No se pudo leer el video.")); };
      v.onloadedmetadata = function () {
        var vw = v.videoWidth, vh = v.videoHeight; if (!vw) return reject(new Error("Video sin dimensiones."));
        var w = GW, h = Math.max(24, Math.round(GW * vh / vw)), cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        var ctx = cv.getContext("2d", { willReadFrequently: true });
        var t0 = clip.srcStart || 0, span = clip.duration * (clip.speed || 1), fps = Math.min(15, Math.max(6, 400 / Math.max(span, 1))), step = 1 / fps, n = Math.max(2, Math.floor(span / step) + 1);
        var path = [], px = 0, py = 0, prev = null, i = 0;
        (function next() {
          if (opt.signal && opt.signal.cancel) return reject(new Error("cancelado"));
          if (i >= n) { v.src = ""; return resolve(path); }
          var t = Math.min(t0 + i * step, t0 + span - 0.02);
          seek(v, t).then(function () {
            ctx.drawImage(v, 0, 0, w, h); var g = gray(ctx, w, h);
            if (prev) { var s = shift(prev, g, w, h); px += -s[0] / w; py += -s[1] / h; } /* el contenido se movió -(dx,dy) */
            path.push([t, px, py]); prev = g; i++;
            if (opt.onProgress) opt.onProgress(i / n);
            setTimeout(next, 0);
          });
        })();
      };
    });
  }
  window.ErizoStab = { analyze: analyze };
})();
