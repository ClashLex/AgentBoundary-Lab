import { useMemo, useState } from 'react';
import Session from './Session.tsx';
import {
  REST,
  createTarget,
  emptyBoard,
  isComplete,
  isSlot,
  makeClues,
  pitchLabel,
  scoreAnswer,
  type CandidateSlot,
  type Result,
  type Role,
  type Target
} from './shared/game.ts';
import type { ActionEvent, RoomMessage, RoomView } from './shared/protocol.ts';

interface DemoState {
  target: Target;
  board: CandidateSlot[];
  role: Role;
  roundNumber: number;
  messages: RoomMessage[];
  pending: boolean;
  result?: Result;
}

const PLAYERS = [
  { id: 'conductor', nickname: 'You · Conductor', role: 'conductor' as const, connected: true, ready: true, isHost: true },
  { id: 'rhythm_keeper', nickname: 'You · Rhythm', role: 'rhythm_keeper' as const, connected: true, ready: true, isHost: false },
  { id: 'melodist', nickname: 'You · Melody', role: 'melodist' as const, connected: true, ready: true, isHost: false }
];

function messageForSignal(state: DemoState, payload: Record<string, unknown>): string | null {
  const clue = makeClues(state.target);
  if (state.role === 'rhythm_keeper' && payload.kind === 'status') {
    const slot = Number(payload.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 8) return null;
    return 'Slot ' + slot + ' is ' + (clue.rhythm_keeper.notes[slot - 1] ? 'a Note' : 'a Rest') + '.';
  }
  if (state.role === 'melodist' && payload.kind === 'shifted') {
    const index = Number(payload.noteIndex);
    const pitch = clue.melodist.shiftedNotes[index - 1];
    if (!Number.isInteger(index) || !pitch) return null;
    return 'Shifted note ' + index + ' is ' + pitchLabel(pitch) + '.';
  }
  if (state.role === 'conductor' && payload.kind === 'check') {
    const slot = Number(payload.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 8) return null;
    return 'Can we check slot ' + slot + '?';
  }
  return null;
}

interface DemoProps {
  onLeave: () => void;
  onPlay: (slots: CandidateSlot[], kind?: 'melody' | 'rhythm') => void;
  onStop: () => void;
  playing: boolean;
  playhead: number | null;
  muted: boolean;
  onToggleMute: () => void;
}

export default function Demo(props: DemoProps) {
  const [state, setState] = useState<DemoState>(() => ({
    target: createTarget('judge-demo-001'),
    board: emptyBoard(),
    role: 'conductor',
    roundNumber: 1,
    messages: [],
    pending: false
  }));
  const clues = useMemo(() => makeClues(state.target), [state.target]);
  const view: RoomView = {
    code: 'DEMO',
    phase: state.result ? 'results' : 'playing',
    roundNumber: state.roundNumber,
    role: state.role,
    playerId: state.role,
    players: PLAYERS,
    board: state.board,
    clue: clues[state.role],
    messages: state.messages,
    pendingSubmission: state.pending,
    canConfirmSubmission: state.pending,
    result: state.result,
    demo: true
  };

  async function onAction(event: ActionEvent, payload: Record<string, unknown> = {}) {
    if (event === 'round:replay' || event === 'round:next') props.onStop();
    setState((previous) => {
      if (event === 'board:update') {
        const slot = Number(payload.slot);
        const value = payload.value;
        if (previous.role !== 'conductor' || previous.pending || previous.result || !Number.isInteger(slot) || slot < 1 || slot > 8 || (value !== null && !isSlot(value))) return previous;
        const board = [...previous.board];
        board[slot - 1] = value;
        return { ...previous, board };
      }
      if (event === 'chat:send' || event === 'signal:send') {
        const text = event === 'chat:send'
          ? String(payload.text ?? '').trim().slice(0, 240)
          : messageForSignal(previous, payload);
        if (!text) return previous;
        const message: RoomMessage = {
          id: crypto.randomUUID(),
          playerId: previous.role,
          text,
          kind: event === 'chat:send' ? 'chat' : 'signal',
          sentAt: Date.now()
        };
        return { ...previous, messages: [...previous.messages, message].slice(-50) };
      }
      if (event === 'round:submit-request') {
        if (previous.role !== 'conductor' || !isComplete(previous.board) || previous.result) return previous;
        return { ...previous, pending: true };
      }
      if (event === 'round:submit-cancel') return { ...previous, pending: false };
      if (event === 'round:submit-confirm') {
        if (!previous.pending || !isComplete(previous.board)) return previous;
        return { ...previous, pending: false, result: scoreAnswer(previous.target, previous.board) };
      }
      if (event === 'round:replay') {
        return { ...previous, board: emptyBoard(), pending: false, result: undefined, role: 'conductor', messages: [] };
      }
      if (event === 'round:next') {
        const roundNumber = previous.roundNumber + 1;
        return {
          target: createTarget('judge-demo-' + String(roundNumber).padStart(3, '0')),
          board: emptyBoard(),
          role: 'conductor',
          roundNumber,
          messages: [],
          pending: false
        };
      }
      return previous;
    });
  }

  return (
    <Session
      view={view}
      onAction={onAction}
      onLeave={props.onLeave}
      onPlay={props.onPlay}
      onStop={props.onStop}
      playing={props.playing}
      playhead={props.playhead}
      muted={props.muted}
      onToggleMute={props.onToggleMute}
      onSwitchRole={(role) => setState((previous) => ({ ...previous, role }))}
    />
  );
}
