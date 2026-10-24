import assert from 'node:assert/strict';
import test from 'node:test';
import { REST, makeClues } from '../src/shared/game.ts';
import { RoomError, RoomManager } from './rooms.ts';

function setup() {
  let time = 1_000_000;
  const manager = new RoomManager(() => time);
  const host = manager.create();
  const rhythm = manager.join(host.room.code);
  const melody = manager.join(host.room.code);
  const players = [host.player, rhythm.player, melody.player];
  return {
    manager,
    room: host.room,
    players,
    advance: (milliseconds: number) => { time += milliseconds; }
  };
}

test('roles are unique, clues are isolated, and only a ready host can start', () => {
  const { manager, room, players } = setup();
  assert.deepEqual(players.map((player) => player.role), [
    'conductor', 'rhythm_keeper', 'melodist'
  ]);
  assert.throws(() => manager.join(room.code), RoomError);
  assert.throws(() => manager.start(players[0].id), RoomError);
  const views = players.map((player) => manager.view(room, player.id));
  const clueKeys = views.map((view) => Object.keys(view.clue));
  assert.deepEqual(clueKeys, [['stepsBack'], ['notes'], ['shiftedNotes']]);
  for (const view of views) {
    const payload = JSON.stringify(view);
    assert.equal(payload.includes(room.target.seed), false);
    assert.equal(payload.includes('"target"'), false);
    assert.equal(payload.includes('"shift"'), false);
    assert.equal(payload.includes('"token"'), false);
  }
  players.forEach((player) => manager.setReady(player.id, true));
  manager.start(players[0].id);
  assert.equal(room.phase, 'playing');
});

test('the Conductor alone edits and exact submission reveals one result', () => {
  const { manager, room, players } = setup();
  players.forEach((player) => manager.setReady(player.id, true));
  manager.start(players[0].id);
  assert.throws(() => manager.updateBoard(players[1].id, 1, REST), RoomError);
  assert.throws(() => manager.requestSubmission(players[1].id), RoomError);
  room.target.slots.forEach((slot, index) => manager.updateBoard(players[0].id, index + 1, slot));
  manager.requestSubmission(players[0].id);
  assert.equal(manager.view(room, players[1].id).pendingSubmission, true);
  assert.throws(() => manager.updateBoard(players[0].id, 1, REST), RoomError);
  assert.throws(() => manager.confirmSubmission(players[0].id), RoomError);
  manager.markSubmissionReady(players[0].id);
  manager.confirmSubmission(players[0].id);
  assert.equal(room.phase, 'results');
  assert.equal(room.result?.points, 8);
  assert.deepEqual(manager.view(room, players[2].id).result?.target, room.target.slots);
  assert.throws(() => manager.confirmSubmission(players[0].id), RoomError);

  const originalSeed = room.target.seed;
  manager.advance(players[0].id, false);
  assert.equal(room.phase, 'lobby');
  assert.deepEqual(room.board, Array(8).fill(null));
  assert.equal(room.result, undefined);
  assert.equal(room.target.seed, originalSeed);
});

test('signals share one allowed clue and chat is bounded and rate limited', () => {
  const { manager, room, players, advance } = setup();
  assert.throws(() => manager.sendSignal(players[1].id, { kind: 'shifted', noteIndex: 1 }), RoomError);
  manager.sendSignal(players[1].id, { kind: 'status', slot: 1 });
  const expected = makeClues(room.target).rhythm_keeper.notes[0] ? 'a Note' : 'a Rest';
  assert.ok(room.messages[0].text.includes(expected));
  manager.sendSignal(players[2].id, { kind: 'shifted', noteIndex: 1 });
  manager.sendSignal(players[0].id, { kind: 'check', slot: 1 });
  manager.sendChat(players[0].id, '<b>Can you check?</b>');
  assert.equal(room.messages.at(-1)?.text, '<b>Can you check?</b>');
  for (let index = 0; index < 4; index += 1) manager.sendChat(players[2].id, 'Message ' + index);
  assert.throws(() => manager.sendChat(players[2].id, 'Too fast'), RoomError);
  advance(10_001);
  manager.sendChat(players[2].id, 'Allowed again');
  assert.throws(() => manager.sendChat(players[2].id, 'x'.repeat(241)), RoomError);
});

test('disconnect pauses, valid token restores, and an expired player can be aborted', () => {
  const { manager, room, players, advance } = setup();
  players.forEach((player) => manager.setReady(player.id, true));
  manager.start(players[0].id);
  const token = players[1].token;
  manager.disconnect(players[1].id);
  assert.equal(room.phase, 'paused');
  assert.throws(() => manager.updateBoard(players[0].id, 1, REST), RoomError);
  assert.throws(() => manager.reconnect(room.code, 'wrong'), RoomError);
  advance(59_000);
  manager.reconnect(room.code, token);
  assert.equal(room.phase, 'playing');
  assert.notEqual(players[1].token, token);

  manager.disconnect(players[0].id);
  advance(60_001);
  assert.throws(() => manager.reconnect(room.code, players[0].token), RoomError);
  manager.expireGrace();
  assert.deepEqual(manager.expireGrace(), []);
  assert.equal(room.hostPlayerId, players[1].id);
  assert.equal(manager.view(room, players[1].id).canAbort, true);
  manager.abort(players[1].id);
  assert.equal(room.phase, 'ended');
  assert.equal(room.result, undefined);
});
