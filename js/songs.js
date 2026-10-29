// As músicas do Pincel do Vento, compostas pelo próprio jogo (escalas pentatônicas japonesas).
// Cada seção: compassos, energia (0..1, define a densidade das notas e da percussão) e as partes
// que tocam. Partes: taiko, shime (tambor pequeno), kane (sininho), hyoshi (batida de madeira),
// bass (koto grave), arp (koto dedilhado), lead (melodia de koto), flute (shakuhachi: as notas
// longas viram as faixas de vento), pad (fundo suave).
// Os timbres (sound) são presets do sintetizador (js/synth.js); kit troca os tambores.

const KOTO = { wave: 'triangle', attack: 0.002, decay: 0.28, sustain: 0, release: 0.25, cutoff: 3200, env: 2200, slide: 0.982, vol: 0.13 };
const KOTO_ARP = { ...KOTO, decay: 0.2, vol: 0.075, echo: 0.3 };
const KOTO_BASS = { wave: 'triangle', attack: 0.003, decay: 0.45, sustain: 0.12, release: 0.3, cutoff: 900, env: 700, slide: 0.99, vol: 0.26 };
const SHAKU = { wave: 'sine', attack: 0.09, decay: 0.4, sustain: 0.8, release: 0.35, cutoff: 3000, vibrato: 5, vibDelay: 0.35, breath: 0.06, vol: 0.11, echo: 0.25 };
const PAD = { wave: 'triangle', voices: 2, detune: 8, attack: 0.9, release: 1.2, decay: 1, sustain: 0.8, cutoff: 1100, vol: 0.035 };

export const SONGS = [
  {
    id: 'nevoa', name: 'Névoa da Manhã', desc: 'Calma · 80 BPM', bpm: 80, seed: 41,
    root: 50, scale: 'pentaMinor', progression: [0, 3, 1, 0], leadDensity: 0.4, fillPart: 'shime',
    drums: {
      taiko: ['x...............', 'x.......x.......', 'x.......x...x...'],
      shime: ['........x.......', '....x.......x...', '....x...x.x.x...'],
      kane: ['x...............', 'x.......x.......'],
      hyoshi: ['............x...'],
      crash: 'x',
    },
    bass: ['x---------------', 'x-------x-------', 'x-----o-x-------'],
    sound: { bass: KOTO_BASS, arp: KOTO_ARP, lead: KOTO, flute: SHAKU, pad: PAD },
    sections: [
      { name: 'névoa', bars: 2, energy: 0.25, parts: ['pad', 'kane'] },
      { name: 'primeiro sopro', bars: 8, energy: 0.45, parts: ['taiko', 'kane', 'bass', 'pad', 'flute'] },
      { name: 'koto', bars: 6, energy: 0.6, parts: ['taiko', 'shime', 'kane', 'bass', 'arp', 'lead'] },
      { name: 'montanha', bars: 8, energy: 0.75, parts: ['taiko', 'shime', 'hyoshi', 'kane', 'bass', 'flute', 'pad', 'lead'] },
      { name: 'orvalho', bars: 4, energy: 0.5, parts: ['taiko', 'kane', 'arp', 'flute', 'pad'] },
      { name: 'sol', bars: 4, energy: 0.3, parts: ['pad', 'kane', 'bass'] },
    ],
  },
  {
    id: 'folha', name: 'Folha ao Vento', desc: 'Média · 100 BPM', bpm: 100, seed: 57,
    root: 52, scale: 'inSen', progression: [0, 2, 3, 1], leadDensity: 0.5, fillPart: 'shime',
    drums: {
      taiko: ['x.......x.......', 'x.......x...x...', 'x..x....x...x.x.'],
      shime: ['....x.......x...', '....x.......x.x.', '..x.x...x.x.x.xx'],
      kane: ['x...............', 'x.......x.......', 'x...x...x...x...'],
      hyoshi: ['............x...', '....x.......x...'],
      crash: 'x',
    },
    bass: ['x-------x-------', 'x---o---x---o---', 'x-o-x-o-x-o-x-5-'],
    sound: { bass: KOTO_BASS, arp: KOTO_ARP, lead: { ...KOTO, vol: 0.12 }, flute: SHAKU, pad: PAD },
    sections: [
      { name: 'galho', bars: 2, energy: 0.3, parts: ['pad', 'kane', 'arp'] },
      { name: 'primeira folha', bars: 8, energy: 0.5, parts: ['taiko', 'shime', 'kane', 'bass', 'arp', 'flute'] },
      { name: 'redemoinho de folhas', bars: 8, energy: 0.75, parts: ['taiko', 'shime', 'hyoshi', 'kane', 'bass', 'lead', 'pad'] },
      { name: 'planando', bars: 4, energy: 0.4, parts: ['pad', 'flute', 'kane'] },
      { name: 'ventania', bars: 8, energy: 0.9, parts: ['taiko', 'shime', 'hyoshi', 'kane', 'bass', 'flute', 'lead', 'arp'] },
      { name: 'pouso', bars: 4, energy: 0.45, parts: ['taiko', 'pad', 'flute', 'kane'] },
      { name: 'chão', bars: 2, energy: 0.25, parts: ['pad', 'kane'] },
    ],
  },
  {
    id: 'dragao', name: 'Dragão de Tinta', desc: 'Animada · 125 BPM', bpm: 125, seed: 73,
    root: 45, scale: 'inSen', progression: [0, 3, 2, 4], leadDensity: 0.6, fillPart: 'shime', fluteOct: 24,
    kit: {
      taiko: { tone: { f0: 120, f1: 50, dur: 0.55, vol: 1 }, noise: { type: 'lowpass', f: 380, q: 0.7, dur: 0.12, vol: 0.4 } },
    },
    drums: {
      taiko: ['x.......x.......', 'x...x...x...x...', 'x..x..x.x.x.x..x'],
      shime: ['....x.......x...', '..x.x..x..x.x...', 'oxoxxoxoxxoxxoxx'],
      kane: ['x.......x.......', 'x...x...x...x...', 'x.o.x.o.x.o.x.o.'],
      hyoshi: ['....x.......x...', '....x.......x..x'],
      crash: 'x',
    },
    bass: ['x-o-x-o-x-o-x-o-', 'x.o.x.o.x.o.x.o.', 'xxo.xxo.xxo.x5o.'],
    sound: {
      bass: { ...KOTO_BASS, vol: 0.28 }, arp: { ...KOTO_ARP, vol: 0.07 }, lead: { ...KOTO, vol: 0.12, echo: 0.2 },
      flute: { ...SHAKU, vol: 0.12, vibrato: 6 }, pad: PAD,
    },
    sections: [
      { name: 'ovo', bars: 4, energy: 0.35, parts: ['taiko', 'pad', 'kane'] },
      { name: 'despertar', bars: 8, energy: 0.6, parts: ['taiko', 'shime', 'kane', 'bass', 'arp', 'flute'] },
      { name: 'voo', bars: 8, energy: 0.85, parts: ['taiko', 'shime', 'hyoshi', 'kane', 'bass', 'lead', 'pad'] },
      { name: 'nuvem', bars: 4, energy: 0.45, parts: ['pad', 'flute', 'kane', 'arp'] },
      { name: 'fúria', bars: 8, energy: 1, parts: ['taiko', 'shime', 'hyoshi', 'kane', 'bass', 'flute', 'lead'] },
      { name: 'escamas', bars: 8, energy: 0.8, parts: ['taiko', 'shime', 'kane', 'bass', 'arp', 'flute', 'pad'] },
      { name: 'céu limpo', bars: 4, energy: 0.6, parts: ['taiko', 'hyoshi', 'bass', 'lead', 'kane'] },
      { name: 'repouso', bars: 4, energy: 0.3, parts: ['pad', 'kane'] },
    ],
  },
];
