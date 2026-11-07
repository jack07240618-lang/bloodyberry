export type BGMTrack = 'TITLE' | 'BATTLE' | 'BOSS' | 'NONE';

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted = false;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // BGM Synthesizer engine state
  private currentTrack: BGMTrack = 'NONE';
  private bgmTimerId: number | null = null;
  private bgmStep = 0;
  private bgmBpm = 130;

  constructor() {}

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();

        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // SFX Sub-bus
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        // BGM Sub-bus
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);

        this.generateNoiseBuffer();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public unlock(): void {
    this.initContext();
    if (this.currentTrack === 'NONE') {
      this.playBGM('TITLE');
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  private generateNoiseBuffer(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  // --- Procedural Chiptune BGM Generator ---

  public playBGM(track: BGMTrack): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.stopBGM();

    if (track === 'NONE') return;
    this.initContext();
    if (!this.ctx) return;

    this.bgmStep = 0;
    if (track === 'TITLE') this.bgmBpm = 95;
    else if (track === 'BATTLE') this.bgmBpm = 132;
    else if (track === 'BOSS') this.bgmBpm = 148;

    const stepIntervalMs = (60 / this.bgmBpm / 4) * 1000; // 16th notes
    this.bgmTimerId = window.setInterval(() => {
      this.tickBGM();
    }, stepIntervalMs);
  }

  public stopBGM(): void {
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  private tickBGM(): void {
    if (!this.ctx || !this.bgmGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const step = this.bgmStep % 64;
    this.bgmStep++;

    // D-minor scale notes (Hz)
    const D2 = 73.42, F2 = 87.31, G2 = 98.0, A2 = 110.0, Bb2 = 116.54, C3 = 130.81;
    const D3 = 146.83, F3 = 174.61, G3 = 196.0, A3 = 220.0, C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23;
    const G4 = 392.0, A4 = 440.0, Bb4 = 466.16;

    if (this.currentTrack === 'TITLE') {
      // Atmospheric slow gothic arpeggio
      if (step % 8 === 0) {
        const chordRoots = [D2, Bb2 / 2, F2, C3 / 2];
        const root = chordRoots[Math.floor(step / 16) % chordRoots.length];
        this.playSynthNote(root, 0.45, 'triangle', 0.18);
      }
      if (step % 4 === 2) {
        const notes = [A3, D4, F4, C4, A3, F3];
        const n = notes[(step / 4) % notes.length];
        this.playSynthNote(n, 0.35, 'sine', 0.12);
      }
    } else if (this.currentTrack === 'BATTLE') {
      // High-energy 16th note chiptune battle arpeggio
      const bassPattern = [D2, D2, D3, D2, F2, D2, G2, A2, Bb2, Bb2, D3, Bb2, A2, A2, G2, F2];
      const bassNote = bassPattern[step % bassPattern.length];
      this.playSynthNote(bassNote, 0.1, 'sawtooth', 0.15);

      // Snare / Hi-hat on beats
      if (step % 8 === 4) {
        this.playDrumSnare(t);
      } else if (step % 2 === 0) {
        this.playDrumHiHat(t);
      }

      // Melody
      if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) {
        const leadPattern = [D4, 0, F4, A3, D4, C4, 0, A3, Bb2 * 2, 0, D4, F4, G3 * 2, F4, E4, D4];
        const melodyNote = leadPattern[Math.floor(step / 2) % leadPattern.length];
        if (melodyNote > 0) {
          this.playSynthNote(melodyNote, 0.15, 'square', 0.08);
        }
      }
    } else if (this.currentTrack === 'BOSS') {
      // Intense Boss Encounter theme
      const bossBass = [D2, D2, D2, D2, C3, C3, Bb2, A2];
      const bassNote = bossBass[Math.floor(step / 4) % bossBass.length];
      this.playSynthNote(bassNote, 0.18, 'sawtooth', 0.22);

      if (step % 4 === 0) {
        this.playDrumKick(t);
      }
      if (step % 4 === 2) {
        this.playDrumSnare(t);
      }

      // Screaming lead
      if (step % 4 === 1 || step % 4 === 3) {
        const notes = [F4, D4, G4, F4, A4, Bb4, A4, F4];
        const n = notes[Math.floor(step / 2) % notes.length];
        this.playSynthNote(n, 0.12, 'square', 0.12);
      }
    }
  }

  private playSynthNote(freq: number, duration: number, type: OscillatorType, gainAmt: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    g.gain.setValueAtTime(gainAmt, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  private playDrumKick(t: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);

    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private playDrumSnare(t: number): void {
    if (!this.ctx || !this.bgmGain || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.bgmGain);
    noise.start(t);
    noise.stop(t + 0.1);
  }

  private playDrumHiHat(t: number): void {
    if (!this.ctx || !this.bgmGain || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6000, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.bgmGain);
    noise.start(t);
    noise.stop(t + 0.04);
  }

  // --- Sound Effects ---

  public playShoot(type: 'wand' | 'dagger' | 'lightning' | 'water' = 'wand'): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'wand') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.09);
    } else if (type === 'dagger') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.06);
    } else if (type === 'lightning') {
      this.playExplosion(0.18, 900);
    } else if (type === 'water') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.linearRampToValueAtTime(150, t + 0.12);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  public playHit(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playEnemyDeath(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.12);
  }

  public playGemPickup(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 880 + Math.random() * 200;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.08);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playExplosion(duration = 0.3, maxCutoff = 600): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(maxCutoff, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + duration);
  }

  public playPlayerHurt(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playLevelUp(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const noteDuration = 0.08;
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = startTime + idx * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration * 1.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + noteDuration * 1.5);
    });
  }

  public playChestOpen(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    const noteDuration = 0.09;
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = startTime + idx * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playGameOver(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [440, 415.3, 392, 349.23, 329.63];
    const noteDuration = 0.2;
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = startTime + idx * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}
