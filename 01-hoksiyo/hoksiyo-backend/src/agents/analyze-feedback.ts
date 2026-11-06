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
import { buildResultSchema, LlmAnalysisSchema } from '../analysis/llm-schema.ts';
import { buildAnalysisPrompt, buildRetryPrompt, TEXT_MODE_SUFFIX } from '../analysis/prompt.ts';
import { splitSentences } from '../analysis/sentences.ts';
import { issuesToErrors, validate, validateRefs, type AnalysisInput, type ValidationError } from '../analysis/validate.ts';

const MAX_FAILED_FINISH_CALLS = 3;
const HARNESS_TIMEOUT_MS = 180_000;

type Mode = 'C' | 'B';
type Outcome = 'finished' | 'no_finish' | 'give_up' | 'aborted' | 'timeout' | 'error';

interface Attempt {
	n: number;
	errors: ValidationError[];
}

interface AnalysisMeta {
	mode: Mode;
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
	meta: Omit<AnalysisMeta, 'mode' | 'duration_ms'>;
}

type AnalyzeFeedbackInput = AnalysisInput & { mode: Mode };

function finalize(input: AnalysisInput, analysis: AnalysisResult | undefined, meta: RunResult['meta']): RunResult {
	if (!analysis) return { meta };
	const report = validate(analysis, input);
	return { analysis, meta: { ...meta, final_errors: report.errors, warnings: report.warnings } };
}

// C: harness.prompt with a result schema; invariants are checked in the finish tool.
async function runResultMode(harness: FlueHarness, input: AnalysisInput): Promise<RunResult> {
	const attempts: Attempt[] = [];
	let failed = 0;
	let aborted = false;
	const timeout = AbortSignal.timeout(HARNESS_TIMEOUT_MS);
	const call = harness.prompt(buildAnalysisPrompt(input), {
		signal: timeout,
		result: buildResultSchema(input, (errors) => {
			attempts.push({ n: attempts.length + 1, errors });
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

function parseJson(text: string): unknown {
	const unfenced = text.replace(/```(?:json)?/g, '');
	const start = unfenced.indexOf('{');
	const end = unfenced.lastIndexOf('}');
	if (start === -1 || end <= start) throw new Error('JSON 객체를 찾지 못했습니다.');
	return JSON.parse(unfenced.slice(start, end + 1));
}

function checkText(input: AnalysisInput, text: string): { analysis?: AnalysisResult; errors: ValidationError[] } {
	let raw: unknown;
	try {
		raw = parseJson(text);
	} catch (error) {
		return { errors: [{ cond: 'parse', message: error instanceof Error ? error.message : String(error) }] };
	}
	const parsed = v.safeParse(LlmAnalysisSchema, raw);
	if (!parsed.success) return { errors: issuesToErrors(parsed.issues) };
	const refErrors = validateRefs(parsed.output, splitSentences(input.feedback).length);
	if (refErrors.length > 0) return { errors: refErrors };
	const analysis = assemble(input, parsed.output);
	return { analysis, errors: validate(analysis, input).errors };
}

function addUsage(a: PromptUsage | undefined, b: PromptUsage): PromptUsage {
	if (!a) return b;
	return {
		input: a.input + b.input,
		output: a.output + b.output,
		cacheRead: a.cacheRead + b.cacheRead,
		cacheWrite: a.cacheWrite + b.cacheWrite,
		totalTokens: a.totalTokens + b.totalTokens,
		cost: {
			input: a.cost.input + b.cost.input,
			output: a.cost.output + b.cost.output,
			cacheRead: a.cost.cacheRead + b.cost.cacheRead,
			cacheWrite: a.cost.cacheWrite + b.cost.cacheWrite,
			total: a.cost.total + b.cost.total,
		},
	};
}

// B: plain text JSON, parsed and validated in code, re-requested once on failure.
async function runTextMode(harness: FlueHarness, input: AnalysisInput): Promise<RunResult> {
	const attempts: Attempt[] = [];
	let usage: PromptUsage | undefined;
	// One budget for the first request and the retry together.
	const timeout = AbortSignal.timeout(HARNESS_TIMEOUT_MS);
	try {
		let response = await harness.prompt(buildAnalysisPrompt(input) + TEXT_MODE_SUFFIX, { signal: timeout });
		usage = addUsage(usage, response.usage);
		let checked = checkText(input, response.text);
		attempts.push({ n: 1, errors: checked.errors });
		if (checked.errors.length > 0) {
			response = await harness.prompt(buildRetryPrompt(checked.errors), { signal: timeout });
			usage = addUsage(usage, response.usage);
			checked = checkText(input, response.text);
			attempts.push({ n: 2, errors: checked.errors });
		}
		const outcome: Outcome = checked.errors.length === 0 ? 'finished' : 'aborted';
		return finalize(input, checked.analysis, { attempts, final_errors: checked.errors, warnings: [], outcome, usage });
	} catch (error) {
		const base = { attempts, final_errors: [], warnings: [], usage };
		if (timeout.aborted) {
			return { meta: { ...base, outcome: 'timeout', outcome_detail: `harness ${HARNESS_TIMEOUT_MS / 1000}초 초과` } };
		}
		return { meta: { ...base, outcome: 'error', outcome_detail: String(error) } };
	}
}

export function AnalyzeFeedback() {
	useModel('cloudflare/@cf/zai-org/glm-4.7-flash');
	const writeAnalysis = useDataWriter('analysis');
	const writeMeta = useDataWriter('analysis_meta');
	const input = useInitialData<AnalyzeFeedbackInput>();

	useAgentStart(async ({ harness }) => {
		const startedAt = Date.now();
		const run = input.mode === 'C' ? await runResultMode(harness, input) : await runTextMode(harness, input);
		if (run.analysis) writeAnalysis(run.analysis);
		writeMeta({ mode: input.mode, ...run.meta, duration_ms: Date.now() - startedAt } satisfies AnalysisMeta);
	});

	// 실험용, 배포 전 제거: records the response's own usage so the main turn's cost can be measured.
	useResponseFinish(({ response }) => ({ response_usage: response.usage }));

	// The harness shares this system prompt, so it stays neutral. The "reply 완료"
	// instruction travels in the dispatched message, which the harness never sees.
	return '너는 수정 피드백 분석 에이전트 혹시요다.';
}

// The 180s harness signal is the real bound: timeoutMs is only checked between
// turns, so it backstops the whole submission including the main turn.
AnalyzeFeedback.durability = { maxAttempts: 2, timeoutMs: 240_000 };

AnalyzeFeedback.initialData = v.object({
	project_line: v.string(),
	feedback: v.string(),
	prior_feedback: v.optional(v.string()),
	mode: v.picklist(['C', 'B']), // 실험용, 배포 전 제거
});
