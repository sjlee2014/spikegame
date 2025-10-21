// Global game state management

// Active rooms (roomId -> room object)
const rooms = new Map();

// Connected users (socketId -> user object)
const users = new Map();

// Matchmaking queue
const matchmakingQueue = [];

module.exports = {
  rooms,
  users,
  matchmakingQueue
};
