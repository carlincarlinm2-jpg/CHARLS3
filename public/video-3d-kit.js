// Kit de piezas 3D de la Fábrica de videos.
//
// Las piezas que usan los videos explicativos (personas, objetos, efectos, materiales)
// están aquí, listas para combinar. Un mundo nuevo no se dibuja desde cero: se arma
// con estas piezas. Toda pieza devuelve un Object3D; las animadas traen además
// `userData.animar(t, ...)`.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, RoundedBoxGeometry };

// ---------- Utilidades ----------

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const suave = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const normal = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const elegir = (rnd, lista) => lista[Math.floor(rnd() * lista.length)];

export function textura(ancho, alto, dibujar, { repetir = false, color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  dibujar(c.getContext('2d'), ancho, alto);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Une muchas geometrías del mismo material en una sola malla: la tarjeta gráfica
// dibuja una pieza en lugar de cientos.
export function fusionar(lista, material) {
  const geos = lista.map(({ geo, pos, rot, esc }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4().compose(
      pos || new THREE.Vector3(),
      new THREE.Quaternion().setFromEuler(rot || new THREE.Euler()),
      esc || new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    return g;
  });
  return new THREE.Mesh(mergeGeometries(geos), material);
}

// ---------- Materiales (en caché: el mismo color se comparte) ----------

const materiales = new Map();
export function mat(color, op = {}) {
  const clave = color + JSON.stringify(op);
  if (!materiales.has(clave)) {
    const { rugosidad = 0.72, metal = 0, emisivo = null, intensidad = 1, fisico = false, ...resto } = op;
    const Clase = fisico ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Clase({ color, roughness: rugosidad, metalness: metal, ...resto });
    if (emisivo) { m.emissive = new THREE.Color(emisivo); m.emissiveIntensity = intensidad; }
    materiales.set(clave, m);
  }
  return materiales.get(clave);
}

export const brilla = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
export const aditivo = (color, opacidad = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
});

// ---------- Destellos, sombras y luz pintada ----------

const radial = (paradas) => textura(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  for (const [k, c] of paradas) r.addColorStop(k, c);
  g.fillStyle = r;
  g.fillRect(0, 0, w, w);
}, { color: false });

const TEX = {
  brillo: radial([[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]),
  sombra: radial([[0, 'rgba(0,0,0,.7)'], [0.5, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]),
};

export function destello(color, tam, opacidad = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.brillo, color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  s.scale.setScalar(tam);
  return s;
}

const GEO_PISO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export function sombra(ancho, largo = ancho) {
  const m = new THREE.Mesh(GEO_PISO, new THREE.MeshBasicMaterial({ map: TEX.sombra, transparent: true, depthWrite: false }));
  m.scale.set(ancho, 1, largo);
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

// Charco de luz en el suelo: imita una lámpara sin el costo de una luz real.
export function luzPintada(color, tam, opacidad = 0.5) {
  const m = new THREE.Mesh(GEO_PISO, new THREE.MeshBasicMaterial({
    map: TEX.brillo, color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  m.scale.set(tam, 1, tam);
  m.position.y = 0.02;
  return m;
}

// Orienta un cilindro de altura 1 para que una dos puntos (rayos, cables, palitos).
const ARRIBA = new THREE.Vector3(0, 1, 0);
export function unir(malla, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  malla.position.copy(a).addScaledVector(dir, 0.5);
  malla.scale.set(1, Math.max(1e-4, dir.length()), 1);
  malla.quaternion.setFromUnitVectors(ARRIBA, dir.normalize());
}

// ---------- Personas ----------

export const PIELES = ['#f3cfb3', '#e6b28e', '#cf946c', '#b27650', '#8d5a3b', '#653e28'];
export const PELOS = ['#1d1612', '#3b2a20', '#5e3d22', '#94622f', '#d0a660', '#8c8c8c', '#2a2633', '#7a2e1f'];
export const ROPA = ['#4f7bd9', '#c0504d', '#8c6bb1', '#e0a24a', '#4aa38b', '#e8e4dc', '#d97a9c', '#6b8e23', '#3d5a80', '#ef7d57', '#2d2d38', '#f2d45c'];
export const PANTALONES = ['#1d2a4a', '#2b2b30', '#4b3a2a', '#3a4f6b', '#6b6b70', '#1f3b2f', '#c9b48a'];
export const PEINADOS = ['corto', 'largo', 'coleta', 'mono', 'rapado', 'rizado'];

const G = {
  pelvis: new THREE.SphereGeometry(1, 18, 12),
  muslo: new THREE.CapsuleGeometry(0.074, 0.3, 4, 12).translate(0, -0.21, 0),
  pierna: new THREE.CapsuleGeometry(0.058, 0.3, 4, 12).translate(0, -0.2, 0),
  zapato: new RoundedBoxGeometry(0.1, 0.075, 0.25, 3, 0.03).translate(0, -0.035, 0.05),
  torso: new THREE.LatheGeometry([
    [0.0, -0.02], [0.13, -0.02], [0.125, 0.12], [0.145, 0.26], [0.168, 0.4], [0.16, 0.48], [0.11, 0.54], [0.05, 0.57], [0, 0.575],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 24),
  chaqueta: new THREE.LatheGeometry([
    [0.0, -0.12], [0.15, -0.12], [0.14, 0.1], [0.158, 0.26], [0.18, 0.4], [0.172, 0.49], [0.12, 0.55], [0.06, 0.58], [0, 0.585],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 24),
  falda: new THREE.CylinderGeometry(0.15, 0.27, 0.46, 20, 1, true).translate(0, -0.2, 0),
  cuello: new THREE.CylinderGeometry(0.046, 0.05, 0.1, 12),
  cabeza: new THREE.SphereGeometry(0.11, 24, 18),
  ojo: new THREE.SphereGeometry(0.013, 8, 6),
  oreja: new THREE.SphereGeometry(0.025, 8, 6),
  pelo: new THREE.SphereGeometry(0.119, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
  peloLargo: new THREE.CapsuleGeometry(0.095, 0.16, 4, 14),
  bolita: new THREE.SphereGeometry(1, 14, 10),
  brazo: new THREE.CapsuleGeometry(0.05, 0.2, 4, 10).translate(0, -0.14, 0),
  manga: new THREE.CapsuleGeometry(0.058, 0.1, 4, 10).translate(0, -0.08, 0),
  antebrazo: new THREE.CapsuleGeometry(0.042, 0.18, 4, 10).translate(0, -0.12, 0),
  mano: new THREE.SphereGeometry(0.045, 12, 10),
  mochila: new RoundedBoxGeometry(0.27, 0.33, 0.13, 3, 0.04),
  bolso: new RoundedBoxGeometry(0.2, 0.15, 0.06, 3, 0.02),
  tira: new THREE.CylinderGeometry(0.01, 0.01, 1, 6),
  movil: new RoundedBoxGeometry(0.075, 0.15, 0.012, 2, 0.008),
  visera: new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20, 1, false, -Math.PI / 2, Math.PI),
};

// Persona estilizada con articulaciones (cadera, rodillas, tobillos, hombros, codos,
// cabeza), para caminar, mirar el móvil o quedarse quieta.
export function persona(op = {}) {
  const {
    piel = PIELES[1], pelo = PELOS[1], peinado = 'corto', ropa = 'camiseta', camisa = ROPA[0],
    pantalon = PANTALONES[0], zapatos = '#2a2a2e', accesorio = null, color2 = '#e8e4dc', movil = false, altura = 1,
  } = op;
  const mPiel = mat(piel, { rugosidad: 0.6 });
  const mCamisa = mat(camisa, { rugosidad: 0.85 });
  const mPant = mat(pantalon, { rugosidad: 0.9 });
  const mPelo = mat(pelo, { rugosidad: 0.55 });
  const mZap = mat(zapatos, { rugosidad: 0.5 });
  const vestido = ropa === 'vestido';
  const mangaLarga = ropa === 'manga larga' || ropa === 'chaqueta';
  const mPierna = vestido ? mPiel : mPant;

  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.scale.setScalar(altura);
  raiz.add(cuerpo);
  const malla = (geo, m, padre, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    padre.add(o);
    return o;
  };

  const cadera = new THREE.Group();
  cadera.position.y = 0.9;
  cuerpo.add(cadera);
  const pelvis = malla(G.pelvis, vestido ? mCamisa : mPant, cadera, 0, 0.0, 0);
  pelvis.scale.set(0.16, 0.11, 0.115);
  if (vestido) malla(G.falda, mCamisa, cadera, 0, 0.04, 0);

  const piernas = [-1, 1].map((lado) => {
    const muslo = new THREE.Group();
    muslo.position.set(lado * 0.088, -0.02, 0);
    cadera.add(muslo);
    malla(G.muslo, mPierna, muslo);
    const rodilla = new THREE.Group();
    rodilla.position.y = -0.42;
    muslo.add(rodilla);
    malla(G.pierna, mPierna, rodilla);
    const tobillo = new THREE.Group();
    tobillo.position.y = -0.41;
    rodilla.add(tobillo);
    malla(G.zapato, mZap, tobillo);
    return { muslo, rodilla, tobillo };
  });

  const torso = new THREE.Group();
  torso.position.y = 0.05;
  cadera.add(torso);
  const pecho = malla(ropa === 'chaqueta' ? G.chaqueta : G.torso, mCamisa, torso);
  pecho.scale.z = 0.66;
  if (ropa === 'chaqueta') {
    // Camiseta interior que asoma por la chaqueta abierta.
    const interior = malla(G.bolita, mat(color2, { rugosidad: 0.9 }), torso, 0, 0.3, 0.075);
    interior.scale.set(0.06, 0.23, 0.04);
  }
  malla(G.cuello, mPiel, torso, 0, 0.6, 0);

  const cabeza = new THREE.Group();
  cabeza.position.y = 0.64;
  torso.add(cabeza);
  const craneo = malla(G.cabeza, mPiel, cabeza, 0, 0.1, 0);
  craneo.scale.set(0.93, 1.07, 1);
  const mOjo = mat('#1b1716', { rugosidad: 0.3 });
  for (const lado of [-1, 1]) {
    malla(G.ojo, mOjo, cabeza, lado * 0.036, 0.115, 0.097);
    const oreja = malla(G.oreja, mPiel, cabeza, lado * 0.102, 0.1, 0);
    oreja.scale.set(0.45, 0.85, 0.6);
  }
  const casco = malla(G.pelo, mPelo, cabeza, 0, 0.105, -0.008);
  casco.rotation.x = -0.32;
  if (peinado === 'rapado') casco.scale.setScalar(0.96);
  if (peinado === 'rizado') {
    const r = aleatorio(pelo.length * 7 + camisa.charCodeAt(1));
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2;
      const b = r() * 1.1;
      const bola = malla(G.bolita, mPelo, cabeza, Math.sin(a) * Math.sin(b) * 0.115, 0.13 + Math.cos(b) * 0.09, Math.cos(a) * Math.sin(b) * 0.1 - 0.02);
      bola.scale.setScalar(0.042);
    }
  }
  if (peinado === 'largo') {
    const largo = malla(G.peloLargo, mPelo, cabeza, 0, 0.02, -0.055);
    largo.scale.set(1.2, 1, 0.55);
  }
  if (peinado === 'coleta') {
    malla(G.bolita, mPelo, cabeza, 0, 0.13, -0.12).scale.setScalar(0.04);
    const cola = malla(G.peloLargo, mPelo, cabeza, 0, 0.02, -0.14);
    cola.scale.set(0.38, 0.75, 0.38);
  }
  if (peinado === 'mono') malla(G.bolita, mPelo, cabeza, 0, 0.225, -0.05).scale.setScalar(0.055);
  if (accesorio === 'gorra') {
    const mGorra = mat(color2, { rugosidad: 0.8 });
    const gorra = malla(G.pelo, mGorra, cabeza, 0, 0.115, -0.004);
    gorra.scale.set(1.04, 0.95, 1.04);
    malla(G.visera, mGorra, cabeza, 0, 0.14, 0.03).rotation.x = -0.08;
  }

  let pantalla = null;
  const brazos = [-1, 1].map((lado) => {
    const hombro = new THREE.Group();
    hombro.position.set(lado * 0.195, 0.47, 0);
    torso.add(hombro);
    malla(mangaLarga ? G.brazo : G.manga, mCamisa, hombro);
    if (!mangaLarga) malla(G.brazo, mPiel, hombro).scale.set(0.95, 1, 0.95);
    const codo = new THREE.Group();
    codo.position.y = -0.29;
    hombro.add(codo);
    malla(G.antebrazo, mangaLarga ? mCamisa : mPiel, codo);
    const mano = new THREE.Group();
    mano.position.y = -0.26;
    codo.add(mano);
    malla(G.mano, mPiel, mano).scale.set(0.8, 1.1, 0.7);
    if (movil && lado > 0) {
      pantalla = new THREE.MeshStandardMaterial({ color: '#0e0f13', roughness: 0.3, metalness: 0.4, emissive: '#000000', emissiveIntensity: 3 });
      const m = new THREE.Mesh(G.movil, pantalla);
      m.position.set(-0.01, -0.04, 0.04);
      m.rotation.set(-1.2, 0, 0);
      mano.add(m);
    }
    return { hombro, codo, mano };
  });

  if (accesorio === 'mochila') {
    const mMochila = mat(color2, { rugosidad: 0.8 });
    malla(G.mochila, mMochila, torso, 0, 0.3, -0.16);
    for (const lado of [-1, 1]) {
      const tira = malla(G.tira, mat('#222'), torso, lado * 0.09, 0.32, 0.0);
      tira.scale.set(2, 0.36, 2);
      tira.rotation.x = 0.2;
    }
  }
  if (accesorio === 'bolso') {
    malla(G.bolso, mat(color2, { rugosidad: 0.5 }), cadera, -0.2, -0.02, 0.02);
    const tira = malla(G.tira, mat('#222'), torso, -0.03, 0.25, 0.07);
    tira.scale.set(1, 0.62, 1);
    tira.rotation.z = -0.62;
  }

  raiz.add(sombra(0.75, 0.6));

  const [piernaI, piernaD] = piernas;
  const [brazoI, brazoD] = brazos;
  raiz.userData = {
    pantalla,
    cabeza,
    // Ciclo de caminar: rodillas que se doblan al avanzar, cadera que sube y baja,
    // hombros que giran al contrario que la cadera y brazos opuestos a las piernas.
    caminar(f) {
      const s = Math.sin(f);
      const c = Math.cos(f);
      piernaI.muslo.rotation.x = -0.44 * s;
      piernaD.muslo.rotation.x = 0.44 * s;
      piernaI.rodilla.rotation.x = 0.95 * Math.pow(Math.max(0, c), 1.4) + 0.05;
      piernaD.rodilla.rotation.x = 0.95 * Math.pow(Math.max(0, -c), 1.4) + 0.05;
      for (const p of piernas) p.tobillo.rotation.x = -(p.muslo.rotation.x + p.rodilla.rotation.x) * 0.75;
      cadera.position.y = 0.9 - 0.022 * (1 - Math.cos(2 * f)) / 2;
      cadera.rotation.y = 0.09 * s;
      cadera.rotation.z = 0.025 * c;
      torso.rotation.y = -0.16 * s;
      torso.rotation.x = 0.04;
      brazoI.hombro.rotation.set(0.38 * s, 0, 0.07);
      brazoI.codo.rotation.x = -0.25 - 0.3 * Math.max(0, -s);
      if (movil) {
        // Camina mirando el móvil.
        brazoD.hombro.rotation.set(-0.55, 0, -0.12);
        brazoD.codo.rotation.x = -1.35;
        cabeza.rotation.x = 0.32;
      } else {
        brazoD.hombro.rotation.set(-0.38 * s, 0, -0.07);
        brazoD.codo.rotation.x = -0.25 - 0.3 * Math.max(0, s);
        cabeza.rotation.x = 0.03 * Math.cos(2 * f);
      }
    },
    quieto(t) {
      for (const p of piernas) { p.muslo.rotation.x = 0; p.rodilla.rotation.x = 0.04; p.tobillo.rotation.x = -0.03; }
      cadera.position.y = 0.9;
      torso.rotation.set(0.02 * Math.sin(t * 1.3), 0, 0);
      brazoI.hombro.rotation.set(0.05, 0, 0.1);
      brazoI.codo.rotation.x = -0.15;
      if (movil) {
        brazoD.hombro.rotation.set(-0.55, 0, -0.12);
        brazoD.codo.rotation.x = -1.35;
        cabeza.rotation.x = 0.32;
      } else {
        brazoD.hombro.rotation.set(0.05, 0, -0.1);
        brazoD.codo.rotation.x = -0.15;
      }
    },
  };
  raiz.userData.quieto(0);
  return raiz;
}

export function personaAleatoria(rnd, extra = {}) {
  const ropa = elegir(rnd, ['camiseta', 'camiseta', 'manga larga', 'chaqueta', 'vestido']);
  const peinado = ropa === 'vestido' ? elegir(rnd, ['largo', 'coleta', 'mono', 'rizado']) : elegir(rnd, PEINADOS);
  return persona({
    piel: elegir(rnd, PIELES),
    pelo: elegir(rnd, PELOS),
    peinado,
    ropa,
    camisa: elegir(rnd, ROPA),
    pantalon: elegir(rnd, PANTALONES),
    zapatos: elegir(rnd, ['#2a2a2e', '#f0f0f0', '#5a3b28', '#1b2a4a', '#b33a3a']),
    color2: elegir(rnd, ROPA),
    accesorio: rnd() < 0.45 ? elegir(rnd, ['mochila', 'bolso', 'gorra']) : null,
    altura: 0.92 + rnd() * 0.14,
    movil: rnd() < 0.3,
    ...extra,
  });
}

// ---------- Objetos ----------

// Maleta rígida con costillas, cierre, asa extensible, ruedas y etiqueta con AirTag.
export function maleta({ color = '#d8342c' } = {}) {
  const g = new THREE.Group();
  const mCasco = mat(color, { rugosidad: 0.32, fisico: true, clearcoat: 0.6 });
  const mNegro = mat('#1a1a1d', { rugosidad: 0.5 });
  const mMetal = mat('#b9bec7', { metal: 1, rugosidad: 0.3 });
  const W = 0.44;
  const Hh = 0.64;
  const D = 0.27;
  const cuerpo = new THREE.Mesh(new RoundedBoxGeometry(W, Hh, D, 5, 0.06), mCasco);
  cuerpo.position.y = 0.1 + Hh / 2;
  g.add(cuerpo);
  // Costillas verticales en las dos caras.
  const costillas = [];
  for (const z of [-1, 1]) {
    for (let i = -2; i <= 2; i++) {
      costillas.push({ geo: new RoundedBoxGeometry(0.035, Hh - 0.1, 0.02, 2, 0.008), pos: new THREE.Vector3(i * 0.075, 0.1 + Hh / 2, z * (D / 2 + 0.004)) });
    }
  }
  g.add(fusionar(costillas, mCasco));
  // Cierre: una franja oscura que rodea la maleta.
  const cierre = new THREE.Mesh(new RoundedBoxGeometry(W + 0.006, Hh + 0.006, 0.018, 3, 0.05), mNegro);
  cierre.position.copy(cuerpo.position);
  g.add(cierre);
  // Asa extensible.
  const tubo = new THREE.CylinderGeometry(0.011, 0.011, 0.36, 8);
  for (const x of [-0.1, 0.1]) {
    const t = new THREE.Mesh(tubo, mMetal);
    t.position.set(x, 0.1 + Hh + 0.16, -D / 2 + 0.03);
    g.add(t);
  }
  const barra = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.04, 0.05, 2, 0.015), mNegro);
  barra.position.set(0, 0.1 + Hh + 0.34, -D / 2 + 0.03);
  g.add(barra);
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 20, Math.PI), mNegro);
  asa.position.set(0, 0.1 + Hh, 0.02);
  g.add(asa);
  // Cuatro ruedas giratorias.
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const soporte = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.05, 0.06, 2, 0.015), mNegro);
      soporte.position.set(x * (W / 2 - 0.05), 0.1, z * (D / 2 - 0.05));
      g.add(soporte);
      const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14).rotateZ(Math.PI / 2), mat('#0c0c0e', { rugosidad: 0.8 }));
      rueda.position.set(x * (W / 2 - 0.05), 0.04, z * (D / 2 - 0.05));
      g.add(rueda);
    }
  }
  // Etiqueta colgando del asa, con el AirTag que late.
  const etiqueta = new THREE.Group();
  etiqueta.position.set(0.05, 0.1 + Hh - 0.02, D / 2 + 0.02);
  const cuero = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.1, 0.018, 2, 0.01), mat('#6b4428', { rugosidad: 0.6 }));
  cuero.position.y = -0.07;
  etiqueta.add(cuero);
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 24).rotateX(Math.PI / 2), mat('#f4f6f8', { rugosidad: 0.2 }));
  tag.position.set(0, -0.07, 0.012);
  etiqueta.add(tag);
  const luz = destello('#7fe3ff', 0.22);
  luz.position.set(0, -0.07, 0.03);
  etiqueta.add(luz);
  g.add(etiqueta);
  g.add(sombra(0.75, 0.55));
  g.userData = {
    alto: 0.1 + Hh,
    airtag: luz,
    animar(t) {
      etiqueta.rotation.z = Math.sin(t * 1.7) * 0.06;
      luz.material.opacity = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 4), 2);
    },
  };
  return g;
}

// Pantalla tipo "Encontrar": mapa, punto azul, ruta, pin que cae y ficha del objeto.
export function uiBuscar(g, w, h, t, { objeto = 'Maleta', lugar = 'Rua Augusta, Lisboa' } = {}) {
  const calle = lugar.split(',')[0];
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, w, h);
  // Mapa: manzanas, río, parques y calles.
  const mapaH = h * 0.66;
  g.save();
  g.beginPath();
  g.rect(0, 0, w, mapaH);
  g.clip();
  g.fillStyle = '#2b303a';
  g.fillRect(0, 0, w, mapaH);
  const r = aleatorio(31);
  for (let fila = -1; fila < 12; fila++) {
    for (let col = -1; col < 6; col++) {
      const x = col * 96 + (fila % 2) * 18;
      const y = fila * 66 + 70;
      g.fillStyle = r() < 0.12 ? '#2f5b3d' : '#363c48';
      g.beginPath();
      g.roundRect(x + 8, y + 8, 80, 50, 6);
      g.fill();
    }
  }
  g.fillStyle = '#1d4a73';
  g.beginPath();
  g.moveTo(0, mapaH * 0.82);
  g.bezierCurveTo(w * 0.3, mapaH * 0.74, w * 0.7, mapaH * 0.92, w, mapaH * 0.8);
  g.lineTo(w, mapaH);
  g.lineTo(0, mapaH);
  g.fill();
  g.strokeStyle = '#e0b84a';
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(w * 0.52, 0);
  g.lineTo(w * 0.5, mapaH * 0.8);
  g.stroke();
  g.save();
  g.translate(w * 0.5 - 22, mapaH * 0.42);
  g.rotate(-Math.PI / 2 + 0.03);
  g.fillStyle = '#d8deea';
  g.font = '600 24px system-ui, sans-serif';
  g.fillText(calle, 0, 0);
  g.restore();
  // Tú (punto azul) y la ruta hasta la maleta.
  const yo = { x: w * 0.25, y: mapaH * 0.66 };
  const pin = { x: w * 0.505, y: mapaH * 0.36 };
  const kRuta = clamp((t - 1.0) / 0.8);
  if (kRuta > 0) {
    g.strokeStyle = '#3d8bff';
    g.lineWidth = 9;
    g.setLineDash([2, 16]);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(yo.x, yo.y);
    g.lineTo(lerp(yo.x, pin.x, kRuta), lerp(yo.y, yo.y, kRuta));
    if (kRuta > 0.5) g.lineTo(pin.x, lerp(yo.y, pin.y + 60, (kRuta - 0.5) * 2));
    g.stroke();
    g.setLineDash([]);
  }
  const pulso = (t * 0.8) % 1;
  g.fillStyle = `rgba(61,139,255,${0.35 * (1 - pulso)})`;
  g.beginPath();
  g.arc(yo.x, yo.y, 16 + pulso * 40, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(yo.x, yo.y, 17, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3d8bff';
  g.beginPath();
  g.arc(yo.x, yo.y, 12, 0, Math.PI * 2);
  g.fill();
  // Pin que cae y rebota.
  const kp = clamp((t - 0.35) / 0.7);
  if (kp > 0) {
    const rebote = kp < 1 ? Math.abs(Math.cos(kp * Math.PI * 1.5)) * (1 - kp) * 150 : 0;
    const y = pin.y - rebote;
    g.globalAlpha = clamp(kp * 3);
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath();
    g.ellipse(pin.x, pin.y + 62, 22, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(pin.x, y, 46, Math.PI * 0.78, Math.PI * 2.22);
    g.lineTo(pin.x, y + 64);
    g.closePath();
    g.fill();
    g.fillStyle = '#d8342c';
    g.beginPath();
    g.arc(pin.x, y, 38, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(pin.x - 14, y - 18, 28, 34, 5);
    g.fill();
    g.fillStyle = '#d8342c';
    g.fillRect(pin.x - 5, y - 24, 10, 7);
    g.globalAlpha = 1;
  }
  g.restore();
  // Barra de estado.
  g.fillStyle = '#ffffff';
  g.font = '700 30px system-ui, sans-serif';
  g.fillText('9:41', 48, 62);
  g.fillRect(w - 112, 44, 54, 24);
  g.fillStyle = '#20242c';
  g.fillRect(w - 108, 48, 40, 16);
  g.fillStyle = '#4cd964';
  g.fillRect(w - 108, 48, 34, 16);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) g.fillRect(w - 168 + i * 11, 64 - i * 6 - 6, 7, i * 6 + 6);
  g.fillStyle = '#000';
  g.beginPath();
  g.roundRect(w / 2 - 78, 26, 156, 46, 23);
  g.fill();
  // Ficha inferior.
  const kf = suave((t - 0.9) / 0.6);
  const y0 = lerp(h, mapaH - 30, kf);
  g.fillStyle = '#2c313b';
  g.beginPath();
  g.roundRect(0, y0, w, h - y0 + 40, 36);
  g.fill();
  g.fillStyle = '#5b6170';
  g.beginPath();
  g.roundRect(w / 2 - 36, y0 + 14, 72, 9, 5);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '800 40px system-ui, sans-serif';
  g.fillText('Objetos', 36, y0 + 76);
  g.fillStyle = '#d8342c';
  g.beginPath();
  g.arc(78, y0 + 150, 40, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(64, y0 + 132, 28, 36, 5);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '700 34px system-ui, sans-serif';
  g.fillText(objeto, 138, y0 + 142);
  g.fillStyle = '#a5acbb';
  g.font = '500 24px system-ui, sans-serif';
  g.fillText(lugar, 138, y0 + 176, w - 170);
  g.fillStyle = '#4cd964';
  g.font = '600 24px system-ui, sans-serif';
  g.fillText('Ahora', 138, y0 + 210);
  g.fillStyle = '#3d8bff';
  g.beginPath();
  g.roundRect(36, y0 + 245, w - 72, 74, 22);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '700 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('Cómo llegar', w / 2, y0 + 293);
  g.textAlign = 'left';
}

// iPhone con marco metálico, botones, cámaras traseras, isla y reflejo en el cristal.
// `dibujarPantalla(g, w, h, t)` pinta lo que se ve en pantalla.
export function iphone({ marco = '#8e9299', dibujarPantalla = null } = {}) {
  const g = new THREE.Group();
  const mMarco = mat(marco, { metal: 1, rugosidad: 0.22 });
  g.add(new THREE.Mesh(new RoundedBoxGeometry(2.0, 4.1, 0.2, 8, 0.3), mMarco));
  const espalda = new THREE.Mesh(new RoundedBoxGeometry(1.94, 4.04, 0.02, 6, 0.008), mat('#30333a', { rugosidad: 0.35, fisico: true, clearcoat: 1 }));
  espalda.position.z = -0.1;
  g.add(espalda);
  const isla = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.06, 4, 0.18), mat('#2a2d33', { rugosidad: 0.3 }));
  isla.position.set(-0.4, 1.45, -0.12);
  g.add(isla);
  for (const [x, y] of [[-0.6, 1.65], [-0.6, 1.25], [-0.22, 1.45]]) {
    const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 24).rotateX(Math.PI / 2), mat('#0b0c10', { metal: 0.6, rugosidad: 0.1 }));
    lente.position.set(x, y, -0.16);
    g.add(lente);
  }
  for (const [x, y, alto] of [[-1.01, 1.2, 0.18], [-1.01, 0.8, 0.35], [-1.01, 0.35, 0.35], [1.01, 0.9, 0.55]]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.04, alto, 0.06, 2, 0.015), mMarco);
    b.position.set(x, y, 0);
    g.add(b);
  }
  const vidrio = new THREE.Mesh(new RoundedBoxGeometry(1.92, 4.02, 0.012, 6, 0.27), mat('#05060a', { rugosidad: 0.05 }));
  vidrio.position.z = 0.098;
  g.add(vidrio);
  const lienzo = document.createElement('canvas');
  lienzo.width = 540;
  lienzo.height = 1170;
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.9), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  pantalla.position.z = 0.106;
  g.add(pantalla);
  // Reflejo diagonal del cristal.
  const reflejo = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.9), new THREE.MeshBasicMaterial({
    map: textura(64, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.42, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.10)');
      gr.addColorStop(0.62, 'rgba(255,255,255,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, w, h);
    }, { color: false }),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  reflejo.position.z = 0.108;
  g.add(reflejo);
  g.userData = {
    animar(t) {
      if (!dibujarPantalla) return;
      dibujarPantalla(lienzo.getContext('2d'), lienzo.width, lienzo.height, t);
      tex.needsUpdate = true;
    },
  };
  return g;
}

// AirTag con sus piezas; animar(k) lo abre (0 cerrado → 1 desarmado).
export function airtag() {
  const g = new THREE.Group();
  const perfil = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI / 2;
    perfil.push(new THREE.Vector2(1.6 - 0.32 * (1 - Math.cos(a)), Math.sin(a) * 0.4));
  }
  perfil.unshift(new THREE.Vector2(1.6, -0.06));
  perfil.push(new THREE.Vector2(0, 0.42));
  const placa = textura(512, 512, (c, w) => {
    c.fillStyle = '#16753a';
    c.beginPath();
    c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#e1bd55';
    c.lineWidth = 4;
    const r = aleatorio(4);
    for (let i = 0; i < 34; i++) {
      c.beginPath();
      let x = 100 + r() * 310;
      let y = 100 + r() * 310;
      c.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        if (r() < 0.5) x += (r() - 0.5) * 140; else y += (r() - 0.5) * 140;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.fillStyle = '#0f0f12';
    c.fillRect(196, 206, 120, 100);
    c.fillStyle = '#2b2b30';
    c.fillRect(140, 330, 64, 44);
    c.fillRect(326, 140, 56, 56);
    c.fillStyle = '#c8c8c8';
    for (let i = 0; i < 6; i++) c.fillRect(150 + i * 36, 410, 18, 10);
  });
  const pila = textura(512, 512, (c, w) => {
    const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, '#e4e7eb');
    gr.addColorStop(1, '#9aa1aa');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, w);
    c.fillStyle = '#6b727c';
    c.font = '800 64px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('CR2032', w / 2, w / 2 + 10);
    c.font = '600 40px system-ui, sans-serif';
    c.fillText('3V  +', w / 2, w / 2 + 70);
  });
  const piezas = [
    new THREE.Mesh(new THREE.LatheGeometry(perfil, 72), mat('#f5f7f9', { rugosidad: 0.12, fisico: true, clearcoat: 1, side: THREE.DoubleSide })),
    new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.07, 72), [
      mat('#16753a', { rugosidad: 0.5 }), new THREE.MeshStandardMaterial({ map: placa, roughness: 0.45, metalness: 0.15 }), mat('#105a2b'),
    ]),
    new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 72), [
      mat('#c3c8cf', { metal: 1, rugosidad: 0.22 }), new THREE.MeshStandardMaterial({ map: pila, metalness: 0.9, roughness: 0.3 }), mat('#aab0b8', { metal: 1, rugosidad: 0.3 }),
    ]),
    new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.12, 16, 90).rotateX(Math.PI / 2).scale(1, 0.4, 1), mat('#c8743c', { metal: 1, rugosidad: 0.28 })),
    new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.52, 0.16, 72), mat('#d6dade', { metal: 1, rugosidad: 0.14 })),
  ];
  const nombres = ['Tapa', 'Bluetooth + chip', 'Pila CR2032', 'Antena', 'Base de acero'];
  const cerrado = [0.18, 0.08, -0.06, -0.18, -0.3];
  const abierto = [2.3, 1.2, 0.12, -0.95, -2.05];
  piezas.forEach((p) => g.add(p));
  g.userData = {
    piezas,
    anclas: () => piezas.map((p, i) => ({ pos: p.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(1.9, 0, 0)), texto: nombres[i] })),
    animar(t, k = 0) {
      piezas.forEach((p, i) => { p.position.y = lerp(cerrado[i], abierto[i], suave(k)); });
    },
  };
  return g;
}

// Satélite con cuerpo de lámina dorada, paneles con marco, antena parabólica y luz.
export function satelite() {
  const g = new THREE.Group();
  const lamina = textura(256, 256, (c, w, h) => {
    const r = aleatorio(12);
    c.fillStyle = '#c99a32';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      c.fillStyle = `hsla(${38 + r() * 12},${60 + r() * 30}%,${35 + r() * 40}%,.55)`;
      c.beginPath();
      const x = r() * w;
      const y = r() * h;
      c.moveTo(x, y);
      for (let k = 0; k < 3; k++) c.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
      c.fill();
    }
  });
  g.add(new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1.4, 3, 0.06), new THREE.MeshStandardMaterial({ map: lamina, metalness: 0.9, roughness: 0.35 })));
  const celdas = textura(256, 128, (c, w, h) => {
    c.fillStyle = '#0d1d4a';
    c.fillRect(0, 0, w, h);
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 4; y++) {
        const gr = c.createLinearGradient(x * 32, y * 32, x * 32 + 32, y * 32 + 32);
        gr.addColorStop(0, '#2d5bd6');
        gr.addColorStop(1, '#16307e');
        c.fillStyle = gr;
        c.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
      }
    }
  });
  const mPanel = new THREE.MeshStandardMaterial({ map: celdas, metalness: 0.5, roughness: 0.25, emissive: '#2050c0', emissiveIntensity: 0.25, side: THREE.DoubleSide });
  const mMarco = mat('#c0c4cc', { metal: 1, rugosidad: 0.3 });
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 1.0), [mMarco, mMarco, mPanel, mPanel, mMarco, mMarco]);
      p.position.set(lado * (1.25 + i * 1.6), 0, 0);
      g.add(p);
    }
    const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8).rotateZ(Math.PI / 2), mMarco);
    brazo.position.x = lado * 0.6;
    g.add(brazo);
  }
  const plato = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 8, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), mat('#e8eaee', { rugosidad: 0.4, side: THREE.DoubleSide }));
  plato.position.y = -0.2;
  g.add(plato);
  const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), mMarco);
  antena.position.set(0.2, 0.7, 0.3);
  g.add(antena);
  const led = destello('#ff4d4d', 0.35);
  led.position.set(0.2, 0.97, 0.3);
  g.add(led);
  g.userData = { animar(t) { led.material.opacity = Math.sin(t * 6) > 0.6 ? 1 : 0.15; } };
  return g;
}

// Farol de Lisboa: base, poste con anillos, farola de cuatro cristales y remate.
export function farol({ luz = '#ffd28a' } = {}) {
  const g = new THREE.Group();
  const m = mat('#1f2329', { metal: 0.7, rugosidad: 0.45 });
  const piezas = [
    { geo: new THREE.CylinderGeometry(0.16, 0.2, 0.35, 12), pos: new THREE.Vector3(0, 0.17, 0) },
    { geo: new THREE.CylinderGeometry(0.05, 0.07, 3.6, 10), pos: new THREE.Vector3(0, 2.1, 0) },
    { geo: new THREE.TorusGeometry(0.075, 0.02, 6, 14).rotateX(Math.PI / 2), pos: new THREE.Vector3(0, 1.2, 0) },
    { geo: new THREE.TorusGeometry(0.065, 0.02, 6, 14).rotateX(Math.PI / 2), pos: new THREE.Vector3(0, 3.6, 0) },
    { geo: new THREE.CylinderGeometry(0.2, 0.14, 0.08, 4), pos: new THREE.Vector3(0, 3.92, 0) },
    { geo: new THREE.ConeGeometry(0.3, 0.32, 4), pos: new THREE.Vector3(0, 4.62, 0) },
    { geo: new THREE.SphereGeometry(0.06, 8, 6), pos: new THREE.Vector3(0, 4.82, 0) },
  ];
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) piezas.push({ geo: new THREE.BoxGeometry(0.025, 0.5, 0.025), pos: new THREE.Vector3(x * 0.17, 4.2, z * 0.17) });
  }
  g.add(fusionar(piezas, m));
  const cristal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.48, 4, 1, true), brilla(luz));
  cristal.position.y = 4.2;
  g.add(cristal);
  g.userData.foco = new THREE.Vector3(0, 4.2, 0);
  return g;
}

// Tranvía amarillo de Lisboa (tipo "28"), con ventanas iluminadas y pantógrafo.
export function tranvia() {
  const g = new THREE.Group();
  const lado = textura(512, 256, (c, w, h) => {
    c.fillStyle = '#f2c200';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f7f1e3';
    c.fillRect(0, 0, w, 30);
    c.fillStyle = '#7c5a12';
    c.fillRect(0, h - 40, w, 40);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = '#f6d48a';
      c.fillRect(18 + i * 61, 46, 48, 82);
      c.fillStyle = 'rgba(80,50,10,.35)';
      c.fillRect(18 + i * 61, 46, 48, 10);
    }
    c.fillStyle = '#c99a00';
    c.fillRect(0, 140, w, 6);
  });
  const ladoBrillo = textura(512, 256, (c, w, h) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffb860';
    for (let i = 0; i < 8; i++) c.fillRect(18 + i * 61, 46, 48, 82);
  });
  const frente = textura(256, 256, (c, w, h) => {
    c.fillStyle = '#f2c200';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f7f1e3';
    c.fillRect(0, 0, w, 30);
    c.fillStyle = '#1c2230';
    c.fillRect(30, 46, w - 60, 90);
    c.fillStyle = '#111';
    c.fillRect(70, 6, 116, 22);
    c.fillStyle = '#ffcf4d';
    c.font = '800 20px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('28  ESTRELA', w / 2, 24);
    c.fillStyle = '#7c5a12';
    c.fillRect(0, h - 40, w, 40);
  });
  const mLado = new THREE.MeshStandardMaterial({ map: lado, emissiveMap: ladoBrillo, emissive: '#ffffff', emissiveIntensity: 1.2, roughness: 0.5 });
  const mFrente = new THREE.MeshStandardMaterial({ map: frente, roughness: 0.4 });
  const mTecho = mat('#f7f1e3', { rugosidad: 0.6 });
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 8), [mLado, mLado, mTecho, mTecho, mFrente, mFrente]);
  cuerpo.position.y = 1.55;
  g.add(cuerpo);
  const techo = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.3, 7.6, 3, 0.12), mTecho);
  techo.position.y = 2.9;
  g.add(techo);
  const mMetal = mat('#2a2d33', { metal: 0.8, rugosidad: 0.4 });
  const vara = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.9, 6), mMetal);
  vara.position.set(0, 4.3, -1.2);
  vara.rotation.x = -0.55;
  g.add(vara);
  for (const x of [-0.75, 0.75]) {
    for (const z of [-1, 1]) {
      const faro = destello('#fff2c8', 0.9);
      faro.position.set(x, 0.85, z * 4.02);
      g.add(faro);
    }
  }
  g.add(sombra(3, 9));
  return g;
}

// Mosquito (Aedes): cuerpo rayado, patas largas con bandas blancas, alas que baten.
export function mosquito({ macho = false, color = '#1b1a1f' } = {}) {
  const g = new THREE.Group();
  const rayas = textura(64, 256, (c, w, h) => {
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#b9bcc4';
    for (let y = 18; y < h; y += 34) c.fillRect(0, y, w, 7);
  });
  const rayasPata = textura(32, 256, (c, w, h) => {
    c.fillStyle = '#2a2a30';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e4e6ea';
    for (let y = 10; y < h; y += 28) c.fillRect(0, y, w, 9);
  });
  const mCuerpo = new THREE.MeshStandardMaterial({ map: rayas, roughness: 0.45 });
  const mOscuro = mat(color, { rugosidad: 0.4 });
  const torax = new THREE.Mesh(G.bolita, mOscuro);
  torax.scale.set(0.12, 0.11, 0.15);
  g.add(torax);
  const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.42, 6, 14), mCuerpo);
  abdomen.position.set(0, -0.04, -0.33);
  abdomen.rotation.x = Math.PI / 2 - 0.25;
  g.add(abdomen);
  const cabeza = new THREE.Mesh(G.bolita, mOscuro);
  cabeza.scale.setScalar(0.065);
  cabeza.position.set(0, 0.0, 0.17);
  g.add(cabeza);
  for (const x of [-1, 1]) {
    const ojo = new THREE.Mesh(G.bolita, mat('#3a1010', { rugosidad: 0.2 }));
    ojo.scale.setScalar(0.035);
    ojo.position.set(x * 0.035, 0.01, 0.2);
    g.add(ojo);
  }
  const mPata = new THREE.MeshStandardMaterial({ map: rayasPata, roughness: 0.5 });
  const trompa = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.34, 6), mOscuro);
  unir(trompa, new THREE.Vector3(0, -0.02, 0.22), new THREE.Vector3(0, -0.2, 0.5));
  g.add(trompa);
  const antenas = [];
  for (const x of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.26, 5), mOscuro);
    unir(a, new THREE.Vector3(x * 0.02, 0.03, 0.22), new THREE.Vector3(x * 0.1, 0.15, 0.42));
    g.add(a);
    antenas.push(a);
    if (macho) {
      // Antenas plumosas del macho.
      for (let i = 1; i < 6; i++) {
        const pluma = destello('#d8d8d8', 0.06);
        pluma.position.lerpVectors(new THREE.Vector3(x * 0.02, 0.03, 0.22), new THREE.Vector3(x * 0.1, 0.15, 0.42), i / 6);
        g.add(pluma);
      }
    }
  }
  // Seis patas largas en tres tramos.
  const patas = [];
  for (const x of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = 0.06 - i * 0.07;
      const pts = [
        new THREE.Vector3(x * 0.05, -0.05, z),
        new THREE.Vector3(x * 0.32, 0.12, z + (i - 1) * 0.25),
        new THREE.Vector3(x * 0.5, -0.32, z + (i - 1) * 0.42),
        new THREE.Vector3(x * 0.56, -0.5, z + (i - 1) * 0.5),
      ];
      const p = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0055, 5), mPata);
      g.add(p);
      patas.push(p);
    }
  }
  // Alas translúcidas con borde.
  const forma = new THREE.Shape();
  forma.absellipse(0, 0.26, 0.07, 0.27, 0, Math.PI * 2);
  const geoAla = new THREE.ShapeGeometry(forma, 24);
  const mAla = new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const borde = new THREE.LineBasicMaterial({ color: '#e8f2ff', transparent: true, opacity: 0.6 });
  const alas = [-1, 1].map((x) => {
    const pivote = new THREE.Group();
    pivote.position.set(x * 0.04, 0.08, 0.0);
    const ala = new THREE.Mesh(geoAla, mAla);
    ala.add(new THREE.LineSegments(new THREE.EdgesGeometry(geoAla), borde));
    ala.rotation.set(-Math.PI / 2, 0, x * -1.9);
    pivote.add(ala);
    g.add(pivote);
    return { pivote, x };
  });
  g.userData = {
    animar(t) {
      const batida = Math.sin(t * 95);
      for (const a of alas) a.pivote.rotation.z = a.x * (0.15 + 0.55 * batida);
      for (const p of patas) p.rotation.x = Math.sin(t * 3 + p.id) * 0.03;
    },
  };
  return g;
}

// Molécula de bolas y palitos (olor, CO2…).
export function molecula({ semilla = 1, atomos = 9, colores = ['#3c3c42', '#f2f2f2', '#d8342c'] } = {}) {
  const g = new THREE.Group();
  const r = aleatorio(semilla);
  const pos = [new THREE.Vector3()];
  for (let i = 1; i < atomos; i++) {
    const base = pos[Math.floor(r() * pos.length)];
    pos.push(base.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.42)));
  }
  const centro = pos.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(-1 / pos.length);
  const mPalito = mat('#c9ccd3', { rugosidad: 0.4 });
  pos.forEach((p, i) => {
    p.add(centro);
    const color = i === 0 ? colores[0] : colores[Math.floor(r() * colores.length)];
    const a = new THREE.Mesh(G.bolita, mat(color, { rugosidad: 0.25, fisico: true, clearcoat: 0.7 }));
    a.scale.setScalar(color === colores[1] ? 0.11 : 0.16);
    a.position.copy(p);
    g.add(a);
    if (i > 0) {
      const cerca = pos.slice(0, i).reduce((m, q) => (q.distanceTo(p) < m.distanceTo(p) ? q : m));
      const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), mPalito);
      unir(palo, cerca, p);
      g.add(palo);
    }
  });
  return g;
}

// Doble hélice de ADN con peldaños de colores.
export function adn({ alto = 4, vueltas = 2.2 } = {}) {
  const g = new THREE.Group();
  const n = 46;
  const colores = ['#ff5d7a', '#38c8ff', '#ffd166', '#3ee6a0'];
  const esferas = [];
  const peldanos = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = k * Math.PI * 2 * vueltas;
    const y = (k - 0.5) * alto;
    const p1 = new THREE.Vector3(Math.cos(a) * 0.6, y, Math.sin(a) * 0.6);
    const p2 = new THREE.Vector3(-p1.x, y, -p1.z);
    esferas.push({ geo: G.bolita, pos: p1, esc: new THREE.Vector3(0.07, 0.07, 0.07) }, { geo: G.bolita, pos: p2, esc: new THREE.Vector3(0.07, 0.07, 0.07) });
    if (i % 2 === 0) {
      const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), mat(colores[i % 4], { emisivo: colores[i % 4], intensidad: 0.5 }));
      unir(palo, p1, p2);
      peldanos.push(palo);
    }
  }
  g.add(fusionar(esferas, mat('#e8f0ff', { emisivo: '#7fb8ff', intensidad: 0.6, rugosidad: 0.3 })));
  peldanos.forEach((p) => g.add(p));
  return g;
}

// Gota (de sangre por defecto), brillante como de cristal.
export function gota({ color = '#c8102e' } = {}) {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const k = i / 30;
    const a = k * Math.PI;
    const r = Math.sin(a) * (1 - Math.pow(1 - k, 3) * 0.0) * (0.6 + 0.4 * k) * 0.8;
    pts.push(new THREE.Vector2(Math.max(0.0001, r * Math.pow(k, 0.55)), 1.1 - k * 1.9));
  }
  const g = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat(color, { fisico: true, rugosidad: 0.08, clearcoat: 1, transmission: 0.25, thickness: 1 }));
  return g;
}

// Candado holográfico (todo es luz).
export function candado({ color = '#b18cff' } = {}) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.0, 0.35, 4, 0.12), aditivo(color, 0.35));
  g.add(cuerpo);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.2, 1.0, 0.35)), new THREE.LineBasicMaterial({ color })));
  const arco = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.07, 12, 30, Math.PI), aditivo(color, 0.7));
  arco.position.y = 0.5;
  g.add(arco);
  const ojo = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), brilla('#ffffff'));
  ojo.position.set(0, 0.05, 0.18);
  g.add(ojo);
  return g;
}

// Planeta de puntos con atmósfera.
export function planeta({ radio = 2, color = '#7fd0ff' } = {}) {
  const g = new THREE.Group();
  const pos = [];
  const n = 5000;
  const oro = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const lon = i * oro;
    const lat = Math.asin(y);
    const tierra = Math.sin(lon * 2.1) * Math.cos(lat * 3.2) + Math.sin(lon * 3.7 + 1) * 0.6 + Math.cos(lat * 5.1) * 0.3;
    if (tierra < 0.25) continue;
    pos.push(Math.cos(lon) * r * radio, y * radio, Math.sin(lon) * r * radio);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.95, toneMapped: false })));
  const nucleo = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.985, 48, 32), mat('#081428', { rugosidad: 1 }));
  g.add(nucleo);
  const atm = destello(color, radio * 3.2, 0.35);
  g.add(atm);
  return g;
}

// Tarjeta holográfica con líneas de texto (coordenadas, datos…).
export function tarjeta({ lineas = ['38.7104° N', '9.1366° O'], color = '#b18cff', ancho = 2.4 } = {}) {
  const t = textura(512, 256, (c, w, h) => {
    c.fillStyle = 'rgba(40,20,90,.55)';
    c.beginPath();
    c.roundRect(6, 6, w - 12, h - 12, 26);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = '700 54px system-ui, sans-serif';
    lineas.forEach((l, i) => c.fillText(l, 40, 92 + i * 80));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  return m;
}

// Tubo en Y de vidrio (experimentos de elección).
export function tuboY({ color = '#7fd0ff' } = {}) {
  const g = new THREE.Group();
  const mVidrio = new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, transmission: 0.9, thickness: 0.2, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const caminos = [
    [[0, -2.2, 0], [0, -0.6, 0], [0, 0, 0]],
    [[0, 0, 0], [-0.6, 0.8, 0], [-1.4, 1.9, 0]],
    [[0, 0, 0], [0.6, 0.8, 0], [1.4, 1.9, 0]],
  ];
  for (const c of caminos) {
    const curva = new THREE.CatmullRomCurve3(c.map((p) => new THREE.Vector3(...p)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 30, 0.22, 16), mVidrio));
  }
  for (const [x, y] of [[0, -2.5], [-1.6, 2.2], [1.6, 2.2]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), mVidrio);
    b.position.set(x, y, 0);
    g.add(b);
  }
  return g;
}

// ---------- Efectos ----------

// Ondas que se expanden en el suelo (Bluetooth, señal, sonido).
export function ondas({ color = '#7fe3ff', cuantas = 3, alcance = 9 } = {}) {
  const g = new THREE.Group();
  const anillos = Array.from({ length: cuantas }, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96).rotateX(-Math.PI / 2), aditivo(color, 0));
    g.add(m);
    return m;
  });
  g.userData = {
    radio: (t, i) => 0.3 + ((t * 0.45 + i / cuantas) % 1) * alcance,
    animar(t, fuerza = 1) {
      anillos.forEach((m, i) => {
        const f = (t * 0.45 + i / cuantas) % 1;
        m.scale.setScalar(0.3 + f * alcance);
        m.material.opacity = fuerza * (1 - f) * 0.9;
        m.visible = fuerza > 0;
      });
    },
  };
  return g;
}

// Rayo de luz entre dos puntos.
export function rayo(color = '#ffd166', grosor = 0.03) {
  return new THREE.Mesh(new THREE.CylinderGeometry(grosor, grosor, 1, 8, 1, true), aditivo(color, 0.8));
}

// Partículas que suben y se dispersan (vapor, CO2, olor, polvo).
export function particulas({ n = 400, color = '#bfe8ff', tam = 0.05, area = 0.5, alto = 2.5, semilla = 3 } = {}) {
  const r = aleatorio(semilla);
  const base = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) base.set([(r() - 0.5) * area, r(), (r() - 0.5) * area, r() * 6.28], i * 4);
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({
    color, size: tam, map: TEX.brillo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  p.frustumCulled = false;
  p.userData = {
    animar(t, fuerza = 1, viento = new THREE.Vector3(0, 0, 0)) {
      for (let i = 0; i < n; i++) {
        const [x, k0, z, f] = base.subarray(i * 4, i * 4 + 4);
        const k = (k0 + t * 0.18) % 1;
        const abre = 0.3 + k * 2.2;
        pos[i * 3] = x * abre + Math.sin(t * 0.9 + f) * 0.15 * k + viento.x * k;
        pos[i * 3 + 1] = k * alto;
        pos[i * 3 + 2] = z * abre + Math.cos(t * 0.7 + f) * 0.15 * k + viento.z * k;
      }
      geo.attributes.position.needsUpdate = true;
      p.material.opacity = fuerza * 0.8;
      p.visible = fuerza > 0;
    },
  };
  return p;
}

// Estrellas lejanas.
export function estrellas({ n = 900, radio = 140, semilla = 8 } = {}) {
  const r = aleatorio(semilla);
  const pos = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const b = r() * Math.PI * 0.45;
    pos.push(Math.cos(a) * Math.cos(b) * radio, Math.sin(b) * radio + 10, Math.sin(a) * Math.cos(b) * radio);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: '#dfe8ff', size: 0.6, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.9, toneMapped: false }));
}

// Piso de estudio: cuadrícula que se desvanece hacia los lados.
export function pisoCuadricula({ color = '#2f74ff', tam = 60, fondo = '#060b1a' } = {}) {
  const t = textura(1024, 1024, (c, w) => {
    const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, '#0e1a3a');
    gr.addColorStop(1, fondo);
    c.fillStyle = gr;
    c.fillRect(0, 0, w, w);
    c.strokeStyle = color;
    for (let i = 0; i <= 40; i++) {
      const d = Math.abs(i - 20) / 20;
      c.globalAlpha = 0.35 * (1 - d);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(i * w / 40, 0);
      c.lineTo(i * w / 40, w);
      c.stroke();
      c.beginPath();
      c.moveTo(0, i * w / 40);
      c.lineTo(w, i * w / 40);
      c.stroke();
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.3 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

// ---------- Estilo "líneas de contorno" ----------

// Superficie dibujada como cortes de líneas (como la cobija del video del mosquito).
// alto(x, z) da la altura; color(x, z) el color de cada punto.
export function superficieContorno({ ancho, largo, cortes = 70, puntos = 90, alto, color }) {
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < cortes; i++) {
    const z = (i / (cortes - 1) - 0.5) * largo;
    for (let j = 0; j < puntos - 1; j++) {
      for (const jj of [j, j + 1]) {
        const x = (jj / (puntos - 1) - 0.5) * ancho;
        pos.push(x, alto(x, z), z);
        c.set(color(x, z));
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, toneMapped: false }));
}

// Esfera hecha de anillos (cabezas, brazos en estilo de contorno).
export function anillosContorno({ radio = 0.11, anillos = 16, color = '#ffb347', escala = new THREE.Vector3(1, 1, 1) } = {}) {
  const pos = [];
  for (let i = 1; i < anillos; i++) {
    const y = (i / anillos) * 2 - 1;
    const r = Math.sqrt(1 - y * y) * radio;
    for (let k = 0; k < 40; k++) {
      for (const kk of [k, k + 1]) {
        const a = (kk / 40) * Math.PI * 2;
        pos.push(Math.cos(a) * r, y * radio, Math.sin(a) * r);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, toneMapped: false }));
  l.scale.copy(escala);
  return l;
}

// Caja oscura con bordes iluminados (muebles en estilo de contorno).
export function cajaContorno(ancho, alto, largo, { color = '#0d1426', borde = '#3d5a99', radio = 0.04 } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new RoundedBoxGeometry(ancho, alto, largo, 3, radio), mat(color, { rugosidad: 0.8 })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(ancho, alto, largo)), new THREE.LineBasicMaterial({ color: borde, transparent: true, opacity: 0.7 })));
  return g;
}

// ---------- Catálogo de piezas para el estudio ----------

// Cada entrada crea la pieza lista para mostrarse sola: { objeto, alto, animar? }.
export const piezas = {
  maleta: { descripcion: 'Maleta con AirTag', crear: () => { const o = maleta(); o.scale.setScalar(2.4); return o; } },
  airtag: { descripcion: 'AirTag (se abre)', crear: () => { const o = airtag(); o.scale.setScalar(0.65); o.rotation.x = 0.45; return o; } },
  iphone: { descripcion: 'iPhone con "Encontrar"', crear: () => iphone({ dibujarPantalla: (g, w, h, t) => uiBuscar(g, w, h, t) }) },
  satelite: { descripcion: 'Satélite', crear: () => { const o = satelite(); o.scale.setScalar(0.7); return o; } },
  mosquito: { descripcion: 'Mosquito', crear: () => { const o = mosquito(); o.scale.setScalar(3); return o; } },
  macho: { descripcion: 'Mosquito macho', crear: () => { const o = mosquito({ macho: true }); o.scale.setScalar(3); return o; } },
  molecula: { descripcion: 'Molécula', crear: () => { const o = molecula({ semilla: 5, atomos: 12 }); o.scale.setScalar(2.4); return o; } },
  adn: { descripcion: 'ADN', crear: () => adn() },
  gota: { descripcion: 'Gota de sangre', crear: () => gota() },
  candado: { descripcion: 'Candado holográfico', crear: () => { const o = candado(); o.scale.setScalar(1.6); return o; } },
  planeta: { descripcion: 'Planeta de puntos', crear: () => planeta() },
  tranvia: { descripcion: 'Tranvía de Lisboa', crear: () => { const o = tranvia(); o.scale.setScalar(0.5); o.rotation.y = 0.9; o.position.y = -1.2; return o; } },
  farol: { descripcion: 'Farol de Lisboa', crear: () => { const o = farol(); o.scale.setScalar(0.8); o.position.y = -1.9; return o; } },
  tubo: { descripcion: 'Tubo en Y (experimento)', crear: () => { const o = tuboY(); o.scale.setScalar(0.8); return o; } },
  persona: { descripcion: 'Persona', crear: () => { const o = personaAleatoria(aleatorio(4)); o.scale.setScalar(2.2); o.position.y = -1.9; return o; } },
};
