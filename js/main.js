// Liga tudo: renderização, controles do Quest, mouse, menus, música e o laço do jogo.
// Quem decide o que o pincel acertou é o play.js (Round), o mesmo que os testes usam.
import * as THREE from '../vendor/three/three.module.js';
import { compose, sectionAt } from './music.js';
import { makeChart, soloChart, DIFFS, DIR_VEC } from './chart.js';
import { Round, robotPose } from './play.js';
import * as MODE from './mode.js';
import { SONGS } from './songs.js';
import { Synth } from './synth.js';
import { Panel, Label, C, FONT, PANEL_W, drawScroll, roundRect } from './ui.js';
import { buildScene, makeNoteMesh, styleNote, makeHalf, styleHalf, noteColor, makeSaber, BLADE, Trail, Sparks, COLORS, RibbonMesh, RingMesh, InkStroke } from './scene.js';
import * as S from './save.js';

const GAME_NAME = 'PINCEL DO VENTO';
const save = S.loadState();
const synth = new Synth();
synth.setMusicVolume(save.musicVol);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildScene();
const scene = world.scene;
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.02, 200);
rig.add(camera);

function deskCamera() {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  camera.position.set(0, 1.5, 0.55);
  camera.lookAt(0, 1.15, -2);
}
deskCamera();

const panel = new Panel(1.2);
scene.add(panel.mesh);
function placePanel(yaw = 0) {
  panel.mesh.position.set(Math.sin(yaw) * 1.3, 1.4, -Math.cos(yaw) * 1.3);
  panel.mesh.rotation.set(0, -yaw, 0);
}
placePanel();

const fpsLabel = new Label(0.14);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);

// Placar: pergaminho pendurado (kakemono) à direita, virado para o jogador.
class Hud {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 384; this.canvas.height = 720;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.825), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }));
    this.group = new THREE.Group();
    this.group.position.set(1.3, 1.3, -1.55);
    this.group.rotation.y = -0.62;
    this.group.add(this.mesh);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0x3b2a1a }));
    cord.position.y = 0.66; this.group.add(cord);
    this.last = '';
  }
  draw(sk, progress, section) {
    const key = `${sk.score}|${sk.combo}|${Math.round(sk.health * 50)}|${Math.round(progress * 100)}|${section}`;
    if (key === this.last) return;
    this.last = key;
    const g = this.g, w = 384, h = 720;
    g.clearRect(0, 0, w, h);
    drawScroll(g, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = C.dim; g.font = `italic 26px ${FONT}`;
    g.fillText(section || '', w / 2, 76);
    g.fillStyle = C.ink; g.font = `bold 64px ${FONT}`;
    g.fillText(String(sk.score), w / 2, 160);
    g.font = `22px ${FONT}`; g.fillStyle = C.dim; g.fillText('pontos', w / 2, 204);
    // Carimbo carmim com o multiplicador.
    g.save(); g.translate(w / 2, 300); g.rotate(-0.08);
    g.fillStyle = sk.mult > 1 ? C.edge : 'rgba(168,36,43,0.35)'; roundRect(g, -58, -50, 116, 100, 12); g.fill();
    g.fillStyle = '#fff6e6'; g.font = `bold 58px ${FONT}`; g.fillText(`x${sk.mult}`, 0, 4);
    g.restore();
    g.fillStyle = C.ink; g.font = `bold 40px ${FONT}`;
    g.fillText(sk.combo > 1 ? `${sk.combo}` : '', w / 2, 410);
    g.font = `22px ${FONT}`; g.fillStyle = C.dim;
    g.fillText(sk.combo > 1 ? 'em sequência' : '', w / 2, 446);
    // Barra de tinta (vida) e progresso da música, como pinceladas.
    g.fillStyle = C.dim; g.font = `22px ${FONT}`; g.fillText('tinta', w / 2, 520);
    g.fillStyle = 'rgba(31,27,23,0.12)'; roundRect(g, 50, 540, w - 100, 26, 13); g.fill();
    g.fillStyle = sk.health > 0.3 ? C.ink : C.edge; roundRect(g, 50, 540, Math.max(26, (w - 100) * sk.health), 26, 13); g.fill();
    g.fillStyle = C.dim; g.fillText('música', w / 2, 610);
    g.fillStyle = 'rgba(31,27,23,0.12)'; roundRect(g, 50, 628, w - 100, 12, 6); g.fill();
    g.fillStyle = C.edge; roundRect(g, 50, 628, Math.max(12, (w - 100) * clamp(progress, 0, 1)), 12, 6); g.fill();
    this.tex.needsUpdate = true;
  }
}
const hud = new Hud();
scene.add(hud.group);
hud.group.visible = false;

const sparks = new Sparks(500);
scene.add(sparks.points);

// ---------- Pincéis ----------
const sabers = [0, 1].map(hand => {
  const color = hand === 0 ? COLORS.left : COLORS.right;
  const pivot = new THREE.Group();
  const model = makeSaber(color);
  pivot.add(model);
  scene.add(pivot);
  const trail = new Trail(color);
  scene.add(trail.mesh);
  const stroke = new InkStroke(color);
  scene.add(stroke.mesh);
  return {
    hand, color, pivot, model, trail, stroke, entry: null,
    base: new THREE.Vector3(), tip: new THREE.Vector3(), pbase: new THREE.Vector3(), ptip: new THREE.Vector3(),
    valid: false, fresh: false, dt: 0,
  };
});

// ---------- VR: controles ----------
const hands = { left: null, right: null };
const ctrls = [];
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  const grip = renderer.xr.getControllerGrip(i);
  rig.add(ctrl); rig.add(grip);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: C.edge }));
  laser.scale.z = 2; laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, grip, laser, source: null, hand: null, prev: [], hoverIndex: -1 };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => {
    entry.source = e.data; entry.hand = e.data.handedness;
    if (entry.hand === 'left' || entry.hand === 'right') hands[entry.hand] = entry;
    attachSabers();
  });
  ctrl.addEventListener('disconnected', () => {
    if (entry.hand && hands[entry.hand] === entry) hands[entry.hand] = null;
    entry.source = null; entry.hand = null;
    attachSabers();
  });
  ctrl.addEventListener('selectstart', () => onTrigger(entry));
}

const inVR = () => renderer.xr.isPresenting;

function attachSabers() {
  for (const s of sabers) {
    const e = hands[s.hand === 0 ? 'left' : 'right'];
    s.entry = e;
    if (inVR() && e) {
      e.grip.add(s.pivot);
      s.pivot.position.set(0, 0, 0);
      s.pivot.rotation.set(THREE.MathUtils.degToRad(save.angle), 0, 0);
    } else {
      scene.add(s.pivot);
      s.pivot.rotation.set(0, 0, 0);
    }
    s.valid = false;
    s.trail.clear();
  }
}

function pulse(saber, v, ms) {
  try { saber?.entry?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v, ms); } catch { /* sem vibração */ }
}

// Põe o jogador no centro do pátio, virado para a frente (-Z).
function recenter() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
}
let recenterIn = 0;
renderer.xr.addEventListener('sessionstart', () => { recenterIn = 5; attachSabers(); updateHint(); placePanel(0); });
renderer.xr.addEventListener('sessionend', () => { deskCamera(); attachSabers(); updateHint(); if (app === 'playing') pauseGame(); });

function headYaw() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  return Math.atan2(d.x, -d.z);
}

// ---------- Mouse (PC) ----------
const mouse = { ndc: new THREE.Vector2(0.15, -0.1), moved: false };
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

renderer.domElement.addEventListener('pointermove', (e) => {
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.moved = true;
  if (panel.visible && !inVR()) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    panel.setHover(panel.pick(hit?.uv));
  }
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  synth.unlock();
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    doAction(panel.actionAt(panel.pick(hit?.uv)));
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'f' || e.key === 'F') { save.fps = !save.fps; S.saveState(save); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Põe o pincel com o cabo em gripPos apontando para tipPos.
function placeSaber(s, gripPos, tipPos) {
  s.pivot.position.copy(gripPos);
  tmpV2.copy(gripPos).multiplyScalar(2).sub(tipPos); // olhar para o lado oposto: -Z aponta para a ponta
  s.pivot.lookAt(tmpV2);
}
const gripP = new THREE.Vector3(), tipP = new THREE.Vector3();
const hitPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), MODE.HIT_DIST);
const GRIP_BACK = new THREE.Vector3(0.12, -0.5, 0.85).normalize();
// Pincel do mouse: a ponta segue o mouse no plano do pincel (0,7 m à frente).
function updateMouseSaber() {
  const s = sabers[1];
  raycaster.setFromCamera(mouse.ndc, camera);
  if (!raycaster.ray.intersectPlane(hitPlane, tipP)) return;
  tipP.x = clamp(tipP.x, -1.2, 1.2); tipP.y = clamp(tipP.y, 0.3, 2.2);
  gripP.copy(tipP).addScaledVector(GRIP_BACK, -BLADE.tip);
  gripP.x += tipP.x * 0.15;
  tmpV.copy(tipP).sub(gripP).normalize();
  gripP.copy(tipP).addScaledVector(tmpV, BLADE.tip); // ponta exatamente no mouse
  placeSaber(s, gripP, tipP);
}

// ---------- Estado do jogo ----------
let app = 'menu';          // 'menu' | 'playing' | 'paused' | 'result'
let screen = 'main';
let songIdx = save.lastSong, diffIdx = save.lastDiff;
let comp = null, chart = null, round = null, sk = null;
let nextIdx = 0;
const drops = new Map();   // id -> { n, mesh, fade }
const winds = new Map();   // id -> { n, ribbon, ring }
const notePool = [], ribbonPool = [], ringPool = [];
const halves = [];         // { m, v, spin, life }
let lastBeat = -1, lastSection = null;
let result = null;
const dev = { autoplay: false, freeze: false };

function getNoteMesh() {
  const m = notePool.pop() || makeNoteMesh();
  scene.add(m);
  m.visible = true;
  m.scale.setScalar(1);
  return m;
}
function freeNoteMesh(m) { m.visible = false; scene.remove(m); notePool.push(m); }

function startSong(si = songIdx, di = diffIdx) {
  songIdx = si; diffIdx = di;
  save.lastSong = si; save.lastDiff = di; S.saveState(save);
  clearNotes();
  comp = compose(SONGS[si]);
  chart = MODE.decorate(makeChart(comp, di, { spawnDist: MODE.SPAWN_DIST }), comp, di);
  // No PC (um pincel só) usa o mapa sem faixas sobrepostas nem gotas durante a faixa.
  const solo = !inVR() && !dev.autoplay;
  if (solo) chart = soloChart(chart);
  round = new Round(chart, comp, { solo, noFail: save.noFail, height: save.height });
  sk = round.sk;
  nextIdx = 0;
  lastBeat = -1; lastSection = null;
  synth.stop();
  synth.start(comp, chart.lead + 0.5);
  app = 'playing';
  panel.hide();
  hud.group.visible = true;
  hud.last = '';
  if (!inVR()) deskCamera();
  updateHint();
}

function clearNotes() {
  for (const a of drops.values()) freeNoteMesh(a.mesh);
  drops.clear();
  for (const w of winds.values()) freeWind(w);
  winds.clear();
  for (const h of halves) h.life = 0;
  for (const s of sabers) s.stroke.clear();
}

function freeWind(w) {
  scene.remove(w.ribbon.mesh); scene.remove(w.ring.group);
  ribbonPool.push(w.ribbon); ringPool.push(w.ring);
}

function pauseGame() {
  if (app !== 'playing') return;
  app = 'paused';
  synth.pause();
  screen = 'pause';
  placePanel(inVR() ? headYaw() : 0);
  showScreen();
}
function resumeGame() {
  if (app !== 'paused') return;
  panel.hide();
  app = 'playing';
  synth.unlock();
  synth.resume();
}
function togglePause() { if (app === 'playing') pauseGame(); else if (app === 'paused') resumeGame(); }

function quitToMenu() {
  synth.stop();
  clearNotes();
  app = 'menu';
  hud.group.visible = false;
  screen = 'songs';
  if (!inVR()) deskCamera();
  placePanel(0);
  showScreen();
  updateHint();
}

function finish(failed) {
  synth.stop();
  synth.fanfare(!failed);
  const song = SONGS[songIdx], diff = DIFFS[diffIdx];
  const res = { score: sk.score, rank: failed ? '—' : sk.rank, acc: Math.round(sk.accuracy * 100), combo: sk.maxCombo };
  const isRecord = !failed && S.record(save, song.id, diff.id, res);
  const total = chart.notes.length, faixas = chart.notes.filter(n => n.kind === 'faixa').length;
  const faixasOk = round.state.filter(s => s.hold && s.hold.finished && !s.hold.broken).length;
  result = { ...res, failed, isRecord, hits: sk.hits, total, faixas, faixasOk, misses: sk.misses + sk.bad };
  clearNotes();
  app = 'result';
  hud.group.visible = false;
  screen = 'result';
  placePanel(inVR() ? headYaw() : 0);
  showScreen();
  updateHint();
}

// ---------- Menus ----------
function showScreen() {
  panel.show((p) => {
    const W = PANEL_W;
    if (screen === 'main') {
      p.title(GAME_NAME, 100);
      p.text('Pincele as gotas de tinta. Siga o vento com a ponta do pincel.', W / 2, 178, { size: 28, color: C.dim });
      p.button('Jogar', 'go:songs', 312, 240, 400, 100, { size: 44 });
      p.button('Opções', 'go:options', 312, 360, 400, 84);
      p.button('Como jogar', 'go:help', 312, 464, 400, 84);
      p.text(inVR() ? 'Aponte com o controle e aperte o gatilho' : 'No PC: o mouse move o pincel. Esc pausa.', W / 2, 610, { size: 26, color: C.dim });
    } else if (screen === 'songs') {
      p.title('Escolha a música', 76);
      SONGS.forEach((song, i) => {
        const y = 135 + i * 165;
        p.text(song.name, 60, y + 30, { size: 38, bold: true, align: 'left' });
        p.text(song.desc, 60, y + 72, { size: 24, align: 'left', color: C.dim });
        DIFFS.forEach((d, k) => {
          const best = S.bestOf(save, song.id, d.id);
          p.button(d.name, `play:${i}:${k}`, 420 + k * 190, y + 6, 175, 100,
            { size: 30, on: i === songIdx && k === diffIdx, sub: best ? `${best.rank} · ${best.score}` : 'sem recorde' });
        });
      });
      p.button('Voltar', 'go:main', 362, 625, 300, 62, { size: 30 });
    } else if (screen === 'options') {
      p.title('Opções', 76);
      const line = (y, label, vals, cur, key) => {
        p.text(label, 60, y + 32, { size: 30, align: 'left' });
        vals.forEach(([v, txt], k) => p.button(txt, `opt:${key}:${v}`, 420 + k * 112, y, 102, 64, { size: 26, on: v === cur }));
      };
      line(130, 'Sem derrota', [[false, 'Não'], [true, 'Sim']], save.noFail, 'noFail');
      line(215, 'Ângulo do pincel', [[-30, '-30°'], [-15, '-15°'], [0, '0°'], [15, '+15°'], [30, '+30°']], save.angle, 'angle');
      line(300, 'Altura das notas', [[-0.15, 'Baixa'], [0, 'Média'], [0.15, 'Alta']], save.height, 'height');
      line(385, 'Volume da música', [[0, '0'], [0.4, '40%'], [0.8, '80%'], [1, '100%']], save.musicVol, 'musicVol');
      line(470, 'Mostrar FPS', [[false, 'Não'], [true, 'Sim']], save.fps, 'fps');
      p.button('Voltar', 'go:main', 362, 595, 300, 66, { size: 30 });
    } else if (screen === 'help') {
      p.title('Como jogar', 76);
      const lines = [
        'Um pincel em cada mão: tinta preta na esquerda, vermelha na direita.',
        'GOTAS: passe o pincel da cor da gota através dela, rápido,',
        '    no sentido do traço desenhado nela. Gota com círculo: qualquer sentido.',
        'FAIXAS DE VENTO: um caminho de tinta clara vem chegando. Quando o anel',
        '    começar a correr, ponha a ponta do pincel da cor certa dentro dele',
        '    e acompanhe até o fim. Dentro do anel ganha pontos sem parar.',
        'Sair do anel por mais de um instante quebra a sequência.',
        'Sequência sobe o multiplicador. Errar gasta a barra de tinta.',
        'Pausa: B ou Y (Esc no PC). No PC o mouse move um pincel que vale as duas cores.',
      ];
      lines.forEach((l, i) => p.text(l, 52, 140 + i * 50, { size: 25, align: 'left', bold: i === 1 || i === 3 }));
      p.button('Voltar', 'go:main', 362, 610, 300, 66, { size: 30 });
    } else if (screen === 'pause') {
      p.title('Pausa', 90);
      p.button('Continuar', 'resume', 312, 170, 400, 90, { size: 40 });
      p.button('Recomeçar', 'restart', 312, 280, 400, 80);
      p.button('Recentralizar', 'recenter', 312, 380, 400, 80, { locked: !inVR() });
      p.button('Sair da música', 'quit', 312, 480, 400, 80);
    } else if (screen === 'result') {
      const r = result;
      p.title(r.failed ? 'A tinta secou' : 'Obra concluída!', 80);
      p.text(`${SONGS[songIdx].name} · ${DIFFS[diffIdx].name}`, PANEL_W / 2, 145, { size: 30, color: C.dim });
      // Nota dentro de um carimbo carmim.
      const g = p.ctx;
      g.save(); g.translate(230, 310); g.rotate(-0.06);
      g.fillStyle = r.failed ? C.lock : C.edge; roundRect(g, -110, -110, 220, 220, 22); g.fill();
      g.restore();
      p.text(r.rank, 230, 318, { size: 170, bold: true, color: r.failed ? C.dim : C.btnOnText });
      p.text(`Pontos: ${r.score}`, 420, 215, { size: 36, align: 'left', bold: true });
      p.text(`Precisão: ${r.acc}%`, 420, 268, { size: 30, align: 'left' });
      p.text(`Notas: ${r.hits} de ${r.total}`, 420, 316, { size: 30, align: 'left' });
      p.text(`Faixas completas: ${r.faixasOk} de ${r.faixas}`, 420, 364, { size: 30, align: 'left' });
      p.text(`Maior sequência: ${r.combo}`, 420, 412, { size: 30, align: 'left' });
      if (r.isRecord) p.text('NOVO RECORDE!', 420, 464, { size: 34, bold: true, align: 'left', color: C.edge });
      p.button('Jogar de novo', 'restart', 160, 530, 340, 90, { size: 34 });
      p.button('Músicas', 'go:songs', 524, 530, 340, 90, { size: 34 });
    }
  });
}

function doAction(a) {
  if (!a) return;
  synth.unlock();
  synth.click();
  const [cmd, x, y] = a.split(':');
  if (cmd === 'go') { screen = x; showScreen(); }
  else if (cmd === 'play') startSong(Number(x), Number(y));
  else if (cmd === 'opt') {
    const v = y === 'true' ? true : y === 'false' ? false : Number(y);
    save[x] = v;
    if (x === 'angle') attachSabers();
    if (x === 'musicVol') synth.setMusicVolume(v);
    S.saveState(save);
    showScreen();
  } else if (cmd === 'resume') resumeGame();
  else if (cmd === 'restart') startSong();
  else if (cmd === 'recenter') { recenter(); placePanel(0); }
  else if (cmd === 'quit') quitToMenu();
}

function onTrigger(entry) {
  synth.unlock();
  if (panel.visible && entry.hoverIndex >= 0) doAction(panel.actionAt(entry.hoverIndex));
}

// Laser dos controles apontando para o menu.
const rayM = new THREE.Matrix4();
function updateLasers() {
  for (const e of ctrls) {
    const show = inVR() && panel.visible && e.source;
    e.laser.visible = !!show;
    e.hoverIndex = -1;
    if (!show) continue;
    rayM.identity().extractRotation(e.ctrl.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(e.ctrl.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rayM);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.scale.z = hit ? hit.distance : 2;
    if (hit) e.hoverIndex = panel.pick(hit.uv);
  }
  const h = ctrls.find(e => e.hoverIndex >= 0);
  if (inVR() && panel.visible) panel.setHover(h ? h.hoverIndex : -1);
}

// Botões B/Y pausam.
function pollButtons() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp) continue;
    const b = gp.buttons.map(x => x.pressed);
    if ((b[5] && !e.prev[5]) || (b[4] && !e.prev[4] && app === 'paused')) togglePause();
    e.prev = b;
  }
}

// ---------- Jogo ----------
const pos = {}, ringPos = {};

function brushActive(s) {
  return s.pivot.visible && (inVR() ? !!s.entry : (s.hand === 1 || dev.autoplay));
}

function readSabers(dt) {
  for (const s of sabers) {
    s.pbase.copy(s.base); s.ptip.copy(s.tip);
    s.model.updateWorldMatrix(true, false);
    s.base.set(0, 0, BLADE.base).applyMatrix4(s.model.matrixWorld);
    s.tip.set(0, 0, BLADE.tip).applyMatrix4(s.model.matrixWorld);
    const ok = brushActive(s);
    if (ok) s.trail.push(tmpV.copy(s.base).lerp(s.tip, 0.6), s.tip);
    s.trail.mesh.visible = ok && app === 'playing';
    const was = s.valid;
    s.valid = ok;
    s.fresh = ok && was; // precisa de dois quadros seguidos para medir a passada
    s.dt = dt;
  }
}

// Robô do PC (dev.autoplay): a mesma pose do robô dos testes, nos dois pincéis.
const rb = new THREE.Vector3(), rt = new THREE.Vector3(), rd = new THREE.Vector3();
function autoplaySabers(st) {
  for (const s of sabers) {
    const p = robotPose(chart, s.hand, st, save.height);
    rb.set(p.base.x, p.base.y, p.base.z); rt.set(p.tip.x, p.tip.y, p.tip.z);
    rd.copy(rt).sub(rb).normalize();
    gripP.copy(rb).addScaledVector(rd, BLADE.base); // BLADE.base é negativo: recua 5 cm
    placeSaber(s, gripP, tmpV.copy(gripP).add(rd));
  }
}

// Mostra as notas quando chegam na distância de onde aparecem.
function spawnNotes(st) {
  const lead = chart.lead;
  while (nextIdx < chart.notes.length && chart.notes[nextIdx].t - lead <= st) {
    const n = chart.notes[nextIdx++];
    if (n.kind === 'gota') {
      const mesh = getNoteMesh();
      styleNote(mesh, n, DIR_VEC);
      drops.set(n.id, { n, mesh, fade: -1 });
    } else {
      const ribbon = ribbonPool.pop() || new RibbonMesh();
      const ring = ringPool.pop() || new RingMesh();
      scene.add(ribbon.mesh); scene.add(ring.group);
      winds.set(n.id, { n, ribbon, ring });
    }
  }
}

function brushFor(ev) { return ev.brush >= 0 ? sabers[ev.brush] : null; }

function cutDrop(a, ev) {
  const res = ev.res, p = a.mesh.position;
  sparks.burst(p, noteColor(a.n.hand), 22, 1.6 + (res.speed || 3) * 0.2);
  const ang = Math.atan2(res.cutDir[1], res.cutDir[0]);
  for (const side of [1, -1]) {
    let h = halves.find(x => x.life <= 0);
    if (!h) { h = { m: makeHalf(), v: new THREE.Vector3(), spin: 0, life: 0 }; halves.push(h); }
    scene.add(h.m);
    h.m.visible = true;
    styleHalf(h.m, a.n.hand);
    h.m.material.opacity = 1;
    h.m.position.copy(p);
    h.m.rotation.set(0, 0, ang + Math.PI / 2 + (side > 0 ? 0 : Math.PI));
    const nx = -res.cutDir[1] * side, ny = res.cutDir[0] * side;
    h.v.set(nx * 1.3, ny * 1.3 + 0.5, -0.5);
    h.spin = (Math.random() - 0.5) * 6;
    h.life = 0.6;
  }
  freeNoteMesh(a.mesh);
  drops.delete(a.n.id);
  synth.cut(Math.min(1, res.points / 100), clamp(p.x, -1, 1));
  pulse(brushFor(ev), 0.5, 25);
}

function handleEvents(events, st) {
  for (const ev of events) {
    const n = ev.note;
    if (ev.type === 'cut') { const a = drops.get(n.id); if (a) cutDrop(a, ev); }
    else if (ev.type === 'wrong' || ev.type === 'miss') {
      const a = drops.get(n.id);
      if (a) a.fade = 0.25;
      if (ev.type === 'miss') synth.miss(); else { synth.bad(clamp(n.x, -1, 1)); pulse(brushFor(ev), 1, 80); }
    } else if (ev.type === 'tick') {
      synth.holdTick((st - n.t) / (n.t1 - n.t), clamp(ev.pos.x, -1, 1));
      sparks.burst(ev.pos, noteColor(n.hand), 3, 0.6);
      pulse(brushFor(ev), 0.25, 15);
    } else if (ev.type === 'break') { synth.holdBreak(clamp(ev.pos.x, -1, 1)); }
    else if (ev.type === 'done') {
      synth.holdDone(clamp(ev.pos.x, -1, 1));
      sparks.burst(ev.pos, COLORS.accent, 26, 1.8);
      pulse(brushFor(ev), 0.7, 60);
    }
  }
}

function updatePlaying(dt) {
  synth.tick(dt);
  synth.pump();
  const st = synth.time();
  const speed = chart.diff.speed;
  const h = save.height;

  if (!inVR()) {
    deskCamera();
    if (dev.autoplay) autoplaySabers(st);
    else updateMouseSaber();
  }
  readSabers(dt);
  spawnNotes(st);

  // Juiz: o mesmo dos testes.
  const brushes = sabers.map(s => ({ hand: s.hand, valid: s.fresh, base0: s.pbase, tip0: s.ptip, base1: s.base, tip1: s.tip, dt: s.dt }));
  handleEvents(round.step(st, dt, brushes), st);

  // Gotas: posição e as que somem.
  for (const [id, a] of drops) {
    MODE.notePos(a.n, st, speed, pos);
    a.mesh.position.set(pos.x, pos.y + h, pos.z);
    if (a.fade >= 0) {
      a.fade -= dt;
      a.mesh.scale.setScalar(Math.max(0.01, a.fade * 4));
      if (a.fade <= 0) { freeNoteMesh(a.mesh); drops.delete(id); }
    }
  }
  // Faixas: fita, anel e o traço pintado no ar.
  const painting = [false, false];
  for (const [id, w] of winds) {
    const n = w.n, S = round.state[id], hold = S.hold;
    w.ribbon.update(n, st, speed, h, hold.broken);
    MODE.ringAt(n, st, ringPos); ringPos.y += h;
    w.ring.update(ringPos, n.hand, n.t - st, hold.inside && st >= n.t, hold.broken, st);
    w.ring.group.visible = st <= n.t1 + 0.05 && n.t - st < 2.5;
    if (st >= n.t && st <= n.t1) {
      painting[round.solo ? 1 : n.hand] = true;
    }
    if (st > n.t1 + 0.6) { freeWind(w); winds.delete(id); }
  }
  for (const s of sabers) {
    if (painting[s.hand] && brushActive(s)) s.stroke.add(s.tip, true);
    else s.stroke.up();
  }

  // Batida e seção: o cenário pulsa com a música.
  const beat = Math.floor(st / comp.spb);
  const sec = sectionAt(comp, Math.max(0, st / comp.spb));
  if (beat !== lastBeat && st >= 0) { lastBeat = beat; if (sec.energy > 0.35) world.beat(0.3 + sec.energy * 0.7); }
  if (sec !== lastSection && st >= 0) { if (lastSection && sec.energy >= 0.6) world.flash(1); lastSection = sec; }
  world.update(dt, { energy: st >= 0 ? sec.energy : 0.2 });

  hud.draw(sk, st / comp.duration, st >= 0 ? sec.name : '');
  if (sk.failed) finish(true);
  else if (st > comp.duration + 1) finish(false);
}

function updateHalves(dt) {
  for (const hh of halves) {
    if (hh.life <= 0) { if (hh.m.visible) { hh.m.visible = false; scene.remove(hh.m); } continue; }
    hh.life -= dt;
    hh.v.y -= 6 * dt;
    hh.m.position.addScaledVector(hh.v, dt);
    hh.m.rotation.z += hh.spin * dt;
    hh.m.material.opacity = Math.max(0, hh.life / 0.6);
  }
}

// ---------- Laço principal ----------
let fpsAcc = 0, fpsN = 0, fpsShown = 0;
const clock = new THREE.Clock();
const fpsDiv = document.getElementById('fps');

function step(dt) {
  if (recenterIn > 0 && inVR()) { recenterIn--; if (recenterIn === 0) recenter(); }
  pollButtons();
  if (app === 'playing') updatePlaying(dt);
  else {
    readSabers(dt);
    world.update(dt, { energy: 0.15 });
    if (!inVR()) {
      deskCamera();
      // No menu do PC o pincel fica parado ao lado.
      placeSaber(sabers[1], gripP.set(0.32, 1.0, 0.0), tipP.set(0.5, 1.3, -0.4));
    }
  }
  for (const s of sabers) s.stroke.update(dt);
  updateHalves(dt);
  sparks.update(dt);
  updateLasers();
  // No PC só o pincel vermelho aparece (a não ser com o robô).
  sabers[0].pivot.visible = inVR() ? !!sabers[0].entry : (dev.autoplay && app === 'playing');
  sabers[1].pivot.visible = inVR() ? !!sabers[1].entry : true;
}

function frameLoop() {
  const dt = Math.min(0.05, clock.getDelta());
  if (!dev.freeze) step(dt); // freeze: congela a cena para fotos de teste
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  fpsLabel.mesh.visible = save.fps && inVR();
  if (fpsLabel.mesh.visible) fpsLabel.set(`${fpsShown} FPS`);
  fpsDiv.style.display = save.fps && !inVR() ? 'block' : 'none';
  if (save.fps) fpsDiv.textContent = `${fpsShown} FPS`;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frameLoop);

// ---------- Botão VR e dica ----------
const vrBtn = document.getElementById('vr');
const hintDiv = document.getElementById('hint');
function updateHint() {
  hintDiv.textContent = inVR() ? '' : app === 'playing' ? 'Mova o mouse para pincelar · Esc pausa' : 'Clique no menu · no Quest, aperte "Entrar em VR"';
}
async function setupVR() {
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.disabled = false;
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.addEventListener('click', async () => {
    synth.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
      if (app === 'menu') { screen = 'main'; showScreen(); }
    } catch (err) {
      vrBtn.textContent = 'Não deu para entrar em VR';
      console.error(err);
    }
  });
}
setupVR();
attachSabers();
showScreen();
updateHint();

// Para testes no console: window.jogo (o painel escondido não anima: use dev.advance).
dev.advance = (sec, fps = 60) => {
  for (let i = 0; i < sec * fps; i++) step(1 / fps);
  renderer.render(scene, camera);
  const faixas = round ? round.state.filter(s => s.hold) : [];
  return {
    app, score: sk?.score, hits: sk?.hits, misses: sk?.misses, bad: sk?.bad, total: chart?.notes.length,
    faixas: faixas.length, faixasOk: faixas.filter(s => s.hold.finished && !s.hold.broken).length, rank: sk?.rank, st: synth.time(),
  };
};
window.jogo = { startSong, doAction, dev, save, get sk() { return sk; }, get chart() { return chart; }, get round() { return round; }, get app() { return app; }, get result() { return result; } };
