# 🦔 Erizo Cut

Editor de video **100 % en el navegador**, sin instalación ni servidor: abre `index.html` y empieza a editar.
Está inspirado en la organización de editores como Concat y DaVinci Resolve: biblioteca de medios, vista previa,
inspector, fotogramas clave y línea de tiempo multipista, todo en paneles que puedes reorganizar.

> Tus archivos **nunca salen de tu equipo**: todo se procesa localmente y el proyecto se autoguarda en el navegador.

## Características

- **Biblioteca de medios**: los archivos importados se quedan en la biblioteca (video, audio, imágenes, voz grabada).
  Se **arrastran a la línea de tiempo** (o doble clic / *Archivo → Añadir la selección a la línea de tiempo*).
  Búsqueda, filtros por tipo, selección múltiple, renombrar y eliminar con clic derecho.
- **Línea de tiempo multipista** (video y audio) con audio enlazado automáticamente, imán (snap), zoom y ajuste.
- **Barra de herramientas**: agregar pista/texto, deshacer/rehacer, **dividir**, recortar inicio/final hasta el cabezal,
  eliminar, **eliminar cerrando el hueco**, herramienta selección/mano, **imán on/off**, enlazar/desenlazar audio,
  texto, importar audio y **grabar voz** con el micrófono.
- **Transiciones, efectos y filtros** como elementos de la línea de tiempo (clic o arrastrar desde la biblioteca).
- **Vista previa con escala real**: *Ajustar*, 25 %, 50 %, 75 %, **100 % = tamaño original del proyecto** (1 px del
  proyecto = 1 px de pantalla, como en DaVinci Resolve) y 200 %, con barras de desplazamiento para recorrerla.
- **Inspector** (estilo Concat): posición, zoom, estirado, rotación, perspectiva, velocidad, volumen, texto y las secciones:
  - **Fusión**: opacidad (con fotogramas clave), modo de fusión (Multiplicar, Trama, Superponer, Diferencia…), voltear horizontal/vertical.
  - **Quitar fondo**: eliminación *automática* (color de los bordes), *manual* (color elegido con el cuentagotas sobre la vista previa) y *croma* (verde/azul, tolerancia, suavizado y reducción de reflejo).
  - **Máscara**: lineal, espejo, círculo, rectángulo, corazón y estrella.
  - **Recortar**: izquierda, arriba, derecha y abajo en %.
  - **Estabilizar**: análisis de movimiento de la cámara, modo *suave* o *cámara fija*, intensidad, recorte automático y zoom extra.
- **Fotogramas clave** y animaciones de entrada/salida.
- **Menú Escala**: 100 %, 125 % o 150 % para **toda la interfaz**.
- **Temas** y **modos de estudio** (distribuciones de paneles), barras de desplazamiento que siguen el tema.
- **Archivo** (estilo Concat): abrir proyecto, importar, guardar, exportar, plantillas, vaciar caché, ajustes,
  cerrar proyecto y salir.
- **Exportación** de video con resolución y formato de aspecto configurables (16:9, 9:16, 1:1).
- Autoguardado con los medios incluidos (IndexedDB) y archivos de proyecto `.erizo` portables.

## Cómo usarlo

1. Descarga o clona el repositorio.
2. Abre `index.html` en **Chrome, Edge o Brave** (recomendado). No necesita `npm` ni compilación.
   - Para publicarlo: *Settings → Pages* en GitHub y selecciona la rama `main` (carpeta raíz).
3. **Importar** → los archivos aparecen en la Biblioteca → **arrástralos** a una pista.
4. Corta con **S**, ajusta en el Inspector y exporta con **Ctrl + E**.

## Menú Archivo

| Opción | Qué hace |
|---|---|
| Añadir la selección a la línea de tiempo | Coloca en el cabezal los medios seleccionados en la biblioteca |
| Abrir proyecto… (Ctrl+O) | Abre un archivo `.erizo` |
| Importar medios… (Ctrl+I) | Agrega archivos a la biblioteca |
| Guardar (Ctrl+S) | Descarga el proyecto como `.erizo` (con sus medios) |
| Exportar… (Ctrl+E) | Abre el diálogo de exportación de video |
| Guardar como plantilla… / Aplicar plantilla… | Guarda/aplica textos, efectos, pistas y formato (sin medios) |
| Vaciar la caché del proyecto | Limpia historial de deshacer, miniaturas y copias sin uso; conserva el proyecto |
| Ajustes… (Ctrl+,) | Escala de la interfaz, autoguardado, duración de imágenes, imán, paneles y atajos |
| Cerrar proyecto | Borra el proyecto y el autoguardado |
| Salir | Guarda y cierra (si el navegador no lo permite, muestra un aviso) |

## Atajos

| Tecla | Acción |
|---|---|
| Espacio | Reproducir / pausar |
| **S** | Dividir en el cabezal. Con selección corta solo lo seleccionado; si nada seleccionado cruza el cabezal, corta todos los clips bajo él |
| Q / W | Recortar inicio / final hasta el cabezal |
| Supr · Mayús+Supr | Borrar · borrar cerrando el hueco |
| V / H | Herramienta selección / mano |
| N | Imán de la línea de tiempo |
| M | Magnetizar al centro (vista previa) |
| Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| Ctrl+C / X / V · Ctrl+A | Copiar / cortar / pegar · seleccionar todo |
| Ctrl+Shift+L | Enlazar / desenlazar audio y video |
| Ctrl + rueda | Zoom de la línea de tiempo (o de la vista previa sobre ella) |
| Doble clic en una pista | Renombrar |
| Clic derecho en una pista | Renombrar, ocultar, agregar o eliminar |

## Estructura

```
index.html          Interfaz
css/                main.css (base) · workspace.css (paneles, temas, componentes)
js/
  editor.js         Núcleo: clips, línea de tiempo, reproducción, exportación
  media.js          Biblioteca de medios (pool), arrastre a la línea de tiempo, grabación de voz
  library.js        Panel Biblioteca
  tltools.js        Barra de herramientas, corte, recortes, mano, imán
  effects.js        Catálogo de transiciones/efectos/filtros
  fxtimeline.js     Efectos como elementos de la línea de tiempo
  tracks.js         Pistas y menú de clic derecho
  project.js        Autoguardado, archivos .erizo, caché
  archivo.js        Menú Archivo, plantillas, ajustes, salir
  scale.js          Escala de la interfaz y de la vista previa
  look.js           Motor de fusión, recorte, máscara, croma y estabilización (vista previa y exportación)
  stab.js           Análisis de movimiento para estabilizar
  inspector.js      Secciones del Inspector (Fusión, Quitar fondo, Máscara, Recortar, Estabilizar)
  workspace.js · themes.js · settings.js · anim.js · keyframes.js · magnet.js · textfx.js · perspective.js · inputs.js
```

## Limitaciones conocidas

- **Texto a voz**: no está incluido. Los navegadores permiten *leer* texto en voz alta, pero no capturar ese audio
  para guardarlo o exportarlo, así que no se podía integrar de forma honesta. Alternativa: grabar tu voz con 🎤.
- **Salir** y **Cerrar pestaña**: por seguridad, un sitio web no siempre puede cerrar su propia pestaña.
- La exportación se graba en tiempo real con `MediaRecorder` (WebM); un video de 1 minuto tarda ~1 minuto.
- Los filtros en la exportación requieren un navegador con `CanvasRenderingContext2D.filter` (Chrome/Edge/Firefox; no Safari).
- La escala de la interfaz usa `zoom` de CSS: probada en Chromium.

- **Quitar fondo** no usa IA: separa por color. Funciona bien con fondos uniformes (pantalla verde/azul o fondos lisos).
- **Estabilizar** compensa solo desplazamiento (no rotación ni perspectiva) y rinde mejor con temblor de mano que con paneos largos.
  Si combinas Estabilizar con Recortar/Máscara, la ventana de recorte se mueve junto con la imagen.
- El análisis de estabilización recorre el clip en tiempo real aproximado (unos segundos por cada 10 s de video).

## Contribuir

Los *issues* y *pull requests* son bienvenidos. El proyecto es JavaScript sin dependencias: edita los archivos y
recarga la página. Elige y agrega la licencia que prefieras (por ejemplo MIT) antes de publicarlo.
