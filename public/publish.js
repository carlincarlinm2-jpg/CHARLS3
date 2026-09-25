// Publicador de video: sube el video una vez, ábrelo en tu editor (Filmora) para
// añadir música y lánzalo a tus redes con el texto ya copiado.
(function () {
  'use strict';

  const C = window.Cerebro;
  const $ = (sel) => document.querySelector(sel);
  const dialog = $('#publish');
  let video = null; // { name, path?, objectUrl }

  const byTag = (tag) => C.state.data.nodes.filter((n) => n.tags.some((t) => t.toLowerCase() === tag));
  const destinations = () => byTag('publicar');
  const editors = () => byTag('editor');

  function caption() {
    const text = $('#pub-caption').value.trim();
    const tags = $('#pub-tags').value.trim().split(/[\s,]+/).filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : '#' + t)).join(' ');
    return [text, tags].filter(Boolean).join('\n\n');
  }

  function setStatus(msg, isError) {
    const el = $('#pub-status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }

  function renderTargets() {
    const dests = destinations();
    $('#pub-targets').innerHTML = dests.length
      ? dests.map((n) => `<label class="target">
          <input type="checkbox" value="${C.esc(n.id)}" ${n.url ? 'checked' : 'disabled'}>
          <span class="dot" style="background:${C.colorOf(n)}"></span>${C.esc(n.title)}
          ${n.url ? '' : '<span class="muted">(sin enlace)</span>'}
        </label>`).join('')
      : '<p class="muted">No tienes redes marcadas con la etiqueta <b>publicar</b>.</p>';

    const eds = editors();
    const ed = eds.find((n) => n.url) || eds[0];
    const btn = $('#pub-edit');
    btn.textContent = `✂️ Editar en ${ed ? ed.title : 'editor'} (música, cortes…)`;
    btn.dataset.editor = ed ? ed.id : '';
    $('#pub-edit-help').textContent = !ed
      ? 'Añade tu editor como nodo con la etiqueta "editor".'
      : !ed.url
        ? `Escribe la ruta de ${ed.title} en su nodo para poder abrirlo desde aquí.`
        : C.Store.mode !== 'archivo'
          ? 'Inicia Cerebro con "npm start" para abrir apps del equipo.'
          : '';
    $('#pub-add-workflow').hidden = dests.length > 0 && eds.length > 0;
  }

  function reset() {
    if (video && video.objectUrl) URL.revokeObjectURL(video.objectUrl);
    video = null;
    $('#pub-file').value = '';
    $('#pub-preview').hidden = true;
    $('#pub-preview').removeAttribute('src');
    $('#pub-drop-label').textContent = 'Arrastra aquí tu video o haz clic para elegirlo';
    $('#pub-title').value = '';
    $('#pub-caption').value = '';
    $('#pub-tags').value = '';
    $('#pub-music').value = '';
    $('#pub-links').innerHTML = '';
    setStatus('');
  }

  function uploadToServer(file) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'api/media?name=' + encodeURIComponent(file.name));
      xhr.setRequestHeader('X-Brain', '1');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setStatus(`Subiendo… ${Math.round((e.loaded / e.total) * 100)}%`);
      };
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status === 200) resolve(body);
          else reject(new Error(body.error || xhr.statusText));
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('Error de red'));
      xhr.send(file);
    });
  }

  async function pickFile(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setStatus('Ese archivo no parece un video.', true);
      return;
    }
    if (video && video.objectUrl) URL.revokeObjectURL(video.objectUrl);
    video = { name: file.name, objectUrl: URL.createObjectURL(file) };
    const preview = $('#pub-preview');
    preview.src = video.objectUrl;
    preview.hidden = false;
    $('#pub-drop-label').textContent = file.name;
    if (!$('#pub-title').value) $('#pub-title').value = file.name.replace(/\.[^.]+$/, '');

    if (C.Store.mode === 'archivo') {
      try {
        const saved = await uploadToServer(file);
        video.path = saved.path;
        setStatus('Video guardado en ' + saved.path);
      } catch (err) {
        setStatus('No se pudo guardar el video: ' + err.message, true);
      }
    } else {
      setStatus('Modo navegador: el video no se guarda en disco. Usa "npm start" para guardarlo y abrir Filmora.');
    }
  }

  async function openInEditor() {
    const editor = C.nodeById($('#pub-edit').dataset.editor);
    if (!editor || !editor.url) {
      if (editor) C.focus(editor.id);
      dialog.close();
      return;
    }
    if (!video || !video.path) {
      setStatus('Primero elige un video (y usa "npm start" para que se guarde).', true);
      return;
    }
    try {
      if (C.isLocalPath(editor.url)) await C.openLocal(editor.url, video.path);
      else C.openUrl(editor.url);
      const music = $('#pub-music').value.trim();
      setStatus(`Abriendo ${editor.title}…${music ? ' Recuerda añadir: ' + music : ''} Cuando exportes, vuelve y elige el video final.`);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  async function publish() {
    const chosen = [...document.querySelectorAll('#pub-targets input:checked')].map((i) => C.nodeById(i.value)).filter(Boolean);
    if (!chosen.length) {
      setStatus('Elige al menos una red.', true);
      return;
    }
    const text = caption();
    let copied = false;
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch { /* sin permiso de portapapeles */ }
    }

    // El navegador solo permite abrir una pestaña por clic; el resto quedan como botones.
    C.openUrl(chosen[0].url);
    $('#pub-links').innerHTML = chosen.map((n, i) => `<button type="button" data-open="${C.esc(n.id)}">
        ${i === 0 ? '✓ ' : ''}Abrir ${C.esc(n.title)}</button>`).join('');

    if (video && video.path) {
      fetch('api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Brain': '1' },
        body: JSON.stringify({ file: video.path, reveal: true }),
      }).catch(() => {});
    }

    // Registra la publicación en el cerebro, conectada a cada red.
    const music = $('#pub-music').value.trim();
    const node = C.addNode({
      type: 'video',
      title: $('#pub-title').value.trim() || (video ? video.name : 'Video'),
      url: video && video.path ? video.path : '',
      tags: $('#pub-tags').value.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean),
      description: [text, music ? 'Música: ' + music : '', 'Publicado: ' + new Date().toLocaleString()].filter(Boolean).join('\n\n'),
    });
    for (const dest of chosen) {
      C.state.data.links.push({ id: C.uid(), source: node.id, target: dest.id, label: 'publicado en' });
    }
    const editor = C.nodeById($('#pub-edit').dataset.editor);
    if (editor) C.state.data.links.push({ id: C.uid(), source: node.id, target: editor.id, label: 'editado en' });
    C.persist();
    C.renderAll();

    setStatus([
      copied ? 'Texto y hashtags copiados: pégalos (Ctrl/Cmd+V) en la descripción.' : '',
      video && video.path ? 'Se abrió la carpeta del video: arrástralo a la página de subida.' : 'Sube el video en la página que se abrió.',
      chosen.length > 1 ? 'Usa los botones para abrir las demás redes.' : '',
    ].filter(Boolean).join(' '));
  }

  // ---------- Eventos ----------
  $('#btn-publish').addEventListener('click', () => {
    renderTargets();
    dialog.showModal();
  });
  $('#pub-close').addEventListener('click', () => dialog.close());
  $('#pub-reset').addEventListener('click', reset);
  $('#pub-file').addEventListener('change', (e) => pickFile(e.target.files[0]));
  const drop = $('#pub-drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    pickFile(e.dataTransfer.files[0]);
  });
  $('#pub-edit').addEventListener('click', openInEditor);
  $('#pub-go').addEventListener('click', publish);
  $('#pub-links').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    const n = btn && C.nodeById(btn.dataset.open);
    if (!n) return;
    C.openUrl(n.url);
    btn.textContent = '✓ Abrir ' + n.title;
  });
  $('#pub-add-workflow').addEventListener('click', () => {
    const count = C.addVideoWorkflow();
    renderTargets();
    setStatus(count ? `Añadidos ${count} nodos: Flow, Filmora y redes.` : 'Ya los tenías.');
  });
})();
