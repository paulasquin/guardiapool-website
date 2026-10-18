// One particle field shared by the whole page (adapted from paulasquin.com and
// aidiligence.eu). Every section names a shape (data-shape); the particles fly
// from the current shape to the next one. Each particle carries a "kind"
// (integer part of w) and a parameter (fraction of w) that the vertex shader
// animates: the lighthouse beam, water, ripples, the walking adult and child of
// the scenario, the alarm, the camera sweep, the skeletons' keypoints.
import * as THREE from 'three';
import { LANG } from './i18n.js';

const K = {
  STILL: 0, WAVE: 1, RAY: 2, BEAM: 3, ORBIT: 4, RIPPLE: 5, ADULT: 6, CHILD: 7, ZONE: 8, SIREN: 9,
  SCAN: 10, KEY: 11, BONE: 12, GLOW: 13, DROP: 14, TIMER: 15, SEA: 16, CAUSTIC: 17, FLOW: 18, PERIM: 19,
};

// The scenario's garden: the camera on its post, where the alarm rings from.
const CAM = new THREE.Vector3(1.2, 0.95, -1.45);
const SEA_Y = -1.3;
const LAMP_Y = 0.94;

/* ---------------- shapes ---------------- */

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

class Shape {
  constructor(n) {
    this.n = n;
    this.pos = new Float32Array(n * 4);
    this.col = new Float32Array(n * 3);
    this.i = 0;
  }
  push(x, y, z, kind, param, c) {
    if (this.i >= this.n) return;
    const i = this.i++;
    this.pos.set([x, y, z, kind + Math.min(Math.max(param, 0), 0.999)], i * 4);
    this.col.set([c.r, c.g, c.b], i * 3);
  }
  get full() { return this.i >= this.n; }
}

const C = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const lerpC = (a, b, t) => a.clone().lerp(b, t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Text drawn into a canvas and read back as points (labels of the detection boxes).
function textPoints(text, px = 96) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = `600 ${px}px Inter, system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 8, h = Math.ceil(px * 1.3);
  c.width = w; c.height = h;
  ctx.font = font; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 4, h / 2);
  const d = ctx.getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 140) pts.push([x / px, -(y - h / 2) / px]);
  return { pts, w: w / px };
}

/** A standing person, feet at y = 0, facing +z: joints and bones. Children have a bigger head and shorter legs. */
function skeleton(h, child) {
  const k = child
    ? { head: 0.88, hr: 0.1, neck: 0.75, sh: 0.72, sw: 0.13, el: 0.55, ew: 0.17, wr: 0.4, ww: 0.17, hip: 0.44, hw: 0.07, kn: 0.22, kw: 0.07, an: 0.02, aw: 0.07 }
    : { head: 0.92, hr: 0.065, neck: 0.83, sh: 0.81, sw: 0.12, el: 0.62, ew: 0.15, wr: 0.46, ww: 0.17, hip: 0.52, hw: 0.06, kn: 0.27, kw: 0.06, an: 0.02, aw: 0.07 };
  const J = {
    head: V(0, k.head * h, 0), neck: V(0, k.neck * h, 0),
    lsh: V(-k.sw * h, k.sh * h, 0), rsh: V(k.sw * h, k.sh * h, 0),
    lel: V(-k.ew * h, k.el * h, 0.02 * h), rel: V(k.ew * h, k.el * h, 0.02 * h),
    lwr: V(-k.ww * h, k.wr * h, 0.05 * h), rwr: V(k.ww * h, k.wr * h, 0.05 * h),
    lhip: V(-k.hw * h, k.hip * h, 0), rhip: V(k.hw * h, k.hip * h, 0),
    lkn: V(-k.kw * h, k.kn * h, 0.01 * h), rkn: V(k.kw * h, k.kn * h, 0.01 * h),
    lan: V(-k.aw * h, k.an * h, 0), ran: V(k.aw * h, k.an * h, 0),
  };
  const mid = J.lhip.clone().lerp(J.rhip, 0.5);
  const bones = [[J.neck, mid], [J.lsh, J.rsh], [J.lhip, J.rhip], [J.lsh, J.lel], [J.lel, J.lwr], [J.rsh, J.rel], [J.rel, J.rwr],
    [J.lhip, J.lkn], [J.lkn, J.lan], [J.rhip, J.rkn], [J.rkn, J.ran]];
  return { J, bones, headR: k.hr * h };
}

/** Points of a person in particles: a head shell, bones, a footprint ring. */
function person(s, r, h, child, kind, c, count, at = V(0, 0, 0)) {
  const { J, bones, headR } = skeleton(h, child);
  for (let i = 0; i < count; i++) {
    const u = r();
    if (u < 0.28) {
      const a = r() * Math.PI * 2, b = Math.acos(r() * 2 - 1);
      s.push(at.x + J.head.x + Math.sin(b) * Math.cos(a) * headR, at.y + J.head.y + Math.cos(b) * headR, at.z + J.head.z + Math.sin(b) * Math.sin(a) * headR, kind, 0, c.clone().multiplyScalar(0.7 + r() * 0.4));
    } else if (u < 0.88) {
      const [a, b] = bones[Math.floor(r() * bones.length)], t = r(), j = 0.012 * h;
      s.push(at.x + a.x + (b.x - a.x) * t + (r() - 0.5) * j, at.y + a.y + (b.y - a.y) * t + (r() - 0.5) * j, at.z + a.z + (b.z - a.z) * t + (r() - 0.5) * j, kind, 0, c.clone().multiplyScalar(0.55 + r() * 0.45));
    } else {
      const a = r() * Math.PI * 2, rr = h * 0.32;
      s.push(at.x + Math.cos(a) * rr, at.y + 0.005, at.z + Math.sin(a) * rr, kind, 0, c.clone().multiplyScalar(0.3));
    }
  }
}

/** Rounded rectangle centred on the origin in the xz plane, by perimeter fraction t. */
function roundRect(t, hx, hz, rad) {
  const sx = hx - rad, sz = hz - rad, arc = (Math.PI / 2) * rad;
  const segs = [2 * sx, arc, 2 * sz, arc, 2 * sx, arc, 2 * sz, arc];
  const total = segs.reduce((a, b) => a + b, 0);
  let d = t * total, k = 0;
  while (k < 7 && d > segs[k]) { d -= segs[k]; k++; }
  // Clockwise from the top-left end of the top side; corners turn from angle a0, downwards.
  const corner = (cx, cz, a0) => { const a = a0 - d / rad; return [cx + Math.cos(a) * rad, cz + Math.sin(a) * rad]; };
  switch (k) {
    case 0: return [-sx + d, hz];
    case 1: return corner(sx, sz, Math.PI / 2);
    case 2: return [hx, sz - d];
    case 3: return corner(sx, -sz, 0);
    case 4: return [sx - d, -hz];
    case 5: return corner(-sx, -sz, -Math.PI / 2);
    case 6: return [-hx, -sz + d];
    default: return corner(-sx, sz, Math.PI);
  }
}

/** A pool: water (kind WAVE) is left to the caller; this draws the coping and the walls. */
function coping(s, r, L, W, count, c) {
  for (let i = 0; i < count; i++) {
    const t = r() * 4 * (L + W), p = t < 2 * L ? [t - L, -W] : t < 2 * L + 2 * W ? [L, t - 2 * L - W] : t < 4 * L + 2 * W ? [L - (t - 2 * L - 2 * W), W] : [-L, W - (t - 4 * L - 2 * W)];
    const down = r() < 0.3 ? r() * 0.35 : 0;
    s.push(p[0], -down, p[1], K.STILL, 0, c.clone().multiplyScalar(down ? 0.1 : 0.3 + r() * 0.25));
  }
}

// Hero and about: the lighthouse of the logo, its rays, its beam sweeping the sea.
function beacon(n) {
  const s = new Shape(n), r = rng(1);
  const stripeA = C('#8b7bff'), stripeB = C('#eef0ff'), lamp = C('#fff3d6'), roof = C('#6b5cff'), ray = C('#6fd6ff'), beam = C('#dff6ff');
  const base = SEA_Y + 0.02, top = 0.74, R0 = 0.42, R1 = 0.26;
  const nTower = Math.floor(n * 0.2), nTop = Math.floor(n * 0.07), nRays = Math.floor(n * 0.08), nBeam = Math.floor(n * 0.17);
  for (let i = 0; i < nTower; i++) {
    const y = base + r() * (top - base), f = (y - base) / (top - base), R = R0 + (R1 - R0) * f, a = r() * Math.PI * 2;
    const band = (((y - base) * 1.25 + a / (Math.PI * 2)) % 1 + 1) % 1 < 0.5;
    const lit = 0.55 + 0.45 * Math.max(0, Math.cos(a - 1.2)); // light from the front right
    s.push(Math.cos(a) * R, y, Math.sin(a) * R, K.STILL, 0, (band ? stripeA.clone().multiplyScalar(1.1) : stripeB.clone().multiplyScalar(0.75)).multiplyScalar(lit * (0.75 + r() * 0.4)));
  }
  for (let i = 0; i < nTop; i++) {
    const u = r(), a = r() * Math.PI * 2;
    if (u < 0.3) { // gallery and its rail
      const rr = 0.38 + (r() < 0.5 ? 0 : -0.06);
      s.push(Math.cos(a) * rr, top + (r() < 0.6 ? 0 : 0.09), Math.sin(a) * rr, K.STILL, 0, stripeB.clone().multiplyScalar(0.35 + r() * 0.2));
    } else if (u < 0.75) { // lantern room
      const y = top + 0.04 + r() * 0.34;
      s.push(Math.cos(a) * 0.2, y, Math.sin(a) * 0.2, K.GLOW, r(), lamp.clone().multiplyScalar(0.6 + r() * 0.5));
    } else { // roof
      const f = r(), y = top + 0.38 + f * 0.28;
      s.push(Math.cos(a) * 0.27 * (1 - f), y, Math.sin(a) * 0.27 * (1 - f), K.STILL, 0, roof.clone().multiplyScalar(0.5 + r() * 0.3));
    }
  }
  // Rays around the lantern, as in the logo (front plane).
  const angles = [200, 178, 155, 132, 110, 90, 70, 48, 25, 2, -20];
  for (let i = 0; i < nRays; i++) {
    const a = THREE.MathUtils.degToRad(angles[Math.floor(r() * angles.length)]), t = r();
    const rr = 0.5 + t * 0.32;
    s.push(Math.cos(a) * rr, LAMP_Y + Math.sin(a) * rr, 0.25, K.RAY, t, ray.clone().multiplyScalar(0.6 + r() * 0.4));
  }
  // The beam: two cones from the lantern, turned around the tower by the shader.
  for (let i = 0; i < nBeam; i++) {
    const d = 0.25 + Math.pow(r(), 1.5) * 2.5, side = r() < 0.72 ? 1 : -1, w = 0.04 + d * 0.13;
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * w;
    s.push(side * d, LAMP_Y + Math.cos(a) * rr * 0.6, Math.sin(a) * rr, K.BEAM, d / 2.8, beam.clone().multiplyScalar(0.55 + r() * 0.35));
  }
  const deep = C('#1d2a6e'), glint = C('#8fdcff');
  while (!s.full) {
    const a = r() * Math.PI * 2, rr = 0.5 + Math.sqrt(r()) * 3.2;
    s.push(Math.cos(a) * rr, SEA_Y, Math.sin(a) * rr, K.SEA, r(), lerpC(deep, glint, Math.pow(r(), 3)).multiplyScalar(0.5 + r() * 0.4));
  }
  return s;
}

// The statistics: a drop falls, rings spread; around it, a two-minute countdown.
function ripple(n) {
  const s = new Shape(n), r = rng(2);
  const deep = C('#1f3f9a'), light = C('#9fe7ff'), drop = C('#e9fbff'), timer = C('#ff8a6b');
  const nDrop = Math.floor(n * 0.025), nTimer = Math.floor(n * 0.07);
  for (let i = 0; i < nDrop; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, q = Math.sqrt(1 - u * u), rad = 0.07 * Math.cbrt(r());
    const tail = u > 0 ? 1 + u * 0.8 : 1; // a drop, pointed upwards
    s.push(q * Math.cos(th) * rad, u * rad * tail, q * Math.sin(th) * rad, K.DROP, r(), drop.clone().multiplyScalar(0.7 + r() * 0.4));
  }
  for (let i = 0; i < nTimer; i++) {
    const f = r(), a = Math.PI / 2 - f * Math.PI * 2, rr = 2.55 + (r() - 0.5) * 0.05;
    const tick = (f * 60) % 1 < 0.12 && r() < 0.5;
    s.push(Math.cos(a) * (tick ? rr + 0.1 : rr), 0.02, -Math.sin(a) * (tick ? rr + 0.1 : rr), K.TIMER, f, timer.clone().multiplyScalar(0.6 + r() * 0.4));
  }
  while (!s.full) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 2.35;
    s.push(Math.cos(a) * rr, 0, Math.sin(a) * rr, K.RIPPLE, r(), lerpC(deep, light, Math.pow(r(), 2.2)).multiplyScalar(0.45 + r() * 0.45));
  }
  return s;
}

// The scenario: a garden seen from above, the pool, the watched zone, the camera,
// an adult and a child who walk as the page scrolls (Field.story).
const POOL = { L: 1.2, W: 0.62 };
const ZONE = { hx: POOL.L + 0.62, hz: POOL.W + 0.62, rad: 0.45 };
function watch(n) {
  const s = new Shape(n), r = rng(3);
  const water = C('#2f7fd0'), glint = C('#bff0ff'), edge = C('#e9ecff'), zone = C('#6fd6ff'), cone = C('#a78bff');
  const adult = C('#4fe0c0'), child = C('#ffb37a'), ground = C('#3b4580'), siren = C('#ff5a5a'), post = C('#cfd6ff');
  const nEdge = Math.floor(n * 0.08), nZone = Math.floor(n * 0.1), nCone = Math.floor(n * 0.1), nGround = Math.floor(n * 0.08);
  const nSiren = Math.floor(n * 0.07), nAdult = Math.floor(n * 0.075), nChild = Math.floor(n * 0.055), nCam = Math.floor(n * 0.025);
  coping(s, r, POOL.L, POOL.W, nEdge, edge);
  for (let i = 0; i < nZone; i++) {
    const t = r();
    if ((t * 46) % 1 > 0.62) { i--; continue; } // dashed
    const [x, z] = roundRect(t, ZONE.hx, ZONE.hz, ZONE.rad);
    s.push(x + (r() - 0.5) * 0.02, 0.01, z + (r() - 0.5) * 0.02, K.ZONE, t, zone.clone().multiplyScalar(0.55 + r() * 0.35));
  }
  for (let i = 0; i < nCone; i++) {
    // The field of view, from the camera to the far side of the zone: brightness swept by the shader.
    const f = r(), a = -2.75 + f * 1.4, reach = 2.2 + r() * 2.4, t = Math.pow(r(), 0.8);
    const gx = CAM.x + Math.cos(a) * reach, gz = CAM.z - Math.sin(a) * reach;
    const p = CAM.clone().lerp(V(gx, 0, gz), t);
    s.push(p.x, p.y, p.z, K.SCAN, f, cone.clone().multiplyScalar(t < 0.04 ? 1 : 0.3 + r() * 0.3));
  }
  for (let i = 0; i < nGround; i++) {
    const x = (r() * 2 - 1) * 3.1, z = (r() * 2 - 1) * 2.2;
    if (Math.abs(x) < POOL.L + 0.05 && Math.abs(z) < POOL.W + 0.05) { i--; continue; }
    const grid = Math.abs(((x * 2.5) % 1 + 1) % 1 - 0.5) > 0.46 || Math.abs(((z * 2.5) % 1 + 1) % 1 - 0.5) > 0.46;
    s.push(x, -0.01, z, K.STILL, 0, ground.clone().multiplyScalar((grid ? 0.35 : 0.1) * (1 - Math.hypot(x / 3.4, z / 2.6) * 0.6)));
  }
  for (let i = 0; i < nCam; i++) {
    if (r() < 0.55) s.push(CAM.x + (r() - 0.5) * 0.02, r() * CAM.y, CAM.z + (r() - 0.5) * 0.02, K.STILL, 0, post.clone().multiplyScalar(0.25 + r() * 0.2));
    else s.push(CAM.x + (r() - 0.5) * 0.2, CAM.y + (r() - 0.5) * 0.09, CAM.z + (r() - 0.5) * 0.08, K.GLOW, r(), post.clone().multiplyScalar(0.7 + r() * 0.4));
  }
  for (let i = 0; i < nSiren; i++) {
    const a = r() * Math.PI * 2;
    s.push(CAM.x + Math.cos(a), 0.02, CAM.z + Math.sin(a), K.SIREN, r() < 0.5 ? 0 : 0.5, siren.clone().multiplyScalar(0.7 + r() * 0.4));
  }
  person(s, r, 1.0, false, K.ADULT, adult, nAdult);
  person(s, r, 0.56, true, K.CHILD, child, nChild);
  while (!s.full) {
    const x = (r() * 2 - 1) * (POOL.L - 0.03), z = (r() * 2 - 1) * (POOL.W - 0.03);
    s.push(x, -0.05, z, K.WAVE, r(), lerpC(water, glint, Math.pow(r(), 6)).multiplyScalar(0.3 + r() * 0.35));
  }
  return s;
}

// Detection: an adult and a child as the network sees them — keypoints, bones,
// boxes and labels — measured against a ruler; the ball is ignored.
function pose(n) {
  const s = new Shape(n), r = rng(4);
  const adult = C('#4fe0c0'), child = C('#ffb37a'), bone = C('#cfd6ff'), ruler = C('#8b93c8'), ball = C('#6c7095'), floor = C('#3b4580');
  const ground = -1.35;
  const people = [{ h: 2.55, child: false, x: -0.95, c: adult, label: LANG === 'fr' ? 'ADULTE' : 'ADULT' },
    { h: 1.42, child: true, x: 0.72, c: child, label: LANG === 'fr' ? 'ENFANT' : 'CHILD' }];
  const nKey = Math.floor(n * 0.12), nBone = Math.floor(n * 0.28), nBox = Math.floor(n * 0.1), nLabel = Math.floor(n * 0.14);
  const nRuler = Math.floor(n * 0.07), nBall = Math.floor(n * 0.04);
  const sk = people.map((p) => ({ ...p, ...skeleton(p.h, p.child) }));
  for (let i = 0; i < nKey; i++) {
    const p = sk[r() < 0.6 ? 0 : 1], joints = Object.values(p.J), j = joints[Math.floor(r() * joints.length)];
    const u = r() * 2 - 1, th = r() * Math.PI * 2, q = Math.sqrt(1 - u * u), rad = 0.045 * Math.cbrt(r());
    s.push(p.x + j.x + q * Math.cos(th) * rad, ground + j.y + u * rad, j.z + q * Math.sin(th) * rad, K.KEY, r(), p.c.clone().multiplyScalar(0.8 + r() * 0.4));
  }
  for (let i = 0; i < nBone; i++) {
    const p = sk[r() < 0.6 ? 0 : 1];
    if (r() < 0.22) { // head outline
      const a = r() * Math.PI * 2;
      s.push(p.x + p.J.head.x + Math.cos(a) * p.headR, ground + p.J.head.y + Math.sin(a) * p.headR, 0, K.BONE, r(), bone.clone().multiplyScalar(0.4 + r() * 0.3));
      continue;
    }
    const [a, b] = p.bones[Math.floor(r() * p.bones.length)], t = r();
    s.push(p.x + a.x + (b.x - a.x) * t, ground + a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, K.BONE, t, bone.clone().multiplyScalar(0.3 + r() * 0.25));
  }
  const boxes = sk.map((p) => ({ p, x0: p.x - p.h * 0.27, x1: p.x + p.h * 0.27, y0: ground - 0.06, y1: ground + p.h + 0.08 }));
  for (let i = 0; i < nBox; i++) {
    const b = boxes[r() < 0.55 ? 0 : 1], L = 0.24, corner = Math.floor(r() * 4), along = r() * L, horiz = r() < 0.5;
    const cx = corner % 2 ? b.x1 : b.x0, cy = corner < 2 ? b.y0 : b.y1, sx = corner % 2 ? -1 : 1, sy = corner < 2 ? 1 : -1;
    if (r() < 0.2) { // faint full box
      const t = r() * 2 * ((b.x1 - b.x0) + (b.y1 - b.y0)), w = b.x1 - b.x0, h = b.y1 - b.y0;
      const [x, y] = t < w ? [b.x0 + t, b.y0] : t < w + h ? [b.x1, b.y0 + t - w] : t < 2 * w + h ? [b.x1 - (t - w - h), b.y1] : [b.x0, b.y1 - (t - 2 * w - h)];
      s.push(x, y, 0, K.STILL, 0, b.p.c.clone().multiplyScalar(0.12 + r() * 0.08));
    } else s.push(cx + (horiz ? sx * along : 0), cy + (horiz ? 0 : sy * along), 0, K.STILL, 0, b.p.c.clone().multiplyScalar(0.6 + r() * 0.4));
  }
  const labels = boxes.map((b) => ({ b, ...textPoints(b.p.label) }));
  for (let i = 0; i < nLabel; i++) {
    const l = labels[r() < 0.5 ? 0 : 1], sc = 0.2;
    if (!l.pts.length) { s.push(l.b.x0, l.b.y1 + 0.2, 0, K.STILL, 0, l.b.p.c); continue; }
    const [x, y] = l.pts[Math.floor(r() * l.pts.length)];
    s.push(l.b.x0 + x * sc, l.b.y1 + 0.2 + y * sc, 0, K.STILL, 0, l.b.p.c.clone().multiplyScalar(0.55 + r() * 0.3));
  }
  const rx = 1.72, top = ground + 2.75;
  for (let i = 0; i < nRuler; i++) {
    const u = r();
    if (u < 0.45) s.push(rx, ground + r() * (top - ground), 0, K.STILL, 0, ruler.clone().multiplyScalar(0.35 + r() * 0.2));
    else if (u < 0.75) { // ticks
      const k = Math.floor(r() * 21), y = ground + (k / 20) * (top - ground), len = k % 5 ? 0.06 : 0.13;
      s.push(rx - r() * len, y, 0, K.STILL, 0, ruler.clone().multiplyScalar(0.45 + r() * 0.2));
    } else { // dashed lines from each head to the ruler
      const p = sk[r() < 0.5 ? 0 : 1], y = ground + p.h, x0 = p.x + 0.15, t = r();
      if ((t * 30) % 1 > 0.5) { i--; continue; }
      s.push(x0 + (rx - x0) * t, y, 0, K.STILL, 0, p.c.clone().multiplyScalar(0.35 + r() * 0.25));
    }
  }
  for (let i = 0; i < nBall; i++) {
    const a = r() * Math.PI * 2, b = Math.acos(r() * 2 - 1), R = 0.2;
    const seam = Math.abs(Math.cos(b)) < 0.04 || Math.abs(Math.sin(a)) < 0.04;
    s.push(0.05 + Math.sin(b) * Math.cos(a) * R, ground + R + Math.cos(b) * R, Math.sin(b) * Math.sin(a) * R + 0.4, K.STILL, 0, ball.clone().multiplyScalar(seam ? 0.6 : 0.25 + r() * 0.15));
  }
  while (!s.full) {
    const x = (r() * 2 - 1) * 2.6, z = -1 + r() * 1.8;
    const grid = Math.abs(((x * 3) % 1 + 1) % 1 - 0.5) > 0.45 || Math.abs(((z * 3) % 1 + 1) % 1 - 0.5) > 0.45;
    if (!grid && r() > 0.2) continue;
    s.push(x, ground - 0.02, z, K.STILL, 0, floor.clone().multiplyScalar((grid ? 0.3 : 0.08) * (1 - Math.abs(x) / 3)));
  }
  return s;
}

// The features, the videos and the contact: a horizon of water, its caustics, motes of light.
function water(n) {
  const s = new Shape(n), r = rng(5);
  const deep = C('#1d2f7a'), mid = C('#2f7fd0'), light = C('#bff0ff'), mote = C('#8b7bff');
  const nMote = Math.floor(n * 0.1);
  for (let i = 0; i < nMote; i++) {
    const a = r() * Math.PI * 2, R = 0.6 + Math.pow(r(), 0.8) * 3.6;
    s.push(Math.cos(a) * R, 0.2 + r() * 1.6, Math.sin(a) * R - 0.5, K.ORBIT, r(), lerpC(mote, light, r()).multiplyScalar(0.25 + r() * 0.4));
  }
  while (!s.full) {
    const x = (r() * 2 - 1) * 5.2, z = -3.4 + r() * 5;
    const far = (z + 3.4) / 5;
    s.push(x, 0, z, K.CAUSTIC, r(), lerpC(deep, mid, far).lerp(light, Math.pow(r(), 8)).multiplyScalar(0.45 + r() * 0.4));
  }
  return s;
}

// The camera: the box, its stereo pair, the processor inside, the two fields of view.
function camera(n) {
  const s = new Shape(n), r = rng(6);
  const shell = C('#c9d2e6'), glass = C('#2b2f55'), lens = C('#6fd6ff'), chip = C('#4fe0c0'), fov = C('#a78bff'), screw = C('#ffffff');
  const W = 1.1, H = 0.5, D = 0.24; // half sizes
  const nBox = Math.floor(n * 0.34), nGlass = Math.floor(n * 0.05), nLens = Math.floor(n * 0.04), nChip = Math.floor(n * 0.1), nGland = Math.floor(n * 0.04);
  const lenses = [[-0.62, 0.1], [-0.36, 0.1], [0.62, 0.1]];
  for (let i = 0; i < nBox; i++) {
    const face = Math.floor(r() * 6);
    let x = (r() * 2 - 1) * W, y = (r() * 2 - 1) * H, z = (r() * 2 - 1) * D;
    if (face === 0) z = D; else if (face === 1) z = -D; else if (face === 2) x = W; else if (face === 3) x = -W; else if (face === 4) y = H; else y = -H;
    const edges = [Math.abs(x) > W - 0.03, Math.abs(y) > H - 0.03, Math.abs(z) > D - 0.03].filter(Boolean).length >= 2;
    if (face === 0 && Math.abs(x) < 0.86 && y > -0.1 && y < 0.3) { i--; continue; } // the glass band
    s.push(x, y, z, K.STILL, 0, shell.clone().multiplyScalar(edges ? 0.8 + r() * 0.3 : (face === 0 ? 0.3 : 0.16) + r() * 0.12));
  }
  for (let i = 0; i < nGlass; i++) {
    const t = r() * 2 * (1.72 + 0.4), border = r() < 0.6;
    if (border) {
      const [x, y] = t < 1.72 ? [-0.86 + t, -0.1] : t < 2.12 ? [0.86, -0.1 + (t - 1.72)] : t < 3.84 ? [0.86 - (t - 2.12), 0.3] : [-0.86, 0.3 - (t - 3.84)];
      s.push(x, y, D + 0.005, K.STILL, 0, glass.clone().multiplyScalar(1.4 + r() * 0.6));
    } else s.push(-0.86 + r() * 1.72, -0.1 + r() * 0.4, D - 0.01, K.STILL, 0, glass.clone().multiplyScalar(0.4));
  }
  for (let i = 0; i < nLens; i++) {
    const [lx, ly] = lenses[Math.floor(r() * 3)], a = r() * Math.PI * 2, rr = r() < 0.5 ? 0.065 : Math.sqrt(r()) * 0.03;
    s.push(lx + Math.cos(a) * rr, ly + Math.sin(a) * rr, D + 0.01, K.GLOW, r(), lens.clone().multiplyScalar(0.7 + r() * 0.5));
  }
  for (let i = 0; i < 4 * Math.floor(n * 0.002); i++) {
    const k = i % 4, a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.035;
    s.push((k % 2 ? 1 : -1) * (W - 0.07) + Math.cos(a) * rr, (k < 2 ? 1 : -1) * (H - 0.07) + Math.sin(a) * rr, D + 0.005, K.STILL, 0, screw.clone().multiplyScalar(0.5));
  }
  for (let i = 0; i < nChip; i++) {
    // The processor, inside: a die and its traces, pulses running out to the lenses.
    if (r() < 0.35) {
      const x = (r() * 2 - 1) * 0.2, y = -0.2 + (r() * 2 - 1) * 0.14;
      const on = Math.abs(((x * 25) % 1 + 1) % 1 - 0.5) > 0.4 || Math.abs(((y * 25) % 1 + 1) % 1 - 0.5) > 0.4;
      if (!on) { i--; continue; }
      s.push(x, y, 0, K.STILL, 0, chip.clone().multiplyScalar(0.45 + r() * 0.3));
    } else {
      const [lx, ly] = lenses[Math.floor(r() * 3)], t = r(), sx = Math.sign(lx) * 0.2;
      const [x, y] = t < 0.5 ? [sx + (lx - sx) * t * 2, -0.2] : [lx, -0.2 + (ly + 0.2) * (t - 0.5) * 2];
      s.push(x, y, 0, K.FLOW, t, chip.clone().multiplyScalar(0.35 + r() * 0.25));
    }
  }
  for (let i = 0; i < nGland; i++) {
    const a = r() * Math.PI * 2, y = -H - r() * 0.36, rr = y < -H - 0.12 ? 0.13 : 0.1;
    const rib = y < -H - 0.12 && Math.abs(Math.sin(a * 6)) > 0.9;
    s.push(Math.cos(a) * rr, y, Math.sin(a) * rr, K.STILL, 0, C('#5a5f80').multiplyScalar(rib ? 0.9 : 0.4 + r() * 0.2));
  }
  while (!s.full) {
    // Two fields of view from the stereo pair, overlapping ahead: depth where both see.
    const [lx, ly] = lenses[r() < 0.5 ? 0 : 2], t = Math.pow(r(), 0.9), d = 0.2 + t * 3.0;
    const sx = (r() * 2 - 1) * d * 0.62, sy = (r() * 2 - 1) * d * 0.38;
    const onEdge = Math.abs(Math.abs(sx) - d * 0.62) < 0.02 * d || Math.abs(Math.abs(sy) - d * 0.38) < 0.02 * d;
    if (!onEdge && r() > 0.25) continue;
    s.push(lx + sx, ly + sy, D + d, K.FLOW, t, fov.clone().multiplyScalar((onEdge ? 0.3 : 0.08) * (1.1 - t * 0.7) + r() * 0.06));
  }
  return s;
}

// Security: barrier, cover, the gate left open — and the second line, the watched perimeter.
function fence(n) {
  const s = new Shape(n), r = rng(7);
  const water = C('#2f7fd0'), glint = C('#bff0ff'), edge = C('#e9ecff'), bar = C('#8c93c8'), cover = C('#5a6bb0'), perim = C('#6fd6ff');
  const L = 1.25, W = 0.66, FX = L + 0.42, FZ = W + 0.42, Hf = 0.42;
  const nEdge = Math.floor(n * 0.07), nFence = Math.floor(n * 0.2), nCover = Math.floor(n * 0.07), nPerim = Math.floor(n * 0.1), nCam = Math.floor(n * 0.02), nCone = Math.floor(n * 0.07);
  coping(s, r, L, W, nEdge, edge);
  const gate = { x0: 0.15, x1: 0.62, open: 1.15 };
  for (let i = 0; i < nFence; i++) {
    const t = r() * 4 * (FX + FZ);
    let [x, z] = t < 2 * FX ? [t - FX, FZ] : t < 2 * FX + 2 * FZ ? [FX, FZ - (t - 2 * FX)] : t < 4 * FX + 2 * FZ ? [FX - (t - 2 * FX - 2 * FZ), -FZ] : [-FX, -FZ + (t - 4 * FX - 2 * FZ)];
    const onGate = z === FZ && x > gate.x0 && x < gate.x1;
    if (onGate) { // swung open around its hinge
      const d = x - gate.x0;
      x = gate.x0 + Math.cos(gate.open) * d; z = FZ + Math.sin(gate.open) * d;
    }
    const along = t * 5.5, post = (along % 1) < 0.08, u = r();
    const y = post ? r() * Hf : u < 0.5 ? Hf : u < 0.8 ? 0.03 : r() * Hf;
    if (!post && u >= 0.8 && (along * 4 % 1) > 0.2) { i--; continue; }
    s.push(x, y, z, K.STILL, 0, (onGate ? C('#ffb37a') : bar).clone().multiplyScalar(post ? 0.85 + r() * 0.3 : 0.55 + r() * 0.3));
  }
  for (let i = 0; i < nCover; i++) { // the cover, rolled up at the end of the pool
    const a = r() * Math.PI * 2, z = (r() * 2 - 1) * (W + 0.1), rr = 0.11;
    s.push(-L - 0.2 + Math.cos(a) * rr, rr + Math.sin(a) * rr, z, K.STILL, 0, cover.clone().multiplyScalar(0.55 + 0.45 * Math.max(0, Math.sin(a)) + r() * 0.2));
  }
  for (let i = 0; i < nPerim; i++) {
    const t = r(), [x, z] = roundRect(t, FX + 0.55, FZ + 0.55, 0.5);
    s.push(x, 0.01, z, K.PERIM, t, perim.clone().multiplyScalar(0.55 + r() * 0.35));
  }
  const cam = V(FX + 0.55, 0.85, -FZ - 0.55);
  for (let i = 0; i < nCam; i++) {
    if (r() < 0.55) s.push(cam.x, r() * cam.y, cam.z, K.STILL, 0, C('#cfd6ff', 0.3));
    else s.push(cam.x + (r() - 0.5) * 0.18, cam.y + (r() - 0.5) * 0.08, cam.z + (r() - 0.5) * 0.08, K.GLOW, r(), C('#cfd6ff', 0.9));
  }
  for (let i = 0; i < nCone; i++) {
    const f = r(), a = -2.75 + f * 1.4, reach = 2.4 + r() * 2.6, t = Math.pow(r(), 0.8);
    const p = cam.clone().lerp(V(cam.x + Math.cos(a) * reach, 0, cam.z - Math.sin(a) * reach), t);
    s.push(p.x, p.y, p.z, K.SCAN, f, C('#a78bff').multiplyScalar(0.15 + r() * 0.15));
  }
  while (!s.full) {
    const x = (r() * 2 - 1) * (L - 0.03), z = (r() * 2 - 1) * (W - 0.03);
    s.push(x, -0.05, z, K.WAVE, r(), lerpC(water, glint, Math.pow(r(), 6)).multiplyScalar(0.3 + r() * 0.35));
  }
  return s;
}

const BUILDERS = { beacon, ripple, watch, pose, water, camera, fence };

// How each shape is presented: tilt, and an optional slow sway.
const VIEW = {
  beacon: { rx: 0.3, ry: 0, rz: 0, scale: 0.92 },
  ripple: { rx: 0.62, ry: 0, rz: 0, scale: 0.78 },
  watch: { rx: 0.85, ry: -0.22, rz: 0, scale: 0.86 },
  pose: { rx: 0.06, ry: -0.18, rz: 0, scale: 0.95, sway: 0.22 },
  water: { rx: 0.2, ry: 0, rz: 0, scale: 1 },
  camera: { rx: 0.16, ry: -0.5, rz: 0, scale: 0.88, sway: 0.18 },
  fence: { rx: 0.62, ry: -0.4, rz: 0, scale: 0.78, sway: 0.15 },
};

/* ---------------- shaders ---------------- */

const f2 = (v) => v.toFixed(3);
const vert = /* glsl */ `
  #define CAM vec3(${f2(CAM.x)}, ${f2(CAM.y)}, ${f2(CAM.z)})
  #define SEA_Y ${f2(SEA_Y)}
  #define LAMP_Y ${f2(LAMP_Y)}
  attribute vec4 aFrom;
  attribute vec4 aTo;
  attribute vec3 cFrom;
  attribute vec3 cTo;
  attribute vec4 aRand;
  uniform float uTime, uMix, uSize, uPixel, uAspect, uAlarm, uSafe, uWalkA, uWalkC;
  uniform vec2 uPointer;
  uniform vec3 uAdult, uChild;
  varying vec3 vColor;
  varying float vAlpha;

  const vec3 RED = vec3(1.0, 0.3, 0.28);
  const vec3 MINT = vec3(0.31, 0.88, 0.75);

  vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * v; }
  float beamAngle() { return uTime * 0.55; }

  vec3 animate(vec4 p, inout vec3 col, out float boost) {
    float kind = floor(p.w + 0.0005), prm = fract(p.w + 0.0005);
    vec3 q = p.xyz;
    boost = 1.0;
    if (kind == 1.0) {            // pool water
      q.y += sin(q.x * 5.0 + uTime * 1.3) * 0.012 + sin(q.z * 7.0 - uTime * 1.7 + q.x * 2.0) * 0.01;
      boost = 0.7 + 0.6 * pow(0.5 + 0.5 * sin(q.x * 9.0 + q.z * 6.0 - uTime * 2.2 + prm * 6.28), 3.0);
    } else if (kind == 2.0) {     // lighthouse rays: light running outwards
      float w = exp(-pow((prm - fract(uTime * 0.55)) * 4.5, 2.0));
      boost = 0.35 + 1.9 * w;
    } else if (kind == 3.0) {     // the beam, turning around the tower
      q.xz = rot(q.xz, beamAngle());
      boost = (1.0 - prm) * (1.0 - prm) * 1.5 + 0.08;
    } else if (kind == 4.0) {     // slow orbit
      float R = length(q.xz);
      q.xz = rot(q.xz, uTime * 0.05 / max(R, 0.6));
      q.y += sin(uTime * 0.5 + prm * 30.0) * 0.06;
      boost = 0.6 + 0.6 * sin(uTime * 1.3 + prm * 40.0);
    } else if (kind == 5.0) {     // ripples spreading from the drop
      float r = length(q.xz), f = fract(uTime * 0.3), tau = f / 0.3, front = tau * 0.85;
      float w = sin((r - front) * 13.0) * exp(-pow((r - front + 0.25) * 2.6, 2.0)) * (1.0 - f) * 1.4;
      w += 0.25 * sin(r * 3.0 - uTime * 0.9) * 0.2;
      q.y += w * 0.07;
      boost = 0.55 + max(w, 0.0) * 1.8;
    } else if (kind == 6.0) {     // the adult of the scenario
      q.y += abs(sin(uWalkA)) * 0.025;
      q += uAdult;
    } else if (kind == 7.0) {     // the child: turns red when the alarm rings
      q.y += abs(sin(uWalkC)) * 0.02;
      q += uChild;
      col = mix(col, RED * (0.7 + 0.5 * sin(uTime * 9.0)), uAlarm * 0.85);
      boost = 1.0 + uAlarm * 0.5;
    } else if (kind == 8.0) {     // the watched zone: cyan, mint when the child is accompanied, red on alarm
      col = mix(col, MINT * 0.8, uSafe);
      col = mix(col, RED, uAlarm);
      boost = 0.7 + 0.6 * exp(-pow(fract(prm - uTime * 0.06) * 6.0 - 0.5, 2.0) * 3.0) + uAlarm * (0.6 + 0.5 * sin(uTime * 8.0));
    } else if (kind == 9.0) {     // the siren: rings spreading from the camera, only on alarm
      float t = fract(prm + uTime * 0.55);
      vec2 d = q.xz - CAM.xz;
      q.xz = CAM.xz + d * (0.1 + t * 2.9);
      boost = uAlarm * (1.0 - t) * 1.6;
    } else if (kind == 10.0) {    // the camera's field of view, swept side to side
      float ph = 0.5 + 0.42 * sin(uTime * 0.7);
      boost = 0.35 + 2.2 * exp(-pow((prm - ph) * 9.0, 2.0));
      col = mix(col, RED * 0.4, uAlarm * 0.6);
    } else if (kind == 11.0) {    // keypoints, pulsing
      boost = 0.9 + 0.5 * sin(uTime * 2.4 + prm * 6.28);
    } else if (kind == 12.0) {    // bones: a glow runs along them
      boost = 0.75 + 1.3 * exp(-pow((prm - fract(uTime * 0.45 + aRand.x * 0.2)) * 6.0, 2.0));
    } else if (kind == 13.0) {    // lantern, lenses: a slow glow
      boost = 0.85 + 0.35 * sin(uTime * 1.6 + prm * 3.0);
    } else if (kind == 14.0) {    // the falling drop, landing as the rings start
      float f = fract(uTime * 0.3);
      q.y += 1.7 * (1.0 - f * f);
      boost = smoothstep(0.0, 0.08, f) * smoothstep(1.0, 0.96, f) * 1.4;
    } else if (kind == 15.0) {    // two minutes counting down
      float f = fract(uTime / 12.0);
      boost = prm < f ? 1.5 : 0.18;
    } else if (kind == 16.0) {    // the sea, lit where the beam passes
      float a = atan(q.z, q.x), b = -beamAngle();
      float d1 = abs(mod(a - b + 3.14159, 6.28318) - 3.14159);
      float d2 = abs(mod(a - b, 6.28318) - 3.14159);
      float lit = exp(-d1 * d1 * 18.0) + 0.5 * exp(-d2 * d2 * 18.0);
      q.y += sin(q.x * 2.4 + uTime * 0.8) * 0.04 + sin(q.z * 3.1 - uTime * 1.1) * 0.03;
      boost = 0.55 + lit * 2.2 / (1.0 + length(q.xz) * 0.3);
    } else if (kind == 17.0) {    // caustics
      float c = sin(q.x * 3.1 + uTime * 0.7) + sin(q.z * 4.3 - uTime * 0.9 + q.x * 1.3) + sin((q.x + q.z) * 2.2 + uTime * 0.5);
      q.y += sin(q.x * 1.3 + uTime * 0.6) * 0.04 + sin(q.z * 2.1 - uTime * 0.8) * 0.03;
      boost = 0.45 + pow(abs(c) / 3.0, 2.0) * 2.4;
    } else if (kind == 18.0) {    // data and depth: pulses running outwards
      boost = 0.55 + 1.6 * exp(-pow((prm - fract(uTime * 0.4 + aRand.x * 0.15)) * 7.0, 2.0));
    } else if (kind == 19.0) {    // the watched perimeter: a light running round
      float d = fract(prm - uTime * 0.1);
      boost = 0.45 + 1.8 * exp(-pow(min(d, 1.0 - d) * 9.0, 2.0)) + 0.35 * step(0.5, fract(prm * 60.0));
    }
    return q;
  }

  void main() {
    float m = clamp(uMix * 1.5 - aRand.x * 0.5, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    float bA, bB;
    vec3 ca = cFrom, cb = cTo;
    vec3 a = animate(aFrom, ca, bA);
    vec3 b = animate(aTo, cb, bB);
    vec3 p = mix(a, b, m);
    float swirl = sin(3.14159 * m);
    p += (aRand.yzw - 0.5) * 1.6 * swirl;
    p += vec3(sin(uTime * 0.6 + aRand.y * 40.0), cos(uTime * 0.5 + aRand.z * 40.0), sin(uTime * 0.4 + aRand.w * 40.0)) * 0.01;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = (ndc - uPointer) * vec2(uAspect, 1.0);
    float f = smoothstep(0.32, 0.0, length(d));
    mv.xy += normalize(d + 1e-5) * f * 0.3;

    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.55 + aRand.y * 0.9) * (1.0 + swirl * 0.6);
    gl_PointSize = size * uPixel / -mv.z;
    vColor = mix(ca, cb, m);
    vAlpha = max(mix(bA, bB, m), 0.0) * (1.0 + f * 1.2);
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a + smoothstep(0.12, 0.0, d) * 0.6;
    vec3 c = max(vColor, 0.0) * a * vAlpha;
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); // premultiplied: light added over the page
  }
`;

/* ---------------- the scenario ---------------- */

// Where the adult and the child stand along the scroll of #fonctionnement (p in 0..1):
// 1. both away from the pool; 2. they walk along it together — accompanied, no
// alarm; 3. the adult walks off, the child heads for the water alone — alarm.
const KEYS = [
  { p: 0.0, a: [2.55, 1.35], c: [2.25, 1.55] },
  { p: 0.2, a: [2.45, 1.3], c: [2.15, 1.5] },
  { p: 0.5, a: [-0.1, 1.2], c: [0.25, 1.15] },
  { p: 0.62, a: [-0.3, 1.22], c: [0.05, 1.15] },
  { p: 0.86, a: [-1.45, -1.55], c: [-0.15, 0.8] },
  { p: 1.0, a: [-1.6, -1.7], c: [-0.25, 0.74] },
];
function storyAt(p) {
  let k = 0;
  while (k < KEYS.length - 2 && p > KEYS[k + 1].p) k++;
  const A = KEYS[k], B = KEYS[k + 1], t = THREE.MathUtils.smoothstep(p, A.p, B.p);
  const L = (u, v) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  return { adult: L(A.a, B.a), child: L(A.c, B.c) };
}

/* ---------------- field ---------------- */

export class Field {
  constructor(canvas, { count, reduced }) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.dpr = Math.min(devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(this.dpr);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0, 7.2);

    this.n = count;
    this.shapes = {};
    for (const [k, fn] of Object.entries(BUILDERS)) this.shapes[k] = fn(count);

    const g = new THREE.BufferGeometry();
    const rand = new Float32Array(count * 4), r = rng(99);
    for (let i = 0; i < rand.length; i++) rand[i] = r();
    const start = this.shapes.beacon;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aFrom', new THREE.BufferAttribute(start.pos.slice(), 4));
    g.setAttribute('aTo', new THREE.BufferAttribute(start.pos.slice(), 4));
    g.setAttribute('cFrom', new THREE.BufferAttribute(start.col.slice(), 3));
    g.setAttribute('cTo', new THREE.BufferAttribute(start.col.slice(), 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    this.geo = g;
    this.rand = rand;

    this.uniforms = {
      uTime: { value: 0 }, uMix: { value: 1 }, uSize: { value: count > 12000 ? 20 : 24 },
      uPixel: { value: this.dpr }, uPointer: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 },
      uAdult: { value: new THREE.Vector3() }, uChild: { value: new THREE.Vector3() },
      uAlarm: { value: 0 }, uSafe: { value: 0 }, uWalkA: { value: 0 }, uWalkC: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.points = new THREE.Points(g, mat);
    this.pivot = new THREE.Group();
    this.holder = new THREE.Group();
    this.pivot.add(this.points);
    this.holder.add(this.pivot);
    this.scene.add(this.holder);

    this.current = 'beacon';
    this.side = 0;
    this.pointer = new THREE.Vector2(9, 9);
    this.look = new THREE.Vector2();
    this.scrollSpin = 0;
    this.storyP = 0;
    this.target = { alarm: 0, safe: 0 };
    this.story(0);
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    }, { passive: true });
    document.addEventListener('pointerleave', () => this.pointer.set(9, 9));
    this.applyView(true);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (this.lastW === w && Math.abs((this.lastH || 0) - h) < 150) return; // mobile URL bar
    this.lastW = w; this.lastH = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 52 : 40;
    this.camera.updateProjectionMatrix();
    this.uniforms.uAspect.value = w / h;
    this.applyView(true);
  }

  /** Visible half-size of the z = 0 plane. */
  frame() {
    const hh = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    return { hw: hh * this.camera.aspect, hh };
  }

  /** Placement for a side (-1 left, 0 centre, 1 right) — away from the text card. */
  placement(side) {
    const { hw, hh } = this.frame(), portrait = this.camera.aspect < 0.9;
    if (side === 0) return { x: 0, y: -hh * 0.62, s: portrait ? 0.75 : 1.25 }; // a horizon under centred text
    if (portrait) return { x: 0, y: hh * 0.4, s: Math.min(1, hw / 2.6) * 0.95 };
    return { x: side * hw * 0.48, y: 0, s: THREE.MathUtils.clamp(hw / 3.8, 0.6, 1.1) };
  }

  applyView(instant) {
    const v = VIEW[this.current], p = this.placement(this.side);
    const to = { x: p.x, y: p.y };
    const sc = v.scale * p.s;
    const rot = { x: v.rx, y: v.ry, z: v.rz };
    if (instant) {
      this.holder.position.set(to.x, to.y, 0);
      this.holder.scale.setScalar(sc);
      this.pivot.rotation.set(rot.x, rot.y, rot.z);
      return;
    }
    gsap.to(this.holder.position, { ...to, duration: 1.8, ease: 'power3.inOut', overwrite: true });
    gsap.to(this.holder.scale, { x: sc, y: sc, z: sc, duration: 1.8, ease: 'power3.inOut', overwrite: true });
    gsap.to(this.pivot.rotation, { ...rot, duration: 2.2, ease: 'power3.inOut', overwrite: true });
  }

  /** Fly to a shape, starting from wherever the particles are now. */
  morphTo(name, side) {
    if (!this.shapes[name]) return;
    if (name === this.current && side === this.side) return;
    this.side = side;
    if (name === this.current) { this.applyView(false); return; }
    const aF = this.geo.attributes.aFrom, aT = this.geo.attributes.aTo;
    const cF = this.geo.attributes.cFrom, cT = this.geo.attributes.cTo;
    const mix = this.uniforms.uMix.value;
    if (mix >= 1) {
      aF.array.set(aT.array);
      cF.array.set(cT.array);
    } else {
      for (let i = 0; i < this.n; i++) {
        let m = Math.min(1, Math.max(0, mix * 1.5 - this.rand[i * 4] * 0.5));
        m = m * m * (3 - 2 * m);
        for (let k = 0; k < 3; k++) {
          aF.array[i * 4 + k] += (aT.array[i * 4 + k] - aF.array[i * 4 + k]) * m;
          cF.array[i * 3 + k] += (cT.array[i * 3 + k] - cF.array[i * 3 + k]) * m;
        }
        if (m >= 0.5) aF.array[i * 4 + 3] = aT.array[i * 4 + 3];
      }
    }
    aT.array.set(this.shapes[name].pos);
    cT.array.set(this.shapes[name].col);
    aF.needsUpdate = aT.needsUpdate = cF.needsUpdate = cT.needsUpdate = true;
    this.current = name;
    this.uniforms.uMix.value = 0;
    gsap.to(this.uniforms.uMix, { value: 1, duration: this.reduced ? 0.01 : 2.4, ease: 'power2.inOut', overwrite: true });
    this.applyView(false);
  }

  /** Move the scenario to p (0..1); returns its step (0, 1, 2) and whether the alarm rings. */
  story(p) {
    const { adult, child } = storyAt(p), u = this.uniforms;
    const stepA = Math.hypot(adult[0] - u.uAdult.value.x, adult[1] - u.uAdult.value.z);
    const stepC = Math.hypot(child[0] - u.uChild.value.x, child[1] - u.uChild.value.z);
    u.uWalkA.value += stepA * 9;
    u.uWalkC.value += stepC * 14;
    u.uAdult.value.set(adult[0], 0, adult[1]);
    u.uChild.value.set(child[0], 0, child[1]);
    const alarm = p > 0.8 ? 1 : 0;
    this.target.alarm = alarm;
    this.target.safe = p > 0.36 && p <= 0.66 ? 1 : 0;
    this.storyP = p;
    return { step: p < 0.33 ? 0 : p < 0.66 ? 1 : 2, alarm: !!alarm };
  }

  update(t, scrollVel) {
    const u = this.uniforms;
    u.uTime.value = this.reduced ? 0 : t;
    u.uAlarm.value += (this.target.alarm - u.uAlarm.value) * 0.08;
    u.uSafe.value += (this.target.safe - u.uSafe.value) * 0.06;
    u.uPointer.value.lerp(this.pointer, 0.12);
    this.look.lerp(this.pointer.x > 5 ? new THREE.Vector2() : this.pointer, 0.04);
    const v = VIEW[this.current];
    this.scrollSpin += (THREE.MathUtils.clamp(scrollVel * 0.0006, -0.06, 0.06) - this.scrollSpin) * 0.08;
    if (this.current !== 'watch') this.holder.rotation.y += this.scrollSpin; // the scenario stays still while it plays
    this.holder.rotation.y *= 0.985;
    if (v.sway && !this.reduced) this.pivot.rotation.y = v.ry + Math.sin(t * 0.25) * v.sway;
    this.camera.position.x = this.look.x * 0.35;
    this.camera.position.y = this.look.y * 0.22;
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
