// Socket.io event handlers
const matchmaking = require('../services/matchmaking');
const gameRoom = require('../services/gameRoom');

function handleSocketConnection(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle matchmaking
    socket.on('joinQueue', (playerData) => {
      const player = { ...playerData, socketId: socket.id };
      const match = matchmaking.addToQueue(player);

      if (match) {
        // Create game room
        const room = gameRoom.createRoom(match.gameId, match.team1, match.team2);

        // Notify all players
        match.players.forEach(p => {
          io.to(p.socketId).emit('matchFound', {
            gameId: match.gameId,
            team: match.team1.find(t => t.id === p.id) ? 'team1' : 'team2',
            players: match.players
          });

          // Join socket room
          const playerSocket = io.sockets.sockets.get(p.socketId);
          if (playerSocket) {
            playerSocket.join(match.gameId);
          }
        });
      } else {
        socket.emit('queueUpdate', { position: matchmaking.getQueueSize() });
      }
    });

    // Handle leaving queue
    socket.on('leaveQueue', () => {
      matchmaking.removeFromQueue(socket.id);
    });

    // Handle player movement
    socket.on('playerMove', ({ gameId, position }) => {
      gameRoom.updatePlayerPosition(gameId, socket.id, position);
      socket.to(gameId).emit('playerMoved', { playerId: socket.id, position });
    });

    // Handle ball physics
    socket.on('ballUpdate', ({ gameId, ballData }) => {
      gameRoom.updateBallPosition(gameId, ballData);
      io.to(gameId).emit('ballUpdated', ballData);
    });

    // Handle scoring
    socket.on('score', ({ gameId, team }) => {
      const score = gameRoom.updateScore(gameId, team, 1);
      io.to(gameId).emit('scoreUpdate', score);
    });

    // Handle game start
    socket.on('startGame', ({ gameId }) => {
      gameRoom.updateRoomState(gameId, 'playing');
      io.to(gameId).emit('gameStarted', { gameId });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      matchmaking.removeFromQueue(socket.id);
    });
  });
}

module.exports = handleSocketConnection;
