// Offline checks that never call a model: prompt rendering, assemble()'s
// code-filled fields, the usage budget, and the sentence cap on /api/analyze
// (through app.request with a counter stub that refuses every reservation).
// Run after changing src/analysis or src/usage.
//
// Usage (in hoksiyo-backend/):
//   node --experimental-strip-types scripts/offline-check.mts
// Update the expected values here when wrangler.jsonc vars change.

import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import app from '../src/app.ts';
import { assemble } from '../src/analysis/assemble.ts';
import { LlmAnalysisSchema } from '../src/analysis/llm-schema.ts';
import { buildAnalysisPrompt } from '../src/analysis/prompt.ts';
import { splitSentences } from '../src/analysis/sentences.ts';
import { validate } from '../src/analysis/validate.ts';
import { charge, maxSentences, readUsageConfig, worstCase } from '../src/usage/budget.ts';

const VARS = {
	DAILY_NEURON_LIMIT: '9000',
	USAGE_WORST_BASE: '1800',
	USAGE_WORST_PER_SENTENCE: '400',
	USAGE_CORRECTION_FACTOR: '1.0',
	MAX_SENTENCES: '12',
};

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
let ok = true;
function check(label: string, cond: boolean): void {
	console.log(cond ? 'OK  ' : 'FAIL', label);
	ok &&= cond;
}

// 1. Prompt: sender line, no model-extracted context.
const t01 = buildAnalysisPrompt(cases.T01);
check('prompt has no feedback_context / 프로젝트 설명', !t01.includes('feedback_context') && !t01.includes('프로젝트 설명'));
check('T01 전달자: 편집자', t01.includes('전달자: 편집자'));
check('T06 전달자: 알 수 없음', buildAnalysisPrompt(cases.T06).includes('전달자: 알 수 없음'));
check('blank sender → 알 수 없음', buildAnalysisPrompt({ ...cases.T01, sender: '  ' }).includes('전달자: 알 수 없음'));
check('prompt has no "열려 있"', !t01.includes('열려 있'));

// 2. assemble + validate on a T01-like LLM output.
const llm = v.parse(LlmAnalysisSchema, {
	analysis: { input_type: 'revision_feedback', summary: '요약' },
	items: [
		{
			original_text: [3],
			request: '저자 이름 축소',
			requester: '편집자',
			requester_status: 'identified',
			interpretations: [],
			confidence: 'medium',
			confidence_reason: '정도가 정해지지 않았고 이전 피드백이 없음',
			status: 'needs_confirmation',
			prior_feedback_reference: 'not_provided',
			questions: ['질문?'],
		},
	],
	validation: { unmatched_text: [], non_request_text: [1, 2], missing_information: ['이전 피드백'], notes: [] },
});
const a1 = assemble(cases.T01, llm);
check(
	'T01 context and project.name from input',
	a1.feedback_context.sender === '편집자' && a1.feedback_context.channel === 'email' && a1.project.name === '《밤의 정원》 표지',
);
const a6 = assemble(cases.T06, llm);
check('T06 context unknown', a6.feedback_context.sender === 'unknown' && a6.feedback_context.channel === 'unknown');
check('T02 messenger', assemble(cases.T02, llm).feedback_context.channel === 'messenger');
check('validate: no errors on the T01 sample', validate(a1, cases.T01).errors.length === 0);
const stray = v.safeParse(LlmAnalysisSchema, { ...llm, feedback_context: { channel: 'x', sender: 'y' } });
check('stray feedback_context from the model is dropped', stray.success && !('feedback_context' in stray.output));

// 3. Budget.
const config = readUsageConfig(VARS);
check('budget.ts defaults equal wrangler.jsonc vars', JSON.stringify(config) === JSON.stringify(readUsageConfig({})));
console.log('     W(n):', [1, 2, 3, 4, 12].map((n) => `${n}=${worstCase(n, config)}`).join(' '));
check('W = 2200/2600/3000/3400, W(12) = 6600', [1, 2, 3, 4, 12].map((n) => worstCase(n, config)).join() === '2200,2600,3000,3400,6600');
check('maxSentences = 12', maxSentences(config) === 12);
check('a lower limit still caps sentences (3000 → 3)', maxSentences(readUsageConfig({ ...VARS, DAILY_NEURON_LIMIT: '3000' })) === 3);
let threw = false;
try {
	readUsageConfig({ ...VARS, MAX_SENTENCES: '0' });
} catch {
	threw = true;
}
check('MAX_SENTENCES=0 is rejected', threw);
// Measured charge (correction 1.0) against the dashboard: 616.39 + 1,055.17 on 2026-11-07.
let measured = 0;
for (const [file, sentences] of [['T04-low-1.json', 1], ['T01-low-1.json', 3]] as const) {
	const d = JSON.parse(readFileSync(new URL(`../experiments/2026-11-07-thinking-low/${file}`, import.meta.url), 'utf8'));
	measured += charge({
		sentences,
		config,
		analysisModel: '@cf/zai-org/glm-5.3',
		mainTurnModel: '@cf/zai-org/glm-4.7-flash',
		finished: true,
		harnessUsage: d.meta.usage,
		mainTurnUsage: d.reply_metadata.response_usage,
		elapsedMs: d.meta.duration_ms,
	}).neurons;
}
check(`measured charge matches dashboard (${measured.toFixed(2)} ≈ 1671.56)`, Math.abs(measured - 1671.56) < 0.1);
const timeout = charge({
	sentences: 3,
	config,
	analysisModel: '@cf/zai-org/glm-5.3',
	mainTurnModel: '@cf/zai-org/glm-4.7-flash',
	finished: false,
	elapsedMs: 180_000,
});
check(`180s timeout charged by elapsed estimate (${timeout.neurons.toFixed(0)})`, timeout.basis === 'elapsed_estimate');

// 4. Sentence cap on the route: 12 reaches the reservation (refused → 429), 13 is a 400.
let reserves = 0;
const status = { date: 'd', used: 0, reserved: 0, limit: 9000, resets_at: 'r' };
const stub = {
	fetch: async (url: string) => {
		if (new URL(url).pathname === '/reserve') {
			reserves++;
			return Response.json({ ...status, ok: false });
		}
		return Response.json(status);
	},
};
const env = { ...VARS, USAGE_COUNTER: { idFromName: () => 'id', get: () => stub } };
for (const n of [12, 13]) {
	const feedback = Array.from({ length: n }, (_, i) => `문장${i + 1}입니다.`).join(' ');
	const res = await app.request(
		'/api/analyze',
		{ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project_name: 'x', feedback }) },
		env,
	);
	const body = (await res.json()) as { error?: string; max?: number };
	if (n === 12) {
		check(`12 sentences (split ${splitSentences(feedback).length}) pass the cap → 429 daily_limit`, res.status === 429 && body.error === 'daily_limit');
	} else {
		check('13 sentences → 400 too_many_sentences, max 12', res.status === 400 && body.error === 'too_many_sentences' && body.max === 12);
	}
}
check('reserve called only for 12', reserves === 1);

// 5. Strict input: the removed experiment fields are unknown now, refused before any reservation.
for (const extra of [{ mode: 'C' }, { model: '@cf/zai-org/glm-5.3' }]) {
	const res = await app.request(
		'/api/analyze',
		{ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project_name: 'x', feedback: '문장입니다.', ...extra }) },
		env,
	);
	const body = (await res.json()) as { error?: string };
	check(`unknown field ${Object.keys(extra)[0]} → 400 invalid_input`, res.status === 400 && body.error === 'invalid_input');
}
check('reserve not called for unknown fields', reserves === 1);

console.log(ok ? 'ALL OK' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
