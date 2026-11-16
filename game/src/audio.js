// Ember Yard — every sound is synthesized live with WebAudio.
// No audio files, no network: gunfire is filtered noise, everything else is
// oscillators with short envelopes.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  // Lazily create the context on the first user gesture; browsers block
  // audio before that. Safe to call from anywhere.
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // White noise through a filter, decaying linearly — the basis of shots,
  // footsteps and the explosion.
  noiseBurst(dur, filterFreq, gain, type = 'lowpass') {
    if (!this.ctx || !this.enabled) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  // A single oscillator with an exponential decay, optionally sliding pitch.
  tone(freq, dur, gain, type = 'sine', slide = 0) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), this.ctx.currentTime + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  shot(kind) {
    this.ensure();
    if (kind === 'lm88') {
      this.noiseBurst(0.28, 900, 0.9);
      this.tone(90, 0.22, 0.7, 'sine', -50);
    } else if (kind === 'ar9') {
      this.noiseBurst(0.12, 1800, 0.55);
      this.tone(140, 0.08, 0.35, 'square', -60);
    } else if (kind === 'vk7') {
      this.noiseBurst(0.09, 2400, 0.45);
      this.tone(170, 0.06, 0.3, 'square', -70);
    } else {
      this.noiseBurst(0.1, 1600, 0.5);
      this.tone(150, 0.07, 0.3, 'square', -60);
    }
  }

  dry() {
    this.ensure();
    this.tone(1400, 0.03, 0.15, 'square');
  }

  reload() {
    this.ensure();
    this.tone(900, 0.04, 0.2, 'square');
    setTimeout(() => this.tone(650, 0.04, 0.2, 'square'), 180);
    setTimeout(() => this.tone(1100, 0.05, 0.22, 'square'), 420);
  }

  hit(kill) {
    this.ensure();
    this.tone(kill ? 1560 : 1180, 0.06, 0.25, 'sine');
    if (kill) setTimeout(() => this.tone(2080, 0.09, 0.22, 'sine'), 70);
  }

  hurt() {
    this.ensure();
    this.tone(110, 0.15, 0.5, 'sawtooth', -40);
  }

  plantBeep() {
    this.ensure();
    this.tone(880, 0.09, 0.3, 'sine');
  }

  explosion() {
    this.ensure();
    this.noiseBurst(0.9, 300, 1.0);
    this.tone(55, 0.8, 0.9, 'sine', -25);
  }

  roundWin() {
    this.ensure();
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 0.3, 'triangle'), i * 110));
  }

  roundLose() {
    this.ensure();
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.28, 'triangle'), i * 120));
  }

  click() {
    this.ensure();
    this.tone(700, 0.04, 0.18, 'sine');
  }

  step() {
    this.ensure();
    this.noiseBurst(0.05, 500, 0.08);
  }
}
