# hoksiyo-backend

A [Flue](https://flueframework.com) agent project.

## Setup

```sh
npm install
```

No API key needed: the Hello agent uses the Workers AI model `@cf/zai-org/glm-5.3-flash` through the `AI` binding in `wrangler.jsonc`. Log in with `npx wrangler login`; the binding reaches your Cloudflare account even in local dev.

`@earendil-works/pi-*` is pinned to 1.4.0 via `overrides` in `package.json` — 1.5.0 breaks `@flue/runtime` 2.3.0.

## Talk to your agent

The keyless `cloudflare/` provider only exists inside the Worker, so `flue run` (plain Node) can't use it. Start the dev server and post a message:

```sh
npm run dev
curl -X POST http://localhost:5173/agents/hello/my-first-chat \
  -H 'content-type: application/json' \
  -d '{"kind":"user","body":"Say hello!"}'
curl http://localhost:5173/agents/hello/my-first-chat   # read the conversation
```

## Develop

```sh
npm run dev
```

The Hello agent is served at `http://localhost:5173/agents/hello` — see `src/app.ts` for the route map and an example request.

## Deploy

```sh
npm run deploy
```

## Learn more

- [Flue docs](https://flueframework.com/docs/) — or `npx flue docs` from the terminal.
