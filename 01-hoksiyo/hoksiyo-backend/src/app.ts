import { AgentRunError, init } from '@flue/runtime';
import { Hono } from 'hono';
import * as v from 'valibot';
import { AnalyzeFeedback } from './agents/analyze-feedback.ts';
import { ANALYSIS_MODEL, MAIN_TURN_MODEL } from './analysis/models.ts';
import { splitSentences } from './analysis/sentences.ts';
import { charge, maxSentences, readUsageConfig, worstCase, type TokenUsage, type UsageEnv } from './usage/budget.ts';
import { usageCounter, type DurableObjectNamespaceLike } from './usage/usage-counter.ts';

type Bindings = UsageEnv & { USAGE_COUNTER: DurableObjectNamespaceLike };

const MAX_FEEDBACK_LENGTH = 1_000;

const app = new Hono<{ Bindings: Bindings }>();

// The route map: every agent, channel, and custom route is mounted here
// explicitly. No agent router is mounted: every model call goes through
// /api/analyze so it is counted against the daily Neurons budget.

app.get('/api/usage', async (c) => {
	const config = readUsageConfig(c.env);
	return c.json(await usageCounter(c.env.USAGE_COUNTER).status(config.dailyLimit));
});

// One analysis per request: a fresh instance, then wait for its reply.
app.post('/api/analyze', async (c) => {
	const parsed = v.safeParse(AnalyzeFeedback.initialData, await c.req.json());
	if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.issues.map((i) => i.message) }, 400);
	const input = parsed.output;
	if (input.feedback.length > MAX_FEEDBACK_LENGTH) {
		return c.json(
			{ error: 'feedback_too_long', message: `피드백 원문은 ${MAX_FEEDBACK_LENGTH}자까지 분석할 수 있습니다.`, max: MAX_FEEDBACK_LENGTH, length: input.feedback.length },
			400,
		);
	}

	const config = readUsageConfig(c.env);
	const counter = usageCounter(c.env.USAGE_COUNTER);
	const sentences = splitSentences(input.feedback).length;
	// Over the cap or too long for any day, even an empty one: not a daily-limit problem.
	const max = maxSentences(config);
	if (sentences > max) {
		return c.json(
			{ error: 'too_many_sentences', message: `한 번에 ${max}문장까지 분석할 수 있습니다. 피드백을 나눠서 보내 주세요.`, max, sentences },
			400,
		);
	}
	const reservation = await counter.reserve(worstCase(sentences, config), config.dailyLimit);
	if (!reservation.ok) {
		return c.json(
			{
				error: 'daily_limit',
				message: '오늘 분석 한도에 도달했습니다.',
				used: reservation.used,
				reserved: reservation.reserved,
				limit: reservation.limit,
				resets_at: reservation.resets_at,
			},
			429,
		);
	}

	const analysisModel = input.model ?? ANALYSIS_MODEL;
	const startedAt = Date.now();
	let finished = false;
	let harnessUsage: TokenUsage | undefined;
	let mainTurnUsage: TokenUsage | undefined;
	let body: Record<string, unknown>;
	let status: 200 | 504 = 200;
	let usage: { neurons: number; basis: string } | undefined;
	try {
		const handle = init(AnalyzeFeedback);
		// The analysis runs in useAgentStart; this message only steers the main turn.
		const receipt = await handle.dispatch({
			message: "분석은 이미 완료되었습니다. '완료'라고만 답하세요.",
			initialData: input,
		});
		try {
			const reply = await handle.read(receipt);
			const meta = (reply.data.analysis_meta?.at(-1) ?? null) as { outcome?: string; usage?: TokenUsage } | null;
			finished = meta?.outcome === 'finished';
			harnessUsage = meta?.usage;
			mainTurnUsage = (reply.metadata as { response_usage?: TokenUsage } | undefined)?.response_usage;
			body = {
				analysis: reply.data.analysis?.at(-1) ?? null,
				meta,
				reply_text: reply.text, // 실험용, 배포 전 제거
				reply_metadata: reply.metadata ?? null, // 실험용, 배포 전 제거
			};
		} catch (error) {
			// The submission itself failed (e.g. the 240s durability timeout), so no meta was written.
			if (!(error instanceof AgentRunError)) throw error;
			status = 504;
			body = {
				analysis: null,
				meta: null,
				error: { outcome: error.outcome, message: error.message, submissionId: error.submissionId },
			};
		}
	} finally {
		// Always settle the reservation, also when the request throws.
		const spent = charge({
			sentences,
			config,
			analysisModel,
			mainTurnModel: MAIN_TURN_MODEL,
			finished,
			harnessUsage,
			mainTurnUsage,
			elapsedMs: Date.now() - startedAt,
		});
		await counter.commit(reservation.ticket, spent.neurons);
		usage = { neurons: Math.round(spent.neurons), basis: spent.basis };
	}
	const daily = await counter.status(config.dailyLimit);
	return c.json(
		{ ...body, usage: { ...usage, daily_used: Math.round(daily.used), daily_limit: daily.limit } },
		status,
	);
});

export default app;
