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
  $('#catalogo').innerHTML = Object.entries(F.escenas).map(([tipo, def]) => `<div class="item">
      <code>${esc(def.ejemplo || `[${tipo}]`)}</code>
      <p>${esc(def.descripcion || '')}</p>
      <button data-tipo="${esc(tipo)}" title="Añadir al final del guion">+ Insertar</button>
    </div>`).join('');
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
    musica = { url, el, ganancia, destino };
    $('#musica-nombre').textContent = archivo.name.length > 18 ? archivo.name.slice(0, 16) + '…' : archivo.name;
    $('#quitar-musica').hidden = false;
  });
  $('#quitar-musica').addEventListener('click', quitarMusica);

  // ---------- Exportar ----------

  let grabadora = null;
  let trozos = [];

  function formato() {
    const opciones = [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return opciones.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  }

  function bloquear(si) {
    grabando = si;
    for (const id of ['#exportar', '#play', '#tiempo', '#guion', '#ejemplo', '#estilo', '#musica', '#quitar-musica']) $(id).disabled = si;
  }

  $('#exportar').addEventListener('click', () => {
    if (!plan.total) return estado('Escribe un guion primero.', true);
    const tipo = formato();
    if (!tipo) return estado('Tu navegador no puede grabar video. Prueba con Chrome, Edge o Firefox actualizados.', true);

    pausar();
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
    grabadora.onstop = () => terminarArchivo(tipo, flujo);
    bloquear(true);
    $('#resultado').hidden = true;
    estado('🔴 Grabando en tiempo real… no cambies de pestaña ni minimices la ventana.');
    t = 0;
    grabadora.start(500);
    reproducir();
  });

  function terminarGrabacion() {
    reproduciendo = false;
    $('#play').textContent = '▶';
    if (musica) musica.el.pause();
    // Un instante extra para que el último cuadro llegue a la grabadora.
    setTimeout(() => grabadora && grabadora.state !== 'inactive' && grabadora.stop(), 300);
  }

  function terminarArchivo(tipo, flujo) {
    flujo.getVideoTracks().forEach((p) => p.stop());
    if (musica) {
      musica.ganancia.gain.cancelScheduledValues(audio.currentTime);
      musica.ganancia.gain.setValueAtTime(1, audio.currentTime);
    }
    const blob = new Blob(trozos, { type: tipo.split(';')[0] });
    const ext = tipo.startsWith('video/mp4') ? 'mp4' : 'webm';
    const nombre = (plan.titulo || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'video';
    const url = URL.createObjectURL(blob);
    const enlace = $('#descargar');
    if (enlace.href.startsWith('blob:')) URL.revokeObjectURL(enlace.href);
    enlace.href = url;
    enlace.download = `${nombre}.${ext}`;
    $('#resultado-video').src = url;
    $('#resultado').hidden = false;
    enlace.click();
    bloquear(false);
    estado(ext === 'mp4'
      ? `✅ Listo: ${nombre}.mp4 (${(blob.size / 1048576).toFixed(1)} MB)`
      : `✅ Listo: ${nombre}.webm. Tu navegador no graba MP4; TikTok y YouTube aceptan WebM, o conviértelo en tu editor.`);
    grabadora = null;
  }

  // ---------- Inicio ----------

  let guardado = null;
  try { guardado = localStorage.getItem(CLAVE); } catch (e) { /* almacenamiento no disponible */ }
  editor.value = guardado || window.FabricaEjemplos[0].guion;
  actualizar();
  // Si la fuente tarda en cargar, se redibuja cuando esté lista.
  if (document.fonts) document.fonts.ready.then(pintar);
})();
