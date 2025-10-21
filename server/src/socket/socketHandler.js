// Socket.io event handlers
const { supabase } = require('../config/supabase');
const { rooms, users, matchmakingQueue, ballPhysicsInstances, gameIntervals } = require('./gameState');
const BallPhysics = require('../services/ballPhysics');

// Generate 4-digit room code
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Generate bot character
function generateBotCharacter(botNumber) {
  const skinColors = ['#FFE0BD', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#6B4423'];
  const hairStyles = ['short', 'long', 'curly', 'bald', 'mohawk'];
  const hairColors = ['#000000', '#4A3728', '#8B4513', '#D2691E', '#FFD700', '#FF0000', '#0000FF'];

  return {
    id: `bot_${Date.now()}_${botNumber}`,
    name: `Bot ${botNumber}`,
    isBot: true,
    skinColor: skinColors[Math.floor(Math.random() * skinColors.length)],
    hairStyle: hairStyles[Math.floor(Math.random() * hairStyles.length)],
    hairColor: hairColors[Math.floor(Math.random() * hairColors.length)]
  };
}

// Check if matchmaking queue has enough players (6 for 3v3)
function checkMatchmaking(io) {
  if (matchmakingQueue.length >= 6) {
    const players = matchmakingQueue.splice(0, 6);
    createMatchmakingRoom(io, players);
  }
}

// Create a room from matchmaking
function createMatchmakingRoom(io, players) {
  const roomId = `room_${Date.now()}`;
  const code = generateRoomCode();

  const room = {
    roomId,
    code,
    host: players[0].socketId,
    players: players.map(p => ({
      socketId: p.socketId,
      userId: p.userId,
      characterId: p.characterId,
      characterName: p.characterName,
      team: null
    })),
    teamA: [],
    teamB: [],
    status: 'waiting', // waiting, in_game, finished
    isPrivate: false,
    createdAt: new Date().toISOString()
  };

  rooms.set(roomId, room);

  // Update all players
  players.forEach(player => {
    const user = users.get(player.socketId);
    if (user) {
      user.roomId = roomId;
      user.status = 'in_room';

      // Join socket.io room
      io.sockets.sockets.get(player.socketId)?.join(roomId);
    }
  });

  // Notify all players
  io.to(roomId).emit('room_created', {
    roomId,
    code,
    host: room.host,
    isPrivate: false,
    players: room.players,
    teamA: room.teamA,
    teamB: room.teamB
  });

  console.log(`[Matchmaking] Room ${roomId} created with ${players.length} players`);
}

// Remove player from matchmaking queue
function removeFromMatchmaking(socketId) {
  const index = matchmakingQueue.findIndex(p => p.socketId === socketId);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
    return true;
  }
  return false;
}

// Start ball physics for a room
function startBallPhysics(io, roomId) {
  // Create ball physics instance
  const ballPhysics = new BallPhysics(roomId);
  ballPhysicsInstances.set(roomId, ballPhysics);

  // Start physics update loop (60fps = ~16ms)
  const intervalId = setInterval(() => {
    const scoreEvent = ballPhysics.update();

    // Broadcast ball position to all players
    io.to(roomId).emit('ball_update', ballPhysics.getBallState());

    // Handle scoring events
    if (scoreEvent) {
      io.to(roomId).emit('score_update', scoreEvent);

      // Handle game end
      if (scoreEvent.gameEnd) {
        io.to(roomId).emit('game_end', {
          winner: scoreEvent.winner,
          finalScore: scoreEvent.score
        });

        // Stop physics updates
        stopBallPhysics(roomId);

        // Update room status
        const room = rooms.get(roomId);
        if (room) {
          room.status = 'finished';
        }
      }
    }
  }, 16); // 60fps

  gameIntervals.set(roomId, intervalId);
  console.log(`[Ball Physics] Started for room ${roomId}`);
}

// Stop ball physics for a room
function stopBallPhysics(roomId) {
  const intervalId = gameIntervals.get(roomId);
  if (intervalId) {
    clearInterval(intervalId);
    gameIntervals.delete(roomId);
  }

  ballPhysicsInstances.delete(roomId);
  console.log(`[Ball Physics] Stopped for room ${roomId}`);
}

// Remove player from room
function leaveRoom(io, socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const user = users.get(socket.id);
  if (!user) return;

  // Remove player from room
  room.players = room.players.filter(p => p.socketId !== socket.id);
  room.teamA = room.teamA.filter(p => p.socketId !== socket.id);
  room.teamB = room.teamB.filter(p => p.socketId !== socket.id);

  // Update user
  user.roomId = null;
  user.team = null;
  user.status = 'connected';

  // Leave socket.io room
  socket.leave(roomId);

  // If room is empty, delete it
  if (room.players.length === 0) {
    // Stop ball physics if running
    stopBallPhysics(roomId);
    rooms.delete(roomId);
    console.log(`[Room] ${roomId} deleted (empty)`);
  } else {
    // If host left, assign new host
    if (room.host === socket.id && room.players.length > 0) {
      room.host = room.players[0].socketId;
      io.to(roomId).emit('host_changed', { newHost: room.host });
    }

    // Notify remaining players
    io.to(roomId).emit('player_left', {
      socketId: socket.id,
      players: room.players,
      teamA: room.teamA,
      teamB: room.teamB
    });
  }

  console.log(`[Room] Player ${user.characterName} left room ${roomId}`);
}

function handleSocketConnection(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // 1. Register user
    socket.on('register', async ({ userId, characterId }) => {
      console.log(`[DEBUG] Register called - UserId: ${userId}, CharacterId: ${characterId}, SocketId: ${socket.id}`);

      try {
        // Fetch character info from Supabase
        const { data: character, error } = await supabase
          .from('characters')
          .select('*')
          .eq('id', characterId)
          .single();

        if (error) throw error;

        console.log(`[DEBUG] Character from DB:`, character);

        // Store user info
        const userData = {
          socketId: socket.id,
          userId,
          characterId,
          characterName: character.name,
          roomId: null,
          team: null,
          status: 'connected'
        };

        users.set(socket.id, userData);
        console.log(`[DEBUG] User stored in users Map:`, userData);
        console.log(`[DEBUG] Total users in Map:`, users.size);

        socket.emit('registered', {
          success: true,
          characterName: character.name
        });

        console.log(`[Register] ${character.name} registered (${socket.id})`);
      } catch (err) {
        console.error('[Register] Error:', err);
        socket.emit('registered', {
          success: false,
          error: err.message
        });
      }
    });

    // 2. Create private room
    socket.on('create_private_room', () => {
      console.log(`[DEBUG] create_private_room called - SocketId: ${socket.id}`);

      const user = users.get(socket.id);
      console.log(`[DEBUG] User from users Map:`, user);

      if (!user) {
        socket.emit('error', { message: '먼저 등록이 필요합니다' });
        return;
      }

      if (user.roomId) {
        socket.emit('error', { message: '이미 방에 있습니다' });
        return;
      }

      const roomId = `room_${Date.now()}`;
      const code = generateRoomCode();

      const room = {
        roomId,
        code,
        host: socket.id,
        players: [{
          socketId: socket.id,
          userId: user.userId,
          characterId: user.characterId,
          characterName: user.characterName,
          team: null
        }],
        teamA: [],
        teamB: [],
        status: 'waiting',
        isPrivate: true,
        createdAt: new Date().toISOString()
      };

      console.log(`[DEBUG] Room created:`, room);

      rooms.set(roomId, room);
      user.roomId = roomId;
      user.status = 'in_room';

      socket.join(roomId);

      const roomCreatedData = {
        roomId,
        code,
        host: room.host,
        isPrivate: true,
        players: room.players,
        teamA: room.teamA,
        teamB: room.teamB
      };

      console.log(`[DEBUG] Emitting room_created:`, roomCreatedData);
      socket.emit('room_created', roomCreatedData);

      console.log(`[Room] ${user.characterName} created private room ${code}`);
    });

    // 3. Join private room
    socket.on('join_private_room', ({ code }) => {
      const user = users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: '먼저 등록이 필요합니다' });
        return;
      }

      if (user.roomId) {
        socket.emit('error', { message: '이미 방에 있습니다' });
        return;
      }

      // Find room by code
      const room = Array.from(rooms.values()).find(r => r.code === code);
      if (!room) {
        socket.emit('error', { message: '방 코드가 올바르지 않습니다' });
        return;
      }

      // Check if user already in this room (duplicate join)
      const alreadyInRoom = room.players.some(p => p.userId === user.userId);
      if (alreadyInRoom) {
        socket.emit('error', { message: '이미 이 방에 참가하고 있습니다' });
        return;
      }

      if (room.players.length >= 6) {
        socket.emit('error', { message: '방이 가득 찼습니다 (최대 6명)' });
        return;
      }

      if (room.status !== 'waiting') {
        socket.emit('error', { message: '이미 게임이 시작되었습니다' });
        return;
      }

      // Add player to room
      room.players.push({
        socketId: socket.id,
        userId: user.userId,
        characterId: user.characterId,
        characterName: user.characterName,
        team: null
      });

      user.roomId = room.roomId;
      user.status = 'in_room';

      socket.join(room.roomId);

      // Notify all players in room
      io.to(room.roomId).emit('player_joined', {
        player: {
          socketId: socket.id,
          characterName: user.characterName
        },
        players: room.players
      });

      // Send room info to joining player
      socket.emit('room_joined', {
        roomId: room.roomId,
        code: room.code,
        host: room.host,
        players: room.players,
        teamA: room.teamA,
        teamB: room.teamB
      });

      console.log(`[Room] ${user.characterName} joined room ${code}`);
    });

    // 4. Select team
    socket.on('select_team', ({ team }) => {
      console.log(`[DEBUG] select_team called - Team: ${team}, SocketId: ${socket.id}`);

      const user = users.get(socket.id);
      console.log(`[DEBUG] User from users Map:`, user);

      if (!user || !user.roomId) {
        socket.emit('error', { message: '방에 있지 않습니다' });
        return;
      }

      const room = rooms.get(user.roomId);
      console.log(`[DEBUG] Room before team selection:`, {
        roomId: room?.roomId,
        teamA: room?.teamA,
        teamB: room?.teamB,
        players: room?.players
      });

      if (!room) return;

      if (team !== 'A' && team !== 'B') {
        socket.emit('error', { message: '잘못된 팀입니다' });
        return;
      }

      // Remove from current team first
      room.teamA = room.teamA.filter(p => p.socketId !== socket.id);
      room.teamB = room.teamB.filter(p => p.socketId !== socket.id);

      // Check if target team is full AFTER removing from current team
      const targetTeam = team === 'A' ? room.teamA : room.teamB;
      if (targetTeam.length >= 3) {
        socket.emit('error', { message: '팀이 가득 찼습니다' });
        return;
      }

      // Add to new team
      const playerData = {
        socketId: socket.id,
        userId: user.userId,
        characterId: user.characterId,
        characterName: user.characterName,
        team
      };

      // Directly push to the actual array
      if (team === 'A') {
        room.teamA.push(playerData);
      } else {
        room.teamB.push(playerData);
      }

      user.team = team;

      // Update player in room.players
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players[playerIndex].team = team;
      }

      console.log(`[DEBUG] Room after team selection:`, {
        roomId: room.roomId,
        teamA: room.teamA,
        teamB: room.teamB,
        players: room.players,
        unassigned: room.players.filter(p => !p.team)
      });

      // Notify all players
      const updateData = {
        teamA: room.teamA,
        teamB: room.teamB,
        players: room.players
      };

      console.log(`[DEBUG] Emitting team_updated to room ${room.roomId}:`, updateData);
      io.to(room.roomId).emit('team_updated', updateData);

      console.log(`[Room] ${user.characterName} joined team ${team}`);
    });

    // 5. Start game
    socket.on('start_game', () => {
      const user = users.get(socket.id);
      if (!user || !user.roomId) {
        socket.emit('error', { message: '방에 있지 않습니다' });
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) return;

      if (room.host !== socket.id) {
        socket.emit('error', { message: '방장만 게임을 시작할 수 있습니다' });
        return;
      }

      if (room.teamA.length === 0 || room.teamB.length === 0) {
        socket.emit('error', { message: '각 팀에 최소 1명씩 있어야 합니다' });
        return;
      }

      if (room.teamA.length > 3 || room.teamB.length > 3) {
        socket.emit('error', { message: '각 팀은 최대 3명까지 가능합니다' });
        return;
      }

      room.status = 'in_game';

      // Start ball physics
      startBallPhysics(io, room.roomId);

      io.to(room.roomId).emit('game_started', {
        roomId: room.roomId,
        teamA: room.teamA,
        teamB: room.teamB
      });

      console.log(`[Game] Game started in room ${room.code}`);
    });

    // 6. Join matchmaking
    socket.on('join_matchmaking', () => {
      const user = users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: '먼저 등록이 필요합니다' });
        return;
      }

      if (user.roomId) {
        socket.emit('error', { message: '이미 방에 있습니다' });
        return;
      }

      // Check if already in queue
      const alreadyInQueue = matchmakingQueue.some(p => p.socketId === socket.id);
      if (alreadyInQueue) {
        socket.emit('error', { message: '이미 매칭 대기 중입니다' });
        return;
      }

      matchmakingQueue.push({
        socketId: socket.id,
        userId: user.userId,
        characterId: user.characterId,
        characterName: user.characterName,
        joinedAt: new Date().toISOString()
      });

      user.status = 'matchmaking';

      socket.emit('matchmaking_joined', {
        queuePosition: matchmakingQueue.length,
        queueSize: matchmakingQueue.length
      });

      console.log(`[Matchmaking] ${user.characterName} joined queue (${matchmakingQueue.length}/6)`);

      // Check if we can create a match
      checkMatchmaking(io);
    });

    // 7. Leave matchmaking
    socket.on('leave_matchmaking', () => {
      const removed = removeFromMatchmaking(socket.id);
      if (removed) {
        const user = users.get(socket.id);
        if (user) {
          user.status = 'connected';
        }
        socket.emit('matchmaking_left', { success: true });
        console.log(`[Matchmaking] Player left queue`);
      }
    });

    // 8. Leave room
    socket.on('leave_room', () => {
      const user = users.get(socket.id);
      if (!user || !user.roomId) return;

      leaveRoom(io, socket, user.roomId);
      socket.emit('room_left', { success: true });
    });

    // 9. Player movement sync
    socket.on('player_move', (data) => {
      const user = users.get(socket.id);
      if (!user || !user.roomId) return;

      const room = rooms.get(user.roomId);
      if (!room || room.status !== 'in_game') return;

      // Broadcast movement to other players in the room
      socket.to(room.roomId).emit('player_moved', {
        socketId: socket.id,
        x: data.x,
        y: data.y,
        velocityX: data.velocityX,
        velocityY: data.velocityY,
        facingRight: data.facingRight,
        isGrounded: data.isGrounded
      });
    });

    // 10. Player action sync (jump, dive, toss, spike)
    socket.on('player_action', (data) => {
      const user = users.get(socket.id);
      if (!user || !user.roomId) return;

      const room = rooms.get(user.roomId);
      if (!room || room.status !== 'in_game') return;

      // Broadcast action to other players in the room
      socket.to(room.roomId).emit('player_action', {
        socketId: socket.id,
        action: data.action, // 'jump', 'dive', 'toss', 'spike'
        data: data.data // Additional data (e.g., spike power)
      });
    });

    // 11. Add bot to room
    socket.on('add_bot', () => {
      const user = users.get(socket.id);
      if (!user || !user.roomId) {
        socket.emit('error', { message: '방에 있지 않습니다' });
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) return;

      // Only host can add bots
      if (room.host !== socket.id) {
        socket.emit('error', { message: '방장만 봇을 추가할 수 있습니다' });
        return;
      }

      // Check room capacity
      if (room.players.length >= 6) {
        socket.emit('error', { message: '방이 가득 찼습니다 (최대 6명)' });
        return;
      }

      // Generate bot
      const botNumber = room.players.filter(p => p.isBot).length + 1;
      const botCharacter = generateBotCharacter(botNumber);

      const botPlayer = {
        socketId: botCharacter.id,
        userId: botCharacter.id,
        characterId: botCharacter.id,
        characterName: botCharacter.name,
        isBot: true,
        character: botCharacter,
        team: null
      };

      room.players.push(botPlayer);

      // Notify all players
      io.to(room.roomId).emit('bot_added', {
        bot: botPlayer,
        players: room.players
      });

      console.log(`[Bot] ${botCharacter.name} added to room ${room.code}`);
    });

    // 12. Remove bot from room
    socket.on('remove_bot', ({ botId }) => {
      const user = users.get(socket.id);
      if (!user || !user.roomId) {
        socket.emit('error', { message: '방에 있지 않습니다' });
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) return;

      // Only host can remove bots
      if (room.host !== socket.id) {
        socket.emit('error', { message: '방장만 봇을 제거할 수 있습니다' });
        return;
      }

      // Find and remove bot
      const botIndex = room.players.findIndex(p => p.socketId === botId && p.isBot);
      if (botIndex === -1) {
        socket.emit('error', { message: '봇을 찾을 수 없습니다' });
        return;
      }

      const bot = room.players[botIndex];
      room.players.splice(botIndex, 1);

      // Remove from teams
      room.teamA = room.teamA.filter(p => p.socketId !== botId);
      room.teamB = room.teamB.filter(p => p.socketId !== botId);

      // Notify all players
      io.to(room.roomId).emit('bot_removed', {
        botId,
        players: room.players,
        teamA: room.teamA,
        teamB: room.teamB
      });

      console.log(`[Bot] ${bot.characterName} removed from room ${room.code}`);
    });

    // 13. Assign bot to team
    socket.on('assign_bot_team', ({ botId, team }) => {
      const user = users.get(socket.id);
      if (!user || !user.roomId) {
        socket.emit('error', { message: '방에 있지 않습니다' });
        return;
      }

      const room = rooms.get(user.roomId);
      if (!room) return;

      // Only host can assign bot teams
      if (room.host !== socket.id) {
        socket.emit('error', { message: '방장만 봇 팀을 배치할 수 있습니다' });
        return;
      }

      if (team !== 'A' && team !== 'B') {
        socket.emit('error', { message: '잘못된 팀입니다' });
        return;
      }

      // Find bot
      const botIndex = room.players.findIndex(p => p.socketId === botId && p.isBot);
      if (botIndex === -1) {
        socket.emit('error', { message: '봇을 찾을 수 없습니다' });
        return;
      }

      // Remove from current team
      room.teamA = room.teamA.filter(p => p.socketId !== botId);
      room.teamB = room.teamB.filter(p => p.socketId !== botId);

      // Check if target team is full
      const targetTeam = team === 'A' ? room.teamA : room.teamB;
      if (targetTeam.length >= 3) {
        socket.emit('error', { message: '팀이 가득 찼습니다' });
        return;
      }

      // Add to new team
      const bot = room.players[botIndex];
      bot.team = team;

      const botData = {
        socketId: bot.socketId,
        userId: bot.userId,
        characterId: bot.characterId,
        characterName: bot.characterName,
        isBot: true,
        character: bot.character,
        team
      };

      if (team === 'A') {
        room.teamA.push(botData);
      } else {
        room.teamB.push(botData);
      }

      // Update player in room.players
      room.players[botIndex].team = team;

      // Notify all players
      io.to(room.roomId).emit('team_updated', {
        teamA: room.teamA,
        teamB: room.teamB,
        players: room.players
      });

      console.log(`[Bot] ${bot.characterName} assigned to team ${team}`);
    });

    // 14. Ball hit event
    socket.on('ball_hit', (data) => {
      const user = users.get(socket.id);
      if (!user || !user.roomId || !user.team) return;

      const room = rooms.get(user.roomId);
      if (!room || room.status !== 'in_game') return;

      const ballPhysics = ballPhysicsInstances.get(room.roomId);
      if (!ballPhysics) return;

      // Process ball hit
      const scoreEvent = ballPhysics.hitBall(socket.id, user.team, {
        power: data.power, // 'toss' or 'spike'
        direction: data.direction,
        gauge: data.gauge
      });

      // If there's a scoring event (e.g., 3-touch violation)
      if (scoreEvent) {
        io.to(room.roomId).emit('score_update', scoreEvent);

        if (scoreEvent.gameEnd) {
          io.to(room.roomId).emit('game_end', {
            winner: scoreEvent.winner,
            finalScore: scoreEvent.score
          });

          stopBallPhysics(room.roomId);
          room.status = 'finished';
        }
      }

      console.log(`[Ball] ${user.characterName} hit ball (${data.power})`);
    });

    // 15. Disconnect
    socket.on('disconnect', () => {
      const user = users.get(socket.id);
      if (!user) {
        console.log(`[Socket] User disconnected: ${socket.id}`);
        return;
      }

      console.log(`[Socket] ${user.characterName} disconnected`);

      // Remove from matchmaking if in queue
      removeFromMatchmaking(socket.id);

      // Leave room if in one
      if (user.roomId) {
        leaveRoom(io, socket, user.roomId);
      }

      // Remove user
      users.delete(socket.id);
    });
  });
}

module.exports = handleSocketConnection;
