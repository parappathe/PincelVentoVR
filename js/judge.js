// Juiz do pincel (gotas e faixas) e placar. Puro (sem navegador): vetores são objetos {x, y, z}.
import { DIR_VEC } from './chart.js';

export const NOTE_R = 0.2;       // raio de acerto da gota (m), um pouco maior que o desenho
export const MIN_SPEED = 1.0;    // velocidade mínima do pincel para valer (m/s)
export const DIR_COS = 0.42;     // tolerância da direção (~65°)
export const MISS_AFTER = 0.14;  // segundos depois do tempo da nota em que ela conta como perdida
export const RING_R = 0.12;      // raio do anel da faixa (m)
export const RING_DEPTH = 0.22;  // folga na profundidade (m) para a ponta contar dentro do anel
export const BREAK_AFTER = 0.25; // fora do anel por mais que isso (s) quebra a sequência
export const TICK_PTS = 15;      // pontos a cada meia batida dentro do anel
export const BRUSH_LEN = 0.4;    // trecho do pincel que pinta: do cabo (0,05 m) à ponta (0,45 m)

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const lerpV = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

export function distPointSeg(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const L = dot(ab, ab);
  const t = L > 0 ? Math.max(0, Math.min(1, dot(ap, ab) / L)) : 0;
  const q = lerpV(a, b, t);
  const d = sub(p, q);
  return Math.sqrt(dot(d, d));
}

// Menor distância entre o centro c e a área varrida pela lâmina entre dois quadros.
export function sweepDist(c, base0, tip0, base1, tip1) {
  const dtip = sub(tip1, tip0);
  const n = Math.min(24, 2 + Math.ceil(Math.sqrt(dot(dtip, dtip)) / 0.04));
  let best = Infinity;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const d = distPointSeg(c, lerpV(base0, base1, t), lerpV(tip0, tip1, t));
    if (d < best) best = d;
  }
  return best;
}

// Testa um corte. frame = { right: {x,y,z}, up: {x,y,z} } da nota (plano de frente para o
// jogador). saber = { base0, tip0, base1, tip1, dt, hand } (hand -1 = serve para as duas).
// Retorna null (não encostou ou foi fraco) ou { ok, reason, points, cutDir:[x,y] }.
export function judgeCut(note, center, frame, saber, opts = {}) {
  const radius = opts.radius ?? NOTE_R;
  const d = sweepDist(center, saber.base0, saber.tip0, saber.base1, saber.tip1);
  if (d > radius) return null;
  // Velocidade no ponto da lâmina mais perto da nota (média entre a ponta e o meio).
  const v0 = lerpV(saber.base0, saber.tip0, 0.75), v1 = lerpV(saber.base1, saber.tip1, 0.75);
  const v = sub(v1, v0);
  const dt = Math.max(1e-4, saber.dt);
  const vx = dot(v, frame.right) / dt, vy = dot(v, frame.up) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed < (opts.minSpeed ?? MIN_SPEED)) return null;
  const cut = [vx / speed, vy / speed];
  if (note.hand >= 0 && saber.hand >= 0 && note.hand !== saber.hand) return { ok: false, reason: 'mao', points: 0, cutDir: cut };
  let align = 1;
  if (note.dir >= 0) {
    const want = DIR_VEC[note.dir];
    align = cut[0] * want[0] + cut[1] * want[1];
    if (align < DIR_COS) return { ok: false, reason: 'direcao', points: 0, cutDir: cut };
  }
  const sQ = Math.min(1, (speed - MIN_SPEED) / 2.2);
  const aQ = note.dir >= 0 ? (align - DIR_COS) / (1 - DIR_COS) : 1;
  // Centro: quão longe do meio da gota passa a linha do traço da ponta (no plano da gota).
  const off = sub(center, saber.tip1);
  const ox = dot(off, frame.right), oy = dot(off, frame.up);
  const perp = Math.abs(cut[0] * oy - cut[1] * ox);
  const cQ = 1 - Math.min(1, perp / radius);
  const points = Math.round(45 + 25 * sQ + 15 * aQ + 15 * cQ);
  return { ok: true, reason: 'ok', points, cutDir: cut, speed };
}

export const MULT_STEPS = [0, 8, 16, 32]; // combo para chegar a x2, x3, x4

export class ScoreKeeper {
  constructor(total, { noFail = false, max = null } = {}) {
    this.total = total;
    this.max = max;
    this.noFail = noFail;
    this.score = 0; this.hits = 0; this.misses = 0; this.bad = 0; this.bombs = 0;
    this.combo = 0; this.maxCombo = 0; this.points = 0;
    this.health = 0.6;
    this.failed = false;
  }
  get mult() { let m = 1; for (let i = 1; i < MULT_STEPS.length; i++) if (this.combo >= MULT_STEPS[i]) m = i + 1; return m; }
  get judged() { return this.hits + this.misses + this.bad; }
  get accuracy() { return this.judged ? this.points / (100 * this.judged) : 1; }
  // Pontuação máxima possível: todas as notas com 100 pontos e o multiplicador subindo.
  get maxScore() {
    if (this.max) return this.max;
    let s = 0;
    for (let i = 0; i < this.total; i++) { let m = 1; for (let k = 1; k < MULT_STEPS.length; k++) if (i >= MULT_STEPS[k]) m = k + 1; s += 100 * m; }
    return s;
  }
  hit(points) {
    this.score += points * this.mult;
    this.points += points;
    this.hits++; this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.health = Math.min(1, this.health + 0.02);
  }
  // Pontos contínuos da faixa (não mexem na sequência nem na contagem de notas).
  tick(points) { this.score += points * this.mult; }
  _lose(amount) {
    this.combo = 0;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && !this.noFail) this.failed = true;
  }
  miss() { this.misses++; this._lose(0.12); }
  wrong() { this.bad++; this._lose(0.1); }
  bomb() { this.bombs++; this._lose(0.15); }
  get rank() {
    const r = this.score / Math.max(1, this.maxScore);
    return r >= 0.9 ? 'S' : r >= 0.8 ? 'A' : r >= 0.65 ? 'B' : r >= 0.5 ? 'C' : 'D';
  }
}

// Ponta do pincel dentro do anel da faixa?
export function insideRing(tip, ring) {
  return Math.hypot(tip.x - ring.x, tip.y - ring.y) <= RING_R && Math.abs(tip.z - ring.z) <= RING_DEPTH;
}

// Acompanha uma faixa: pontos a cada meia batida dentro do anel; fora por mais de BREAK_AFTER
// seguidos quebra a sequência (um erro, uma vez só). No fim, se não quebrou, vale como acerto.
export class HoldTracker {
  constructor(note, spb) {
    this.note = note;
    this.ticks = [];
    for (let b = note.b + 0.5; b <= note.b1 + 1e-6; b += 0.5) this.ticks.push(b * spb);
    this.nextTick = 0;
    this.out = 0;
    this.inTime = 0;
    this.time = 0;
    this.broken = false;
    this.finished = false;
    this.inside = false;
  }
  // Retorna a lista de acontecimentos deste quadro: 'tick', 'break', 'done'.
  step(st, dt, inside, sk) {
    const ev = [];
    const n = this.note;
    this.inside = inside;
    if (this.finished || st < n.t) return ev;
    while (this.nextTick < this.ticks.length && this.ticks[this.nextTick] <= st + 1e-9) {
      if (inside) { sk.tick(TICK_PTS); ev.push('tick'); }
      this.nextTick++;
    }
    const d = Math.min(dt, st - n.t);
    this.time += d;
    if (inside) { this.out = 0; this.inTime += d; } else this.out += d;
    if (!this.broken && this.out > BREAK_AFTER) { this.broken = true; sk.miss(); ev.push('break'); }
    if (st >= n.t1) {
      this.finished = true;
      if (!this.broken) {
        const frac = this.time > 0 ? Math.min(1, this.inTime / this.time) : 1;
        this.points = Math.round(60 + 40 * frac);
        sk.hit(this.points);
        ev.push('done');
      }
    }
    return ev;
  }
}

// Pontuação de uma partida perfeita (para a nota S/A): todos os acertos com 100 e todos os
// pontos das faixas, na ordem em que acontecem.
export function perfectScore(notes, spb) {
  const ev = [];
  for (const n of notes) {
    if (n.kind === 'faixa') {
      for (let b = n.b + 0.5; b <= n.b1 + 1e-6; b += 0.5) ev.push([b * spb, 0]);
      ev.push([n.t1, 1]);
    } else ev.push([n.t, 1]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const sk = new ScoreKeeper(notes.length);
  for (const [, hit] of ev) if (hit) sk.hit(100); else sk.tick(TICK_PTS);
  return sk.score;
}

const norm = (x, y, z) => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; };
const HOLD_BACK = [norm(-0.25, -0.4, 0.88), norm(0.25, -0.4, 0.88)]; // da ponta para o cabo, por mão
const SWING_BACK = norm(0, -0.45, 0.9);

// Robô: passada do pincel que atravessa a gota no centro, na direção pedida.
// Retorna {base, tip} (trecho que pinta) para a fase u (-1..1).
export function robotBlade(center, frame, dir, u, reach = 0.32) {
  const dv = dir >= 0 ? DIR_VEC[dir] : [0, -1];
  const ox = frame.right, oy = frame.up, f = frame.back;
  const s = u * reach;
  // A ponta passa 6 cm além do centro da gota (os pelos atravessam a tinta).
  const tip = {
    x: center.x + (ox.x * dv[0] + oy.x * dv[1]) * s - f.x * 0.06,
    y: center.y + (ox.y * dv[0] + oy.y * dv[1]) * s - f.y * 0.06,
    z: center.z + (ox.z * dv[0] + oy.z * dv[1]) * s - f.z * 0.06,
  };
  const b = SWING_BACK;
  const base = { x: tip.x + b.x * BRUSH_LEN, y: tip.y + b.y * BRUSH_LEN, z: tip.z + b.z * BRUSH_LEN };
  return { base, tip };
}

// Robô na faixa: ponta do pincel no centro do anel.
export function robotHold(ring, hand) {
  const b = HOLD_BACK[hand === 0 ? 0 : 1];
  const tip = { x: ring.x, y: ring.y, z: ring.z };
  return { base: { x: tip.x + b.x * BRUSH_LEN, y: tip.y + b.y * BRUSH_LEN, z: tip.z + b.z * BRUSH_LEN }, tip };
}
