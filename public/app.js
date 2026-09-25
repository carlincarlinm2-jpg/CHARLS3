// Cerebro: estado, almacenamiento e interfaz.
(function () {
  'use strict';

  const TYPES = {
    proyecto: { label: 'Proyecto', color: '#ff5d8f' },
    app: { label: 'App', color: '#4f9dff' },
    artefacto: { label: 'Artefacto', color: '#b67cff' },
    video: { label: 'Video', color: '#e8559b' },
    nota: { label: 'Nota', color: '#f5b83d' },
    idea: { label: 'Idea', color: '#9aa5b8' },
    enlace: { label: 'Enlace', color: '#06c28f' },
    archivo: { label: 'Archivo', color: '#ef8354' },
    persona: { label: 'Persona', color: '#39c0d8' },
  };
  const STORAGE_KEY = 'cerebro:v1';
  const WIKILINK = /\[\[([^\]\n]+)\]\]/g;

  // ---------- Utilidades ----------
  const $ = (sel) => document.querySelector(sel);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => new Date().toISOString();
  const norm = (s) => String(s || '').trim().toLowerCase();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colorOf = (node) => (TYPES[node.type] || TYPES.nota).color;
  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s).trim());

  // ---------- Almacenamiento ----------
  // Con `npm start` guarda en data/brain.json; abriendo index.html directamente, en el navegador.
  const Store = {
    mode: 'navegador',
    async load() {
      if (location.protocol.startsWith('http')) {
        try {
          const res = await fetch('api/brain', { cache: 'no-store' });
          if (res.ok) {
            this.mode = 'archivo';
            return await res.json();
          }
        } catch { /* sin servidor: seguimos en modo navegador */ }
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    async save(data) {
      const json = JSON.stringify(data);
      try { localStorage.setItem(STORAGE_KEY, json); } catch { /* sin espacio o bloqueado */ }
      if (this.mode !== 'archivo') return;
      const res = await fetch('api/brain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Brain': '1' },
        body: json,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    },
  };

  // ---------- Modelo ----------
  function normalize(raw) {
    const data = { version: 1, nodes: [], links: [] };
    if (!raw || !Array.isArray(raw.nodes)) return data;
    const ids = new Set();
    for (const n of raw.nodes) {
      if (!n || typeof n !== 'object') continue;
      const id = String(n.id || uid());
      if (ids.has(id)) continue;
      ids.add(id);
      data.nodes.push({
        id,
        type: TYPES[n.type] ? n.type : 'nota',
        title: String(n.title || 'Sin título'),
        url: String(n.url || ''),
        tags: Array.isArray(n.tags) ? n.tags.map(String).filter(Boolean) : [],
        description: String(n.description || ''),
        x: typeof n.x === 'number' ? n.x : undefined,
        y: typeof n.y === 'number' ? n.y : undefined,
        created: n.created || now(),
        updated: n.updated || n.created || now(),
      });
    }
    for (const l of Array.isArray(raw.links) ? raw.links : []) {
      if (!l || !ids.has(l.source) || !ids.has(l.target) || l.source === l.target) continue;
      data.links.push({ id: String(l.id || uid()), source: l.source, target: l.target, label: String(l.label || '') });
    }
    return data;
  }

  function seed() {
    const t = now();
    const n = (id, type, title, description, extra = {}) => ({ id, type, title, description, url: '', tags: [], created: t, updated: t, ...extra });
    return normalize({
      nodes: [
        n('centro', 'proyecto', 'Mi Cerebro',
          'Este es el centro de tu segundo cerebro.\n\nCada cosa que usas o creas —apps, artefactos, proyectos, notas, enlaces, personas— es un nodo. Conéctalos entre sí para ver cómo se relaciona todo.\n\nEscribe [[Cómo usar Cerebro]] en cualquier descripción para crear una conexión automática.',
          { tags: ['inicio'] }),
        n('guia', 'nota', 'Cómo usar Cerebro',
          '• Doble clic en un espacio vacío del grafo → nuevo nodo.\n• Clic en un nodo → editarlo en este panel.\n• Doble clic en un nodo → abre su enlace.\n• Pega una URL en cualquier parte → se guarda como enlace.\n• En "Conexiones" puedes enlazar este nodo con otro y ponerle una etiqueta.\n• Escribir [[Título de otro nodo]] también crea una conexión (línea discontinua).\n• Exporta a JSON para tener copias de seguridad.',
          { tags: ['ayuda'] }),
        n('ej-app', 'app', 'Claude', 'Asistente con el que construyo cosas. Aquí nacen muchos de mis [[Artefactos]].', { url: 'https://claude.ai', tags: ['ia'] }),
        n('ej-art', 'artefacto', 'Artefactos', 'Páginas, herramientas y prototipos que he creado. Añade cada uno como un nodo y conéctalo al proyecto al que pertenece.'),
        n('ej-repo', 'app', 'GitHub', 'Donde vive el código de mis proyectos.', { url: 'https://github.com', tags: ['código'] }),
        n('ej-idea', 'idea', 'Próxima idea', 'Anota aquí ideas sueltas y conéctalas con lo que ya existe.'),
        ...videoWorkflowNodes(t),
      ],
      links: [
        { source: 'centro', target: 'guia', label: 'empieza aquí' },
        { source: 'centro', target: 'ej-app', label: 'uso' },
        { source: 'centro', target: 'ej-repo', label: 'uso' },
        { source: 'ej-art', target: 'ej-repo', label: 'se guardan en' },
        { source: 'centro', target: 'ej-idea' },
        { source: 'centro', target: 'flujo-video', label: 'proyecto' },
        ...videoWorkflowLinks(),
      ],
    });
  }

  // Flujo de video sugerido: crear en Flow → editar/música en Filmora → publicar en redes.
  // Las redes llevan la etiqueta "publicar" y los editores "editor"; así las encuentra el publicador.
  function videoWorkflowNodes(t) {
    const n = (id, type, title, url, tags, description) => ({ id, type, title, url, tags, description, created: t, updated: t });
    return [
      n('flujo-video', 'proyecto', 'Flujo de video', '', ['video'],
        'Crear → editar → publicar.\n\n1. Genera el clip en [[Flow]].\n2. Pulsa "Publicar video" arriba y súbelo.\n3. "Editar en Filmora" para ponerle música.\n4. Elige las redes y pulsa Publicar: se copia el texto y se abren sus páginas de subida.'),
      n('flow', 'app', 'Flow', 'https://labs.google/fx/tools/flow', ['video', 'ia'], 'Generador de video con IA.'),
      n('filmora', 'app', 'Filmora', '', ['editor', 'video'],
        'Editor de video para añadir música y efectos.\n\nEscribe arriba la ruta de Filmora en tu equipo para que Cerebro pueda abrirla con tu video, por ejemplo:\n• Windows: C:\\Program Files\\Wondershare\\Wondershare Filmora\\Wondershare Filmora.exe\n• Mac: /Applications/Wondershare Filmora.app\n(La ruta exacta depende de tu versión.)'),
      n('tiktok', 'app', 'TikTok', 'https://www.tiktok.com/tiktokstudio/upload', ['publicar', 'redes'], 'Página de subida de TikTok Studio.'),
      n('youtube', 'app', 'YouTube Shorts', 'https://studio.youtube.com', ['publicar', 'redes'], 'YouTube Studio → Crear → Subir video.'),
      n('instagram', 'app', 'Instagram Reels', 'https://www.instagram.com', ['publicar', 'redes'], 'Instagram → Crear (+) → Reel.'),
      n('facebook', 'app', 'Facebook Reels', 'https://www.facebook.com/reels/create', ['publicar', 'redes'], 'Crear un reel en Facebook.'),
    ];
  }
  function videoWorkflowLinks() {
    return [
      { source: 'flujo-video', target: 'flow', label: '1. crear' },
      { source: 'flujo-video', target: 'filmora', label: '2. editar' },
      { source: 'flow', target: 'filmora', label: 'exportar a' },
      ...['tiktok', 'youtube', 'instagram', 'facebook'].map((id) => ({ source: 'filmora', target: id, label: 'publicar en' })),
    ];
  }

  // ---------- Estado ----------
  const state = {
    data: normalize(null),
    selectedId: null,
    hiddenTypes: new Set(),
    query: '',
  };

  const nodeById = (id) => state.data.nodes.find((n) => n.id === id);
  const nodeByTitle = (title) => state.data.nodes.find((n) => norm(n.title) === norm(title));

  function mentionsOf(node) {
    const out = [];
    for (const m of node.description.matchAll(WIKILINK)) out.push(m[1].trim());
    return [...new Set(out)];
  }

  // Todas las conexiones: explícitas + menciones [[...]] resueltas.
  function allEdges() {
    const edges = state.data.links.map((l) => ({ ...l, kind: 'enlace' }));
    const seen = new Set(edges.map((e) => [e.source, e.target].sort().join('|')));
    for (const node of state.data.nodes) {
      for (const title of mentionsOf(node)) {
        const target = nodeByTitle(title);
        if (!target || target.id === node.id) continue;
        const key = [node.id, target.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ id: 'm:' + key, source: node.id, target: target.id, label: '', kind: 'mencion' });
      }
    }
    return edges;
  }

  function connectionsOf(id) {
    return allEdges()
      .filter((e) => e.source === id || e.target === id)
      .map((e) => ({ edge: e, other: nodeById(e.source === id ? e.target : e.source) }))
      .filter((c) => c.other);
  }

  function matchesQuery(node) {
    const q = norm(state.query);
    if (!q) return true;
    return [node.title, node.description, node.url, node.tags.join(' '), TYPES[node.type].label].some((f) => norm(f).includes(q));
  }

  // ---------- Guardado ----------
  const statusEl = $('#save-status');
  const doSave = debounce(async () => {
    try {
      await Store.save(state.data);
      statusEl.textContent = Store.mode === 'archivo' ? 'Guardado en data/brain.json' : 'Guardado en este navegador';
    } catch (err) {
      statusEl.textContent = 'Error al guardar: ' + err.message;
    }
  }, 400);
  function persist() {
    statusEl.textContent = 'Guardando…';
    doSave();
  }

  // ---------- Grafo ----------
  let edgeSignature = '';
  const graph = new window.BrainGraph($('#graph'), {
    colorOf,
    onSelect: (id) => select(id),
    onOpen: (id) => {
      const node = nodeById(id);
      if (node && node.url) openUrl(node.url);
      else select(id);
    },
    onCreateAt: (pos) => createNode({ x: pos.x, y: pos.y }),
    onSettle: (positions) => {
      let changed = false;
      for (const p of positions) {
        const node = nodeById(p.id);
        if (!node) continue;
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        if (node.x !== x || node.y !== y) {
          node.x = x;
          node.y = y;
          changed = true;
        }
      }
      if (changed) persist();
    },
  });

  function refreshGraph(forceReheat) {
    const visible = state.data.nodes.filter((n) => !state.hiddenTypes.has(n.type));
    const ids = new Set(visible.map((n) => n.id));
    const edges = allEdges().filter((e) => ids.has(e.source) && ids.has(e.target));
    const sig = visible.map((n) => n.id).join(',') + '#' + edges.map((e) => e.source + '>' + e.target).join(',');
    const reheat = forceReheat || sig !== edgeSignature;
    edgeSignature = sig;
    graph.setData(visible, edges, reheat);
    graph.setHighlight(state.query ? new Set(visible.filter(matchesQuery).map((n) => n.id)) : null);
    graph.setSelected(state.selectedId);
  }

  // ---------- Filtros ----------
  function renderFilters() {
    const counts = {};
    for (const n of state.data.nodes) counts[n.type] = (counts[n.type] || 0) + 1;
    $('#filters').innerHTML = Object.entries(TYPES)
      .map(([key, t]) => `<button class="chip" data-type="${key}" aria-pressed="${!state.hiddenTypes.has(key)}">
          <span class="dot" style="background:${t.color}"></span>${t.label}<span class="count">${counts[key] || 0}</span>
        </button>`)
      .join('');
  }
  $('#filters').addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-type]');
    if (!chip) return;
    const type = chip.dataset.type;
    if (state.hiddenTypes.has(type)) state.hiddenTypes.delete(type);
    else state.hiddenTypes.add(type);
    renderAll();
  });

  // ---------- Lista lateral ----------
  function renderList() {
    const edges = allEdges();
    const degree = {};
    for (const e of edges) {
      degree[e.source] = (degree[e.source] || 0) + 1;
      degree[e.target] = (degree[e.target] || 0) + 1;
    }
    const items = state.data.nodes
      .filter((n) => !state.hiddenTypes.has(n.type) && matchesQuery(n))
      .sort((a, b) => b.updated.localeCompare(a.updated));
    $('#stats').textContent = `${state.data.nodes.length} nodos · ${edges.length} conexiones`;
    $('#node-list').innerHTML = items.length
      ? items.map((n) => `<li><button data-id="${esc(n.id)}" aria-current="${n.id === state.selectedId}">
            <span class="dot" style="background:${colorOf(n)}"></span>
            <span class="title">${esc(n.title)}</span>
            <span class="count" title="Conexiones">${degree[n.id] || 0}</span>
          </button></li>`).join('')
      : `<li class="empty">${state.query ? 'Nada coincide con la búsqueda.' : 'Aún no hay nodos.'}</li>`;
  }
  $('#node-list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-id]');
    if (!btn) return;
    select(btn.dataset.id);
    graph.centerOn(btn.dataset.id);
  });

  // ---------- Panel de detalle ----------
  const panel = $('#panel');

  function renderPanel() {
    const node = nodeById(state.selectedId);
    if (!node) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    panel.innerHTML = `
      <div class="panel-head">
        <span class="dot" id="p-dot" style="background:${colorOf(node)}"></span>
        <select id="p-type" aria-label="Tipo">
          ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === node.type ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <button id="p-close" title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
      </div>
      <input id="p-title" class="title-input" value="${esc(node.title)}" aria-label="Título" placeholder="Título">
      <div class="field">
        <label for="p-url">Enlace, ruta o comando</label>
        <div class="row">
          <input id="p-url" value="${esc(node.url)}" placeholder="https://…  o  /ruta/al/archivo">
          <button id="p-open" ${node.url ? '' : 'disabled'}>Abrir</button>
        </div>
      </div>
      <div class="field">
        <label for="p-tags">Etiquetas (separadas por comas)</label>
        <input id="p-tags" value="${esc(node.tags.join(', '))}" placeholder="trabajo, ia, personal">
      </div>
      <div class="field">
        <label for="p-desc">Descripción</label>
        <textarea id="p-desc" placeholder="Qué es, para qué sirve… Usa [[Título]] para conectar con otro nodo.">${esc(node.description)}</textarea>
      </div>
      <div id="p-conns"></div>
      <div class="meta">
        <span>Editado ${new Date(node.updated).toLocaleString()}</span>
        <button id="p-delete" class="danger">Eliminar</button>
      </div>`;
    renderConnections();

    const touch = () => { node.updated = now(); persist(); };
    $('#p-type').addEventListener('change', (e) => {
      node.type = e.target.value;
      $('#p-dot').style.background = colorOf(node);
      touch();
      renderFilters();
      refreshGraph();
      renderList();
    });
    $('#p-title').addEventListener('input', (e) => {
      node.title = e.target.value;
      touch();
      refreshGraph();
      renderListDebounced();
    });
    $('#p-url').addEventListener('input', (e) => {
      node.url = e.target.value.trim();
      $('#p-open').disabled = !node.url;
      touch();
    });
    $('#p-tags').addEventListener('input', (e) => {
      node.tags = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
      touch();
    });
    $('#p-desc').addEventListener('input', (e) => {
      node.description = e.target.value;
      touch();
      refreshGraph();
      renderConnectionsDebounced();
    });
    $('#p-open').addEventListener('click', () => openUrl(node.url));
    $('#p-close').addEventListener('click', () => select(null));
    $('#p-delete').addEventListener('click', () => {
      if (!confirm(`¿Eliminar "${node.title}" y sus conexiones?`)) return;
      state.data.nodes = state.data.nodes.filter((n) => n.id !== node.id);
      state.data.links = state.data.links.filter((l) => l.source !== node.id && l.target !== node.id);
      persist();
      select(null);
      renderAll();
    });
  }

  function renderConnections() {
    const node = nodeById(state.selectedId);
    const box = $('#p-conns');
    if (!node || !box) return;
    const conns = connectionsOf(node.id);
    const missing = mentionsOf(node).filter((t) => !nodeByTitle(t));
    const options = state.data.nodes
      .filter((n) => n.id !== node.id)
      .map((n) => `<option value="${esc(n.title)}"></option>`)
      .join('');

    box.innerHTML = `
      <h3>Conexiones (${conns.length})</h3>
      <ul class="conn-list">
        ${conns.map(({ edge, other }) => `<li>
          <span class="dot" style="background:${colorOf(other)}"></span>
          <button class="link conn-title" data-goto="${esc(other.id)}">${esc(other.title)}</button>
          <span class="conn-label">${edge.kind === 'mencion' ? 'mención' : esc(edge.label)}</span>
          ${edge.kind === 'enlace' ? `<button class="remove" data-unlink="${esc(edge.id)}" title="Quitar conexión" aria-label="Quitar conexión">✕</button>` : ''}
        </li>`).join('') || '<li class="conn-label">Sin conexiones todavía.</li>'}
      </ul>
      ${missing.length ? `<p class="help">Menciones sin nodo: ${missing.map((t) => `<button class="link" data-create="${esc(t)}">+ ${esc(t)}</button>`).join(' · ')}</p>` : ''}
      <form class="connect-form" id="p-connect">
        <input id="p-target" list="p-titles" placeholder="Conectar con…" aria-label="Nodo a conectar" required>
        <input id="p-label" placeholder="Relación (opcional)" aria-label="Relación">
        <button type="submit">Conectar</button>
        <datalist id="p-titles">${options}</datalist>
      </form>
      <p class="help">Si el nodo no existe, se crea como nota.</p>`;

    box.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
      select(b.dataset.goto);
      graph.centerOn(b.dataset.goto);
    }));
    box.querySelectorAll('[data-unlink]').forEach((b) => b.addEventListener('click', () => {
      state.data.links = state.data.links.filter((l) => l.id !== b.dataset.unlink);
      persist();
      refreshGraph();
      renderConnections();
      renderList();
    }));
    box.querySelectorAll('[data-create]').forEach((b) => b.addEventListener('click', () => {
      const created = addNode({ title: b.dataset.create, type: 'nota' });
      persist();
      renderAll();
      select(node.id);
      graph.centerOn(created.id);
    }));
    $('#p-connect').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const title = $('#p-target').value.trim();
      if (!title) return;
      let target = nodeByTitle(title);
      if (target && target.id === node.id) return;
      if (!target) target = addNode({ title, type: 'nota' });
      const exists = state.data.links.some((l) =>
        (l.source === node.id && l.target === target.id) || (l.source === target.id && l.target === node.id));
      if (!exists) {
        state.data.links.push({ id: uid(), source: node.id, target: target.id, label: $('#p-label').value.trim() });
      }
      node.updated = now();
      persist();
      renderFilters();
      refreshGraph();
      renderList();
      renderConnections();
      $('#p-target').focus();
    });
  }
  const renderConnectionsDebounced = debounce(renderConnections, 300);
  const renderListDebounced = debounce(renderList, 300);

  // ---------- Acciones ----------
  function addNode(fields) {
    const t = now();
    const node = { id: uid(), type: 'nota', title: 'Nuevo nodo', url: '', tags: [], description: '', created: t, updated: t, ...fields };
    state.data.nodes.push(node);
    return node;
  }

  function createNode(fields) {
    // Si hay un nodo seleccionado, el nuevo nace conectado a él.
    const parent = nodeById(state.selectedId);
    const node = addNode(fields);
    if (parent && fields.x === undefined) {
      state.data.links.push({ id: uid(), source: parent.id, target: node.id, label: '' });
    }
    persist();
    state.selectedId = node.id;
    renderAll();
    const title = $('#p-title');
    if (title) { title.focus(); title.select(); }
    return node;
  }

  function select(id) {
    state.selectedId = id && nodeById(id) ? id : null;
    graph.setSelected(state.selectedId);
    renderPanel();
    renderList();
  }

  const isLocalPath = (s) => /^(\/|~\/|[a-zA-Z]:\\)/.test(String(s).trim());

  // Pide al servidor local que abra una app o ruta del equipo (opcionalmente con un video).
  async function openLocal(target, file) {
    if (Store.mode !== 'archivo') {
      throw new Error('Para abrir apps del equipo, inicia Cerebro con "npm start".');
    }
    await Store.save(state.data); // el servidor solo abre rutas guardadas en algún nodo
    const res = await fetch('api/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Brain': '1' },
      body: JSON.stringify({ target, file }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  }

  function openUrl(url) {
    let target = url.trim();
    if (isLocalPath(target)) {
      openLocal(target).catch((err) => alert(err.message));
      return;
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(target)) target = 'https://' + target;
    window.open(target, '_blank', 'noopener');
  }

  function renderAll() {
    renderFilters();
    refreshGraph();
    renderList();
    renderPanel();
  }

  // API para otros módulos (publicador de video).
  window.Cerebro = {
    TYPES, state, Store, uid, now, esc, colorOf, nodeById,
    addNode, persist, renderAll, select, openUrl, openLocal, isLocalPath,
    focus: (id) => { select(id); graph.centerOn(id); },
    addVideoWorkflow() {
      const t = now();
      const existing = new Set(state.data.nodes.map((n) => n.id));
      const titles = new Set(state.data.nodes.map((n) => norm(n.title)));
      const added = videoWorkflowNodes(t).filter((n) => !existing.has(n.id) && !titles.has(norm(n.title)));
      state.data.nodes.push(...added);
      const ids = new Set(state.data.nodes.map((n) => n.id));
      for (const l of videoWorkflowLinks()) {
        if (ids.has(l.source) && ids.has(l.target) && (existing.has(l.source) + existing.has(l.target) < 2)) {
          state.data.links.push({ id: uid(), ...l });
        }
      }
      persist();
      renderAll();
      return added.length;
    },
  };

  // ---------- Barra superior ----------
  $('#btn-new').addEventListener('click', () => createNode({}));
  $('#btn-fit').addEventListener('click', () => graph.fit());
  $('#btn-layout').addEventListener('click', () => {
    for (const n of state.data.nodes) { delete n.x; delete n.y; }
    graph.setData([], [], false);
    refreshGraph(true);
    graph.reheat();
    setTimeout(() => graph.fit(), 1500);
  });

  $('#search').addEventListener('input', (e) => {
    state.query = e.target.value;
    refreshGraph();
    renderList();
  });
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = state.data.nodes.find((n) => !state.hiddenTypes.has(n.type) && matchesQuery(n));
      if (first) { select(first.id); graph.centerOn(first.id); }
    } else if (e.key === 'Escape') {
      e.target.value = '';
      state.query = '';
      refreshGraph();
      renderList();
      e.target.blur();
    }
  });

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cerebro-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.nodes)) throw new Error('el archivo no tiene "nodes"');
      if (!confirm(`Se reemplazará tu cerebro actual por ${parsed.nodes.length} nodos del archivo. ¿Continuar?`)) return;
      state.data = normalize(parsed);
      state.selectedId = null;
      persist();
      renderAll();
      setTimeout(() => graph.fit(), 800);
    } catch (err) {
      alert('No se pudo importar: ' + err.message);
    }
  });

  // Pegar una URL fuera de un campo de texto la guarda como enlace.
  document.addEventListener('paste', (e) => {
    if (e.target.closest('input, textarea, select, dialog')) return;
    const text = (e.clipboardData.getData('text') || '').trim();
    if (!isUrl(text)) return;
    e.preventDefault();
    let title = text;
    try { title = new URL(text).hostname.replace(/^www\./, ''); } catch { /* usar el texto */ }
    createNode({ type: 'enlace', title, url: text });
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); createNode({}); }
    else if (e.key === 'f' || e.key === 'F') graph.fit();
    else if (e.key === 'Escape') select(null);
  });

  // ---------- Inicio ----------
  (async function init() {
    const raw = await Store.load();
    state.data = raw && Array.isArray(raw.nodes) ? normalize(raw) : seed();
    if (!raw) persist();
    statusEl.textContent = Store.mode === 'archivo' ? 'Conectado a data/brain.json' : 'Guardando en este navegador';
    renderAll();
    setTimeout(() => graph.fit(), state.data.nodes.some((n) => n.x === undefined) ? 1200 : 50);
  })();
})();
