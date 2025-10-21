import { useState, useEffect } from 'react'
import socketService from '../../services/socket'
import { PrivateRoom } from './PrivateRoom'
import { Toast } from '../Common/Toast'
import './Lobby.css'

export function Lobby({ user, character, onLogout }) {
  const [view, setView] = useState('main') // main, matchmaking, room
  const [roomData, setRoomData] = useState(null)
  const [matchmakingData, setMatchmakingData] = useState(null)
  const [roomCode, setRoomCode] = useState('')
  const [toast, setToast] = useState({ message: '', type: 'error' })

  useEffect(() => {
    // Socket event listeners
    socketService.on('registered', handleRegistered)
    socketService.on('matchmaking_joined', handleMatchmakingJoined)
    socketService.on('room_created', handleRoomCreated)
    socketService.on('room_joined', handleRoomJoined)
    socketService.on('player_joined', handlePlayerJoined)
    socketService.on('player_left', handlePlayerLeft)
    socketService.on('team_updated', handleTeamUpdated)
    socketService.on('host_changed', handleHostChanged)
    socketService.on('matchmaking_left', handleMatchmakingLeft)
    socketService.on('error', handleError)

    return () => {
      socketService.off('registered', handleRegistered)
      socketService.off('matchmaking_joined', handleMatchmakingJoined)
      socketService.off('room_created', handleRoomCreated)
      socketService.off('room_joined', handleRoomJoined)
      socketService.off('player_joined', handlePlayerJoined)
      socketService.off('player_left', handlePlayerLeft)
      socketService.off('team_updated', handleTeamUpdated)
      socketService.off('host_changed', handleHostChanged)
      socketService.off('matchmaking_left', handleMatchmakingLeft)
      socketService.off('error', handleError)
    }
  }, [])

  const handleRegistered = (data) => {
    if (data.success) {
      console.log('[Lobby] Registered:', data.characterName)
    } else {
      setToast({ message: data.error || '등록 실패', type: 'error' })
    }
  }

  const handleMatchmakingJoined = (data) => {
    setMatchmakingData(data)
    setView('matchmaking')
  }

  const handleRoomCreated = (data) => {
    setRoomData(data)
    setView('room')
    setMatchmakingData(null)
  }

  const handleRoomJoined = (data) => {
    setRoomData(data)
    setView('room')
  }

  const handlePlayerJoined = (data) => {
    console.log('[Lobby] Player joined:', data)
    setRoomData(prev => prev ? ({ ...prev, players: data.players }) : prev)
  }

  const handlePlayerLeft = (data) => {
    console.log('[Lobby] Player left:', data)
    setRoomData(prev => prev ? ({
      ...prev,
      players: data.players,
      teamA: data.teamA,
      teamB: data.teamB
    }) : prev)
  }

  const handleTeamUpdated = (data) => {
    console.log('[DEBUG Lobby] Team updated event received')
    setRoomData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        teamA: data.teamA,
        teamB: data.teamB,
        players: data.players
      }
    })
  }

  const handleHostChanged = (data) => {
    console.log('[Lobby] Host changed:', data)
    setRoomData(prev => prev ? ({ ...prev, host: data.newHost }) : prev)
  }

  const handleMatchmakingLeft = () => {
    setMatchmakingData(null)
    setView('main')
  }

  const handleError = (data) => {
    setToast({ message: data.message || '오류가 발생했습니다', type: 'error' })
  }

  const handleJoinMatchmaking = () => {
    setToast({ message: '', type: 'error' })
    socketService.joinMatchmaking()
  }

  const handleLeaveMatchmaking = () => {
    socketService.leaveMatchmaking()
  }

  const handleCreateRoom = () => {
    setToast({ message: '', type: 'error' })
    socketService.createPrivateRoom()
  }

  const handleJoinRoom = () => {
    if (!roomCode.trim() || roomCode.length !== 4) {
      setToast({ message: '4자리 방 코드를 입력해주세요', type: 'error' })
      return
    }
    setToast({ message: '', type: 'error' })
    socketService.joinPrivateRoom(roomCode)
  }

  const handleLeaveRoom = () => {
    socketService.leaveRoom()
    setRoomData(null)
    setView('main')
  }

  if (view === 'room' && roomData) {
    return (
      <PrivateRoom
        roomData={roomData}
        user={user}
        character={character}
        onLeave={handleLeaveRoom}
        onLogout={onLogout}
      />
    )
  }

  if (view === 'matchmaking') {
    return (
      <div className="lobby-container">
        {toast.message && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ message: '', type: 'error' })}
          />
        )}

        <div className="lobby-card">
          <h1>매칭 대기 중...</h1>

          <div className="matchmaking-status">
            <div className="loading-spinner-large"></div>
            <p>플레이어를 찾고 있습니다</p>
            <div className="queue-info">
              <span className="queue-size">{matchmakingData?.queueSize || 0} / 6</span>
              <span className="queue-label">대기 중</span>
            </div>
          </div>

          <button className="cancel-btn" onClick={handleLeaveMatchmaking}>
            매칭 취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="lobby-container">
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'error' })}
        />
      )}

      <div className="lobby-card">
        <div className="lobby-header">
          <div>
            <h1>3vs3 배구 게임</h1>
            <p className="welcome-text">환영합니다, {character.name}님!</p>
          </div>
          <button className="logout-btn-lobby" onClick={onLogout}>
            로그아웃
          </button>
        </div>

        <div className="lobby-menu">
          <div className="menu-section">
            <h2>랜덤 매칭</h2>
            <p className="section-desc">무작위 플레이어와 매칭됩니다</p>
            <button className="menu-btn primary" onClick={handleJoinMatchmaking}>
              빠른 매칭 시작
            </button>
          </div>

          <div className="menu-divider">또는</div>

          <div className="menu-section">
            <h2>친구와 플레이</h2>
            <p className="section-desc">방을 만들거나 친구 방에 참가하세요</p>

            <button className="menu-btn secondary" onClick={handleCreateRoom}>
              친구 방 만들기
            </button>

            <div className="join-room-section">
              <input
                type="text"
                className="room-code-input"
                placeholder="4자리 방 코드 입력"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                maxLength={4}
              />
              <button className="menu-btn secondary" onClick={handleJoinRoom}>
                방 참가
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
