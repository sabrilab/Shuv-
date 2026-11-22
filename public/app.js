import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ---------- Réglages par défaut + looks ---------- */
const DEFAULT = { hairStyle:'crew', hairLen:3, sideLen:1, texture:0.45, beardStyle:'short', beardLen:10, mustLen:8, cheekLine:0.5 };

const PRESETS = [
  { name:'Crew cut + barbe 1 cm', tag:'Tes favoris', p:{hairStyle:'crew',hairLen:2.5,sideLen:0.5,texture:0.45,beardStyle:'short',beardLen:10,mustLen:8,cheekLine:0.55} },
  { name:'Quiff très court', tag:'Tes favoris', p:{hairStyle:'quiff',hairLen:3.5,sideLen:0.5,texture:0.35,beardStyle:'short',beardLen:10,mustLen:8,cheekLine:0.55} },
  { name:'Slick back très court', tag:'Tes favoris', p:{hairStyle:'slick',hairLen:3.5,sideLen:0.5,texture:0.15,beardStyle:'short',beardLen:10,mustLen:8,cheekLine:0.55} },
  { name:'Raie côté très courte', tag:'Tes favoris', p:{hairStyle:'side',hairLen:3.5,sideLen:0.5,texture:0.2,beardStyle:'short',beardLen:10,mustLen:8,cheekLine:0.55} },
  { name:'Quiff + barbe courte', tag:'Court', p:{hairStyle:'quiff',hairLen:5.5,sideLen:1,texture:0.45,beardStyle:'short',beardLen:5,mustLen:5,cheekLine:0.5} },
  { name:'Slick back + barbe courte', tag:'Court', p:{hairStyle:'slick',hairLen:5.5,sideLen:1,texture:0.2,beardStyle:'short',beardLen:5,mustLen:5,cheekLine:0.5} },
  { name:'Raie milieu courte', tag:'Court', p:{hairStyle:'middle',hairLen:5.5,sideLen:1.5,texture:0.5,beardStyle:'short',beardLen:5,mustLen:5,cheekLine:0.5} },
  { name:'French crop', tag:'Court', p:{hairStyle:'crop',hairLen:3.5,sideLen:0.5,texture:0.5,beardStyle:'goatee',beardLen:6,mustLen:6,cheekLine:0.5} },
  { name:'Boucles + low taper', tag:'Boucles', p:{hairStyle:'curly',hairLen:7,sideLen:1,texture:0.9,beardStyle:'goatee',beardLen:6,mustLen:6,cheekLine:0.5} },
  { name:'Modern mullet', tag:'Boucles', p:{hairStyle:'mullet',hairLen:7,sideLen:1,texture:0.75,beardStyle:'goatee',beardLen:6,mustLen:6,cheekLine:0.5} },
  { name:'Curly shag', tag:'Long', p:{hairStyle:'curly',hairLen:11,sideLen:4,texture:1,beardStyle:'goatee',beardLen:6,mustLen:6,cheekLine:0.5} },
  { name:'Raie milieu ondulée', tag:'Long', p:{hairStyle:'middle',hairLen:10,sideLen:3,texture:0.65,beardStyle:'goatee',beardLen:5,mustLen:6,cheekLine:0.5} },
];

const STYLE_NAMES = { crew:'Crew cut', quiff:'Quiff', slick:'Slick back', side:'Raie côté', middle:'Raie milieu', crop:'French crop', curly:'Boucles', mullet:'Modern mullet' };
const BEARD_NAMES = { none:'rasé', goatee:'bouc', short:'barbe', chin:'collier' };

let state = { ...DEFAULT };
try { const s = JSON.parse(localStorage.getItem('ss-state')); if (s) state = { ...DEFAULT, ...s }; } catch {}

/* ---------- Scène ---------- */
const viewer = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 0.1, 8.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.25, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 4.5; controls.maxDistance = 12;
controls.minPolarAngle = 0.9; controls.maxPolarAngle = 2.1;

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x6a4a3a, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfd4ff, 1.4); rim.position.set(-4, 2, -4); scene.add(rim);

// Dégradé toon 4 niveaux (look jeu cartoon)
const grad = new THREE.DataTexture(new Uint8Array([90, 160, 215, 255]), 4, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: grad });

const COLORS = { skin:0xc89272, skinDark:0xa8735a, hair:0x1d1512, beard:0x241b17, lip:0xa86454, sweater:0x2b2f36, shirt:0xa9c3e6, iris:0x4a2c1a, white:0xf4efe8 };

// Contour noir façon cel-shading (coque inversée)
function outline(mesh, w = 0.018) {
  const m = new THREE.MeshBasicMaterial({ color:0x15101a, side:THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${w.toFixed(4)};`); };
  const o = new THREE.Mesh(mesh.geometry, m);
  o.renderOrder = -1;
  mesh.add(o);
  return o;
}

const avatar = new THREE.Group();
scene.add(avatar);

/* ---------- Forme du crâne (visage ovale allongé, mâchoire anguleuse) ---------- */
const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function headShape(d, out) {
  let { x, y, z } = d;
  let sx = 0.8, sy = 1.14, sz = 0.97;
  const low = Math.max(0, -y);
  // menton plus étroit mais mâchoire carrée : on rétrécit fort seulement tout en bas
  const chin = SS(0.4, 1.0, low);
  const jawSquare = SS(0.15, 0.6, low) * (1 - chin);
  let wx = 1 - 0.38 * chin + 0.05 * jawSquare;
  // pommettes marquées
  wx += 0.025 * Math.exp(-((y + 0.05) ** 2) / 0.02) * SS(0.2, 0.7, z);
  // crâne plus volumineux derrière
  let wz = 1 + (z < 0 ? 0.06 * SS(-0.2, 0.6, y) : 0);
  // visage plus plat sur l'avant, menton qui avance un peu
  if (z > 0) wz *= 1 - 0.06 * SS(-0.2, 0.5, y);
  let px = x * sx * wx, py = y * sy, pz = z * sz * wz;
  if (z > 0 && y < -0.6) pz += 0.06 * chin * z;
  // front droit
  if (z > 0.3 && y > 0.2) pz *= 1 - 0.04 * SS(0.2, 0.8, y);
  return out.set(px, py, pz);
}

const SEG_W = 160, SEG_H = 120;
function buildShell(thicknessFn) {
  const g = new THREE.SphereGeometry(1, SEG_W, SEG_H);
  g.userData.dirs = g.attributes.position.array.slice();
  g.userData.fn = thicknessFn;
  g.setAttribute('aMask', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1));
  return g;
}
// Le masque découpe proprement les bords des cheveux / de la barbe (pas de « murs » en escalier)
function masked(mat, extrude = 0) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aMask;\nvarying float vMask;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `vec3 transformed = position + normal * ${extrude.toFixed(4)}; vMask = aMask;`);
    sh.fragmentShader = 'varying float vMask;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vMask < 0.5) discard;');
  };
  return mat;
}
const tmpD = new THREE.Vector3(), tmpP = new THREE.Vector3();
function updateShell(g, fn = g.userData.fn) {
  const dirs = g.userData.dirs, pos = g.attributes.position, mask = g.attributes.aMask;
  for (let i = 0; i < pos.count; i++) {
    tmpD.set(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2]).normalize();
    headShape(tmpD, tmpP);
    const r = tmpP.length();
    const res = fn(tmpD);
    const m = res.m ?? 1;
    const t = (res.t ?? 0) * SS(0.35, 0.9, m) + 0.004;
    tmpP.multiplyScalar(1 + t / r);
    if (res.drop) tmpP.y -= res.drop * SS(0.35, 0.9, m);
    pos.setXYZ(i, tmpP.x, tmpP.y, tmpP.z);
    mask.setX(i, m);
  }
  pos.needsUpdate = true; mask.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

// Tête
const headGeo = buildShell(() => ({ t: -0.004, m: 1 }));
updateShell(headGeo);
const head = new THREE.Mesh(headGeo, toon(COLORS.skin));
outline(head, 0.02);
avatar.add(head);

// Cheveux et barbe : des coques autour du crâne dont l'épaisseur suit les réglages
function shellMesh(color, w) {
  const g = buildShell(() => ({ t: 0, m: 0 }));
  const mesh = new THREE.Mesh(g, masked(toon(color)));
  const o = new THREE.Mesh(g, masked(new THREE.MeshBasicMaterial({ color:0x15101a, side:THREE.BackSide }), w));
  mesh.add(o); avatar.add(mesh);
  return g;
}
const hairGeo = shellMesh(COLORS.hair, 0.014);
const beardGeo = shellMesh(COLORS.beard, 0.01);

/* ---------- Visage : yeux, sourcils, nez, bouche, oreilles ---------- */
const ray = new THREE.Raycaster();
function surf(x, y) {
  ray.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
  const h = ray.intersectObject(head, false)[0];
  return h ? h.point.clone() : new THREE.Vector3(x, y, 0.8);
}

const face = new THREE.Group(); avatar.add(face);
for (const s of [-1, 1]) {
  const p = surf(0.3 * s, 0.1);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), toon(COLORS.white));
  eye.position.set(p.x, p.y, p.z - 0.07); face.add(eye);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.052, 32), new THREE.MeshBasicMaterial({ color:COLORS.iris }));
  iris.position.set(p.x - 0.01 * s, p.y - 0.01, p.z - 0.07 + 0.104); face.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.024, 24), new THREE.MeshBasicMaterial({ color:0x0b0706 }));
  pupil.position.set(iris.position.x, iris.position.y, iris.position.z + 0.001); face.add(pupil);
  const shine = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), new THREE.MeshBasicMaterial({ color:0xffffff }));
  shine.position.set(iris.position.x + 0.018, iris.position.y + 0.02, iris.position.z + 0.002); face.add(shine);
  // paupière supérieure lourde (regard un peu voilé)
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.114, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), toon(COLORS.skinDark));
  lid.position.copy(eye.position); lid.rotation.x = 0.32; face.add(lid);
  outline(lid, 0.008);
  // sourcil épais, droit puis légèrement arqué
  const bp = surf(0.31 * s, 0.31);
  const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.24, 6, 12), toon(COLORS.hair));
  brow.position.set(bp.x, bp.y, bp.z + 0.005);
  brow.rotation.z = Math.PI / 2 + 0.12 * s; brow.rotation.y = -0.35 * s;
  brow.scale.set(1, 1, 0.6);
  face.add(brow);
}
// nez long et droit
{
  const top = surf(0, 0.12), bot = surf(0, -0.27);
  const len = 0.42;
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, len, 8, 16), toon(COLORS.skin));
  bridge.position.set(0, (top.y + bot.y) / 2 - 0.02, (top.z + bot.z) / 2 + 0.08);
  bridge.rotation.x = -0.32; bridge.scale.set(1, 1, 1.1);
  face.add(bridge);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), toon(COLORS.skin));
  tip.position.set(0, bot.y + 0.02, bot.z + 0.14); tip.scale.set(1.15, 0.85, 0.95);
  face.add(tip); outline(tip, 0.012);
  for (const s of [-1, 1]) {
    const al = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), toon(COLORS.skin));
    al.position.set(0.085 * s, bot.y + 0.0, bot.z + 0.07); face.add(al);
  }
}
// bouche
{
  const m = surf(0, -0.5);
  const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 6, 16), toon(COLORS.lip));
  lip.rotation.z = Math.PI / 2; lip.scale.set(0.75, 1, 0.6);
  lip.position.set(0, m.y + 0.02, m.z - 0.005); face.add(lip);
  const lip2 = lip.clone(); lip2.scale.set(0.95, 0.92, 0.7); lip2.position.y = m.y - 0.045; face.add(lip2);
  const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.26, 4, 8), new THREE.MeshBasicMaterial({ color:0x4a2420 }));
  line.rotation.z = Math.PI / 2; line.position.set(0, m.y - 0.012, m.z + 0.03); face.add(line);
}
// oreilles
for (const s of [-1, 1]) {
  const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), toon(COLORS.skin));
  ear.scale.set(0.35, 1, 0.65);
  ear.position.set(0.82 * s, 0.0, -0.12); ear.rotation.y = 0.35 * s;
  avatar.add(ear); outline(ear, 0.014);
}
// cou + buste (pull foncé, col de chemise bleu clair)
{
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.0, 32), toon(COLORS.skin));
  neck.position.set(0, -1.3, -0.15); avatar.add(neck); outline(neck, 0.016);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), toon(COLORS.sweater));
  body.scale.set(1.75, 0.95, 0.95); body.position.set(0, -2.45, -0.15); avatar.add(body); outline(body, 0.02);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.09, 12, 32), toon(COLORS.shirt));
  collar.rotation.x = Math.PI / 2 - 0.15; collar.position.set(0, -1.62, -0.1); avatar.add(collar);
}

/* ---------- Épaisseur des cheveux ---------- */
const CM = 0.032; // 1 cm de cheveu en unités 3D
function noise(d) {
  return (Math.sin(d.x * 21 + 1.3) * Math.sin(d.y * 19 + 0.7) * Math.sin(d.z * 23 + 2.1)
        + 0.5 * Math.sin(d.x * 41) * Math.sin(d.y * 37 + 1) * Math.sin(d.z * 43 + 3));
}
function hairFn(d) {
  const { x, y, z } = d, s = state;
  let front = s.hairStyle === 'crop' ? 0.36 : 0.5;
  // ligne d'implantation : haute devant, au-dessus des oreilles sur les côtés, basse sur la nuque
  let H = z > 0 ? lerp(0.24, front, Math.min(1, z * 1.2)) : lerp(0.24, s.hairStyle === 'mullet' ? -0.78 : -0.5, -z);
  // golfes temporaux
  if (z > 0.4) H += 0.06 * Math.exp(-((Math.abs(x) - 0.45) ** 2) / 0.01);
  const mask = SS(H - 0.04, H + 0.04, y);
  if (mask <= 0) return { t: 0, m: 0 };
  const top = SS(0.25, 0.78, y);
  const fwd = SS(0.45, 0.95, z) * top;
  const back = SS(0, -0.8, z);
  const Lt = s.hairLen * CM;
  const Ls = (0.15 + s.sideLen) * CM * 0.9 * SS(H - 0.02, H + 0.38, y);
  let t = lerp(Ls, Lt, top);
  switch (s.hairStyle) {
    case 'crew': t += 0.25 * Lt * fwd; break;
    case 'quiff': t += 1.1 * Lt * fwd * SS(0.4, 0.85, y) + 0.15 * Lt * top; break;
    case 'slick': t = lerp(Ls, Lt * 0.8, top) + 0.45 * Lt * back * top; break;
    case 'side': {
      const g = Math.exp(-((x - 0.32) ** 2) / 0.003) * top * SS(-0.3, 0.2, z);
      t += 0.35 * Lt * SS(0.35, -0.4, x) * top - 0.7 * t * g; break;
    }
    case 'middle': {
      const g = Math.exp(-(x ** 2) / 0.003) * top * SS(-0.2, 0.3, z);
      t += 0.45 * Lt * SS(0.25, 0.7, Math.abs(x)) * SS(-0.1, 0.4, y) - 0.7 * t * g; break;
    }
    case 'crop': t = lerp(Ls, Lt, top) + 0.5 * Lt * SS(0.6, 0.95, z) * SS(0.3, 0.55, y); break;
    case 'curly': t += 0.35 * Lt * SS(0.1, 0.6, y) + 0.3 * Lt * fwd; break;
    case 'mullet': t += Lt * 0.9 * back * SS(0.25, -0.6, y); break;
  }
  t *= 1 + s.texture * 0.45 * noise(d) * SS(0.5, 3, s.hairLen + s.sideLen * 0.5);
  return { t: Math.max(0.006, t), m: mask };
}

/* ---------- Épaisseur de la barbe et de la moustache ---------- */
const MM = 0.0032; // 1 mm de poil
function beardFn(d) {
  const { x, y, z } = d, s = state, ax = Math.abs(x);
  let t = 0, m = 0, drop = 0;
  const lips = SS(0.25, 0.19, ax) * SS(-0.37, -0.41, y) * SS(-0.6, -0.55, y) * SS(0.55, 0.75, z);
  // moustache
  if (s.mustLen > 0) {
    const mm = SS(0.31, 0.25, ax) * SS(-0.27, -0.31, y) * SS(-0.44, -0.39, y) * SS(0.5, 0.7, z);
    if (mm > 0) { m = mm; t = 0.003 + s.mustLen * MM * 0.8; }
  }
  if (s.beardStyle !== 'none') {
    // ligne des joues : de la patte (devant l'oreille) jusqu'au coin de la bouche
    const cheekTop = lerp(-0.02, -0.16, s.cheekLine) - 0.3 * SS(0.25, 0.85, z);
    let zone = SS(cheekTop + 0.04, cheekTop - 0.04, y) * SS(-0.3, -0.12, z);
    if (s.beardStyle === 'goatee') zone = SS(0.3, 0.22, ax) * SS(-0.44, -0.52, y) * SS(0.05, 0.3, z);
    if (s.beardStyle === 'chin') zone *= SS(cheekTop - 0.2, cheekTop - 0.3, y);
    // sous le menton : s'arrête au cou
    zone *= SS(-0.995, -0.97, -Math.abs(y)) > 0 ? 1 : 1;
    zone *= 1 - lips;
    const chin = SS(-0.6, -0.95, y) * SS(-0.1, 0.4, z);
    const L = 0.003 + s.beardLen * MM;
    if (zone > m) { m = zone; t = L * (1 + 0.4 * chin); }
    if (s.beardLen > 12) drop = (s.beardLen - 12) * MM * 1.2 * chin * zone;
  }
  return { t, m, drop };
}

/* ---------- UI ---------- */
const $ = (id) => document.getElementById(id);
const fmt = {
  hairLen: (v) => `${String(v).replace('.', ',')} cm`,
  sideLen: (v) => v == 0 ? 'rasé' : `${String(v).replace('.', ',')} cm`,
  texture: (v) => v < 0.25 ? 'lisse' : v < 0.6 ? 'ondulé' : 'bouclé',
  beardLen: (v) => v == 0 ? 'barbe de 3 jours' : `${v} mm`,
  mustLen: (v) => v == 0 ? 'aucune' : `${v} mm`,
  cheekLine: (v) => v < 0.35 ? 'naturel' : v < 0.7 ? 'net' : 'très bas',
};
const KEYS = ['hairStyle', 'hairLen', 'sideLen', 'texture', 'beardStyle', 'beardLen', 'mustLen', 'cheekLine'];

function syncUI() {
  for (const k of KEYS) {
    const el = $(k); el.value = state[k];
    const o = $('o-' + k); if (o) o.textContent = fmt[k](state[k]);
  }
  const preset = PRESETS.find((p) => KEYS.every((k) => p.p[k] == state[k]));
  document.querySelectorAll('.presets button').forEach((b, i) => b.classList.toggle('on', PRESETS[i] === preset));
  if (!personal.visible) $('lookName').textContent = preset ? preset.name : `${STYLE_NAMES[state.hairStyle]} · ${BEARD_NAMES[state.beardStyle]}`;
  $('barberText').textContent = barberText();
}

function barberText() {
  const s = state, h = String(s.hairLen).replace('.', ',');
  const sides = s.sideLen == 0 ? 'côtés rasés (skin fade)' : s.sideLen <= 1 ? 'low taper aux tempes et à la nuque, du 0,5 vers le 1' : s.sideLen <= 2 ? 'dégradé progressif du 1 vers le 3 sur les côtés' : `côtés gardés à ${String(s.sideLen).replace('.', ',')} cm, juste désépaissis`;
  const style = {
    crew: `un crew cut texturé, dessus à ${h} cm, coiffé vers l'avant`,
    quiff: `un quiff, dessus à ${h} cm, plus long devant pour remonter la mèche`,
    slick: `un slick back, dessus à ${h} cm, coiffé en arrière`,
    side: `une raie sur le côté, dessus à ${h} cm`,
    middle: `une raie au milieu, dessus à ${h} cm, mèches qui tombent sur les côtés`,
    crop: `un French crop texturé, dessus à ${h} cm, frange courte droite`,
    curly: `boucles sur le dessus à ${h} cm, coupées à sec en suivant la boucle`,
    mullet: `un modern mullet, dessus à ${h} cm, nuque gardée longue et bouclée`,
  }[s.hairStyle];
  let b = '';
  if (s.beardStyle === 'none') b = 'Barbe rasée';
  else if (s.beardStyle === 'goatee') b = `Bouc taillé à ${s.beardLen} mm, pas trop pointu`;
  else if (s.beardStyle === 'chin') b = `Collier le long de la mâchoire à ${s.beardLen} mm, joues rasées`;
  else b = `Barbe complète à ${s.beardLen} mm, ${s.cheekLine > 0.5 ? 'contour des joues bien net et assez bas' : 'contour des joues naturel'}`;
  const m = s.mustLen == 0 ? ', sans moustache.' : `, moustache à ${s.mustLen} mm dégagée des lèvres.`;
  return `Je voudrais ${style}, ${sides}. ${b}${m}`;
}

let rafPending = false;
function apply(save = true) {
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; updateShell(hairGeo, hairFn); updateShell(beardGeo, beardFn); });
  }
  syncUI();
  if (save) try { localStorage.setItem('ss-state', JSON.stringify(state)); } catch {}
}

for (const k of KEYS) {
  $(k).addEventListener('input', (e) => {
    const v = e.target.value; state[k] = isNaN(+v) ? v : +v; apply();
  });
}

const presetsEl = $('presets');
PRESETS.forEach((p) => {
  const b = document.createElement('button');
  b.innerHTML = `${p.name}<small>${p.tag}</small>`;
  b.onclick = () => { state = { ...p.p }; apply(); };
  presetsEl.appendChild(b);
});

$('random').onclick = () => {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  state = {
    hairStyle: pick(Object.keys(STYLE_NAMES)), hairLen: pick([2, 3, 4, 5, 6, 8]), sideLen: pick([0, 0.5, 1, 1.5, 2]),
    texture: Math.round(Math.random() * 20) / 20, beardStyle: pick(['short', 'short', 'goatee', 'chin', 'none']),
    beardLen: pick([2, 5, 8, 10, 14]), mustLen: pick([0, 4, 6, 8, 10]), cheekLine: pick([0.2, 0.5, 0.8]),
  };
  apply();
};

function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }
$('copyBarber').onclick = async () => { try { await navigator.clipboard.writeText($('barberText').textContent); toast('Copié'); } catch { toast('Copie impossible'); } };

/* ---------- Favoris ---------- */
let favs = [];
try { favs = JSON.parse(localStorage.getItem('ss-favs')) || []; } catch {}
function saveFavs() { try { localStorage.setItem('ss-favs', JSON.stringify(favs)); } catch { toast('Stockage plein'); } }
function renderFavs() {
  $('favCount').textContent = favs.length;
  $('favEmpty').style.display = favs.length ? 'none' : '';
  const box = $('favs'); box.innerHTML = '';
  favs.forEach((f, i) => {
    const el = document.createElement('div'); el.className = 'fav';
    el.innerHTML = `<img alt=""><span></span><button class="del" title="Supprimer">✕</button>`;
    el.querySelector('img').src = f.img; el.querySelector('span').textContent = f.name;
    el.onclick = () => { if (f.pp && pHead) { pState = { ...f.pp }; setMode('perso'); applyP(); } else { state = { ...f.p }; if (pHead) setMode('avatar'); apply(); } showTab('essayer'); };
    el.querySelector('.del').onclick = (e) => { e.stopPropagation(); favs.splice(i, 1); saveFavs(); renderFavs(); };
    box.appendChild(el);
  });
}
$('saveFav').onclick = () => {
  renderer.render(scene, camera);
  const src = renderer.domElement, c = document.createElement('canvas'); c.width = c.height = 240;
  const s = Math.min(src.width, src.height) * 0.8;
  c.getContext('2d').drawImage(src, (src.width - s) / 2, (src.height - s) / 2 - s * 0.08, s, s, 0, 0, 240, 240);
  favs.unshift({ name: $('lookName').textContent, p: { ...state }, pp: personal.visible ? { ...pState } : null, img: c.toDataURL('image/jpeg', 0.8) });
  favs = favs.slice(0, 24); saveFavs(); renderFavs(); toast('Look gardé ♥');
};
$('saveFav2').onclick = () => $('saveFav').onclick();

/* ---------- Onglets, vues ---------- */
function showTab(t) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + t));
}
document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

let anim = null;
const VIEWS = { face: 0, trois: 0.65, profil: Math.PI / 2, dos: Math.PI };
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => {
  controls.autoRotate = false; $('spin').classList.remove('on');
  const from = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  let to = VIEWS[b.dataset.view]; let dlt = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  anim = { from, dlt, t0: performance.now() };
}));
$('spin').onclick = () => { controls.autoRotate = !controls.autoRotate; controls.autoRotateSpeed = 3; $('spin').classList.toggle('on', controls.autoRotate); };

function resize() {
  const w = viewer.clientWidth, h = viewer.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.position.setLength(Math.max(8.2, 8.2 * 0.9 / Math.min(1, w / h)) );
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer);
resize();

function loop(now) {
  if (anim) {
    const k = Math.min(1, (now - anim.t0) / 600), e = 1 - (1 - k) ** 3;
    const a = anim.from + anim.dlt * e, r = Math.hypot(camera.position.x, camera.position.z - 0);
    camera.position.x = Math.sin(a) * r; camera.position.z = Math.cos(a) * r;
    if (k >= 1) anim = null;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ---------- Modèle 3D personnel (fait depuis les photos de Sabri) + filtres ---------- */
const personal = new THREE.Group(); personal.visible = false; scene.add(personal);
let pHead = null, pState = { beard:'bouc', must:'fine', hair:0, fade:0.55 };
try { const s = JSON.parse(localStorage.getItem('ss-pstate')); if (s) pState = { ...pState, ...s }; } catch {}
let pBEARDS = {}, pMUSTS = {};
const FADES = [{ v:0, label:'Naturel' }, { v:0.55, label:'Dégradé' }, { v:0.95, label:'Très court' }];
const P_PRESETS = [
  { name:'Mon look actuel', tag:'Comme sur tes photos', p:{ beard:'bouc', must:'fine', hair:0, fade:0 } },
  { name:'Très court + barbe courte', tag:'Ton favori', p:{ beard:'courte', must:'fine', hair:-0.7, fade:0.55 } },
  { name:'Court propre, rasé', tag:'Net', p:{ beard:'rasee', must:'sans', hair:-0.5, fade:0.95 } },
  { name:'3 jours + dégradé', tag:'Décontracté', p:{ beard:'troisj', must:'sans', hair:-0.3, fade:0.55 } },
  { name:'Barbe longue', tag:'Audacieux', p:{ beard:'longue', must:'pleine', hair:0, fade:0.55 } },
  { name:'Cheveux longs + bouc', tag:'Volume', p:{ beard:'bouc', must:'fine', hair:0.7, fade:0 } },
];
function chips(boxId, items, key) {
  const box = $(boxId); box.innerHTML = '';
  items.forEach(([v, label]) => {
    const b = document.createElement('button'); b.textContent = label; b.dataset.v = v;
    b.onclick = () => { pState[key] = typeof pState[key] === 'number' ? +v : v; applyP(); };
    box.appendChild(b);
  });
}
let pRaf = false;
function applyP() {
  if (!pHead) return;
  if (!pRaf) { pRaf = true; requestAnimationFrame(() => { pRaf = false; pHead.apply({ ...pBEARDS[pState.beard], ...pMUSTS[pState.must], hair: pState.hair, fade: pState.fade }); }); }
  syncP();
  try { localStorage.setItem('ss-pstate', JSON.stringify(pState)); } catch {}
}
function syncP() {
  for (const [id, key] of [['pBeard', 'beard'], ['pMust', 'must'], ['pFade', 'fade']])
    $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(pState[key]) === b.dataset.v));
  $('pHair').value = pState.hair;
  $('o-pHair').textContent = pState.hair < -0.6 ? 'très court' : pState.hair < -0.2 ? 'court' : pState.hair < 0.2 ? 'actuel' : pState.hair < 0.55 ? 'mi-long' : 'long';
  const pre = P_PRESETS.find((x) => Object.keys(x.p).every((k) => x.p[k] == pState[k]));
  document.querySelectorAll('#pPresets button').forEach((b, i) => b.classList.toggle('on', P_PRESETS[i] === pre));
  if (personal.visible) $('lookName').textContent = pre ? pre.name : `${pBEARDS[pState.beard]?.label || ''} · ${FADES.find((f) => f.v == pState.fade)?.label || ''}`;
  $('pBarber').textContent = barberP();
}
function barberP() {
  const h = pState.hair < -0.6 ? 'dessus très court, 2 à 3 cm' : pState.hair < -0.2 ? 'dessus court, 3 à 5 cm' : pState.hair < 0.2 ? 'dessus gardé à la longueur actuelle, juste désépaissi' : pState.hair < 0.55 ? 'dessus mi-long, 7 à 9 cm' : 'dessus long, plus de 10 cm';
  const f = pState.fade >= 0.9 ? 'côtés très courts (skin fade)' : pState.fade >= 0.5 ? 'low taper aux tempes et à la nuque' : 'côtés naturels, juste égalisés';
  const b = { rasee:'Barbe rasée', troisj:'Barbe de 3 jours égalisée', bouc:'Bouc gardé, contour net', courte:'Barbe courte complète vers 5–10 mm, contour des joues net', longue:'Barbe longue et fournie, bas arrondi' }[pState.beard];
  const m = { sans:', sans moustache.', fine:', moustache fine dégagée des lèvres.', pleine:', moustache épaisse.' }[pState.must];
  return `Je voudrais ${h}, ${f}. ${b}${m}`;
}
function setMode(m) {
  const mine = m === 'perso';
  personal.visible = mine; avatar.visible = !mine;
  document.querySelectorAll('#modeSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  $('perso-ui').style.display = mine ? '' : 'none';
  $('avatar-ui').style.display = mine ? 'none' : '';
  $('modelBadge').textContent = mine ? 'Mon modèle 3D' : 'Avatar générique';
  mine ? syncP() : syncUI();
}
async function tryPersonalModel() {
  try {
    $('modelBadge').textContent = 'Chargement de ton modèle…';
    const mod = await import('./avatar.js');
    pBEARDS = mod.BEARDS; pMUSTS = mod.MUSTS;
    chips('pBeard', Object.entries(pBEARDS).map(([k, v]) => [k, v.label]), 'beard');
    chips('pMust', Object.entries(pMUSTS).map(([k, v]) => [k, v.label]), 'must');
    chips('pFade', FADES.map((f) => [f.v, f.label]), 'fade');
    const pre = $('pPresets'); pre.innerHTML = '';
    P_PRESETS.forEach((x) => { const b = document.createElement('button'); b.innerHTML = `${x.name}<small>${x.tag}</small>`; b.onclick = () => { pState = { ...x.p }; applyP(); }; pre.appendChild(b); });
    $('pHair').addEventListener('input', (e) => { pState.hair = +e.target.value; applyP(); });
    $('pCopy').onclick = async () => { try { await navigator.clipboard.writeText($('pBarber').textContent); toast('Copié'); } catch { toast('Copie impossible'); } };
    pHead = await mod.loadAvatar('models/sabri-head-source.glb');
    pHead.scale.setScalar(3.1); pHead.position.y = -0.31;
    personal.add(pHead);
    $('modeSwitch').style.display = '';
    document.querySelectorAll('#modeSwitch button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
    setMode('perso'); applyP();
  } catch (e) { console.warn('modèle perso', e); $('modelBadge').textContent = 'Avatar générique'; }
}

renderFavs();
apply(false);
updateShell(hairGeo, hairFn); updateShell(beardGeo, beardFn);
requestAnimationFrame(loop);
tryPersonalModel();
window.__ss = { state, apply, setState: (p) => { state = { ...state, ...p }; apply(); } };
