export class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private reverb: ConvolverNode | null = null;

  constructor() {}

  async start() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.2;
    
    this.reverb = this.ctx.createConvolver();
    // Complex spectral IR
    const len = this.ctx.sampleRate * 8;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = buf.getChannelData(i);
      for (let j = 0; j < len; j++) {
        const decay = Math.exp(-j / (this.ctx.sampleRate * 1.5));
        channel[j] = (Math.random() * 2 - 1) * decay * (1 + 0.2 * Math.sin(j * 0.001));
      }
    }
    this.reverb.buffer = buf;

    this.masterGain.connect(this.reverb);
    this.reverb.connect(this.ctx.destination);
  }

  triggerPhase(phase: string, depth: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Gradual cleanup
    this.nodes.forEach(n => {
      if ('stop' in n) (n as any).stop(now + 1);
    });
    this.nodes = [];

    const baseFreq = 60 + (depth * 15);
    const attack = 0.15; // Mandatory >30ms

    // WAVE LAYER (Primary)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 10);
    
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.3, now + attack);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 5);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    this.nodes.push(osc, oscGain);

    // RESONANT PERCUSSION (Handpan/Tank Drum style)
    if (depth > 1) {
      const pOsc = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      pOsc.type = "triangle";
      pOsc.frequency.setValueAtTime(baseFreq * 2.618, now);
      
      pGain.gain.setValueAtTime(0, now);
      pGain.gain.linearRampToValueAtTime(0.1, now + 0.2);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 6);
      
      pOsc.connect(pGain);
      pGain.connect(this.masterGain);
      pOsc.start(now);
      this.nodes.push(pOsc, pGain);
    }

    // SUB FOUNDATION
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(baseFreq / 2, now);
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.2, now + 0.3);
    
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    this.nodes.push(sub, subGain);
  }

  updateParams(x: number, y: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const vol = 0.05 + (y * 0.4);
    this.masterGain.gain.setTargetAtTime(vol, now, 0.2);
  }

  stop() {
    if (this.ctx) {
      this.nodes.forEach(n => { if ('stop' in n) (n as any).stop(); });
      this.ctx.close();
      this.ctx = null;
    }
  }

  dispose() { this.stop(); }
}
