# CLAUDE.md — 혹시요

## 프로젝트 개요
'혹시요'는 프리랜서 일러스트레이터가 받은 수정 피드백(텍스트)을 분석해
작업 목록, 확인 필요 항목, 확인 질문을 JSON으로 만들어 주는 에이전트다.
백엔드와 프론트엔드는 각각 독립된 Cloudflare Worker로 동작한다.

- 백엔드: Flue 2.3 + Hono + Workers AI (Durable Objects)
- 프론트엔드: React 19 + Vite + Cloudflare Worker
- 현재 상태 (2026-11-09)
  - 백엔드: 분석 에이전트 `AnalyzeFeedback` 완성(glm-5.3, thinking low). `docs/test-cases.md` T01~T10 통합 테스트 통과
    (`hoksiyo-backend/experiments/2026-11-08-integration`, `-revalidate`).
  - 사용량 한도(`UsageCounter` Durable Object) 동작 중. 하루 9,000 Neurons, 분석 1건당 W(n) = 1,800 + 400n 예약.
  - 테스트 도구: `hoksiyo-backend/scripts/` (사용법은 `hoksiyo-backend/README.md` "Test scripts")
  - 프론트엔드: 접속 코드 화면, 입력 화면, 결과·오류 화면 완성. 프론트 Worker가 service binding(`BACKEND`)으로 백엔드 `/api/analyze`를 호출한다.
  - Cloudflare 배포 완료: 프론트 Version `986138f3`, 백엔드 Version `f01c159d`.
    백엔드는 workers.dev·route 없이 프론트의 service binding으로만 호출된다.
  - 배포본 스모크 테스트 8개 항목 통과
    - curl 4개: 프론트 루트 200·HTML / 백엔드 workers.dev `GET /api/usage` 404 / 쿠키 없는 `POST /api/analyze` 401 / 틀린 코드 `POST /api/session` 401·Set-Cookie 없음
    - 브라우저 4개: 맞는 코드 로그인 200 / T01 분석 200·판정 기대와 일치 / 대시보드 Workers AI 사용량 증가 확인 / 13문장 입력 400 거절·분할 안내 표시
    - 배포본 실제 분석 1건(T01) 약 730 Neurons
  - **다음 작업: 11/12~15 사용자 테스트.** 테스트 후 정리 목록은 아래 "테스트 후 정리" 참고.

## 폴더 구조
```
01-hoksiyo/                 # git 루트는 상위 폴더(AXS-Challenges)
├── docs/                   # 기획·명세 문서 (아래 "문서 안내")
├── hoksiyo-backend/
│   ├── src/app.ts          # Hono 라우트 맵. 모든 라우트를 여기서 명시적으로 mount
│   ├── src/agents/         # 'use agent' 모듈. 대문자로 시작하는 export 함수 = 에이전트
│   ├── src/cloudflare.ts   # Worker 레벨 export (DO 클래스, cron 등)
│   ├── wrangler.jsonc      # AI 바인딩, DO migrations, 사용량 vars. workers_dev·preview_urls false
│   ├── flue.config.ts      # target: cloudflare
│   └── AGENTS.md           # Flue 프로젝트 규칙
└── hoksiyo-frontend/
    ├── src/                # React 앱 (접속 코드·입력·결과 화면)
    ├── worker/index.ts     # 프론트 Worker 라우트: /api/session, POST /api/analyze만 처리
    ├── worker/session.ts   # 접속 코드 확인, 세션 쿠키(HMAC)
    ├── worker/analyze.ts   # 입력 정리 후 BACKEND binding으로 전달 (MOCK_ANALYZE=1이면 mock.ts·fixtures.ts)
    └── wrangler.jsonc      # services: BACKEND → hoksiyo-backend
```

## 실행 명령어
각 폴더에서 실행한다.

| 목적 | hoksiyo-backend | hoksiyo-frontend |
|---|---|---|
| 개발 서버 | `npm run dev` (http://localhost:5173) | `npm run dev` (http://localhost:5174) |
| 타입 체크 | `npm run check:types` | `npx tsc -b` |
| 린트 | 없음 (확인 필요) | `npm run lint` (oxlint) |
| 테스트 | `scripts/` (README의 Test scripts 참고) | 없음 (확인 필요) |
| 빌드 / 배포 | `npm run build` / `npm run deploy` | `npm run build` / `npm run deploy` |

- 백엔드 에이전트 호출 예시는 `hoksiyo-backend/README.md`에 있다.
- `scripts/offline-check.mts`는 모델을 호출하지 않으므로 백엔드 변경 후 매번 돌려도 된다. `scripts/run-cases.mts`는 Neurons를 쓴다.
- `cloudflare/...` 모델은 Worker 안에서만 동작한다. `npx flue run`은 쓰지 말고 `npm run dev` + curl로 테스트한다.
- Workers AI는 로컬 개발 중에도 실제 Cloudflare 계정으로 요청이 나간다 (`npx wrangler login` 필요).
- 프론트에서 실제 분석을 하려면 두 개발 서버를 함께 띄우고 `hoksiyo-frontend/.dev.vars`의 `MOCK_ANALYZE`를 `0`으로 둔다
  (`1`이면 `worker/fixtures.ts` mock 응답, Neurons 안 씀). `.dev.vars`가 있으면 셸 환경변수로 덮어쓸 수 없다.
- Flue 문서: `npx flue docs search <query>`

## 문서 안내 (docs/)
문서 내용을 여기에 옮기지 않는다. 작업 전에 해당 문서를 직접 읽는다.

| 문서 | 언제 읽나 |
|---|---|
| `docs/analysis-schema.md` | 출력 JSON 구조, 필드·enum, 구현 시 불변 조건(6장)을 다룰 때 |
| `docs/analysis-rules.md` | confidence/status/requester 판정, 요청 분리, 질문 생성 로직을 다룰 때 |
| `docs/test-cases.md` | T01–T10 입력과 기대 판정, 합격 기준을 확인할 때 |
| `docs/product-spec.md` | 배경, 사용자, 범위(4-6), 예외 상황을 확인할 때 |

우선순위:
- **분석 로직과 출력 형식은 `analysis-schema.md`, `analysis-rules.md`가 `product-spec.md`보다 우선한다.**
  기대 결과는 `test-cases.md`를 따른다.
- **`product-spec.md`의 '⚠️ 변경됨' 표시 부분은 따르지 않는다.**
  (상단 안내 표와 각 표시 아래 설명이 현재 기준이다.)
- 문서끼리 충돌하거나 문서에 없는 결정이 필요하면 추측하지 말고 사용자에게 묻는다.

## 작업 규칙
- 백엔드 코드를 수정하기 전에 `hoksiyo-backend/AGENTS.md`를 먼저 읽는다.
- 출력 JSON은 `analysis-schema.md`와 정확히 같게 만든다. 필드를 생략하거나 null을 쓰지 말고,
  값이 없으면 `[]` 또는 `"unknown"`을 쓴다.
- 분석 결과 중 사용자가 읽는 텍스트(`summary`, `request`, `interpretations`, `confidence_reason`, `questions`)는
  한국어로 생성한다.
- 불변 조건은 LLM 프롬프트에만 맡기지 않고 코드로 검증한다
  (`analysis-schema.md` 6장의 "오류" 항목과 "구현 권장" 참고). 집계값은 코드로 계산한다.
- 스키마나 판정 규칙을 바꿔야 하면 코드를 고치기 전에 사용자에게 먼저 확인한다.
  docs/ 문서는 허락 없이 수정하지 않는다.
- 모든 AI 호출은 `/api/analyze`를 거쳐 사용량 카운터(`UsageCounter`)를 통과해야 한다.
  카운터를 거치지 않는 라우트나 에이전트를 추가하지 않는다.
- 새 에이전트를 추가하면 `src/app.ts`에 라우트를 mount하고,
  `wrangler.jsonc` `migrations`에 `Flue<Name>Agent`를 **새 tag**로 추가한다(기존 tag 수정 금지).
- `package.json`의 `@earendil-works/pi-*` overrides는 사용자 확인 없이 변경하지 않는다.
- 분석 에이전트의 모델은 `hoksiyo-backend/src/analysis/models.ts`의 상수가 기준이다
  (분석(harness) `ANALYSIS_MODEL` = `@cf/zai-org/glm-5.3`, thinking 수준 `ANALYSIS_THINKING` = `low`,
  메인 턴 `MAIN_TURN_MODEL` = `@cf/zai-org/glm-4.7-flash`).
  모델을 바꿀 때는 이 파일만 고친다. glm-5.3은 Workers Paid가 필요하고, Free 플랜에서 막힌 모델은 403 오류가 난다.
  (`src/agents/hello.ts`는 라우트에서 제외됨. DO migration(v1)에 등록된 클래스라 파일은 삭제하지 않는다.
  삭제는 아래 "테스트 후 정리"에서 마이그레이션과 함께 진행한다.)
- Valibot 1.5.0은 직접 의존성이다(`package.json`에 고정).
- 변경 후에는 해당 폴더의 타입 체크를 실행하고, 프론트엔드라면 린트도 실행한다.
- 이미지 분석, 답장 작성·전송, 견적 판단, 피드백 저장·자동 대조는 MVP 범위 밖이다 (`product-spec.md` 4-6).
  단, 사용자가 입력한 이전 피드백과의 대조(`prior_feedback_reference`)는 범위 안이다.
- `.env`, `.dev.vars`는 커밋하지 않는다. 커밋과 push는 사용자가 요청할 때만 한다.

## 확인 필요
- 테스트 러너(예: vitest)와 백엔드 린트 도입 여부

### 배포 전 정리 (완료, 2026-11-09)
실험 코드(`model`·`mode` 입력, B 모드 함수, 응답의 `reply_text`·`reply_metadata`, 프론트의 임시 `mode: 'C'`)를 삭제했고,
입력 스키마를 `v.strictObject`로 바꿨으며, 백엔드 `workers_dev`·`preview_urls`를 `false`로 설정했다.
배포본이 mock 응답을 내지 않는 것도 확인했다(`MOCK_ANALYZE`는 `hoksiyo-frontend/.dev.vars`에만 있음).

### 테스트 후 정리 (11/12~15 사용자 테스트 뒤에 진행)
- `src/agents/hello.ts` 삭제와 DO 삭제 마이그레이션: `wrangler.jsonc` `migrations`에 **새 tag**로
  `deleted_classes: ["FlueHelloAgent"]` 추가. 이때 "작업 규칙"의 "hello.ts는 파일을 삭제하지 않는다" 문구도 함께 갱신한다.
- 질문 복사 형식
- 원문 강조(형광) 번짐
- 판정 안정성: 같은 피드백에 다른 판정이 나오는 경우
