// Avatar 3D modulaire : tête de base chauve et rasée (sourcils seulement) + modules 3D séparés
// « hair », « beard », « mustache » construits comme des coques posées sur la peau.
// Fonctionne sur n'importe quel buste généré (repères détectés automatiquement), donc extensible à d'autres personnes.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t; const h = (a, b, c) => hash(ix + a, iy + b, iz + c);
  return L(L(L(h(0,0,0), h(1,0,0), u), L(h(0,1,0), h(1,1,0), u), v), L(L(h(0,0,1), h(1,0,1), u), L(h(0,1,1), h(1,1,1), u), v), w); };

// Ramène n'importe quel buste généré dans un repère commun : sommet du crâne y=0.5, bas du menton y=-0.255, regard +Z.
function normalize(geo, img) {
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  const P = geo.attributes.position, UV = geo.attributes.uv, n = P.count;
  let top = -1e9, maxZ = -1e9, ly = 0, lc = 0;
  for (let i = 0; i < n; i++) { const y = P.getY(i), z = P.getZ(i); if (y > top) top = y; if (z > maxZ) maxZ = z; }
  for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const u = Math.floor(UV.getX(i) * cv.width), v = Math.floor(UV.getY(i) * cv.height), k = (Math.min(cv.height - 1, v) * cv.width + Math.min(cv.width - 1, u)) * 4, r = px[k], g = px[k + 1], b = px[k + 2];
    if (r - g > 45 && g - b < 20 && r > 110 && Math.abs(x) < 0.3 * (top - 0) + 1 && z > maxZ - 0.25 * Math.abs(maxZ) - 0.02) { ly += y; lc++; } }
  // ligne médiane : profondeur du visage par tranche de hauteur, sous la bouche
  const mouthY = lc ? ly / lc : top - 0.5;
  const step = (top - mouthY) / 120, bins = new Map();
  for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (Math.abs(x) > step * 3 || y > mouthY || y < mouthY - step * 60) continue; const b = Math.floor((mouthY - y) / step); bins.set(b, Math.max(bins.get(b) ?? -1e9, z)); }
  let chinY = mouthY - (top - mouthY) * 0.25, best = 0;
  for (let b = 1; b < 60; b++) { const a = bins.get(b - 1), c = bins.get(b); if (a === undefined || c === undefined) continue; const drop = a - c; if (drop > 0.1 * (top - mouthY)) { chinY = mouthY - (b - 0.5) * step; break; } }
  const s = 0.755 / (top - chinY), oy = 0.5 - top * s;
  const oz = 0.351 - maxZ * s;
  geo.scale(s, s, s); geo.translate(0, oy, oz);
  // on garde le buste (épaules) et on coupe le reste du corps
  const idx = geo.index.array, keep = [];
  for (let t = 0; t < idx.length; t += 3) { if (P.getY(idx[t]) > -0.55 || P.getY(idx[t + 1]) > -0.55 || P.getY(idx[t + 2]) > -0.55) keep.push(idx[t], idx[t + 1], idx[t + 2]); }
  geo.setIndex(keep);
  return {mouthY: mouthY * s + oy};
}


export async function loadAvatar(url, opts = {}) {
  const ld = new GLTFLoader();
  let g;
  if (typeof url !== 'string') g = await ld.parseAsync(url, '');
  else if (url.endsWith('.txt')) { const b = atob((await (await fetch(url)).text()).trim()); const u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); g = await ld.parseAsync(u8.buffer, ''); }
  else g = await ld.loadAsync(url);
  let mesh; g.scene.traverse(o => { if (o.isMesh) mesh = o; });
  mesh.updateMatrixWorld();
  const src = mesh.geometry, geo = new THREE.BufferGeometry();
  for (const name of ['position', 'uv']) { const a = src.attributes[name], f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = (c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i)); geo.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize)); }
  geo.setIndex(src.index); geo.applyMatrix4(mesh.matrixWorld);
  geo.rotateY(-Math.PI / 2);                       // le buste généré regarde +X → on le tourne vers +Z
  const tex = mesh.material.map, img = tex.image;
  const LM = normalize(geo, img); const mY = LM.mouthY;
  const P = geo.attributes.position, UV = geo.attributes.uv, n = P.count, idx = geo.index.array;
  // menton fuyant (option)
  const receding = opts.receding ?? 0;
  if (receding) for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), dy = y - mY; const w = sm(-0.06, -0.14, dy) * sm(0.085, 0.035, Math.abs(x)) * sm(0.06, 0.16, z) * sm(-0.33, -0.27, y); if (w > 0) P.setZ(i, z - receding * 0.02 * w); }
  // sommets dupliqués aux coutures UV → groupes soudés
  const gid = new Int32Array(n); let G = 0; { const m = new Map(); for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 1e5) + ',' + Math.round(P.getY(i) * 1e5) + ',' + Math.round(P.getZ(i) * 1e5); let q = m.get(k); if (q === undefined) { q = G++; m.set(k, q); } gid[i] = q; } }
  const NRM = new Float32Array(n * 3);
  { const gn = new Float32Array(G * 3); const p = P.array;
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3; const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const v of [idx[t], idx[t + 1], idx[t + 2]]) { const q = gid[v] * 3; gn[q] += nx; gn[q + 1] += ny; gn[q + 2] += nz; } }
    for (let i = 0; i < n; i++) { const q = gid[i] * 3, l = Math.hypot(gn[q], gn[q + 1], gn[q + 2]) || 1; NRM[i * 3] = gn[q] / l; NRM[i * 3 + 1] = gn[q + 1] / l; NRM[i * 3 + 2] = gn[q + 2] / l; } }
  geo.setAttribute('normal', new THREE.BufferAttribute(NRM, 3));
  // voisinage (à travers les coutures) pour lisser les masques
  const nb = Array.from({length: n}, () => []);
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
  { const mem = new Map(); for (let i = 0; i < n; i++) { const l = mem.get(gid[i]); if (l) l.push(i); else mem.set(gid[i], [i]); } for (const l of mem.values()) if (l.length > 1) { const all = []; for (const i of l) all.push(...nb[i]); for (const i of l) nb[i] = all; } }
  const smooth = (w, it) => { let cur = w; for (let s = 0; s < it; s++) { const nx = new Float32Array(n); for (let i = 0; i < n; i++) { let acc = cur[i], c = 1; const l = nb[i]; for (let j = 0; j < l.length; j++) { acc += cur[l[j]]; c++; } nx[i] = acc / c; } cur = nx; } return cur; };

  // ---- repères : sourcils et oreilles
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  const texAt = i => { const u = Math.min(cv.width - 1, Math.floor(UV.getX(i) * cv.width)), v = Math.min(cv.height - 1, Math.floor(UV.getY(i) * cv.height)), k = (v * cv.width + u) * 4; return [px[k], px[k + 1], px[k + 2]]; };
  let maxZ = -1e9; for (let i = 0; i < n; i++) maxZ = Math.max(maxZ, P.getZ(i));
  let by = 0, bc = 0; for (let i = 0; i < n; i++) { const y = P.getY(i), z = P.getZ(i); if (y < mY + 0.12 || y > mY + 0.4 || z < maxZ - 0.16 || Math.abs(P.getX(i)) > 0.12) continue; const [r, gg, b] = texAt(i); if ((r + gg + b) / 3 < 70) { by += y; bc++; } }
  const browY = bc ? by / bc : mY + 0.25;
  let earX = 0; for (let i = 0; i < n; i++) { const y = P.getY(i); if (y > mY && y < browY + 0.02) earX = Math.max(earX, Math.abs(P.getX(i))); }
  let ez = 0, ec = 0, eTop = -1e9, eBot = 1e9; for (let i = 0; i < n; i++) { const y = P.getY(i); if (y > mY - 0.05 && y < browY + 0.08 && Math.abs(P.getX(i)) > earX - 0.025) { ez += P.getZ(i); ec++; eTop = Math.max(eTop, y); eBot = Math.min(eBot, y); } }
  const earZ = ec ? ez / ec : 0;
  const LMK = {mouthY: mY, browY, earX, earZ, earTop: eTop, earBot: eBot, chinY: -0.255, top: 0.5};

  // ---- tête de base
  const skinMat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.7, metalness: 0});
  const head = new THREE.Mesh(geo, skinMat); head.name = 'head';
  const group = new THREE.Group(); group.add(head); group.userData.landmarks = LMK;

  // ---- champ « cuir chevelu » : 1 là où poussent les cheveux, 0 ailleurs
  const HC = new THREE.Vector3(0, (browY + 0.5) / 2 - 0.05, earZ);
  const scalp = new Float32Array(n), side = new Float32Array(n), front = new Float32Array(n), back = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ax = Math.abs(x);
    const fz = sm(earZ + 0.02, earZ + 0.08, z), bz = sm(earZ - 0.02, earZ - 0.08, z);
    const hlFront = browY + 0.105 - 0.03 * sm(0.05, 0.12, ax);          // golfes aux tempes
    const hlSide = eTop - 0.005 - 0.06 * sm(earZ + 0.06, earZ + 0.035, z) * sm(earZ - 0.0, earZ + 0.02, z); // pattes devant l'oreille
    const hlBack = mY + 0.03;
    const hl = fz * hlFront + bz * hlBack + (1 - fz - bz) * hlSide;
    const notEar = 1 - sm(earX - 0.03, earX - 0.01, ax) * sm(eTop + 0.01, eTop - 0.01, y) * sm(earZ - 0.05, earZ - 0.03, z) * sm(earZ + 0.05, earZ + 0.03, z);
    scalp[i] = sm(hl - 0.004, hl + 0.012, y) * notEar * (z > earZ + 0.03 && y < browY + 0.06 ? 0 : 1);
    side[i] = sm(0.06, 0.11, ax) * sm(browY + 0.13, browY + 0.05, y);                       // côtés (pour le dégradé)
    back[i] = bz * sm(browY + 0.06, browY - 0.04, y);                                          // nuque
    front[i] = fz * sm(0.09, 0.0, ax);
  }
  const SC = smooth(scalp, 2);

  // ---- zones de barbe (relatives à la bouche)
  const REG = {}; for (const k of ['must', 'tips', 'soul', 'chin', 'conn', 'cheek', 'chops', 'fadeCheek', 'strap', 'side', 'neck']) REG[k] = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ax = Math.abs(x), dy = y - mY;
    const fr = sm(0.1, 0.17, z), lips = Math.hypot(x / 0.062, dy / 0.024) < 1 && z > 0.15 ? 1 : 0, nl = 1 - lips;
    const top = mY + 0.124 - 0.085 * sm(0.02, 0.2, z), bot = -0.1 - 0.17 * sm(0.0, 0.14, z), ear = sm(earZ - 0.03, earZ + 0.01, z);
    REG.must[i] = fr * nl * sm(0.004, 0.014, dy) * sm(0.052, 0.04, dy) * sm(0.075, 0.06, ax);
    REG.tips[i] = fr * nl * sm(0.055, 0.065, ax) * sm(0.088, 0.078, ax) * sm(-0.115, -0.1, dy) * sm(0.03, 0.015, dy);
    REG.soul[i] = fr * nl * sm(0.02, 0.013, ax) * sm(-0.072, -0.062, dy) * sm(-0.02, -0.03, dy);
    REG.chin[i] = nl * sm(0.062, 0.048, ax) * sm(-0.05, -0.065, dy) * sm(bot - 0.03, bot - 0.005, y) * sm(0.03, 0.09, z);
    REG.conn[i] = fr * nl * sm(0.045, 0.055, ax) * sm(0.085, 0.072, ax) * sm(0.015, 0.0, dy) * sm(-0.1, -0.08, dy);
    const zoneV = ear * sm(top + 0.01, top - 0.02, y) * sm(bot - 0.015, bot + 0.01, y) * sm(0.9, 1.25, Math.hypot(x / 0.07, dy / 0.028));
    REG.cheek[i] = zoneV; REG.chops[i] = zoneV * sm(0.065, 0.1, ax);
    REG.fadeCheek[i] = zoneV * (0.15 + 0.85 * sm(top - 0.01, bot + 0.04, y));
    REG.strap[i] = ear * sm(bot - 0.012, bot + 0.004, y) * sm(bot + 0.05, bot + 0.034, y) * nl;
    REG.side[i] = sm(earZ - 0.035, earZ - 0.015, z) * sm(earZ + 0.07, earZ + 0.045, z) * sm(top - 0.02, top, y) * sm(eTop - 0.01, eTop - 0.03, y) * sm(earX - 0.06, earX - 0.03, ax);
    REG.neck[i] = ear * sm(bot - 0.08, bot - 0.05, y) * sm(bot + 0.005, bot - 0.01, y) * sm(earZ - 0.01, earZ + 0.04, z);
  }
  for (const k in REG) REG[k] = smooth(REG[k], 2);

  // ---- matériau des poils : couleur + grain, épaisseur portée par la géométrie
  const hairCol = new THREE.Color(opts.hairColor ?? 0x15100e);
  const makeMat = () => { const m = new THREE.MeshStandardMaterial({map: tex, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    m.onBeforeCompile = sh => { sh.uniforms.uHair = {value: hairCol};
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aDen; attribute float aShade; varying float vDen; varying float vShade; varying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDen = aDen; vShade = aShade; vP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHair; varying float vDen; varying float vShade; varying vec3 vP;\nfloat h3(vec3 p){ return fract(sin(dot(floor(p * 3600.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
        .replace('#include <map_fragment>', '#include <map_fragment>\n{ float g = h3(vP); float d = clamp(vDen, 0.0, 1.0); float cover = d >= 0.98 ? 1.0 : smoothstep(0.0, 0.6, d) * 0.45 + step(g, d) * 0.45 * smoothstep(0.0, 0.3, d) + smoothstep(0.55, 0.95, d); cover = clamp(cover, 0.0, 1.0);\n  vec3 hc = uHair * (0.75 + 0.5 * vShade) * (0.9 + 0.2 * g); diffuseColor.rgb = mix(diffuseColor.rgb, hc, cover); }');
    }; return m; };

  // Construit une coque à partir des sommets de la tête où weight > 0 : offset = normale * (eps + épaisseur), plus un déplacement libre.
  const buildShell = (name, weight, fn) => {
    const keep = new Uint8Array(n); for (let i = 0; i < n; i++) keep[i] = weight[i] > 0.02 ? 1 : 0;
    const tri = []; for (let t = 0; t < idx.length; t += 3) if (keep[idx[t]] && keep[idx[t + 1]] && keep[idx[t + 2]]) tri.push(idx[t], idx[t + 1], idx[t + 2]);
    const map = new Int32Array(n).fill(-1); let m = 0; for (const v of tri) if (map[v] < 0) map[v] = m++;
    const pos = new Float32Array(m * 3), uv = new Float32Array(m * 2), den = new Float32Array(m), shd = new Float32Array(m), src = new Int32Array(m);
    for (let i = 0; i < n; i++) if (map[i] >= 0) { const j = map[i]; src[j] = i; uv[j * 2] = UV.getX(i); uv[j * 2 + 1] = UV.getY(i); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    sg.setAttribute('aDen', new THREE.BufferAttribute(den, 1)); sg.setAttribute('aShade', new THREE.BufferAttribute(shd, 1)); sg.setIndex(tri.map(v => map[v]));
    const sh = new THREE.Mesh(sg, makeMat()); sh.name = name; sh.frustumCulled = false;
    const out = {x: 0, y: 0, z: 0, d: 0, s: 0.5};
    sh.userData.update = (params) => {
      for (let j = 0; j < m; j++) { const i = src[j]; out.x = P.getX(i); out.y = P.getY(i); out.z = P.getZ(i); out.d = 0; out.s = 0.5; const t = fn(i, params, out);
        pos[j * 3] = out.x + NRM[i * 3] * (0.0012 + t); pos[j * 3 + 1] = out.y + NRM[i * 3 + 1] * (0.0012 + t); pos[j * 3 + 2] = out.z + NRM[i * 3 + 2] * (0.0012 + t); den[j] = out.d; shd[j] = out.s; }
      // normales soudées de la coque
      const gnn = new Map(); const ia = sg.index.array; const nn = new Float32Array(m * 3);
      for (let t = 0; t < ia.length; t += 3) { const a = ia[t] * 3, b = ia[t + 1] * 3, c = ia[t + 2] * 3; const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const v of [ia[t], ia[t + 1], ia[t + 2]]) { const q = gid[src[v]]; const e = gnn.get(q) || [0, 0, 0]; e[0] += nx; e[1] += ny; e[2] += nz; gnn.set(q, e); } }
      for (let j = 0; j < m; j++) { const e = gnn.get(gid[src[j]]) || [0, 1, 0]; const l = Math.hypot(e[0], e[1], e[2]) || 1; nn[j * 3] = e[0] / l; nn[j * 3 + 1] = e[1] / l; nn[j * 3 + 2] = e[2] / l; }
      sg.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
      sg.attributes.position.needsUpdate = true; sg.attributes.aDen.needsUpdate = true; sg.attributes.aShade.needsUpdate = true; sg.computeBoundingSphere();
    };
    return sh;
  };

  // ---- module cheveux
  const hairW = new Float32Array(n); for (let i = 0; i < n; i++) hairW[i] = Math.max(SC[i], 0.03 * sm(0.0, 0.2, SC[i]) );
  // zone élargie pour les coupes longues (couvre oreilles et nuque basse)
  const longW = new Float32Array(n); for (let i = 0; i < n; i++) { const y = P.getY(i), z = P.getZ(i); longW[i] = Math.max(SC[i], sm(mY - 0.06, mY + 0.02, y) * sm(earZ + 0.04, earZ - 0.01, z)); }
  const hairShell = buildShell('hair', longW, (i, c, o) => {
    const x = o.x, y = o.y, z = o.z, ax = Math.abs(x); const w = SC[i];
    const dx = x - HC.x, dy = y - HC.y, dz = z - HC.z; const az = Math.atan2(x, -(z - HC.z)), el = Math.atan2(dy, Math.hypot(dx, dz));
    // densité : 1 dans le cuir chevelu, dégradé sur les côtés selon la coupe
    const fadeH = c.fade || 0;   // 0 aucun, 0.5 bas, 1 haut
    const sideF = side[i] * fadeH, backF = back[i] * fadeH;
    const fadeCut = Math.max(sideF * sm(browY + 0.02 + 0.08 * fadeH, browY - 0.06, y), backF * sm(browY + 0.0 + 0.08 * fadeH, mY + 0.05, y));
    let den = w * (1 - 0.8 * fadeCut);
    // épaisseur selon la coupe : dessus, côtés, nuque
    const topness = sm(browY + 0.05, browY + 0.2, y);
    let th = (c.side + (c.top - c.side) * topness) * w * (1 - fadeCut);
    // mèches sculptées dans le sens du coiffage
    const flow = c.flow === 'back' ? az * 9 + vnoise(x * 18, y * 18, z * 18) * 2.5 : c.flow === 'part' ? (Math.atan2(y - browY - 0.25, x - 0.05) * 7 + vnoise(x * 18, y * 18, z * 18) * 2) : (vnoise(x * 30, y * 30, z * 30) * 6 + az * 4);
    const ridge = Math.pow(Math.abs(Math.sin(flow)), 0.6);
    th *= 1 - c.clump * (1 - ridge);
    o.s = 0.25 + 0.75 * ridge;
    // volume avant (quiff / slick) et frange
    th += c.lift * w * front[i] * sm(browY + 0.08, browY + 0.16, y);
    if (c.fringe) { const f = front[i] * sm(browY + 0.18, browY + 0.1, y) * w; o.y -= c.fringe * 0.06 * f; o.z += c.fringe * 0.02 * f; th += c.fringe * 0.01 * f; }
    // longueur : les pointes descendent sur les côtés et la nuque
    if (c.length) { const lw = longW[i] * sm(browY + 0.08, browY - 0.04, y) * (z < earZ + 0.04 ? 1 : 0.3); o.y -= c.length * 0.09 * lw * (0.6 + 0.4 * vnoise(x * 25, y * 5, z * 25)); th += c.length * 0.02 * lw; den = Math.max(den, lw > 0.05 ? Math.min(1, lw * 3) : den); }
    o.d = den * (c.dens ?? 1); return Math.max(0, th);
  });
  // ---- modules barbe et moustache
  const beardW = new Float32Array(n); for (let i = 0; i < n; i++) beardW[i] = Math.max(REG.cheek[i], REG.chin[i], REG.strap[i], REG.side[i], REG.neck[i], REG.soul[i], REG.conn[i], REG.tips[i]);
  const mustW = new Float32Array(n); for (let i = 0; i < n; i++) mustW[i] = Math.max(REG.must[i], REG.tips[i]);
  const JC = new THREE.Vector3(0, mY + 0.06, earZ);
  const beardShell = buildShell('beard', beardW, (i, c, o) => {
    let solid = 0, stub = 0; for (const k in c.solid || {}) solid = Math.max(solid, REG[k][i] * c.solid[k]); for (const k in c.stubble || {}) stub = Math.max(stub, REG[k][i] * c.stubble[k]);
    const L = c.len || 0; const g = vnoise(o.x * 60, o.y * 60, o.z * 60);
    let th = solid > 0.05 ? (0.0025 + L * 0.03) * sm(0.05, 0.6, solid) * (0.75 + 0.25 * g) : 0;
    if (L > 0.3 && solid > 0.05) { o.y -= (L - 0.3) * 0.07 * solid * sm(mY - 0.03, mY - 0.14, o.y); o.z += (L - 0.3) * 0.015 * solid * sm(mY - 0.05, mY - 0.14, o.y); }
    o.d = Math.max(solid > 0.05 ? 0.55 + 0.45 * sm(0.1, 0.6, solid) : 0, stub * 0.45); o.s = 0.4 + 0.6 * g; return th;
  });
  const mustShell = buildShell('mustache', mustW, (i, c, o) => {
    let solid = 0; for (const k in c.solid || {}) solid = Math.max(solid, REG[k][i] * c.solid[k]);
    const g = vnoise(o.x * 70, o.y * 70, o.z * 70); const L = c.len || 0;
    if (c.curl) { const tip = sm(0.04, 0.07, Math.abs(o.x)) * REG.must[i]; o.y += c.curl * 0.02 * tip; }
    o.d = solid > 0.05 ? 0.6 + 0.4 * sm(0.1, 0.6, solid) : (c.stub ? REG.must[i] * 0.4 : 0); o.s = 0.4 + 0.6 * g;
    return solid > 0.05 ? (0.002 + L * 0.012) * sm(0.05, 0.6, solid) : 0;
  });
  group.add(hairShell, beardShell, mustShell);

  group.apply = (st) => {
    const cut = typeof st.hair === 'object' ? st.hair : CUTS[st.hair] || CUTS.slick;
    hairShell.userData.update({...cut, fade: st.fade ?? cut.fade ?? 0}); hairShell.visible = cut.key !== 'chauve';
    const bd = typeof st.beard === 'object' ? st.beard : BEARDS[st.beard] || BEARDS.rasee;
    beardShell.userData.update(bd); beardShell.visible = Object.keys(bd.solid || {}).length + Object.keys(bd.stubble || {}).length > 0;
    const md = typeof st.must === 'object' ? st.must : MUSTS[st.must] || MUSTS.sans;
    mustShell.userData.update(md); mustShell.visible = Object.keys(md.solid || {}).length > 0 || !!md.stub;
  };
  group.apply({hair: 'slick', beard: 'rasee', must: 'sans', fade: 0});
  return group;
}

// Coupes (épaisseurs en unités du modèle : tête ≈ 0,75 de haut)
export const CUTS = {
  chauve:  {key: 'chauve', label: 'Chauve', top: 0, side: 0, clump: 0, lift: 0},
  rase:    {label: 'Rasé', top: 0.0, side: 0.0, clump: 0, lift: 0, flow: 'noise', dens: 0.4},
  tondeuse:{label: 'Tondeuse', top: 0.004, side: 0.003, clump: 0.2, lift: 0, flow: 'noise'},
  court:   {label: 'Court', top: 0.016, side: 0.006, clump: 0.35, lift: 0.004, flow: 'noise', fade: 0.5},
  frange:  {label: 'French crop', top: 0.02, side: 0.006, clump: 0.4, lift: 0, fringe: 0.7, flow: 'noise', fade: 0.6},
  slick:   {label: 'Slick back', top: 0.034, side: 0.012, clump: 0.45, lift: 0.014, flow: 'back', fade: 0.4},
  quiff:   {label: 'Quiff', top: 0.032, side: 0.008, clump: 0.45, lift: 0.04, flow: 'back', fade: 0.6},
  raie:    {label: 'Raie sur le côté', top: 0.028, side: 0.01, clump: 0.4, lift: 0.01, flow: 'part', fade: 0.3},
  milong:  {label: 'Mi-long ondulé', top: 0.04, side: 0.022, clump: 0.5, lift: 0.012, flow: 'back', length: 0.6, fade: 0},
};
const FULL = {cheek: 1, chin: 1, strap: 1, side: 1, soul: 1, conn: 1};
export const BEARDS = {
  rasee:    {label: 'Rasée', solid: {}},
  troisj:   {label: '3 jours', solid: {}, stubble: {...FULL}},
  mouche:   {label: 'Mouche', solid: {soul: 1}},
  bouc:     {label: 'Bouc', solid: {chin: 1, soul: 1}, len: 0.15, conseil: true},
  actuelle: {label: 'Ta barbe', solid: {chin: 1, soul: 1, strap: 0.8}, stubble: {cheek: 0.5, side: 0.6}, len: 0.1, conseil: true},
  ancre:    {label: 'Ancre', solid: {chin: 1, soul: 1, tips: 0.8}, len: 0.12, conseil: true},
  cercle:   {label: 'Cercle', solid: {chin: 1, soul: 1, conn: 1}, len: 0.1, conseil: true},
  collier:  {label: 'Collier', solid: {strap: 1, chin: 1, side: 1}},
  favoris:  {label: 'Favoris', solid: {side: 1, chops: 1}},
  courte:   {label: 'Courte', solid: FULL, len: 0.2, conseil: true},
  degradee: {label: 'Dégradée', solid: {fadeCheek: 1, chin: 1, strap: 1, soul: 1, conn: 1}, stubble: {side: 1, cheek: 1}, len: 0.25, conseil: true},
  moyenne:  {label: 'Moyenne', solid: FULL, len: 0.55, conseil: true},
  longue:   {label: 'Longue', solid: {...FULL, neck: 0.8}, len: 1, conseil: true},
};
export const MUSTS = {
  sans:     {label: 'Sans', solid: {}},
  ombre:    {label: 'Ombre', solid: {}, stub: true},
  crayon:   {label: 'Crayon', solid: {must: 0.7}},
  fine:     {label: 'Fine', solid: {must: 1}, len: 0.2},
  chevron:  {label: 'Chevron', solid: {must: 1}, len: 0.8},
  guidon:   {label: 'Guidon', solid: {must: 1}, len: 0.5, curl: 1},
  ferACheval: {label: 'Fer à cheval', solid: {must: 1, tips: 1}, len: 0.5},
};
export const FADES = {aucun: {label: 'Aucun', v: 0}, bas: {label: 'Bas', v: 0.5}, haut: {label: 'Haut', v: 1}};
