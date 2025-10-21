// Global game state management

// Active rooms (roomId -> room object)
const rooms = new Map();

// Connected users (socketId -> user object)
const users = new Map();

// Matchmaking queue
const matchmakingQueue = [];

// Ball physics instances (roomId -> BallPhysics)
const ballPhysicsInstances = new Map();

// Game update intervals (roomId -> intervalId)
const gameIntervals = new Map();

// Bot AI instances (roomId -> Array of BotAI)
const botAIInstances = new Map();

module.exports = {
  rooms,
  users,
  matchmakingQueue,
  ballPhysicsInstances,
  gameIntervals,
  botAIInstances
};
