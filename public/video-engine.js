// Fábrica de videos: convierte un guion de texto en un video vertical animado
// con subtítulos palabra por palabra. Sin dependencias: todo se dibuja en <canvas>.
//
// Las escenas y los estilos se registran con Fabrica.escena() y Fabrica.estilo(),
// así que para un nuevo tipo de video basta con añadir una función de dibujo.
(function () {
  'use strict';

  const W = 1080;
  const H = 1920;
  const FPS = 30;
  const TRANSICION = 0.35; // segundos de mezcla entre escenas
  const FUENTE = '"Montserrat", "Poppins", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const FUENTE_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  const escenas = {}; // tipo → { descripcion, ejemplo, dibujar(ctx, E, s, t, p) }
  const estilos = {}; // nombre → paleta

  function escena(tipo, def) { escenas[tipo] = def; }
  function estilo(nombre, def) { estilos[nombre] = def; }

  // ---------- Guion → plan ----------

  // "Duración" → "duracion": las opciones se escriben como uno quiera.
  const normalizar = (s) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function directiva(src) {
    const [cabeza, ...resto] = src.split('|');
    const i = cabeza.indexOf(':');
    const s = {
      tipo: normalizar(i < 0 ? cabeza : cabeza.slice(0, i)),
      valor: i < 0 ? '' : cabeza.slice(i + 1).trim(),
      op: {},
      texto: '',
    };
    for (const parte of resto) {
      const j = parte.indexOf(':');
      if (j > 0) s.op[normalizar(parte.slice(0, j))] = parte.slice(j + 1).trim();
    }
    return s;
  }

  function parsear(texto) {
    const plan = { titulo: '', estilo: 'neon', marca: '', velocidad: 1, escenas: [], avisos: [] };
    let actual = null;
    for (const linea of String(texto).split(/\r?\n/)) {
      const l = linea.trim();
      if (!l || l.startsWith('//')) continue;
      if (l.startsWith('#')) { plan.titulo = l.replace(/^#+\s*/, ''); continue; }
      const dir = l.match(/^\[(.*)\]$/);
      if (dir) {
        actual = directiva(dir[1]);
        if (!escenas[actual.tipo]) plan.avisos.push(`Escena desconocida "${actual.tipo}": se dibuja como "objeto".`);
        plan.escenas.push(actual);
        continue;
      }
      const op = !actual && l.match(/^(estilo|marca|velocidad)\s*:\s*(.+)$/i);
      if (op) {
        const clave = normalizar(op[1]);
        const valor = op[2].trim();
        if (clave === 'velocidad') plan.velocidad = Math.min(3, Math.max(0.3, parseFloat(valor) || 1));
        else if (clave === 'estilo') {
          plan.estilo = normalizar(valor);
          if (!estilos[plan.estilo]) plan.avisos.push(`Estilo desconocido "${valor}": se usa "neon".`);
        } else plan.marca = valor;
        continue;
      }
      if (!actual) { actual = directiva('objeto'); plan.escenas.push(actual); }
      actual.texto += (actual.texto ? ' ' : '') + l;
    }
    tiempos(plan);
    return plan;
  }

  // Separa el texto en palabras; lo que va entre *asteriscos* queda resaltado.
  function palabras(texto) {
    const out = [];
    let resaltar = false;
    for (const token of texto.split(/\s+/).filter(Boolean)) {
      let w = token;
      const abre = w.startsWith('*');
      if (abre) { resaltar = true; w = w.slice(1); }
      const cierra = /\*[.,;:!?…"»)]*$/.test(w);
      w = w.replace(/\*/g, '');
      if (w) out.push({ texto: w, clave: resaltar });
      if (cierra) resaltar = false;
    }
    return out;
  }

  // Sin voz, el ritmo sale de la lectura: palabras largas y signos de pausa duran más.
  function tiempos(plan) {
    let t = 0;
    for (const s of plan.escenas) {
      s.palabras = palabras(s.texto);
      let d = 0.25;
      for (const p of s.palabras) {
        p.inicio = d;
        const letras = p.texto.replace(/[^\p{L}\p{N}]/gu, '').length;
        d += (0.17 + 0.045 * letras) / plan.velocidad;
        p.fin = d;
        if (/[.!?…]$/.test(p.texto)) d += 0.35 / plan.velocidad;
        else if (/[,;:]$/.test(p.texto)) d += 0.15 / plan.velocidad;
      }
      d += 0.6;
      const fija = parseFloat(s.op.duracion);
      s.dur = fija > 0 ? fija : Math.max(2.5, d);
      if (fija > 0) {
        const k = s.dur / d;
        for (const p of s.palabras) { p.inicio *= k; p.fin *= k; }
      }
      s.grupos = agrupar(s.palabras);
      s.inicio = t;
      t += s.dur;
    }
    plan.total = t;
  }

  // Bloques cortos de subtítulo (como en TikTok): máximo 4 palabras o 22 letras,
  // y siempre se corta después de un signo de puntuación.
  function agrupar(lista) {
    const grupos = [];
    let g = null;
    for (const p of lista) {
      const largo = g ? g.palabras.reduce((n, x) => n + x.texto.length + 1, 0) : 0;
      if (!g || g.palabras.length >= 4 || largo + p.texto.length > 22) {
        g = { palabras: [] };
        grupos.push(g);
      }
      g.palabras.push(p);
      if (/[.,;:!?…]$/.test(p.texto)) g = null;
    }
    for (const x of grupos) x.inicio = x.palabras[0].inicio;
    return grupos;
  }

  // ---------- Utilidades de dibujo ----------

  function aleatorio(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const easeInOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeBack = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  function alfa(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function rectRedondo(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Herramientas que reciben todas las escenas (E).
  function herramientas(ctx, c) {
    const E = {
      W, H, c, ctx, clamp, lerp, easeOut, easeInOut, easeBack, alfa, aleatorio, normal: normalizar,
      fuente: (peso, tam) => `${peso} ${tam}px ${FUENTE}`,

      // 0→1 suavizado entre `retraso` y `retraso + dur` segundos de la escena.
      aparecer: (t, retraso = 0, dur = 0.5) => easeOut((t - retraso) / dur),

      halo(x, y, r, color, intensidad = 0.4) {
        if (r <= 0) return;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, alfa(color, intensidad));
        g.addColorStop(0.45, alfa(color, intensidad * 0.35));
        g.addColorStop(1, alfa(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      },

      // Emoji o texto grande, reducido si no cabe en `ancho`.
      emoji(texto, x, y, tam, ancho = 900) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${tam}px ${FUENTE_EMOJI}`;
        const w = ctx.measureText(texto).width;
        if (w > ancho) ctx.font = `${Math.floor(tam * ancho / w)}px ${FUENTE_EMOJI}`;
        ctx.fillStyle = c.texto;
        ctx.fillText(texto, x, y);
        ctx.restore();
      },

      texto(txt, x, y, { tam = 64, peso = 800, color = c.texto, ancho = 940, alinear = 'center', sombra = true } = {}) {
        ctx.save();
        ctx.textAlign = alinear;
        ctx.textBaseline = 'middle';
        ctx.font = E.fuente(peso, tam);
        const w = ctx.measureText(txt).width;
        if (w > ancho) ctx.font = E.fuente(peso, Math.floor(tam * ancho / w));
        if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; }
        ctx.fillStyle = color;
        ctx.fillText(txt, x, y);
        ctx.restore();
      },

      // Corta un texto en líneas que quepan en `ancho` con la fuente actual de ctx.
      lineas(txt, ancho) {
        const out = [];
        let linea = '';
        for (const w of txt.split(/\s+/)) {
          const prueba = linea ? linea + ' ' + w : w;
          if (linea && ctx.measureText(prueba).width > ancho) { out.push(linea); linea = w; } else linea = prueba;
        }
        if (linea) out.push(linea);
        return out;
      },

      // Etiqueta tipo "píldora" con borde brillante: "0 PICADURAS", "MACHO", "×100"…
      etiqueta(txt, x, y, color = c.acento, k = 1) {
        if (!txt || k <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp(k);
        ctx.font = E.fuente(800, 46);
        const t = txt.toUpperCase();
        const w = ctx.measureText(t).width + 56;
        const h = 82;
        const s = lerp(0.7, 1, easeBack(k));
        ctx.translate(x, y);
        ctx.scale(s, s);
        rectRedondo(ctx, -w / 2, -h / 2, w, h, 18);
        ctx.fillStyle = alfa(c.fondo1, 0.82);
        ctx.fill();
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, 0, 3);
        ctx.restore();
      },

      // Sombra/reflejo elíptico en el piso bajo un objeto.
      piso(x, y, rx, color = c.acento, k = 1) {
        ctx.save();
        ctx.globalAlpha *= 0.55 * k;
        ctx.translate(x, y);
        ctx.scale(1, 0.22);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, alfa(color, 0.5));
        g.addColorStop(1, alfa(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      rectRedondo: (x, y, w, h, r) => rectRedondo(ctx, x, y, w, h, r),
    };
    return E;
  }

  // ---------- Fondo, subtítulos y marca ----------

  const PARTICULAS = (() => {
    const r = aleatorio(7);
    return Array.from({ length: 80 }, () => ({
      x: r() * W, y: r() * H, v: 8 + r() * 30, tam: 1.5 + r() * 3.5, fase: r() * 6.28,
    }));
  })();

  function fondo(ctx, E, t) {
    const { c } = E;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.fondo1);
    g.addColorStop(1, c.fondo2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    E.halo(W / 2, 1080, 900, c.acento, 0.13);

    // Piso cuadriculado en perspectiva que avanza despacio hacia la cámara.
    const horizonte = 1300;
    const fuga = W / 2;
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = -12; i <= 12; i++) {
      ctx.strokeStyle = alfa(c.rejilla, 0.16 * (1 - Math.abs(i) / 14));
      ctx.beginPath();
      ctx.moveTo(fuga + i * 20, horizonte);
      ctx.lineTo(fuga + i * 330, H + 40);
      ctx.stroke();
    }
    const N = 16;
    for (let i = 0; i < N; i++) {
      const z = N - ((i + t * 0.45) % N); // 16 (lejos) … 0 (cerca)
      if (z < 0.6) continue;
      const y = horizonte + 640 / z;
      if (y > H) continue;
      ctx.strokeStyle = alfa(c.rejilla, clamp(0.28 / Math.sqrt(z), 0, 0.22));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // Partículas que suben y titilan.
    for (const p of PARTICULAS) {
      const y = ((p.y - t * p.v) % H + H) % H;
      const brillo = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.fase));
      ctx.fillStyle = alfa(c.particula, brillo);
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(t * 0.5 + p.fase) * 14, y, p.tam, 0, Math.PI * 2);
      ctx.fill();
    }

    // Viñeta: oscurece los bordes para centrar la mirada.
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function subtitulos(ctx, E, s, t) {
    const grupos = s.grupos;
    if (!grupos.length) return;
    let gi = 0;
    while (gi + 1 < grupos.length && grupos[gi + 1].inicio <= t) gi++;
    const g = grupos[gi];
    const tam = 68;
    const lineaAlto = 92;
    const anchoMax = 920;
    ctx.save();
    ctx.font = E.fuente(800, tam);
    const espacio = tam * 0.34;
    const margen = 16; // aire extra a cada lado de una palabra resaltada, para su recuadro

    // Acomoda las palabras del bloque en una o dos líneas centradas.
    const lineas = [[]];
    let ancho = 0;
    for (const p of g.palabras) {
      const w = ctx.measureText(p.texto).width;
      const caja = w + (p.clave ? margen * 2 : 0);
      if (ancho && ancho + espacio + caja > anchoMax) { lineas.push([]); ancho = 0; }
      lineas[lineas.length - 1].push({ p, w, caja });
      ancho += (ancho ? espacio : 0) + caja;
    }
    const y0 = 360 - (lineas.length - 1) * lineaAlto / 2;
    const entrada = E.aparecer(t, g.inicio - 0.05, 0.18);
    ctx.globalAlpha = gi === 0 ? Math.max(entrada, 0.0001) : 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    lineas.forEach((fila, li) => {
      const total = fila.reduce((n, x) => n + x.caja, 0) + espacio * (fila.length - 1);
      let x = W / 2 - total / 2;
      const y = y0 + li * lineaAlto;
      for (const { p, w, caja } of fila) {
        const dicha = t >= p.inicio;
        const actual = dicha && t < p.fin + 0.05;
        const pop = actual ? 1 + 0.04 * Math.sin(clamp((t - p.inicio) / (p.fin - p.inicio)) * Math.PI) : 1;
        ctx.save();
        ctx.translate(x + caja / 2, y);
        ctx.scale(pop, pop);
        if (p.clave && dicha) {
          const k = E.aparecer(t, p.inicio, 0.2);
          rectRedondo(ctx, -w / 2 - margen + 2, -tam * 0.62, w + margen * 2 - 4, tam * 1.24, 14);
          ctx.fillStyle = alfa(E.c.acento, 0.18 * k);
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = alfa(E.c.acento, k);
          ctx.shadowColor = E.c.acento;
          ctx.shadowBlur = 20 * k;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.shadowColor = 'rgba(0,0,0,.7)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = dicha ? (p.clave ? E.c.claro : E.c.texto) : E.c.tenue;
        ctx.fillText(p.texto, -w / 2, 2);
        ctx.restore();
        x += caja + espacio;
      }
    });
    ctx.restore();
  }

  function marca(ctx, E, texto) {
    if (!texto) return;
    ctx.save();
    ctx.globalAlpha = 0.75;
    E.texto(texto, W - 60, H - 170, { tam: 34, peso: 700, alinear: 'right', ancho: 600 });
    ctx.restore();
  }

  // ---------- Fotograma ----------

  function escenaEn(plan, t) {
    let i = 0;
    while (i + 1 < plan.escenas.length && plan.escenas[i + 1].inicio <= t) i++;
    return i;
  }

  function dibujarEscena(ctx, E, s, t, opacidad, zoom) {
    const def = escenas[s.tipo] || escenas.objeto;
    ctx.save();
    ctx.globalAlpha = opacidad;
    ctx.translate(W / 2, 1080);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -1080);
    def.dibujar(ctx, E, s, t, clamp(t / s.dur));
    ctx.restore();
  }

  function dibujar(ctx, plan, t) {
    const E = herramientas(ctx, estilos[plan.estilo] || estilos.neon);
    t = clamp(t, 0, Math.max(0, plan.total - 1 / FPS));
    fondo(ctx, E, t);
    if (!plan.escenas.length) {
      E.texto('Escribe tu guion para empezar', W / 2, H / 2, { tam: 56, color: E.c.tenue });
      return;
    }
    const i = escenaEn(plan, t);
    const s = plan.escenas[i];
    const local = t - s.inicio;
    if (i > 0 && local < TRANSICION) {
      const k = easeInOut(local / TRANSICION);
      const prev = plan.escenas[i - 1];
      dibujarEscena(ctx, E, prev, prev.dur + local, 1 - k, 1 + 0.05 * k);
      dibujarEscena(ctx, E, s, local, k, lerp(1.06, 1, k));
    } else {
      dibujarEscena(ctx, E, s, local, 1, i === 0 ? lerp(1.06, 1, easeOut(local / 0.6)) : 1);
    }
    subtitulos(ctx, E, s, local);
    marca(ctx, E, plan.marca);
  }

  window.Fabrica = {
    W, H, FPS, escenas, estilos, escena, estilo, parsear, dibujar, escenaEn,
  };
})();
