// Cenário do Pincel do Vento (tudo gerado por código, estilo pintura sumi-ê): pátio de madeira
// de um templo no alto da montanha, sobre um mar de nuvens, céu de papel de arroz, montanhas em
// camadas de tinta, sol carmim, gongo, lanterna, pinheiro e pétalas de cerejeira.
// Também: gotas de tinta, pincéis, faixas de vento, anel, traço pintado no ar e respingos.
import * as THREE from '../vendor/three/three.module.js';
import { HIT_DIST, SPAWN_DIST, PATH_N, ribbonPoint } from './mode.js';
import { RING_R } from './judge.js';

export const COLORS = { left: 0x1c1b1f, right: 0xb3202a, accent: 0xc9962e, paper: 0xf1e7cf };
const PAPER = new THREE.Color(COLORS.paper);

// ---------- Texturas pintadas em canvas ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}
const css = (hex, a = 1) => { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };

// Céu de papel: degradê creme com fibras e manchas leves de aguada.
function paperSkyTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#efe6d0'); grd.addColorStop(0.45, '#f4ecd9'); grd.addColorStop(0.55, '#efe3c8'); grd.addColorStop(1, '#e6dac0');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const r = seeded(7);
    for (let i = 0; i < 60; i++) {
      const x = r() * w, y = r() * h * 0.5, rad = 40 + r() * 140;
      const rg = g.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, 'rgba(120,105,85,0.035)'); rg.addColorStop(1, 'rgba(120,105,85,0)');
      g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = 'rgba(140,120,90,0.07)'; g.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 4 + r() * 16;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
}

// Mancha de tinta: borda irregular, tinta mais escura onde acumula na borda, respingos.
function inkBlobTex(hex, seed) {
  return canvasTex(256, 256, (g, w) => {
    const r = seeded(seed), cx = w / 2, R = 92;
    const k = [r() * 6, r() * 6, r() * 6];
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * Math.PI * 2;
      const rr = R * (1 + 0.06 * Math.sin(a * 3 + k[0]) + 0.04 * Math.sin(a * 5 + k[1]) + 0.03 * Math.sin(a * 9 + k[2]));
      const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    const rg = g.createRadialGradient(cx - 20, cx - 24, 5, cx, cx, R * 1.1);
    rg.addColorStop(0, css(new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.28).getHex(), 0.95));
    rg.addColorStop(0.7, css(hex, 0.97));
    rg.addColorStop(1, css(new THREE.Color(hex).multiplyScalar(0.6).getHex(), 1));
    g.fillStyle = rg; g.fill();
    g.fillStyle = css(hex, 0.95);
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = R * (1.08 + r() * 0.25), s = 2 + r() * 7;
      g.beginPath(); g.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, s, 0, Math.PI * 2); g.fill();
    }
    // brilho úmido
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.ellipse(cx - 34, cx - 40, 22, 12, -0.6, 0, Math.PI * 2); g.fill();
  });
}

// Traço de pincel (mostra o sentido): cabeça cheia à esquerda afinando para a direita, com
// uma pontinha em gancho no fim. Desenhado apontando para +x.
function strokeMarkTex() {
  return canvasTex(256, 96, (g, w, h) => {
    const r = seeded(3), cy = h / 2;
    g.fillStyle = '#f7efdc';
    g.beginPath();
    g.moveTo(26, cy - 22);
    g.bezierCurveTo(90, cy - 22, 160, cy - 10, 214, cy - 3);
    g.lineTo(236, cy);
    g.lineTo(214, cy + 4);
    g.bezierCurveTo(160, cy + 12, 90, cy + 24, 26, cy + 22);
    g.arc(26, cy, 22, Math.PI / 2, Math.PI * 1.5);
    g.closePath(); g.fill();
    // gancho (ponta de seta suave)
    g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#f7efdc';
    g.beginPath(); g.moveTo(236, cy); g.lineTo(204, cy - 26); g.stroke();
    g.beginPath(); g.moveTo(236, cy); g.lineTo(204, cy + 26); g.stroke();
    // fios secos do pincel
    g.strokeStyle = 'rgba(40,30,20,0.25)'; g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) { const y = cy - 14 + r() * 28; g.beginPath(); g.moveTo(40 + r() * 40, y); g.lineTo(150 + r() * 60, cy + (y - cy) * 0.4); g.stroke(); }
  });
}

// Ensō (círculo zen aberto): gota que aceita qualquer sentido.
function ensoTex() {
  return canvasTex(128, 128, (g, w) => {
    g.strokeStyle = '#f7efdc'; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a0 = -1.2 + i * 0.2, a1 = a0 + 0.24;
      g.lineWidth = 15 - i * 0.45;
      g.beginPath(); g.arc(w / 2, w / 2, 40, a0, a1); g.stroke();
    }
  });
}

function dotTex() {
  return canvasTex(32, 32, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.fill(); });
}
function petalTex() {
  return canvasTex(64, 64, (g) => {
    g.translate(32, 32); g.rotate(0.5);
    const rg = g.createRadialGradient(0, 4, 2, 0, 0, 26);
    rg.addColorStop(0, '#fff2f4'); rg.addColorStop(1, '#f2a9b9');
    g.fillStyle = rg;
    g.beginPath(); g.moveTo(0, 24); g.bezierCurveTo(22, 10, 18, -20, 4, -24); g.lineTo(0, -18); g.lineTo(-4, -24);
    g.bezierCurveTo(-18, -20, -22, 10, 0, 24); g.fill();
  });
}
function cloudTex(seed) {
  return canvasTex(512, 256, (g, w, h) => {
    const r = seeded(seed);
    for (let i = 0; i < 22; i++) {
      const x = w * (0.15 + r() * 0.7), y = h * (0.4 + r() * 0.3), rad = 40 + r() * 70;
      const rg = g.createRadialGradient(x, y - rad * 0.2, 0, x, y, rad);
      rg.addColorStop(0, 'rgba(255,253,246,0.9)'); rg.addColorStop(0.6, 'rgba(236,228,210,0.55)'); rg.addColorStop(1, 'rgba(220,210,190,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    }
    // sombra de tinta embaixo
    const sg = g.createLinearGradient(0, h * 0.5, 0, h);
    sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(90,85,80,0.18)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = sg; g.fillRect(0, 0, w, h);
  });
}
// Textura de pincel seco (fios ao longo do traço) para as faixas e o traço pintado.
function dryBrushTex() {
  const t = canvasTex(64, 256, (g, w, h) => {
    const r = seeded(11);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(6, 0, w - 12, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, ww = 1 + r() * 3;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.35)';
      g.fillRect(x, 0, ww, h);
    }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 10 + r() * 50); }
    g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  }, false);
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
const DRY = typeof document !== 'undefined' ? dryBrushTex() : null;

// ---------- Cenário ----------
function ridge(R, base, amp, topHex, mistHex, seed, valley = 0) {
  const r = seeded(seed);
  const M = 220;
  const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
  const pos = [], col = [], idx = [];
  const top = new THREE.Color(topHex), mist = new THREE.Color(mistHex);
  for (let i = 0; i <= M; i++) {
    const a = i / M * Math.PI * 2 - Math.PI;
    let hgt = Math.sin(a * 2 + ph[0]) * 0.35 + Math.sin(a * 5 + ph[1]) * 0.3 + Math.abs(Math.sin(a * 9 + ph[2])) * 0.35 + Math.sin(a * 17 + ph[3]) * 0.08;
    hgt = Math.max(0.05, 0.45 + hgt * 0.6);
    if (valley) hgt *= 1 - valley * Math.max(0, 1 - Math.abs(a) / 0.9);
    const x = Math.sin(a) * R, z = -Math.cos(a) * R;
    pos.push(x, base + amp * hgt, z, x, -30, z);
    col.push(top.r, top.g, top.b, mist.r, mist.g, mist.b);
    if (i < M) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
}

function pine(x, z, s) {
  const g = new THREE.Group();
  const ink = new THREE.MeshStandardMaterial({ color: 0x2b2a27, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.12 * s, 3 * s, 6), new THREE.MeshStandardMaterial({ color: 0x3e3329, roughness: 1 }));
  trunk.position.y = 1.5 * s; trunk.rotation.z = 0.18;
  g.add(trunk);
  [[0.0, 2.9, 1.3], [-0.6, 2.2, 1.0], [0.55, 1.7, 0.9], [-0.2, 3.5, 0.8]].forEach(([dx, y, w]) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), ink);
    f.scale.set(w * s, 0.22 * s, w * 0.6 * s);
    f.position.set(dx * s - y * 0.12 * s, y * s, 0);
    g.add(f);
  });
  g.position.set(x, 0, z);
  return g;
}

export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = PAPER.clone();
  scene.fog = new THREE.Fog(0xece2c9, 7, 26);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 32, 16), new THREE.MeshBasicMaterial({ map: paperSkyTex(), side: THREE.BackSide, fog: false }));
  scene.add(sky);

  // Sol carmim atrás das montanhas.
  const sun = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ color: 0xc23a35, transparent: true, opacity: 0.88, fog: false }));
  sun.position.set(-14, 17, -82); sun.lookAt(0, 1.5, 0);
  scene.add(sun);

  scene.add(new THREE.HemisphereLight(0xfff6e4, 0x8d7258, 1.25));
  const light = new THREE.DirectionalLight(0xfff0d8, 1.4);
  light.position.set(3, 7, -2);
  scene.add(light);

  // Montanhas: as de longe mais claras (perspectiva de aguada); vale na frente da mais próxima.
  scene.add(ridge(78, -6, 34, 0xc9c1b1, 0xece3cd, 5));
  scene.add(ridge(64, -8, 30, 0xa59d90, 0xe9dfc8, 9));
  scene.add(ridge(50, -9, 22, 0x77716a, 0xe6dbc3, 13, 0.55));
  scene.add(ridge(38, -10, 15, 0x46423e, 0xe2d6bd, 21, 0.9));

  // Mar de nuvens embaixo do pátio e nuvens soltas.
  const sea = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshBasicMaterial({ color: 0xf6f0e2, transparent: true, opacity: 0.96, fog: false }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -7;
  scene.add(sea);
  const clouds = [];
  const cloudTexes = [cloudTex(41), cloudTex(53), cloudTex(67)];
  const cr = seeded(99);
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexes[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
    const a = cr() * Math.PI * 2, d = 14 + cr() * 36;
    const sc = 10 + cr() * 16;
    m.scale.set(sc, sc * 0.45, 1);
    const y = -6.5 + cr() * 4.5 + (d > 30 ? 3 : 0);
    m.position.set(Math.sin(a) * d, y, -Math.cos(a) * d);
    scene.add(m);
    clouds.push({ m, a, d, y, sp: (0.004 + cr() * 0.006) * (cr() < 0.5 ? 1 : -1), sc });
  }

  // Pátio de madeira (tábuas no sentido da profundidade).
  const deck = new THREE.Group();
  const woodA = new THREE.MeshStandardMaterial({ color: 0x8c6040, roughness: 0.85 });
  const woodB = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.9 });
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.08, 4.8), i % 2 ? woodA : woodB);
    p.position.set(-2.2 + i * 0.4, -0.04, 0.2);
    deck.add(p);
  }
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9 });
  const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.18, 0.16), beamMat);
  frontBeam.position.set(0, -0.1, -2.2);
  deck.add(frontBeam);
  // Pilares que descem até as nuvens.
  for (const x of [-2.3, 2.3]) for (const z of [-2.1, 2.5]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 8, 8), beamMat);
    leg.position.set(x, -4.1, z);
    deck.add(leg);
  }
  // Corrimão carmim dos lados.
  const red = new THREE.MeshStandardMaterial({ color: 0xa8302a, roughness: 0.6 });
  for (const x of [-2.42, 2.42]) {
    for (let z = -2.1; z <= 2.6; z += 1.17) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), red);
      post.position.set(x, 0.47, z);
      deck.add(post);
    }
    for (const y of [0.9, 0.45]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 4.8), red);
      rail.position.set(x, y, 0.25);
      deck.add(rail);
    }
  }
  scene.add(deck);
  // Linha de aguada no chão embaixo do plano do pincel.
  const hitLine = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.05), new THREE.MeshBasicMaterial({ color: 0x2a2420, transparent: true, opacity: 0.35, depthWrite: false }));
  hitLine.rotation.x = -Math.PI / 2; hitLine.position.set(0, 0.003, -HIT_DIST);
  scene.add(hitLine);

  // Templo atrás do jogador: parede, pilares carmim e telhado com beiral curvo.
  const temple = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.3), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1 }));
  wall.position.set(0, 1.5, 3.4); temple.add(wall);
  for (let x = -2.7; x <= 2.7; x += 1.35) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3, 10), red);
    p.position.set(x, 1.5, 3.1); temple.add(p);
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2a29, roughness: 0.8 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.25, 2.4), roofMat);
  roof.position.set(0, 3.25, 3.3); roof.rotation.x = -0.12; temple.add(roof);
  for (const s of [-1, 1]) {
    const eave = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 2.6), roofMat);
    eave.position.set(s * 4.1, 3.45, 3.3); eave.rotation.z = s * 0.28; temple.add(eave);
  }
  scene.add(temple);

  // Gongo no canto esquerdo.
  const gongFrame = new THREE.Group();
  for (const dx of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.1, 0.09), beamMat);
    post.position.set(dx, 1.05, 0); gongFrame.add(post);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.12), red);
  top.position.y = 2.1; gongFrame.add(top);
  const gongPivot = new THREE.Group();
  gongPivot.position.y = 2.02;
  const gongMat = new THREE.MeshStandardMaterial({ color: 0xa7803e, metalness: 0.75, roughness: 0.35, emissive: 0x6b3b10, emissiveIntensity: 0 });
  const gong = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 40), gongMat);
  gong.rotation.x = Math.PI / 2; gong.position.y = -0.62;
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8), gongMat);
  boss.scale.z = 0.5; boss.position.set(0, -0.62, 0.03);
  for (const dx of [-0.2, 0.2]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), new THREE.MeshBasicMaterial({ color: 0x3b2a1a }));
    cord.position.set(dx, -0.15, 0); gongPivot.add(cord);
  }
  gongPivot.add(gong, boss);
  gongFrame.add(gongPivot);
  gongFrame.position.set(-2.0, 0, -2.0); gongFrame.rotation.y = 0.65; gongFrame.scale.setScalar(0.85);
  scene.add(gongFrame);

  // Lanterna de pedra (tōrō) à direita.
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8a83, roughness: 1 });
  const lantern = new THREE.Group();
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.7, 6), stone); lb.position.y = 0.35;
  const lbox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), stone); lbox.position.y = 0.83;
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const lglow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.2), glowMat); lglow.position.y = 0.83;
  const lroof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 6), stone); lroof.position.y = 1.07;
  lantern.add(lb, lbox, lglow, lroof);
  lantern.position.set(1.95, 0, -1.7);
  scene.add(lantern);

  scene.add(pine(7.5, -11, 1.5));
  scene.add(pine(-6.5, 2.5, 1.0));
  scene.add(pine(-9, -14, 1.7));

  // Pétalas de cerejeira levadas pelo vento.
  const NP = 260;
  const pp = new Float32Array(NP * 3);
  const pv = [];
  const prr = seeded(5);
  for (let i = 0; i < NP; i++) {
    pp.set([(prr() - 0.5) * 24, prr() * 9 - 1, -prr() * 22 + 4], i * 3);
    pv.push({ ph: prr() * 6, fall: 0.25 + prr() * 0.35, wob: 0.3 + prr() * 0.6 });
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pmat = new THREE.PointsMaterial({ map: petalTex(), size: 0.09, transparent: true, alphaTest: 0.3, depthWrite: false });
  const petals = new THREE.Points(pgeo, pmat);
  petals.frustumCulled = false;
  scene.add(petals);

  let flashV = 0, pulse = 0, t = 0, swing = 0, wind = 0.4;
  return {
    scene,
    // Troca de seção forte: gongo bate, rajada de pétalas.
    flash(v = 1) { flashV = Math.max(flashV, v); swing = Math.max(swing, 0.25 * v); wind = Math.max(wind, 3 * v); },
    beat(v = 1) { pulse = Math.max(pulse, v); wind = Math.max(wind, 0.6 + v * 1.1); },
    update(dt, info = {}) {
      t += dt;
      const e = info.energy || 0;
      pulse = Math.max(0, pulse - dt * 3);
      flashV = Math.max(0, flashV - dt * 0.8);
      wind += (0.35 + e * 0.6 - wind) * Math.min(1, dt * 1.2);
      for (let i = 0; i < NP; i++) {
        const v = pv[i], k = i * 3;
        pp[k] += (wind + Math.sin(t * v.wob + v.ph) * 0.3) * dt;
        pp[k + 1] -= v.fall * dt * (0.6 + wind * 0.3);
        pp[k + 2] += Math.cos(t * v.wob * 0.7 + v.ph) * 0.25 * dt;
        if (pp[k] > 12) pp[k] -= 24;
        if (pp[k + 1] < -1.2) pp[k + 1] += 10;
      }
      pgeo.attributes.position.needsUpdate = true;
      pmat.size = 0.09 + pulse * 0.025;
      for (const c of clouds) {
        c.a += c.sp * dt * (1 + e);
        c.m.position.set(Math.sin(c.a) * c.d, c.y + Math.sin(t * 0.2 + c.a * 3) * 0.3, -Math.cos(c.a) * c.d);
        const s = c.sc * (1 + pulse * 0.03);
        c.m.scale.set(s, s * 0.45, 1);
      }
      swing *= Math.exp(-dt * 0.9);
      gongPivot.rotation.x = Math.sin(t * 4.2) * swing;
      gongMat.emissiveIntensity = flashV * 1.2 + pulse * 0.15;
      sun.scale.setScalar(1 + pulse * 0.025 + flashV * 0.05);
      glowMat.color.setHSL(0.1, 1, 0.68 + Math.sin(t * 7) * 0.03 + Math.sin(t * 13) * 0.02);
    },
  };
}

// ---------- Gotas de tinta ----------
const blobTex = typeof document !== 'undefined' ? [inkBlobTex(COLORS.left, 17), inkBlobTex(COLORS.right, 29)] : [];
const markTex = typeof document !== 'undefined' ? strokeMarkTex() : null;
const enso = typeof document !== 'undefined' ? ensoTex() : null;
const blobGeo = new THREE.PlaneGeometry(0.36, 0.36);
const blobMats = blobTex.map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.2 }));
const markGeo = new THREE.PlaneGeometry(0.24, 0.09);
const markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, alphaTest: 0.25, depthWrite: false });
const ensoGeo = new THREE.PlaneGeometry(0.17, 0.17);
const ensoMat = new THREE.MeshBasicMaterial({ map: enso, transparent: true, alphaTest: 0.25, depthWrite: false });

export function makeNoteMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(blobGeo, blobMats[0]);
  const chev = new THREE.Mesh(markGeo, markMat); chev.position.z = 0.004;
  const dot = new THREE.Mesh(ensoGeo, ensoMat); dot.position.z = 0.004;
  g.add(body, chev, dot);
  g.userData = { body, chev, dot };
  return g;
}

export function styleNote(mesh, note, dirVec) {
  const u = mesh.userData;
  u.body.material = blobMats[note.hand];
  u.body.rotation.z = note.id * 2.399;
  u.chev.visible = note.dir >= 0;
  u.dot.visible = note.dir < 0;
  if (note.dir >= 0) {
    const [dx, dy] = dirVec[note.dir];
    u.chev.rotation.z = Math.atan2(dy, dx);
  }
}

// Meia gota pincelada (voa e some).
const halfGeo = new THREE.PlaneGeometry(0.18, 0.36);
{
  const uv = halfGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5);
  halfGeo.translate(-0.09, 0, 0);
}
export function makeHalf() {
  const m = new THREE.Mesh(halfGeo, new THREE.MeshBasicMaterial({ map: blobTex[0], transparent: true, depthWrite: false }));
  return m;
}
export function styleHalf(m, hand) { m.material.map = blobTex[hand] ?? blobTex[0]; m.material.needsUpdate = true; }
export const noteColor = (hand) => [COLORS.left, COLORS.right][hand] ?? COLORS.accent;

// ---------- Pincel ----------
// Cabo na mão (origem), pincel para -Z. O trecho que pinta vai de BLADE.base até a ponta.
export const BLADE = { base: -0.05, tip: -0.45 };
export function makeSaber(color) {
  const g = new THREE.Group();
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xc9b06c, roughness: 0.55 });
  const node = new THREE.MeshStandardMaterial({ color: 0x8a7440, roughness: 0.6 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.37, 12), bamboo);
  handle.rotation.x = Math.PI / 2; handle.position.z = -0.085;
  g.add(handle);
  for (const z of [0.06, -0.06, -0.18]) {
    const n = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0025, 6, 14), node);
    n.position.z = z; g.add(n);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.0135, 0.035, 12), new THREE.MeshStandardMaterial({ color: color === COLORS.right ? 0x6e1218 : 0x1a1614, roughness: 0.3, metalness: 0.2 }));
  cap.rotation.x = Math.PI / 2; cap.position.z = -0.285;
  g.add(cap);
  // Pelos: perfil girado, branco na base e com tinta na ponta.
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const y = i / 12 * 0.15;
    const r = 0.0135 * Math.sin(Math.min(1, 0.35 + i / 12 * 1.4) * Math.PI * 0.5 + 0.2) * (1 - Math.pow(i / 12, 2.2));
    prof.push(new THREE.Vector2(Math.max(0.0005, r), y));
  }
  const lathe = new THREE.LatheGeometry(prof, 14);
  const cols = [];
  const white = new THREE.Color(0xeee6d4), ink = new THREE.Color(color);
  const p = lathe.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) - 0.04) / 0.06)); const c = white.clone().lerp(ink, k); cols.push(c.r, c.g, c.b); }
  lathe.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  lathe.rotateX(-Math.PI / 2);
  const hair = new THREE.Mesh(lathe, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  hair.position.z = -0.30;
  g.add(hair);
  return g;
}

// Rastro do pincel na passada: aguada rápida da cor da tinta.
export class Trail {
  constructor(color, n = 7) {
    this.n = n;
    this.pts = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.color = new THREE.Color(color);
  }
  push(mid, tip) {
    // Pulo grande de um quadro para o outro (robô, controle sumindo): recomeça o rastro.
    const l = this.pts[0];
    if (l && Math.hypot(tip.x - l[3], tip.y - l[4], tip.z - l[5]) > 0.25) this.pts = [];
    this.pts.unshift([mid.x, mid.y, mid.z, tip.x, tip.y, tip.z]);
    if (this.pts.length > this.n) this.pts.pop();
    const c = this.color;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[Math.min(i, this.pts.length - 1)];
      this.pos.set(p, i * 6);
      const k = (1 - i / (this.n - 1)) * 0.25;
      this.col.set([c.r, c.g, c.b, 0, c.r, c.g, c.b, k], i * 8);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
  clear() { this.pts = []; }
}

// Respingos de tinta (pingos que caem).
export class Sparks {
  constructor(max = 400) {
    this.max = max;
    this.p = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.03, map: dotTex(), vertexColors: true, transparent: true, alphaTest: 0.4, depthWrite: false }));
    this.points.frustumCulled = false;
    for (let i = 0; i < max; i++) this.p[i * 3 + 1] = -100;
  }
  burst(at, color, n = 24, speed = 2.5) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      this.p.set([at.x, at.y, at.z], i * 3);
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      const r = Math.sqrt(1 - u * u);
      this.v.set([Math.cos(a) * r * s, u * s + 0.8, Math.sin(a) * r * s * 0.5], i * 3);
      this.c.set([c.r, c.g, c.b], i * 3);
      this.life[i] = 0.5 + Math.random() * 0.4;
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.p[i * 3 + 1] = -100; continue; }
      this.v[i * 3 + 1] -= 7 * dt;
      for (let k = 0; k < 3; k++) this.p[i * 3 + k] += this.v[i * 3 + k] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------- Faixa de vento ----------
// Fita de tinta clara ao longo do caminho; a parte que ainda vai chegar vem lá da frente.
const WASH = [new THREE.Color(0x6f6c6a), new THREE.Color(0xd77a80)];
export class RibbonMesh {
  constructor() {
    const n = PATH_N;
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 4);
    this.uv = new Float32Array(n * 2 * 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: DRY, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this._p = {};
    this._pts = [];
    for (let i = 0; i < n; i++) this._pts.push({ x: 0, y: 0, z: 0, ahead: 0 });
  }
  update(note, st, speed, height, broken) {
    const n = PATH_N, P = this._pts;
    for (let i = 0; i < n; i++) { ribbonPoint(note, i, st, speed, P[i]); P[i].y += height; }
    const c = WASH[note.hand] || WASH[0];
    const u = (st - note.t) / (note.t1 - note.t);
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const p = P[i];
      const w = 0.045 + 0.02 * Math.sin(i * 0.7);
      this.pos.set([p.x - ty * w, p.y + tx * w, p.z, p.x + ty * w, p.y - tx * w, p.z], i * 6);
      const done = i / (n - 1) < u;               // parte já percorrida pelo anel
      const fade = 1 - Math.min(1, Math.max(0, (p.ahead - SPAWN_DIST * 0.7) / (SPAWN_DIST * 0.3)));
      const alpha = (done ? 0.12 : broken ? 0.3 : 0.62) * fade;
      for (let k = 0; k < 2; k++) this.col.set([c.r, c.g, c.b, alpha], (i * 2 + k) * 4);
      const v = i / (n - 1) * note.length * 3;
      this.uv.set([0, v, 1, v], i * 4);
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}

// Anel que corre pela faixa: a ponta do pincel tem que ficar dentro dele.
export class RingMesh {
  constructor() {
    this.group = new THREE.Group();
    this.ringMat = new THREE.MeshBasicMaterial({ color: COLORS.left, transparent: true, opacity: 0.95, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.009, 8, 48), this.ringMat);
    this.fillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(RING_R, 40), this.fillMat);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(RING_R * 1.05, RING_R * 1.35, 48), new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.group.add(this.fill, this.ring, this.halo);
    this.group.renderOrder = 3;
  }
  // phase: tempo até o início (s, positivo = ainda não começou).
  update(pos, hand, phase, inside, broken, t) {
    this.group.position.set(pos.x, pos.y, pos.z);
    const pre = Math.max(0, Math.min(1, phase / 0.8));
    this.group.scale.setScalar(1 + pre * 0.8);
    this.ringMat.color.setHex(broken ? 0x9a948a : noteColor(hand));
    this.ringMat.opacity = phase > 0 ? 0.35 + 0.5 * (1 - pre) : 0.95;
    this.fillMat.color.setHex(inside ? COLORS.accent : 0xffffff);
    this.fillMat.opacity = inside ? 0.35 : 0.18 + 0.1 * Math.sin(t * 10) ** 2;
    this.halo.material.opacity = inside ? 0.55 + 0.25 * Math.sin(t * 14) : 0;
  }
}

// Traço pintado no ar durante a faixa: fita de tinta que vai se desfazendo.
export class InkStroke {
  constructor(color, max = 260, life = 3) {
    this.max = max; this.life = life;
    this.pts = [];
    this.pos = new Float32Array(max * 2 * 3);
    this.col = new Float32Array(max * 2 * 4);
    this.uv = new Float32Array(max * 2 * 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: DRY, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.color = new THREE.Color(color);
    this.penDown = false;
    this.dist = 0;
  }
  // Ponto novo do traço (ou levanta o pincel com up()).
  add(p, strong = true) {
    const last = this.pts[this.pts.length - 1];
    if (last && this.penDown && Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) < 0.006) return;
    if (last && this.penDown) this.dist += Math.hypot(p.x - last.x, p.y - last.y);
    this.pts.push({ x: p.x, y: p.y, z: p.z, age: 0, on: this.penDown, a: strong ? 0.9 : 0.4, d: this.dist });
    this.penDown = true;
    if (this.pts.length > this.max) this.pts.shift();
  }
  up() {
    const last = this.pts[this.pts.length - 1];
    if (this.penDown && last) this.pts.push({ ...last, on: false, age: last.age });
    this.penDown = false;
  }
  clear() { this.pts = []; this.penDown = false; this.mesh.geometry.setDrawRange(0, 0); }
  update(dt) {
    const P = this.pts;
    for (const p of P) p.age += dt;
    while (P.length && P[0].age > this.life) P.shift();
    const n = P.length, c = this.color;
    for (let i = 0; i < n; i++) {
      const p = P[i];
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const k = 1 - p.age / this.life;
      const w = 0.012 + 0.014 * k;
      this.pos.set([p.x - ty * w, p.y + tx * w, p.z, p.x + ty * w, p.y - tx * w, p.z], i * 6);
      // Pontos 'off' (pincel levantado) são invisíveis: separam um traço do outro.
      const al = p.on ? p.a * k * k : 0;
      for (let q = 0; q < 2; q++) this.col.set([c.r, c.g, c.b, al], (i * 2 + q) * 4);
      const v = p.d * 4;
      this.uv.set([0, v, 1, v], i * 4);
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, Math.max(0, (n - 1) * 6));
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}
