// AI Bot gameplay logic
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const FLOOR_HEIGHT = 100;
const PLAYER_MOVE_SPEED = 5;
const GRAVITY = 0.6; // Match ball physics gravity

class BotAI {
  constructor(botPlayer, team, io, roomId, ballPhysics) {
    this.botPlayer = botPlayer;
    this.team = team; // 'A' or 'B'
    this.io = io;
    this.roomId = roomId;
    this.ballPhysics = ballPhysics;

    // Bot position and state
    this.x = team === 'A' ? 200 : 600; // Starting position
    this.y = CANVAS_HEIGHT - FLOOR_HEIGHT - 50; // Ground level
    this.velocityX = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.facingRight = team === 'A';

    // AI settings (improved for better gameplay)
    this.reactionDelay = 150; // ms - quicker reactions
    this.predictionAccuracy = 0.85; // 85% accurate
    this.mistakeProbability = 0.10; // 10% chance to make mistake

    // AI state
    this.lastDecisionTime = 0;
    this.targetX = this.x;
    this.lastActionTime = 0;
    this.isMoving = false;

    // Court boundaries
    this.courtLeft = team === 'A' ? 10 : 400;
    this.courtRight = team === 'A' ? 390 : 790;
    this.courtCenter = (this.courtLeft + this.courtRight) / 2;

    console.log(`[BotAI] ${botPlayer.characterName} initialized on Team ${team}`);
  }

  // Predict where the ball will land
  predictBallLanding(ball) {
    if (!ball) return null;

    // Simple physics prediction
    let simX = ball.x;
    let simY = ball.y;
    let simVelX = ball.velocityX;
    let simVelY = ball.velocityY;

    const maxSteps = 200; // Simulate up to ~3 seconds
    const floorY = CANVAS_HEIGHT - FLOOR_HEIGHT;
    const netX = CANVAS_WIDTH / 2;

    for (let i = 0; i < maxSteps; i++) {
      simVelY += GRAVITY;
      simX += simVelX;
      simY += simVelY;

      // Check if ball will land on floor
      if (simY >= floorY) {
        // Add some inaccuracy based on AI settings
        const error = (1 - this.predictionAccuracy) * 100 * (Math.random() - 0.5);
        return {
          x: simX + error,
          y: floorY,
          isOnMyCourt: this.team === 'A' ? simX < netX : simX > netX
        };
      }

      // Check if ball hits net
      if ((simVelX > 0 && simX >= netX) || (simVelX < 0 && simX <= netX)) {
        // Ball crossed net
        const isOnMyCourt = this.team === 'A' ? simX < netX : simX > netX;
        if (!isOnMyCourt) {
          // Ball is going to opponent's court, return null
          return null;
        }
      }

      // Wall bounce
      if (simX < 0 || simX > CANVAS_WIDTH) {
        simVelX *= -0.8;
        simX = Math.max(0, Math.min(CANVAS_WIDTH, simX));
      }
    }

    return null;
  }

  // Calculate distance to ball
  getDistanceToBall(ball) {
    if (!ball) return Infinity;
    const dx = ball.x - (this.x + 15); // Player center
    const dy = ball.y - (this.y + 25);
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Check if ball is on my court
  isBallOnMyCourt(ball) {
    if (!ball) return false;
    const netX = CANVAS_WIDTH / 2;
    return this.team === 'A' ? ball.x < netX : ball.x > netX;
  }

  // Make AI decision
  update(ball, currentTime) {
    // Make decision with reaction delay
    if (currentTime - this.lastDecisionTime >= this.reactionDelay) {
      this.lastDecisionTime = currentTime;

      // Random mistake check
      if (Math.random() < this.mistakeProbability) {
        // Make a mistake - do nothing or move wrong direction
        if (Math.random() < 0.5) {
          this.targetX = this.x + (Math.random() - 0.5) * 100;
          this.targetX = Math.max(this.courtLeft, Math.min(this.courtRight, this.targetX));
        }
      } else {
        const distance = this.getDistanceToBall(ball);
        const ballOnMyCourt = this.isBallOnMyCourt(ball);

        if (ballOnMyCourt) {
          // Ball is on my court - go get it!
          const prediction = this.predictBallLanding(ball);

          if (prediction && prediction.isOnMyCourt) {
            // Move to predicted landing position
            this.targetX = prediction.x;
            this.targetX = Math.max(this.courtLeft, Math.min(this.courtRight, this.targetX));
          } else {
            // Move towards ball
            this.targetX = ball.x;
            this.targetX = Math.max(this.courtLeft, Math.min(this.courtRight, this.targetX));
          }

          // Try to hit ball if close enough (increased range)
          if (distance < 80 && currentTime - this.lastActionTime > 400) {
            this.tryHitBall(ball, currentTime);
          }
        } else {
          // Ball is on opponent's court - return to center
          this.targetX = this.courtCenter;
        }
      }
    }

    // Always update movement every frame (physics and emit)
    this.updateMovement();
  }

  // Try to hit the ball
  tryHitBall(ball, currentTime) {
    if (!ball) return;

    this.lastActionTime = currentTime;

    // Jump
    if (this.isGrounded) {
      this.velocityY = -12;
      this.isGrounded = false;

      // Emit jump action
      this.io.to(this.roomId).emit('player_action', {
        socketId: this.botPlayer.socketId,
        action: 'jump'
      });
    }

    // Decide whether to toss or spike based on ball height
    const ballHeight = ball.y;
    const shouldSpike = ballHeight > 200 && Math.random() > 0.3;

    const direction = this.facingRight ? 1 : -1;
    const power = shouldSpike ? 'spike' : 'toss';
    const gauge = shouldSpike ? 60 + Math.random() * 20 : 0; // 60-80% power

    // Hit ball directly through ballPhysics
    const scoreEvent = this.ballPhysics.hitBall(this.botPlayer.socketId, this.team, {
      power,
      direction,
      gauge
    });

    // Emit action to clients for visual feedback
    this.io.to(this.roomId).emit('player_action', {
      socketId: this.botPlayer.socketId,
      action: power,
      data: { direction, gauge }
    });

    // Handle scoring event if any
    if (scoreEvent) {
      this.io.to(this.roomId).emit('score_update', scoreEvent);

      if (scoreEvent.gameEnd) {
        this.io.to(this.roomId).emit('game_end', {
          winner: scoreEvent.winner,
          finalScore: scoreEvent.score
        });
      }
    }

    console.log(`[BotAI] ${this.botPlayer.characterName} ${power} (gauge: ${gauge})`);
  }

  // Update bot movement
  updateMovement() {
    // Move towards target
    const diff = this.targetX - this.x;

    if (Math.abs(diff) > 5) {
      if (diff > 0) {
        this.velocityX = PLAYER_MOVE_SPEED;
        this.facingRight = true;
      } else {
        this.velocityX = -PLAYER_MOVE_SPEED;
        this.facingRight = false;
      }
      this.isMoving = true;
    } else {
      this.velocityX = 0;
      this.isMoving = false;
    }

    // Apply gravity
    if (!this.isGrounded) {
      this.velocityY += 0.8;
    }

    // Update position
    this.x += this.velocityX;
    this.y += this.velocityY;

    // Ground check
    const groundLevel = CANVAS_HEIGHT - FLOOR_HEIGHT - 50;
    if (this.y >= groundLevel) {
      this.y = groundLevel;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    // Keep within court boundaries
    this.x = Math.max(this.courtLeft, Math.min(this.courtRight - 30, this.x));

    // Emit movement to clients
    this.emitMovement();
  }

  // Emit bot movement to all clients
  emitMovement() {
    this.io.to(this.roomId).emit('player_moved', {
      socketId: this.botPlayer.socketId,
      x: this.x,
      y: this.y,
      velocityX: this.velocityX,
      velocityY: this.velocityY,
      facingRight: this.facingRight,
      isGrounded: this.isGrounded
    });
  }

  // Clean up
  destroy() {
    console.log(`[BotAI] ${this.botPlayer.characterName} destroyed`);
  }
}

module.exports = BotAI;
