# 01-hoksiyo

Cloudflare Workers 위에서 동작하는 AI 에이전트 프로젝트입니다. 백엔드와 프론트엔드가 각각 독립된 Worker로 구성되어 있습니다.

| 폴더 | 내용 | 스택 |
| --- | --- | --- |
| [`hoksiyo-backend/`](hoksiyo-backend/) | AI 에이전트 서버 | [Flue](https://flueframework.com), Hono, Workers AI, Durable Objects |
| [`hoksiyo-frontend/`](hoksiyo-frontend/) | 웹 화면 | React 19, Vite, Cloudflare Workers |

> 현재 프론트엔드는 Cloudflare React 템플릿 상태이며, 아직 백엔드 에이전트와 연결되어 있지 않습니다.

## 준비물

- Node.js, npm
- Cloudflare 계정 로그인: `npx wrangler login`
  (Workers AI는 로컬 개발 중에도 내 Cloudflare 계정으로 요청이 나갑니다.)

## 백엔드: `hoksiyo-backend`

`Hello` 에이전트가 Workers AI 모델 `@cf/zai-org/glm-4.7-flash`를 사용합니다. `wrangler.jsonc`의 `AI` 바인딩을 통해 호출하므로 API 키가 필요 없습니다.

```sh
cd hoksiyo-backend
npm install
npm run dev
```

에이전트에게 메시지 보내기 (`my-first-chat` 자리에 아무 대화 ID나 사용):

```sh
curl -X POST http://localhost:5173/agents/hello/my-first-chat \
  -H 'content-type: application/json' \
  -d '{"kind":"user","body":"Say hello!"}'

# 대화 내용 확인
curl http://localhost:5173/agents/hello/my-first-chat
```

주의할 점:

- `cloudflare/...` 모델은 Worker 안에서만 동작하므로 `npx flue run`(Node 환경)으로는 실행되지 않습니다. `npm run dev`로 테스트하세요.
- `@cf/zai-org/glm-5.3-flash`처럼 Workers Free 플랜에서 막힌 모델은 403 오류가 납니다.
- `@earendil-works/pi-*` 패키지는 `package.json`의 `overrides`로 1.4.0에 고정되어 있습니다. 1.5.0은 `@flue/runtime` 2.3.0과 호환되지 않습니다.
- 에이전트를 추가할 때는 `wrangler.jsonc`의 `migrations`에 Durable Object 클래스(예: `FlueHelloAgent`)를 새 태그로 추가해야 합니다.

## 프론트엔드: `hoksiyo-frontend`

```sh
cd hoksiyo-frontend
npm install
npm run dev
```

Worker 코드는 `worker/index.ts`, React 앱은 `src/`에 있습니다.

## 배포

각 폴더에서 실행합니다.

```sh
npm run deploy
```
