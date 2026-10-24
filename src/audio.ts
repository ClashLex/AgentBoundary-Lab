import { REST, TEMPO_BPM, type CandidateSlot, type Pitch } from './shared/game.ts';

const FREQUENCIES: Record<Pitch, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0
};

const START_DELAY_MS = 80;

export class AudioEngine {
  private context: AudioContext | null = null;
  private sources = new Set<OscillatorNode>();
  private timers: number[] = [];
  private generation = 0;
  private muted = false;

  setMuted(value: boolean) {
    this.muted = value;
    if (value) this.stop();
  }

  isMuted() {
    return this.muted;
  }

  stop() {
    this.generation += 1;
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
    for (const source of this.sources) {
      try { source.stop(); } catch { /* A finished source is already silent. */ }
    }
    this.sources.clear();
  }

  async play(
    slots: CandidateSlot[],
    kind: 'melody' | 'rhythm',
    onStep: (index: number | null) => void,
    onDone: () => void
  ) {
    this.stop();
    if (this.muted) return false;
    const BrowserAudioContext = window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!BrowserAudioContext) throw new Error('Audio playback is unavailable in this browser.');
    if (!this.context || this.context.state === 'closed') this.context = new BrowserAudioContext();
    const generation = this.generation;
    const context = this.context;

    // Start a silent source during the click so browser gesture policies can unlock audio.
    if (context.state !== 'running') {
      const unlock = context.createOscillator();
      const silent = context.createGain();
      silent.gain.value = 0;
      unlock.connect(silent).connect(context.destination);
      unlock.start();
      unlock.stop(context.currentTime + 0.01);
      unlock.onended = () => this.sources.delete(unlock);
      this.sources.add(unlock);
    }

    let unlockTimer: number | undefined;
    try {
      await Promise.race([
        context.state === 'running' ? Promise.resolve() : context.resume(),
        new Promise<never>((_resolve, reject) => {
          unlockTimer = window.setTimeout(() => reject(new Error('Audio did not start. Tap Test tone, then check this tab and your device volume.')), 3000);
        })
      ]);
      if (generation !== this.generation) return false;
      if (context.state !== 'running') {
        throw new Error('Audio is blocked in this browser. Check this tab’s sound permission, then tap Test tone.');
      }
    } catch (error) {
      if (generation !== this.generation) return false;
      this.stop();
      throw error;
    } finally {
      if (unlockTimer !== undefined) window.clearTimeout(unlockTimer);
    }

    const beat = 60 / TEMPO_BPM;
    const startsAt = context.currentTime + START_DELAY_MS / 1000;
    slots.forEach((slot, index) => {
      this.timers.push(window.setTimeout(() => {
        if (generation === this.generation) onStep(index);
      }, START_DELAY_MS + index * beat * 1000));
      if (slot === null || slot === REST) return;
      const starts = startsAt + index * beat;
      const duration = kind === 'rhythm' ? 0.12 : beat * 0.76;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = kind === 'rhythm' ? 'square' : 'triangle';
      oscillator.frequency.setValueAtTime(kind === 'rhythm' ? 880 : FREQUENCIES[slot], starts);
      envelope.gain.setValueAtTime(0, starts);
      envelope.gain.linearRampToValueAtTime(kind === 'rhythm' ? 0.2 : 0.3, starts + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.001, starts + duration);
      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(starts);
      oscillator.stop(starts + duration + 0.01);
      oscillator.onended = () => this.sources.delete(oscillator);
      this.sources.add(oscillator);
    });
    this.timers.push(window.setTimeout(() => {
      if (generation !== this.generation) return;
      onStep(null);
      onDone();
      this.stop();
    }, START_DELAY_MS + slots.length * beat * 1000));
    return true;
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}
