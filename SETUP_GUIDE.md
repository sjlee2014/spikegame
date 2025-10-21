# Google 로그인 설정 가이드

이 가이드는 3vs3 배구 게임에서 Google OAuth 인증을 설정하는 방법을 설명합니다.

## 1. Supabase 프로젝트 생성

### 1.1 계정 생성 및 프로젝트 생성
1. [Supabase](https://supabase.com)에 접속하여 계정 생성
2. **New Project** 버튼 클릭
3. 프로젝트 정보 입력:
   - **Name**: spikegame (또는 원하는 이름)
   - **Database Password**: 안전한 비밀번호 생성 (저장해두세요!)
   - **Region**: Northeast Asia (Seoul) 권장
4. **Create new project** 클릭 (약 2분 소요)

### 1.2 API Keys 확인
1. 프로젝트 대시보드에서 **Settings** (톱니바퀴 아이콘) 클릭
2. **API** 메뉴 선택
3. 아래 정보 복사:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 1.3 클라이언트 환경 변수 설정
`client/.env` 파일을 열고 다음 값을 업데이트:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

---

## 2. Google Cloud Console 설정

### 2.1 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 상단의 프로젝트 선택 드롭다운 클릭
3. **New Project** 클릭
4. 프로젝트 이름 입력: `volleyball-3v3` (또는 원하는 이름)
5. **Create** 클릭

### 2.2 OAuth Consent Screen 설정
1. 왼쪽 메뉴에서 **APIs & Services > OAuth consent screen** 선택
2. **User Type**: External 선택 후 **Create**
3. 앱 정보 입력:
   - **App name**: 3vs3 배구 게임
   - **User support email**: 본인 이메일
   - **Developer contact information**: 본인 이메일
4. **Save and Continue** 클릭
5. **Scopes** 페이지: 건너뛰기 (Save and Continue)
6. **Test users** 페이지: 건너뛰기 (Save and Continue)
7. **Summary** 확인 후 **Back to Dashboard**

### 2.3 OAuth 2.0 Client ID 생성
1. 왼쪽 메뉴에서 **APIs & Services > Credentials** 선택
2. 상단의 **+ Create Credentials** 클릭
3. **OAuth client ID** 선택
4. **Application type**: Web application
5. **Name**: Volleyball 3v3 Web Client
6. **Authorized redirect URIs** 섹션에서 **+ Add URI** 클릭
7. 다음 URI 추가:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
   (your-project-ref를 실제 Supabase 프로젝트 URL로 교체)
8. **Create** 클릭
9. 생성된 **Client ID**와 **Client Secret** 복사 (나중에 사용)

---

## 3. Supabase에서 Google Provider 활성화

### 3.1 Google OAuth 설정
1. Supabase 프로젝트 대시보드로 돌아가기
2. 왼쪽 메뉴에서 **Authentication** 클릭
3. **Providers** 탭 선택
4. **Google** 찾아서 활성화
5. Google Cloud Console에서 복사한 정보 입력:
   - **Client ID**: Google OAuth Client ID
   - **Client Secret**: Google OAuth Client Secret
6. **Save** 클릭

### 3.2 Redirect URL 확인
- Supabase가 자동으로 제공하는 Callback URL 확인:
  ```
  https://your-project-ref.supabase.co/auth/v1/callback
  ```
- 이 URL이 Google Cloud Console의 Authorized redirect URIs에 정확히 일치하는지 확인

---

## 4. 데이터베이스 스키마 설정

### 4.1 SQL Editor 접속
1. Supabase 프로젝트 대시보드로 이동
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. **New query** 버튼 클릭

### 4.2 테이블 생성
1. `database/schema.sql` 파일 열기
2. 전체 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭 (또는 Ctrl+Enter)
5. "Success. No rows returned" 메시지 확인

**생성되는 테이블:**
- `profiles`: 사용자 프로필
- `characters`: 캐릭터 정보
- `game_history`: 게임 기록
- `player_stats`: 플레이어 통계

### 4.3 트리거 생성
1. `database/triggers.sql` 파일 열기
2. 전체 내용 복사
3. SQL Editor에 새 쿼리로 붙여넣기
4. **Run** 버튼 클릭
5. 성공 메시지 확인

**생성되는 트리거:**
- 신규 사용자 자동 프로필 생성
- 티어 자동 업데이트
- updated_at 자동 갱신

### 4.4 함수 생성
1. `database/functions.sql` 파일 열기
2. 전체 내용 복사
3. SQL Editor에 새 쿼리로 붙여넣기
4. **Run** 버튼 클릭
5. 성공 메시지 확인

**생성되는 함수:**
- `record_game_result()`: 게임 결과 기록 및 통계 업데이트
- `get_leaderboard()`: 리더보드 조회
- `get_player_history()`: 플레이어 전적 조회
- `set_active_character()`: 활성 캐릭터 설정
- `check_username_available()`: 사용자명 중복 확인

### 4.5 데이터베이스 확인
1. 왼쪽 메뉴에서 **Table Editor** 클릭
2. 생성된 테이블 목록 확인:
   - profiles
   - characters
   - game_history
   - player_stats

### 4.6 서버 환경 변수 설정
`server/.env` 파일을 열고 다음 값을 업데이트:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

**주의:**
- `service_role` 키는 **모든 권한**을 가지고 있습니다
- 절대 클라이언트 코드나 공개 저장소에 노출하지 마세요!
- 서버 측에서만 사용하세요

---

## 5. 애플리케이션 실행

### 5.1 서버 시작
```bash
cd server
npm run dev
```

### 5.2 클라이언트 시작
```bash
cd client
npm run dev
```

### 5.3 브라우저에서 확인
1. 브라우저에서 `http://localhost:5173` 접속
2. "Google로 로그인" 버튼 클릭
3. Google 계정 선택 및 권한 승인
4. 로그인 성공 시 메인 게임 화면으로 리다이렉트

---

## 6. 문제 해결

### 로그인 버튼을 눌러도 아무 반응이 없어요
- 브라우저 콘솔(F12)을 열어 에러 메시지 확인
- `.env` 파일의 환경 변수가 올바르게 설정되었는지 확인
- 개발 서버를 재시작해보세요

### "Invalid redirect URI" 에러가 발생해요
- Google Cloud Console의 Authorized redirect URIs 확인
- Supabase의 Callback URL과 정확히 일치하는지 확인
- URL에 슬래시(/)가 추가로 들어가지 않았는지 확인

### "Invalid client ID" 에러가 발생해요
- Supabase에 입력한 Google Client ID가 정확한지 확인
- Google Cloud Console에서 올바른 프로젝트의 Credentials를 사용하는지 확인

### 로그인은 되는데 다시 로그인 화면으로 돌아가요
- 브라우저 콘솔에서 `supabase.auth.getSession()` 결과 확인
- 쿠키 설정이 차단되지 않았는지 확인 (시크릿 모드 테스트)

---

## 7. 다음 단계

로그인 기능과 데이터베이스가 완료되었습니다! 이제 다음 기능을 구현할 수 있습니다:

- [ ] 캐릭터 선택 화면
- [ ] 로비 시스템
- [ ] 매치메이킹 로직
- [ ] 실제 게임 화면 및 물리 엔진
- [ ] 리더보드 및 통계

Happy coding! 🏐
