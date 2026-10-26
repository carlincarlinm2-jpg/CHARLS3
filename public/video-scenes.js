// Estilos y tipos de escena de la Fábrica de videos.
// Para crear un tipo nuevo: Fabrica.escena('nombre', { descripcion, ejemplo, dibujar }).
// dibujar(ctx, E, s, t, p) recibe la escena `s` ({ valor, op, texto }), los segundos
// `t` desde que empezó y su avance `p` (0→1). E trae la paleta (E.c) y utilidades.
(function () {
  'use strict';

  const F = window.Fabrica;
  const CX = F.W / 2;
  const CY = 1080; // centro visual de las escenas (los subtítulos van arriba)

  // ---------- Estilos ----------

  F.estilo('neon', {
    nombre: 'Neón azul',
    fondo1: '#050a18', fondo2: '#0b1a3c', acento: '#38c8ff', acento2: '#ffb347',
    peligro: '#ff4d6d', exito: '#3ee6a0', texto: '#ffffff', claro: '#ffffff',
    tenue: '#7d8bb0', rejilla: '#2f74ff', particula: '#9fd8ff',
  });
  F.estilo('magma', {
    nombre: 'Magma',
    fondo1: '#100307', fondo2: '#2b0a12', acento: '#ff7a3d', acento2: '#ffd166',
    peligro: '#ff3d6e', exito: '#7ee081', texto: '#fff6ef', claro: '#ffffff',
    tenue: '#a8807a', rejilla: '#ff3d6e', particula: '#ffb38a',
  });
  F.estilo('menta', {
    nombre: 'Menta',
    fondo1: '#03120e', fondo2: '#06291f', acento: '#3ef0b4', acento2: '#d2ff5e',
    peligro: '#ff5d6c', exito: '#3ef0b4', texto: '#f2fffa', claro: '#ffffff',
    tenue: '#6f9d8f', rejilla: '#1fbf8f', particula: '#a6ffe0',
  });
  F.estilo('violeta', {
    nombre: 'Violeta',
    fondo1: '#0a0618', fondo2: '#1c0f3d', acento: '#b18cff', acento2: '#ff8bd1',
    peligro: '#ff5d7a', exito: '#59e3b5', texto: '#ffffff', claro: '#ffffff',
    tenue: '#8a80b0', rejilla: '#7a4dff', particula: '#d5c4ff',
  });

  // ---------- Piezas compartidas ----------

  // Anillos de órbita en perspectiva alrededor de un objeto.
  function anillos(ctx, E, x, y, r, t, k) {
    ctx.save();
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const giro = t * (0.5 + i * 0.3) + i * 1.3;
      ctx.strokeStyle = E.alfa(i ? E.c.acento2 : E.c.acento, 0.5 * k);
      ctx.setLineDash([22, 18]);
      ctx.lineDashOffset = -t * 60 * (i ? -1 : 1);
      ctx.beginPath();
      ctx.ellipse(x, y, r * (1 + i * 0.18) * k, r * 0.28 * k, giro * 0.15 - 0.2 + i * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Anillo holográfico que barre el objeto de lado a lado.
  function escaner(ctx, E, x, y, r, t, k) {
    const fase = Math.sin(t * 1.8);
    const px = x + fase * r * 0.9;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.shadowColor = E.c.acento;
    ctx.shadowBlur = 30;
    ctx.strokeStyle = E.alfa(E.c.acento, 0.9);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(px, y, 34, r * 1.05, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = E.alfa(E.c.claro, 0.8);
    ctx.beginPath();
    ctx.ellipse(px, y, 16, r * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function pulso(ctx, E, x, y, r, t, k) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const f = ((t * 0.6 + i / 3) % 1);
      ctx.strokeStyle = E.alfa(E.c.acento, (1 - f) * 0.6 * k);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.6 + f * 0.9), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  const EFECTOS = { orbita: anillos, escaner, pulso, ninguno: () => {} };

  // Objeto flotando con halo, piso y efecto.
  function objeto(ctx, E, s, t, x, y, tam, retraso = 0) {
    const k = E.aparecer(t, retraso, 0.6);
    if (k <= 0) return;
    const flota = Math.sin(t * 1.6 + x) * 16;
    E.piso(x, y + tam * 0.62, tam * 0.75, E.c.acento, k);
    E.halo(x, y, tam * 1.05 * k, E.c.acento, 0.32);
    const efecto = EFECTOS[E.normal(s.op.efecto || 'orbita')] || anillos;
    efecto(ctx, E, x, y + flota, tam * 0.85, t, k);
    ctx.save();
    ctx.globalAlpha *= k;
    E.emoji(s.valor || '✨', x, y + flota, tam * (0.6 + 0.4 * E.easeBack(k)), tam * 2);
    ctx.restore();
  }

  // ---------- Escenas ----------

  F.escena('objeto', {
    descripcion: 'Un emoji u objeto grande flotando con halo. Efectos: orbita, escaner, pulso, ninguno.',
    ejemplo: '[objeto: 🦟 | etiqueta: macho | efecto: escaner]',
    dibujar(ctx, E, s, t) {
      objeto(ctx, E, s, t, CX, CY, 420);
      E.etiqueta(s.op.etiqueta, CX, CY + 360, E.c[s.op.color] || E.c.acento, E.aparecer(t, 0.45, 0.4));
    },
  });

  F.escena('titulo', {
    descripcion: 'Frase gancho en letras gigantes. Ideal para el primer segundo.',
    ejemplo: '[titulo: ¿Por qué a ti sí? | icono: 🦟]',
    dibujar(ctx, E, s, t) {
      const k = E.aparecer(t, 0, 0.5);
      if (s.op.icono) {
        ctx.save();
        ctx.globalAlpha *= k;
        E.halo(CX, CY - 260, 300, E.c.acento, 0.35);
        E.emoji(s.op.icono, CX, CY - 260 + Math.sin(t * 2) * 12, 260);
        ctx.restore();
      }
      ctx.save();
      ctx.font = E.fuente(900, 120);
      const lineas = E.lineas((s.valor || '').toUpperCase(), 900);
      const y0 = CY + (s.op.icono ? 40 : -((lineas.length - 1) * 130) / 2);
      lineas.forEach((l, i) => {
        const ki = E.aparecer(t, 0.1 + i * 0.12, 0.45);
        ctx.save();
        ctx.globalAlpha *= ki;
        ctx.translate(0, (1 - ki) * 40);
        E.texto(l, CX, y0 + i * 130, { tam: 120, peso: 900, ancho: 960 });
        ctx.restore();
      });
      // Subrayado que se dibuja de izquierda a derecha.
      const sub = E.aparecer(t, 0.4, 0.6);
      const yLinea = y0 + (lineas.length - 1) * 130 + 95;
      ctx.shadowColor = E.c.acento;
      ctx.shadowBlur = 24;
      ctx.fillStyle = E.c.acento;
      E.rectRedondo(CX - 260, yLinea, 520 * sub, 12, 6);
      ctx.fill();
      ctx.restore();
    },
  });

  F.escena('numero', {
    descripcion: 'Un número que cuenta hasta su valor (acepta ×, %, m, $…).',
    ejemplo: '[numero: ×100 | icono: 🦟 | etiqueta: la favorita]',
    dibujar(ctx, E, s, t) {
      const m = String(s.valor).match(/^(.*?)(\d+(?:[.,]\d+)?)(.*)$/);
      let texto = s.valor;
      if (m) {
        const decimales = (m[2].split(/[.,]/)[1] || '').length;
        const sep = m[2].includes(',') ? ',' : '.';
        const n = parseFloat(m[2].replace(',', '.')) * E.easeOut(t / 1.3);
        texto = m[1] + n.toFixed(decimales).replace('.', sep) + m[3];
      }
      const k = E.aparecer(t, 0, 0.4);
      const y = s.op.icono ? CY + 60 : CY;
      if (s.op.icono) objeto(ctx, E, { valor: s.op.icono, op: { efecto: 'pulso' } }, t, CX, CY - 290, 230);
      E.halo(CX, y, 520, E.c.acento2, 0.25 * k);
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = E.fuente(900, 300);
      const w = ctx.measureText(texto).width;
      if (w > 960) ctx.font = E.fuente(900, Math.floor(300 * 960 / w));
      const g = ctx.createLinearGradient(0, y - 150, 0, y + 150);
      g.addColorStop(0, E.c.claro);
      g.addColorStop(1, E.c.acento2);
      ctx.shadowColor = E.c.acento2;
      ctx.shadowBlur = 50;
      ctx.fillStyle = g;
      ctx.fillText(texto, CX, y);
      ctx.restore();
      E.etiqueta(s.op.etiqueta, CX, y + 230, E.c.acento2, E.aparecer(t, 0.9, 0.4));
    },
  });

  F.escena('vs', {
    descripcion: 'Comparación de dos cosas. Etiquetas separadas con "/". ganador: a o b.',
    ejemplo: '[vs: 🧍 vs 🧍‍♀️ | etiqueta: 0 picaduras / 20 picaduras | ganador: b]',
    dibujar(ctx, E, s, t, p) {
      const [a, b] = String(s.valor || '? vs ?').split(/\s+vs\s+/i);
      const [ea, eb] = String(s.op.etiqueta || '').split('/').map((x) => x.trim());
      const gana = E.normal(s.op.ganador || '');
      const destaca = E.aparecer(t, s.dur * 0.45, 0.5);
      const lados = [[a, ea, 290, 'a', 0], [b, eb, 790, 'b', 0.25]];
      for (const [obj, et, x, id, retraso] of lados) {
        const pierde = gana && gana !== id;
        ctx.save();
        ctx.globalAlpha *= pierde ? 1 - 0.55 * destaca : 1;
        if (gana === id) E.halo(x, CY, 380 * destaca, E.c.acento2, 0.45);
        objeto(ctx, E, { valor: obj, op: { efecto: 'ninguno' } }, t, x, CY, 280, retraso);
        E.etiqueta(et, x, CY + 270, gana === id ? E.c.acento2 : E.c.acento, E.aparecer(t, 0.5 + retraso, 0.4));
        ctx.restore();
      }
      const kv = E.aparecer(t, 0.35, 0.35);
      ctx.save();
      ctx.globalAlpha *= kv;
      ctx.translate(CX, CY);
      ctx.scale(E.lerp(1.6, 1, E.easeBack(kv)), E.lerp(1.6, 1, E.easeBack(kv)));
      E.texto('VS', 0, 0, { tam: 90, peso: 900, color: E.c.acento });
      ctx.restore();
    },
  });

  F.escena('lista', {
    descripcion: 'Puntos que aparecen uno por uno. Sepáralos con ";".',
    ejemplo: '[lista: 🌡️ Calor; 💨 CO2; 👃 Olor]',
    dibujar(ctx, E, s, t) {
      const items = String(s.valor).split(';').map((x) => x.trim()).filter(Boolean).slice(0, 6);
      const alto = 150;
      const y0 = CY - ((items.length - 1) * alto) / 2;
      const paso = Math.max(0.35, (s.dur - 0.8) / Math.max(1, items.length));
      items.forEach((it, i) => {
        const k = E.aparecer(t, 0.2 + i * paso, 0.45);
        if (k <= 0) return;
        const y = y0 + i * alto;
        ctx.save();
        ctx.globalAlpha *= k;
        ctx.translate((1 - k) * -120, 0);
        E.rectRedondo(110, y - 58, 860, 116, 26);
        ctx.fillStyle = E.alfa(E.c.fondo2, 0.75);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = E.alfa(E.c.acento, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(180, y, 38, 0, Math.PI * 2);
        ctx.fillStyle = E.c.acento;
        ctx.shadowColor = E.c.acento;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
        E.texto(String(i + 1), 180, y + 2, { tam: 44, peso: 900, color: E.c.fondo1, sombra: false });
        E.texto(it, 250, y + 2, { tam: 54, peso: 700, alinear: 'left', ancho: 690 });
        ctx.restore();
      });
    },
  });

  F.escena('mito', {
    descripcion: 'Una creencia que se tacha y se marca como MITO. verdad: lo que sí es cierto.',
    ejemplo: '[mito: sangre dulce | icono: 🩸 | verdad: es tu olor]',
    dibujar(ctx, E, s, t, p) {
      const icono = s.op.icono;
      if (icono) objeto(ctx, E, { valor: icono, op: { efecto: 'ninguno' } }, t, CX, CY - 250, 300);
      const y = icono ? CY + 110 : CY - 60;
      const k = E.aparecer(t, 0.15, 0.4);
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.font = E.fuente(900, 84);
      const txt = String(s.valor).toUpperCase();
      const w = Math.min(900, ctx.measureText(txt).width + 80);
      E.rectRedondo(CX - w / 2, y - 70, w, 140, 26);
      ctx.fillStyle = E.alfa(E.c.fondo1, 0.85);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = E.alfa(E.c.peligro, 0.8);
      ctx.stroke();
      E.texto(txt, CX, y + 4, { tam: 84, peso: 900, ancho: w - 60 });
      // Tachón.
      const tacha = E.aparecer(t, s.dur * 0.3, 0.35);
      ctx.strokeStyle = E.c.peligro;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.shadowColor = E.c.peligro;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(CX - w / 2 + 20, y + 6);
      ctx.lineTo(CX - w / 2 + 20 + (w - 40) * tacha, y + 6);
      ctx.stroke();
      ctx.restore();
      // Sello "MITO".
      const sello = E.aparecer(t, s.dur * 0.3 + 0.3, 0.3);
      if (sello > 0) {
        ctx.save();
        ctx.globalAlpha *= sello;
        ctx.translate(CX + w / 2 - 70, y - 90);
        ctx.rotate(-0.22);
        ctx.scale(E.lerp(2, 1, E.easeBack(sello)), E.lerp(2, 1, E.easeBack(sello)));
        E.rectRedondo(-120, -48, 240, 96, 14);
        ctx.fillStyle = E.c.peligro;
        ctx.fill();
        E.texto('MITO', 0, 4, { tam: 62, peso: 900, color: '#ffffff', sombra: false });
        ctx.restore();
      }
      if (s.op.verdad) {
        const kv = E.aparecer(t, s.dur * 0.55, 0.45);
        ctx.save();
        ctx.globalAlpha *= kv;
        ctx.translate(0, (1 - kv) * 30);
        E.texto('✓ ' + s.op.verdad.toUpperCase(), CX, y + 190, { tam: 64, peso: 900, color: E.c.exito });
        ctx.restore();
      }
    },
  });

  F.escena('barras', {
    descripcion: 'Gráfica de barras que crecen. Formato "nombre: número" separados con ";".',
    ejemplo: '[barras: Tú: 85; Tu pareja: 15 | unidad: %]',
    dibujar(ctx, E, s, t) {
      const datos = String(s.valor).split(';').map((x) => {
        const i = x.lastIndexOf(':');
        return { nombre: x.slice(0, i).trim(), n: parseFloat(x.slice(i + 1).replace(',', '.')) || 0 };
      }).filter((d) => d.nombre).slice(0, 6);
      if (!datos.length) return;
      const max = Math.max(...datos.map((d) => d.n), 1);
      const colores = [E.c.acento, E.c.acento2, E.c.exito, E.c.peligro];
      const alto = 170;
      const y0 = CY - ((datos.length - 1) * alto) / 2;
      const unidad = s.op.unidad || '';
      datos.forEach((d, i) => {
        const k = E.aparecer(t, 0.2 + i * 0.25, 1.1);
        const y = y0 + i * alto;
        const col = colores[i % colores.length];
        E.texto(d.nombre, 120, y - 48, { tam: 44, peso: 700, alinear: 'left', color: E.c.texto, ancho: 700 });
        E.rectRedondo(120, y - 8, 840, 56, 28);
        ctx.fillStyle = E.alfa(E.c.tenue, 0.18);
        ctx.fill();
        const w = Math.max(56, 840 * (d.n / max) * k);
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = 26;
        E.rectRedondo(120, y - 8, w, 56, 28);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.restore();
        const valor = (d.n * k).toFixed(Number.isInteger(d.n) ? 0 : 1) + unidad;
        E.texto(valor, 960, y - 48, { tam: 46, peso: 900, alinear: 'right', color: col });
      });
    },
  });

  F.escena('globo', {
    descripcion: 'Planeta de puntos girando, con señales que se encienden. pines: cuántas.',
    ejemplo: '[globo | pines: 6 | etiqueta: todo el mundo]',
    dibujar(ctx, E, s, t) {
      const k = E.aparecer(t, 0, 0.7);
      const R = 330 * E.lerp(0.7, 1, E.easeOut(k));
      E.halo(CX, CY, R * 1.6, E.c.acento, 0.4 * k);
      ctx.save();
      ctx.globalAlpha *= k;
      // Esfera de puntos (espiral de Fibonacci) con "continentes" simulados.
      const N = 2600;
      const giro = t * 0.35;
      const oro = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const lon = i * oro;
        const lat = Math.asin(y);
        const tierra = Math.sin(lon * 2.1) * Math.cos(lat * 3.2) + Math.sin(lon * 3.7 + 1) * 0.6 + Math.cos(lat * 5.1) * 0.3;
        const a = lon + giro;
        const z = Math.cos(a) * r;
        if (z < -0.1) continue;
        const px = CX + Math.sin(a) * r * R;
        const py = CY - y * R;
        const luz = 0.2 + 0.8 * Math.max(0, z);
        if (tierra > 0.2) {
          ctx.fillStyle = E.alfa(E.c.particula, 0.35 + 0.65 * luz);
          ctx.beginPath();
          ctx.arc(px, py, 3 + 2.5 * luz, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = E.alfa(E.c.acento, 0.12 + 0.2 * luz); // océano: puntos tenues
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = E.alfa(E.c.acento, 0.5);
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.stroke();
      // Señales que se encienden en la cara visible.
      const pines = Math.min(20, parseInt(s.op.pines, 10) || 0);
      const rnd = E.aleatorio(42);
      for (let i = 0; i < pines; i++) {
        const lon = rnd() * Math.PI * 2;
        const y = rnd() * 1.4 - 0.7;
        const r = Math.sqrt(1 - y * y);
        const a = lon + giro;
        if (Math.cos(a) < 0.15) continue;
        const px = CX + Math.sin(a) * r * R;
        const py = CY - y * R;
        const f = (t * 0.8 + i * 0.37) % 1;
        ctx.strokeStyle = E.alfa(E.c.acento2, 1 - f);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 8 + f * 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = E.c.acento2;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      E.etiqueta(s.op.etiqueta, CX, CY + R + 110, E.c.acento, E.aparecer(t, 0.6, 0.4));
    },
  });

  F.escena('cierre', {
    descripcion: 'Final para compartir: icono que late y botón de seguir con tu marca.',
    ejemplo: '[cierre: 📤 | etiqueta: sígueme para más]',
    dibujar(ctx, E, s, t) {
      const k = E.aparecer(t, 0, 0.5);
      const late = 1 + 0.06 * Math.sin(t * 6);
      pulso(ctx, E, CX, CY - 80, 260, t, k);
      E.halo(CX, CY - 80, 380, E.c.acento, 0.4 * k);
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate(CX, CY - 80);
      ctx.scale(late, late);
      E.emoji(s.valor || '📤', 0, 0, 300);
      ctx.restore();
      E.etiqueta(s.op.etiqueta || 'Sígueme para más', CX, CY + 260, E.c.acento2, E.aparecer(t, 0.4, 0.4));
    },
  });
})();
