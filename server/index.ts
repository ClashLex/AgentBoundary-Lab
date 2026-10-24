import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { Ack, ActionEvent, JoinResponse } from '../src/shared/protocol.ts';
import { RoomError, RoomManager, type Player, type Room } from './rooms.ts';

type Reply<T = undefined> = (answer: Ack<T>) => void;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { maxHttpBufferSize: 16_384 });
const rooms = new RoomManager();
const socketByPlayer = new Map<string, string>();

function safeError(error: unknown): string {
  if (error instanceof RoomError) return error.message;
  console.error('Unexpected room error:', error);
  return 'Something went wrong. Please try again.';
}

function broadcast(room: Room) {
  for (const player of room.players) {
    if (!player.connected) continue;
    const socketId = socketByPlayer.get(player.id);
    const socket = socketId ? io.sockets.sockets.get(socketId) : undefined;
    socket?.emit('room:state', rooms.view(room, player.id));
  }
}

io.on('connection', (socket) => {
  let playerId: string | undefined;

  function bind(room: Room, player: Player) {
    const previousSocketId = socketByPlayer.get(player.id);
    socketByPlayer.set(player.id, socket.id);
    playerId = player.id;
    socket.join(room.code);
    if (previousSocketId && previousSocketId !== socket.id) {
      io.sockets.sockets.get(previousSocketId)?.disconnect(true);
    }
  }

  socket.on('room:create', (reply: Reply<JoinResponse>) => {
    if (typeof reply !== 'function') return;
    try {
      if (playerId) throw new RoomError('Leave your current room first.');
      const { room, player } = rooms.create();
      bind(room, player);
      reply({ ok: true, data: {
        playerId: player.id,
        token: player.token,
        view: rooms.view(room, player.id)
      } });
      broadcast(room);
    } catch (error) {
      reply({ ok: false, error: safeError(error) });
    }
  });

  socket.on('room:join', (payload: { code?: unknown }, reply: Reply<JoinResponse>) => {
    if (typeof reply !== 'function') return;
    try {
      if (playerId) throw new RoomError('Leave your current room first.');
      const { room, player } = rooms.join(payload?.code);
      bind(room, player);
      reply({ ok: true, data: {
        playerId: player.id,
        token: player.token,
        view: rooms.view(room, player.id)
      } });
      broadcast(room);
    } catch (error) {
      reply({ ok: false, error: safeError(error) });
    }
  });

  socket.on('player:reconnect', (
    payload: { code?: unknown; token?: unknown },
    reply: Reply<JoinResponse>
  ) => {
    if (typeof reply !== 'function') return;
    try {
      const { room, player } = rooms.reconnect(payload?.code, payload?.token);
      bind(room, player);
      reply({ ok: true, data: {
        playerId: player.id,
        token: player.token,
        view: rooms.view(room, player.id)
      } });
      broadcast(room);
    } catch (error) {
      reply({ ok: false, error: safeError(error) });
    }
  });

  const actions: ActionEvent[] = [
    'player:ready',
    'round:start',
    'board:update',
    'chat:send',
    'signal:send',
    'round:submit-request',
    'round:submit-confirm',
    'round:submit-cancel',
    'round:replay',
    'round:next',
    'round:abort'
  ];
  for (const event of actions) {
    socket.on(event, async (payload: Record<string, unknown>, reply: Reply) => {
      if (typeof reply !== 'function') return;
      try {
        if (!playerId) throw new RoomError('Join a room first.');
        let room: Room;
        switch (event) {
          case 'player:ready': room = rooms.setReady(playerId, payload?.ready); break;
          case 'round:start': room = rooms.start(playerId); break;
          case 'board:update': room = rooms.updateBoard(playerId, payload?.slot, payload?.value); break;
          case 'chat:send': room = rooms.sendChat(playerId, payload?.text); break;
          case 'signal:send': room = rooms.sendSignal(playerId, payload); break;
          case 'round:submit-request': {
            room = rooms.requestSubmission(playerId);
            broadcast(room);
            try {
              await io.to(room.code).timeout(5000).emitWithAck('round:submit-pending', { code: room.code });
              rooms.markSubmissionReady(playerId);
              broadcast(room);
              reply({ ok: true, data: undefined });
            } catch {
              if (room.phase === 'playing' && room.pending) {
                rooms.cancelSubmission(playerId);
                broadcast(room);
              }
              reply({ ok: false, error: 'Not everyone received the confirmation. Try submitting again.' });
            }
            return;
          }
          case 'round:submit-confirm': room = rooms.confirmSubmission(playerId); break;
          case 'round:submit-cancel': room = rooms.cancelSubmission(playerId); break;
          case 'round:replay': room = rooms.advance(playerId, false); break;
          case 'round:next': room = rooms.advance(playerId, true); break;
          case 'round:abort': room = rooms.abort(playerId); break;
        }
        broadcast(room);
        reply({ ok: true, data: undefined });
      } catch (error) {
        reply({ ok: false, error: safeError(error) });
      }
    });
  }

  socket.on('room:leave', (reply?: Reply) => {
    if (!playerId) {
      if (typeof reply === 'function') reply({ ok: true, data: undefined });
      return;
    }
    try {
      const currentId = playerId;
      playerId = undefined;
      socketByPlayer.delete(currentId);
      const room = rooms.leave(currentId);
      if (room) {
        socket.leave(room.code);
        broadcast(room);
      }
      if (typeof reply === 'function') reply({ ok: true, data: undefined });
    } catch (error) {
      const message = safeError(error);
      if (typeof reply === 'function') reply({ ok: false, error: message });
      else socket.emit('room:error', message);
    }
  });

  socket.on('disconnect', () => {
    if (!playerId || socketByPlayer.get(playerId) !== socket.id) return;
    socketByPlayer.delete(playerId);
    const room = rooms.disconnect(playerId);
    if (room) broadcast(room);
  });
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist));
  app.use((request, response, next) => {
    if (request.method !== 'GET' || !request.accepts('html')) return next();
    response.sendFile(path.join(dist, 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'custom'
  });
  app.use(vite.middlewares);
  app.use(async (request, response, next) => {
    if (request.method !== 'GET' || !request.accepts('html')) return next();
    try {
      const template = await readFile(path.join(root, 'index.html'), 'utf8');
      const html = await vite.transformIndexHtml(request.originalUrl, template);
      response.status(200).type('html').send(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, '0.0.0.0', () => {
  console.log('Unreliable Orchestra is ready on http://localhost:' + port);
});

setInterval(() => {
  for (const room of rooms.expireGrace()) broadcast(room);
  for (const code of rooms.prune()) io.to(code).emit('room:error', 'This room expired. Create a new room to play again.');
}, 1000).unref();
