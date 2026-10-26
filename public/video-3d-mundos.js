// Mundos 3D de la Fábrica de videos, armados con piezas del kit (video-3d-kit.js).
// Para crear uno nuevo: mundo('nombre', { descripcion, ejemplo, crear(entorno) }),
// donde crear() devuelve { escena, camara, objetivos, actualizar(tAbs, s, t), ... }.
import { mundo, listo } from './video-3d.js';
import {
  THREE, RoundedBoxGeometry, clamp, lerp, suave, normal, aleatorio, elegir, textura, fusionar, mat, brilla,
  destello, sombra, luzPintada, unir, persona, personaAleatoria, maleta, iphone, uiBuscar, airtag, satelite,
  farol, tranvia, mosquito, ondas, rayo, particulas, estrellas, pisoCuadricula, tarjeta,
  superficieContorno, anillosContorno, cajaContorno, piezas,
} from './video-3d-kit.js';

const F = window.Fabrica;
const camara = (fov = 50) => new THREE.PerspectiveCamera(fov, F.W / F.H, 0.05, 400);
const en = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// Cadena de escenas seguidas del mismo mundo (para que los sucesos sean continuos).
function cadena(s) {
  const lista = [s];
  while (lista[0].anterior && lista[0].anterior.tipo === '3d' && normal(lista[0].anterior.valor) === normal(s.valor)) lista.unshift(lista[0].anterior);
  return lista;
}

// ---------- Calle de Lisboa ----------

function fachada(rnd, color, azulejo) {
  const encendidas = [];
  const COL = 512 / 3;
  const FILA = 256;
  const contraventana = elegir(rnd, ['#2f6b4a', '#6b3b2a', '#2a4a6b', '#3d3d3d']);
  const mapa = textura(512, 1024, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    if (azulejo) {
      // Azulejos: cuadritos con un motivo repetido.
      for (let y = 0; y < 768; y += 32) {
        for (let x = 0; x < w; x += 32) {
          g.fillStyle = (x + y) % 64 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.10)';
          g.fillRect(x + 1, y + 1, 30, 30);
          g.strokeStyle = 'rgba(255,255,255,.35)';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x + 16, y + 16, 8, 0, Math.PI * 2);
          g.stroke();
        }
      }
    } else {
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.05})`;
        g.fillRect(rnd() * w, rnd() * h, 3 + rnd() * 8, 3 + rnd() * 8);
      }
    }
    // Cornisas entre pisos.
    g.fillStyle = 'rgba(245,238,225,.9)';
    for (let f = 1; f <= 3; f++) g.fillRect(0, f * FILA - 10, w, 12);
    g.fillRect(0, 0, w, 16);
    // Ventanas de los pisos altos.
    for (let f = 0; f < 3; f++) {
      for (let c = 0; c < 3; c++) {
        const x = c * COL + COL / 2 - 34;
        const y = f * FILA + 60;
        const luz = rnd() < 0.42;
        if (luz) encendidas.push([x, y, 68, 130]);
        g.fillStyle = '#f2ede2';
        g.fillRect(x - 8, y - 8, 84, 146);
        g.fillStyle = luz ? '#ffcf86' : '#18203a';
        g.fillRect(x, y, 68, 130);
        if (luz) {
          const gr = g.createLinearGradient(x, y, x, y + 130);
          gr.addColorStop(0, 'rgba(255,240,200,.5)');
          gr.addColorStop(1, 'rgba(200,120,40,.3)');
          g.fillStyle = gr;
          g.fillRect(x, y, 68, 130);
        }
        g.fillStyle = '#f2ede2';
        g.fillRect(x + 31, y, 6, 130);
        g.fillRect(x, y + 50, 68, 5);
        if (rnd() < 0.5) {
          g.fillStyle = contraventana;
          g.fillRect(x - 30, y - 4, 20, 138);
          g.fillRect(x + 78, y - 4, 20, 138);
        }
      }
    }
    // Planta baja: escaparate y puerta.
    const y0 = 3 * FILA;
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(0, y0, w, FILA);
    g.fillStyle = '#ffd59a';
    g.fillRect(40, y0 + 60, 250, 160);
    encendidas.push([40, y0 + 60, 250, 160]);
    g.fillStyle = 'rgba(120,70,20,.45)';
    for (let i = 0; i < 4; i++) g.fillRect(56 + i * 58, y0 + 150 + (i % 2) * 20, 40, 70);
    g.fillStyle = '#3a2416';
    g.fillRect(340, y0 + 50, 110, 206);
    g.fillStyle = '#c9a046';
    g.fillRect(430, y0 + 150, 8, 8);
  });
  const luces = textura(512, 1024, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffb45a';
    for (const [x, y, ww, hh] of encendidas) g.fillRect(x, y, ww, hh);
  });
  return { mapa, luces };
}

mundo('calle', {
  descripcion: 'Calle de Lisboa de noche: gente caminando, tranvía, faroles y una maleta con AirTag. foco: maleta, persona, calle, cielo, tranvia. efecto: bluetooth, satelites.',
  ejemplo: '[3d: calle | foco: maleta | camara: subir]',
  crear() {
    const escena = new THREE.Scene();
    const cielo = new THREE.Color('#0a0e24');
    escena.background = cielo;
    escena.fog = new THREE.Fog(cielo, 24, 95);
    escena.add(new THREE.HemisphereLight('#7083d0', '#40302a', 1.0));
    const luna = new THREE.DirectionalLight('#a9bcff', 0.7);
    luna.position.set(-6, 22, 10);
    escena.add(luna);
    escena.add(estrellas());
    const lunaDisco = destello('#e8eeff', 9, 0.85);
    lunaDisco.position.set(-30, 55, -130);
    lunaDisco.material.fog = false;
    escena.add(lunaDisco);

    // Empedrado: ondas portuguesas en la calzada y piedra clara en las aceras.
    const empedrado = (claro) => textura(512, 512, (g, w) => {
      g.fillStyle = claro ? '#6a6863' : '#3e3e42';
      g.fillRect(0, 0, w, w);
      const r = aleatorio(claro ? 9 : 3);
      const n = 32;
      const c = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const onda = Math.sin((i / n) * Math.PI * 4) * 2.2 + 6.5;
          const oscura = !claro && Math.abs(((j - onda) % 13 + 13) % 13) < 1.3;
          const v = oscura ? 36 + r() * 16 : (claro ? 180 : 150) + r() * 38;
          g.fillStyle = `rgb(${v - 4},${v - 1},${v + 4})`;
          const m = 1 + r() * 0.9;
          g.beginPath();
          g.roundRect(i * c + m, j * c + m, c - m * 2, c - m * 2, 3);
          g.fill();
        }
      }
    }, { repetir: true });
    const calzada = empedrado(false);
    calzada.repeat.set(3.2, 60);
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(9, 170), mat('#aab0bd', { map: calzada, rugosidad: 0.88 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.z = -65;
    escena.add(suelo);
    const acera = empedrado(true);
    acera.repeat.set(1, 60);
    const mAcera = new THREE.MeshStandardMaterial({ map: acera, color: '#c8c6c0', roughness: 0.85 });
    const mBordillo = mat('#9c9a94', { rugosidad: 0.7 });
    for (const lado of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 170), mAcera);
      a.position.set(lado * 5.65, 0.07, -65);
      escena.add(a);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 170), mBordillo);
      b.position.set(lado * 4.5, 0.08, -65);
      escena.add(b);
    }

    // Rieles y catenaria del tranvía.
    const RIEL = 3.0;
    const mRiel = mat('#c9ced6', { metal: 1, rugosidad: 0.25 });
    escena.add(fusionar([-0.72, 0.72].map((d) => ({ geo: new THREE.BoxGeometry(0.07, 0.03, 170), pos: new THREE.Vector3(RIEL + d, 0.015, -65) })), mRiel));
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 170, 4).rotateX(Math.PI / 2), mat('#15171c'));
    cable.position.set(RIEL, 5.6, -65);
    escena.add(cable);

    // Edificios: fachada con ventanas, balcones, toldos y cornisas.
    const COLORES = ['#f2b544', '#5fae8f', '#e98a6b', '#7aa6d6', '#e9d27a', '#c97fa4', '#8fc5b5', '#f0d9b5', '#d9634f', '#9fb7d9'];
    const rnd = aleatorio(21);
    const variantes = COLORES.map((c, i) => ({ color: c, ...fachada(aleatorio(40 + i), c, i % 3 === 1) }));
    const balcones = [];
    const barandas = [];
    const cornisas = [];
    const toldos = [];
    const barras = textura(128, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, 6);
      g.fillRect(0, h - 6, w, 6);
      for (let x = 2; x < w; x += 12) g.fillRect(x, 0, 4, h);
    }, { color: false });
    const mBaranda = new THREE.MeshStandardMaterial({ color: '#1c1f26', alphaMap: barras, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
    const rayasToldo = (c1, c2) => textura(64, 64, (g, w, h) => {
      for (let x = 0; x < w; x += 16) { g.fillStyle = x % 32 ? c1 : c2; g.fillRect(x, 0, 16, h); }
    });
    const mToldos = [['#b8322c', '#f3ece0'], ['#2f6b4a', '#f3ece0'], ['#1f4a7a', '#f3ece0']].map(([a, b]) => new THREE.MeshStandardMaterial({ map: rayasToldo(a, b), roughness: 0.8, side: THREE.DoubleSide }));
    for (const lado of [-1, 1]) {
      for (let z = 16; z > -125;) {
        const largo = 4.5 * (1 + Math.floor(rnd() * 2));
        const alto = 12 + rnd() * 3.5;
        const v = elegir(rnd, variantes);
        const mapa = v.mapa.clone();
        const luces = v.luces.clone();
        for (const t of [mapa, luces]) {
          t.wrapS = THREE.RepeatWrapping;
          t.repeat.set(largo / 4.5, 1);
          t.needsUpdate = true;
        }
        const mFachada = new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: luces, emissive: '#ffffff', emissiveIntensity: 0.85, roughness: 0.85 });
        const mPared = mat(v.color, { rugosidad: 0.9 });
        const mTecho = mat('#5a2f24', { rugosidad: 0.9 });
        // Caras: +x, -x, arriba, abajo, +z, -z. La fachada mira a la calle.
        const caras = lado < 0 ? [mFachada, mPared, mTecho, mPared, mPared, mPared] : [mPared, mFachada, mTecho, mPared, mPared, mPared];
        const edificio = new THREE.Mesh(new THREE.BoxGeometry(6, alto, largo), caras);
        const zc = z - largo / 2;
        edificio.position.set(lado * 9.8, alto / 2, zc);
        escena.add(edificio);
        const xf = lado * 6.8; // plano de la fachada
        cornisas.push({ geo: new THREE.BoxGeometry(0.5, 0.35, largo + 0.1), pos: new THREE.Vector3(xf - lado * 0.2, alto - 0.2, zc) });
        // Ventanas: 3 por cada 4.5 m; la u de la textura corre en -z en la cara +x y en +z en la -x.
        const columnas = Math.round(largo / 1.5);
        for (let c = 0; c < columnas; c++) {
          const u = (c + 0.5) / columnas;
          const zv = lado < 0 ? z - u * largo : z - largo + u * largo;
          for (let f = 0; f < 3; f++) {
            if (rnd() > 0.38) continue;
            const yv = alto * (1 - (f * 256 + 200) / 1024);
            balcones.push({ geo: new THREE.BoxGeometry(0.55, 0.08, 1.05), pos: new THREE.Vector3(xf - lado * 0.27, yv, zv) });
            barandas.push({ geo: new THREE.PlaneGeometry(1.05, 0.55), pos: new THREE.Vector3(xf - lado * 0.54, yv + 0.3, zv), rot: new THREE.Euler(0, Math.PI / 2, 0) });
          }
        }
        if (rnd() < 0.6) {
          const ut = 155 / 512;
          const zt = lado < 0 ? z - ut * Math.min(4.5, largo) : z - largo + ut * Math.min(4.5, largo);
          const toldo = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), elegir(rnd, mToldos));
          toldo.position.set(xf - lado * 0.45, alto * 0.215 + 0.25, zt);
          toldo.rotation.set(-Math.PI / 2, 0, 0);
          toldo.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), lado * 0.55);
          toldos.push(toldo);
          escena.add(toldo);
        }
        z -= largo + 0.05;
      }
    }
    escena.add(fusionar(balcones, mat('#e9e2d4', { rugosidad: 0.8 })));
    escena.add(fusionar(barandas, mBaranda));
    escena.add(fusionar(cornisas, mat('#efe7d8', { rugosidad: 0.85 })));

    // Faroles: luz real solo en los cercanos; el resto, luz pintada en el suelo.
    for (let i = 0; i < 12; i++) {
      const lado = i % 2 ? 1 : -1;
      const z = 8 - i * 7;
      const f = farol();
      f.position.set(lado * 5.9, 0.14, z);
      escena.add(f);
      const foco = f.userData.foco.clone().add(f.position);
      const b = destello('#ffb45a', 3.0, 0.75);
      b.position.copy(foco);
      escena.add(b);
      const charco = luzPintada('#ffae55', 7, 0.22);
      charco.position.set(lado * 5.0, 0.16, z);
      escena.add(charco);
      if (i < 5) {
        const luz = new THREE.PointLight('#ffb45a', 9, 16, 1.6);
        luz.position.copy(foco);
        escena.add(luz);
      }
    }

    // Tranvía.
    const tram = tranvia();
    tram.position.x = RIEL;
    escena.add(tram);

    // Maleta con AirTag.
    const valija = maleta();
    valija.position.set(-0.4, 0, 0);
    valija.rotation.y = 0.35;
    escena.add(valija);

    // Gente: en las aceras y en el carril izquierdo; el de la derecha es del tranvía.
    const rg = aleatorio(77);
    const gente = [];
    for (let i = 0; i < 44; i++) {
      const zona = rg();
      const x = zona < 0.35 ? -(5.0 + rg() * 1.4) : zona < 0.7 ? 5.0 + rg() * 1.4 : -(2.2 + rg() * 1.8);
      const p = personaAleatoria(rg);
      const sentido = rg() < 0.5 ? 1 : -1;
      const parado = rg() < 0.1;
      p.rotation.y = parado ? rg() * 6 : (sentido > 0 ? 0 : Math.PI);
      escena.add(p);
      gente.push({ p, x, z0: -100 + rg() * 118, sentido, vel: 0.95 + rg() * 0.45, fase: rg() * 6, parado });
    }
    // Protagonista: el desconocido que pasa junto a la maleta mirando su iPhone.
    const heroe = persona({ camisa: '#3d7bd9', ropa: 'chaqueta', color2: '#f0ede6', pantalon: '#26324d', piel: '#e6b28e', pelo: '#2a1d16', peinado: 'corto', movil: true, accesorio: 'mochila', zapatos: '#f0f0f0' });
    escena.add(heroe);
    const aura = destello('#7fe3ff', 0.9, 0);
    escena.add(aura);

    // Efectos.
    const bt = ondas({ alcance: 9 });
    bt.position.set(valija.position.x, 0.17, valija.position.z);
    escena.add(bt);
    const sats = [[-8, 24, -16], [4, 28, -22], [10, 22, -9]].map((p, i) => {
      const s = satelite();
      s.position.set(...p);
      s.rotation.set(0.5, i * 1.3, 0.25);
      escena.add(s);
      const r = rayo('#ffd166', 0.025);
      escena.add(r);
      return { s, r };
    });
    const coords = tarjeta({ lineas: ['📍 38.7104° N', '    9.1366° O'], ancho: 1.6 });
    escena.add(coords);

    const cam = camara(50);
    const posHeroe = new THREE.Vector3();
    const posMovil = new THREE.Vector3();

    function momentoCruce(s) {
      const c = cadena(s);
      const clave = c.find((x) => normal(x.op.efecto) === 'bluetooth' || normal(x.op.foco) === 'persona');
      return clave ? clave.inicio + clave.dur * 0.5 : c[0].inicio + 4;
    }

    return {
      escena,
      camara: cam,
      bloom: 0.42,
      objetivos: {
        maleta: { pos: () => new THREE.Vector3(valija.position.x, 0.5, valija.position.z), dist: 3.0, yaw: 0.45, pitch: 0.14 },
        persona: { pos: () => posHeroe.clone().setY(1.25), dist: 4.0, yaw: -0.7, pitch: 0.1 },
        calle: { pos: () => new THREE.Vector3(0, 2.5, -14), dist: 16, yaw: 0, pitch: 0.12 },
        cielo: { pos: () => new THREE.Vector3(posHeroe.x, 11, posHeroe.z - 8), dist: 15, yaw: 0.35, pitch: -0.55 },
        tranvia: { pos: () => tram.position.clone().setY(1.6), dist: 9, yaw: -0.9, pitch: 0.15 },
      },
      limitar(pos) {
        pos.x = clamp(pos.x, -4.3, 4.3);
        pos.y = Math.max(0.35, pos.y);
      },
      actualizar(tAbs, s, t) {
        for (const g of gente) {
          if (g.parado) {
            g.p.position.set(g.x, g.x * g.x > 20 ? 0.14 : 0, -20 + (g.z0 % 30));
            g.p.userData.quieto(tAbs + g.fase);
            continue;
          }
          const z = ((g.z0 + g.sentido * g.vel * tAbs) % 118 + 118) % 118 - 100;
          g.p.position.set(g.x, Math.abs(g.x) > 4.6 ? 0.14 : 0, z);
          g.p.visible = z > -75;
          if (g.p.visible) g.p.userData.caminar(tAbs * g.vel * 4.4 + g.fase);
        }
        tram.position.z = 30 - ((tAbs * 5.5 + 60) % 175);
        valija.userData.animar(tAbs);

        const cruce = momentoCruce(s);
        posHeroe.set(valija.position.x + 1.05, 0, valija.position.z + (tAbs - cruce) * 1.05);
        heroe.position.copy(posHeroe);
        heroe.userData.caminar(tAbs * 4.6);
        posMovil.copy(posHeroe).add(new THREE.Vector3(-0.08, 1.12, 0.38));

        const efecto = normal(s.op.efecto);
        const entra = suave(t / 0.6);
        const fBt = efecto === 'bluetooth' ? entra : 0;
        bt.userData.animar(tAbs, fBt);
        let alcanza = 0;
        const d = posHeroe.distanceTo(valija.position);
        for (let i = 0; i < 3; i++) {
          const r = bt.userData.radio(tAbs, i);
          if (Math.abs(d - r) < 0.9) alcanza = Math.max(alcanza, 1 - Math.abs(d - r) / 0.9);
        }
        const fSat = efecto === 'satelites' ? entra : 0;
        const luz = Math.max(fBt * alcanza, fSat);
        heroe.userData.pantalla.emissive.set('#7fe3ff').multiplyScalar(0.2 + luz);
        aura.position.copy(posMovil);
        aura.material.opacity = luz;

        sats.forEach(({ s: sat, r }, i) => {
          sat.visible = fSat > 0;
          sat.rotation.y = i * 1.3 + tAbs * 0.15;
          sat.userData.animar(tAbs + i);
          r.visible = fSat > 0;
          unir(r, posMovil, sat.position);
          r.material.opacity = fSat * (0.5 + 0.3 * Math.sin(tAbs * 6 + i * 2));
        });
        coords.visible = fSat > 0;
        coords.material.opacity = suave((t - 1.2) / 0.6) * fSat;
        coords.position.copy(posHeroe).add(new THREE.Vector3(0, 2.6, 0));
        coords.lookAt(cam.position);
      },
    };
  },
});

// ---------- iPhone con "Encontrar" ----------

mundo('telefono', {
  descripcion: 'Un iPhone flotando con la app de buscar: mapa, ruta, pin que cae y ficha. objeto: nombre, lugar: dirección.',
  ejemplo: '[3d: telefono | camara: acercar | objeto: Maleta | lugar: Rua Augusta, Lisboa]',
  crear(entorno) {
    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#170f38');
    escena.environment = entorno;
    escena.add(new THREE.AmbientLight('#ffffff', 0.35));
    const clave = new THREE.DirectionalLight('#ffffff', 2.2);
    clave.position.set(3, 4, 6);
    escena.add(clave);
    const contra = new THREE.DirectionalLight('#b18cff', 2.5);
    contra.position.set(-4, 2, -5);
    escena.add(contra);
    const rnd = aleatorio(5);
    const bokeh = [];
    for (let i = 0; i < 46; i++) {
      const b = destello(['#ff6fb5', '#5f8bff', '#ff9a4d', '#b37dff'][i % 4], 1 + rnd() * 2.6, 0.3 + rnd() * 0.35);
      b.position.set((rnd() * 2 - 1) * 9, (rnd() * 2 - 1) * 14, -6 - rnd() * 10);
      bokeh.push({ b, y0: b.position.y, v: 0.2 + rnd() * 0.4 });
      escena.add(b);
    }
    let escenaActual = null;
    let tLocal = 0;
    const movil = iphone({ dibujarPantalla: (g, w, h) => uiBuscar(g, w, h, tLocal, escenaActual ? escenaActual.op : {}) });
    escena.add(movil);
    return {
      escena,
      camara: camara(40),
      bloom: 0.35,
      temblor: 0.5,
      objetivos: { telefono: { pos: () => new THREE.Vector3(0, -0.1, 0), dist: 7.5, yaw: 0, pitch: 0.05 } },
      actualizar(tAbs, s, t) {
        escenaActual = s;
        tLocal = t;
        movil.rotation.set(Math.sin(tAbs * 0.7) * 0.06, Math.sin(tAbs * 0.5) * 0.18 - 0.1, 0.04);
        movil.position.y = Math.sin(tAbs * 1.1) * 0.08;
        movil.userData.animar(t);
        for (const b of bokeh) b.b.position.y = b.y0 + Math.sin(tAbs * b.v) * 0.8;
      },
    };
  },
});

// ---------- AirTag desarmado ----------

mundo('airtag', {
  descripcion: 'Un AirTag que se abre en sus piezas con el nombre de cada una. piezas: no oculta los nombres.',
  ejemplo: '[3d: airtag | camara: orbita]',
  crear(entorno) {
    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#0b1838');
    escena.environment = entorno;
    escena.add(new THREE.AmbientLight('#ffffff', 0.25));
    const clave = new THREE.DirectionalLight('#ffffff', 2.4);
    clave.position.set(4, 8, 6);
    escena.add(clave);
    const contra = new THREE.DirectionalLight('#5fb8ff', 2.4);
    contra.position.set(-6, -2, -5);
    escena.add(contra);
    const halo = destello('#3d7bff', 16, 0.35);
    halo.position.set(0, 0, -5);
    escena.add(halo);
    const polvo = particulas({ n: 220, color: '#9fd8ff', tam: 0.06, area: 6, alto: 8, semilla: 2 });
    polvo.position.y = -4;
    escena.add(polvo);
    const tag = airtag();
    tag.rotation.x = 0.5;
    escena.add(tag);
    let apertura = 0;
    return {
      escena,
      camara: camara(40),
      bloom: 0.3,
      objetivos: { airtag: { pos: () => new THREE.Vector3(0, 0, 0), dist: 13, yaw: 0, pitch: 0.12 } },
      actualizar(tAbs, s, t) {
        apertura = (t - 0.4) / 1.6;
        tag.userData.animar(tAbs, clamp(apertura));
        tag.rotation.y = tAbs * 0.4;
        tag.position.y = Math.sin(tAbs * 1.2) * 0.1;
        tag.updateMatrixWorld(true);
        polvo.userData.animar(tAbs * 0.3, 0.6);
      },
      etiquetas(tAbs, s, t) {
        if (normal(s.op.piezas) === 'no') return [];
        return tag.userData.anclas().map((a, i) => ({ ...a, k: clamp((apertura - 1) * 3 - i * 0.4), color: 'acento' }));
      },
    };
  },
});

// ---------- Dormitorio (estilo líneas de contorno) ----------

mundo('dormitorio', {
  descripcion: 'Dos personas durmiendo, dibujadas con líneas de contorno, y mosquitos. foco: cama, persona, otra, cabeza, mosquito. efecto: enjambre, co2, calor.',
  ejemplo: '[3d: dormitorio | foco: cama | efecto: enjambre | camara: acercar]',
  crear() {
    const escena = new THREE.Scene();
    const fondo = new THREE.Color('#03060e');
    escena.background = fondo;
    escena.fog = new THREE.Fog(fondo, 6, 16);
    escena.add(new THREE.HemisphereLight('#4b6bb0', '#0a0a12', 0.9));
    const lampara = new THREE.PointLight('#ffb36b', 1.2, 4, 1.8);
    lampara.position.set(-1.75, 1.15, -1.0);
    escena.add(lampara);
    const piso = pisoCuadricula({ color: '#1e3a7a', tam: 30, fondo: '#03060e' });
    escena.add(piso);

    const NARANJA = '#ffae42';
    const CIAN = '#4fd2ff';
    const A = { x: -0.55, color: NARANJA };
    const B = { x: 0.55, color: CIAN };
    escena.add(en(cajaContorno(2.5, 0.42, 2.7), 0, 0.21, 0.05));
    escena.add(en(cajaContorno(2.6, 1.25, 0.12), 0, 0.62, -1.33));
    for (const x of [-1.75, 1.75]) escena.add(en(cajaContorno(0.55, 0.55, 0.5), x, 0.275, -1.0));
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.4, 10), mat('#1c2233'));
    pie.position.set(-1.75, 0.75, -1.0);
    escena.add(pie);
    const pantallaL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 16, 1, true), brilla('#8a6a48'));
    pantallaL.position.set(-1.75, 1.0, -1.0);
    escena.add(pantallaL);
    const brilloL = destello('#ffb36b', 1.0, 0.3);
    brilloL.position.copy(pantallaL.position);
    escena.add(brilloL);
    for (const p of [A, B]) {
      const almohada = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.16, 0.42, 4, 0.07), mat('#151d33', { rugosidad: 0.9 }));
      almohada.position.set(p.x, 0.5, -0.98);
      escena.add(almohada);
      const cabeza = anillosContorno({ radio: 0.13, anillos: 18, color: p.color, escala: new THREE.Vector3(0.95, 1.05, 1) });
      cabeza.rotation.x = Math.PI / 2;
      cabeza.position.set(p.x, 0.68, -0.9);
      escena.add(cabeza);
      p.cabeza = cabeza.position;
    }
    // Cobija de líneas con el relieve de los dos cuerpos.
    const cuerpo = (x, z, cx) => {
      const dx = (x - cx) / 0.3;
      const perfil = z < -0.75 ? 0 : z < -0.45 ? (z + 0.75) / 0.3 : 1 - Math.max(0, z - 0.25) * 0.55;
      return 0.2 * Math.exp(-dx * dx) * Math.max(0, perfil);
    };
    const c1 = new THREE.Color(NARANJA);
    const c2 = new THREE.Color(CIAN);
    const base = new THREE.Color('#2a3b66');
    const tmp = new THREE.Color();
    const manta = superficieContorno({
      ancho: 2.5, largo: 2.0, cortes: 78, puntos: 110,
      alto: (x, z) => {
        const borde = Math.max(0, Math.abs(x) - 1.05) / 0.2;
        return 0.47 + cuerpo(x, z + 0.1, A.x) + cuerpo(x, z + 0.1, B.x) + 0.03 * Math.sin(x * 7 + z * 3) * 0.3 - Math.min(1, borde) * 0.2;
      },
      color: (x, z) => {
        const a = cuerpo(x, z + 0.1, A.x) / 0.2;
        const b = cuerpo(x, z + 0.1, B.x) / 0.2;
        tmp.copy(base).lerp(c1, clamp(a * 1.1)).lerp(c2, clamp(b * 1.1));
        return tmp;
      },
    });
    manta.position.z = 0.15;
    escena.add(manta);
    // Brazo de A por fuera de la cobija: ahí pican.
    const brazo = anillosContorno({ radio: 0.07, anillos: 70, color: NARANJA, escala: new THREE.Vector3(1, 4.2, 1) });
    brazo.rotation.x = Math.PI / 2;
    brazo.rotation.z = 0.15;
    brazo.position.set(A.x - 0.36, 0.6, -0.25);
    escena.add(brazo);
    const blanco = new THREE.Vector3(A.x - 0.34, 0.66, -0.3);

    // Mosquitos.
    const rm = aleatorio(11);
    const enjambre = Array.from({ length: 18 }, (_, i) => {
      const m = mosquito();
      m.scale.setScalar(0.075);
      escena.add(m);
      return { m, fase: rm() * 10, r: 0.18 + rm() * 0.3, v: 0.8 + rm() * 0.9, h: rm(), i };
    });
    const protagonista = mosquito();
    protagonista.scale.setScalar(0.09);
    escena.add(protagonista);
    const posProta = new THREE.Vector3();

    // CO2 que exhalan y calor que desprende A.
    const co2A = particulas({ n: 420, color: '#cfeaff', tam: 0.035, area: 0.12, alto: 1.4, semilla: 4 });
    const co2B = particulas({ n: 160, color: '#cfeaff', tam: 0.035, area: 0.12, alto: 1.4, semilla: 6 });
    co2A.position.copy(A.cabeza).add(new THREE.Vector3(0, 0.08, 0.1));
    co2B.position.copy(B.cabeza).add(new THREE.Vector3(0, 0.08, 0.1));
    escena.add(co2A, co2B);
    const calor = [0, 1, 2].map((i) => {
      const d = destello('#ff5a2a', 1.1 - i * 0.2, 0);
      d.position.set(A.x, 0.75, -0.3 + i * 0.45);
      escena.add(d);
      return d;
    });

    const cam = camara(45);
    let fuerzaEnjambre = 0;
    return {
      escena,
      camara: cam,
      bloom: 0.6,
      objetivos: {
        cama: { pos: () => new THREE.Vector3(0, 0.5, -0.1), dist: 4.3, yaw: 0.35, pitch: 0.75 },
        persona: { pos: () => blanco.clone(), dist: 1.5, yaw: 0.3, pitch: 0.95 },
        otra: { pos: () => B.cabeza.clone(), dist: 1.6, yaw: -0.6, pitch: 0.5 },
        cabeza: { pos: () => A.cabeza.clone(), dist: 1.3, yaw: 0.25, pitch: 0.45 },
        mosquito: { pos: () => posProta.clone(), dist: 0.55, yaw: -0.5, pitch: 0.25 },
      },
      actualizar(tAbs, s, t) {
        const efecto = normal(s.op.efecto);
        const entra = suave(t / 0.8);
        // El enjambre se va cerrando sobre el brazo de A mientras dure el efecto.
        const objetivoEnj = efecto === 'enjambre' ? suave(t / Math.max(1.5, s.dur * 0.6)) : 0;
        fuerzaEnjambre = objetivoEnj;
        for (const e of enjambre) {
          const a = tAbs * e.v + e.fase;
          const radio = lerp(2.4, e.r, objetivoEnj);
          e.m.position.set(
            blanco.x + Math.cos(a) * radio,
            blanco.y + 0.12 + e.h * lerp(1.4, 0.25, objetivoEnj) + Math.sin(a * 1.7) * 0.06,
            blanco.z + Math.sin(a) * radio * 0.8,
          );
          e.m.lookAt(blanco.x + Math.cos(a + 0.4) * radio, e.m.position.y, blanco.z + Math.sin(a + 0.4) * radio * 0.8);
          e.m.userData.animar(tAbs + e.i);
        }
        // El mosquito protagonista vuela desde lejos hasta el brazo durante su escena.
        const c = cadena(s);
        const inicioProta = (c.find((x) => normal(x.op.foco) === 'mosquito') || c[0]).inicio;
        const k = suave((tAbs - inicioProta) / 5);
        posProta.set(
          lerp(1.6, blanco.x + 0.05, k) + Math.sin(tAbs * 2.1) * 0.1 * (1 - k),
          lerp(1.5, blanco.y + 0.1, k) + Math.sin(tAbs * 3.3) * 0.06,
          lerp(1.3, blanco.z, k),
        );
        protagonista.position.copy(posProta);
        protagonista.lookAt(blanco);
        protagonista.userData.animar(tAbs);

        const fCo2 = efecto === 'co2' ? entra : 0;
        co2A.userData.animar(tAbs, fCo2);
        co2B.userData.animar(tAbs, fCo2 * 0.5);
        const fCalor = efecto === 'calor' ? entra : 0;
        calor.forEach((d, i) => { d.material.opacity = fCalor * (0.35 + 0.15 * Math.sin(tAbs * 3 + i)); });
      },
      etiquetas(tAbs, s, t) {
        const e = normal(s.op.efecto);
        if (e !== 'enjambre') return [];
        return [{ pos: blanco, marco: 120, texto: 'Objetivo', color: 'peligro', k: clamp((fuerzaEnjambre - 0.5) * 3) }];
      },
    };
  },
});

// ---------- Estudio: cualquier pieza del kit en un escenario ----------

mundo('estudio', {
  descripcion: `Escenario oscuro para presentar una pieza del kit girando. pieza: ${Object.keys(piezas).join(', ')}.`,
  ejemplo: '[3d: estudio | pieza: mosquito | camara: orbita]',
  crear(entorno) {
    const escena = new THREE.Scene();
    const fondo = new THREE.Color('#050a18');
    escena.background = fondo;
    escena.fog = new THREE.Fog(fondo, 12, 34);
    escena.environment = entorno;
    escena.add(new THREE.HemisphereLight('#7fa0ff', '#0a0a14', 0.6));
    const clave = new THREE.SpotLight('#ffffff', 45, 30, 0.5, 0.6, 1.4);
    clave.position.set(4, 9, 6);
    escena.add(clave);
    const contra = new THREE.DirectionalLight('#38c8ff', 2.2);
    contra.position.set(-5, 3, -6);
    escena.add(contra);
    escena.add(pisoCuadricula({ tam: 60 }));
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 0.25, 64), mat('#0b1226', { rugosidad: 0.4, metal: 0.5 }));
    pedestal.position.y = 0.125;
    escena.add(pedestal);
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.025, 8, 96).rotateX(Math.PI / 2), brilla('#38c8ff'));
    anillo.position.y = 0.25;
    escena.add(anillo);
    const halo = destello('#2f74ff', 14, 0.3);
    halo.position.set(0, 2.5, -6);
    escena.add(halo);
    const polvo = particulas({ n: 260, color: '#9fd8ff', tam: 0.05, area: 5, alto: 7, semilla: 9 });
    escena.add(polvo);
    const soporte = new THREE.Group();
    soporte.position.y = 2.1;
    escena.add(soporte);
    const creadas = {};
    let actual = null;
    return {
      escena,
      camara: camara(42),
      bloom: 0.3,
      objetivos: { pieza: { pos: () => new THREE.Vector3(0, 2.0, 0), dist: 7.5, yaw: 0, pitch: 0.12 } },
      actualizar(tAbs, s, t) {
        const cual = (x) => (piezas[normal(x.op.pieza)] ? normal(x.op.pieza) : 'maleta');
        const nombre = cual(s);
        // Si la escena anterior era otra pieza del estudio, una se encoge y la otra crece.
        const antes = s.anterior && s.anterior.tipo === '3d' && normal(s.anterior.valor) === 'estudio' ? cual(s.anterior) : null;
        const cambio = antes && antes !== nombre ? clamp(t / 0.7) : 1;
        for (const n of [nombre, antes]) {
          if (!n || creadas[n]) continue;
          // Cada pieza se centra y se escala para ocupar lo mismo, sea un mosquito o un tranvía
          // (medida ya "abierta", por si se anima, como el AirTag).
          const pieza = piezas[n].crear();
          if (pieza.userData.animar) pieza.userData.animar(0, 1);
          const caja = new THREE.Box3().setFromObject(pieza);
          const tam = caja.getSize(new THREE.Vector3());
          pieza.position.sub(caja.getCenter(new THREE.Vector3()));
          const envoltura = new THREE.Group();
          envoltura.add(pieza);
          envoltura.userData = { ...pieza.userData, base: 3.1 / Math.max(tam.x, tam.y, tam.z) };
          creadas[n] = envoltura;
          soporte.add(envoltura);
        }
        for (const [n, o] of Object.entries(creadas)) {
          const k = n === nombre ? suave(cambio) : n === antes ? 1 - suave(cambio) : 0;
          o.visible = k > 0.01;
          o.scale.setScalar(o.userData.base * Math.max(0.01, k));
        }
        actual = creadas[nombre];
        if (normal(s.op.girar) !== 'no') soporte.rotation.y = tAbs * 0.35;
        soporte.position.y = 2.1 + Math.sin(tAbs * 1.1) * 0.06;
        if (actual.userData.animar) actual.userData.animar(t, clamp((t - 0.4) / 1.6));
        if (actual.userData.caminar) actual.userData.caminar(t * 4.4);
        anillo.material.color.set(F.estilos[normal(s.op.color)] ? F.estilos[normal(s.op.color)].acento : '#38c8ff');
        polvo.userData.animar(tAbs * 0.25, 0.7);
      },
      etiquetas(tAbs, s, t) {
        if (!actual || !actual.userData.anclas || normal(s.op.piezas) === 'no') return [];
        soporte.updateMatrixWorld(true);
        return actual.userData.anclas().map((a, i) => ({ ...a, k: clamp(((t - 0.4) / 1.6 - 1) * 3 - i * 0.4) }));
      },
    };
  },
});

listo();
