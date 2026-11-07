# CLAUDE.md — 혹시요

## 프로젝트 개요
'혹시요'는 프리랜서 일러스트레이터가 받은 수정 피드백(텍스트)을 분석해
작업 목록, 확인 필요 항목, 확인 질문을 JSON으로 만들어 주는 에이전트다.
백엔드와 프론트엔드는 각각 독립된 Cloudflare Worker로 동작한다.

- 백엔드: Flue 2.3 + Hono + Workers AI (Durable Objects)
- 프론트엔드: React 19 + Vite + Cloudflare Worker
- 현재 상태: 백엔드에는 예제 `Hello` 에이전트만 있음. 분석 에이전트는 아직 없음.
  프론트엔드는 Cloudflare React 템플릿 그대로이고 백엔드와 연결되어 있지 않음.

## 폴더 구조
```
01-hoksiyo/                 # git 루트는 상위 폴더(AXS-Challenges)
├── docs/                   # 기획·명세 문서 (아래 "문서 안내")
├── hoksiyo-backend/
│   ├── src/app.ts          # Hono 라우트 맵. 모든 라우트를 여기서 명시적으로 mount
│   ├── src/agents/         # 'use agent' 모듈. 대문자로 시작하는 export 함수 = 에이전트
│   ├── src/cloudflare.ts   # Worker 레벨 export (DO 클래스, cron 등)
│   ├── wrangler.jsonc      # AI 바인딩, DO migrations
│   ├── flue.config.ts      # target: cloudflare
│   └── AGENTS.md           # Flue 프로젝트 규칙
└── hoksiyo-frontend/
    ├── src/                # React 앱
    ├── worker/index.ts     # 프론트 Worker (현재 /api/ 더미 응답)
    └── wrangler.jsonc
```

## 실행 명령어
각 폴더에서 실행한다.

| 목적 | hoksiyo-backend | hoksiyo-frontend |
|---|---|---|
| 개발 서버 | `npm run dev` (http://localhost:5173) | `npm run dev` |
| 타입 체크 | `npm run check:types` | `npx tsc -b` |
| 린트 | 없음 (확인 필요) | `npm run lint` (oxlint) |
| 테스트 | 없음 (테스트 러너 미설정, 확인 필요) | 없음 (확인 필요) |
| 빌드 / 배포 | `npm run build` / `npm run deploy` | `npm run build` / `npm run deploy` |

- 백엔드 에이전트 호출 예시는 `hoksiyo-backend/README.md`에 있다.
- `cloudflare/...` 모델은 Worker 안에서만 동작한다. `npx flue run`은 쓰지 말고 `npm run dev` + curl로 테스트한다.
- Workers AI는 로컬 개발 중에도 실제 Cloudflare 계정으로 요청이 나간다 (`npx wrangler login` 필요).
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
  (`src/agents/hello.ts`의 `useModel` 값은 예제 에이전트 전용이다.)
- Valibot은 직접 의존성이 아니다(@flue/runtime의 간접 의존성). 직접 import하려면 먼저 package.json에 추가할지 확인한다.
- 변경 후에는 해당 폴더의 타입 체크를 실행하고, 프론트엔드라면 린트도 실행한다.
- 이미지 분석, 답장 작성·전송, 견적 판단, 피드백 저장·자동 대조는 MVP 범위 밖이다 (`product-spec.md` 4-6).
  단, 사용자가 입력한 이전 피드백과의 대조(`prior_feedback_reference`)는 범위 안이다.
- `.env`, `.dev.vars`는 커밋하지 않는다. 커밋과 push는 사용자가 요청할 때만 한다.

## 확인 필요
- 테스트 러너(예: vitest)와 백엔드 린트 도입 여부
- 프론트엔드에서 백엔드를 호출하는 방식 (service binding, 직접 fetch, CORS)
- 분석 에이전트의 출력 형식을 강제하는 방법 (Flue 구조화 출력 기능 여부. `npx flue docs`로 확인)
- 백엔드와 프론트엔드 개발 서버를 동시에 띄울 때 포트(5173) 충돌 여부
