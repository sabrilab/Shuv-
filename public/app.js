import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAvatar, BEARDS, MUSTS } from './avatar.js';

const $ = (id) => document.getElementById(id);

/* ---------- Options ---------- */
const HAIRS = { tc:{ label:'Très court', v:-0.8 }, c:{ label:'Court', v:-0.4 }, a:{ label:'Actuel', v:0 }, l:{ label:'Long', v:0.6 } };
const FADES = { n:{ label:'Côtés naturels', v:0 }, d:{ label:'Dégradé', v:0.55 }, r:{ label:'Côtés rasés', v:0.95 } };
const LOOKS = {
  actuel: { label:'Actuel', s:{ beard:'bouc', must:'fine', hair:'a', fade:'n' } },
  fav:    { label:'Court + barbe', s:{ beard:'courte', must:'fine', hair:'tc', fade:'d' } },
  net:    { label:'Rasé net', s:{ beard:'rasee', must:'sans', hair:'c', fade:'r' } },
  troisj: { label:'3 jours', s:{ beard:'troisj', must:'sans', hair:'c', fade:'d' } },
  barbu:  { label:'Barbu', s:{ beard:'longue', must:'pleine', hair:'a', fade:'d' } },
  long:   { label:'Long', s:{ beard:'bouc', must:'fine', hair:'l', fade:'n' } },
};
const GROUPS = {
  looks: { el:'looks', items:LOOKS, key:null, cam:'face' },
  beard: { el:'beard', items:BEARDS, key:'beard', cam:'chin' },
  must:  { el:'must', items:MUSTS, key:'must', cam:'mouth' },
  hair:  { el:'hair', items:HAIRS, key:'hair', cam:'head' },
  fade:  { el:'fade', items:FADES, key:'fade', cam:'side' },
};

let state = { ...LOOKS.actuel.s };
try { const s = JSON.parse(localStorage.getItem('ss-look')); if (s && BEARDS[s.beard] && MUSTS[s.must] && HAIRS[s.hair] && FADES[s.fade]) state = s; } catch {}
let favs = [];
try { favs = JSON.parse(localStorage.getItem('ss-favs2')) || []; } catch {}

const params = (s) => ({ ...BEARDS[s.beard], ...MUSTS[s.must], hair: HAIRS[s.hair].v, fade: FADES[s.fade].v });
const same = (a, b) => ['beard', 'must', 'hair', 'fade'].every((k) => a[k] === b[k]);

/* ---------- Scène ---------- */
const viewer = $('viewer');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x6a4a3a, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfd4ff, 1.4); rim.position.set(-4, 2, -4); scene.add(rim);

const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 4; controls.maxDistance = 22;
controls.minPolarAngle = 0.9; controls.maxPolarAngle = 2.1;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // la tête reste visible au-dessus du panneau du bas
  const sheet = document.querySelector('.sheet').offsetHeight;
  document.documentElement.style.setProperty('--sheet', sheet + 'px');
  const t = Math.tan(THREE.MathUtils.degToRad(13)) * 2, frac = Math.max(0.35, (h - sheet - 70) / h);
  const dist = Math.max(3.7 / (frac * t), 2.9 / (t * (w / h)));
  const visH = dist * t;
  controls.target.set(0, -0.45 - ((sheet - 70) / h) * visH * 0.5, 0);
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 0.01) dir.set(0, 0.2, 1);
  camera.position.copy(controls.target).add(dir.setLength(dist));
  camera.updateProjectionMatrix();
}

/* ---------- Vignettes : ton modèle rendu avec chaque option ---------- */
const thumbR = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
thumbR.setSize(164, 164, false); thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.setClearColor(0xc4dcff, 1);
const thumbCam = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
const SHOTS = {
  face:  { pos:[1.2, 0.3, 6.6], at:[0, -0.05, 0] },
  head:  { pos:[2.2, 0.9, 5.8], at:[0, 0.15, 0] },
  side:  { pos:[5.4, 0.5, 2.0], at:[0, 0.25, 0] },
  chin:  { pos:[1.3, -0.5, 3.4], at:[0, -0.55, 0] },
  mouth: { pos:[0.7, -0.3, 2.6], at:[0, -0.4, 0] },
};
function shot(name) {
  const s = SHOTS[name];
  thumbCam.position.set(...s.pos); thumbCam.lookAt(...s.at);
  thumbR.render(scene, thumbCam);
  return thumbR.domElement.toDataURL('image/jpeg', 0.82);
}

let head = null;
function buildGroup(g) {
  const G = GROUPS[g], box = $(G.el); box.innerHTML = '';
  for (const [id, it] of Object.entries(G.items)) {
    const s = G.key ? { ...state, [G.key]: id } : it.s;
    head.apply(params(s));
    const b = document.createElement('button');
    b.dataset.id = id;
    b.innerHTML = '<img alt=""><span></span>';
    b.querySelector('img').src = shot(G.cam);
    b.querySelector('span').textContent = it.label;
    b.onclick = () => { state = G.key ? { ...state, [G.key]: id } : { ...it.s }; update(); };
    box.appendChild(b);
  }
  if (g === 'looks') favs.forEach((f, i) => {
    const b = document.createElement('button'); b.className = 'fav'; b.dataset.fav = i;
    b.innerHTML = '<img alt=""><span>♥ Gardé</span>'; b.querySelector('img').src = f.img;
    b.onclick = () => { state = { ...f.s }; update(); };
    box.insertBefore(b, box.children[i] || null);
  });
  head.apply(params(state));
}
// les vignettes d'un onglet suivent ton look courant : refaites à l'ouverture de l'onglet
const dirty = new Set();
function refreshTab(t) {
  const groups = t === 'hair' ? ['hair', 'fade'] : [t];
  for (const g of groups) if (dirty.has(g) || !$(GROUPS[g].el).children.length) { buildGroup(g); dirty.delete(g); }
  sync();
}

/* ---------- État ---------- */
function lookLabel() {
  const l = Object.values(LOOKS).find((x) => same(x.s, state));
  return l ? l.label : `${BEARDS[state.beard].label} · ${HAIRS[state.hair].label}`;
}
function sync() {
  for (const g of Object.keys(GROUPS)) {
    $(GROUPS[g].el).querySelectorAll('button').forEach((b) => {
      const on = b.dataset.fav != null ? same(favs[b.dataset.fav].s, state)
        : GROUPS[g].key ? state[GROUPS[g].key] === b.dataset.id : same(GROUPS[g].items[b.dataset.id].s, state);
      b.classList.toggle('on', on);
    });
  }
  $('lookName').textContent = lookLabel();
  const isFav = favs.some((f) => same(f.s, state));
  $('favBtn').textContent = isFav ? '♥' : '♡'; $('favBtn').classList.toggle('on', isFav);
}
function update() {
  head.apply(params(state));
  for (const g of Object.keys(GROUPS)) if (g !== 'looks') dirty.add(g);
  sync();
  try { localStorage.setItem('ss-look', JSON.stringify(state)); } catch {}
}

/* ---------- Onglets, favoris, barbier ---------- */
document.querySelectorAll('#seg button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('#seg button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.id === 't-' + b.dataset.tab));
  if (head) refreshTab(b.dataset.tab);
  resize();
}));

function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1400); }
$('favBtn').onclick = () => {
  if (!head) return;
  const i = favs.findIndex((f) => same(f.s, state));
  if (i >= 0) favs.splice(i, 1);
  else { head.apply(params(state)); favs.unshift({ s:{ ...state }, img: shot('face') }); favs = favs.slice(0, 12); toast('Look gardé'); }
  try { localStorage.setItem('ss-favs2', JSON.stringify(favs)); } catch {}
  buildGroup('looks'); sync();
};

function barberText() {
  const h = { tc:'Dessus très court, 2–3 cm', c:'Dessus court, 3–5 cm', a:'Dessus gardé à la longueur actuelle, désépaissi', l:'Dessus long, plus de 10 cm' }[state.hair];
  const f = { n:'côtés naturels', d:'low taper aux tempes et à la nuque', r:'côtés très courts (skin fade)' }[state.fade];
  const b = { rasee:'Barbe rasée', troisj:'Barbe de 3 jours égalisée', bouc:'Bouc gardé, contour net', courte:'Barbe courte 5–10 mm, contour net', longue:'Barbe longue, bas arrondi' }[state.beard] || BEARDS[state.beard].label;
  const m = { sans:'sans moustache', fine:'moustache fine dégagée des lèvres', pleine:'moustache épaisse' }[state.must] || MUSTS[state.must].label;
  return `${h}, ${f}. ${b}, ${m}.`;
}
$('barberBtn').onclick = () => { $('barberText').textContent = barberText(); $('barber').showModal(); };
$('closeBarber').onclick = () => $('barber').close();
$('copyBarber').onclick = async () => { try { await navigator.clipboard.writeText(barberText()); toast('Copié'); } catch { toast('Copie impossible'); } $('barber').close(); };

/* ---------- Démarrage ---------- */
addEventListener('resize', resize);
camera.position.set(0, 0.2, 9);
resize();
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

try {
  head = await loadAvatar('models/sabri-head-source.glb');
  head.scale.setScalar(3.1); head.position.y = -0.31;
  scene.add(head);
  buildGroup('looks');
  update();
  $('loading').remove();
  resize();
} catch (e) {
  console.error(e);
  $('loading').textContent = 'Le modèle n’a pas pu se charger. Recharge la page.';
}
