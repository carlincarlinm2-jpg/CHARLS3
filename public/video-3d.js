// Mundos 3D de la Fábrica de videos (Three.js).
//
// Un mundo es una escena 3D con "objetivos" a los que la cámara puede mirar. El guion
// elige el mundo, el foco y el movimiento de cámara:
//   [3d: calle | foco: maleta | camara: subir]
// Escenas seguidas del mismo mundo comparten la escena 3D y la cámara viaja de una a
// otra sin corte. Para añadir un mundo: mundo('nombre', { descripcion, ejemplo, crear }).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const F = window.Fabrica;
const MEZCLA = 1.2; // segundos que tarda la cámara en viajar de una escena a la siguiente

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const suave = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const normal = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const mundos = {};
const instancias = {};

function mundo(nombre, def) { mundos[nombre] = def; }

// ---------- Utilidades para construir mundos ----------

function textura(ancho, alto, dibujar) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  dibujar(c.getContext('2d'), ancho, alto);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Brillo redondo para destellos y luces (se suma a lo que hay detrás).
const TEX_BRILLO = textura(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, w, w);
});

function brillo(color, tam) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX_BRILLO, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(tam);
  return s;
}

// Sombra difusa bajo personas y objetos (más barata y suave que un mapa de sombras).
const TEX_SOMBRA = textura(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(0,0,0,.65)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, w, w);
});
const GEO_SOMBRA = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function sombra(tam) {
  const m = new THREE.Mesh(GEO_SOMBRA, new THREE.MeshBasicMaterial({ map: TEX_SOMBRA, transparent: true, depthWrite: false }));
  m.scale.set(tam, 1, tam);
  m.position.y = 0.01;
  return m;
}

// Maniquí estilo "persona de prueba": cápsulas y esferas, con ciclo de caminar.
const GEO = {
  pierna: new THREE.CapsuleGeometry(0.085, 0.72, 4, 10).translate(0, -0.42, 0),
  brazo: new THREE.CapsuleGeometry(0.062, 0.5, 4, 10).translate(0, -0.3, 0),
  torso: new THREE.CapsuleGeometry(0.19, 0.42, 4, 14),
  cabeza: new THREE.SphereGeometry(0.135, 20, 16),
  pelo: new THREE.SphereGeometry(0.142, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  movil: new THREE.BoxGeometry(0.075, 0.15, 0.012),
};
const mate = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

function maniqui({ camisa, pantalon = '#1d2a4a', piel = '#e2b48f', pelo = '#3b2a20', movil = false }) {
  const g = new THREE.Group();
  const mCamisa = mate(camisa);
  const mPantalon = mate(pantalon);
  const piernas = [-1, 1].map((lado) => {
    const p = new THREE.Group();
    p.position.set(lado * 0.1, 0.95, 0);
    p.add(new THREE.Mesh(GEO.pierna, mPantalon));
    g.add(p);
    return p;
  });
  const torso = new THREE.Mesh(GEO.torso, mCamisa);
  torso.position.y = 1.3;
  torso.scale.set(1.12, 1, 0.7);
  g.add(torso);
  const brazos = [-1, 1].map((lado) => {
    const b = new THREE.Group();
    b.position.set(lado * 0.27, 1.53, 0);
    b.add(new THREE.Mesh(GEO.brazo, mCamisa));
    g.add(b);
    return b;
  });
  const cabeza = new THREE.Mesh(GEO.cabeza, mate(piel));
  cabeza.position.y = 1.76;
  g.add(cabeza);
  const cabello = new THREE.Mesh(GEO.pelo, mate(pelo));
  cabello.position.y = 1.77;
  cabello.rotation.x = -0.25;
  g.add(cabello);

  let pantalla = null;
  if (movil) {
    pantalla = mate('#111', { emissive: '#000000', emissiveIntensity: 3 });
    const m = new THREE.Mesh(GEO.movil, pantalla);
    m.position.set(0, -0.58, 0.04);
    brazos[1].add(m);
  }
  g.add(sombra(0.9));

  g.userData = {
    pantalla,
    caminar(fase) {
      const a = Math.sin(fase) * 0.55;
      piernas[0].rotation.x = a;
      piernas[1].rotation.x = -a;
      brazos[0].rotation.x = -a * 0.8;
      brazos[1].rotation.x = movil ? -1.05 : a * 0.8; // quien lleva el móvil lo mira
      torso.position.y = 1.3 + Math.abs(Math.cos(fase)) * 0.03;
    },
  };
  return g;
}

// Orienta un cilindro de altura 1 para que una dos puntos (rayos, cables).
const ARRIBA = new THREE.Vector3(0, 1, 0);
function unir(malla, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  malla.position.copy(a).addScaledVector(dir, 0.5);
  malla.scale.set(1, dir.length(), 1);
  malla.quaternion.setFromUnitVectors(ARRIBA, dir.normalize());
}

// ---------- Mundo: calle de noche ----------

mundo('calle', {
  descripcion: 'Calle empedrada de noche con gente caminando y una maleta. foco: maleta, persona, calle, cielo. efecto: bluetooth, satelites.',
  ejemplo: '[3d: calle | foco: maleta | camara: subir]',
  crear() {
    const escena = new THREE.Scene();
    const cielo = new THREE.Color('#0b0f26');
    escena.background = cielo;
    escena.fog = new THREE.Fog(cielo, 22, 85);
    escena.add(new THREE.HemisphereLight('#6a7bc4', '#3a2a24', 1.1));
    const luna = new THREE.DirectionalLight('#9fb4ff', 0.6);
    luna.position.set(-5, 20, 8);
    escena.add(luna);

    // Empedrado portugués: piedras claras con ondas oscuras.
    const piso = textura(512, 512, (g, w) => {
      g.fillStyle = '#4a4a4c';
      g.fillRect(0, 0, w, w);
      const rnd = aleatorio(3);
      const n = 32;
      const c = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const onda = Math.sin((i / n) * Math.PI * 4) * 2.2 + 6.5;
          const oscura = Math.abs(((j - onda) % 13 + 13) % 13) < 1.3;
          const v = oscura ? 34 + rnd() * 16 : 150 + rnd() * 40;
          g.fillStyle = `rgb(${v - 4},${v},${v + 6})`;
          const m = 1 + rnd() * 0.8;
          g.beginPath();
          g.roundRect(i * c + m, j * c + m, c - m * 2, c - m * 2, 3);
          g.fill();
        }
      }
    });
    piso.wrapS = piso.wrapT = THREE.RepeatWrapping;
    piso.repeat.set(5, 58);
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(14, 160), new THREE.MeshStandardMaterial({ map: piso, color: '#b8bcc8', roughness: 0.9 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.z = -60;
    escena.add(suelo);

    // Fachadas de colores con ventanas, algunas encendidas.
    const COLORES = ['#f2b544', '#5fae8f', '#e98a6b', '#7aa6d6', '#e9d27a', '#c97fa4', '#8fc5b5', '#f0d9b5', '#d9634f'];
    const fachadas = COLORES.map((color, ci) => {
      const rnd = aleatorio(10 + ci);
      const encendidas = [];
      const mapa = textura(256, 512, (g, w, h) => {
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        for (let piso = 0; piso < 4; piso++) {
          for (let col = 0; col < 3; col++) {
            const x = 22 + col * 80;
            const y = 30 + piso * 120;
            const luz = rnd() < 0.35;
            if (luz) encendidas.push([x, y]);
            g.fillStyle = 'rgba(0,0,0,.25)';
            g.fillRect(x - 6, y - 6, 56, 92);
            g.fillStyle = luz ? '#ffd38a' : '#1c2440';
            g.fillRect(x, y, 44, 80);
            g.fillStyle = 'rgba(255,255,255,.5)';
            g.fillRect(x - 8, y + 84, 60, 6);
          }
        }
      });
      const brilla = textura(256, 512, (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffb860';
        for (const [x, y] of encendidas) g.fillRect(x, y, 44, 80);
      });
      return { mapa, brilla };
    });
    const rnd = aleatorio(21);
    for (const lado of [-1, 1]) {
      for (let z = 14; z > -120;) {
        const largo = 5 + rnd() * 4;
        const alto = 9 + rnd() * 9;
        const f = fachadas[Math.floor(rnd() * fachadas.length)];
        const mapa = f.mapa.clone();
        const brilla = f.brilla.clone();
        for (const t of [mapa, brilla]) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(largo / 4.5, alto / 12);
          t.needsUpdate = true;
        }
        const mat = new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: brilla, emissive: '#ffffff', emissiveIntensity: 1.4, roughness: 0.85 });
        const edificio = new THREE.Mesh(new THREE.BoxGeometry(6, alto, largo), mat);
        edificio.position.set(lado * 10, alto / 2, z - largo / 2);
        escena.add(edificio);
        z -= largo + 0.15;
      }
    }

    // Faroles con luz cálida.
    const mPoste = mate('#22252e', { metalness: 0.6 });
    for (let i = 0; i < 9; i++) {
      const lado = i % 2 ? 1 : -1;
      const z = 8 - i * 8;
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), mPoste);
      poste.position.set(lado * 6.4, 2.1, z);
      escena.add(poste);
      const farol = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
      farol.position.set(lado * 6.4, 4.3, z);
      escena.add(farol);
      const b = brillo('#ffb45a', 3.2);
      b.position.copy(farol.position);
      escena.add(b);
      const luz = new THREE.PointLight('#ffb45a', 28, 0, 1.6);
      luz.position.copy(farol.position);
      escena.add(luz);
    }

    // La maleta, con el AirTag que late por dentro.
    const maleta = new THREE.Group();
    const rayas = textura(128, 256, (g, w, h) => {
      g.fillStyle = '#d8342c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.22)';
      for (let x = 8; x < w; x += 20) g.fillRect(x, 0, 5, h);
    });
    const mMaleta = new THREE.MeshStandardMaterial({ map: rayas, roughness: 0.45 });
    const cuerpo = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.7, 0.3, 4, 0.05), mMaleta);
    cuerpo.position.y = 0.42;
    maleta.add(cuerpo);
    const asa = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20, Math.PI), mate('#1a1a1a'));
    asa.position.set(0, 0.77, 0);
    maleta.add(asa);
    for (const x of [-0.18, 0.18]) {
      const rueda = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mate('#111'));
      rueda.position.set(x, 0.05, 0.1);
      maleta.add(rueda);
    }
    const chispa = brillo('#7fe3ff', 0.5);
    chispa.position.set(0.12, 0.55, 0.16);
    maleta.add(chispa);
    maleta.add(sombra(1));
    maleta.position.set(-0.4, 0, 0);
    maleta.rotation.y = 0.35;
    escena.add(maleta);

    // Gente caminando en ambos sentidos.
    const CAMISAS = ['#4f7bd9', '#c0504d', '#8c6bb1', '#e0a24a', '#4aa38b', '#9b9b9b', '#d97a9c', '#6b8e23', '#3d5a80'];
    const gente = [];
    const rg = aleatorio(77);
    for (let i = 0; i < 34; i++) {
      const p = maniqui({ camisa: CAMISAS[i % CAMISAS.length], movil: rg() < 0.3 });
      const sentido = rg() < 0.5 ? 1 : -1;
      // Dejan libre el carril de la maleta y del protagonista.
      const x = (rg() < 0.5 ? -1 : 1) * (2.3 + rg() * 2.4);
      gente.push({ p, x, z0: -100 + rg() * 115, sentido, vel: 1 + rg() * 0.5, fase: rg() * 6 });
      p.rotation.y = sentido > 0 ? 0 : Math.PI;
      escena.add(p);
    }
    // Protagonista: el desconocido que pasa junto a la maleta con su iPhone.
    const heroe = maniqui({ camisa: '#4a8fe7', movil: true });
    escena.add(heroe);
    const aura = brillo('#7fe3ff', 0.9);
    escena.add(aura);

    // Ondas de Bluetooth que salen de la maleta.
    const ondas = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.97, 1, 96).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.position.set(maleta.position.x, 0.08, maleta.position.z);
      escena.add(m);
      return m;
    });

    // Satélites que reciben la ubicación del iPhone.
    const panel = textura(128, 64, (g, w, h) => {
      g.fillStyle = '#1b3f8f';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#7fb0ff';
      g.lineWidth = 2;
      for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
    const mPanel = new THREE.MeshStandardMaterial({ map: panel, emissiveMap: panel, emissive: '#ffffff', emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const satelites = [[-7, 24, -14], [3, 27, -20], [9, 22, -8]].map(([x, y, z], i) => {
      const s = new THREE.Group();
      s.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.3), mate('#d9b44a', { metalness: 0.7, roughness: 0.3 })));
      for (const lado of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1), mPanel);
        p.position.x = lado * 1.85;
        s.add(p);
      }
      s.position.set(x, y, z);
      s.rotation.set(0.4, i, 0.2);
      escena.add(s);
      const rayo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      escena.add(rayo);
      return { s, rayo };
    });

    const camara = new THREE.PerspectiveCamera(50, F.W / F.H, 0.1, 300);
    const posHeroe = new THREE.Vector3();
    const posMovil = new THREE.Vector3();

    // El protagonista cruza junto a la maleta a mitad de la primera escena con bluetooth
    // (o con foco en él) de la cadena actual; así su paseo es continuo entre escenas.
    function momentoCruce(s) {
      const cadena = [s];
      while (cadena[0].anterior && enlaza(cadena[0].anterior, cadena[0])) cadena.unshift(cadena[0].anterior);
      const clave = cadena.find((x) => normal(x.op.efecto) === 'bluetooth' || normal(x.op.foco) === 'persona');
      return clave ? clave.inicio + clave.dur * 0.5 : cadena[0].inicio + 4;
    }

    return {
      escena,
      camara,
      bloom: 0.55,
      objetivos: {
        maleta: { pos: () => new THREE.Vector3(maleta.position.x, 0.45, maleta.position.z), dist: 3.2, yaw: 0.45, pitch: 0.12 },
        persona: { pos: () => posHeroe.clone().setY(1.25), dist: 4.2, yaw: -0.7, pitch: 0.1 },
        calle: { pos: () => new THREE.Vector3(0, 2.5, -14), dist: 16, yaw: 0, pitch: 0.12 },
        cielo: { pos: () => new THREE.Vector3(posHeroe.x, 11, posHeroe.z - 8), dist: 15, yaw: 0.35, pitch: -0.55 },
      },
      // La cámara nunca atraviesa las fachadas ni el suelo.
      limitar(pos) {
        pos.x = clamp(pos.x, -5.5, 5.5);
        pos.y = Math.max(0.35, pos.y);
      },
      actualizar(tAbs, s, t) {
        for (const g of gente) {
          const z = ((g.z0 + g.sentido * g.vel * tAbs) % 115 + 115) % 115 - 100;
          g.p.position.set(g.x, 0, z);
          g.p.userData.caminar(tAbs * g.vel * 4.2 + g.fase);
        }
        const cruce = momentoCruce(s);
        posHeroe.set(maleta.position.x + 1.05, 0, maleta.position.z + (tAbs - cruce) * 1.05);
        heroe.position.copy(posHeroe);
        heroe.userData.caminar(tAbs * 4.4);

        const efecto = normal(s.op.efecto);
        const entra = suave(t / 0.6);
        // Bluetooth: ondas que se expanden; cuando una alcanza al iPhone, se ilumina.
        const bt = efecto === 'bluetooth' ? entra : 0;
        let alcanza = 0;
        ondas.forEach((o, i) => {
          const f = (tAbs * 0.45 + i / 3) % 1;
          const r = 0.3 + f * 9;
          o.scale.setScalar(r);
          o.material.opacity = bt * (1 - f) * 0.9;
          o.visible = bt > 0;
          const d = posHeroe.distanceTo(maleta.position);
          if (Math.abs(d - r) < 0.8) alcanza = Math.max(alcanza, 1 - Math.abs(d - r) / 0.8);
        });
        chispa.material.opacity = 0.5 + 0.5 * Math.sin(tAbs * 5);
        const sat = efecto === 'satelites' ? entra : 0;
        const luzMovil = Math.max(bt * alcanza, sat);
        heroe.userData.pantalla.emissive.set('#7fe3ff').multiplyScalar(0.15 + luzMovil);
        posMovil.copy(posHeroe).add(new THREE.Vector3(0, 1.1, 0.35));
        aura.position.copy(posMovil);
        aura.material.opacity = luzMovil;

        satelites.forEach(({ s: sat3d, rayo }, i) => {
          sat3d.visible = sat > 0;
          sat3d.rotation.y = i + tAbs * 0.2;
          rayo.visible = sat > 0;
          unir(rayo, posMovil, sat3d.position);
          rayo.material.opacity = sat * (0.45 + 0.35 * Math.sin(tAbs * 6 + i * 2));
        });
      },
    };
  },
});

// ---------- Mundo: iPhone con el mapa ----------

mundo('telefono', {
  descripcion: 'Un iPhone flotando con un mapa: cae un pin y llega la notificación. objeto: nombre, lugar: dirección.',
  ejemplo: '[3d: telefono | camara: acercar | objeto: Maleta | lugar: Rua Augusta, Lisboa]',
  crear(entorno) {
    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#1b1240');
    escena.environment = entorno;
    escena.add(new THREE.AmbientLight('#ffffff', 0.4));
    const clave = new THREE.DirectionalLight('#ffffff', 2);
    clave.position.set(3, 4, 6);
    escena.add(clave);

    // Luces desenfocadas de fondo (bokeh).
    const rnd = aleatorio(5);
    const bokeh = [];
    for (let i = 0; i < 40; i++) {
      const b = brillo(['#ff6fb5', '#5f8bff', '#ff9a4d', '#b37dff'][i % 4], 1 + rnd() * 2.5);
      b.position.set((rnd() * 2 - 1) * 9, (rnd() * 2 - 1) * 14, -6 - rnd() * 10);
      b.material.opacity = 0.35 + rnd() * 0.3;
      bokeh.push({ b, y0: b.position.y, v: 0.2 + rnd() * 0.4 });
      escena.add(b);
    }

    const movil = new THREE.Group();
    movil.add(new THREE.Mesh(
      new RoundedBoxGeometry(2.0, 4.1, 0.22, 6, 0.3),
      new THREE.MeshStandardMaterial({ color: '#2b2d33', metalness: 0.85, roughness: 0.25 }),
    ));
    const lienzo = document.createElement('canvas');
    lienzo.width = 480;
    lienzo.height = 1000;
    const tex = new THREE.CanvasTexture(lienzo);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 3.92), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    pantalla.position.z = 0.112;
    movil.add(pantalla);
    escena.add(movil);

    const camara = new THREE.PerspectiveCamera(40, F.W / F.H, 0.1, 100);
    const rm = aleatorio(9);
    const manzanas = [];
    for (let fila = 0; fila < 9; fila++) {
      for (let col = 0; col < 5; col++) manzanas.push({ fila, col, parque: rm() < 0.18 });
    }

    function dibujarPantalla(t, s) {
      const g = lienzo.getContext('2d');
      const w = lienzo.width;
      const h = lienzo.height;
      g.fillStyle = '#1d2333';
      g.fillRect(0, 0, w, h);
      for (const m of manzanas) {
        g.fillStyle = m.parque ? '#2f7a45' : '#2c3550';
        g.beginPath();
        g.roundRect(14 + m.col * 94, 60 + m.fila * 104, 80, 90, 10);
        g.fill();
      }
      // Calle principal.
      g.fillStyle = '#f2c94c';
      g.fillRect(w / 2 - 9, 0, 18, h);
      const lugar = s.op.lugar || 'Rua Augusta, Lisboa';
      const calle = lugar.split(',')[0];
      g.save();
      g.translate(w / 2 - 22, 300);
      g.rotate(-Math.PI / 2);
      g.fillStyle = '#c9d2e8';
      g.font = '600 26px system-ui, sans-serif';
      g.fillText(calle, 0, 0);
      g.restore();
      // Isla dinámica.
      g.fillStyle = '#000';
      g.beginPath();
      g.roundRect(w / 2 - 80, 22, 160, 44, 22);
      g.fill();
      // Pin que cae y rebota.
      const kp = clamp((t - 0.5) / 0.6);
      if (kp > 0) {
        const rebote = kp < 1 ? Math.abs(Math.cos(kp * Math.PI * 1.5)) * (1 - kp) * 160 : 0;
        const y = 470 - rebote;
        g.globalAlpha = clamp(kp * 3);
        g.fillStyle = 'rgba(242,201,76,.35)';
        g.beginPath();
        g.arc(w / 2, 470 + 46, 40 * (0.6 + 0.4 * Math.sin(t * 4) ** 2), 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#f2c94c';
        g.beginPath();
        g.arc(w / 2, y, 42, Math.PI * 0.8, Math.PI * 2.2);
        g.lineTo(w / 2, y + 70);
        g.closePath();
        g.fill();
        g.fillStyle = '#d8342c';
        g.beginPath();
        g.roundRect(w / 2 - 17, y - 22, 34, 42, 6);
        g.fill();
        g.globalAlpha = 1;
      }
      // Notificación que sube.
      const kn = suave((t - 1.3) / 0.6);
      if (kn > 0) {
        const y = h - 30 - 190 * kn;
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath();
        g.roundRect(26, y + 8, w - 52, 170, 30);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.roundRect(22, y, w - 44, 170, 30);
        g.fill();
        g.fillStyle = '#d8342c';
        g.beginPath();
        g.roundRect(48, y + 40, 80, 90, 14);
        g.fill();
        g.fillStyle = '#111';
        g.font = '700 40px system-ui, sans-serif';
        g.fillText(s.op.objeto || 'Maleta', 150, y + 70);
        g.fillStyle = '#555';
        g.font = '500 26px system-ui, sans-serif';
        g.fillText(lugar, 150, y + 110, w - 190);
        g.fillStyle = '#2e9e52';
        g.font = '600 24px system-ui, sans-serif';
        g.fillText('Ahora', 150, y + 145);
      }
      tex.needsUpdate = true;
    }

    return {
      escena,
      camara,
      bloom: 0.35,
      objetivos: {
        telefono: { pos: () => new THREE.Vector3(0, -0.2, 0), dist: 7.5, yaw: 0, pitch: 0.05 },
      },
      actualizar(tAbs, s, t) {
        movil.rotation.set(Math.sin(tAbs * 0.7) * 0.06, Math.sin(tAbs * 0.5) * 0.18 - 0.1, 0.04);
        movil.position.y = Math.sin(tAbs * 1.1) * 0.08;
        for (const b of bokeh) b.b.position.y = b.y0 + Math.sin(tAbs * b.v) * 0.8;
        dibujarPantalla(t, s);
      },
    };
  },
});

// ---------- Mundo: AirTag desarmado ----------

mundo('airtag', {
  descripcion: 'Un AirTag que se abre en sus piezas: tapa, placa, pila, bobina y base.',
  ejemplo: '[3d: airtag | camara: orbita]',
  crear(entorno) {
    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#0c1a3d');
    escena.environment = entorno;
    escena.add(new THREE.AmbientLight('#ffffff', 0.3));
    const clave = new THREE.DirectionalLight('#ffffff', 2.2);
    clave.position.set(4, 8, 6);
    escena.add(clave);
    const contra = new THREE.DirectionalLight('#5fb8ff', 2);
    contra.position.set(-6, -2, -5);
    escena.add(contra);
    const halo = brillo('#3d7bff', 14);
    halo.position.set(0, 0, -4);
    halo.material.opacity = 0.35;
    escena.add(halo);

    const tapaPerfil = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI / 2;
      tapaPerfil.push(new THREE.Vector2(Math.cos(a) * 1.6, Math.sin(a) * 0.45));
    }
    tapaPerfil.unshift(new THREE.Vector2(1.6, -0.05));
    const placa = textura(512, 512, (g, w) => {
      g.fillStyle = '#1c7a3c';
      g.beginPath();
      g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#d9b44a';
      g.lineWidth = 4;
      const r = aleatorio(4);
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        let x = 110 + r() * 290;
        let y = 110 + r() * 290;
        g.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          if (r() < 0.5) x += (r() - 0.5) * 140; else y += (r() - 0.5) * 140;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = '#111';
      g.fillRect(200, 210, 110, 90);
      g.fillStyle = '#333';
      g.fillRect(150, 330, 60, 40);
      g.fillRect(320, 150, 50, 50);
    });
    const pila = textura(512, 512, (g, w) => {
      g.fillStyle = '#cfd3d8';
      g.fillRect(0, 0, w, w);
      g.fillStyle = '#7d838c';
      g.font = '700 70px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('CR2032', w / 2, w / 2 + 25);
    });
    const piezas = [
      new THREE.Mesh(new THREE.LatheGeometry(tapaPerfil, 64), new THREE.MeshPhysicalMaterial({ color: '#f4f6f8', roughness: 0.18, clearcoat: 1, side: THREE.DoubleSide })),
      new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.07, 64), [
        new THREE.MeshStandardMaterial({ color: '#1c7a3c', roughness: 0.5 }),
        new THREE.MeshStandardMaterial({ map: placa, roughness: 0.45, metalness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: '#145c2c' }),
      ]),
      new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 64), [
        new THREE.MeshStandardMaterial({ color: '#c3c8cf', metalness: 1, roughness: 0.25 }),
        new THREE.MeshStandardMaterial({ map: pila, metalness: 0.9, roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ color: '#aab0b8', metalness: 1, roughness: 0.3 }),
      ]),
      new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.13, 16, 80).rotateX(Math.PI / 2).scale(1, 0.45, 1),
        new THREE.MeshStandardMaterial({ color: '#c8743c', metalness: 1, roughness: 0.3 })),
      new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.5, 0.16, 64),
        new THREE.MeshStandardMaterial({ color: '#d6dade', metalness: 1, roughness: 0.18 })),
    ];
    const cerrado = [0.18, 0.08, -0.06, -0.18, -0.3];
    const abierto = [2.2, 1.15, 0.1, -0.95, -2.0];
    const grupo = new THREE.Group();
    piezas.forEach((p) => grupo.add(p));
    grupo.rotation.x = 0.5;
    escena.add(grupo);
    const camara = new THREE.PerspectiveCamera(40, F.W / F.H, 0.1, 100);

    return {
      escena,
      camara,
      bloom: 0.3,
      objetivos: {
        airtag: { pos: () => new THREE.Vector3(0, 0, 0), dist: 13, yaw: 0, pitch: 0.12 },
      },
      actualizar(tAbs, s, t) {
        const k = suave((t - 0.4) / 1.6);
        piezas.forEach((p, i) => { p.position.y = lerp(cerrado[i], abierto[i], k); });
        grupo.rotation.y = tAbs * 0.4;
        grupo.position.y = Math.sin(tAbs * 1.2) * 0.1;
      },
    };
  },
});

// ---------- Cámara ----------

// Cada movimiento devuelve, para un avance k (0→1), cuánto se aleja (×dist del
// objetivo), cuánto gira alrededor (yaw) y cuánto sube o baja (pitch).
const MOVIMIENTOS = {
  fija: () => ({ dist: 1, yaw: 0, pitch: 0 }),
  orbita: (k) => ({ dist: 1, yaw: lerp(-0.6, 0.6, k), pitch: 0 }),
  acercar: (k) => ({ dist: lerp(1.45, 0.8, k), yaw: lerp(-0.12, 0.12, k), pitch: 0 }),
  alejar: (k) => ({ dist: lerp(0.8, 1.6, k), yaw: lerp(0.12, -0.12, k), pitch: lerp(0, 0.1, k) }),
  subir: (k) => ({ dist: lerp(0.55, 1.45, k), yaw: lerp(0.35, 0, k), pitch: lerp(-0.1, 0.35, k) }),
  bajar: (k) => ({ dist: lerp(1.45, 0.55, k), yaw: lerp(0, 0.35, k), pitch: lerp(0.35, -0.1, k) }),
  seguir: (k) => ({ dist: 1, yaw: lerp(-0.25, 0.25, k), pitch: 0 }),
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
  const claves = Object.keys(inst.objetivos);
  return inst.objetivos[normal(s.op.foco)] || inst.objetivos[claves[0]];
}

function pose(inst, s, t) {
  const obj = objetivo(inst, s);
  const mov = MOVIMIENTOS[normal(s.op.camara)] || MOVIMIENTOS.fija;
  const m = mov(suave(t / s.dur));
  const mira = obj.pos(s.inicio + t);
  const dist = obj.dist * m.dist;
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
  return { pos, mira };
}

// ---------- Render ----------

let renderer = null;
let composer = null;
let pasoEscena = null;
let bloom = null;
let mapaEntorno = null;

function iniciar() {
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(F.W, F.H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(F.W, F.H);
  pasoEscena = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  composer.addPass(pasoEscena);
  bloom = new UnrealBloomPass(new THREE.Vector2(F.W / 2, F.H / 2), 0.5, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
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

function dibujar(ctx, E, s, t) {
  const inst = instancia(s);
  if (!inst) {
    E.texto(`Mundo 3D desconocido: "${s.valor}"`, F.W / 2, 1080, { tam: 46, color: E.c.peligro });
    return;
  }
  inst.actualizar(s.inicio + t, s, t);
  const { pos, mira } = pose(inst, s, t);
  if (inst.limitar) inst.limitar(pos);
  inst.camara.position.copy(pos);
  inst.camara.lookAt(mira);
  pasoEscena.scene = inst.escena;
  pasoEscena.camera = inst.camara;
  bloom.strength = inst.bloom ?? 0.5;
  composer.render();
  ctx.drawImage(renderer.domElement, 0, 0, F.W, F.H);

  // La etiqueta se coloca bajo el objetivo, siguiéndolo en pantalla.
  if (s.op.etiqueta) {
    proyectado.copy(objetivo(inst, s).pos(s.inicio + t)).project(inst.camara);
    const x = clamp((proyectado.x + 1) / 2 * F.W, 260, F.W - 260);
    const y = clamp((1 - proyectado.y) / 2 * F.H + 230, 560, F.H - 260);
    E.etiqueta(s.op.etiqueta, x, y, E.c.acento, E.aparecer(t, 0.5, 0.4));
  }
}

try {
  iniciar();
  F.motor3d = { dibujar, enlaza, mundos, mundo, THREE };
  const def = F.escenas['3d'];
  def.descripcion = `Mundo 3D con cámara en movimiento. Mundos: ${Object.keys(mundos).join(', ')}. ` +
    `camara: ${Object.keys(MOVIMIENTOS).join(', ')}. Escenas seguidas del mismo mundo se unen sin corte.`;
} catch (err) {
  F.error3d = 'Tu navegador no puede mostrar 3D (WebGL).';
  console.error(err);
}
window.dispatchEvent(new Event('fabrica3d'));
