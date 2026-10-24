# Build change log

All timestamps are in India Standard Time (IST, UTC+05:30). Each row records a source, configuration, or documentation file creation, modification, or deletion made while building Unreliable Orchestra. This log's own append operations, generated dependencies, and build output are omitted.

| Timestamp (IST) | Action | File | Change and reason |
|---|---|---|---|
| 2026-10-25 00:01:41 | Created | `BUILD_CHANGELOG.md` | Started the requested single-file record of build changes. |
| 2026-10-25 00:02:13 | Created | `package.json` | Defined scripts for development, build, production, and tests. |
| 2026-10-25 00:02:13 | Created | `tsconfig.json` | Configured strict TypeScript for shared, server, and React code. |
| 2026-10-25 00:02:13 | Created | `index.html` | Added the browser entry page and accessible document metadata. |
| 2026-10-25 00:02:13 | Created | `src/shared/game.ts` | Added the seeded eight-slot generator, fixed pitch shift, role clues, board validation, and exact scoring. |
| 2026-10-25 00:02:13 | Created | `src/shared/game.test.ts` | Added meaningful checks for deterministic puzzles, clue recovery, and exact slot scoring. |
| 2026-10-25 00:09:51 | Modified | `package.json` | Installed runtime dependencies (React, Express, Socket.IO) and build/test tooling (Vite, TypeScript, tsx, type declarations). |
| 2026-10-25 00:09:51 | Created | `package-lock.json` | Locked the installed package versions for reproducible builds. |
| 2026-10-25 00:10:55 | Created | `src/shared/protocol.ts` | Defined the public room view, messages, acknowledgements, and action names shared by client and server. |
| 2026-10-25 00:10:55 | Created | `src/main.tsx` | Added the React entry point. |
| 2026-10-25 00:10:55 | Modified | `package.json` | Switched tests to Node's built-in TypeScript runner after tsx failed before tests started in this environment. |
| 2026-10-25 00:10:55 | Created | `src/Session.tsx` | Added reusable lobby, role clue, shared board, room chat, submission, pause, and result views for demo and live rooms. |
| 2026-10-25 00:12:08 | Created | `src/audio.ts` | Added local Web Audio synthesis, fixed 100 BPM timing, stop/replay cleanup, and mute support. |
| 2026-10-25 00:12:26 | Created | `src/Demo.tsx` | Added a separate guided demo that switches roles, shares clues, edits the board, scores locally, and supports replay. |
| 2026-10-25 00:12:58 | Created | `src/Live.tsx` | Added the live room client, acknowledged actions, room-scoped updates, and session-token reconnect flow. |
| 2026-10-25 00:13:15 | Created | `src/App.tsx` | Added the landing page, create/join/demo navigation, session recovery entry, audio controls, and mute state. |
| 2026-10-25 00:13:41 | Created | `src/styles.css` | Styled the warm-white, lime, and lavender landing page, game board, clues, chat, results, mobile layout, and reduced-motion states. |
| 2026-10-25 00:15:07 | Created | `server/rooms.ts` | Added authoritative room membership, role permissions, clue isolation, chat/signals, submission, replay, pause/rejoin, and expiry rules. |
| 2026-10-25 00:15:07 | Modified | `src/shared/protocol.ts` | Added host-only abort availability to the public room view. |
| 2026-10-25 00:15:46 | Created | `server/rooms.test.ts` | Added server-rule tests for role isolation, permissions, exact results, chat limits, and 60-second recovery. |
| 2026-10-25 00:16:09 | Modified | `server/rooms.ts` | Removed a TypeScript syntax form unsupported by Node's strip-only runner and allowed a vacant Conductor role to be refilled in a lobby. |
| 2026-10-25 00:16:20 | Modified | `server/rooms.test.ts` | Corrected the rate-limit case to exceed five sends and checked replay against the original seed. |
| 2026-10-25 00:17:09 | Created | `server/index.ts` | Connected room rules to Socket.IO acknowledgements and per-player private views; added one-process Vite development and production serving. |
| 2026-10-25 00:17:36 | Modified | `package.json` | Switched development and production server scripts to Node's built-in TypeScript runner. |
| 2026-10-25 00:17:59 | Modified | `package.json` | Removed unused tsx tooling after switching to Node's built-in runner. |
| 2026-10-25 00:17:59 | Modified | `package-lock.json` | Removed the unused tsx dependency from the lockfile. |
| 2026-10-25 00:18:51 | Created | `server/integration.test.ts` | Added a three-client Socket.IO round test, including private clues, chat, exact reveal, replay, and reconnect. |
| 2026-10-25 00:18:51 | Modified | `package.json` | Included the live multiplayer integration test in the test command. |
| 2026-10-25 00:25:45 | Modified | `src/main.tsx` | Removed Strict Mode's duplicate mount so a refresh cannot rotate a room token twice. |
| 2026-10-25 00:25:45 | Modified | `src/App.tsx` | Added a direct demo link and cleaned up navigation and audio playback state. |
| 2026-10-25 00:25:45 | Modified | `src/audio.ts` | Prevented a stopped playback request from scheduling audio after asynchronous context resume. |
| 2026-10-25 00:25:45 | Modified | `src/Demo.tsx` | Moved audio stopping out of React state updates to keep replay transitions free of side effects. |
| 2026-10-25 00:25:45 | Modified | `src/Session.tsx` | Added Conductor check signals, disabled paused-room actions, host-only replay controls, and visible paused lobby/results views. |
| 2026-10-25 00:25:45 | Modified | `src/styles.css` | Styled the new check signal and host guidance in results. |
| 2026-10-25 00:28:18 | Modified | `src/Session.tsx` | Kept automatic message scrolling inside the chat list so the page does not jump on mobile. |
| 2026-10-25 00:28:18 | Modified | `src/styles.css` | Moved the fixed mute control away from the room chat input. |
| 2026-10-25 00:29:30 | Modified | `src/Session.tsx` | Put the mute control in the room header so it cannot cover game controls on small screens. |
| 2026-10-25 00:29:30 | Modified | `src/Demo.tsx` | Passed the shared mute control into the demo header. |
| 2026-10-25 00:29:30 | Modified | `src/Live.tsx` | Passed the shared mute control into the live room header. |
| 2026-10-25 00:29:30 | Modified | `src/App.tsx` | Removed the floating mute buttons and reused the session header control. |
| 2026-10-25 00:29:30 | Modified | `src/styles.css` | Styled the inline sound control and removed the overlapping fixed control. |
| 2026-10-25 00:30:01 | Modified | `server/rooms.ts` | Broadcast grace expiry once per disconnected player instead of every second indefinitely. |
| 2026-10-25 00:30:01 | Modified | `server/rooms.test.ts` | Checked that grace expiry is reported only once. |
| 2026-10-25 00:30:53 | Modified | `server/index.ts` | Acknowledged explicit room exits before disconnecting so lobby roles release reliably. |
| 2026-10-25 00:30:53 | Modified | `src/Live.tsx` | Waited briefly for the leave acknowledgement and suppressed false reconnect notices during exit. |
| 2026-10-25 00:31:08 | Modified | `server/integration.test.ts` | Verified an acknowledged lobby exit frees the role for another player. |
| 2026-10-25 00:31:25 | Created | `README.md` | Documented local play, demo mode, tests, production setup, game rules, and memory-only room limits. |
| 2026-10-25 00:31:25 | Created | `Dockerfile` | Added a single-process production container that serves the built app and Socket.IO. |
| 2026-10-25 00:31:25 | Created | `.dockerignore` | Kept dependencies, build output, repository metadata, and secrets out of the container build context. |
| 2026-10-25 00:46:12 | Modified | `src/Session.tsx` | Added individual shifted-note playback for the Melodist, matching the private clue requirement. |
| 2026-10-25 00:46:12 | Modified | `src/Live.tsx` | Added leave-room confirmation during an active round. |
| 2026-10-25 00:46:40 | Modified | `src/shared/protocol.ts` | Added a submission-ready flag to the per-player room view. |
| 2026-10-25 00:46:40 | Modified | `server/rooms.ts` | Required all-client pending-state acknowledgement before the Conductor can confirm a score. |
| 2026-10-25 00:46:40 | Modified | `src/Demo.tsx` | Marked solo demo confirmations ready immediately. |
| 2026-10-25 00:46:40 | Modified | `src/Session.tsx` | Disabled the final confirm button until every player has received the pending state. |
| 2026-10-25 00:46:57 | Modified | `server/index.ts` | Waited for Socket.IO acknowledgements from all three clients before unlocking final confirmation. |
| 2026-10-25 00:46:57 | Modified | `src/Live.tsx` | Acknowledged receipt of the room-wide pending submission event. |
| 2026-10-25 00:46:57 | Modified | `server/integration.test.ts` | Made the three test clients acknowledge pending submissions. |
| 2026-10-25 00:46:57 | Modified | `server/rooms.test.ts` | Verified the server rejects confirmation before the acknowledgement step. |
| 2026-10-25 01:02:30 | Modified | `package.json` | Added a `share` command for a local production build and ngrok tunnel. |
| 2026-10-25 01:02:30 | Created | `scripts/share.mjs` | Added a one-command launcher that checks for ngrok, builds the app, starts the local server, and tunnels the game port. |
| 2026-10-25 01:02:30 | Modified | `README.md` | Documented ngrok installation, private token setup, the share command, room joining, and restart behavior. |
| 2026-10-25 01:03:08 | Modified | `scripts/share.mjs` | Closed the tunnel if the local server exits unexpectedly. |
| 2026-10-25 01:44:45 | Modified | `src/audio.ts` | Improved Web Audio startup diagnostics, added Safari context support, and raised note and rhythm levels. |
| 2026-10-25 01:44:45 | Modified | `src/App.tsx` | Showed a clear message when playback is requested while muted and cleared stale audio errors when mute changes. |
| 2026-10-25 01:44:45 | Modified | `src/Session.tsx` | Clarified the mute action, added a test tone for every role, and disabled board playback until it contains a note. |
| 2026-10-25 01:45:15 | Modified | `src/audio.ts` | Used a silent source during the click to unlock browser audio, then scheduled audible notes after the context resumed so delayed startup cannot lose them. |
| 2026-10-25 01:45:30 | Created | `src/audio.test.ts` | Added a Web Audio scheduling check covering the unlock source, notes, rests, rhythm, and mute behavior. |
| 2026-10-25 01:45:30 | Modified | `package.json` | Included the audio behavior test in the normal test command. |
| 2026-10-25 01:45:30 | Modified | `README.md` | Explained the test tone, mute button, and why an empty composition is silent. |
| 2026-10-25 01:45:40 | Modified | `src/audio.test.ts` | Adjusted the fake audio context for Node's strip-only TypeScript runner. |
| 2026-10-25 01:47:55 | Modified | `src/Session.tsx` | Marked the game header for compact sound controls on narrow screens. |
| 2026-10-25 01:47:55 | Modified | `src/styles.css` | Kept Mute sound and Test tone accessible in the mobile game header. |
| 2026-10-25 02:00:15 | Created | `src/Dither.tsx` | Added the user-provided WebGL dither component as a decorative background renderer. |
| 2026-10-25 02:00:35 | Created | `src/Dither.css` | Sized and layered the dither canvas behind the interface without intercepting clicks. |
| 2026-10-25 02:00:35 | Modified | `src/main.tsx` | Mounted a pale lavender dither across the app, with animation disabled on narrow screens and reduced-motion devices. |
| 2026-10-25 02:00:35 | Modified | `src/styles.css` | Kept app and loading content above the fixed dither layer. |
| 2026-10-25 02:00:48 | Modified | `src/Dither.tsx` | Removed the pasted Next.js-only directive that produced a Vite build warning. |
| 2026-10-25 02:01:20 | Modified | `src/Dither.css` | Reduced dither opacity to 9% on desktop and 6% on narrow screens after visual review. |
| 2026-10-25 02:07:40 | Modified | `src/main.tsx` | Enabled the supplied dither component's click ripple so pointer clicks and taps briefly disturb the background while hover remains quiet. |
| 2026-10-25 02:24:55 | Created | `render.yaml` | Defined one paid Starter Docker web service, one instance, `/health` checks, and manual deploys so code pushes do not interrupt active rooms. |
| 2026-10-25 02:24:55 | Modified | `README.md` | Added Render Blueprint setup, three-device access, manual release steps, and the in-memory room restart limitation. |
| 2026-10-25 03:00:39 | Modified | `.gitignore` | Excluded the workspace-local npm cache used to install lint dependencies. |
| 2026-10-25 03:00:39 | Created | `eslint.config.js` | Added recommended ESLint, TypeScript, and React Hooks rules for browser and Node source files. |
| 2026-10-25 03:00:39 | Modified | `package.json` | Added the lint command and lint dependencies; moved TypeScript to the supported 6.0 line for typescript-eslint. |
| 2026-10-25 03:00:39 | Modified | `package-lock.json` | Locked the lint tooling and TypeScript 6.0.3 for reproducible installs. |
| 2026-10-25 03:00:39 | Modified | `README.md` | Documented the lint command alongside tests and the production build. |
| 2026-10-25 03:00:39 | Modified | `server/rooms.ts` | Removed an unused Rest import reported by ESLint. |
| 2026-10-25 03:00:39 | Modified | `src/Demo.tsx` | Removed an unused Rest import reported by ESLint. |
| 2026-10-25 03:00:39 | Modified | `src/Dither.tsx` | Updated the settings ref after render, keeping the WebGL renderer current without writing to a ref during render. |
| 2026-10-25 03:00:39 | Modified | `src/Session.tsx` | Removed a synchronous state update from an effect and hid slot selection while board editing is locked. |
| 2026-10-25 03:00:39 | Modified | `src/audio.test.ts` | Removed unused parameters from fake audio methods without changing their test behavior. |

## Build order

1. Puzzle rules, deterministic generation, clue separation, and exact scoring.
2. Local playable round and guided demo.
3. Web Audio playback.
4. Three-player rooms, chat, signals, and shared state.
5. Recovery, replay, polish, and deployment readiness.

## Verification

| Timestamp (IST) | Check | Result |
|---|---|---|
| 2026-10-25 00:02 | Puzzle tests | Deterministic generation, clue recovery, and exact scoring passed. |
| 2026-10-25 00:19 | Multiplayer tests | Three Socket.IO clients completed a round, revealed 8/8, replayed, and recovered a disconnected role. |
| 2026-10-25 00:28 | Browser layout | Desktop landing page and demo rendered; a mobile page-jump issue was found and fixed. |
| 2026-10-25 00:31 | Mobile layout | The eight-slot board and inline sound control fit the 500 px viewport. |
| 2026-10-25 00:33 | Final tests and build | All 8 tests passed; TypeScript and Vite production build passed. |
| 2026-10-25 00:45 | Production serving | `/health` and the built page returned HTTP 200; Chrome rendered the production demo. |
| 2026-10-25 00:47 | Final regression | All 8 tests and the production build passed after submission acknowledgements and clue-preview changes. |
| 2026-10-25 01:03 | ngrok share workflow | All 8 tests, the production build, and launcher syntax passed. The launcher reported the missing ngrok agent clearly; a public tunnel could not be verified without installation and account authentication. |
| 2026-10-25 01:46 | Audio regression | All 9 tests and the production build passed. A browser session reached a running AudioContext and created audio nodes for the test tone, Rhythm Keeper playback, and Melodist playback; physical speaker output was not measurable here. |
| 2026-10-25 01:49 | Mobile audio controls | A production browser check at a true 375 px viewport found no horizontal overflow; Mute sound and Test tone were both visible. All 9 tests and the production build passed after the mobile header changes. |
| 2026-10-25 02:03 | Dither background | All 9 tests and the production build passed. Desktop and 375 px mobile production captures showed the pale pattern behind readable content; mobile had no horizontal overflow. |
| 2026-10-25 02:09 | Dither click ripple | All 9 tests and the production build passed. At a static 375 px browser viewport, a click changed the dither image and it returned exactly to its original image after the ripple faded. |
| 2026-10-25 02:25 | Render deployment readiness | All 9 tests and the production build passed. The production server returned HTTP 200 for `/health` and the homepage. `git diff --check` passed; no Render deployment was started from this workspace. |
| 2026-10-25 03:00 | Lint regression | ESLint reported 7 issues; all were fixed. `npm run lint` passed with zero warnings, all 9 tests passed, and the TypeScript/Vite production build passed. |

No project source files were deleted. The unused `tsx` dependency was removed from the package manifests. Browser screenshots were written only to the system temporary directory.
