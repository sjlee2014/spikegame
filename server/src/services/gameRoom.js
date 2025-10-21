// Game room management service
class GameRoomService {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(gameId, team1, team2) {
    const room = {
      id: gameId,
      team1,
      team2,
      state: 'waiting',
      score: { team1: 0, team2: 0 },
      ball: null,
      players: new Map(),
      createdAt: Date.now()
    };

    this.rooms.set(gameId, room);
    return room;
  }

  getRoom(gameId) {
    return this.rooms.get(gameId);
  }

  updateRoomState(gameId, state) {
    const room = this.rooms.get(gameId);
    if (room) {
      room.state = state;
    }
  }

  updatePlayerPosition(gameId, playerId, position) {
    const room = this.rooms.get(gameId);
    if (room) {
      room.players.set(playerId, position);
    }
  }

  updateBallPosition(gameId, ballData) {
    const room = this.rooms.get(gameId);
    if (room) {
      room.ball = ballData;
    }
  }

  updateScore(gameId, team, points) {
    const room = this.rooms.get(gameId);
    if (room) {
      room.score[team] += points;
    }
    return room?.score;
  }

  deleteRoom(gameId) {
    this.rooms.delete(gameId);
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }
}

module.exports = new GameRoomService();
