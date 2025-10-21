import { useEffect, useState } from 'react'
import { supabase } from './services/supabase'
import socketService from './services/socket'
import { Login } from './components/Auth/Login'
import { CharacterCreator } from './components/Character/CharacterCreator'
import { Lobby } from './components/Lobby/Lobby'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [character, setCharacter] = useState(null)
  const [checkingCharacter, setCheckingCharacter] = useState(true)

  useEffect(() => {
    // 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)

      // 세션이 있으면 캐릭터 확인
      if (session) {
        checkCharacter(session.user.id)
      } else {
        setCheckingCharacter(false)
      }
    })

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkCharacter(session.user.id)
      } else {
        setCharacter(null)
        setCheckingCharacter(false)
        // 로그아웃 시 소켓 연결 해제
        socketService.disconnect()
      }
    })

    return () => {
      subscription.unsubscribe()
      // Cleanup socket connection
      socketService.disconnect()
    }
  }, [])

  // Socket connection when user has character
  useEffect(() => {
    if (session && character) {
      // Connect to socket server
      socketService.connect()

      // Register user with character
      socketService.register(session.user.id, character.id)

      console.log('[App] Socket connected and user registered')
    }
  }, [session, character])

  const checkCharacter = async (userId) => {
    try {
      setCheckingCharacter(true)
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, 이건 에러가 아님
        console.error('캐릭터 조회 에러:', error)
      }

      setCharacter(data)
    } catch (err) {
      console.error('캐릭터 확인 중 에러:', err)
    } finally {
      setCheckingCharacter(false)
    }
  }

  const handleCharacterCreated = (newCharacter) => {
    setCharacter(newCharacter)
  }

  const handleLogout = async () => {
    // Disconnect socket before logout
    socketService.disconnect()
    await supabase.auth.signOut()
    setCharacter(null)
  }

  if (loading || checkingCharacter) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (!character) {
    return (
      <CharacterCreator
        onCharacterCreated={handleCharacterCreated}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <Lobby
      user={session.user}
      character={character}
      onLogout={handleLogout}
    />
  )
}

export default App
