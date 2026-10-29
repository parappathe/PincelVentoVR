// Gerador do mapa de notas a partir dos eventos da música. Puro (sem navegador).
// Dois tipos de nota: 'gota' (pincelar através dela no sentido do traço) e 'faixa' (nota longa:
// manter a ponta do pincel dentro do anel que corre pelo caminho). As faixas saem das notas
// longas da flauta; as gotas, dos tempos de percussão e da melodia do koto.
// O mapa sai sempre igual para a mesma música e dificuldade (semente fixa).
import { rng, sectionAt } from './music.js';

// Direções do traço: 0 cima, 1 baixo, 2 esquerda, 3 direita, 4 cima-esq, 5 cima-dir,
// 6 baixo-esq, 7 baixo-dir. -1 = qualquer direção (gota com círculo ensō).
const S = Math.SQRT1_2;
export const DIR_VEC = [[0, 1], [0, -1], [-1, 0], [1, 0], [-S, S], [S, S], [-S, -S], [S, -S]];
export const OPPOSITE = [1, 0, 3, 2, 7, 6, 5, 4];
const MIRROR = [0, 1, 3, 2, 5, 4, 7, 6];
const NEIGHBORS = { 0: [4, 5], 1: [6, 7], 2: [4, 6], 3: [5, 7], 4: [0, 2], 5: [0, 3], 6: [1, 2], 7: [1, 3] };

export const LANES = [-0.45, -0.15, 0.15, 0.45];
export const ROWS = [0.9, 1.18, 1.46];
export const SHAPES = ['reta', 'arco', 'onda', 'subida', 'descida', 'S', 'espiral'];

// grid: menor divisão (batidas); gapAny: intervalo mínimo entre gotas; gapHand: mínimo para
// a mesma mão; keep: chance de usar um tempo candidato; speed: velocidade das notas (m/s).
// Faixas: hold = chance de usar uma nota longa da flauta; holdMax = batidas no máximo;
// holdDouble = chance de faixa nas duas mãos ao mesmo tempo; holdFree = a outra mão pode ter
// gotas durante a faixa; ringSpeed = velocidade média do anel (m/s), define o tamanho do desenho.
export const DIFFS = [
  { id: 'facil', name: 'Fácil', grid: 1, gapAny: 1, gapHand: 2, minAny: 0.7, minHand: 1.2, keep: 0.8, doubles: 0, dot: 0.4, diag: 0, speed: 6,
    hold: 0.45, holdMax: 2, holdDouble: 0, holdFree: false, ringSpeed: 0.38, shapes: ['reta', 'arco'] },
  { id: 'normal', name: 'Normal', grid: 0.5, gapAny: 0.5, gapHand: 1, minAny: 0.33, minHand: 0.6, keep: 0.62, doubles: 0.1, dot: 0.15, diag: 0.25, speed: 7.5,
    hold: 0.7, holdMax: 4, holdDouble: 0, holdFree: true, ringSpeed: 0.5, shapes: ['reta', 'arco', 'onda', 'subida', 'descida', 'S'] },
  { id: 'dificil', name: 'Difícil', grid: 0.5, gapAny: 0.5, gapHand: 0.5, minAny: 0.22, minHand: 0.34, keep: 0.85, doubles: 0.2, dot: 0.05, diag: 0.4, speed: 9,
    hold: 0.85, holdMax: 4, holdDouble: 0.35, holdFree: true, ringSpeed: 0.62, shapes: SHAPES },
];

// Folga (s) entre uma faixa e qualquer outra nota da mesma mão.
export const HOLD_GAP_S = 0.5;

const WEIGHT = { taiko: 3, shime: 3, kane: 2, hyoshi: 1, lead: 2 };

export function makeChart(comp, diffIndex, opts = {}) {
  const diff = DIFFS[diffIndex];
  const song = comp.song;
  const r = rng((song.seed || 1) * 31 + diffIndex * 7 + 3);
  const weights = { ...WEIGHT, ...(song.chartWeights || {}) };
  const startBeat = song.chartStart ?? 8;
  const endBeat = comp.totalBeats - (song.chartEndGap ?? 4);
  const gapAny = Math.max(diff.gapAny, diff.minAny / comp.spb);
  const gapHand = Math.max(diff.gapHand, diff.minHand / comp.spb);
  const holdGap = Math.max(gapHand, HOLD_GAP_S / comp.spb);

  // ---- 1. Faixas de vento: notas longas da flauta. ----
  const faixas = [];
  const windows = [[], []]; // [b0, b1] de cada faixa, por mão
  const freeFor = (h, b0, b1) => windows[h].every(([s, f]) => b0 >= f + holdGap - 1e-6 || b1 <= s - holdGap + 1e-6);
  let holdHand = 1;
  for (const e of comp.events) {
    if (e.part !== 'flute' || e.b < startBeat) continue;
    const len = Math.min(diff.holdMax, Math.max(1, Math.round(e.hold ?? e.dur)));
    const b0 = e.b, b1 = b0 + len;
    if (b1 > endBeat) continue;
    if (sectionAt(comp, b0).energy <= 0.05) continue;
    if (r() > diff.hold) continue;
    let hands;
    if (diff.holdDouble > 0 && len >= 2 && freeFor(0, b0, b1) && freeFor(1, b0, b1) && r() < diff.holdDouble) hands = [0, 1];
    else {
      // Fora o Difícil (duplas), nunca há duas faixas ao mesmo tempo.
      if (!freeFor(0, b0, b1) || !freeFor(1, b0, b1)) continue;
      hands = [holdHand];
      holdHand = 1 - holdHand;
    }
    const shape = diff.shapes[Math.floor(r() * diff.shapes.length)];
    const flipX = r() < 0.5, flipY = r() < 0.5;
    const seed = Math.floor(r() * 1e6);
    for (const h of hands) {
      faixas.push({ kind: 'faixa', b: b0, b1, t: b0 * comp.spb, t1: b1 * comp.spb, hand: h, shape, flipX, flipY, seed,
        double: hands.length === 2, energy: sectionAt(comp, b0).energy });
      windows[h].push([b0, b1]);
    }
  }

  // Uma mão nunca tem gota durante (nem colada) na própria faixa. No Fácil, nenhuma gota
  // durante qualquer faixa.
  const holdFreeFor = (h, b) => {
    const list = diff.holdFree ? windows[h] : windows[0].concat(windows[1]);
    return list.every(([s, f]) => b <= s - holdGap + 1e-6 || b >= f + holdGap - 1e-6);
  };

  // ---- 2. Gotas: tempos onde a percussão ou o koto batem, no grid da dificuldade. ----
  const cand = new Map();
  for (const e of comp.events) {
    const w = weights[e.part];
    if (!w || e.b < startBeat || e.b > endBeat) continue;
    const q = Math.round(e.b / diff.grid) * diff.grid;
    if (Math.abs(q - e.b) > 1e-6) continue;
    cand.set(q, (cand.get(q) || 0) + w * e.vel + (q % 1 === 0 ? 1 : 0));
  }
  const beats = [...cand.keys()].sort((a, b) => a - b);

  const gotas = [];
  const lastHand = [-99, -99];
  const prevDir = [0, 0];
  let last = -99;
  let nextHand = 1;
  for (const b of beats) {
    const sec = sectionAt(comp, b);
    const e = sec.energy;
    if (e <= 0.05) continue;
    const w = cand.get(b);
    if (b - last < gapAny - 1e-6) continue;
    const forced = b - last >= 4 && e >= 0.4;
    const p = diff.keep * (0.3 + 0.7 * e) * (w >= 4 ? 1.25 : w >= 3 ? 1 : 0.7);
    if (!forced && r() > p) continue;

    const okHand = (h) => b - lastHand[h] >= gapHand - 1e-6 && holdFreeFor(h, b);
    let hands;
    if (diff.doubles > 0 && w >= 4 && okHand(0) && okHand(1) && r() < diff.doubles * (0.5 + e)) hands = [0, 1];
    else {
      let h = nextHand;
      if (r() < 0.18) h = 1 - h;
      if (!okHand(h)) h = 1 - h;
      if (!okHand(h)) continue;
      hands = [h];
    }

    const double = hands.length === 2;
    let dirR = null;
    for (const h of hands) {
      let dir;
      if (double) {
        if (dirR === null) dirR = OPPOSITE[prevDir[1]] === 0 || OPPOSITE[prevDir[1]] === 1 ? OPPOSITE[prevDir[1]] : 1;
        dir = h === 1 ? dirR : MIRROR[dirR];
      } else {
        dir = OPPOSITE[prevDir[h]];
        if (diffIndex === 0 && dir > 3) dir = dir < 6 ? 0 : 1;
        if (r() < diff.diag) dir = NEIGHBORS[dir][Math.floor(r() * 2)];
        if (diffIndex === 0 && dir > 1 && r() < 0.7) dir = prevDir[h] === 1 ? 0 : 1;
      }
      prevDir[h] = dir;
      const dot = !double && r() < diff.dot;
      const up = dir === 0 || dir === 4 || dir === 5;
      const down = dir === 1 || dir === 6 || dir === 7;
      const row = up ? (r() < 0.6 ? 0 : 1) : down ? (r() < 0.6 ? 2 : 1) : 1;
      let lane = h === 0 ? (r() < 0.5 ? 0 : 1) : (r() < 0.5 ? 3 : 2);
      if (dir === 2 && h === 1) lane = 3;
      if (dir === 3 && h === 0) lane = 0;
      gotas.push({ kind: 'gota', b, t: b * comp.spb, hand: h, dir: dot ? -1 : dir, lane, row, x: LANES[lane], y: ROWS[row], energy: e });
      lastHand[h] = b;
    }
    last = b;
    nextHand = 1 - hands[hands.length - 1];
  }

  const notes = gotas.concat(faixas).sort((a, b) => a.t - b.t || a.hand - b.hand);
  notes.forEach((n, i) => { n.id = i; });
  return { diff, notes, gapHand, holdGap, lead: (opts.spawnDist ?? 14) / diff.speed };
}

// Mapa para o PC (um pincel só, que vale pelas duas cores): tira faixas que se sobrepõem e
// gotas que caem durante uma faixa (o mouse não estaria livre para elas).
export function soloChart(chart, gapS = 0.4) {
  const kept = [];
  const busy = [];
  for (const n of chart.notes) {
    if (n.kind !== 'faixa') continue;
    if (busy.some(([s, f]) => n.t < f + gapS && n.t1 > s - gapS)) continue;
    busy.push([n.t, n.t1]);
    kept.push(n);
  }
  const notes = chart.notes.filter(n => n.kind === 'faixa' ? kept.includes(n)
    : busy.every(([s, f]) => n.t <= s - gapS || n.t >= f + gapS)).map(n => ({ ...n }));
  notes.forEach((n, i) => { n.id = i; });
  return { ...chart, notes, solo: true };
}
