import { useEffect, useRef, useState } from 'react';
import socketService from '../../services/socket';
import { throttle } from '../../utils/throttle';

const GameCanvas = ({ roomId, players, myTeam, onLeaveGame }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [score, setScore] = useState({ teamA: 0, teamB: 0 });

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const NET_HEIGHT = 150;
  const FLOOR_HEIGHT = 100;
  const BALL_RADIUS = 15;
  const GRAVITY = 0.5;
  const BOUNCE_DAMPING = 0.7;

  // 캐릭터 상수
  const PLAYER_WIDTH = 30;
  const PLAYER_HEIGHT = 50;
  const PLAYER_GRAVITY = 0.8;
  const PLAYER_MOVE_SPEED = 5;
  const PLAYER_JUMP_POWER = -12;
  const DIVE_SPEED = 3;

  // 공 상태 (서버에서 받은 데이터로 렌더링)
  const ballRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: 100,
    targetX: CANVAS_WIDTH / 2,
    targetY: 100,
    velocityX: 0,
    velocityY: 0,
    radius: BALL_RADIUS
  });

  // 캐릭터 상태 (로컬 플레이어)
  // Team A는 왼쪽 코트 (10~390), Team B는 오른쪽 코트 (410~790)
  const initialX = myTeam === 'A' ? 200 : 600;
  const playerRef = useRef({
    x: initialX,
    y: CANVAS_HEIGHT - FLOOR_HEIGHT - PLAYER_HEIGHT,
    velocityX: 0,
    velocityY: 0,
    isGrounded: true,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    facingRight: true,
    animationFrame: 0,
    team: myTeam
  });

  // 원격 플레이어 상태 (다른 플레이어들)
  const remotePlayersRef = useRef(new Map()); // socketId -> player data

  // 키보드 입력 상태
  const keysRef = useRef({
    a: false,
    d: false,
    w: false,
    s: false,
    space: false
  });

  // 액션 발생 여부 추적 (중복 방지)
  const actionEmittedRef = useRef({
    jump: false,
    dive: false
  });

  // Space 키 관련 상태
  const spaceKeyRef = useRef({
    pressTime: 0,
    isCharging: false,
    gauge: 0
  });

  // 공 터치 가능 여부 (연속 터치 방지용)
  const ballTouchRef = useRef({
    canTouch: true
  });

  // 공과 플레이어 충돌 감지
  const checkBallPlayerCollision = () => {
    const ball = ballRef.current;
    const player = playerRef.current;

    // 플레이어 중심점 계산
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    // 거리 계산
    const dx = ball.x - playerCenterX;
    const dy = ball.y - playerCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < 40; // 40px 이내면 충돌
  };

  // 공 치기 (서버에 요청)
  const hitBall = (power) => {
    const player = playerRef.current;
    const ballTouch = ballTouchRef.current;

    if (!ballTouch.canTouch) return;

    // 플레이어 방향에 따라 공 방향 결정
    const direction = player.facingRight ? 1 : -1;
    const gauge = spaceKeyRef.current.gauge;

    // 게이지 폭발 체크 (스파이크인 경우)
    if (power === 'spike' && gauge > 100) {
      console.log('게이지 폭발!');
      spaceKeyRef.current.isCharging = false;
      spaceKeyRef.current.gauge = 0;
      return;
    }

    // 서버에 ball_hit 이벤트 전송
    socketService.emit('ball_hit', {
      power, // 'toss' or 'spike'
      direction,
      gauge: power === 'spike' ? gauge : 0
    });

    // 액션 이벤트도 전송 (시각 효과용)
    socketService.emit('player_action', {
      action: power,
      data: { direction, gauge }
    });

    // 터치 후 잠시 대기 (연속 터치 방지)
    ballTouch.canTouch = false;
    setTimeout(() => {
      ballTouch.canTouch = true;
    }, 300);
  };

  // 공 업데이트 (서버 데이터 보간)
  const updateBall = () => {
    const ball = ballRef.current;
    const interpolationSpeed = 0.5; // 보간 속도

    if (ball.targetX !== undefined && ball.targetY !== undefined) {
      // 서버에서 받은 위치로 부드럽게 이동
      ball.x += (ball.targetX - ball.x) * interpolationSpeed;
      ball.y += (ball.targetY - ball.y) * interpolationSpeed;
    }
  };

  // 공 그리기
  const drawBall = (ctx) => {
    const ball = ballRef.current;

    // 공 본체 (흰색)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // 공 테두리 (검은색)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 배구공 무늬 (선 3개)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;

    // 세로선
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y - ball.radius);
    ctx.lineTo(ball.x, ball.y + ball.radius);
    ctx.stroke();

    // 대각선 1
    ctx.beginPath();
    ctx.moveTo(ball.x - ball.radius * 0.7, ball.y - ball.radius * 0.7);
    ctx.lineTo(ball.x + ball.radius * 0.7, ball.y + ball.radius * 0.7);
    ctx.stroke();

    // 대각선 2
    ctx.beginPath();
    ctx.moveTo(ball.x - ball.radius * 0.7, ball.y + ball.radius * 0.7);
    ctx.lineTo(ball.x + ball.radius * 0.7, ball.y - ball.radius * 0.7);
    ctx.stroke();
  };

  // Throttled movement emission (50ms = 20fps for network)
  const emitMovement = useRef(
    throttle((player) => {
      socketService.emit('player_move', {
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        facingRight: player.facingRight,
        isGrounded: player.isGrounded
      });
    }, 50)
  ).current;

  // 캐릭터 물리 업데이트
  const updatePlayer = () => {
    const player = playerRef.current;
    const keys = keysRef.current;
    const spaceKey = spaceKeyRef.current;
    const groundLevel = CANVAS_HEIGHT - FLOOR_HEIGHT;

    // 좌우 이동
    player.velocityX = 0;
    if (keys.a) {
      player.velocityX = -PLAYER_MOVE_SPEED;
      player.facingRight = false;
    }
    if (keys.d) {
      player.velocityX = PLAYER_MOVE_SPEED;
      player.facingRight = true;
    }

    // 점프 (땅에 있을 때만)
    if (keys.w && player.isGrounded && !actionEmittedRef.current.jump) {
      player.velocityY = PLAYER_JUMP_POWER;
      player.isGrounded = false;
      // Emit jump action
      socketService.emit('player_action', { action: 'jump' });
      actionEmittedRef.current.jump = true;
    }

    // Reset jump action flag when grounded
    if (player.isGrounded) {
      actionEmittedRef.current.jump = false;
    }

    // 다이빙 (공중에 있을 때만)
    if (keys.s && !player.isGrounded && !actionEmittedRef.current.dive) {
      player.velocityY += DIVE_SPEED;
      // Emit dive action
      socketService.emit('player_action', { action: 'dive' });
      actionEmittedRef.current.dive = true;
      // Reset dive flag after some time
      setTimeout(() => {
        actionEmittedRef.current.dive = false;
      }, 500);
    }

    // Space 키 게이지 업데이트
    if (keys.space && checkBallPlayerCollision() && ballTouchRef.current.canTouch) {
      spaceKey.pressTime += 1000 / 60; // 프레임당 시간 증가

      if (spaceKey.pressTime > 300) {
        // 0.3초 이상 누르면 충전 시작
        spaceKey.isCharging = true;
        spaceKey.gauge = Math.min(120, (spaceKey.pressTime - 300) / 10); // 1초에 100%
      }
    }

    // 중력 적용
    if (!player.isGrounded) {
      player.velocityY += PLAYER_GRAVITY;
    }

    // 위치 업데이트
    player.x += player.velocityX;
    player.y += player.velocityY;

    // 바닥 충돌
    if (player.y + player.height >= groundLevel) {
      player.y = groundLevel - player.height;
      player.velocityY = 0;
      player.isGrounded = true;
    } else {
      player.isGrounded = false;
    }

    // 코트 경계 제한 (네트를 넘지 못함, 팀별로 다른 영역)
    const netX = CANVAS_WIDTH / 2;
    let leftBoundary, rightBoundary;

    if (myTeam === 'A') {
      // Team A: 왼쪽 코트 (10 ~ 360)
      leftBoundary = 10;
      rightBoundary = netX - 40; // 네트 앞에서 멈춤
    } else {
      // Team B: 오른쪽 코트 (440 ~ 790)
      leftBoundary = netX + 40; // 네트 뒤에서 시작
      rightBoundary = CANVAS_WIDTH - 10;
    }

    if (player.x < leftBoundary) {
      player.x = leftBoundary;
    } else if (player.x + player.width > rightBoundary) {
      player.x = rightBoundary - player.width;
    }

    // 애니메이션 프레임 업데이트
    if (player.velocityX !== 0) {
      player.animationFrame += 0.2;
    } else {
      player.animationFrame = 0;
    }

    // Emit movement to server (throttled)
    emitMovement(player);
  };

  // 원격 플레이어 업데이트 (interpolation)
  const updateRemotePlayers = () => {
    const remotePlayers = remotePlayersRef.current;
    const interpolationSpeed = 0.3; // 보간 속도 (0~1, 높을수록 빠름)

    remotePlayers.forEach((remotePlayer) => {
      if (remotePlayer.targetX !== undefined && remotePlayer.targetY !== undefined) {
        // 부드러운 보간 (linear interpolation)
        remotePlayer.x += (remotePlayer.targetX - remotePlayer.x) * interpolationSpeed;
        remotePlayer.y += (remotePlayer.targetY - remotePlayer.y) * interpolationSpeed;

        // 애니메이션 프레임 업데이트
        if (remotePlayer.velocityX !== 0) {
          remotePlayer.animationFrame = (remotePlayer.animationFrame || 0) + 0.2;
        } else {
          remotePlayer.animationFrame = 0;
        }
      }
    });
  };

  // 캐릭터 그리기 (로컬 플레이어)
  const drawPlayer = (ctx) => {
    const player = playerRef.current;

    // 걷기 애니메이션 오프셋
    const walkBounce = player.velocityX !== 0 && player.isGrounded
      ? Math.sin(player.animationFrame) * 3
      : 0;

    // 캐릭터 본체 (직사각형)
    ctx.fillStyle = '#FF5722'; // 오렌지색
    ctx.fillRect(
      player.x,
      player.y - walkBounce,
      player.width,
      player.height
    );

    // 캐릭터 테두리
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      player.x,
      player.y - walkBounce,
      player.width,
      player.height
    );

    // 머리 (원)
    const headRadius = player.width / 2;
    const headX = player.x + player.width / 2;
    const headY = player.y - walkBounce - headRadius;

    ctx.fillStyle = '#FFB74D'; // 밝은 오렌지
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 눈 (방향에 따라 변경)
    ctx.fillStyle = '#000000';
    const eyeY = headY - 3;
    if (player.facingRight) {
      ctx.fillRect(headX + 5, eyeY, 4, 4);
    } else {
      ctx.fillRect(headX - 9, eyeY, 4, 4);
    }

    // 팔 (점프 상태에 따라 변경)
    ctx.strokeStyle = '#FF5722';
    ctx.lineWidth = 3;

    if (!player.isGrounded) {
      // 점프 중: 팔 위로
      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y + 10 - walkBounce);
      ctx.lineTo(player.x + player.width / 2 + (player.facingRight ? 15 : -15), player.y - 10 - walkBounce);
      ctx.stroke();
    } else {
      // 땅에 있을 때: 팔 옆으로
      const armSwing = Math.sin(player.animationFrame) * 5;
      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y + 10 - walkBounce);
      ctx.lineTo(player.x + player.width / 2 + (player.facingRight ? 12 : -12), player.y + 20 - walkBounce + armSwing);
      ctx.stroke();
    }

    // 다리
    ctx.strokeStyle = '#D84315';
    ctx.lineWidth = 3;

    if (!player.isGrounded) {
      // 점프 중: 다리 모음
      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y + player.height - walkBounce);
      ctx.lineTo(player.x + player.width / 2 + 5, player.y + player.height + 8 - walkBounce);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y + player.height - walkBounce);
      ctx.lineTo(player.x + player.width / 2 - 5, player.y + player.height + 8 - walkBounce);
      ctx.stroke();
    } else {
      // 걷기 애니메이션
      const legSwing = Math.sin(player.animationFrame) * 8;
      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y + player.height - walkBounce);
      ctx.lineTo(player.x + player.width / 2 + legSwing, player.y + player.height + 12 - walkBounce);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y + player.height - walkBounce);
      ctx.lineTo(player.x + player.width / 2 - legSwing, player.y + player.height + 12 - walkBounce);
      ctx.stroke();
    }
  };

  // 원격 플레이어들 그리기
  const drawRemotePlayers = (ctx) => {
    const remotePlayers = remotePlayersRef.current;

    remotePlayers.forEach((remotePlayer) => {
      // 걷기 애니메이션 오프셋
      const walkBounce = remotePlayer.velocityX !== 0 && remotePlayer.isGrounded
        ? Math.sin(remotePlayer.animationFrame || 0) * 3
        : 0;

      // 캐릭터 본체 (다른 색상으로 구분)
      ctx.fillStyle = '#2196F3'; // 파란색 (다른 플레이어)
      ctx.fillRect(
        remotePlayer.x,
        remotePlayer.y - walkBounce,
        PLAYER_WIDTH,
        PLAYER_HEIGHT
      );

      // 캐릭터 테두리
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        remotePlayer.x,
        remotePlayer.y - walkBounce,
        PLAYER_WIDTH,
        PLAYER_HEIGHT
      );

      // 머리 (원)
      const headRadius = PLAYER_WIDTH / 2;
      const headX = remotePlayer.x + PLAYER_WIDTH / 2;
      const headY = remotePlayer.y - walkBounce - headRadius;

      ctx.fillStyle = '#64B5F6'; // 밝은 파란색
      ctx.beginPath();
      ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 눈 (방향에 따라 변경)
      ctx.fillStyle = '#000000';
      const eyeY = headY - 3;
      if (remotePlayer.facingRight) {
        ctx.fillRect(headX + 5, eyeY, 4, 4);
      } else {
        ctx.fillRect(headX - 9, eyeY, 4, 4);
      }

      // 팔 (점프 상태에 따라 변경)
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 3;

      if (!remotePlayer.isGrounded) {
        // 점프 중: 팔 위로
        ctx.beginPath();
        ctx.moveTo(remotePlayer.x + PLAYER_WIDTH / 2, remotePlayer.y + 10 - walkBounce);
        ctx.lineTo(remotePlayer.x + PLAYER_WIDTH / 2 + (remotePlayer.facingRight ? 15 : -15), remotePlayer.y - 10 - walkBounce);
        ctx.stroke();
      } else {
        // 땅에 있을 때: 팔 옆으로
        const armSwing = Math.sin(remotePlayer.animationFrame || 0) * 5;
        ctx.beginPath();
        ctx.moveTo(remotePlayer.x + PLAYER_WIDTH / 2, remotePlayer.y + 10 - walkBounce);
        ctx.lineTo(remotePlayer.x + PLAYER_WIDTH / 2 + (remotePlayer.facingRight ? 12 : -12), remotePlayer.y + 20 - walkBounce + armSwing);
        ctx.stroke();
      }

      // 다리
      ctx.strokeStyle = '#1565C0';
      ctx.lineWidth = 3;

      if (!remotePlayer.isGrounded) {
        // 점프 중: 다리 모음
        ctx.beginPath();
        ctx.moveTo(remotePlayer.x + PLAYER_WIDTH / 2, remotePlayer.y + PLAYER_HEIGHT - walkBounce);
        ctx.lineTo(remotePlayer.x + PLAYER_WIDTH / 2 + 5, remotePlayer.y + PLAYER_HEIGHT + 8 - walkBounce);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(remotePlayer.x + PLAYER_WIDTH / 2, remotePlayer.y + PLAYER_HEIGHT - walkBounce);
        ctx.lineTo(remotePlayer.x + PLAYER_WIDTH / 2 - 5, remotePlayer.y + PLAYER_HEIGHT + 8 - walkBounce);
        ctx.stroke();
      } else {
        // 걷기 애니메이션
        const legSwing = Math.sin(remotePlayer.animationFrame || 0) * 8;
        ctx.beginPath();
        ctx.moveTo(remotePlayer.x + PLAYER_WIDTH / 2, remotePlayer.y + PLAYER_HEIGHT - walkBounce);
        ctx.lineTo(remotePlayer.x + PLAYER_WIDTH / 2 + legSwing, remotePlayer.y + PLAYER_HEIGHT + 12 - walkBounce);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(remotePlayer.x + PLAYER_WIDTH / 2, remotePlayer.y + PLAYER_HEIGHT - walkBounce);
        ctx.lineTo(remotePlayer.x + PLAYER_WIDTH / 2 - legSwing, remotePlayer.y + PLAYER_HEIGHT + 12 - walkBounce);
        ctx.stroke();
      }
    });
  };

  // 스파이크 게이지 그리기
  const drawSpikeGauge = (ctx) => {
    const spaceKey = spaceKeyRef.current;
    const player = playerRef.current;

    if (!spaceKey.isCharging) return;

    const gaugeWidth = 60;
    const gaugeHeight = 8;
    const gaugeX = player.x + player.width / 2 - gaugeWidth / 2;
    const gaugeY = player.y - 30;

    // 게이지 배경 (검은색)
    ctx.fillStyle = '#000000';
    ctx.fillRect(gaugeX - 2, gaugeY - 2, gaugeWidth + 4, gaugeHeight + 4);

    // 게이지 배경 (회색)
    ctx.fillStyle = '#555555';
    ctx.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight);

    // 게이지 바 (색상은 게이지 수치에 따라)
    const fillWidth = Math.min(gaugeWidth, (spaceKey.gauge / 100) * gaugeWidth);
    let fillColor;

    if (spaceKey.gauge > 100) {
      fillColor = '#FF0000'; // 빨강 (폭발)
    } else if (spaceKey.gauge > 80) {
      fillColor = '#FFD700'; // 금색 (강력)
    } else if (spaceKey.gauge > 50) {
      fillColor = '#FFA500'; // 오렌지 (중간)
    } else {
      fillColor = '#90EE90'; // 연두색 (약함)
    }

    ctx.fillStyle = fillColor;
    ctx.fillRect(gaugeX, gaugeY, fillWidth, gaugeHeight);

    // 게이지 텍스트
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeText(`${Math.floor(spaceKey.gauge)}%`, player.x + player.width / 2, gaugeY - 5);
    ctx.fillText(`${Math.floor(spaceKey.gauge)}%`, player.x + player.width / 2, gaugeY - 5);
  };

  // 게임 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let lastTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const gameLoop = (currentTime) => {
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= frameInterval) {
        // 물리 업데이트
        updatePlayer();
        updateBall();
        updateRemotePlayers(); // 원격 플레이어 보간

        // 화면 클리어
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 배경 그리기 (그라데이션 하늘)
        drawBackground(ctx);

        // 바닥 그리기
        drawFloor(ctx);

        // 네트 그리기
        drawNet(ctx);

        // 캐릭터 그리기 (로컬 플레이어)
        drawPlayer(ctx);

        // 원격 플레이어들 그리기
        drawRemotePlayers(ctx);

        // 공 그리기
        drawBall(ctx);

        // 스파이크 게이지 그리기
        drawSpikeGauge(ctx);

        // 점수판 그리기
        drawScoreboard(ctx);

        lastTime = currentTime - (deltaTime % frameInterval);
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [score]);

  // 배경 그리기 (그라데이션 하늘)
  const drawBackground = (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB'); // 하늘색
    gradient.addColorStop(0.7, '#E0F6FF'); // 밝은 하늘색
    gradient.addColorStop(1, '#FFFFFF'); // 흰색

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  };

  // 바닥 그리기
  const drawFloor = (ctx) => {
    ctx.fillStyle = '#8B4513'; // 갈색
    ctx.fillRect(0, CANVAS_HEIGHT - FLOOR_HEIGHT, CANVAS_WIDTH, FLOOR_HEIGHT);
  };

  // 네트 그리기
  const drawNet = (ctx) => {
    const netX = CANVAS_WIDTH / 2;
    const netY = CANVAS_HEIGHT - FLOOR_HEIGHT - NET_HEIGHT;
    const netWidth = 4;

    // 네트 기둥
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(netX - netWidth / 2, netY, netWidth, NET_HEIGHT);

    // 네트 망
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    const meshSize = 20;

    for (let y = netY; y < netY + NET_HEIGHT; y += meshSize) {
      ctx.beginPath();
      ctx.moveTo(netX - 30, y);
      ctx.lineTo(netX + 30, y);
      ctx.stroke();
    }

    for (let x = netX - 30; x <= netX + 30; x += meshSize) {
      ctx.beginPath();
      ctx.moveTo(x, netY);
      ctx.lineTo(x, netY + NET_HEIGHT);
      ctx.stroke();
    }
  };

  // 점수판 그리기
  const drawScoreboard = (ctx) => {
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const scoreText = `Team A: ${score.teamA} - ${score.teamB} :Team B`;
    ctx.fillText(scoreText, CANVAS_WIDTH / 2, 20);

    // 배경 추가 (가독성 향상)
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFFFFF';
    const textWidth = ctx.measureText(scoreText).width;
    ctx.fillRect(CANVAS_WIDTH / 2 - textWidth / 2 - 10, 15, textWidth + 20, 40);
    ctx.restore();

    // 점수 다시 그리기 (배경 위에)
    ctx.fillStyle = '#000000';
    ctx.fillText(scoreText, CANVAS_WIDTH / 2, 20);
  };

  // 키보드 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();

      // ESC키로 게임 나가기
      if (e.key === 'Escape') {
        if (window.confirm('게임을 나가시겠습니까?')) {
          if (onLeaveGame) {
            onLeaveGame();
          }
        }
        return;
      }

      // 게임 조작 키
      if (key === 'a' || key === 'd' || key === 'w' || key === 's') {
        keysRef.current[key] = true;
        e.preventDefault(); // 스크롤 방지
      }

      // Space 키 (공 치기)
      if (key === ' ') {
        if (!keysRef.current.space) {
          keysRef.current.space = true;
          spaceKeyRef.current.pressTime = 0;
          spaceKeyRef.current.isCharging = false;
          spaceKeyRef.current.gauge = 0;
        }
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();

      if (key === 'a' || key === 'd' || key === 'w' || key === 's') {
        keysRef.current[key] = false;
        e.preventDefault();
      }

      // Space 키 떼었을 때 (공 치기 실행)
      if (key === ' ') {
        if (keysRef.current.space && checkBallPlayerCollision() && ballTouchRef.current.canTouch) {
          const spaceKey = spaceKeyRef.current;

          if (spaceKey.pressTime < 300) {
            // 짧게 누름: 토스
            hitBall('toss');
          } else {
            // 길게 누름: 스파이크
            hitBall('spike');
          }
        }

        // 리셋
        keysRef.current.space = false;
        spaceKeyRef.current.pressTime = 0;
        spaceKeyRef.current.isCharging = false;
        spaceKeyRef.current.gauge = 0;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onLeaveGame]);

  // Socket event listeners for multiplayer sync
  useEffect(() => {
    // Listen for game started (initialize game state)
    const handleGameStarted = (data) => {
      console.log('[GameCanvas] Game started event received:', data);
      // Game state is already initialized, just log
    };

    // Listen for other players' movements
    const handlePlayerMoved = (data) => {
      const remotePlayers = remotePlayersRef.current;

      // Get or create remote player
      let remotePlayer = remotePlayers.get(data.socketId);
      if (!remotePlayer) {
        remotePlayer = {
          socketId: data.socketId,
          x: data.x,
          y: data.y,
          targetX: data.x,
          targetY: data.y,
          velocityX: 0,
          velocityY: 0,
          facingRight: true,
          isGrounded: true,
          animationFrame: 0
        };
        remotePlayers.set(data.socketId, remotePlayer);
      }

      // Update target position for interpolation
      remotePlayer.targetX = data.x;
      remotePlayer.targetY = data.y;
      remotePlayer.velocityX = data.velocityX;
      remotePlayer.velocityY = data.velocityY;
      remotePlayer.facingRight = data.facingRight;
      remotePlayer.isGrounded = data.isGrounded;
    };

    // Listen for player actions (jump, dive, toss, spike)
    const handlePlayerAction = (data) => {
      console.log(`[Game] Player ${data.socketId} action: ${data.action}`, data.data);
      // TODO: Add visual effects for actions
    };

    // Listen for player leaving
    const handlePlayerLeft = (data) => {
      const remotePlayers = remotePlayersRef.current;
      remotePlayers.delete(data.socketId);
      console.log(`[Game] Player ${data.socketId} left the game`);
    };

    // Listen for ball updates from server
    const handleBallUpdate = (data) => {
      const ball = ballRef.current;
      ball.targetX = data.x;
      ball.targetY = data.y;
      ball.velocityX = data.velocityX;
      ball.velocityY = data.velocityY;
    };

    // Listen for score updates
    const handleScoreUpdate = (data) => {
      console.log('[Game] Score update:', data);
      setScore(data.score);

      // Show scoring reason
      if (data.reason === 'ball_landed') {
        console.log(`Team ${data.scoringTeam} scored! (Ball landed)`);
      } else if (data.reason === 'three_touch_violation') {
        console.log(`Team ${data.scoringTeam} scored! (3-touch violation)`);
      }
    };

    // Listen for game end
    const handleGameEnd = (data) => {
      console.log('[Game] Game ended! Winner:', data.winner);
      alert(`Game Over! Team ${data.winner} wins!\nFinal Score: ${data.finalScore.teamA} - ${data.finalScore.teamB}`);
      // TODO: Show proper game end screen
    };

    socketService.on('game_started', handleGameStarted);
    socketService.on('player_moved', handlePlayerMoved);
    socketService.on('player_action', handlePlayerAction);
    socketService.on('player_left', handlePlayerLeft);
    socketService.on('ball_update', handleBallUpdate);
    socketService.on('score_update', handleScoreUpdate);
    socketService.on('game_end', handleGameEnd);

    return () => {
      socketService.off('game_started', handleGameStarted);
      socketService.off('player_moved', handlePlayerMoved);
      socketService.off('player_action', handlePlayerAction);
      socketService.off('player_left', handlePlayerLeft);
      socketService.off('ball_update', handleBallUpdate);
      socketService.off('score_update', handleScoreUpdate);
      socketService.off('game_end', handleGameEnd);
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f0f0'
    }}>
      <div style={{
        backgroundColor: '#000',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            display: 'block',
            border: '2px solid #333'
          }}
        />
      </div>
      <div style={{
        marginTop: '20px',
        color: '#666',
        fontSize: '14px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '5px' }}>
          <strong>조작법:</strong> A/D - 이동 | W - 점프 | S - 다이빙(공중)
        </div>
        <div style={{ marginBottom: '5px' }}>
          <strong>Space:</strong> 짧게 누름 - 토스 | 길게 누름 - 스파이크 (게이지 충전)
        </div>
        <div>
          ESC - 게임 나가기
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
