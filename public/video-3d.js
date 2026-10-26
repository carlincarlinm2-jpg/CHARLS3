// Motor 3D de la Fábrica de videos (Three.js).
//
// Un mundo es una escena 3D con "objetivos" a los que la cámara puede mirar. El guion
// elige el mundo, el foco y el movimiento de cámara:
//   [3d: calle | foco: maleta | camara: subir]
// Escenas seguidas del mismo mundo comparten la escena 3D y la cámara viaja de una a
// otra sin corte. Los mundos se registran en video-3d-mundos.js con piezas del kit.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clamp, lerp, suave, normal } from './video-3d-kit.js';

const F = window.Fabrica;
const MEZCLA = 1.2; // segundos que tarda la cámara en viajar de una escena a la siguiente

const mundos = {};
const instancias = {};

// def: { descripcion, ejemplo, crear(entorno) → { escena, camara, objetivos, actualizar,
//        limitar?, etiquetas?, bloom?, temblor? } }
export function mundo(nombre, def) { mundos[nombre] = def; }

// ---------- Cámara ----------

// Cada movimiento devuelve, para un avance k (0→1), cuánto se aleja (×dist del
// objetivo), cuánto gira alrededor (yaw) y cuánto sube o baja (pitch).
const MOVIMIENTOS = {
  fija: () => ({ dist: 1, yaw: 0, pitch: 0 }),
  orbita: (k) => ({ dist: 1, yaw: lerp(-0.6, 0.6, k), pitch: 0 }),
  vuelta: (k) => ({ dist: 1, yaw: lerp(0, Math.PI * 2, k), pitch: 0.05 }),
  acercar: (k) => ({ dist: lerp(1.45, 0.8, k), yaw: lerp(-0.12, 0.12, k), pitch: 0 }),
  alejar: (k) => ({ dist: lerp(0.8, 1.6, k), yaw: lerp(0.12, -0.12, k), pitch: lerp(0, 0.1, k) }),
  subir: (k) => ({ dist: lerp(0.55, 1.45, k), yaw: lerp(0.35, 0, k), pitch: lerp(-0.1, 0.35, k) }),
  bajar: (k) => ({ dist: lerp(1.45, 0.55, k), yaw: lerp(0, 0.35, k), pitch: lerp(0.35, -0.1, k) }),
  seguir: (k) => ({ dist: 1, yaw: lerp(-0.25, 0.25, k), pitch: 0 }),
  cenital: (k) => ({ dist: lerp(1.2, 1, k), yaw: lerp(0, 0.3, k), pitch: 1.1 }),
};

function enlaza(a, b) {
  return a.tipo === '3d' && b.tipo === '3d' && normal(a.valor || 'calle') === normal(b.valor || 'calle');
}

function instancia(s) {
  const nombre = normal(s.valor || 'calle');
  const def = mundos[nombre];
  if (!def) return null;
  if (!instancias[nombre]) instancias[nombre] = def.crear(entorno());
  return instancias[nombre];
}

function objetivo(inst, s) {
  return inst.objetivos[normal(s.op.foco)] || Object.values(inst.objetivos)[0];
}

function pose(inst, s, t) {
  const obj = objetivo(inst, s);
  const mov = MOVIMIENTOS[normal(s.op.camara)] || MOVIMIENTOS.fija;
  const m = mov(suave(t / s.dur));
  const zoom = parseFloat(s.op.zoom) || 1;
  const mira = obj.pos(s.inicio + t);
  const dist = obj.dist * m.dist / zoom;
  const yaw = obj.yaw + m.yaw;
  const pitch = obj.pitch + m.pitch;
  const pos = mira.clone().add(new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch),
  ).multiplyScalar(dist));
  if (s.anterior && enlaza(s.anterior, s) && t < MEZCLA) {
    // Viaja desde donde terminó la escena anterior.
    const prev = pose(inst, s.anterior, s.anterior.dur);
    const k = suave(t / MEZCLA);
    pos.lerpVectors(prev.pos, pos, k);
    mira.lerpVectors(prev.mira, mira, k);
  }
  if (inst.limitar) inst.limitar(pos);
  return { pos, mira };
}

// Ligero movimiento de cámara en mano, para que nada se vea "congelado".
function temblor(pos, mira, tAbs, fuerza) {
  if (!fuerza) return;
  const d = pos.distanceTo(mira) * fuerza;
  pos.x += (Math.sin(tAbs * 0.9) + Math.sin(tAbs * 2.3) * 0.4) * 0.006 * d;
  pos.y += (Math.sin(tAbs * 1.1 + 1) + Math.sin(tAbs * 2.9) * 0.4) * 0.005 * d;
}

// ---------- Render ----------

const Vineta = {
  uniforms: { tDiffuse: { value: null }, tiempo: { value: 0 }, fuerza: { value: 0.42 }, grano: { value: 0.035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float tiempo; uniform float fuerza; uniform float grano;
    varying vec2 vUv;
    float azar(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; d.x *= 0.62;
      c.rgb *= mix(1.0 - fuerza, 1.0, smoothstep(0.72, 0.18, length(d)));
      c.rgb += (azar(vUv * 900.0 + tiempo) - 0.5) * grano;
      gl_FragColor = c;
    }`,
};

let renderer = null;
let composer = null;
let pasoEscena = null;
let bloom = null;
let vineta = null;
let mapaEntorno = null;

function iniciar() {
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  pasoEscena = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  composer.addPass(pasoEscena);
  bloom = new UnrealBloomPass(new THREE.Vector2(F.W / 2, F.H / 2), 0.5, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  vineta = new ShaderPass(Vineta);
  composer.addPass(vineta);
  ponerEscala(1);
}

// Calidad del render: 1 = 1080×1920; la vista previa puede usar menos para ir fluida.
function ponerEscala(k) {
  const e = clamp(k, 0.25, 1);
  const w = Math.round(F.W * e);
  const h = Math.round(F.H * e);
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
}

function entorno() {
  if (!mapaEntorno) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    mapaEntorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  return mapaEntorno;
}

const proyectado = new THREE.Vector3();

function enPantalla(pos, camara) {
  proyectado.copy(pos).project(camara);
  return { x: (proyectado.x + 1) / 2 * F.W, y: (1 - proyectado.y) / 2 * F.H, delante: proyectado.z < 1 };
}

// Recuadro de esquinas que marca un objetivo (como "OBJETIVO" en los videos).
function marco(ctx, E, x, y, tam, color, k) {
  const s = tam * lerp(1.5, 1, E.easeOut(k));
  const l = s * 0.32;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * s, y + sy * (s - l));
    ctx.lineTo(x + sx * s, y + sy * s);
    ctx.lineTo(x + sx * (s - l), y + sy * s);
    ctx.stroke();
  }
  ctx.restore();
}

function dibujar(ctx, E, s, t) {
  const inst = instancia(s);
  if (!inst) {
    E.texto(`Mundo 3D desconocido: "${s.valor}"`, F.W / 2, 1080, { tam: 46, color: E.c.peligro });
    return;
  }
  const tAbs = s.inicio + t;
  inst.actualizar(tAbs, s, t);
  const { pos, mira } = pose(inst, s, t);
  temblor(pos, mira, tAbs, inst.temblor ?? 1);
  inst.camara.position.copy(pos);
  inst.camara.lookAt(mira);
  inst.camara.updateMatrixWorld();
  pasoEscena.scene = inst.escena;
  pasoEscena.camera = inst.camara;
  bloom.strength = inst.bloom ?? 0.5;
  vineta.uniforms.tiempo.value = tAbs % 100;
  composer.render();
  ctx.drawImage(renderer.domElement, 0, 0, F.W, F.H);

  // Etiquetas del mundo (siguen a su objeto en pantalla) y la del guion bajo el foco.
  const marcas = inst.etiquetas ? inst.etiquetas(tAbs, s, t) : [];
  if (s.op.etiqueta) marcas.push({ pos: objetivo(inst, s).pos(tAbs), texto: s.op.etiqueta, k: E.aparecer(t, 0.5, 0.4), bajo: 230 });
  for (const m of marcas) {
    if (!(m.k > 0)) continue;
    const p = enPantalla(m.pos, inst.camara);
    if (!p.delante) continue;
    const color = E.c[m.color] || m.color || E.c.acento;
    if (m.marco) marco(ctx, E, p.x, p.y, m.marco, color, m.k);
    if (m.texto) {
      const x = clamp(p.x, 240, F.W - 240);
      const y = clamp(p.y + (m.bajo ?? (m.marco ? m.marco + 60 : 0)), 560, F.H - 240);
      E.etiqueta(m.texto, x, y, color, m.k);
    }
  }
}

// Llamado por video-3d-mundos.js cuando todos los mundos están registrados.
export function listo() {
  try {
    iniciar();
    F.motor3d = { dibujar, enlaza, mundos, ponerEscala };
    F.escenas['3d'].descripcion = `Mundo 3D con cámara en movimiento. Mundos: ${Object.keys(mundos).join(', ')}. ` +
      `camara: ${Object.keys(MOVIMIENTOS).join(', ')}. zoom: 1.5 acerca. Escenas seguidas del mismo mundo se unen sin corte.`;
  } catch (err) {
    F.error3d = 'Tu navegador no puede mostrar 3D (WebGL).';
    console.error(err);
  }
  window.dispatchEvent(new Event('fabrica3d'));
}
