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
  // Sube este número al añadir nodos predeterminados: se agregan a cerebros ya existentes.
  const DEFAULTS_VERSION = 2;
  const PINNED_DEFAULTS = ['flow', 'art-autoprompt', 'art-sala', 'filmora', 'tiktok', 'ej-app'];
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
    const data = { version: 1, defaultsVersion: 1, nodes: [], links: [] };
    if (!raw || !Array.isArray(raw.nodes)) return data;
    data.defaultsVersion = Number(raw.defaultsVersion) || 1;
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
        pinned: !!n.pinned,
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
    const data = normalize({
      nodes: [
        n('centro', 'proyecto', 'Mi Cerebro',
          'Este es el centro de tu segundo cerebro.\n\nCada cosa que usas o creas —apps, artefactos, proyectos, notas, enlaces, personas— es un nodo. Conéctalos entre sí para ver cómo se relaciona todo.\n\nEscribe [[Cómo usar Cerebro]] en cualquier descripción para crear una conexión automática.',
          { tags: ['inicio'] }),
        n('guia', 'nota', 'Cómo usar Cerebro',
          '• Doble clic en un espacio vacío del grafo → nuevo nodo.\n• Clic en un nodo → editarlo en este panel.\n• Doble clic en un nodo → abre su enlace.\n• Pega una URL en cualquier parte → se guarda como enlace.\n• Para conectar: toca un nodo → "🔗 Conectar con…" → toca los que quieras.\n• Escribir [[Título de otro nodo]] también crea una conexión (línea discontinua).\n• Exporta a JSON para tener copias de seguridad.',
          { tags: ['ayuda'] }),
        n('ej-app', 'app', 'Claude', 'Asistente con el que construyo cosas. Aquí nacen muchos de mis [[Artefactos]].', { url: 'https://claude.ai', tags: ['ia'] }),
        n('ej-art', 'artefacto', 'Artefactos', 'Páginas, herramientas y prototipos que he creado. Añade cada uno como un nodo y conéctalo al proyecto al que pertenece.'),
        n('ej-repo', 'app', 'GitHub', 'Donde vive el código de mis proyectos.', { url: 'https://github.com', tags: ['código'] }),
        n('ej-idea', 'idea', 'Próxima idea', 'Anota aquí ideas sueltas y conéctalas con lo que ya existe.'),
        ...videoWorkflowNodes(t),
        ...myArtifactNodes(t),
      ],
      links: [
        { source: 'centro', target: 'guia', label: 'empieza aquí' },
        { source: 'centro', target: 'ej-app', label: 'uso' },
        { source: 'centro', target: 'ej-repo', label: 'uso' },
        { source: 'ej-art', target: 'ej-repo', label: 'se guardan en' },
        { source: 'centro', target: 'ej-idea' },
        { source: 'centro', target: 'flujo-video', label: 'proyecto' },
        ...videoWorkflowLinks(),
        ...myArtifactLinks(),
      ],
    });
    data.defaultsVersion = DEFAULTS_VERSION;
    for (const node of data.nodes) node.pinned = PINNED_DEFAULTS.includes(node.id);
    return data;
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

  // Mis artefactos publicados en Claude.
  function myArtifactNodes(t) {
    const n = (id, type, title, url, tags, description) => ({ id, type, title, url, tags, description, created: t, updated: t });
    return [
      n('art-autoprompt', 'artefacto', 'Charlie AutoPrompt', 'https://claude.ai/artifact/HysHZChPyfQRvQsXP3Nrkn', ['prompts', 'ia'],
        'Mi generador de prompts. Lo uso para crear los prompts de mis videos en [[Flow]].'),
      n('art-sala', 'artefacto', 'Sala de Guionistas', 'https://claude.ai/artifact/6R45q4RH3mi4owebPzdszE', ['guiones', 'video'],
        'Donde escribo los guiones de mis videos.'),
      n('art-afiliado', 'artefacto', 'Guionista de Afiliado', 'https://claude.ai/artifact/CVMgsP9W35MU3rRDJi2VDg', ['guiones', 'afiliados'],
        'Guiones para videos de productos de afiliado.'),
      n('art-belleza', 'artefacto', 'Guionista de Belleza', 'https://claude.ai/artifact/9eiDtzAwoRGzxqH3nznUD1', ['guiones', 'belleza'],
        'Guiones para videos de belleza.'),
      n('art-bloques', 'artefacto', 'Estudio de Bloques', 'https://claude.ai/artifact/87eurhyfYxfZnpXpA2ZUbX', [], ''),
      n('roblox', 'proyecto', 'Juegos de Roblox', '', ['roblox', 'juegos'], 'Mis ideas y documentos de juegos.'),
      n('art-granja-tycoon', 'artefacto', 'Granja Tycoon — Documento de Diseño', 'https://claude.ai/artifact/SKwqjamCZxird6p9gZ1xca', ['roblox'], ''),
      n('art-granja-brainrot', 'artefacto', 'Granja Brainrot — Documento Base (Roblox)', 'https://claude.ai/artifact/Gn7NzaxW2ZGn2QfLET4jcA', ['roblox'], ''),
    ];
  }
  function myArtifactLinks() {
    return [
      { source: 'art-autoprompt', target: 'flow', label: 'prompts para' },
      { source: 'art-sala', target: 'art-autoprompt', label: 'guion → prompt' },
      { source: 'art-afiliado', target: 'art-sala', label: 'parte de' },
      { source: 'art-belleza', target: 'art-sala', label: 'parte de' },
      { source: 'flujo-video', target: 'art-sala', label: '0. guion' },
      { source: 'roblox', target: 'art-granja-tycoon', label: 'documento' },
      { source: 'roblox', target: 'art-granja-brainrot', label: 'documento' },
      { source: 'centro', target: 'roblox', label: 'proyecto' },
      ...['art-autoprompt', 'art-sala', 'art-bloques', 'art-granja-tycoon', 'art-granja-brainrot']
        .map((id) => ({ source: 'ej-art', target: id, label: '' })),
      { source: 'ej-app', target: 'ej-art', label: 'creados con' },
    ];
  }

  // Añade a un cerebro ya existente los nodos predeterminados que le falten (sin duplicar
  // títulos) y las conexiones entre ellos. Devuelve cuántos nodos se añadieron.
  function mergeDefaults(nodesFn, linksFn, pinNew) {
    const t = now();
    const existing = new Set(state.data.nodes.map((n) => n.id));
    const titles = new Set(state.data.nodes.map((n) => norm(n.title)));
    const added = nodesFn(t)
      .filter((n) => !existing.has(n.id) && !titles.has(norm(n.title)))
      .map((n) => ({ ...n, pinned: pinNew && PINNED_DEFAULTS.includes(n.id) }));
    state.data.nodes.push(...added);
    const ids = new Set(state.data.nodes.map((n) => n.id));
    const linked = new Set(state.data.links.map((l) => [l.source, l.target].sort().join('|')));
    for (const l of linksFn()) {
      const key = [l.source, l.target].sort().join('|');
      if (ids.has(l.source) && ids.has(l.target) && !linked.has(key) && !(existing.has(l.source) && existing.has(l.target))) {
        state.data.links.push({ id: uid(), ...l });
        linked.add(key);
      }
    }
    return added.length;
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
      <div class="row">
        <a id="p-go" class="button primary open-big" target="_blank" rel="noopener" ${node.url ? '' : 'hidden'}>Abrir ↗</a>
        <label class="pin"><input id="p-pinned" type="checkbox" ${node.pinned ? 'checked' : ''}> ⚡ Acceso rápido</label>
      </div>
      <button id="p-link" class="connect-big">🔗 Conectar con…</button>
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
    const syncGo = () => {
      const go = $('#p-go');
      go.hidden = !node.url;
      go.textContent = `Abrir ${node.title || ''} ↗`;
      if (node.url && !isLocalPath(node.url)) go.href = webHref(node.url);
      else go.removeAttribute('href');
    };
    syncGo();
    $('#p-go').addEventListener('click', (e) => {
      if (isLocalPath(node.url)) { e.preventDefault(); openUrl(node.url); }
    });
    $('#p-pinned').addEventListener('change', (e) => {
      node.pinned = e.target.checked;
      touch();
      renderLauncher();
    });
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
      syncGo();
      if (node.pinned) renderLauncher();
      refreshGraph();
      renderListDebounced();
    });
    $('#p-url').addEventListener('input', (e) => {
      node.url = e.target.value.trim();
      $('#p-open').disabled = !node.url;
      touch();
      syncGo();
      if (node.pinned) renderLauncher();
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
    $('#p-link').addEventListener('click', () => openConnectPicker(node.id));
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
      <button type="button" class="connect-big" id="p-link-2">🔗 Conectar con…</button>`;

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
    $('#p-link-2').addEventListener('click', () => openConnectPicker(node.id));
  }

  // ---------- Selector para conectar ----------
  // Lista de todos los nodos: tocar uno lo conecta (o lo desconecta si ya lo estaba).
  const connectDialog = $('#connect');
  let connectFrom = null;

  const linkBetween = (a, b) => state.data.links.find((l) =>
    (l.source === a && l.target === b) || (l.source === b && l.target === a));

  function openConnectPicker(id) {
    const node = nodeById(id);
    if (!node) return;
    connectFrom = id;
    $('#cx-heading').textContent = `🔗 Conectar «${node.title}» con…`;
    $('#cx-search').value = '';
    $('#cx-label').value = '';
    renderConnectPicker();
    connectDialog.showModal();
  }

  function renderConnectPicker() {
    const node = nodeById(connectFrom);
    if (!node) return;
    const q = norm($('#cx-search').value);
    const mentioned = new Set(allEdges().filter((e) => e.kind === 'mencion' && (e.source === node.id || e.target === node.id))
      .map((e) => (e.source === node.id ? e.target : e.source)));
    const items = state.data.nodes
      .filter((n) => n.id !== node.id && (!q || norm(n.title).includes(q) || n.tags.some((t) => norm(t).includes(q))))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
    const exact = q && state.data.nodes.some((n) => norm(n.title) === q);
    $('#cx-list').innerHTML = items.map((n) => {
      const link = linkBetween(node.id, n.id);
      const on = !!link || mentioned.has(n.id);
      return `<button type="button" class="cx-item${on ? ' on' : ''}" data-cx="${esc(n.id)}" ${!link && on ? 'disabled' : ''}>
          <span class="dot" style="background:${colorOf(n)}"></span>
          <span class="cx-title">${esc(n.title)}</span>
          <span class="cx-state">${link ? '✓ conectado' : on ? '✓ por mención' : '+ conectar'}</span>
        </button>`;
    }).join('') + (q && !exact
      ? `<button type="button" class="cx-item cx-new" data-cx-new="1"><span class="cx-title">+ Crear «${esc($('#cx-search').value.trim())}» y conectarlo</span></button>`
      : '') || '<p class="muted">No hay más nodos. Escribe un nombre arriba para crear uno.</p>';
  }

  function afterConnectChange() {
    const node = nodeById(connectFrom);
    if (node) node.updated = now();
    persist();
    renderFilters();
    refreshGraph();
    renderList();
    renderConnections();
    renderConnectPicker();
  }

  $('#cx-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !connectFrom) return;
    const label = $('#cx-label').value.trim();
    if (btn.dataset.cxNew) {
      const created = addNode({ title: $('#cx-search').value.trim(), type: 'nota' });
      state.data.links.push({ id: uid(), source: connectFrom, target: created.id, label });
      $('#cx-search').value = '';
    } else {
      const link = linkBetween(connectFrom, btn.dataset.cx);
      if (link) state.data.links = state.data.links.filter((l) => l !== link);
      else state.data.links.push({ id: uid(), source: connectFrom, target: btn.dataset.cx, label });
    }
    afterConnectChange();
  });
  $('#cx-search').addEventListener('input', renderConnectPicker);
  $('#cx-done').addEventListener('click', () => connectDialog.close());
  $('#cx-close').addEventListener('click', () => connectDialog.close());
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
    window.open(webHref(target), '_blank', 'noopener');
  }

  // ---------- Acceso rápido ----------
  // Enlaces reales (<a>) en vez de window.open: un toque abre la app aunque el
  // navegador bloquee ventanas emergentes.
  function webHref(url) {
    const u = url.trim();
    return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u;
  }
  function renderLauncher() {
    const pinned = state.data.nodes.filter((n) => n.pinned);
    $('#launcher').innerHTML = `<span class="launcher-label">⚡</span>` + (pinned.length
      ? pinned.map((n) => {
        const inner = `<span class="dot" style="background:${colorOf(n)}"></span>${esc(n.title)}`;
        if (n.url && !isLocalPath(n.url)) {
          return `<a class="launch" href="${esc(webHref(n.url))}" target="_blank" rel="noopener" title="Abrir ${esc(n.title)}">${inner} <span aria-hidden="true">↗</span></a>`;
        }
        return `<button class="launch" data-launch="${esc(n.id)}" title="${n.url ? 'Abrir ' + esc(n.title) : 'Falta el enlace: tócalo para añadirlo'}">${inner}${n.url ? ' <span aria-hidden="true">↗</span>' : ' <span class="muted">(sin enlace)</span>'}</button>`;
      }).join('')
      : '<span class="muted">Marca "⚡ Acceso rápido" en cualquier nodo para tenerlo aquí a un toque.</span>');
  }
  $('#launcher').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-launch]');
    if (!btn) return;
    const node = nodeById(btn.dataset.launch);
    if (!node) return;
    if (node.url) openUrl(node.url);
    else {
      select(node.id);
      graph.centerOn(node.id);
      const url = $('#p-url');
      if (url) url.focus();
    }
  });

  function renderAll() {
    renderLauncher();
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
      const count = mergeDefaults(videoWorkflowNodes, videoWorkflowLinks, false);
      persist();
      renderAll();
      return count;
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
    if (state.data.defaultsVersion < DEFAULTS_VERSION) {
      mergeDefaults(myArtifactNodes, myArtifactLinks, true);
      for (const node of state.data.nodes) {
        if (PINNED_DEFAULTS.includes(node.id) && node.url) node.pinned = true;
      }
      state.data.defaultsVersion = DEFAULTS_VERSION;
      persist();
    }
    statusEl.textContent = Store.mode === 'archivo' ? 'Conectado a data/brain.json' : 'Guardando en este navegador';
    renderAll();
    setTimeout(() => graph.fit(), state.data.nodes.some((n) => n.x === undefined) ? 1200 : 50);
  })();
})();
