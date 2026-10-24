import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import Session from './Session.tsx';
import type { CandidateSlot } from './shared/game.ts';
import type {
  Ack,
  ActionEvent,
  JoinResponse,
  RoomView
} from './shared/protocol.ts';

export const SESSION_KEY = 'unreliable-orchestra-session';

interface Credentials {
  code: string;
  token: string;
}

export function savedCredentials(): Credentials | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Credentials;
    return typeof parsed.code === 'string' && typeof parsed.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export type LiveIntent =
  | { kind: 'create' }
  | { kind: 'join'; code: string }
  | { kind: 'reconnect' };

interface LiveProps {
  intent: LiveIntent;
  onLeave: () => void;
  onPlay: (slots: CandidateSlot[], kind?: 'melody' | 'rhythm') => void;
  onStop: () => void;
  playing: boolean;
  playhead: number | null;
  muted: boolean;
  onToggleMute: () => void;
}

export default function Live(props: LiveProps) {
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    const socket = io({ autoConnect: false, reconnection: true, reconnectionDelay: 800 });
    socketRef.current = socket;
    let active = true;
    socket.on('room:state', (next: RoomView) => {
      if (active) {
        setView(next);
        setError('');
      }
    });
    socket.on('room:error', (message: string) => active && setError(message));
    socket.on('round:submit-pending', (_payload: unknown, acknowledge: (seen: boolean) => void) => {
      window.setTimeout(() => { if (active) acknowledge(true); }, 0);
    });
    socket.on('disconnect', () => {
      if (active && !leavingRef.current) {
        setConnecting(true);
        setError('Connection lost. Reconnecting to your room…');
      }
    });
    socket.on('connect', async () => {
      if (!active) return;
      setConnecting(true);
      try {
        const credentials = savedCredentials();
        let answer: Ack<JoinResponse>;
        if (credentials && (joinedRef.current || props.intent.kind === 'reconnect')) {
          answer = await socket.timeout(7000).emitWithAck('player:reconnect', credentials);
        } else if (props.intent.kind === 'create') {
          answer = await socket.timeout(7000).emitWithAck('room:create');
        } else if (props.intent.kind === 'join') {
          answer = await socket.timeout(7000).emitWithAck('room:join', { code: props.intent.code });
        } else {
          answer = { ok: false, error: 'No saved room session was found.' };
        }
        if (!active) return;
        if (!answer.ok) {
          setError(answer.error);
          if (props.intent.kind === 'reconnect') sessionStorage.removeItem(SESSION_KEY);
          return;
        }
        joinedRef.current = true;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          code: answer.data.view.code,
          token: answer.data.token
        }));
        setView(answer.data.view);
        setError('');
      } catch {
        if (active) setError('The room did not respond. Check your connection and retry.');
      } finally {
        if (active) setConnecting(false);
      }
    });
    socket.connect();
    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [props.intent]);

  async function onAction(event: ActionEvent, payload: Record<string, unknown> = {}) {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('The room is offline. Your action was not sent.');
      return;
    }
    try {
      const answer = await socket.timeout(6000).emitWithAck(event, payload) as Ack;
      if (!answer.ok) setError(answer.error);
      else setError('');
    } catch {
      setError('That action timed out. Please try again.');
    }
  }

  async function leave() {
    const activeRound = view?.phase === 'playing' ||
      (view?.phase === 'paused' && view.pausedFrom === 'playing');
    if (activeRound && !window.confirm('Leave this round? Your role will be reserved for 60 seconds.')) return;
    leavingRef.current = true;
    const socket = socketRef.current;
    if (socket?.connected) {
      try { await socket.timeout(1000).emitWithAck('room:leave'); } catch { /* Disconnect still releases the socket. */ }
    }
    socket?.disconnect();
    sessionStorage.removeItem(SESSION_KEY);
    props.onStop();
    props.onLeave();
  }

  if (!view) {
    return (
      <div className="loading-screen">
        <span className="brand-mark"><i /><i /><i /></span>
        <span className="eyebrow">{connecting ? 'Connecting the ensemble' : 'Room unavailable'}</span>
        <h1>{connecting ? 'Tuning the room…' : 'We could not open that room.'}</h1>
        {error && <p role="alert">{error}</p>}
        <button className="secondary-button" onClick={leave}>Back to home</button>
      </div>
    );
  }
  return (
    <>
      {error && <div className="floating-notice" role="alert">{error}</div>}
      <Session
        view={view}
        onAction={onAction}
        onLeave={leave}
        onPlay={props.onPlay}
        onStop={props.onStop}
        playing={props.playing}
        playhead={props.playhead}
        muted={props.muted}
        onToggleMute={props.onToggleMute}
      />
    </>
  );
}
