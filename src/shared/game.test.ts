import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PITCHES,
  REST,
  createTarget,
  isComplete,
  makeClues,
  scoreAnswer,
  shiftPitch
} from './game.ts';

test('a seed always gives the same valid target and clues', () => {
  for (let index = 0; index < 100; index += 1) {
    const seed = 'round-' + index;
    const target = createTarget(seed);
    assert.deepEqual(createTarget(seed), target);
    assert.equal(target.slots.length, 8);
    assert.ok(target.shift >= 1 && target.shift <= 4);
    const notes = target.slots.filter((slot) => slot !== REST);
    assert.ok(notes.length >= 4 && notes.length <= 7);
    assert.ok(target.slots.slice(0, 4).some((slot) => slot !== REST));
    assert.ok(target.slots.slice(4).some((slot) => slot !== REST));
    assert.ok(new Set(notes).size > 1);
    assert.deepEqual(makeClues(createTarget(seed)), makeClues(target));
  }
});

test('the three clues recover exactly the target', () => {
  const target = createTarget('joint-clues');
  const clues = makeClues(target);
  const recovered = [...clues.melodist.shiftedNotes];
  const slots = clues.rhythm_keeper.notes.map((hasNote) =>
    hasNote ? shiftPitch(recovered.shift()!, -clues.conductor.stepsBack) : REST
  );
  assert.deepEqual(slots, target.slots);
  assert.equal(recovered.length, 0);
});

test('the score counts exact slots, including rests, and rejects unanswered slots', () => {
  const target = createTarget('scoring');
  assert.equal(scoreAnswer(target, [...target.slots]).points, 8);
  const changed = [...target.slots];
  changed[0] = changed[0] === REST ? PITCHES[0] : REST;
  const result = scoreAnswer(target, changed);
  assert.equal(result.points, 7);
  assert.equal(result.matches[0], false);
  assert.equal(isComplete([...target.slots.slice(0, 7), null]), false);
});
