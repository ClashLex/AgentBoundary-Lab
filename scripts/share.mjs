import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be a number from 1 to 65535.');
  process.exit(1);
}

const ngrokCheck = spawnSync('ngrok', ['version'], { stdio: 'pipe' });
if (ngrokCheck.error || ngrokCheck.status !== 0) {
  console.error('ngrok is not available. Install the ngrok agent and add it to PATH: https://ngrok.com/download/windows');
  console.error('Then add your account token once: ngrok config add-authtoken <YOUR_TOKEN>');
  process.exit(1);
}

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Start this command through npm: npm.cmd run share');
  process.exit(1);
}

const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
  cwd: root,
  stdio: 'inherit'
});
if (build.error || build.status !== 0) {
  console.error('The production build failed; the tunnel was not started.');
  process.exit(build.status || 1);
}

const server = spawn(process.execPath, [
  '--experimental-strip-types',
  path.join(root, 'server', 'index.ts')
], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
  stdio: ['inherit', 'pipe', 'inherit']
});

let tunnel;
let stopping = false;
let serverFailed = false;
function stop() {
  if (stopping) return;
  stopping = true;
  tunnel?.kill();
  server.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const ready = await new Promise((resolve) => {
  let output = '';
  server.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    output += text;
    if (output.includes('Unreliable Orchestra is ready on')) resolve(true);
    if (output.length > 1000) output = output.slice(-1000);
  });
  server.once('error', () => resolve(false));
  server.once('exit', () => resolve(false));
});

if (!ready) {
  console.error('The local server could not start. Check whether port ' + port + ' is already in use.');
  process.exit(1);
}

server.on('exit', () => {
  if (stopping) return;
  serverFailed = true;
  console.error('The local server stopped; closing the ngrok tunnel.');
  tunnel?.kill();
});

console.log('Opening an ngrok tunnel to http://localhost:' + port + ' ...');
console.log('Share the HTTPS forwarding URL and the room code with the other two players.');
tunnel = spawn('ngrok', ['http', String(port)], { cwd: root, stdio: 'inherit' });

const exitCode = await new Promise((resolve) => {
  tunnel.once('error', (error) => {
    console.error('Could not start ngrok:', error.message);
    resolve(1);
  });
  tunnel.once('exit', (code) => resolve(code ?? 0));
});

stop();
process.exitCode = serverFailed ? 1 : exitCode;
