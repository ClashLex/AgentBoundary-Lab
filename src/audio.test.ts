import assert from 'node:assert/strict';
import test from 'node:test';
import { AudioEngine } from './audio.ts';
import { REST } from './shared/game.ts';

class FakeOscillator {
  type = 'sine';
  frequencyValue = 0;
  startTime: number | undefined;
  onended: (() => void) | null = null;
  frequency = { setValueAtTime: (value: number) => { this.frequencyValue = value; } };
  connect(gain: FakeGain) { return gain; }
  start(time?: number) { this.startTime = time; }
  stop() { /* The fake records only scheduling. */ }
}

class FakeGain {
  private destination: object;
  gain = {
    value: 1,
    peak: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: (value: number) => { this.gain.peak = value; },
    exponentialRampToValueAtTime: () => {}
  };
  constructor(destination: object) { this.destination = destination; }
  connect(destination: object) {
    assert.equal(destination, this.destination);
    return destination;
  }
}

class FakeAudioContext {
  static latest: FakeAudioContext;
  state = 'suspended';
  currentTime = 1;
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  constructor() { FakeAudioContext.latest = this; }
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const gain = new FakeGain(this.destination);
    this.gains.push(gain);
    return gain;
  }
  async resume() {
    assert.equal(this.oscillators.length, 1, 'a source starts before resume');
    assert.equal(this.gains[0].gain.value, 0, 'the unlock source is silent');
    this.state = 'running';
  }
  async close() { this.state = 'closed'; }
}

test('audio unlocks on the click and schedules audible notes, rests, and rhythm', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      AudioContext: FakeAudioContext,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout
    }
  });
  try {
    const engine = new AudioEngine();
    assert.equal(await engine.play(['C4', REST, 'A4'], 'melody', () => {}, () => {}), true);
    const context = FakeAudioContext.latest;
    assert.equal(context.state, 'running');
    assert.deepEqual(context.oscillators.slice(1).map((source) => source.frequencyValue), [261.63, 440]);
    assert.deepEqual(context.gains.slice(1).map((gain) => gain.gain.peak), [0.3, 0.3]);
    engine.stop();

    assert.equal(await engine.play(['C4', REST], 'rhythm', () => {}, () => {}), true);
    assert.equal(context.oscillators.at(-1)?.frequencyValue, 880);
    assert.equal(context.gains.at(-1)?.gain.peak, 0.2);
    engine.setMuted(true);
    const count = context.oscillators.length;
    assert.equal(await engine.play(['C4'], 'melody', () => {}, () => {}), false);
    assert.equal(context.oscillators.length, count);
    engine.dispose();
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
