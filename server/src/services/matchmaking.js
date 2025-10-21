// Matchmaking service
class MatchmakingService {
  constructor() {
    this.queue = [];
    this.games = new Map();
  }

  addToQueue(player) {
    this.queue.push(player);
    return this.checkForMatch();
  }

  removeFromQueue(playerId) {
    this.queue = this.queue.filter(p => p.id !== playerId);
  }

  checkForMatch() {
    // Need 6 players for a 3v3 match
    if (this.queue.length >= 6) {
      const players = this.queue.splice(0, 6);
      return this.createMatch(players);
    }
    return null;
  }

  createMatch(players) {
    const gameId = `game_${Date.now()}`;
    const team1 = players.slice(0, 3);
    const team2 = players.slice(3, 6);

    return {
      gameId,
      team1,
      team2,
      players
    };
  }

  getQueueSize() {
    return this.queue.length;
  }
}

module.exports = new MatchmakingService();
