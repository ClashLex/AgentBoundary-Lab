# Unreliable Orchestra

A three-player cooperative browser puzzle. One player knows note/rest positions, one receives shifted pitches in note order, and one knows the inverse shift and enters the team's eight-slot answer. The room includes text chat, contextual signals, local Web Audio playback, exact 0–8 scoring, and a separate guided demo.

## Run locally

Use Node.js 24 or newer. On Windows PowerShell, use `npm.cmd` if `npm` is blocked by script execution policy.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). Create a room in one tab and join its code in two other tabs or browsers. The host is Conductor; the first and second joiners are Rhythm Keeper and Melodist. Each tab keeps its own short-lived reconnect token.

For a one-person walkthrough, choose **Try Demo** or open [http://localhost:3000/?demo=1](http://localhost:3000/?demo=1). Demo puzzles and scoring are local and separate from live rooms.

Use **Test tone** in the room header to check sound before playing. **Mute sound** and **Unmute sound** show what clicking the button will do. The shared board's Play button becomes available after a note is placed; Rest and unanswered slots are silent. If the test tone fails, the game shows an audio message. Also check the browser tab's sound permission and the device output volume.

## Share a local game over the internet with ngrok

1. Install the [ngrok agent for Windows](https://ngrok.com/download/windows). The official Windows page offers `winget install ngrok -s msstore`.
2. Create a free ngrok account and run `ngrok config add-authtoken <YOUR_TOKEN>` once in your own terminal. Keep the token private and out of this repository.
3. Run `npm.cmd run share` from this project. This builds the app, starts the local production server on port 3000, and opens an ngrok HTTP tunnel. Use this command instead of `npm.cmd run dev` while sharing.
4. Copy the **HTTPS forwarding URL** shown by ngrok. Open it on all three devices, including the host's. One player creates a room and shares its six-character room code; the other two join with that code.

Keep the command window and host computer running for the round. The share command rebuilds each time you start it; after editing code, stop it with Ctrl+C and run it again. If port 3000 is busy, stop the other server first or set `PORT` before starting the share command. The free ngrok plan may show each player a one-time browser warning that they must continue through before the game loads.

## Check the build

```powershell
npm.cmd test
npm.cmd run build
```

The tests cover deterministic puzzle generation, clue recovery, exact scoring, room permissions and recovery, plus a complete three-client Socket.IO round. The build type-checks the client and server and writes browser assets to `dist/`.

## Production

Set `NODE_ENV=production`, install packages, run `npm run build`, and start with `npm start`. The Node service serves the built frontend and Socket.IO from one origin. `PORT` defaults to 3000. A Dockerfile is included for a single-service deployment.

Rooms, chat, and results live in memory. Run one server instance for the MVP; a restart clears active rooms. The server holds live targets and sends each browser only its assigned clue until results.

## Rules at a glance

- Each target has eight slots using C, D, E, G, A, or an explicit Rest at 100 BPM.
- A round shifts sounding pitches by one to four steps around C → D → E → G → A → C.
- Rhythm Keeper sees note/rest positions. Melodist sees shifted pitches in sounding-note order. Conductor sees the number of steps backward and edits the answer board.
- The Conductor submits a complete board. Every exact pitch or Rest in the correct slot earns one point, up to 8/8.
- A disconnect pauses the room. The player can return within 60 seconds using their saved room token.

See [BUILD_CHANGELOG.md](BUILD_CHANGELOG.md) for timestamped file changes.
