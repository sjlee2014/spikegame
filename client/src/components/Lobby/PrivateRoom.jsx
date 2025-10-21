import { useState, useEffect } from 'react'
import socketService from '../../services/socket'
import { Toast } from '../Common/Toast'
import './PrivateRoom.css'

export function PrivateRoom({ roomData, user, character, onLeave, onLogout }) {
  const [toast, setToast] = useState({ message: '', type: 'error' })
  const [gameStarted, setGameStarted] = useState(false)

  const isHost = socketService.getSocketId() === roomData.host
  const teamA = roomData.teamA || []
  const teamB = roomData.teamB || []
  const players = roomData.players || []

  useEffect(() => {
    // Socket event listeners - only game_started and error
    socketService.on('game_started', handleGameStarted)
    socketService.on('error', handleError)

    return () => {
      socketService.off('game_started', handleGameStarted)
      socketService.off('error', handleError)
    }
  }, [])

  const handleGameStarted = (data) => {
    console.log('[Room] Game started:', data)
    setGameStarted(true)
    // TODO: Navigate to game screen
  }

  const handleError = (data) => {
    setToast({ message: data.message || '오류가 발생했습니다', type: 'error' })
  }

  const handleSelectTeam = (team) => {
    setToast({ message: '', type: 'error' })
    socketService.selectTeam(team)
  }

  const handleStartGame = () => {
    if (!isHost) {
      setToast({ message: '방장만 게임을 시작할 수 있습니다', type: 'error' })
      return
    }

    if (teamA.length < 1 || teamB.length < 1) {
      setToast({ message: '양팀에 최소 1명씩 있어야 합니다', type: 'error' })
      return
    }

    setToast({ message: '', type: 'error' })
    socketService.startGame()
  }

  // Get current player's team
  const mySocketId = socketService.getSocketId()
  const myPlayer = players.find(p => p.socketId === mySocketId)
  const myTeam = myPlayer?.team

  // Get waiting players (no team selected)
  const waitingPlayers = players.filter(p => !p.team)

  if (gameStarted) {
    return (
      <div className="private-room-container">
        <div className="game-starting">
          <h1>게임이 시작됩니다!</h1>
          <div className="loading-spinner-large"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="private-room-container">
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'error' })}
        />
      )}

      <div className="room-header">
        <div className="room-info">
          <h1>게임 방</h1>
          <div className="room-code-display">
            <span className="code-label">방 코드:</span>
            <span className="code-value">{roomData.code}</span>
          </div>
          {isHost && <span className="host-badge">방장</span>}
        </div>
        <div className="room-actions">
          <button className="leave-btn" onClick={onLeave}>
            나가기
          </button>
          <button className="logout-btn-room" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </div>

      <div className="room-content">
        {/* Team A */}
        <div className="team-section team-a">
          <h2>Team A ({teamA.length}/3)</h2>
          <div className="team-players">
            {teamA.map((player, index) => (
              <div
                key={player.socketId}
                className={`player-card ${player.socketId === mySocketId ? 'me' : ''}`}
              >
                <div className="player-avatar">A{index + 1}</div>
                <div className="player-name">{player.characterName}</div>
                {player.socketId === roomData.host && <span className="host-icon">👑</span>}
              </div>
            ))}
            {Array.from({ length: 3 - teamA.length }).map((_, i) => (
              <div key={`empty-a-${i}`} className="player-card empty">
                <div className="player-avatar">?</div>
                <div className="player-name">대기 중</div>
              </div>
            ))}
          </div>
          {myTeam !== 'A' && teamA.length < 3 && (
            <button className="team-join-btn" onClick={() => handleSelectTeam('A')}>
              Team A 참가
            </button>
          )}
        </div>

        {/* VS */}
        <div className="vs-divider">VS</div>

        {/* Team B */}
        <div className="team-section team-b">
          <h2>Team B ({teamB.length}/3)</h2>
          <div className="team-players">
            {teamB.map((player, index) => (
              <div
                key={player.socketId}
                className={`player-card ${player.socketId === mySocketId ? 'me' : ''}`}
              >
                <div className="player-avatar">B{index + 1}</div>
                <div className="player-name">{player.characterName}</div>
                {player.socketId === roomData.host && <span className="host-icon">👑</span>}
              </div>
            ))}
            {Array.from({ length: 3 - teamB.length }).map((_, i) => (
              <div key={`empty-b-${i}`} className="player-card empty">
                <div className="player-avatar">?</div>
                <div className="player-name">대기 중</div>
              </div>
            ))}
          </div>
          {myTeam !== 'B' && teamB.length < 3 && (
            <button className="team-join-btn" onClick={() => handleSelectTeam('B')}>
              Team B 참가
            </button>
          )}
        </div>
      </div>

      {/* Waiting players */}
      {waitingPlayers.length > 0 && (
        <div className="waiting-section">
          <h3>팀 선택 대기 중</h3>
          <div className="waiting-players">
            {waitingPlayers.map((player) => (
              <div
                key={player.socketId}
                className={`waiting-player ${player.socketId === mySocketId ? 'me' : ''}`}
              >
                <span className="player-name">{player.characterName}</span>
                {player.socketId === roomData.host && <span className="host-icon">👑</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start game button */}
      <div className="room-footer">
        {isHost ? (
          <button
            className="start-game-btn"
            onClick={handleStartGame}
            disabled={teamA.length < 1 || teamB.length < 1}
          >
            게임 시작
            {(teamA.length < 1 || teamB.length < 1) && ' (양팀에 최소 1명 필요)'}
          </button>
        ) : (
          <p className="waiting-host">방장이 게임을 시작하기를 기다리는 중...</p>
        )}
      </div>
    </div>
  )
}
