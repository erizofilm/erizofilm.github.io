# Loveholic STUDIO v21 PRO - Estructura Profesional

Estructura de archivos lista para hosting.

```
/loveholic-studio/
├── index.html          # Entrada principal
├── css/
│   └── style.css       # Estilos completos
├── js/
│   ├── editor.js       # Núcleo editor, clips, historial
│   ├── timeline.js     # Magnet a cortes + Selección por rango
│   ├── transform.js    # Transform y drag preview
│   ├── export.js       # Export FIX 1x velocidad + MP4 H.264
│   └── app.js (opcional)
└── assets/             # Para logos, etc.
```

## Deploy

1. Sube la carpeta `loveholic-studio` a tu hosting (Vercel, Netlify, Hostinger, cPanel)
2. Apunta dominio a `index.html`
3. No necesita build, es vanilla JS modules

## Features v21 PRO

- **Magnet/Cabezal**: botón 🧲 Magnet ON/OFF - se acerca a cortes, playhead, inicio
- **Selección por rango**: arrastra mouse en área vacía del timeline → rectángulo verde selecciona múltiples clips
- **Drag entre pistas**: arrastra clip vertical V1→V2→V3 / A1→A2, con validación video solo V, audio solo A
- **Selector pista destino**: importa directo a V2, no siempre al final de V1
- **Export FIX**: 
  - Antes 1:11 → 6:30 por `captureStream(30)` grabando tiempo real con seeks lentos
  - Ahora `captureStream(0)` + `track.requestFrame()` → cada frame dibujado = 1 frame video, duración real exacta, 1x velocidad, sin sobresaturación, sin pausas, sin saltos
  - Audio continuo via AudioContext + MediaStreamDestination
  - MP4 H.264 si navegador soporta (Chrome/Edge), fallback WEBM VP9
- **Playhead solo en regla**: no se mueve al seleccionar clips
- **Centro exacto**: object-fit contain + transform centrado

## Navegadores soportados para MP4

Chrome/Edge 88+ soportan `video/mp4;codecs=avc1` en MediaRecorder.
Firefox solo WEBM (usa fallback automático).
