# 데이터베이스 스키마

이 폴더에는 3vs3 배구 게임의 Supabase 데이터베이스 스키마가 포함되어 있습니다.

## 파일 설명

### 1. `schema.sql`
기본 데이터베이스 테이블과 인덱스를 생성합니다.

**테이블:**
- **profiles**: 사용자 프로필 정보
- **characters**: 캐릭터 커스터마이징 데이터
- **game_history**: 게임 결과 기록
- **player_stats**: 플레이어 통계 및 랭킹

**Row Level Security (RLS):**
- 모든 테이블에 RLS 활성화
- 읽기는 공개, 쓰기는 본인만 가능

### 2. `triggers.sql`
자동화를 위한 트리거와 함수를 생성합니다.

**주요 기능:**
- **자동 프로필 생성**: 신규 사용자 가입 시 자동으로 프로필, 통계, 기본 캐릭터 생성
- **updated_at 자동 갱신**: 레코드 업데이트 시 자동으로 타임스탬프 갱신
- **티어 자동 업데이트**: 레이팅 변경 시 자동으로 티어 계산

**티어 시스템:**
- Bronze: 0-1199 레이팅
- Silver: 1200-1499 레이팅
- Gold: 1500-1999 레이팅
- Diamond: 2000+ 레이팅

### 3. `functions.sql`
게임 로직과 데이터 조회를 위한 함수들입니다.

**함수 목록:**

#### `record_game_result()`
게임 종료 후 결과를 기록하고 플레이어 통계를 업데이트합니다.

**파라미터:**
- `p_room_id`: 게임 룸 ID
- `p_winner_team`: 승리 팀 ('A' 또는 'B')
- `p_team_a_players`: 팀 A 플레이어 UUID 배열
- `p_team_b_players`: 팀 B 플레이어 UUID 배열
- `p_final_score_a`: 팀 A 최종 점수
- `p_final_score_b`: 팀 B 최종 점수
- `p_duration`: 게임 시간 (초)

**반환값:** 생성된 게임 기록 ID

**사용 예시:**
```sql
SELECT record_game_result(
  'room_123',
  'A',
  ARRAY['uuid1', 'uuid2', 'uuid3']::uuid[],
  ARRAY['uuid4', 'uuid5', 'uuid6']::uuid[],
  25,
  20,
  600
);
```

#### `get_leaderboard()`
레이팅 기준 리더보드를 조회합니다.

**파라미터:**
- `p_limit`: 조회할 플레이어 수 (기본값: 100)
- `p_tier`: 특정 티어 필터 (선택사항)

**사용 예시:**
```sql
-- 전체 리더보드 상위 100명
SELECT * FROM get_leaderboard();

-- 골드 티어 상위 50명
SELECT * FROM get_leaderboard(50, 'gold');
```

#### `get_player_history()`
특정 플레이어의 게임 전적을 조회합니다.

**파라미터:**
- `p_user_id`: 플레이어 UUID
- `p_limit`: 조회할 게임 수 (기본값: 20)

**사용 예시:**
```sql
SELECT * FROM get_player_history('user-uuid-here', 10);
```

#### `set_active_character()`
플레이어의 활성 캐릭터를 변경합니다.

**파라미터:**
- `p_user_id`: 플레이어 UUID
- `p_character_id`: 활성화할 캐릭터 UUID

**사용 예시:**
```sql
SELECT set_active_character('user-uuid', 'character-uuid');
```

#### `check_username_available()`
사용자명 사용 가능 여부를 확인합니다.

**파라미터:**
- `p_username`: 확인할 사용자명

**반환값:** boolean (true = 사용 가능, false = 중복)

**사용 예시:**
```sql
SELECT check_username_available('newuser123');
```

## 설치 순서

Supabase SQL Editor에서 다음 순서로 실행하세요:

1. **schema.sql** - 테이블 및 인덱스 생성
2. **triggers.sql** - 트리거 및 자동화 설정
3. **functions.sql** - 비즈니스 로직 함수 생성

## 데이터 모델

```
┌─────────────┐
│ auth.users  │ (Supabase Auth)
└──────┬──────┘
       │
       │ 1:1
       ▼
┌─────────────┐      1:N      ┌──────────────┐
│  profiles   │◄──────────────│  characters  │
└──────┬──────┘               └──────────────┘
       │
       │ 1:1
       ▼
┌──────────────┐
│ player_stats │
└──────────────┘

┌──────────────┐
│ game_history │ (플레이어 UUID 배열 참조)
└──────────────┘
```

## 주의사항

1. **Service Role Key**: 서버에서 `record_game_result()` 호출 시 service role key 사용 필요
2. **RLS 정책**: 클라이언트에서 직접 통계를 수정할 수 없도록 설정됨
3. **자동 프로필 생성**: Google 로그인 시 자동으로 프로필이 생성됨
4. **레이팅 시스템**: 기본 레이팅 1000, 승리 시 +25, 패배 시 -25

## 문제 해결

### 트리거가 실행되지 않아요
- auth.users 테이블에 대한 권한 확인
- 트리거가 올바르게 생성되었는지 확인:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```

### 함수 실행 시 권한 에러
- 함수는 `SECURITY DEFINER`로 설정되어 있어야 함
- 서버에서 service role key로 호출해야 함

### RLS 정책 확인
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

## 추가 기능 제안

- [ ] 친구 시스템 테이블
- [ ] 팀/클랜 시스템
- [ ] 업적 시스템
- [ ] 아이템/스킨 인벤토리
- [ ] 채팅 메시지 저장

Happy coding! 🏐
