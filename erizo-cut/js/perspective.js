// v30: perspectiva (preview CSS + export canvas por franjas)
function __persp(t) {
  var a = (t && t.perspX) || 0, b = (t && t.perspY) || 0;
  return a || b ? " perspective(600px) rotateX(" + b + "deg) rotateY(" + a + "deg)" : "";
}
function __drawPersp(ctx, src, dw, dh, tr) {
  var a = ((tr && tr.perspX) || 0) * Math.PI / 180, b = ((tr && tr.perspY) || 0) * Math.PI / 180;
  if (!a && !b) { ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh); return; }
  var d = Math.max(dw, dh) * 1.5, TW = Math.ceil(dw * 2), TH = Math.ceil(dh * 2);
  var T = document.createElement("canvas"); T.width = TW; T.height = TH;
  var tc = T.getContext("2d");
  var sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  var N = Math.max(1, Math.min(160, Math.ceil(dw))), i, j;
  for (i = 0; i < N; i++) {
    var x = -dw / 2 + (i + 0.5) * dw / N, cw = dw / N;
    var s1 = a ? d / (d + x * Math.sin(a)) : 1, k = a ? Math.cos(a) * s1 : 1;
    var ddh = dh * s1;
    tc.drawImage(src, i * sw / N, 0, sw / N, sh, TW / 2 + (a ? x * k : x) - cw * k / 2, TH / 2 - ddh / 2, cw * k + 0.8, ddh);
  }
  var M = Math.max(1, Math.min(240, TH)), ch = TH / M;
  for (j = 0; j < M; j++) {
    var y = -TH / 2 + (j + 0.5) * ch;
    var s2 = b ? d / (d - y * Math.sin(b)) : 1, k2 = b ? Math.cos(b) * s2 : 1;
    ctx.drawImage(T, 0, j * ch, TW, ch, -TW * s2 / 2, (b ? y * k2 : y) - ch * k2 / 2, TW * s2, ch * k2 + 0.8);
  }
}
