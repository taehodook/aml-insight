# AML 인사이트 — 배포 & 자동 갱신 가이드

이 문서 하나로 사이트를 **무료로 배포**하고 **매일 자동 갱신**되게 만들 수 있습니다.
(GitHub + GitHub Actions만 사용 · 서버·비용 없음)

> **이 문서는 두 갈래입니다.**
> - **A. 전체 사이트를 배포**하고 매일 자동 갱신 → **1~7장** (아래 순서대로)
> - **B. 도구 하나만 빠르게 쓰기**(관계 탐색기 등, 설치 불필요) → **8장**부터 먼저 보세요
>
> 먼저 **0-1. 업로드 전 체크리스트**를 꼭 확인하세요. 자주 막히는 지점을 미리 정리했습니다.

---


## 0. 전체 그림 (5분이면 이해)

```
매일 아침 07:30 (KST)
   ↓  GitHub Actions(무료 크론)가 자동 실행
   ├─ 브리핑 수집 (뉴스·제재·규제)      → briefing/data.json
   ├─ 업종 위험 RA 수집 (국내외 뉴스)    → business-risk/ra_news.json
   ├─ 수법 인텔리전스 수집 (수사·뉴스)   → typology/methods.json
   ├─ 자금흐름 수집                      → flow/flow_data.json
   └─ (월요일만) 제재 명단 갱신          → checker/*
   ↓  변경분을 자동 커밋 & 푸시
   ↓  Netlify(또는 GitHub Pages)가 자동 재배포
사이트가 최신 데이터로 갱신됨 ✅
```

핵심: **한 번 세팅하면 그 뒤로는 손댈 필요 없음.** 매일 알아서 돌아갑니다.

---

## 0-1. 업로드 전 체크리스트 (막힘 방지)

| 항목 | 내용 |
|---|---|
| `.github` 폴더 | 숨김 폴더라 업로드 때 자주 누락됨 → **반드시 포함** (자동 갱신의 핵심) |
| `checker/index.html` (6.8MB) | 큼. 웹 드래그 업로드로도 되지만, 느리면 **Git 명령**(2-2 하단)으로 올리는 게 안전 |
| `country-risk/` | **빈 안내 페이지**임 → 실제 국가위험평가는 별도 준비 필요 (9장 참고) |
| 도메인 잠금 | 관계 탐색기는 **허가된 주소에서만 열림** → 새 주소로 배포하면 잠김 → **반드시 10장 먼저 수정** |

> 가장 흔한 사고 2가지: ①`.github` 누락으로 자동갱신 안 됨 ②도메인 잠금 안 풀어서 관계 탐색기가 🔒 화면만 뜸. 이 둘만 조심하면 대부분 성공합니다.

---

## 1. 사전 준비물

- **GitHub 계정** (무료) — https://github.com
- 배포용 둘 중 하나 (무료):
  - **Netlify** (추천, 쉬움) — https://netlify.com
  - 또는 **GitHub Pages** (GitHub만으로)

파이썬·서버 설치 **불필요**. 수집 스크립트는 전부 파이썬 표준 라이브러리만 써서 `pip install`도 필요 없습니다.

---

## 2. GitHub에 올리기

### 2-1. 저장소(repository) 만들기
1. GitHub 로그인 → 우상단 **+** → **New repository**
2. 이름: 예) `aml-insight` / **Public** 선택 (Actions 무료로 쓰려면 Public 권장)
3. **Create repository**

### 2-2. 파일 업로드
- 이 zip(`aml-insight-v12.zip`)의 **압축을 풀고**, 그 안의 모든 파일·폴더를 저장소에 올립니다.
- 웹에서 올리는 법: 저장소 페이지 → **Add file** → **Upload files** → 폴더째 드래그 → **Commit changes**
- ⚠️ 중요: `.github` 폴더(안에 workflows/briefing.yml)가 **반드시 함께** 올라가야 자동 갱신이 작동합니다. (숨김 폴더라 빠지기 쉬움 — 확인!)

> **더 편한 방법**: PC에 Git이 있으면
> ```bash
> cd 압축푼폴더
> git init && git add -A && git commit -m "init"
> git branch -M main
> git remote add origin https://github.com/<내계정>/aml-insight.git
> git push -u origin main
> ```

---

## 3. 자동 갱신(GitHub Actions) 켜기

### 3-1. Actions 활성화
1. 저장소 → 상단 **Actions** 탭
2. "I understand my workflows, go ahead and enable them" 나오면 클릭
3. 왼쪽에 **daily-aml-briefing** 워크플로가 보이면 성공

### 3-2. (선택) Gemini API 키 등록
브리핑 요약문을 AI로 생성하려면 키가 필요합니다. **없어도 템플릿 브리핑으로 정상 작동**하니 건너뛰어도 됩니다.
1. https://aistudio.google.com/apikey 에서 무료 키 발급
2. 저장소 → **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** → Name: `GEMINI_API_KEY` / Secret: (발급받은 키) → **Add secret**

### 3-3. 지금 바로 한 번 돌려보기 (테스트)
크론(매일 07:30)을 기다리지 말고 즉시 실행해서 확인:
1. **Actions** 탭 → 왼쪽 **daily-aml-briefing** 클릭
2. 오른쪽 **Run workflow** 버튼 → **Run workflow**
3. 1~3분 뒤 초록 체크(✅)가 뜨면 성공
4. 저장소 파일에서 `business-risk/ra_news.json`, `typology/methods.json`의 수정 시간이 방금으로 바뀌었는지 확인

> 실패(빨간 ✗)하면 → 해당 실행 클릭 → 로그에서 빨간 줄 확인. 대개 `.github` 폴더 누락 또는 파일 경로 문제입니다.

---

## 4. 배포하기 (둘 중 하나)

### 방법 A — Netlify (추천)
1. https://netlify.com 로그인 (GitHub 계정으로)
2. **Add new site** → **Import an existing project** → **GitHub** → 저장소 선택
3. 빌드 설정: **비워두기** (정적 사이트라 빌드 불필요)
   - Build command: (공란)
   - Publish directory: `.` (또는 공란)
4. **Deploy** → 몇 초 뒤 `https://랜덤이름.netlify.app` 주소 생성
5. 이후 GitHub에 새 커밋이 들어오면 **Netlify가 자동 재배포** → 매일 갱신된 데이터가 사이트에 반영됨

### 방법 B — GitHub Pages
1. 저장소 → **Settings** → **Pages**
2. Source: **Deploy from a branch** → Branch: `main` / `/ (root)` → **Save**
3. 1분 뒤 `https://<계정>.github.io/aml-insight/` 로 접속
   - ⚠️ 하위 경로(`/aml-insight/`)로 열리므로, 도구 간 링크가 깨지면 Netlify를 쓰는 게 편합니다.

---

## 5. 잘 돌아가는지 확인하는 법

| 확인 항목 | 어디서 |
|---|---|
| 자동 실행됐나 | Actions 탭 — 매일 07:30 KST 실행 기록, 초록 ✅ |
| 데이터 갱신됐나 | `business-risk/ra_news.json` 등의 커밋 날짜 |
| 사이트 반영됐나 | 배포 주소에서 업종위험·수법 페이지의 기사 날짜 |

---

## 6. 자주 겪는 문제

**Q. Actions가 아예 안 보여요**
→ `.github/workflows/briefing.yml`이 안 올라갔습니다. 숨김 폴더라 자주 누락돼요. 저장소에서 `.github` 폴더가 보이는지 확인하고 없으면 다시 업로드.

**Q. 실행은 되는데 사이트가 안 바뀌어요**
→ ① Actions는 성공했는지(초록✅) ② 커밋이 생겼는지(저장소 커밋 기록) ③ Netlify가 재배포했는지(Netlify Deploys 탭) 순서로 확인.

**Q. 크론 시간을 바꾸고 싶어요**
→ `.github/workflows/briefing.yml`의 `cron: "30 22 * * *"` 수정. **UTC 기준**이라 한국시간 -9시간입니다. (07:30 KST = 22:30 UTC 전날). 예: 매일 09:00 KST로 바꾸려면 `"0 0 * * *"`.

**Q. 특정 수집만 끄고 싶어요**
→ briefing.yml에서 해당 `- name: Collect ...` 스텝을 지우거나 앞에 `#`로 주석 처리.

**Q. 하루 한 번 말고 더 자주 돌리고 싶어요**
→ cron을 여러 개 추가 가능. 예: 아침·저녁 2회
```yaml
schedule:
  - cron: "30 22 * * *"   # 07:30 KST
  - cron: "30 10 * * *"   # 19:30 KST
```
단, 뉴스 소스 부하를 고려해 하루 1~2회 권장.

---

## 7. 무엇이 자동 갱신되나 (요약)

| 도구 | 스크립트 | 출력 파일 | 주기 |
|---|---|---|---|
| 데일리 브리핑 | briefing/collect.py | briefing/data.json | 매일 |
| 업종 위험 인텔리전스 | business-risk/collect_ra.py | business-risk/ra_news.json | 매일 |
| 수법 인텔리전스 | typology/collect_method.py | typology/methods.json | 매일 |
| 자금흐름 | flow/collect_flow.py | flow/flow_data.json | 매일 |
| 제재 체커 | checker/fetch_wanted.py 등 | checker/* | 월요일만 |

---

## 8. 도구 하나만 빠르게 쓰기 (설치 불필요)

전체 사이트 배포가 부담되면, **도구 HTML 파일 하나만** 쓰면 됩니다. 대부분 파일 하나로 완결됩니다.

**바로 열어서 쓰는 도구 (더블클릭):**
- `relation/index.html` — 관계 탐색기 ⚠️ **단, 도메인 잠금 때문에 그냥 열면 🔒 화면이 뜹니다 → 10장에서 잠금 해제 후 사용**
- `typology/index.html` — 수법 인텔리전스 (단, `methods.json`이 같은 폴더에 있어야 함)
- `business-risk/index.html` — 업종 위험 (단, `ra_news.json` 필요)
- `guide/index.html` — 관계 탐색기 사용법

> **주의**: typology·business-risk는 데이터(json)를 `fetch`로 불러오는데, 파일을 직접 더블클릭하면(`file://`) 브라우저 보안정책상 json을 못 읽을 수 있습니다.
> **해결 2가지**:
> 1. 간단히: 폴더에서 아래 명령으로 로컬 서버 띄우기
>    ```bash
>    cd 폴더위치
>    python3 -m http.server 8000
>    # 브라우저에서 http://localhost:8000 접속
>    ```
> 2. 또는 데이터를 HTML에 넣은 **단독 샘플 파일**을 쓰기 (예: `typology-sample.html`은 더블클릭만으로 열림)

관계 탐색기는 데이터를 화면에서 직접 입력/붙여넣기 하므로 json fetch가 없어 **더블클릭으로도 작동**합니다 (잠금만 풀면).

---

## 9. 국가위험평가(country-risk) 연결하기

이 패키지의 `country-risk/`는 **빈 안내 페이지**입니다. 실제 255개국 × 9기관 국가위험평가 사이트는 별도 프로젝트예요.

**연결 방법:**
1. 기존 국가위험평가 프로젝트의 파일(`index.html`, `sw.js`, `manifest.json`, `data.json` 등)을 준비
2. 이 패키지의 `country-risk/` 폴더 안에 **덮어쓰기**
3. 갱신 체계(엑셀 → `convert.py` → `build.py`)도 함께 넣으면 그대로 작동
4. 허브 색인 07번에서 자동 연결됨

> 국가위험평가가 필요 없으면, 허브(`index.html`)에서 해당 `<a class="row" href="./country-risk/">...</a>` 줄을 지우면 목록에서 사라집니다.

---

## 10. 도메인 잠금 해제/설정 (관계 탐색기 — 중요!)

관계 탐색기(`relation/index.html`)는 **지정한 주소에서만 열리도록** 잠겨 있습니다. 무단 복제 방지용인데, **새 주소로 배포하면 본인도 🔒 화면에 막힙니다.** 반드시 새 주소를 등록하세요.

**수정 방법:**
1. `relation/index.html`을 텍스트 편집기로 열기
2. `ALLOW` 로 검색 (파일 중반, 스크립트 영역)
3. 아래 줄을 찾습니다:
   ```javascript
   const ALLOW=["amlinsight-test1.netlify.app","localhost","127.0.0.1",""];
   ```
4. **본인 배포 주소를 추가**합니다. 예: `my-aml.netlify.app`으로 배포했다면
   ```javascript
   const ALLOW=["my-aml.netlify.app","amlinsight-test1.netlify.app","localhost","127.0.0.1",""];
   ```
   - `localhost`·`127.0.0.1`·`""`은 로컬 테스트용이니 그대로 두세요.
   - 여러 주소를 쉼표로 계속 추가할 수 있습니다.

**잠금을 아예 끄고 싶으면** (누구나 열 수 있게):
```javascript
const ALLOW=[];   // 빈 배열 = 잠금 해제
```

> ⚠️ 배포 순서 팁: **①먼저 대충 배포해서 Netlify 주소를 확인 → ②그 주소를 ALLOW에 추가 → ③다시 커밋** 하면 확실합니다. (Netlify 주소는 처음 배포 때 정해짐)
> 참고: 이 잠금은 JavaScript라 작정하면 우회 가능한 **라이트 방어**입니다. 초·중급 도용은 막지만 완벽하진 않아요.

---

## 11. 커스텀 도메인 (선택)

`randomname.netlify.app` 대신 `aml.mydomain.com` 같은 주소를 쓰려면:
1. Netlify → 사이트 → **Domain settings** → **Add a domain**
2. 보유한 도메인 입력 → 안내에 따라 DNS 레코드 설정
3. 무료 SSL(https) 자동 적용
4. ⚠️ 새 도메인도 **10장의 ALLOW 배열에 추가**해야 관계 탐색기가 열립니다

---
---

## 12. SQL 테마 모니터링 룰 (자동 생성)

**수법 인텔리전스** 페이지(`/typology/`)의 각 수법 카드에 **⌨ SQL 테마룰 템플릿**이 붙어 있습니다.

- 뉴스에서 활발한 수법이 매일 자동 갱신되고, 각 수법에 **바로 쓸 수 있는 SQL 초안**이 함께 제공됩니다
- 카드에서 SQL 블록을 펼치고 **📋 복사** → 사내 모니터링 시스템에 붙여넣기
- 예: 오늘 1위가 "가상자산 환전 세탁"이면 → 거래소 상대 분할거래 탐지 SQL이 상단에

**사용 전 반드시 치환할 것:**
| 템플릿 | 사내 치환 대상 |
|---|---|
| `t_txn` (거래) | 실제 거래 테이블명 |
| `t_acct` / `t_corp` / `t_merchant` | 계좌·법인·가맹점 테이블 |
| `t_vasp_acct` / `t_fraud_report` / `t_limit_chg` | 거래소 계좌·피해신고·한도변경 (없으면 해당 룰 보류) |
| `:파라미터` (예: `:고액기준`) | 사내 임계값 |

> 문법은 범용 ANSI 기준입니다. Oracle은 `INTERVAL` 표기, MySQL은 재귀 CTE 문법(`WITH RECURSIVE`) 버전 등을 확인하세요. **초안일 뿐이니 반드시 테스트 환경에서 실행 계획·성능을 검증 후 운영 반영하세요.**

---

## 13. 뉴스 자동 발송 — 텔레그램(추천) & 카카오톡

매일 크론이 돈 뒤, 그날의 다이제스트(키워드·수법 동향·업종위험·주요 기사 링크)를 메신저로 자동 발송할 수 있습니다.

### 13-1. 텔레그램 (추천 — 완전 자동·무료·만료 없음)

**① 봇 만들기 (2분)**
1. 텔레그램에서 **@BotFather** 검색 → 대화 시작
2. `/newbot` 입력 → 봇 이름(예: AML인사이트봇) → 봇 아이디(예: `aml_insight_bot`, 반드시 `bot`으로 끝나야 함)
3. BotFather가 주는 **토큰**(`1234567:AAF...` 형태)을 복사해 보관

**② chat_id 알아내기 (2분)**
1. 방금 만든 봇을 검색해서 **아무 메시지나 1개 전송** (예: "hi") — 이걸 안 하면 다음 단계가 빈 값
2. 브라우저 주소창에:
   ```
   https://api.telegram.org/bot<토큰>/getUpdates
   ```
   (`<토큰>` 자리에 ①의 토큰. bot 글자 뒤에 바로 붙임)
3. 응답 JSON에서 `"chat":{"id":123456789,...` 의 **숫자가 chat_id**

> 팀 단체방에 보내려면: 봇을 그 방에 초대 → 방에서 아무 말 → 같은 방법으로 조회하면 **음수 id**(예: `-100123...`)가 나옵니다. 그걸 쓰면 단체방 발송.

**③ GitHub Secrets 등록 (1분)**
저장소 → **Settings → Secrets and variables → Actions → New repository secret**
- `TELEGRAM_BOT_TOKEN` = ①의 토큰
- `TELEGRAM_CHAT_ID` = ②의 숫자
- (선택) **Variables 탭**에 `SITE_URL` = 배포 주소 (메시지 하단 링크용)

**④ 테스트**
Actions → daily-aml-briefing → **Run workflow** → 로그에서 `텔레그램 발송: 성공 ✅` 확인 → 폰에 메시지 도착!

**발송 내용 예시:**
```
🛡 AML 인사이트 데일리 · 2026-07-05

📰 오늘의 키워드
가상자산 15건 · 자금세탁 12건 · 코인 7건

🎯 수법 동향 (score · 당국적발)
 100 · 가상자산 환전 세탁 (적발 37건)
  85 · 보이스피싱 인출·수거 (적발 57건)

📊 업종 위험 1위 가상자산사업자 (종합 100)
⚠ 재평가 후보: 미술품·골동품(21건)

🔗 주요 기사
· (기사 제목 링크 3건)
```

### 13-2. 카카오톡 — 솔직한 한계부터

| 항목 | 현실 |
|---|---|
| **나에게 보내기** ("나와의 채팅") | ✅ 가능 — 아래 절차 |
| 친구에게 보내기 | ⚠ 친구가 앱에 동의해야 하고 월 한도 있음 |
| **단톡방(팀방) 발송** | ❌ 사실상 불가 — 카카오 비즈니스 채널 심사 필요 |
| 토큰 유지 | ⚠ refresh_token 약 2개월 — 매일 크론이 돌면 자동 연장되지만, 중단되면 재발급 필요 |

→ **팀 공유 목적이면 텔레그램을 쓰세요.** 개인 알림용 "나에게 보내기"만 원하면 아래로.

**① 카카오 앱 만들기**
1. https://developers.kakao.com → 로그인 → **내 애플리케이션 → 애플리케이션 추가**
2. 만든 앱 → **앱 키**에서 **REST API 키** 복사
3. **카카오 로그인** 메뉴 → 활성화 ON → Redirect URI에 `https://localhost` 등록
4. **동의항목** → "카카오톡 메시지 전송(talk_message)" → **선택 동의** 설정

**② 최초 1회 토큰 발급 (브라우저 + 터미널)**
1. 브라우저에서 (REST키·URI 치환):
   ```
   https://kauth.kakao.com/oauth/authorize?client_id=REST키&redirect_uri=https://localhost&response_type=code&scope=talk_message
   ```
2. 동의하면 `https://localhost/?code=XXXX`로 이동(페이지는 안 떠도 됨) → 주소창의 **code=값** 복사
3. 터미널에서:
   ```bash
   curl -X POST "https://kauth.kakao.com/oauth/token" \
     -d "grant_type=authorization_code" \
     -d "client_id=REST키" \
     -d "redirect_uri=https://localhost" \
     -d "code=방금복사한값"
   ```
4. 응답의 **refresh_token**을 보관 (access_token은 스크립트가 매번 자동 갱신)

**③ GitHub Secrets 등록**
- `KAKAO_REST_KEY` = REST API 키
- `KAKAO_REFRESH_TOKEN` = ②의 refresh_token

**④ 테스트** — Run workflow → `카카오 발송: 성공 ✅` → "나와의 채팅"에 카드 도착

> 참고: 카카오 텍스트 템플릿은 200자 제한이라 요약(수법 상위 3개 + 링크 버튼)만 갑니다. 상세는 텔레그램이 훨씬 풍부해요.

### 13-3. 발송 끄기/바꾸기
- 끄기: Secrets에서 해당 키 삭제 (스크립트가 자동 스킵 — 크론은 정상 진행)
- 시간 바꾸기: 크론 시간 = 발송 시간 (6장 참고)
- 문구 바꾸기: `notify/send_telegram.py`의 `build_message()` 수정


---

*본 가이드는 무료 티어(GitHub Actions 공개 저장소 무제한, Netlify 무료 플랜) 기준입니다.*
