import { ratesFor } from '../analysis/models.ts';

// Daily Neurons budget. Every value can be set per environment (wrangler.jsonc
// `vars` for deploys, `.env` for local dev); the defaults below apply otherwise.
// The worst-case coefficients fit 14 glm-5.3 thinking-low runs in experiments/
// (2026-11-07-thinking-low, 2026-11-08-input-sender, 2026-11-08-integration):
// W(n) is 2.8-3.6x the largest run per sentence count and 2x what those runs
// would cost with no cached input. The 1,000 Neurons between the limit and the
// free 10,000 are extra margin. Recorded usage matched the Cloudflare dashboard
// on 2026-11-07, so the correction factor is 1. Inputs over maxSentences are
// refused: runs were only observed up to 4 sentences.

export interface UsageEnv {
	DAILY_NEURON_LIMIT?: string;
	USAGE_WORST_BASE?: string;
	USAGE_WORST_PER_SENTENCE?: string;
	USAGE_CORRECTION_FACTOR?: string;
	MAX_SENTENCES?: string;
}

export interface UsageConfig {
	dailyLimit: number;
	worstBase: number;
	worstPerSentence: number;
	correction: number;
	maxSentences: number;
}

const DEFAULTS: UsageConfig = {
	dailyLimit: 9_000,
	worstBase: 1_800,
	worstPerSentence: 400,
	correction: 1,
	maxSentences: 12,
};

function positive(value: string | undefined, fallback: number, name: string): number {
	if (value === undefined || value.trim() === '') return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`[hoksiyo] ${name} must be a positive number: "${value}"`);
	return parsed;
}

export function readUsageConfig(env: UsageEnv): UsageConfig {
	return {
		dailyLimit: positive(env.DAILY_NEURON_LIMIT, DEFAULTS.dailyLimit, 'DAILY_NEURON_LIMIT'),
		worstBase: positive(env.USAGE_WORST_BASE, DEFAULTS.worstBase, 'USAGE_WORST_BASE'),
		worstPerSentence: positive(env.USAGE_WORST_PER_SENTENCE, DEFAULTS.worstPerSentence, 'USAGE_WORST_PER_SENTENCE'),
		correction: positive(env.USAGE_CORRECTION_FACTOR, DEFAULTS.correction, 'USAGE_CORRECTION_FACTOR'),
		maxSentences: Math.floor(positive(env.MAX_SENTENCES, DEFAULTS.maxSentences, 'MAX_SENTENCES')),
	};
}

export interface TokenUsage {
	input: number;
	output: number;
	cacheRead?: number;
}

// Neurons as computed from recorded token counts, before correction.
export function recordedNeurons(model: string, usage: TokenUsage): number {
	const rates = ratesFor(model);
	return (
		(usage.input * rates.inputPerM + (usage.cacheRead ?? 0) * rates.cachedPerM + usage.output * rates.outputPerM) / 1e6
	);
}

// W(n), corrected: what one analysis of n sentences is reserved against the budget.
export function worstCase(sentences: number, config: UsageConfig): number {
	return (config.worstBase + config.worstPerSentence * sentences) * config.correction;
}

// The most sentences one analysis may have: the configured cap, and no more
// than still fits in an empty day.
export function maxSentences(config: UsageConfig): number {
	const fits = Math.floor((config.dailyLimit / config.correction - config.worstBase) / config.worstPerSentence);
	return Math.max(0, Math.min(config.maxSentences, fits));
}

// Output the model could have produced while running for elapsedMs, corrected.
export function elapsedEstimate(model: string, elapsedMs: number, config: UsageConfig): number {
	const rates = ratesFor(model);
	return ((elapsedMs / 1000) * rates.maxOutputTokensPerSecond * rates.outputPerM * config.correction) / 1e6;
}

export interface ChargeInput {
	sentences: number;
	config: UsageConfig;
	analysisModel: string;
	mainTurnModel: string;
	finished: boolean;
	harnessUsage?: TokenUsage;
	mainTurnUsage?: TokenUsage;
	elapsedMs: number;
}

export interface Charge {
	neurons: number;
	basis: 'measured' | 'worst_case' | 'elapsed_estimate';
}

// What a finished analysis adds to the daily total. A run without trustworthy
// usage (timeout, abort, give_up, failed submission) is charged
// max(W(n), elapsed-time estimate, whatever was recorded).
export function charge(input: ChargeInput): Charge {
	const { config } = input;
	const main = input.mainTurnUsage ? recordedNeurons(input.mainTurnModel, input.mainTurnUsage) * config.correction : 0;
	const harness = input.harnessUsage ? recordedNeurons(input.analysisModel, input.harnessUsage) * config.correction : 0;
	if (input.finished && input.harnessUsage) return { neurons: harness + main, basis: 'measured' };
	const worst = worstCase(input.sentences, config);
	const elapsed = elapsedEstimate(input.analysisModel, input.elapsedMs, config);
	const neurons = Math.max(worst, elapsed, harness + main);
	return { neurons, basis: elapsed > worst && elapsed >= harness + main ? 'elapsed_estimate' : 'worst_case' };
}

export function utcDate(nowMs: number): string {
	return new Date(nowMs).toISOString().slice(0, 10);
}

export function nextResetIso(nowMs: number): string {
	const next = new Date(utcDate(nowMs) + 'T00:00:00.000Z');
	next.setUTCDate(next.getUTCDate() + 1);
	return next.toISOString();
}
