import { useEffect, useRef, useState } from 'react';
import {
  PITCHES,
  REST,
  isPitch,
  pitchLabel,
  type CandidateSlot,
  type Clues,
  type Role
} from './shared/game.ts';
import type { ActionHandler, RoomView } from './shared/protocol.ts';

const ROLE_NAMES: Record<Role, string> = {
  conductor: 'Conductor',
  rhythm_keeper: 'Rhythm Keeper',
  melodist: 'Melodist'
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  conductor: 'You know how to undo the pitch shift. Listen to your team, then place the original song on the board.',
  rhythm_keeper: 'You know which of the eight slots are notes and which are rests. Share their positions with your team.',
  melodist: 'You have the notes in playing order, but every pitch has been shifted. Share them so the Conductor can decode them.'
};

const ROLE_ORDER: Role[] = ['conductor', 'rhythm_keeper', 'melodist'];

interface SessionProps {
  view: RoomView;
  onAction: ActionHandler;
  onLeave: () => void;
  onPlay: (slots: CandidateSlot[], kind?: 'melody' | 'rhythm') => void;
  onStop: () => void;
  playing: boolean;
  playhead: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onSwitchRole?: (role: Role) => void;
}

function RoleBadge({ role }: { role: Role }) {
  return <span className={'role-badge role-' + role}>{ROLE_NAMES[role]}</span>;
}

function RoleClue({
  view,
  onAction,
  onPlay
}: Pick<SessionProps, 'view' | 'onAction' | 'onPlay'>) {
  const role = view.role;
  return (
    <section className={'panel clue-panel clue-' + role}>
      <div className="eyebrow">Your private signal</div>
      <div className="clue-heading">
        <h2>{ROLE_NAMES[role]}</h2>
        <RoleBadge role={role} />
      </div>
      <p className="muted">{ROLE_DESCRIPTIONS[role]}</p>
      {role === 'rhythm_keeper' && (() => {
        const clue = view.clue as Clues['rhythm_keeper'];
        return (
          <>
            <div className="clue-slots">
              {clue.notes.map((hasNote, index) => (
                <div className="clue-slot" key={index}>
                  <small>{index + 1}</small>
                  <strong>{hasNote ? '♪ Note' : '— Rest'}</strong>
                  <button
                    className="text-button"
                    onClick={() => void onAction('signal:send', { kind: 'status', slot: index + 1 })}
                  >
                    Share
                  </button>
                </div>
              ))}
            </div>
            <button className="secondary-button compact" onClick={() => onPlay(clue.notes.map((note) => note ? 'C4' : REST), 'rhythm')}>
              Hear rhythm
            </button>
          </>
        );
      })()}
      {role === 'melodist' && (() => {
        const clue = view.clue as Clues['melodist'];
        return (
          <>
            <p className="clue-note">These are shifted notes in playing order. Rests are omitted.</p>
            <div className="note-list">
              {clue.shiftedNotes.map((pitch, index) => (
                <div className="note-token" key={index}>
                  <small>Note {index + 1}</small>
                  <strong>{pitchLabel(pitch)}</strong>
                  <button className="text-button" onClick={() => onPlay([pitch])}>Hear</button>
                  <button
                    className="text-button"
                    onClick={() => void onAction('signal:send', { kind: 'shifted', noteIndex: index + 1 })}
                  >
                    Share
                  </button>
                </div>
              ))}
            </div>
            <button className="secondary-button compact" onClick={() => onPlay(clue.shiftedNotes)}>
              Hear shifted notes
            </button>
          </>
        );
      })()}
      {role === 'conductor' && (() => {
        const clue = view.clue as Clues['conductor'];
        return (
          <div className="shift-instruction">
            <div className="shift-number">{clue.stepsBack}</div>
            <div>
              <strong>steps backward</strong>
              <p>Move every note the Melodist shares {clue.stepsBack} step{clue.stepsBack === 1 ? '' : 's'} back around this ring.</p>
            </div>
          </div>
        );
      })()}
      <div className="pitch-ring" aria-label="Pitch ring C, D, E, G, A, then C again">
        {PITCHES.map((pitch, index) => (
          <span key={pitch}>{pitchLabel(pitch)}{index < PITCHES.length - 1 && <em>→</em>}</span>
        ))}
        <span className="ring-return">↺ C</span>
      </div>
    </section>
  );
}

function Board({
  view,
  onAction,
  playhead
}: Pick<SessionProps, 'view' | 'onAction' | 'playhead'>) {
  const [selected, setSelected] = useState<number | null>(null);
  const canEdit = view.role === 'conductor' && view.phase === 'playing' && !view.pendingSubmission;
  return (
    <section className="panel board-panel">
      <div className="panel-title-row">
        <div>
          <div className="eyebrow">The shared composition</div>
          <h2>Eight slots. One answer.</h2>
        </div>
        <span className="tempo-tag">100 BPM · 2 bars</span>
      </div>
      <div className="score-grid" aria-label="Eight-slot shared composition">
        {view.board.map((slot, index) => {
          const active = canEdit && selected === index;
          return (
            <button
              key={index}
              className={'score-slot' + (slot === null ? ' is-empty' : slot === REST ? ' is-rest' : ' is-note') + (active ? ' is-selected' : '') + (playhead === index ? ' is-playing' : '')}
              onClick={() => canEdit && setSelected(index)}
              disabled={!canEdit}
              aria-label={'Slot ' + (index + 1) + ': ' + (slot === null ? 'Unanswered' : pitchLabel(slot))}
              aria-pressed={active}
            >
              <span className="slot-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="slot-value">{slot === null ? '?' : slot === REST ? '—' : pitchLabel(slot)}</span>
              <span className="slot-caption">{slot === null ? 'Unanswered' : slot === REST ? 'Rest' : 'Note'}</span>
            </button>
          );
        })}
      </div>
      {canEdit && selected !== null && (
        <div className="pitch-picker" aria-label={'Choose a value for slot ' + (selected + 1)}>
          <span>Slot {selected + 1}</span>
          {PITCHES.map((pitch) => (
            <button
              key={pitch}
              className="pitch-choice"
              onClick={() => {
                void onAction('board:update', { slot: selected + 1, value: pitch });
                setSelected(null);
              }}
            >
              {pitchLabel(pitch)}
            </button>
          ))}
          <button
            className="pitch-choice rest-choice"
            onClick={() => {
              void onAction('board:update', { slot: selected + 1, value: REST });
              setSelected(null);
            }}
          >Rest</button>
          <button
            className="pitch-choice clear-choice"
            onClick={() => {
              void onAction('board:update', { slot: selected + 1, value: null });
              setSelected(null);
            }}
          >Clear</button>
          <button
            className="text-button check-signal"
            onClick={() => void onAction('signal:send', { kind: 'check', slot: selected + 1 })}
          >Ask team to check this slot</button>
        </div>
      )}
      <div className="board-footnote">
        {view.role === 'conductor'
          ? 'Select a slot, then choose a pitch or an explicit Rest.'
          : 'Only the Conductor edits the board. Your clues help them find the answer.'}
      </div>
    </section>
  );
}

function Chat({ view, onAction }: Pick<SessionProps, 'view' | 'onAction'>) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [view.messages.length]);
  return (
    <section className="panel chat-panel">
      <div className="panel-title-row">
        <div>
          <div className="eyebrow">The conversation</div>
          <h2>Pass the missing pieces.</h2>
        </div>
        <span className="chat-count">{view.messages.length} messages</span>
      </div>
      <div className="message-list" ref={listRef} aria-live="polite">
        {view.messages.length === 0 && <p className="empty-chat">Start with what only you know. One clue at a time.</p>}
        {view.messages.map((message) => {
          const player = view.players.find((item) => item.id === message.playerId);
          return (
            <div className={'message ' + (message.kind === 'signal' ? 'signal-message' : '')} key={message.id}>
              <div className="message-meta">
                <span className={'message-dot role-' + (player?.role ?? 'conductor')} />
                <strong>{player?.nickname ?? 'Player'}</strong>
                <span>{message.kind === 'signal' ? 'signal' : 'chat'}</span>
              </div>
              <p>{message.text}</p>
            </div>
          );
        })}
      </div>
      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          const value = text.trim();
          if (!value) return;
          void onAction('chat:send', { text: value });
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={240}
          placeholder="Share a clue or ask a question…"
          aria-label="Room message"
        />
        <button type="submit" className="send-button" disabled={!text.trim()}>Send ↗</button>
      </form>
    </section>
  );
}

function Results({
  view,
  onAction,
  onPlay,
  onStop
}: Pick<SessionProps, 'view' | 'onAction' | 'onPlay' | 'onStop'>) {
  const result = view.result;
  if (!result) return null;
  const isHost = view.players.some((player) => player.id === view.playerId && player.isHost);
  return (
    <div className="results-layout">
      <section className="panel result-hero">
        <div className="eyebrow">The reveal · round {view.roundNumber}</div>
        <h1>{result.points === 8 ? 'You found the song.' : 'Hear what you discovered.'}</h1>
        <div className="result-score"><strong>{result.points}</strong><span>/ 8 exact slots</span></div>
        <p>Each matching pitch or Rest earns one point. Listen to both versions, then follow the highlighted slots to see what changed.</p>
        <div className="button-row">
          <button className="primary-button" onClick={() => onPlay(result.submitted)}>Play your version</button>
          <button className="secondary-button" onClick={() => onPlay(result.target)}>Play target</button>
          <button className="text-button" onClick={onStop}>Stop</button>
        </div>
      </section>
      <section className="panel compare-panel">
        <div className="eyebrow">Slot by slot</div>
        <h2>The exact comparison</h2>
        <div className="comparison-grid">
          {result.target.map((target, index) => (
            <div className={'comparison-slot ' + (result.matches[index] ? 'matched' : 'missed')} key={index}>
              <small>Slot {index + 1}</small>
              <strong>{result.matches[index] ? '✓' : '×'}</strong>
              <span>You: {pitchLabel(result.submitted[index])}</span>
              <span>Song: {pitchLabel(target)}</span>
            </div>
          ))}
        </div>
        <div className="button-row result-actions">
          <button className="secondary-button" disabled={!isHost || view.phase === 'paused'} onClick={() => void onAction('round:replay')}>Replay same puzzle</button>
          <button className="primary-button" disabled={!isHost || view.phase === 'paused'} onClick={() => void onAction('round:next')}>New puzzle ↗</button>
        </div>
        {!isHost && <p className="result-host-note">The host starts the next round.</p>}
      </section>
    </div>
  );
}

export default function Session({
  view,
  onAction,
  onLeave,
  onPlay,
  onStop,
  playing,
  playhead,
  muted,
  onToggleMute,
  onSwitchRole
}: SessionProps) {
  const me = view.players.find((player) => player.id === view.playerId);
  const isHost = Boolean(me?.isHost);
  const allReady = view.players.length === 3 && view.players.every((player) => player.connected && player.ready);
  const complete = view.board.every((slot) => slot !== null);
  const boardHasNote = view.board.some(isPitch);
  const visiblePhase = view.phase === 'paused' ? view.pausedFrom : view.phase;
  const [copied, setCopied] = useState(false);

  return (
    <div className="app-shell">
      <header className="site-header session-header">
        <button className="brand" onClick={onLeave} aria-label="Return to home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>UNRELIABLE<br />ORCHESTRA</span>
        </button>
        <div className="header-right">
          <span className="round-pill">ROUND {String(view.roundNumber).padStart(2, '0')}</span>
          <span className={'phase-pill phase-' + view.phase}>{view.demo ? 'GUIDED DEMO' : view.phase.toUpperCase()}</span>
          <button className="sound-toggle" onClick={onToggleMute} aria-pressed={muted}>{muted ? 'Unmute sound' : 'Mute sound'}</button>
          <button className="sound-toggle" onClick={() => onPlay(['A4'])}>Test tone</button>
          <button className="text-button leave-link" onClick={onLeave}>Leave room ↗</button>
        </div>
      </header>

      <div className="room-bar">
        <div>
          <span className="eyebrow">{view.demo ? 'Demo room' : 'Private room'}</span>
          <button
            className="room-code"
            onClick={() => {
              void navigator.clipboard?.writeText(view.code).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              });
            }}
            title="Copy room code"
          >
            {view.code} <span>{copied ? 'COPIED' : 'COPY ↗'}</span>
          </button>
        </div>
        <div className="player-list">
          {ROLE_ORDER.map((role) => {
            const player = view.players.find((item) => item.role === role);
            return (
              <div className={'player-chip ' + (!player?.connected ? 'disconnected' : '')} key={role}>
                <span className={'message-dot role-' + role} />
                <div><strong>{ROLE_NAMES[role]}</strong><small>{player?.nickname ?? 'Waiting'}{player?.ready ? ' · ready' : ''}</small></div>
              </div>
            );
          })}
        </div>
      </div>

      {view.demo && onSwitchRole && view.phase !== 'results' && (
        <div className="demo-switcher">
          <span>Explore each signal</span>
          {ROLE_ORDER.map((role) => (
            <button className={view.role === role ? 'active' : ''} key={role} onClick={() => onSwitchRole(role)}>
              {ROLE_NAMES[role]}
            </button>
          ))}
        </div>
      )}

      {view.phase === 'paused' && (
        <div className="notice pause-notice" role="status">
          <strong>The room is paused.</strong> A player disconnected. Their role and progress are reserved for 60 seconds.
          {isHost && view.canAbort && <button className="text-button" onClick={() => void onAction('round:abort')}>End round</button>}
        </div>
      )}

      {visiblePhase === 'lobby' && (
        <main className="lobby-layout">
          <section className="panel lobby-intro">
            <span className="eyebrow">Before the downbeat</span>
            <h1>Three minds.<br />One missing song.</h1>
            <p>Each player holds a clue the others need. Read your role, mark ready, and the host can start when all three are here.</p>
            <RoleBadge role={view.role} />
            <p className="role-brief">{ROLE_DESCRIPTIONS[view.role]}</p>
            <div className="button-row">
              <button className="secondary-button" disabled={view.phase === 'paused'} onClick={() => void onAction('player:ready', { ready: !me?.ready })}>
                {me?.ready ? '✓ Ready' : "I'm ready"}
              </button>
              {isHost && <button className="primary-button" disabled={!allReady || view.phase === 'paused'} onClick={() => void onAction('round:start')}>Start round ↗</button>}
            </div>
          </section>
          <section className="panel lobby-roles">
            <span className="eyebrow">The ensemble</span>
            {ROLE_ORDER.map((role, index) => {
              const player = view.players.find((item) => item.role === role);
              return (
                <div className="lobby-role" key={role}>
                  <span>0{index + 1}</span>
                  <div><RoleBadge role={role} /><p>{ROLE_DESCRIPTIONS[role]}</p></div>
                  <small>{player ? player.ready ? 'READY' : 'JOINED' : 'OPEN'}</small>
                </div>
              );
            })}
          </section>
        </main>
      )}

      {visiblePhase === 'results' && (
        <main><Results view={view} onAction={onAction} onPlay={onPlay} onStop={onStop} /></main>
      )}

      {visiblePhase === 'playing' && (
        <main className="game-layout">
          <div className="game-primary">
            <div className="game-heading">
              <div><span className="eyebrow">Round {view.roundNumber} · the reconstruction</span><h1>Nobody has the whole song.</h1></div>
              <div className="game-progress">{view.board.filter((slot) => slot !== null).length}<span>/ 8 slots filled</span></div>
            </div>
            <Board view={view} onAction={onAction} playhead={playhead} />
            <div className="transport-bar">
              <div className="transport-copy"><strong>Hear the current answer</strong><span>{boardHasNote ? 'Unanswered slots play as silence.' : 'Add a note to hear the current answer.'}</span></div>
              <button className="secondary-button" onClick={() => onPlay(view.board)} disabled={playing || !boardHasNote}>▶ Play</button>
              <button className="secondary-button" onClick={onStop} disabled={!playing}>■ Stop</button>
              {view.role === 'conductor' && (
                <button
                  className="primary-button"
                  disabled={!complete || view.phase !== 'playing' || view.pendingSubmission}
                  onClick={() => void onAction('round:submit-request')}
                >Submit song ↗</button>
              )}
            </div>
            {view.pendingSubmission && (
              <div className="notice submit-notice" role="status">
                <strong>Answer ready for confirmation.</strong> All players can see this before the sequence is locked.
                {view.role === 'conductor' && (
                  <span className="button-row">
                    <button className="secondary-button compact" onClick={() => void onAction('round:submit-cancel')}>Keep editing</button>
                    <button className="primary-button compact" disabled={!view.canConfirmSubmission} onClick={() => void onAction('round:submit-confirm')}>
                      {view.canConfirmSubmission ? 'Confirm answer' : 'Showing the team…'}
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
          <aside className="game-sidebar">
            <RoleClue view={view} onAction={onAction} onPlay={onPlay} />
            <Chat view={view} onAction={onAction} />
          </aside>
        </main>
      )}
      {view.phase === 'ended' && <main className="ended-panel panel"><h1>Round ended.</h1><p>No answer was submitted. Start a new room to play again.</p><button className="primary-button" onClick={onLeave}>Return home</button></main>}
      <footer className="site-footer"><span>THREE SIGNALS. ONE SONG.</span><span>Made for play · no musical training needed.</span></footer>
    </div>
  );
}
