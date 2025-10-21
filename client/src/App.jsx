import { useEffect, useState } from 'react'
import { supabase } from './services/supabase'
import { Login } from './components/Auth/Login'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>3vs3 배구 게임</h1>
        <div className="user-info">
          <span>환영합니다, {session.user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="game-menu">
          <h2>게임 메뉴</h2>
          <button className="menu-btn">빠른 매칭</button>
          <button className="menu-btn">캐릭터 선택</button>
          <button className="menu-btn">설정</button>
        </div>
      </main>
    </div>
  )
}

export default App
