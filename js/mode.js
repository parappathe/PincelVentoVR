// Regra própria do Pincel do Vento: as notas vêm da frente, flutuando como tinta no ar, até o
// plano do pincel (0,7 m à frente). As faixas de vento têm um caminho desenhado nesse plano e um
// anel que corre por ele no ritmo da música. Puro (sem navegador).
import { rng } from './music.js';

export const HIT_DIST = 0.7;     // distância à frente do jogador onde a nota chega no tempo certo
export const SPAWN_DIST = 14;    // distância de onde ela aparece
const SWAY = 0.35;               // quanto a gota balança de lado enquanto flutua (m)
const RISE = 1.1;                // de que altura ela desce
// Área ao alcance dos braços onde ficam as faixas (no plano do pincel).
export const BOUNDS = { yMin: 0.72, yMax: 1.58, xMax: 0.58, inner: 0.04 };
export const PATH_N = 48;        // pontos de cada caminho

// Para onde a nota "olha": right/up = plano do traço, back = da nota para o jogador.
export const FRAME = Object.freeze({
  right: Object.freeze({ x: 1, y: 0, z: 0 }),
  up: Object.freeze({ x: 0, y: 1, z: 0 }),
  back: Object.freeze({ x: 0, y: 0, z: 1 }),
});
export function noteFrame() { return FRAME; }

// Posição da gota no tempo da música (s).
export function notePos(note, songTime, speed, out = {}) {
  const ahead = (note.t - songTime) * speed;
  const far = Math.max(0, Math.min(1, ahead / SPAWN_DIST));
  out.x = note.x + Math.sin(note.id * 1.7 + far * 5) * SWAY * far;
  out.y = note.y + RISE * far * far;
  out.z = -(HIT_DIST + ahead);
  return out;
}

// ---------- Caminhos das faixas ----------
// Formas em coordenadas "unitárias" (s de 0 a 1).
const SHAPE_FN = {
  reta: (s, k) => [s * 2 - 1, (0.5 - s) * k.tilt],
  arco: (s) => [-Math.cos(Math.PI * s), Math.sin(Math.PI * s) * 0.75],
  onda: (s) => [s * 2 - 1, 0.42 * Math.sin(Math.PI * 2 * 1.5 * s)],
  subida: (s) => [0.35 * Math.sin(Math.PI * s), s * 2 - 1],
  descida: (s) => [0.35 * Math.sin(Math.PI * s), 1 - s * 2],
  S: (s) => [-0.7 * Math.sin(Math.PI * 2 * s), 1 - s * 2],
  espiral: (s) => { const a = Math.PI * 3.2 * s, rr = 1 - 0.65 * s; return [Math.cos(a) * rr, Math.sin(a) * rr]; },
};

function resample(pts, n) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = acc[acc.length - 1];
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = L * i / (n - 1);
    while (j < pts.length - 2 && acc[j + 1] < d) j++;
    const seg = acc[j + 1] - acc[j] || 1;
    const u = Math.min(1, Math.max(0, (d - acc[j]) / seg));
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u]);
  }
  return { pts: out, length: L };
}

// Monta o caminho de uma faixa: escala pela duração (anel na velocidade da dificuldade), cabe
// na área da mão (esquerda x < 0, direita x > 0) e entre 0,72 e 1,58 m de altura.
export function buildPath(note, diff, r) {
  const fn = SHAPE_FN[note.shape] || SHAPE_FN.reta;
  const k = { tilt: (r() - 0.5) * 1.2 };
  const raw = [];
  for (let i = 0; i <= 96; i++) {
    let [x, y] = fn(i / 96, k);
    if (note.flipX) x = -x;
    if (note.flipY && note.shape !== 'subida' && note.shape !== 'descida') y = -y;
    raw.push([x, y]);
  }
  const unit = resample(raw, 97).length;
  const dur = note.t1 - note.t;
  const target = Math.max(0.28, Math.min(1.25, dur * diff.ringSpeed));
  const minX = Math.min(...raw.map(p => p[0])), maxX = Math.max(...raw.map(p => p[0]));
  const minY = Math.min(...raw.map(p => p[1])), maxY = Math.max(...raw.map(p => p[1]));
  const w = BOUNDS.xMax - BOUNDS.inner, h = BOUNDS.yMax - BOUNDS.yMin;
  let scale = target / unit;
  scale = Math.min(scale, w / Math.max(1e-6, maxX - minX), h / Math.max(1e-6, maxY - minY));
  const bw = (maxX - minX) * scale, bh = (maxY - minY) * scale;
  // Posição: uma faixa por mão fica do lado dela; dupla (Difícil) é espelhada.
  const side = note.hand === 0 ? -1 : 1;
  const rx = r(), ry = r();
  const x0 = BOUNDS.inner + (w - bw) * (0.25 + 0.5 * rx); // borda interna do desenho (|x|)
  const y0 = BOUNDS.yMin + (h - bh) * (0.2 + 0.6 * ry);
  // Direita: x = lx. Esquerda: mesmo desenho deslocado para x < 0; na dupla, espelhado.
  const pts = raw.map(([x, y]) => {
    const lx = x0 + (x - minX) * scale;           // de x0 a x0 + bw, medido do centro para fora
    const xx = side > 0 ? lx : note.double ? -lx : lx - 2 * x0 - bw;
    return [xx, y0 + (y - minY) * scale];
  });
  const rs = resample(pts, PATH_N);
  note.path = rs.pts;
  note.length = rs.length;
  return note;
}

export function decorate(chart, comp, diffIndex) {
  for (const n of chart.notes) {
    if (n.kind !== 'faixa') continue;
    const r = rng(n.seed + 17 + diffIndex);
    // Dupla: as duas mãos usam o mesmo sorteio, então ficam espelhadas.
    buildPath(n, chart.diff, r);
  }
  return chart;
}

// Ponto do caminho no parâmetro u (0..1).
export function pathAt(note, u, out = {}) {
  const P = note.path, f = Math.max(0, Math.min(1, u)) * (P.length - 1);
  const i = Math.min(P.length - 2, Math.floor(f)), k = f - i;
  out.x = P[i][0] + (P[i + 1][0] - P[i][0]) * k;
  out.y = P[i][1] + (P[i + 1][1] - P[i][1]) * k;
  return out;
}

// Centro do anel no tempo da música: parado no início antes da hora, corre pelo caminho com
// velocidade constante e para no fim.
export function ringAt(note, songTime, out = {}) {
  pathAt(note, (songTime - note.t) / (note.t1 - note.t), out);
  out.z = -HIT_DIST;
  return out;
}

// Ponto i do caminho no espaço: a parte que ainda não chegou vem flutuando lá da frente.
export function ribbonPoint(note, i, songTime, speed, out = {}) {
  const P = note.path[i];
  const ti = note.t + (note.t1 - note.t) * i / (note.path.length - 1);
  const ahead = Math.max(0, ti - songTime) * speed;
  const far = Math.min(1, ahead / SPAWN_DIST);
  out.x = P[0];
  out.y = P[1] + RISE * far * far;
  out.z = -(HIT_DIST + ahead);
  out.ahead = ahead;
  return out;
}
