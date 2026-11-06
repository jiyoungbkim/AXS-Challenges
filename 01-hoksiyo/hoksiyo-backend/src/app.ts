import { init } from '@flue/runtime';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import * as v from 'valibot';
import { AnalyzeFeedback } from './agents/analyze-feedback.ts';
import { Hello } from './agents/hello.ts';

const app = new Hono();

// The route map: every agent, channel, and custom route is mounted here
// explicitly. Talk to Hello with one POST per message:
//
//   curl -X POST http://localhost:5173/agents/hello/my-first-chat \
//     -H 'content-type: application/json' \
//     -d '{"kind":"user","body":"Tell me a joke."}'
app.route('/agents/hello', createAgentRouter(Hello));

// 실험용, 배포 전 제거
app.route('/agents/analyze-feedback', createAgentRouter(AnalyzeFeedback));

// One analysis per request: a fresh instance, then wait for its reply.
app.post('/api/analyze', async (c) => {
	const parsed = v.safeParse(AnalyzeFeedback.initialData, await c.req.json());
	if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.issues.map((i) => i.message) }, 400);
	const handle = init(AnalyzeFeedback);
	const receipt = await handle.dispatch({ message: 'analyze', initialData: parsed.output });
	const reply = await handle.read(receipt);
	return c.json({
		analysis: reply.data.analysis?.at(-1) ?? null,
		meta: reply.data.analysis_meta?.at(-1) ?? null,
		reply_text: reply.text, // 실험용, 배포 전 제거
	});
});

export default app;
