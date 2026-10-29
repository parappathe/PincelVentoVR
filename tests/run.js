// Testes automáticos (Node, sem navegador e sem som): node tests/run.js
import { compose } from '../js/music.js';
import { makeChart, soloChart, DIFFS, OPPOSITE, SHAPES } from '../js/chart.js';
import { judgeCut, robotBlade, ScoreKeeper, MISS_AFTER, RING_R } from '../js/judge.js';
import { decorate, notePos, ringAt, FRAME, SPAWN_DIST, HIT_DIST, BOUNDS } from '../js/mode.js';
import { Round, robotPose } from '../js/play.js';
import { SONGS } from '../js/songs.js';

let fails = 0, count = 0;
function check(cond, msg) { count++; if (!cond) { fails++; console.log('  FALHOU:', msg); } }

const FPS = 90;

// Passada isolada do robô por uma gota (de u=-1 a u=1 em `dur` segundos, centrada no tempo dela).
function swing(n, chart, { dir = n.dir, hand = n.hand, dur = 0.1, reach = 0.32, offset = 0 } = {}) {
  const t0 = n.t - dur / 2 + offset;
  const at = notePos(n, n.t, chart.diff.speed);
  let prev = null;
  for (let k = 0; k <= Math.ceil(dur * FPS); k++) {
    const time = t0 + k / FPS;
    const c = notePos(n, time, chart.diff.speed);
    const u = Math.max(-1, Math.min(1, (time - t0) / dur * 2 - 1));
    const cur = robotBlade(at, FRAME, dir, u, reach);
    if (prev) {
      const res = judgeCut(n, c, FRAME, { base0: prev.base, tip0: prev.tip, base1: cur.base, tip1: cur.tip, dt: 1 / FPS, hand });
      if (res) return res;
    }
    prev = cur;
  }
  return null;
}

// Partida inteira quadro a quadro com a mesma lógica do navegador (Round). pose(hand, st) dá
// o pincel de cada mão.
function simulate(chart, comp, pose, { solo = false, from = null, to = null } = {}) {
  const round = new Round(chart, comp, { solo });
  const start = from ?? -chart.lead, end = to ?? comp.duration + 1;
  const prev = [null, null];
  const counts = { cut: 0, wrong: 0, miss: 0, break: 0, done: 0, tick: 0 };
  const steps = Math.ceil((end - start) * FPS);
  for (let k = 0; k <= steps; k++) {
    const st = start + k / FPS;
    const brushes = [0, 1].map(h => {
      const p = pose(h, st);
      const b = { hand: h, valid: !!prev[h] && !!p, base0: prev[h]?.base, tip0: prev[h]?.tip, base1: p?.base, tip1: p?.tip, dt: 1 / FPS };
      prev[h] = p;
      return b;
    });
    for (const e of round.step(st, 1 / FPS, brushes)) counts[e.type]++;
  }
  return { round, sk: round.sk, counts };
}

const robot = (chart) => (h, st) => robotPose(chart, h, st);
const summary = [];
let doublesHard = 0;

for (const song of SONGS) {
  console.log(`Música: ${song.name}`);
  const comp = compose(song);
  const comp2 = compose(song);
  check(JSON.stringify(comp.events) === JSON.stringify(comp2.events), 'composição sempre igual');
  check(comp.events.length > 300, `poucos eventos (${comp.events.length})`);
  check(comp.duration > 55 && comp.duration < 130, `duração ${comp.duration.toFixed(0)} s fora de 55..130`);
  check(comp.events.every(e => e.b >= 0 && e.b <= comp.totalBeats && e.dur > 0), 'eventos dentro da música');
  check(comp.events.some(e => e.part === 'flute' && e.hold >= 2), 'flauta tem notas longas');

  let prevCount = 0;
  for (let d = 0; d < DIFFS.length; d++) {
    const chart = decorate(makeChart(comp, d), comp, d);
    const chart2 = decorate(makeChart(comp, d), comp, d);
    check(JSON.stringify(chart.notes) === JSON.stringify(chart2.notes), 'mapa sempre igual');
    const notes = chart.notes;
    const diff = DIFFS[d];
    const gotas = notes.filter(n => n.kind === 'gota'), faixas = notes.filter(n => n.kind === 'faixa');
    const nps = notes.length / comp.duration;
    console.log(`  ${diff.name}: ${notes.length} notas = ${gotas.length} gotas + ${faixas.length} faixas (${nps.toFixed(2)}/s)`);
    summary.push(`${song.name} ${diff.name}: ${gotas.length} gotas + ${faixas.length} faixas`);
    check(gotas.length >= 30, `${diff.name}: poucas gotas`);
    check(faixas.length >= 3, `${diff.name}: poucas faixas (${faixas.length})`);
    check(nps < [1.4, 2.4, 3.6][d], `${diff.name}: notas demais (${nps.toFixed(2)}/s)`);
    check(notes.length > prevCount, `${diff.name} tem que ter mais notas que a dificuldade anterior`);
    prevCount = notes.length;
    check(notes.every((n, i) => n.id === i), `${diff.name}: ids fora de ordem`);
    check(notes.every((n, i) => i === 0 || n.t >= notes[i - 1].t), `${diff.name}: notas fora de ordem`);

    // Gotas: intervalo por mão e posição.
    const lastHand = [-99, -99];
    let gapOk = true, posOk = true;
    for (const n of gotas) {
      if (n.b - lastHand[n.hand] < chart.gapHand - 1e-6) gapOk = false;
      lastHand[n.hand] = n.b;
      if (!(n.y >= 0.85 && n.y <= 1.5 && Math.abs(n.x) <= 0.5)) posOk = false;
      if (n.t - chart.lead < 0.5) posOk = false;
    }
    check(gapOk, `${diff.name}: mesma mão rápido demais`);
    check(posOk, `${diff.name}: posição de gota inválida`);
    const n0 = gotas[0];
    check(-notePos(n0, n0.t - chart.lead, diff.speed).z > SPAWN_DIST * 0.95, `${diff.name}: gota nasce perto demais`);
    check(Math.abs(notePos(n0, n0.t, diff.speed).z + HIT_DIST) < 1e-9, `${diff.name}: gota não chega no plano do pincel`);

    // Faixas: duração, forma, caminho ao alcance e do lado da mão, velocidade do anel.
    let durOk = true, pathOk = true, sideOk = true, speedOk = true, shapeOk = true, handFree = true, overlapOk = true;
    for (const f of faixas) {
      const beats = f.b1 - f.b;
      if (beats < 1 - 1e-9 || beats > diff.holdMax + 1e-9) durOk = false;
      if (!diff.shapes.includes(f.shape) || !SHAPES.includes(f.shape)) shapeOk = false;
      for (const [x, y] of f.path) {
        if (!(y >= 0.7 && y <= 1.6 && Math.abs(x) <= 0.6 + 1e-9)) pathOk = false;
        if (f.hand === 0 ? x > -BOUNDS.inner + 1e-9 : x < BOUNDS.inner - 1e-9) sideOk = false;
      }
      if (f.length / (f.t1 - f.t) > 1.2) speedOk = false;
      // Mesma mão: nenhuma gota durante a faixa nem colada nela.
      const gapS = chart.holdGap * comp.spb;
      for (const g of gotas) {
        if ((diff.holdFree ? g.hand === f.hand : true) && g.t > f.t - gapS + 1e-6 && g.t < f.t1 + gapS - 1e-6) handFree = false;
      }
      for (const o of faixas) {
        if (o === f || o.t >= f.t1 || o.t1 <= f.t) continue;
        if (o.hand === f.hand || !(f.double && o.double && o.t === f.t)) overlapOk = false;
      }
    }
    check(durOk, `${diff.name}: faixa com duração fora de 1..${diff.holdMax} batidas`);
    check(shapeOk, `${diff.name}: forma de faixa não permitida`);
    check(pathOk, `${diff.name}: caminho fora do alcance (0,7..1,6 m, |x| ≤ 0,6)`);
    check(sideOk, `${diff.name}: faixa do lado errado`);
    check(speedOk, `${diff.name}: anel rápido demais`);
    check(handFree, `${diff.name}: gota na mão que está numa faixa${diff.holdFree ? '' : ' (Fácil: nenhuma gota durante faixa)'}`);
    check(overlapOk, `${diff.name}: faixas sobrepostas sem ser dupla`);
    const dbl = faixas.filter(f => f.double).length;
    if (d < 2) check(dbl === 0, `${diff.name}: faixa dupla fora do Difícil`);
    else doublesHard += dbl;
    // Dupla é espelhada.
    for (const f of faixas.filter(x => x.double && x.hand === 0)) {
      const g = faixas.find(x => x.double && x.hand === 1 && x.t === f.t);
      check(g && f.path.every((p, i) => Math.abs(p[0] + g.path[i][0]) < 1e-9 && Math.abs(p[1] - g.path[i][1]) < 1e-9), `${diff.name}: dupla não espelhada`);
    }
    // Anel: parado no início antes da hora, no fim depois.
    const f0 = faixas[0];
    const rs = ringAt(f0, f0.t - 0.3), re = ringAt(f0, f0.t1 + 0.3);
    check(Math.hypot(rs.x - f0.path[0][0], rs.y - f0.path[0][1]) < 1e-9 && Math.hypot(re.x - f0.path.at(-1)[0], re.y - f0.path.at(-1)[1]) < 1e-9, `${diff.name}: anel fora do caminho`);

    // Robô joga a música inteira (mesma lógica do navegador) e acerta tudo.
    const sim = simulate(chart, comp, robot(chart));
    const { sk, counts } = sim;
    check(counts.cut === gotas.length, `${diff.name}: robô pincelou ${counts.cut} de ${gotas.length} gotas`);
    check(counts.done === faixas.length, `${diff.name}: robô completou ${counts.done} de ${faixas.length} faixas`);
    check(counts.wrong === 0 && counts.miss === 0 && counts.break === 0, `${diff.name}: robô errou (errado ${counts.wrong}, perdeu ${counts.miss}, quebrou ${counts.break})`);
    check(sk.hits === notes.length && sk.maxCombo === notes.length, `${diff.name}: sequência do robô ${sk.maxCombo} de ${notes.length}`);
    check(sk.rank === 'S', `${diff.name}: robô tirou ${sk.rank}`);
    check(sim.round.finished, `${diff.name}: partida não terminou`);

    // Gotas: traço errado não vale.
    const withDir = gotas.filter(n => n.dir >= 0).slice(0, 20);
    check(withDir.every(n => swing(n, chart, { dir: OPPOSITE[n.dir] })?.reason === 'direcao'), `${diff.name}: traço no sentido oposto foi aceito`);
    check(gotas.slice(0, 20).every(n => swing(n, chart, { hand: 1 - n.hand })?.reason === 'mao'), `${diff.name}: pincel da cor errada foi aceito na gota`);
    check(gotas.slice(0, 20).every(n => !swing(n, chart, { dur: 1.2, reach: 0.25 })?.ok), `${diff.name}: pincel devagar valeu`);
    check(gotas.slice(0, 20).every(n => !swing(n, chart, { offset: MISS_AFTER + 0.25 })?.ok), `${diff.name}: traço muito atrasado valeu`);

    // Faixas: testes da mecânica, uma faixa por vez (só ela no mapa).
    const long = faixas.find(f => f.t1 - f.t >= 0.9) || faixas[0];
    const only = { ...chart, notes: [{ ...long, id: 0 }] };
    const win = { from: long.t - 0.5, to: long.t1 + 0.3 };
    const fdur = long.t1 - long.t;
    const away = (dx, a, b) => (h, st) => {
      const p = robotPose(only, h, st);
      if (st < long.t + a || st > long.t + b) return p;
      const m = (q) => ({ x: q.x + dx, y: q.y, z: q.z });
      return { base: m(p.base), tip: m(p.tip) };
    };
    {
      const s = simulate(only, comp, robot(only), win);
      check(s.counts.done === 1 && s.counts.break === 0 && s.counts.tick === (long.b1 - long.b) * 2, `${diff.name}: faixa sozinha com o robô (${JSON.stringify(s.counts)})`);
    }
    {
      const s = simulate(only, comp, away(RING_R + 0.1, fdur * 0.3, fdur * 0.3 + 0.4), win);
      check(s.counts.break === 1 && s.counts.done === 0 && s.sk.misses === 1 && s.sk.combo === 0, `${diff.name}: sair do anel por 0,4 s tem que quebrar (uma vez)`);
    }
    {
      const s = simulate(only, comp, away(RING_R + 0.1, fdur * 0.3, fdur * 0.3 + 0.15), win);
      check(s.counts.break === 0 && s.counts.done === 1, `${diff.name}: escapada de 0,15 s não pode quebrar`);
    }
    {
      // Pincel da outra cor fazendo o caminho certo: não conta.
      const swapped = (h, st) => robotPose(only, 1 - h, st);
      const s = simulate(only, comp, swapped, win);
      check(s.counts.tick === 0 && s.counts.done === 0 && s.counts.break === 1, `${diff.name}: pincel da cor errada contou na faixa`);
      // No PC (um pincel só, vale pelas duas cores) conta.
      const s2 = simulate(only, comp, swapped, { ...win, solo: true });
      check(s2.counts.done === 1, `${diff.name}: no PC o pincel único tem que valer na faixa`);
    }

    // Mapa do PC: sem faixas sobrepostas e sem gotas durante faixas.
    const solo = soloChart(chart);
    const sf = solo.notes.filter(n => n.kind === 'faixa');
    check(sf.every((f, i) => i === 0 || f.t >= sf[i - 1].t1 + 0.4 - 1e-9), `${diff.name}: mapa do PC com faixas sobrepostas`);
    check(solo.notes.every(g => g.kind !== 'gota' || sf.every(f => g.t <= f.t - 0.4 + 1e-9 || g.t >= f.t1 + 0.4 - 1e-9)), `${diff.name}: mapa do PC com gota durante faixa`);
    check(sf.length >= 3 && solo.notes.every((n, i) => n.id === i), `${diff.name}: mapa do PC inválido`);
  }
}
check(doublesHard > 0, 'Difícil precisa ter faixas nas duas mãos ao mesmo tempo às vezes');

// Placar.
{
  const sk = new ScoreKeeper(10);
  for (let i = 0; i < 10; i++) sk.hit(100);
  check(sk.score === sk.maxScore && sk.rank === 'S', 'placar perfeito = S');
  const sk2 = new ScoreKeeper(30);
  for (let i = 0; i < 6; i++) sk2.miss();
  check(sk2.failed, 'errar várias seguidas perde');
  const sk3 = new ScoreKeeper(30, { noFail: true });
  for (let i = 0; i < 20; i++) sk3.miss();
  check(!sk3.failed, 'modo sem derrota não perde');
}

console.log('\nResumo:\n  ' + summary.join('\n  '));
console.log(fails ? `\n${fails} de ${count} verificações FALHARAM` : `\nTudo certo (${count} verificações)`);
process.exit(fails ? 1 : 0);
