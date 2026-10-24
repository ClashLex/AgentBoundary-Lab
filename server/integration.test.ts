import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import test from 'node:test';
import { io, type Socket } from 'socket.io-client';
import { REST, shiftPitch, type Pitch, type Slot } from '../src/shared/game.ts';
import type { Ack, JoinResponse, RoomView } from '../src/shared/protocol.ts';

async function waitFor(predicate: () => boolean, timeout = 8000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for server state.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function connect(url: string) {
  const socket = io(url, { transports: ['websocket'], reconnection: false });
  const state: { view?: RoomView } = {};
  socket.on('room:state', (view: RoomView) => { state.view = view; });
  socket.on('round:submit-pending', (_payload: unknown, acknowledge: (seen: boolean) => void) => acknowledge(true));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return { socket, state };
}

async function request<T>(socket: Socket, event: string, payload?: object): Promise<Ack<T>> {
  return payload === undefined
    ? socket.timeout(4000).emitWithAck(event)
    : socket.timeout(4000).emitWithAck(event, payload);
}

test('three real clients reconstruct, submit, replay, and reconnect', { timeout: 25000 }, async (context) => {
  const port = randomInt(32000, 57000);
  const url = 'http://localhost:' + port;
  let output = '';
  const child = spawn(process.execPath, ['--experimental-strip-types', 'server/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  const sockets: Socket[] = [];
  context.after(() => {
    sockets.forEach((socket) => socket.disconnect());
    child.kill();
  });
  await waitFor(() => output.includes('is ready on'), 12000).catch(() => {
    throw new Error('Server did not start: ' + output);
  });
  assert.equal((await fetch(url + '/health')).status, 200);

  const host = await connect(url);
  const rhythm = await connect(url);
  const melody = await connect(url);
  sockets.push(host.socket, rhythm.socket, melody.socket);
  const created = await request<JoinResponse>(host.socket, 'room:create');
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const code = created.data.view.code;
  const joinedRhythm = await request<JoinResponse>(rhythm.socket, 'room:join', { code });
  const joinedMelody = await request<JoinResponse>(melody.socket, 'room:join', { code });
  assert.equal(joinedRhythm.ok, true);
  assert.equal(joinedMelody.ok, true);
  if (!joinedRhythm.ok || !joinedMelody.ok) return;
  await waitFor(() => Boolean(host.state.view && rhythm.state.view && melody.state.view));
  assert.deepEqual([
    host.state.view?.role,
    rhythm.state.view?.role,
    melody.state.view?.role
  ], ['conductor', 'rhythm_keeper', 'melodist']);
  assert.deepEqual(Object.keys(host.state.view!.clue), ['stepsBack']);
  assert.deepEqual(Object.keys(rhythm.state.view!.clue), ['notes']);
  assert.deepEqual(Object.keys(melody.state.view!.clue), ['shiftedNotes']);
  assert.equal(JSON.stringify(host.state.view).includes('"target"'), false);

  for (const client of [host, rhythm, melody]) {
    assert.equal((await request(client.socket, 'player:ready', { ready: true })).ok, true);
  }
  assert.equal((await request(host.socket, 'round:start', {})).ok, true);
  await waitFor(() => [host, rhythm, melody].every((client) => client.state.view?.phase === 'playing'));
  assert.equal((await request(rhythm.socket, 'board:update', { slot: 1, value: REST })).ok, false);
  assert.equal((await request(rhythm.socket, 'signal:send', { kind: 'status', slot: 1 })).ok, true);
  assert.equal((await request(melody.socket, 'signal:send', { kind: 'shifted', noteIndex: 1 })).ok, true);
  assert.equal((await request(host.socket, 'chat:send', { text: 'Let us decode the melody.' })).ok, true);
  await waitFor(() => host.state.view?.messages.length === 3);

  const notes = (rhythm.state.view!.clue as { notes: boolean[] }).notes;
  const shifted = [...(melody.state.view!.clue as { shiftedNotes: Pitch[] }).shiftedNotes];
  const stepsBack = (host.state.view!.clue as { stepsBack: number }).stepsBack;
  const answer: Slot[] = notes.map((hasNote) =>
    hasNote ? shiftPitch(shifted.shift()!, -stepsBack) : REST
  );
  for (let index = 0; index < answer.length; index += 1) {
    assert.equal((await request(host.socket, 'board:update', { slot: index + 1, value: answer[index] })).ok, true);
  }
  assert.equal((await request(host.socket, 'round:submit-request', {})).ok, true);
  await waitFor(() => [host, rhythm, melody].every((client) => client.state.view?.pendingSubmission));
  assert.equal((await request(melody.socket, 'round:submit-confirm', {})).ok, false);
  assert.equal((await request(host.socket, 'round:submit-confirm', {})).ok, true);
  await waitFor(() => [host, rhythm, melody].every((client) => client.state.view?.phase === 'results'));
  assert.equal(host.state.view?.result?.points, 8);
  assert.deepEqual(host.state.view?.result?.target, answer);
  assert.equal((await request(host.socket, 'round:replay', {})).ok, true);
  await waitFor(() => host.state.view?.phase === 'lobby' && host.state.view.board.every((slot) => slot === null));

  const oldToken = joinedRhythm.data.token;
  rhythm.socket.disconnect();
  await waitFor(() => host.state.view?.phase === 'paused');
  const rhythmReturn = await connect(url);
  sockets.push(rhythmReturn.socket);
  const restored = await request<JoinResponse>(rhythmReturn.socket, 'player:reconnect', { code, token: oldToken });
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.data.view.role, 'rhythm_keeper');
  assert.notEqual(restored.data.token, oldToken);
  await waitFor(() => host.state.view?.phase === 'lobby');
  assert.equal((await request(rhythmReturn.socket, 'room:leave')).ok, true);
  await waitFor(() => host.state.view?.players.length === 2);
  const replacement = await connect(url);
  sockets.push(replacement.socket);
  const replacementJoin = await request<JoinResponse>(replacement.socket, 'room:join', { code });
  assert.equal(replacementJoin.ok, true);
  if (replacementJoin.ok) assert.equal(replacementJoin.data.view.role, 'rhythm_keeper');
});
