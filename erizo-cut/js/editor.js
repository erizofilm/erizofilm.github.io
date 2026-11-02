(function () {
        "use strict";
        /* Factor de escala de la interfaz: convierte píxeles de pantalla (ratón) en píxeles CSS. */
        function __K() {
          return (window.ErizoUI && window.ErizoUI.k) || 1;
        }
        function hideContext() {
          var m = document.getElementById("context-menu");
          if (m) m.style.display = "none";
        }
        document.addEventListener("click", function () {
          hideContext();
          document.querySelectorAll(".menu-item").forEach(function (m) {
            m.classList.remove("open");
          });
        });
        document.querySelectorAll(".menu-btn").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var item = btn.parentElement;
            var wasOpen = item.classList.contains("open");
            document.querySelectorAll(".menu-item").forEach(function (m) {
              m.classList.remove("open");
            });
            if (!wasOpen) item.classList.add("open");
          });
        });

        class VideoEditor {
          constructor() {
            this.previewBox = document.getElementById("preview-box");
            this.viewport = document.getElementById("preview-viewport");
            this.layersBox = document.getElementById("preview-layers");
            this.textLayer = document.getElementById("text-layer");
            this.previewStage = document.getElementById("preview-stage");
            this.ruler = document.getElementById("timeline-ruler");
            this.tracksContainer = document.getElementById("timeline-tracks");
            this.tracksSidebar = document.getElementById("tracks-sidebar");
            this.tracksList = document.getElementById("tracks-list");
            this.playhead = document.getElementById("single-playhead");
            this.cursor = document.getElementById("single-cursor");
            this.timeDisplay = document.getElementById("time-display");
            this.zoomLabel = document.getElementById("zoom-label");
            this.projectW = 1920;
            this.projectH = 1080;
            this.aspectRatio = "16-9";
            this.resolution = "1080p";
            this.duration = 0;
            this.clips = [];
            this.videoTracks = [
              { id: "v1", name: "V1", type: "video", icon: "🎬", num: 1, enabled: true },
              { id: "v2", name: "V2", type: "video", icon: "🎬", num: 2, enabled: true },
              { id: "v3", name: "V3", type: "video", icon: "🎬", num: 3, enabled: true },
            ];
            this.audioTracks = [
              { id: "a1", name: "A1", type: "audio", icon: "🎵", num: 1, enabled: true },
              { id: "a2", name: "A2", type: "audio", icon: "🎵", num: 2, enabled: true },
              { id: "a3", name: "A3", type: "audio", icon: "🎵", num: 3, enabled: true },
            ];
            this.selectedId = null;
            this.selectedTextId = null;
            this.selectedIds = new Set();
            this.dragState = null;
            this.pixelsPerSecond = 80;
            this.timelineTime = 0;
            this.isPlaying = false;
            this.lastTick = 0;
            this.raf = null;
            this.audioElements = {};
            this.transforms = {};
            this.textStyles = {};
            this.kfs = {};
            this.anim = {};
            this.defaultTransform = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rot: 0, perspX: 0, perspY: 0 };
            this.layerElements = {};
            this.textElements = {};
            this.history = [];
            this.historyIndex = -1;
            this.clipboard = null;
            this.isDragging = false;
            this.previewZoom = 1;
            this.fitScale = 1;
            this.selectedExportQuality = "original";
            this.currentDropTrackId = null;
            this.dragOverTrackId = null;
            this.snapEnabled = true;
            this.snapThreshold = 0.18;
            this._snapHideTimeout = null;
            this.selectedExportQuality = "original";
            this.selectedExportFormat = "mp4";
            this.supportedMp4 = null;
            this.supportedWebm = null;
            this.defaultMime = null;
            this.isExporting = false;
            this.exportCancelled = false;
            this.exportRecorder = null;
            this.init();
          }
          get allTracksOrdered() {
            var v = [...this.videoTracks].sort(function (a, b) {
              return b.num - a.num;
            });
            var a = [...this.audioTracks].sort(function (a, b) {
              return a.num - b.num;
            });
            return [...v, ...a];
          }
          get allTracks() {
            return [...this.videoTracks, ...this.audioTracks];
          }
          cloneClips() {
            return this.clips.map(function (c) {
              return {
                id: c.id,
                name: c.name,
                type: c.type,
                url: c.url,
                start: c.start,
                duration: c.duration,
                srcStart: c.srcStart,
                srcDuration: c.srcDuration,
                trackId: c.trackId,
                linkId: c.linkId,
                linkedTo: c.linkedTo,
                origW: c.origW,
                origH: c.origH,
                text: c.text,
                speed: c.speed,
                vol: c.vol,
                fxKind: c.fxKind,
                fxIdx: c.fxIdx,
                fxName: c.fxName,
                fxVal: c.fxVal,
                fxMode: c.fxMode,
                fxDur: c.fxDur,
              };
            });
          }
          pushHistory(act) {
            var snap = {
              clips: this.cloneClips(),
              transforms: JSON.parse(JSON.stringify(this.transforms)),
              textStyles: JSON.parse(JSON.stringify(this.textStyles)),
              kfs: JSON.parse(JSON.stringify(this.kfs || {})),
              anim: JSON.parse(JSON.stringify(this.anim || {})),
              selectedId: this.selectedId,
              selectedIds: Array.from(this.selectedIds),
              action: act,
            };
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.history.push(snap);
            this.historyIndex = this.history.length - 1;
            if (this.history.length > 80) {
              this.history.shift();
              this.historyIndex--;
            }
            var el = document.getElementById("undo-status");
            if (el) el.textContent = act + " • Multi: " + this.selectedIds.size;
          }
          undo() {
            if (this.historyIndex <= 0) return;
            this.historyIndex--;
            this.restoreHistory();
          }
          redo() {
            if (this.historyIndex >= this.history.length - 1) return;
            this.historyIndex++;
            this.restoreHistory();
          }
          restoreHistory() {
            var h = this.history[this.historyIndex];
            if (!h) return;
            this.transforms = JSON.parse(JSON.stringify(h.transforms));
            this.textStyles = JSON.parse(JSON.stringify(h.textStyles || {}));
            this.kfs = JSON.parse(JSON.stringify(h.kfs || {}));
            this.anim = JSON.parse(JSON.stringify(h.anim || {}));
            var curMap = new Map(
              this.clips.map(function (c) {
                return [c.id, c];
              }),
            );
            var newClips = [];
            h.clips.forEach(function (saved) {
              var ex = curMap.get(saved.id);
              var url = ex ? ex.url : saved.url;
              newClips.push(Object.assign({}, saved, { url: url }));
            });
            var newIds = new Set(
              newClips.map(function (c) {
                return c.id;
              }),
            );
            var self = this;
            Object.keys(this.audioElements).forEach(function (id) {
              if (!newIds.has(parseFloat(id)) && !newIds.has(id)) {
                var a = self.audioElements[id];
                if (a) {
                  a.pause();
                  try {
                    a.src = "";
                  } catch (e) {}
                }
                delete self.audioElements[id];
              }
            });
            Object.keys(this.layerElements).forEach(function (id) {
              if (!newIds.has(parseFloat(id)) && !newIds.has(id)) {
                var el = self.layerElements[id];
                if (el) {
                  if (el.tagName === "VIDEO") el.pause();
                  el.remove();
                }
                delete self.layerElements[id];
              }
            });
            Object.keys(this.textElements).forEach(function (id) {
              if (!newIds.has(parseFloat(id)) && !newIds.has(id)) {
                var el = self.textElements[id];
                if (el) el.remove();
                delete self.textElements[id];
              }
            });
            this.clips = newClips;
            this.selectedId =
              h.selectedId && newIds.has(h.selectedId) ? h.selectedId : newClips[0] ? newClips[0].id : null;
            this.selectedIds = new Set(
              (h.selectedIds || []).filter(function (id) {
                return newIds.has(id);
              }),
            );
            this.duration = Math.max.apply(
              null,
              this.clips
                .map(function (c) {
                  return c.start + c.duration;
                })
                .concat([0]),
            );
            this.updateMetrics();
            this.renderAll();
            this.syncToTimeline();
            if (this._updateUI) this._updateUI();
            newClips.forEach(function (c) {
              if (c.type === "audio" && !self.audioElements[c.id]) self.audioElements[c.id] = new Audio(c.url);
            });
          }

          getSnapTargets(excludeIds) {
            var targets = [];
            this.clips.forEach(function (c) {
              if (excludeIds && excludeIds.indexOf(c.id) !== -1) return;
              targets.push(c.start);
              targets.push(c.start + c.duration);
            });
            targets.push(this.timelineTime);
            targets.push(0);
            return Array.from(new Set(targets)).sort(function (a, b) {
              return a - b;
            });
          }
          applySnap(time, excludeIds) {
            if (!this.snapEnabled) return time;
            var targets = this.getSnapTargets(excludeIds);
            var best = time,
              bestDiff = this.snapThreshold;
            for (var i = 0; i < targets.length; i++) {
              var t = targets[i];
              var diff = Math.abs(time - t);
              if (diff < bestDiff) {
                bestDiff = diff;
                best = t;
              }
            }
            if (best !== time) {
              this.showSnapIndicator(best);
              return best;
            }
            this.hideSnapIndicator();
            return time;
          }
          showSnapIndicator(time) {
            var tracks = document.getElementById("timeline-tracks");
            var ruler = document.getElementById("timeline-ruler");
            var ind = document.getElementById("snap-indicator");
            if (!ind && tracks) {
              ind = document.createElement("div");
              ind.id = "snap-indicator";
              ind.className = "snap-indicator";
              tracks.appendChild(ind);
            }
            if (ind) {
              ind.style.left = time * this.pixelsPerSecond + "px";
              ind.style.display = "block";
            }
            var rInd = document.getElementById("snap-indicator-ruler");
            if (!rInd && ruler) {
              rInd = document.createElement("div");
              rInd.id = "snap-indicator-ruler";
              rInd.className = "snap-indicator-ruler";
              ruler.appendChild(rInd);
            }
            if (rInd) {
              rInd.style.left = time * this.pixelsPerSecond + "px";
              rInd.style.display = "block";
            }
          }
          hideSnapIndicator() {
            var ind = document.getElementById("snap-indicator");
            if (ind) ind.style.display = "none";
            var rInd = document.getElementById("snap-indicator-ruler");
            if (rInd) rInd.style.display = "none";
          }
          /* Escala de la vista previa. previewPct = null → "Ajustar"; si no, fracción del tamaño REAL del proyecto (1 = 100 %, 1 píxel del proyecto = 1 píxel de pantalla, como en DaVinci Resolve). */
          setPreviewPercent(p) {
            this.previewPct = p == null ? null : p;
            this.updatePreviewBoxSize(true);
          }
          setPreviewZoom(f) {
            this.previewPct = null;
            var lo = this.previewMin || 0.1,
              hi = this.previewMax || 8;
            this.previewZoom = Math.max(lo, Math.min(hi, f));
            var s = document.getElementById("preview-zoom-slider");
            if (s) s.value = Math.round(this.previewZoom * 100);
            var l = document.getElementById("preview-zoom-label");
            if (l) l.textContent = Math.round(this.previewZoom * 100) + "%";
            this.updatePreviewBoxSize();
          }
          updatePreviewBoxSize(recenter) {
            var box = this.previewBox;
            if (!box || !this.previewStage) return;
            var vp = this.viewport, vw = vp.clientWidth, vh = vp.clientHeight;
            this.fitScale = Math.min((vw * 0.92) / this.projectW, (vh * 0.92) / this.projectH, 1);
            var baseW = this.projectW * this.fitScale;
            var baseH = this.projectH * this.fitScale;
            if (this.previewPct != null) this.previewZoom = this.previewPct / this.fitScale;
            var z = this.previewZoom, visW = baseW * z, visH = baseH * z;
            box.style.width = baseW + "px";
            box.style.height = baseH + "px";
            box.style.transformOrigin = "0 0";
            box.style.transform = "scale(" + z + ")";
            /* centrado cuando cabe; con zoom grande el visor se desplaza con barras */
            box.style.margin = Math.max(0, (vh - visH) / 2) + "px " + Math.min(0, visW - baseW) + "px " + Math.min(0, visH - baseH) + "px " + Math.max(0, (vw - visW) / 2) + "px";
            if (recenter) {
              vp.scrollLeft = Math.max(0, (visW - vw) / 2);
              vp.scrollTop = Math.max(0, (visH - vh) / 2);
            }
            var s = document.getElementById("preview-zoom-slider");
            if (s) s.value = Math.round(z * 100);
            if (window.ErizoUI && window.ErizoUI.onPreview) window.ErizoUI.onPreview();
          }
          showContextMenu(x, y) {
            var menu = document.getElementById("context-menu");
            if (!menu) return;
            menu.style.left = x + "px";
            menu.style.top = y + "px";
            menu.style.display = "block";
            setTimeout(function () {
              var rect = menu.getBoundingClientRect();
              if (rect.right > window.innerWidth) menu.style.left = x - rect.width + "px";
              if (rect.bottom > window.innerHeight) menu.style.top = y - rect.height + "px";
            }, 10);
          }
          setAspect(r) {
            this.aspectRatio = r;
            var base = this.resolution === "480p" ? 480 : this.resolution === "720p" ? 720 : 1080;
            if (r === "9-16") {
              this.projectH = Math.round((base * 16) / 9);
              this.projectW = Math.round((this.projectH * 9) / 16);
            } else if (r === "1-1") {
              this.projectW = base;
              this.projectH = base;
            } else if (r === "4-5") {
              this.projectH = Math.round((base * 5) / 4);
              this.projectW = Math.round((this.projectH * 4) / 5);
            } else {
              this.projectW = Math.round((base * 16) / 9);
              this.projectH = base;
            }
            var wEl = document.getElementById("proj-w");
            var hEl = document.getElementById("proj-h");
            if (wEl) wEl.value = this.projectW;
            if (hEl) hEl.value = this.projectH;
            this.updatePreviewBoxSize();
            var od = document.getElementById("opt-original-desc");
            if (od) od.textContent = this.projectW + "x" + this.projectH + " (tu W/H exacto)";
          }
          setResolution(res) {
            this.resolution = res;
            this.setAspect(this.aspectRatio);
          }
          applyCustomSize() {
            var w = parseInt(document.getElementById("proj-w").value) || 1920;
            var h = parseInt(document.getElementById("proj-h").value) || 1080;
            this.projectW = w;
            this.projectH = h;
            this.updatePreviewBoxSize();
            var od = document.getElementById("opt-original-desc");
            if (od) od.textContent = w + "x" + h + " (tu W/H exacto)";
          }
          bindTransform() {
            var self = this;
            var getT = function () {
              var id = self.selectedId || "global";
              if (!self.transforms[id]) self.transforms[id] = Object.assign({}, self.defaultTransform);
              return self.transforms[id];
            };
            var upd = function () {
              var t = getT();
              function setP(b, v, d) {
                var r = document.getElementById("tr-" + b);
                var n = document.getElementById("tr-" + b + "-num");
                if (r) r.value = v;
                if (n && document.activeElement !== n) n.value = Number(v).toFixed(d);
              }
              setP("x", t.x, 1);
              setP("y", t.y, 1);
              setP("scale", t.scale, 2);
              setP("scaleX", t.scaleX || 1, 2);
              setP("scaleY", t.scaleY || 1, 2);
              setP("rot", t.rot, 1);
              setP("perspX", t.perspX || 0, 1);
              setP("perspY", t.perspY || 0, 1);
            };
            ["x", "y", "scale", "scaleX", "scaleY", "rot", "perspX", "perspY"].forEach(function (base) {
              var r = document.getElementById("tr-" + base);
              var n = document.getElementById("tr-" + base + "-num");
              if (r)
                r.addEventListener("input", function (e) {
                  var ids = self.selectedIds.size ? Array.from(self.selectedIds) : [self.selectedId];
                  ids.forEach(function (id) {
                    if (!id) return;
                    if (!self.transforms[id]) self.transforms[id] = Object.assign({}, self.defaultTransform);
                    self.transforms[id][base] = parseFloat(e.target.value);
                  });
                  self.applyTransformMulti();
                  upd();
                });
              if (n)
                n.addEventListener("input", function (e) {
                  var ids = self.selectedIds.size ? Array.from(self.selectedIds) : [self.selectedId];
                  var v = parseFloat(e.target.value);
                  if (isNaN(v)) return;
                  ids.forEach(function (id) {
                    if (!id) return;
                    if (!self.transforms[id]) self.transforms[id] = Object.assign({}, self.defaultTransform);
                    self.transforms[id][base] = v;
                  });
                  self.applyTransformMulti();
                  upd();
                });
            });
            document.querySelectorAll(".btn-reset").forEach(function (b) {
              b.addEventListener("click", function () {
                var k = b.dataset.reset;
                var ids = self.selectedIds.size ? Array.from(self.selectedIds) : [self.selectedId];
                ids.forEach(function (id) {
                  if (!id) return;
                  var t = self.transforms[id] || Object.assign({}, self.defaultTransform);
                  if (k === "x") t.x = 0;
                  else if (k === "y") t.y = 0;
                  else if (k === "scale") t.scale = 1;
                  else if (k === "scaleX") t.scaleX = 1;
                  else if (k === "scaleY") t.scaleY = 1;
                  else if (k === "rot") t.rot = 0;
                  else if (k === "perspX") t.perspX = 0;
                  else if (k === "perspY") t.perspY = 0;
                  self.transforms[id] = t;
                });
                self.applyTransformMulti();
                upd();
                self.pushHistory("Reset " + k);
              });
            });
            this._updateUI = upd;
          }
          applyTransform() {
            this.applyTransformMulti();
          }
          applyTransformMulti() {
            var self = this;
            var ids = this.selectedIds.size ? Array.from(this.selectedIds) : this.selectedId ? [this.selectedId] : [];
            ids.forEach(function (id) {
              if (!self.transforms[id]) self.transforms[id] = Object.assign({}, self.defaultTransform);
              var t = self.transforms[id];
              var el = self.layerElements[id] || self.textElements[id];
              if (el) {
                var sx = (t.scale || 1) * (t.scaleX || 1);
                var sy = (t.scale || 1) * (t.scaleY || 1);
                var baseTransform = el.dataset.baseTransform || "";
                if (el.classList.contains("text-overlay")) {
                  el.style.transform =
                    baseTransform +
                    " translate(" +
                    t.x +
                    "px," +
                    t.y +
                    "px) scaleX(" +
                    sx +
                    ") scaleY(" +
                    sy +
                    ") rotate(" +
                    t.rot +
                    "deg)" + __persp(t);
                } else {
                  el.style.transform =
                    "translate(" +
                    t.x +
                    "px," +
                    t.y +
                    "px) scaleX(" +
                    sx +
                    ") scaleY(" +
                    sy +
                    ") rotate(" +
                    t.rot +
                    "deg)" + __persp(t);
                }
              }
            });
          }
          bindTextEdit() {
            var self = this;
            var els = {
              content: document.getElementById("txt-content"),
              font: document.getElementById("txt-font"),
              size: document.getElementById("txt-size"),
              sizeNum: document.getElementById("txt-size-num"),
              color: document.getElementById("txt-color"),
              colorTxt: document.getElementById("txt-color-txt"),
              bg: document.getElementById("txt-bg"),
              bgAlpha: document.getElementById("txt-bg-alpha"),
              weight: document.getElementById("txt-weight"),
              align: document.getElementById("txt-align"),
            };
            function getStyle() {
              var id = self.selectedTextId || self.selectedId;
              if (!id) return null;
              if (!self.textStyles[id])
                self.textStyles[id] = {
                  id: id,
                  text: "Texto",
                  font: "Inter, system-ui, sans-serif",
                  size: 32,
                  color: "#ffffff",
                  bg: "#000000",
                  bgAlpha: 0.35,
                  weight: "700",
                  align: "center",
                };
              return self.textStyles[id];
            }
            function applyToEl() {
              var st = getStyle();
              if (!st) return;
              var el =
                self.textElements[st.id] ||
                self.textElements[self.selectedTextId] ||
                document.querySelector(".text-overlay.selected");
              if (!el) return;
              el.textContent = st.text;
              el.style.fontFamily = st.font;
              el.style.fontSize = st.size + "px";
              el.style.color = st.color;
              el.style.fontWeight = st.weight;
              el.style.textAlign = st.align;
__txtFx(el, st);
              var bgAlpha = parseFloat(st.bgAlpha);
              if (bgAlpha === 0) el.style.background = "transparent";
              else
                el.style.background =
                  "rgba(" +
                  parseInt(st.bg.slice(1, 3), 16) +
                  "," +
                  parseInt(st.bg.slice(3, 5), 16) +
                  "," +
                  parseInt(st.bg.slice(5, 7), 16) +
                  "," +
                  bgAlpha +
                  ")";
              var clip = self.clips.find(function (c) {
                return c.id == st.id;
              });
              if (clip) clip.text = st.text;
            }
            function syncUI() {
              var st = getStyle();
              if (!st) return;
              if (els.content) els.content.value = st.text;
              if (els.font) els.font.value = st.font;
              if (els.size) els.size.value = st.size;
              if (els.sizeNum) els.sizeNum.value = st.size;
              if (els.color) els.color.value = st.color;
              if (els.colorTxt) els.colorTxt.value = st.color;
              if (els.bg) els.bg.value = st.bg;
              if (els.bgAlpha) els.bgAlpha.value = st.bgAlpha;
              if (els.weight) els.weight.value = st.weight;
              if (els.align) els.align.value = st.align;
            }
            this._syncTextUI = syncUI;
            this._applyText = applyToEl;
            if (els.content)
              els.content.addEventListener("keydown", function (e) {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.target.blur();
                }
              });
            if (els.content)
              els.content.addEventListener("input", function (e) {
                var st = getStyle();
                if (!st) return;
                st.text = e.target.value;
                var clip = self.clips.find(function (c) {
                  return c.id == st.id;
                });
                if (clip) clip.text = e.target.value;
                applyToEl();
                self.renderClips();
              });
            if (els.font)
              els.font.addEventListener("change", function (e) {
                var st = getStyle();
                if (!st) return;
                st.font = e.target.value;
                applyToEl();
              });
            function sizeChange(v) {
              var st = getStyle();
              if (!st) return;
              st.size = parseInt(v);
              applyToEl();
              if (els.size) els.size.value = v;
              if (els.sizeNum) els.sizeNum.value = v;
            }
            if (els.size)
              els.size.addEventListener("input", function (e) {
                sizeChange(e.target.value);
              });
            if (els.sizeNum)
              els.sizeNum.addEventListener("input", function (e) {
                sizeChange(e.target.value);
              });
            if (els.color)
              els.color.addEventListener("input", function (e) {
                var st = getStyle();
                if (!st) return;
                st.color = e.target.value;
                if (els.colorTxt) els.colorTxt.value = e.target.value;
                applyToEl();
              });
            if (els.colorTxt)
              els.colorTxt.addEventListener("input", function (e) {
                var st = getStyle();
                if (!st) return;
                st.color = e.target.value;
                if (els.color) els.color.value = e.target.value;
                applyToEl();
              });
            if (els.bg)
              els.bg.addEventListener("input", function (e) {
                var st = getStyle();
                if (!st) return;
                st.bg = e.target.value;
                applyToEl();
              });
            if (els.bgAlpha)
              els.bgAlpha.addEventListener("change", function (e) {
                var st = getStyle();
                if (!st) return;
                st.bgAlpha = e.target.value;
                applyToEl();
              });
            if (els.weight)
              els.weight.addEventListener("change", function (e) {
                var st = getStyle();
                if (!st) return;
                st.weight = e.target.value;
                applyToEl();
              });
            if (els.align)
              els.align.addEventListener("change", function (e) {
                var st = getStyle();
                if (!st) return;
                st.align = e.target.value;
                applyToEl();
              });
          }
          initDragPreview() {
            var self = this;
            var drag = false,
              sx,
              sy,
              ox,
              oy,
              tid = null;
            var getT = function (id) {
              if (!self.transforms[id]) self.transforms[id] = Object.assign({}, self.defaultTransform);
              return self.transforms[id];
            };
            this.previewBox.addEventListener("mousedown", function (e) {
              var textEl = e.target.closest ? e.target.closest(".text-overlay") : null;
              if (textEl) {
                tid = textEl.dataset.clipId || textEl.dataset.textId;
                self.selectText(tid);
                drag = true;
                sx = e.clientX;
                sy = e.clientY;
                var t = getT(tid);
                ox = t.x;
                oy = t.y;
                e.preventDefault();
                return;
              }
              var target = e.target.closest ? e.target.closest(".layer-item") : null;
              if (target) {
                tid = target.dataset.clipId;
                self.selectClip(tid);
                drag = true;
                sx = e.clientX;
                sy = e.clientY;
                var t2 = getT(tid);
                ox = t2.x;
                oy = t2.y;
                e.preventDefault();
                return;
              }
              var vidClip = self.getClipsAtTimeline(self.timelineTime).find(function (c) {
                return c.type === "video" || c.type === "image";
              });
              if (!vidClip) return;
              tid = vidClip.id;
              self.selectClip(tid);
              drag = true;
              sx = e.clientX;
              sy = e.clientY;
              var t3 = getT(tid);
              ox = t3.x;
              oy = t3.y;
              e.preventDefault();
            });
            document.addEventListener("mousemove", function (e) {
              if (!drag || !tid) return;
              var t = getT(tid);
              t.x = ox + (e.clientX - sx) / __K() / self.previewZoom;
              t.y = oy + (e.clientY - sy) / __K() / self.previewZoom;
              var el = self.layerElements[tid] || self.textElements[tid];
              if (el && window.Magnet) Magnet.snap(self, t, el);
              if (el) {
                var sx2 = (t.scale || 1) * (t.scaleX || 1);
                var sy2 = (t.scale || 1) * (t.scaleY || 1);
                if (el.classList.contains("text-overlay")) {
                  var base = el.dataset.baseTransform || "";
                  el.style.transform =
                    base +
                    " translate(" +
                    t.x +
                    "px," +
                    t.y +
                    "px) scaleX(" +
                    sx2 +
                    ") scaleY(" +
                    sy2 +
                    ") rotate(" +
                    t.rot +
                    "deg)" + __persp(t);
                } else {
                  el.style.transform =
                    "translate(" +
                    t.x +
                    "px," +
                    t.y +
                    "px) scaleX(" +
                    sx2 +
                    ") scaleY(" +
                    sy2 +
                    ") rotate(" +
                    t.rot +
                    "deg)" + __persp(t);
                }
              }
            });
            document.addEventListener("mouseup", function () {
              if (drag) {
                self.pushHistory("Mover preview");
              }
              drag = false;
              tid = null;
            });
          }

          getSelectedImportTrack() {
            var sel1 = document.getElementById("import-track-select");
            var sel2 = document.getElementById("import-track-select2");
            var v = sel1 ? sel1.value : sel2 ? sel2.value : "auto";
            return v;
          }
          resolveImportTrackForType(type, requestedTrackId) {
            var req = requestedTrackId || this.getSelectedImportTrack();
            if (req === "auto") return null;
            if (req === "newV") {
              var n = this.videoTracks.length + 1;
              var nt = { id: "v" + Date.now() + n, name: "V" + n, type: "video", icon: "🎬", num: n, enabled: true };
              this.videoTracks.push(nt);
              this.renderTracks();
              return nt.id;
            }
            if (req === "newA") {
              var n = this.audioTracks.length + 1;
              var nt = { id: "a" + Date.now() + n, name: "A" + n, type: "audio", icon: "🎵", num: n, enabled: true };
              this.audioTracks.push(nt);
              this.renderTracks();
              return nt.id;
            }
            var all = this.allTracks;
            var found = all.find(function (t) {
              return t.id === req;
            });
            if (found) {
              if (type === "audio" && found.type !== "audio") return null;
              if ((type === "video" || type === "image" || type === "text") && found.type === "audio") return null;
              return found.id;
            }
            return null;
          }
          findFreeTrack(type, afterTime) {
            var self = this;
            var after = afterTime || 0;
            if (type === "audio") {
              for (var i = 0; i < self.audioTracks.length; i++) {
                var tid = self.audioTracks[i].id;
                var overlap = self.clips.some(function (c) {
                  return c.trackId === tid && !(c.start + c.duration <= after || c.start >= after + 0.1);
                });
                if (!overlap) return tid;
              }
              var n = self.audioTracks.length + 1;
              var nt = { id: "a" + Date.now() + n, name: "A" + n, type: "audio", icon: "🎵", num: n, enabled: true };
              self.audioTracks.push(nt);
              self.renderTracks();
              return nt.id;
            } else {
              for (var i = 0; i < self.videoTracks.length; i++) {
                var tid = self.videoTracks[i].id;
                var overlap = self.clips.some(function (c) {
                  return (
                    c.trackId === tid &&
                    c.type !== "audio" &&
                    !(c.start + c.duration <= after || c.start >= after + 0.1)
                  );
                });
                if (!overlap) return tid;
              }
              return self.videoTracks[0] ? self.videoTracks[0].id : "v1";
            }
          }

          handleFiles(fileList, forcedTrackId) {
            var self = this;
            var files = Array.from(fileList);
            if (!files.length) return;
            var requestedTrack = forcedTrackId || self.getSelectedImportTrack();
            var lastEnd = self.clips.length
              ? Math.max.apply(
                  null,
                  self.clips.map(function (c) {
                    return c.start + c.duration;
                  }),
                )
              : 0;
            var offset = lastEnd > 0 ? lastEnd + 0.3 : 0;
            var useSpecific = requestedTrack && requestedTrack !== "auto";
            if (useSpecific) {
              offset = self.timelineTime;
            }
            files.forEach(function (file) {
              var url = URL.createObjectURL(file);
              var type = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "video";
              var id = Date.now() + Math.random();
              var trackId;
              if (useSpecific) {
                var resolved = self.resolveImportTrackForType(type, requestedTrack);
                if (resolved) {
                  trackId = resolved;
                } else {
                  trackId = self.findFreeTrack(type, offset);
                }
              } else {
                trackId = self.findFreeTrack(type, offset);
              }
              var clip = {
                id: id,
                name: file.name,
                type: type,
                url: url,
                start: offset,
                duration: type === "image" ? 5 : 0,
                srcStart: 0,
                srcDuration: type === "image" ? 5 : 0,
                trackId: trackId,
                origW: 0,
                origH: 0,
                linkId: null,
                linkedTo: null,
              };
              if (type === "video") {
                var v = document.createElement("video");
                v.src = url;
                v.muted = true;
                v.playsInline = true;
                v.addEventListener(
                  "loadedmetadata",
                  function () {
                    clip.duration = v.duration;
                    clip.srcDuration = v.duration;
                    clip.origW = v.videoWidth;
                    clip.origH = v.videoHeight;
                    self.duration = Math.max(self.duration, clip.start + clip.duration);
                    self.updateMetrics();
                    self.renderAll();
                    self.selectClip(clip.id);
                    self.syncToTimeline();
                    if (
                      !self.clips.find(function (c) {
                        return (c.linkedTo === clip.id || c.linkId === clip.id) && c.type === "audio";
                      })
                    ) {
                      self.createLinkedAudio(clip, url);
                    }
                  },
                  { once: true },
                );
              } else if (type === "image") {
                var img = new Image();
                img.src = url;
                img.onload = function () {
                  clip.origW = img.naturalWidth;
                  clip.origH = img.naturalHeight;
                  self.renderAll();
                  self.selectClip(clip.id);
                  self.syncToTimeline();
                };
              } else if (type === "audio") {
                var a = document.createElement("audio");
                a.src = url;
                a.addEventListener(
                  "loadedmetadata",
                  function () {
                    clip.duration = a.duration;
                    clip.srcDuration = a.duration;
                    self.duration = Math.max(self.duration, clip.start + clip.duration);
                    self.updateMetrics();
                    self.renderAll();
                  },
                  { once: true },
                );
                self.audioElements[id] = new Audio(url);
              }
              self.clips.push(clip);
              self.transforms[id] = Object.assign({}, self.defaultTransform);
              if (useSpecific) {
                offset += 0.05;
              } else {
                offset += (clip.duration || 5) + 0.3;
              }
            });
            var ph = document.getElementById("placeholder");
            if (ph) ph.style.display = "none";
            this.duration = Math.max.apply(
              null,
              this.clips
                .map(function (c) {
                  return c.start + c.duration;
                })
                .concat([this.duration || 0]),
            );
            this.updateMetrics();
            this.renderAll();
            this.pushHistory("Agregar a " + (requestedTrack || "auto"));
            if (this.clips.length) {
              this.selectClip(this.clips[this.clips.length - 1].id);
            }
            this.updateImportSelectors();
          }
          createLinkedAudio(videoClip, url) {
            if (
              this.clips.find(function (c) {
                return c.linkedTo === videoClip.id && c.type === "audio";
              })
            )
              return;
            var audioTrackId = null;
            for (var i = 0; i < this.audioTracks.length; i++) {
              var tid = this.audioTracks[i].id;
              var conflict = this.clips.some(function (c) {
                return c.trackId === tid && c.type === "audio" && Math.abs(c.start - videoClip.start) < 0.05;
              });
              if (!conflict) {
                audioTrackId = tid;
                break;
              }
            }
            if (!audioTrackId) {
              var n = this.audioTracks.length + 1;
              var nt = { id: "a" + Date.now() + n, name: "A" + n, type: "audio", icon: "🎵", num: n, enabled: true };
              this.audioTracks.push(nt);
              audioTrackId = nt.id;
            }
            var audioId = Date.now() + Math.random() + 1;
            var ac = {
              id: audioId,
              name: "🔗 " + videoClip.name + " (audio)",
              type: "audio",
              url: url,
              start: videoClip.start,
              duration: videoClip.duration,
              srcStart: videoClip.srcStart,
              srcDuration: videoClip.srcDuration,
              trackId: audioTrackId,
              origW: 0,
              origH: 0,
              linkId: videoClip.id,
              linkedTo: videoClip.id,
            };
            videoClip.linkId = audioId;
            videoClip.linkedTo = audioId;
            this.clips.push(ac);
            if (!this.audioElements[audioId]) this.audioElements[audioId] = new Audio(url);
            this.duration = Math.max(this.duration, ac.start + ac.duration);
            this.updateMetrics();
            this.renderAll();
            this.updateImportSelectors();
          }
          updateImportSelectors() {
            var self = this;
            var selects = [
              document.getElementById("import-track-select"),
              document.getElementById("import-track-select2"),
            ];
            selects.forEach(function (sel) {
              if (!sel) return;
              var cur = sel.value;
              sel.innerHTML = '<option value="auto">AUTO (libre)</option>';
              self.videoTracks
                .slice()
                .sort(function (a, b) {
                  return a.num - b.num;
                })
                .forEach(function (t) {
                  var o = document.createElement("option");
                  o.value = t.id;
                  o.textContent = t.name + " 🎬";
                  sel.appendChild(o);
                });
              self.audioTracks
                .slice()
                .sort(function (a, b) {
                  return a.num - b.num;
                })
                .forEach(function (t) {
                  var o = document.createElement("option");
                  o.value = t.id;
                  o.textContent = t.name + " 🎵";
                  sel.appendChild(o);
                });
              var oNewV = document.createElement("option");
              oNewV.value = "newV";
              oNewV.textContent = "+ Nueva V";
              sel.appendChild(oNewV);
              var oNewA = document.createElement("option");
              oNewA.value = "newA";
              oNewA.textContent = "+ Nueva A";
              sel.appendChild(oNewA);
              if (
                Array.from(sel.options).some(function (o) {
                  return o.value === cur;
                })
              )
                sel.value = cur;
              else sel.value = "auto";
            });
          }
          setZoom(pps) {
            this.pixelsPerSecond = Math.max(1, Math.min(1000, pps));
            var s = document.getElementById("zoom-slider");
            if (s) s.value = this.pixelsPerSecond;
            if (this.zoomLabel) this.zoomLabel.textContent = Math.round(this.pixelsPerSecond) + " px/s";
            this.updateMetrics();
            this.renderAll();
            this.updatePlayheadPos();
          }
          zoomIn() {
            this.setZoom(this.pixelsPerSecond * 1.4);
          }
          zoomOut() {
            this.setZoom(this.pixelsPerSecond / 1.4);
          }
          zoomFit() {
            var maxEnd = Math.max.apply(
              null,
              this.clips
                .map(function (c) {
                  return c.start + c.duration;
                })
                .concat([60]),
            );
            var containerW = this.tracksContainer.clientWidth - 100;
            var ideal = containerW / maxEnd;
            this.setZoom(Math.max(1, Math.min(1000, ideal)));
          }
          zoomDetail() {
            this.setZoom(200);
          }
          updateMetrics() {
            var maxEnd = Math.max.apply(
              null,
              this.clips
                .map(function (c) {
                  return c.start + c.duration;
                })
                .concat([this.duration || 0, 60]),
            );
            var w = Math.max(800, maxEnd * this.pixelsPerSecond + 400);
            document.querySelectorAll(".track-content").forEach(function (el) {
              el.style.minWidth = w + "px";
            });
            if (this.ruler) this.ruler.style.minWidth = w + "px";
          }
          renderTracks() {
            var self = this;
            if (!this.tracksSidebar || !this.tracksList) return;
            this.tracksSidebar.innerHTML = '<div class="ruler-spacer"><button class="add-menu-btn">＋ Agregar ▾</button></div>';
            this.tracksList.innerHTML = "";
            this.allTracksOrdered.forEach(function (track) {
              var lbl = document.createElement("div");
              lbl.className =
                "track-label-item " +
                (track.type === "audio" ? "a-track" : "v-track") +
                (track.enabled === false ? " disabled" : "");
              if (self.dragOverTrackId === track.id) lbl.classList.add("drag-over");
              lbl.dataset.trackId = track.id;
              lbl.innerHTML =
                '<button class="track-toggle ' +
                (track.enabled === false ? "off" : "") +
                '" data-track="' +
                track.id +
                '">' +
                (track.enabled === false ? "🚫" : "👁️") +
                '</button><span class="num">' +
                track.name +
                '</span><span style="margin-left:auto;font-size:7px;color:#666">soltar aquí</span>';
              var toggle = lbl.querySelector(".track-toggle");
              toggle.addEventListener("click", function (e) {
                e.stopPropagation();
                track.enabled = track.enabled === false ? true : false;
                self.renderTracks();
                self.syncToTimeline();
              });
              lbl.addEventListener("dragover", function (e) {
                e.preventDefault();
                self.dragOverTrackId = track.id;
                self.clearDragOver();
                lbl.classList.add("drag-over");
              });
              lbl.addEventListener("dragleave", function (e) {
                lbl.classList.remove("drag-over");
              });
              lbl.addEventListener("drop", function (e) {
                e.preventDefault();
                lbl.classList.remove("drag-over");
                if (e.dataTransfer.files.length) {
                  self.handleFiles(e.dataTransfer.files, track.id);
                }
              });
              self.tracksSidebar.appendChild(lbl);
              var row = document.createElement("div");
              row.className = "track" + (track.enabled === false ? " disabled" : "");
              if (self.dragOverTrackId === track.id) row.classList.add("drag-over");
              row.dataset.trackId = track.id;
              row.innerHTML =
                '<div class="track-content" data-track-id="' + track.id + '" id="content-' + track.id + '"></div>';
              row.addEventListener("dragover", function (e) {
                e.preventDefault();
                self.dragOverTrackId = track.id;
                self.clearDragOver();
                row.classList.add("drag-over");
                lbl.classList.add("drag-over");
              });
              row.addEventListener("dragleave", function (e) {
                if (!row.contains(e.relatedTarget)) {
                  row.classList.remove("drag-over");
                }
              });
              row.addEventListener("drop", function (e) {
                e.preventDefault();
                row.classList.remove("drag-over");
                self.dragOverTrackId = null;
                if (e.dataTransfer.files.length) {
                  self.handleFiles(e.dataTransfer.files, track.id);
                }
              });
              self.tracksList.appendChild(row);
            });
            setTimeout(function () {
              self.renderClips();
              self.updateImportSelectors();
            }, 30);
          }
          clearDragOver() {
            document.querySelectorAll(".track.drag-over, .track-label-item.drag-over").forEach(function (el) {
              el.classList.remove("drag-over");
            });
          }
          renderRuler() {
            if (!this.ruler) return;
            this.ruler.querySelectorAll(".ruler-mark").forEach(function (e) {
              e.remove();
            });
            var maxEnd = Math.max.apply(
              null,
              this.clips
                .map(function (c) {
                  return c.start + c.duration;
                })
                .concat([this.duration || 0, 60]),
            );
            var step =
              this.pixelsPerSecond > 200
                ? 1
                : this.pixelsPerSecond > 100
                  ? 2
                  : this.pixelsPerSecond > 40
                    ? 5
                    : this.pixelsPerSecond > 15
                      ? 10
                      : 30;
            for (var t = 0; t <= maxEnd + step; t += step) {
              var el = document.createElement("div");
              el.className = "ruler-mark";
              el.style.left = t * this.pixelsPerSecond + "px";
              el.textContent = this.format(t);
              this.ruler.appendChild(el);
            }
          }
          renderClips() {
            var self = this;
            this.allTracksOrdered.forEach(function (track) {
              var content = document.getElementById("content-" + track.id);
              if (!content) return;
              content.querySelectorAll(".clip").forEach(function (e) {
                e.remove();
              });
              self.clips
                .filter(function (c) {
                  return c.trackId === track.id;
                })
                .sort(function (a, b) {
                  return a.start - b.start;
                })
                .forEach(function (clip) {
                  var div = document.createElement("div");
                  div.className = "clip " + clip.type + (clip.linkId || clip.linkedTo ? " linked" : "");
                  div.dataset.id = clip.id;
                  if (clip.id === self.selectedId) div.classList.add("selected");
                  if (self.selectedIds.has(clip.id)) div.classList.add("multiselected");
                  if (clip.linkedTo && self.selectedIds.has(clip.linkedTo)) div.classList.add("multiselected");
                  if (clip.linkId && self.selectedIds.has(clip.linkId)) div.classList.add("multiselected");
                  if (clip.id === self.selectedTextId) div.classList.add("selected");
                  if (self.dragState && self.dragState.movingIds && self.dragState.movingIds.indexOf(clip.id) !== -1)
                    div.classList.add("dragging");
                  div.style.left = clip.start * self.pixelsPerSecond + "px";
                  div.style.width = Math.max(22, clip.duration * self.pixelsPerSecond) + "px";
                  var linkIcon = clip.linkId || clip.linkedTo ? "🔗 " : "";
                  var label = clip.type === "text" ? (clip.text || "Texto").replace(/\n/g, " ") : clip.name;
                  div.innerHTML =
                    '<div class="clip-handle left"></div><span style="pointer-events:none;overflow:hidden;text-overflow:ellipsis">' +
                    linkIcon +
                    label.slice(0, 14) +
                    " " +
                    self.format(clip.duration) +
                    '</span><div class="clip-handle right"></div>';
                  div.addEventListener("mousedown", function (e) {
                    self.onClipMouseDown(e, clip);
                  });
                  div.addEventListener("click", function (e) {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
                      if (self.selectedIds.has(clip.id)) {
                        self.selectedIds.delete(clip.id);
                        if (clip.linkId) self.selectedIds.delete(clip.linkId);
                        if (clip.linkedTo) self.selectedIds.delete(clip.linkedTo);
                      } else {
                        self.selectedIds.add(clip.id);
                        if (clip.linkId) self.selectedIds.add(clip.linkId);
                        if (clip.linkedTo) self.selectedIds.add(clip.linkedTo);
                      }
                      self.renderClips();
                      self.updateSelectionInfo();
                    } else {
                      if (clip.type === "text") self.selectText(clip.id);
                      else self.selectClip(clip.id);
                    }
                  });
                  div.addEventListener("contextmenu", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!self.selectedIds.has(clip.id)) {
                      if (clip.type === "text") self.selectText(clip.id);
                      else self.selectClip(clip.id);
                    }
                    self.showContextMenu(e.clientX, e.clientY);
                  });
                  content.appendChild(div);
                });
            });
            this.updatePlayheadPos();
          }
          updateSelectionInfo() {
            var inf = document.getElementById("selected-info");
            if (!inf) return;
            if (this.selectedIds.size > 1) {
              inf.textContent =
                "Multi-select: " +
                this.selectedIds.size +
                " clips - Arrastra entre V/A para cambiar línea. Playhead solo en regla superior.";
            } else if (this.selectedId) {
              var c = this.clips.find(
                function (x) {
                  return x.id == this.selectedId;
                }.bind(this),
              );
              if (c)
                inf.textContent =
                  c.type.toUpperCase() +
                  " | " +
                  String(c.text || c.name).replace(/\n/g, " ") +
                  " | " +
                  c.trackId.toUpperCase() +
                  "";
            } else {
              inf.textContent =
                "Arrastra clip hacia arriba/abajo para cambiar de línea V1/V2/V3/A1/A2/A3. Playhead solo se mueve clickeando en regla de tiempo superior.";
            }
          }
          getLinkedClip(clip) {
            if (!clip) return null;
            if (clip.linkId)
              return this.clips.find(function (c) {
                return c.id === clip.linkId;
              });
            if (clip.linkedTo)
              return this.clips.find(function (c) {
                return c.id === clip.linkedTo;
              });
            return null;
          }
          copySelected() {
            var ids = this.selectedIds.size ? Array.from(this.selectedIds) : this.selectedId ? [this.selectedId] : [];
            if (!ids.length) return;
            var clips = ids
              .map(
                function (id) {
                  return this.clips.find(function (c) {
                    return c.id == id;
                  });
                }.bind(this),
              )
              .filter(Boolean);
            this.clipboard = clips.map(function (c) {
              return JSON.parse(JSON.stringify(Object.assign({}, c, { linkId: null, linkedTo: null })));
            });
          }
          cutSelected() {
            if (!this.selectedIds.size && !this.selectedId) return;
            this.copySelected();
            this.deleteSelected();
          }
          pasteAtPlayhead() {
            if (!this.clipboard || !this.clipboard.length) {
              alert("Nada en portapapeles");
              return;
            }
            var baseTime = this.timelineTime;
            var self = this;
            var targetTrack = this.getSelectedImportTrack();
            var targetId = null;
            if (targetTrack && targetTrack !== "auto" && targetTrack !== "newV" && targetTrack !== "newA")
              targetId = targetTrack;
            this.clipboard.forEach(function (base, idx) {
              var newId = Date.now() + Math.random() + idx;
              var nc = Object.assign({}, base, {
                id: newId,
                start: baseTime + idx * 0.2 + (base.start - (self.clipboard[0].start || 0)),
                url: base.url,
                linkId: null,
                linkedTo: null,
              });
              if (targetId) nc.trackId = targetId;
              self.clips.push(nc);
              self.transforms[newId] = JSON.parse(JSON.stringify(self.transforms[base.id] || self.defaultTransform));
              if (nc.type === "text" && base.text)
                self.textStyles[newId] = Object.assign({}, self.textStyles[base.id] || {}, {
                  id: newId,
                  text: base.text,
                });
              if (nc.type === "audio") self.audioElements[newId] = new Audio(nc.url);
            });
            this.selectedIds.clear();
            this.selectedId = this.clips[this.clips.length - 1].id;
            this.renderAll();
            this.syncToTimeline();
            this.pushHistory("Pegar multi");
          }
          duplicateSelected() {
            var ids = this.selectedIds.size ? Array.from(this.selectedIds) : this.selectedId ? [this.selectedId] : [];
            if (!ids.length) return;
            var self = this;
            ids.forEach(function (id, idx) {
              var base = self.clips.find(function (c) {
                return c.id == id;
              });
              if (!base) return;
              var newId = Date.now() + Math.random() + idx + 100;
              var nc = Object.assign({}, base, {
                id: newId,
                start: base.start + base.duration + 0.3,
                url: base.url,
                linkId: null,
                linkedTo: null,
              });
              self.clips.push(nc);
              self.transforms[newId] = JSON.parse(JSON.stringify(self.transforms[base.id] || self.defaultTransform));
              if (nc.type === "text")
                self.textStyles[newId] = Object.assign({}, self.textStyles[base.id] || {}, { id: newId });
              if (nc.type === "audio") self.audioElements[newId] = new Audio(nc.url);
            });
            this.renderAll();
            this.pushHistory("Duplicar multi");
          }
          getTrackAtY(y) {
            var tracks = document.querySelectorAll(".track");
            for (var i = 0; i < tracks.length; i++) {
              var rect = tracks[i].getBoundingClientRect();
              if (y >= rect.top && y <= rect.bottom) {
                return tracks[i].dataset.trackId;
              }
            }
            var labels = document.querySelectorAll(".track-label-item");
            for (var j = 0; j < labels.length; j++) {
              var r = labels[j].getBoundingClientRect();
              if (y >= r.top && y <= r.bottom) {
                return labels[j].dataset.trackId;
              }
            }
            return null;
          }
          canMoveToTrack(clip, targetTrackId) {
            if (!targetTrackId) return false;
            var target = this.allTracks.find(function (t) {
              return t.id === targetTrackId;
            });
            if (!target) return false;
            if (clip.type === "audio") {
              return target.type === "audio";
            } else {
              return target.type === "video";
            }
          }
          onClipMouseDown(e, clip) {
            var h = e.target.closest ? e.target.closest(".clip-handle") : null;
            if (h) {
              var linked = this.getLinkedClip(clip);
              var left = h.classList.contains("left");
              this.dragState = {
                type: "resize",
                clipId: clip.id,
                isLeft: left,
                startX: e.clientX,
                origStart: clip.start,
                origDur: clip.duration,
                origSrcStart: clip.srcStart,
                linkedId: linked ? linked.id : null,
                linkedOrigStart: linked ? linked.start : 0,
                linkedOrigDur: linked ? linked.duration : 0,
                linkedOrigSrcStart: linked ? linked.srcStart : 0,
              };
            } else {
              var movingIds = this.selectedIds.has(clip.id) ? Array.from(this.selectedIds) : [clip.id];
              var fullMoving = new Set(movingIds);
              var self = this;
              movingIds.forEach(function (id) {
                var c = self.clips.find(function (x) {
                  return x.id == id;
                });
                if (!c) return;
                if (c.linkId) fullMoving.add(c.linkId);
                if (c.linkedTo) fullMoving.add(c.linkedTo);
              });
              movingIds = Array.from(fullMoving);
              this.dragState = {
                type: "drag",
                clipId: clip.id,
                startX: e.clientX,
                startY: e.clientY,
                origStart: clip.start,
                origTrackId: clip.trackId,
                movingIds: movingIds,
                origStarts: {},
                origTracks: {},
                hasMovedY: false,
              };
              movingIds.forEach(function (id) {
                var c = self.clips.find(function (x) {
                  return x.id == id;
                });
                if (c) {
                  self.dragState.origStarts[id] = c.start;
                  self.dragState.origTracks[id] = c.trackId;
                }
              });
              if (!this.selectedIds.has(clip.id) && !(e.ctrlKey || e.metaKey)) {
                if (clip.type === "text") this.selectText(clip.id);
                else this.selectClip(clip.id);
              }
            }
            this.isDragging = true;
            e.preventDefault();
            e.stopPropagation();
          }
          onMouseMove(e) {
            if (!this.dragState) return;
            if (this.dragState.type === "playhead") {
              this.seekTimelineFromEvent(e);
              return;
            }
            var clip = this.clips.find(
              function (c) {
                return c.id === this.dragState.clipId;
              }.bind(this),
            );
            if (!clip) return;
            var linked = this.dragState.linkedId
              ? this.clips.find(
                  function (c) {
                    return c.id === this.dragState.linkedId;
                  }.bind(this),
                )
              : null;
            var dx = (e.clientX - this.dragState.startX) / __K();
            var ds = dx / this.pixelsPerSecond;
            if (this.dragState.type === "drag") {
              var self = this;
              if (this.dragState.movingIds && this.dragState.movingIds.length > 1) {
                this.dragState.movingIds.forEach(function (id) {
                  var c = self.clips.find(function (x) {
                    return x.id == id;
                  });
                  if (!c) return;
                  var orig = self.dragState.origStarts[id];
                  if (orig === undefined) return;
                  c.start = Math.max(0, orig + ds);
                });
              } else {
                clip.start = Math.max(0, this.dragState.origStart + ds);
                if (linked && this.dragState.movingIds && this.dragState.movingIds.indexOf(linked.id) !== -1) {
                } else if (linked) {
                  linked.start = Math.max(0, this.dragState.linkedOrigStart + ds);
                }
              }
              var dy = Math.abs(e.clientY - this.dragState.startY);
              if (dy > 12) this.dragState.hasMovedY = true;
              if (this.dragState.hasMovedY) {
                var targetTrackId = this.getTrackAtY(e.clientY);
                if (targetTrackId && targetTrackId !== clip.trackId && this.canMoveToTrack(clip, targetTrackId)) {
                  var tT = self.allTracks.find(function (t) { return t.id === targetTrackId; });
                  var oT = self.allTracks.find(function (t) { return t.id === self.dragState.origTracks[clip.id]; });
                  if (tT && oT) {
                    var dnum = tT.num - oT.num; // video sube (+num) => audio baja (+num): movimiento espejo
                    var plan = {}, okAll = true;
                    self.dragState.movingIds.forEach(function (id) {
                      var c = self.clips.find(function (x) { return x.id == id; });
                      var ot = c && self.allTracks.find(function (t) { return t.id === self.dragState.origTracks[id]; });
                      if (!c || !ot) return;
                      var nt = self.allTracks.find(function (t) { return t.type === ot.type && t.num === ot.num + dnum; });
                      if (!nt) okAll = false;
                      else plan[id] = nt.id;
                    });
                    if (okAll) {
                      self.dragState.movingIds.forEach(function (id) {
                        var c = self.clips.find(function (x) { return x.id == id; });
                        if (c && plan[id]) c.trackId = plan[id];
                      });
                    }
                  }
                  self.dragOverTrackId = targetTrackId;
                  document.querySelectorAll(".track").forEach(function (tr) {
                    tr.classList.toggle("drag-over", tr.dataset.trackId === targetTrackId);
                  });
                  document.querySelectorAll(".track-label-item").forEach(function (lb) {
                    lb.classList.toggle("drag-over", lb.dataset.trackId === targetTrackId);
                  });
                }
              }
              this.renderClips();
            } else {
              if (this.dragState.isLeft) {
                var ns = Math.max(0, this.dragState.origStart + ds);
                var nd = this.dragState.origDur - (ns - this.dragState.origStart);
                if (nd < 0.2) {
                  nd = 0.2;
                  ns = this.dragState.origStart + this.dragState.origDur - nd;
                }
                var d = ns - this.dragState.origStart;
                clip.start = ns;
                clip.duration = nd;
                if (clip.type !== "image" && clip.type !== "text") clip.srcStart = this.dragState.origSrcStart + d * (clip.speed || 1);
                if (linked) {
                  linked.start = ns;
                  linked.duration = nd;
                  if (linked.type !== "image") linked.srcStart = this.dragState.linkedOrigSrcStart + d * (linked.speed || 1);
                }
              } else {
                clip.duration = Math.max(0.2, this.dragState.origDur + ds);
                if (linked) linked.duration = Math.max(0.2, this.dragState.linkedOrigDur + ds);
              }
              this.renderClips();
              this.updatePlayheadPos();
            }
          }
          onMouseUp() {
            if (
              this.isDragging &&
              this.dragState &&
              (this.dragState.type === "drag" || this.dragState.type === "resize")
            ) {
              this.duration = Math.max.apply(
                null,
                this.clips
                  .map(function (c) {
                    return c.start + c.duration;
                  })
                  .concat([0]),
              );
              this.updateMetrics();
              this.renderAll();
              this.syncToTimeline();
              this.pushHistory(
                this.dragState.type === "drag"
                  ? "Mover entre pistas " + (this.dragState.movingIds ? this.dragState.movingIds.length : "")
                  : "Redim",
              );
              this.clearDragOver();
              this.dragOverTrackId = null;
            }
            this.dragState = null;
            this.isDragging = false;
            this.clearDragOver();
            this.dragOverTrackId = null;
          }
          selectClip(id) {
            this.selectedId = id;
            this.selectedTextId = null;
            if (!event || (!event.ctrlKey && !event.metaKey)) this.selectedIds.clear();
            this.selectedIds.add(id);
            var clip = this.clips.find(function (c) {
              return c.id == id;
            });
            if (clip && clip.linkId) this.selectedIds.add(clip.linkId);
            if (clip && clip.linkedTo) this.selectedIds.add(clip.linkedTo);
            var self = this;
            document.querySelectorAll(".clip").forEach(function (el) {
              var cid = el.dataset.id;
              el.classList.toggle("selected", cid == id);
              el.classList.toggle("multiselected", Array.from(self.selectedIds).some(function (sid) { return sid == cid; }) && cid != id);
            });
            var c = this.clips.find(function (x) {
              return x.id == id;
            });
            if (c) {
              var inf = document.getElementById("selected-info");
              if (inf) {
                inf.textContent =
                  c.type.toUpperCase() +
                  " | " +
                  String(c.text || c.name).replace(/\n/g, " ") +
                  " | " +
                  this.format(c.start) +
                  "→" +
                  this.format(c.start + c.duration) +
                  " | Multi: " +
                  this.selectedIds.size +
                  " | Playhead solo en regla";
              }
              if (!this.transforms[id]) this.transforms[id] = Object.assign({}, this.defaultTransform);
              if (this._updateUI) this._updateUI();
              document.getElementById("text-edit-group").style.display = c.type === "text" ? "block" : "none";
              if (c.type === "text" && this._syncTextUI) this._syncTextUI();
            }
            document.querySelectorAll(".text-overlay").forEach(function (el) {
              el.classList.remove("selected");
            });
            this.updateSelectionInfo();
          }
          selectText(id) {
            this.selectedTextId = id;
            this.selectedId = id;
            if (!event || (!event.ctrlKey && !event.metaKey)) this.selectedIds.clear();
            this.selectedIds.add(id);
            var self = this;
            document.querySelectorAll(".clip").forEach(function (el) {
              el.classList.toggle("selected", el.dataset.id == id);
              el.classList.toggle("multiselected", Array.from(self.selectedIds).some(function (sid) { return sid == el.dataset.id; }) && el.dataset.id != id);
            });
            var clip = this.clips.find(function (c) {
              return c.id == id;
            });
            var st = this.textStyles[id];
            if (!st && clip) {
              st = {
                id: id,
                text: clip.text || "Texto",
                font: "Inter, system-ui, sans-serif",
                size: 32,
                color: "#ffffff",
                bg: "#000000",
                bgAlpha: 0.35,
                weight: "700",
                align: "center",
              };
              this.textStyles[id] = st;
            }
            if (st) {
              document.getElementById("text-edit-group").style.display = "block";
              if (this._syncTextUI) this._syncTextUI();
            }
            var el = this.textElements[id];
            if (el) {
              document.querySelectorAll(".text-overlay").forEach(function (x) {
                x.classList.remove("selected");
              });
              el.classList.add("selected");
            }
            if (this._updateUI) this._updateUI();
            var inf = document.getElementById("selected-info");
            if (inf && clip) {
              inf.textContent =
                "TEXTO en V | " +
                clip.text +
                " | " +
                this.format(clip.start) +
                "→" +
                this.format(clip.start + clip.duration) +
                " | Multi: " +
                this.selectedIds.size;
            }
            this.updateSelectionInfo();
          }
          clearSelection() {
            this.selectedIds.clear();
            this.selectedId = null;
            this.selectedTextId = null;
            document.querySelectorAll(".clip").forEach(function (el) {
              el.classList.remove("selected");
              el.classList.remove("multiselected");
            });
            document.querySelectorAll(".text-overlay").forEach(function (el) {
              el.classList.remove("selected");
            });
            document.getElementById("text-edit-group").style.display = "none";
            this.updateSelectionInfo();
          }
          unlinkSelected() {
            var self = this, n = 0;
            var ids = this.selectedIds.size ? Array.from(this.selectedIds) : this.selectedId ? [this.selectedId] : [];
            ids.forEach(function (id) {
              var c = self.clips.find(function (x) { return x.id == id; });
              if (!c) return;
              var p = self.getLinkedClip(c);
              if (p) { p.linkId = null; p.linkedTo = null; }
              if (c.linkId || c.linkedTo) { c.linkId = null; c.linkedTo = null; n++; }
            });
            if (n) {
              this.renderClips();
              this.updateSelectionInfo();
              this.pushHistory("Desenlazar audio");
            }
          }
          linkSelected() {
            var self = this;
            var cl = Array.from(this.selectedIds).map(function (id) {
              return self.clips.find(function (x) { return x.id == id; });
            }).filter(Boolean);
            var v = cl.find(function (c) { return c.type !== "audio" && !c.linkId && !c.linkedTo; });
            var a = cl.find(function (c) { return c.type === "audio" && !c.linkId && !c.linkedTo; });
            if (!v || !a) return;
            v.linkId = a.id; v.linkedTo = a.id;
            a.linkId = v.id; a.linkedTo = v.id;
            this.renderClips();
            this.updateSelectionInfo();
            this.pushHistory("Enlazar audio");
          }
          deleteSelected() {
            var ids = this.selectedIds.size ? Array.from(this.selectedIds) : this.selectedId ? [this.selectedId] : [];
            if (!ids.length) return;
            this.pushHistory("Borrar " + ids.length);
            var self = this;
            var fullSet = new Set(ids);
            ids.forEach(function (id) {
              var c = self.clips.find(function (x) {
                return x.id == id;
              });
              if (c) {
                if (c.linkId) fullSet.add(c.linkId);
                if (c.linkedTo) fullSet.add(c.linkedTo);
              }
            });
            var finalIds = Array.from(fullSet);
            finalIds.forEach(function (id) {
              var el = self.layerElements[id];
              if (el) {
                if (el.tagName === "VIDEO") {
                  el.pause();
                  try {
                    el.src = "";
                  } catch (e) {}
                }
                el.remove();
                delete self.layerElements[id];
              }
              var a = self.audioElements[id];
              if (a) {
                a.pause();
                try {
                  a.src = "";
                } catch (e) {}
                delete self.audioElements[id];
              }
              var t = self.textElements[id];
              if (t) {
                t.remove();
                delete self.textElements[id];
              }
            });
            this.clips = this.clips.filter(function (c) {
              return finalIds.indexOf(c.id) === -1;
            });
            finalIds.forEach(function (id) {
              delete self.transforms[id];
              delete self.textStyles[id];
            });
            this.selectedIds.clear();
            this.selectedId = this.clips[0] ? this.clips[0].id : null;
            this.selectedTextId = null;
            this.renderAll();
            this.syncToTimeline();
            this.updateSelectionInfo();
            if (!this.clips.length) {
              var ph = document.getElementById("placeholder");
              if (ph) ph.style.display = "block";
              this.layersBox.innerHTML = "";
              this.layerElements = {};
              this.textElements = {};
              this.duration = 0;
              this.timelineTime = 0;
              this.updatePlayheadPos();
              document.getElementById("text-edit-group").style.display = "none";
            }
          }
          splitAtPlayhead() {
            var t = this.timelineTime;
            var targets = this.selectedIds.size
              ? Array.from(this.selectedIds)
                  .map(
                    function (id) {
                      return this.clips.find(function (c) {
                        return c.id == id;
                      });
                    }.bind(this),
                  )
                  .filter(Boolean)
              : this.clips.filter(function (c) {
                  return t > c.start + 0.08 && t < c.start + c.duration - 0.08;
                });
            if (!targets.length) {
              alert("Selecciona clips con Ctrl+Click o pon playhead sobre clip");
              return;
            }
            this.pushHistory("Dividir " + targets.length);
            var newIds = [];
            targets.forEach(
              function (cl) {
                if (!(t > cl.start + 0.08 && t < cl.start + cl.duration - 0.08)) return;
                var off = t - cl.start;
                var linked = this.getLinkedClip(cl);
                var orig = cl.duration;
                cl.duration = off;
                var newId = Date.now() + Math.random() + newIds.length;
                var nc = {
                  id: newId,
                  name: cl.name,
                  type: cl.type,
                  url: cl.url,
                  start: t,
                  duration: orig - off,
                  srcStart: cl.type === "image" || cl.type === "text" ? 0 : cl.srcStart + off * (cl.speed || 1),
                  speed: cl.speed,
                  vol: cl.vol,
                  srcDuration: cl.srcDuration,
                  trackId: cl.trackId,
                  origW: cl.origW,
                  origH: cl.origH,
                  linkId: null,
                  linkedTo: null,
                  text: cl.text,
                };
                this.transforms[newId] = Object.assign({}, this.transforms[cl.id] || this.defaultTransform);
                if (cl.type === "text")
                  this.textStyles[newId] = Object.assign({}, this.textStyles[cl.id] || {}, { id: newId });
                if (nc.type === "audio") this.audioElements[newId] = new Audio(nc.url);
                if (linked) {
                  var nLid = Date.now() + Math.random() + newIds.length + 100;
                  var nL = {
                    id: nLid,
                    name: linked.name,
                    type: "audio",
                    url: linked.url,
                    start: t,
                    duration: linked.duration - off,
                    srcStart: linked.type === "image" ? 0 : linked.srcStart + off * (linked.speed || 1),
                    speed: linked.speed,
                    vol: linked.vol,
                    srcDuration: linked.srcDuration,
                    trackId: linked.trackId,
                    origW: 0,
                    origH: 0,
                    linkId: newId,
                    linkedTo: newId,
                  };
                  linked.duration = off;
                  this.transforms[nLid] = Object.assign({}, this.transforms[linked.id] || this.defaultTransform);
                  this.audioElements[nLid] = new Audio(nL.url);
                  this.clips.splice(this.clips.indexOf(linked) + 1, 0, nL);
                  nc.linkId = nLid;
                  nc.linkedTo = nLid;
                  nL.linkId = newId;
                  nL.linkedTo = newId;
                }
                this.clips.splice(this.clips.indexOf(cl) + 1, 0, nc);
                newIds.push(newId);
              }.bind(this),
            );
            if (newIds.length) {
              this.selectedIds = new Set(newIds);
              this.selectedId = newIds[0];
            }
            this.renderAll();
            this.syncToTimeline();
          }
          seekTimelineFromEvent(e) {
            var rect = this.ruler.getBoundingClientRect();
            var scroll = this.ruler.scrollLeft;
            var x = (e.clientX - rect.left) / __K() + scroll;
            var raw = Math.max(0, x / this.pixelsPerSecond);
            var snapped = this.snapEnabled ? this.applySnap(raw, []) : raw;
            this.timelineTime = snapped;
            this.syncToTimeline();
            this.updatePlayheadPos();
            if (this.snapEnabled && Math.abs(raw - snapped) < this.snapThreshold) {
              var self = this;
              clearTimeout(self._snapHideTimeout);
              self._snapHideTimeout = setTimeout(function () {
                self.hideSnapIndicator();
              }, 800);
            }
          }

          getClipsAtTimeline(t) {
            var self = this;
            var cov = this.clips.filter(function (c) {
              var track = self.allTracks.find(function (tr) {
                return tr.id === c.trackId;
              });
              if (track && track.enabled === false) return false;
              return t >= c.start - 0.02 && t < c.start + c.duration + 0.02;
            });
            cov.sort(function (a, b) {
              var ta = self.allTracks.find(function (tr) {
                return tr.id === a.trackId;
              });
              var tb = self.allTracks.find(function (tr) {
                return tr.id === b.trackId;
              });
              if (!ta || !tb) return 0;
              if (ta.type !== "audio" && tb.type !== "audio") return ta.num - tb.num;
              if (ta.type !== "audio" && tb.type === "audio") return -1;
              return 1;
            });
            return cov;
          }
          getNextTimeAfter(t) {
            var self = this;
            var n = null;
            for (var i = 0; i < this.clips.length; i++) {
              var c = this.clips[i];
              var tr = self.allTracks.find(function (tr) {
                return tr.id === c.trackId;
              });
              if (tr && tr.enabled === false) continue;
              if (c.start > t + 0.001) {
                if (!n || c.start < n) n = c.start;
              }
            }
            return n;
          }
          syncToTimeline() {
            var self = this;
            if (!this.clips.length) {
              this.layersBox.querySelectorAll(".layer-item").forEach(function (e) {
                if (e.tagName === "VIDEO") e.pause();
                e.remove();
              });
              this.layerElements = {};
              Object.values(this.textElements).forEach(function (el) {
                el.style.display = "none";
              });
              Object.values(this.audioElements).forEach(function (a) {
                a.pause();
              });
              return;
            }
            var cov = this.getClipsAtTimeline(this.timelineTime);
            var visualClips = cov.filter(function (c) {
              return c.type === "video" || c.type === "image";
            });
            visualClips.sort(function (a, b) {
              var ta = self.allTracks.find(function (t) {
                return t.id === a.trackId;
              });
              var tb = self.allTracks.find(function (t) {
                return t.id === b.trackId;
              });
              return (ta ? ta.num : 0) - (tb ? tb.num : 0);
            });
            var wantedIds = new Set(
              visualClips.map(function (c) {
                return c.id;
              }),
            );
            Object.keys(this.layerElements).forEach(function (id) {
              var exists = false;
              wantedIds.forEach(function (w) {
                if (w == id) exists = true;
              });
              if (
                visualClips.find(function (c) {
                  return c.id == id;
                })
              )
                exists = true;
              if (!exists) {
                var el = self.layerElements[id];
                if (el) {
                  if (el.tagName === "VIDEO") el.pause();
                  el.remove();
                }
                delete self.layerElements[id];
              }
            });
            if (visualClips.length === 0) {
              var ph = document.getElementById("placeholder");
              if (ph) ph.style.display = self.clips.length ? "none" : "block";
              self.layersBox.style.background = "#111";
            } else {
              var ph2 = document.getElementById("placeholder");
              if (ph2) ph2.style.display = "none";
              self.layersBox.style.background = "#000";
            }
            // FIX v31: Siempre aplicar transform y asegurar visibilidad aunque no esté seleccionado
            visualClips.forEach(function (clip) {
              var el = self.layerElements[clip.id];
              var track = self.allTracks.find(function (t) {
                return t.id === clip.trackId;
              });
              if (!el) {
                if (clip.type === "image") {
                  el = document.createElement("img");
                  el.src = clip.url;
                  el.crossOrigin = "anonymous";
                } else {
                  el = document.createElement("video");
                  el.src = clip.url;
                  var linked = self.getLinkedClip(clip);
                  el.muted = linked ? true : false;
                  el.playsInline = true;
                  el.preload = "auto";
                  el.crossOrigin = "anonymous";
                }
                el.className = "layer-item";
                el.dataset.clipId = clip.id;
                el.style.position = "absolute";
                el.style.left = "0";
                el.style.top = "0";
                el.style.width = "100%";
                el.style.height = "100%";
                el.style.objectFit = "contain";
                el.style.objectPosition = "center center";
                el.style.background = "transparent";
                self.layersBox.appendChild(el);
                self.layerElements[clip.id] = el;
              }
              // Siempre aplicar transform actualizado (fix: antes solo al crear)
              var tr = self.transforms[clip.id] || self.defaultTransform;
              var sx = (tr.scale || 1) * (tr.scaleX || 1) * (tr.flipX ? -1 : 1);
              var sy = (tr.scale || 1) * (tr.scaleY || 1) * (tr.flipY ? -1 : 1);
              var persp =
                (tr.perspX || 0) !== 0 || (tr.perspY || 0) !== 0
                  ? " perspective(600px) rotateX(" + (tr.perspY || 0) + "deg) rotateY(" + (tr.perspX || 0) + "deg)"
                  : "";
              el.style.transform =
                "translate(" +
                tr.x +
                "px," +
                tr.y +
                "px) scaleX(" +
                sx +
                ") scaleY(" +
                sy +
                ") rotate(" +
                tr.rot +
                "deg)" +
                persp;
              el.style.transformOrigin = "center center";
              if (track) el.style.zIndex = track.num;
              // Asegurar que no esté oculto por display none
              el.style.display = "block";
              el.style.opacity = "1";
              if (el.tagName === "VIDEO") {
                var lk = self.getLinkedClip(clip);
                // Si tiene audio linkeado, video mutedo para que audio suene
                el.muted = lk ? true : false;
                // Si no tiene link, asegurar que video suene en preview si no hay audio separado
                if (!lk) {
                  el.muted = false;
                  el.volume = 1;
                }
              }
              if (clip.type === "video") {
                var off = self.timelineTime - clip.start;
                var target = clip.srcStart + off * (clip.speed || 1);
                var maxT = clip.srcStart + clip.duration * (clip.speed || 1);
                var clamped = Math.min(Math.max(target, 0), maxT - 0.05);
                try {
                  if (Math.abs(el.currentTime - clamped) > 0.35) {
                    el.currentTime = clamped;
                  }
                  if (!self.isPlaying) {
                    el.pause();
                  } else {
                    var p = el.play();
                    if (p)
                      p.catch(function () {
                        el.muted = true;
                        el.play().catch(function () {});
                      });
                  }
                } catch (e) {}
              }
            });
            Object.values(self.textElements).forEach(function (el) {
              el.style.display = "none";
            });
            cov
              .filter(function (c) {
                return c.type === "text";
              })
              .forEach(function (clip) {
                var track = self.allTracks.find(function (t) {
                  return t.id === clip.trackId;
                });
                if (track && track.enabled === false) return;
                var el = self.textElements[clip.id];
                if (!el) {
                  el = document.createElement("div");
                  el.className = "text-overlay";
                  el.dataset.clipId = clip.id;
                  el.dataset.textId = clip.id;
                  el.dataset.baseTransform = "translate(-50%,-50%)";
                  el.style.position = "absolute";
                  el.style.left = "50%";
                  el.style.top = "50%";
                  el.style.zIndex = "35";
                  el.style.padding = "6px 12px";
                  el.style.borderRadius = "8px";
                  self.textLayer.appendChild(el);
                  self.textElements[clip.id] = el;
                  el.addEventListener("mousedown", function (e) {
                    self.selectText(clip.id);
                    e.stopPropagation();
                  });
                }
                var st = self.textStyles[clip.id];
                if (!st) {
                  st = {
                    id: clip.id,
                    text: clip.text || "Texto",
                    font: "Inter, system-ui, sans-serif",
                    size: 32,
                    color: "#ffffff",
                    bg: "#000000",
                    bgAlpha: 0.35,
                    weight: "700",
                    align: "center",
                  };
                  self.textStyles[clip.id] = st;
                }
                el.textContent = st.text;
                el.style.fontFamily = st.font;
                el.style.fontSize = st.size + "px";
                el.style.color = st.color;
                el.style.fontWeight = st.weight;
                el.style.textAlign = st.align;
__txtFx(el, st);
                el.style.display = "block";
                var bgAlpha = parseFloat(st.bgAlpha);
                if (bgAlpha === 0) el.style.background = "transparent";
                else
                  el.style.background =
                    "rgba(" +
                    parseInt(st.bg.slice(1, 3), 16) +
                    "," +
                    parseInt(st.bg.slice(3, 5), 16) +
                    "," +
                    parseInt(st.bg.slice(5, 7), 16) +
                    "," +
                    bgAlpha +
                    ")";
                var tr = self.transforms[clip.id] || self.defaultTransform;
                var sx = (tr.scale || 1) * (tr.scaleX || 1);
                var sy = (tr.scale || 1) * (tr.scaleY || 1);
                el.style.transform =
                  (el.dataset.baseTransform || "translate(-50%,-50%)") + " translate(" +
                  tr.x +
                  "px," +
                  tr.y +
                  "px) scaleX(" +
                  sx +
                  ") scaleY(" +
                  sy +
                  ") rotate(" +
                  tr.rot +
                  "deg)" + __persp(tr);
                if (clip.id === self.selectedTextId) el.classList.add("selected");
              });
            // FIX AUDIO v32 - ROBUSTO: video suena directo + audio clip suena
            var played = new Set();
            // 1) Audios A1,A2,A3
            cov
              .filter(function (c) {
                return c.type === "audio";
              })
              .forEach(function (c) {
                if (played.has(c.id)) return;
                played.add(c.id);
                var track = self.allTracks.find(function (t) {
                  return t.id === c.trackId;
                });
                if (track && track.enabled === false) {
                  var a2 = self.audioElements[c.id];
                  if (a2)
                    try {
                      a2.pause();
                    } catch (e) {}
                  return;
                }
                var a = self.audioElements[c.id];
                if (!a) {
                  a = document.createElement("audio");
                  a.src = c.url;
                  a.preload = "auto";
                  a.crossOrigin = "anonymous";
                  a.volume = 1;
                  a.muted = false;
                  a.style.display = "none";
                  document.body.appendChild(a);
                  self.audioElements[c.id] = a;
                  console.log("[Audio] Created", c.id, c.url.substring(0, 30));
                }
                var off = self.timelineTime - c.start;
                var st = c.srcStart + off * (c.speed || 1);
                var maxSt = c.srcStart + c.duration * (c.speed || 1);
                var clamped = Math.min(Math.max(st, 0), Math.max(0, maxSt - 0.05));
                try {
                  if (Math.abs(a.currentTime - clamped) > 0.5) a.currentTime = clamped;
                  a.volume = 1;
                  a.muted = false;
                  if (self.isPlaying) {
                    var p = a.play();
                    if (p)
                      p.then(function () {
                        console.log("[Audio] Playing", c.id);
                      }).catch(function (e) {
                        console.log("[Audio] Blocked", c.id, e.message);
                      });
                  } else {
                    // No pausar si es seek? Si, pausar para no sonar al mover playhead pero mantener posición
                    // Dejar sonando solo si isPlaying
                    if (!self.isPlaying) a.pause();
                  }
                } catch (e) {
                  console.log("audio sync err", e);
                }
              });
            self.clips
              .filter(function (c) {
                return c.type === "audio";
              })
              .forEach(function (c) {
                if (
                  !cov.find(function (x) {
                    return x.id === c.id;
                  })
                ) {
                  var a = self.audioElements[c.id];
                  if (a)
                    try {
                      a.pause();
                    } catch (e) {}
                }
              });
            // 2) Videos: si NO tienen audio linkeado, suenan directo. Si tienen link, se mutean y suena el A1
            cov
              .filter(function (c) {
                return c.type === "video";
              })
              .forEach(function (c) {
                var link = self.getLinkedClip(c);
                var el = self.layerElements[c.id];
                if (!el) return;
                try {
                  if (link) {
                    // Tiene audio linkeado en A1 -> video mutedo, audio A1 suena
                    el.muted = true;
                    el.volume = 0;
                  } else {
                    // Video sin link -> suena directo
                    el.muted = false;
                    el.volume = 1;
                  }
                } catch (e) {}
              });
            var pt = document.getElementById("preview-time");
            if (pt) {
              var maxEnd = Math.max.apply(
                null,
                self.clips
                  .map(function (c) {
                    return c.start + c.duration;
                  })
                  .concat([0]),
              );
              pt.textContent = self.format(self.timelineTime) + " / " + self.format(maxEnd);
            }
          }
          updatePlayheadPos() {
            var sl = this.tracksContainer ? this.tracksContainer.scrollLeft : 0;
            if (this.ruler) {
              this.ruler.style.position = "relative";
              this.ruler.style.left = -sl + "px";
            }
            var px = this.timelineTime * this.pixelsPerSecond - sl;
            if (this.playhead) {
              this.playhead.style.left = px + "px";
              this.playhead.style.display = "block";
            }
            if (this.cursor) {
              this.cursor.style.left = px + "px";
              this.cursor.style.display = "block";
            }
            var maxEnd = Math.max.apply(
              null,
              this.clips
                .map(function (c) {
                  return c.start + c.duration;
                })
                .concat([0]),
            );
            if (this.timeDisplay)
              this.timeDisplay.textContent = this.format(this.timelineTime) + " / " + this.format(maxEnd);
          }
          togglePlay() {
            if (this.isPlaying) this.pause();
            else this.play();
          }
          play() {
            var self = this;
            if (!self.clips.length) return;
            var maxEnd = Math.max.apply(
              null,
              self.clips.map(function (c) {
                return c.start + c.duration;
              }),
            );
            if (self.timelineTime >= maxEnd - 0.05) self.timelineTime = 0;
            self.isPlaying = true;
            self.lastTick = performance.now();
            self.syncToTimeline();
            var pi = document.getElementById("play-icon");
            if (pi) pi.textContent = "⏸";
            var pm = document.getElementById("play-btn-main");
            if (pm) pm.textContent = "⏸";
            // FIX v33: NO saltar espacios vacíos - respetar huecos negros/silencio
            var loop = function (now) {
              if (!self.isPlaying) return;
              var dt = (now - self.lastTick) / 1000;
              self.lastTick = now;
              self.timelineTime += dt;
              // Si no hay clips, NO saltar al siguiente - mostrar negro y silencio (respeta huecos)
              // Solo pausar si llegamos al final total
              var maxEnd = Math.max.apply(
                null,
                self.clips
                  .map(function (c) {
                    return c.start + c.duration;
                  })
                  .concat([0]),
              );
              if (self.timelineTime >= maxEnd) {
                self.pause();
                self.timelineTime = maxEnd;
                self.syncToTimeline();
                self.updatePlayheadPos();
                return;
              }
              // Siempre sincronizar, aunque sea espacio vacío (mostrará negro)
              self.syncToTimeline();
              self.updatePlayheadPos();
              self.raf = requestAnimationFrame(loop);
            };
            self.raf = requestAnimationFrame(loop);
          }
          pause() {
            this.isPlaying = false;
            var self = this;
            Object.values(this.layerElements).forEach(function (el) {
              if (el.tagName === "VIDEO") el.pause();
            });
            Object.values(this.audioElements).forEach(function (a) {
              a.pause();
            });
            if (this.raf) cancelAnimationFrame(this.raf);
            var pi = document.getElementById("play-icon");
            if (pi) pi.textContent = "▶";
            var pm = document.getElementById("play-btn-main");
            if (pm) pm.textContent = "▶";
          }
          renderAll() {
            this.renderRuler();
            this.renderTracks();
          }
          addTrack(type) {
            if (type === "video") {
              var n = this.videoTracks.length + 1;
              this.videoTracks.push({
                id: "v" + Date.now() + n,
                name: "V" + n,
                type: "video",
                icon: "🎬",
                num: n,
                enabled: true,
              });
            } else {
              var n = this.audioTracks.length + 1;
              this.audioTracks.push({
                id: "a" + Date.now() + n,
                name: "A" + n,
                type: "audio",
                icon: "🎵",
                num: n,
                enabled: true,
              });
            }
            this.renderTracks();
            this.updateMetrics();
            this.renderClips();
            this.pushHistory("Pista");
            this.updateImportSelectors();
          }
          addText() {
            var id = Date.now() + Math.random();
            var sel = this.getSelectedImportTrack();
            var trackId = "v1";
            if (
              sel &&
              sel !== "auto" &&
              sel !== "newV" &&
              sel !== "newA" &&
              this.allTracks.find(function (t) {
                return t.id === sel && t.type !== "audio";
              })
            )
              trackId = sel;
            else trackId = this.videoTracks[0] ? this.videoTracks[0].id : "v1";
            var clip = {
              id: id,
              name:
                "Texto " +
                (this.clips.filter(function (c) {
                  return c.type === "text";
                }).length +
                  1),
              type: "text",
              url: "",
              start: this.timelineTime,
              duration: 4,
              srcStart: 0,
              srcDuration: 4,
              trackId: trackId,
              origW: 0,
              origH: 0,
              linkId: null,
              linkedTo: null,
              text: "Tu texto aquí",
            };
            this.clips.push(clip);
            this.transforms[id] = Object.assign({}, this.defaultTransform);
            this.textStyles[id] = {
              id: id,
              text: "Tu texto aquí",
              font: "Inter, system-ui, sans-serif",
              size: 36,
              color: "#ffffff",
              bg: "#000000",
              bgAlpha: 0.35,
              weight: "700",
              align: "center",
            };
            this.duration = Math.max(this.duration, clip.start + clip.duration);
            this.updateMetrics();
            this.renderAll();
            this.selectText(id);
            this.syncToTimeline();
            this.pushHistory("Agregar texto en V");
          }

          closeExportModal() {
            var pv = document.getElementById("export-preview");
            if (pv) {
              try { pv.pause(); } catch (err) {}
              pv.removeAttribute("src");
              try { pv.load(); } catch (err) {}
              pv.style.display = "none";
            }
            var modal = document.getElementById("export-modal");
            if (modal) {
              modal.classList.remove("show");
              modal.style.display = "none";
            }
            if (this.isExporting) {
              this.exportCancelled = true;
              try {
                if (this.exportRecorder && this.exportRecorder.state !== "inactive") this.exportRecorder.stop();
              } catch (e) {}
              this.isExporting = false;
            }
            this.timelineTime = 0;
            this.syncToTimeline();
          }
          abortExport() {
            this.exportCancelled = true;
            try {
              if (this.exportRecorder && this.exportRecorder.state !== "inactive") this.exportRecorder.stop();
            } catch (e) {}
            this.isExporting = false;
            var status = document.getElementById("export-status");
            if (status) status.textContent = "⏹ Export detenido";
          }
          openExportDialog() {
            try {
              var modal = document.getElementById("export-options-modal");
              if (!modal) {
                alert("Modal no encontrado");
                return;
              }
              var od = document.getElementById("opt-original-desc");
              if (od) od.textContent = this.projectW + "x" + this.projectH + " (W/H exacto)";
              if (!this.supportedMp4) {
                var mp4Candidates = [
                  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
                  "video/mp4;codecs=avc1.42E01E",
                  "video/mp4;codecs=avc1",
                  "video/mp4",
                ];
                var webmCandidates = [
                  "video/webm;codecs=vp9,opus",
                  "video/webm;codecs=vp9",
                  "video/webm;codecs=vp8,opus",
                  "video/webm",
                ];
                var mp4 = null,
                  webm = null;
                for (var i = 0; i < mp4Candidates.length; i++) {
                  try {
                    if (MediaRecorder.isTypeSupported(mp4Candidates[i])) {
                      mp4 = mp4Candidates[i];
                      break;
                    }
                  } catch (e) {}
                }
                for (var j = 0; j < webmCandidates.length; j++) {
                  try {
                    if (MediaRecorder.isTypeSupported(webmCandidates[j])) {
                      webm = webmCandidates[j];
                      break;
                    }
                  } catch (e) {}
                }
                this.supportedMp4 = mp4;
                this.supportedWebm = webm;
                this.defaultMime = mp4 || webm || "video/webm";
                var info = document.getElementById("mp4-support-info");
                if (info) info.textContent = mp4 ? "✅ MP4 H.264" : "⚠️ WEBM";
              }
              modal.classList.add("show");
              modal.style.display = "flex";
              var self = this;
              modal.querySelectorAll(".export-option[data-quality]").forEach(function (opt) {
                opt.onclick = function () {
                  modal.querySelectorAll(".export-option[data-quality]").forEach(function (o) {
                    o.classList.remove("selected");
                  });
                  opt.classList.add("selected");
                  self.selectedExportQuality = opt.dataset.quality;
                };
              });
              modal.querySelectorAll(".export-option[data-format]").forEach(function (opt) {
                opt.onclick = function () {
                  modal.querySelectorAll(".export-option[data-format]").forEach(function (o) {
                    o.classList.remove("selected");
                  });
                  opt.classList.add("selected");
                  self.selectedExportFormat = opt.dataset.format;
                };
              });
            } catch (e) {
              alert("Error: " + e.message);
            }
          }
          getExportSize(quality) {
            var w, h;
            if (quality === "original") {
              w = this.projectW;
              h = this.projectH;
            } else {
              var map = { "480p": { w: 854, h: 480 }, "720p": { w: 1280, h: 720 }, "1080p": { w: 1920, h: 1080 } };
              var q = map[quality] || map["720p"];
              if (this.aspectRatio === "9-16") {
                w = Math.round((q.h * 9) / 16);
                h = q.h;
              } else if (this.aspectRatio === "1-1") {
                w = q.w;
                h = q.w;
              } else {
                w = q.w;
                h = q.h;
              }
            }
            return { w: w, h: h };
          }

          async exportVideo(quality) {
            var self = this;
            quality = quality || self.selectedExportQuality || "original";
            var format = self.selectedExportFormat || "mp4";
            var modal = document.getElementById("export-modal"),
              status = document.getElementById("export-status"),
              progress = document.getElementById("export-progress"),
              link = document.getElementById("download-link"),
              details = document.getElementById("export-details"),
              preview = document.getElementById("export-preview");
            var optModal = document.getElementById("export-options-modal");
            function log(m) {
              console.log("[export] " + m);
              if (status) status.textContent = m;
              if (details) details.textContent = m;
            }
            function cleanup() {
              try {
                Object.keys(visualEls).forEach(function (id) {
                  var o = visualEls[id];
                  try {
                    o.el.pause();
                    if (o.el.parentNode) o.el.parentNode.removeChild(o.el);
                  } catch (e) {}
                });
                audioJobs.forEach(function (j) {
                  try {
                    j.el.pause();
                    if (j.el.parentNode) j.el.parentNode.removeChild(j.el);
                  } catch (e) {}
                });
                if (audioCtx)
                  try {
                    audioCtx.close();
                  } catch (e) {}
              } catch (e) {}
            }
            var visualEls = {},
              audioJobs = [],
              audioCtx = null;
            try {
              if (optModal) {
                optModal.classList.remove("show");
                optModal.style.display = "none";
              }
              if (!modal) {
                alert("Modal no encontrado");
                return;
              }
              modal.classList.add("show");
              modal.style.display = "flex";
              if (link) {
                link.style.display = "none";
                link.href = "";
              }
              if (preview) {
                preview.style.display = "none";
                preview.src = "";
              }
              if (progress) progress.style.width = "0%";
              self.exportCancelled = false;
              if (!self.clips.length) {
                log("No hay clips para exportar");
                return;
              }
              self.pause();
              if (!self.supportedMp4) {
                var mp4C = [
                  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
                  "video/mp4;codecs=avc1.42E01E",
                  "video/mp4;codecs=avc1",
                  "video/mp4",
                ];
                var webmC = [
                  "video/webm;codecs=vp9,opus",
                  "video/webm;codecs=vp9",
                  "video/webm;codecs=vp8,opus",
                  "video/webm",
                ];
                var mp4 = null,
                  webm = null,
                  i,
                  j;
                for (i = 0; i < mp4C.length; i++) {
                  try {
                    if (MediaRecorder.isTypeSupported(mp4C[i])) {
                      mp4 = mp4C[i];
                      break;
                    }
                  } catch (e) {}
                }
                for (j = 0; j < webmC.length; j++) {
                  try {
                    if (MediaRecorder.isTypeSupported(webmC[j])) {
                      webm = webmC[j];
                      break;
                    }
                  } catch (e) {}
                }
                self.supportedMp4 = mp4;
                self.supportedWebm = webm;
                self.defaultMime = webm || mp4 || "video/webm";
              }
              var size = self.getExportSize(quality);
              var exportW = size.w,
                exportH = size.h;
              var mime =
                format === "mp4" ? self.supportedMp4 || self.supportedWebm : self.supportedWebm || self.supportedMp4;
              if (!mime) mime = "video/webm";
              var ext = mime.indexOf("mp4") !== -1 ? "mp4" : "webm";
              var bitrate = quality === "480p" ? 4000000 : quality === "720p" ? 7000000 : 12000000;
              log("Preparando export " + exportW + "x" + exportH + " [" + mime + "]...");
              // Convierte blob: a data URL (evita cualquier taint en file://)
              function blobToDataUrl(u) {
                return new Promise(function (res) {
                  if (u.indexOf("data:") === 0) {
                    res(u);
                    return;
                  }
                  fetch(u)
                    .then(function (r) {
                      return r.blob();
                    })
                    .then(function (b) {
                      var fr = new FileReader();
                      fr.onload = function () {
                        res(fr.result);
                      };
                      fr.onerror = function () {
                        res(u);
                      };
                      fr.readAsDataURL(b);
                    })
                    .catch(function () {
                      res(u);
                    });
                });
              }
              function waitEvent(el, ev, timeout) {
                return new Promise(function (res) {
                  var done = false;
                  function fin() {
                    if (done) return;
                    done = true;
                    try {
                      el.removeEventListener(ev, fin);
                    } catch (e) {}
                    res();
                  }
                  el.addEventListener(ev, fin);
                  setTimeout(fin, timeout || 10000);
                });
              }
              var baseW = self.projectW * self.fitScale || 720,
                baseH = self.projectH * self.fitScale || 405;
              if (baseW < 10) {
                baseW = 720;
                baseH = 405;
              }
              var scaleX = exportW / baseW,
                scaleY = exportH / baseH;
              var totalDuration = Math.max.apply(
                null,
                self.clips
                  .map(function (c) {
                    return c.start + c.duration;
                  })
                  .concat([0]),
              );
              if (totalDuration <= 0) {
                log("Duracion 0");
                return;
              }
              var preloadPromises = [];
              // --- elementos VISUALES dedicados por clip (no se toca el preview) ---
              self.clips.forEach(function (clip) {
                var track = self.allTracks.find(function (t) {
                  return t.id === clip.trackId;
                });
                var trackOn = track ? track.enabled !== false : true;
                if ((clip.type === "video" || clip.type === "image") && trackOn) {
                  if (clip.type === "image") {
                    var im = new Image();
                    var pp = blobToDataUrl(clip.url).then(function (u) {
                      im.src = u;
                      return waitEvent(im, "load", 6000);
                    });
                    preloadPromises.push(pp);
                    visualEls[clip.id] = { kind: "img", el: im, clip: clip, lastGood: null };
                  } else {
                    var v = document.createElement("video");
                    v.muted = true;
                    v.playsInline = true;
                    v.preload = "auto";
                    v.style.display = "none";
                    var pp2 = blobToDataUrl(clip.url)
                      .then(function (u) {
                        v.src = u;
                        return waitEvent(v, "canplay", 12000);
                      })
                      .then(function () {
                        try {
                          v.currentTime = clip.srcStart || 0;
                        } catch (e) {}
                      });
                    preloadPromises.push(pp2);
                    visualEls[clip.id] = { kind: "video", el: v, clip: clip, lastGood: null, playing: false };
                  }
                }
              });
              // --- AUDIO: clips de audio + audio embebido de videos (con o sin link) ---
              self.clips.forEach(function (clip) {
                var track = self.allTracks.find(function (t) {
                  return t.id === clip.trackId;
                });
                var trackOn = track ? track.enabled !== false : true;
                if (clip.type === "audio" && trackOn) {
                  var a = document.createElement("audio");
                  a.preload = "auto";
                  a.src = clip.url;
                  a.style.display = "none";
                  document.body.appendChild(a);
                  audioJobs.push({ clip: clip, el: a });
                  preloadPromises.push(waitEvent(a, "canplay", 10000));
                } else if (clip.type === "video" && trackOn) {
                  var link2 = self.getLinkedClip(clip);
                  var srcUrl = null;
                  if (link2) {
                    var at = self.allTracks.find(function (t) {
                      return t.id === link2.trackId;
                    });
                    if (at && at.enabled !== false) srcUrl = link2.url;
                  } else srcUrl = clip.url;
                  if (srcUrl) {
                    var a2 = document.createElement("audio");
                    a2.preload = "auto";
                    a2.src = srcUrl;
                    a2.style.display = "none";
                    document.body.appendChild(a2);
                    audioJobs.push({ clip: clip, el: a2 });
                    preloadPromises.push(waitEvent(a2, "canplay", 10000));
                  }
                }
              });
              log("Cargando " + preloadPromises.length + " medios...");
              var done = 0;
              await Promise.all(
                preloadPromises.map(function (p) {
                  return p.then(function () {
                    done++;
                    if (status) status.textContent = "Cargando medios " + done + "/" + preloadPromises.length;
                  });
                }),
              );
              // --- grafo de audio (WebAudio) ---
              var dest = null,
                gains = [];
              try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                await audioCtx.resume();
                dest = audioCtx.createMediaStreamDestination();
                audioJobs.forEach(function (j) {
                  try {
                    var src = audioCtx.createMediaElementSource(j.el);
                    var g = audioCtx.createGain();
                    g.gain.value = 0;
                    src.connect(g);
                    g.connect(dest);
                    gains.push({ job: j, gain: g });
                  } catch (e) {
                    console.log("audiosrc", e.message);
                  }
                });
              } catch (e) {
                console.log("audioctx", e.message);
              }
              // --- canvas + stream ---
              var canvas = document.getElementById("export-canvas");
              canvas.width = exportW;
              canvas.height = exportH;
              var ctx = canvas.getContext("2d");
              ctx.fillStyle = "#000";
              ctx.fillRect(0, 0, exportW, exportH);
              var stream;
              try {
                stream = canvas.captureStream(30);
              } catch (e) {
                try {
                  stream = canvas.captureStream(0);
                } catch (e2) {
                  log("captureStream no soportado");
                  return;
                }
              }
              if (dest && dest.stream.getAudioTracks().length) {
                dest.stream.getAudioTracks().forEach(function (t) {
                  stream.addTrack(t);
                });
              }
              var recorder;
              try {
                recorder = new MediaRecorder(stream, {
                  mimeType: mime,
                  videoBitsPerSecond: bitrate,
                  audioBitsPerSecond: 192000,
                });
              } catch (e) {
                try {
                  recorder = new MediaRecorder(stream, { mimeType: mime });
                } catch (e2) {
                  try {
                    recorder = new MediaRecorder(stream);
                  } catch (e3) {
                    log("MediaRecorder no disponible");
                    return;
                  }
                }
              }
              var chunks = [];
              recorder.ondataavailable = function (e) {
                if (e.data && e.data.size > 0) chunks.push(e.data);
              };
              var stopped = false;
              recorder.onstop = function () {
                if (stopped) return;
                stopped = true;
                self.isExporting = false;
                var ab = document.getElementById("abort-export-btn");
                if (ab) ab.style.display = "none";
                if (self.exportCancelled) {
                  log("Export cancelado");
                } else {
                  var blob = new Blob(chunks, { type: mime });
                  var url = URL.createObjectURL(blob);
                  if (link) {
                    link.href = url;
                    link.download = "erizocut_export_" + exportW + "x" + exportH + "." + ext;
                    link.style.display = "flex";
                    link.textContent =
                      "⬇ Descargar " + exportW + "x" + exportH + " (" + (blob.size / 1024 / 1024).toFixed(2) + " MB)";
                  }
                  if (preview) {
                    preview.src = url;
                    preview.style.display = "block";
                  }
                  log(
                    "✅ Export listo: " + exportW + "x" + exportH + " " + (blob.size / 1024 / 1024).toFixed(2) + " MB",
                  );
                }
                if (progress) progress.style.width = "100%";
                cleanup();
                self.timelineTime = 0;
                self.syncToTimeline();
              };
              self.isExporting = true;
              self.exportRecorder = recorder;
              var ab2 = document.getElementById("abort-export-btn");
              if (ab2) ab2.style.display = "flex";
              // --- arrancar TODOS los videos muted ANTES de grabar (garantiza frames pintados) ---
              var playPromises = [];
              Object.keys(visualEls).forEach(function (id) {
                var o = visualEls[id];
                if (o.kind !== "video") return;
                o.playing = true;
                var pr = o.el.play();
                if (pr)
                  pr.catch(function () {
                    o.playing = false;
                  });
                playPromises.push(pr ? pr.catch(function () {}) : Promise.resolve());
              });
              audioJobs.forEach(function (j) {
                try {
                  j.el.currentTime = j.clip.srcStart || 0;
                  j.el.pause();
                } catch (e) {}
              });
              await Promise.all(playPromises);
              await new Promise(function (r) {
                setTimeout(r, 300);
              });
              recorder.start(250);
              await new Promise(function (r) {
                setTimeout(r, 300);
              });
              log("Exportando: 0.0s / " + totalDuration.toFixed(1) + "s ...");
              var exportedTime = 0,
                lastT = performance.now();
              var videoTrack = stream.getVideoTracks()[0] || null;
              function draw(t) {
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, exportW, exportH);
                if (window.Anim) Anim.apply(self, t);
                var atT = self.getClipsAtTimeline(t);
                var visuals = atT.filter(function (c) {
                  return c.type === "video" || c.type === "image";
                });
                visuals.sort(function (a, b) {
                  var ta = self.allTracks.find(function (x) {
                    return x.id === a.trackId;
                  });
                  var tb = self.allTracks.find(function (x) {
                    return x.id === b.trackId;
                  });
                  return (ta ? ta.num : 0) - (tb ? tb.num : 0);
                });
                visuals.forEach(function (clip) {
                  var o = visualEls[clip.id];
                  if (!o) return;
                  try {
                    var tr = self.transforms[clip.id] || { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rot: 0 };
                    var tx = tr.x * scaleX,
                      ty = tr.y * scaleY;
                    var sx = (tr.scale || 1) * (tr.scaleX || 1) * (tr.flipX ? -1 : 1),
                      sy = (tr.scale || 1) * (tr.scaleY || 1) * (tr.flipY ? -1 : 1);
                    ctx.save();
                    ctx.filter = (window.ErizoTL ? ErizoTL.mix(tr.filter, t) : tr.filter) || "none";
                      __animCtx(ctx, self, clip, t, exportW, exportH);
                    ctx.translate(exportW / 2 + tx, exportH / 2 + ty);
                    ctx.rotate(((tr.rot || 0) * Math.PI) / 180);
                    ctx.scale(sx, sy);
                    var source = o.el,
                      mediaW,
                      mediaH,
                      ok = false;
                    if (o.kind === "video") {
                      var target = (clip.srcStart || 0) + (t - clip.start) * (clip.speed || 1);
                      var maxT = (clip.srcStart || 0) + clip.duration * (clip.speed || 1);
                      target = Math.min(Math.max(target, 0), Math.max(0, maxT - 0.04));
                      if (o.el.readyState >= 1 && Math.abs(o.el.currentTime - target) > 0.35) {
                        try {
                          o.el.currentTime = target;
                        } catch (e) {}
                      }
                      if (o.el.paused) {
                        o.playing = true;
                        var p = o.el.play();
                        if (p)
                          p.catch(function () {
                            o.playing = false;
                          });
                      }
                      mediaW = o.el.videoWidth || clip.origW || exportW;
                      mediaH = o.el.videoHeight || clip.origH || exportH;
                      ok = o.el.readyState >= 2 && mediaW > 0;
                    } else {
                      mediaW = o.el.naturalWidth || clip.origW || exportW;
                      mediaH = o.el.naturalHeight || clip.origH || exportH;
                      ok = o.el.complete && mediaW > 0;
                    }
                    var ca = exportW / exportH,
                      ma = mediaW / mediaH;
                    var dw, dh;
                    if (ma > ca) {
                      dw = exportW;
                      dh = exportW / ma;
                    } else {
                      dh = exportH;
                      dw = exportH * ma;
                    }
                    if (ok) {
                      if (window.ErizoLook) source = ErizoLook.prep(ctx, clip, tr, t, source, mediaW, mediaH, dw, dh);
                      __drawPersp(ctx, source, dw, dh, tr);
                      if (o.kind === "video") {
                        if (!o.lastGood) o.lastGood = document.createElement("canvas");
                        if (o.lastGood.width !== Math.round(dw) || o.lastGood.height !== Math.round(dh)) {
                          o.lastGood.width = Math.round(dw);
                          o.lastGood.height = Math.round(dh);
                        }
                        try {
                          o.lastGood.getContext("2d").drawImage(source, 0, 0, o.lastGood.width, o.lastGood.height);
                        } catch (e) {}
                      }
                    } else if (o.lastGood) {
                      ctx.drawImage(
                        o.lastGood,
                        -o.lastGood.width / 2,
                        -o.lastGood.height / 2,
                        o.lastGood.width,
                        o.lastGood.height,
                      );
                    }
                    ctx.restore();
                  } catch (e) {
                    try {
                      ctx.restore();
                    } catch (e2) {}
                  }
                });
                atT
                  .filter(function (c) {
                    return c.type === "text";
                  })
                  .forEach(function (clip) {
                    var st = self.textStyles[clip.id];
                    if (!st) return;
                    var tr = self.transforms[clip.id] || { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rot: 0 };
                    try {
                      ctx.save();
                      __animCtx(ctx, self, clip, t, exportW, exportH);
                      ctx.translate(exportW * (st.align === "left" ? 0.04 : st.align === "right" ? 0.96 : 0.5) + tr.x * scaleX, exportH / 2 + tr.y * scaleY);
                      ctx.rotate(((tr.rot || 0) * Math.PI) / 180);
                      ctx.scale((tr.scale || 1) * (tr.scaleX || 1), (tr.scale || 1) * (tr.scaleY || 1));
                      var fs = Math.max(6, st.size * scaleY);
                      ctx.font = (st.weight || "700") + " " + fs + "px " + (st.font || "sans-serif");
                      ctx.textAlign = st.align || "center";
                      ctx.textBaseline = "middle";
                      if ((tr.perspX || 0) !== 0 || (tr.perspY || 0) !== 0) {
                        // v33: texto con perspectiva -> dibujar en canvas temporal y deformar por franjas
                        var lines = Anim.text(self, clip, t, st).split("\n");
                        var lh = fs * 1.2;
                        var pmw = 0;
                        lines.forEach(function (ln) { pmw = Math.max(pmw, ctx.measureText(ln).width); });
                        var pw = Math.ceil(pmw + 24 * scaleX),
                          ph = Math.ceil(lines.length * lh + 12 * scaleY);
                        var PC = document.createElement("canvas");
                        PC.width = pw;
                        PC.height = ph;
                        var pc = PC.getContext("2d");
                        if (parseFloat(st.bgAlpha) > 0) {
                          pc.fillStyle =
                            "rgba(" +
                            parseInt(st.bg.slice(1, 3), 16) + "," +
                            parseInt(st.bg.slice(3, 5), 16) + "," +
                            parseInt(st.bg.slice(5, 7), 16) + "," +
                            st.bgAlpha + ")";
                          pc.fillRect(0, 0, pw, ph);
                        }
                        pc.font = ctx.font;
                        pc.textBaseline = "middle";
                        var pshp = __shadowParams(st, scaleX);
                        if (pshp) { pc.shadowColor = pshp.c; pc.shadowBlur = pshp.b; pc.shadowOffsetX = pshp.x; pc.shadowOffsetY = pshp.y; }
                        pc.fillStyle = st.color || "#fff";
                        var palign = st.align || "center";
                        pc.textAlign = palign;
                        var px = palign === "left" ? 12 * scaleX : palign === "right" ? pw - 12 * scaleX : pw / 2;
                        lines.forEach(function (ln, li) {
                          if (st.stW > 0) { pc.lineJoin = "round"; pc.lineWidth = st.stW * scaleX; pc.strokeStyle = st.stColor || "#000000"; pc.strokeText(ln, px, 6 * scaleY + (li + 0.5) * lh); }
                          pc.fillText(ln, px, 6 * scaleY + (li + 0.5) * lh);
                        });
                        ctx.translate(palign === "left" ? pw / 2 : palign === "right" ? -pw / 2 : 0, 0);
                        __drawPersp(ctx, PC, pw, ph, tr);
                        ctx.restore();
                        return;
                      }
                      var lines2 = Anim.text(self, clip, t, st).split("\n");
                      var lh2 = fs * 1.2;
                      var mw2 = 0;
                      lines2.forEach(function (ln) { mw2 = Math.max(mw2, ctx.measureText(ln).width); });
                      var bw = mw2 + 24 * scaleX,
                        bh = lines2.length * lh2 + 12 * scaleY;
                      if (parseFloat(st.bgAlpha) > 0) {
                        var bx = st.align === "left" ? 0 : st.align === "right" ? -bw : -bw / 2;
                        ctx.fillStyle =
                          "rgba(" +
                          parseInt(st.bg.slice(1, 3), 16) + "," +
                          parseInt(st.bg.slice(3, 5), 16) + "," +
                          parseInt(st.bg.slice(5, 7), 16) + "," +
                          st.bgAlpha + ")";
                        ctx.fillRect(bx, -bh / 2, bw, bh);
                      }
                      var shp = __shadowParams(st, scaleX);
                      if (shp) { ctx.shadowColor = shp.c; ctx.shadowBlur = shp.b; ctx.shadowOffsetX = shp.x; ctx.shadowOffsetY = shp.y; }
                      ctx.fillStyle = st.color || "#fff";
                      lines2.forEach(function (ln, li) {
                        if (st.stW > 0) { ctx.lineJoin = "round"; ctx.lineWidth = st.stW * scaleX; ctx.strokeStyle = st.stColor || "#000000"; ctx.strokeText(ln, st.align === "left" ? 12 * scaleX : st.align === "right" ? -12 * scaleX : 0, -bh / 2 + 6 * scaleY + (li + 0.5) * lh2); }
                        ctx.fillText(ln, st.align === "left" ? 12 * scaleX : st.align === "right" ? -12 * scaleX : 0, -bh / 2 + 6 * scaleY + (li + 0.5) * lh2);
                      });
                      ctx.restore();
                    } catch (e) {
                      try {
                        ctx.restore();
                      } catch (e2) {}
                    }
                  });
                gains.forEach(function (g) {
                  var active = t >= g.job.clip.start - 0.05 && t < g.job.clip.start + g.job.clip.duration + 0.05;
                  try {
                    if (active) {
                      var tgt = (g.job.clip.srcStart || 0) + (t - g.job.clip.start) * (g.job.clip.speed || 1);
                      var mx = (g.job.clip.srcStart || 0) + g.job.clip.duration * (g.job.clip.speed || 1);
                      tgt = Math.min(Math.max(tgt, 0), Math.max(0, mx - 0.04));
                      if (Math.abs(g.job.el.currentTime - tgt) > 0.5) {
                        try {
                          g.job.el.currentTime = tgt;
                        } catch (e) {}
                      }
                      if (g.job.el.paused) {
                        var p = g.job.el.play();
                        if (p) p.catch(function () {});
                      }
                      if (g.gain.gain.value !== 1) g.gain.gain.value = 1;
                    } else {
                      if (g.gain.gain.value !== 0) g.gain.gain.value = 0;
                      if (!g.job.el.paused) {
                        try {
                          g.job.el.pause();
                        } catch (e) {}
                      }
                    }
                  } catch (e) {}
                });
                if (videoTrack && videoTrack.requestFrame) {
                  try {
                    videoTrack.requestFrame();
                  } catch (e) {}
                }
              }
              var loop = function (now) {
                if (self.exportCancelled) {
                  try {
                    recorder.stop();
                  } catch (e) {}
                  return;
                }
                var dt = (now - lastT) / 1000;
                lastT = now;
                if (dt > 0.2) dt = 1 / 30;
                if (dt < 0) dt = 0;
                exportedTime += dt;
                self.timelineTime = exportedTime;
                if (exportedTime >= totalDuration) {
                  self.timelineTime = totalDuration;
                  draw(totalDuration);
                  setTimeout(function () {
                    try {
                      recorder.stop();
                    } catch (e) {}
                  }, 400);
                  return;
                }
                draw(exportedTime);
                if (progress) progress.style.width = Math.min(95, (exportedTime / totalDuration) * 100) + "%";
                self._frameCount = (self._frameCount || 0) + 1;
                if (self._frameCount % 30 === 0)
                  log("Exportando: " + exportedTime.toFixed(1) + "s / " + totalDuration.toFixed(1) + "s");
                self.rafExport = requestAnimationFrame(loop);
              };
              self.rafExport = requestAnimationFrame(loop);
            } catch (err) {
              log("Error: " + err.message);
              console.error(err);
              self.isExporting = false;
              cleanup();
            }
          }

          format(s) {
            var m = Math.floor(s / 60);
            var sec = Math.floor(s % 60);
            var ms = Math.floor((s % 1) * 10);
            return m + ":" + String(sec).padStart(2, "0") + "." + ms;
          }

          init() {
            var self = this;
            var input = document.getElementById("file-input");
            var stage = this.previewStage;
            if (stage) {
              stage.addEventListener("dragover", function (e) {
                e.preventDefault();
              });
              stage.addEventListener("drop", function (e) {
                e.preventDefault();
                if (e.dataTransfer.files.length) self.handleFiles(e.dataTransfer.files);
              });
            }
            var ph = document.getElementById("placeholder");
            if (ph)
              ph.addEventListener("click", function () {
                input.click();
              });
            function safe(id, ev, fn) {
              var el = document.getElementById(id);
              if (el) el.addEventListener(ev, fn);
            }
            safe("import-btn", "click", function () {
              input.click();
            });
            safe("tb-import", "click", function () {
              input.click();
            });
            safe("tb-split", "click", function () {
              self.splitAtPlayhead();
            });
            safe("tb-del", "click", function () {
              self.deleteSelected();
            });
            safe("tb-text", "click", function () {
              self.addText();
            });
            safe("m-undo", "click", function () {
              self.undo();
            });
            safe("m-redo", "click", function () {
              self.redo();
            });
            safe("m-copy", "click", function () {
              self.copySelected();
            });
            safe("m-cut", "click", function () {
              self.cutSelected();
            });
            safe("m-paste", "click", function () {
              self.pasteAtPlayhead();
            });
            safe("m-del", "click", function () {
              self.deleteSelected();
            });
            safe("m-split", "click", function () {
              self.splitAtPlayhead();
            });
            safe("m-fit", "click", function () {
              self.zoomFit();
            });
            safe("m-detail", "click", function () {
              self.zoomDetail();
            });
            safe("m-exp-dialog", "click", function () {
              self.openExportDialog();
            });
            safe("export-btn", "click", function () {
              self.openExportDialog();
            });
            safe("export-btn2", "click", function () {
              self.openExportDialog();
            });
            safe("confirm-export", "click", function () {
              self.exportVideo(self.selectedExportQuality);
            });
            safe("c-copy", "click", function () {
              self.copySelected();
            });
            safe("c-cut", "click", function () {
              self.cutSelected();
            });
            safe("c-paste", "click", function () {
              self.pasteAtPlayhead();
            });
            safe("c-del", "click", function () {
              self.deleteSelected();
            });
            safe("c-clear-sel", "click", function () {
              self.clearSelection();
            });
            safe("ctx-copy", "click", function () {
              self.copySelected();
              hideContext();
            });
            safe("ctx-cut", "click", function () {
              self.cutSelected();
              hideContext();
            });
            safe("ctx-paste", "click", function () {
              self.pasteAtPlayhead();
              hideContext();
            });
            safe("ctx-split", "click", function () {
              self.splitAtPlayhead();
              hideContext();
            });
            safe("ctx-del", "click", function () {
              self.deleteSelected();
              hideContext();
            });
            safe("ctx-fit", "click", function () {
              self.zoomFit();
              hideContext();
            });
            safe("ctx-dup", "click", function () {
              self.duplicateSelected();
              hideContext();
            });
            safe("ctx-clear", "click", function () {
              self.clearSelection();
              hideContext();
            });
            if (input)
              input.addEventListener("change", function (e) {
                self.handleFiles(e.target.files);
                e.target.value = "";
              });
            var playBtns = [document.getElementById("play-btn"), document.getElementById("play-btn-main")];
            playBtns.forEach(function (b) {
              if (b)
                b.addEventListener("click", function () {
                  self.togglePlay();
                });
            });
            document.addEventListener("keydown", function (e) {
              if (e.target.tagName === "TEXTAREA") return;
              if (e.target.tagName === "INPUT" && e.target.type !== "range") {
                if (!(e.ctrlKey || e.metaKey)) return;
              }
              if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) {
                e.preventDefault();
                self.undo();
              } else if ((e.ctrlKey || e.metaKey) && ((e.code === "KeyZ" && e.shiftKey) || e.code === "KeyY")) {
                e.preventDefault();
                self.redo();
              } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyC") {
                e.preventDefault();
                self.copySelected();
              } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyX") {
                e.preventDefault();
                self.cutSelected();
              } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyV") {
                e.preventDefault();
                self.pasteAtPlayhead();
              } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyA") {
                e.preventDefault();
                self.selectedIds = new Set(
                  self.clips.map(function (c) {
                    return c.id;
                  }),
                );
                self.renderClips();
                self.updateSelectionInfo();
              } else if ((e.ctrlKey || e.metaKey) && (e.code === "Equal" || e.code === "NumpadAdd")) {
                e.preventDefault();
                self.zoomIn();
              } else if ((e.ctrlKey || e.metaKey) && (e.code === "Minus" || e.code === "NumpadSubtract")) {
                e.preventDefault();
                self.zoomOut();
              } else if (e.code === "Space" && !e.ctrlKey && e.target.tagName !== "INPUT") {
                e.preventDefault();
                self.togglePlay();
              } else if (e.code === "KeyS" && !e.ctrlKey && e.target.tagName !== "INPUT") {
                e.preventDefault();
                self.splitAtPlayhead();
              } else if ((e.code === "Delete" || e.code === "Backspace") && !e.ctrlKey) {
                if (e.target.tagName !== "INPUT" && (self.selectedId || self.selectedIds.size)) {
                  e.preventDefault();
                  self.deleteSelected();
                }
              } else if (e.code === "Escape") {
                self.clearSelection();
              }
            });
            // FIX PLAYHEAD SOLO EN REGLA: tracksContainer ya NO mueve playhead, solo selecciona
            if (this.tracksContainer) {
              this.tracksContainer.addEventListener("mousedown", function (e) {
                // Si es clip, no mover playhead, solo iniciar drag del clip
                if (e.target.closest && e.target.closest(".clip")) return;
                // Si es espacio vacío, no mover playhead tampoco (para multi-select)
                // Solo la regla mueve playhead
                e.preventDefault();
              });
              this.tracksContainer.addEventListener("scroll", function () {
                /* la regla y el marcador deben desplazarse junto con las pistas (si no, el marcador queda lejos de donde corta) */
                self.updatePlayheadPos();
              });
            }
            if (this.ruler) {
              this.ruler.addEventListener("mousedown", function (e) {
                if (e.button !== 0) return;
                self.seekTimelineFromEvent(e);
                self.dragState = { type: "playhead" };
                e.preventDefault();
              });
              this.ruler.addEventListener("mousemove", function (e) {
                if (self.dragState && self.dragState.type === "playhead") self.seekTimelineFromEvent(e);
              });
              this.ruler.addEventListener("scroll", function () {
                self.ruler.scrollLeft = 0;
              });
              this.ruler.addEventListener("click", function (e) {
                self.seekTimelineFromEvent(e);
              });
            }
            if (this.cursor)
              this.cursor.addEventListener("mousedown", function (e) {
                self.dragState = { type: "playhead" };
                e.preventDefault();
              });
            document.addEventListener("mousemove", function (e) {
              self.onMouseMove(e);
            });
            document.addEventListener("mouseup", function () {
              self.onMouseUp();
            });
            safe("zoom-in", "click", function () {
              self.zoomIn();
            });
            safe("zoom-out", "click", function () {
              self.zoomOut();
            });
            safe("zoom-fit", "click", function () {
              self.zoomFit();
            });
            safe("zoom-detail", "click", function () {
              self.zoomDetail();
            });
            safe("zoom-fit-btn", "click", function () {
              self.zoomFit();
            });
            safe("zoom-detail-btn", "click", function () {
              self.zoomDetail();
            });
            var zs = document.getElementById("zoom-slider");
            if (zs)
              zs.addEventListener("input", function (e) {
                self.setZoom(parseInt(e.target.value));
              });
            safe("preview-zoom-in", "click", function () {
              self.setPreviewZoom(self.previewZoom * 1.2);
            });
            safe("preview-zoom-out", "click", function () {
              self.setPreviewZoom(self.previewZoom / 1.2);
            });
            safe("preview-fit", "click", function () {
              self.setPreviewZoom(1);
            });
            var pzs = document.getElementById("preview-zoom-slider");
            if (pzs)
              pzs.addEventListener("input", function (e) {
                self.setPreviewZoom(parseInt(e.target.value) / 100);
              });
            this.previewStage.addEventListener(
              "wheel",
              function (e) {
                if (e.ctrlKey || e.altKey) {
                  e.preventDefault();
                  if (window.ErizoUI && window.ErizoUI.stepPreview) window.ErizoUI.stepPreview(e.deltaY > 0 ? -1 : 1);
                }
              },
              { passive: false },
            );
            this.tracksContainer.addEventListener(
              "wheel",
              function (e) {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  var d = e.deltaY > 0 ? 0.9 : 1.1;
                  self.setZoom(self.pixelsPerSecond * d);
                }
              },
              { passive: false },
            );
            document.querySelectorAll(".aspect-btn").forEach(function (btn) {
              btn.addEventListener("click", function () {
                document.querySelectorAll(".aspect-btn").forEach(function (b) {
                  b.classList.remove("active");
                });
                btn.classList.add("active");
                self.setAspect(btn.dataset.ratio);
              });
            });
            safe("res-select", "change", function (e) {
              self.setResolution(e.target.value);
            });
            safe("apply-size", "click", function () {
              self.applyCustomSize();
            });
            safe("add-v-track", "click", function () {
              self.addTrack("video");
            });
            safe("add-a-track", "click", function () {
              self.addTrack("audio");
            });
            var sel1 = document.getElementById("import-track-select");
            var sel2 = document.getElementById("import-track-select2");
            if (sel1)
              sel1.addEventListener("change", function () {
                if (sel2) sel2.value = sel1.value;
              });
            if (sel2)
              sel2.addEventListener("change", function () {
                if (sel1) sel1.value = sel2.value;
              });
            this.tracksContainer.addEventListener("contextmenu", function (e) {
              e.preventDefault();
              var clipEl = e.target.closest ? e.target.closest(".clip") : null;
              if (clipEl) {
                var id = clipEl.dataset.id;
                var cl = self.clips.find(function (c) {
                  return c.id == id;
                });
                if (!self.selectedIds.has(id)) {
                  if (cl && cl.type === "text") self.selectText(id);
                  else self.selectClip(id);
                }
              }
              self.showContextMenu(e.clientX, e.clientY);
            });
            this.previewStage.addEventListener("contextmenu", function (e) {
              e.preventDefault();
              self.showContextMenu(e.clientX, e.clientY);
            });
            var wrapper = document.getElementById("timeline-wrapper");
            if (wrapper) {
              wrapper.addEventListener("dragover", function (e) {
                e.preventDefault();
              });
              wrapper.addEventListener("drop", function (e) {
                if (e.dataTransfer.files.length) {
                  e.preventDefault();
                  var targetId = self.getTrackAtY(e.clientY);
                  if (targetId) self.handleFiles(e.dataTransfer.files, targetId);
                  else self.handleFiles(e.dataTransfer.files);
                }
              });
            }
            this.bindTransform();
            this.bindTextEdit();
            this.initDragPreview();

            // v29 FIX: Box Select (cuadro de selección con clic izquierdo)
            var self = this;
            var tracksContainer = document.getElementById("timeline-tracks");
            if (tracksContainer) {
              var isBoxSelecting = false;
              var boxMoved = false;
              var startX = 0,
                startY = 0,
                boxEl = null,
                baseSel = new Set(),
                lastKey = "";

              // Los IDs reales de los clips son números; dataset.id es texto.
              // Siempre se resuelve el clip real para usar su ID original.
              function clipFromEl(el) {
                var sid = el.dataset.id;
                for (var i = 0; i < self.clips.length; i++) {
                  if (String(self.clips[i].id) === sid) return self.clips[i];
                }
                return null;
              }

              tracksContainer.addEventListener("mousedown", function (e) {
                if (e.button !== 0) return;
                if (e.target.closest && e.target.closest(".clip")) return;
                var rect = tracksContainer.getBoundingClientRect();
                // Ignorar clic sobre las barras de scroll
                if (e.clientX > rect.left + tracksContainer.clientWidth * __K()) return;
                if (e.clientY > rect.top + tracksContainer.clientHeight * __K()) return;
                startX = (e.clientX - rect.left) / __K() + tracksContainer.scrollLeft;
                startY = (e.clientY - rect.top) / __K() + tracksContainer.scrollTop;
                isBoxSelecting = true;
                boxMoved = false;
                lastKey = "";
                // Con Ctrl/Cmd se suma a la selección actual; si no, se parte de cero
                baseSel = e.ctrlKey || e.metaKey ? new Set(self.selectedIds) : new Set();
                if (!boxEl || !boxEl.parentNode) {
                  boxEl = document.createElement("div");
                  boxEl.id = "selection-box";
                  tracksContainer.appendChild(boxEl);
                }
                boxEl.style.display = "block";
                boxEl.style.left = startX + "px";
                boxEl.style.top = startY + "px";
                boxEl.style.width = "0px";
                boxEl.style.height = "0px";
                e.preventDefault();
              });

              document.addEventListener("mousemove", function (e) {
                if (!isBoxSelecting || !boxEl) return;
                var rect = tracksContainer.getBoundingClientRect();
                var curX = (e.clientX - rect.left) / __K() + tracksContainer.scrollLeft;
                var curY = (e.clientY - rect.top) / __K() + tracksContainer.scrollTop;
                var x = Math.min(curX, startX);
                var y = Math.min(curY, startY);
                var w = Math.abs(curX - startX);
                var h = Math.abs(curY - startY);
                boxEl.style.left = x + "px";
                boxEl.style.top = y + "px";
                boxEl.style.width = w + "px";
                boxEl.style.height = h + "px";
                if (w <= 4 && h <= 4) return;
                boxMoved = true;

                var hit = new Set(baseSel);
                tracksContainer.querySelectorAll(".clip").forEach(function (clipEl) {
                  var cRect = clipEl.getBoundingClientRect();
                  var clipX = (cRect.left - rect.left) / __K() + tracksContainer.scrollLeft;
                  var clipY = (cRect.top - rect.top) / __K() + tracksContainer.scrollTop;
                  var intersect =
                    clipX < x + w && clipX + cRect.width / __K() > x && clipY < y + h && clipY + cRect.height / __K() > y;
                  if (!intersect) return;
                  var clip = clipFromEl(clipEl);
                  if (!clip) return;
                  hit.add(clip.id);
                  // Si el clip está enlazado (video + audio), se selecciona también su pareja
                  if (clip.linkId) hit.add(clip.linkId);
                  if (clip.linkedTo) hit.add(clip.linkedTo);
                });

                // Solo re-renderizar si la selección cambió
                var key = Array.from(hit).sort().join("|");
                if (key === lastKey) return;
                lastKey = key;
                self.selectedIds = hit;
                self.selectedTextId = null;
                self.selectedId = hit.size === 1 ? Array.from(hit)[0] : null;
                self.renderClips();
                // renderClips no toca el cuadro, pero lo aseguramos en el DOM
                if (boxEl && !boxEl.parentNode) tracksContainer.appendChild(boxEl);
                self.updateSelectionInfo();
              });

              document.addEventListener("mouseup", function (e) {
                if (!isBoxSelecting) return;
                isBoxSelecting = false;
                if (boxEl) boxEl.style.display = "none";
                // Clic simple en vacío (sin arrastrar): limpiar selección
                if (!boxMoved && !e.ctrlKey && !e.metaKey) {
                  self.clearSelection();
                }
                self.hideSnapIndicator();
              });
            }
            [["ctx-unlink", "unlinkSelected"], ["tb-unlink", "unlinkSelected"], ["ctx-link", "linkSelected"], ["tb-link", "linkSelected"]].forEach(function (p) {
              var b = document.getElementById(p[0]);
              if (b) b.addEventListener("click", function () { self[p[1]](); });
            });
            document.addEventListener("keydown", function (e) {
              if (e.code === "KeyL" && e.shiftKey && (e.ctrlKey || e.metaKey) && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
                e.preventDefault();
                var linked = Array.from(self.selectedIds).some(function (id) {
                  var c = self.clips.find(function (x) { return x.id == id; });
                  return c && (c.linkId || c.linkedTo);
                });
                if (linked) self.unlinkSelected(); else self.linkSelected();
              }
            });
            // Magnet toggle
            var magnetBtn = document.getElementById("magnet-toggle");
            if (magnetBtn) {
              magnetBtn.classList.add("magnet-on");
              magnetBtn.textContent = "🧲 Magnet ON";
              magnetBtn.onclick = function () {
                self.snapEnabled = !self.snapEnabled;
                magnetBtn.classList.toggle("magnet-on", self.snapEnabled);
                magnetBtn.textContent = self.snapEnabled ? "🧲 Magnet ON" : "🧲 Magnet OFF";
              };
            }
            // File input fix - NO clonar, solo asegurar listener
            var fileInput = document.getElementById("file-input");
            if (fileInput) {
              fileInput.addEventListener("change", function (e) {
                console.log("v28 file-input", e.target.files.length);
                if (e.target.files.length && self.handleFiles) self.handleFiles(e.target.files);
                setTimeout(function () {
                  e.target.value = "";
                }, 100);
              });
            }
            // Export cancel buttons
            var closeBtn = document.getElementById("close-export-modal");
            if (closeBtn)
              closeBtn.onclick = function () {
                self.closeExportModal();
              };
            var cancelBtn = document.getElementById("cancel-export-modal");
            if (cancelBtn)
              cancelBtn.onclick = function () {
                self.closeExportModal();
              };
            var abortBtn = document.getElementById("abort-export-btn");
            if (abortBtn)
              abortBtn.onclick = function () {
                self.abortExport();
              };
            // Export buttons
            ["export-btn", "export-btn2", "m-exp-dialog"].forEach(function (id) {
              var b = document.getElementById(id);
              if (b)
                b.onclick = function () {
                  self.openExportDialog();
                };
            });
            var confirmBtn = document.getElementById("confirm-export");
            if (confirmBtn)
              confirmBtn.onclick = function () {
                self.exportVideo();
              };
            // Click fuera para cerrar modals
            var exportModalEl = document.getElementById("export-modal");
            if (exportModalEl)
              exportModalEl.addEventListener("click", function (e) {
                if (e.target === exportModalEl) self.closeExportModal();
              });
            var optModalEl = document.getElementById("export-options-modal");
            if (optModalEl)
              optModalEl.addEventListener("click", function (e) {
                if (e.target === optModalEl) {
                  optModalEl.classList.remove("show");
                  optModalEl.style.display = "none";
                }
              });

            this.setResolution("1080p");
            this.setAspect("16-9");
            this.renderTracks();
            this.updateMetrics();
            this.renderRuler();
            this.updatePlayheadPos();
            this.updateImportSelectors();
            this.pushHistory("Inicio");
          }
        }
        document.addEventListener("DOMContentLoaded", function () {
          window.editor = new VideoEditor();
        });
      })();
