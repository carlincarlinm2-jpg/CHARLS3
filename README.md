# 🧠 Cerebro

Tu segundo cerebro local. Cada app, artefacto, proyecto, nota, enlace, persona o video es un **nodo**, y los conectas entre sí para ver cómo se relaciona todo en un grafo interactivo. También incluye una **fábrica de videos** que convierte un guion en un video animado con subtítulos, y un **publicador de video**: subes el video una vez, lo abres en Filmora para ponerle música y lo mandas a TikTok, YouTube, Instagram y Facebook.

Sin dependencias, sin nube y sin cuentas: tus datos se quedan en tu equipo.

## Cómo iniciarlo

Necesitas [Node.js](https://nodejs.org) 18 o superior.

```bash
npm start
```

Abre **http://localhost:4321**. Todo se guarda en `data/brain.json` (y una copia en `data/brain.backup.json`). Los videos subidos van a `data/media/`.

> También puedes abrir `public/index.html` directamente en el navegador. En ese caso los datos se guardan solo en ese navegador y no se pueden abrir apps del equipo (Filmora, carpetas…).

## Uso del grafo

| Acción | Cómo |
| --- | --- |
| Crear un nodo | **+ Nuevo**, tecla `N`, o doble clic en un espacio vacío. Si hay un nodo seleccionado, el nuevo nace conectado a él. |
| Editar | Clic en un nodo: se abre el panel de la derecha. |
| Conectar | Toca un nodo → **🔗 Conectar con…** → toca en la lista todo lo que quieras conectar (tocar otra vez lo desconecta). Puedes escribir una relación opcional, p. ej. "usa" o "prompts para". |
| Conexión rápida | Escribe `[[Título de otro nodo]]` en la descripción (se ve como línea discontinua). |
| Abrir | Doble clic en el nodo o botón **Abrir**. Funciona con URLs y con rutas locales (apps, carpetas, archivos). |
| Guardar un enlace | Pega una URL en cualquier parte de la página. |
| Buscar | `/` y escribe; `Enter` salta al primer resultado. |
| Filtrar | Pulsa los tipos de la barra de filtros para ocultarlos o mostrarlos. |
| Copias de seguridad | **Exportar** / **Importar** en JSON. |

## Publicar un video (Flow → Filmora → redes)

1. Crea tu clip en **Flow** (el nodo ya tiene su enlace).
2. Pulsa **📤 Publicar video** y arrastra el video. Se guarda en `data/media/`.
3. **✂️ Editar en Filmora** abre Filmora con ese video para que le pongas música o cortes. Antes, escribe en el nodo *Filmora* la ruta del programa en tu equipo, por ejemplo:
   - Windows: `C:\Program Files\Wondershare\Wondershare Filmora\Wondershare Filmora.exe`
   - Mac: `/Applications/Wondershare Filmora.app`

   (La ruta exacta depende de tu versión; búscala en tu equipo.) Cuando exportes desde Filmora, vuelve a elegir el video final.
4. Escribe la descripción y los hashtags, marca las redes y pulsa **🚀 Publicar**. Cerebro:
   - copia la descripción y los hashtags al portapapeles,
   - abre la página de subida de la primera red (las demás quedan como botones, porque el navegador solo deja abrir una pestaña por clic),
   - abre la carpeta del video para que lo arrastres a la página,
   - y guarda el video como nodo, conectado a las redes donde lo publicaste.

Cualquier nodo con la etiqueta `publicar` aparece como red de destino, y cualquiera con la etiqueta `editor` como editor. Así puedes añadir X, Threads, CapCut, etc.

### ¿Por qué no publica 100 % solo?

Publicar sin abrir la página necesita las APIs oficiales de cada red (por ejemplo la *Content Posting API* de TikTok o la *YouTube Data API*). Todas piden registrar una app de desarrollador, iniciar sesión con OAuth y, en TikTok, pasar una revisión antes de poder publicar en público. Cerebro te deja justo antes de ese paso: la página de subida abierta, el texto copiado y el archivo a mano. Si más adelante consigues esas credenciales, se puede añadir la publicación automática al servidor.

## Crear un video (Fábrica de videos)

Pulsa **🎬 Crear video** (o abre `http://localhost:4321/video.html`). Escribes un guion y la Fábrica genera un video vertical 9:16 animado, estilo "dato curioso": fondo oscuro con neón, objetos flotando, etiquetas y subtítulos que se iluminan palabra por palabra. No necesita voz: el ritmo sale de la lectura.

```text
# ¿Por qué los mosquitos te pican solo a ti?
estilo: neon
marca: @tuusuario

[titulo: ¿Por qué a ti sí? | icono: 🦟]
¿Por qué los mosquitos te *acribillan* a ti?

[numero: ×100 | etiqueta: la favorita]
La persona favorita atraía *cien veces* más mosquitos.
```

- `[tipo: valor | opción: valor]` empieza una escena; las líneas de abajo son sus subtítulos.
- `*palabra*` la resalta con un recuadro.
- Al inicio: `estilo:` (neon, magma, menta, violeta), `marca:` y `velocidad:` (1 = normal, más alto = más rápido).
- Cualquier escena acepta `duracion: 4`.

Escenas incluidas: `titulo`, `objeto` (efectos `orbita`, `escaner`, `pulso`), `numero`, `vs`, `lista`, `mito`, `barras`, `globo` y `cierre`. La propia página trae el catálogo con ejemplos y tres guiones de muestra.

**🎵 Música** añade una pista de fondo (se repite y se desvanece al final). **⬇ Exportar video** graba el video en tiempo real (MP4 en Chrome/Edge/Safari, WebM en Firefox): no cambies de pestaña mientras graba. Luego súbelo con **📤 Publicar video**.

### Añadir un tipo de escena o un estilo

Todo está en `public/video-scenes.js`:

```js
Fabrica.escena('miescena', {
  descripcion: 'Qué hace',
  ejemplo: '[miescena: valor | etiqueta: algo]',
  dibujar(ctx, E, s, t, p) {
    // s.valor, s.op.etiqueta… · t = segundos desde que empezó · p = avance 0→1
    E.emoji(s.valor, E.W / 2, 1080, 400);
    E.etiqueta(s.op.etiqueta, E.W / 2, 1440, E.c.acento, E.aparecer(t, 0.4));
  },
});

Fabrica.estilo('miestilo', { nombre: 'Mi estilo', fondo1: '#000000', /* …misma paleta que "neon" */ });
```

La escena aparece sola en el catálogo de la página.

## Seguridad

- El servidor solo escucha en `127.0.0.1` y rechaza peticiones con otro `Host` (protege contra *DNS rebinding*).
- Las escrituras y los lanzamientos de apps exigen una cabecera propia, así que ninguna web externa puede usarlos.
- Solo se pueden abrir rutas que ya están guardadas en algún nodo, y solo se pasan como argumento videos de `data/media/`.

## Estructura

```
server.js          servidor local (Node, sin dependencias)
public/index.html  interfaz
public/graph.js    motor del grafo (fuerzas + canvas)
public/app.js      datos, panel, búsqueda, guardado
public/publish.js  publicador de video
public/video.html  Fábrica de videos (video-engine.js motor, video-scenes.js escenas
                   y estilos, video-ejemplos.js guiones, video-app.js interfaz)
data/              tus datos (ignorados por git)
```

Variables opcionales: `PORT` (por defecto 4321), `HOST` y `BRAIN_DATA_DIR`.
