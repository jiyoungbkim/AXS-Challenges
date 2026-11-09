# 혹시요

프리랜서 일러스트레이터가 받은 수정 피드백을 작업 목록으로 정리하고, 의도가 불분명한 항목은 "혹시 이런 뜻인가요?" 하고 되물을 질문까지 만들어 주는 AI 에이전트입니다.

## 누구를 위한 에이전트인가요

단행본 표지와 삽화를 혼자 작업하는 프리랜서 일러스트레이터를 위한 에이전트입니다.

- 보통 3~4개 프로젝트를 동시에 진행하고, 출판사 편집자·독립출판 작가 등 여러 의뢰인에게서 메일·메신저로 수정 피드백을 받습니다.
- 가장 소모되는 일은 그림 작업이 아니라 피드백 해석입니다. "쓸쓸한 느낌이 더 났으면 좋겠어요" 같은 표현을 구체적인 작업으로 바꾸고, 되물을지 감으로 진행할지 고민하는 과정입니다.
- 잘못 해석하고 진행하면 수정 라운드를 통째로 다시 하게 됩니다.

## 어떤 업무를 대신하나요

피드백 원문을 붙여 넣으면 다음을 대신합니다.

1. **요청 분리:** 여러 요청이 섞인 피드백을 항목별로 나누고, 각 항목에 근거가 된 원문 문장을 연결합니다.
2. **확신도와 착수 가능 여부 판정:** 항목마다 해석의 확신도(높음·중간·낮음)를 판정하고, 바로 작업해도 되는지와 의뢰인 확인이 필요한지를 따로 판정합니다.
3. **확인 질문 생성:** 확인이 필요한 항목에는 선택지가 있는 질문을 만듭니다.
4. **요청 출처 표시:** 의뢰인 본인의 의견인지, 마케팅팀 등 제3자의 요구를 전달한 것인지 표시합니다.

질문을 다듬어 보내는 일은 사용자가 직접 합니다. 핵심 원칙은 **모르는 내용을 추측해서 단정하지 않고, 판단이 어려운 항목은 사용자에게 넘기는 것**입니다.

## 진행 상황 (2026-11-09 기준)

### 지금 되는 것
- 분석 에이전트: 테스트 피드백 10건(T01~T10) 통합 테스트 통과
- 웹 화면: 프로젝트명과 피드백을 입력하면 작업 목록, 확인 필요 항목, 확인 질문을 보여 줌
- 배포: Cloudflare Workers에 접속 코드가 필요한 비공개 테스트 버전으로 배포
- 사용량 한도: 하루 Workers AI 사용량 상한을 두고, 넘으면 분석 요청을 거절

### 아직 안 되는 것
- 실제 사용자 테스트 전 (11/12~15 예정)
- 같은 피드백을 반복 분석했을 때 판정이 얼마나 일정한지 미검증
- 화면 다듬기: 질문 복사 형식, 원문 강조 표시
- MVP 범위 밖: 이미지·시안 위 피드백 분석, 피드백 기록 저장과 자동 대조, 답장 작성·전송, 메일·메신저 자동 수집

## 구성

백엔드와 프론트엔드가 각각 독립된 Cloudflare Worker로 구성되어 있습니다. 브라우저는 프론트 Worker에만 접속하고, 프론트 Worker가 service binding으로 백엔드를 호출합니다. 백엔드에는 공개 URL이 없습니다.

| 폴더 | 내용 | 스택 |
| --- | --- | --- |
| [`hoksiyo-backend/`](hoksiyo-backend/) | AI 에이전트 서버 | [Flue](https://flueframework.com), Hono, Workers AI, Durable Objects |
| [`hoksiyo-frontend/`](hoksiyo-frontend/) | 웹 화면 | React 19, Vite, Cloudflare Workers |

## 준비물

- Node.js, npm
- Cloudflare 계정 로그인: `npx wrangler login`
  (Workers AI는 로컬 개발 중에도 내 Cloudflare 계정으로 요청이 나갑니다.)
- **Workers Paid 플랜:** 분석 모델 `@cf/zai-org/glm-5.3`은 Workers Free 플랜에서 막혀 있어 403 오류가 납니다.

## 백엔드: `hoksiyo-backend`

분석 에이전트 `AnalyzeFeedback`이 Workers AI 모델 `@cf/zai-org/glm-5.3`을 사용합니다. `wrangler.jsonc`의 `AI` 바인딩을 통해 호출하므로 API 키가 필요 없습니다.

```sh
cd hoksiyo-backend
npm install
npm run dev   # http://localhost:5173
```

로컬에서 분석 요청 보내기 (실제 Neurons를 씁니다):

```sh
curl -X POST http://localhost:5173/api/analyze \
  -H 'content-type: application/json' \
  -d '{"project_name":"《밤의 정원》 표지","sender":"편집자","channel":"email","feedback":"저자 이름만 조금 작게 해주세요."}'

# 오늘 사용량과 한도 확인
curl http://localhost:5173/api/usage
```

주의할 점:

- `cloudflare/...` 모델은 Worker 안에서만 동작하므로 `npx flue run`(Node 환경)으로는 실행되지 않습니다. `npm run dev`로 테스트하세요.
- `@earendil-works/pi-*` 패키지는 `package.json`의 `overrides`로 1.4.0에 고정되어 있습니다. 1.5.0은 `@flue/runtime` 2.3.0과 호환되지 않습니다.
- 에이전트를 추가할 때는 `wrangler.jsonc`의 `migrations`에 Durable Object 클래스(예: `FlueHelloAgent`)를 새 태그로 추가해야 합니다.
- 테스트 스크립트와 자세한 내용은 [`hoksiyo-backend/README.md`](hoksiyo-backend/README.md)에 있습니다.

## 프론트엔드: `hoksiyo-frontend`

```sh
cd hoksiyo-frontend
npm install
npm run dev   # http://localhost:5174
```

Worker 코드는 `worker/`, React 앱은 `src/`에 있습니다. 실제 분석까지 확인하려면 백엔드 개발 서버도 함께 띄웁니다.

로컬 설정은 `hoksiyo-frontend/.dev.vars`에 둡니다. 이 파일은 커밋하지 않습니다.

| 키 | 파일 | 용도 |
| --- | --- | --- |
| `ACCESS_CODE` | `hoksiyo-frontend/.dev.vars` | 화면에 들어갈 때 입력하는 접속 코드 |
| `MOCK_ANALYZE` | `hoksiyo-frontend/.dev.vars` | `1`이면 백엔드 대신 `worker/fixtures.ts`의 mock 응답을 돌려줌(Neurons 안 씀), `0`이면 백엔드 호출 |

백엔드는 `.dev.vars`가 필요 없습니다.

## 배포

각 폴더에서 실행합니다. 백엔드를 먼저 배포합니다.

```sh
npm run deploy
```

배포 환경의 접속 코드는 프론트 폴더에서 `npx wrangler secret put ACCESS_CODE`로 설정합니다. `MOCK_ANALYZE`는 배포 환경에 설정하지 않습니다.
