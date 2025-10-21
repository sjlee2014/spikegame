import { useState } from 'react'
import { supabase } from '../../services/supabase'
import './CharacterCreator.css'

export function CharacterCreator({ onCharacterCreated, onLogout }) {
  const [characterName, setCharacterName] = useState('')
  const [skinColor, setSkinColor] = useState('#FFD7B5')
  const [hairStyle, setHairStyle] = useState('short')
  const [hairColor, setHairColor] = useState('#000000')
  const [outfit, setOutfit] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const skinColors = [
    { name: '밝은 피부', value: '#FFD7B5' },
    { name: '중간 피부', value: '#F1C27D' },
    { name: '어두운 피부', value: '#C68642' },
    { name: '올리브 피부', value: '#E0AC69' },
    { name: '따뜻한 피부', value: '#FFDBAC' }
  ]

  const hairStyles = [
    { name: '짧은 머리', value: 'short' },
    { name: '긴 머리', value: 'long' },
    { name: '곱슬머리', value: 'curly' },
    { name: '스포츠 머리', value: 'sport' }
  ]

  const hairColors = [
    { name: '검은색', value: '#000000' },
    { name: '갈색', value: '#8B4513' },
    { name: '금발', value: '#FFD700' },
    { name: '빨간색', value: '#CD5C5C' },
    { name: '파란색', value: '#4169E1' }
  ]

  const outfits = [
    { name: '기본 복장', value: 'basic' },
    { name: '스포츠 복장', value: 'sport' },
    { name: '캐주얼', value: 'casual' }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!characterName.trim()) {
      setError('캐릭터 이름을 입력해주세요')
      return
    }

    if (characterName.length > 12) {
      setError('캐릭터 이름은 최대 12자까지 가능합니다')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('로그인이 필요합니다')
      }

      // 기존 캐릭터를 모두 비활성화
      await supabase
        .from('characters')
        .update({ is_active: false })
        .eq('user_id', user.id)

      // 새 캐릭터 생성
      const { data, error: insertError } = await supabase
        .from('characters')
        .insert([
          {
            user_id: user.id,
            name: characterName.trim(),
            skin_color: skinColor,
            hair_style: hairStyle,
            hair_color: hairColor,
            outfit: outfit,
            is_active: true
          }
        ])
        .select()

      if (insertError) throw insertError

      console.log('캐릭터 생성 성공:', data)

      if (onCharacterCreated) {
        onCharacterCreated(data[0])
      }
    } catch (err) {
      console.error('캐릭터 생성 에러:', err)
      setError(err.message || '캐릭터 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="character-creator-container">
      <div className="character-creator-card">
        <div className="creator-header">
          <div>
            <h1>캐릭터 생성</h1>
            <p className="subtitle">나만의 배구 선수를 만들어보세요!</p>
          </div>
          {onLogout && (
            <button className="logout-btn-creator" onClick={onLogout}>
              로그아웃
            </button>
          )}
        </div>

        <div className="creator-content">
          {/* 캐릭터 미리보기 */}
          <div className="character-preview">
            <h3>미리보기</h3>
            <div className="preview-canvas">
              {/* 머리 */}
              <div
                className="preview-head"
                style={{ backgroundColor: skinColor }}
              >
                {/* 헤어스타일 */}
                <div
                  className={`preview-hair ${hairStyle}`}
                  style={{ backgroundColor: hairColor }}
                />
              </div>

              {/* 몸 */}
              <div className={`preview-body ${outfit}`}>
                <div className="preview-arms">
                  <div className="arm left" style={{ backgroundColor: skinColor }} />
                  <div className="arm right" style={{ backgroundColor: skinColor }} />
                </div>
              </div>

              {/* 다리 */}
              <div className="preview-legs" />

              {/* 이름 표시 */}
              <div className="preview-name">
                {characterName || '이름 없음'}
              </div>
            </div>
          </div>

          {/* 캐릭터 커스터마이징 폼 */}
          <form className="character-form" onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}

            {/* 캐릭터 이름 */}
            <div className="form-group">
              <label>캐릭터 이름</label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                maxLength={12}
                placeholder="캐릭터 이름 입력 (최대 12자)"
                disabled={loading}
              />
              <span className="char-count">{characterName.length}/12</span>
            </div>

            {/* 피부색 선택 */}
            <div className="form-group">
              <label>피부색</label>
              <div className="color-options">
                {skinColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`color-option ${skinColor === color.value ? 'active' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setSkinColor(color.value)}
                    disabled={loading}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* 헤어스타일 선택 */}
            <div className="form-group">
              <label>헤어스타일</label>
              <div className="style-options">
                {hairStyles.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    className={`style-option ${hairStyle === style.value ? 'active' : ''}`}
                    onClick={() => setHairStyle(style.value)}
                    disabled={loading}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 헤어 색상 선택 */}
            <div className="form-group">
              <label>헤어 색상</label>
              <div className="color-options">
                {hairColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`color-option ${hairColor === color.value ? 'active' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setHairColor(color.value)}
                    disabled={loading}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* 복장 선택 */}
            <div className="form-group">
              <label>복장</label>
              <div className="style-options">
                {outfits.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`style-option ${outfit === item.value ? 'active' : ''}`}
                    onClick={() => setOutfit(item.value)}
                    disabled={loading}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 생성 버튼 */}
            <button
              type="submit"
              className="create-btn"
              disabled={loading}
            >
              {loading ? '생성 중...' : '캐릭터 생성'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
