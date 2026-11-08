export type BGMTrack = 'TITLE' | 'BATTLE' | 'BOSS' | 'NONE';

/**
 * 六首哥特交响 / 暗潮 / 电影配乐曲目列表（默认以 BAROQUE 哥特交响开场，单首播放完毕后按 1->6 顺序循环往复播放）
 */
export type BGMStyle =
  | 'BAROQUE'
  | 'SYNTHWAVE'
  | 'CINEMATIC_EPIC'
  | 'GOTHIC_REQUIEM'
  | 'DARK_INDUSTRIAL'
  | 'CINEMATIC_NOCTURNE';

export const BGM_STYLE_ORDER: BGMStyle[] = [
  'BAROQUE',            // Ⅰ. 哥特交响 · 圣堂管风琴 (Gothic Symphony - 默认曲目)
  'SYNTHWAVE',          // Ⅱ. 暗潮脉动 · 夜行合成器 (Darkwave Pulse)
  'CINEMATIC_EPIC',     // Ⅲ. 电影交响 · 黯蚀史诗 (Cinematic Epic)
  'GOTHIC_REQUIEM',     // Ⅳ. 哥特安魂曲 · 绯红咏叹 (Gothic Requiem)
  'DARK_INDUSTRIAL',    // Ⅴ. 冷冽暗潮 · 机械深渊 (Cold Darkwave)
  'CINEMATIC_NOCTURNE'  // Ⅵ. 电影夜曲 · 星界审判 (Cinematic Nocturne)
];

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted = false;
  public bgmStyle: BGMStyle = 'BAROQUE'; // 默认以第 1 首「哥特交响」开场，播完后按六首顺序循环播放
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

  // --- 6-Track Sequential Gothic Symphony / Darkwave / Cinematic BGM Engine ---

  public cycleBGMStyle(): BGMStyle {
    const idx = BGM_STYLE_ORDER.indexOf(this.bgmStyle);
    this.bgmStyle = BGM_STYLE_ORDER[(idx + 1) % BGM_STYLE_ORDER.length];
    this.bgmStep = 0;
    if (this.currentTrack !== 'NONE') {
      this.updateBGMTempoInterval();
    }
    return this.bgmStyle;
  }

  public setBiomeBGMHint(_biomeIndex: number): void {
    // 保持六首曲目按既定顺序完整播放并循环，不因进出房间强行打断当前曲目
  }

  private getEffectiveBGMStyle(): BGMStyle {
    return this.bgmStyle;
  }

  private computeTargetBpm(track: BGMTrack, style: BGMStyle): number {
    const baseBpmMap: Record<BGMStyle, number> = {
      BAROQUE: 134,            // Ⅰ. 哥特交响
      SYNTHWAVE: 126,          // Ⅱ. 暗潮脉动
      CINEMATIC_EPIC: 128,     // Ⅲ. 电影史诗
      GOTHIC_REQUIEM: 122,     // Ⅳ. 哥特安魂曲
      DARK_INDUSTRIAL: 132,    // Ⅴ. 冷冽暗潮
      CINEMATIC_NOCTURNE: 118  // Ⅵ. 电影夜曲
    };
    const base = baseBpmMap[style] || 128;
    if (track === 'TITLE') return Math.round(base * 0.84);
    if (track === 'BOSS') return base + 6;
    return base;
  }

  private updateBGMTempoInterval(): void {
    if (this.currentTrack === 'NONE' || !this.ctx) return;
    const newBpm = this.computeTargetBpm(this.currentTrack, this.getEffectiveBGMStyle());
    if (this.bgmTimerId !== null && newBpm === this.bgmBpm) return;
    this.bgmBpm = newBpm;
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
    }
    const stepIntervalMs = (60 / this.bgmBpm / 4) * 1000; // 16th notes
    this.bgmTimerId = window.setInterval(() => {
      this.tickBGM();
    }, stepIntervalMs);
  }

  public playBGM(track: BGMTrack): void {
    if (this.currentTrack === track) return;

    const wasInGameplay = this.currentTrack === 'BATTLE' || this.currentTrack === 'BOSS';
    const isNowInGameplay = track === 'BATTLE' || track === 'BOSS';

    this.currentTrack = track;

    if (track === 'NONE') {
      this.stopBGM();
      return;
    }

    this.initContext();
    if (!this.ctx) return;

    // 在局内战斗与 Boss 战之间切换时，保持当前曲目的播放进度不断流，确保六首 BGM 顺序完整播放并循环
    if (!wasInGameplay || !isNowInGameplay) {
      this.bgmStep = 0;
    }

    this.updateBGMTempoInterval();
  }

  public stopBGM(): void {
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  private tickBGM(): void {
    if (!this.ctx || !this.bgmGain || this.isMuted) return;

    // 当一首曲目完整播放完一次（128 个十六分音符步长 = 完整 8 小节乐段）后，自动按顺序切换到下一首（1->2->3->4->5->6->1 循环往复）
    if (this.bgmStep > 0 && this.bgmStep % 128 === 0) {
      const curIdx = BGM_STYLE_ORDER.indexOf(this.bgmStyle);
      this.bgmStyle = BGM_STYLE_ORDER[(curIdx + 1) % BGM_STYLE_ORDER.length];
      this.updateBGMTempoInterval();
    }

    const t = this.ctx.currentTime;
    const step128 = this.bgmStep % 128; // 8-bar full musical structure per song
    const step = this.bgmStep % 64;
    this.bgmStep++;

    // Extended D-minor / Dorian / Harmonic Minor / Neapolitan pitch palette (Hz)
    const D2 = 73.42, Eb2 = 77.78, E2 = 82.41, F2 = 87.31, G2 = 98.0, A2 = 110.0, Bb2 = 116.54, C3 = 130.81, Cs3 = 138.59;
    const D3 = 146.83, Eb3 = 155.56, E3 = 164.81, F3 = 174.61, G3 = 196.0, A3 = 220.0, Bb3 = 233.08, C4 = 261.63, Cs4 = 277.18;
    const D4 = 293.66, Eb4 = 311.13, E4 = 329.63, F4 = 349.23, G4 = 392.0, A4 = 440.0, Bb4 = 466.16, C5 = 523.25, Cs5 = 554.37, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880.0;

    const style = this.getEffectiveBGMStyle();
    const isBoss = this.currentTrack === 'BOSS';

    // =========================================================================
    // 6-TRACK SEQUENTIAL PLAYLIST: Gothic Symphony, Darkwave & Cinematic Scores
    // =========================================================================
    switch (style) {
      // -----------------------------------------------------------------------
      // Ⅰ. BAROQUE: 哥特交响 · 圣堂管风琴 (Gothic Symphony: Cathedral Organ) [默认第 1 首]
      // -----------------------------------------------------------------------
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
            this.playWarmPadNote(cn, 1.3, 0.054);
          }
        }

        // Walking Baroque Contrabass (eighth notes)
        if (step % 2 === 0) {
          const walkBass = [
            D2, F2, A2, D3, G2, Bb2, D3, G2,
            A2, Cs3, E3, A2, D3, A2, F2, E2,
            Bb2, D3, F3, Bb2, G2, Bb2, E3, G2,
            A2, D3, F3, D3, A2, G2, F2, E2
          ];
          const bFreq = walkBass[Math.floor(step128 / 2) % walkBass.length];
          this.playFilteredBassNote(bFreq, 0.16, 0.145, 840);
        }

        // Orchestral percussion
        if (step % 8 === 0 || (isBoss && step % 8 === 6)) this.playDrumKick(t);
        if (step % 8 === 4) this.playDrumSnare(t);
        if (step % 2 === 1 && isBoss) this.playDrumHiHat(t);

        // Harpsichord 16th-note classical counterpoint + Gothic String Lead in Section B
        const harpsiA = [
          D5, A4, F4, A4, D5, E5, F5, D5,
          Bb4, G4, D4, G4, Bb4, C5, D5, Bb4,
          Cs5, A4, E4, A4, Cs5, D5, E5, Cs5,
          D5, A4, F4, E4, D4, F4, A4, C5
        ];
        const harpsiB = [
          Bb4, F4, D4, F4, Bb4, C5, D5, F5,
          E5, Bb4, G4, Bb4, E5, D5, C5, Bb4,
          A4, F4, D4, F4, A4, D5, F5, D5,
          Cs5, A4, E4, G4, A4, Cs5, E5, A4
        ];
        const hSeq = step128 < 64 ? harpsiA : harpsiB;
        const hNote = hSeq[step128 % hSeq.length];
        this.playFMBellNote(hNote, 0.14, 0.062);

        if (step128 >= 64 && step128 % 4 === 0) {
          const vLead = [D5, F5, E5, D5, Bb4, D5, C5, Bb4, A4, D5, F5, E5, Cs5, E5, A4, 0];
          const vn = vLead[Math.floor((step128 - 64) / 4) % vLead.length];
          if (vn > 0) this.playVibratoLeadNote(vn, 0.32, 'sawtooth', 0.058);
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Ⅱ. SYNTHWAVE: 暗潮脉动 · 夜行合成器 (Darkwave: Nocturnal Pulse) [第 2 首]
      // -----------------------------------------------------------------------
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
          this.playWarmPadNote(root * 2, 1.4, 0.052);
          this.playWarmPadNote(root * 3, 1.4, 0.045);
        }

        // Electronic Four-on-the-Floor Kick + Gated Snare
        if (step % 4 === 0) this.playDrumKick(t);
        if (step % 8 === 4) this.playDrumSnare(t);
        if (step % 2 === 1) this.playDrumHiHat(t);

        // Sparkling 16th-note Darkwave Pluck Arpeggio
        const arpIntervals = [2, 2.4, 3, 4, 3, 2.4, 2, 1.5];
        const arpFreq = root * 2 * arpIntervals[step % arpIntervals.length];
        this.playFilteredBassNote(arpFreq, 0.09, 0.055, 1800);

        // Brooding Darkwave Lead Melody across 8 bars
        if (step128 % 4 === 0) {
          const synthMelody = [
            A4, 0, G4, F4, D4, 0, F4, G4,
            A4, C5, D5, A4, G4, F4, E4, 0,
            F4, 0, G4, A4, Bb4, A4, G4, F4,
            E4, G4, A4, Cs5, D5, 0, 0, 0
          ];
          const mNote = synthMelody[Math.floor(step128 / 4) % synthMelody.length];
          if (mNote > 0) {
            this.playVibratoLeadNote(mNote, 0.34, 'sawtooth', 0.068);
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Ⅲ. CINEMATIC_EPIC: 电影交响 · 黯蚀史诗 (Cinematic Score: Eclipse Overture) [全新第 3 首]
      // -----------------------------------------------------------------------
      case 'CINEMATIC_EPIC': {
        // Hans Zimmer / Dark Souls style Epic Brass & Low Cello Ostinato
        const epicChords = [
          [D2, A2, D3, F3],
          [Bb2, F3, Bb3, D4],
          [G2, D3, G3, Bb3],
          [A2, E3, A3, Cs4],
          [D2, A2, D3, F3],
          [C3 * 0.5, G2, C3, E3],
          [Bb2, F3, Bb3, D4],
          [A2, E3, A3, Cs4]
        ];
        const bar = Math.floor(step128 / 16) % epicChords.length;
        const chord = epicChords[bar];

        // Massive Low Brass & String Swell at bar start
        if (step128 % 16 === 0) {
          for (const n of chord) {
            this.playWarmPadNote(n, 1.45, 0.056);
          }
        }

        // Tense 16th-note Spiccato Cello Ostinato (D-D-A-D-F-D-G-A...)
        const root = chord[0];
        const fifth = chord[1];
        const octave = chord[2];
        const third = chord[3];
        const spiccatoPattern = [root, root, octave, root, third, root, fifth, octave];
        const spicFreq = spiccatoPattern[step128 % spiccatoPattern.length];
        this.playFilteredBassNote(spicFreq, 0.10, step128 % 4 === 0 ? 0.155 : 0.095, step128 % 4 === 0 ? 980 : 620);

        // Booming Cinematic Taiko / Timpani Percussion
        if (step % 16 === 0 || step % 16 === 6 || step % 16 === 12 || (isBoss && step % 16 === 14)) {
          this.playDrumKick(t);
        }
        if (step % 8 === 4 || step % 16 === 15) {
          this.playDrumSnare(t);
        }

        // Soaring Heroic French Horn & Violin Melody (8-Bar Epic Theme)
        if (step128 % 2 === 0) {
          const epicTheme = [
            D4, 0, D4, 0, F4, 0, G4, A4, Bb4, 0, A4, 0, G4, F4, E4, D4,
            G4, 0, G4, 0, Bb4, 0, C5, D5, Cs5, 0, A4, 0, E4, F4, G4, E4,
            F4, 0, A4, 0, D5, 0, E5, F5, E5, 0, D5, C5, G4, 0, C5, Bb4,
            A4, 0, Bb4, A4, G4, F4, E4, D4, Cs4, 0, E4, G4, A4, 0, 0, 0
          ];
          const hornNote = epicTheme[Math.floor(step128 / 2) % epicTheme.length];
          if (hornNote > 0) {
            this.playVibratoLeadNote(hornNote, 0.24, 'sawtooth', 0.072);
            this.playWarmPadNote(hornNote * 0.5, 0.28, 0.045); // Horn lower octave body
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Ⅳ. GOTHIC_REQUIEM: 哥特安魂曲 · 绯红咏叹 (Gothic Requiem: Crimson Aria) [全新第 4 首]
      // -----------------------------------------------------------------------
      case 'GOTHIC_REQUIEM': {
        // Tragic Cathedral Choir & Neapolitan Minor Progression: Dm -> Gm -> Eb(bII) -> A7 -> Dm -> Bb -> Gm6 -> A7
        const requiemChords = [
          [D3, F3, A3, D4],
          [G2 * 2, Bb3, D4, G4],
          [Eb3, G3, Bb3, Eb4],
          [A2 * 2, Cs4, E4, G4],
          [D3, F3, A3, F4],
          [Bb2, D3, F3, D4],
          [G2 * 2, Bb3, E4, G4],
          [A2 * 2, Cs4, E4, A4]
        ];
        const bar = Math.floor(step128 / 16) % requiemChords.length;
        const rChord = requiemChords[bar];

        // Cathedral Choir & Pipe Organ Pad + Funeral Sanctuary Bell on Bar Downbeat
        if (step128 % 16 === 0) {
          for (const n of rChord) {
            this.playWarmPadNote(n, 1.48, 0.050);
          }
          // Sanctuary Bell Toll
          this.playFMBellNote(rChord[3] * 2, 0.85, 0.068);
        }

        // Flowing Baroque Waltz-Pulse Contrabass
        if (step % 4 === 0 || step % 4 === 3) {
          const bRoot = rChord[0] * 0.5;
          this.playFilteredBassNote(step % 4 === 0 ? bRoot : bRoot * 1.5, 0.22, 0.14, 720);
        }

        // Classical Broken-Chord Harpsichord / Pizzicato Arpeggio
        const arpOrder = [0, 1, 2, 3, 2, 1, 2, 3];
        const arpNote = rChord[arpOrder[step128 % arpOrder.length]];
        this.playFMBellNote(arpNote, 0.16, 0.048);

        if (step % 8 === 0) this.playDrumKick(t);
        if (step % 16 === 8) this.playDrumSnare(t);

        // Melancholic Solo Violin Crimson Aria (Expressive Harmonic Minor phrasing)
        if (step128 % 2 === 0) {
          const ariaMelody = [
            A4, 0, Bb4, A4, F4, 0, D4, 0, G4, 0, A4, Bb4, D5, 0, C5, Bb4,
            Eb4 * 2, 0, D5, C5, Bb4, 0, G4, 0, A4, 0, Cs5, D5, E5, 0, 0, 0,
            F5, 0, E5, D5, A4, 0, F4, 0, D5, 0, C5, Bb4, F4, 0, D4, 0,
            G4, A4, Bb4, D5, E5, 0, Bb4, G4, A4, 0, Cs5, E5, D5, 0, 0, 0
          ];
          const vNote = ariaMelody[Math.floor(step128 / 2) % ariaMelody.length];
          if (vNote > 0) {
            this.playVibratoLeadNote(vNote, 0.28, 'sawtooth', 0.074);
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Ⅴ. DARK_INDUSTRIAL: 冷冽暗潮 · 机械深渊 (Cold Darkwave: Abyssal EBM) [全新第 5 首]
      // -----------------------------------------------------------------------
      case 'DARK_INDUSTRIAL': {
        // Coldwave / Dark EBM 16th-Note Sequenced Bass Progression: Dm -> C -> Bb -> Am -> Gm -> Dm -> Eb -> A7
        const ebmRoots = [D2, C3 * 0.5, Bb2 * 0.5, A2 * 0.5, G2, D2, Eb2, A2];
        const bar = Math.floor(step128 / 16) % ebmRoots.length;
        const root = ebmRoots[bar];

        // Relentless 16th-note EBM Bass Sequencer with resonant accent pattern
        const seqMultipliers = [1, 1, 2, 1, 1.5, 1, 2, 1.5];
        const seqFreq = root * seqMultipliers[step128 % seqMultipliers.length];
        const isAccent = step128 % 4 === 0 || step128 % 8 === 6;
        this.playFilteredBassNote(seqFreq, 0.10, isAccent ? 0.165 : 0.115, isAccent ? 1350 : 760);

        // Cold Chorus Minor Pad Swell
        if (step128 % 16 === 0) {
          this.playWarmPadNote(root * 2, 1.35, 0.048);
          this.playWarmPadNote(root * 2.4, 1.35, 0.042);
        }

        // Driving Coldwave Drum Machine (Punchy 4x4 Kick + Metallic Snare + Crisp Offbeat Hat)
        if (step % 4 === 0) this.playDrumKick(t);
        if (step % 8 === 4 || (step128 % 32 === 30)) this.playDrumSnare(t);
        if (step % 2 === 1) this.playDrumHiHat(t);

        // Haunting Post-Punk / Cold Darkwave Lead Hook + Icy Bell Overtones
        if (step128 % 2 === 0) {
          const coldHook = [
            D4, F4, A4, 0, E5, 0, D5, A4, C4, E4, G4, 0, D5, 0, C5, G4,
            Bb3, D4, F4, 0, C5, 0, Bb4, F4, A3, C4, E4, 0, A4, G4, F4, E4,
            G3 * 2, Bb4, D5, 0, F5, 0, E5, D5, D4, F4, A4, 0, D5, 0, A4, F4,
            Eb4, G4, Bb4, 0, Eb4 * 2, D5, C5, Bb4, A4, 0, Cs5, 0, D5, 0, 0, 0
          ];
          const cNote = coldHook[Math.floor(step128 / 2) % coldHook.length];
          if (cNote > 0) {
            this.playVibratoLeadNote(cNote, 0.18, 'square', 0.060);
            this.playFMBellNote(cNote * 2, 0.12, 0.036);
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Ⅵ. CINEMATIC_NOCTURNE: 电影夜曲 · 星界审判 (Cinematic Nocturne: Astral Judgment) [全新第 6 首]
      // -----------------------------------------------------------------------
      case 'CINEMATIC_NOCTURNE': {
        // Atmospheric Dark Fantasy Film Score: Dm9 -> Bbmaj7#11 -> Gm9 -> A7b9
        const nocturnePads = [
          [D3, F3, A3, E4],
          [Bb2, D3, F3, E4],
          [G2 * 2, Bb3, D4, A4],
          [A2 * 2, Cs4, E4, Bb4]
        ];
        const padIdx = Math.floor(step128 / 32) % nocturnePads.length;
        const nPad = nocturnePads[padIdx];

        if (step128 % 16 === 0) {
          for (const pn of nPad) {
            this.playWarmPadNote(pn, 1.55, 0.048);
          }
          // Deep Cinematic Sub-Bass Swell
          this.playFilteredBassNote(nPad[0] * 0.5, 1.35, 0.155, 420);
        }

        // Hypnotic Celesta & Harp 16th-Note Cinematic Ostinato
        const ostinatoNotes = [
          D4, A4, E5, F5, A4, D5, C5, A4,
          Bb3, F4, C5, D5, F4, Bb4, A4, F4,
          G3 * 2, D4, A4, Bb4, D4, G4, F4, D4,
          A3, E4, Bb4, Cs5, E4, A4, G4, E4
        ];
        const ostNote = ostinatoNotes[step128 % ostinatoNotes.length];
        this.playFMBellNote(ostNote, 0.22, step128 % 4 === 0 ? 0.068 : 0.044);

        // Deep Heartbeat Cinematic Percussion
        if (step % 16 === 0 || step % 16 === 3 || step % 16 === 8) this.playDrumKick(t);
        if (step % 16 === 12) this.playDrumSnare(t);
        if (step % 4 === 2) this.playDrumHiHat(t);

        // Building Solo Cello -> High Orchestra Climax Counter-Melody
        if (step128 % 4 === 0) {
          const nocturneMelody = [
            // Bars 1-4: Warm Baritone Cello Register
            D3 * 2, 0, E4, F4, A4, 0, G4, F4,
            E4, 0, D4, C4, D4, 0, A3, 0,
            // Bars 5-8: High Orchestral String Climax
            D5, 0, E5, F5, A5, 0, G5, F5,
            E5, D5, Cs5, A4, D5, 0, 0, 0
          ];
          const nm = nocturneMelody[Math.floor(step128 / 4) % nocturneMelody.length];
          if (nm > 0) {
            this.playVibratoLeadNote(nm, 0.42, 'sawtooth', 0.068);
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
   * Pure Crystal Blade Parry Sound when deflecting enemy projectiles (Dual Set A / Set B random variation)
   */
  public playParry(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (t - this.lastParryTime < 0.055) return;
    this.lastParryTime = t;

    if (Math.random() < 0.5) {
      // Set A: Clean D-minor harmonic crystal ring (A5 -> D6)
      this.playPureTone(880.0, t, 0.085, 0.12, 1174.66, 2.0, 0.15);
    } else {
      // Set B: Crisp double-harmonic blade chime (D6 -> F6 -> A6)
      this.playPureTone(1174.66, t, 0.075, 0.11, 1396.91, 2.0, 0.14);
      this.playPureTone(1760.0, t + 0.028, 0.085, 0.10, undefined, 2.0, 0.12);
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
   * 升级交互音效（双套随机触发：Set A 纯五度八度三音泛音 / Set B 多利亚四音辉煌飞升琶音）
   */
  public playLevelUp(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const startTime = this.ctx.currentTime;
    const useSetB = Math.random() < 0.5;
    const notes = useSetB
      ? [293.66, 349.23, 440.0, 523.25, 587.33] // Set B: D4 -> F4 -> A4 -> C5 -> D5 (Dorian Ascension)
      : [293.66, 440.0, 587.33]; // Set A: D4 -> A4 -> D5 (Pure Fifth + Octave)
    const spacing = useSetB ? 0.058 : 0.075;

    notes.forEach((freq, idx) => {
      const t = startTime + idx * spacing;
      const isLast = idx === notes.length - 1;
      this.playPureTone(freq, t, isLast ? 0.36 : 0.20, isLast ? 0.13 : 0.10, undefined, 2.0, 0.15);
    });
  }

  /**
   * 道具宝箱开启交互音效（双套随机触发：Set A D大调水晶竖琴琶音 / Set B 天界颂钵五音华彩）
   */
  public playChestOpen(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const startTime = this.ctx.currentTime;
    const useSetB = Math.random() < 0.5;

    if (!useSetB) {
      // Set A: Warm D3 base + 4-note D-Major Crystal Harp Arpeggio (D4 -> F#4 -> A4 -> D5)
      this.playPureTone(146.83, startTime, 0.26, 0.15, 110.0, 2.0, 0.1);
      const notes = [293.66, 369.99, 440.0, 587.33];
      notes.forEach((freq, idx) => {
        const t = startTime + 0.03 + idx * 0.072;
        const isCrown = idx === notes.length - 1;
        this.playPureTone(freq, t, isCrown ? 0.42 : 0.24, isCrown ? 0.13 : 0.10, undefined, 2.0, 0.16);
      });
    } else {
      // Set B: Warm G3->A3 sub-chord + 5-note Celestial Bell Cascade (A4 -> B4 -> D5 -> F#5 -> A5)
      this.playPureTone(196.0, startTime, 0.28, 0.14, 220.0, 2.0, 0.1);
      const notes = [440.0, 493.88, 587.33, 739.99, 880.0];
      notes.forEach((freq, idx) => {
        const t = startTime + 0.025 + idx * 0.062;
        const isCrown = idx === notes.length - 1;
        this.playPureTone(freq, t, isCrown ? 0.45 : 0.22, isCrown ? 0.13 : 0.095, undefined, 2.0, 0.18);
      });
    }
  }

  /**
   * 出入传送门交互音效（双套随机触发：Set A 空灵五度上扬共鸣 / Set B 星界四度八度旋涡泛音）
   */
  public playPortalTransition(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const useSetB = Math.random() < 0.5;

    if (!useSetB) {
      // Set A: Smooth dimensional sub-sine glide (D3 -> A3) + pure fifth chime (A4 -> E5)
      this.playPureTone(146.83, t, 0.36, 0.16, 220.0, 2.0, 0.08);
      this.playPureTone(440.0, t + 0.04, 0.32, 0.10, 444.0, 2.0, 0.12);
      this.playPureTone(659.25, t + 0.10, 0.36, 0.11, 664.0, 2.0, 0.12);
    } else {
      // Set B: Astral vortex sub-drop (A3 -> D3) + 3-note fourth/octave shimmer (D4 -> G4 -> D5)
      this.playPureTone(220.0, t, 0.38, 0.15, 146.83, 2.0, 0.10);
      this.playPureTone(293.66, t + 0.03, 0.28, 0.095, undefined, 2.0, 0.14);
      this.playPureTone(392.0, t + 0.08, 0.30, 0.10, undefined, 2.0, 0.14);
      this.playPureTone(587.33, t + 0.13, 0.38, 0.11, 592.0, 2.0, 0.15);
    }
  }

  /**
   * 圣物祭坛 / 铁匠淬炼 / 诅咒血箱交互音效（每种交互均具备 Set A 与 Set B 两套随机音色）
   */
  public playShrineInteract(kind: 'RELIC' | 'FORGE' | 'CURSED' = 'RELIC'): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const useSetB = Math.random() < 0.5;

    if (kind === 'FORGE') {
      if (!useSetB) {
        // Set A: Pure resonant tuning-fork anvil fifth chime (D5 -> A5)
        this.playPureTone(587.33, t, 0.24, 0.13, undefined, 2.0, 0.22);
        this.playPureTone(880.0, t + 0.06, 0.32, 0.12, undefined, 2.0, 0.18);
      } else {
        // Set B: Deep smithy sub-strike (D3) + triple harmonic quench bell (A4 -> D5 -> F#5)
        this.playPureTone(146.83, t, 0.22, 0.14, 110.0, 1.5, 0.18);
        this.playPureTone(440.0, t + 0.02, 0.22, 0.11, undefined, 2.0, 0.20);
        this.playPureTone(587.33, t + 0.07, 0.26, 0.12, undefined, 2.0, 0.20);
        this.playPureTone(739.99, t + 0.12, 0.34, 0.11, undefined, 2.0, 0.18);
      }
      return;
    }

    if (kind === 'CURSED') {
      if (!useSetB) {
        // Set A: Deep, pure minor harmonic resonance (D3 -> Bb3 -> A3)
        this.playPureTone(146.83, t, 0.34, 0.15, undefined, 2.0, 0.12);
        this.playPureTone(233.08, t + 0.05, 0.32, 0.11, 220.0, 2.0, 0.12);
      } else {
        // Set B: Abyssal Neapolitan / Tritone blood-pact resonance (A2 -> Eb3 -> F3 -> D3)
        this.playPureTone(110.0, t, 0.38, 0.16, 73.42, 2.0, 0.15);
        this.playPureTone(311.13, t + 0.04, 0.26, 0.10, 293.66, 2.0, 0.14);
        this.playPureTone(220.0, t + 0.11, 0.34, 0.11, 146.83, 2.0, 0.12);
      }
      return;
    }

    // 'RELIC'
    if (!useSetB) {
      // Set A: Pure singing-bowl fifth & ninth (A4 -> D5 -> E5)
      const relicNotes = [440.0, 587.33, 659.25];
      relicNotes.forEach((rf, idx) => {
        this.playPureTone(rf, t + idx * 0.055, 0.32, 0.11, undefined, 2.0, 0.14);
      });
    } else {
      // Set B: Celestial Dorian four-note sanctuary chord (D4 -> A4 -> C5 -> F5)
      const relicNotesB = [293.66, 440.0, 523.25, 698.46];
      relicNotesB.forEach((rf, idx) => {
        this.playPureTone(rf, t + idx * 0.048, 0.34, 0.105, undefined, 2.0, 0.15);
      });
    }
  }

  /**
   * 道具拾取交互音效（金币、药剂、遗物均具备 Set A 与 Set B 两套随机音色）
   */
  public playItemPickup(kind: 'GOLD' | 'POTION' | 'RELIC_ITEM' = 'GOLD'): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const useSetB = Math.random() < 0.5;

    if (kind === 'GOLD') {
      if (t - this.lastGemTime < 0.038) return;
      this.lastGemTime = t;
      if (!useSetB) {
        // Set A: Clean two-note crystal bell (A5 -> D6)
        this.playPureTone(880.0, t, 0.08, 0.10, undefined, 2.0, 0.12);
        this.playPureTone(1174.66, t + 0.035, 0.11, 0.11, undefined, 2.0, 0.12);
      } else {
        // Set B: Bright three-note baroque coin chime (F5 -> A5 -> C6)
        this.playPureTone(698.46, t, 0.07, 0.095, undefined, 2.0, 0.12);
        this.playPureTone(880.0, t + 0.028, 0.08, 0.10, undefined, 2.0, 0.12);
        this.playPureTone(1046.5, t + 0.056, 0.11, 0.105, undefined, 2.0, 0.14);
      }
      return;
    }

    if (kind === 'POTION') {
      if (!useSetB) {
        // Set A: Warm 3-note restorative chord (D4 -> F4 -> A4)
        this.playPureTone(293.66, t, 0.16, 0.11, undefined, 2.0, 0.1);
        this.playPureTone(349.23, t + 0.045, 0.18, 0.11, undefined, 2.0, 0.1);
        this.playPureTone(440.0, t + 0.09, 0.24, 0.12, undefined, 2.0, 0.1);
      } else {
        // Set B: Soothing 4-note emerald spring cascade (G4 -> A4 -> C5 -> D5)
        const potNotes = [392.0, 440.0, 523.25, 587.33];
        potNotes.forEach((pf, idx) => {
          this.playPureTone(pf, t + idx * 0.038, 0.20, 0.105, undefined, 2.0, 0.11);
        });
      }
      return;
    }

    // 'RELIC_ITEM' (Magnet / Freeze Clock)
    if (!useSetB) {
      // Set A: Pure harmonic fifth (D5 -> A5)
      this.playPureTone(587.33, t, 0.16, 0.11, undefined, 2.0, 0.12);
      this.playPureTone(880.0, t + 0.05, 0.22, 0.11, undefined, 2.0, 0.12);
    } else {
      // Set B: Radiant octave-fourth resonance (E5 -> A5 -> D6)
      this.playPureTone(659.25, t, 0.14, 0.10, undefined, 2.0, 0.12);
      this.playPureTone(880.0, t + 0.04, 0.16, 0.105, undefined, 2.0, 0.12);
      this.playPureTone(1174.66, t + 0.08, 0.24, 0.11, undefined, 2.0, 0.14);
    }
  }

  /**
   * 构筑卡牌选择 / UI 按钮交互确认（双套随机触发：Set A 温润五度双音 / Set B 清脆三音泛音）
   */
  public playUIConfirm(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (Math.random() < 0.5) {
      // Set A: Warm ascending fifth (D4 -> A4)
      this.playPureTone(293.66, t, 0.075, 0.10, undefined, 2.0, 0.1);
      this.playPureTone(440.0, t + 0.03, 0.11, 0.10, undefined, 2.0, 0.1);
    } else {
      // Set B: Crisp Dorian fourth-to-octave chime (E4 -> A4 -> D5)
      this.playPureTone(329.63, t, 0.065, 0.095, undefined, 2.0, 0.11);
      this.playPureTone(440.0, t + 0.026, 0.08, 0.095, undefined, 2.0, 0.11);
      this.playPureTone(587.33, t + 0.052, 0.11, 0.10, undefined, 2.0, 0.12);
    }
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
