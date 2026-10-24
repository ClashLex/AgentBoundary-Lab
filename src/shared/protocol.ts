import type { CandidateSlot, Clues, Phase, Result, Role } from './game.ts';

export interface PublicPlayer {
  id: string;
  nickname: string;
  role: Role;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  reconnectUntil?: number;
}

export interface RoomMessage {
  id: string;
  playerId: string;
  text: string;
  kind: 'chat' | 'signal';
  sentAt: number;
}

export interface RoomView {
  code: string;
  phase: Phase;
  pausedFrom?: 'lobby' | 'playing' | 'results';
  roundNumber: number;
  role: Role;
  playerId: string;
  players: PublicPlayer[];
  board: CandidateSlot[];
  clue: Clues[Role];
  messages: RoomMessage[];
  pendingSubmission: boolean;
  canConfirmSubmission?: boolean;
  canAbort?: boolean;
  result?: Result;
  demo?: boolean;
}

export interface JoinResponse {
  playerId: string;
  token: string;
  view: RoomView;
}

export type Ack<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ActionEvent =
  | 'player:ready'
  | 'round:start'
  | 'board:update'
  | 'chat:send'
  | 'signal:send'
  | 'round:submit-request'
  | 'round:submit-confirm'
  | 'round:submit-cancel'
  | 'round:replay'
  | 'round:next'
  | 'round:abort';

export type ActionHandler = (
  event: ActionEvent,
  payload?: Record<string, unknown>
) => Promise<void>;
