/* Ajustes persistentes del editor (se guardan en el navegador). */
(function () {
  "use strict";
  var KEY = "erizocut.settings.v1";
  var S = { autosave: true, imgDur: 5 };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  S.save = function () {
    var o = {}; Object.keys(S).forEach(function (k) { if (typeof S[k] !== "function") o[k] = S[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  };
  window.ErizoSettings = S;
})();
