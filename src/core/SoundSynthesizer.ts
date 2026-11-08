export type BGMTrack = 'TITLE' | 'BATTLE' | 'BOSS' | 'NONE';

export type BGMStyle = 'DEFAULT' | 'SYNTHWAVE' | 'BAROQUE' | 'ETHEREAL' | 'CHIPTUNE_PRO' | 'AUTO';

export const BGM_STYLE_ORDER: BGMStyle[] = [
  'BAROQUE',
  'DEFAULT',
  'SYNTHWAVE',
  'ETHEREAL',
  'CHIPTUNE_PRO',
  'AUTO'
];

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted = false;
  public bgmStyle: BGMStyle = 'BAROQUE'; // Sets Gothic Baroque Symphony as the default BGM!
  private autoResolvedStyle: Exclude<BGMStyle, 'AUTO'> = 'BAROQUE';
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private sfxGain: GainNode | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;
  private bgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Anti-clipping rate-limit timestamps & polyphony counters (防止多怪受击音效重叠爆音)
  private lastHitTime = 0;
  private lastDeathTime = 0;
  private lastGemTime = 0;
  private lastShootTime = 0;
  private lastParryTime = 0;
  private lastExplosionTime = 0;
  private hitBurstCount = 0;

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

        // Master Bus Brickwall Limiter / Compressor (彻底杜绝扬声器与耳机峰值削波爆音)
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.setValueAtTime(-8, this.ctx.currentTime);
        this.masterCompressor.knee.setValueAtTime(10, this.ctx.currentTime);
        this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.masterCompressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
        this.masterCompressor.release.setValueAtTime(0.08, this.ctx.currentTime);
        this.masterCompressor.connect(this.ctx.destination);

        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.78, this.ctx.currentTime);
        this.masterGain.connect(this.masterCompressor);

        // SFX Dedicated Dynamics Compressor (平滑压限高密度打击音效)
        this.sfxCompressor = this.ctx.createDynamicsCompressor();
        this.sfxCompressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.sfxCompressor.knee.setValueAtTime(14, this.ctx.currentTime);
        this.sfxCompressor.ratio.setValueAtTime(10, this.ctx.currentTime);
        this.sfxCompressor.attack.setValueAtTime(0.001, this.ctx.currentTime);
        this.sfxCompressor.release.setValueAtTime(0.06, this.ctx.currentTime);
        this.sfxCompressor.connect(this.masterGain);

        // SFX Sub-bus
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.38, this.ctx.currentTime);
        this.sfxGain.connect(this.sfxCompressor);

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

  // --- Multi-Style High-Precision Procedural BGM Generator ---

  public cycleBGMStyle(): BGMStyle {
    const idx = BGM_STYLE_ORDER.indexOf(this.bgmStyle);
    this.bgmStyle = BGM_STYLE_ORDER[(idx + 1) % BGM_STYLE_ORDER.length];
    const track = this.currentTrack;
    if (track !== 'NONE') {
      this.currentTrack = 'NONE';
      this.playBGM(track);
    }
    return this.bgmStyle;
  }

  public setBiomeBGMHint(biomeIndex: number): void {
    const styles: Array<Exclude<BGMStyle, 'AUTO'>> = [
      'BAROQUE',
      'ETHEREAL',
      'SYNTHWAVE',
      'CHIPTUNE_PRO',
      'DEFAULT'
    ];
    this.autoResolvedStyle = styles[biomeIndex % styles.length];
  }

  private getEffectiveBGMStyle(): Exclude<BGMStyle, 'AUTO'> {
    return this.bgmStyle === 'AUTO' ? this.autoResolvedStyle : this.bgmStyle;
  }

  public playBGM(track: BGMTrack): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.stopBGM();

    if (track === 'NONE') return;
    this.initContext();
    if (!this.ctx) return;

    this.bgmStep = 0;
    const style = this.getEffectiveBGMStyle();
    if (track === 'TITLE') {
      this.bgmBpm = style === 'ETHEREAL' ? 88 : 95;
    } else if (track === 'BATTLE') {
      this.bgmBpm =
        style === 'SYNTHWAVE'
          ? 126
          : style === 'BAROQUE'
          ? 136
          : style === 'ETHEREAL'
          ? 114
          : style === 'CHIPTUNE_PRO'
          ? 138
          : 132;
    } else if (track === 'BOSS') {
      this.bgmBpm = 148;
    }

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
    const step128 = this.bgmStep % 128; // 8-bar long phrase so it never feels repetitive!
    const step = this.bgmStep % 64;
    this.bgmStep++;

    // Extended D-minor / Dorian / Harmonic Minor pitch palette (Hz)
    const D2 = 73.42, E2 = 82.41, F2 = 87.31, G2 = 98.0, A2 = 110.0, Bb2 = 116.54, C3 = 130.81, Cs3 = 138.59;
    const D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.0, A3 = 220.0, Bb3 = 233.08, C4 = 261.63, Cs4 = 277.18;
    const D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.0, A4 = 440.0, Bb4 = 466.16, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46;

    const style = this.getEffectiveBGMStyle();

    if (this.currentTrack === 'TITLE') {
      // Rich atmospheric prelude with warm pad chords + crystal harp arpeggio
      if (step128 % 16 === 0) {
        const chordProg = [
          [D3, F3, A3],
          [Bb2, D3, F3],
          [G2 * 2, Bb3, D4],
          [A2 * 2, Cs4, E4]
        ];
        const chord = chordProg[Math.floor(step128 / 16) % chordProg.length];
        for (const n of chord) {
          this.playWarmPadNote(n, 1.35, 0.055);
        }
      }
      if (step % 4 === 2) {
        const notes = [A3, D4, F4, E4, D4, C4, A3, G3, F3, A3, D4, G4, F4, E4, D4, Cs4];
        const n = notes[Math.floor(step128 / 4) % notes.length];
        this.playFMBellNote(n, 0.48, 0.08);
      }
      return;
    }

    if (this.currentTrack === 'BOSS') {
      // High-intensity Boss Encounter Symphony (Enhanced across all styles)
      const bossBass = [D2, D2, D3, D2, Bb2, Bb2, C3, C3, G2, G2, Bb2, G2, A2, A2, Cs3, A2];
      const bassNote = bossBass[Math.floor(step128 / 2) % bossBass.length];
      this.playFilteredBassNote(bassNote, 0.16, 0.19, 950);

      if (step % 4 === 0) this.playDrumKick(t);
      if (step % 8 === 4) this.playDrumSnare(t);
      if (step % 2 === 1) this.playDrumHiHat(t);

      // Baroque / Synth Boss Lead Phrase (A + B sections over 128 steps)
      if (step % 2 === 0) {
        const phraseA = [D4, F4, A4, D5, Cs4 * 2, A4, F4, E4, Bb3 * 2, D4, F4, Bb4, A4, G4, F4, E4];
        const phraseB = [G4, Bb4, D5, F5, E5, D5, C5, Bb4, A4, Cs4 * 2, E5, A4, G4, F4, E4, D4];
        const activePhrase = step128 < 64 ? phraseA : phraseB;
        const n = activePhrase[Math.floor(step128 / 2) % activePhrase.length];
        this.playVibratoLeadNote(n, 0.16, 'sawtooth', 0.085);
      }
      return;
    }

    // =========================================================================
    // BATTLE TRACK: 5 Distinct High-Precision Market-Popular BGM Arrangements
    // =========================================================================
    switch (style) {
      // 1. DEFAULT: Original Classic Chiptune Battle BGM (Preserved as requested!)
      case 'DEFAULT': {
        const bassPattern = [D2, D2, D3, D2, F2, D2, G2, A2, Bb2, Bb2, D3, Bb2, A2, A2, G2, F2];
        const bassNote = bassPattern[step % bassPattern.length];
        this.playSynthNote(bassNote, 0.1, 'sawtooth', 0.15);

        if (step % 8 === 4) {
          this.playDrumSnare(t);
        } else if (step % 2 === 0) {
          this.playDrumHiHat(t);
        }

        if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) {
          const leadPattern = [D4, 0, F4, A3, D4, C4, 0, A3, Bb2 * 2, 0, D4, F4, G3 * 2, F4, E4, D4];
          const melodyNote = leadPattern[Math.floor(step / 2) % leadPattern.length];
          if (melodyNote > 0) {
            this.playSynthNote(melodyNote, 0.15, 'square', 0.08);
          }
        }
        break;
      }

      // 2. SYNTHWAVE: Dark Cyberpunk / Soul Knight Electronic Pulse (Warm Analog Bass + Stereo Pluck Arp + Evolving Lead)
      case 'SYNTHWAVE': {
        // 8-bar chord root progression: Dm -> Bb -> F -> C -> Gm -> Dm -> Bb -> A7
        const roots = [D2, Bb2 * 0.5, F2, C3 * 0.5, G2, D2, Bb2 * 0.5, A2];
        const barIdx = Math.floor(step128 / 16) % roots.length;
        const root = roots[barIdx];

        // Punchy analog rolling bassline (offbeat octave bounce)
        const bassFreq = step % 2 === 0 ? root : root * 2;
        this.playFilteredBassNote(bassFreq, 0.12, 0.16, step % 4 === 0 ? 1100 : 680);

        // Warm lush stereo synth pad on bar start
        if (step128 % 16 === 0) {
          this.playWarmPadNote(root * 2, 1.4, 0.05);
          this.playWarmPadNote(root * 3, 1.4, 0.045);
        }

        // Electronic Four-on-the-Floor Kick + Gated Snare
        if (step % 4 === 0) this.playDrumKick(t);
        if (step % 8 === 4) this.playDrumSnare(t);
        if (step % 2 === 1) this.playDrumHiHat(t);

        // Sparkling 16th-note Synthwave Pluck Arpeggio
        const arpIntervals = [2, 2.4, 3, 4, 3, 2.4, 2, 1.5];
        const arpFreq = root * 2 * arpIntervals[step % arpIntervals.length];
        this.playFilteredBassNote(arpFreq, 0.09, 0.055, 1800);

        // Soaring Synth Lead Melody on bars 1-8 (non-fatiguing smooth phrasing)
        if (step128 % 4 === 0) {
          const synthMelody = [
            A4, 0, G4, F4, D4, 0, F4, G4,
            A4, C5, D5, A4, G4, F4, E4, 0,
            F4, 0, G4, A4, Bb4, A4, G4, F4,
            E4, G4, A4, Cs4 * 2, D5, 0, 0, 0
          ];
          const mNote = synthMelody[Math.floor(step128 / 4) % synthMelody.length];
          if (mNote > 0) {
            this.playVibratoLeadNote(mNote, 0.34, 'sawtooth', 0.068);
          }
        }
        break;
      }

      // 3. BAROQUE: Castlevania / Vampire Survivors Gothic Pipe Organ & Harpsichord Counterpoint
      case 'BAROQUE': {
        // Pipe Organ sustained harmonic chords every 16 steps
        const organChords = [
          [D3, F3, A3],
          [G3, Bb3, D4],
          [A3, Cs4, E4],
          [D3, F3, A3],
          [Bb2, D3, F3],
          [G2 * 2, Bb3, E4],
          [A3, D4, F4],
          [A3, Cs4, E4]
        ];
        const bar = Math.floor(step128 / 16) % organChords.length;
        if (step128 % 16 === 0) {
          for (const cn of organChords[bar]) {
            this.playWarmPadNote(cn, 1.25, 0.052);
          }
        }

        // Walking Baroque Bassline (quarter/eighth notes)
        if (step % 2 === 0) {
          const walkBass = [
            D2, F2, A2, D3, G2, Bb2, D3, G2,
            A2, Cs3, E3, A2, D3, A2, F2, E2,
            Bb2, D3, F3, Bb2, G2, Bb2, E3, G2,
            A2, D3, F3, D3, A2, G2, F2, E2
          ];
          const bFreq = walkBass[Math.floor(step128 / 2) % walkBass.length];
          this.playFilteredBassNote(bFreq, 0.16, 0.14, 820);
        }

        // Light orchestral percussion
        if (step % 8 === 0) this.playDrumKick(t);
        if (step % 8 === 4) this.playDrumSnare(t);

        // Harpsichord 16th-note classical counterpoint (bright plucked FM harmonics)
        const harpsiA = [
          D5, A4, F4, A4, D5, E5, F5, D5,
          Bb4, G4, D4, G4, Bb4, C5, D5, Bb4,
          Cs4 * 2, A4, E4, A4, Cs4 * 2, D5, E5, Cs4 * 2,
          D5, A4, F4, E4, D4, F4, A4, C5
        ];
        const harpsiB = [
          Bb4, F4, D4, F4, Bb4, C5, D5, F5,
          E5, Bb4, G4, Bb4, E5, D5, C5, Bb4,
          A4, F4, D4, F4, A4, D5, F5, D5,
          Cs4 * 2, A4, E4, G4, A4, Cs4 * 2, E5, A4
        ];
        const hSeq = step128 < 64 ? harpsiA : harpsiB;
        const hNote = hSeq[step128 % hSeq.length];
        this.playFMBellNote(hNote, 0.14, 0.062);
        break;
      }

      // 4. ETHEREAL: Hollow Knight / Hades Celestial Handpan, Crystal Harp & Deep Sub-Drone (Ultra non-fatiguing!)
      case 'ETHEREAL': {
        // Warm Dorian progression: Dm9 -> G6 -> Bbmaj7 -> Am7
        const dorianPads = [
          [D3, F3, A3, E4],
          [G2 * 2, B2_FREQ(), D4, E4],
          [Bb2, D3, F3, A3],
          [A2 * 2, C4, E4, G4]
        ];
        function B2_FREQ(): number {
          return 123.47 * 2;
        }
        const padIdx = Math.floor(step128 / 32) % dorianPads.length;
        if (step128 % 32 === 0) {
          for (const pn of dorianPads[padIdx]) {
            this.playWarmPadNote(pn, 2.8, 0.045);
          }
          // Deep soothing sub-bass pulse
          this.playFilteredBassNote(dorianPads[padIdx][0] * 0.5, 1.8, 0.15, 320);
        }

        // Polyrhythmic Crystal Handpan / Harp notes (3-against-4 gentle pattern)
        if (step128 % 3 === 0 || step128 % 8 === 4) {
          const harpScale = [D4, E4, F4, A4, B2_FREQ() * 2, D5, E5, A4, F4, E4, D4, A3];
          const hn = harpScale[(step128 * 7 + padIdx * 3) % harpScale.length];
          this.playFMBellNote(hn, 0.55, 0.075);
        }

        // Soft heartbeat kick & brushed hi-hat
        if (step % 16 === 0 || step % 16 === 10) this.playDrumKick(t);
        if (step % 4 === 2) this.playDrumHiHat(t);
        break;
      }

      // 5. CHIPTUNE_PRO: Enter the Gungeon 16-Bit Multi-Voice Arcade Anthem
      case 'CHIPTUNE_PRO': {
        // Triangle wave bouncy octave bass
        const chipBass = [
          D2, D3, F2, F3, G2, G3, A2, A3,
          Bb2, Bb3 * 0.5, C3, C4 * 0.5, D3, A2, G2, F2
        ];
        const cb = chipBass[step % chipBass.length];
        this.playSynthNote(cb, 0.11, 'triangle', 0.18);

        if (step % 4 === 0) this.playDrumKick(t);
        if (step % 8 === 4) this.playDrumSnare(t);
        if (step % 2 === 0) this.playDrumHiHat(t);

        // Fast 3-note chiptune chord arpeggiator on off-steps
        if (step % 2 === 1) {
          const arpTriads = [D4, F4, A4, C5];
          this.playSynthNote(arpTriads[step % arpTriads.length], 0.06, 'square', 0.038);
        }

        // Dual-section Heroic 16-Bit Lead with Vibrato
        const lead128 = [
          D5, 0, A4, F4, G4, A4, C5, D5, E5, 0, C5, A4, G4, F4, G4, 0,
          Bb4, 0, D5, F5, E5, D5, C5, A4, D5, 0, 0, A4, C5, D5, E5, 0,
          F5, 0, E5, D5, C5, A4, C5, D5, E5, 0, D5, C5, A4, G4, F4, 0,
          G4, A4, Bb4, C5, D5, F5, E5, D5, Cs4 * 2, 0, A4, Cs4 * 2, D5, 0, 0, 0
        ];
        if (step128 % 2 === 0) {
          const ln = lead128[Math.floor(step128 / 2) % lead128.length];
          if (ln > 0) {
            this.playVibratoLeadNote(ln, 0.18, 'square', 0.072);
            // Harmony third below
            this.playSynthNote(ln * 0.8, 0.15, 'triangle', 0.05);
          }
        }
        break;
      }
    }
  }

  /**
   * Low-pass filtered analog bass / pluck note (warm, punchy, zero harshness)
   */
  private playFilteredBassNote(freq: number, duration: number, gainAmt: number, cutoffHz: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoffHz * 0.25), t + duration);

    g.gain.setValueAtTime(gainAmt, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.bgmGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  /**
   * Warm detuned stereo pad / pipe organ voice with gentle attack & release
   */
  private playWarmPadNote(freq: number, duration: number, gainAmt: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq * 0.997, t);
    osc2.frequency.setValueAtTime(freq * 1.003, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, t);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gainAmt, t + Math.min(0.18, duration * 0.25));
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(this.bgmGain);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  /**
   * Crystal FM Bell / Harpsichord / Handpan harmonic voice
   */
  private playFMBellNote(freq: number, duration: number, gainAmt: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const g = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, t);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(freq * 2.0, t);
    modGain.gain.setValueAtTime(freq * 1.2, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + duration * 0.7);

    g.gain.setValueAtTime(gainAmt, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g);
    g.connect(this.bgmGain);

    modulator.start(t);
    carrier.start(t);
    modulator.stop(t + duration);
    carrier.stop(t + duration);
  }

  /**
   * Expressive lead synth with gentle LFO pitch vibrato & lowpass smoothing
   */
  private playVibratoLeadNote(freq: number, duration: number, type: OscillatorType, gainAmt: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5.5, t);
    lfoGain.gain.setValueAtTime(freq * 0.008, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);

    g.gain.setValueAtTime(gainAmt, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.bgmGain);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + duration);
    osc.stop(t + duration);
  }

  /**
   * Pure Harmonic Helper: Plays a clean, noise-free sine + soft octave overtone note
   * with a smooth attack and natural exponential decay (Unified Pure Sanctuary Timbre)
   */
  private playPureTone(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    endFreq?: number,
    overtoneRatio = 2.0,
    overtoneShare = 0.18
  ): void {
    if (!this.ctx || !this.sfxGain) return;

    const fund = this.ctx.createOscillator();
    const over = this.ctx.createOscillator();
    const fundGain = this.ctx.createGain();
    const overGain = this.ctx.createGain();
    const outGain = this.ctx.createGain();

    fund.type = 'sine';
    fund.frequency.setValueAtTime(freq, startTime);
    if (endFreq && endFreq !== freq) {
      fund.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    }

    over.type = 'triangle';
    over.frequency.setValueAtTime(freq * overtoneRatio, startTime);
    if (endFreq && endFreq !== freq) {
      over.frequency.exponentialRampToValueAtTime(endFreq * overtoneRatio, startTime + duration);
    }

    fundGain.gain.setValueAtTime(1 - overtoneShare, startTime);
    overGain.gain.setValueAtTime(overtoneShare, startTime);

    const attack = Math.min(0.008, duration * 0.15);
    outGain.gain.setValueAtTime(0.0008, startTime);
    outGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    outGain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    fund.connect(fundGain);
    over.connect(overGain);
    fundGain.connect(outGain);
    overGain.connect(outGain);
    outGain.connect(this.sfxGain);

    fund.start(startTime);
    over.start(startTime);
    fund.stop(startTime + duration);
    over.stop(startTime + duration);
  }

  /**
   * Pure Crystal Blade Parry Sound when deflecting enemy projectiles
   */
  public playParry(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (t - this.lastParryTime < 0.055) return;
    this.lastParryTime = t;

    // Clean D-minor harmonic crystal ring (A5 -> D6)
    this.playPureTone(880.0, t, 0.085, 0.12, 1174.66, 2.0, 0.15);
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

  // --- Unified, Pure & Non-Noisy Sound Effects (纯净统一的暗黑圣殿声学体系) ---

  public playShoot(type: 'wand' | 'dagger' | 'lightning' | 'water' = 'wand'): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (type !== 'lightning' && t - this.lastShootTime < 0.042) return;
    this.lastShootTime = t;

    if (type === 'wand') {
      // Soft arcane sine-triangle pulse
      this.playPureTone(523.25, t, 0.075, 0.12, 220.0, 2.0, 0.12);
    } else if (type === 'dagger') {
      // Clean air-slice sine sweep (no harsh sawtooth buzz)
      this.playPureTone(587.33, t, 0.06, 0.11, 196.0, 1.5, 0.15);
    } else if (type === 'lightning') {
      this.playExplosion(0.16, 480);
    } else if (type === 'water') {
      this.playPureTone(349.23, t, 0.10, 0.12, 174.61, 2.0, 0.1);
    }
  }

  public playHit(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const elapsed = t - this.lastHitTime;

    // Coalesce simultaneous multi-enemy hits within 45ms
    if (elapsed < 0.045) {
      this.hitBurstCount = Math.min(8, this.hitBurstCount + 1);
      return;
    }

    if (elapsed > 0.14) {
      this.hitBurstCount = 0;
    } else {
      this.hitBurstCount = Math.max(0, this.hitBurstCount - 1);
    }
    this.lastHitTime = t;

    // Pure, tight low-frequency acoustic thud (sine + soft triangle, zero square-wave buzz!)
    const pitchJitter = 0.95 + Math.random() * 0.10;
    const dynamicGain = 0.15 / Math.sqrt(1 + this.hitBurstCount * 0.5);
    this.playPureTone(135 * pitchJitter, t, 0.048, dynamicGain, 44 * pitchJitter, 1.5, 0.2);
  }

  public playEnemyDeath(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (t - this.lastDeathTime < 0.055) return;
    this.lastDeathTime = t;

    // Clean, deep soul-release sub-tone (replaces noisy white-noise static burst)
    const pitchJitter = 0.94 + Math.random() * 0.12;
    this.playPureTone(110 * pitchJitter, t, 0.095, 0.14, 38 * pitchJitter, 2.0, 0.12);
  }

  public playGemPickup(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (t - this.lastGemTime < 0.042) return;
    this.lastGemTime = t;

    // Tuned to D-Minor Pentatonic scale so gem pickups always harmonize purely with the BGM!
    const pentatonic = [587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66]; // D5, F5, G5, A5, C6, D6
    const idx = Math.floor((t * 17) % pentatonic.length);
    const freq = pentatonic[idx];
    this.playPureTone(freq, t, 0.075, 0.095, freq * 1.005, 2.0, 0.1);
  }

  public playExplosion(duration = 0.24, maxCutoff = 420): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (t - this.lastExplosionTime < 0.065) return;
    this.lastExplosionTime = t;

    // Deep, warm sub-bass impact wave + very gentle low-pass rumble (no harsh high static)
    this.playPureTone(98, t, duration, 0.20, 32, 1.5, 0.18);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(360, maxCutoff), t);
      filter.frequency.exponentialRampToValueAtTime(45, t + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      const maxOffset = Math.max(0, this.noiseBuffer.duration - duration - 0.02);
      noise.start(t, Math.random() * maxOffset);
      noise.stop(t + duration);
    }
  }

  public playPlayerHurt(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    // Low damped minor-second impact thud (no harsh sawtooth buzz)
    this.playPureTone(116.54, t, 0.15, 0.22, 48.0, 1.5, 0.22);
  }

  /**
   * 升级音效：纯净 D 大调/多利亚三音水晶泛音琶音 (D4 -> A4 -> D5)
   */
  public playLevelUp(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const startTime = this.ctx.currentTime;
    const notes = [293.66, 440.0, 587.33]; // D4 -> A4 -> D5 (Pure Fifth + Octave)
    const spacing = 0.075;

    notes.forEach((freq, idx) => {
      const t = startTime + idx * spacing;
      const isLast = idx === notes.length - 1;
      this.playPureTone(freq, t, isLast ? 0.36 : 0.20, isLast ? 0.13 : 0.10, undefined, 2.0, 0.15);
    });
  }

  /**
   * 道具宝箱开启音效：温润低音共鸣 + 纯净四音水晶竖琴琶音 (零白噪、零锯齿波，清澈高雅)
   */
  public playChestOpen(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const startTime = this.ctx.currentTime;

    // 1. Soft, warm wooden/stone resonance base (D3)
    this.playPureTone(146.83, startTime, 0.26, 0.15, 110.0, 2.0, 0.1);

    // 2. Pure 4-note Crystal Harp Arpeggio (D4 -> F#4 -> A4 -> D5)
    const notes = [293.66, 369.99, 440.0, 587.33];
    const stepTime = 0.072;

    notes.forEach((freq, idx) => {
      const t = startTime + 0.03 + idx * stepTime;
      const isCrown = idx === notes.length - 1;
      this.playPureTone(freq, t, isCrown ? 0.42 : 0.24, isCrown ? 0.13 : 0.10, undefined, 2.0, 0.16);
    });
  }

  /**
   * 出入传送门专属音效：纯净空灵五度空间共鸣 (去除嘈杂风噪，采用温润正弦下潜与双音泛音)
   */
  public playPortalTransition(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;

    // 1. Smooth dimensional sub-sine glide (D3 -> A2 -> D3)
    this.playPureTone(146.83, t, 0.36, 0.16, 220.0, 2.0, 0.08);

    // 2. Pure ethereal fifth chime (A4 -> E5)
    this.playPureTone(440.0, t + 0.04, 0.32, 0.10, 444.0, 2.0, 0.12);
    this.playPureTone(659.25, t + 0.10, 0.36, 0.11, 664.0, 2.0, 0.12);
  }

  /**
   * 圣物祭坛 / 铁匠淬炼 / 诅咒血箱交互音效：统一采用纯净音叉/颂钵泛音体系
   */
  public playShrineInteract(kind: 'RELIC' | 'FORGE' | 'CURSED' = 'RELIC'): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;

    if (kind === 'FORGE') {
      // Pure resonant tuning-fork anvil chime (D5 -> A5, zero steam noise)
      this.playPureTone(587.33, t, 0.24, 0.13, undefined, 2.0, 0.22);
      this.playPureTone(880.0, t + 0.06, 0.32, 0.12, undefined, 2.0, 0.18);
      return;
    }

    if (kind === 'CURSED') {
      // Deep, pure minor harmonic resonance (D3 -> Bb3 -> A3)
      this.playPureTone(146.83, t, 0.34, 0.15, undefined, 2.0, 0.12);
      this.playPureTone(233.08, t + 0.05, 0.32, 0.11, 220.0, 2.0, 0.12);
      return;
    }

    // 'RELIC': Pure singing-bowl fifth & octave (A4 -> D5 -> E5)
    const relicNotes = [440.0, 587.33, 659.25];
    relicNotes.forEach((rf, idx) => {
      this.playPureTone(rf, t + idx * 0.055, 0.32, 0.11, undefined, 2.0, 0.14);
    });
  }

  /**
   * 道具拾取音效：统一在 D 小调泛音列内的清澈音色
   */
  public playItemPickup(kind: 'GOLD' | 'POTION' | 'RELIC_ITEM' = 'GOLD'): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;

    if (kind === 'GOLD') {
      if (t - this.lastGemTime < 0.038) return;
      this.lastGemTime = t;
      // Clean two-note crystal bell (A5 -> D6)
      this.playPureTone(880.0, t, 0.08, 0.10, undefined, 2.0, 0.12);
      this.playPureTone(1174.66, t + 0.035, 0.11, 0.11, undefined, 2.0, 0.12);
      return;
    }

    if (kind === 'POTION') {
      // Warm 3-note restorative chord (D4 -> F4 -> A4)
      this.playPureTone(293.66, t, 0.16, 0.11, undefined, 2.0, 0.1);
      this.playPureTone(349.23, t + 0.045, 0.18, 0.11, undefined, 2.0, 0.1);
      this.playPureTone(440.0, t + 0.09, 0.24, 0.12, undefined, 2.0, 0.1);
      return;
    }

    // 'RELIC_ITEM' (Magnet / Freeze Clock): Pure harmonic fifth (D5 -> A5)
    this.playPureTone(587.33, t, 0.16, 0.11, undefined, 2.0, 0.12);
    this.playPureTone(880.0, t + 0.05, 0.22, 0.11, undefined, 2.0, 0.12);
  }

  /**
   * 构筑卡牌选择 / UI 按钮确认：温润低调的纯净双音反馈
   */
  public playUIConfirm(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    this.playPureTone(293.66, t, 0.075, 0.10, undefined, 2.0, 0.1);
    this.playPureTone(440.0, t + 0.03, 0.11, 0.10, undefined, 2.0, 0.1);
  }

  public playGameOver(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [440, 392, 349.23, 293.66]; // A4 -> G4 -> F4 -> D4 pure minor descent
    const noteDuration = 0.22;
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const t = startTime + idx * noteDuration;
      this.playPureTone(freq, t, 0.36, 0.15, undefined, 2.0, 0.15);
    });
  }

  /**
   * 首领降临警报音效：深渊低频管风琴轰鸣 + 巴洛克减五度不协和警钟泛音
   */
  public playBossWarning(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const startTime = this.ctx.currentTime;

    // 1. Sub-bass abyssal pipe-organ drone (D2 -> D1)
    this.playPureTone(73.42, startTime, 1.45, 0.24, 36.71, 2.0, 0.28);
    this.playPureTone(110.0, startTime + 0.04, 1.35, 0.16, 73.42, 1.5, 0.22);

    // 2. Three ominous Gothic Sanctuary bell tolls (D4 -> Ab4 -> D4)
    const bellNotes = [293.66, 415.3, 293.66];
    bellNotes.forEach((freq, idx) => {
      const t = startTime + idx * 0.34;
      this.playPureTone(freq, t, 0.42, 0.14, freq * 0.98, 2.0, 0.2);
    });
  }

  /**
   * 首领讨伐终结圣音：恢弘时停低频震波 + 哥特大调辉煌加冕琶音
   */
  public playBossSlain(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const startTime = this.ctx.currentTime;
    // Deep time-dilation impact boom
    this.playExplosion(0.55, 620);

    // Majestic D-Major / Celestial fanfare chord arpeggio (D4 -> F#4 -> A4 -> D5 -> A5)
    const notes = [293.66, 369.99, 440.0, 587.33, 880.0];
    notes.forEach((freq, idx) => {
      const t = startTime + 0.08 + idx * 0.085;
      const isFinal = idx === notes.length - 1;
      this.playPureTone(freq, t, isFinal ? 0.85 : 0.42, isFinal ? 0.16 : 0.12, undefined, 2.0, 0.18);
    });
  }
}
