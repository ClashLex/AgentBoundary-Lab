export const PITCHES = ['C4', 'D4', 'E4', 'G4', 'A4'] as const;
export const REST = 'REST' as const;
export const SLOT_COUNT = 8;
export const TEMPO_BPM = 100;

export type Pitch = (typeof PITCHES)[number];
export type Slot = Pitch | typeof REST;
export type CandidateSlot = Slot | null;
export type Shift = 1 | 2 | 3 | 4;
export type Role = 'conductor' | 'rhythm_keeper' | 'melodist';
export type Phase = 'lobby' | 'playing' | 'paused' | 'results' | 'ended';

export interface Target {
  seed: string;
  slots: Slot[];
  shift: Shift;
}

export interface Clues {
  rhythm_keeper: { notes: boolean[] };
  melodist: { shiftedNotes: Pitch[] };
  conductor: { stepsBack: Shift };
}

export interface Result {
  points: number;
  matches: boolean[];
  submitted: Slot[];
  target: Slot[];
}

export const isPitch = (value: unknown): value is Pitch =>
  typeof value === 'string' && (PITCHES as readonly string[]).includes(value);

export const isSlot = (value: unknown): value is Slot =>
  value === REST || isPitch(value);

export const isComplete = (slots: unknown): slots is Slot[] =>
  Array.isArray(slots) && slots.length === SLOT_COUNT && slots.every(isSlot);

export const pitchLabel = (slot: CandidateSlot): string =>
  slot === null ? '?' : slot === REST ? 'Rest' : slot.slice(0, -1);

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function shiftPitch(pitch: Pitch, steps: number): Pitch {
  const index = PITCHES.indexOf(pitch);
  return PITCHES[((index + steps) % PITCHES.length + PITCHES.length) % PITCHES.length];
}

export function createTarget(seed: string): Target {
  if (!seed) throw new Error('A puzzle seed is required.');
  const random = seededRandom(seed);
  const noteCount = 4 + Math.floor(random() * 4);
  const positions = [
    Math.floor(random() * 4),
    4 + Math.floor(random() * 4)
  ];
  const remaining = shuffle(
    Array.from({ length: SLOT_COUNT }, (_, index) => index).filter(
      (index) => !positions.includes(index)
    ),
    random
  );
  positions.push(...remaining.slice(0, noteCount - 2));
  const slots: Slot[] = Array(SLOT_COUNT).fill(REST);
  for (const position of positions) {
    slots[position] = PITCHES[Math.floor(random() * PITCHES.length)];
  }
  const sounding = positions.sort((a, b) => a - b);
  if (sounding.every((position) => slots[position] === slots[sounding[0]])) {
    const last = sounding[sounding.length - 1];
    slots[last] = shiftPitch(slots[last] as Pitch, 1);
  }
  const shift = (1 + Math.floor(random() * 4)) as Shift;
  return { seed, slots, shift };
}

export function makeClues(target: Target): Clues {
  return {
    rhythm_keeper: { notes: target.slots.map((slot) => slot !== REST) },
    melodist: {
      shiftedNotes: target.slots
        .filter(isPitch)
        .map((pitch) => shiftPitch(pitch, target.shift))
    },
    conductor: { stepsBack: target.shift }
  };
}

export function scoreAnswer(target: Target, submitted: Slot[]): Result {
  if (!isComplete(submitted)) throw new Error('All eight slots need a pitch or Rest.');
  const matches = submitted.map((slot, index) => slot === target.slots[index]);
  return {
    points: matches.filter(Boolean).length,
    matches,
    submitted: [...submitted],
    target: [...target.slots]
  };
}

export function emptyBoard(): CandidateSlot[] {
  return Array(SLOT_COUNT).fill(null);
}
