-- =====================================================
-- 게임 통계 및 유틸리티 함수
-- =====================================================

-- 1. 게임 종료 후 통계 업데이트 함수
CREATE OR REPLACE FUNCTION record_game_result(
  p_room_id TEXT,
  p_winner_team TEXT,
  p_team_a_players UUID[],
  p_team_b_players UUID[],
  p_final_score_a INTEGER,
  p_final_score_b INTEGER,
  p_duration INTEGER
)
RETURNS UUID AS $$
DECLARE
  game_id UUID;
  player_id UUID;
  rating_change INTEGER := 25; -- ELO 레이팅 변화량
BEGIN
  -- 게임 기록 저장
  INSERT INTO game_history (
    room_id, winner_team, team_a_players, team_b_players,
    final_score_a, final_score_b, duration
  )
  VALUES (
    p_room_id, p_winner_team, p_team_a_players, p_team_b_players,
    p_final_score_a, p_final_score_b, p_duration
  )
  RETURNING id INTO game_id;

  -- Team A 플레이어 통계 업데이트
  FOREACH player_id IN ARRAY p_team_a_players
  LOOP
    IF p_winner_team = 'A' THEN
      -- 승리
      UPDATE player_stats
      SET
        total_games = total_games + 1,
        wins = wins + 1,
        rating = rating + rating_change
      WHERE user_id = player_id;
    ELSE
      -- 패배
      UPDATE player_stats
      SET
        total_games = total_games + 1,
        losses = losses + 1,
        rating = GREATEST(rating - rating_change, 0) -- 레이팅 최소값 0
      WHERE user_id = player_id;
    END IF;
  END LOOP;

  -- Team B 플레이어 통계 업데이트
  FOREACH player_id IN ARRAY p_team_b_players
  LOOP
    IF p_winner_team = 'B' THEN
      -- 승리
      UPDATE player_stats
      SET
        total_games = total_games + 1,
        wins = wins + 1,
        rating = rating + rating_change
      WHERE user_id = player_id;
    ELSE
      -- 패배
      UPDATE player_stats
      SET
        total_games = total_games + 1,
        losses = losses + 1,
        rating = GREATEST(rating - rating_change, 0)
      WHERE user_id = player_id;
    END IF;
  END LOOP;

  RETURN game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. 리더보드 조회 함수
-- =====================================================

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_limit INTEGER DEFAULT 100,
  p_tier TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  rating INTEGER,
  tier TEXT,
  total_games INTEGER,
  wins INTEGER,
  losses INTEGER,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.user_id,
    p.username,
    p.avatar_url,
    ps.rating,
    ps.tier,
    ps.total_games,
    ps.wins,
    ps.losses,
    CASE
      WHEN ps.total_games > 0 THEN ROUND((ps.wins::NUMERIC / ps.total_games::NUMERIC) * 100, 2)
      ELSE 0
    END AS win_rate
  FROM player_stats ps
  JOIN profiles p ON ps.user_id = p.id
  WHERE (p_tier IS NULL OR ps.tier = p_tier)
    AND ps.total_games > 0
  ORDER BY ps.rating DESC, ps.wins DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. 플레이어 전적 조회 함수
-- =====================================================

CREATE OR REPLACE FUNCTION get_player_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  game_id UUID,
  room_id TEXT,
  winner_team TEXT,
  player_team TEXT,
  final_score_a INTEGER,
  final_score_b INTEGER,
  duration INTEGER,
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gh.id AS game_id,
    gh.room_id,
    gh.winner_team,
    CASE
      WHEN p_user_id = ANY(gh.team_a_players) THEN 'A'
      WHEN p_user_id = ANY(gh.team_b_players) THEN 'B'
      ELSE NULL
    END AS player_team,
    gh.final_score_a,
    gh.final_score_b,
    gh.duration,
    CASE
      WHEN (p_user_id = ANY(gh.team_a_players) AND gh.winner_team = 'A') OR
           (p_user_id = ANY(gh.team_b_players) AND gh.winner_team = 'B')
      THEN 'WIN'
      ELSE 'LOSS'
    END AS result,
    gh.created_at
  FROM game_history gh
  WHERE p_user_id = ANY(gh.team_a_players)
     OR p_user_id = ANY(gh.team_b_players)
  ORDER BY gh.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. 사용자 캐릭터 활성화 함수
-- =====================================================

CREATE OR REPLACE FUNCTION set_active_character(
  p_user_id UUID,
  p_character_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- 모든 캐릭터 비활성화
  UPDATE characters
  SET is_active = false
  WHERE user_id = p_user_id;

  -- 선택한 캐릭터만 활성화
  UPDATE characters
  SET is_active = true
  WHERE id = p_character_id
    AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. 사용자 이름 중복 확인 함수
-- =====================================================

CREATE OR REPLACE FUNCTION check_username_available(
  p_username TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles WHERE username = p_username
  );
END;
$$ LANGUAGE plpgsql;
