// Interfaz de la Fábrica de videos: editor, vista previa, música y exportación.
(function () {
  'use strict';

  const F = window.Fabrica;
  const $ = (sel) => document.querySelector(sel);
  const CLAVE = 'fabrica.guion';

  const editor = $('#guion');
  const lienzo = $('#lienzo');
  lienzo.width = F.W;
  lienzo.height = F.H;
  const ctx = lienzo.getContext('2d');

  let plan = F.parsear('');
  let t = 0;
  let reproduciendo = false;
  let relojBase = 0;
  let grabando = false;
  let musica = null; // { url, el, ganancia, destino }
  let audio = null; // AudioContext, se crea al primer uso (los navegadores lo exigen tras un clic)

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function estado(msg, error) {
    $('#estado').textContent = msg || '';
    $('#estado').classList.toggle('error', !!error);
  }

  // ---------- Guion ----------

  function guardar() {
    try { localStorage.setItem(CLAVE, editor.value); } catch (e) { /* almacenamiento no disponible */ }
  }

  function actualizar() {
    plan = F.parsear(editor.value);
    t = Math.min(t, plan.total);
    $('#tiempo').max = Math.max(0.01, plan.total);
    $('#estilo').value = F.estilos[plan.estilo] ? plan.estilo : 'neon';
    $('#avisos').innerHTML = plan.avisos.map((a) => `<li>${esc(a)}</li>`).join('');
    $('#resumen').textContent = plan.escenas.length ? `· ${plan.escenas.length} · ${mmss(plan.total)}` : '';
    $('#escenas').innerHTML = plan.escenas.map((s, i) => `<li data-i="${i}">
        <span class="tipo">${esc(s.tipo)}${s.valor ? ' · ' + esc(s.valor) : ''}</span>
        <span class="t">${mmss(s.inicio)}</span>
        <span class="txt">${esc(s.texto)}</span>
      </li>`).join('');
    pintar();
    guardar();
  }

  let espera = 0;
  editor.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(actualizar, 200);
  });

  $('#escenas').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    irA(plan.escenas[li.dataset.i].inicio + 0.5);
  });

  // El estilo vive en el propio guion (línea "estilo:"), así el texto es la única fuente.
  function cambiarEstilo(nombre) {
    const lineas = editor.value.split('\n');
    const i = lineas.findIndex((l) => /^\s*estilo\s*:/i.test(l));
    if (i >= 0) lineas[i] = `estilo: ${nombre}`;
    else {
      const titulo = lineas.findIndex((l) => l.trim().startsWith('#'));
      lineas.splice(titulo + 1, 0, `estilo: ${nombre}`);
    }
    editor.value = lineas.join('\n');
    actualizar();
  }

  $('#estilo').innerHTML = Object.entries(F.estilos)
    .map(([id, e]) => `<option value="${esc(id)}">${esc(e.nombre || id)}</option>`).join('');
  $('#estilo').addEventListener('change', (e) => cambiarEstilo(e.target.value));

  $('#ejemplo').innerHTML += window.FabricaEjemplos
    .map((ej, i) => `<option value="${i}">${esc(ej.nombre)}</option>`).join('');
  $('#ejemplo').addEventListener('change', (e) => {
    const ej = window.FabricaEjemplos[e.target.value];
    e.target.value = '';
    if (!ej) return;
    if (editor.value.trim() && !confirm('¿Reemplazar tu guion actual por el ejemplo?')) return;
    editor.value = ej.guion;
    irA(0);
    actualizar();
  });

  // Catálogo de escenas generado desde el registro: una escena nueva aparece sola aquí.
  function catalogo() {
    $('#catalogo').innerHTML = Object.entries(F.escenas).map(([tipo, def]) => `<div class="item">
        <code>${esc(def.ejemplo || `[${tipo}]`)}</code>
        <p>${esc(def.descripcion || '')}</p>
        <button data-tipo="${esc(tipo)}" title="Añadir al final del guion">+ Insertar</button>
      </div>`).join('');
  }
  catalogo();
  // El motor 3D se carga después (es un módulo): al estar listo, se redibuja todo.
  window.addEventListener('fabrica3d', () => { catalogo(); pintar(); });
  $('#catalogo').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tipo]');
    if (!b) return;
    const def = F.escenas[b.dataset.tipo];
    editor.value = editor.value.replace(/\s*$/, '') + `\n\n${def.ejemplo || `[${b.dataset.tipo}]`}\nTu texto aquí.\n`;
    actualizar();
    editor.focus();
    editor.scrollTop = editor.scrollHeight;
  });

  // ---------- Vista previa ----------

  function pintar() {
    // En pausa al inicio se muestra un cuadro ya animado como portada, no el fondo vacío.
    F.dibujar(ctx, plan, !reproduciendo && t === 0 ? Math.min(1.5, plan.total) : t);
    $('#tiempo').value = t;
    $('#reloj').textContent = `${mmss(t)} / ${mmss(plan.total)}`;
    const activa = plan.escenas.length ? F.escenaEn(plan, t) : -1;
    document.querySelectorAll('#escenas li').forEach((li, i) => li.classList.toggle('activa', i === activa));
  }

  function irA(seg) {
    t = Math.max(0, Math.min(seg, plan.total));
    relojBase = performance.now() - t * 1000;
    if (musica) musica.el.currentTime = t % (musica.el.duration || Infinity);
    pintar();
  }

  function cuadro(ahora) {
    if (!reproduciendo) return;
    t = (ahora - relojBase) / 1000;
    if (t >= plan.total) {
      t = plan.total;
      pintar();
      if (grabando) terminarGrabacion();
      else pausar();
      return;
    }
    pintar();
    requestAnimationFrame(cuadro);
  }

  function reproducir() {
    if (!plan.total) return;
    if (t >= plan.total - 0.05) t = 0;
    reproduciendo = true;
    relojBase = performance.now() - t * 1000;
    $('#play').textContent = '⏸';
    if (musica) {
      musica.el.currentTime = t % (musica.el.duration || Infinity);
      audio.resume();
      musica.el.play().catch(() => {});
    }
    requestAnimationFrame(cuadro);
  }

  function pausar() {
    reproduciendo = false;
    $('#play').textContent = '▶';
    if (musica) musica.el.pause();
  }

  $('#play').addEventListener('click', () => (reproduciendo ? pausar() : reproducir()));
  $('#tiempo').addEventListener('input', (e) => irA(parseFloat(e.target.value)));
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target === editor || grabando) return;
    e.preventDefault();
    reproduciendo ? pausar() : reproducir();
  });

  // ---------- Música ----------

  function quitarMusica() {
    if (!musica) return;
    musica.el.pause();
    URL.revokeObjectURL(musica.url);
    musica.ganancia.disconnect();
    musica = null;
    $('#musica-nombre').textContent = 'Música';
    $('#quitar-musica').hidden = true;
    $('#musica').value = '';
  }

  $('#musica').addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    quitarMusica();
    audio = audio || new AudioContext();
    const url = URL.createObjectURL(archivo);
    const el = new Audio(url);
    el.loop = true;
    const ganancia = audio.createGain();
    const destino = audio.createMediaStreamDestination();
    audio.createMediaElementSource(el).connect(ganancia);
    ganancia.connect(audio.destination);
    ganancia.connect(destino);
    musica = { url, el, ganancia, destino, archivo };
    $('#musica-nombre').textContent = archivo.name.length > 18 ? archivo.name.slice(0, 16) + '…' : archivo.name;
    $('#quitar-musica').hidden = false;
  });
  $('#quitar-musica').addEventListener('click', quitarMusica);

  // ---------- Exportar ----------
  //
  // Preferido: cuadro por cuadro con WebCodecs. No se pierde ningún cuadro aunque la
  // escena 3D sea pesada, con buena tarjeta gráfica va más rápido que el tiempo real y
  // siempre sale MP4. Si el navegador no lo tiene, se graba en tiempo real.

  let cancelar = false;
  let grabadora = null;
  let trozos = [];

  function nombreArchivo() {
    return (plan.titulo || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'video';
  }

  function bloquear(si) {
    grabando = si;
    for (const id of ['#play', '#tiempo', '#guion', '#ejemplo', '#estilo', '#musica', '#quitar-musica', '#calidad']) $(id).disabled = si;
    $('#exportar').textContent = si ? '✕ Cancelar' : '⬇ Exportar video';
    if (F.motor3d) F.motor3d.ponerEscala(si ? 1 : calidad());
  }

  function entregar(blob, ext) {
    const nombre = nombreArchivo();
    const url = URL.createObjectURL(blob);
    const enlace = $('#descargar');
    if (enlace.href.startsWith('blob:')) URL.revokeObjectURL(enlace.href);
    enlace.href = url;
    enlace.download = `${nombre}.${ext}`;
    $('#resultado-video').src = url;
    $('#resultado').hidden = false;
    enlace.click();
    estado(ext === 'mp4'
      ? `✅ Listo: ${nombre}.mp4 (${(blob.size / 1048576).toFixed(1)} MB)`
      : `✅ Listo: ${nombre}.webm. Tu navegador no graba MP4; TikTok y YouTube aceptan WebM, o conviértelo en tu editor.`);
  }

  async function configVideo() {
    if (!window.VideoEncoder || !window.Mp4Muxer) return null;
    for (const [codec, caja] of [['avc1.640034', 'avc'], ['avc1.4d0034', 'avc'], ['vp09.00.40.08', 'vp9'], ['av01.0.08M.08', 'av1']]) {
      const config = { codec, width: F.W, height: F.H, bitrate: 14e6, framerate: F.FPS };
      try {
        if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, caja };
      } catch (e) { /* códec no disponible: probar el siguiente */ }
    }
    return null;
  }

  async function configAudio(muestras, canales) {
    if (!window.AudioEncoder) return null;
    for (const [codec, caja] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const config = { codec, sampleRate: muestras, numberOfChannels: canales, bitrate: 192000 };
      try {
        if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, caja };
      } catch (e) { /* probar el siguiente */ }
    }
    return null;
  }

  async function exportarCuadros(video) {
    let pista = null;
    let audioCfg = null;
    if (musica) {
      const datos = await audio.decodeAudioData(await musica.archivo.arrayBuffer());
      audioCfg = await configAudio(datos.sampleRate, Math.min(2, datos.numberOfChannels));
      pista = audioCfg ? datos : null;
    }
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: video.caja, width: F.W, height: F.H, frameRate: F.FPS },
      audio: pista ? { codec: audioCfg.caja, sampleRate: pista.sampleRate, numberOfChannels: audioCfg.config.numberOfChannels } : undefined,
      fastStart: 'in-memory',
    });
    let fallo = null;
    const ve = new VideoEncoder({ output: (c, meta) => muxer.addVideoChunk(c, meta), error: (e) => { fallo = e; } });
    ve.configure(video.config);
    const n = Math.ceil(plan.total * F.FPS);
    const inicio = performance.now();
    for (let i = 0; i < n; i++) {
      if (cancelar) { ve.close(); return null; }
      if (fallo) throw fallo;
      t = i / F.FPS;
      F.dibujar(ctx, plan, t);
      const cuadro = new VideoFrame(lienzo, { timestamp: Math.round(i * 1e6 / F.FPS), duration: Math.round(1e6 / F.FPS) });
      ve.encode(cuadro, { keyFrame: i % (F.FPS * 2) === 0 });
      cuadro.close();
      while (ve.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
      if (i % 15 === 0) {
        const pasado = (performance.now() - inicio) / 1000;
        const falta = i ? pasado / i * (n - i) : 0;
        estado(`⏳ Exportando… ${Math.round(i / n * 100)} %${i > 30 ? ` · faltan ~${mmss(falta)}` : ''}`);
        $('#tiempo').value = t;
        await new Promise((r) => setTimeout(r));
      }
    }
    await ve.flush();
    ve.close();
    if (pista) {
      const ae = new AudioEncoder({ output: (c, meta) => muxer.addAudioChunk(c, meta), error: (e) => { fallo = e; } });
      ae.configure(audioCfg.config);
      const sr = pista.sampleRate;
      const canales = audioCfg.config.numberOfChannels;
      const total = Math.round(plan.total * sr);
      const fuente = Array.from({ length: canales }, (_, c) => pista.getChannelData(Math.min(c, pista.numberOfChannels - 1)));
      // La música se repite si es corta y se desvanece en los últimos 1.5 s.
      for (let ini = 0; ini < total; ini += sr) {
        const len = Math.min(sr, total - ini);
        const datos = new Float32Array(len * canales);
        for (let c = 0; c < canales; c++) {
          for (let j = 0; j < len; j++) {
            const k = ini + j;
            const fade = Math.min(1, (total - k) / (1.5 * sr));
            datos[c * len + j] = fuente[c][k % pista.length] * fade;
          }
        }
        const trozo = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: canales, timestamp: Math.round(ini * 1e6 / sr), data: datos });
        ae.encode(trozo);
        trozo.close();
      }
      await ae.flush();
      ae.close();
    }
    if (fallo) throw fallo;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }

  function formatoTiempoReal() {
    const opciones = [
      'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
    ];
    return opciones.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  }

  function exportarTiempoReal(tipo) {
    const flujo = lienzo.captureStream(F.FPS);
    if (musica) {
      audio.resume();
      const ahora = audio.currentTime;
      musica.ganancia.gain.cancelScheduledValues(ahora);
      musica.ganancia.gain.setValueAtTime(1, ahora);
      // Baja la música en los últimos 1.5 s para que no corte de golpe.
      musica.ganancia.gain.setValueAtTime(1, ahora + Math.max(0, plan.total - 1.5));
      musica.ganancia.gain.linearRampToValueAtTime(0, ahora + plan.total);
      musica.destino.stream.getAudioTracks().forEach((pista) => flujo.addTrack(pista));
    }
    trozos = [];
    grabadora = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 12e6 });
    grabadora.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
    grabadora.onstop = () => {
      flujo.getVideoTracks().forEach((p) => p.stop());
      if (musica) {
        musica.ganancia.gain.cancelScheduledValues(audio.currentTime);
        musica.ganancia.gain.setValueAtTime(1, audio.currentTime);
      }
      if (!cancelar) entregar(new Blob(trozos, { type: tipo.split(';')[0] }), tipo.startsWith('video/mp4') ? 'mp4' : 'webm');
      else estado('Exportación cancelada.');
      grabadora = null;
      bloquear(false);
    };
    estado('🔴 Grabando en tiempo real… no cambies de pestaña ni minimices la ventana.');
    t = 0;
    grabadora.start(500);
    reproducir();
  }

  function terminarGrabacion() {
    reproduciendo = false;
    $('#play').textContent = '▶';
    if (musica) musica.el.pause();
    // Un instante extra para que el último cuadro llegue a la grabadora.
    setTimeout(() => grabadora && grabadora.state !== 'inactive' && grabadora.stop(), 300);
  }

  $('#exportar').addEventListener('click', async () => {
    if (grabando) {
      cancelar = true;
      if (grabadora) terminarGrabacion();
      return;
    }
    if (!plan.total) return estado('Escribe un guion primero.', true);
    pausar();
    cancelar = false;
    $('#resultado').hidden = true;
    bloquear(true);
    const video = await configVideo();
    if (!video) {
      const tipo = formatoTiempoReal();
      if (!tipo) {
        bloquear(false);
        return estado('Tu navegador no puede grabar video. Prueba con Chrome, Edge o Firefox actualizados.', true);
      }
      return exportarTiempoReal(tipo);
    }
    try {
      const blob = await exportarCuadros(video);
      if (blob) entregar(blob, 'mp4');
      else estado('Exportación cancelada.');
    } catch (err) {
      console.error(err);
      estado(`No se pudo exportar: ${err.message}`, true);
    }
    bloquear(false);
    irA(0);
  });

  // ---------- Calidad de la vista previa ----------

  const CLAVE_CALIDAD = 'fabrica.calidad';
  function calidad() { return parseFloat($('#calidad').value) || 0.6; }
  try { $('#calidad').value = localStorage.getItem(CLAVE_CALIDAD) || '0.6'; } catch (e) { /* sin almacenamiento */ }
  $('#calidad').addEventListener('change', () => {
    try { localStorage.setItem(CLAVE_CALIDAD, $('#calidad').value); } catch (e) { /* sin almacenamiento */ }
    if (F.motor3d) F.motor3d.ponerEscala(calidad());
    pintar();
  });
  window.addEventListener('fabrica3d', () => { if (F.motor3d) F.motor3d.ponerEscala(calidad()); pintar(); });

  // ---------- Inicio ----------

  let guardado = null;
  try { guardado = localStorage.getItem(CLAVE); } catch (e) { /* almacenamiento no disponible */ }
  editor.value = guardado || window.FabricaEjemplos[0].guion;
  actualizar();
  // Si la fuente tarda en cargar, se redibuja cuando esté lista.
  if (document.fonts) document.fonts.ready.then(pintar);
})();
