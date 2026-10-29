// Sintetizador e tocador das músicas (Web Audio, sem arquivos) + efeitos sonoros.
// O relógio da música é o relógio do áudio, para as notas baterem com o som.
// Sem áudio liberado (testes, painel escondido) o relógio é manual: main.js avança com tick().

// Percussão japonesa. tone = batida tonal (frequência caindo), noise = ruído filtrado,
// bell = sino (parciais inarmônicas de seno).
const KIT = {
  taiko: { tone: { f0: 105, f1: 48, dur: 0.6, vol: 0.95 }, noise: { type: 'lowpass', f: 320, q: 0.7, dur: 0.1, vol: 0.35 } },
  shime: { tone: { f0: 420, f1: 330, dur: 0.09, vol: 0.32 }, noise: { type: 'bandpass', f: 2400, q: 1.4, dur: 0.06, vol: 0.22 } },
  kane: { bell: { f: 2350, dur: 0.5, vol: 0.06, partials: [[1, 1], [2.71, 0.45], [4.13, 0.25]] }, noise: { type: 'highpass', f: 6000, q: 0.7, dur: 0.03, vol: 0.08 } },
  hyoshi: { tone: { f0: 1250, f1: 1150, dur: 0.05, vol: 0.22, wave: 'triangle' }, noise: { type: 'bandpass', f: 2800, q: 3, dur: 0.04, vol: 0.25 } },
  crash: { bell: { f: 118, dur: 3.2, vol: 0.16, partials: [[1, 1], [1.47, 0.6], [2.09, 0.4], [2.76, 0.3], [3.9, 0.15]] }, noise: { type: 'bandpass', f: 700, q: 0.6, dur: 1.4, vol: 0.06 } },
};

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Synth {
  constructor() {
    this.ctx = null;
    this.comp = null;
    this.manual = 0;        // relógio manual (s) quando não há áudio
    this.playing = false;
    this.paused = false;
    this.musicVol = 0.8;
  }

  get hasAudio() { return !!this.ctx; }

  // Precisa ser chamado num clique/gesto (regra dos navegadores). Os testes não chamam.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC({ latencyHint: 'interactive' });
      this.out = c.createDynamicsCompressor();
      this.out.threshold.value = -14; this.out.ratio.value = 4;
      this.out.connect(c.destination);
      this.music = c.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.out);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.out);
      // Eco (delay com retorno) para leads e arpejos.
      this.echoIn = c.createGain(); this.echoIn.gain.value = 1;
      const dl = c.createDelay(1); dl.delayTime.value = 0.3;
      const fb = c.createGain(); fb.gain.value = 0.35;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
      this.echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.music);
      this.echoDelay = dl;
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
  }

  setMusicVolume(v) { this.musicVol = v; if (this.music) this.music.gain.value = v; }

  // Começa a música. lead = segundos de silêncio antes do tempo 0 (as primeiras notas já vêm voando).
  start(comp, lead = 2) {
    this.comp = comp;
    this.idx = 0;
    this.playing = true;
    this.paused = false;
    this.manual = -lead;
    this.kit = { ...KIT, ...(comp.song.kit || {}) };
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const lat = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
      this.latency = Math.min(0.15, lat);
      this.t0 = this.ctx.currentTime + lead + 0.05;
      this.echoDelay.delayTime.setValueAtTime(comp.spb * 0.75, this.ctx.currentTime);
    }
  }

  stop() {
    this.playing = false;
    this.comp = null;
    if (this.ctx && this.busNow) { try { this.busNow.disconnect(); } catch { /* já desligado */ } }
    this.busNow = null;
  }

  pause() { this.paused = true; if (this.ctx) this.ctx.suspend(); }
  resume() { this.paused = false; if (this.ctx) this.ctx.resume(); }

  // Tempo da música em segundos (0 = primeira batida). Negativo durante a contagem.
  time() {
    if (!this.ctx) return this.manual;
    return this.ctx.currentTime - this.t0 - this.latency;
  }

  // Sem áudio: avança o relógio manual.
  tick(dt) { if (!this.ctx && this.playing && !this.paused) this.manual += dt; }

  // Agenda os eventos que tocam nos próximos instantes. Chamar todo quadro.
  pump() {
    if (!this.playing || !this.comp || !this.ctx || this.paused) return;
    if (!this.busNow) { this.busNow = this.ctx.createGain(); this.busNow.connect(this.music); }
    const spb = this.comp.spb;
    const until = this.ctx.currentTime + 0.25;
    const ev = this.comp.events;
    while (this.idx < ev.length && this.t0 + ev[this.idx].b * spb < until) {
      const e = ev[this.idx++];
      const when = Math.max(this.ctx.currentTime, this.t0 + e.b * spb);
      this.play(e, when, spb);
    }
  }

  play(e, when, spb) {
    const drum = this.kit[e.part];
    if (drum) return this.drum(drum, when, e.vel, this.busNow);
    const p = this.comp.song.sound?.[e.part];
    if (p) this.voice(p, midiHz(e.midi), when, e.dur * spb, e.vel, this.busNow);
  }

  drum(k, t, vel, bus) {
    const c = this.ctx;
    if (k.tone) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = k.tone.wave || 'sine';
      o.frequency.setValueAtTime(k.tone.f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, k.tone.f1 ?? k.tone.f0), t + k.tone.dur * 0.6);
      g.gain.setValueAtTime(k.tone.vol * vel, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + k.tone.dur);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + k.tone.dur + 0.02);
    }
    if (k.bell) this.bell(k.bell.f, t, k.bell.dur, k.bell.vol * vel, bus, k.bell.partials);
    if (k.noise) {
      const n = k.noise;
      const bursts = n.bursts || 1;
      for (let i = 0; i < bursts; i++) {
        const tb = t + i * 0.012;
        const s = c.createBufferSource(); s.buffer = this.noise;
        const f = c.createBiquadFilter(); f.type = n.type; f.frequency.value = n.f; f.Q.value = n.q ?? 1;
        const g = c.createGain();
        const dur = i < bursts - 1 ? 0.012 : n.dur;
        g.gain.setValueAtTime(n.vol * vel, tb);
        g.gain.exponentialRampToValueAtTime(0.0001, tb + dur);
        s.connect(f); f.connect(g); g.connect(bus);
        s.start(tb, Math.random() * 1.5); s.stop(tb + dur + 0.02);
      }
    }
  }

  // Voz tonal genérica: osciladores (com desafinação) → filtro passa-baixa com envelope → ganho.
  voice(p, hz, t, dur, vel, bus) {
    const c = this.ctx;
    const a = p.attack ?? 0.005, d = p.decay ?? 0.2, s = p.sustain ?? 0.6, r = p.release ?? 0.12;
    const vol = (p.vol ?? 0.1) * vel;
    const g = c.createGain();
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = p.q ?? 1;
    const cut = p.cutoff ?? 4000;
    f.frequency.setValueAtTime(cut, t);
    if (p.env) {
      f.frequency.setValueAtTime(cut + p.env, t);
      f.frequency.exponentialRampToValueAtTime(cut, t + a + d);
    }
    const end = t + Math.max(dur, a + 0.01);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setTargetAtTime(vol * s + 0.0001, t + a, d / 3 + 0.001);
    g.gain.setTargetAtTime(0.0001, end, r / 3 + 0.001);
    const voices = p.voices || 1;
    for (let i = 0; i < voices; i++) {
      const o = c.createOscillator();
      o.type = p.wave || 'sawtooth';
      o.frequency.setValueAtTime(hz, t);
      if (voices > 1) o.detune.value = (i / (voices - 1) - 0.5) * 2 * (p.detune ?? 10);
      if (p.vibrato) {
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = p.vibrato;
        // vibDelay: o vibrato só entra depois de um tempo (como na flauta de bambu).
        if (p.vibDelay) { lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.008, t + p.vibDelay + 0.3); }
        else lg.gain.value = hz * 0.006;
        lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(t); lfo.stop(end + r + 0.05);
      }
      if (p.slide) { o.frequency.setValueAtTime(hz * p.slide, t); o.frequency.exponentialRampToValueAtTime(hz, t + 0.06); }
      o.connect(f);
      o.start(t); o.stop(end + r + 0.05);
    }
    // breath: sopro (ruído filtrado na altura da nota), para o shakuhachi.
    if (p.breath) {
      const ns = c.createBufferSource(); ns.buffer = this.noise;
      const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = hz * 2; nf.Q.value = 2.5;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.linearRampToValueAtTime(p.breath * vel * 2.2, t + 0.05);
      ng.gain.setTargetAtTime(p.breath * vel * 0.6, t + 0.08, 0.1);
      ng.gain.setTargetAtTime(0.0001, end, r / 3 + 0.001);
      ns.connect(nf); nf.connect(ng); ng.connect(bus);
      ns.start(t, Math.random() * 1.5); ns.stop(end + r + 0.05);
    }
    f.connect(g); g.connect(bus);
    if (p.echo) { const eg = c.createGain(); eg.gain.value = p.echo; g.connect(eg); eg.connect(this.echoIn); }
  }

  // Sino: soma de senos com decaimento longo (kane e gongo).
  bell(f, t, dur, vol, bus, partials = [[1, 1], [2.76, 0.4], [5.4, 0.2]]) {
    const c = this.ctx;
    for (const [ratio, gain] of partials) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * ratio, t);
      const d = dur / (0.6 + ratio * 0.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + d + 0.05);
    }
  }

  // ---------- Efeitos sonoros ----------
  _sfxBus(pan = 0) {
    const c = this.ctx;
    if (!c.createStereoPanner) return this.sfx;
    const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.sfx);
    return p;
  }
  // Pincelada na gota: "fssh" de pelo no papel + um pingo de sino.
  cut(strength = 0.6, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, bus = this._sfxBus(pan);
    this.drum({ noise: { type: 'bandpass', f: 1800 + strength * 1500, q: 0.9, dur: 0.12, vol: 0.3 + strength * 0.25 } }, t, 1, bus);
    this.bell(1568 + strength * 300, t, 0.35, 0.05, bus, [[1, 1], [2.4, 0.3]]);
  }
  // Ponto da faixa: sininho baixinho que sobe de tom ao longo da faixa (u de 0 a 1).
  holdTick(u = 0, pan = 0) {
    if (!this.ctx) return;
    this.bell(1046 * Math.pow(2, Math.round(u * 5) * 3 / 12), this.ctx.currentTime, 0.25, 0.025, this._sfxBus(pan), [[1, 1], [3, 0.2]]);
  }
  // Faixa completa: acorde de sinos.
  holdDone(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, bus = this._sfxBus(pan);
    [1318, 1760, 2093].forEach((f, i) => this.bell(f, t + i * 0.05, 0.7, 0.04, bus));
  }
  // Faixa quebrada: madeira seca.
  holdBreak(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, bus = this._sfxBus(pan);
    this.drum({ tone: { f0: 300, f1: 140, dur: 0.18, vol: 0.25, wave: 'triangle' }, noise: { type: 'lowpass', f: 900, q: 0.7, dur: 0.15, vol: 0.15 } }, t, 1, bus);
  }
  bad(pan = 0) {
    if (!this.ctx) return;
    this.voice({ wave: 'triangle', cutoff: 900, decay: 0.15, sustain: 0, vol: 0.12, slide: 1.3 }, 160, this.ctx.currentTime, 0.12, 1, this._sfxBus(pan));
  }
  miss() {
    if (!this.ctx) return;
    this.drum({ noise: { type: 'lowpass', f: 500, q: 0.7, dur: 0.2, vol: 0.13 } }, this.ctx.currentTime, 1, this.sfx);
  }
  click() {
    if (!this.ctx) return;
    this.drum(KIT.hyoshi, this.ctx.currentTime, 0.7, this.sfx);
  }
  fanfare(win = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (win) {
      [62, 65, 67, 69, 74].forEach((m, i) => this.voice({ wave: 'triangle', attack: 0.002, decay: 0.4, sustain: 0, release: 0.4, slide: 0.98, vol: 0.13 }, midiHz(m + 12), t + i * 0.13, 0.4, 1, this.sfx));
      this.bell(118, t + 0.7, 3, 0.15, this.sfx, KIT.crash.bell.partials);
    } else {
      [69, 67, 63, 62].forEach((m, i) => this.voice({ wave: 'sine', attack: 0.08, decay: 0.4, sustain: 0.6, release: 0.4, vol: 0.1, vibrato: 5 }, midiHz(m), t + i * 0.3, 0.35, 1, this.sfx));
    }
  }
}
