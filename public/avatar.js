// Avatar 3D de Sabri : classification cheveux / barbe / moustache depuis la texture,
// puis filtres temps réel (longueur cheveux, dégradé, barbe, moustache).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function loadAvatar(url) {
  const g = await new GLTFLoader().loadAsync(url);
  let mesh; g.scene.traverse(o => { if (o.isMesh) mesh = o; });
  mesh.updateMatrixWorld();
  // attributs quantifiés -> float32 pour pouvoir les modifier
  const src = mesh.geometry, geo = new THREE.BufferGeometry();
  for (const name of ['position', 'uv']) { const a = src.attributes[name], f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = (c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i)); geo.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize)); }
  geo.setIndex(src.index); geo.applyMatrix4(mesh.matrixWorld);
  // le modèle regarde vers +X : on le tourne pour qu'il regarde la caméra (+Z)
  geo.rotateY(-Math.PI / 2);
  const tex = mesh.material.map;
  const img = tex.image; const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  const P = geo.attributes.position, UV = geo.attributes.uv, n = P.count;
  const base = new Float32Array(P.array);
  // regroupe les sommets dupliqués aux coutures UV pour qu'ils bougent ensemble
  const gid = new Int32Array(n); { const m = new Map(); let c = 0; for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 1e5) + ',' + Math.round(P.getY(i) * 1e5) + ',' + Math.round(P.getZ(i) * 1e5); let g = m.get(k); if (g === undefined) { g = c++; m.set(k, g); } gid[i] = g; } }
  const hairy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.min(cv.width - 1, Math.floor(UV.getX(i) * cv.width)), y = Math.min(cv.height - 1, Math.floor(UV.getY(i) * cv.height));
    const k = (y * cv.width + x) * 4, r = px[k], gg = px[k + 1], b = px[k + 2], L = (r + gg + b) / 3;
    hairy[i] = (L < 85 && r - b > 6) ? 1 : 0; // brun chaud et foncé = poils (le t-shirt est noir neutre)
  }
  // voisinage pour lisser les masques
  const idx = geo.index.array; const nb = new Array(n);
  for (let i = 0; i < n; i++) nb[i] = [];
  // voisins = sommets des triangles adjacents, à travers les coutures
  const members = new Map(); for (let i = 0; i < n; i++) { const g = gid[i]; const l = members.get(g); if (l) l.push(i); else members.set(g, [i]); }
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
  for (const l of members.values()) if (l.length > 1) { const all = []; for (const i of l) all.push(...nb[i]); for (const i of l) nb[i] = all; }
  // poils : un sommet dupliqué est poil si une de ses copies l'est
  for (const l of members.values()) if (l.length > 1) { let h = 0; for (const i of l) h = Math.max(h, hairy[i]); for (const i of l) hairy[i] = h; }
  const smooth = (w, it) => { let cur = w; for (let s = 0; s < it; s++) { const nx = new Float32Array(n); for (let i = 0; i < n; i++) { let acc = cur[i], c = 1; const l = nb[i]; for (let j = 0; j < l.length; j++) { acc += cur[l[j]]; c++; } nx[i] = acc / c; } cur = nx; } return cur; };
  // après rotation : visage vers +Z, haut = +Y, gauche/droite = X
  const hair = new Float32Array(n), beard = new Float32Array(n), must = new Float32Array(n), zone = new Float32Array(n), side = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const facial = z > -0.04 && y < 0.035 && y > -0.3;
    const brows = z > 0.12 && y > 0.05 && y < 0.21;
    if (hairy[i]) {
      if (facial) { if (y > -0.095 && z > 0.18 && Math.abs(x) < 0.12) must[i] = 1; else beard[i] = 1; }
      else if (!brows && y > -0.16) hair[i] = 1;
    }
    // zone où pousse une barbe pleine : bas du visage, sans les lèvres
    const mouth = Math.hypot((x) / 0.075, (y + 0.072) / 0.03);
    const top = 0.045 - 0.085 * sm(0.02, 0.2, z);      // de la patte (près de l'oreille) au coin de la bouche
    const bot = -0.1 - 0.17 * sm(0.0, 0.14, z);        // angle de la mâchoire -> sous le menton
    const ear = sm(-0.03, 0.01, z);                     // rien derrière l'oreille
    zone[i] = ear * sm(top + 0.01, top - 0.02, y) * sm(bot - 0.015, bot + 0.01, y) * sm(0.85, 1.25, mouth) * (1 - sm(0.2, 0.26, z) * sm(-0.035, 0.0, y) * (1 - sm(0.05, 0.1, Math.abs(x))));
    if (false) zone[i] = sm(top + 0.01, top - 0.02, y) * sm(-0.3, -0.24, y) * sm(-0.06, 0.02, z) * sm(0.85, 1.25, mouth) * (1 - sm(0.12, 0.2, z) * sm(-0.035, 0.0, y) * (1 - sm(0.05, 0.1, Math.abs(x))));
    side[i] = sm(0.11, 0.17, Math.abs(x)) * sm(0.3, 0.12, y); // côtés et nuque basse pour le dégradé
  }
  const Hs = smooth(hair, 3); for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); const earZ = sm(0.14, 0.12, Math.abs(x)) ; Hs[i] = sm(0.25, 0.75, Hs[i]) * Math.max(earZ, 1 - sm(0.12, 0.08, y) * sm(-0.06, -0.02, y) * sm(-0.1, -0.06, z) * sm(0.06, 0.02, z)); }
  const H = smooth(Hs, 2), B = smooth(beard, 2), M = smooth(must, 2), Z = smooth(zone, 2);
  for (let i = 0; i < n; i++) { const y = P.getY(i), z = P.getZ(i); side[i] = Math.max(side[i], sm(-0.02, -0.12, z) * sm(0.16, 0.02, y)); }
  geo.setAttribute('aHair', new THREE.BufferAttribute(H, 1));
  geo.setAttribute('aBeard', new THREE.BufferAttribute(B, 1));
  geo.setAttribute('aMust', new THREE.BufferAttribute(M, 1));
  geo.setAttribute('aZone', new THREE.BufferAttribute(Z, 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));

  const U = {
    uSkin: {value: new THREE.Color(0.86, 0.62, 0.50)}, uBeardCol: {value: new THREE.Color(0.075, 0.045, 0.035)},
    uBeardShave: {value: 0}, uMustShave: {value: 0}, uFull: {value: 0}, uStubble: {value: 0}, uFade: {value: 0}
  };
  // teinte de peau mesurée sur les joues
  { let r = 0, g2 = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (!hairy[i] && z > 0.2 && y > 0.03 && y < 0.07 && Math.abs(x) > 0.07 && Math.abs(x) < 0.12) { const u = Math.floor(UV.getX(i) * cv.width), v = Math.floor(UV.getY(i) * cv.height), k = (v * cv.width + u) * 4; r += px[k]; g2 += px[k + 1]; b += px[k + 2]; c++; } } if (c) U.uSkin.value.setRGB(r / c / 255, g2 / c / 255, b / c / 255, THREE.SRGBColorSpace); }

  const mat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.75, metalness: 0});
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aHair; attribute float aBeard; attribute float aMust; attribute float aZone; attribute float aSide;
varying float vHair; varying float vBeard; varying float vMust; varying float vZone; varying float vSide; varying vec3 vP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vHair=aHair; vBeard=aBeard; vMust=aMust; vZone=aZone; vSide=aSide; vP=position;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uSkin; uniform vec3 uBeardCol; uniform float uBeardShave; uniform float uMustShave; uniform float uFull; uniform float uStubble; uniform float uFade;
varying float vHair; varying float vBeard; varying float vMust; varying float vZone; varying float vSide; varying vec3 vP;
float hsh(vec3 p){ return fract(sin(dot(floor(p*900.0), vec3(12.9898,78.233,37.719)))*43758.5453); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  // rasage : on remplace les poils existants par la peau
  c = mix(c, uSkin, clamp(vBeard * 2.5 * uBeardShave, 0.0, 1.0));
  c = mix(c, uSkin, clamp(vMust * 2.5 * uMustShave, 0.0, 1.0));
  // barbe pleine / barbe de 3 jours sur toute la zone
  float grain = 0.55 + 0.45 * hsh(vP); float g2 = 0.8 + 0.2 * hsh(vP * 0.37);
  float full = vZone * uFull * g2;
  float stub = vZone * uStubble * grain * 0.55;
  c = mix(c, uBeardCol, clamp(max(full, stub), 0.0, 1.0));
  // dégradé : les côtés passent du cheveu à la peau ombrée
  float fade = vHair * vSide * uFade;
  vec3 shadow = mix(uSkin, uBeardCol, 0.45 + 0.25 * hsh(vP));
  c = mix(c, shadow, clamp(fade, 0.0, 1.0));
  diffuseColor.rgb = c;
}`);
  };
  const out = new THREE.Mesh(geo, mat);
  out.userData.base = base;

  // déformations géométriques (longueur cheveux / barbe)
  const hw = new Float32Array(n);
  const pos = P.array, tmp = new THREE.Vector3();
  const HC = new THREE.Vector3(0, 0.08, -0.03);
  // « crâne » : pour chaque direction depuis le centre de la tête, rayon minimal des cheveux (surface intérieure de la coiffure)
  const NB = 36, skull = new Float32Array(NB * NB).fill(1e9);
  const binOf = (dx, dy, dz) => { const th = Math.acos(Math.max(-1, Math.min(1, dy))), ph = Math.atan2(dx, dz) + Math.PI; return [Math.min(NB - 1, Math.floor(th / Math.PI * NB)), Math.min(NB - 1, Math.floor(ph / (2 * Math.PI) * NB))]; };
  for (let i = 0; i < n; i++) { if (!hair[i]) continue; const dx = P.getX(i) - HC.x, dy = P.getY(i) - HC.y, dz = P.getZ(i) - HC.z, r = Math.hypot(dx, dy, dz); const [a1, b1] = binOf(dx / r, dy / r, dz / r); const k = a1 * NB + b1; if (r < skull[k]) skull[k] = r; }
  { const fill = () => { const nx = new Float32Array(skull); let miss = 0; for (let a1 = 0; a1 < NB; a1++) for (let b1 = 0; b1 < NB; b1++) { const k = a1 * NB + b1; if (skull[k] < 1e8) continue; let acc = 0, c = 0; for (const [da, db] of [[1,0],[-1,0],[0,1],[0,-1]]) { const aa = a1 + da, bb = (b1 + db + NB) % NB; if (aa < 0 || aa >= NB) continue; const v = skull[aa * NB + bb]; if (v < 1e8) { acc += v; c++; } } if (c) nx[k] = acc / c; else miss++; } skull.set(nx); return miss; };
    for (let it = 0; it < 60 && fill() > 0; it++);
    for (let it = 0; it < 2; it++) { const nx = new Float32Array(skull); for (let a1 = 0; a1 < NB; a1++) for (let b1 = 0; b1 < NB; b1++) { let acc = 0, c = 0; for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const aa = a1 + da; if (aa < 0 || aa >= NB) continue; acc += skull[aa * NB + (b1 + db + NB) % NB]; c++; } nx[a1 * NB + b1] = acc / c; } skull.set(nx); } }
  const skullR = (dx, dy, dz) => { const [a1, b1] = binOf(dx, dy, dz); return skull[a1 * NB + b1]; };
  const JC = new THREE.Vector3(0, -0.02, 0.02);
  out.apply = (s) => {
    U.uBeardShave.value = s.beardShave; U.uMustShave.value = s.mustShave; U.uFull.value = s.full; U.uStubble.value = s.stubble; U.uFade.value = s.fade;
    for (let i = 0; i < n; i++) {
      const o = i * 3; let x = base[o], y = base[o + 1], z = base[o + 2];
      const h = H[i] * (1 - sm(0.1, 0.14, Math.abs(x)) * sm(0.14, 0.08, y) * sm(-0.12, -0.06, z));
      if (h > 0.001 && s.hair !== 0) {
        // épaisseur au-dessus du crâne (ellipsoïde) : on la comprime ou l'étire, l'ordre des mèches est conservé
        tmp.set(x - HC.x, y - HC.y, z - HC.z); const r = tmp.length(); tmp.divideScalar(r);
        const rs = Math.min(skullR(tmp.x, tmp.y, tmp.z), r);
        const t = r - rs; let r2;
        if (s.hair < 0) r2 = rs + Math.max(t, 0) * (1 + s.hair * 0.8) + Math.min(t, 0);
        else r2 = rs + Math.max(t, 0) * (1 + s.hair * 1.2) + Math.min(t, 0) + s.hair * 0.012;
        const nr = r + (r2 - r) * h; x = HC.x + tmp.x * nr; y = HC.y + tmp.y * nr; z = HC.z + tmp.z * nr;
        if (s.hair > 0) y -= s.hair * 0.06 * h * sm(0.15, -0.08, y) * sm(-0.04, -0.12, z);
      }
      hw[i] = h;
      const bw = Math.max(B[i] * s.beardKeep, Z[i] * s.full);
      if (bw > 0.001 && s.beardLen > 0) {
        tmp.set(x - JC.x, y - JC.y, z - JC.z).normalize();
        const d = s.beardLen * 0.022 * bw; x += tmp.x * d; z += tmp.z * d * 1.1; y += tmp.y * d - s.beardLen * 0.03 * bw * sm(-0.12, -0.24, y) * sm(0.05, 0.15, z);
      }
      const mw = M[i] * (1 - s.mustShave);
      if (mw > 0.001 && s.mustLen > 0) { z += s.mustLen * 0.012 * mw; y -= s.mustLen * 0.004 * mw; }
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
    }
    P.needsUpdate = true; weldNormals(); geo.computeBoundingSphere();
  };
  const G = gid.reduce((a, b) => Math.max(a, b), 0) + 1, gn = new Float32Array(G * 3);
  const nrm = new Float32Array(n * 3); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const weldNormals = () => {
    gn.fill(0); const p = pos;
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [idx[t], idx[t + 1], idx[t + 2]]) { const g = gid[v] * 3; gn[g] += nx; gn[g + 1] += ny; gn[g + 2] += nz; } }
    for (let i = 0; i < n; i++) { const g = gid[i] * 3; const l = Math.hypot(gn[g], gn[g + 1], gn[g + 2]) || 1; nrm[i * 3] = gn[g] / l; nrm[i * 3 + 1] = gn[g + 1] / l; nrm[i * 3 + 2] = gn[g + 2] / l; }
    geo.attributes.normal.needsUpdate = true;
  };
  weldNormals();
  return out;
}

// Les « filtres » proposés dans l'app
export const BEARDS = {
  rasee:   {label: 'Rasée',          beardShave: 1, full: 0,   stubble: 0,   beardLen: 0,   beardKeep: 0},
  troisj:  {label: '3 jours',        beardShave: 1, full: 0,   stubble: 1,   beardLen: 0,   beardKeep: 0},
  bouc:    {label: 'Bouc actuel',    beardShave: 0, full: 0,   stubble: 0,   beardLen: 0,   beardKeep: 1},
  courte:  {label: 'Barbe courte',   beardShave: 0, full: 0.85, stubble: 0.6, beardLen: 0.25, beardKeep: 1},
  longue:  {label: 'Barbe longue',   beardShave: 0, full: 1,   stubble: 0,   beardLen: 1,   beardKeep: 1},
};
export const MUSTS = {
  sans:   {label: 'Sans',   mustShave: 1, mustLen: 0},
  fine:   {label: 'Fine',   mustShave: 0, mustLen: 0},
  pleine: {label: 'Épaisse', mustShave: 0, mustLen: 1},
};
