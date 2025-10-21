// Socket.io client configuration
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// Store user info for auto re-register
let userInfo = null;
let reconnectionCallback = null;

// Socket service object
const socketService = {
  socket,

  // Connect to server
  connect() {
    if (!socket.connected) {
      socket.connect();
      console.log('[Socket] Connecting to server...');
    }
  },

  // Disconnect from server
  disconnect() {
    userInfo = null; // Clear stored user info
    if (socket.connected) {
      socket.disconnect();
      console.log('[Socket] Disconnected from server');
    }
  },

  // Register user
  register(userId, characterId) {
    userInfo = { userId, characterId }; // Store for auto re-register
    socket.emit('register', { userId, characterId });
  },

  // Set callback for reconnection event
  onReconnect(callback) {
    reconnectionCallback = callback;
  },

  // Create private room
  createPrivateRoom() {
    socket.emit('create_private_room');
  },

  // Join private room
  joinPrivateRoom(code) {
    socket.emit('join_private_room', { code });
  },

  // Select team
  selectTeam(team) {
    socket.emit('select_team', { team });
  },

  // Start game
  startGame() {
    socket.emit('start_game');
  },

  // Join matchmaking
  joinMatchmaking() {
    socket.emit('join_matchmaking');
  },

  // Leave matchmaking
  leaveMatchmaking() {
    socket.emit('leave_matchmaking');
  },

  // Leave room
  leaveRoom() {
    socket.emit('leave_room');
  },

  // Generic emit
  emit(event, data) {
    socket.emit(event, data);
  },

  // Listen to event
  on(event, callback) {
    socket.on(event, callback);
  },

  // Remove event listener
  off(event, callback) {
    if (callback) {
      socket.off(event, callback);
    } else {
      socket.off(event);
    }
  },

  // Remove all listeners for an event
  removeAllListeners(event) {
    if (event) {
      socket.removeAllListeners(event);
    } else {
      socket.removeAllListeners();
    }
  },

  // Check if connected
  isConnected() {
    return socket.connected;
  },

  // Get socket ID
  getSocketId() {
    return socket.id;
  }
};

// Auto reconnection and re-register
socket.on('connect', () => {
  console.log('[Socket] Connected to server');

  // Auto re-register if we have stored user info
  if (userInfo) {
    console.log('[Socket] Auto re-registering user...');
    socket.emit('register', userInfo);
  }
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected:', reason);
});

socket.on('reconnect', (attemptNumber) => {
  console.log('[Socket] Reconnected after', attemptNumber, 'attempts');

  // Call reconnection callback if set
  if (reconnectionCallback) {
    reconnectionCallback();
  }
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('[Socket] Reconnection attempt', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('[Socket] Reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('[Socket] Reconnection failed after all attempts');
});

export default socketService;
