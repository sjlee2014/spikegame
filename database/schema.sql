-- =====================================================
-- 3vs3 배구 게임 데이터베이스 스키마
-- =====================================================

-- 1. 프로필 테이블
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 캐릭터 테이블
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skin_color TEXT DEFAULT '#FFD7B5',
  hair_style TEXT DEFAULT 'short',
  hair_color TEXT DEFAULT '#000000',
  outfit TEXT DEFAULT 'basic',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 게임 기록 테이블
CREATE TABLE game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  winner_team TEXT, -- 'A' or 'B'
  team_a_players UUID[],
  team_b_players UUID[],
  final_score_a INTEGER,
  final_score_b INTEGER,
  duration INTEGER, -- 초 단위
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 플레이어 통계 테이블
CREATE TABLE player_stats (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  rating INTEGER DEFAULT 1000, -- ELO 레이팅
  tier TEXT DEFAULT 'bronze',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 인덱스 생성
-- =====================================================

-- 캐릭터 검색 최적화
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_active ON characters(user_id, is_active);

-- 게임 기록 검색 최적화
CREATE INDEX idx_game_history_room_id ON game_history(room_id);
CREATE INDEX idx_game_history_created_at ON game_history(created_at DESC);

-- 통계 검색 최적화
CREATE INDEX idx_player_stats_rating ON player_stats(rating DESC);
CREATE INDEX idx_player_stats_tier ON player_stats(tier);

-- =====================================================
-- Row Level Security (RLS) 설정
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- 프로필: 본인만 수정, 모두 읽기 가능
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- 캐릭터: 본인만 생성/수정, 모두 읽기 가능
CREATE POLICY "Characters are viewable by everyone"
  ON characters FOR SELECT USING (true);

CREATE POLICY "Users can create own characters"
  ON characters FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own characters"
  ON characters FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own characters"
  ON characters FOR DELETE USING (auth.uid() = user_id);

-- 게임 기록: 모두 읽기 가능
CREATE POLICY "Game history is viewable by everyone"
  ON game_history FOR SELECT USING (true);

-- 통계: 모두 읽기 가능
CREATE POLICY "Stats are viewable by everyone"
  ON player_stats FOR SELECT USING (true);

CREATE POLICY "Users can insert own stats"
  ON player_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
