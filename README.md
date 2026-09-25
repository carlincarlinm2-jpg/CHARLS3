# 🧠 Cerebro

Tu segundo cerebro local. Cada app, artefacto, proyecto, nota, enlace, persona o video es un **nodo**, y los conectas entre sí para ver cómo se relaciona todo en un grafo interactivo. También incluye un **publicador de video**: subes el video una vez, lo abres en Filmora para ponerle música y lo mandas a TikTok, YouTube, Instagram y Facebook.

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
data/              tus datos (ignorados por git)
```

Variables opcionales: `PORT` (por defecto 4321), `HOST` y `BRAIN_DATA_DIR`.
