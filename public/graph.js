// Motor del grafo: simulación de fuerzas + dibujo en canvas, sin dependencias.
(function () {
  'use strict';

  const REPULSION = 2400;
  const SPRING_LENGTH = 110;
  const SPRING_K = 0.04;
  const GRAVITY = 0.004;
  const DAMPING = 0.8;
  const CLICK_TOLERANCE = 4;

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967295;
  }

  class BrainGraph {
    constructor(canvas, handlers) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.h = handlers || {};
      this.nodes = [];
      this.edges = [];
      this.byId = new Map();
      this.neighbors = new Map();
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
      this.alpha = 1;
      this.hoverId = null;
      this.selectedId = null;
      this.highlight = null; // Set de ids resaltados por la búsqueda, o null
      this.pointer = null;
      this.dirty = true;
      this.dpr = window.devicePixelRatio || 1;

      this._bindEvents();
      this._resize();
      new ResizeObserver(() => this._resize()).observe(canvas);
      const loop = () => {
        this._tick();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // nodes: [{id, x?, y?, ...}], edges: [{source, target, label?, kind?}]
    setData(nodes, edges, reheat) {
      const prev = this.byId;
      this.byId = new Map();
      this.nodes = nodes.map((data) => {
        let n = prev.get(data.id);
        if (!n) {
          n = { vx: 0, vy: 0, x: data.x, y: data.y, fresh: typeof data.x !== 'number' };
        }
        n.id = data.id;
        n.data = data;
        n.degree = 0;
        this.byId.set(data.id, n);
        return n;
      });

      this.neighbors = new Map(this.nodes.map((n) => [n.id, new Set()]));
      this.edges = [];
      for (const e of edges) {
        const s = this.byId.get(e.source);
        const t = this.byId.get(e.target);
        if (!s || !t || s === t) continue;
        this.edges.push({ ...e, s, t });
        s.degree++;
        t.degree++;
        this.neighbors.get(s.id).add(t.id);
        this.neighbors.get(t.id).add(s.id);
      }

      // Coloca los nodos nuevos cerca de algún vecino ya posicionado.
      for (const n of this.nodes) {
        if (!n.fresh) continue;
        const anchor = [...this.neighbors.get(n.id)].map((id) => this.byId.get(id)).find((m) => !m.fresh);
        const r = hash(n.id);
        const angle = r * Math.PI * 2;
        const dist = anchor ? 60 + r * 40 : 40 + r * 160;
        n.x = (anchor ? anchor.x : 0) + Math.cos(angle) * dist;
        n.y = (anchor ? anchor.y : 0) + Math.sin(angle) * dist;
        n.fresh = false;
      }

      if (this.hoverId && !this.byId.has(this.hoverId)) this.hoverId = null;
      if (reheat) this.alpha = Math.max(this.alpha, 0.5);
      this.dirty = true;
    }

    setSelected(id) {
      this.selectedId = id;
      this.dirty = true;
    }

    setHighlight(ids) {
      this.highlight = ids;
      this.dirty = true;
    }

    reheat() {
      this.alpha = 1;
    }

    centerOn(id) {
      const n = this.byId.get(id);
      if (!n) return;
      this.panX = -n.x * this.scale;
      this.panY = -n.y * this.scale;
      this.dirty = true;
    }

    fit() {
      if (!this.nodes.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of this.nodes) {
        minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
      }
      const pad = 80;
      const w = this.width - pad * 2;
      const h = this.height - pad * 2;
      this.scale = Math.min(2, Math.max(0.15, Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1))));
      this.panX = -((minX + maxX) / 2) * this.scale;
      this.panY = -((minY + maxY) / 2) * this.scale;
      this.dirty = true;
    }

    toWorld(sx, sy) {
      return {
        x: (sx - this.width / 2 - this.panX) / this.scale,
        y: (sy - this.height / 2 - this.panY) / this.scale,
      };
    }

    radius(n) {
      return 7 + Math.min(14, Math.sqrt(n.degree) * 3);
    }

    nodeAt(sx, sy) {
      const p = this.toWorld(sx, sy);
      let best = null;
      let bestD = Infinity;
      for (const n of this.nodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < this.radius(n) + 4 / this.scale && d < bestD) {
          best = n;
          bestD = d;
        }
      }
      return best;
    }

    _resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
      this.dirty = true;
    }

    _tick() {
      const dragging = this.pointer && this.pointer.node && this.pointer.moved;
      const running = this.alpha > 0.01 || dragging;
      if (running) this._step(dragging);
      if (running || this.dirty) {
        this._draw();
        this.dirty = false;
      }
    }

    _step(dragging) {
      const nodes = this.nodes;
      const a = Math.max(this.alpha, dragging ? 0.3 : 0);
      for (const n of nodes) { n.fx = 0; n.fy = 0; }

      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const q = nodes[j];
          let dx = p.x - q.x;
          let dy = p.y - q.y;
          let d2 = dx * dx + dy * dy;
          if (d2 > 360000) continue;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2);
          const f = REPULSION / Math.max(d2, 100);
          p.fx += (dx / d) * f; p.fy += (dy / d) * f;
          q.fx -= (dx / d) * f; q.fy -= (dy / d) * f;
        }
      }

      for (const e of this.edges) {
        const dx = e.t.x - e.s.x;
        const dy = e.t.y - e.s.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - SPRING_LENGTH) * SPRING_K;
        e.s.fx += (dx / d) * f; e.s.fy += (dy / d) * f;
        e.t.fx -= (dx / d) * f; e.t.fy -= (dy / d) * f;
      }

      const held = dragging ? this.pointer.node : null;
      for (const n of nodes) {
        if (n === held) { n.vx = 0; n.vy = 0; continue; }
        n.fx -= n.x * GRAVITY;
        n.fy -= n.y * GRAVITY;
        n.vx = (n.vx + n.fx * a) * DAMPING;
        n.vy = (n.vy + n.fy * a) * DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }

      if (!dragging) {
        this.alpha *= 0.985;
        if (this.alpha <= 0.01) {
          this.alpha = 0;
          if (this.h.onSettle) this.h.onSettle(this.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })));
        }
      }
    }

    _draw() {
      const ctx = this.ctx;
      const { dpr, scale } = this;
      const css = getComputedStyle(this.canvas);
      const edgeColor = css.getPropertyValue('--edge').trim() || '#556';
      const textColor = css.getPropertyValue('--text').trim() || '#eee';
      const haloColor = css.getPropertyValue('--bg').trim() || '#000';

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (this.width / 2 + this.panX), dpr * (this.height / 2 + this.panY));

      const focusId = this.hoverId || this.selectedId;
      const focusSet = focusId ? new Set([focusId, ...(this.neighbors.get(focusId) || [])]) : null;
      const isDim = (n) => (this.highlight && !this.highlight.has(n.id)) || (focusSet && !focusSet.has(n.id));

      // Aristas
      for (const e of this.edges) {
        const active = focusId && (e.s.id === focusId || e.t.id === focusId);
        const dim = isDim(e.s) || isDim(e.t);
        ctx.globalAlpha = active ? 0.95 : dim ? 0.08 : 0.4;
        ctx.strokeStyle = active ? this.h.colorOf(e.s.id === focusId ? e.t.data : e.s.data) : edgeColor;
        ctx.lineWidth = (active ? 2 : 1.2) / scale;
        ctx.setLineDash(e.kind === 'mencion' ? [5 / scale, 4 / scale] : []);
        ctx.beginPath();
        ctx.moveTo(e.s.x, e.s.y);
        ctx.lineTo(e.t.x, e.t.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Nodos
      for (const n of this.nodes) {
        const r = this.radius(n);
        const color = this.h.colorOf(n.data);
        ctx.globalAlpha = isDim(n) ? 0.18 : 1;
        if (n.id === this.selectedId) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6 / scale, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.25;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (n.id === this.hoverId || n.id === this.selectedId) {
          ctx.lineWidth = 2 / scale;
          ctx.strokeStyle = textColor;
          ctx.stroke();
        }
      }

      // Etiquetas (tamaño constante en pantalla)
      const fontPx = 12 / scale;
      ctx.font = `500 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      for (const n of this.nodes) {
        const focused = focusSet ? focusSet.has(n.id) : false;
        const matched = this.highlight ? this.highlight.has(n.id) : false;
        if (!(scale > 0.75 || focused || matched || n.degree >= 4)) continue;
        if (isDim(n) && !focused) continue;
        let label = n.data.title || 'Sin título';
        if (label.length > 32) label = label.slice(0, 31) + '…';
        const y = n.y + this.radius(n) + 4 / scale;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = haloColor;
        ctx.strokeText(label, n.x, y);
        ctx.fillStyle = textColor;
        ctx.fillText(label, n.x, y);
      }

      // Etiquetas de las conexiones del nodo enfocado
      if (focusId) {
        ctx.font = `${10.5 / scale}px system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        for (const e of this.edges) {
          if (!e.label || (e.s.id !== focusId && e.t.id !== focusId)) continue;
          const mx = (e.s.x + e.t.x) / 2;
          const my = (e.s.y + e.t.y) / 2;
          ctx.lineWidth = 3 / scale;
          ctx.strokeStyle = haloColor;
          ctx.strokeText(e.label, mx, my);
          ctx.fillStyle = textColor;
          ctx.globalAlpha = 0.8;
          ctx.fillText(e.label, mx, my);
          ctx.globalAlpha = 1;
        }
      }
      ctx.globalAlpha = 1;
    }

    _bindEvents() {
      const c = this.canvas;
      const local = (ev) => {
        const r = c.getBoundingClientRect();
        return { x: ev.clientX - r.left, y: ev.clientY - r.top };
      };

      c.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        const p = local(ev);
        const node = this.nodeAt(p.x, p.y);
        this.pointer = { node, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, moved: false };
        c.setPointerCapture(ev.pointerId);
      });

      c.addEventListener('pointermove', (ev) => {
        const p = local(ev);
        const ptr = this.pointer;
        if (ptr) {
          if (!ptr.moved && Math.hypot(p.x - ptr.startX, p.y - ptr.startY) > CLICK_TOLERANCE) ptr.moved = true;
          if (ptr.moved) {
            if (ptr.node) {
              const w = this.toWorld(p.x, p.y);
              ptr.node.x = w.x;
              ptr.node.y = w.y;
            } else {
              this.panX += p.x - ptr.lastX;
              this.panY += p.y - ptr.lastY;
            }
            this.dirty = true;
          }
          ptr.lastX = p.x;
          ptr.lastY = p.y;
          return;
        }
        const hit = this.nodeAt(p.x, p.y);
        const id = hit ? hit.id : null;
        if (id !== this.hoverId) {
          this.hoverId = id;
          c.style.cursor = id ? 'pointer' : 'grab';
          this.dirty = true;
        }
      });

      const end = (ev) => {
        const ptr = this.pointer;
        this.pointer = null;
        if (!ptr) return;
        if (c.hasPointerCapture(ev.pointerId)) c.releasePointerCapture(ev.pointerId);
        if (!ptr.moved) {
          if (this.h.onSelect) this.h.onSelect(ptr.node ? ptr.node.id : null);
        } else if (ptr.node) {
          this.alpha = Math.max(this.alpha, 0.3);
        }
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('pointerleave', () => {
        if (!this.pointer && this.hoverId) {
          this.hoverId = null;
          this.dirty = true;
        }
      });

      c.addEventListener('dblclick', (ev) => {
        const p = local(ev);
        const node = this.nodeAt(p.x, p.y);
        if (node) {
          if (this.h.onOpen) this.h.onOpen(node.id);
        } else if (this.h.onCreateAt) {
          this.h.onCreateAt(this.toWorld(p.x, p.y));
        }
      });

      c.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        const p = local(ev);
        const before = this.toWorld(p.x, p.y);
        const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015));
        this.scale = Math.min(4, Math.max(0.1, this.scale * factor));
        this.panX = p.x - this.width / 2 - before.x * this.scale;
        this.panY = p.y - this.height / 2 - before.y * this.scale;
        this.dirty = true;
      }, { passive: false });
    }
  }

  window.BrainGraph = BrainGraph;
})();
