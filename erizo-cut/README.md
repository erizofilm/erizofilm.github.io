# 🦔 Erizo Cut

Editor de video no lineal que corre 100 % en el navegador (sin dependencias ni build).

## Estructura

```
erizo-cut/
├── index.html
├── css/
│   ├── main.css          # Estilos base
│   └── workspace.css     # Espacios y paneles
└── js/
    ├── perspective.js    # Perspectiva 3D (preview + export)
    ├── inputs.js         # Campos numéricos flexibles (permiten "-")
    ├── editor.js         # Núcleo: timeline, clips, texto, export
    └── workspace.js      # Sistema de paneles
```

## Uso local

Abre `index.html` en el navegador, o sirve la carpeta con `python3 -m http.server 8000`.

## Paneles

- 6 espacios (2 filas × 3). Cada espacio aloja uno de los 5 paneles: Biblioteca, Vista previa, Inspector, Fotogramas clave y Línea de tiempo.
- Cambia el panel de un espacio con su selector, o arrastra la cabecera sobre otro espacio para intercambiarlos.
- 🔒 bloquea un espacio: no se puede mover, reemplazar ni quitar (sí redimensionar).
- ✕ quita el espacio; **＋** al final de la fila lo vuelve a agregar.
- Arrastra las barras entre espacios para extender o reducir; doble clic las restablece.
- Menú **Paneles**: mostrar/ocultar paneles y espacios, preset «6 paneles (3×2)» y restablecer.
- La disposición se guarda en `localStorage`.

## Publicar en GitHub Pages

Sube la carpeta a un repositorio → Settings → Pages → Deploy from branch → `main` / root.
