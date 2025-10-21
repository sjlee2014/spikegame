-- =====================================================
-- 트리거 및 자동화 함수
-- =====================================================

-- 1. updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. profiles 테이블 updated_at 트리거
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. player_stats 테이블 updated_at 트리거
CREATE TRIGGER update_player_stats_updated_at
  BEFORE UPDATE ON player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. 신규 사용자 자동 프로필 생성 함수
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  random_username TEXT;
BEGIN
  -- 랜덤 사용자명 생성 (User + 난수)
  random_username := 'User' || FLOOR(RANDOM() * 1000000)::TEXT;

  -- 프로필 생성
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    random_username,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- 플레이어 통계 초기화
  INSERT INTO public.player_stats (user_id)
  VALUES (NEW.id);

  -- 기본 캐릭터 생성
  INSERT INTO public.characters (user_id, name, is_active)
  VALUES (NEW.id, '기본 캐릭터', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 신규 사용자 트리거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 6. 티어 업데이트 함수 (레이팅 기반)
-- =====================================================

CREATE OR REPLACE FUNCTION update_player_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier := CASE
    WHEN NEW.rating >= 2000 THEN 'diamond'
    WHEN NEW.rating >= 1500 THEN 'gold'
    WHEN NEW.rating >= 1200 THEN 'silver'
    ELSE 'bronze'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 티어 자동 업데이트 트리거
CREATE TRIGGER update_tier_on_rating_change
  BEFORE UPDATE ON player_stats
  FOR EACH ROW
  WHEN (OLD.rating IS DISTINCT FROM NEW.rating)
  EXECUTE FUNCTION update_player_tier();
