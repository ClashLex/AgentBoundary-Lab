import { randomBytes, randomUUID } from 'node:crypto';
import {
  createTarget,
  emptyBoard,
  isComplete,
  isSlot,
  makeClues,
  pitchLabel,
  scoreAnswer,
  type CandidateSlot,
  type Phase,
  type Result,
  type Role,
  type Slot,
  type Target
} from '../src/shared/game.ts';
import type { RoomMessage, RoomView } from '../src/shared/protocol.ts';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const RECONNECT_MS = 60_000;
const ROOM_TTL_MS = 30 * 60_000;
const CHAT_LIMIT = 240;
const CHAT_HISTORY = 50;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 5;
const JOIN_ROLES: Role[] = ['conductor', 'rhythm_keeper', 'melodist'];

export class RoomError extends Error {}

export interface Player {
  id: string;
  token: string;
  nickname: string;
  role: Role;
  connected: boolean;
  ready: boolean;
  reconnectUntil?: number;
  graceExpiredNotified?: boolean;
  sendTimes: number[];
}

export interface Room {
  code: string;
  hostPlayerId: string;
  phase: Phase;
  pausedFrom?: 'lobby' | 'playing' | 'results';
  players: Player[];
  target: Target;
  board: CandidateSlot[];
  messages: RoomMessage[];
  pending?: { slots: Slot[]; requestedAt: number; ready: boolean };
  result?: Result;
  roundNumber: number;
  createdAt: number;
  lastActivityAt: number;
}

export interface JoinResult {
  room: Room;
  player: Player;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RoomError(message);
}

function validCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(value);
}

function validIndex(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maximum;
}

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  create(): JoinResult {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const time = this.now();
    const player = this.newPlayer('conductor', 1);
    const room: Room = {
      code,
      hostPlayerId: player.id,
      phase: 'lobby',
      players: [player],
      target: createTarget(randomUUID()),
      board: emptyBoard(),
      messages: [],
      roundNumber: 1,
      createdAt: time,
      lastActivityAt: time
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  join(rawCode: unknown): JoinResult {
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : rawCode;
    assert(validCode(code), 'Enter a valid six-character room code.');
    const room = this.rooms.get(code);
    assert(room, 'No active room was found for that code.');
    assert(room.phase === 'lobby', 'This room is no longer accepting new players.');
    const role = JOIN_ROLES.find((candidate) => !room.players.some((player) => player.role === candidate));
    assert(role, 'This room is full.');
    const player = this.newPlayer(role, room.players.length + 1);
    room.players.push(player);
    this.touch(room);
    return { room, player };
  }

  reconnect(rawCode: unknown, token: unknown): JoinResult {
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : rawCode;
    assert(validCode(code) && typeof token === 'string', 'A room code and session token are required.');
    const room = this.rooms.get(code);
    assert(room, 'That room has expired. Please create a new room.');
    const player = room.players.find((entry) => entry.token === token);
    assert(player, 'Your saved room session is not valid.');
    assert(player.connected || (player.reconnectUntil !== undefined && this.now() < player.reconnectUntil),
      'The 60-second rejoin window has ended.');
    player.connected = true;
    player.reconnectUntil = undefined;
    player.graceExpiredNotified = undefined;
    player.token = randomBytes(24).toString('base64url');
    if (room.phase === 'paused' && room.players.every((entry) => entry.connected)) {
      room.phase = room.pausedFrom ?? 'playing';
      room.pausedFrom = undefined;
    }
    this.touch(room);
    return { room, player };
  }

  findByPlayer(playerId: string): { room: Room; player: Player } {
    for (const room of this.rooms.values()) {
      const player = room.players.find((entry) => entry.id === playerId);
      if (player) return { room, player };
    }
    throw new RoomError('Your room is no longer available.');
  }

  view(room: Room, playerId: string): RoomView {
    const player = room.players.find((entry) => entry.id === playerId);
    assert(player, 'Player not found in this room.');
    const clues = makeClues(room.target);
    const time = this.now();
    return {
      code: room.code,
      phase: room.phase,
      pausedFrom: room.pausedFrom,
      roundNumber: room.roundNumber,
      role: player.role,
      playerId: player.id,
      players: room.players.map((entry) => ({
        id: entry.id,
        nickname: entry.nickname,
        role: entry.role,
        connected: entry.connected,
        ready: entry.ready,
        isHost: entry.id === room.hostPlayerId,
        reconnectUntil: !entry.connected ? entry.reconnectUntil : undefined
      })),
      board: [...room.board],
      clue: clues[player.role],
      messages: [...room.messages],
      pendingSubmission: Boolean(room.pending),
      canConfirmSubmission: Boolean(room.pending?.ready),
      result: room.phase === 'results' || room.pausedFrom === 'results' ? room.result : undefined,
      canAbort: room.phase === 'paused' && room.hostPlayerId === player.id &&
        room.players.some((entry) => !entry.connected && (entry.reconnectUntil ?? 0) <= time)
    };
  }

  setReady(playerId: string, ready: unknown): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(room.phase === 'lobby', 'Readiness can only change in the lobby.');
    assert(typeof ready === 'boolean', 'Ready must be true or false.');
    player.ready = ready;
    this.touch(room);
    return room;
  }

  start(playerId: string): Room {
    const { room } = this.findByPlayer(playerId);
    this.assertHost(room, playerId);
    assert(room.phase === 'lobby', 'This round cannot be started now.');
    assert(room.players.length === 3 && room.players.every((player) => player.connected && player.ready),
      'All three players must be connected and ready.');
    room.phase = 'playing';
    this.touch(room);
    return room;
  }

  updateBoard(playerId: string, slot: unknown, value: unknown): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(player.role === 'conductor', 'Only the Conductor can edit the composition.');
    assert(room.phase === 'playing', 'The composition is not editable now.');
    assert(!room.pending, 'Confirm or cancel the pending submission first.');
    assert(validIndex(slot, 8), 'Choose a slot from 1 to 8.');
    assert(value === null || isSlot(value), 'Choose a pitch, Rest, or Unanswered.');
    room.board[slot - 1] = value;
    this.touch(room);
    return room;
  }

  sendChat(playerId: string, rawText: unknown): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(room.phase !== 'ended' && player.connected, 'Chat is unavailable in this room.');
    assert(typeof rawText === 'string', 'Message text is required.');
    const text = rawText.trim();
    assert(text.length > 0 && text.length <= CHAT_LIMIT, 'Keep messages between 1 and 240 characters.');
    this.addMessage(room, player, text, 'chat');
    return room;
  }

  sendSignal(playerId: string, raw: unknown): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(room.phase !== 'ended' && player.connected, 'Signals are unavailable in this room.');
    assert(raw !== null && typeof raw === 'object', 'Choose a valid signal.');
    const payload = raw as Record<string, unknown>;
    const clues = makeClues(room.target);
    let text: string | undefined;
    if (player.role === 'rhythm_keeper' && payload.kind === 'status' && validIndex(payload.slot, 8)) {
      text = 'Slot ' + payload.slot + ' is ' +
        (clues.rhythm_keeper.notes[payload.slot - 1] ? 'a Note' : 'a Rest') + '.';
    } else if (player.role === 'melodist' && payload.kind === 'shifted' &&
      validIndex(payload.noteIndex, clues.melodist.shiftedNotes.length)) {
      const pitch = clues.melodist.shiftedNotes[payload.noteIndex - 1];
      text = 'Shifted note ' + payload.noteIndex + ' is ' + pitchLabel(pitch) + '.';
    } else if (player.role === 'conductor' && payload.kind === 'check' && validIndex(payload.slot, 8)) {
      text = 'Can we check slot ' + payload.slot + '?';
    }
    assert(text, 'That signal is not available for your role.');
    this.addMessage(room, player, text, 'signal');
    return room;
  }

  requestSubmission(playerId: string): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(player.role === 'conductor', 'Only the Conductor can submit.');
    assert(room.phase === 'playing', 'This round cannot be submitted now.');
    assert(room.players.length === 3 && room.players.every((entry) => entry.connected),
      'All players must be connected to submit.');
    assert(!room.pending, 'An answer is already pending confirmation.');
    assert(isComplete(room.board), 'Fill all eight slots with a pitch or Rest.');
    room.pending = { slots: [...room.board], requestedAt: this.now(), ready: false };
    this.touch(room);
    return room;
  }

  markSubmissionReady(playerId: string): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(player.role === 'conductor' && room.phase === 'playing' && room.pending,
      'There is no pending submission.');
    assert(room.players.every((entry) => entry.connected),
      'A player disconnected before the answer was shown.');
    room.pending.ready = true;
    this.touch(room);
    return room;
  }

  confirmSubmission(playerId: string): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(player.role === 'conductor', 'Only the Conductor can confirm.');
    assert(room.phase === 'playing' && room.pending, 'There is no answer to confirm.');
    assert(room.pending.ready, 'Wait until every player sees the pending answer.');
    assert(room.players.every((entry) => entry.connected), 'The room paused before confirmation.');
    room.result = scoreAnswer(room.target, room.pending.slots);
    room.pending = undefined;
    room.phase = 'results';
    this.touch(room);
    return room;
  }

  cancelSubmission(playerId: string): Room {
    const { room, player } = this.findByPlayer(playerId);
    assert(player.role === 'conductor' && room.phase === 'playing' && room.pending,
      'There is no answer to cancel.');
    room.pending = undefined;
    this.touch(room);
    return room;
  }

  advance(playerId: string, fresh: boolean): Room {
    const { room } = this.findByPlayer(playerId);
    this.assertHost(room, playerId);
    assert(room.phase === 'results', 'Finish the current round first.');
    if (fresh) room.target = createTarget(randomUUID());
    room.board = emptyBoard();
    room.messages = [];
    room.pending = undefined;
    room.result = undefined;
    room.roundNumber += 1;
    room.phase = 'lobby';
    room.players.forEach((player) => { player.ready = false; });
    this.touch(room);
    return room;
  }

  disconnect(playerId: string): Room | null {
    let found: { room: Room; player: Player };
    try { found = this.findByPlayer(playerId); } catch { return null; }
    const { room, player } = found;
    if (!player.connected) return room;
    player.connected = false;
    player.reconnectUntil = this.now() + RECONNECT_MS;
    player.graceExpiredNotified = false;
    room.pending = undefined;
    if (room.phase !== 'ended' && room.phase !== 'paused') {
      room.pausedFrom = room.phase;
      room.phase = 'paused';
    }
    this.touch(room);
    return room;
  }

  expireGrace(): Room[] {
    const changed: Room[] = [];
    for (const room of this.rooms.values()) {
      if (room.phase !== 'paused') continue;
      const newlyExpired = room.players.filter((player) =>
        !player.connected && player.reconnectUntil !== undefined &&
        player.reconnectUntil <= this.now() && !player.graceExpiredNotified
      );
      if (newlyExpired.length === 0) continue;
      newlyExpired.forEach((player) => { player.graceExpiredNotified = true; });
      const host = room.players.find((player) => player.id === room.hostPlayerId);
      if (!host?.connected) {
        const replacement = room.players.find((player) => player.connected);
        if (replacement) room.hostPlayerId = replacement.id;
      }
      changed.push(room);
    }
    return changed;
  }

  abort(playerId: string): Room {
    const { room } = this.findByPlayer(playerId);
    this.assertHost(room, playerId);
    assert(room.phase === 'paused', 'Only a paused round can be ended.');
    assert(room.players.some((player) =>
      !player.connected && player.reconnectUntil !== undefined &&
      player.reconnectUntil <= this.now()
    ), 'The disconnected player still has time to rejoin.');
    room.phase = 'ended';
    room.pausedFrom = undefined;
    room.pending = undefined;
    room.result = undefined;
    this.touch(room);
    return room;
  }

  leave(playerId: string): Room | null {
    const { room, player } = this.findByPlayer(playerId);
    if (room.phase === 'lobby') {
      room.players = room.players.filter((entry) => entry.id !== playerId);
      if (player.id === room.hostPlayerId) {
        const replacement = room.players[0];
        if (replacement) room.hostPlayerId = replacement.id;
        else {
          this.rooms.delete(room.code);
          return null;
        }
      }
      this.touch(room);
      return room;
    }
    this.disconnect(playerId);
    player.reconnectUntil = this.now();
    return room;
  }

  prune(): string[] {
    const expired: string[] = [];
    for (const room of this.rooms.values()) {
      if (this.now() - room.lastActivityAt > ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        expired.push(room.code);
      }
    }
    return expired;
  }

  private newPlayer(role: Role, number: number): Player {
    return {
      id: randomUUID(),
      token: randomBytes(24).toString('base64url'),
      nickname: 'Player ' + number,
      role,
      connected: true,
      ready: false,
      sendTimes: []
    };
  }

  private addMessage(room: Room, player: Player, text: string, kind: 'chat' | 'signal') {
    const time = this.now();
    player.sendTimes = player.sendTimes.filter((sentAt) => time - sentAt < RATE_WINDOW_MS);
    assert(player.sendTimes.length < RATE_MAX, 'Slow down before sending another message.');
    player.sendTimes.push(time);
    room.messages.push({
      id: randomUUID(),
      playerId: player.id,
      text,
      kind,
      sentAt: time
    });
    room.messages = room.messages.slice(-CHAT_HISTORY);
    this.touch(room);
  }

  private assertHost(room: Room, playerId: string) {
    assert(room.hostPlayerId === playerId, 'Only the host can do that.');
  }

  private touch(room: Room) {
    room.lastActivityAt = this.now();
  }
}
