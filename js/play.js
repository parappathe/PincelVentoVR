// Uma partida, sem navegador: decide a cada quadro o que os pincéis acertaram (gotas e faixas)
// e atualiza o placar. O main.js usa isto para jogar de verdade e os testes usam igual, com o
// robô (robotPose), para garantir que o que roda no navegador é o que foi testado.
import { judgeCut, ScoreKeeper, MISS_AFTER, HoldTracker, insideRing, perfectScore, robotBlade, robotHold } from './judge.js';
import { notePos, ringAt, FRAME } from './mode.js';

export const JUDGE_AHEAD = 0.35;   // a gota começa a ser testada este tempo (s) antes da hora
export const BUSY_BEFORE = 0.3;    // pincel "preso" na faixa desde este tempo antes do início...
export const BUSY_AFTER = 0.15;    // ...até este tempo depois do fim (não corta gotas nesse meio)

export class Round {
  // opts.solo: um pincel só que vale pelas duas cores (PC). opts.height: ajuste de altura.
  constructor(chart, comp, { solo = false, noFail = false, height = 0 } = {}) {
    this.chart = chart;
    this.comp = comp;
    this.solo = solo;
    this.height = height;
    this.notes = chart.notes;
    this.sk = new ScoreKeeper(this.notes.length, { noFail, max: perfectScore(this.notes, comp.spb) });
    this.state = this.notes.map(n => ({ done: false, result: null, hold: n.kind === 'faixa' ? new HoldTracker(n, comp.spb) : null }));
    this.next = 0;          // próxima nota a entrar na lista de vivas
    this.live = [];         // índices de notas em jogo
    this.cooldown = [0, 0];
    this._pos = {}; this._ring = {}; this._cut = { base0: null, tip0: null, base1: null, tip1: null, dt: 0, hand: 0 };
  }

  get finished() { return this.next >= this.notes.length && this.live.length === 0; }

  // O pincel desta mão está numa faixa agora (ou chegando nela)?
  busy(hand, st) {
    for (const i of this.live) {
      const n = this.notes[i];
      if (n.kind !== 'faixa' || (!this.solo && n.hand !== hand)) continue;
      if (st >= n.t - BUSY_BEFORE && st <= n.t1 + BUSY_AFTER) return true;
    }
    return false;
  }

  // brushes: [{ hand, valid, base0, tip0, base1, tip1, dt }] (base/tip = trecho que pinta,
  // 0 = quadro anterior, 1 = este). Retorna os acontecimentos do quadro para o cenário e o som.
  step(st, dt, brushes) {
    const ev = [];
    const sk = this.sk;
    while (this.next < this.notes.length && this.notes[this.next].t - (this.notes[this.next].kind === 'faixa' ? 1 : JUDGE_AHEAD) <= st) this.live.push(this.next++);
    for (let k = 0; k < 2; k++) this.cooldown[k] = Math.max(0, this.cooldown[k] - dt);
    const busyNow = brushes.map(b => this.busy(b.hand, st));

    for (const i of this.live) {
      const n = this.notes[i], S = this.state[i];
      if (S.done) continue;
      if (n.kind === 'gota') {
        const pos = notePos(n, st, this.chart.diff.speed, this._pos);
        pos.y += this.height;
        if (n.t - st < JUDGE_AHEAD) {
          for (let k = 0; k < brushes.length; k++) {
            const b = brushes[k];
            if (!b.valid || busyNow[k] || this.cooldown[k] > 0) continue;
            const c = this._cut;
            c.base0 = b.base0; c.tip0 = b.tip0; c.base1 = b.base1; c.tip1 = b.tip1; c.dt = b.dt;
            c.hand = this.solo ? -1 : b.hand;
            const res = judgeCut(n, pos, FRAME, c);
            if (!res) continue;
            S.done = true; S.result = res;
            if (res.ok) { sk.hit(res.points); ev.push({ type: 'cut', note: n, res, brush: k, pos: { ...pos } }); }
            else { sk.wrong(); this.cooldown[k] = 0.05; ev.push({ type: 'wrong', note: n, res, brush: k, pos: { ...pos } }); }
            break;
          }
        }
        if (!S.done && st > n.t + MISS_AFTER) { S.done = true; sk.miss(); ev.push({ type: 'miss', note: n, pos: { ...pos } }); }
      } else {
        const ring = ringAt(n, st, this._ring);
        ring.y += this.height;
        let inside = false, who = -1;
        for (let k = 0; k < brushes.length; k++) {
          const b = brushes[k];
          if (!b.valid || (!this.solo && b.hand !== n.hand)) continue;
          if (insideRing(b.tip1, ring)) { inside = true; who = k; break; }
        }
        for (const type of S.hold.step(st, dt, inside, sk)) ev.push({ type, note: n, brush: who, pos: { ...ring } });
        if (S.hold.finished) { S.done = true; S.result = S.hold; }
      }
    }
    // Tira da lista o que já acabou.
    this.live = this.live.filter(i => !this.state[i].done);
    return ev;
  }
}

// Robô: onde ficam o cabo e a ponta (trecho que pinta) do pincel desta mão no tempo st.
// Na faixa: ponta no centro do anel. Perto de uma gota: passada atravessando a gota.
// Senão: descansando do lado do corpo.
export function robotPose(chart, hand, st, height = 0) {
  for (const n of chart.notes) {
    if (n.t - 1.5 > st) break;
    if (n.kind !== 'faixa' || n.hand !== hand) continue;
    if (st >= n.t - 0.25 && st <= n.t1 + 0.04) {
      const ring = ringAt(n, st, {});
      ring.y += height;
      return robotHold(ring, hand);
    }
  }
  for (const n of chart.notes) {
    if (n.t - JUDGE_AHEAD > st) break;
    if (n.kind !== 'gota' || n.hand !== hand || n.t <= st - 0.06) continue;
    const at = notePos(n, n.t, chart.diff.speed, {});
    at.y += height;
    const u = Math.max(-1, Math.min(1, (st - (n.t - 0.05)) / 0.1 * 2 - 1));
    return robotBlade(at, FRAME, n.dir, u);
  }
  const sx = hand === 0 ? -1 : 1;
  return { base: { x: sx * 0.3, y: 0.85 + height, z: -0.1 }, tip: { x: sx * 0.42, y: 1.05 + height, z: -0.43 } };
}
