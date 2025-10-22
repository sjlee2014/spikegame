// Ball physics engine - Authoritative server
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const NET_HEIGHT = 150;
const FLOOR_HEIGHT = 100;
const BALL_RADIUS = 15;
const GRAVITY = 0.6; // Increased for more realistic fall
const BOUNCE_DAMPING = 0.7;
const AIR_RESISTANCE = 0.99; // 1% air resistance per frame

class BallPhysics {
  constructor(roomId) {
    this.roomId = roomId;
    this.ball = {
      x: CANVAS_WIDTH / 2,
      y: 100,
      velocityX: 0,
      velocityY: 0,
      radius: BALL_RADIUS,
      prevSide: 'right' // 'left' or 'right'
    };

    this.touchState = {
      lastTeam: null, // 'A' or 'B'
      touchCount: 0,
      lastTouchPlayer: null
    };

    this.score = {
      teamA: 0,
      teamB: 0
    };

    this.gameActive = true;
    this.winningScore = 15;
  }

  // Reset ball to center
  resetBall() {
    this.ball = {
      x: CANVAS_WIDTH / 2,
      y: 100,
      velocityX: Math.random() * 4 - 2, // -2 ~ 2
      velocityY: 0,
      radius: BALL_RADIUS,
      prevSide: this.ball.prevSide
    };

    this.touchState = {
      lastTeam: null,
      touchCount: 0,
      lastTouchPlayer: null
    };
  }

  // Update ball physics (called every 16ms)
  update() {
    if (!this.gameActive) return null;

    const ball = this.ball;
    const netX = CANVAS_WIDTH / 2;

    // Check if ball crossed net (reset touch count)
    const currentSide = ball.x < netX ? 'left' : 'right';
    if (currentSide !== ball.prevSide) {
      this.touchState.lastTeam = null;
      this.touchState.touchCount = 0;
      ball.prevSide = currentSide;
    }

    // Apply gravity
    ball.velocityY += GRAVITY;

    // Apply air resistance
    ball.velocityX *= AIR_RESISTANCE;
    ball.velocityY *= AIR_RESISTANCE;

    // Update position
    ball.x += ball.velocityX;
    ball.y += ball.velocityY;

    // Wall collision (left/right)
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.velocityX *= -0.8;
    } else if (ball.x + ball.radius > CANVAS_WIDTH) {
      ball.x = CANVAS_WIDTH - ball.radius;
      ball.velocityX *= -0.8;
    }

    // Ceiling collision
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.velocityY *= -0.5;
    }

    // Floor collision and scoring
    const floorY = CANVAS_HEIGHT - FLOOR_HEIGHT;
    let scoreEvent = null;

    if (ball.y + ball.radius >= floorY) {
      ball.y = floorY - ball.radius;

      // Determine which team scores
      if (ball.x < CANVAS_WIDTH / 2) {
        // Ball landed on left court (Team A) - Team B scores
        this.score.teamB++;
        scoreEvent = {
          scoringTeam: 'B',
          reason: 'ball_landed',
          score: { ...this.score }
        };
      } else {
        // Ball landed on right court (Team B) - Team A scores
        this.score.teamA++;
        scoreEvent = {
          scoringTeam: 'A',
          reason: 'ball_landed',
          score: { ...this.score }
        };
      }

      // Check for game end
      if (this.score.teamA >= this.winningScore || this.score.teamB >= this.winningScore) {
        this.gameActive = false;
        scoreEvent.gameEnd = true;
        scoreEvent.winner = this.score.teamA >= this.winningScore ? 'A' : 'B';
      } else {
        // Continue game - ball will reset on next update
        setTimeout(() => this.resetBall(), 1000);
      }

      // Bounce
      if (Math.abs(ball.velocityY) > 1) {
        ball.velocityY *= -BOUNCE_DAMPING;
      } else {
        ball.velocityY = 0;
      }

      // Friction
      ball.velocityX *= 0.9;
    }

    // Net collision
    this.checkNetCollision();

    return scoreEvent;
  }

  // Check net collision
  checkNetCollision() {
    const ball = this.ball;
    const netX = CANVAS_WIDTH / 2;
    const netY = CANVAS_HEIGHT - FLOOR_HEIGHT - NET_HEIGHT;
    const netWidth = 30;

    if (
      ball.x + ball.radius > netX - netWidth / 2 &&
      ball.x - ball.radius < netX + netWidth / 2 &&
      ball.y + ball.radius > netY &&
      ball.y - ball.radius < netY + NET_HEIGHT
    ) {
      // Net collision
      if (ball.velocityX > 0) {
        ball.x = netX - netWidth / 2 - ball.radius;
      } else {
        ball.x = netX + netWidth / 2 + ball.radius;
      }
      ball.velocityX *= -0.5;

      // Ball hit net and falling back - might be a fault
      if (ball.velocityY > 0) {
        // Check which side ball will land on
        const willLandOnLeftSide = ball.x < netX;
        const wasHitFromLeftSide = this.touchState.lastTeam === 'A';

        if (willLandOnLeftSide === wasHitFromLeftSide && this.touchState.lastTeam) {
          // Ball hit net and will land on same side - potential fault
          // This will be caught by floor collision scoring
        }
      }
    }
  }

  // Handle ball hit by player
  hitBall(playerSocketId, team, hitData) {
    const { power, direction, gauge } = hitData;

    // Check touch count
    if (this.touchState.lastTeam === team) {
      this.touchState.touchCount++;

      // 3-touch rule violation
      if (this.touchState.touchCount > 3) {
        console.log(`[Ball] Team ${team} exceeded 3 touches!`);

        // Award point to opposing team
        const scoringTeam = team === 'A' ? 'B' : 'A';
        if (scoringTeam === 'A') {
          this.score.teamA++;
        } else {
          this.score.teamB++;
        }

        const scoreEvent = {
          scoringTeam,
          reason: 'three_touch_violation',
          score: { ...this.score }
        };

        // Check for game end
        if (this.score.teamA >= this.winningScore || this.score.teamB >= this.winningScore) {
          this.gameActive = false;
          scoreEvent.gameEnd = true;
          scoreEvent.winner = this.score.teamA >= this.winningScore ? 'A' : 'B';
        } else {
          setTimeout(() => this.resetBall(), 1000);
        }

        return scoreEvent;
      }
    } else {
      // Different team touched - reset count
      this.touchState.lastTeam = team;
      this.touchState.touchCount = 1;
    }

    this.touchState.lastTouchPlayer = playerSocketId;

    // Apply ball velocity based on hit type
    const ball = this.ball;
    const dir = direction || 1;

    if (power === 'toss') {
      // Gentle toss - easier to receive
      ball.velocityX = dir * 3;
      ball.velocityY = -10;
    } else if (power === 'spike') {
      let velocityMultiplier = 1.0;

      if (gauge <= 50) {
        velocityMultiplier = 0.6; // Weak spike
      } else if (gauge <= 80) {
        velocityMultiplier = 0.9; // Medium spike
      } else if (gauge <= 100) {
        velocityMultiplier = 1.2; // Strong spike
      } else {
        // Gauge overload - weak hit
        velocityMultiplier = 0.4;
      }

      // Reduced spike velocity for easier gameplay
      ball.velocityX = dir * 7 * velocityMultiplier;
      ball.velocityY = -6 * velocityMultiplier;
    }

    return null; // No scoring event from hit
  }

  // Get current ball state
  getBallState() {
    return {
      x: this.ball.x,
      y: this.ball.y,
      velocityX: this.ball.velocityX,
      velocityY: this.ball.velocityY
    };
  }

  // Get current score
  getScore() {
    return { ...this.score };
  }

  // Check if game is active
  isGameActive() {
    return this.gameActive;
  }
}

module.exports = BallPhysics;
