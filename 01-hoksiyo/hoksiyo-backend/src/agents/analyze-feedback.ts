'use agent';
import {
	ResultUnavailableError,
	useAgentStart,
	useDataWriter,
	useInitialData,
	useModel,
	useResponseFinish,
	type FlueHarness,
	type PromptUsage,
} from '@flue/runtime';
import * as v from 'valibot';
import { assemble, type AnalysisResult } from '../analysis/assemble.ts';
import { buildResultSchema, type Judgment } from '../analysis/llm-schema.ts';
import { ANALYSIS_MODEL, ANALYSIS_THINKING, cloudflareModel, MAIN_TURN_MODEL, type Thinking } from '../analysis/models.ts';
import { buildAnalysisPrompt } from '../analysis/prompt.ts';
import { findMisquotes, validate, type AnalysisInput, type ValidationError } from '../analysis/validate.ts';

const MAX_FAILED_FINISH_CALLS = 3;
const HARNESS_TIMEOUT_MS = 180_000;

type Outcome = 'finished' | 'no_finish' | 'give_up' | 'aborted' | 'timeout' | 'error';

interface Attempt {
	n: number;
	errors: ValidationError[];
	// Item judgments as submitted, before any rejection; null when the base schema failed.
	judgments: Judgment[] | null;
}

interface AnalysisMeta {
	model: string;
	thinking: Thinking;
	outcome: Outcome;
	outcome_detail?: string;
	attempts: Attempt[];
	final_errors: ValidationError[];
	warnings: string[];
	usage?: PromptUsage;
	usage_unavailable?: boolean;
	duration_ms: number;
}

interface RunResult {
	analysis?: AnalysisResult;
	meta: Omit<AnalysisMeta, 'model' | 'thinking' | 'duration_ms'>;
}

interface ModelOptions {
	model: string;
	thinkingLevel: Thinking;
}

function finalize(input: AnalysisInput, analysis: AnalysisResult | undefined, meta: RunResult['meta']): RunResult {
	if (!analysis) return { meta };
	const report = validate(analysis, input);
	// Worker log for counting misquotes in deploys: the kind and field only,
	// never the quote, the feedback, or the project name.
	for (const { field } of findMisquotes(analysis, input)) {
		console.log(JSON.stringify({ event: 'analysis_warning', kind: 'misquote', field }));
	}
	return { analysis, meta: { ...meta, final_errors: report.errors, warnings: report.warnings } };
}

// C: harness.prompt with a result schema; invariants are checked in the finish tool.
async function runResultMode(harness: FlueHarness, input: AnalysisInput, options: ModelOptions): Promise<RunResult> {
	const attempts: Attempt[] = [];
	let failed = 0;
	let aborted = false;
	const timeout = AbortSignal.timeout(HARNESS_TIMEOUT_MS);
	const call = harness.prompt(buildAnalysisPrompt(input), {
		...options,
		signal: timeout,
		result: buildResultSchema(input, (errors, judgments) => {
			attempts.push({ n: attempts.length + 1, errors, judgments });
			if (errors.length > 0 && ++failed > MAX_FAILED_FINISH_CALLS) {
				aborted = true;
				call.abort();
			}
		}),
	});
	const base = { attempts, final_errors: [], warnings: [] };
	try {
		const response = await call;
		return finalize(input, assemble(input, response.data), { ...base, outcome: 'finished', usage: response.usage });
	} catch (error) {
		if (aborted) {
			return { meta: { ...base, outcome: 'aborted', outcome_detail: `finish 검증 실패 ${failed}회`, usage_unavailable: true } };
		}
		if (timeout.aborted) {
			return { meta: { ...base, outcome: 'timeout', outcome_detail: `harness ${HARNESS_TIMEOUT_MS / 1000}초 초과`, usage_unavailable: true } };
		}
		if (error instanceof ResultUnavailableError) {
			// Flue 2.3.0 internal wording for an exhausted follow-up loop; may change between versions.
			const noFinish = error.message.startsWith('Agent did not call `finish`');
			return { meta: { ...base, outcome: noFinish ? 'no_finish' : 'give_up', outcome_detail: error.message } };
		}
		return { meta: { ...base, outcome: 'error', outcome_detail: String(error) } };
	}
}

export function AnalyzeFeedback() {
	useModel(cloudflareModel(MAIN_TURN_MODEL));
	const writeAnalysis = useDataWriter('analysis');
	const writeMeta = useDataWriter('analysis_meta');
	const input = useInitialData<AnalysisInput>();

	useAgentStart(async ({ harness }) => {
		const startedAt = Date.now();
		const options: ModelOptions = { model: cloudflareModel(ANALYSIS_MODEL), thinkingLevel: ANALYSIS_THINKING };
		const run = await runResultMode(harness, input, options);
		if (run.analysis) writeAnalysis(run.analysis);
		writeMeta({
			model: ANALYSIS_MODEL,
			thinking: ANALYSIS_THINKING,
			...run.meta,
			duration_ms: Date.now() - startedAt,
		} satisfies AnalysisMeta);
	});

	// 정식 기능: 사용량 카운터용. Records the main turn's own usage; app.ts charges it to the daily budget.
	useResponseFinish(({ response }) => ({ response_usage: response.usage }));

	// The harness shares this system prompt, so it stays neutral. The "reply 완료"
	// instruction travels in the dispatched message, which the harness never sees.
	return '너는 수정 피드백 분석 에이전트 혹시요다.';
}

// The 180s harness signal is the real bound: timeoutMs is only checked between
// turns, so it backstops the whole submission including the main turn.
AnalyzeFeedback.durability = { maxAttempts: 2, timeoutMs: 240_000 };

// Strict: an unknown field is a 400 invalid_input before any reservation.
AnalyzeFeedback.initialData = v.strictObject({
	project_name: v.string(),
	sender: v.optional(v.string()),
	channel: v.optional(v.picklist(['email', 'messenger', 'document'])),
	feedback: v.string(),
	prior_feedback: v.optional(v.string()),
});
