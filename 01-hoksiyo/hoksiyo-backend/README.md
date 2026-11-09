# hoksiyo-backend

A [Flue](https://flueframework.com) agent project.

## Setup

```sh
npm install
```

No API key needed: the analysis agent uses Workers AI models (`src/analysis/models.ts`) through the `AI` binding in `wrangler.jsonc`. Log in with `npx wrangler login`; the binding reaches your Cloudflare account even in local dev.

`@earendil-works/pi-*` is pinned to 1.4.0 via `overrides` in `package.json` — 1.5.0 breaks `@flue/runtime` 2.3.0.

## Analyze feedback

The keyless `cloudflare/` provider only exists inside the Worker, so `flue run` (plain Node) can't use it. Start the dev server and post one analysis:

```sh
npm run dev
curl -X POST http://localhost:5173/api/analyze \
  -H 'content-type: application/json' \
  -d '{"project_name":"《밤의 정원》 표지","sender":"편집자","channel":"email","feedback":"저자 이름만 조금 작게 해주세요."}'
curl http://localhost:5173/api/usage   # today's Neurons usage and limit
```

Each call spends real Workers AI Neurons, also in local dev. `/api/analyze` reserves against a daily budget first (`src/usage/`, limits in `wrangler.jsonc` `vars`, override locally in `.env`) and answers `429` once the day's limit is reached, `400` for feedback over 1,000 characters or too many sentences.

## Test scripts

`scripts/` holds the test tools (run them from this folder; details in each file's header):

```sh
# No model calls: prompt, assemble, budget, sentence cap. Run after changing src/analysis or src/usage.
node --experimental-strip-types scripts/offline-check.mts

# T01–T10 from docs/test-cases.md (inputs: scripts/cases.json). Needs `npm run dev`; spends Neurons.
node --experimental-strip-types scripts/run-cases.mts experiments/2026-11-10-integration          # all 10
node --experimental-strip-types scripts/run-cases.mts experiments/2026-11-10-integration T10 T04  # some
node --experimental-strip-types scripts/summarize.mts experiments/2026-11-10-integration
```

`run-cases.mts` checks `/api/usage` before each case and skips the ones whose reservation would not fit today (run them after 00:00 UTC); it stops on a Workers AI 429, a billing error, or a timeout. All 10 cost about 4,000 Neurons, so they usually do not fit in one day together with other runs.

## Develop

```sh
npm run dev
```

The analysis API is served at `http://localhost:5173/api/analyze` — see `src/app.ts` for the route map. No agent router is mounted; every model call goes through the usage counter.

## Deploy

```sh
npm run deploy
```

## Learn more

- [Flue docs](https://flueframework.com/docs/) — or `npx flue docs` from the terminal.
