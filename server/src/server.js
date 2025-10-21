// Main server file
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const handleSocketConnection = require('./socket/socketHandler');
const { rooms, users, matchmakingQueue } = require('./socket/gameState');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Debug endpoints
app.get('/debug/rooms', (req, res) => {
  const roomsArray = Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    code: room.code,
    host: room.host,
    players: room.players.map(p => ({
      userId: p.userId,
      characterName: p.characterName,
      team: p.team
    })),
    teamA: room.teamA.map(p => p.characterName),
    teamB: room.teamB.map(p => p.characterName),
    status: room.status,
    isPrivate: room.isPrivate,
    createdAt: room.createdAt
  }));

  res.json({
    totalRooms: rooms.size,
    rooms: roomsArray
  });
});

app.get('/debug/users', (req, res) => {
  const usersArray = Array.from(users.entries()).map(([socketId, user]) => ({
    socketId,
    userId: user.userId,
    characterId: user.characterId,
    characterName: user.characterName,
    roomId: user.roomId,
    team: user.team,
    status: user.status
  }));

  res.json({
    totalUsers: users.size,
    users: usersArray
  });
});

app.get('/debug/matchmaking', (req, res) => {
  res.json({
    queueSize: matchmakingQueue.length,
    queue: matchmakingQueue.map(player => ({
      userId: player.userId,
      characterName: player.characterName,
      joinedAt: player.joinedAt
    }))
  });
});

// Socket.io connection handling
handleSocketConnection(io);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Debug endpoints available at:`);
  console.log(`  - http://localhost:${PORT}/debug/rooms`);
  console.log(`  - http://localhost:${PORT}/debug/users`);
  console.log(`  - http://localhost:${PORT}/debug/matchmaking`);
});
