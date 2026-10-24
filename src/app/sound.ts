/** Tiny WebAudio synth for game feedback; no audio assets needed. */
export class Sound {
  private ctx: AudioContext | null = null;
  enabled = true;

  private tone(freq: number, duration: number, type: OscillatorType = 'square', gain = 0.04, slideTo?: number): void {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
      amp.gain.setValueAtTime(gain, t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(amp).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch {
      // Audio is optional; ignore browsers that block or lack WebAudio.
    }
  }

  rotate(): void { this.tone(660, 0.05, 'triangle'); }
  lock(): void { this.tone(140, 0.12, 'square', 0.06, 70); }
  clear(layers: number): void { this.tone(440, 0.25 + layers * 0.1, 'sawtooth', 0.05, 1200); }
  levelUp(): void { this.tone(520, 0.4, 'triangle', 0.06, 1560); }
  gameOver(): void { this.tone(300, 0.9, 'sawtooth', 0.06, 50); }
}
