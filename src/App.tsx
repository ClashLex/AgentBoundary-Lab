import { useEffect, useRef, useState } from 'react';
import Demo from './Demo.tsx';
import Live, { SESSION_KEY, savedCredentials, type LiveIntent } from './Live.tsx';
import { AudioEngine } from './audio.ts';
import type { CandidateSlot } from './shared/game.ts';

export default function App() {
  const [mode, setMode] = useState<'home' | 'demo' | 'live'>(() =>
    new URLSearchParams(window.location.search).get('demo') === '1'
      ? 'demo'
      : savedCredentials() ? 'live' : 'home'
  );
  const [intent, setIntent] = useState<LiveIntent>(() =>
    savedCredentials() ? { kind: 'reconnect' } : { kind: 'create' }
  );
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioError, setAudioError] = useState('');
  const engineRef = useRef<AudioEngine | null>(null);
  const engine = () => (engineRef.current ??= new AudioEngine());

  useEffect(() => () => engineRef.current?.dispose(), []);

  function stop() {
    engineRef.current?.stop();
    setPlaying(false);
    setPlayhead(null);
  }

  function play(slots: CandidateSlot[], kind: 'melody' | 'rhythm' = 'melody') {
    if (muted) {
      setAudioError('Sound is muted. Select Unmute sound, then try again.');
      return;
    }
    setAudioError('');
    void engine().play(
      slots,
      kind,
      setPlayhead,
      () => setPlaying(false)
    ).then((started) => { if (started) setPlaying(true); }).catch((error: unknown) => {
      setPlaying(false);
      setPlayhead(null);
      setAudioError(error instanceof Error ? error.message : 'Audio playback is unavailable.');
    });
  }

  function leave() {
    stop();
    window.history.replaceState(null, '', window.location.pathname);
    setMode('home');
    setJoinOpen(false);
  }

  function beginLive(next: LiveIntent) {
    stop();
    window.history.replaceState(null, '', window.location.pathname);
    sessionStorage.removeItem(SESSION_KEY);
    setIntent(next);
    setMode('live');
  }

  function beginDemo() {
    stop();
    window.history.replaceState(null, '', '?demo=1');
    setMode('demo');
  }

  function toggleMute() {
    const next = !muted;
    engine().setMuted(next);
    setMuted(next);
    setAudioError('');
    if (next) stop();
  }

  if (mode === 'demo') {
    return (
      <>
        <Demo onLeave={leave} onPlay={play} onStop={stop} playing={playing} playhead={playhead} muted={muted} onToggleMute={toggleMute} />
        {audioError && <div className="floating-notice" role="alert">{audioError}</div>}
      </>
    );
  }
  if (mode === 'live') {
    return (
      <>
        <Live intent={intent} onLeave={leave} onPlay={play} onStop={stop} playing={playing} playhead={playhead} muted={muted} onToggleMute={toggleMute} />
        {audioError && <div className="floating-notice" role="alert">{audioError}</div>}
      </>
    );
  }
  return (
    <div className="app-shell home-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>UNRELIABLE<br />ORCHESTRA</span>
        </div>
        <div className="header-right"><span className="header-annotation">A COOPERATIVE MUSIC PUZZLE</span><button className="header-demo" onClick={beginDemo}>TRY THE DEMO ↗</button></div>
      </header>

      <main className="home-main">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><span className="lime-dot" /> THREE PLAYERS · EIGHT SLOTS · ONE SONG</div>
          <h1>Nobody has<br />the <em>whole</em> song<span className="hero-period">.</span></h1>
          <p>One player knows the rests. One hears shifted notes. One knows how to decode them. Talk it through, build the melody, and hear what you found.</p>
          <div className="hero-actions">
            <button className="primary-button large" onClick={() => beginLive({ kind: 'create' })}>Create a room <span>↗</span></button>
            <button className="secondary-button large" onClick={() => setJoinOpen(true)}>Join a room</button>
            <button className="text-button demo-link" onClick={beginDemo}>Or try it solo first →</button>
          </div>
          <div className="hero-note"><span>NO ACCOUNTS.</span><span>NO INSTRUMENTS.</span><span>JUST A LITTLE LISTENING.</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-top"><span>UNFINISHED SCORE / 001</span><span>● LIVE</span></div>
          <div className="art-staff">
            <span className="art-note note-one">♪</span>
            <span className="art-note note-two">♫</span>
            <span className="art-note note-three">♪</span>
            <span className="art-question">?</span>
          </div>
          <div className="art-grid">
            {['C', '?', '—', 'E', '?', 'G', '—', '?'].map((value, index) => (
              <div key={index} className={index === 1 || index === 4 || index === 7 ? 'unknown' : ''}>
                <small>{String(index + 1).padStart(2, '0')}</small><strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="art-bottom"><span>THE MISSING NOTES ARE YOURS TO FIND</span><span>100 BPM ↗</span></div>
        </div>
      </main>

      <section className="how-section" aria-labelledby="how-title">
        <div className="section-heading"><span className="eyebrow">How the puzzle works</span><h2 id="how-title">Three signals. One shared discovery.</h2></div>
        <div className="role-cards">
          <article className="role-card lime-card"><span>01 / THE TIMING</span><div className="card-symbol">— ♪ —</div><h3>Rhythm Keeper</h3><p>Sees where every note and rest belongs. No pitches.</p></article>
          <article className="role-card lavender-card"><span>02 / THE SOUND</span><div className="card-symbol">C → E</div><h3>Melodist</h3><p>Sees the sounding notes after a mysterious pitch shift.</p></article>
          <article className="role-card white-card"><span>03 / THE KEY</span><div className="card-symbol">↶ 2</div><h3>Conductor</h3><p>Knows how to undo the shift and builds the team's answer.</p></article>
        </div>
      </section>
      <footer className="site-footer"><span>THREE SIGNALS. ONE SONG.</span><span>Made for play · no musical training needed.</span></footer>

      {joinOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setJoinOpen(false)}>
          <form className="join-modal" onSubmit={(event) => {
            event.preventDefault();
            if (/^[A-HJ-NP-Z2-9]{6}$/.test(joinCode)) beginLive({ kind: 'join', code: joinCode });
          }}>
            <button type="button" className="modal-close" onClick={() => setJoinOpen(false)} aria-label="Close join dialog">×</button>
            <span className="eyebrow">Join the ensemble</span>
            <h2>Got a room code?</h2>
            <p>Enter the six-character code your Conductor shared.</p>
            <input
              autoFocus
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))}
              placeholder="ABC234"
              aria-label="Six-character room code"
              maxLength={6}
            />
            {joinCode && !/^[A-HJ-NP-Z2-9]{6}$/.test(joinCode) && <small>Use six letters or digits; O, 0, I, and 1 are not used.</small>}
            <button className="primary-button" disabled={!/^[A-HJ-NP-Z2-9]{6}$/.test(joinCode)}>Join room ↗</button>
          </form>
        </div>
      )}
    </div>
  );
}
